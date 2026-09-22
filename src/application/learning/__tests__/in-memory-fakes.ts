/**
 * In-memory fakes for the learning application layer's persistence ports.
 *
 * These prove APPLICATION-LAYER orchestration semantics only (idempotency
 * short-circuiting, ownership validation, rollback-on-error, "domain
 * engine called only for genuine new Attempts"). They do NOT prove
 * PostgreSQL locking/concurrency behavior — JavaScript is single-threaded,
 * so `acquireLearnerQuestionLock` here is a no-op that only records it was
 * called, and there is no way for two `runInTransaction` calls to actually
 * interleave the way two real concurrent DB transactions could. Real
 * concurrency correctness (the advisory lock actually serializing two
 * simultaneous first Attempts) remains documented in ADR-010 and requires
 * integration testing against real Postgres, not asserted here.
 *
 * Rollback is represented honestly: `runInTransaction` snapshots the whole
 * in-memory database before calling `fn`, and restores that snapshot if
 * `fn` throws — the same "all or nothing" guarantee a real transaction
 * gives, implemented with a plain deep clone rather than real WAL/MVCC.
 */

import type { UserQuestionProgress } from "../../../domain/learning/types";
import type {
  AnswerCorrectnessChecker,
  Attempt,
  AttemptReplayRecord,
  AttemptRepository,
  DailyPlanAnswerRepository,
  DailyPlanAnswerTarget,
  QuestionVersionRepository,
  TransactionalRepositories,
  UnitOfWork,
  UserQuestionProgressRepository,
} from "../ports";

function progressKey(userId: string, questionId: string): string {
  return `${userId}:${questionId}`;
}

interface InMemoryState {
  attempts: Map<string, Attempt>; // by (userId, submissionId) composite key
  attemptsById: Map<string, Attempt>;
  createdAtByAttemptId: Map<string, Date>;
  progress: Map<string, UserQuestionProgress>;
  dailyPlanItems: Map<string, DailyPlanAnswerTarget>;
  correctAnswersByVersion: Map<string, string | number | null>;
  currentVersionByQuestion: Map<string, string>;
  /** questionVersionId -> the Question/Course it actually belongs to. */
  versionContext: Map<string, { questionId: string; courseId: string }>;
  questionCourse: Map<string, string>;
}

function cloneState(state: InMemoryState): InMemoryState {
  return structuredClone(state);
}

// Deterministic, monotonically increasing default createdAt — matches
// realistic DB behavior (insertion order == acceptance order by default)
// without ever calling Date.now(). Tests needing exact control over the
// createdAt tie-break use `setCreatedAt` to override a specific Attempt's
// value after insertion.
let nextCreatedAtOffsetMs = 0;
function nextDefaultCreatedAt(): Date {
  return new Date(Date.UTC(2026, 0, 1, 0, 0, 0, 0) + nextCreatedAtOffsetMs++);
}

export class InMemoryLearningDatabase implements UnitOfWork {
  private state: InMemoryState = {
    attempts: new Map(),
    attemptsById: new Map(),
    createdAtByAttemptId: new Map(),
    progress: new Map(),
    dailyPlanItems: new Map(),
    correctAnswersByVersion: new Map(),
    currentVersionByQuestion: new Map(),
    versionContext: new Map(),
    questionCourse: new Map(),
  };

  public lockCalls: Array<{ userId: string; questionId: string }> = [];

  /** Test setup helper — not part of any port. */
  setCorrectAnswer(
    questionVersionId: string,
    correctAnswer: string | number | null,
  ): void {
    this.state.correctAnswersByVersion.set(questionVersionId, correctAnswer);
  }

  /** Test setup helper — not part of any port. */
  setCurrentVersion(questionId: string, versionId: string): void {
    this.state.currentVersionByQuestion.set(questionId, versionId);
  }

  /**
   * Test setup helper — not part of any port. Registers which
   * Question/Course a QuestionVersion actually belongs to, backing
   * `resolveVersionContext` (the QuestionVersion/Question/Course
   * consistency check `submitAnswer` performs).
   */
  setQuestionVersion(
    questionVersionId: string,
    questionId: string,
    courseId: string,
  ): void {
    this.state.versionContext.set(questionVersionId, { questionId, courseId });
    this.state.questionCourse.set(questionId, courseId);
  }

  /** Test setup helper — not part of any port. */
  setQuestionCourse(questionId: string, courseId: string): void {
    this.state.questionCourse.set(questionId, courseId);
  }

  /**
   * Test setup helper — not part of any port. Registers a DailyPlanItem
   * directly — `submitAnswer`'s `dailyPlanItems` port only ever needs
   * `findItemById`/`markCompleted`.
   */
  seedDailyPlanItem(item: DailyPlanAnswerTarget): void {
    this.state.dailyPlanItems.set(item.id, { ...item });
  }

  /** Test-only inspection helper — not part of any port. */
  getDailyPlanItem(itemId: string): DailyPlanAnswerTarget | null {
    return this.state.dailyPlanItems.get(itemId) ?? null;
  }

  /** Test setup helper — not part of any port. */
  seedProgress(progress: UserQuestionProgress): void {
    this.state.progress.set(
      progressKey(progress.userId, progress.questionId),
      progress,
    );
  }

  /** Test-only inspection helper — not part of any port. */
  hasAttempt(userId: string, submissionId: string): boolean {
    return this.state.attempts.has(`${userId}:${submissionId}`);
  }

  /**
   * Test-only override — not part of any port. Overrides a specific
   * Attempt's `createdAt` (only meaningful for exercising the
   * `answeredAt`-tie / `createdAt`-tie-break ordering precisely); normal
   * tests never need this, since insertion already gets a deterministic,
   * monotonically increasing default.
   */
  setCreatedAt(attemptId: string, createdAt: Date): void {
    this.state.createdAtByAttemptId.set(attemptId, createdAt);
  }

  async runInTransaction<T>(
    fn: (repos: TransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const snapshot = cloneState(this.state);
    try {
      return await fn(this.makeRepos());
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }

  private makeRepos(): TransactionalRepositories {
    const attempts: AttemptRepository = {
      insertIfNotExists: async (attempt) => {
        const key = `${attempt.userId}:${attempt.submissionId}`;
        const existing = this.state.attempts.get(key);
        if (existing) {
          return { attempt: existing, wasNew: false };
        }
        this.state.attempts.set(key, attempt);
        this.state.attemptsById.set(attempt.id, attempt);
        this.state.createdAtByAttemptId.set(attempt.id, nextDefaultCreatedAt());
        return { attempt, wasNew: true };
      },
      findByUserAndSubmissionId: async (userId, submissionId) => {
        return this.state.attempts.get(`${userId}:${submissionId}`) ?? null;
      },
      listForReplay: async (userId, questionId) => {
        const records: AttemptReplayRecord[] = [];
        for (const attempt of this.state.attemptsById.values()) {
          if (attempt.userId !== userId || attempt.questionId !== questionId) {
            continue;
          }
          const createdAt =
            this.state.createdAtByAttemptId.get(attempt.id) ?? attempt.answeredAt;
          records.push({ attempt, createdAt });
        }
        return records;
      },
    };

    const progress: UserQuestionProgressRepository = {
      getForUpdate: async (userId, questionId) => {
        return this.state.progress.get(progressKey(userId, questionId)) ?? null;
      },
      upsert: async (p) => {
        this.state.progress.set(progressKey(p.userId, p.questionId), p);
      },
      listForUser: async (userId, courseId) => {
        const results: UserQuestionProgress[] = [];
        for (const p of this.state.progress.values()) {
          if (p.userId !== userId) continue;
          if (this.state.questionCourse.get(p.questionId) !== courseId) {
            continue;
          }
          results.push(p);
        }
        return results;
      },
    };

    const answerCorrectness: AnswerCorrectnessChecker = {
      isCorrect: async (questionVersionId, selectedAnswer) => {
        return (
          this.state.correctAnswersByVersion.get(questionVersionId) ===
          selectedAnswer
        );
      },
    };

    const questionVersions: QuestionVersionRepository = {
      getCurrentVersion: async (questionId) => {
        const versionId = this.state.currentVersionByQuestion.get(questionId);
        if (versionId === undefined) return null;
        return { questionId, versionId };
      },
      resolveVersionContext: async (questionVersionId) => {
        return this.state.versionContext.get(questionVersionId) ?? null;
      },
    };

    const dailyPlanItems: DailyPlanAnswerRepository = {
      findItemById: async (itemId) => {
        const item = this.state.dailyPlanItems.get(itemId);
        return item ? { ...item } : null;
      },
      markCompleted: async (itemId, completedAt) => {
        const item = this.state.dailyPlanItems.get(itemId);
        if (item === undefined) {
          return { outcome: "NOT_FOUND" };
        }
        if (item.status !== "pending") {
          return { outcome: "ALREADY_RESOLVED", item: { status: item.status } };
        }
        item.status = "completed";
        void completedAt; // not separately modeled on this minimal fake shape
        return { outcome: "RESOLVED" };
      },
      markSkipped: async (itemId, skippedAt) => {
        const item = this.state.dailyPlanItems.get(itemId);
        if (item === undefined) {
          return { outcome: "NOT_FOUND" };
        }
        if (item.status !== "pending") {
          return { outcome: "ALREADY_RESOLVED", item: { status: item.status } };
        }
        item.status = "skipped";
        void skippedAt; // not separately modeled on this minimal fake shape
        return { outcome: "RESOLVED" };
      },
    };

    return {
      acquireLearnerQuestionLock: async (userId, questionId) => {
        this.lockCalls.push({ userId, questionId });
      },
      attempts,
      progress,
      answerCorrectness,
      questionVersions,
      dailyPlanItems,
    };
  }
}

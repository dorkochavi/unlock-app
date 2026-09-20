/**
 * In-memory fakes for the DailyPlan GENERATION application layer's
 * persistence ports — mirrors
 * `src/application/learning/__tests__/in-memory-fakes.ts`'s established
 * pattern (snapshot/restore rollback, sequential test ids, no real DB, no
 * real concurrency).
 *
 * These prove APPLICATION-LAYER orchestration semantics only: existing-plan
 * resume, multi-Course pooling, freeze/idempotency, and rollback-on-error.
 * They do NOT prove PostgreSQL race-freedom of
 * `DailyPlanRepository.createIfNotExists`'s real
 * `INSERT ... ON CONFLICT DO NOTHING` — that requires real-Postgres
 * integration testing, not implemented by this slice (see
 * `daily-plan-repository.ts`'s own module doc comment).
 *
 * Rollback is represented honestly, exactly like the learning fakes:
 * `runInTransaction` snapshots the whole in-memory database before calling
 * `fn`, and restores that snapshot if `fn` throws.
 */
import { canResolveDailyPlanItem } from "../../../domain/dailyPlan/types";
import type { UserQuestionProgress } from "../../../domain/learning/types";
import type {
  QuestionVersionRepository,
  UserQuestionProgressRepository,
} from "../../learning/ports";
import type {
  DailyPlan,
  DailyPlanItem,
  DailyPlanKey,
  DailyPlanRepository,
  DailyPlanTransactionalRepositories,
  DailyPlanUnitOfWork,
  ResolveDailyPlanItemResult,
  UnseenQuestionCandidate,
  UnseenQuestionRepository,
} from "../ports";

function dailyPlanKeyString(key: DailyPlanKey): string {
  return `${key.userId}:${key.plannedForDate}`;
}

function progressKey(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

interface InMemoryState {
  dailyPlans: Map<string, DailyPlan>;
  progressByCourse: Map<string, UserQuestionProgress[]>;
  currentVersionByQuestion: Map<string, string>;
  /**
   * Pre-seeded eligible-unseen pool, keyed by courseId — this fake proves
   * ORCHESTRATION only (does the generation core call this port correctly,
   * merge/sort/limit across Courses correctly), not the real "no real
   * Attempt exists" SQL logic itself (that is
   * `supabase/tests/postgres/unseen-question-repository.test.ts`'s job). A
   * test seeds exactly the candidates that should already be considered
   * eligible-unseen.
   */
  unseenByCourse: Map<string, UnseenQuestionCandidate[]>;
}

function cloneState(state: InMemoryState): InMemoryState {
  return structuredClone(state);
}

let nextId = 1;
function makeSequentialId(prefix: string): string {
  return `${prefix}-${nextId++}`;
}

export class InMemoryDailyPlanDatabase implements DailyPlanUnitOfWork {
  private state: InMemoryState = {
    dailyPlans: new Map(),
    progressByCourse: new Map(),
    currentVersionByQuestion: new Map(),
    unseenByCourse: new Map(),
  };

  /** Test-only call counter — assert the fallback path is/isn't reached. */
  findUnseenQuestionsCallCount = 0;

  /** Test setup helper — not part of any port. */
  seedUnseenQuestion(courseId: string, candidate: UnseenQuestionCandidate): void {
    const existing = this.state.unseenByCourse.get(courseId) ?? [];
    existing.push(candidate);
    this.state.unseenByCourse.set(courseId, existing);
  }

  /**
   * Test-only, deliberately NOT part of `state` — configuration for a
   * simulated concurrent-winner race (test H), not application data, so it
   * must survive a `runInTransaction` snapshot/restore unchanged.
   */
  private concurrentWinners = new Map<string, DailyPlan>();

  /** Test-only — forces `dailyPlans.createIfNotExists` to throw after writing (test G). */
  shouldFailOnCreateIfNotExists = false;

  /** Test-only call counters — assert "no re-read on resume" (test A). */
  findByKeyCallCount = 0;
  listForUserCallCount = 0;
  getCurrentVersionCallCount = 0;

  /** Test setup helper — not part of any port. */
  seedProgress(courseId: string, progress: UserQuestionProgress): void {
    const key = progressKey(progress.userId, courseId);
    const existing = this.state.progressByCourse.get(key) ?? [];
    existing.push(progress);
    this.state.progressByCourse.set(key, existing);
  }

  /** Test setup helper — not part of any port. */
  setCurrentVersion(questionId: string, versionId: string): void {
    this.state.currentVersionByQuestion.set(questionId, versionId);
  }

  /**
   * Test setup helper — not part of any port. Simulates another
   * transaction having already won the race to create this exact
   * `(userId, plannedForDate)` DailyPlan, so the NEXT `createIfNotExists`
   * call against this key returns `winner` instead of the locally
   * generated plan/items — mirroring
   * `PostgresDailyPlanRepository.createIfNotExists`'s documented "loses
   * the race -> caller-supplied plan/items silently discarded" contract.
   */
  seedConcurrentWinner(key: DailyPlanKey, winner: DailyPlan): void {
    this.concurrentWinners.set(dailyPlanKeyString(key), winner);
  }

  /** Test-only inspection helper — not part of any port. */
  hasDailyPlan(key: DailyPlanKey): boolean {
    return this.state.dailyPlans.has(dailyPlanKeyString(key));
  }

  async runInTransaction<T>(
    fn: (repos: DailyPlanTransactionalRepositories) => Promise<T>,
  ): Promise<T> {
    const snapshot = cloneState(this.state);
    try {
      return await fn(this.makeRepos());
    } catch (error) {
      this.state = snapshot;
      throw error;
    }
  }

  private async resolveItem(
    itemId: string,
    resolvedAt: Date,
    status: "completed" | "skipped",
    completedAt: Date | null,
  ): Promise<ResolveDailyPlanItemResult> {
    for (const plan of this.state.dailyPlans.values()) {
      const item = plan.items.find((i) => i.id === itemId);
      if (!item) continue;
      if (!canResolveDailyPlanItem(item.status)) {
        return { outcome: "ALREADY_RESOLVED", item };
      }
      item.status = status;
      item.resolvedAt = resolvedAt;
      item.completedAt = completedAt;
      return { outcome: "RESOLVED", item };
    }
    return { outcome: "NOT_FOUND" };
  }

  private makeRepos(): DailyPlanTransactionalRepositories {
    const dailyPlans: DailyPlanRepository = {
      findByKey: async (key) => {
        this.findByKeyCallCount++;
        return this.state.dailyPlans.get(dailyPlanKeyString(key)) ?? null;
      },
      createIfNotExists: async (plan, items) => {
        const key = dailyPlanKeyString({
          userId: plan.userId,
          plannedForDate: plan.plannedForDate,
        });

        const winner = this.concurrentWinners.get(key);
        if (winner) {
          this.state.dailyPlans.set(key, winner);
          return winner;
        }

        const existing = this.state.dailyPlans.get(key);
        if (existing) {
          return existing;
        }

        const planId = makeSequentialId("daily-plan");
        const fullItems: DailyPlanItem[] = items.map((item) => ({
          ...item,
          id: makeSequentialId("daily-plan-item"),
          dailyPlanId: planId,
        }));
        const fullPlan: DailyPlan = { ...plan, id: planId, items: fullItems };
        // Written BEFORE the forced-failure check, deliberately — this is
        // what makes test G an honest proof of rollback: the write really
        // happens against `this.state`, and only `runInTransaction`'s
        // snapshot/restore (not this method declining to write) is what
        // makes it disappear on a thrown error.
        this.state.dailyPlans.set(key, fullPlan);
        if (this.shouldFailOnCreateIfNotExists) {
          throw new Error(
            "InMemoryDailyPlanDatabase: forced createIfNotExists failure",
          );
        }
        return fullPlan;
      },
      findItemById: async (itemId) => {
        for (const plan of this.state.dailyPlans.values()) {
          const item = plan.items.find((i) => i.id === itemId);
          if (item) return item;
        }
        return null;
      },
      markCompleted: async (itemId, completedAt) =>
        this.resolveItem(itemId, completedAt, "completed", completedAt),
      markSkipped: async (itemId, skippedAt) =>
        this.resolveItem(itemId, skippedAt, "skipped", null),
    };

    const progress: UserQuestionProgressRepository = {
      getForUpdate: async () => {
        throw new Error(
          "InMemoryDailyPlanDatabase: getForUpdate is not used by DailyPlan generation",
        );
      },
      upsert: async () => {
        throw new Error(
          "InMemoryDailyPlanDatabase: upsert is not used by DailyPlan generation",
        );
      },
      listForUser: async (userId, courseId) => {
        this.listForUserCallCount++;
        return [
          ...(this.state.progressByCourse.get(progressKey(userId, courseId)) ?? []),
        ];
      },
    };

    const questionVersions: QuestionVersionRepository = {
      getCurrentVersion: async (questionId) => {
        this.getCurrentVersionCallCount++;
        const versionId = this.state.currentVersionByQuestion.get(questionId);
        if (versionId === undefined) return null;
        return { questionId, versionId };
      },
      resolveVersionContext: async () => {
        throw new Error(
          "InMemoryDailyPlanDatabase: resolveVersionContext is not used by DailyPlan generation",
        );
      },
    };

    const unseenQuestions: UnseenQuestionRepository = {
      findUnseenQuestions: async (userId, courseId, limit) => {
        void userId; // this fake's pool is pre-filtered by the test itself
        this.findUnseenQuestionsCallCount++;
        const candidates = [...(this.state.unseenByCourse.get(courseId) ?? [])];
        candidates.sort((a, b) => {
          const byCreatedAt = a.createdAt.getTime() - b.createdAt.getTime();
          if (byCreatedAt !== 0) return byCreatedAt;
          return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0;
        });
        return candidates.slice(0, limit);
      },
    };

    return { dailyPlans, progress, questionVersions, unseenQuestions };
  }
}

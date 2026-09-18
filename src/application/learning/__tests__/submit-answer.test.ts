import { describe, expect, it } from "vitest";
import type { EvidenceStrengthPolicy } from "../../../domain/learning/evidence-strength";
import type { MasteryPolicy } from "../../../domain/learning/mastery";
import type { MisconceptionPolicy } from "../../../domain/learning/misconception";
import type { RetrievalQualificationPolicy } from "../../../domain/learning/retrieval-qualification";
import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../../../domain/learning/scheduler";
import type { TransactionalRepositories, UnitOfWork } from "../ports";
import {
  submitAnswer,
  type SubmitAnswerCommand,
  type SubmitAnswerContext,
} from "../submit-answer";
import { InMemoryLearningDatabase } from "./in-memory-fakes";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-02-01T00:00:00.000Z");

const TEST_RETRIEVAL_QUALIFICATION_POLICY: RetrievalQualificationPolicy = {
  minGapMsForSpacedRetrieval: 1 * DAY_MS,
};
const TEST_EVIDENCE_STRENGTH_POLICY: EvidenceStrengthPolicy = {
  minMeaningfulAttemptsForEarly: 1,
  minMeaningfulAttemptsForModerate: 3,
  minMeaningfulAttemptsForStrong: 5,
  minSpacedRetrievalsForModerate: 1,
  minSpacedRetrievalsForStrong: 3,
  minObservationSpanMsForStrong: 3 * DAY_MS,
};
const TEST_MASTERY_POLICY: MasteryPolicy = {
  minSpacedRetrievalsForStrengthening: 1,
  minSpacedRetrievalsForMastered: 3,
  minEvidenceStrengthForMastered: "strong",
  minRetrievabilityForMastered: 0.8,
};
const TEST_MISCONCEPTION_POLICY: MisconceptionPolicy = {
  confidentErrorScoreIncrement: 2,
  recoveryScoreDecrement: 1,
  minScore: 0,
  maxScore: 10,
  suspectedScoreThreshold: 2,
  activeScoreThreshold: 4,
  resolvedScoreThreshold: 0,
};

class FakeMemoryScheduler implements MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryReviewResult {
    return {
      previousState: null,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
      nextState: {
        stability: 1,
        difficulty: 5,
        scheduledReviewAt: new Date(input.reviewedAt.getTime() + DAY_MS),
        lastReviewAt: input.reviewedAt,
        reviewCount: 1,
        lapseCount: input.rating === "AGAIN" ? 1 : 0,
        implementationState: {
          implementation: "fake",
          schemaVersion: 1,
          state: {},
        },
      },
    };
  }
  review(state: SchedulerMemoryState, input: ReviewEvidence): MemoryReviewResult {
    return {
      previousState: state,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
      nextState: {
        ...state,
        lastReviewAt: input.reviewedAt,
        reviewCount: state.reviewCount + 1,
        lapseCount: state.lapseCount + (input.rating === "AGAIN" ? 1 : 0),
      },
    };
  }
  estimateRetrievability(): number {
    return 0.9;
  }
}

function makeContext(
  overrides: Partial<SubmitAnswerContext> = {},
): SubmitAnswerContext {
  let counter = 0;
  return {
    now: NOW,
    engineVersion: "test-engine-v1",
    memoryScheduler: new FakeMemoryScheduler(),
    retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
    evidenceStrengthPolicy: TEST_EVIDENCE_STRENGTH_POLICY,
    masteryPolicy: TEST_MASTERY_POLICY,
    misconceptionPolicy: TEST_MISCONCEPTION_POLICY,
    generateId: () => `attempt-${++counter}`,
    determineSuspiciousTiming: () => false,
    ...overrides,
  };
}

function makeCommand(
  overrides: Partial<SubmitAnswerCommand> = {},
): SubmitAnswerCommand {
  return {
    submissionId: "sub-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "qv-1",
    answeredAt: NOW,
    selectedAnswer: "A",
    confidenceLevel: "medium",
    responseTimeSeconds: 10,
    todaySessionId: null,
    todaySessionItemId: null,
    learningSessionId: null,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    answerWasRevealedBeforeResponse: false,
    ...overrides,
  };
}

/** Registers the default "question-1"/"qv-1"/"course-1" triple most tests use. */
function seedDefaultQuestion(db: InMemoryLearningDatabase): void {
  db.setQuestionVersion("qv-1", "question-1", "course-1");
}

const JAN1 = new Date("2026-01-01T00:00:00.000Z");
const JAN2 = new Date("2026-01-02T00:00:00.000Z");
const JAN3 = new Date("2026-01-03T00:00:00.000Z");

describe("submitAnswer", () => {
  it("1. a new submission creates exactly one Attempt", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(makeCommand(), makeContext(), db);

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind === "ACCEPTED") {
      expect(result.wasIdempotentRetry).toBe(false);
      expect(result.attempt.isCorrect).toBe(true);
      expect(result.progress.attemptCount).toBe(1);
      expect(db.hasAttempt("user-1", "sub-1")).toBe(true);
    }
  });

  it("2. a duplicate identical submission returns idempotently without double-processing", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();
    const command = makeCommand();

    const first = await submitAnswer(command, context, db);
    const second = await submitAnswer(command, context, db);

    expect(first.kind).toBe("ACCEPTED");
    expect(second.kind).toBe("ACCEPTED");
    if (first.kind === "ACCEPTED" && second.kind === "ACCEPTED") {
      expect(second.wasIdempotentRetry).toBe(true);
      expect(second.attempt.id).toBe(first.attempt.id);
      expect(second.progress).toEqual(first.progress);
    }
  });

  it("retry short-circuit: a genuine retry never invokes isCorrect/suspiciousTiming or the consistency checks a second time", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();
    const command = makeCommand();

    const first = await submitAnswer(command, context, db);
    expect(first.kind).toBe("ACCEPTED");

    // A broken UnitOfWork whose answerCorrectness/questionVersions throw —
    // if the retry fast path is working, these are never reached for the
    // SECOND call, so no throw occurs.
    let isCorrectCalls = 0;
    let resolveVersionCalls = 0;
    const spyingUow: UnitOfWork = {
      runInTransaction: <T>(
        fn: (repos: TransactionalRepositories) => Promise<T>,
      ) =>
        db.runInTransaction((repos) => {
          const spyingRepos: TransactionalRepositories = {
            ...repos,
            answerCorrectness: {
              isCorrect: async (...args) => {
                isCorrectCalls++;
                return repos.answerCorrectness.isCorrect(...args);
              },
            },
            questionVersions: {
              ...repos.questionVersions,
              resolveVersionContext: async (...args) => {
                resolveVersionCalls++;
                return repos.questionVersions.resolveVersionContext(...args);
              },
            },
          };
          return fn(spyingRepos);
        }),
    };

    const retry = await submitAnswer(command, context, spyingUow);

    expect(retry.kind).toBe("ACCEPTED");
    if (retry.kind === "ACCEPTED") {
      expect(retry.wasIdempotentRetry).toBe(true);
    }
    expect(isCorrectCalls).toBe(0);
    expect(resolveVersionCalls).toBe(0);
  });

  it("3. the same submissionId with a different logical command is rejected as an idempotency-key conflict", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();
    await submitAnswer(makeCommand({ selectedAnswer: "A" }), context, db);

    const result = await submitAnswer(
      makeCommand({ selectedAnswer: "B" }),
      context,
      db,
    );

    expect(result.kind).toBe("IDEMPOTENCY_KEY_CONFLICT");
    if (result.kind === "IDEMPOTENCY_KEY_CONFLICT") {
      expect(result.conflictingFields).toContain("selectedAnswer");
    }
  });

  it("J. two intentional answers to the same question with different submissionIds are BOTH retained as distinct Attempts (contrast with test 2's same-submissionId dedup)", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    const first = await submitAnswer(
      makeCommand({ submissionId: "sub-first", selectedAnswer: "A", answeredAt: JAN1 }),
      context,
      db,
    );
    const second = await submitAnswer(
      makeCommand({ submissionId: "sub-second", selectedAnswer: "A", answeredAt: JAN2 }),
      context,
      db,
    );

    expect(first.kind).toBe("ACCEPTED");
    expect(second.kind).toBe("ACCEPTED");
    if (first.kind === "ACCEPTED" && second.kind === "ACCEPTED") {
      // Two genuinely different Attempt ids/submissionIds, not the same
      // record returned twice (unlike an idempotent retry — see test 2).
      expect(second.attempt.id).not.toBe(first.attempt.id);
      expect(db.hasAttempt("user-1", "sub-first")).toBe(true);
      expect(db.hasAttempt("user-1", "sub-second")).toBe(true);
      // Both contributed to accumulated history — progress reflects two
      // Attempts, not one overwritten by the other.
      expect(second.progress.attemptCount).toBe(2);
    }
  });

  it("a malformed selectedAnswer (duplicate ids) is rejected as INVALID_SELECTED_ANSWER end-to-end through submitAnswer, never treated as isCorrect: false", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      makeCommand({ selectedAnswer: ["a", "a"] }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    // No Attempt was ever created for a request that was never actually
    // graded — a malformed submission must not silently become "incorrect".
    expect(db.hasAttempt("user-1", "sub-1")).toBe(false);
  });

  it("a MULTIPLE_CHOICE retry with the SAME set submitted in a DIFFERENT array order is a safe idempotent retry, not an idempotency-key conflict (ADR-014's array-aware comparison)", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    const context = makeContext();

    const first = await submitAnswer(
      makeCommand({ selectedAnswer: ["a", "c"] }),
      context,
      db,
    );
    const retry = await submitAnswer(
      makeCommand({ selectedAnswer: ["c", "a"] }), // same set, different order
      context,
      db,
    );

    expect(first.kind).toBe("ACCEPTED");
    expect(retry.kind).toBe("ACCEPTED");
    if (retry.kind === "ACCEPTED") {
      expect(retry.wasIdempotentRetry).toBe(true);
      // Persisted in canonical (sorted) form, regardless of submission order.
      expect(retry.attempt.selectedAnswer).toEqual(["a", "c"]);
    }
  });

  it("7. manual practice (no TodaySessionItem) is accepted normally", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      makeCommand({ todaySessionId: null, todaySessionItemId: null }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
  });

  it("an Attempt claiming a TodaySessionItem belonging to another user is rejected", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");

    const session = await db.runInTransaction((repos) =>
      repos.todaySessions.createIfNotExists(
        {
          userId: "someone-else",
          courseId: "course-1",
          plannedForDate: "2026-01-10",
          status: "prepared",
          engineVersion: "v1",
          generatedAt: NOW,
          startedAt: null,
          completedAt: null,
        },
        [
          {
            userId: "someone-else",
            position: 0,
            questionId: "question-1",
            questionVersionId: "qv-1",
            actionType: "REVIEW_DUE",
            tier: "DUE_REVIEW",
            otherApplicableTypes: [],
            reasons: ["SCHEDULED_REVIEW_DUE"],
            status: "pending",
            completedAt: null,
          },
        ],
      ),
    );
    const itemId = session.items[0].id;

    const result = await submitAnswer(
      makeCommand({ userId: "user-1", todaySessionItemId: itemId }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED");
  });

  it("a QuestionVersion belonging to a DIFFERENT Question is rejected", async () => {
    const db = new InMemoryLearningDatabase();
    db.setQuestionVersion("qv-1", "question-OTHER", "course-1");
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      makeCommand({ questionId: "question-1", questionVersionId: "qv-1" }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("QUESTION_VERSION_CONSISTENCY_VIOLATION");
    expect(db.hasAttempt("user-1", "sub-1")).toBe(false);
  });

  it("a courseId that does not match the QuestionVersion's actual Course is rejected", async () => {
    const db = new InMemoryLearningDatabase();
    // qv-1 belongs to question-1, which is actually in "course-REAL".
    db.setQuestionVersion("qv-1", "question-1", "course-REAL");
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      makeCommand({ courseId: "course-WRONG" }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("QUESTION_VERSION_CONSISTENCY_VIOLATION");
    expect(db.hasAttempt("user-1", "sub-1")).toBe(false);
  });

  it("a TodaySessionItem completed with a DIFFERENT questionVersionId than it was frozen with is rejected", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setQuestionVersion("qv-2", "question-1", "course-1");
    db.setCorrectAnswer("qv-1", "A");
    db.setCorrectAnswer("qv-2", "A");

    const session = await db.runInTransaction((repos) =>
      repos.todaySessions.createIfNotExists(
        {
          userId: "user-1",
          courseId: "course-1",
          plannedForDate: "2026-01-10",
          status: "prepared",
          engineVersion: "v1",
          generatedAt: NOW,
          startedAt: null,
          completedAt: null,
        },
        [
          {
            userId: "user-1",
            position: 0,
            questionId: "question-1",
            questionVersionId: "qv-1", // frozen at generation time
            actionType: "REVIEW_DUE",
            tier: "DUE_REVIEW",
            otherApplicableTypes: [],
            reasons: ["SCHEDULED_REVIEW_DUE"],
            status: "pending",
            completedAt: null,
          },
        ],
      ),
    );
    const itemId = session.items[0].id;

    // Attempt claims the frozen item but answers a DIFFERENT version.
    const result = await submitAnswer(
      makeCommand({
        questionVersionId: "qv-2",
        todaySessionId: session.id,
        todaySessionItemId: itemId,
      }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED");
  });

  it("completing the final item marks the ITEM completed; session-level rollup is deliberately NOT implemented (deferred, see docs/DATABASE.md §17)", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    const session = await db.runInTransaction((repos) =>
      repos.todaySessions.createIfNotExists(
        {
          userId: "user-1",
          courseId: "course-1",
          plannedForDate: "2026-01-10",
          status: "prepared",
          engineVersion: "v1",
          generatedAt: NOW,
          startedAt: null,
          completedAt: null,
        },
        [
          {
            userId: "user-1",
            position: 0,
            questionId: "question-1",
            questionVersionId: "qv-1",
            actionType: "REVIEW_DUE",
            tier: "DUE_REVIEW",
            otherApplicableTypes: [],
            reasons: ["SCHEDULED_REVIEW_DUE"],
            status: "pending",
            completedAt: null,
          },
        ],
      ),
    );
    const itemId = session.items[0].id;

    await submitAnswer(
      makeCommand({ todaySessionId: session.id, todaySessionItemId: itemId }),
      context,
      db,
    );

    const finalItem = await db.runInTransaction((repos) =>
      repos.todaySessions.findItemById(itemId),
    );
    const finalSession = await db.runInTransaction((repos) =>
      repos.todaySessions.findByKey({
        userId: "user-1",
        courseId: "course-1",
        plannedForDate: "2026-01-10",
      }),
    );

    expect(finalItem?.status).toBe("completed");
    expect(finalSession?.status).toBe("prepared");
  });

  describe("learningSessionId persistence (tasks 1-3, adapted for the new string|null field)", () => {
    it("1. persists a real learningSessionId faithfully", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");

      const result = await submitAnswer(
        makeCommand({ learningSessionId: "session-abc" }),
        makeContext(),
        db,
      );

      expect(result.kind).toBe("ACCEPTED");
      if (result.kind === "ACCEPTED") {
        expect(result.attempt.learningSessionId).toBe("session-abc");
      }
    });

    it("3. persists learningSessionId = null faithfully", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");

      const result = await submitAnswer(
        makeCommand({ learningSessionId: null }),
        makeContext(),
        db,
      );

      expect(result.kind).toBe("ACCEPTED");
      if (result.kind === "ACCEPTED") {
        expect(result.attempt.learningSessionId).toBeNull();
      }
    });

    it("a retry with a different learningSessionId is rejected as an idempotency-key conflict", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");
      const context = makeContext();
      await submitAnswer(
        makeCommand({ learningSessionId: "session-a" }),
        context,
        db,
      );

      const result = await submitAnswer(
        makeCommand({ learningSessionId: "session-b" }),
        context,
        db,
      );

      expect(result.kind).toBe("IDEMPOTENCY_KEY_CONFLICT");
      if (result.kind === "IDEMPOTENCY_KEY_CONFLICT") {
        expect(result.conflictingFields).toContain("learningSessionId");
      }
    });
  });

  describe("learningSessionId ownership (pre-commit correctness audit)", () => {
    async function createTodaySessionWithItem(
      db: InMemoryLearningDatabase,
    ): Promise<{ sessionId: string; itemId: string }> {
      const session = await db.runInTransaction((repos) =>
        repos.todaySessions.createIfNotExists(
          {
            userId: "user-1",
            courseId: "course-1",
            plannedForDate: "2026-01-10",
            status: "prepared",
            engineVersion: "v1",
            generatedAt: NOW,
            startedAt: null,
            completedAt: null,
          },
          [
            {
              userId: "user-1",
              position: 0,
              questionId: "question-1",
              questionVersionId: "qv-1",
              actionType: "REVIEW_DUE",
              tier: "DUE_REVIEW",
              otherApplicableTypes: [],
              reasons: ["SCHEDULED_REVIEW_DUE"],
              status: "pending",
              completedAt: null,
            },
          ],
        ),
      );
      return { sessionId: session.id, itemId: session.items[0].id };
    }

    it("A: a client CANNOT change retrieval qualification by claiming a new learningSessionId on a Today-attached Attempt — the application always derives it from the TodaySessionItem's own todaySessionId", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");
      const context = makeContext();
      const { sessionId, itemId } = await createTodaySessionWithItem(db);

      const result = await submitAnswer(
        makeCommand({
          todaySessionId: sessionId,
          todaySessionItemId: itemId,
          // A malicious/buggy client claims an unrelated learningSessionId —
          // this must be ignored, not merely rejected.
          learningSessionId: "attacker-controlled-claim",
        }),
        context,
        db,
      );

      expect(result.kind).toBe("ACCEPTED");
      if (result.kind === "ACCEPTED") {
        // The persisted Attempt's learningSessionId is the TodaySession's
        // own id, never the client's claim (answers question D: Today
        // safely reuses todaySessionId as learningSessionId).
        expect(result.attempt.learningSessionId).toBe(sessionId);
        expect(result.attempt.learningSessionId).not.toBe(
          "attacker-controlled-claim",
        );
      }
    });

    it("B: a retry of a Today-attached Attempt with a DIFFERENT client-claimed learningSessionId is still treated as a safe idempotent retry, not a conflict", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");
      const context = makeContext();
      const { sessionId, itemId } = await createTodaySessionWithItem(db);

      const first = await submitAnswer(
        makeCommand({
          todaySessionId: sessionId,
          todaySessionItemId: itemId,
          learningSessionId: "claim-1",
        }),
        context,
        db,
      );
      const retry = await submitAnswer(
        makeCommand({
          todaySessionId: sessionId,
          todaySessionItemId: itemId,
          // Same submissionId (default "sub-1"), different (irrelevant)
          // client claim — must NOT be flagged as an idempotency conflict,
          // since the client never actually owned this field here.
          learningSessionId: "claim-2",
        }),
        context,
        db,
      );

      expect(first.kind).toBe("ACCEPTED");
      expect(retry.kind).toBe("ACCEPTED");
      if (retry.kind === "ACCEPTED") {
        expect(retry.wasIdempotentRetry).toBe(true);
        expect(retry.attempt.learningSessionId).toBe(sessionId);
      }
    });

    it("manual practice retains client ownership: a retry with a different learningSessionId IS still rejected as a conflict (regression, see the 'learningSessionId persistence' describe block above)", async () => {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");
      const context = makeContext();

      await submitAnswer(
        makeCommand({ learningSessionId: "manual-session-a" }),
        context,
        db,
      );
      const result = await submitAnswer(
        makeCommand({ learningSessionId: "manual-session-b" }),
        context,
        db,
      );

      expect(result.kind).toBe("IDEMPOTENCY_KEY_CONFLICT");
      if (result.kind === "IDEMPOTENCY_KEY_CONFLICT") {
        expect(result.conflictingFields).toContain("learningSessionId");
      }
    });
  });

  it("4. an ordinary chronological submission uses the O(1) incremental path, not a rebuild", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    const first = await submitAnswer(
      makeCommand({ submissionId: "sub-a", answeredAt: JAN1, learningSessionId: "sA" }),
      context,
      db,
    );
    const second = await submitAnswer(
      makeCommand({ submissionId: "sub-b", answeredAt: JAN2, learningSessionId: "sB" }),
      context,
      db,
    );

    expect(first.kind).toBe("ACCEPTED");
    expect(second.kind).toBe("ACCEPTED");
    if (first.kind === "ACCEPTED" && second.kind === "ACCEPTED") {
      expect(first.wasReconciledViaRebuild).toBe(false);
      expect(second.wasReconciledViaRebuild).toBe(false);
    }
  });

  it("5. an out-of-order Attempt is preserved as historical evidence", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2, learningSessionId: "sA" }),
      context,
      db,
    );
    const result = await submitAnswer(
      makeCommand({ submissionId: "sub-earlier", answeredAt: JAN1, learningSessionId: "sB" }),
      context,
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
    expect(db.hasAttempt("user-1", "sub-earlier")).toBe(true);
  });

  it("6. the out-of-order reconciliation path rebuilds progress including BOTH Attempts", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2, learningSessionId: "sA" }),
      context,
      db,
    );
    const result = await submitAnswer(
      makeCommand({ submissionId: "sub-earlier", answeredAt: JAN1, learningSessionId: "sB" }),
      context,
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind === "ACCEPTED") {
      expect(result.wasReconciledViaRebuild).toBe(true);
      // BOTH Attempts contributed — attemptCount is 2, not 1.
      expect(result.progress.attemptCount).toBe(2);
      // Canonical order: sub-earlier (Jan1, sB) sets baseline; sub-later
      // (Jan2, sA) qualifies (different session, 1-day gap).
      expect(result.progress.successfulSpacedRetrievals).toBe(1);
      expect(result.progress.retrievalBaselineLearningSessionId).toBe("sA");
    }
  });

  it("8/9. three Attempts arriving in order A,C,B (out-of-order) end with the SAME progress as arrival order A,B,C, deterministically", async () => {
    async function run(order: "ABC" | "ACB"): Promise<unknown> {
      const db = new InMemoryLearningDatabase();
      seedDefaultQuestion(db);
      db.setCorrectAnswer("qv-1", "A");
      const context = makeContext();

      const commands = {
        A: makeCommand({ submissionId: "sub-A", answeredAt: JAN1, learningSessionId: "sA" }),
        B: makeCommand({ submissionId: "sub-B", answeredAt: JAN2, learningSessionId: "sB" }),
        C: makeCommand({ submissionId: "sub-C", answeredAt: JAN3, learningSessionId: "sC" }),
      };
      const sequence = order === "ABC" ? ["A", "B", "C"] : ["A", "C", "B"];

      let last;
      for (const key of sequence) {
        last = await submitAnswer(
          commands[key as keyof typeof commands],
          context,
          db,
        );
      }
      return last && "kind" in last && last.kind === "ACCEPTED"
        ? last.progress
        : last;
    }

    const inOrderProgress = await run("ABC");
    const outOfOrderProgress = await run("ACB");

    expect(outOfOrderProgress).toEqual(inOrderProgress);

    // Determinism: running the out-of-order sequence again gives the same
    // result once more.
    const outOfOrderProgressAgain = await run("ACB");
    expect(outOfOrderProgressAgain).toEqual(inOrderProgress);
  });

  it("11. a retry does not cause another rebuild or progress increment", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2 }),
      context,
      db,
    );
    const outOfOrderCommand = makeCommand({
      submissionId: "sub-earlier",
      answeredAt: JAN1,
    });
    const first = await submitAnswer(outOfOrderCommand, context, db);
    const retry = await submitAnswer(outOfOrderCommand, context, db);

    expect(first.kind).toBe("ACCEPTED");
    expect(retry.kind).toBe("ACCEPTED");
    if (first.kind === "ACCEPTED" && retry.kind === "ACCEPTED") {
      expect(retry.wasIdempotentRetry).toBe(true);
      expect(retry.wasReconciledViaRebuild).toBe(false); // retry short-circuits before any rebuild
      expect(retry.progress).toEqual(first.progress); // unchanged, not re-rebuilt
    }
  });

  it("12. a failed rebuild rolls back the newly inserted out-of-order Attempt AND leaves progress unchanged", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2 }),
      context,
      db,
    );
    const progressBefore = await db.runInTransaction((repos) =>
      repos.progress.getForUpdate("user-1", "question-1"),
    );

    const brokenUow: UnitOfWork = {
      runInTransaction: <T>(
        fn: (repos: TransactionalRepositories) => Promise<T>,
      ) =>
        db.runInTransaction((repos) => {
          const brokenRepos: TransactionalRepositories = {
            ...repos,
            progress: {
              ...repos.progress,
              upsert: async () => {
                throw new Error("simulated progress upsert failure during rebuild");
              },
            },
          };
          return fn(brokenRepos);
        }),
    };

    await expect(
      submitAnswer(
        makeCommand({ submissionId: "sub-earlier", answeredAt: JAN1 }),
        context,
        brokenUow,
      ),
    ).rejects.toThrow("simulated progress upsert failure during rebuild");

    expect(db.hasAttempt("user-1", "sub-earlier")).toBe(false);
    const progressAfter = await db.runInTransaction((repos) =>
      repos.progress.getForUpdate("user-1", "question-1"),
    );
    expect(progressAfter).toEqual(progressBefore);
  });

  it("13. an unexpected repository error is never swallowed — it propagates rather than being converted into a SubmitAnswerResult", async () => {
    const context = makeContext();
    const brokenUow: UnitOfWork = {
      runInTransaction: async () => {
        throw new Error("simulated unexpected infrastructure failure");
      },
    };

    await expect(
      submitAnswer(makeCommand(), context, brokenUow),
    ).rejects.toThrow("simulated unexpected infrastructure failure");
  });

  it("15. a Today item is completed correctly by an out-of-order submission that successfully reconciles", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2 }),
      context,
      db,
    );

    const session = await db.runInTransaction((repos) =>
      repos.todaySessions.createIfNotExists(
        {
          userId: "user-1",
          courseId: "course-1",
          plannedForDate: "2026-01-10",
          status: "prepared",
          engineVersion: "v1",
          generatedAt: NOW,
          startedAt: null,
          completedAt: null,
        },
        [
          {
            userId: "user-1",
            position: 0,
            questionId: "question-1",
            questionVersionId: "qv-1",
            actionType: "REVIEW_DUE",
            tier: "DUE_REVIEW",
            otherApplicableTypes: [],
            reasons: ["SCHEDULED_REVIEW_DUE"],
            status: "pending",
            completedAt: null,
          },
        ],
      ),
    );
    const itemId = session.items[0].id;

    const result = await submitAnswer(
      makeCommand({
        submissionId: "sub-earlier",
        answeredAt: JAN1,
        todaySessionId: session.id,
        todaySessionItemId: itemId,
      }),
      context,
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind === "ACCEPTED") {
      expect(result.wasReconciledViaRebuild).toBe(true);
    }
    const item = await db.runInTransaction((repos) =>
      repos.todaySessions.findItemById(itemId),
    );
    expect(item?.status).toBe("completed");
    expect(item?.completedAt).toEqual(JAN1);
  });

  it("submitAnswer never chooses/creates a Question of its own — it only ever writes an Attempt for the exact questionId supplied", async () => {
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      makeCommand({ questionId: "question-1" }),
      makeContext(),
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind === "ACCEPTED") {
      expect(result.attempt.questionId).toBe("question-1");
      expect(result.progress.questionId).toBe("question-1");
    }
  });

  it("16. no permanent stale-progress result kind exists — an out-of-order submission always returns a normal ACCEPTED outcome", async () => {
    // Compile-time: SubmitAnswerResult's union no longer has an
    // ACCEPTED_BUT_OUT_OF_ORDER variant at all (removed from the type in
    // submit-answer.ts) — this test is the runtime confirmation that the
    // out-of-order path really does resolve to ACCEPTED now that
    // synchronous rebuild replaces the old permanently-stale behavior.
    const db = new InMemoryLearningDatabase();
    seedDefaultQuestion(db);
    db.setCorrectAnswer("qv-1", "A");
    const context = makeContext();

    await submitAnswer(
      makeCommand({ submissionId: "sub-later", answeredAt: JAN2 }),
      context,
      db,
    );
    const result = await submitAnswer(
      makeCommand({ submissionId: "sub-earlier", answeredAt: JAN1 }),
      context,
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
  });
});

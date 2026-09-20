/**
 * Unit tests for `submitDailyPlanItemAnswer` ITSELF — not `submitAnswer`
 * (already covered by `application/learning/__tests__/submit-answer.test.ts`)
 * and not the HTTP route (covered by the `handle-submit-daily-plan-item-
 * answer` / route-wiring test suites, which mock this function away
 * entirely). Found as a coverage gap by `unlock-security-reviewer`: every
 * other consumer of this file fakes it out, so its own pre-fetch/ownership
 * short-circuit and its field-mapping into `SubmitAnswerCommand` had no
 * dedicated test proving THIS file's own behavior (as opposed to
 * `submitAnswer`'s in-transaction re-check, which is independently correct
 * regardless of what this file does).
 *
 * Uses the REAL `submitAnswer` against the real in-memory
 * `InMemoryLearningDatabase` fake (not a mock of `submitAnswer` itself) —
 * this proves genuine end-to-end field mapping, not merely "this function
 * calls submitAnswer with something."
 */
import { describe, expect, it } from "vitest";

import { InMemoryLearningDatabase } from "../../learning/__tests__/in-memory-fakes";
import type { SubmitAnswerContext } from "../../learning/submit-answer";
import type { UnitOfWork } from "../../learning/ports";
import {
  submitDailyPlanItemAnswer,
  type DailyPlanItemAnswerLookup,
} from "../submit-daily-plan-item-answer";

const NOW = new Date("2026-02-01T00:00:00.000Z");

function makeContext(): SubmitAnswerContext {
  let counter = 0;
  return {
    now: NOW,
    engineVersion: "test-engine-v1",
    memoryScheduler: {
      initialize: (input) => ({
        previousState: null,
        rating: input.rating,
        reviewedAt: input.reviewedAt,
        nextState: {
          stability: 1,
          difficulty: 5,
          scheduledReviewAt: new Date(input.reviewedAt.getTime() + 86400000),
          lastReviewAt: input.reviewedAt,
          reviewCount: 1,
          lapseCount: 0,
          implementationState: { implementation: "fake", schemaVersion: 1, state: {} },
        },
      }),
      review: (state, input) => ({
        previousState: state,
        rating: input.rating,
        reviewedAt: input.reviewedAt,
        nextState: { ...state, lastReviewAt: input.reviewedAt, reviewCount: state.reviewCount + 1 },
      }),
      estimateRetrievability: () => 0.9,
    },
    retrievalQualificationPolicy: { minGapMsForSpacedRetrieval: 86400000 },
    evidenceStrengthPolicy: {
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 3,
      minMeaningfulAttemptsForStrong: 5,
      minSpacedRetrievalsForModerate: 1,
      minSpacedRetrievalsForStrong: 3,
      minObservationSpanMsForStrong: 3 * 86400000,
    },
    masteryPolicy: {
      minSpacedRetrievalsForStrengthening: 1,
      minSpacedRetrievalsForMastered: 3,
      minEvidenceStrengthForMastered: "strong",
      minRetrievabilityForMastered: 0.8,
    },
    misconceptionPolicy: {
      confidentErrorScoreIncrement: 2,
      recoveryScoreDecrement: 1,
      minScore: 0,
      maxScore: 10,
      suspectedScoreThreshold: 2,
      activeScoreThreshold: 4,
      resolvedScoreThreshold: 0,
    },
    generateId: () => `attempt-${++counter}`,
    determineSuspiciousTiming: () => false,
  };
}

/** A UnitOfWork that fails the test if it is ever invoked — proves the
 * not-found/not-owned short-circuit never reaches submitAnswer at all. */
const POISON_UOW: UnitOfWork = {
  runInTransaction: async () => {
    throw new Error(
      "submitAnswer must not be invoked for an item that failed the ownership pre-check",
    );
  },
};

describe("submitDailyPlanItemAnswer", () => {
  it("null item lookup: ITEM_NOT_FOUND_OR_NOT_OWNED, submitAnswer never invoked", async () => {
    const items: DailyPlanItemAnswerLookup = { findItemById: async () => null };

    const result = await submitDailyPlanItemAnswer(
      {
        userId: "user-1",
        dailyPlanItemId: "item-1",
        submissionId: "sub-1",
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: null,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      { items, context: makeContext(), uow: POISON_UOW },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
  });

  it("item owned by a DIFFERENT user: ITEM_NOT_FOUND_OR_NOT_OWNED, submitAnswer never invoked", async () => {
    const items: DailyPlanItemAnswerLookup = {
      findItemById: async (itemId) => ({
        id: itemId,
        dailyPlanId: "plan-1",
        userId: "someone-else",
        courseId: "course-1",
        questionId: "question-1",
        questionVersionId: "qv-1",
      }),
    };

    const result = await submitDailyPlanItemAnswer(
      {
        userId: "user-1",
        dailyPlanItemId: "item-1",
        submissionId: "sub-1",
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: null,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      { items, context: makeContext(), uow: POISON_UOW },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
  });

  it("matching owner: submitAnswer is invoked with the LOOKED-UP item's own courseId/questionId/questionVersionId/dailyPlanId — never a client-supplied value (there is none on this command's shape to begin with)", async () => {
    const db = new InMemoryLearningDatabase();
    db.setQuestionVersion("qv-real", "question-real", "course-real");
    db.setCorrectAnswer("qv-real", "A");
    // submitAnswer's OWN in-transaction re-check (defense-in-depth, separate
    // from this file's advisory pre-fetch below) needs its own matching
    // record — see the next test for what happens when the two disagree.
    db.seedDailyPlanItem({
      id: "item-1",
      dailyPlanId: "plan-real",
      userId: "user-1",
      courseId: "course-real",
      questionId: "question-real",
      questionVersionId: "qv-real",
      status: "pending",
    });

    const items: DailyPlanItemAnswerLookup = {
      findItemById: async (itemId) => {
        expect(itemId).toBe("item-1");
        return {
          id: itemId,
          dailyPlanId: "plan-real",
          userId: "user-1",
          courseId: "course-real",
          questionId: "question-real",
          questionVersionId: "qv-real",
        };
      },
    };

    const result = await submitDailyPlanItemAnswer(
      {
        userId: "user-1",
        dailyPlanItemId: "item-1",
        submissionId: "sub-1",
        selectedAnswer: "A",
        confidenceLevel: "medium",
        responseTimeSeconds: 5,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      { items, context: makeContext(), uow: db },
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(result.attempt.courseId).toBe("course-real");
    expect(result.attempt.questionId).toBe("question-real");
    expect(result.attempt.questionVersionId).toBe("qv-real");
    expect(result.attempt.dailyPlanId).toBe("plan-real");
    expect(result.attempt.dailyPlanItemId).toBe("item-1");
    expect(result.attempt.userId).toBe("user-1");
    expect(result.attempt.isCorrect).toBe(true);
    expect(result.attempt.todaySessionId).toBeNull();
    expect(result.attempt.todaySessionItemId).toBeNull();
    // attemptNumberForPresentedItem is hardcoded to 1 for this flow — a
    // DailyPlanItem resolves at most once, so there is no "second
    // presented attempt" concept for this command shape to express.
    expect(result.attempt.attemptNumberForPresentedItem).toBe(1);
  });

  it("real submitAnswer's own DailyPlanItem re-check still rejects a stale pre-fetch (defense-in-depth, not this file's job to duplicate)", async () => {
    const db = new InMemoryLearningDatabase();
    db.setQuestionVersion("qv-real", "question-real", "course-real");
    db.setCorrectAnswer("qv-real", "A");
    db.seedDailyPlanItem({
      id: "item-1",
      dailyPlanId: "plan-real",
      userId: "user-1",
      courseId: "course-real",
      questionId: "question-real",
      questionVersionId: "qv-real",
      status: "completed", // already resolved, unlike what the pre-fetch below claims
    });

    // A deliberately "stale" lookup that doesn't know the real item is
    // already resolved — simulates the documented race window between this
    // file's advisory pre-fetch and submitAnswer's own transaction.
    const items: DailyPlanItemAnswerLookup = {
      findItemById: async (itemId) => ({
        id: itemId,
        dailyPlanId: "plan-real",
        userId: "user-1",
        courseId: "course-real",
        questionId: "question-real",
        questionVersionId: "qv-real",
      }),
    };

    const result = await submitDailyPlanItemAnswer(
      {
        userId: "user-1",
        dailyPlanItemId: "item-1",
        submissionId: "sub-new",
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: null,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      { items, context: makeContext(), uow: db },
    );

    expect(result.kind).toBe("DAILY_PLAN_ITEM_ALREADY_RESOLVED");
  });
});

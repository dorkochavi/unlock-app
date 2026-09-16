import { describe, expect, it } from "vitest";
import { applyAttemptToProgress } from "../progress-update";
import type {
  InitialReviewInput,
  MemoryScheduler,
  MemoryReviewResult,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../scheduler";
import type { Attempt, UserQuestionProgress } from "../types";

/**
 * Deterministic, fully controllable fake. Real ts-fsrs behavior is already
 * covered by src/infrastructure/learning/fsrs — this suite is about
 * progress-update.ts's own logic, not FSRS's specific algorithm.
 */
class FakeMemoryScheduler implements MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryReviewResult {
    return {
      previousState: null,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
      nextState: {
        stability: 1,
        difficulty: 5,
        scheduledReviewAt: addDays(input.reviewedAt, 1),
        lastReviewAt: input.reviewedAt,
        reviewCount: 1,
        lapseCount: input.rating === "AGAIN" ? 1 : 0,
        implementationState: {
          implementation: "fake",
          schemaVersion: 1,
          state: { initializedWith: input.rating },
        },
      },
    };
  }

  review(
    state: SchedulerMemoryState,
    input: ReviewEvidence,
  ): MemoryReviewResult {
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

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    submissionId: "submission-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "question-version-1",
    answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    isCorrect: true,
    selectedAnswer: 1,
    confidenceLevel: "medium",
    responseTimeSeconds: 10,
    todaySessionId: null,
    todaySessionItemId: null,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "learning_engine_v1.0",
    ...overrides,
  };
}

function makeContext(scheduler: MemoryScheduler = new FakeMemoryScheduler()) {
  return {
    now: new Date("2026-01-01T00:05:00.000Z"),
    engineVersion: "learning_engine_v1.0",
    memoryScheduler: scheduler,
  };
}

describe("applyAttemptToProgress", () => {
  it("A. creates progress, increments counts, and initializes scheduler memory on a first clean correct attempt", () => {
    const attempt = makeAttempt({ isCorrect: true });
    const context = makeContext();

    const result = applyAttemptToProgress(null, attempt, context);

    expect(result.progress.userId).toBe("user-1");
    expect(result.progress.questionId).toBe("question-1");
    expect(result.progress.attemptCount).toBe(1);
    expect(result.progress.correctCount).toBe(1);
    expect(result.progress.lastAttemptAt).toEqual(attempt.answeredAt);
    expect(result.progress.lastCorrectAt).toEqual(attempt.answeredAt);
    expect(result.progress.lastIncorrectAt).toBeNull();
    expect(result.progress.memory).not.toBeNull();
    expect(result.progress.memory?.reviewCount).toBe(1);
    expect(result.reason).toBe("INITIAL_ATTEMPT");
    expect(result.progress.engineVersion).toBe("learning_engine_v1.0");
    expect(result.progress.updatedAt).toEqual(context.now);
  });

  it("B. reviews previous scheduler state rather than resetting it on a subsequent clean correct attempt", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: new Date("2026-01-01T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({ isCorrect: true, answeredAt: new Date("2026-01-05T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    expect(second.progress.memory?.reviewCount).toBe(2);
    expect(second.progress.attemptCount).toBe(2);
    expect(second.progress.correctCount).toBe(2);
  });

  it("C. handles a clean incorrect attempt against existing scheduler state as a LAPSE", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: new Date("2026-01-01T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "medium",
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler),
    );

    expect(second.progress.attemptCount).toBe(2);
    expect(second.progress.lastIncorrectAt).toEqual(
      new Date("2026-01-05T00:00:00.000Z"),
    );
    expect(second.schedulerRatingDecision).toMatchObject({
      kind: "RATED",
      rating: "AGAIN",
    });
    expect(second.progress.memory?.reviewCount).toBe(2);
    expect(second.reason).toBe("LAPSE");
    expect(second.progress.lapseCount).toBe(
      (first.progress.lapseCount ?? 0) + 1,
    );
    // Prior history is retained, not erased.
    expect(second.progress.correctCount).toBe(1);
  });

  it("D. surfaces CONFIDENT_ERROR for a clean (FULL_EVIDENCE) high-confidence wrong answer without inventing a misconception transition", () => {
    const attempt = makeAttempt({
      isCorrect: false,
      confidenceLevel: "high",
    });
    const previous: UserQuestionProgress | null = null;

    const result = applyAttemptToProgress(previous, attempt, makeContext());

    expect(result.evidence.quality).toBe("FULL_EVIDENCE");
    expect(result.reason).toBe("CONFIDENT_ERROR");
    expect(result.progress.misconceptionState).toBe("none");
    expect(result.progress.misconceptionScore).toBe(0);
  });

  it("D2. does not surface CONFIDENT_ERROR for an assisted high-confidence wrong answer", () => {
    const attempt = makeAttempt({
      isCorrect: false,
      confidenceLevel: "high",
      assistanceUsed: "FIFTY_FIFTY",
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("ASSISTED_EVIDENCE");
    expect(result.reason).not.toBe("CONFIDENT_ERROR");
    expect(result.progress.misconceptionState).toBe("none");
    expect(result.progress.misconceptionScore).toBe(0);
  });

  it("D3. does not surface CONFIDENT_ERROR for a second-attempt high-confidence wrong answer", () => {
    const attempt = makeAttempt({
      isCorrect: false,
      confidenceLevel: "high",
      attemptNumberForPresentedItem: 2,
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("LOW_QUALITY_EVIDENCE");
    expect(result.reason).not.toBe("CONFIDENT_ERROR");
    expect(result.progress.misconceptionState).toBe("none");
    expect(result.progress.misconceptionScore).toBe(0);
  });

  it("D4. does not surface CONFIDENT_ERROR for a revealed-answer high-confidence wrong answer", () => {
    const attempt = makeAttempt({
      isCorrect: false,
      confidenceLevel: "high",
      assistanceUsed: "ANSWER_REVEALED",
      answerWasRevealedBeforeResponse: true,
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("INVALID_FOR_MASTERY");
    expect(result.reason).not.toBe("CONFIDENT_ERROR");
    expect(result.progress.misconceptionState).toBe("none");
    expect(result.progress.misconceptionScore).toBe(0);
  });

  it("E. treats assisted correct answers as ASSISTED_SUCCESS without advancing scheduler memory", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: new Date("2026-01-01T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeContext(scheduler),
    );

    expect(second.progress.attemptCount).toBe(2);
    expect(second.progress.correctCount).toBe(2);
    expect(second.schedulerRatingDecision.kind).toBe("NOT_RATABLE");
    expect(second.progress.memory?.reviewCount).toBe(
      first.progress.memory?.reviewCount,
    );
    expect(second.reason).toBe("ASSISTED_SUCCESS");
  });

  it("F. treats a second-attempt correct answer as updating history without advancing scheduler memory", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: false, answeredAt: new Date("2026-01-01T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        attemptNumberForPresentedItem: 2,
        answeredAt: new Date("2026-01-01T00:00:30.000Z"),
      }),
      makeContext(scheduler),
    );

    expect(second.progress.attemptCount).toBe(2);
    expect(second.progress.correctCount).toBe(1);
    expect(second.schedulerRatingDecision.kind).toBe("NOT_RATABLE");
    expect(second.progress.memory?.reviewCount).toBe(
      first.progress.memory?.reviewCount,
    );
  });

  it("G. does not increase timedAttemptCount or pollute the average when response time is missing", () => {
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ responseTimeSeconds: 10 }),
      makeContext(),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({ responseTimeSeconds: null }),
      makeContext(),
    );

    expect(second.progress.timedAttemptCount).toBe(1);
    expect(second.progress.averageResponseTimeSeconds).toBe(10);
  });

  it("H. computes a running average using only timed attempts", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ responseTimeSeconds: 10 }),
      makeContext(scheduler),
    );
    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({ responseTimeSeconds: null }),
      makeContext(scheduler),
    );
    const third = applyAttemptToProgress(
      second.progress,
      makeAttempt({ responseTimeSeconds: 30 }),
      makeContext(scheduler),
    );

    expect(third.progress.timedAttemptCount).toBe(2);
    expect(third.progress.averageResponseTimeSeconds).toBe(20);
  });

  it("I. preserves implementationState through a subsequent review", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true }),
      makeContext(scheduler),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({ isCorrect: true, answeredAt: new Date("2026-01-05T00:00:00.000Z") }),
      makeContext(scheduler),
    );

    expect(second.progress.memory?.implementationState.state).toEqual({
      initializedWith: "GOOD",
    });
    expect(second.progress.memory?.implementationState.implementation).toBe(
      "fake",
    );
  });

  it("J. is deterministic for the same inputs", () => {
    const attempt = makeAttempt({ isCorrect: true });

    const resultA = applyAttemptToProgress(null, attempt, makeContext());
    const resultB = applyAttemptToProgress(null, attempt, makeContext());

    expect(resultA.progress).toEqual(resultB.progress);
    expect(resultA.reason).toEqual(resultB.reason);
    expect(resultA.schedulerRatingDecision).toEqual(
      resultB.schedulerRatingDecision,
    );
  });
});

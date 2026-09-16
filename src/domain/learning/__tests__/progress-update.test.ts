import { describe, expect, it } from "vitest";
import type { EvidenceStrengthPolicy } from "../evidence-strength";
import { applyAttemptToProgress } from "../progress-update";
import type { RetrievalQualificationPolicy } from "../retrieval-qualification";
import type {
  InitialReviewInput,
  MemoryScheduler,
  MemoryReviewResult,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../scheduler";
import type { Attempt, UserQuestionProgress } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function makeContext(
  scheduler: MemoryScheduler = new FakeMemoryScheduler(),
  isSameLearningSession: boolean | null = false,
) {
  return {
    now: new Date("2026-01-01T00:05:00.000Z"),
    engineVersion: "learning_engine_v1.0",
    memoryScheduler: scheduler,
    retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
    isSameLearningSession,
    evidenceStrengthPolicy: TEST_EVIDENCE_STRENGTH_POLICY,
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

describe("applyAttemptToProgress — retrieval qualification integration", () => {
  it("A. sets the retrieval baseline on a first clean correct retrieval without counting it as spaced", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.retrievalQualification.reason).toBe("NO_PRIOR_RETRIEVAL");
    expect(result.progress.retrievalBaselineAt).toEqual(attempt.answeredAt);
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
    expect(result.progress.memory?.reviewCount).toBe(1);
  });

  it("B. counts a second clean correct retrieval in a different session with a sufficient gap as qualifying", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(second.progress.successfulSpacedRetrievals).toBe(1);
    expect(second.progress.retrievalBaselineAt).toEqual(
      new Date("2026-01-03T00:00:00.000Z"),
    );
    expect(second.reason).toBe("SPACED_RETRIEVAL_SUCCESS");
  });

  it("C. does not increment or move the baseline for a same-session correct retrieval, even with a large gap", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-10T00:00:00.000Z"),
      }),
      makeContext(scheduler, true),
    );

    expect(second.retrievalQualification.reason).toBe("SAME_SESSION");
    expect(second.progress.successfulSpacedRetrievals).toBe(0);
    expect(second.progress.retrievalBaselineAt).toEqual(
      first.progress.retrievalBaselineAt,
    );
  });

  it("D. does not increment or move the baseline when the gap is too short, even in a different session", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T12:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.retrievalQualification.reason).toBe("GAP_TOO_SHORT");
    expect(second.progress.successfulSpacedRetrievals).toBe(0);
    expect(second.progress.retrievalBaselineAt).toEqual(
      first.progress.retrievalBaselineAt,
    );
  });

  it("E. does not set or move the baseline for an assisted correct answer", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      assistanceUsed: "FIFTY_FIFTY",
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.retrievalQualification.reason).toBe("NOT_FULL_EVIDENCE");
    expect(result.progress.retrievalBaselineAt).toBeNull();
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
  });

  it("F. does not set or move the baseline for a second-attempt correct answer", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      attemptNumberForPresentedItem: 2,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.retrievalQualification.reason).toBe("NOT_FULL_EVIDENCE");
    expect(result.progress.retrievalBaselineAt).toBeNull();
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
  });

  it("G. does not set or move the baseline for an incorrect attempt", () => {
    const attempt = makeAttempt({
      isCorrect: false,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.retrievalQualification.reason).toBe("INCORRECT");
    expect(result.progress.retrievalBaselineAt).toBeNull();
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
  });

  it("H. does not increment or move the baseline when session identity is unknown", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, null),
    );

    expect(second.retrievalQualification.reason).toBe("SESSION_UNKNOWN");
    expect(second.progress.successfulSpacedRetrievals).toBe(0);
    expect(second.progress.retrievalBaselineAt).toEqual(
      first.progress.retrievalBaselineAt,
    );
  });

  it("I. compares the next retrieval against the latest baseline, not the original one", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(second.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(second.progress.retrievalBaselineAt).toEqual(
      new Date("2026-01-03T00:00:00.000Z"),
    );

    // A gap that would have qualified against the ORIGINAL baseline
    // (2026-01-01, >1 day away) but not against the NEW baseline
    // (2026-01-03) must be rejected as too short.
    const third = applyAttemptToProgress(
      second.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T12:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(third.retrievalQualification.reason).toBe("GAP_TOO_SHORT");
    expect(third.retrievalQualification.gapMs).toBe(12 * 60 * 60 * 1000);
    expect(third.progress.successfulSpacedRetrievals).toBe(1);
  });

  it("J. increments successfulSpacedRetrievals from its existing value rather than resetting it", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(second.progress.successfulSpacedRetrievals).toBe(1);

    const third = applyAttemptToProgress(
      second.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-06T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(third.progress.successfulSpacedRetrievals).toBe(2);
  });

  it("K. is deterministic for identical inputs including retrieval qualification", () => {
    const previous = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(new FakeMemoryScheduler(), false),
    ).progress;

    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-03T00:00:00.000Z"),
    });

    const resultA = applyAttemptToProgress(
      previous,
      attempt,
      makeContext(new FakeMemoryScheduler(), false),
    );
    const resultB = applyAttemptToProgress(
      previous,
      attempt,
      makeContext(new FakeMemoryScheduler(), false),
    );

    expect(resultA.progress).toEqual(resultB.progress);
    expect(resultA.retrievalQualification).toEqual(
      resultB.retrievalQualification,
    );
    expect(resultA.reason).toEqual(resultB.reason);
  });
});

describe("applyAttemptToProgress — evidence summary counters", () => {
  it("A. increments meaningfulAttemptCount on a first FULL_EVIDENCE attempt", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("FULL_EVIDENCE");
    expect(result.progress.meaningfulAttemptCount).toBe(1);
  });

  it("B. increments meaningfulAttemptCount again on a later FULL_EVIDENCE attempt", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: false,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.evidence.quality).toBe("FULL_EVIDENCE");
    expect(second.progress.meaningfulAttemptCount).toBe(2);
  });

  it("C. increments assistedAttemptCount but not meaningfulAttemptCount for ASSISTED_EVIDENCE", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      assistanceUsed: "FIFTY_FIFTY",
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("ASSISTED_EVIDENCE");
    expect(result.progress.assistedAttemptCount).toBe(1);
    expect(result.progress.meaningfulAttemptCount).toBe(0);
  });

  it("D. increments lowQualityAttemptCount but not meaningfulAttemptCount for LOW_QUALITY_EVIDENCE", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      attemptNumberForPresentedItem: 2,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("LOW_QUALITY_EVIDENCE");
    expect(result.progress.lowQualityAttemptCount).toBe(1);
    expect(result.progress.meaningfulAttemptCount).toBe(0);
  });

  it("E. increments invalidForMasteryAttemptCount but no other evidence counter for INVALID_FOR_MASTERY", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      assistanceUsed: "ANSWER_REVEALED",
      answerWasRevealedBeforeResponse: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.evidence.quality).toBe("INVALID_FOR_MASTERY");
    expect(result.progress.invalidForMasteryAttemptCount).toBe(1);
    expect(result.progress.meaningfulAttemptCount).toBe(0);
    expect(result.progress.assistedAttemptCount).toBe(0);
    expect(result.progress.lowQualityAttemptCount).toBe(0);
  });

  it("F. sets firstMeaningfulEvidenceAt once and preserves it across later meaningful attempts", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(first.progress.firstMeaningfulEvidenceAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.progress.firstMeaningfulEvidenceAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );
  });

  it("G. advances lastMeaningfulEvidenceAt only on meaningful evidence", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(first.progress.lastMeaningfulEvidenceAt).toEqual(
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: false,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.evidence.quality).toBe("FULL_EVIDENCE");
    expect(second.progress.lastMeaningfulEvidenceAt).toEqual(
      new Date("2026-01-05T00:00:00.000Z"),
    );
  });

  it("H. does not move firstMeaningfulEvidenceAt or lastMeaningfulEvidenceAt for assisted/low-quality/invalid attempts", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const assisted = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(assisted.progress.firstMeaningfulEvidenceAt).toEqual(
      first.progress.firstMeaningfulEvidenceAt,
    );
    expect(assisted.progress.lastMeaningfulEvidenceAt).toEqual(
      first.progress.lastMeaningfulEvidenceAt,
    );

    const lowQuality = applyAttemptToProgress(
      assisted.progress,
      makeAttempt({
        isCorrect: true,
        attemptNumberForPresentedItem: 2,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(lowQuality.progress.firstMeaningfulEvidenceAt).toEqual(
      first.progress.firstMeaningfulEvidenceAt,
    );
    expect(lowQuality.progress.lastMeaningfulEvidenceAt).toEqual(
      first.progress.lastMeaningfulEvidenceAt,
    );

    const invalid = applyAttemptToProgress(
      lowQuality.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "ANSWER_REVEALED",
        answerWasRevealedBeforeResponse: true,
        answeredAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(invalid.progress.firstMeaningfulEvidenceAt).toEqual(
      first.progress.firstMeaningfulEvidenceAt,
    );
    expect(invalid.progress.lastMeaningfulEvidenceAt).toEqual(
      first.progress.lastMeaningfulEvidenceAt,
    );
  });

  it("H2. keeps firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt correct under out-of-order processing", () => {
    // Regression test: nothing guarantees Attempts are applied in
    // answeredAt order (replay/backfill/import can reorder them). These
    // fields must reflect chronological evidence time regardless.
    //
    // Uses FULL_EVIDENCE INCORRECT Attempts deliberately: they are still
    // meaningful evidence for evidence-summary counters/timestamps, but
    // retrieval-qualification rejects incorrect Attempts (its INCORRECT
    // gate) before ever establishing/comparing retrievalBaselineAt. That
    // keeps this test purely about evidence-summary chronology, without
    // touching or working around retrieval-qualification's own, separate,
    // intentionally strict backwards-time guard (see
    // retrieval-qualification.test.ts test M) — no fixture mutation needed.
    const scheduler = new FakeMemoryScheduler();
    const laterAnsweredAt = new Date("2026-01-10T00:00:00.000Z");
    const earlierAnsweredAt = new Date("2026-01-01T00:00:00.000Z");

    const processedLaterFirst = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: false, answeredAt: laterAnsweredAt }),
      makeContext(scheduler, false),
    );
    expect(processedLaterFirst.evidence.quality).toBe("FULL_EVIDENCE");
    expect(processedLaterFirst.retrievalQualification.reason).toBe(
      "INCORRECT",
    );
    expect(processedLaterFirst.progress.retrievalBaselineAt).toBeNull();
    expect(processedLaterFirst.progress.meaningfulAttemptCount).toBe(1);
    expect(processedLaterFirst.progress.firstMeaningfulEvidenceAt).toEqual(
      laterAnsweredAt,
    );
    expect(processedLaterFirst.progress.lastMeaningfulEvidenceAt).toEqual(
      laterAnsweredAt,
    );

    const thenProcessedEarlier = applyAttemptToProgress(
      processedLaterFirst.progress,
      makeAttempt({ isCorrect: false, answeredAt: earlierAnsweredAt }),
      makeContext(scheduler, false),
    );

    expect(thenProcessedEarlier.evidence.quality).toBe("FULL_EVIDENCE");
    expect(thenProcessedEarlier.retrievalQualification.reason).toBe(
      "INCORRECT",
    );
    expect(thenProcessedEarlier.progress.retrievalBaselineAt).toBeNull();
    expect(thenProcessedEarlier.progress.meaningfulAttemptCount).toBe(2);
    expect(thenProcessedEarlier.progress.firstMeaningfulEvidenceAt).toEqual(
      earlierAnsweredAt,
    );
    expect(thenProcessedEarlier.progress.lastMeaningfulEvidenceAt).toEqual(
      laterAnsweredAt,
    );
  });

  it("I. preserves and increments existing counters rather than resetting them", () => {
    const scheduler = new FakeMemoryScheduler();
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(first.progress.assistedAttemptCount).toBe(1);

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "HINT",
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(second.progress.assistedAttemptCount).toBe(2);
  });

  it("J. is deterministic for identical inputs including evidence summary counters", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const resultA = applyAttemptToProgress(null, attempt, makeContext());
    const resultB = applyAttemptToProgress(null, attempt, makeContext());

    expect(resultA.progress).toEqual(resultB.progress);
  });

  it("K. keeps evidence-category counters internally coherent with attemptCount", () => {
    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        attemptNumberForPresentedItem: 2,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "ANSWER_REVEALED",
        answerWasRevealedBeforeResponse: true,
        answeredAt: new Date("2026-01-04T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: false,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    const { progress } = result;
    expect(progress.attemptCount).toBe(5);
    expect(
      progress.meaningfulAttemptCount +
        progress.assistedAttemptCount +
        progress.lowQualityAttemptCount +
        progress.invalidForMasteryAttemptCount,
    ).toBe(progress.attemptCount);
  });
});

describe("applyAttemptToProgress — evidence strength integration", () => {
  it("A. moves evidenceStrength from insufficient to early on a first meaningful attempt", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = applyAttemptToProgress(null, attempt, makeContext());

    expect(result.progress.evidenceStrength).toBe("early");
    expect(result.evidenceStrengthResult.reasons).toEqual(["EARLY_EVIDENCE"]);
  });

  it("B. does not let an assisted-only history become moderate/strong", () => {
    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    for (let day = 2; day <= 6; day += 1) {
      result = applyAttemptToProgress(
        result.progress,
        makeAttempt({
          isCorrect: true,
          assistanceUsed: "HINT",
          answeredAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
        }),
        makeContext(scheduler, false),
      );
    }

    expect(result.progress.meaningfulAttemptCount).toBe(0);
    expect(result.progress.evidenceStrength).toBe("insufficient");
    expect(result.evidenceStrengthResult.reasons).toEqual([
      "ASSISTANCE_HEAVY",
    ]);
  });

  it("C. does not let a low-quality-only history become moderate/strong", () => {
    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        attemptNumberForPresentedItem: 2,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    for (let day = 2; day <= 6; day += 1) {
      result = applyAttemptToProgress(
        result.progress,
        makeAttempt({
          isCorrect: true,
          attemptNumberForPresentedItem: 2,
          answeredAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
        }),
        makeContext(scheduler, false),
      );
    }

    expect(result.progress.meaningfulAttemptCount).toBe(0);
    expect(result.progress.evidenceStrength).toBe("insufficient");
    expect(result.evidenceStrengthResult.reasons).toEqual([
      "ASSISTANCE_HEAVY",
    ]);
  });

  it("D. lets a qualifying spaced retrieval move evidenceStrength upward", () => {
    const scheduler = new FakeMemoryScheduler();

    // attempt1: baseline set, meaningful=1 -> early
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(result.progress.evidenceStrength).toBe("early");

    // attempt2: different session, 2-day gap -> qualifies; spaced=1,
    // meaningful=2 (still below moderate's 3-attempt gate) -> stays early.
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(result.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(result.progress.evidenceStrength).toBe("early");

    // attempt3: different session, 2-day gap -> qualifies; spaced=2,
    // meaningful=3 crosses moderate's attempt AND spacing gates together.
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(result.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(result.progress.successfulSpacedRetrievals).toBe(2);
    expect(result.progress.meaningfulAttemptCount).toBe(3);
    expect(result.progress.evidenceStrength).toBe("moderate");
  });

  it("E. lets a long-enough observation span contribute when policy requires it", () => {
    // Bespoke policy isolating span: attempt/spacing gates are trivially
    // met at 1 meaningful attempt / 0 spaced retrievals, so only span and
    // session diversity can still block "strong".
    const spanTestPolicy: EvidenceStrengthPolicy = {
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 1,
      minMeaningfulAttemptsForStrong: 1,
      minSpacedRetrievalsForModerate: 0,
      minSpacedRetrievalsForStrong: 0,
      minObservationSpanMsForStrong: 3 * DAY_MS,
    };
    const contextWith = (scheduler: MemoryScheduler) => ({
      now: new Date("2026-01-01T00:05:00.000Z"),
      engineVersion: "learning_engine_v1.0",
      memoryScheduler: scheduler,
      retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
      isSameLearningSession: false,
      evidenceStrengthPolicy: spanTestPolicy,
    });

    const scheduler = new FakeMemoryScheduler();

    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      contextWith(scheduler),
    );
    // Only 1 meaningful attempt so far: span is 0ms (first === last),
    // below the 3-day threshold -> capped at moderate.
    expect(first.progress.evidenceStrength).toBe("moderate");
    expect(first.evidenceStrengthResult.reasons).toContain(
      "INSUFFICIENT_OBSERVATION_SPAN",
    );

    const second = applyAttemptToProgress(
      first.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      contextWith(scheduler),
    );
    // 4-day gap: qualifies as spaced (confirms cross-session diversity)
    // AND pushes observationSpanMs to 4 days, above the 3-day threshold.
    expect(second.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(second.progress.evidenceStrength).toBe("strong");
    expect(second.evidenceStrengthResult.reasons).toEqual([
      "STRONG_EVIDENCE",
    ]);
  });

  it("F. does not let same-session-only evidence become strong", () => {
    // Bespoke policy: spacing/span thresholds trivially met, so only the
    // session-diversity gate can still block "strong".
    const sessionTestPolicy: EvidenceStrengthPolicy = {
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 3,
      minMeaningfulAttemptsForStrong: 5,
      minSpacedRetrievalsForModerate: 0,
      minSpacedRetrievalsForStrong: 0,
      minObservationSpanMsForStrong: null,
    };
    const contextWith = (scheduler: MemoryScheduler) => ({
      now: new Date("2026-01-01T00:05:00.000Z"),
      engineVersion: "learning_engine_v1.0",
      memoryScheduler: scheduler,
      retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
      isSameLearningSession: true,
      evidenceStrengthPolicy: sessionTestPolicy,
    });

    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      contextWith(scheduler),
    );
    for (let day = 2; day <= 5; day += 1) {
      result = applyAttemptToProgress(
        result.progress,
        makeAttempt({
          isCorrect: true,
          answeredAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
        }),
        contextWith(scheduler),
      );
    }

    expect(result.progress.meaningfulAttemptCount).toBe(5);
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
    expect(result.progress.evidenceStrength).toBe("moderate");
    expect(result.progress.evidenceStrength).not.toBe("strong");
  });

  it("G. does not let unknown session diversity optimistically become strong", () => {
    const sessionTestPolicy: EvidenceStrengthPolicy = {
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 3,
      minMeaningfulAttemptsForStrong: 5,
      minSpacedRetrievalsForModerate: 0,
      minSpacedRetrievalsForStrong: 0,
      minObservationSpanMsForStrong: null,
    };
    const contextWith = (scheduler: MemoryScheduler) => ({
      now: new Date("2026-01-01T00:05:00.000Z"),
      engineVersion: "learning_engine_v1.0",
      memoryScheduler: scheduler,
      retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
      isSameLearningSession: null,
      evidenceStrengthPolicy: sessionTestPolicy,
    });

    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      contextWith(scheduler),
    );
    for (let day = 2; day <= 5; day += 1) {
      result = applyAttemptToProgress(
        result.progress,
        makeAttempt({
          isCorrect: true,
          answeredAt: new Date(`2026-01-0${day}T00:00:00.000Z`),
        }),
        contextWith(scheduler),
      );
    }

    expect(result.retrievalQualification.reason).toBe("SESSION_UNKNOWN");
    expect(result.progress.meaningfulAttemptCount).toBe(5);
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
    expect(result.progress.evidenceStrength).toBe("moderate");
    expect(result.evidenceStrengthResult.reasons).toContain(
      "SESSION_DIVERSITY_UNKNOWN",
    );
  });

  it("H. lets the current Attempt affect the newly-derived evidenceStrength immediately", () => {
    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(result.progress.meaningfulAttemptCount).toBe(2);
    expect(result.progress.evidenceStrength).toBe("early");

    // The 3rd meaningful attempt, processed in this single call, must be
    // reflected in THIS SAME result — not lagging one call behind.
    const third = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-05T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    expect(third.progress.meaningfulAttemptCount).toBe(3);
    expect(third.progress.evidenceStrength).toBe("moderate");
  });

  it("I. is deterministic for identical inputs including evidenceStrength", () => {
    const attempt = makeAttempt({
      isCorrect: true,
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const resultA = applyAttemptToProgress(null, attempt, makeContext());
    const resultB = applyAttemptToProgress(null, attempt, makeContext());

    expect(resultA.progress.evidenceStrength).toEqual(
      resultB.progress.evidenceStrength,
    );
    expect(resultA.evidenceStrengthResult).toEqual(
      resultB.evidenceStrengthResult,
    );
  });

  it("J. recomputes evidenceStrength from current derived state rather than blindly preserving it", () => {
    const first = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(),
    );
    expect(first.progress.evidenceStrength).toBe("early");

    // Simulate stale/corrupted persisted state: evidenceStrength claims
    // "strong" even though the underlying counters do not support it.
    const staleProgress: UserQuestionProgress = {
      ...first.progress,
      evidenceStrength: "strong",
    };

    // A non-meaningful attempt that does not change any counter driving
    // evidence strength.
    const result = applyAttemptToProgress(
      staleProgress,
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
        answeredAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
      makeContext(),
    );

    expect(result.progress.evidenceStrength).toBe("early");
    expect(result.progress.evidenceStrength).not.toBe("strong");
  });

  it("K. leaves masteryCategory unchanged", () => {
    const scheduler = new FakeMemoryScheduler();
    let result = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );
    expect(result.progress.masteryCategory).toBe("not_started");

    result = applyAttemptToProgress(
      result.progress,
      makeAttempt({
        isCorrect: true,
        answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      }),
      makeContext(scheduler, false),
    );

    // evidenceStrength may have changed; masteryCategory must not have.
    expect(result.progress.masteryCategory).toBe("not_started");
  });
});

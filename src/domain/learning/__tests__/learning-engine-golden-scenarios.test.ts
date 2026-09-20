/**
 * End-to-end Golden Scenario tests for the learner-state core.
 *
 * These tests treat `applyAttemptToProgress` (progress-update.ts) as the
 * single learner-state pipeline:
 *
 *   Attempt -> Evidence -> Scheduler -> Retrieval Qualification
 *   -> Evidence Summary -> Evidence Strength -> Misconception -> Mastery
 *
 * and verify that realistic, multi-day, multi-Attempt learner journeys
 * make every subsystem evolve coherently TOGETHER — not that any one
 * module's formula is correct in isolation (that is already covered by
 * evidence.test.ts, retrieval-qualification.test.ts, evidence-strength.
 * test.ts, misconception.test.ts, mastery.test.ts, and progress-update.
 * test.ts's per-module integration suites).
 *
 * Policy values here intentionally match the TEST_* policies already
 * established and hand-verified in progress-update.test.ts, so the
 * arithmetic traced there stays valid here. No new/different thresholds
 * are invented (docs/OPEN_QUESTIONS.md #12/#13 remain open — these are
 * still test-local policies, not production defaults).
 */

import { describe, expect, it } from "vitest";
import type { EvidenceStrengthPolicy } from "../evidence-strength";
import type { MasteryPolicy } from "../mastery";
import type { MisconceptionPolicy } from "../misconception";
import {
  applyAttemptToProgress,
  type ProgressUpdateResult,
} from "../progress-update";
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
const BASE_DATE = new Date("2026-01-01T00:00:00.000Z");

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

/**
 * Deterministic, fully controllable fake, matching progress-update.test.ts.
 * Real ts-fsrs behavior is covered elsewhere (src/infrastructure/learning/
 * fsrs) — these scenarios are about cross-module learner-state behavior,
 * not FSRS's specific algorithm. Retrievability is fixed at 0.9 (above the
 * 0.8 mastered gate) so mastery-blocking in these scenarios is always
 * attributable to spacing/evidence-strength/unresolved-lapse, never to a
 * retrievability swing this fake doesn't model.
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
  return new Date(date.getTime() + days * DAY_MS);
}

function atDay(day: number): Date {
  return addDays(BASE_DATE, day);
}

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    submissionId: "submission-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "question-version-1",
    answeredAt: BASE_DATE,
    isCorrect: true,
    selectedAnswer: "1",
    confidenceLevel: "medium",
    responseTimeSeconds: 10,
    todaySessionId: null,
    todaySessionItemId: null,
    dailyPlanId: null,
    dailyPlanItemId: null,
    learningSessionId: null,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "learning_engine_v1.0",
    ...overrides,
  };
}

function makeContext(
  scheduler: MemoryScheduler,
  isSameLearningSession: boolean | null = false,
  now: Date = BASE_DATE,
) {
  return {
    now,
    engineVersion: "learning_engine_v1.0",
    memoryScheduler: scheduler,
    retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
    isSameLearningSession,
    evidenceStrengthPolicy: TEST_EVIDENCE_STRENGTH_POLICY,
    masteryPolicy: TEST_MASTERY_POLICY,
    misconceptionPolicy: TEST_MISCONCEPTION_POLICY,
  };
}

/**
 * Applies a sequence of clean (FULL_EVIDENCE), correct, different-session
 * Attempts on the given day offsets, threading `.progress` forward. Used
 * wherever a scenario's SETUP is "N clean qualifying correct answers over
 * time" and no distinct per-step assertion is needed for that setup phase —
 * callers still assert on the returned per-step results directly.
 */
function runQualifyingCorrectSequence(
  scheduler: MemoryScheduler,
  days: number[],
): ProgressUpdateResult[] {
  const results: ProgressUpdateResult[] = [];
  let previous: UserQuestionProgress | null = null;
  for (const day of days) {
    const result = applyAttemptToProgress(
      previous,
      makeAttempt({ isCorrect: true, answeredAt: atDay(day) }),
      makeContext(scheduler, false),
    );
    results.push(result);
    previous = result.progress;
  }
  return results;
}

/**
 * Re-runs a fixed sequence of Attempt overrides from `null`, using a fresh
 * scheduler instance, returning every step's full result. Used only for
 * the determinism/replay scenario (12) where running the SAME sequence
 * twice is the entire point.
 */
function runJourney(
  steps: Array<{
    attempt: Partial<Attempt>;
    isSameLearningSession?: boolean | null;
  }>,
): ProgressUpdateResult[] {
  const scheduler = new FakeMemoryScheduler();
  const results: ProgressUpdateResult[] = [];
  let previous: UserQuestionProgress | null = null;
  for (const step of steps) {
    const result = applyAttemptToProgress(
      previous,
      makeAttempt(step.attempt),
      makeContext(scheduler, step.isSameLearningSession ?? false),
    );
    results.push(result);
    previous = result.progress;
  }
  return results;
}

describe("Learning Engine golden scenarios", () => {
  it("1. new learner calibration: first clean correct evidence", () => {
    const scheduler = new FakeMemoryScheduler();

    const result = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );

    expect(result.progress.meaningfulAttemptCount).toBe(1);
    expect(result.progress.retrievalBaselineAt).toEqual(atDay(0));
    expect(result.progress.successfulSpacedRetrievals).toBe(0);
    expect(result.progress.evidenceStrength).toBe("early");
    expect(result.progress.masteryCategory).toBe("learning");
    expect(result.progress.misconceptionState).toBe("none");
  });

  it("2. same-session repetition does not fake mastery", () => {
    const scheduler = new FakeMemoryScheduler();

    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );

    let latest = first;
    for (let i = 1; i <= 4; i++) {
      latest = applyAttemptToProgress(
        latest.progress,
        makeAttempt({ isCorrect: true, answeredAt: atDay(0 + i * 0.01) }),
        makeContext(scheduler, true), // same session
      );
      expect(latest.retrievalQualification.reason).toBe("SAME_SESSION");
    }

    expect(latest.progress.meaningfulAttemptCount).toBe(5);
    expect(latest.progress.successfulSpacedRetrievals).toBe(0);
    // Even with 5 meaningful attempts (the "strong" attempt-count gate),
    // zero spacing keeps evidence at "early" — never even "moderate".
    expect(latest.progress.evidenceStrength).toBe("early");
    expect(latest.progress.masteryCategory).toBe("learning");
    expect(latest.progress.misconceptionState).toBe("none");
    expect(latest.reasons).not.toContain("MISCONCEPTION_RECOVERY");
  });

  it("3. healthy longitudinal strengthening", () => {
    const scheduler = new FakeMemoryScheduler();

    const [day0, day2, day5] = runQualifyingCorrectSequence(scheduler, [
      0, 2, 5,
    ]);

    expect(day0.progress.masteryCategory).toBe("learning");
    expect(day0.progress.evidenceStrength).toBe("early");

    expect(day2.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(day2.progress.successfulSpacedRetrievals).toBe(1);
    expect(day2.progress.masteryCategory).toBe("strengthening");

    expect(day5.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(day5.progress.successfulSpacedRetrievals).toBe(2);
    expect(day5.progress.masteryCategory).toBe("strengthening");
    expect(day5.progress.evidenceStrength).toBe("moderate");
    expect(day5.progress.misconceptionState).toBe("none");
    expect(day5.progress.lapseCount).toBe(0);
  });

  it("4. full path to mastered, never earlier than policy allows", () => {
    const scheduler = new FakeMemoryScheduler();

    const steps = runQualifyingCorrectSequence(
      scheduler,
      [0, 2, 5, 8, 11],
    );

    // Not mastered at any of the first 4 qualifying retrievals — each is
    // blocked by a DIFFERENT gate (spacing, then evidence strength).
    for (const step of steps.slice(0, 4)) {
      expect(step.progress.masteryCategory).not.toBe("mastered");
    }

    const [, , , step4, step5] = steps;
    // spacing(3) already meets the mastered threshold at step 4, but
    // meaningfulAttemptCount(4) is still below the "strong" gate (5), so
    // evidence strength is only "moderate" and mastery is still withheld.
    expect(step4.progress.successfulSpacedRetrievals).toBe(3);
    expect(step4.progress.evidenceStrength).toBe("moderate");
    expect(step4.progress.masteryCategory).toBe("strengthening");

    expect(step5.progress.meaningfulAttemptCount).toBe(5);
    expect(step5.progress.successfulSpacedRetrievals).toBe(4);
    expect(step5.progress.evidenceStrength).toBe("strong");
    expect(step5.masteryDecisionInput.retrievabilityEstimate).toBe(0.9);
    expect(step5.progress.masteryCategory).toBe("mastered");
  });

  it("5. confident misconception emergence", () => {
    const scheduler = new FakeMemoryScheduler();

    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );

    const day1 = applyAttemptToProgress(
      day0.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(1),
      }),
      makeContext(scheduler, false),
    );
    expect(day1.reasons).toEqual(["CONFIDENT_ERROR", "LAPSE"]);
    expect(day1.progress.misconceptionState).toBe("suspected");
    expect(day1.progress.misconceptionScore).toBe(2);
    expect(day1.progress.lapseCount).toBe(1);
    expect(day1.progress.lastLapseAt).toEqual(atDay(1));

    const day2 = applyAttemptToProgress(
      day1.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(2),
      }),
      makeContext(scheduler, false),
    );
    expect(day2.reasons).toEqual(["CONFIDENT_ERROR", "LAPSE"]);
    expect(day2.progress.misconceptionState).toBe("active");
    expect(day2.progress.misconceptionScore).toBe(4);
    expect(day2.progress.lapseCount).toBe(2);
    expect(day2.progress.lastLapseAt).toEqual(atDay(2));
    expect(day2.progress.masteryCategory).not.toBe("mastered");
  });

  it("6. misconception recovery over time: active -> recovering -> resolved", () => {
    const scheduler = new FakeMemoryScheduler();

    // Setup mirrors scenario 5 (kept self-contained per test independence).
    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );
    const day1 = applyAttemptToProgress(
      day0.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(1),
      }),
      makeContext(scheduler, false),
    );
    const day2 = applyAttemptToProgress(
      day1.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(2),
      }),
      makeContext(scheduler, false),
    );
    expect(day2.progress.misconceptionState).toBe("active");

    const day6 = applyAttemptToProgress(
      day2.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(6) }),
      makeContext(scheduler, false),
    );
    expect(day6.reasons).toContain("MISCONCEPTION_RECOVERY");
    expect(day6.progress.misconceptionState).toBe("recovering");
    expect(day6.progress.misconceptionScore).toBe(3);
    expect(day6.progress.misconceptionLastSeenAt).toEqual(atDay(6));

    // Same-session correct answer: must NOT repair the misconception.
    const day7 = applyAttemptToProgress(
      day6.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(7) }),
      makeContext(scheduler, true),
    );
    expect(day7.retrievalQualification.reason).toBe("SAME_SESSION");
    expect(day7.progress.misconceptionState).toBe("recovering");
    expect(day7.progress.misconceptionScore).toBe(3);
    expect(day7.progress.misconceptionLastSeenAt).toEqual(atDay(6)); // unchanged
    expect(day7.reasons).not.toContain("MISCONCEPTION_RECOVERY");

    const day9 = applyAttemptToProgress(
      day7.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(9) }),
      makeContext(scheduler, false),
    );
    expect(day9.progress.misconceptionState).toBe("recovering"); // no transition yet
    expect(day9.progress.misconceptionScore).toBe(2);
    expect(day9.reasons).not.toContain("MISCONCEPTION_RECOVERY");
    expect(day9.progress.misconceptionLastSeenAt).toEqual(atDay(9));

    const day11 = applyAttemptToProgress(
      day9.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(11) }),
      makeContext(scheduler, false),
    );
    expect(day11.progress.misconceptionState).toBe("recovering");
    expect(day11.progress.misconceptionScore).toBe(1);

    const day13 = applyAttemptToProgress(
      day11.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(13) }),
      makeContext(scheduler, false),
    );
    expect(day13.reasons).toContain("MISCONCEPTION_RECOVERY");
    expect(day13.progress.misconceptionState).toBe("resolved");
    expect(day13.progress.misconceptionScore).toBe(0);
    expect(day13.progress.misconceptionLastSeenAt).toEqual(atDay(13));
  });

  it("7. mastered -> lapse -> recovery", () => {
    const scheduler = new FakeMemoryScheduler();

    const [, , , , mastered] = runQualifyingCorrectSequence(
      scheduler,
      [0, 2, 5, 8, 11],
    );
    expect(mastered.progress.masteryCategory).toBe("mastered");

    const lapsed = applyAttemptToProgress(
      mastered.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "medium",
        answeredAt: atDay(13),
      }),
      makeContext(scheduler, false),
    );
    expect(lapsed.reasons).toEqual(["LAPSE"]);
    expect(lapsed.progress.lapseCount).toBe(1);
    expect(lapsed.masteryDecisionInput.hasUnresolvedLapse).toBe(true);
    expect(lapsed.progress.masteryCategory).not.toBe("mastered");
    expect(lapsed.progress.masteryCategory).toBe("strengthening");

    // Same-session correct answer does NOT resolve the lapse.
    const notResolved = applyAttemptToProgress(
      lapsed.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(14) }),
      makeContext(scheduler, true),
    );
    expect(notResolved.retrievalQualification.reason).toBe("SAME_SESSION");
    expect(notResolved.masteryDecisionInput.hasUnresolvedLapse).toBe(true);
    expect(notResolved.progress.masteryCategory).not.toBe("mastered");

    // A later qualifying longitudinal retrieval moves retrievalBaselineAt
    // past lastLapseAt, and mastery is only re-earned once every gate is
    // satisfied again (spacing, evidence strength, AND unresolved lapse).
    const recovered = applyAttemptToProgress(
      notResolved.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(17) }),
      makeContext(scheduler, false),
    );
    expect(recovered.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(recovered.progress.retrievalBaselineAt).toEqual(atDay(17));
    expect(
      recovered.progress.retrievalBaselineAt!.getTime() >
        lapsed.progress.lastLapseAt!.getTime(),
    ).toBe(true);
    expect(recovered.masteryDecisionInput.hasUnresolvedLapse).toBe(false);
    expect(recovered.progress.masteryCategory).toBe("mastered");
  });

  it("8. assisted answers cannot inflate learner state or repair misconception", () => {
    const scheduler = new FakeMemoryScheduler();

    // A single clean (FULL_EVIDENCE) high-confidence wrong answer is both
    // meaningful evidence AND establishes a "suspected" misconception, so
    // this scenario can also prove assisted answers cannot recover it.
    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(0),
      }),
      makeContext(scheduler, false),
    );
    expect(day0.progress.misconceptionState).toBe("suspected");
    expect(day0.progress.memory?.reviewCount).toBe(1);

    let latest = day0;
    const days = [2, 5, 8];
    for (const day of days) {
      latest = applyAttemptToProgress(
        latest.progress,
        makeAttempt({
          isCorrect: true,
          assistanceUsed: "HINT",
          answeredAt: atDay(day),
        }),
        makeContext(scheduler, false),
      );
      expect(latest.evidence.quality).toBe("ASSISTED_EVIDENCE");
    }

    expect(latest.progress.assistedAttemptCount).toBe(3);
    expect(latest.progress.meaningfulAttemptCount).toBe(1);
    expect(latest.progress.memory?.reviewCount).toBe(1); // unchanged
    expect(latest.progress.successfulSpacedRetrievals).toBe(0);
    expect(latest.progress.masteryCategory).toBe("learning");
    expect(latest.progress.misconceptionState).toBe("suspected");
    expect(latest.progress.misconceptionScore).toBe(2);
    expect(latest.progress.misconceptionLastSeenAt).toEqual(atDay(0));
  });

  it("9. low-quality/second-attempt answers cannot inflate learner state or repair misconception", () => {
    const scheduler = new FakeMemoryScheduler();

    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(0),
      }),
      makeContext(scheduler, false),
    );
    expect(day0.progress.misconceptionState).toBe("suspected");

    let latest = day0;
    const days = [2, 5, 8];
    for (const day of days) {
      latest = applyAttemptToProgress(
        latest.progress,
        makeAttempt({
          isCorrect: true,
          attemptNumberForPresentedItem: 2,
          answeredAt: atDay(day),
        }),
        makeContext(scheduler, false),
      );
      expect(latest.evidence.quality).toBe("LOW_QUALITY_EVIDENCE");
    }

    expect(latest.progress.lowQualityAttemptCount).toBe(3);
    expect(latest.progress.meaningfulAttemptCount).toBe(1);
    expect(latest.progress.memory?.reviewCount).toBe(1); // unchanged
    expect(latest.progress.successfulSpacedRetrievals).toBe(0);
    expect(latest.progress.masteryCategory).toBe("learning");
    expect(latest.progress.misconceptionState).toBe("suspected");
    expect(latest.progress.misconceptionScore).toBe(2);
    expect(latest.progress.misconceptionLastSeenAt).toEqual(atDay(0));
  });

  it("10. invalid/answer-revealed evidence is recorded historically but never advances mastery-relevant state", () => {
    const scheduler = new FakeMemoryScheduler();

    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );

    const revealed = applyAttemptToProgress(
      day0.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answerWasRevealedBeforeResponse: true,
        answeredAt: atDay(1),
      }),
      makeContext(scheduler, false),
    );

    expect(revealed.evidence.quality).toBe("INVALID_FOR_MASTERY");
    expect(revealed.progress.attemptCount).toBe(2);
    expect(revealed.progress.invalidForMasteryAttemptCount).toBe(1);
    expect(revealed.progress.meaningfulAttemptCount).toBe(1); // unchanged
    expect(revealed.schedulerRatingDecision.kind).toBe("NOT_RATABLE");
    expect(revealed.progress.memory?.reviewCount).toBe(1); // unchanged
    expect(revealed.retrievalQualification.reason).toBe("NOT_FULL_EVIDENCE");
    // Despite isCorrect:false + confidenceLevel:"high", INVALID_FOR_MASTERY
    // evidence never satisfies CONFIDENT_ERROR's FULL_EVIDENCE requirement.
    expect(revealed.reasons).not.toContain("CONFIDENT_ERROR");
    expect(revealed.misconceptionResult.reason).toBe("NO_CHANGE");
    expect(revealed.progress.misconceptionState).toBe("none");
    expect(revealed.progress.masteryCategory).toBe("learning");
  });

  it("11. out-of-order historical evidence boundary", () => {
    const scheduler = new FakeMemoryScheduler();

    // Evidence-summary min/max timestamps stay chronology-safe under
    // out-of-order APPLICATION, as long as the out-of-order Attempt is
    // INCORRECT (so it never reaches qualifyRetrieval's ordering guard).
    const later = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(10) }),
      makeContext(scheduler, false),
    );
    expect(later.progress.firstMeaningfulEvidenceAt).toEqual(atDay(10));
    expect(later.progress.lastMeaningfulEvidenceAt).toEqual(atDay(10));

    const earlierApplied = applyAttemptToProgress(
      later.progress,
      makeAttempt({ isCorrect: false, answeredAt: atDay(3) }),
      makeContext(scheduler, false),
    );
    expect(earlierApplied.retrievalQualification.reason).toBe("INCORRECT");
    expect(earlierApplied.progress.firstMeaningfulEvidenceAt).toEqual(
      atDay(3),
    );
    expect(earlierApplied.progress.lastMeaningfulEvidenceAt).toEqual(
      atDay(10),
    );

    // Retrieval/spacing requires nondecreasing answeredAt order: a
    // clean CORRECT Attempt earlier than the existing retrievalBaselineAt
    // must fail fast rather than silently compute a negative gap.
    expect(() =>
      applyAttemptToProgress(
        later.progress,
        makeAttempt({ isCorrect: true, answeredAt: atDay(3) }),
        makeContext(scheduler, false),
      ),
    ).toThrow(/earlier than/);
  });

  it("12. deterministic replay of a valid chronological sequence", () => {
    const steps = [
      { attempt: { isCorrect: true, answeredAt: atDay(0) } },
      { attempt: { isCorrect: true, answeredAt: atDay(2) } },
      {
        attempt: {
          isCorrect: false,
          confidenceLevel: "high" as const,
          answeredAt: atDay(3),
        },
      },
      { attempt: { isCorrect: true, answeredAt: atDay(6) } },
    ];

    const runA = runJourney(steps);
    const runB = runJourney(steps);

    expect(runA.length).toBe(runB.length);
    for (let i = 0; i < runA.length; i++) {
      expect(runA[i].progress).toEqual(runB[i].progress);
      expect(runA[i].reasons).toEqual(runB[i].reasons);
      expect(runA[i].misconceptionResult).toEqual(runB[i].misconceptionResult);
      expect(runA[i].masteryDecisionInput).toEqual(runB[i].masteryDecisionInput);
    }
  });

  it("13. no false mastery from raw accuracy alone", () => {
    const scheduler = new FakeMemoryScheduler();

    const first = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );

    let latest = first;
    // Different-session, but every gap is well under the 1-day threshold —
    // a distinct rejection path (GAP_TOO_SHORT) from scenario 2's
    // (SAME_SESSION), still proving raw correctCount alone never earns
    // mastery.
    for (let i = 1; i <= 9; i++) {
      latest = applyAttemptToProgress(
        latest.progress,
        makeAttempt({ isCorrect: true, answeredAt: atDay(i * 0.08) }),
        makeContext(scheduler, false),
      );
      expect(latest.retrievalQualification.reason).toBe("GAP_TOO_SHORT");
    }

    expect(latest.progress.correctCount).toBe(10);
    expect(latest.progress.successfulSpacedRetrievals).toBe(0);
    expect(latest.progress.masteryCategory).toBe("learning");
  });

  it("14. recovery evidence vs simple correctness", () => {
    const scheduler = new FakeMemoryScheduler();

    const day0 = applyAttemptToProgress(
      null,
      makeAttempt({ isCorrect: true, answeredAt: atDay(0) }),
      makeContext(scheduler, false),
    );
    const day1 = applyAttemptToProgress(
      day0.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(1),
      }),
      makeContext(scheduler, false),
    );
    const day2 = applyAttemptToProgress(
      day1.progress,
      makeAttempt({
        isCorrect: false,
        confidenceLevel: "high",
        answeredAt: atDay(2),
      }),
      makeContext(scheduler, false),
    );
    expect(day2.progress.misconceptionState).toBe("active");
    expect(day2.masteryDecisionInput.hasUnresolvedLapse).toBe(true);

    // Ordinary correct answer (same session): NOT recovery evidence.
    const ordinaryCorrect = applyAttemptToProgress(
      day2.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(3) }),
      makeContext(scheduler, true),
    );
    expect(ordinaryCorrect.retrievalQualification.reason).toBe(
      "SAME_SESSION",
    );
    expect(ordinaryCorrect.misconceptionResult.reason).toBe("NO_CHANGE");
    expect(ordinaryCorrect.progress.misconceptionState).toBe("active");
    expect(ordinaryCorrect.masteryDecisionInput.hasUnresolvedLapse).toBe(
      true,
    );

    // Qualifying spaced clean correct answer: IS recovery evidence, and
    // the SAME qualifying event also resolves the unresolved lapse —
    // both driven by retrievalBaselineAt moving past the prior signals.
    const qualifyingCorrect = applyAttemptToProgress(
      ordinaryCorrect.progress,
      makeAttempt({ isCorrect: true, answeredAt: atDay(6) }),
      makeContext(scheduler, false),
    );
    expect(qualifyingCorrect.retrievalQualification.reason).toBe(
      "QUALIFYING_SPACED_RETRIEVAL",
    );
    expect(qualifyingCorrect.reasons).toContain("MISCONCEPTION_RECOVERY");
    expect(qualifyingCorrect.progress.misconceptionState).toBe("recovering");
    expect(qualifyingCorrect.masteryDecisionInput.hasUnresolvedLapse).toBe(
      false,
    );
  });
});

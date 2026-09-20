import { describe, expect, it } from "vitest";
import { deriveIsSameLearningSession } from "../learning-session";
import type { EvidenceStrengthPolicy } from "../evidence-strength";
import type { MasteryPolicy } from "../mastery";
import type { MisconceptionPolicy } from "../misconception";
import { applyAttemptToProgress, type ProgressUpdateContext } from "../progress-update";
import {
  type AttemptReplayRecord,
  rebuildUserQuestionProgress,
  sortReplayRecords,
} from "../rebuild";
import type { RetrievalQualificationPolicy } from "../retrieval-qualification";
import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../scheduler";
import type { Attempt, UserQuestionProgress } from "../types";

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
  overrides: Partial<ProgressUpdateContext> = {},
): ProgressUpdateContext {
  return {
    now: NOW,
    engineVersion: "current-engine-v2",
    memoryScheduler: new FakeMemoryScheduler(),
    retrievalQualificationPolicy: TEST_RETRIEVAL_QUALIFICATION_POLICY,
    isSameLearningSession: null, // ignored/overwritten by rebuild — see rebuild.ts
    evidenceStrengthPolicy: TEST_EVIDENCE_STRENGTH_POLICY,
    masteryPolicy: TEST_MASTERY_POLICY,
    misconceptionPolicy: TEST_MISCONCEPTION_POLICY,
    ...overrides,
  };
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

function record(
  attempt: Attempt,
  createdAt: Date = attempt.answeredAt,
): AttemptReplayRecord {
  return { attempt, createdAt };
}

/**
 * Hand-verified fixture used across several tests:
 * - a1 (Jan 1): first-ever correct, learningSessionId "s1" -> baseline set
 *   to Jan1/"s1" (NO_PRIOR_RETRIEVAL never checks session).
 * - a2 (Jan 3): correct, learningSessionId "s2" (differs from baseline
 *   "s1") -> deriveIsSameLearningSession("s2","s1")=false -> gap=2 days >=
 *   1 day threshold -> QUALIFIES. Baseline moves to Jan3/"s2",
 *   successfulSpacedRetrievals=1.
 * - a3 (Jan 4): correct, learningSessionId "s2" (SAME as current baseline
 *   "s2") -> deriveIsSameLearningSession("s2","s2")=true -> SAME_SESSION,
 *   does not qualify despite the 1-day gap otherwise being sufficient.
 *   Baseline/count unchanged.
 */
function makeThreeAttemptFixture(): {
  a1: Attempt;
  a2: Attempt;
  a3: Attempt;
} {
  return {
    a1: makeAttempt({
      id: "a1",
      submissionId: "sub-a1",
      answeredAt: new Date("2026-01-01T00:00:00.000Z"),
      learningSessionId: "s1",
    }),
    a2: makeAttempt({
      id: "a2",
      submissionId: "sub-a2",
      answeredAt: new Date("2026-01-03T00:00:00.000Z"),
      learningSessionId: "s2",
    }),
    a3: makeAttempt({
      id: "a3",
      submissionId: "sub-a3",
      answeredAt: new Date("2026-01-04T00:00:00.000Z"),
      learningSessionId: "s2",
    }),
  };
}

/** Manual canonical-order replay via applyAttemptToProgress directly, used
 * as the independent "expected" oracle rebuild.ts's fold is checked against. */
function manualCanonicalReplay(
  attempts: Attempt[],
  context: ProgressUpdateContext,
): UserQuestionProgress | null {
  let progress: UserQuestionProgress | null = null;
  for (const attempt of attempts) {
    const isSameLearningSession = deriveIsSameLearningSession(
      attempt.learningSessionId,
      progress?.retrievalBaselineLearningSessionId ?? null,
    );
    const result = applyAttemptToProgress(progress, attempt, {
      ...context,
      isSameLearningSession,
    });
    progress = result.progress;
  }
  return progress;
}

describe("rebuildUserQuestionProgress", () => {
  it("7. rebuilt final progress equals a direct, independently-computed canonical replay of the same Attempts", () => {
    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const context = makeContext();

    const expected = manualCanonicalReplay([a1, a2, a3], context);
    const rebuilt = rebuildUserQuestionProgress(
      [record(a1), record(a2), record(a3)],
      context,
    );

    expect(rebuilt).toEqual(expected);
    // Sanity: the fixture actually exercises both qualifying and
    // same-session rejection, not a trivial no-op scenario.
    expect(rebuilt?.successfulSpacedRetrievals).toBe(1);
    expect(rebuilt?.retrievalBaselineLearningSessionId).toBe("s2");
  });

  it("8. three Attempts replayed in arrival order 1,3,2 produce the SAME progress as canonical order 1,2,3", () => {
    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const context = makeContext();

    const canonicalOrder = rebuildUserQuestionProgress(
      [record(a1), record(a2), record(a3)],
      context,
    );
    const arrivalOrder = rebuildUserQuestionProgress(
      [record(a1), record(a3), record(a2)], // a3 "arrived" before a2
      context,
    );

    expect(arrivalOrder).toEqual(canonicalOrder);
  });

  it("9. repeated rebuild of the same records is deterministic", () => {
    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const context = makeContext();
    const records = [record(a3), record(a1), record(a2)]; // shuffled input

    const first = rebuildUserQuestionProgress(records, context);
    const second = rebuildUserQuestionProgress(records, context);

    expect(second).toEqual(first);
  });

  it("10. rebuild never mutates any Attempt record", () => {
    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const records = [record(a1), record(a2), record(a3)];
    const snapshot = structuredClone(records);

    rebuildUserQuestionProgress(records, makeContext());

    expect(records).toEqual(snapshot);
  });

  it("13. equal answeredAt values are disambiguated by createdAt, not by input array position", () => {
    const tiedAnsweredAt = new Date("2026-01-05T00:00:00.000Z");
    // Two Attempts with the IDENTICAL answeredAt but meaningfully different
    // content, so fold order is observable in the result: a confident
    // wrong answer vs. a clean correct answer.
    const wrongFirst = makeAttempt({
      id: "wrong",
      submissionId: "sub-wrong",
      answeredAt: tiedAnsweredAt,
      isCorrect: false,
      confidenceLevel: "high",
    });
    const correctSecond = makeAttempt({
      id: "correct",
      submissionId: "sub-correct",
      answeredAt: tiedAnsweredAt,
      isCorrect: true,
    });

    const wrongRecord = record(wrongFirst, new Date("2026-01-10T00:00:00.000Z"));
    const correctRecord = record(
      correctSecond,
      new Date("2026-01-10T00:00:00.001Z"), // 1ms later createdAt
    );

    // Regardless of input array order, createdAt must decide the fold
    // order: "wrong" (earlier createdAt) is folded first.
    const inputOrderA = rebuildUserQuestionProgress(
      [wrongRecord, correctRecord],
      makeContext(),
    );
    const inputOrderB = rebuildUserQuestionProgress(
      [correctRecord, wrongRecord],
      makeContext(),
    );
    expect(inputOrderA).toEqual(inputOrderB);

    // And it must actually match folding in the createdAt order, not
    // simply "whatever order happened to be passed in":
    const expectedByCreatedAtOrder = manualCanonicalReplay(
      [wrongFirst, correctSecond],
      makeContext(),
    );
    expect(inputOrderA).toEqual(expectedByCreatedAtOrder);
  });

  it("sortReplayRecords: answeredAt ASC, then createdAt ASC, then id ASC", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    const r1 = record(
      makeAttempt({ id: "z", answeredAt: base, learningSessionId: null }),
      new Date("2026-01-02T00:00:00.000Z"),
    );
    const r2 = record(
      makeAttempt({ id: "a", answeredAt: base, learningSessionId: null }),
      new Date("2026-01-02T00:00:00.000Z"), // same answeredAt AND createdAt as r1 -> id tie-break
    );
    const r3 = record(
      makeAttempt({ id: "m", answeredAt: base, learningSessionId: null }),
      new Date("2026-01-01T12:00:00.000Z"), // earlier createdAt than r1/r2
    );

    const sorted = sortReplayRecords([r1, r2, r3]);

    expect(sorted.map((r) => r.attempt.id)).toEqual(["m", "a", "z"]);
  });

  it("14. rebuild uses CURRENT policy configuration, never anything implied by a historical Attempt.engineVersion", () => {
    // Attempts stamped with an old-looking engineVersion — rebuild.ts never
    // reads or branches on this field at all; it is historical metadata
    // only. Replaying the SAME Attempts under two different injected
    // EvidenceStrengthPolicy configurations must change the outcome,
    // proving the CURRENT policy actually drives the result rather than
    // anything fixed or dispatched from the Attempt data itself.
    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const oldLookingAttempts = [a1, a2, a3].map((a) =>
      makeAttempt({ ...a, engineVersion: "learning_engine_v0.1-historical" }),
    );
    const records = oldLookingAttempts.map((a) => record(a));

    const defaultRebuild = rebuildUserQuestionProgress(
      records,
      makeContext({ engineVersion: "learning_engine_v2.0-current" }),
    );
    // Stricter than the shared default (3): 3 meaningful attempts is no
    // longer enough to reach "moderate" evidence strength. Capped at the
    // policy's own "strong" threshold (5) to stay internally consistent
    // (validateEvidenceStrengthPolicy requires moderate <= strong).
    const stricterEvidencePolicy: EvidenceStrengthPolicy = {
      ...TEST_EVIDENCE_STRENGTH_POLICY,
      minMeaningfulAttemptsForModerate: 5,
    };
    const stricterRebuild = rebuildUserQuestionProgress(records, {
      ...makeContext({ engineVersion: "learning_engine_v2.0-current" }),
      evidenceStrengthPolicy: stricterEvidencePolicy,
    });

    // engineVersion on the REBUILT progress reflects the CURRENT context,
    // not anything copied from the historical Attempts.
    expect(defaultRebuild?.engineVersion).toBe("learning_engine_v2.0-current");
    expect(stricterRebuild?.engineVersion).toBe("learning_engine_v2.0-current");

    // The SAME Attempts produce a DIFFERENT evidenceStrength depending
    // purely on which policy was injected — proof the policy value flows
    // through, not the Attempts' own (irrelevant) engineVersion.
    expect(defaultRebuild?.evidenceStrength).toBe("moderate");
    expect(stricterRebuild?.evidenceStrength).toBe("early");
  });

  it("context.now during replay: one fixed rebuild-time `now` for every step produces the SAME final progress as using each Attempt's own answeredAt as `now` for every intermediate step (ADR-012 §6) — proves now does not leak forward through intermediate state", () => {
    // A scheduler whose estimateRetrievability genuinely depends on `at`,
    // unlike the shared FakeMemoryScheduler (constant 0.9) — otherwise this
    // test would pass vacuously regardless of whether `now` actually flows
    // through correctly. Implements MemoryScheduler directly (rather than
    // extending FakeMemoryScheduler) since narrowing an overridden method's
    // signature to require more parameters than the base class declares is
    // not a valid override.
    class DecayingRetrievabilityScheduler implements MemoryScheduler {
      private readonly delegate = new FakeMemoryScheduler();
      initialize(input: InitialReviewInput): MemoryReviewResult {
        return this.delegate.initialize(input);
      }
      review(state: SchedulerMemoryState, input: ReviewEvidence): MemoryReviewResult {
        return this.delegate.review(state, input);
      }
      estimateRetrievability(state: SchedulerMemoryState, at: Date): number {
        if (state.lastReviewAt === null) {
          return 1;
        }
        const elapsedDays =
          (at.getTime() - state.lastReviewAt.getTime()) / DAY_MS;
        return Math.max(0, 1 - elapsedDays * 0.05);
      }
    }
    const scheduler = new DecayingRetrievabilityScheduler();

    const { a1, a2, a3 } = makeThreeAttemptFixture();
    const records = [record(a1), record(a2), record(a3)];
    // Long after all three Attempts, so a leaked "now" would visibly shift
    // retrievability/masteryCategory if it ever fed into a later step.
    const rebuildNow = new Date("2026-06-01T00:00:00.000Z");

    const uniform = rebuildUserQuestionProgress(
      records,
      makeContext({ now: rebuildNow, memoryScheduler: scheduler }),
    );

    // Candidate design B from the audit: attempt.answeredAt as `now` for
    // every step except the last, where rebuild-time `now` is used.
    let manual: UserQuestionProgress | null = null;
    const ordered = [a1, a2, a3];
    ordered.forEach((attempt, index) => {
      const isLast = index === ordered.length - 1;
      const now = isLast ? rebuildNow : attempt.answeredAt;
      const isSameLearningSession = deriveIsSameLearningSession(
        attempt.learningSessionId,
        manual?.retrievalBaselineLearningSessionId ?? null,
      );
      const result = applyAttemptToProgress(manual, attempt, {
        ...makeContext({ now, memoryScheduler: scheduler }),
        isSameLearningSession,
      });
      manual = result.progress;
    });

    expect(uniform).toEqual(manual);

    // Sanity: the scheduler's retrievability really is `at`-sensitive, so
    // the equality above is a real proof, not a vacuous one.
    const sampleState = uniform?.memory;
    expect(sampleState).not.toBeNull();
    if (sampleState !== null && sampleState !== undefined) {
      const near = scheduler.estimateRetrievability(sampleState, a1.answeredAt);
      const far = scheduler.estimateRetrievability(sampleState, rebuildNow);
      expect(near).not.toBe(far);
    }
  });

  it("returns null for an empty record set", () => {
    expect(rebuildUserQuestionProgress([], makeContext())).toBeNull();
  });
});

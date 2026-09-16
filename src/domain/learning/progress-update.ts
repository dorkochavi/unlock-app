/**
 * Attempt -> Evidence -> Scheduler -> UserQuestionProgress.
 *
 * The smallest deterministic pure function that applies one immutable
 * Attempt to a learner's UserQuestionProgress for a Question.
 *
 * Rules this file deliberately follows:
 * - pure domain logic only: no DB, no network, no ts-fsrs, no Date.now(),
 *   no Math.random(). All time/versioning/scheduler/policy dependencies
 *   are injected via `ProgressUpdateContext`;
 * - the Attempt itself is never mutated or rewritten (see ADR-005);
 * - retrieval qualification (successfulSpacedRetrievals /
 *   retrievalBaselineAt) is now applied here, via the injected
 *   `RetrievalQualificationPolicy` and `isSameLearningSession` context —
 *   see retrieval-qualification.ts. This function still does NOT decide
 *   the spacing threshold value itself, nor mastery thresholds,
 *   misconception activation/recovery, evidence-strength thresholds,
 *   desired retention, or exam behavior. Those remain unresolved policy
 *   (docs/OPEN_QUESTIONS.md) and are preserved unchanged here so the real
 *   policies can be plugged in later without rewriting this function.
 */

import { classifyAttemptEvidence } from "./evidence";
import {
  qualifyRetrieval,
  type RetrievalQualificationPolicy,
  type RetrievalQualificationReason,
  type RetrievalQualificationResult,
} from "./retrieval-qualification";
import {
  mapEvidenceToSchedulerRating,
  type SchedulerRatingDecision,
} from "./scheduler-rating";
import type { MemoryScheduler, SchedulerMemoryState } from "./scheduler";
import type {
  Attempt,
  ClassifiedEvidence,
  EvidenceQuality,
  StateUpdateReason,
  UserQuestionProgress,
} from "./types";

export interface ProgressUpdateContext {
  /**
   * Injected clock for `updatedAt`. Never call Date.now() in this file.
   */
  now: Date;
  engineVersion: string;
  memoryScheduler: MemoryScheduler;

  /**
   * Threshold policy for retrieval-qualification.ts. No production default
   * is chosen here — see docs/OPEN_QUESTIONS.md #12.
   */
  retrievalQualificationPolicy: RetrievalQualificationPolicy;

  /**
   * Whether the current Attempt is in the same learning session/occasion
   * as the previous qualifying retrieval, or null when unknown. This file
   * never infers session identity from timestamps or todaySessionId —
   * the caller must supply it explicitly (docs/OPEN_QUESTIONS.md #3 is
   * still open).
   */
  isSameLearningSession: boolean | null;
}

export interface ProgressUpdateResult {
  progress: UserQuestionProgress;
  evidence: ClassifiedEvidence;
  schedulerRatingDecision: SchedulerRatingDecision;
  retrievalQualification: RetrievalQualificationResult;
  /**
   * The single most relevant, unambiguous reason for this update, or null
   * when no reason from `STATE_UPDATE_REASONS` unambiguously applies yet
   * (for example, an unremarkable non-first correct answer that isn't a
   * qualifying spaced retrieval, before a mastery/misconception policy is
   * available to classify it further).
   */
  reason: StateUpdateReason | null;
}

/**
 * Applies one accepted Attempt to the previous UserQuestionProgress (or
 * null for a brand-new user/question pair), producing the next progress
 * state.
 *
 * This function assumes it is called exactly once for an accepted Attempt.
 * Duplicate-submission protection is an application/transaction-layer
 * concern, not a domain concern (see docs/DATABASE.md §12).
 *
 * Contract: this is the incremental ONLINE update path — one new Attempt
 * applied to the current UserQuestionProgress as it happens. Evidence-
 * summary fields (meaningfulAttemptCount, firstMeaningfulEvidenceAt,
 * lastMeaningfulEvidenceAt) tolerate out-of-order answeredAt values
 * because they take min/max against chronological evidence time rather
 * than assuming arrival order. Retrieval/spacing semantics
 * (retrievalBaselineAt, successfulSpacedRetrievals — see
 * retrieval-qualification.ts) do NOT: they require Attempts to be applied
 * in nondecreasing answeredAt order, and retrieval-qualification.ts fails
 * fast rather than silently computing a negative gap when that's
 * violated. A future rebuild/replay of UserQuestionProgress from
 * immutable Attempt history (not implemented here) must therefore feed
 * Attempts through this function in nondecreasing answeredAt order — it
 * must not feed arbitrary historical order into retrieval qualification.
 */
export function applyAttemptToProgress(
  previousProgress: UserQuestionProgress | null,
  attempt: Attempt,
  context: ProgressUpdateContext,
): ProgressUpdateResult {
  const evidence = classifyAttemptEvidence(attempt);

  const schedulerRatingDecision = mapEvidenceToSchedulerRating({
    evidence,
    confidenceLevel: attempt.confidenceLevel,
  });

  const { memory, isLapse } = nextSchedulerMemory(
    previousProgress?.memory ?? null,
    attempt,
    schedulerRatingDecision,
    context.memoryScheduler,
  );

  const retrievalQualification = qualifyRetrieval(
    {
      currentAttemptAt: attempt.answeredAt,
      isCorrect: attempt.isCorrect,
      currentEvidenceQuality: evidence.quality,
      previousRetrievalBaselineAt: previousProgress?.retrievalBaselineAt ?? null,
      isSameLearningSession: context.isSameLearningSession,
    },
    context.retrievalQualificationPolicy,
  );

  const { retrievalBaselineAt, successfulSpacedRetrievals } =
    nextRetrievalBaseline(
      previousProgress?.retrievalBaselineAt ?? null,
      previousProgress?.successfulSpacedRetrievals ?? 0,
      attempt,
      retrievalQualification,
    );

  const reason = deriveStateUpdateReason({
    isFirstAttempt: previousProgress === null,
    attempt,
    evidenceQuality: evidence.quality,
    isLapse,
    retrievalQualificationReason: retrievalQualification.reason,
  });

  const previousTimedAttemptCount = previousProgress?.timedAttemptCount ?? 0;

  const progress: UserQuestionProgress = {
    userId: attempt.userId,
    questionId: attempt.questionId,

    attemptCount: (previousProgress?.attemptCount ?? 0) + 1,
    correctCount:
      (previousProgress?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0),

    lastAttemptAt: attempt.answeredAt,
    lastCorrectAt: attempt.isCorrect
      ? attempt.answeredAt
      : (previousProgress?.lastCorrectAt ?? null),
    lastIncorrectAt: attempt.isCorrect
      ? (previousProgress?.lastIncorrectAt ?? null)
      : attempt.answeredAt,

    memory,

    retrievalBaselineAt,
    successfulSpacedRetrievals,

    // Unlike successfulSpacedRetrievals, LAPSE is an already-unambiguous
    // signal (requirement 11): a previously established scheduler state
    // received AGAIN. Safe to increment directly.
    lapseCount:
      (previousProgress?.lapseCount ?? 0) + (reason === "LAPSE" ? 1 : 0),

    // Misconception activation/recovery thresholds are unresolved
    // (docs/OPEN_QUESTIONS.md #13). Preserve, do not invent. The
    // CONFIDENT_ERROR reason below still surfaces the raw signal.
    misconceptionState: previousProgress?.misconceptionState ?? "none",
    misconceptionScore: previousProgress?.misconceptionScore ?? 0,
    misconceptionLastSeenAt: previousProgress?.misconceptionLastSeenAt ?? null,

    timedAttemptCount:
      previousTimedAttemptCount + (attempt.responseTimeSeconds !== null ? 1 : 0),
    averageResponseTimeSeconds: nextAverageResponseTimeSeconds(
      previousProgress?.averageResponseTimeSeconds ?? null,
      previousTimedAttemptCount,
      attempt.responseTimeSeconds,
    ),

    ...nextEvidenceSummary(previousProgress, attempt, evidence.quality),

    // Evidence-strength/mastery-category thresholds are unresolved
    // (see src/domain/learning/mastery.ts). Preserve, do not invent;
    // deriveMasteryCategory can be plugged in by a caller once a
    // MasteryPolicy is available.
    evidenceStrength: previousProgress?.evidenceStrength ?? "insufficient",
    masteryCategory: previousProgress?.masteryCategory ?? "not_started",

    engineVersion: context.engineVersion,
    updatedAt: context.now,
  };

  return {
    progress,
    evidence,
    schedulerRatingDecision,
    retrievalQualification,
    reason,
  };
}

/**
 * Baseline-tracking rule (see the `retrievalBaselineAt` doc comment in
 * types.ts): the baseline is set or moved in exactly two cases, both
 * identified directly by retrieval-qualification.ts's own reason —
 *
 * - "NO_PRIOR_RETRIEVAL": this is the first-ever clean FULL_EVIDENCE
 *   correct retrieval. It does not itself count as spaced (nothing prior
 *   to be spaced from), but it establishes the baseline future retrievals
 *   are compared against.
 * - "QUALIFYING_SPACED_RETRIEVAL": this retrieval qualifies. Increment
 *   the count and move the baseline forward to this Attempt's timestamp,
 *   so the NEXT retrieval is compared against this one, not the original.
 *
 * Every other reason (NOT_FULL_EVIDENCE, INCORRECT, SAME_SESSION,
 * SESSION_UNKNOWN, GAP_TOO_SHORT) must leave both values untouched —
 * including same-session/gap-too-short/session-unknown rejections of an
 * otherwise-clean correct retrieval, which must not silently move the
 * baseline just because the evidence itself was clean.
 */
function nextRetrievalBaseline(
  previousBaselineAt: Date | null,
  previousSuccessfulSpacedRetrievals: number,
  attempt: Attempt,
  qualification: RetrievalQualificationResult,
): { retrievalBaselineAt: Date | null; successfulSpacedRetrievals: number } {
  if (qualification.reason === "NO_PRIOR_RETRIEVAL") {
    return {
      retrievalBaselineAt: attempt.answeredAt,
      successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals,
    };
  }

  if (qualification.reason === "QUALIFYING_SPACED_RETRIEVAL") {
    return {
      retrievalBaselineAt: attempt.answeredAt,
      successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals + 1,
    };
  }

  return {
    retrievalBaselineAt: previousBaselineAt,
    successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals,
  };
}

/**
 * Evidence-category counters and meaningful-evidence timestamps (see the
 * doc comment on these fields in types.ts). Exactly one of the four
 * counters increments per call, matching classifyAttemptEvidence()'s
 * exactly-one-quality-per-Attempt guarantee — never derived by
 * subtraction.
 *
 * firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt reflect chronological
 * evidence time (attempt.answeredAt), not processing/ingestion order.
 * Nothing in this codebase or docs/ guarantees Attempts are applied in
 * answeredAt order (docs/DATABASE.md and docs/TESTING.md only discuss
 * replay/backfill as things to guard against, never as an ordering
 * guarantee) — so these fields must stay correct under replay, backfill,
 * import, or otherwise out-of-order application. Each call therefore
 * takes the min/max against attempt.answeredAt rather than assuming this
 * call is chronologically the latest.
 */
function nextEvidenceSummary(
  previousProgress: UserQuestionProgress | null,
  attempt: Attempt,
  quality: EvidenceQuality,
): {
  meaningfulAttemptCount: number;
  assistedAttemptCount: number;
  lowQualityAttemptCount: number;
  invalidForMasteryAttemptCount: number;
  firstMeaningfulEvidenceAt: Date | null;
  lastMeaningfulEvidenceAt: Date | null;
} {
  const isMeaningful = quality === "FULL_EVIDENCE";

  return {
    meaningfulAttemptCount:
      (previousProgress?.meaningfulAttemptCount ?? 0) + (isMeaningful ? 1 : 0),
    assistedAttemptCount:
      (previousProgress?.assistedAttemptCount ?? 0) +
      (quality === "ASSISTED_EVIDENCE" ? 1 : 0),
    lowQualityAttemptCount:
      (previousProgress?.lowQualityAttemptCount ?? 0) +
      (quality === "LOW_QUALITY_EVIDENCE" ? 1 : 0),
    invalidForMasteryAttemptCount:
      (previousProgress?.invalidForMasteryAttemptCount ?? 0) +
      (quality === "INVALID_FOR_MASTERY" ? 1 : 0),

    firstMeaningfulEvidenceAt: isMeaningful
      ? earlierDate(
          previousProgress?.firstMeaningfulEvidenceAt ?? null,
          attempt.answeredAt,
        )
      : (previousProgress?.firstMeaningfulEvidenceAt ?? null),
    lastMeaningfulEvidenceAt: isMeaningful
      ? laterDate(
          previousProgress?.lastMeaningfulEvidenceAt ?? null,
          attempt.answeredAt,
        )
      : (previousProgress?.lastMeaningfulEvidenceAt ?? null),
  };
}

function earlierDate(previous: Date | null, current: Date): Date {
  if (previous === null) {
    return current;
  }
  return previous.getTime() <= current.getTime() ? previous : current;
}

function laterDate(previous: Date | null, current: Date): Date {
  if (previous === null) {
    return current;
  }
  return previous.getTime() >= current.getTime() ? previous : current;
}

function nextSchedulerMemory(
  previousMemory: SchedulerMemoryState | null,
  attempt: Attempt,
  ratingDecision: SchedulerRatingDecision,
  memoryScheduler: MemoryScheduler,
): { memory: SchedulerMemoryState | null; isLapse: boolean } {
  if (ratingDecision.kind === "NOT_RATABLE") {
    // Assisted, second-attempt, and otherwise non-full evidence must not
    // silently advance scheduler memory.
    return { memory: previousMemory, isLapse: false };
  }

  if (previousMemory === null) {
    const result = memoryScheduler.initialize({
      reviewedAt: attempt.answeredAt,
      rating: ratingDecision.rating,
    });
    return { memory: result.nextState, isLapse: false };
  }

  const result = memoryScheduler.review(previousMemory, {
    reviewedAt: attempt.answeredAt,
    rating: ratingDecision.rating,
  });

  // A lapse requires a previously established scheduler state (there is
  // nothing to lapse from on the very first scheduler event).
  const isLapse = ratingDecision.rating === "AGAIN";

  return { memory: result.nextState, isLapse };
}

/**
 * Reason precedence (highest first): CONFIDENT_ERROR and LAPSE are
 * behavioral signals about this specific Attempt and take priority over
 * the structural INITIAL_ATTEMPT label. SPACED_RETRIEVAL_SUCCESS and
 * ASSISTED_SUCCESS are reported when relevant even on a technically-first
 * attempt. SAME_SESSION_SUCCESS / MISCONCEPTION_RECOVERY are intentionally
 * never returned here: no session or recovery policy is available yet.
 *
 * CONFIDENT_ERROR additionally requires FULL_EVIDENCE. Assisted,
 * second-attempt, revealed-answer, or otherwise low-quality evidence is not
 * clean enough to support this diagnostic signal yet, even when confidence
 * was reported as high.
 *
 * SPACED_RETRIEVAL_SUCCESS mutual-exclusivity proof (so this list order
 * never actually has to arbitrate a real conflict — verify this still
 * holds if any of these gates change):
 * - CONFIDENT_ERROR and LAPSE both require `!attempt.isCorrect`;
 *   SPACED_RETRIEVAL_SUCCESS requires `isCorrect` (qualifyRetrieval's
 *   INCORRECT gate would otherwise have already returned false);
 * - ASSISTED_SUCCESS requires evidenceQuality === "ASSISTED_EVIDENCE";
 *   SPACED_RETRIEVAL_SUCCESS requires "FULL_EVIDENCE" (qualifyRetrieval's
 *   NOT_FULL_EVIDENCE gate would otherwise have already returned false) —
 *   evidence.ts returns exactly one quality, so these can't both hold;
 * - INITIAL_ATTEMPT requires `previousProgress === null`;
 *   SPACED_RETRIEVAL_SUCCESS requires a non-null retrievalBaselineAt on
 *   previousProgress, which requires previousProgress to already exist.
 * Given this, `reason` can safely stay a single value instead of an array
 * — no signal is ever silently dropped by this precedence order today.
 */
function deriveStateUpdateReason(input: {
  isFirstAttempt: boolean;
  attempt: Attempt;
  evidenceQuality: EvidenceQuality;
  isLapse: boolean;
  retrievalQualificationReason: RetrievalQualificationReason;
}): StateUpdateReason | null {
  const {
    isFirstAttempt,
    attempt,
    evidenceQuality,
    isLapse,
    retrievalQualificationReason,
  } = input;

  if (
    !attempt.isCorrect &&
    attempt.confidenceLevel === "high" &&
    evidenceQuality === "FULL_EVIDENCE"
  ) {
    return "CONFIDENT_ERROR";
  }

  if (isLapse) {
    return "LAPSE";
  }

  if (retrievalQualificationReason === "QUALIFYING_SPACED_RETRIEVAL") {
    return "SPACED_RETRIEVAL_SUCCESS";
  }

  if (evidenceQuality === "ASSISTED_EVIDENCE" && attempt.isCorrect) {
    return "ASSISTED_SUCCESS";
  }

  if (isFirstAttempt) {
    return "INITIAL_ATTEMPT";
  }

  return null;
}

/**
 * Running average of response time, using only timed attempts. A missing
 * response time must never be treated as 0 — it simply does not
 * contribute to the average.
 */
function nextAverageResponseTimeSeconds(
  previousAverage: number | null,
  previousTimedAttemptCount: number,
  responseTimeSeconds: number | null,
): number | null {
  if (responseTimeSeconds === null) {
    return previousAverage;
  }

  if (previousAverage === null || previousTimedAttemptCount === 0) {
    return responseTimeSeconds;
  }

  const previousTotal = previousAverage * previousTimedAttemptCount;
  return (previousTotal + responseTimeSeconds) / (previousTimedAttemptCount + 1);
}

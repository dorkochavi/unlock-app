/**
 * Attempt -> Evidence -> Scheduler -> UserQuestionProgress.
 *
 * The smallest deterministic pure function that applies one immutable
 * Attempt to a learner's UserQuestionProgress for a Question.
 *
 * Rules this file deliberately follows:
 * - pure domain logic only: no DB, no network, no ts-fsrs, no Date.now(),
 *   no Math.random(). All time/versioning/scheduler dependencies are
 *   injected via `ProgressUpdateContext`;
 * - the Attempt itself is never mutated or rewritten (see ADR-005);
 * - this function does NOT decide mastery thresholds, misconception
 *   activation/recovery, evidence-strength thresholds, spacing thresholds,
 *   desired retention, or exam behavior. Those remain unresolved policy
 *   (docs/OPEN_QUESTIONS.md) and are preserved unchanged here so the real
 *   policies can be plugged in later without rewriting this function.
 */

import { classifyAttemptEvidence } from "./evidence";
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
}

export interface ProgressUpdateResult {
  progress: UserQuestionProgress;
  evidence: ClassifiedEvidence;
  schedulerRatingDecision: SchedulerRatingDecision;
  /**
   * The single most relevant, unambiguous reason for this update, or null
   * when no reason from `STATE_UPDATE_REASONS` unambiguously applies yet
   * (for example, an unremarkable non-first correct answer, before a
   * spacing/mastery policy is available to classify it further).
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

  const reason = deriveStateUpdateReason({
    isFirstAttempt: previousProgress === null,
    attempt,
    evidenceQuality: evidence.quality,
    isLapse,
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

    // Spacing has not been determined by any explicit policy yet
    // (docs/OPEN_QUESTIONS.md #12). Preserve, do not invent.
    successfulSpacedRetrievals: previousProgress?.successfulSpacedRetrievals ?? 0,
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

    // Evidence-strength/mastery-category thresholds are unresolved
    // (see src/domain/learning/mastery.ts). Preserve, do not invent;
    // deriveMasteryCategory can be plugged in by a caller once a
    // MasteryPolicy is available.
    evidenceStrength: previousProgress?.evidenceStrength ?? "insufficient",
    masteryCategory: previousProgress?.masteryCategory ?? "not_started",

    engineVersion: context.engineVersion,
    updatedAt: context.now,
  };

  return { progress, evidence, schedulerRatingDecision, reason };
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
 * the structural INITIAL_ATTEMPT label. ASSISTED_SUCCESS is reported when
 * relevant even on a technically-first attempt. SPACED_RETRIEVAL_SUCCESS /
 * SAME_SESSION_SUCCESS / MISCONCEPTION_RECOVERY are intentionally never
 * returned here: no spacing, session, or recovery policy is available yet.
 *
 * CONFIDENT_ERROR additionally requires FULL_EVIDENCE. Assisted,
 * second-attempt, revealed-answer, or otherwise low-quality evidence is not
 * clean enough to support this diagnostic signal yet, even when confidence
 * was reported as high.
 */
function deriveStateUpdateReason(input: {
  isFirstAttempt: boolean;
  attempt: Attempt;
  evidenceQuality: EvidenceQuality;
  isLapse: boolean;
}): StateUpdateReason | null {
  const { isFirstAttempt, attempt, evidenceQuality, isLapse } = input;

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

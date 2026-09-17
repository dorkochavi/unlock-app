/**
 * Deterministic, policy-driven Retrieval Qualification.
 *
 * Core question: "When should a clean correct retrieval count as new
 * evidence across time, rather than another success from the same
 * immediate learning episode?"
 *
 * This module does NOT schedule reviews — FSRS owns memory scheduling
 * (ADR-008). It only decides whether the current successful retrieval
 * should be allowed to increment `successfulSpacedRetrievals` for
 * UNLOCK's longitudinal learner model (consumed by mastery.ts and
 * evidence-strength.ts).
 *
 * Design rules this file follows:
 * - no hard-coded product thresholds: the only threshold
 *   (`minGapMsForSpacedRetrieval`) is injected via
 *   `RetrievalQualificationPolicy`; no default production policy is
 *   exported here;
 * - pure deterministic function: no Date.now(), no randomness, no DB, no
 *   LLM, no ts-fsrs/MemoryScheduler import;
 * - current evidence must be FULL_EVIDENCE and correct to qualify —
 *   assisted, low-quality, second-attempt, revealed-answer, or incorrect
 *   evidence can never qualify (docs/OPEN_QUESTIONS.md #12/#13 territory,
 *   but this specific gate is unambiguous, matching evidence.ts);
 * - same-session repetition never qualifies, regardless of how large a
 *   timestamp gap happens to separate the two attempts;
 * - session identity is caller-provided (`isSameLearningSession`), never
 *   inferred from timestamps or from a Today-session boundary this file
 *   does not define (docs/OPEN_QUESTIONS.md #3 is still open);
 * - missing session information (`null`) is treated conservatively as
 *   non-qualifying (`SESSION_UNKNOWN`), never optimistically as "assume
 *   a different session";
 * - the very first clean correct retrieval for a Question never
 *   qualifies — there is no prior qualifying retrieval to be spaced
 *   from. It may still be meaningful evidence elsewhere (evidence.ts,
 *   evidence-strength.ts), just not a *spaced* retrieval;
 * - `currentAttemptAt` earlier than `previousRetrievalBaselineAt` is
 *   rejected by throwing a typed `OutOfOrderRetrievalError`, rather than
 *   silently computing a negative gap;
 * - this module never mutates UserQuestionProgress — it only returns a
 *   qualification decision for a caller to apply.
 */

import type { EvidenceQuality } from "./types";

export const RETRIEVAL_QUALIFICATION_REASONS = [
  "NO_PRIOR_RETRIEVAL",
  "NOT_FULL_EVIDENCE",
  "INCORRECT",
  "SAME_SESSION",
  "SESSION_UNKNOWN",
  "GAP_TOO_SHORT",
  "QUALIFYING_SPACED_RETRIEVAL",
] as const;

export type RetrievalQualificationReason =
  (typeof RETRIEVAL_QUALIFICATION_REASONS)[number];

/**
 * Thrown when `currentAttemptAt` is earlier than `previousRetrievalBaselineAt`
 * — this module refuses to silently compute a negative gap. Exported as a
 * typed class (rather than a plain `Error`) specifically so callers outside
 * this module — the application layer's `submitAnswer` use case, and any
 * future rebuild/replay tool — can catch this exact domain invariant
 * violation by type instead of matching a message substring. This class
 * represents ONLY the domain invariant (`currentAttemptAt` vs.
 * `previousRetrievalBaselineAt`); it carries no knowledge of Attempts,
 * submissions, transactions, or anything else application-layer.
 */
export class OutOfOrderRetrievalError extends Error {
  constructor(
    public readonly currentAttemptAt: Date,
    public readonly previousRetrievalBaselineAt: Date,
  ) {
    super(
      "qualifyRetrieval: currentAttemptAt must not be earlier than " +
        "previousRetrievalBaselineAt; refusing to compute a negative gap.",
    );
    this.name = "OutOfOrderRetrievalError";
  }
}

/**
 * Caller-assembled context for one current Attempt being evaluated
 * against the learner's prior qualifying-retrieval history for this
 * Question.
 */
export interface RetrievalQualificationInput {
  /** Timestamp of the current Attempt being evaluated. */
  currentAttemptAt: Date;

  /** Raw correctness of the current Attempt. */
  isCorrect: boolean;

  /** Evidence quality of the current Attempt, from evidence.ts. */
  currentEvidenceQuality: EvidenceQuality;

  /**
   * Timestamp of the learner's most recent QUALIFYING spaced retrieval
   * for this Question (not merely the most recent correct answer), or
   * null when none exists yet.
   */
  previousRetrievalBaselineAt: Date | null;

  /**
   * true: caller has confirmed the current Attempt is in the same
   * learning session/occasion as the previous qualifying retrieval.
   * false: caller has confirmed they are in different sessions.
   * null: unknown. Treated conservatively as non-qualifying — never as
   * "assume different session".
   */
  isSameLearningSession: boolean | null;
}

/**
 * The only threshold this module needs. No production value is chosen
 * here — see docs/OPEN_QUESTIONS.md #12.
 */
export interface RetrievalQualificationPolicy {
  /** Minimum elapsed time (ms) since the previous qualifying retrieval. */
  minGapMsForSpacedRetrieval: number;
}

export interface RetrievalQualificationResult {
  qualifies: boolean;
  /**
   * Milliseconds elapsed since `previousRetrievalBaselineAt`, computed
   * whenever a prior qualifying retrieval exists and the current evidence
   * passed the quality/correctness gates — regardless of whether this
   * particular retrieval ultimately qualifies. Null when no gap could be
   * meaningfully computed (no prior retrieval, or the current evidence
   * failed the quality/correctness gates before timing was considered).
   */
  gapMs: number | null;
  reason: RetrievalQualificationReason;
}

/**
 * Validates policy configuration. Throws rather than letting an invalid
 * policy silently produce ambiguous behavior.
 */
export function validateRetrievalQualificationPolicy(
  policy: RetrievalQualificationPolicy,
): void {
  if (
    !Number.isFinite(policy.minGapMsForSpacedRetrieval) ||
    policy.minGapMsForSpacedRetrieval < 0
  ) {
    throw new Error(
      "RetrievalQualificationPolicy.minGapMsForSpacedRetrieval must be a " +
        `finite number >= 0, got ${policy.minGapMsForSpacedRetrieval}`,
    );
  }
}

/**
 * Decides whether the current successful retrieval qualifies as a new
 * spaced-retrieval data point for the learner model.
 *
 * Deterministic: given the same input and policy, always returns the
 * same result.
 */
export function qualifyRetrieval(
  input: RetrievalQualificationInput,
  policy: RetrievalQualificationPolicy,
): RetrievalQualificationResult {
  validateRetrievalQualificationPolicy(policy);

  if (input.currentEvidenceQuality !== "FULL_EVIDENCE") {
    return { qualifies: false, gapMs: null, reason: "NOT_FULL_EVIDENCE" };
  }

  if (!input.isCorrect) {
    return { qualifies: false, gapMs: null, reason: "INCORRECT" };
  }

  if (input.previousRetrievalBaselineAt === null) {
    return { qualifies: false, gapMs: null, reason: "NO_PRIOR_RETRIEVAL" };
  }

  if (
    input.currentAttemptAt.getTime() <
    input.previousRetrievalBaselineAt.getTime()
  ) {
    throw new OutOfOrderRetrievalError(
      input.currentAttemptAt,
      input.previousRetrievalBaselineAt,
    );
  }

  const gapMs =
    input.currentAttemptAt.getTime() -
    input.previousRetrievalBaselineAt.getTime();

  if (input.isSameLearningSession === true) {
    return { qualifies: false, gapMs, reason: "SAME_SESSION" };
  }

  if (input.isSameLearningSession === null) {
    return { qualifies: false, gapMs, reason: "SESSION_UNKNOWN" };
  }

  if (gapMs < policy.minGapMsForSpacedRetrieval) {
    return { qualifies: false, gapMs, reason: "GAP_TOO_SHORT" };
  }

  return { qualifies: true, gapMs, reason: "QUALIFYING_SPACED_RETRIEVAL" };
}

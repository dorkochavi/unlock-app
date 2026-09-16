/**
 * Deterministic, policy-driven Evidence Strength derivation.
 *
 * Evidence Strength is NOT mastery. It represents how much trustworthy
 * evidence UNLOCK currently has about a learner-question relationship —
 * i.e. confidence in the estimate, not the estimate itself
 * (docs/LEARNING_ENGINE.md §25).
 *
 * Design rules this file follows:
 * - no hard-coded product thresholds: every threshold is injected via
 *   `EvidenceStrengthPolicy`; no default production policy is exported
 *   here (docs/OPEN_QUESTIONS.md has no resolved thresholds yet);
 * - pure deterministic function: no Date.now(), no randomness, no DB, no
 *   LLM, no FSRS/MemoryScheduler import;
 * - consumes an explicit caller-assembled summary (`EvidenceStrengthInput`)
 *   rather than reading raw Attempts or UserQuestionProgress itself;
 * - missing evidence stays missing: `observationSpanMs: null` and
 *   `hasOnlySameSessionEvidence: null` are never treated as if they were
 *   permissive/positive facts — see `meetsStrong` below;
 * - same-session repetition alone can never produce "strong" (only
 *   `hasOnlySameSessionEvidence === false`, an explicit confirmation of
 *   multiple occasions, can satisfy the strong tier's session gate);
 * - assisted/low-quality attempts are tracked for explainability only —
 *   they never count toward `meaningfulAttemptCount` comparisons;
 * - spacing (`successfulSpacedRetrievals`) is caller-decided; this file
 *   does not derive what "spaced" means (docs/OPEN_QUESTIONS.md #12);
 * - behavior is monotonic: increasing meaningfulAttemptCount,
 *   successfulSpacedRetrievals, or observationSpanMs (holding
 *   hasOnlySameSessionEvidence !== true) never lowers the resulting tier,
 *   because every gate is a simple `>=` comparison against the same
 *   growing inputs;
 * - contradictory policies (e.g. a "strong" threshold lower than a
 *   "moderate" one) fail fast via `validateEvidenceStrengthPolicy`/at the
 *   start of `deriveEvidenceStrength`, rather than producing ambiguous
 *   output.
 */

import type { EvidenceStrength } from "./types";

export const EVIDENCE_STRENGTH_REASONS = [
  "NO_MEANINGFUL_EVIDENCE",
  "ASSISTANCE_HEAVY",
  "EARLY_EVIDENCE",
  "INSUFFICIENT_SPACING",
  "INSUFFICIENT_OBSERVATION_SPAN",
  "SAME_SESSION_ONLY",
  "SESSION_DIVERSITY_UNKNOWN",
  "MODERATE_EVIDENCE",
  "STRONG_EVIDENCE",
] as const;

export type EvidenceStrengthReason = (typeof EVIDENCE_STRENGTH_REASONS)[number];

/**
 * Caller-assembled summary. Every dimension here must be something a
 * caller can actually compute deterministically today; nothing is
 * derived from raw Attempts inside this file.
 */
export interface EvidenceStrengthInput {
  /** Count of attempts classified as FULL_EVIDENCE (see evidence.ts). */
  meaningfulAttemptCount: number;

  /**
   * Count of successful spaced retrievals. An already-decided signal —
   * this file does not derive what qualifies as "spaced"
   * (docs/OPEN_QUESTIONS.md #12).
   */
  successfulSpacedRetrievals: number;

  /**
   * Milliseconds between the earliest and most recent meaningful
   * evidence, or null when unknown/not computable. Null must never be
   * treated as "wide enough" — see the strong-tier span gate.
   */
  observationSpanMs: number | null;

  /**
   * Count of ASSISTED_EVIDENCE-quality attempts observed. Context only —
   * never contributes to meaningfulAttemptCount comparisons.
   */
  assistedAttemptCount: number;

  /**
   * Count of LOW_QUALITY_EVIDENCE-quality attempts observed. Context
   * only — never contributes to meaningfulAttemptCount comparisons.
   */
  lowQualityAttemptCount: number;

  /**
   * true: caller has confirmed all meaningful evidence occurred within a
   * single learning occasion (no diversity of occasion at all).
   * false: caller has confirmed evidence spans multiple occasions.
   * null: unknown. Null must never be treated as equivalent to `false`
   * for the strong tier — see the strong-tier session gate.
   */
  hasOnlySameSessionEvidence: boolean | null;
}

/**
 * All thresholds the derivation needs. No values here are hard-coded
 * product decisions.
 */
export interface EvidenceStrengthPolicy {
  /** Minimum meaningful attempts before evidence can be "early". */
  minMeaningfulAttemptsForEarly: number;

  /** Minimum meaningful attempts before evidence can be "moderate". */
  minMeaningfulAttemptsForModerate: number;

  /** Minimum meaningful attempts before evidence can be "strong". */
  minMeaningfulAttemptsForStrong: number;

  /** Minimum successful spaced retrievals before evidence can be "moderate". */
  minSpacedRetrievalsForModerate: number;

  /** Minimum successful spaced retrievals before evidence can be "strong". */
  minSpacedRetrievalsForStrong: number;

  /**
   * Minimum observation span (ms) before evidence can be "strong", or
   * null to not gate the strong tier on span at all. An unknown
   * (`null`) input span never satisfies a non-null threshold here.
   */
  minObservationSpanMsForStrong: number | null;
}

export interface EvidenceStrengthResult {
  strength: EvidenceStrength;
  reasons: EvidenceStrengthReason[];
}

/**
 * Validates that policy thresholds are internally consistent. Throws
 * rather than letting a contradictory policy produce ambiguous output.
 */
export function validateEvidenceStrengthPolicy(
  policy: EvidenceStrengthPolicy,
): void {
  const nonNegativeFields: Array<[string, number]> = [
    ["minMeaningfulAttemptsForEarly", policy.minMeaningfulAttemptsForEarly],
    [
      "minMeaningfulAttemptsForModerate",
      policy.minMeaningfulAttemptsForModerate,
    ],
    ["minMeaningfulAttemptsForStrong", policy.minMeaningfulAttemptsForStrong],
    ["minSpacedRetrievalsForModerate", policy.minSpacedRetrievalsForModerate],
    ["minSpacedRetrievalsForStrong", policy.minSpacedRetrievalsForStrong],
  ];

  for (const [name, value] of nonNegativeFields) {
    if (value < 0) {
      throw new Error(
        `EvidenceStrengthPolicy.${name} must be >= 0, got ${value}`,
      );
    }
  }

  if (
    policy.minObservationSpanMsForStrong !== null &&
    policy.minObservationSpanMsForStrong < 0
  ) {
    throw new Error(
      "EvidenceStrengthPolicy.minObservationSpanMsForStrong must be null " +
        `or >= 0, got ${policy.minObservationSpanMsForStrong}`,
    );
  }

  if (
    policy.minMeaningfulAttemptsForEarly >
    policy.minMeaningfulAttemptsForModerate
  ) {
    throw new Error(
      "EvidenceStrengthPolicy is contradictory: " +
        "minMeaningfulAttemptsForEarly must be <= minMeaningfulAttemptsForModerate",
    );
  }

  if (
    policy.minMeaningfulAttemptsForModerate >
    policy.minMeaningfulAttemptsForStrong
  ) {
    throw new Error(
      "EvidenceStrengthPolicy is contradictory: " +
        "minMeaningfulAttemptsForModerate must be <= minMeaningfulAttemptsForStrong",
    );
  }

  if (
    policy.minSpacedRetrievalsForModerate > policy.minSpacedRetrievalsForStrong
  ) {
    throw new Error(
      "EvidenceStrengthPolicy is contradictory: " +
        "minSpacedRetrievalsForModerate must be <= minSpacedRetrievalsForStrong",
    );
  }
}

/**
 * Derives the current Evidence Strength tier from a caller-assembled
 * summary, under an explicitly injected policy.
 *
 * Deterministic: given the same input and policy, always returns the
 * same result.
 */
export function deriveEvidenceStrength(
  input: EvidenceStrengthInput,
  policy: EvidenceStrengthPolicy,
): EvidenceStrengthResult {
  validateEvidenceStrengthPolicy(policy);

  if (input.meaningfulAttemptCount < policy.minMeaningfulAttemptsForEarly) {
    const noMeaningfulEvidenceAtAll = input.meaningfulAttemptCount <= 0;
    const hasOnlyNonMeaningfulActivity =
      noMeaningfulEvidenceAtAll &&
      (input.assistedAttemptCount > 0 || input.lowQualityAttemptCount > 0);

    return {
      strength: "insufficient",
      reasons: [
        hasOnlyNonMeaningfulActivity
          ? "ASSISTANCE_HEAVY"
          : "NO_MEANINGFUL_EVIDENCE",
      ],
    };
  }

  const meetsModerateAttempts =
    input.meaningfulAttemptCount >= policy.minMeaningfulAttemptsForModerate;
  const meetsModerateSpacing =
    input.successfulSpacedRetrievals >= policy.minSpacedRetrievalsForModerate;

  const meetsStrongAttempts =
    input.meaningfulAttemptCount >= policy.minMeaningfulAttemptsForStrong;
  const meetsStrongSpacing =
    input.successfulSpacedRetrievals >= policy.minSpacedRetrievalsForStrong;
  const meetsStrongSpan =
    policy.minObservationSpanMsForStrong === null ||
    (input.observationSpanMs !== null &&
      input.observationSpanMs >= policy.minObservationSpanMsForStrong);
  // Only an explicit `false` (confirmed multiple occasions) satisfies
  // this gate. `null` (unknown) must not silently unlock "strong" — that
  // would convert missing information into a positive signal.
  const confirmedMultipleSessions = input.hasOnlySameSessionEvidence === false;

  const meetsStrong =
    meetsStrongAttempts &&
    meetsStrongSpacing &&
    meetsStrongSpan &&
    confirmedMultipleSessions;

  if (meetsStrong) {
    return { strength: "strong", reasons: ["STRONG_EVIDENCE"] };
  }

  if (meetsModerateAttempts && meetsModerateSpacing) {
    const reasons: EvidenceStrengthReason[] = ["MODERATE_EVIDENCE"];

    // Only report why "strong" specifically was missed when the
    // attempt-count gate for strong was already satisfied — otherwise
    // attempt count itself is the (unremarkable, already-implied) reason,
    // and singling out spacing/span/session would misattribute the cause.
    if (meetsStrongAttempts) {
      if (!meetsStrongSpacing) {
        reasons.push("INSUFFICIENT_SPACING");
      } else if (!meetsStrongSpan) {
        reasons.push("INSUFFICIENT_OBSERVATION_SPAN");
      } else if (!confirmedMultipleSessions) {
        reasons.push(
          input.hasOnlySameSessionEvidence === true
            ? "SAME_SESSION_ONLY"
            : "SESSION_DIVERSITY_UNKNOWN",
        );
      }
    }

    return { strength: "moderate", reasons };
  }

  const reasons: EvidenceStrengthReason[] = ["EARLY_EVIDENCE"];
  if (meetsModerateAttempts && !meetsModerateSpacing) {
    reasons.push("INSUFFICIENT_SPACING");
  }

  return { strength: "early", reasons };
}

import {
  type EvidenceStrength,
  type MasteryCategory,
} from "./types";

/**
 * Deliberately policy-driven.
 *
 * We have NOT yet finalized the numerical thresholds that separate
 * learning / strengthening / mastered. This file provides the contract
 * without smuggling arbitrary Base44-style rules into V1.
 */
export interface MasteryDecisionInput {
  meaningfulAttemptCount: number;
  successfulSpacedRetrievals: number;
  lapseCount: number;

  evidenceStrength: EvidenceStrength;

  /**
   * Estimated current probability of successful retrieval, when available.
   * Kept nullable so the domain can exist before the scheduler adapter is
   * wired in.
   */
  retrievabilityEstimate: number | null;

  /**
   * True when a lapse is considered currently unresolved.
   */
  hasUnresolvedLapse: boolean;
}

export interface MasteryPolicy {
  /**
   * Minimum number of successful spaced retrievals before an item can enter
   * strengthening. This is configuration, not a hard-coded product truth.
   */
  minSpacedRetrievalsForStrengthening: number;

  /**
   * Minimum number of successful spaced retrievals before an item can even
   * be considered for mastered.
   */
  minSpacedRetrievalsForMastered: number;

  /**
   * Minimum evidence strength required for mastered.
   */
  minEvidenceStrengthForMastered: EvidenceStrength;

  /**
   * Optional current retrievability floor required for mastered.
   * null means "do not use retrievability as a gate yet".
   */
  minRetrievabilityForMastered: number | null;
}

const EVIDENCE_STRENGTH_RANK: Record<EvidenceStrength, number> = {
  insufficient: 0,
  early: 1,
  moderate: 2,
  strong: 3,
};

function hasEnoughEvidenceStrength(
  actual: EvidenceStrength,
  required: EvidenceStrength,
): boolean {
  return EVIDENCE_STRENGTH_RANK[actual] >= EVIDENCE_STRENGTH_RANK[required];
}

/**
 * Pure mastery-category derivation.
 *
 * This intentionally does not look at correct streaks or raw accuracy.
 * Durable mastery is based on spaced retrieval evidence and current memory
 * confidence, not same-session repetition.
 */
export function deriveMasteryCategory(
  input: MasteryDecisionInput,
  policy: MasteryPolicy,
): MasteryCategory {
  if (input.meaningfulAttemptCount === 0) {
    return "not_started";
  }

  const meetsMasteredSpacing =
    input.successfulSpacedRetrievals >=
    policy.minSpacedRetrievalsForMastered;

  const meetsMasteredEvidence = hasEnoughEvidenceStrength(
    input.evidenceStrength,
    policy.minEvidenceStrengthForMastered,
  );

  const meetsRetrievabilityGate =
    policy.minRetrievabilityForMastered === null ||
    (input.retrievabilityEstimate !== null &&
      input.retrievabilityEstimate >=
        policy.minRetrievabilityForMastered);

  if (
    !input.hasUnresolvedLapse &&
    meetsMasteredSpacing &&
    meetsMasteredEvidence &&
    meetsRetrievabilityGate
  ) {
    return "mastered";
  }

  if (
    input.successfulSpacedRetrievals >=
    policy.minSpacedRetrievalsForStrengthening
  ) {
    return "strengthening";
  }

  return "learning";
}

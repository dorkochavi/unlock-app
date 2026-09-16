import type {
  ClassifiedEvidence,
  ConfidenceLevel,
} from "./types";
import type { SchedulerRating } from "./scheduler";

/**
 * Explicit boundary for mapping UNLOCK learning evidence into the rating
 * expected by the memory scheduler.
 *
 * IMPORTANT:
 * This is deliberately conservative. It exists so we do NOT smuggle a
 * "correct = GOOD / slow = HARD / wrong = AGAIN" rule into the system
 * without an explicit decision.
 */

export interface SchedulerRatingInput {
  evidence: ClassifiedEvidence;
  confidenceLevel: ConfidenceLevel | null;
}

export type SchedulerRatingDecision =
  | {
      kind: "RATED";
      rating: SchedulerRating;
      reason: string;
    }
  | {
      kind: "NOT_RATABLE";
      reason: string;
    };

/**
 * Minimal V1 mapping policy.
 *
 * Current intentional behavior:
 * - invalid / assisted / low-quality evidence does not update the memory
 *   scheduler yet;
 * - a clean incorrect first attempt maps to AGAIN;
 * - a clean correct first attempt maps to GOOD;
 * - HARD/EASY are intentionally NOT inferred from response time or
 *   confidence in V1.
 *
 * This policy can be replaced later without changing scheduler adapters.
 */
export function mapEvidenceToSchedulerRating(
  input: SchedulerRatingInput,
): SchedulerRatingDecision {
  const { evidence } = input;

  if (evidence.quality !== "FULL_EVIDENCE") {
    return {
      kind: "NOT_RATABLE",
      reason: `evidence_quality:${evidence.quality}`,
    };
  }

  if (evidence.attempt.isCorrect) {
    return {
      kind: "RATED",
      rating: "GOOD",
      reason: "full_evidence_correct",
    };
  }

  return {
    kind: "RATED",
    rating: "AGAIN",
    reason: "full_evidence_incorrect",
  };
}

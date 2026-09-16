import {
  type Attempt,
  type ClassifiedEvidence,
  type EvidenceQuality,
} from "./types";

/**
 * Returns whether this Attempt may count as full-strength evidence toward
 * durable mastery.
 *
 * IMPORTANT:
 * - This function classifies evidence quality.
 * - It does NOT update mastery.
 * - It does NOT decide a scheduler rating.
 */
export function classifyAttemptEvidence(attempt: Attempt): ClassifiedEvidence {
  const reasons: string[] = [];

  if (attempt.answerWasRevealedBeforeResponse) {
    reasons.push("answer_revealed_before_response");
    return {
      attempt,
      quality: "INVALID_FOR_MASTERY",
      reasons,
    };
  }

  if (attempt.assistanceUsed === "ANSWER_REVEALED") {
    reasons.push("answer_revealed_assistance");
    return {
      attempt,
      quality: "INVALID_FOR_MASTERY",
      reasons,
    };
  }

  if (attempt.attemptNumberForPresentedItem > 1) {
    reasons.push("not_first_attempt_for_presented_item");
    return {
      attempt,
      quality: "LOW_QUALITY_EVIDENCE",
      reasons,
    };
  }

  if (attempt.assistanceUsed === "SECOND_ATTEMPT") {
    reasons.push("second_attempt_assistance");
    return {
      attempt,
      quality: "LOW_QUALITY_EVIDENCE",
      reasons,
    };
  }

  if (
    attempt.assistanceUsed === "FIFTY_FIFTY" ||
    attempt.assistanceUsed === "HINT" ||
    attempt.assistanceUsed === "OTHER"
  ) {
    reasons.push(`assistance:${attempt.assistanceUsed.toLowerCase()}`);
    return {
      attempt,
      quality: "ASSISTED_EVIDENCE",
      reasons,
    };
  }

  if (attempt.suspiciousTiming) {
    reasons.push("suspicious_timing");
    return {
      attempt,
      quality: "LOW_QUALITY_EVIDENCE",
      reasons,
    };
  }

  return {
    attempt,
    quality: "FULL_EVIDENCE",
    reasons,
  };
}

export function canCountAsFullMasteryEvidence(
  quality: EvidenceQuality,
): boolean {
  return quality === "FULL_EVIDENCE";
}

export function canInfluenceLearningState(
  quality: EvidenceQuality,
): boolean {
  return quality !== "INVALID_FOR_MASTERY";
}

/**
 * Pre-Pilot S1 — the ONE place instructor aggregate-disclosure thresholds
 * live. Routes/UI/application code must call `decideAggregateDisclosure`
 * rather than re-implementing or hardcoding these numbers.
 *
 * Pure and deterministic: inputs are counts only. The contract carries no
 * learner identity by construction.
 *
 * The thresholds are PILOT product/privacy thresholds (CHATGPT_PLAN.md
 * Pre-Pilot §4), not universal legal or statistical claims. Group-size is
 * checked before response count, so a too-small Course never leaks even a
 * response count's sufficiency.
 */

/** Minimum active LEARNER memberships in a Course before any aggregate is disclosed. */
export const MIN_ACTIVE_LEARNERS_FOR_DISCLOSURE = 5;

/** Minimum distinct responders on one Question before its statistics are disclosed. */
export const MIN_DISTINCT_RESPONDERS_FOR_DISCLOSURE = 5;

export type AggregateDisclosureDecision =
  | "ELIGIBLE"
  | "INSUFFICIENT_COURSE_SIZE"
  | "INSUFFICIENT_RESPONSES";

export interface AggregateDisclosureInput {
  /** Active LEARNER memberships in the Course (non-revoked, non-archived). */
  activeLearnerCount: number;
  /** Distinct learners with a counted response to the Question. */
  distinctResponderCount: number;
}

/**
 * Non-integer, negative, or NaN counts are a caller bug, not a disclosure
 * state — throws rather than guessing (fail closed).
 */
export function decideAggregateDisclosure(
  input: AggregateDisclosureInput,
): AggregateDisclosureDecision {
  assertCount("activeLearnerCount", input.activeLearnerCount);
  assertCount("distinctResponderCount", input.distinctResponderCount);

  if (input.activeLearnerCount < MIN_ACTIVE_LEARNERS_FOR_DISCLOSURE) {
    return "INSUFFICIENT_COURSE_SIZE";
  }
  if (input.distinctResponderCount < MIN_DISTINCT_RESPONDERS_FOR_DISCLOSURE) {
    return "INSUFFICIENT_RESPONSES";
  }
  return "ELIGIBLE";
}

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `decideAggregateDisclosure: ${name} must be a non-negative integer, got ${value}`,
    );
  }
}

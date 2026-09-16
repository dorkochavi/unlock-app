/**
 * Deterministic misconception-state policy.
 *
 * This file is independent from progress-update.ts, FSRS, and
 * MemoryScheduler. It takes a prior misconception snapshot plus a small,
 * pre-classified signal input and returns the next misconception state,
 * score, lastSeenAt, and an explicit transition reason.
 *
 * Design rules this file follows:
 * - no hard-coded product thresholds: every threshold/weight is injected
 *   via `MisconceptionPolicy`;
 * - no Date.now(), no randomness, no DB, no LLM, no FSRS/MemoryScheduler
 *   import;
 * - the ONLY signal that can raise the score is `isConfidentErrorSignal`
 *   (a caller-computed FULL_EVIDENCE + incorrect + high-confidence signal
 *   — see progress-update.ts's CONFIDENT_ERROR gate). This file does not
 *   re-derive evidence classification itself, so the gate cannot silently
 *   drift out of sync in two places;
 * - the ONLY signal that can lower the score is
 *   `isQualifyingRecoveryEvidence`, an explicit caller-provided flag. This
 *   file does not derive spacing/session rules (docs/OPEN_QUESTIONS.md
 *   #12/#13) — a caller decides what "qualifies" as recovery evidence;
 * - this file does NOT modify masteryCategory or evidenceStrength, and is
 *   not wired into progress-update.ts yet.
 *
 * lastSeenAt semantics (see requirement 12): `lastSeenAt` means "the
 * timestamp of the most recent misconception-relevant evidence observed"
 * — i.e. it updates whenever `isConfidentErrorSignal` or
 * `isQualifyingRecoveryEvidence` is true, regardless of whether the state
 * actually transitioned. It does NOT mean "last state transition", and it
 * does NOT update on NO_CHANGE evaluations (evidence irrelevant to
 * misconception, e.g. assisted/second-attempt/invalid/low-confidence
 * wrong answers).
 *
 * Misconception score meaning: a bounded, policy-driven diagnostic score
 * in [policy.minScore, policy.maxScore], not a probability. It only
 * reflects the accumulation of qualifying confident-error signals net of
 * qualifying recovery evidence, under whatever weights the policy assigns.
 * It carries no statistical guarantee and must not be presented to a
 * learner as a probability.
 */

import type { MisconceptionState } from "./types";

export const MISCONCEPTION_TRANSITION_REASONS = [
  "CONFIDENT_ERROR_OBSERVED",
  "MISCONCEPTION_SUSPECTED",
  "MISCONCEPTION_ACTIVATED",
  "RECOVERY_EVIDENCE_OBSERVED",
  "MISCONCEPTION_RECOVERING",
  "MISCONCEPTION_RESOLVED",
  "NO_CHANGE",
] as const;

export type MisconceptionTransitionReason =
  (typeof MISCONCEPTION_TRANSITION_REASONS)[number];

/**
 * Prior misconception state to evolve from. Pass null for a Question the
 * learner has no misconception history for yet (equivalent to
 * { state: "none", score: policy.minScore, lastSeenAt: null }).
 */
export interface MisconceptionSnapshot {
  state: MisconceptionState;
  score: number;
  lastSeenAt: Date | null;
}

/**
 * Pre-classified signal for one piece of evidence. Both flags are computed
 * by the caller — this file trusts them rather than re-deriving evidence
 * classification, so there is exactly one place (progress-update.ts's
 * CONFIDENT_ERROR gate, and whatever future recovery-evidence policy is
 * written) that decides what qualifies.
 */
export interface MisconceptionSignalInput {
  /**
   * True only for a qualifying confident-error signal: FULL_EVIDENCE +
   * incorrect + confidenceLevel "high". Assisted, second-attempt,
   * revealed-answer/invalid, and low/medium-confidence wrong answers must
   * all be passed as false — they are not this strong a signal (V1).
   */
  isConfidentErrorSignal: boolean;

  /**
   * True only when the caller has already determined this evidence
   * qualifies as recovery evidence (for example a later, sufficiently
   * spaced correct retrieval). This file never derives that on its own.
   */
  isQualifyingRecoveryEvidence: boolean;

  /** Timestamp of the evidence being applied. */
  observedAt: Date;
}

/**
 * All thresholds/weights the transition logic needs. No values here are
 * hard-coded product decisions — callers (tests, and eventually a real
 * product policy) supply them explicitly.
 */
export interface MisconceptionPolicy {
  /** Score added when a qualifying confident-error signal is observed. */
  confidentErrorScoreIncrement: number;

  /** Score subtracted when qualifying recovery evidence is observed. */
  recoveryScoreDecrement: number;

  /** Inclusive lower bound for the score. */
  minScore: number;

  /** Inclusive upper bound for the score. */
  maxScore: number;

  /**
   * Minimum score for the state to become (or remain) at least
   * "suspected" in response to a confident-error signal.
   */
  suspectedScoreThreshold: number;

  /**
   * Minimum score for the state to escalate to "active" in response to a
   * confident-error signal. A single confident error does NOT imply
   * "active" unless the policy's increment alone reaches this threshold —
   * that is an explicit policy choice, not something this file assumes.
   */
  activeScoreThreshold: number;

  /**
   * Score at or below which, while "recovering", qualifying recovery
   * evidence completes the transition to "resolved".
   */
  resolvedScoreThreshold: number;
}

export interface MisconceptionResult {
  state: MisconceptionState;
  score: number;
  lastSeenAt: Date | null;
  reason: MisconceptionTransitionReason;
}

const TRANSITION_REASON_BY_NEXT_STATE: Partial<
  Record<MisconceptionState, MisconceptionTransitionReason>
> = {
  suspected: "MISCONCEPTION_SUSPECTED",
  active: "MISCONCEPTION_ACTIVATED",
  recovering: "MISCONCEPTION_RECOVERING",
  resolved: "MISCONCEPTION_RESOLVED",
};

/**
 * Applies one misconception-relevant signal to the prior snapshot,
 * returning the next state/score/lastSeenAt plus an explicit reason.
 *
 * Deterministic: given the same `previous`, `input`, and `policy`, this
 * always returns the same result. No implicit clock, no randomness.
 */
export function applyMisconceptionSignal(
  previous: MisconceptionSnapshot | null,
  input: MisconceptionSignalInput,
  policy: MisconceptionPolicy,
): MisconceptionResult {
  const previousState = previous?.state ?? "none";
  const previousScore = previous?.score ?? policy.minScore;
  const previousLastSeenAt = previous?.lastSeenAt ?? null;

  if (!input.isConfidentErrorSignal && !input.isQualifyingRecoveryEvidence) {
    return {
      state: previousState,
      score: previousScore,
      lastSeenAt: previousLastSeenAt,
      reason: "NO_CHANGE",
    };
  }

  const score = nextScore(previousScore, input, policy);
  const nextState = deriveNextState(previousState, score, input, policy);
  const reason = deriveTransitionReason(previousState, nextState, input);

  return {
    state: nextState,
    score,
    lastSeenAt: input.observedAt,
    reason,
  };
}

function nextScore(
  previousScore: number,
  input: MisconceptionSignalInput,
  policy: MisconceptionPolicy,
): number {
  let score = previousScore;

  if (input.isConfidentErrorSignal) {
    score += policy.confidentErrorScoreIncrement;
  }

  if (input.isQualifyingRecoveryEvidence) {
    score -= policy.recoveryScoreDecrement;
  }

  return clampScore(score, policy);
}

function clampScore(score: number, policy: MisconceptionPolicy): number {
  return Math.min(policy.maxScore, Math.max(policy.minScore, score));
}

/**
 * Uniform, score-driven state derivation. Deliberately does not special-
 * case every (previousState, signal) pair beyond what the score and the
 * signal type imply — this keeps the policy genuinely policy-driven
 * (threshold-based) rather than an implicit hard-coded transition matrix.
 *
 * A confident-error signal only ever moves the state toward escalation
 * (none/resolved -> suspected -> active), based purely on where the score
 * lands relative to the injected thresholds; it never directly produces
 * "recovering" or "resolved". A qualifying-recovery signal only ever
 * moves the state toward recovery (active/suspected -> recovering ->
 * resolved); it is a no-op on "none" (nothing to recover from) and on
 * "resolved" (already resolved).
 */
function deriveNextState(
  previousState: MisconceptionState,
  score: number,
  input: MisconceptionSignalInput,
  policy: MisconceptionPolicy,
): MisconceptionState {
  if (input.isConfidentErrorSignal) {
    if (score >= policy.activeScoreThreshold) {
      return "active";
    }
    if (score >= policy.suspectedScoreThreshold) {
      return "suspected";
    }
    return previousState;
  }

  // input.isQualifyingRecoveryEvidence is true here (guaranteed by the
  // NO_CHANGE guard above).
  if (previousState === "recovering") {
    return score <= policy.resolvedScoreThreshold ? "resolved" : "recovering";
  }

  if (previousState === "active" || previousState === "suspected") {
    return "recovering";
  }

  // "none" or "resolved": nothing currently active/suspected to recover
  // from.
  return previousState;
}

function deriveTransitionReason(
  previousState: MisconceptionState,
  nextState: MisconceptionState,
  input: MisconceptionSignalInput,
): MisconceptionTransitionReason {
  if (nextState !== previousState) {
    const transitionReason = TRANSITION_REASON_BY_NEXT_STATE[nextState];
    if (transitionReason) {
      return transitionReason;
    }
  }

  if (input.isConfidentErrorSignal) {
    return "CONFIDENT_ERROR_OBSERVED";
  }

  return "RECOVERY_EVIDENCE_OBSERVED";
}

/**
 * Learner Topic progress state (Run 009 S1) — a pure, deterministic,
 * NON-persisted derivation over existing per-Question learner state. No
 * percentage, no score, no new mastery vocabulary: it only composes the
 * existing `masteryCategory`, `misconceptionState` and unresolved-lapse rule.
 *
 * States (Plan D2):
 * - NOT_STARTED: no real Attempt on any Question in the Topic.
 * - NEEDS_REINFORCEMENT: an ATTEMPTED Question has an `active` misconception
 *   or an unresolved lapse. A `suspected` misconception alone never triggers
 *   it, and sparse evidence never resolves here.
 * - SOLID: no reinforcement signal, the coverage gate is met, and every
 *   ATTEMPTED Question is `strengthening` or `mastered`.
 * - IN_PROGRESS: everything else with evidence.
 * Precedence: NEEDS_REINFORCEMENT over SOLID.
 *
 * Coverage gate (Plan constant, integer-safe): N = current published
 * Questions in the Topic, A = attempted. N >= 3: A >= 3 AND 2A >= N.
 * N = 1 or 2: A = N.
 */
import type { MasteryCategory, MisconceptionState } from "../learning/types";
import { deriveHasUnresolvedLapse } from "../learning/lapse";

export const LEARNER_TOPIC_STATES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "NEEDS_REINFORCEMENT",
  "SOLID",
] as const;
export type LearnerTopicState = (typeof LEARNER_TOPIC_STATES)[number];

/** One current published Question of a Topic, from one learner's point of view. */
export interface TopicQuestionLearnerState {
  /** ADR-017: at least one real persisted Attempt (a missing progress row alone is not evidence either way). */
  attempted: boolean;
  /** Progress fields; null when the learner has no progress row for the Question. */
  progress: {
    masteryCategory: MasteryCategory;
    misconceptionState: MisconceptionState;
    lastLapseAt: Date | null;
    retrievalBaselineAt: Date | null;
  } | null;
}

export interface LearnerTopicProgress {
  state: LearnerTopicState;
  attemptedCount: number;
  totalCount: number;
}

export function meetsSolidCoverageGate(totalCount: number, attemptedCount: number): boolean {
  if (totalCount >= 3) {
    return attemptedCount >= 3 && 2 * attemptedCount >= totalCount;
  }
  return totalCount >= 1 && attemptedCount === totalCount;
}

export function deriveLearnerTopicProgress(
  questions: readonly TopicQuestionLearnerState[],
): LearnerTopicProgress {
  const totalCount = questions.length;
  const attempted = questions.filter((question) => question.attempted);
  const attemptedCount = attempted.length;

  if (attemptedCount === 0) {
    return { state: "NOT_STARTED", attemptedCount, totalCount };
  }

  const needsReinforcement = attempted.some(
    ({ progress }) =>
      progress !== null &&
      (progress.misconceptionState === "active" ||
        deriveHasUnresolvedLapse(progress.lastLapseAt, progress.retrievalBaselineAt)),
  );
  if (needsReinforcement) {
    return { state: "NEEDS_REINFORCEMENT", attemptedCount, totalCount };
  }

  const allStrong = attempted.every(
    ({ progress }) =>
      progress !== null &&
      (progress.masteryCategory === "strengthening" || progress.masteryCategory === "mastered"),
  );
  if (allStrong && meetsSolidCoverageGate(totalCount, attemptedCount)) {
    return { state: "SOLID", attemptedCount, totalCount };
  }

  return { state: "IN_PROGRESS", attemptedCount, totalCount };
}

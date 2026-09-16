/**
 * UNLOCK Learning Engine V1 — memory scheduler boundary.
 *
 * The domain depends on this interface, not on ts-fsrs (or any other
 * external scheduler library) directly.
 */

export const SCHEDULER_RATINGS = [
  "AGAIN",
  "HARD",
  "GOOD",
  "EASY",
] as const;

export type SchedulerRating = (typeof SCHEDULER_RATINGS)[number];

/**
 * Generic scheduler state owned by the memory-scheduling layer.
 *
 * These names intentionally reflect the concepts UNLOCK cares about,
 * while allowing an adapter to map to a concrete FSRS implementation.
 */
export interface SchedulerMemoryState {
  stability: number;
  difficulty: number;
  scheduledReviewAt: Date;
  lastReviewAt: Date | null;
  reviewCount: number;
  lapseCount: number;
}

/**
 * Input required when initializing scheduler state for an item that has no
 * previous scheduler history.
 */
export interface InitialReviewInput {
  reviewedAt: Date;
  rating: SchedulerRating;
}

/**
 * Input for a subsequent review.
 *
 * Notice that UNLOCK does NOT pass raw Attempt here. The mapping from
 * domain evidence -> scheduler rating is an explicit separate concern.
 */
export interface ReviewEvidence {
  reviewedAt: Date;
  rating: SchedulerRating;
}

/**
 * Result returned by the scheduler adapter after a review.
 */
export interface MemoryReviewResult {
  previousState: SchedulerMemoryState | null;
  nextState: SchedulerMemoryState;
  rating: SchedulerRating;
  reviewedAt: Date;
}

/**
 * Pluggable memory scheduling boundary.
 *
 * A future ts-fsrs adapter (or another implementation) must satisfy this
 * interface. The rest of the learning domain should never import the
 * external scheduler package directly.
 */
export interface MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryReviewResult;

  review(
    state: SchedulerMemoryState,
    input: ReviewEvidence,
  ): MemoryReviewResult;

  estimateRetrievability(
    state: SchedulerMemoryState,
    at: Date,
  ): number;
}

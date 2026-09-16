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
 * A JSON-serializable value. Used instead of `unknown` for persisted
 * scheduler implementation state so that a future persistence layer can
 * still validate/parse it as JSON, even though the domain does not know
 * the concrete field names inside it.
 */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Opaque, adapter-owned scheduler state.
 *
 * A concrete scheduler implementation (for example ts-fsrs) may need to
 * preserve fields the domain does not otherwise care about (e.g. a card's
 * internal learning-step counter) in order to faithfully reconstruct its
 * own state between reviews. The domain must never read or invent values
 * for `state` itself — it only threads this bag through unchanged between
 * `MemoryScheduler` calls, so the adapter can reconstruct exactly what it
 * previously produced instead of guessing.
 */
export interface SchedulerImplementationState {
  /** Identifies which concrete scheduler produced `state` (e.g. "ts-fsrs"). */
  implementation: string;
  /** Schema version of `state`, owned by the adapter, for future migrations. */
  schemaVersion: number;
  /** JSON-serializable implementation-specific fields. */
  state: Record<string, JsonValue>;
}

/**
 * Generic scheduler state owned by the memory-scheduling layer.
 *
 * The top-level fields are the common, cross-adapter-inspectable
 * projection UNLOCK cares about. `implementationState` carries whatever
 * additional fields the concrete adapter needs to reconstruct its own
 * state exactly, without leaking that adapter's types into the domain.
 */
export interface SchedulerMemoryState {
  stability: number;
  difficulty: number;
  scheduledReviewAt: Date;
  lastReviewAt: Date | null;
  reviewCount: number;
  lapseCount: number;
  implementationState: SchedulerImplementationState;
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

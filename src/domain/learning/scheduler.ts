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

  /**
   * RUN010-D / docs/OPEN_QUESTIONS.md #44 (OQ-044): classifies whether
   * `state` is still in a short-term acquisition/relearning phase
   * ("learning") or has reached ordinary long-term spaced review
   * ("review") — so domain code (next-best-action.ts /
   * today-plan-budget.ts) can distinguish a genuine multi-day-due
   * REVIEW_DUE candidate from a same-day short-learning-step "due again"
   * artifact (OQ-044: a stock scheduler default can make a once-answered
   * Question due again within minutes).
   *
   * Deliberately a METHOD, not a stored field on `SchedulerMemoryState` —
   * same "recomputed here, never persisted" treatment as
   * `estimateRetrievability` above, and for the same reason: a value
   * attached only to an in-memory `SchedulerMemoryState` object would be
   * silently lost across a real persistence round-trip (the Postgres
   * mapper reconstructs `SchedulerMemoryState` from named/JSON columns,
   * none of which would carry an ad hoc extra field). Deriving it instead,
   * on demand, from whatever `implementationState` the adapter already
   * knows how to reconstruct (exactly what `estimateRetrievability`
   * already does) makes it durable for free, with no new schema/column
   * needed.
   *
   * OPTIONAL: a scheduler adapter/fake with no notion of a learning/review
   * phase distinction may omit it entirely. Every caller that reads the
   * resulting value MUST treat a missing implementation (or a missing
   * `SchedulerMemoryState`) as "review" — no positive evidence it is a
   * short-term artifact — never as "learning" (see
   * next-best-action.ts/today-plan-budget.ts's own doc comments).
   */
  estimateCardPhase?(state: SchedulerMemoryState): "learning" | "review";
}

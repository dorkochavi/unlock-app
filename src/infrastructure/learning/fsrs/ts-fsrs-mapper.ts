/**
 * Explicit mapping between UNLOCK's domain scheduler contracts and the
 * ts-fsrs library's Card/Rating types.
 *
 * This is the ONLY place in the codebase allowed to know ts-fsrs field
 * names. `src/domain/learning` must never import ts-fsrs directly.
 *
 * Per ADR-008, this mapper does not decide desired retention or the
 * evidence -> rating policy. It only translates between an already-decided
 * `SchedulerRating` and ts-fsrs's `Grade`, and between ts-fsrs's `Card` and
 * UNLOCK's `SchedulerMemoryState`.
 */

import { Rating, State } from "ts-fsrs";
import type { Card, CardInput, Grade, StateType } from "ts-fsrs";

import type {
  JsonValue,
  SchedulerImplementationState,
  SchedulerMemoryState,
  SchedulerRating,
} from "@/domain/learning/scheduler";

export const TS_FSRS_IMPLEMENTATION_ID = "ts-fsrs";

/**
 * Schema version of the JSON bag stored in `implementationState.state`.
 * Increment this if the set of persisted ts-fsrs Card fields changes, so a
 * future migration can detect and handle old persisted state explicitly
 * instead of guessing.
 */
export const TS_FSRS_STATE_SCHEMA_VERSION = 1;

const FSRS_STATE_NAMES = [
  "New",
  "Learning",
  "Review",
  "Relearning",
] as const;

const SCHEDULER_RATING_TO_FSRS_GRADE: Record<SchedulerRating, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

export function mapSchedulerRatingToFsrsGrade(
  rating: SchedulerRating,
): Grade {
  return SCHEDULER_RATING_TO_FSRS_GRADE[rating];
}

/**
 * Builds domain `SchedulerMemoryState` from a ts-fsrs `Card`, preserving
 * every field ts-fsrs needs to reconstruct this exact card later.
 */
export function fromFsrsCard(card: Card): SchedulerMemoryState {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledReviewAt: card.due,
    lastReviewAt: card.last_review ?? null,
    reviewCount: card.reps,
    lapseCount: card.lapses,
    implementationState: {
      implementation: TS_FSRS_IMPLEMENTATION_ID,
      schemaVersion: TS_FSRS_STATE_SCHEMA_VERSION,
      state: {
        due: card.due.toISOString(),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        reps: card.reps,
        lapses: card.lapses,
        state: State[card.state],
        last_review: card.last_review ? card.last_review.toISOString() : null,
      },
    },
  };
}

function assertTsFsrsImplementationState(
  implementationState: SchedulerImplementationState,
): void {
  if (implementationState.implementation !== TS_FSRS_IMPLEMENTATION_ID) {
    throw new Error(
      `ts-fsrs adapter cannot reconstruct scheduler state produced by ` +
        `implementation "${implementationState.implementation}". Refusing ` +
        `to guess missing FSRS state.`,
    );
  }

  if (implementationState.schemaVersion !== TS_FSRS_STATE_SCHEMA_VERSION) {
    throw new Error(
      `ts-fsrs adapter does not know how to read scheduler state schema ` +
        `version ${implementationState.schemaVersion} (expected ` +
        `${TS_FSRS_STATE_SCHEMA_VERSION}). A migration is required before ` +
        `this state can be reused.`,
    );
  }
}

function readNumberField(
  bag: Record<string, JsonValue>,
  key: string,
): number {
  const value = bag[key];
  if (typeof value !== "number") {
    throw new Error(
      `ts-fsrs adapter: expected numeric field "${key}" in persisted ` +
        `scheduler state, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function readStringField(
  bag: Record<string, JsonValue>,
  key: string,
): string {
  const value = bag[key];
  if (typeof value !== "string") {
    throw new Error(
      `ts-fsrs adapter: expected string field "${key}" in persisted ` +
        `scheduler state, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function readNullableStringField(
  bag: Record<string, JsonValue>,
  key: string,
): string | null {
  const value = bag[key];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error(
      `ts-fsrs adapter: expected nullable string field "${key}" in ` +
        `persisted scheduler state, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

function readFsrsStateName(bag: Record<string, JsonValue>): StateType {
  const value = readStringField(bag, "state");
  if (
    !FSRS_STATE_NAMES.includes(value as (typeof FSRS_STATE_NAMES)[number])
  ) {
    throw new Error(
      `ts-fsrs adapter: unrecognized card state "${value}" in persisted ` +
        `scheduler state.`,
    );
  }
  return value as StateType;
}

/**
 * Reconstructs a ts-fsrs `CardInput` from previously persisted domain
 * state. Throws rather than silently defaulting when the state was not
 * produced by this adapter/schema version, or when an expected field is
 * missing or the wrong type.
 */
export function toFsrsCardInput(state: SchedulerMemoryState): CardInput {
  assertTsFsrsImplementationState(state.implementationState);
  const bag = state.implementationState.state;

  return {
    due: readStringField(bag, "due"),
    stability: readNumberField(bag, "stability"),
    difficulty: readNumberField(bag, "difficulty"),
    elapsed_days: readNumberField(bag, "elapsed_days"),
    scheduled_days: readNumberField(bag, "scheduled_days"),
    learning_steps: readNumberField(bag, "learning_steps"),
    reps: readNumberField(bag, "reps"),
    lapses: readNumberField(bag, "lapses"),
    state: readFsrsStateName(bag),
    last_review: readNullableStringField(bag, "last_review"),
  };
}

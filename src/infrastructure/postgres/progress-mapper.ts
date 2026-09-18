/**
 * Explicit row <-> domain mapping for `user_question_progress` (Phase 5's
 * mapping audit).
 *
 * The trickiest part is `memory` (`SchedulerMemoryState | null`), which is
 * spread across 9 physical columns that must all be null together (no
 * ratable evidence yet) or all present together (see the schema's own
 * comment on `user_question_progress.memory_stability` and
 * `docs/DECISIONS/008-fsrs-memory-scheduler.md`). This mapper enforces that
 * grouping explicitly rather than trusting it — a row with some but not all
 * of the group populated is a data-corruption bug and must throw, not
 * silently produce a partially-null `SchedulerMemoryState` (which the
 * domain type does not even allow: every field except `lastReviewAt` is
 * required).
 */
import {
  EVIDENCE_STRENGTHS,
  MASTERY_CATEGORIES,
  MISCONCEPTION_STATES,
  type UserQuestionProgress,
} from "../../domain/learning/types";
import type {
  SchedulerImplementationState,
  SchedulerMemoryState,
} from "../../domain/learning/scheduler";
import {
  MalformedRowError,
  readDate,
  readEnum,
  readNullableDate,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
} from "./row-validation";

const TABLE = "user_question_progress";

const MEMORY_GROUP_COLUMNS = [
  "memory_stability",
  "memory_difficulty",
  "scheduled_review_at",
  "scheduler_review_count",
  "scheduler_lapse_count",
  "scheduler_implementation",
  "scheduler_schema_version",
  "scheduler_state",
] as const;

/**
 * `scheduler_state` holds ONLY `SchedulerImplementationState.state` (the
 * opaque adapter-owned bag) — `implementation`/`schemaVersion` are their
 * own typed columns (`scheduler_implementation`/`scheduler_schema_version`)
 * precisely so they stay queryable/indexable, and are recombined with this
 * bag below to reconstruct the full envelope. This function validates only
 * that the bag itself is a JSON object (not an array/primitive) — it does
 * NOT validate its adapter-specific internal fields. That deeper
 * validation already exists, deliberately at the adapter boundary instead
 * of here: `src/infrastructure/learning/fsrs/ts-fsrs-mapper.ts`'s
 * `assertTsFsrsImplementationState` + `readNumberField`/`readStringField`/
 * etc. already fail loudly on malformed ts-fsrs-specific fields the moment
 * that adapter actually reads them. Duplicating that here would either
 * hardcode ts-fsrs field names into the Postgres layer (violating ADR-008's
 * "no ts-fsrs-specific schema columns" boundary) or reimplement the same
 * generic-JSON-shape check twice for no benefit.
 */
function readSchedulerStateBag(value: unknown): Record<string, never> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MalformedRowError(
      TABLE,
      "scheduler_state",
      `expected a JSON object, got ${JSON.stringify(value)}`,
    );
  }
  return value as Record<string, never>;
}

function readSchedulerImplementationState(
  row: Record<string, unknown>,
): SchedulerImplementationState {
  return {
    implementation: readString(row, TABLE, "scheduler_implementation"),
    schemaVersion: readNumber(row, TABLE, "scheduler_schema_version"),
    state: readSchedulerStateBag(row.scheduler_state),
  };
}

function readMemory(row: Record<string, unknown>): SchedulerMemoryState | null {
  const presentCount = MEMORY_GROUP_COLUMNS.filter(
    (column) => row[column] !== null && row[column] !== undefined,
  ).length;

  if (presentCount === 0) {
    return null;
  }
  if (presentCount !== MEMORY_GROUP_COLUMNS.length) {
    throw new MalformedRowError(
      TABLE,
      MEMORY_GROUP_COLUMNS.join(", "),
      `expected all-or-none of the scheduler-memory columns to be non-null, ` +
        `got ${presentCount}/${MEMORY_GROUP_COLUMNS.length} populated`,
    );
  }

  return {
    stability: readNumber(row, TABLE, "memory_stability"),
    difficulty: readNumber(row, TABLE, "memory_difficulty"),
    scheduledReviewAt: readDate(row, TABLE, "scheduled_review_at"),
    lastReviewAt: readNullableDate(row, TABLE, "last_review_at"),
    reviewCount: readNumber(row, TABLE, "scheduler_review_count"),
    lapseCount: readNumber(row, TABLE, "scheduler_lapse_count"),
    implementationState: readSchedulerImplementationState(row),
  };
}

export function mapProgressRow(
  row: Record<string, unknown>,
): UserQuestionProgress {
  return {
    userId: readString(row, TABLE, "user_id"),
    questionId: readString(row, TABLE, "question_id"),
    attemptCount: readNumber(row, TABLE, "attempt_count"),
    correctCount: readNumber(row, TABLE, "correct_count"),
    lastAttemptAt: readNullableDate(row, TABLE, "last_attempt_at"),
    lastCorrectAt: readNullableDate(row, TABLE, "last_correct_at"),
    lastIncorrectAt: readNullableDate(row, TABLE, "last_incorrect_at"),
    memory: readMemory(row),
    retrievalBaselineAt: readNullableDate(row, TABLE, "retrieval_baseline_at"),
    retrievalBaselineLearningSessionId: readNullableString(
      row,
      TABLE,
      "retrieval_baseline_learning_session_id",
    ),
    successfulSpacedRetrievals: readNumber(
      row,
      TABLE,
      "successful_spaced_retrievals",
    ),
    lapseCount: readNumber(row, TABLE, "lapse_count"),
    lastLapseAt: readNullableDate(row, TABLE, "last_lapse_at"),
    misconceptionState: readEnum(
      row,
      TABLE,
      "misconception_state",
      MISCONCEPTION_STATES,
    ),
    misconceptionScore: readNumber(row, TABLE, "misconception_score"),
    misconceptionLastSeenAt: readNullableDate(
      row,
      TABLE,
      "misconception_last_seen_at",
    ),
    timedAttemptCount: readNumber(row, TABLE, "timed_attempt_count"),
    averageResponseTimeSeconds: readNullableNumber(
      row,
      TABLE,
      "average_response_time_seconds",
    ),
    meaningfulAttemptCount: readNumber(row, TABLE, "meaningful_attempt_count"),
    assistedAttemptCount: readNumber(row, TABLE, "assisted_attempt_count"),
    lowQualityAttemptCount: readNumber(row, TABLE, "low_quality_attempt_count"),
    invalidForMasteryAttemptCount: readNumber(
      row,
      TABLE,
      "invalid_for_mastery_attempt_count",
    ),
    firstMeaningfulEvidenceAt: readNullableDate(
      row,
      TABLE,
      "first_meaningful_evidence_at",
    ),
    lastMeaningfulEvidenceAt: readNullableDate(
      row,
      TABLE,
      "last_meaningful_evidence_at",
    ),
    evidenceStrength: readEnum(row, TABLE, "evidence_strength", EVIDENCE_STRENGTHS),
    masteryCategory: readEnum(row, TABLE, "mastery_category", MASTERY_CATEGORIES),
    engineVersion: readString(row, TABLE, "engine_version"),
    updatedAt: readDate(row, TABLE, "updated_at"),
  };
}

/**
 * Ordered parameter tuple for `PostgresUserQuestionProgressRepository`'s
 * `INSERT ... ON CONFLICT DO UPDATE` upsert statement.
 */
export function progressUpsertParams(progress: UserQuestionProgress): unknown[] {
  const memory = progress.memory;
  return [
    progress.userId,
    progress.questionId,
    progress.attemptCount,
    progress.correctCount,
    progress.lastAttemptAt,
    progress.lastCorrectAt,
    progress.lastIncorrectAt,
    memory?.stability ?? null,
    memory?.difficulty ?? null,
    memory?.scheduledReviewAt ?? null,
    memory?.lastReviewAt ?? null,
    memory?.reviewCount ?? null,
    memory?.lapseCount ?? null,
    memory?.implementationState.implementation ?? null,
    memory?.implementationState.schemaVersion ?? null,
    memory ? JSON.stringify(memory.implementationState.state) : null,
    progress.retrievalBaselineAt,
    progress.retrievalBaselineLearningSessionId,
    progress.successfulSpacedRetrievals,
    progress.lapseCount,
    progress.lastLapseAt,
    progress.misconceptionState,
    progress.misconceptionScore,
    progress.misconceptionLastSeenAt,
    progress.timedAttemptCount,
    progress.averageResponseTimeSeconds,
    progress.meaningfulAttemptCount,
    progress.assistedAttemptCount,
    progress.lowQualityAttemptCount,
    progress.invalidForMasteryAttemptCount,
    progress.firstMeaningfulEvidenceAt,
    progress.lastMeaningfulEvidenceAt,
    progress.evidenceStrength,
    progress.masteryCategory,
    progress.engineVersion,
    progress.updatedAt,
  ];
}

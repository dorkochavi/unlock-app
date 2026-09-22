/**
 * Explicit row <-> domain mapping for `attempts` (Phase 5's mapping audit).
 *
 * Deliberately does not rely on any driver's automatic type coercion —
 * every field is read through `row-validation.ts`'s typed readers, which
 * throw on a structurally invalid value rather than silently producing a
 * wrong-but-plausible `Attempt`.
 */
import {
  ASSISTANCE_TYPES,
  CONFIDENCE_LEVELS,
  type Attempt,
  type SelectedAnswer,
} from "../../domain/learning/types";
import {
  MalformedRowError,
  readBoolean,
  readDate,
  readEnum,
  readNullableNumber,
  readNullableString,
  readNumber,
  readString,
} from "./row-validation";

const TABLE = "attempts";

/**
 * `selected_answer` is `jsonb`. Per ADR-014, the domain `SelectedAnswer`
 * shape is a single option id (`string`, SINGLE_CHOICE), a set of option
 * ids (`string[]`, MULTIPLE_CHOICE), or `null` — never a bare number,
 * object, or an array containing anything but strings.
 */
function readSelectedAnswer(row: Record<string, unknown>): SelectedAnswer {
  const value = row.selected_answer;
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.every((entry) => typeof entry === "string")) {
      return value;
    }
    throw new MalformedRowError(
      TABLE,
      "selected_answer",
      `expected every array element to be a string option id, got ${JSON.stringify(value)}`,
    );
  }
  throw new MalformedRowError(
    TABLE,
    "selected_answer",
    `expected a string option id, an array of string option ids, or null, got ${JSON.stringify(value)}`,
  );
}

export function mapAttemptRow(row: Record<string, unknown>): Attempt {
  return {
    id: readString(row, TABLE, "id"),
    submissionId: readString(row, TABLE, "submission_id"),
    userId: readString(row, TABLE, "user_id"),
    courseId: readString(row, TABLE, "course_id"),
    questionId: readString(row, TABLE, "question_id"),
    questionVersionId: readString(row, TABLE, "question_version_id"),
    answeredAt: readDate(row, TABLE, "answered_at"),
    isCorrect: readBoolean(row, TABLE, "is_correct"),
    selectedAnswer: readSelectedAnswer(row),
    confidenceLevel:
      row.confidence_level === null || row.confidence_level === undefined
        ? null
        : readEnum(row, TABLE, "confidence_level", CONFIDENCE_LEVELS),
    responseTimeSeconds: readNullableNumber(row, TABLE, "response_time_seconds"),
    dailyPlanId: readNullableString(row, TABLE, "daily_plan_id"),
    dailyPlanItemId: readNullableString(row, TABLE, "daily_plan_item_id"),
    learningSessionId: readNullableString(row, TABLE, "learning_session_id"),
    assistanceUsed: readEnum(row, TABLE, "assistance_used", ASSISTANCE_TYPES),
    attemptNumberForPresentedItem: readNumber(
      row,
      TABLE,
      "attempt_number_for_presented_item",
    ),
    suspiciousTiming: readBoolean(row, TABLE, "suspicious_timing"),
    answerWasRevealedBeforeResponse: readBoolean(
      row,
      TABLE,
      "answer_was_revealed_before_response",
    ),
    engineVersion: readString(row, TABLE, "engine_version"),
  };
}

/** DB-acceptance timestamp — a persistence concept, not part of `Attempt`
 * itself (see `rebuild.ts`'s `AttemptReplayRecord`). Read separately so
 * `mapAttemptRow` stays the single source of truth for the domain shape. */
export function readCreatedAt(row: Record<string, unknown>): Date {
  return readDate(row, TABLE, "created_at");
}

/**
 * Ordered parameter tuple for the `attempts` INSERT column list used by
 * `PostgresAttemptRepository` — kept as its own function (not inlined at
 * the call site) so the column order is defined exactly once and the
 * repository's SQL text and this list can be visually diffed against each
 * other.
 */
export function attemptInsertParams(attempt: Attempt): unknown[] {
  return [
    attempt.id,
    attempt.submissionId,
    attempt.userId,
    attempt.courseId,
    attempt.questionId,
    attempt.questionVersionId,
    attempt.learningSessionId,
    attempt.answeredAt,
    attempt.isCorrect,
    // jsonb column: a bare JS string/number is not valid JSON text on its
    // own (e.g. `A` vs. `"A"`) — must be JSON-encoded before binding, or
    // Postgres rejects it as invalid json input. `null` is passed through
    // as-is so the column gets a real SQL NULL, not a jsonb `null` literal.
    attempt.selectedAnswer === null
      ? null
      : JSON.stringify(attempt.selectedAnswer),
    attempt.confidenceLevel,
    attempt.responseTimeSeconds,
    attempt.assistanceUsed,
    attempt.attemptNumberForPresentedItem,
    attempt.suspiciousTiming,
    attempt.answerWasRevealedBeforeResponse,
    attempt.engineVersion,
    attempt.dailyPlanId,
    attempt.dailyPlanItemId,
  ];
}

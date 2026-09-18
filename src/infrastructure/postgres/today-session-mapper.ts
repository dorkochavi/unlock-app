/**
 * Explicit row <-> domain mapping for `today_sessions` / `today_session_items`
 * (Phase 5's mapping audit).
 */
import {
  NEXT_BEST_ACTION_REASONS,
  NEXT_BEST_ACTION_TYPES,
  type NextBestActionReason,
  type NextBestActionType,
} from "../../domain/learning/next-best-action";
import { NEXT_BEST_ACTION_PRIORITY_TIERS } from "../../domain/learning/next-best-action-ranking";
import type { TodaySession, TodaySessionItem } from "../../application/learning/ports";
import {
  MalformedRowError,
  readDate,
  readDateOnlyString,
  readEnum,
  readNullableDate,
  readNumber,
  readString,
} from "./row-validation";

const SESSION_TABLE = "today_sessions";
const ITEM_TABLE = "today_session_items";

const ITEM_STATUSES = ["pending", "completed", "skipped"] as const;

/**
 * `other_applicable_types`/`reasons` are `jsonb` arrays of a closed,
 * already-decided value set (`action_type`'s and a dedicated reasons enum
 * respectively) — validated element-by-element rather than trusted as
 * `NextBestActionType[]`/`NextBestActionReason[]` merely because the
 * column is an array of strings.
 */
function readEnumArray<T extends string>(
  row: Record<string, unknown>,
  table: string,
  column: string,
  allowed: readonly T[],
): T[] {
  const value = row[column];
  if (!Array.isArray(value)) {
    throw new MalformedRowError(
      table,
      column,
      `expected a JSON array, got ${JSON.stringify(value)}`,
    );
  }
  return value.map((element, index) => {
    if (typeof element !== "string" || !(allowed as readonly string[]).includes(element)) {
      throw new MalformedRowError(
        table,
        column,
        `element ${index} (${JSON.stringify(element)}) is not one of ${JSON.stringify(allowed)}`,
      );
    }
    return element as T;
  });
}

export function mapTodaySessionItemRow(
  row: Record<string, unknown>,
): TodaySessionItem {
  return {
    id: readString(row, ITEM_TABLE, "id"),
    todaySessionId: readString(row, ITEM_TABLE, "today_session_id"),
    userId: readString(row, ITEM_TABLE, "user_id"),
    position: readNumber(row, ITEM_TABLE, "position"),
    questionId: readString(row, ITEM_TABLE, "question_id"),
    questionVersionId: readString(row, ITEM_TABLE, "question_version_id"),
    actionType: readEnum(row, ITEM_TABLE, "action_type", NEXT_BEST_ACTION_TYPES),
    tier: readEnum(row, ITEM_TABLE, "tier", NEXT_BEST_ACTION_PRIORITY_TIERS),
    otherApplicableTypes: readEnumArray<NextBestActionType>(
      row,
      ITEM_TABLE,
      "other_applicable_types",
      NEXT_BEST_ACTION_TYPES,
    ),
    reasons: readEnumArray<NextBestActionReason>(
      row,
      ITEM_TABLE,
      "reasons",
      NEXT_BEST_ACTION_REASONS,
    ),
    status: readEnum(row, ITEM_TABLE, "status", ITEM_STATUSES),
    completedAt: readNullableDate(row, ITEM_TABLE, "completed_at"),
  };
}

/**
 * `status` on `today_sessions` itself is deliberately free text at the DB
 * level (`docs/DATABASE.md` §17: exact state machine deferred) — read as a
 * plain string, not validated against a closed set that does not exist yet.
 */
export function mapTodaySessionRow(
  row: Record<string, unknown>,
  items: TodaySessionItem[],
): TodaySession {
  return {
    id: readString(row, SESSION_TABLE, "id"),
    userId: readString(row, SESSION_TABLE, "user_id"),
    courseId: readString(row, SESSION_TABLE, "course_id"),
    plannedForDate: readDateOnlyString(row, SESSION_TABLE, "planned_for_date"),
    status: readString(row, SESSION_TABLE, "status"),
    engineVersion: readString(row, SESSION_TABLE, "engine_version"),
    generatedAt: readDate(row, SESSION_TABLE, "generated_at"),
    startedAt: readNullableDate(row, SESSION_TABLE, "started_at"),
    completedAt: readNullableDate(row, SESSION_TABLE, "completed_at"),
    items,
  };
}

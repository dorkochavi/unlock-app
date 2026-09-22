/**
 * Explicit row <-> domain mapping for `daily_plans` / `daily_plan_items`
 * (Phase 5's mapping-audit precedent).
 */
import {
  NEXT_BEST_ACTION_TYPES,
  type NextBestActionType,
} from "../../domain/learning/next-best-action";
import { DAILY_PLAN_ITEM_STATUSES } from "../../domain/dailyPlan/types";
import {
  DAILY_PLAN_ITEM_ACTION_TYPES,
  DAILY_PLAN_ITEM_REASONS,
  DAILY_PLAN_ITEM_TIERS,
  type DailyPlanItemReason,
  type DailyPlan,
  type DailyPlanItem,
} from "../../application/dailyPlan/ports";
import {
  MalformedRowError,
  readDate,
  readDateOnlyString,
  readEnum,
  readNullableDate,
  readNumber,
  readString,
} from "./row-validation";

const PLAN_TABLE = "daily_plans";
const ITEM_TABLE = "daily_plan_items";

/**
 * `other_applicable_types`/`reasons` are `jsonb` arrays of a closed,
 * already-decided value set — validated element-by-element rather than
 * trusted merely because the column is an array of strings.
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

export function mapDailyPlanItemRow(row: Record<string, unknown>): DailyPlanItem {
  return {
    id: readString(row, ITEM_TABLE, "id"),
    dailyPlanId: readString(row, ITEM_TABLE, "daily_plan_id"),
    userId: readString(row, ITEM_TABLE, "user_id"),
    courseId: readString(row, ITEM_TABLE, "course_id"),
    position: readNumber(row, ITEM_TABLE, "position"),
    questionId: readString(row, ITEM_TABLE, "question_id"),
    questionVersionId: readString(row, ITEM_TABLE, "question_version_id"),
    actionType: readEnum(row, ITEM_TABLE, "action_type", DAILY_PLAN_ITEM_ACTION_TYPES),
    tier: readEnum(row, ITEM_TABLE, "tier", DAILY_PLAN_ITEM_TIERS),
    otherApplicableTypes: readEnumArray<NextBestActionType>(
      row,
      ITEM_TABLE,
      "other_applicable_types",
      NEXT_BEST_ACTION_TYPES,
    ),
    reasons: readEnumArray<DailyPlanItemReason>(
      row,
      ITEM_TABLE,
      "reasons",
      DAILY_PLAN_ITEM_REASONS,
    ),
    status: readEnum(row, ITEM_TABLE, "status", DAILY_PLAN_ITEM_STATUSES),
    resolvedAt: readNullableDate(row, ITEM_TABLE, "resolved_at"),
    completedAt: readNullableDate(row, ITEM_TABLE, "completed_at"),
  };
}

/**
 * `status` on `daily_plans` itself is deliberately free text at the DB
 * level (state machine deferred) — read as a plain string, not validated
 * against a closed set that does not exist yet.
 */
export function mapDailyPlanRow(
  row: Record<string, unknown>,
  items: DailyPlanItem[],
): DailyPlan {
  return {
    id: readString(row, PLAN_TABLE, "id"),
    userId: readString(row, PLAN_TABLE, "user_id"),
    plannedForDate: readDateOnlyString(row, PLAN_TABLE, "planned_for_date"),
    status: readString(row, PLAN_TABLE, "status"),
    engineVersion: readString(row, PLAN_TABLE, "engine_version"),
    generatedAt: readDate(row, PLAN_TABLE, "generated_at"),
    startedAt: readNullableDate(row, PLAN_TABLE, "started_at"),
    completedAt: readNullableDate(row, PLAN_TABLE, "completed_at"),
    items,
  };
}

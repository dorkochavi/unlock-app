/**
 * DailyPlan/DailyPlanItem domain contracts — ADR-016 §1/§19.
 *
 * Pure types and pure policy functions only — no persistence, no IO,
 * matching this codebase's established domain/application/infrastructure
 * separation (`docs/ARCHITECTURE.md`, the same discipline
 * `src/domain/course/types.ts` already follows).
 *
 * This module deliberately does NOT reimplement Today's ranking/planning
 * logic — that already lives in `src/domain/learning/next-best-action.ts`,
 * `next-best-action-ranking.ts`, `today-planner.ts` and is unchanged by
 * this slice. It only models the single-use resolution rule ADR-016 §19
 * requires for the persisted plan/item shape.
 */

export const DAILY_PLAN_ITEM_STATUSES = ["pending", "completed", "skipped"] as const;
export type DailyPlanItemStatus = (typeof DAILY_PLAN_ITEM_STATUSES)[number];

/**
 * ADR-016 §19: a DailyPlanItem may be resolved (COMPLETED or SKIPPED)
 * exactly once. Only a `pending` item may be resolved — an item that is
 * already `completed` or `skipped` must never accept a second resolution,
 * silently or otherwise.
 */
export function canResolveDailyPlanItem(status: DailyPlanItemStatus): boolean {
  return status === "pending";
}

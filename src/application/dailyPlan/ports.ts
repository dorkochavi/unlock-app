/**
 * Persistence port for the DailyPlan application layer — ADR-016 §1/§19.
 *
 * Deliberately mirrors `src/application/learning/ports.ts`'s
 * `TodaySession`/`TodaySessionItem`/`TodaySessionRepository` shape closely:
 * DailyPlan is the accepted TARGET architecture superseding TodaySession's
 * per-Course key (ADR-016 §1), not a conceptually different thing. The one
 * structural difference: `courseId` lives on each `DailyPlanItem`
 * independently, not on a single parent session.
 *
 * This is a PERSISTENCE FOUNDATION ONLY. No candidate generation, no
 * multi-Course pooling, and no wiring into `submitAnswer`/`UnitOfWork`
 * exists yet — see `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` step 5/6
 * for what remains before this is used end-to-end.
 */
import type {
  NextBestActionReason,
  NextBestActionType,
} from "../../domain/learning/next-best-action";
import type { NextBestActionPriorityTier } from "../../domain/learning/next-best-action-ranking";
import type { DailyPlanItemStatus } from "../../domain/dailyPlan/types";

export interface DailyPlanItem {
  id: string;
  dailyPlanId: string;
  userId: string;
  courseId: string;
  position: number;
  questionId: string;
  questionVersionId: string;
  actionType: NextBestActionType;
  tier: NextBestActionPriorityTier;
  otherApplicableTypes: NextBestActionType[];
  reasons: NextBestActionReason[];
  status: DailyPlanItemStatus;
  /** Set once, the first time this item leaves `pending` (ADR-016 §19). */
  resolvedAt: Date | null;
  /** Set only for a COMPLETED item — equals `resolvedAt` in that case. */
  completedAt: Date | null;
}

export interface DailyPlan {
  id: string;
  userId: string;
  plannedForDate: string;
  status: string;
  engineVersion: string;
  generatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  items: DailyPlanItem[];
}

export interface DailyPlanKey {
  userId: string;
  plannedForDate: string;
}

/**
 * Outcome of resolving (completing or skipping) a DailyPlanItem. ADR-016
 * §19 requires a distinct, typed outcome for the already-resolved case —
 * never a silent success, never a silently-discarded second resolution.
 */
export type ResolveDailyPlanItemResult =
  | { outcome: "RESOLVED"; item: DailyPlanItem }
  | { outcome: "ALREADY_RESOLVED"; item: DailyPlanItem }
  | { outcome: "NOT_FOUND" };

export interface DailyPlanRepository {
  findByKey(key: DailyPlanKey): Promise<DailyPlan | null>;

  /**
   * Race-free by construction (`INSERT ... ON CONFLICT (user_id,
   * planned_for_date) DO NOTHING RETURNING` + fallback `SELECT`, mirroring
   * `TodaySessionRepository.createIfNotExists`/ADR-010's established
   * pattern). Returns the newly-created plan, or the existing one if
   * another concurrent call won the race for the same key — the
   * caller-supplied `plan`/`items` are silently discarded in that case,
   * exactly as `TodaySessionRepository.createIfNotExists` already
   * documents for its own contract.
   */
  createIfNotExists(
    plan: Omit<DailyPlan, "items" | "id">,
    items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">>,
  ): Promise<DailyPlan>;

  findItemById(itemId: string): Promise<DailyPlanItem | null>;

  /**
   * Resolves a `pending` item as COMPLETED. Enforces ADR-016 §19's
   * single-use rule: an item that is already `completed` or `skipped`
   * returns `ALREADY_RESOLVED` with its current (unchanged) state, never a
   * silent overwrite. Returns `NOT_FOUND` if no item exists for `itemId`.
   */
  markCompleted(
    itemId: string,
    completedAt: Date,
  ): Promise<ResolveDailyPlanItemResult>;

  /**
   * Resolves a `pending` item as SKIPPED. Same single-use enforcement as
   * `markCompleted`. Never creates an Attempt and never touches
   * `UserQuestionProgress` — this port has no way to, since it only ever
   * issues an `UPDATE daily_plan_items`.
   */
  markSkipped(
    itemId: string,
    skippedAt: Date,
  ): Promise<ResolveDailyPlanItemResult>;
}

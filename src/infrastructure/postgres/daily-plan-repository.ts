/**
 * PostgreSQL implementation of `DailyPlanRepository`
 * (`src/application/dailyPlan/ports.ts`), backed by `daily_plans` /
 * `daily_plan_items`.
 *
 * Persistence foundation only — see `ports.ts`'s own module doc comment.
 */
import { canResolveDailyPlanItem } from "../../domain/dailyPlan/types";
import type {
  DailyPlan,
  DailyPlanItem,
  DailyPlanKey,
  DailyPlanRepository,
  ResolveDailyPlanItemResult,
} from "../../application/dailyPlan/ports";
import { mapDailyPlanItemRow, mapDailyPlanRow } from "./daily-plan-mapper";
import type { TransactionExecutor } from "./sql-executor";

function itemInsertParams(
  dailyPlanId: string,
  userId: string,
  item: Omit<DailyPlanItem, "id" | "dailyPlanId">,
): unknown[] {
  return [
    dailyPlanId,
    userId,
    item.courseId,
    item.position,
    item.questionId,
    item.questionVersionId,
    item.actionType,
    item.tier,
    JSON.stringify(item.otherApplicableTypes),
    JSON.stringify(item.reasons),
    item.status,
    item.resolvedAt,
    item.completedAt,
  ];
}

export class PostgresDailyPlanRepository implements DailyPlanRepository {
  constructor(private readonly db: TransactionExecutor) {}

  private async loadItems(dailyPlanId: string): Promise<DailyPlanItem[]> {
    const result = await this.db.query(
      "select * from daily_plan_items where daily_plan_id = $1 order by position asc",
      [dailyPlanId],
    );
    return result.rows.map(mapDailyPlanItemRow);
  }

  private async loadByKey(key: DailyPlanKey): Promise<DailyPlan | null> {
    const result = await this.db.query(
      "select * from daily_plans where user_id = $1 and planned_for_date = $2",
      [key.userId, key.plannedForDate],
    );
    if (result.rows.length !== 1) {
      return null;
    }
    const items = await this.loadItems(String(result.rows[0].id));
    return mapDailyPlanRow(result.rows[0], items);
  }

  async findByKey(key: DailyPlanKey): Promise<DailyPlan | null> {
    return this.loadByKey(key);
  }

  async findItemById(itemId: string): Promise<DailyPlanItem | null> {
    const result = await this.db.query(
      "select * from daily_plan_items where id = $1",
      [itemId],
    );
    return result.rows.length === 1 ? mapDailyPlanItemRow(result.rows[0]) : null;
  }

  /**
   * Race-free by construction (ADR-010's established pattern, reused
   * here): `INSERT ... ON CONFLICT (user_id, planned_for_date) DO NOTHING
   * RETURNING`, never a check-then-insert. If this call loses the race,
   * the caller-supplied `plan`/`items` are silently discarded in favor of
   * the already-committed plan — mirroring
   * `PostgresTodaySessionRepository.createIfNotExists`'s documented
   * contract exactly.
   *
   * This race-freedom claim assumes the default `READ COMMITTED` isolation
   * level (what every `UnitOfWork` in this codebase actually runs at —
   * neither `PostgresUnitOfWork` nor `PostgresDailyPlanUnitOfWork` sets a
   * different one). Under `READ COMMITTED`, a concurrent conflicting
   * `INSERT` for the same key blocks until the first inserter's
   * transaction ends, then either sees a real (now-committed) conflict —
   * `ON CONFLICT DO NOTHING` fires, and the follow-up `SELECT` below
   * reliably observes the winner — or finds no conflict at all if the
   * first inserter rolled back, and proceeds normally. At a stricter
   * isolation level (e.g. `SERIALIZABLE`), the same race instead produces
   * a serialization failure requiring the whole transaction to retry — a
   * materially different failure mode this code does not handle. If
   * either `UnitOfWork` ever adopts a stricter isolation level, this
   * race-freedom claim needs re-verification, not just re-reading.
   */
  async createIfNotExists(
    plan: Omit<DailyPlan, "items" | "id">,
    items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">>,
  ): Promise<DailyPlan> {
    const inserted = await this.db.query(
      `insert into daily_plans (
         user_id, planned_for_date, status, engine_version,
         generated_at, started_at, completed_at
       )
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (user_id, planned_for_date) do nothing
       returning *`,
      [
        plan.userId,
        plan.plannedForDate,
        plan.status,
        plan.engineVersion,
        plan.generatedAt,
        plan.startedAt,
        plan.completedAt,
      ],
    );

    if (inserted.rows.length === 0) {
      const existing = await this.loadByKey({
        userId: plan.userId,
        plannedForDate: plan.plannedForDate,
      });
      if (existing === null) {
        // The conflict branch fired, so a row must exist — reachable only
        // via a real bug (e.g. a concurrent delete of the winning plan
        // between the conflicting INSERT and this SELECT), surfaced
        // loudly rather than silently returning an impossible null.
        throw new Error(
          `PostgresDailyPlanRepository.createIfNotExists: INSERT reported ` +
            `a conflict for (user_id=${plan.userId}, planned_for_date=` +
            `${plan.plannedForDate}) but no matching row was found on the ` +
            `follow-up SELECT`,
        );
      }
      return existing;
    }

    const planRow = inserted.rows[0];
    const planId = String(planRow.id);
    const insertedItems: DailyPlanItem[] = [];
    for (const item of items) {
      const result = await this.db.query(
        `insert into daily_plan_items (
           daily_plan_id, user_id, course_id, position, question_id,
           question_version_id, action_type, tier, other_applicable_types,
           reasons, status, resolved_at, completed_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         returning *`,
        itemInsertParams(planId, plan.userId, item),
      );
      insertedItems.push(mapDailyPlanItemRow(result.rows[0]));
    }

    return mapDailyPlanRow(planRow, insertedItems);
  }

  private async resolve(
    itemId: string,
    resolvedAt: Date,
    status: "completed" | "skipped",
    completedAt: Date | null,
  ): Promise<ResolveDailyPlanItemResult> {
    const updated = await this.db.query(
      `update daily_plan_items
          set status = $2, resolved_at = $3, completed_at = $4
        where id = $1 and status = 'pending'
        returning *`,
      [itemId, status, resolvedAt, completedAt],
    );

    if (updated.rows.length === 1) {
      return { outcome: "RESOLVED", item: mapDailyPlanItemRow(updated.rows[0]) };
    }

    // No row updated: either the item does not exist at all, or it exists
    // but was not `pending` (ADR-016 §19 — already resolved). A follow-up
    // SELECT disambiguates the two, exactly as
    // `PostgresCourseMembershipRepository.createMembership`'s own
    // conflict-branch pattern disambiguates "no row" from "existing row."
    const current = await this.findItemById(itemId);
    if (current === null) {
      return { outcome: "NOT_FOUND" };
    }
    if (!canResolveDailyPlanItem(current.status)) {
      return { outcome: "ALREADY_RESOLVED", item: current };
    }
    // Unreachable: the item is `pending` but the conditional UPDATE above
    // still matched zero rows — only possible via a real bug (e.g. a
    // concurrent status change we did not anticipate), surfaced loudly.
    throw new Error(
      `PostgresDailyPlanRepository.resolve: item ${itemId} is 'pending' but ` +
        `the conditional UPDATE matched no rows`,
    );
  }

  async markCompleted(
    itemId: string,
    completedAt: Date,
  ): Promise<ResolveDailyPlanItemResult> {
    return this.resolve(itemId, completedAt, "completed", completedAt);
  }

  async markSkipped(
    itemId: string,
    skippedAt: Date,
  ): Promise<ResolveDailyPlanItemResult> {
    return this.resolve(itemId, skippedAt, "skipped", null);
  }
}

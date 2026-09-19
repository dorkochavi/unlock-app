/**
 * Real-Postgres (PGlite) integration tests for `PostgresDailyPlanRepository`
 * — proves the SQL against the actual migrated schema
 * (`supabase/migrations/20260921000000_daily_plan_v1.sql`), including the
 * `UNIQUE (user_id, planned_for_date)`-backed race-free create path and
 * ADR-016 §19's single-use resolution rule.
 *
 * ## What this file proves about `planned_for_date` DATE round-tripping,
 * and what it does NOT
 *
 * PGlite's own `date`-column type parsing constructs the returned `Date`
 * from the column's UTC calendar components (`Date.UTC(year, month - 1,
 * day)`) — verified directly, not assumed. This is a DIFFERENT convention
 * from real `pg`'s default OID-1082 parser, which builds the `Date` from
 * LOCAL calendar components instead (see `row-validation.ts`'s own doc
 * comment on `readDateOnlyString`, and `row-validation.test.ts`, which
 * covers that real-`pg` convention directly across positive/negative/zero
 * process UTC offsets via `process.env.TZ`).
 *
 * Because `readDateOnlyString`'s `Date`-instance branch reads back via
 * LOCAL getters (the correct inverse of real `pg`'s LOCAL-midnight
 * construction), it also happens to round-trip correctly against PGlite's
 * UTC-midnight construction on any NON-negative process UTC offset — the
 * tests below therefore reliably prove the round-trip in this repo's actual
 * CI/dev environments, but do not by themselves prove correctness on a
 * negative-UTC-offset host (e.g. US timezones), since that combination
 * (PGlite's UTC-midnight `Date` + a negative-offset process) is a distinct
 * scenario from the real-`pg`-driver bug this suite was written to close.
 * Production always talks to real `pg`, never PGlite, so this asymmetry is
 * a test-double-fidelity limitation, not a production risk — flagged here
 * rather than silently relied upon.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DailyPlan, DailyPlanItem } from "../../../src/application/dailyPlan/ports";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;
let repo: PostgresDailyPlanRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresDailyPlanRepository(db);
});

afterEach(async () => {
  await db.close();
});

async function seedPlanInputs() {
  const userId = await insertUser(db);
  const courseId = await insertCourse(db, userId);
  const questionId = await insertQuestion(db, courseId);
  const versionId = await insertQuestionVersion(db, questionId);
  await setCurrentVersion(db, questionId, versionId);

  const plan: Omit<DailyPlan, "items" | "id"> = {
    userId,
    plannedForDate: "2026-01-10",
    status: "prepared",
    engineVersion: "test-engine-v1",
    generatedAt: new Date("2026-01-10T08:00:00Z"),
    startedAt: null,
    completedAt: null,
  };
  const items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">> = [
    {
      userId,
      courseId,
      position: 0,
      questionId,
      questionVersionId: versionId,
      actionType: "REVIEW_DUE",
      tier: "DUE_REVIEW",
      otherApplicableTypes: ["STRENGTHEN_MEMORY"],
      reasons: ["SCHEDULED_REVIEW_DUE"],
      status: "pending",
      resolvedAt: null,
      completedAt: null,
    },
  ];

  return { userId, courseId, questionId, versionId, plan, items };
}

describe("PostgresDailyPlanRepository", () => {
  it("findByKey returns null when no plan exists yet", async () => {
    const { userId } = await seedPlanInputs();
    expect(
      await repo.findByKey({ userId, plannedForDate: "2026-01-10" }),
    ).toBeNull();
  });

  it("createIfNotExists persists the plan and every frozen item field exactly", async () => {
    const { plan, items, courseId, questionId, versionId } = await seedPlanInputs();

    const created = await repo.createIfNotExists(plan, items);

    expect(created.id).toEqual(expect.any(String));
    expect(created.userId).toBe(plan.userId);
    expect(created.plannedForDate).toBe("2026-01-10");
    expect(created.status).toBe("prepared");
    expect(created.items).toHaveLength(1);

    const item = created.items[0];
    expect(item.dailyPlanId).toBe(created.id);
    expect(item.courseId).toBe(courseId);
    expect(item.questionId).toBe(questionId);
    expect(item.questionVersionId).toBe(versionId);
    expect(item.position).toBe(0);
    expect(item.actionType).toBe("REVIEW_DUE");
    expect(item.tier).toBe("DUE_REVIEW");
    expect(item.otherApplicableTypes).toEqual(["STRENGTHEN_MEMORY"]);
    expect(item.reasons).toEqual(["SCHEDULED_REVIEW_DUE"]);
    expect(item.status).toBe("pending");
    expect(item.resolvedAt).toBeNull();
    expect(item.completedAt).toBeNull();

    const fetched = await repo.findByKey({
      userId: plan.userId,
      plannedForDate: "2026-01-10",
    });
    expect(fetched).toEqual(created);
  });

  it("createIfNotExists is race-free: a second call for the same (user, date) key returns the existing plan, not a duplicate", async () => {
    const { plan, items } = await seedPlanInputs();

    const first = await repo.createIfNotExists(plan, items);
    const second = await repo.createIfNotExists(plan, items);

    expect(second.id).toBe(first.id);
    expect(second.items).toHaveLength(1);
    expect(second.items[0].id).toBe(first.items[0].id);

    const rows = await db.query(
      "select count(*)::int as count from daily_plans where user_id = $1 and planned_for_date = $2",
      [plan.userId, plan.plannedForDate],
    );
    expect((rows.rows[0] as { count: number }).count).toBe(1);
  });

  it("findItemById returns null for a nonexistent item", async () => {
    expect(await repo.findItemById(randomUUID())).toBeNull();
  });

  it("findItemById returns the item for an existing id", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);

    const found = await repo.findItemById(created.items[0].id);
    expect(found).toEqual(created.items[0]);
  });

  it("markCompleted resolves a pending item exactly once", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);
    const completedAt = new Date("2026-01-10T09:00:00Z");

    const result = await repo.markCompleted(created.items[0].id, completedAt);

    expect(result.outcome).toBe("RESOLVED");
    if (result.outcome !== "RESOLVED") throw new Error("unreachable");
    expect(result.item.status).toBe("completed");
    expect(result.item.resolvedAt).toEqual(completedAt);
    expect(result.item.completedAt).toEqual(completedAt);
  });

  it("markSkipped resolves a pending item exactly once, leaving completedAt null", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);
    const skippedAt = new Date("2026-01-10T09:00:00Z");

    const result = await repo.markSkipped(created.items[0].id, skippedAt);

    expect(result.outcome).toBe("RESOLVED");
    if (result.outcome !== "RESOLVED") throw new Error("unreachable");
    expect(result.item.status).toBe("skipped");
    expect(result.item.resolvedAt).toEqual(skippedAt);
    expect(result.item.completedAt).toBeNull();
  });

  it("markCompleted on an already-completed item returns ALREADY_RESOLVED without changing it (ADR-016 §19)", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);
    const firstCompletedAt = new Date("2026-01-10T09:00:00Z");
    const first = await repo.markCompleted(created.items[0].id, firstCompletedAt);
    expect(first.outcome).toBe("RESOLVED");

    const second = await repo.markCompleted(
      created.items[0].id,
      new Date("2026-01-10T10:00:00Z"),
    );

    expect(second.outcome).toBe("ALREADY_RESOLVED");
    if (second.outcome !== "ALREADY_RESOLVED") throw new Error("unreachable");
    expect(second.item.completedAt).toEqual(firstCompletedAt);
    expect(second.item.resolvedAt).toEqual(firstCompletedAt);
  });

  it("markSkipped on an already-completed item returns ALREADY_RESOLVED (cross-status conflict, not just same-status retry)", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);
    await repo.markCompleted(created.items[0].id, new Date("2026-01-10T09:00:00Z"));

    const result = await repo.markSkipped(
      created.items[0].id,
      new Date("2026-01-10T10:00:00Z"),
    );

    expect(result.outcome).toBe("ALREADY_RESOLVED");
    if (result.outcome !== "ALREADY_RESOLVED") throw new Error("unreachable");
    expect(result.item.status).toBe("completed");
  });

  it("markCompleted on an already-skipped item returns ALREADY_RESOLVED", async () => {
    const { plan, items } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, items);
    await repo.markSkipped(created.items[0].id, new Date("2026-01-10T09:00:00Z"));

    const result = await repo.markCompleted(
      created.items[0].id,
      new Date("2026-01-10T10:00:00Z"),
    );

    expect(result.outcome).toBe("ALREADY_RESOLVED");
    if (result.outcome !== "ALREADY_RESOLVED") throw new Error("unreachable");
    expect(result.item.status).toBe("skipped");
  });

  it("markCompleted returns NOT_FOUND for a nonexistent item", async () => {
    const result = await repo.markCompleted(randomUUID(), new Date());
    expect(result).toEqual({ outcome: "NOT_FOUND" });
  });

  it("markSkipped returns NOT_FOUND for a nonexistent item", async () => {
    const result = await repo.markSkipped(randomUUID(), new Date());
    expect(result).toEqual({ outcome: "NOT_FOUND" });
  });

  it("createIfNotExists returns items in the given (position-ascending) order — real callers always supply items pre-sorted by position (see generate-daily-plan-for-resolved-inputs.ts), and this is the order persisted/returned", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questions = await Promise.all(
      [0, 1, 2].map(async (n) => {
        const questionId = await insertQuestion(db, courseId);
        const versionId = await insertQuestionVersion(db, questionId, n + 1);
        await setCurrentVersion(db, questionId, versionId);
        return { questionId, versionId };
      }),
    );

    const plan: Omit<DailyPlan, "items" | "id"> = {
      userId,
      plannedForDate: "2026-01-10",
      status: "prepared",
      engineVersion: "test-engine-v1",
      generatedAt: new Date("2026-01-10T08:00:00Z"),
      startedAt: null,
      completedAt: null,
    };
    const items: Array<Omit<DailyPlanItem, "id" | "dailyPlanId">> = [0, 1, 2].map(
      (position) => ({
        userId,
        courseId,
        position,
        questionId: questions[position].questionId,
        questionVersionId: questions[position].versionId,
        actionType: "REVIEW_DUE",
        tier: "DUE_REVIEW",
        otherApplicableTypes: [],
        reasons: ["SCHEDULED_REVIEW_DUE"],
        status: "pending",
        resolvedAt: null,
        completedAt: null,
      }),
    );

    const created = await repo.createIfNotExists(plan, items);
    expect(created.items.map((item) => item.position)).toEqual([0, 1, 2]);
    expect(created.items.map((item) => item.questionId)).toEqual([
      questions[0].questionId,
      questions[1].questionId,
      questions[2].questionId,
    ]);

    const fetched = await repo.findByKey({ userId, plannedForDate: "2026-01-10" });
    expect(fetched?.items.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("findByKey orders items by `position`, not by insertion order — proven by inserting rows out of position order directly", async () => {
    const { userId, courseId, plan } = await seedPlanInputs();
    const created = await repo.createIfNotExists(plan, []);

    // Insert three raw items (distinct questions — `daily_plan_items` has a
    // unique (daily_plan_id, question_id) constraint) directly, in an
    // insertion order that is the REVERSE of their `position` values, so a
    // query relying on insertion order (or on primary-key/id ordering)
    // instead of `ORDER BY position` would fail this assertion.
    for (const position of [2, 1, 0]) {
      const questionId = await insertQuestion(db, courseId);
      const versionId = await insertQuestionVersion(db, questionId, position + 1);
      await setCurrentVersion(db, questionId, versionId);
      await db.query(
        `insert into daily_plan_items (
           id, daily_plan_id, user_id, course_id, position, question_id,
           question_version_id, action_type, tier, other_applicable_types,
           reasons, status, resolved_at, completed_at
         )
         values ($1, $2, $3, $4, $5, $6, $7, 'REVIEW_DUE', 'DUE_REVIEW', '[]', '[]', 'pending', null, null)`,
        [randomUUID(), created.id, userId, courseId, position, questionId, versionId],
      );
    }

    const fetched = await repo.findByKey({
      userId: plan.userId,
      plannedForDate: plan.plannedForDate,
    });
    expect(fetched?.items.map((item) => item.position)).toEqual([0, 1, 2]);
  });

  it("plannedForDate round-trips exactly across a year boundary (2025-12-31), not shifted to 2026-01-01 or 2025-12-30", async () => {
    const { plan, items } = await seedPlanInputs();
    const boundaryPlan = { ...plan, plannedForDate: "2025-12-31" };

    const created = await repo.createIfNotExists(boundaryPlan, items);
    expect(created.plannedForDate).toBe("2025-12-31");

    const fetched = await repo.findByKey({ userId: plan.userId, plannedForDate: "2025-12-31" });
    expect(fetched?.plannedForDate).toBe("2025-12-31");
  });
});

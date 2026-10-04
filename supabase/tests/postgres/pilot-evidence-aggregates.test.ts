/**
 * Proves `scripts/pilot-evidence-aggregates.sql` (PILOT_READINESS item 13a evidence queries):
 *  1. every query executes against the real migrated schema (PGlite), is SELECT-only, and exposes only
 *     aggregate / bucket / non-identity columns;
 *  2. with SEEDED rows, each query counts what the docs claim (current-members join semantics, UTC day buckets,
 *     accepted attempts split plan/practice, plan-item resolution, now()-anchored repeat behavior).
 * Limit: PGlite only. Proves query validity and counting semantics on representative rows — not hosted data or volumes.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import {
  createTestDb,
  insertCourseMembership,
  insertUser,
  seedDailyPlanWithItem,
  seedQuestionChain,
  setDailyPlanItemResolved,
} from "./db-harness";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(path.join(dir, "../../../scripts/pilot-evidence-aggregates.sql"), "utf8");

const queries = SQL.split(/^-- @query /m)
  .slice(1)
  .map((chunk) => {
    const [name, ...rest] = chunk.split("\n");
    return { name: name!.trim(), sql: rest.join("\n").trim() };
  });

function sqlFor(name: string): string {
  return queries.find((q) => q.name === name)!.sql;
}

const ALLOWED_COLUMNS = new Set([
  "day_utc",
  "course_id",
  "learners_joined",
  "plans_generated",
  "distinct_learners",
  "via_daily_plan",
  "attempts",
  "distinct_responders",
  "status",
  "items",
  "learners_with_3_plus_active_days",
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const day = (value: Date | string) => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

describe("pilot-evidence-aggregates.sql: shape", () => {
  it("defines the five expected queries", () => {
    expect(queries.map((q) => q.name)).toEqual([
      "joins_per_day",
      "plans_generated_per_day",
      "accepted_answers_per_day",
      "plan_items_resolution_per_day",
      "repeat_behavior_last_7_days",
    ]);
  });

  it("contains only SELECT statements (read-only)", () => {
    for (const query of queries) {
      const code = query.sql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n");
      expect(code.trimStart().toLowerCase().startsWith("select")).toBe(true);
      expect(code).not.toMatch(/\b(insert|update|delete|drop|alter|create|truncate|grant)\b/i);
    }
  });

  it("every query runs on the migrated schema and exposes only aggregate/bucket columns (no identity or content)", async () => {
    for (const query of queries) {
      const result = await db.query(query.sql);
      for (const field of result.fields) {
        expect(ALLOWED_COLUMNS.has(field.name), `${query.name}.${field.name}`).toBe(true);
      }
    }
  });
});

describe("pilot-evidence-aggregates.sql: seeded semantics", () => {
  async function newLearner(courseId?: string): Promise<string> {
    const userId = await insertUser(db);
    if (courseId) await insertCourseMembership(db, { userId, courseId });
    return userId;
  }

  it("joins_per_day = CURRENT (non-revoked) LEARNER memberships by UTC join day; revoked are excluded", async () => {
    const chain = await seedQuestionChain(db);
    const a = await newLearner(chain.courseId);
    const b = await newLearner(chain.courseId);
    const revoked = await newLearner();
    await insertCourseMembership(db, { userId: revoked, courseId: chain.courseId, revokedAt: new Date() });
    // 23:30Z and 00:30Z are different UTC days: UTC bucketing is intentional (not learner-local).
    await db.query("update course_memberships set joined_at = $2 where user_id = $1", [a, "2026-03-01T23:30:00Z"]);
    await db.query("update course_memberships set joined_at = $2 where user_id = $1", [b, "2026-03-02T00:30:00Z"]);
    await db.query("update course_memberships set joined_at = $2 where user_id = $1", [revoked, "2026-03-01T10:00:00Z"]);

    const result = await db.query<{ day_utc: Date | string; learners_joined: number }>(sqlFor("joins_per_day"));
    expect(result.rows.map((r) => [day(r.day_utc), r.learners_joined])).toEqual([
      ["2026-03-01", 1],
      ["2026-03-02", 1],
    ]);
    expect(JSON.stringify(result.rows)).not.toContain(a);
  });

  it("plans_generated_per_day counts plans and distinct learners per UTC day of generated_at", async () => {
    const chain = await seedQuestionChain(db);
    const l1 = await newLearner(chain.courseId);
    const l2 = await newLearner(chain.courseId);
    const p1 = await seedDailyPlanWithItem(db, { ...chain, userId: l1, plannedForDate: "2026-03-01" });
    const p2 = await seedDailyPlanWithItem(db, { ...chain, userId: l2, plannedForDate: "2026-03-01" });
    await db.query("update daily_plans set generated_at = $2 where id = $1", [p1.dailyPlanId, "2026-03-01T08:00:00Z"]);
    await db.query("update daily_plans set generated_at = $2 where id = $1", [p2.dailyPlanId, "2026-03-01T22:00:00Z"]);

    const result = await db.query<{ plans_generated: number; distinct_learners: number }>(
      sqlFor("plans_generated_per_day"),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ plans_generated: 2, distinct_learners: 2 });
  });

  it("accepted_answers_per_day splits plan-linked vs practice attempts, counts distinct responders, buckets by UTC day", async () => {
    const chain = await seedQuestionChain(db);
    const l1 = await newLearner(chain.courseId);
    const l2 = await newLearner(chain.courseId);
    const plan = await seedDailyPlanWithItem(db, { ...chain, userId: l1, plannedForDate: "2026-03-01" });

    async function attempt(userId: string, answeredAt: string, link?: { planId: string; itemId: string }) {
      await db.query(
        `insert into attempts
           (id, submission_id, user_id, course_id, question_id, question_version_id,
            answered_at, is_correct, attempt_number_for_presented_item, engine_version,
            daily_plan_id, daily_plan_item_id)
         values ($1, $2, $3, $4, $5, $6, $7, true, 1, 'test-engine-v1', $8, $9)`,
        [
          randomUUID(),
          `sub-${randomUUID()}`,
          userId,
          chain.courseId,
          chain.questionId,
          chain.questionVersionId,
          answeredAt,
          link?.planId ?? null,
          link?.itemId ?? null,
        ],
      );
    }
    await attempt(l1, "2026-03-01T23:59:59Z", { planId: plan.dailyPlanId, itemId: plan.dailyPlanItemId });
    await attempt(l1, "2026-03-02T00:00:00Z"); // practice, next UTC day
    await attempt(l2, "2026-03-02T09:00:00Z"); // practice, other learner, same day

    const result = await db.query<{
      day_utc: Date | string;
      via_daily_plan: boolean;
      attempts: number;
      distinct_responders: number;
    }>(sqlFor("accepted_answers_per_day"));
    expect(
      result.rows.map((r) => [day(r.day_utc), r.via_daily_plan, r.attempts, r.distinct_responders]),
    ).toEqual([
      ["2026-03-01", true, 1, 1],
      ["2026-03-02", false, 2, 2],
    ]);
  });

  it("plan_items_resolution_per_day reports completed and skipped by UTC day; unresolved (pending) items are not counted", async () => {
    const chain = await seedQuestionChain(db);
    const l1 = await newLearner(chain.courseId);
    const done = await seedDailyPlanWithItem(db, { ...chain, userId: l1, plannedForDate: "2026-03-01" });
    const skipped = await seedDailyPlanWithItem(db, { ...chain, userId: l1, plannedForDate: "2026-03-02" });
    await seedDailyPlanWithItem(db, { ...chain, userId: l1, plannedForDate: "2026-03-03" }); // stays pending
    await setDailyPlanItemResolved(db, done.dailyPlanItemId, "completed", new Date("2026-03-01T10:00:00Z"));
    await setDailyPlanItemResolved(db, skipped.dailyPlanItemId, "skipped", new Date("2026-03-02T11:00:00Z"));

    const result = await db.query<{ day_utc: Date | string; status: string; items: number }>(
      sqlFor("plan_items_resolution_per_day"),
    );
    expect(result.rows.map((r) => [day(r.day_utc), r.status, r.items])).toEqual([
      ["2026-03-01", "completed", 1],
      ["2026-03-02", "skipped", 1],
    ]);
  });

  it("repeat_behavior_last_7_days: >=3 DISTINCT UTC days of completions within 7 days of now() qualifies; 2 days and an out-of-window third day do not; skips do not count", async () => {
    const chain = await seedQuestionChain(db);
    const now = Date.now();

    async function complete(userId: string, daysAgo: number[], status: "completed" | "skipped" = "completed") {
      for (const d of daysAgo) {
        const at = new Date(now - d * DAY_MS);
        const item = await seedDailyPlanWithItem(db, {
          ...chain,
          userId,
          plannedForDate: at.toISOString().slice(0, 10),
        });
        await setDailyPlanItemResolved(db, item.dailyPlanItemId, status, at);
      }
    }

    const threeDays = await newLearner(chain.courseId);
    const twoDays = await newLearner(chain.courseId);
    const staleThird = await newLearner(chain.courseId);
    const skipper = await newLearner(chain.courseId);
    await complete(threeDays, [1, 2, 6]); // 3 distinct days inside the window -> counted
    await complete(twoDays, [1, 2]); // 2 days -> not counted
    await complete(staleThird, [1, 2, 8]); // third day outside the window -> not counted
    await complete(skipper, [1, 2, 3], "skipped"); // skips are not completions -> not counted

    const result = await db.query<{ learners_with_3_plus_active_days: number }>(
      sqlFor("repeat_behavior_last_7_days"),
    );
    expect(result.rows).toEqual([{ learners_with_3_plus_active_days: 1 }]);
  });
});

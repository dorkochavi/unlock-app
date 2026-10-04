/**
 * Proves `scripts/pilot-evidence-aggregates.sql` (PILOT_READINESS item 13a evidence queries) executes against the
 * real migrated schema (PGlite), and that every result column is an aggregate / bucket / non-identity field.
 * Limit: PGlite only; proves the queries are valid and identity-free in shape — not hosted data or volumes.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { createTestDb, insertCourse, insertCourseMembership, insertUser } from "./db-harness";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(path.join(dir, "../../../scripts/pilot-evidence-aggregates.sql"), "utf8");

const queries = SQL.split(/^-- @query /m)
  .slice(1)
  .map((chunk) => {
    const [name, ...rest] = chunk.split("\n");
    return { name: name!.trim(), sql: rest.join("\n").trim() };
  });

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

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

describe("pilot-evidence-aggregates.sql", () => {
  it("defines the five expected queries", () => {
    expect(queries.map((q) => q.name)).toEqual([
      "joins_per_day",
      "plans_generated_per_day",
      "accepted_answers_per_day",
      "plan_items_resolution_per_day",
      "repeat_behavior_last_7_days",
    ]);
  });

  it("every query runs on the migrated schema and exposes only aggregate/bucket columns (no identity or content)", async () => {
    for (const query of queries) {
      const result = await db.query(query.sql);
      for (const field of result.fields) {
        expect(ALLOWED_COLUMNS.has(field.name), `${query.name}.${field.name}`).toBe(true);
      }
    }
  });

  it("joins_per_day counts a joined LEARNER and reveals no user identifier", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, await insertUser(db));
    await insertCourseMembership(db, { userId, courseId });
    const query = queries.find((q) => q.name === "joins_per_day")!;
    const result = await db.query<{ learners_joined: number }>(query.sql);
    expect(result.rows.reduce((sum, row) => sum + row.learners_joined, 0)).toBe(1);
    expect(JSON.stringify(result.rows)).not.toContain(userId);
  });
});

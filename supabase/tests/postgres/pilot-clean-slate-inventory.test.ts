/**
 * Proves `scripts/pilot-clean-slate-inventory.sql` (Run 2026-10-10-PILOT-CLEAN-SLATE-RESET-001):
 *  1. the file is read-only SQL and commits no real id (the preserved id stays a placeholder);
 *  2. the public-schema queries execute against the real migrated schema (PGlite);
 *  3. public_inventory covers EVERY public base table, so schema drift fails this test.
 * `auth_*` / `storage_inventory` need the real Supabase schemas and are NOT executed here (PGlite limit).
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import {
  createTestDb,
  insertCourseAuthor,
  insertCourseMembership,
  insertTopic,
  insertUser,
  seedDailyPlanWithItem,
  seedQuestionChain,
  setQuestionTopic,
} from "./db-harness";

const dir = path.dirname(fileURLToPath(import.meta.url));
const SQL = readFileSync(path.join(dir, "../../../scripts/pilot-clean-slate-inventory.sql"), "utf8");
const queries = SQL.split(/^-- @query /m)
  .slice(1)
  .map((chunk) => {
    const [name, ...rest] = chunk.split("\n");
    return { name: name!.trim(), sql: rest.join("\n").trim() };
  });
const sqlFor = (name: string) => queries.find((q) => q.name === name)!.sql;
const PLACEHOLDER = "PASTE-PRESERVED-AUTH-USER-UUID";
const withId = (sql: string, id: string) => sql.replaceAll(PLACEHOLDER, id);
const codeOnly = SQL.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");
const PUBLIC_QUERIES = [
  "public_inventory",
  "public_unknown_tables",
  "preserved_account_footprint",
  "reset_expectation",
  "orphan_checks",
];

let db: PGlite;
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

describe("pilot-clean-slate-inventory.sql", () => {
  it("is read-only: no mutating or DDL statement", () => {
    expect(codeOnly).not.toMatch(/\b(insert|update|delete|truncate|drop|alter|create|grant|revoke)\b/i);
  });

  it("commits no uuid literal (preserved id is a placeholder)", () => {
    expect(codeOnly).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    expect(SQL).toContain(PLACEHOLDER);
  });

  it("an unreplaced placeholder fails closed (invalid uuid), never matches a row", async () => {
    await expect(db.query(sqlFor("preserved_account_footprint"))).rejects.toThrow();
  });

  it("public_inventory covers every public base table; public_unknown_tables is empty", async () => {
    const tables = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'",
    );
    const inv = await db.query<{ entity: string }>(sqlFor("public_inventory"));
    expect(inv.rows.map((r) => r.entity).sort()).toEqual(tables.rows.map((r) => r.table_name).sort());
    expect((await db.query(sqlFor("public_unknown_tables"))).rows).toEqual([]);
  });

  it("public queries execute and report preserved/delete counts correctly", async () => {
    for (const name of PUBLIC_QUERIES) {
      await expect(db.query(withId(sqlFor(name), "11111111-1111-4111-8111-111111111111"))).resolves.toBeDefined();
    }
    const keep = await insertUser(db);
    await insertUser(db);
    const exp = await db.query(withId(sqlFor("reset_expectation"), keep));
    expect(exp.rows[0]).toMatchObject({ users_now: 2, delete_candidates_users: 1, users_remaining_expected: 1 });
    const fp = await db.query<{ preserved_in_public_users: number }>(withId(sqlFor("preserved_account_footprint"), keep));
    expect(fp.rows[0]!.preserved_in_public_users).toBe(1);
    const missing = await db.query<{ preserved_in_public_users: number }>(
      withId(sqlFor("preserved_account_footprint"), "33333333-3333-4333-8333-333333333333"),
    );
    expect(missing.rows[0]!.preserved_in_public_users).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Proposed reset SQL (docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md §6A) — executed ONLY against a disposable PGlite
// schema to prove FK-safe order, preserved-account protection and rollback. Never against hosted data.
// ---------------------------------------------------------------------------
const RUNBOOK = readFileSync(path.join(dir, "../../../docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md"), "utf8");
const RESET_SQL = /```sql reset-sql\n([\s\S]*?)```/.exec(RUNBOOK)![1]!;
const TABLES = [
  "attempts", "user_question_progress", "daily_plan_items", "daily_plans", "course_memberships",
  "course_authors", "question_versions", "questions", "topics", "materials", "courses", "users",
];

async function countAll(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) out[t] = (await db.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]!.n;
  return out;
}

async function seedFull() {
  const keep = await insertUser(db);
  const learner = await insertUser(db);
  // preserved account owns a course with content, a plan and history (all must still be deleted)
  const chain = await seedQuestionChain(db);
  const topicId = await insertTopic(db, chain.courseId);
  await setQuestionTopic(db, chain.questionId, topicId);
  await db.query("insert into materials (course_id, created_by, title) values ($1, $2, 'm')", [chain.courseId, keep]);
  await insertCourseAuthor(db, { userId: keep, courseId: chain.courseId, capability: "OWNER" });
  await insertCourseMembership(db, { userId: learner, courseId: chain.courseId, role: "LEARNER" });
  const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, {
    userId: learner, courseId: chain.courseId, questionId: chain.questionId, questionVersionId: chain.questionVersionId,
  });
  await db.query(
    `insert into attempts
       (submission_id, user_id, course_id, question_id, question_version_id, answered_at,
        is_correct, selected_answer, attempt_number_for_presented_item, engine_version, daily_plan_id, daily_plan_item_id)
     values ($1, $2, $3, $4, $5, now(), true, '"A"'::jsonb, 1, 'test-engine-v1', $6, $7)`,
    [`sub-${randomUUID()}`, learner, chain.courseId, chain.questionId, chain.questionVersionId, dailyPlanId, dailyPlanItemId],
  );
  await db.query(
    `insert into user_question_progress (user_id, question_id, mastery_category, misconception_state, engine_version)
     values ($1, $2, 'not_started', 'none', 'test-engine-v1')`,
    [learner, chain.questionId],
  );
  return keep;
}

describe("proposed reset SQL (runbook §6A) on disposable PGlite", () => {
  it("deletes everything FK-safely, keeps exactly the preserved users row, and is re-runnable", async () => {
    const keep = await seedFull();
    const before = await countAll();
    expect(before).toMatchObject({ attempts: 1, materials: 1, topics: 1, daily_plan_items: 1, user_question_progress: 1, course_authors: 1, course_memberships: 1 });
    expect(before.question_versions).toBeGreaterThan(0);
    const sql = RESET_SQL.replaceAll(PLACEHOLDER, keep);
    await db.exec(sql);
    const after = await countAll();
    expect(after).toEqual({ ...Object.fromEntries(TABLES.map((t) => [t, 0])), users: 1 });
    expect((await db.query<{ id: string }>("select id from users")).rows[0]!.id).toBe(keep);
    await db.exec(sql); // idempotent
    expect((await countAll()).users).toBe(1);
  });

  it("aborts and rolls back everything when the preserved user is absent", async () => {
    await seedFull();
    const before = await countAll();
    await expect(db.exec(RESET_SQL.replaceAll(PLACEHOLDER, "99999999-9999-4999-8999-999999999999"))).rejects.toThrow(/preserved user not found/);
    await db.exec("rollback").catch(() => undefined);
    expect(await countAll()).toEqual(before);
  });

  it("aborts and changes nothing when an unknown public table exists (drift guard)", async () => {
    const keep = await seedFull();
    await db.exec("create table zz_unknown_pilot_table (id int)");
    const before = await countAll();
    await expect(db.exec(RESET_SQL.replaceAll(PLACEHOLDER, keep))).rejects.toThrow(/unknown public table/);
    await db.exec("rollback").catch(() => undefined);
    expect(await countAll()).toEqual(before);
  });

  it("an unreplaced placeholder fails closed and changes nothing", async () => {
    await seedFull();
    const before = await countAll();
    await expect(db.exec(RESET_SQL)).rejects.toThrow();
    await db.exec("rollback").catch(() => undefined);
    expect(await countAll()).toEqual(before);
  });
});

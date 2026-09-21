/**
 * Real-Postgres (PGlite) integration tests for `PostgresImportUnitOfWork`
 * (Run 007 S4/S6: `confirmImport`'s per-row `createDraft`/`updateDraft`
 * write loop must commit or roll back together). Proves the actual
 * atomicity/rollback contract that `confirm-import.test.ts` (in-memory
 * fakes) cannot: its fake `runInTransaction` has no notion of a
 * mid-sequence failure against a real transactional connection. Mirrors
 * `postgres-question-unit-of-work.test.ts`'s own commit/rollback pair
 * exactly — this is the genuine real-Postgres proof for
 * `docs/CHATGPT_PLAN.md` §13's "transactional rollback prevents partial
 * imports" bullet, which the S6 walkthrough
 * (`run-007-structured-import-walkthrough.test.ts`) cannot itself provide:
 * every zero-Questions-created case there is rejected by `confirmImport`'s
 * Phase 1, BEFORE any transaction opens — only a direct `runInTransaction`
 * call like the one below can force a genuine mid-transaction failure and
 * observe a real `ROLLBACK`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresImportUnitOfWork } from "../../../src/infrastructure/postgres/postgres-import-unit-of-work";
import { createTestDb, insertCourse, insertUser, pgliteConnectionProvider } from "./db-harness";

let db: PGlite;
let uow: PostgresImportUnitOfWork;

beforeEach(async () => {
  db = await createTestDb();
  uow = new PostgresImportUnitOfWork(pgliteConnectionProvider(db));
});

afterEach(async () => {
  await db.close();
});

async function countQuestions(courseId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    "select count(*)::int as count from questions where course_id = $1",
    [courseId],
  );
  return Number(result.rows[0].count);
}

describe("PostgresImportUnitOfWork", () => {
  it("commits every row's createDraft+updateDraft together: both imported Questions persist as DRAFT_ONLY", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);

    const questionIds = await uow.runInTransaction(async (repos) => {
      const ids: string[] = [];
      for (const prompt of ["Row 1", "Row 2"]) {
        const created = await repos.questions.createDraft({ courseId });
        await repos.questions.updateDraft(created.id, {
          topicId: null,
          questionType: "SINGLE_CHOICE",
          prompt,
          answerOptions: [
            { id: "A", content: "Yes" },
            { id: "B", content: "No" },
          ],
          correctOptionIds: ["A"],
          explanation: null,
        });
        ids.push(created.id);
      }
      return ids;
    });

    expect(questionIds).toHaveLength(2);
    expect(await countQuestions(courseId)).toBe(2);
    const rows = await db.query<{ current_version_id: string | null; draft_prompt: string }>(
      "select current_version_id, draft_prompt from questions where course_id = $1 order by created_at",
      [courseId],
    );
    expect(rows.rows.map((r) => r.draft_prompt)).toEqual(["Row 1", "Row 2"]);
    expect(rows.rows.every((r) => r.current_version_id === null)).toBe(true);
  });

  it("rolls back the ENTIRE batch when a later row's write fails — the earlier row's already-issued createDraft/updateDraft never persists either", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);

    await expect(
      uow.runInTransaction(async (repos) => {
        // Row 1 succeeds within this transaction...
        const created = await repos.questions.createDraft({ courseId });
        await repos.questions.updateDraft(created.id, {
          topicId: null,
          questionType: "SINGLE_CHOICE",
          prompt: "Row 1 — never actually persisted",
          answerOptions: [
            { id: "A", content: "Yes" },
            { id: "B", content: "No" },
          ],
          correctOptionIds: ["A"],
          explanation: null,
        });
        // ...but row 2 fails before this same transaction commits — the
        // whole batch, including row 1's already-issued writes, must roll
        // back atomically (`docs/CHATGPT_PLAN.md` §11 "any transaction/write
        // failure -> rollback entire batch").
        throw new Error("simulated failure on row 2, after row 1's writes were already issued");
      }),
    ).rejects.toThrow("simulated failure");

    expect(await countQuestions(courseId)).toBe(0);
  });
});

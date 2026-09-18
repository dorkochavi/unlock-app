/**
 * Shared PGlite test harness for the Postgres infrastructure integration
 * suite (`supabase/tests/postgres/*.test.ts`) — spins up a real (WASM)
 * PostgreSQL engine with the actual initial migration applied, the same
 * approach `supabase/tests/schema.integration.test.ts` uses for pure
 * schema verification. This module additionally exposes a
 * `ConnectionProvider` (see `src/infrastructure/postgres/
 * connection-provider.ts`) and small seed helpers so repository/UnitOfWork
 * tests don't each reimplement "build one valid row chain."
 *
 * Deliberately separate from `schema.integration.test.ts`'s own internal
 * seed helpers (not a shared import) — that file is already reviewed and
 * passing; this harness is shaped for repository-level tests (which need
 * to construct full domain objects, not just raw SQL params) rather than
 * schema-constraint tests (which want to inject deliberately-wrong raw
 * values). A little duplication of "insert a valid Course" is an
 * acceptable, low-risk cost for not touching a working, already-audited
 * test file.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ConnectionProvider } from "../../../src/infrastructure/postgres/connection-provider";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";

const dir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  path.join(dir, "../../migrations/20260917203000_initial_schema.sql"),
  "utf8",
);

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(MIGRATION_SQL);
  return db;
}

/**
 * PGlite has no pooling/multi-connection concept — there is exactly one
 * "connection" for the lifetime of the instance, so `withConnection` is
 * just `fn(db)`. A future `pg.Pool`-backed provider would instead check
 * out and release one `Client` per call; `PostgresUnitOfWork` does not
 * need to know which kind it was given.
 */
export function pgliteConnectionProvider(db: PGlite): ConnectionProvider {
  return {
    async withConnection<T>(fn: (db: SqlExecutor) => Promise<T>): Promise<T> {
      return fn(db as unknown as SqlExecutor);
    },
  };
}

export function randomToken(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export async function insertUser(db: SqlExecutor): Promise<string> {
  const id = randomUUID();
  await db.query("insert into users (id) values ($1)", [id]);
  return id;
}

export async function insertCourse(
  db: SqlExecutor,
  ownerUserId: string,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into courses (id, owner_user_id, title) values ($1, $2, 'Test Course')",
    [id, ownerUserId],
  );
  return id;
}

export async function insertQuestion(
  db: SqlExecutor,
  courseId: string,
): Promise<string> {
  const id = randomUUID();
  await db.query("insert into questions (id, course_id) values ($1, $2)", [
    id,
    courseId,
  ]);
  return id;
}

export async function insertQuestionVersion(
  db: SqlExecutor,
  questionId: string,
  versionNumber = 1,
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into question_versions
       (id, question_id, version_number, prompt, answer_options, correct_answer)
     values ($1, $2, $3, 'Prompt?', '["A","B"]'::jsonb, '"A"'::jsonb)`,
    [id, questionId, versionNumber],
  );
  return id;
}

export async function setCurrentVersion(
  db: SqlExecutor,
  questionId: string,
  versionId: string,
): Promise<void> {
  await db.query("update questions set current_version_id = $1 where id = $2", [
    versionId,
    questionId,
  ]);
}

/** One full valid chain: user, course, question, its current version. */
export async function seedQuestionChain(db: SqlExecutor) {
  const userId = await insertUser(db);
  const courseId = await insertCourse(db, userId);
  const questionId = await insertQuestion(db, courseId);
  const questionVersionId = await insertQuestionVersion(db, questionId);
  await setCurrentVersion(db, questionId, questionVersionId);
  return { userId, courseId, questionId, questionVersionId };
}

/**
 * A real Today session with one real item, via raw SQL (not through
 * `PostgresTodaySessionRepository`, so callers exercising that repository
 * itself don't create a circular test dependency on it). Returns enough
 * ids for `submit-answer.test.ts`'s Today-attached scenarios.
 */
export async function seedTodaySessionWithItem(
  db: SqlExecutor,
  args: {
    userId: string;
    courseId: string;
    questionId: string;
    questionVersionId: string;
    plannedForDate?: string;
  },
): Promise<{ todaySessionId: string; todaySessionItemId: string }> {
  const todaySessionId = randomUUID();
  await db.query(
    `insert into today_sessions
       (id, user_id, course_id, planned_for_date, status, engine_version)
     values ($1, $2, $3, $4, 'prepared', 'test-engine-v1')`,
    [
      todaySessionId,
      args.userId,
      args.courseId,
      args.plannedForDate ?? "2026-01-10",
    ],
  );
  const todaySessionItemId = randomUUID();
  await db.query(
    `insert into today_session_items
       (id, today_session_id, user_id, course_id, position, question_id,
        question_version_id, action_type, tier)
     values ($1, $2, $3, $4, 0, $5, $6, 'REVIEW_DUE', 'DUE_REVIEW')`,
    [
      todaySessionItemId,
      todaySessionId,
      args.userId,
      args.courseId,
      args.questionId,
      args.questionVersionId,
    ],
  );
  return { todaySessionId, todaySessionItemId };
}

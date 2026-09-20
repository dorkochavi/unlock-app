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
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { ConnectionProvider } from "../../../src/infrastructure/postgres/connection-provider";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";

const dir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(dir, "../../migrations");

/**
 * Applies EVERY migration in `supabase/migrations/`, in filename order —
 * not just the first one. Filenames are timestamp-prefixed
 * (`YYYYMMDDHHMMSS_name.sql`), so a plain lexicographic sort is already
 * chronological order, matching how the real Supabase CLI / `supabase db
 * push` applies them. Bug found and fixed while adding the second
 * migration (`20260918000000_question_answer_model_v1.sql`, ADR-014):
 * this harness originally hardcoded only the FIRST migration's filename,
 * so every test seeding a `question_versions` row with the new
 * `question_type` column failed against a database that had never
 * actually been given that column — a real "does the full migration chain
 * apply cleanly from empty" gap, not a data problem.
 */
const MIGRATION_SQL = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n");

export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  // Minimal stand-in for Supabase's real `auth` schema/`auth.users` table
  // — created BEFORE the migration chain runs, since
  // `20260923000000_auth_user_provisioning.sql`'s trigger targets
  // `auth.users` directly and the migration chain would otherwise fail to
  // apply here at all (a bare PGlite instance has no `auth` schema —
  // verified directly: `pg_namespace` has zero rows for `nspname =
  // 'auth'` on a fresh instance). Deliberately minimal — one column,
  // `id uuid primary key`, the only thing that migration's trigger reads
  // — and NOT a claim about Supabase's real `auth.users` shape; see
  // `supabase/tests/auth-user-provisioning.integration.test.ts`'s own doc
  // comment for exactly what this does and does not represent/prove.
  await db.exec(`
    create schema auth;
    create table auth.users (
      id uuid primary key
    );
  `);
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

/**
 * Defaults `status` to PUBLISHED (Run 005 S2's own migration backfill
 * decision for pre-existing rows — most existing tests in this suite exist
 * to prove behavior unrelated to Course lifecycle and need an ordinarily-
 * usable Course, not a DRAFT/ARCHIVED one). Pass `status`/`examDate` to
 * seed a specific lifecycle state for Run 005 S2's own repository tests.
 */
export async function insertCourse(
  db: SqlExecutor,
  ownerUserId: string,
  overrides: {
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    examDate?: string | null;
  } = {},
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into courses (id, owner_user_id, title, status, exam_date)
     values ($1, $2, 'Test Course', $3, $4)`,
    [id, ownerUserId, overrides.status ?? "PUBLISHED", overrides.examDate ?? null],
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

/**
 * ADR-014 shape by default: `SINGLE_CHOICE`, options `A`/`B` (id === a
 * short display label here, purely a fixture convenience — ids and
 * content are independent per ADR-014), `A` correct. Matches the
 * `selectedAnswer: "A"`/`"B"` convention already used throughout
 * `submit-answer.test.ts`'s pre-existing (pre-ADR-014) fixtures. Pass
 * `overrides` for a MULTIPLE_CHOICE version or a custom option set — see
 * `answer-correctness-checker.test.ts` for real usage of both.
 */
export async function insertQuestionVersion(
  db: SqlExecutor,
  questionId: string,
  versionNumber = 1,
  overrides: {
    questionType?: "SINGLE_CHOICE" | "MULTIPLE_CHOICE";
    options?: Array<{ id: string; content: string }>;
    correctOptionIds?: string[];
  } = {},
): Promise<string> {
  const id = randomUUID();
  const questionType = overrides.questionType ?? "SINGLE_CHOICE";
  const options = overrides.options ?? [
    { id: "A", content: "Option A" },
    { id: "B", content: "Option B" },
  ];
  const correctOptionIds = overrides.correctOptionIds ?? ["A"];
  await db.query(
    `insert into question_versions
       (id, question_id, version_number, prompt, question_type, answer_options, correct_answer)
     values ($1, $2, $3, 'Prompt?', $4, $5, $6)`,
    [
      id,
      questionId,
      versionNumber,
      questionType,
      JSON.stringify(options),
      JSON.stringify(correctOptionIds),
    ],
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

/** One full valid chain: user, course, question, its current version.
 * Pass `versionOverrides` to seed a MULTIPLE_CHOICE version or a custom
 * option set instead of the SINGLE_CHOICE A/B default. */
export async function seedQuestionChain(
  db: SqlExecutor,
  versionOverrides: Parameters<typeof insertQuestionVersion>[3] = {},
) {
  const userId = await insertUser(db);
  const courseId = await insertCourse(db, userId);
  const questionId = await insertQuestion(db, courseId);
  const questionVersionId = await insertQuestionVersion(
    db,
    questionId,
    1,
    versionOverrides,
  );
  await setCurrentVersion(db, questionId, questionVersionId);
  return { userId, courseId, questionId, questionVersionId };
}

/**
 * A real `course_memberships` row via raw SQL (not through
 * `PostgresCourseMembershipRepository`, so callers exercising that
 * repository itself don't create a circular test dependency on it).
 */
export async function insertCourseMembership(
  db: SqlExecutor,
  args: {
    userId: string;
    courseId: string;
    role?: "OWNER" | "INSTRUCTOR" | "LEARNER";
    revokedAt?: Date | null;
    archivedAt?: Date | null;
  },
): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into course_memberships (id, user_id, course_id, role, revoked_at, archived_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      args.userId,
      args.courseId,
      args.role ?? "LEARNER",
      args.revokedAt ?? null,
      args.archivedAt ?? null,
    ],
  );
  return id;
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

/**
 * A real DailyPlan with one real item, via raw SQL (not through
 * `PostgresDailyPlanRepository`, so callers exercising that repository
 * itself — via the `dailyPlanItems` port in `submitAnswer` — don't create a
 * circular test dependency on it). Mirrors `seedTodaySessionWithItem`
 * exactly, for `submit-answer.test.ts`'s DailyPlan-attached scenarios
 * (ADR-016, Night-Run Slice 1).
 */
export async function seedDailyPlanWithItem(
  db: SqlExecutor,
  args: {
    userId: string;
    courseId: string;
    questionId: string;
    questionVersionId: string;
    plannedForDate?: string;
  },
): Promise<{ dailyPlanId: string; dailyPlanItemId: string }> {
  const dailyPlanId = randomUUID();
  await db.query(
    `insert into daily_plans
       (id, user_id, planned_for_date, status, engine_version)
     values ($1, $2, $3, 'prepared', 'test-engine-v1')`,
    [dailyPlanId, args.userId, args.plannedForDate ?? "2026-01-10"],
  );
  const dailyPlanItemId = randomUUID();
  await db.query(
    `insert into daily_plan_items
       (id, daily_plan_id, user_id, course_id, position, question_id,
        question_version_id, action_type, tier)
     values ($1, $2, $3, $4, 0, $5, $6, 'REVIEW_DUE', 'DUE_REVIEW')`,
    [
      dailyPlanItemId,
      dailyPlanId,
      args.userId,
      args.courseId,
      args.questionId,
      args.questionVersionId,
    ],
  );
  return { dailyPlanId, dailyPlanItemId };
}

/** Test-only direct mutation — sets a DailyPlanItem's status/resolution
 * timestamps to simulate an already-resolved item without going through
 * `submitAnswer`/the Skip flow. */
export async function setDailyPlanItemResolved(
  db: SqlExecutor,
  dailyPlanItemId: string,
  status: "completed" | "skipped",
  resolvedAt: Date,
): Promise<void> {
  await db.query(
    `update daily_plan_items
        set status = $2, resolved_at = $3, completed_at = $4
      where id = $1`,
    [dailyPlanItemId, status, resolvedAt, status === "completed" ? resolvedAt : null],
  );
}

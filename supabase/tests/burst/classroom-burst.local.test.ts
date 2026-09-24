/**
 * Pre-Pilot S3 — SYNTHETIC classroom burst sanity against a REAL local
 * PostgreSQL server (not PGlite, not hosted). Opt-in: skipped unless
 * `BURST_DATABASE_URL` is set, and excluded from `npm run test:schema`.
 *
 * Run: see docs/RUNS or `scripts/burst/README.md` for the exact commands
 * (`npm run test:burst`).
 *
 * What it exercises, through the REAL application use cases and the REAL
 * production composition roots, over real `pg.Pool` connections:
 *   join Course -> first Today (DailyPlan generation, TWICE concurrently to
 *   model a double-opened tab) -> first answer (ONE logical submission, same
 *   submissionId, sent TWICE concurrently with distinct server-side times).
 *
 * Two shapes:
 *  - PER_LEARNER_POOL: each of a learner's two concurrent requests gets its
 *    OWN `Pool({max: 1})` (plus one for the rest of the flow) — models
 *    Vercel serverless where every invocation holds its own one-connection
 *    pool (the app's `max: 1`, `pg-pool.ts`), so the duplicates genuinely
 *    race in Postgres instead of queueing on one connection.
 *  - SHARED_POOL_1: ONE `Pool({max: 1})` for everything — the worst-case
 *    "one warm instance serves the whole class" queueing shape. The two
 *    duplicates are serialized here by design.
 *
 * Duplicate-answer acceptance is the SAME rule as the hosted harness
 * (`evaluateDuplicateAnswerOutcome`): 200+200, or 200+409 with
 * ITEM_ALREADY_RESOLVED / SUBMISSION_ID_REUSED. The strongest invariant is
 * asserted from the database afterwards: exactly one Attempt and one
 * completed DailyPlanItem per learner.
 *
 * What this DOES prove: application/transaction correctness under real
 * concurrent connections (one plan per learner, one Attempt per learner,
 * no unique-constraint/serialization failures surfacing), and a latency
 * baseline against a Supabase-image Postgres 17 on one machine.
 *
 * What it does NOT prove (see the S3 report): hosted Supabase behaviour,
 * Supavisor transaction-pooler limits, TLS/network/cold-start latency, the
 * auth provider, HTTP/Next.js layer, or production capacity. Latencies are
 * localhost, in-process, single-machine numbers — a baseline, not a claim.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { joinCourse } from "../../../src/application/course/join-course";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { submitDailyPlanItemAnswer } from "../../../src/application/dailyPlan/submit-daily-plan-item-answer";
import {
  createProductionDailyPlanGenerationSettings,
  createProductionDailyPlanPorts,
} from "../../../src/infrastructure/dailyPlan/composition-root";
import { createProductionSubmitAnswerContext } from "../../../src/infrastructure/learning/composition-root";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PgConnectionProvider } from "../../../src/infrastructure/postgres/pg-connection-provider";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import { buildReport, evaluateDuplicateAnswerOutcome } from "../../../scripts/burst/burst-stats.mjs";

const BASE_URL = process.env.BURST_DATABASE_URL;

// Safety: this suite creates/drops a database and writes synthetic rows —
// it must only ever run against a LOCAL Postgres, never a hosted project.
if (BASE_URL && !["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE_URL).hostname)) {
  throw new Error("BURST_DATABASE_URL must point at a local Postgres (localhost/127.0.0.1/::1).");
}
const LEARNERS = Number(process.env.BURST_LEARNERS ?? "30");
const QUESTION_COUNT = 12;

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(here, "../../migrations");
const REPORT_DIR = path.join(here, "../../../scratch/burst");

function dbUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

interface StepResult {
  ok: boolean;
  steps: Record<string, number>;
  failure?: { step: string; message?: string; code?: string };
  /** e.g. "200+200" or "409:ITEM_ALREADY_RESOLVED+200" - same labels as the hosted HTTP harness. */
  answerOutcome?: string;
}

/**
 * Maps a use-case result onto the HTTP status/application code the real
 * route (handle-submit-daily-plan-item-answer.ts) would return, so the
 * SAME acceptance rule as the hosted harness applies to local runs.
 */
function toHttpLike(result: { kind: string }): { status: number; code: string | null; shapeOk: boolean } {
  switch (result.kind) {
    case "ACCEPTED":
      return { status: 200, code: null, shapeOk: true };
    case "DAILY_PLAN_ITEM_ALREADY_RESOLVED":
      return { status: 409, code: "ITEM_ALREADY_RESOLVED", shapeOk: true };
    case "IDEMPOTENCY_KEY_CONFLICT":
      return { status: 409, code: "SUBMISSION_ID_REUSED", shapeOk: true };
    case "INVALID_SELECTED_ANSWER":
      return { status: 400, code: "INVALID_ANSWER", shapeOk: true };
    case "ITEM_NOT_FOUND_OR_NOT_OWNED":
    case "DAILY_PLAN_ITEM_NOT_FOUND_OR_NOT_OWNED":
      return { status: 404, code: "ITEM_NOT_FOUND", shapeOk: true };
    default:
      return { status: 500, code: "INTERNAL_ERROR", shapeOk: true };
  }
}

async function migrateAndSeed(url: string): Promise<{ courseId: string; learnerIds: string[] }> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query("create schema if not exists auth");
    await client.query("create table if not exists auth.users (id uuid primary key)");
    for (const file of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await client.query(readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"));
    }

    const ownerId = randomUUID();
    await client.query("insert into users (id, timezone) values ($1, 'Asia/Jerusalem')", [ownerId]);
    const courseId = randomUUID();
    await client.query(
      `insert into courses (id, owner_user_id, title, status, join_policy)
       values ($1, $2, 'Burst Course', 'PUBLISHED', 'OPEN')`,
      [courseId, ownerId],
    );
    await client.query(
      "insert into course_memberships (user_id, course_id, role) values ($1, $2, 'OWNER')",
      [ownerId, courseId],
    );
    for (let i = 0; i < QUESTION_COUNT; i += 1) {
      const questionId = randomUUID();
      const versionId = randomUUID();
      await client.query("insert into questions (id, course_id) values ($1, $2)", [questionId, courseId]);
      await client.query(
        `insert into question_versions
           (id, question_id, version_number, prompt, question_type, answer_options, correct_answer)
         values ($1, $2, 1, $3, 'SINGLE_CHOICE', $4, $5)`,
        [
          versionId,
          questionId,
          `Burst question ${i + 1}?`,
          JSON.stringify([
            { id: "A", content: "A" },
            { id: "B", content: "B" },
          ]),
          JSON.stringify(["A"]),
        ],
      );
      await client.query("update questions set current_version_id = $1 where id = $2", [versionId, questionId]);
    }
    const learnerIds: string[] = [];
    for (let i = 0; i < LEARNERS; i += 1) {
      const id = randomUUID();
      await client.query("insert into users (id, timezone) values ($1, 'Asia/Jerusalem')", [id]);
      learnerIds.push(id);
    }
    return { courseId, learnerIds };
  } finally {
    await client.end();
  }
}

async function learnerFlow(args: {
  pool: pg.Pool;
  /**
   * Pool for the SECOND of two concurrent requests. PER_LEARNER_POOL hands
   * out a fresh one-connection pool (a separate serverless invocation);
   * SHARED_POOL_1 returns the one shared pool, which serializes both
   * requests by design (single warm instance, single connection).
   */
  newPool: () => pg.Pool;
  userId: string;
  courseId: string;
  start: Promise<void>;
}): Promise<StepResult> {
  const { pool, userId, courseId } = args;
  const steps: Record<string, number> = {};
  let step = "join";
  let answerOutcome: string | undefined;
  // One second pool per learner (reused for both concurrent duplicates) so a
  // learner holds at most 2 server connections, not 3.
  let secondPool: pg.Pool | undefined;
  const getSecondPool = () => (secondPool ??= args.newPool());
  await args.start;

  try {
    // 1. join (single-statement, no UnitOfWork — same as the real route)
    let t = performance.now();
    const joined = await joinCourse(
      { actorUserId: userId, courseId },
      {
        memberships: new PostgresCourseMembershipRepository(pool),
        courses: new PostgresCourseRepository(pool),
      },
    );
    steps.join = performance.now() - t;
    if (joined.outcome !== "JOINED") throw new Error(`join outcome ${joined.outcome}`);

    // 2. first Today: TWO concurrent opens (double tab), each on its OWN
    // pool where the scenario allows -> one plan, real plan-creation race.
    step = "today";
    const now = new Date();
    const openToday = async (p: pg.Pool) => {
      const provider = new PgConnectionProvider(p);
      return getOrCreateDailyPlanForToday(
        { userId, now },
        createProductionDailyPlanGenerationSettings(),
        createProductionDailyPlanPorts(p, provider),
      );
    };
    t = performance.now();
    const [first, second] = await Promise.all([openToday(pool), openToday(getSecondPool())]);
    steps.today = performance.now() - t;
    if (first.outcome !== "READY" || second.outcome !== "READY") {
      throw new Error(`today outcome ${first.outcome}/${second.outcome}`);
    }
    if (first.plan.id !== second.plan.id) throw new Error("two concurrent Today opens produced different plans");
    if (first.plan.items.length === 0) throw new Error("plan has no items");

    // Learner-facing content read, as the real route does after plan READY.
    t = performance.now();
    const content = await new PostgresLearnerQuestionContentRepository(pool).findManyByVersionIds(
      first.plan.items.map((item) => item.questionVersionId),
    );
    steps.todayContent = performance.now() - t;
    if (content.length === 0) throw new Error("no learner content returned");

    // 3. first answer: ONE logical submission (same submissionId) sent twice
    // concurrently, like two HTTP requests: separate pools where the
    // scenario allows, and distinct server-side times (the real route uses
    // its own new Date() per request, and answeredAt is part of the
    // submission identity).
    step = "answer";
    const item = first.plan.items[0];
    const submissionId = `burst-${randomUUID()}`;
    const requestTimes = [new Date(), new Date(Date.now() + 3)];
    const submit = (p: pg.Pool, requestNow: Date) =>
      submitDailyPlanItemAnswer(
        {
          userId,
          dailyPlanItemId: item.id,
          submissionId,
          selectedAnswer: "A",
          confidenceLevel: null,
          responseTimeSeconds: 3,
          assistanceUsed: "NONE",
          answerWasRevealedBeforeResponse: false,
          answeredAt: requestNow,
        },
        {
          items: new PostgresDailyPlanRepository(p),
          memberships: new PostgresCourseMembershipRepository(p),
          context: createProductionSubmitAnswerContext(requestNow),
          uow: new PostgresUnitOfWork(new PgConnectionProvider(p)),
        },
      );
    t = performance.now();
    const [a, b] = await Promise.all([submit(pool, requestTimes[0]), submit(getSecondPool(), requestTimes[1])]);
    steps.answer = performance.now() - t;
    // Same acceptance rule as the hosted harness: 200+200, or 200+409 with
    // ITEM_ALREADY_RESOLVED | SUBMISSION_ID_REUSED; nothing else.
    const verdict = evaluateDuplicateAnswerOutcome([toHttpLike(a), toHttpLike(b)]);
    if (!verdict.ok) throw new Error(`duplicate same-submission answer: ${verdict.reason} (${a.kind}, ${b.kind})`);
    answerOutcome = verdict.outcome;
    return { ok: true, steps, answerOutcome };
  } catch (error) {
    const e = error as { message?: string; code?: string };
    return { ok: false, steps, failure: { step, message: e.message, code: e.code } };
  }
}

async function runScenario(scenario: "PER_LEARNER_POOL" | "SHARED_POOL_1") {
  const admin = new pg.Client({ connectionString: BASE_URL });
  await admin.connect();
  const database = `burst_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  await admin.query(`create database ${database}`);
  const url = dbUrl(BASE_URL as string, database);

  const { courseId, learnerIds } = await migrateAndSeed(url);

  // Connection monitor (separate connection, not counted in the app pools).
  const monitor = new pg.Client({ connectionString: dbUrl(BASE_URL as string, "postgres") });
  await monitor.connect();
  let peakConnections = 0;
  let monitoring = true;
  const poll = (async () => {
    while (monitoring) {
      const r = await monitor.query(
        "select count(*)::int as n from pg_stat_activity where datname = $1",
        [database],
      );
      peakConnections = Math.max(peakConnections, (r.rows[0] as { n: number }).n);
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  })();

  const sharedPool = scenario === "SHARED_POOL_1" ? new pg.Pool({ connectionString: url, max: 1 }) : null;
  const pools: pg.Pool[] = sharedPool ? [sharedPool] : [];
  let release!: () => void;
  const start = new Promise<void>((resolve) => {
    release = resolve;
  });

  const makePool = (): pg.Pool => {
    if (sharedPool) return sharedPool;
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    pools.push(pool);
    return pool;
  };
  const flows = learnerIds.map((userId) =>
    learnerFlow({ pool: makePool(), newPool: makePool, userId, courseId, start }),
  );

  const wallStart = performance.now();
  release();
  const results = await Promise.all(flows);
  const wallMs = performance.now() - wallStart;

  monitoring = false;
  await poll;
  await monitor.end();

  // Invariants, read through a fresh connection.
  const check = new pg.Client({ connectionString: url });
  await check.connect();
  const count = async (sql: string) => Number(((await check.query(sql)).rows[0] as { n: string }).n);
  const invariants = {
    learnerMemberships: await count("select count(*) as n from course_memberships where role = 'LEARNER'"),
    dailyPlans: await count("select count(*) as n from daily_plans"),
    usersWithExactlyOnePlan: await count(
      "select count(*) as n from (select user_id from daily_plans group by user_id having count(*) = 1) t",
    ),
    attempts: await count("select count(*) as n from attempts"),
    usersWithExactlyOneAttempt: await count(
      "select count(*) as n from (select user_id from attempts group by user_id having count(*) = 1) t",
    ),
    completedPlanItems: await count("select count(*) as n from daily_plan_items where status = 'completed'"),
  };
  await check.end();

  await Promise.all(pools.map((p) => p.end()));
  // Pool/Client `end()` sends Terminate asynchronously, so the backends may
  // still be exiting; retry a plain DROP (no FORCE — never kill live
  // connections, which surfaces as unhandled 57P01 errors on the clients).
  for (let attempt = 0; ; attempt += 1) {
    try {
      await admin.query(`drop database ${database}`);
      break;
    } catch (error) {
      if (attempt >= 20) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  await admin.end();

  const report = buildReport({
    scenario,
    learners: learnerIds.length,
    results,
    extra: {
      environment: "local Docker supabase/postgres 17.6, direct connection (no Supavisor), in-process app layer (no HTTP)",
      wallClockMs: Math.round(wallMs),
      peakServerConnections: peakConnections,
      poolShape: sharedPool
        ? "1 shared Pool(max:1) (both duplicate requests serialized on it)"
        : `2 x Pool(max:1) per learner (${learnerIds.length * 2} connections; each duplicate request on its own pool)`,
      duplicateAnswerOutcomes: results.reduce<Record<string, number>>((tally, r) => {
        if (r.answerOutcome) tally[r.answerOutcome] = (tally[r.answerOutcome] ?? 0) + 1;
        return tally;
      }, {}),
      invariants,
    },
  });
  mkdirSync(REPORT_DIR, { recursive: true });
  writeFileSync(
    path.join(REPORT_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}-${scenario}-${LEARNERS}.json`),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  return { report, invariants };
}

describe.skipIf(!BASE_URL)("synthetic classroom burst (real local Postgres)", () => {
  beforeAll(() => {
    expect(LEARNERS).toBeGreaterThanOrEqual(1);
  });
  afterAll(() => undefined);

  for (const scenario of ["PER_LEARNER_POOL", "SHARED_POOL_1"] as const) {
    it(`${scenario}: ${LEARNERS} near-simultaneous learners complete join -> Today -> answer with intact invariants`, async () => {
      const { report, invariants } = await runScenario(scenario);
      expect(report.failed).toBe(0);
      expect(invariants.learnerMemberships).toBe(LEARNERS);
      expect(invariants.dailyPlans).toBe(LEARNERS);
      expect(invariants.usersWithExactlyOnePlan).toBe(LEARNERS);
      expect(invariants.attempts).toBe(LEARNERS);
      expect(invariants.usersWithExactlyOneAttempt).toBe(LEARNERS);
      expect(invariants.completedPlanItems).toBe(LEARNERS);
    }, 180_000);
  }
});

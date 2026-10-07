/**
 * PGlite tests for the Today learning recap read (Run TODAY-LEARNING-RECAP-004):
 * `PostgresDailyPlanAttemptRecapRepository` scoping/mapping, plus the
 * statement-cost evidence of the Today GET handler wired to real repositories
 * (3 plain plan reads + 1 content read, +1 recap read only once an item is
 * completed). PGlite proves SQL/scoping/structural statement counts, not
 * latency or multi-connection behavior.
 */
import { randomUUID } from "node:crypto";

import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleGetDailyPlanToday } from "../../../src/app/api/daily-plan/today/handle-get-daily-plan-today";
import {
  deriveLearningRecap,
  type LearningRecapPlanItem,
} from "../../../src/application/dailyPlan/derive-learning-recap";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresDailyPlanAttemptRecapRepository } from "../../../src/infrastructure/postgres/daily-plan-attempt-recap-repository";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
import { createStatementCounter } from "./statement-counter";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertQuestion,
  insertQuestionVersion,
  insertTopic,
  insertUser,
  pgliteConnectionProvider,
  seedDailyPlanWithItem,
  setCurrentVersion,
  setDailyPlanItemResolved,
  setQuestionTopic,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

async function question(courseId: string, topicId: string | null) {
  const questionId = await insertQuestion(db, courseId);
  const versionId = await insertQuestionVersion(db, questionId);
  await setCurrentVersion(db, questionId, versionId);
  if (topicId !== null) await setQuestionTopic(db, questionId, topicId);
  return { questionId, versionId };
}

async function insertAttempt(args: {
  userId: string;
  courseId: string;
  questionId: string;
  versionId: string;
  isCorrect: boolean;
  confidence?: string | null;
  planId?: string | null;
  itemId?: string | null;
}) {
  await db.query(
    `insert into attempts
       (submission_id, user_id, course_id, question_id, question_version_id, answered_at,
        is_correct, selected_answer, confidence_level, attempt_number_for_presented_item,
        engine_version, daily_plan_id, daily_plan_item_id)
     values ($1, $2, $3, $4, $5, now(), $6, '"A"'::jsonb, $7, 1, 'test-engine-v1', $8, $9)`,
    [
      `sub-${randomUUID()}`,
      args.userId,
      args.courseId,
      args.questionId,
      args.versionId,
      args.isCorrect,
      args.confidence ?? null,
      args.planId ?? null,
      args.itemId ?? null,
    ],
  );
}

/** Adds one more item (position n) to an existing plan. */
async function addItem(planId: string, userId: string, courseId: string, q: { questionId: string; versionId: string }, position: number) {
  const id = randomUUID();
  await db.query(
    `insert into daily_plan_items
       (id, daily_plan_id, user_id, course_id, position, question_id, question_version_id, action_type, tier)
     values ($1, $2, $3, $4, $5, $6, $7, 'REVIEW_DUE', 'DUE_REVIEW')`,
    [id, planId, userId, courseId, position, q.questionId, q.versionId],
  );
  return id;
}

describe("PostgresDailyPlanAttemptRecapRepository", () => {
  it("returns this plan's attempts with topic + confidence; null topic, null confidence, archived topic are mapped explicitly", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const topic = await insertTopic(db, courseId, "מטריצות");
    const archived = await insertTopic(db, courseId, "נושא ישן");
    await db.query("update topics set archived_at = now() where id = $1", [archived]);

    const q1 = await question(courseId, topic);
    const q2 = await question(courseId, null);
    const q3 = await question(courseId, archived);
    const { dailyPlanId, dailyPlanItemId: i1 } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q1.questionId, questionVersionId: q1.versionId,
    });
    const i2 = await addItem(dailyPlanId, userId, courseId, q2, 1);
    const i3 = await addItem(dailyPlanId, userId, courseId, q3, 2);
    await insertAttempt({ userId, courseId, ...q1, isCorrect: true, confidence: "high", planId: dailyPlanId, itemId: i1 });
    await insertAttempt({ userId, courseId, ...q2, isCorrect: false, confidence: null, planId: dailyPlanId, itemId: i2 });
    await insertAttempt({ userId, courseId, ...q3, isCorrect: true, confidence: "low", planId: dailyPlanId, itemId: i3 });

    const rows = await new PostgresDailyPlanAttemptRecapRepository(db).findAttemptsForPlan(userId, dailyPlanId);

    expect(rows).toHaveLength(3);
    const byItem = new Map(rows.map((r) => [r.dailyPlanItemId, r]));
    expect(byItem.get(i1)).toEqual({
      dailyPlanItemId: i1, isCorrect: true, confidenceLevel: "high",
      topicId: topic, topicName: "מטריצות", topicArchived: false,
    });
    expect(byItem.get(i2)).toMatchObject({ isCorrect: false, confidenceLevel: null, topicId: null, topicName: null, topicArchived: false });
    expect(byItem.get(i3)).toMatchObject({ confidenceLevel: "low", topicName: "נושא ישן", topicArchived: true });

    // End-to-end with the pure derivation: archived/null topics are excluded from lists but counted.
    const items: LearningRecapPlanItem[] = [i1, i2, i3].map((id) => ({ id, status: "completed" }));
    expect(deriveLearningRecap(items, rows)).toMatchObject({
      answered: 3, correct: 2, incorrect: 1, topicsWorked: 1, strongTopics: ["מטריצות"], revisitTopics: [],
    });
  });

  it("a skipped item has no attempt row; it is not returned", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const q1 = await question(courseId, null);
    const q2 = await question(courseId, null);
    const { dailyPlanId, dailyPlanItemId: i1 } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q1.questionId, questionVersionId: q1.versionId,
    });
    const i2 = await addItem(dailyPlanId, userId, courseId, q2, 1);
    await setDailyPlanItemResolved(db, i2, "skipped", new Date());
    await insertAttempt({ userId, courseId, ...q1, isCorrect: true, planId: dailyPlanId, itemId: i1 });

    const rows = await new PostgresDailyPlanAttemptRecapRepository(db).findAttemptsForPlan(userId, dailyPlanId);
    expect(rows.map((r) => r.dailyPlanItemId)).toEqual([i1]);
  });

  it("is user-scoped: another user's attempts never come back, even when asking with the other user's plan id", async () => {
    const userA = await insertUser(db);
    const userB = await insertUser(db);
    const courseId = await insertCourse(db, userA);
    const q = await question(courseId, null);
    const a = await seedDailyPlanWithItem(db, { userId: userA, courseId, questionId: q.questionId, questionVersionId: q.versionId });
    const b = await seedDailyPlanWithItem(db, { userId: userB, courseId, questionId: q.questionId, questionVersionId: q.versionId, plannedForDate: "2026-01-11" });
    await insertAttempt({ userId: userA, courseId, ...q, isCorrect: true, planId: a.dailyPlanId, itemId: a.dailyPlanItemId });
    await insertAttempt({ userId: userB, courseId, ...q, isCorrect: false, planId: b.dailyPlanId, itemId: b.dailyPlanItemId });

    const repo = new PostgresDailyPlanAttemptRecapRepository(db);
    const forA = await repo.findAttemptsForPlan(userA, a.dailyPlanId);
    expect(forA.map((r) => [r.dailyPlanItemId, r.isCorrect])).toEqual([[a.dailyPlanItemId, true]]);
    // Cross-scope probes: user + someone else's plan => nothing.
    expect(await repo.findAttemptsForPlan(userA, b.dailyPlanId)).toEqual([]);
    expect(await repo.findAttemptsForPlan(userB, a.dailyPlanId)).toEqual([]);
  });

  it("excludes practice attempts (daily_plan_id null), including ones on the same question", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const q = await question(courseId, null);
    const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q.questionId, questionVersionId: q.versionId,
    });
    await insertAttempt({ userId, courseId, ...q, isCorrect: false, planId: null, itemId: null }); // Practice
    expect(await new PostgresDailyPlanAttemptRecapRepository(db).findAttemptsForPlan(userId, dailyPlanId)).toEqual([]);

    await insertAttempt({ userId, courseId, ...q, isCorrect: true, planId: dailyPlanId, itemId: dailyPlanItemId });
    const rows = await new PostgresDailyPlanAttemptRecapRepository(db).findAttemptsForPlan(userId, dailyPlanId);
    expect(rows).toHaveLength(1);
    expect(rows[0].isCorrect).toBe(true);
  });

  it("is read-only: leaves attempts and plan items untouched", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const q = await question(courseId, null);
    const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q.questionId, questionVersionId: q.versionId,
    });
    await insertAttempt({ userId, courseId, ...q, isCorrect: true, planId: dailyPlanId, itemId: dailyPlanItemId });
    const counter = createStatementCounter();
    await new PostgresDailyPlanAttemptRecapRepository(counter.wrapExecutor(db as unknown as SqlExecutor)).findAttemptsForPlan(userId, dailyPlanId);
    expect(counter.total).toBe(1);
    expect(counter.byVerb.select).toBe(1);
  });
});

describe("Today GET statement cost with the recap read (repeat open of an existing plan)", () => {
  async function seed() {
    const userId = await insertUser(db);
    await db.query("update users set timezone = 'Asia/Jerusalem' where id = $1", [userId]);
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
    const q = await question(courseId, null);
    return { userId, courseId, q };
  }

  /** Mirrors route.ts wiring over a statement counter (all plain pool reads). */
  function countedHandler(userId: string) {
    const counter = createStatementCounter();
    const pool = counter.wrapExecutor(db as unknown as SqlExecutor);
    const ports = {
      users: new PostgresUserRepository(pool),
      courseMemberships: new PostgresCourseMembershipRepository(pool),
      courses: new PostgresCourseRepository(pool),
      dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(counter.wrapProvider(pgliteConnectionProvider(db))),
      dailyPlanReader: new PostgresDailyPlanRepository(pool),
    };
    const settings = {
      engineVersion: "test-engine-v1",
      memoryScheduler: { initialize: () => { throw new Error("n/a"); }, review: () => { throw new Error("n/a"); }, estimateRetrievability: () => 0.9 },
      todayPlanBudgetPolicy: { minUsefulItems: 5, typicalRangeMax: 12, hardMaximumItems: 15 },
    };
    const now = new Date("2026-01-10T10:00:00Z");
    const call = () =>
      handleGetDailyPlanToday({
        authenticate: async () => ({ outcome: "AUTHENTICATED", userId }),
        now,
        generateDailyPlan: (command) => getOrCreateDailyPlanForToday(command, settings, ports),
        loadLearnerQuestionContent: (ids) => new PostgresLearnerQuestionContentRepository(pool).findManyByVersionIds(ids),
        loadPlanAttempts: (uid, planId) => new PostgresDailyPlanAttemptRecapRepository(pool).findAttemptsForPlan(uid, planId),
      });
    return { counter, call };
  }

  it("not started: 4 statements (3 plan reads + 1 content read), no recap; one item completed: 5 (+1 recap)", async () => {
    const { userId, courseId, q } = await seed();
    // Hand-built frozen plan for the learner's local day (so no generation runs).
    const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q.questionId, questionVersionId: q.versionId, plannedForDate: "2026-01-10",
    });
    const { counter, call } = countedHandler(userId);

    const fresh = await call();
    expect(fresh.status).toBe(200);
    expect(fresh.body).not.toHaveProperty("plan.learningRecap");
    expect(counter.total).toBe(4);
    expect(counter.byVerb.insert + counter.byVerb.update + counter.byVerb.delete).toBe(0);
    const freshCount = counter.total;

    // Resolve the only item via a real attempt row + item status.
    await insertAttempt({ userId, courseId, ...q, isCorrect: true, confidence: "high", planId: dailyPlanId, itemId: dailyPlanItemId });
    await setDailyPlanItemResolved(db, dailyPlanItemId, "completed", new Date());
    counter.reset();
    const resolved = await call();
    expect(resolved.status).toBe(200);
    expect(counter.total).toBe(freshCount + 1);
    expect(counter.total).toBe(5);
    expect((resolved.body as { plan: { learningRecap: unknown } }).plan.learningRecap).toMatchObject({
      answered: 1, correct: 1, sureCorrect: 1, skipped: 0,
    });
  });

  it("skipped-only plan adds no recap statement", async () => {
    const { userId, courseId, q } = await seed();
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, {
      userId, courseId, questionId: q.questionId, questionVersionId: q.versionId, plannedForDate: "2026-01-10",
    });
    await setDailyPlanItemResolved(db, dailyPlanItemId, "skipped", new Date());
    const { counter, call } = countedHandler(userId);
    const result = await call();
    expect(result.body).not.toHaveProperty("plan.learningRecap");
    expect(counter.total).toBe(4);
  });
});

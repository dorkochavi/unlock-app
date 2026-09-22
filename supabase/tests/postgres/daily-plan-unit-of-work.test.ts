/**
 * Real-Postgres (PGlite) integration tests for `PostgresDailyPlanUnitOfWork`
 * and the full `getOrCreateDailyPlanForToday` generation path wired against
 * it — the DailyPlan-scoped counterpart to
 * `supabase/tests/postgres/unit-of-work.test.ts`.
 *
 * `supabase/tests/postgres/daily-plan-repository.test.ts` already proves
 * `PostgresDailyPlanRepository`'s own SQL/race-freedom directly; this file's
 * job is the NEW surface this slice adds: the transaction wrapper itself
 * (atomicity across `dailyPlans`/`progress`/`questionVersions` together),
 * and the full application-layer generation pipeline running against a real
 * migrated schema end-to-end.
 *
 * Concurrency caveat (same as `unit-of-work.test.ts`'s own, restated here):
 * PGlite is a single in-process WASM engine with no second concurrent
 * backend — there is no meaningful way to open two TRULY concurrent
 * transactions against it. The "concurrent first open" test below is
 * SEQUENTIAL calls proving the same race-free-by-construction property
 * `daily-plan-repository.test.ts` already proves at the repository level,
 * this time through the full `getOrCreateDailyPlanForToday` pipeline — it
 * does not and cannot prove genuine multi-connection concurrent blocking.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DailyPlanGenerationSettings } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import type { DailyPlan, DailyPlanItem } from "../../../src/application/dailyPlan/ports";
import type { TodayPlannerPolicy } from "../../../src/domain/learning/today-planner";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import type { ConnectionProvider } from "../../../src/infrastructure/postgres/connection-provider";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
import { PostgresUserQuestionProgressRepository } from "../../../src/infrastructure/postgres/progress-repository";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  pgliteConnectionProvider,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

function makeSettings(
  overrides: Partial<DailyPlanGenerationSettings> = {},
): DailyPlanGenerationSettings {
  const policy: TodayPlannerPolicy = { maxItems: 15 };
  return {
    engineVersion: "test-engine-v1",
    memoryScheduler: {
      initialize: () => {
        throw new Error("not used");
      },
      review: () => {
        throw new Error("not used");
      },
      estimateRetrievability: () => 0.9,
    },
    todayPlannerPolicy: policy,
    ...overrides,
  };
}

async function setUserTimezone(executor: SqlExecutor, userId: string, timezone: string) {
  await executor.query("update users set timezone = $2 where id = $1", [userId, timezone]);
}

async function seedDueProgress(
  executor: SqlExecutor,
  userId: string,
  questionId: string,
) {
  const repo = new PostgresUserQuestionProgressRepository(executor);
  await repo.upsert({
    userId,
    questionId,
    attemptCount: 1,
    correctCount: 1,
    lastAttemptAt: new Date("2026-01-05T00:00:00Z"),
    lastCorrectAt: new Date("2026-01-05T00:00:00Z"),
    lastIncorrectAt: null,
    memory: {
      stability: 5,
      difficulty: 5,
      scheduledReviewAt: new Date("2020-01-01T00:00:00Z"), // long since due
      lastReviewAt: new Date("2026-01-05T00:00:00Z"),
      reviewCount: 1,
      lapseCount: 0,
      implementationState: { implementation: "fake", schemaVersion: 1, state: {} },
    },
    retrievalBaselineAt: new Date("2026-01-05T00:00:00Z"),
    retrievalBaselineLearningSessionId: null,
    successfulSpacedRetrievals: 0,
    lapseCount: 0,
    lastLapseAt: null,
    misconceptionState: "none",
    misconceptionScore: 0,
    misconceptionLastSeenAt: null,
    timedAttemptCount: 1,
    averageResponseTimeSeconds: 10,
    meaningfulAttemptCount: 1,
    assistedAttemptCount: 0,
    lowQualityAttemptCount: 0,
    invalidForMasteryAttemptCount: 0,
    firstMeaningfulEvidenceAt: new Date("2026-01-05T00:00:00Z"),
    lastMeaningfulEvidenceAt: new Date("2026-01-05T00:00:00Z"),
    evidenceStrength: "early",
    masteryCategory: "learning",
    engineVersion: "test-engine-v1",
    updatedAt: new Date("2026-01-05T00:00:00Z"),
  });
}

function makePorts() {
  return {
    users: new PostgresUserRepository(db),
    courseMemberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
    dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(pgliteConnectionProvider(db)),
  };
}

describe("PostgresDailyPlanUnitOfWork — atomicity", () => {
  it("A. rolls back the whole transaction when a failure occurs after the DailyPlan row insert but before all DailyPlanItems complete — real Postgres, zero rows of either table survive", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionA = await insertQuestion(db, courseId);
    const versionA = await insertQuestionVersion(db, questionA);
    await setCurrentVersion(db, questionA, versionA);
    const questionB = await insertQuestion(db, courseId);
    const versionB = await insertQuestionVersion(db, questionB);
    await setCurrentVersion(db, questionB, versionB);

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
        questionId: questionA,
        questionVersionId: versionA,
        actionType: "REVIEW_DUE",
        tier: "DUE_REVIEW",
        otherApplicableTypes: [],
        reasons: ["SCHEDULED_REVIEW_DUE"],
        status: "pending",
        resolvedAt: null,
        completedAt: null,
      },
      {
        userId,
        courseId,
        position: 1,
        questionId: questionB,
        questionVersionId: versionB,
        actionType: "REVIEW_DUE",
        tier: "DUE_REVIEW",
        otherApplicableTypes: [],
        reasons: ["SCHEDULED_REVIEW_DUE"],
        status: "pending",
        resolvedAt: null,
        completedAt: null,
      },
    ];

    // Query sequence inside the transaction, calling
    // `repos.dailyPlans.createIfNotExists` directly (not the full
    // generation pipeline, so the count is small and exact):
    //   1 = begin, 2 = plan INSERT, 3 = item[0] INSERT, 4 = item[1] INSERT.
    // Throwing exactly on query 4 fails AFTER the plan row and the FIRST
    // item are already written, but before the second item completes —
    // then lets query 5 (the real ROLLBACK the catch block issues) through
    // normally, so the actual Postgres-level rollback genuinely executes.
    let queryCount = 0;
    const throwOnceExecutor: SqlExecutor = {
      query: async (text, params) => {
        queryCount++;
        if (queryCount === 4) {
          throw new Error("simulated failure mid-item-insert");
        }
        return db.query(text, params as unknown[]);
      },
    };
    const throwingProvider: ConnectionProvider = {
      withConnection: async (fn) => fn(throwOnceExecutor),
    };
    const throwingUow = new PostgresDailyPlanUnitOfWork(throwingProvider);

    await expect(
      throwingUow.runInTransaction((repos) => repos.dailyPlans.createIfNotExists(plan, items)),
    ).rejects.toThrow("simulated failure mid-item-insert");

    const planRows = await db.query<{ count: string }>(
      "select count(*)::int as count from daily_plans where user_id = $1",
      [userId],
    );
    const itemRows = await db.query<{ count: string }>(
      "select count(*)::int as count from daily_plan_items where user_id = $1",
      [userId],
    );
    expect(Number(planRows.rows[0].count)).toBe(0);
    expect(Number(itemRows.rows[0].count)).toBe(0);
  });
});

describe("getOrCreateDailyPlanForToday — real Postgres generation path", () => {
  it("B. sequential first-open calls for the same (userId, local date) result in exactly one daily_plans row, the same canonical plan, with no mixed/duplicated items (PGlite is single-connection — see file doc comment for the concurrency caveat)", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "UTC");
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
    const questionA = await insertQuestion(db, courseId);
    const versionA = await insertQuestionVersion(db, questionA);
    await setCurrentVersion(db, questionA, versionA);
    await seedDueProgress(db, userId, questionA);

    const now = new Date("2026-01-10T10:00:00Z");
    const ports = makePorts();

    const first = await getOrCreateDailyPlanForToday(
      { userId, now },
      makeSettings(),
      ports,
    );
    const second = await getOrCreateDailyPlanForToday(
      { userId, now },
      makeSettings(),
      ports,
    );

    expect(first.outcome).toBe("READY");
    expect(second.outcome).toBe("READY");
    if (first.outcome === "READY" && second.outcome === "READY") {
      expect(second.plan.id).toBe(first.plan.id);
      expect(second.plan.items).toEqual(first.plan.items);
    }

    const planCount = await db.query<{ count: string }>(
      "select count(*)::int as count from daily_plans where user_id = $1 and planned_for_date = $2",
      [userId, "2026-01-10"],
    );
    expect(Number(planCount.rows[0].count)).toBe(1);

    const itemRows = await db.query<{ position: number; question_id: string }>(
      "select position, question_id from daily_plan_items where user_id = $1",
      [userId],
    );
    const positions = itemRows.rows.map((r) => r.position);
    const questionIds = itemRows.rows.map((r) => r.question_id);
    expect(new Set(positions).size).toBe(positions.length);
    expect(new Set(questionIds).size).toBe(questionIds.length);
  });

  it("C. generates, persists, and resumes a real DailyPlan end-to-end with the correct local plannedForDate and frozen item fields", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "Asia/Jerusalem");
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);
    await seedDueProgress(db, userId, questionId);

    // 23:00 UTC + winter UTC+2 = 01:00 the NEXT day in Jerusalem.
    const now = new Date("2026-01-10T23:00:00Z");
    const ports = makePorts();

    const result = await getOrCreateDailyPlanForToday({ userId, now }, makeSettings(), ports);

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    expect(result.plan.plannedForDate).toBe("2026-01-11");
    expect(result.plan.items).toHaveLength(1);
    expect(result.plan.items[0].courseId).toBe(courseId);
    expect(result.plan.items[0].questionId).toBe(questionId);
    expect(result.plan.items[0].questionVersionId).toBe(versionId);
    expect(result.plan.items[0].status).toBe("pending");

    // Reopening the same local day resumes the persisted plan.
    const reopened = await getOrCreateDailyPlanForToday(
      { userId, now: new Date("2026-01-11T00:30:00Z") }, // still 02:30 Jerusalem, same local day
      makeSettings(),
      ports,
    );
    expect(reopened.outcome).toBe("READY");
    if (reopened.outcome !== "READY") throw new Error("unreachable");
    expect(reopened.plan.id).toBe(result.plan.id);
  });

  it("D. pools items only from the LEARNER-role Course, excluding OWNER/INSTRUCTOR Courses, against real CourseMembership rows", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "UTC");

    const learnerCourseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId: learnerCourseId, role: "LEARNER" });
    const learnerQuestionId = await insertQuestion(db, learnerCourseId);
    const learnerVersionId = await insertQuestionVersion(db, learnerQuestionId);
    await setCurrentVersion(db, learnerQuestionId, learnerVersionId);
    await seedDueProgress(db, userId, learnerQuestionId);

    const ownerCourseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId: ownerCourseId, role: "OWNER" });
    const ownerQuestionId = await insertQuestion(db, ownerCourseId);
    const ownerVersionId = await insertQuestionVersion(db, ownerQuestionId);
    await setCurrentVersion(db, ownerQuestionId, ownerVersionId);
    await seedDueProgress(db, userId, ownerQuestionId);

    const instructorCourseId = await insertCourse(db, userId);
    await insertCourseMembership(db, {
      userId,
      courseId: instructorCourseId,
      role: "INSTRUCTOR",
    });
    const instructorQuestionId = await insertQuestion(db, instructorCourseId);
    const instructorVersionId = await insertQuestionVersion(db, instructorQuestionId);
    await setCurrentVersion(db, instructorQuestionId, instructorVersionId);
    await seedDueProgress(db, userId, instructorQuestionId);

    const ports = makePorts();
    const result = await getOrCreateDailyPlanForToday(
      { userId, now: new Date("2026-01-10T10:00:00Z") },
      makeSettings(),
      ports,
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    expect(result.plan.items).toHaveLength(1);
    expect(result.plan.items[0].questionId).toBe(learnerQuestionId);
    expect(result.plan.items[0].courseId).toBe(learnerCourseId);
  });

  it("E. DailyPlan generation writes only daily_plans/daily_plan_items — no Attempt row is created as a side effect", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "UTC");
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);
    await seedDueProgress(db, userId, questionId);

    const ports = makePorts();
    const result = await getOrCreateDailyPlanForToday(
      { userId, now: new Date("2026-01-10T10:00:00Z") },
      makeSettings(),
      ports,
    );
    expect(result.outcome).toBe("READY");

    const attemptCount = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where user_id = $1",
      [userId],
    );
    expect(Number(attemptCount.rows[0].count)).toBe(0);
  });

  it("J. excludes a Course whose OWN status is ARCHIVED, even though the real CourseMembership row is neither revoked nor archived (Run 008 S4) — real Postgres, both ranked-progress and unseen candidates", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "UTC");

    const archivedCourseId = await insertCourse(db, userId, { status: "ARCHIVED" });
    await insertCourseMembership(db, { userId, courseId: archivedCourseId, role: "LEARNER" });
    const archivedProgressQuestionId = await insertQuestion(db, archivedCourseId);
    const archivedProgressVersionId = await insertQuestionVersion(db, archivedProgressQuestionId);
    await setCurrentVersion(db, archivedProgressQuestionId, archivedProgressVersionId);
    await seedDueProgress(db, userId, archivedProgressQuestionId);
    // A second, unseen (no progress row) Question in the same archived
    // Course. Note: since this Course also has a due ranked candidate
    // above, the ranked path wins and this assertion alone does not
    // isolate the unseen/new-material fallback branch specifically — see
    // test K below for that isolated proof (S4 review rigor note).
    const archivedUnseenQuestionId = await insertQuestion(db, archivedCourseId);
    const archivedUnseenVersionId = await insertQuestionVersion(db, archivedUnseenQuestionId);
    await setCurrentVersion(db, archivedUnseenQuestionId, archivedUnseenVersionId);

    const activeCourseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId: activeCourseId, role: "LEARNER" });
    const activeQuestionId = await insertQuestion(db, activeCourseId);
    const activeVersionId = await insertQuestionVersion(db, activeQuestionId);
    await setCurrentVersion(db, activeQuestionId, activeVersionId);
    await seedDueProgress(db, userId, activeQuestionId);

    const ports = makePorts();
    const result = await getOrCreateDailyPlanForToday(
      { userId, now: new Date("2026-01-10T10:00:00Z") },
      makeSettings(),
      ports,
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    const questionIds = result.plan.items.map((item) => item.questionId);
    expect(questionIds).not.toContain(archivedProgressQuestionId);
    expect(questionIds).not.toContain(archivedUnseenQuestionId);
    expect(questionIds).toContain(activeQuestionId);
  });

  it("K. excludes an ARCHIVED Course's unseen/new-material candidate specifically via the fallback path — zero ranked/progress candidates anywhere, real Postgres, isolating the fallback branch (Run 008 S4, addresses review rigor note on test J)", async () => {
    const userId = await insertUser(db);
    await setUserTimezone(db, userId, "UTC");

    const archivedCourseId = await insertCourse(db, userId, { status: "ARCHIVED" });
    await insertCourseMembership(db, { userId, courseId: archivedCourseId, role: "LEARNER" });
    const archivedUnseenOnlyId = await insertQuestion(db, archivedCourseId);
    const archivedUnseenOnlyVersionId = await insertQuestionVersion(db, archivedUnseenOnlyId);
    await setCurrentVersion(db, archivedUnseenOnlyId, archivedUnseenOnlyVersionId);
    // No `seedDueProgress` call for either Course in this test — zero
    // ranked candidates exist anywhere, so the unseen/new-material fallback
    // (ADR-017) is the only path that could place an item.

    const activeCourseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId: activeCourseId, role: "LEARNER" });
    const activeUnseenOnlyId = await insertQuestion(db, activeCourseId);
    const activeUnseenOnlyVersionId = await insertQuestionVersion(db, activeUnseenOnlyId);
    await setCurrentVersion(db, activeUnseenOnlyId, activeUnseenOnlyVersionId);

    const ports = makePorts();
    const result = await getOrCreateDailyPlanForToday(
      { userId, now: new Date("2026-01-10T10:00:00Z") },
      makeSettings(),
      ports,
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    const questionIds = result.plan.items.map((item) => item.questionId);
    expect(questionIds).not.toContain(archivedUnseenOnlyId);
    expect(questionIds).toContain(activeUnseenOnlyId);
  });

  describe("New-material fallback against real Postgres (ADR-017, Night-Run Slice 5)", () => {
    it("F. fresh learner regression: active LEARNER membership, zero Attempts, zero UserQuestionProgress, real eligible Questions — Today is non-empty with real NEW_LEARNING/NEW_MATERIAL rows", async () => {
      const userId = await insertUser(db);
      await setUserTimezone(db, userId, "UTC");
      const courseId = await insertCourse(db, userId);
      await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
      const questionId = await insertQuestion(db, courseId);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
      // Deliberately NO seedDueProgress / no Attempt at all.

      const ports = makePorts();
      const result = await getOrCreateDailyPlanForToday(
        { userId, now: new Date("2026-01-10T10:00:00Z") },
        makeSettings(),
        ports,
      );

      expect(result.outcome).toBe("READY");
      if (result.outcome !== "READY") throw new Error("unreachable");
      expect(result.plan.items).toHaveLength(1);
      expect(result.plan.items[0].questionId).toBe(questionId);
      expect(result.plan.items[0].actionType).toBe("NEW_LEARNING");
      expect(result.plan.items[0].tier).toBe("NEW_MATERIAL");
      expect(result.plan.items[0].reasons).toEqual(["UNSEEN_MATERIAL"]);

      const itemRow = await db.query<{ action_type: string; tier: string; reasons: unknown }>(
        "select action_type, tier, reasons from daily_plan_items where id = $1",
        [result.plan.items[0].id],
      );
      expect(itemRow.rows[0].action_type).toBe("NEW_LEARNING");
      expect(itemRow.rows[0].tier).toBe("NEW_MATERIAL");
      expect(itemRow.rows[0].reasons).toEqual(["UNSEEN_MATERIAL"]);
    });

    it("G. a Question the learner already has a real Attempt for is excluded from the unseen pool, even with no UserQuestionProgress row", async () => {
      const userId = await insertUser(db);
      await setUserTimezone(db, userId, "UTC");
      const courseId = await insertCourse(db, userId);
      await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
      const attemptedQuestionId = await insertQuestion(db, courseId);
      const attemptedVersionId = await insertQuestionVersion(db, attemptedQuestionId);
      await setCurrentVersion(db, attemptedQuestionId, attemptedVersionId);
      const unseenQuestionId = await insertQuestion(db, courseId);
      const unseenVersionId = await insertQuestionVersion(db, unseenQuestionId, 1, {
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
        ],
      });
      await setCurrentVersion(db, unseenQuestionId, unseenVersionId);

      // A real Attempt row, deliberately with NO corresponding
      // UserQuestionProgress row — proves ADR-017 §1's rule is checked
      // against Attempts directly, not inferred from progress-row absence.
      await db.query(
        `insert into attempts (
           id, submission_id, user_id, course_id, question_id, question_version_id,
           answered_at, is_correct, selected_answer, attempt_number_for_presented_item,
           engine_version
         )
         values (gen_random_uuid(), 'sub-1', $1, $2, $3, $4, now(), true, '"A"'::jsonb, 1, 'test-engine-v1')`,
        [userId, courseId, attemptedQuestionId, attemptedVersionId],
      );

      const ports = makePorts();
      const result = await getOrCreateDailyPlanForToday(
        { userId, now: new Date("2026-01-10T10:00:00Z") },
        makeSettings(),
        ports,
      );

      expect(result.outcome).toBe("READY");
      if (result.outcome !== "READY") throw new Error("unreachable");
      expect(result.plan.items).toHaveLength(1);
      expect(result.plan.items[0].questionId).toBe(unseenQuestionId);
    });

    it("H. when a normal (review-due) candidate exists, the unseen fallback never activates even though eligible unseen Questions also exist — no mixing", async () => {
      const userId = await insertUser(db);
      await setUserTimezone(db, userId, "UTC");
      const courseId = await insertCourse(db, userId);
      await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
      const dueQuestionId = await insertQuestion(db, courseId);
      const dueVersionId = await insertQuestionVersion(db, dueQuestionId);
      await setCurrentVersion(db, dueQuestionId, dueVersionId);
      await seedDueProgress(db, userId, dueQuestionId);
      const unseenQuestionId = await insertQuestion(db, courseId);
      const unseenVersionId = await insertQuestionVersion(db, unseenQuestionId);
      await setCurrentVersion(db, unseenQuestionId, unseenVersionId);

      const ports = makePorts();
      const result = await getOrCreateDailyPlanForToday(
        { userId, now: new Date("2026-01-10T10:00:00Z") },
        makeSettings(),
        ports,
      );

      expect(result.outcome).toBe("READY");
      if (result.outcome !== "READY") throw new Error("unreachable");
      expect(result.plan.items).toHaveLength(1);
      expect(result.plan.items[0].questionId).toBe(dueQuestionId);
      expect(result.plan.items[0].actionType).not.toBe("NEW_LEARNING");
    });

    it("I. selecting new-material creates no real UserQuestionProgress row — placement is not evidence", async () => {
      const userId = await insertUser(db);
      await setUserTimezone(db, userId, "UTC");
      const courseId = await insertCourse(db, userId);
      await insertCourseMembership(db, { userId, courseId, role: "LEARNER" });
      const questionId = await insertQuestion(db, courseId);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);

      const ports = makePorts();
      const result = await getOrCreateDailyPlanForToday(
        { userId, now: new Date("2026-01-10T10:00:00Z") },
        makeSettings(),
        ports,
      );
      expect(result.outcome).toBe("READY");

      const progressCount = await db.query<{ count: string }>(
        "select count(*)::int as count from user_question_progress where user_id = $1",
        [userId],
      );
      expect(Number(progressCount.rows[0].count)).toBe(0);
    });
  });
});

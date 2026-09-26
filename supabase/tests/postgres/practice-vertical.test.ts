/**
 * Run UX-02 integration acceptance (PGlite): ONE vertical path through the
 * REAL API handlers (`handleGetPractice`, `handleSubmitPracticeAnswer`) wired
 * to the REAL production settings/ports over a real migrated schema, plus
 * Today's own answer path before/after Practice.
 *
 * Proves what the per-Slice tests do not prove together: the learner-safe wire
 * DTO built from real rows (no grading fields), the HTTP status mapping for
 * real outcomes, that Practice never touches Today's plan or resolves its
 * items, and that Today keeps working (and keeps resolving items normally)
 * after Practice on the same learning day.
 *
 * Not proven here (stated honestly): real Supabase auth/hosting, browser
 * behavior, or true multi-connection concurrency.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { handleGetPractice } from "../../../src/app/api/courses/[courseId]/practice/handle-get-practice";
import { handleSubmitPracticeAnswer } from "../../../src/app/api/courses/[courseId]/practice/answer/handle-submit-practice-answer";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { submitDailyPlanItemAnswer } from "../../../src/application/dailyPlan/submit-daily-plan-item-answer";
import { selectPracticeBatch } from "../../../src/application/practice/select-practice-batch";
import { submitPracticeAnswer } from "../../../src/application/practice/submit-practice-answer";
import { createProductionDailyPlanGenerationSettings } from "../../../src/infrastructure/dailyPlan/composition-root";
import { createProductionSubmitAnswerContext } from "../../../src/infrastructure/learning/composition-root";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PostgresPracticeReadRepository } from "../../../src/infrastructure/postgres/practice-read-repository";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import { PostgresUserQuestionProgressRepository } from "../../../src/infrastructure/postgres/progress-repository";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
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
const NOW = new Date("2026-03-10T10:00:00Z");
const settings = createProductionDailyPlanGenerationSettings();

beforeEach(async () => {
  db = await createTestDb();
});
afterEach(async () => {
  await db.close();
});

function ports() {
  const provider = pgliteConnectionProvider(db);
  const executor = db as never;
  return {
    users: new PostgresUserRepository(executor),
    courseMemberships: new PostgresCourseMembershipRepository(executor),
    courses: new PostgresCourseRepository(executor),
    dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(provider),
    topics: new PostgresTopicRepository(executor),
    practice: new PostgresPracticeReadRepository(executor),
    progress: new PostgresUserQuestionProgressRepository(executor),
    content: new PostgresLearnerQuestionContentRepository(executor),
    uow: new PostgresUnitOfWork(provider),
  };
}

const authed = (userId: string) => async () => ({ outcome: "AUTHENTICATED" as const, userId });

describe("Run UX-02 integrated vertical path (real handlers, real repositories, real engine)", () => {
  it("Practice selects around Today, answers through the normal pipeline, never resolves Today, and Today keeps working", async () => {
    const owner = await insertUser(db);
    const learner = await insertUser(db);
    await db.query("update users set timezone = 'UTC' where id = $1", [learner]);
    const courseId = await insertCourse(db, owner);
    await insertCourseMembership(db, { userId: learner, courseId, role: "LEARNER" });
    const topicId = randomUUID();
    await db.query("insert into topics (id, course_id, name) values ($1, $2, 'נושא')", [topicId, courseId]);

    const seeded: Array<{ questionId: string; versionId: string }> = [];
    for (let i = 0; i < 6; i++) {
      const questionId = await insertQuestion(db, courseId);
      await db.query("update questions set created_at = $2, topic_id = $3 where id = $1", [
        questionId,
        new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
        i < 4 ? topicId : null,
      ]);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
      seeded.push({ questionId, versionId });
    }

    // Today first (ADR-017 new material: the first 3 unseen become pending items).
    const plan = await (async () => {
      const r = await getOrCreateDailyPlanForToday({ userId: learner, now: NOW }, settings, ports());
      if (r.outcome !== "READY") throw new Error(r.outcome);
      return r.plan;
    })();
    expect(plan.items).toHaveLength(3);
    const pending = new Set(plan.items.map((i) => i.questionId));

    const get = (query: { topicIdParam?: string | null; skipParams?: string[] } = {}) =>
      handleGetPractice({
        authenticate: authed(learner),
        courseId,
        topicIdParam: query.topicIdParam ?? null,
        skipParams: query.skipParams ?? [],
        now: NOW,
        select: (command) => selectPracticeBatch(command, settings, ports()),
      });
    const post = (body: unknown) =>
      handleSubmitPracticeAnswer({
        authenticate: authed(learner),
        courseId,
        body,
        now: NOW,
        submit: (command) =>
          submitPracticeAnswer(command, settings, createProductionSubmitAnswerContext(NOW), ports()),
      });

    // 1. Course Practice: only non-pending Questions, learner-safe DTO, hasMore false.
    const first = await get();
    expect(first.status).toBe(200);
    const firstBody = first.body as {
      scope: { kind: string; title: string };
      items: Array<{ questionId: string; questionVersionId: string; answerOptions: unknown[] }>;
      hasMore: boolean;
    };
    expect(firstBody.scope).toEqual({ kind: "COURSE", title: "Test Course" });
    expect(firstBody.items.map((i) => i.questionId).sort()).toEqual(
      seeded.map((s) => s.questionId).filter((id) => !pending.has(id)).sort(),
    );
    expect(firstBody.hasMore).toBe(false);
    const wire = JSON.stringify(first.body);
    expect(wire).not.toMatch(/correct|explanation|answer_definition/i);
    expect(Object.keys(firstBody.items[0]).sort()).toEqual(
      ["answerOptions", "prompt", "questionId", "questionType", "questionVersionId"].sort(),
    );

    // 2. Topic Practice scope honored through the HTTP layer (Topic-less excluded).
    const topicBatch = await get({ topicIdParam: topicId });
    expect(topicBatch.status).toBe(200);
    const topicIds = (topicBatch.body as { items: Array<{ questionId: string }> }).items.map((i) => i.questionId);
    const inTopic = seeded.slice(0, 4).map((s) => s.questionId).filter((id) => !pending.has(id));
    expect(topicIds.sort()).toEqual(inTopic.sort());
    expect((topicBatch.body as { scope: { kind: string } }).scope.kind).toBe("TOPIC");

    // 3. Answering a Question that is pending in Today -> 409, no Attempt.
    const pendingQ = seeded.find((s) => pending.has(s.questionId))!;
    const blocked = await post({ questionId: pendingQ.questionId, questionVersionId: pendingQ.versionId, submissionId: "s-blocked", selectedAnswer: "A" });
    expect(blocked).toEqual({ status: 409, body: { error: { code: "PENDING_IN_TODAY" } } });

    // 4. Practice answers (Course scope + Topic scope) -> 200 {isCorrect} only.
    const practiceQ = seeded.find((s) => !pending.has(s.questionId))!;
    const ok = await post({ questionId: practiceQ.questionId, questionVersionId: practiceQ.versionId, submissionId: "s-1", selectedAnswer: "A" });
    expect(ok).toEqual({ status: 200, body: { isCorrect: true } });
    const wrong = seeded.filter((s) => !pending.has(s.questionId))[1];
    const wrongRes = await post({ questionId: wrong.questionId, questionVersionId: wrong.versionId, submissionId: "s-2", selectedAnswer: "B", topicId: wrong === seeded[4] || wrong === seeded[5] ? undefined : topicId });
    expect(wrongRes).toEqual({ status: 200, body: { isCorrect: false } });

    // 5. Attempts are normal, immutable, server-session-stamped, and not Today-attached.
    const attempts = await db.query<Record<string, unknown>>(
      "select question_id, learning_session_id, daily_plan_id, daily_plan_item_id, engine_version from attempts where user_id = $1",
      [learner],
    );
    expect(attempts.rows).toHaveLength(2);
    for (const row of attempts.rows) {
      expect(row.learning_session_id).toBe(plan.id);
      expect(row.daily_plan_id).toBeNull();
      expect(row.daily_plan_item_id).toBeNull();
      expect(row.engine_version).toBe("learning-engine-v2");
    }

    // 6. Practice never touched Today: same plan, same items, all still pending.
    const again = await getOrCreateDailyPlanForToday({ userId: learner, now: NOW }, settings, ports());
    if (again.outcome !== "READY") throw new Error(again.outcome);
    expect(again.plan.id).toBe(plan.id);
    expect(again.plan.items.map((i) => [i.id, i.questionId, i.status])).toEqual(
      plan.items.map((i) => [i.id, i.questionId, i.status]),
    );
    expect(again.plan.items.every((i) => i.status === "pending")).toBe(true);

    // 7. "Another 10": answered Questions are gone; nothing repeats.
    const next = await get();
    const nextIds = (next.body as { items: Array<{ questionId: string }> }).items.map((i) => i.questionId);
    expect(nextIds).not.toContain(practiceQ.questionId);
    expect(nextIds).not.toContain(wrong.questionId);
    expect(nextIds).toHaveLength(firstBody.items.length - 2);

    // 8. Today still works on the same day: answering a pending item resolves it
    //    through the Today path, with the same learning-day session as Practice.
    const todayItem = plan.items[0];
    const todayResult = await submitDailyPlanItemAnswer(
      {
        userId: learner,
        dailyPlanItemId: todayItem.id,
        submissionId: randomUUID(),
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: 5,
        assistanceUsed: "NONE",
        answerWasRevealedBeforeResponse: false,
        answeredAt: NOW,
      },
      {
        items: new PostgresDailyPlanRepository(db as never),
        memberships: ports().courseMemberships,
        context: createProductionSubmitAnswerContext(NOW),
        uow: ports().uow,
      },
    );
    expect(todayResult.kind).toBe("ACCEPTED");
    const afterToday = await getOrCreateDailyPlanForToday({ userId: learner, now: NOW }, settings, ports());
    if (afterToday.outcome !== "READY") throw new Error(afterToday.outcome);
    expect(afterToday.plan.items.filter((i) => i.status === "completed").map((i) => i.id)).toEqual([todayItem.id]);
    const todayAttempt = await db.query<Record<string, unknown>>(
      "select learning_session_id, daily_plan_item_id from attempts where user_id = $1 and question_id = $2",
      [learner, todayItem.questionId],
    );
    expect(todayAttempt.rows[0].learning_session_id).toBe(plan.id);
    expect(todayAttempt.rows[0].daily_plan_item_id).toBe(todayItem.id);

    // 9. Once Today's item is answered it is excluded from Practice as answered-this-day.
    const afterIds = ((await get()).body as { items: Array<{ questionId: string }> }).items.map((i) => i.questionId);
    expect(afterIds).not.toContain(todayItem.questionId);

    // 10. HTTP-level fail-closed: revoked membership -> 403 for both endpoints.
    await db.query("update course_memberships set revoked_at = now() where user_id = $1", [learner]);
    expect(await get()).toEqual({ status: 403, body: { error: { code: "PRACTICE_NOT_AVAILABLE" } } });
    expect((await post({ questionId: practiceQ.questionId, questionVersionId: practiceQ.versionId, submissionId: "s-3", selectedAnswer: "A" })).status).toBe(403);
  });
});

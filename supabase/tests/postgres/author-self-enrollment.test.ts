/**
 * RUN010-H.3 (FUB-036, Option 4 architecture) — real-Postgres (PGlite)
 * integration proof for the approved author self-enrollment exception
 * (human decision 1, APPROVED 2026-09-29) and the corrected "authoring
 * capability carries zero mastery/evidence signal" principle: an active
 * Course Author who self-enrolls as an ordinary LEARNER (the narrow
 * `joinCourse` bypass) gets NO special treatment anywhere downstream — the
 * same real Practice/Attempts/Insights code paths as any other learner, with
 * zero new exclusion logic added anywhere.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCourse } from "../../../src/application/course/create-course";
import { joinCourse } from "../../../src/application/course/join-course";
import { publishCourse } from "../../../src/application/course/publish-course";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import type { SelectPracticeBatchPorts } from "../../../src/application/practice/select-practice-batch";
import { selectPracticeBatch } from "../../../src/application/practice/select-practice-batch";
import { submitPracticeAnswer } from "../../../src/application/practice/submit-practice-answer";
import { createProductionDailyPlanGenerationSettings } from "../../../src/infrastructure/dailyPlan/composition-root";
import { createProductionSubmitAnswerContext } from "../../../src/infrastructure/learning/composition-root";
import { PostgresCourseAuthorRepository } from "../../../src/infrastructure/postgres/course-author-repository";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import { PostgresItemAnalysisRepository } from "../../../src/infrastructure/postgres/item-analysis-repository";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PostgresPracticeReadRepository } from "../../../src/infrastructure/postgres/practice-read-repository";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import { PostgresUserQuestionProgressRepository } from "../../../src/infrastructure/postgres/progress-repository";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import {
  createTestDb,
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

function makeCourseRepos() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
    authors: new PostgresCourseAuthorRepository(db),
  };
}

function makePracticePorts(): SelectPracticeBatchPorts & { uow: PostgresUnitOfWork } {
  const provider = pgliteConnectionProvider(db);
  return {
    users: new PostgresUserRepository(db),
    courseMemberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
    dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(provider),
    topics: new PostgresTopicRepository(db),
    practice: new PostgresPracticeReadRepository(db),
    progress: new PostgresUserQuestionProgressRepository(db),
    content: new PostgresLearnerQuestionContentRepository(db),
    uow: new PostgresUnitOfWork(provider),
  };
}

describe("author self-enrollment — no special treatment downstream (RUN010-H.3)", () => {
  it("a dual-role Author-Learner self-enrolls on their own DRAFT Course, practices, and is counted in Insights exactly like any other learner", async () => {
    const authorId = await insertUser(db);
    // Practice eligibility requires a set timezone (DailyPlan local day) —
    // unrelated to this Slice's own concern, just required test setup.
    await db.query("update users set timezone = 'UTC' where id = $1", [authorId]);
    const courseRepos = makeCourseRepos();
    const uow = new PostgresCourseUnitOfWork(pgliteConnectionProvider(db));

    const created = await createCourse(
      { actorUserId: authorId, title: "Author-Learner Course", examDate: null },
      uow,
    );
    if (created.outcome !== "CREATED") throw new Error("unreachable");
    const courseId = created.course.id;
    expect(created.course.status).toBe("DRAFT");

    // Self-enroll while still DRAFT, via the RUN010-H.3 bypass.
    const join = await joinCourse({ actorUserId: authorId, courseId }, courseRepos);
    expect(join.outcome).toBe("JOINED");
    if (join.outcome !== "JOINED") throw new Error("unreachable");
    expect(join.membership.role).toBe("LEARNER");
    expect(join.membership.revokedAt).toBeNull();
    expect(join.membership.archivedAt).toBeNull();

    // The persisted row is ordinary — no field anywhere marks it as
    // "author-created"; it is indistinguishable in shape from any other
    // learner's row.
    const row = await db.query<{ role: string; revoked_at: string | null; archived_at: string | null }>(
      "select role, revoked_at, archived_at from course_memberships where user_id = $1 and course_id = $2",
      [authorId, courseId],
    );
    expect(row.rows).toEqual([{ role: "LEARNER", revoked_at: null, archived_at: null }]);

    // An ordinary later author action: publish the Course (no special-casing
    // for a dual-role user — the same step any other Course's author takes).
    const publishResult = await publishCourse(
      { actorUserId: authorId, courseId },
      courseRepos,
    );
    expect(publishResult.outcome).toBe("PUBLISHED");

    const NOW = new Date("2026-04-01T10:00:00Z");
    const settings = createProductionDailyPlanGenerationSettings();
    const practicePorts = makePracticePorts();

    // Generate today's (empty) DailyPlan BEFORE the Question exists — same
    // "todayPlan() before addQuestion()" convention `practice.test.ts` uses
    // so the plan freezes for the day with zero items and this Question is
    // never claimed by Today, leaving it available to Practice.
    const planResult = await getOrCreateDailyPlanForToday(
      { userId: authorId, now: NOW },
      settings,
      practicePorts,
    );
    if (planResult.outcome !== "READY") throw new Error("expected READY");

    // Ordinary Question content, same as any other Course.
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);

    // Today/Practice treat this user exactly like any LEARNER — eligibility
    // is derived purely from the ordinary course_memberships row above;
    // nothing here ever reads course_authors.
    const batch = await selectPracticeBatch(
      { userId: authorId, courseId, topicId: null, skippedQuestionIds: [], now: NOW },
      settings,
      practicePorts,
    );
    expect(batch.outcome).toBe("READY");
    if (batch.outcome !== "READY") throw new Error("unreachable");
    expect(batch.items.map((item) => item.questionId)).toContain(questionId);

    const answerResult = await submitPracticeAnswer(
      {
        userId: authorId,
        courseId,
        topicId: null,
        questionId,
        questionVersionId: versionId,
        submissionId: `sub-${randomUUID()}`,
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: 5,
        now: NOW,
      },
      settings,
      createProductionSubmitAnswerContext(NOW),
      practicePorts,
    );
    expect(answerResult.kind).toBe("ACCEPTED");

    // A real Attempt now exists for this user, exactly like any learner's.
    const attemptRows = await db.query(
      "select id from attempts where user_id = $1 and question_id = $2",
      [authorId, questionId],
    );
    expect(attemptRows.rows).toHaveLength(1);

    // Counted normally by instructor-facing Insights — the corrected
    // principle: authoring capability carries zero mastery/evidence signal,
    // so a dual-role Author-Learner's Attempt counts exactly like any other
    // learner's. No exclusion of any kind is added by this Slice.
    const itemAnalysis = new PostgresItemAnalysisRepository(db);
    expect(await itemAnalysis.countActiveLearners(courseId)).toBe(1);
    const stats = await itemAnalysis.listCurrentVersionItemStats(courseId);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ questionId, distinctResponderCount: 1 });
  });
});

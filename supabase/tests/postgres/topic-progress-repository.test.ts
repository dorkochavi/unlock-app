/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresLearnerTopicProgressRepository` and the `getCourseTopicProgress`
 * use case wired to real repositories (Run 009 S1). Proves query semantics:
 * CURRENT-derived Topic (D6), ADR-017 attempted semantics (a real Attempt,
 * not a progress row), published-Questions-only denominator, own-state
 * isolation, null/archived Topic handling, and membership authorization.
 *
 * PGlite does not prove multi-connection concurrency or real-hosted
 * performance; this suite proves query semantics only.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { getCourseTopicProgress } from "../../../src/application/progress/get-course-topic-progress";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
import { PostgresLearnerTopicProgressRepository } from "../../../src/infrastructure/postgres/topic-progress-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;
let repo: PostgresLearnerTopicProgressRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresLearnerTopicProgressRepository(db);
});

afterEach(async () => {
  await db.close();
});

const exec = () => db as unknown as SqlExecutor;

let tick = 0;

async function insertTopic(
  courseId: string,
  name: string,
  opts: { archived?: boolean } = {},
): Promise<string> {
  tick += 1;
  const id = randomUUID();
  await db.query(
    `insert into topics (id, course_id, name, archived_at, created_at)
     values ($1, $2, $3, $4, $5)`,
    [
      id,
      courseId,
      name,
      opts.archived ? new Date("2026-09-10T00:00:00Z") : null,
      new Date(Date.UTC(2026, 8, 1, 0, 0, tick)),
    ],
  );
  return id;
}

/** A published Question (has a current QuestionVersion) in the Topic. */
async function publishedQuestion(courseId: string, topicId: string | null) {
  tick += 1;
  const questionId = await insertQuestion(exec(), courseId);
  await db.query("update questions set topic_id = $1, created_at = $2 where id = $3", [
    topicId,
    new Date(Date.UTC(2026, 8, 2, 0, 0, tick)),
    questionId,
  ]);
  const versionId = await insertQuestionVersion(exec(), questionId, 1);
  await setCurrentVersion(exec(), questionId, versionId);
  return { questionId, versionId };
}

async function attempt(args: {
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
}) {
  tick += 1;
  await db.query(
    `insert into attempts
       (submission_id, user_id, course_id, question_id, question_version_id, answered_at,
        is_correct, selected_answer, attempt_number_for_presented_item, engine_version, created_at)
     values ($1, $2, $3, $4, $5, $6, true, $7, 1, 'test-engine-v1', $8)`,
    [
      `sub-${randomUUID()}`,
      args.userId,
      args.courseId,
      args.questionId,
      args.questionVersionId,
      new Date("2026-09-24T08:00:00Z"),
      JSON.stringify("A"),
      new Date(Date.UTC(2026, 8, 24, 9, 0, tick)),
    ],
  );
}

async function progressRow(
  userId: string,
  questionId: string,
  fields: {
    masteryCategory?: string;
    misconceptionState?: string;
    lastLapseAt?: Date | null;
    retrievalBaselineAt?: Date | null;
  } = {},
) {
  await db.query(
    `insert into user_question_progress
       (user_id, question_id, mastery_category, misconception_state,
        last_lapse_at, retrieval_baseline_at, engine_version)
     values ($1, $2, $3, $4, $5, $6, 'test-engine-v1')`,
    [
      userId,
      questionId,
      fields.masteryCategory ?? "not_started",
      fields.misconceptionState ?? "none",
      fields.lastLapseAt ?? null,
      fields.retrievalBaselineAt ?? null,
    ],
  );
}

async function courseWithLearner() {
  const owner = await insertUser(exec());
  const courseId = await insertCourse(exec(), owner);
  await insertCourseMembership(exec(), { userId: owner, courseId, role: "OWNER" });
  const learnerId = await insertUser(exec());
  await insertCourseMembership(exec(), { userId: learnerId, courseId, role: "LEARNER" });
  return { owner, courseId, learnerId };
}

describe("PostgresLearnerTopicProgressRepository.listCourseQuestionsForLearner", () => {
  it("returns published Questions only, ordered by Topic then Question creation", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const t1 = await insertTopic(courseId, "First");
    const t2 = await insertTopic(courseId, "Second");
    const q2a = await publishedQuestion(courseId, t2);
    const q1a = await publishedQuestion(courseId, t1);
    const q1b = await publishedQuestion(courseId, t1);
    // Draft-only Question (no current version) is not part of the denominator.
    const draft = await insertQuestion(exec(), courseId);
    await db.query("update questions set topic_id = $1 where id = $2", [t1, draft]);

    const rows = await repo.listCourseQuestionsForLearner(learnerId, courseId);

    expect(rows.map((r) => r.questionId)).toEqual([q1a, q1b, q2a].map((q) => q.questionId));
    expect(rows.map((r) => r.topicName)).toEqual(["First", "First", "Second"]);
  });

  it("attempted follows real Attempts (any version), not progress rows; own state only", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const other = await insertUser(exec());
    await insertCourseMembership(exec(), { userId: other, courseId, role: "LEARNER" });
    const topic = await insertTopic(courseId, "T");
    const attempted = await publishedQuestion(courseId, topic);
    const rowOnly = await publishedQuestion(courseId, topic);
    const otherOnly = await publishedQuestion(courseId, topic);
    const olderVersion = await publishedQuestion(courseId, topic);

    await attempt({ userId: learnerId, courseId, ...toAttemptArgs(attempted) });
    await progressRow(learnerId, attempted.questionId, { masteryCategory: "mastered" });
    // ADR-017: a progress row alone (no real Attempt) is not "attempted".
    await progressRow(learnerId, rowOnly.questionId, { masteryCategory: "mastered" });
    // Another learner's Attempt/progress never leaks into this learner's state.
    await attempt({ userId: other, courseId, ...toAttemptArgs(otherOnly) });
    await progressRow(other, otherOnly.questionId, { misconceptionState: "active" });
    // An Attempt on an older QuestionVersion still counts as a real Attempt.
    const v2 = await insertQuestionVersion(exec(), olderVersion.questionId, 2);
    await attempt({ userId: learnerId, courseId, questionId: olderVersion.questionId, questionVersionId: olderVersion.versionId });
    await setCurrentVersion(exec(), olderVersion.questionId, v2);

    const rows = await repo.listCourseQuestionsForLearner(learnerId, courseId);
    const byId = new Map(rows.map((r) => [r.questionId, r]));

    expect(byId.get(attempted.questionId)?.learnerState).toEqual({
      attempted: true,
      progress: {
        masteryCategory: "mastered",
        misconceptionState: "none",
        lastLapseAt: null,
        retrievalBaselineAt: null,
      },
    });
    expect(byId.get(rowOnly.questionId)?.learnerState.attempted).toBe(false);
    expect(byId.get(rowOnly.questionId)?.learnerState.progress).not.toBeNull();
    expect(byId.get(otherOnly.questionId)?.learnerState).toEqual({ attempted: false, progress: null });
    expect(byId.get(olderVersion.questionId)?.learnerState.attempted).toBe(true);
  });

  it("maps reinforcement signals (active misconception, lapse timestamps)", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const topic = await insertTopic(courseId, "T");
    const q = await publishedQuestion(courseId, topic);
    const lapse = new Date("2026-09-20T00:00:00Z");
    const baseline = new Date("2026-09-10T00:00:00Z");
    await attempt({ userId: learnerId, courseId, ...toAttemptArgs(q) });
    await progressRow(learnerId, q.questionId, {
      masteryCategory: "learning",
      misconceptionState: "active",
      lastLapseAt: lapse,
      retrievalBaselineAt: baseline,
    });

    const [row] = await repo.listCourseQuestionsForLearner(learnerId, courseId);

    expect(row.learnerState.progress).toEqual({
      masteryCategory: "learning",
      misconceptionState: "active",
      lastLapseAt: lapse,
      retrievalBaselineAt: baseline,
    });
  });

  it("Topic is CURRENT-derived: reassigning a Question's Topic moves its history with it (D6)", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const oldTopic = await insertTopic(courseId, "Old");
    const newTopic = await insertTopic(courseId, "New");
    const q = await publishedQuestion(courseId, oldTopic);
    await attempt({ userId: learnerId, courseId, ...toAttemptArgs(q) });

    const before = await repo.listCourseQuestionsForLearner(learnerId, courseId);
    expect(before[0]).toMatchObject({ topicName: "Old", learnerState: { attempted: true } });

    await db.query("update questions set topic_id = $1 where id = $2", [newTopic, q.questionId]);

    const after = await repo.listCourseQuestionsForLearner(learnerId, courseId);
    expect(after[0]).toMatchObject({
      topicId: newTopic,
      topicName: "New",
      learnerState: { attempted: true },
    });
  });

  it("null-Topic Question surfaces with null Topic fields; archived Topic is flagged", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const archived = await insertTopic(courseId, "Retired", { archived: true });
    const live = await insertTopic(courseId, "Live");
    await publishedQuestion(courseId, null);
    await publishedQuestion(courseId, archived);
    await publishedQuestion(courseId, live);

    const rows = await repo.listCourseQuestionsForLearner(learnerId, courseId);
    const named = new Map(rows.map((r) => [r.topicName, r]));

    expect(named.get(null)).toMatchObject({ topicId: null, topicArchived: false });
    expect(named.get("Retired")?.topicArchived).toBe(true);
    expect(named.get("Live")?.topicArchived).toBe(false);
  });

  it("does not read other Courses' Questions", async () => {
    const { courseId, learnerId, owner } = await courseWithLearner();
    const otherCourse = await insertCourse(exec(), owner);
    const otherTopic = await insertTopic(otherCourse, "Elsewhere");
    await publishedQuestion(otherCourse, otherTopic);

    expect(await repo.listCourseQuestionsForLearner(learnerId, courseId)).toEqual([]);
  });
});

describe("getCourseTopicProgress with real repositories", () => {
  const run = (actorUserId: string, courseId: string) =>
    getCourseTopicProgress(
      { actorUserId, courseId },
      {
        memberships: new PostgresCourseMembershipRepository(db),
        courses: new PostgresCourseRepository(db),
        topicProgress: repo,
      },
    );

  it("derives states end to end for an active LEARNER (archived + null Topics hidden)", async () => {
    const { courseId, learnerId } = await courseWithLearner();
    const solid = await insertTopic(courseId, "Solid topic");
    const fresh = await insertTopic(courseId, "Fresh topic");
    const archived = await insertTopic(courseId, "Retired", { archived: true });
    const s1 = await publishedQuestion(courseId, solid);
    await publishedQuestion(courseId, fresh);
    await publishedQuestion(courseId, archived);
    await publishedQuestion(courseId, null);
    await attempt({ userId: learnerId, courseId, ...toAttemptArgs(s1) });
    await progressRow(learnerId, s1.questionId, { masteryCategory: "mastered" });

    expect(await run(learnerId, courseId)).toEqual({
      outcome: "READY",
      topics: [
        { topicId: solid, name: "Solid topic", state: "SOLID", attemptedCount: 1, totalCount: 1 },
        { topicId: fresh, name: "Fresh topic", state: "NOT_STARTED", attemptedCount: 0, totalCount: 1 },
      ],
    });
  });

  it("denies non-member, revoked LEARNER, OWNER and INSTRUCTOR", async () => {
    const { owner, courseId } = await courseWithLearner();
    const stranger = await insertUser(exec());
    const revoked = await insertUser(exec());
    await insertCourseMembership(exec(), {
      userId: revoked,
      courseId,
      role: "LEARNER",
      revokedAt: new Date("2026-09-11T00:00:00Z"),
    });
    const instructor = await insertUser(exec());
    await insertCourseMembership(exec(), { userId: instructor, courseId, role: "INSTRUCTOR" });

    for (const actor of [stranger, revoked, owner, instructor]) {
      expect(await run(actor, courseId)).toEqual({ outcome: "NOT_AUTHORIZED" });
    }
  });

  it("allows an archived non-revoked LEARNER to read their own Progress (ADR-015 §7/§8)", async () => {
    const { courseId } = await courseWithLearner();
    const archivedLearner = await insertUser(exec());
    await insertCourseMembership(exec(), {
      userId: archivedLearner,
      courseId,
      role: "LEARNER",
      archivedAt: new Date("2026-09-11T00:00:00Z"),
    });
    const topic = await insertTopic(courseId, "T");
    const q = await publishedQuestion(courseId, topic);
    await attempt({ userId: archivedLearner, courseId, ...toAttemptArgs(q) });

    expect(await run(archivedLearner, courseId)).toEqual({
      outcome: "READY",
      topics: [{ topicId: topic, name: "T", state: "IN_PROGRESS", attemptedCount: 1, totalCount: 1 }],
    });
  });

  it("non-PUBLISHED Course -> COURSE_NOT_ACTIVE", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner, { status: "ARCHIVED" });
    const learnerId = await insertUser(exec());
    await insertCourseMembership(exec(), { userId: learnerId, courseId, role: "LEARNER" });

    expect(await run(learnerId, courseId)).toEqual({ outcome: "COURSE_NOT_ACTIVE" });
  });
});

function toAttemptArgs(q: { questionId: string; versionId: string }) {
  return { questionId: q.questionId, questionVersionId: q.versionId };
}

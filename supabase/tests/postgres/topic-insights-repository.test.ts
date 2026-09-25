/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresItemAnalysisRepository.listTopicFirstAttemptStats` (Run 009 S3).
 * Proves the pooled Topic evidence rules against a real engine: FIRST
 * persisted Attempt per (Question, active LEARNER) on the CURRENT
 * QuestionVersion, pooled across the Topic's published Questions; Topic is
 * CURRENT-derived (`questions.topic_id`); null-Topic and archived-Topic
 * buckets; active-LEARNER population only.
 *
 * PGlite does not prove multi-connection concurrency or real-hosted
 * performance; this suite proves query semantics only.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresItemAnalysisRepository } from "../../../src/infrastructure/postgres/item-analysis-repository";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
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
let repo: PostgresItemAnalysisRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresItemAnalysisRepository(db);
});

afterEach(async () => {
  await db.close();
});

const exec = () => db as unknown as SqlExecutor;

let tick = 0;

async function learner(
  courseId: string,
  overrides: { revokedAt?: Date | null; archivedAt?: Date | null } = {},
) {
  const userId = await insertUser(exec());
  await insertCourseMembership(exec(), { userId, courseId, role: "LEARNER", ...overrides });
  return userId;
}

async function attempt(args: {
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  isCorrect: boolean;
}) {
  tick += 1;
  await db.query(
    `insert into attempts
       (submission_id, user_id, course_id, question_id, question_version_id, answered_at,
        is_correct, selected_answer, attempt_number_for_presented_item, engine_version, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, 1, 'test-engine-v1', $9)`,
    [
      `sub-${randomUUID()}`,
      args.userId,
      args.courseId,
      args.questionId,
      args.questionVersionId,
      new Date("2026-09-24T08:00:00Z"),
      args.isCorrect,
      JSON.stringify("A"),
      new Date(Date.UTC(2026, 8, 24, 9, 0, tick)),
    ],
  );
}

async function topic(courseId: string, name: string, opts: { archived?: boolean } = {}) {
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

/** A published Question (has a current QuestionVersion) in the Topic (or none). */
async function publishedIn(courseId: string, topicId: string | null) {
  const questionId = await insertQuestion(exec(), courseId);
  const versionId = await insertQuestionVersion(exec(), questionId, 1);
  await setCurrentVersion(exec(), questionId, versionId);
  await db.query("update questions set topic_id = $1 where id = $2", [topicId, questionId]);
  return { questionId, versionId };
}

const on = (courseId: string, q: { questionId: string; versionId: string }) => ({
  courseId,
  questionId: q.questionId,
  questionVersionId: q.versionId,
});

describe("PostgresItemAnalysisRepository.listTopicFirstAttemptStats", () => {
  it("pools first attempts across the Topic Questions; repeat attempts never inflate", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const t = await topic(courseId, "Algebra");
    const q1 = await publishedIn(courseId, t);
    const q2 = await publishedIn(courseId, t);
    const a = await learner(courseId);
    const b = await learner(courseId);

    await attempt({ ...on(courseId, q1), userId: a, isCorrect: false }); // first: wrong
    await attempt({ ...on(courseId, q1), userId: a, isCorrect: true }); // repeat: ignored
    await attempt({ ...on(courseId, q2), userId: a, isCorrect: true });
    await attempt({ ...on(courseId, q1), userId: b, isCorrect: true });

    expect(await repo.listTopicFirstAttemptStats(courseId)).toEqual([
      {
        topicId: t,
        topicName: "Algebra",
        topicArchived: false,
        distinctResponderCount: 2,
        firstAttemptCount: 3,
        correctAttemptCount: 2,
      },
    ]);
  });

  it("is current-version only: old-version attempts are excluded after a re-publish", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const t = await topic(courseId, "T");
    const q = await publishedIn(courseId, t);
    const a = await learner(courseId);
    await attempt({ ...on(courseId, q), userId: a, isCorrect: true });
    const v2 = await insertQuestionVersion(exec(), q.questionId, 2);
    await setCurrentVersion(exec(), q.questionId, v2);

    const [row] = await repo.listTopicFirstAttemptStats(courseId);
    expect(row).toMatchObject({
      distinctResponderCount: 0,
      firstAttemptCount: 0,
      correctAttemptCount: 0,
    });
  });

  it("counts only active LEARNERs: revoked, archived, instructor and owner are excluded", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    await insertCourseMembership(exec(), { userId: owner, courseId, role: "OWNER" });
    const t = await topic(courseId, "T");
    const q = await publishedIn(courseId, t);
    const active = await learner(courseId);
    const revoked = await learner(courseId, { revokedAt: new Date("2026-02-01T00:00:00Z") });
    const archived = await learner(courseId, { archivedAt: new Date("2026-02-01T00:00:00Z") });
    const instructor = await insertUser(exec());
    await insertCourseMembership(exec(), { userId: instructor, courseId, role: "INSTRUCTOR" });

    await attempt({ ...on(courseId, q), userId: active, isCorrect: true });
    await attempt({ ...on(courseId, q), userId: revoked, isCorrect: false });
    await attempt({ ...on(courseId, q), userId: archived, isCorrect: false });
    await attempt({ ...on(courseId, q), userId: instructor, isCorrect: false });
    await attempt({ ...on(courseId, q), userId: owner, isCorrect: false });

    const [row] = await repo.listTopicFirstAttemptStats(courseId);
    expect(row).toMatchObject({
      distinctResponderCount: 1,
      firstAttemptCount: 1,
      correctAttemptCount: 1,
    });
  });

  it("Topic is CURRENT-derived: reassigning a Question moves its history to the new Topic (D6)", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const oldTopic = await topic(courseId, "Old");
    const newTopic = await topic(courseId, "New");
    const q = await publishedIn(courseId, oldTopic);
    const a = await learner(courseId);
    await attempt({ ...on(courseId, q), userId: a, isCorrect: true });

    const before = await repo.listTopicFirstAttemptStats(courseId);
    expect(before.find((r) => r.topicId === oldTopic)?.firstAttemptCount).toBe(1);

    await db.query("update questions set topic_id = $1 where id = $2", [newTopic, q.questionId]);

    const after = await repo.listTopicFirstAttemptStats(courseId);
    // The old Topic no longer has any published Question, so it is omitted entirely.
    expect(after.find((r) => r.topicId === oldTopic)).toBeUndefined();
    expect(after.find((r) => r.topicId === newTopic)).toMatchObject({
      firstAttemptCount: 1,
      correctAttemptCount: 1,
    });
  });

  it("null-Topic Questions form one null bucket (last); an archived Topic is its own flagged bucket", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const live = await topic(courseId, "Live");
    const retired = await topic(courseId, "Retired", { archived: true });
    const qLive = await publishedIn(courseId, live);
    const qRetired = await publishedIn(courseId, retired);
    const qNone1 = await publishedIn(courseId, null);
    const qNone2 = await publishedIn(courseId, null);
    const a = await learner(courseId);
    for (const q of [qLive, qRetired, qNone1, qNone2]) {
      await attempt({ ...on(courseId, q), userId: a, isCorrect: true });
    }

    const rows = await repo.listTopicFirstAttemptStats(courseId);
    expect(rows.map((r) => [r.topicName, r.topicArchived, r.firstAttemptCount])).toEqual([
      ["Live", false, 1],
      ["Retired", true, 1],
      [null, false, 2],
    ]);
    expect(rows[2].topicId).toBeNull();
  });

  it("excludes draft-only Questions, omits Topics with no published Question, keeps zero-evidence Topics", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const withQuestion = await topic(courseId, "HasQuestion");
    await topic(courseId, "Empty");
    await publishedIn(courseId, withQuestion);
    const draft = await insertQuestion(exec(), courseId);
    await db.query("update questions set topic_id = $1 where id = $2", [withQuestion, draft]);

    const rows = await repo.listTopicFirstAttemptStats(courseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      topicName: "HasQuestion",
      distinctResponderCount: 0,
      firstAttemptCount: 0,
    });
  });

  it("is scoped to the requested Course only", async () => {
    const owner = await insertUser(exec());
    const courseA = await insertCourse(exec(), owner);
    const courseB = await insertCourse(exec(), owner);
    const tA = await topic(courseA, "A");
    const tB = await topic(courseB, "B");
    await publishedIn(courseA, tA);
    const qb = await publishedIn(courseB, tB);
    const u = await learner(courseB);
    await attempt({ ...on(courseB, qb), userId: u, isCorrect: true });

    const rowsA = await repo.listTopicFirstAttemptStats(courseA);
    expect(rowsA.map((r) => r.topicName)).toEqual(["A"]);
    expect(rowsA[0].firstAttemptCount).toBe(0);
    expect((await repo.listTopicFirstAttemptStats(courseB))[0].firstAttemptCount).toBe(1);
  });
});

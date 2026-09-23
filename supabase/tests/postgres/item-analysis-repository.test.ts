/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresItemAnalysisRepository` (Pre-Pilot S2). Proves the counting
 * rules against a real engine: current QuestionVersion only, FIRST
 * persisted Attempt per distinct active LEARNER, repeat Attempts never
 * inflate counts, non-learners excluded, draft-only Questions excluded,
 * zero-response Questions present.
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

async function learner(
  courseId: string,
  overrides: { revokedAt?: Date | null; archivedAt?: Date | null } = {},
) {
  const userId = await insertUser(exec());
  await insertCourseMembership(exec(), { userId, courseId, role: "LEARNER", ...overrides });
  return userId;
}

let tick = 0;
async function attempt(args: {
  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;
  isCorrect: boolean;
  /** Later `createdAt` = later persistence. */
  createdAt?: Date;
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
      // Deliberately the SAME client time for all: ordering must come from created_at.
      new Date("2026-09-24T08:00:00Z"),
      args.isCorrect,
      JSON.stringify("A"),
      args.createdAt ?? new Date(Date.UTC(2026, 8, 24, 9, 0, tick)),
    ],
  );
}

async function publishedQuestion(courseId: string, versionNumber = 1) {
  const questionId = await insertQuestion(exec(), courseId);
  const versionId = await insertQuestionVersion(exec(), questionId, versionNumber);
  await setCurrentVersion(exec(), questionId, versionId);
  return { questionId, versionId };
}

describe("PostgresItemAnalysisRepository.countActiveLearners", () => {
  it("counts only non-revoked, non-archived LEARNER memberships of that Course", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const otherCourse = await insertCourse(exec(), owner);
    await insertCourseMembership(exec(), { userId: owner, courseId, role: "OWNER" });
    await learner(courseId);
    await learner(courseId);
    await learner(courseId, { revokedAt: new Date("2026-02-01T00:00:00Z") });
    await learner(courseId, { archivedAt: new Date("2026-02-01T00:00:00Z") });
    await learner(otherCourse);

    expect(await repo.countActiveLearners(courseId)).toBe(2);
  });
});

describe("PostgresItemAnalysisRepository.listCurrentVersionItemStats", () => {
  it("counts the FIRST Attempt per distinct learner; repeat Attempts never inflate", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const { questionId, versionId } = await publishedQuestion(courseId);
    const a = await learner(courseId);
    const b = await learner(courseId);
    const c = await learner(courseId);
    const base = { courseId, questionId, questionVersionId: versionId };

    // a: wrong first, then correct twice -> counts once, as INCORRECT.
    await attempt({ ...base, userId: a, isCorrect: false });
    await attempt({ ...base, userId: a, isCorrect: true });
    await attempt({ ...base, userId: a, isCorrect: true });
    // b: correct first, then wrong -> counts once, as CORRECT.
    await attempt({ ...base, userId: b, isCorrect: true });
    await attempt({ ...base, userId: b, isCorrect: false });
    // c: correct.
    await attempt({ ...base, userId: c, isCorrect: true });

    const rows = await repo.listCurrentVersionItemStats(courseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      questionId,
      questionVersionId: versionId,
      prompt: "Prompt?",
      distinctResponderCount: 3,
      correctCount: 2,
    });
  });

  it("first is decided by server created_at, not by client answered_at or insert order", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const { questionId, versionId } = await publishedQuestion(courseId);
    const a = await learner(courseId);
    const base = { courseId, questionId, questionVersionId: versionId, userId: a };

    // Inserted first but persisted LATER (correct); inserted second but persisted EARLIER (wrong).
    await attempt({ ...base, isCorrect: true, createdAt: new Date("2026-09-24T09:30:00Z") });
    await attempt({ ...base, isCorrect: false, createdAt: new Date("2026-09-24T09:10:00Z") });

    const [row] = await repo.listCurrentVersionItemStats(courseId);
    expect(row).toMatchObject({ distinctResponderCount: 1, correctCount: 0 });
  });

  it("re-publish: old-version Attempts are excluded and the count starts fresh", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const { questionId, versionId: v1 } = await publishedQuestion(courseId);
    const a = await learner(courseId);
    const b = await learner(courseId);
    await attempt({ courseId, questionId, questionVersionId: v1, userId: a, isCorrect: true });
    await attempt({ courseId, questionId, questionVersionId: v1, userId: b, isCorrect: false });

    let [row] = await repo.listCurrentVersionItemStats(courseId);
    expect(row).toMatchObject({ questionVersionId: v1, distinctResponderCount: 2, correctCount: 1 });

    const v2 = await insertQuestionVersion(exec(), questionId, 2);
    await setCurrentVersion(exec(), questionId, v2);

    [row] = await repo.listCurrentVersionItemStats(courseId);
    expect(row).toMatchObject({ questionVersionId: v2, distinctResponderCount: 0, correctCount: 0 });

    // The same learner answering v2 counts there; v1 history is untouched.
    await attempt({ courseId, questionId, questionVersionId: v2, userId: a, isCorrect: false });
    [row] = await repo.listCurrentVersionItemStats(courseId);
    expect(row).toMatchObject({ distinctResponderCount: 1, correctCount: 0 });
    const v1Rows = await db.query("select count(*)::int as n from attempts where question_version_id = $1", [v1]);
    expect((v1Rows.rows[0] as { n: number }).n).toBe(2);
  });

  it("excludes draft-only Questions, includes zero-response current Questions, preserves creation order", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    const first = await publishedQuestion(courseId);
    await insertQuestion(exec(), courseId); // draft-only: no current version
    const second = await publishedQuestion(courseId);

    const rows = await repo.listCurrentVersionItemStats(courseId);
    expect(rows.map((r) => r.questionId)).toEqual([first.questionId, second.questionId]);
    expect(rows.every((r) => r.distinctResponderCount === 0 && r.correctCount === 0)).toBe(true);
  });

  it("excludes Attempts by non-learners (instructor/owner), revoked and archived members", async () => {
    const owner = await insertUser(exec());
    const courseId = await insertCourse(exec(), owner);
    await insertCourseMembership(exec(), { userId: owner, courseId, role: "OWNER" });
    const { questionId, versionId } = await publishedQuestion(courseId);
    const base = { courseId, questionId, questionVersionId: versionId };

    const active = await learner(courseId);
    const revoked = await learner(courseId, { revokedAt: new Date("2026-02-01T00:00:00Z") });
    const archived = await learner(courseId, { archivedAt: new Date("2026-02-01T00:00:00Z") });
    const instructor = await insertUser(exec());
    await insertCourseMembership(exec(), { userId: instructor, courseId, role: "INSTRUCTOR" });

    await attempt({ ...base, userId: active, isCorrect: true });
    await attempt({ ...base, userId: revoked, isCorrect: false });
    await attempt({ ...base, userId: archived, isCorrect: false });
    await attempt({ ...base, userId: instructor, isCorrect: false });
    await attempt({ ...base, userId: owner, isCorrect: false });

    const [row] = await repo.listCurrentVersionItemStats(courseId);
    expect(row).toMatchObject({ distinctResponderCount: 1, correctCount: 1 });
  });

  it("is scoped to the requested Course only", async () => {
    const owner = await insertUser(exec());
    const courseA = await insertCourse(exec(), owner);
    const courseB = await insertCourse(exec(), owner);
    const qa = await publishedQuestion(courseA);
    const qb = await publishedQuestion(courseB);
    const u = await learner(courseB);
    await attempt({ courseId: courseB, questionId: qb.questionId, questionVersionId: qb.versionId, userId: u, isCorrect: true });

    const rowsA = await repo.listCurrentVersionItemStats(courseA);
    expect(rowsA.map((r) => r.questionId)).toEqual([qa.questionId]);
    expect(rowsA[0].distinctResponderCount).toBe(0);
    const rowsB = await repo.listCurrentVersionItemStats(courseB);
    expect(rowsB[0]).toMatchObject({ distinctResponderCount: 1, correctCount: 1 });
  });
});

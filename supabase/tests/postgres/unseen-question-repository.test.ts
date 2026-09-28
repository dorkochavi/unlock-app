/**
 * Real-Postgres (PGlite) integration test for
 * `PostgresUnseenQuestionRepository` (ADR-017, Night-Run Slice 5) — the SQL
 * text itself is the enforcement point for "unseen" and "resolvable
 * current version," so this tests the real query directly rather than only
 * through the higher-level `getOrCreateDailyPlanForToday` pipeline (see
 * `daily-plan-unit-of-work.test.ts` for that end-to-end coverage).
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresUnseenQuestionRepository } from "../../../src/infrastructure/postgres/unseen-question-repository";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertTopic,
  insertUser,
  setCurrentVersion,
  setQuestionTopic,
} from "./db-harness";

let db: PGlite;
let repo: PostgresUnseenQuestionRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresUnseenQuestionRepository(db);
});

afterEach(async () => {
  await db.close();
});

describe("PostgresUnseenQuestionRepository", () => {
  it("returns eligible unseen questions ordered by created_at asc, then id asc", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);

    const q1 = await insertQuestion(db, courseId);
    await db.query("update questions set created_at = $2 where id = $1", [
      q1,
      "2026-01-03T00:00:00Z",
    ]);
    const v1 = await insertQuestionVersion(db, q1);
    await setCurrentVersion(db, q1, v1);

    const q2 = await insertQuestion(db, courseId);
    await db.query("update questions set created_at = $2 where id = $1", [
      q2,
      "2026-01-01T00:00:00Z",
    ]);
    const v2 = await insertQuestionVersion(db, q2);
    await setCurrentVersion(db, q2, v2);

    const q3 = await insertQuestion(db, courseId);
    await db.query("update questions set created_at = $2 where id = $1", [
      q3,
      "2026-01-02T00:00:00Z",
    ]);
    const v3 = await insertQuestionVersion(db, q3);
    await setCurrentVersion(db, q3, v3);

    const results = await repo.findUnseenQuestions(userId, courseId, 10);

    expect(results.map((r) => r.questionId)).toEqual([q2, q3, q1]);
    expect(results[0].questionVersionId).toBe(v2);
    expect(results[0].courseId).toBe(courseId);
  });

  it("respects the limit parameter", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    for (let i = 0; i < 5; i++) {
      const questionId = await insertQuestion(db, courseId);
      const versionId = await insertQuestionVersion(db, questionId);
      await setCurrentVersion(db, questionId, versionId);
    }

    const results = await repo.findUnseenQuestions(userId, courseId, 2);
    expect(results).toHaveLength(2);
  });

  it("excludes a Question with no current_version_id (not yet servable)", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    // Deliberately no setCurrentVersion call — current_version_id stays null.

    const results = await repo.findUnseenQuestions(userId, courseId, 10);
    expect(results.map((r) => r.questionId)).not.toContain(questionId);
  });

  it("excludes a Question the user has a real Attempt for, even across confidence/response-time variations", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);

    await db.query(
      `insert into attempts (
         id, submission_id, user_id, course_id, question_id, question_version_id,
         answered_at, is_correct, selected_answer, attempt_number_for_presented_item,
         engine_version
       )
       values ($1, $2, $3, $4, $5, $6, now(), false, '"B"'::jsonb, 1, 'test-engine-v1')`,
      [randomUUID(), randomUUID(), userId, courseId, questionId, versionId],
    );

    const results = await repo.findUnseenQuestions(userId, courseId, 10);
    expect(results.map((r) => r.questionId)).not.toContain(questionId);
  });

  it("a Question with an Attempt from a DIFFERENT user is still unseen for this user", async () => {
    const ownerId = await insertUser(db);
    const otherUserId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);

    await db.query(
      `insert into attempts (
         id, submission_id, user_id, course_id, question_id, question_version_id,
         answered_at, is_correct, selected_answer, attempt_number_for_presented_item,
         engine_version
       )
       values ($1, $2, $3, $4, $5, $6, now(), true, '"A"'::jsonb, 1, 'test-engine-v1')`,
      [randomUUID(), randomUUID(), otherUserId, courseId, questionId, versionId],
    );

    const results = await repo.findUnseenQuestions(ownerId, courseId, 10);
    expect(results.map((r) => r.questionId)).toContain(questionId);
  });

  it("returns an empty array for a Course with no questions", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);

    const results = await repo.findUnseenQuestions(userId, courseId, 10);
    expect(results).toEqual([]);
  });

  /**
   * RUN010-E — Topic-diversifying round-robin selection (evidence-backed
   * fix for a real Topic-clustering gap in the pure `created_at asc`
   * order this replaces).
   */
  describe("Topic-diversifying round-robin (RUN010-E)", () => {
    async function seedTopicWithQuestions(
      courseId: string,
      count: number,
      createdAtStarting: string,
    ): Promise<{ topicId: string; questionIds: string[] }> {
      const topicId = await insertTopic(db, courseId);
      const questionIds: string[] = [];
      for (let i = 0; i < count; i++) {
        const questionId = await insertQuestion(db, courseId);
        await db.query("update questions set created_at = $2 where id = $1", [
          questionId,
          new Date(new Date(createdAtStarting).getTime() + i * 60_000).toISOString(),
        ]);
        const versionId = await insertQuestionVersion(db, questionId);
        await setCurrentVersion(db, questionId, versionId);
        await setQuestionTopic(db, questionId, topicId);
        questionIds.push(questionId);
      }
      return { topicId, questionIds };
    }

    it("does not let one Topic's older Questions starve a second Topic out of a small limit", async () => {
      const userId = await insertUser(db);
      const courseId = await insertCourse(db, userId);

      // Topic A: 3 Questions, ALL created strictly before every Topic B
      // Question. Under the old pure `created_at asc` order, Topic B would
      // never appear at all within a limit-3 fallback while Topic A still
      // had unseen material left — exactly the clustering bug this Slice's
      // investigation found.
      const topicA = await seedTopicWithQuestions(courseId, 3, "2026-01-01T00:00:00Z");
      const topicB = await seedTopicWithQuestions(courseId, 3, "2026-02-01T00:00:00Z");

      const results = await repo.findUnseenQuestions(userId, courseId, 3);

      expect(results).toHaveLength(3);
      const resultIds = results.map((r) => r.questionId);
      // Topic B's earliest Question must be represented despite being
      // chronologically newer than every Topic A Question.
      expect(resultIds).toContain(topicB.questionIds[0]);
      expect(resultIds).toContain(topicA.questionIds[0]);
    });

    it("picks exactly one (the earliest) Question per Topic when limit equals the Topic count", async () => {
      const userId = await insertUser(db);
      const courseId = await insertCourse(db, userId);

      const topicA = await seedTopicWithQuestions(courseId, 3, "2026-01-01T00:00:00Z");
      const topicB = await seedTopicWithQuestions(courseId, 3, "2026-02-01T00:00:00Z");

      const results = await repo.findUnseenQuestions(userId, courseId, 2);

      expect(results).toHaveLength(2);
      const resultIds = results.map((r) => r.questionId);
      expect(resultIds).toEqual(
        expect.arrayContaining([topicA.questionIds[0], topicB.questionIds[0]]),
      );
      // Neither Topic contributes a SECOND Question before the other
      // Topic's first has been represented.
      expect(resultIds).not.toContain(topicA.questionIds[1]);
      expect(resultIds).not.toContain(topicB.questionIds[1]);
    });

    it("treats Questions with no Topic assigned as their own round-robin bucket, never excluded", async () => {
      const userId = await insertUser(db);
      const courseId = await insertCourse(db, userId);

      const topicA = await seedTopicWithQuestions(courseId, 2, "2026-01-01T00:00:00Z");

      // Two more Questions, deliberately left with topic_id = null (legacy /
      // no-Topic-chosen case).
      const noTopicQ1 = await insertQuestion(db, courseId);
      await db.query("update questions set created_at = $2 where id = $1", [
        noTopicQ1,
        "2026-03-01T00:00:00Z",
      ]);
      const v1 = await insertQuestionVersion(db, noTopicQ1);
      await setCurrentVersion(db, noTopicQ1, v1);

      const results = await repo.findUnseenQuestions(userId, courseId, 2);

      expect(results).toHaveLength(2);
      const resultIds = results.map((r) => r.questionId);
      expect(resultIds).toContain(topicA.questionIds[0]);
      expect(resultIds).toContain(noTopicQ1);
    });

    it("is deterministic across repeated calls against the same DB state", async () => {
      const userId = await insertUser(db);
      const courseId = await insertCourse(db, userId);
      await seedTopicWithQuestions(courseId, 3, "2026-01-01T00:00:00Z");
      await seedTopicWithQuestions(courseId, 3, "2026-02-01T00:00:00Z");

      const first = await repo.findUnseenQuestions(userId, courseId, 3);
      const second = await repo.findUnseenQuestions(userId, courseId, 3);

      expect(second.map((r) => r.questionId)).toEqual(first.map((r) => r.questionId));
    });
  });
});

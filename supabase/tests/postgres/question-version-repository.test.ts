/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresQuestionVersionRepository` (Phase 8).
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresQuestionVersionRepository } from "../../../src/infrastructure/postgres/question-version-repository";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;
let repo: PostgresQuestionVersionRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresQuestionVersionRepository(db);
});

afterEach(async () => {
  await db.close();
});

describe("PostgresQuestionVersionRepository", () => {
  it("getCurrentVersion returns null for a Question with no current_version_id yet", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);

    expect(await repo.getCurrentVersion(questionId)).toBeNull();
  });

  it("getCurrentVersion returns the questionId/versionId once current_version_id is set", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);

    expect(await repo.getCurrentVersion(questionId)).toEqual({ questionId, versionId });
  });

  it("getCurrentVersion tracks a version change (editing creates a new current version, ADR-009)", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const v1 = await insertQuestionVersion(db, questionId, 1);
    await setCurrentVersion(db, questionId, v1);
    const v2 = await insertQuestionVersion(db, questionId, 2);
    await setCurrentVersion(db, questionId, v2);

    expect(await repo.getCurrentVersion(questionId)).toEqual({
      questionId,
      versionId: v2,
    });
  });

  it("resolveVersionContext returns null for a QuestionVersion id that does not exist", async () => {
    expect(await repo.resolveVersionContext(randomUUID())).toBeNull();
  });

  it("resolveVersionContext returns the true (questionId, courseId) a QuestionVersion belongs to", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);

    expect(await repo.resolveVersionContext(versionId)).toEqual({
      questionId,
      courseId,
    });
  });
});

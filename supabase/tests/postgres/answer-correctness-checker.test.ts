/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresAnswerCorrectnessChecker` (Phase 9), focused on the read path +
 * malformed-PERSISTED-content scenarios that are only reachable via a real
 * row (JSON-internal corruption the DB has no CHECK for — see ADR-014
 * Decision §4/§5). Correctness-computation coverage (SINGLE_CHOICE/
 * MULTIPLE_CHOICE grading, invalid client answers) is exercised more
 * thoroughly end-to-end through `submitAnswer` in `submit-answer.test.ts`;
 * this file is about the adapter's OWN read/validate contract in
 * isolation.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { InvalidQuestionAnswerDefinitionError } from "../../../src/domain/learning/answer";
import { PostgresAnswerCorrectnessChecker } from "../../../src/infrastructure/postgres/answer-correctness-checker";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
} from "./db-harness";

let db: PGlite;
let checker: PostgresAnswerCorrectnessChecker;

beforeEach(async () => {
  db = await createTestDb();
  checker = new PostgresAnswerCorrectnessChecker(db);
});

afterEach(async () => {
  await db.close();
});

async function seedQuestion() {
  const userId = await insertUser(db);
  const courseId = await insertCourse(db, userId);
  return insertQuestion(db, courseId);
}

describe("PostgresAnswerCorrectnessChecker", () => {
  it("loads by the exact questionVersionId and grades a SINGLE_CHOICE answer correctly", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId);

    expect(await checker.isCorrect(versionId, "A")).toBe(true);
    expect(await checker.isCorrect(versionId, "B")).toBe(false);
  });

  it("grades a MULTIPLE_CHOICE answer by set equality", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId, 1, {
      questionType: "MULTIPLE_CHOICE",
      options: [
        { id: "a", content: "A" },
        { id: "b", content: "B" },
        { id: "c", content: "C" },
      ],
      correctOptionIds: ["a", "c"],
    });

    expect(await checker.isCorrect(versionId, ["a", "c"])).toBe(true);
    expect(await checker.isCorrect(versionId, ["c", "a"])).toBe(true);
    expect(await checker.isCorrect(versionId, ["a"])).toBe(false);
  });

  it("throws for a questionVersionId that does not exist — never silently 'incorrect'", async () => {
    await expect(checker.isCorrect(randomUUID(), "A")).rejects.toThrow(
      /no question_versions row found/,
    );
  });

  it("throws InvalidQuestionAnswerDefinitionError for a persisted definition with an empty options array", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId);
    await db.query(
      "update question_versions set answer_options = '[]'::jsonb where id = $1",
      [versionId],
    );

    await expect(checker.isCorrect(versionId, "A")).rejects.toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("throws InvalidQuestionAnswerDefinitionError when correct_answer references an option id that does not exist", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId);
    await db.query(
      "update question_versions set correct_answer = '[\"nonexistent\"]'::jsonb where id = $1",
      [versionId],
    );

    await expect(checker.isCorrect(versionId, "A")).rejects.toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("throws InvalidQuestionAnswerDefinitionError for a duplicate option id within answer_options", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId);
    await db.query(
      `update question_versions
          set answer_options = '[{"id":"a","content":"A"},{"id":"a","content":"A again"}]'::jsonb
        where id = $1`,
      [versionId],
    );

    await expect(checker.isCorrect(versionId, "a")).rejects.toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("throws InvalidQuestionAnswerDefinitionError for SINGLE_CHOICE with two correct options persisted", async () => {
    const questionId = await seedQuestion();
    const versionId = await insertQuestionVersion(db, questionId);
    await db.query(
      `update question_versions set correct_answer = '["a","b"]'::jsonb where id = $1`,
      [versionId],
    );

    await expect(checker.isCorrect(versionId, "a")).rejects.toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("historical grading: an old QuestionVersion is graded by ITS OWN definition, never by questions.current_version_id", async () => {
    const questionId = await seedQuestion();
    const v1 = await insertQuestionVersion(db, questionId, 1, {
      correctOptionIds: ["A"],
    });
    const v2 = await insertQuestionVersion(db, questionId, 2, {
      correctOptionIds: ["B"],
    });
    await db.query("update questions set current_version_id = $1 where id = $2", [
      v2,
      questionId,
    ]);

    // v1 still grades "A" as correct even though current_version_id now
    // points at v2 (whose correct answer is "B").
    expect(await checker.isCorrect(v1, "A")).toBe(true);
    expect(await checker.isCorrect(v1, "B")).toBe(false);
    // v2 grades independently, by its own definition.
    expect(await checker.isCorrect(v2, "B")).toBe(true);
    expect(await checker.isCorrect(v2, "A")).toBe(false);
  });
});

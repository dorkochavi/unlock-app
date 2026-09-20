/**
 * Real-Postgres (PGlite) integration tests for `PostgresQuestionRepository`
 * (`questions`' draft_ columns and `topic_id`, Run 006 S2) — including the
 * same-Course Question<->Topic composite FK
 * (`questions_topic_id_course_id_fkey`) and backward compatibility with
 * existing published Questions.
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { PostgresQuestionRepository } from "../../../src/infrastructure/postgres/question-authoring-repository";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("PostgresQuestionRepository", () => {
  it("createDraft persists a never-published, Topic-less Question scoped to the given Course", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresQuestionRepository(db);

    const created = await repo.createDraft({ courseId });

    expect(created.courseId).toBe(courseId);
    expect(created.topicId).toBeNull();
    expect(created.currentVersionId).toBeNull();
    expect(created.draft).toEqual({
      questionType: null,
      prompt: null,
      answerOptions: null,
      correctOptionIds: null,
      explanation: null,
    });
  });

  it("getForAuthoring returns null for an unknown id", async () => {
    const repo = new PostgresQuestionRepository(db);
    expect(await repo.getForAuthoring(randomUUID())).toBeNull();
  });

  it("listForCourse returns only Questions for that Course, in creation order", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const otherCourseId = await insertCourse(db, ownerId);
    const repo = new PostgresQuestionRepository(db);

    const first = await repo.createDraft({ courseId });
    const second = await repo.createDraft({ courseId });
    await repo.createDraft({ courseId: otherCourseId });

    const listed = await repo.listForCourse(courseId);

    expect(listed.map((q) => q.id)).toEqual([first.id, second.id]);
  });

  it("updateDraft persists full draft content (SINGLE_CHOICE) and re-reads it unchanged", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const repo = new PostgresQuestionRepository(db);
    const created = await repo.createDraft({ courseId });

    const updated = await repo.updateDraft(created.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: "Basic arithmetic.",
    });

    expect(updated).toMatchObject({
      topicId: topic.id,
      draft: {
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
        answerOptions: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
        correctOptionIds: ["b"],
        explanation: "Basic arithmetic.",
      },
    });

    const reread = await repo.getForAuthoring(created.id);
    expect(reread).toEqual(updated);
  });

  it("updateDraft updates only the fields provided, leaving the rest unchanged", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresQuestionRepository(db);
    const created = await repo.createDraft({ courseId });
    await repo.updateDraft(created.id, { prompt: "Original prompt" });

    const updated = await repo.updateDraft(created.id, { explanation: "Added later" });

    expect(updated?.draft.prompt).toBe("Original prompt");
    expect(updated?.draft.explanation).toBe("Added later");
  });

  it("updateDraft can explicitly clear a field back to null", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresQuestionRepository(db);
    const created = await repo.createDraft({ courseId });
    await repo.updateDraft(created.id, { prompt: "Will be cleared" });

    const updated = await repo.updateDraft(created.id, { prompt: null });

    expect(updated?.draft.prompt).toBeNull();
  });

  it("updateDraft returns null for an unknown id", async () => {
    const repo = new PostgresQuestionRepository(db);
    expect(await repo.updateDraft(randomUUID(), { prompt: "X" })).toBeNull();
  });

  it("rejects a Question referencing a Topic from a different Course (DB-enforced composite FK)", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const otherCourseId = await insertCourse(db, ownerId);
    const topicRepo = new PostgresTopicRepository(db);
    const otherCourseTopic = await topicRepo.createTopic({ courseId: otherCourseId, name: "Wrong course" });
    const repo = new PostgresQuestionRepository(db);
    const created = await repo.createDraft({ courseId });

    await expect(repo.updateDraft(created.id, { topicId: otherCourseTopic.id })).rejects.toThrow();
  });

  it("rejects a Question referencing a nonexistent Topic id (composite FK has no row to match)", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresQuestionRepository(db);
    const created = await repo.createDraft({ courseId });

    await expect(repo.updateDraft(created.id, { topicId: randomUUID() })).rejects.toThrow();
  });

  it("an existing published Question (no draft_*/topic_id ever written) remains fully readable and backward-compatible", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);
    const repo = new PostgresQuestionRepository(db);

    const authoring = await repo.getForAuthoring(questionId);

    expect(authoring).toMatchObject({
      id: questionId,
      courseId,
      topicId: null,
      currentVersionId: versionId,
      draft: {
        questionType: null,
        prompt: null,
        answerOptions: null,
        correctOptionIds: null,
        explanation: null,
      },
    });
  });
});

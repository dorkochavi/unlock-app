import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { listQuestionsForCourse } from "../list-questions-for-course";
import { InMemoryQuestionDatabase } from "./in-memory-fakes";
import type { CourseMembership, QuestionAuthoringRecord, Topic } from "../ports";

function seedTopic(db: InMemoryQuestionDatabase, overrides: Partial<Topic>): void {
  db.seedTopic({
    id: "topic-1",
    courseId: "course-1",
    name: "Algebra",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

function seedActor(db: InMemoryQuestionDatabase, overrides: Partial<CourseMembership>): void {
  db.seedMembership({
    id: "actor-membership",
    userId: "actor-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  });
}

function seedQuestion(db: InMemoryQuestionDatabase, overrides: Partial<QuestionAuthoringRecord>): void {
  db.seedQuestion({
    id: `question-${Math.random()}`,
    courseId: "course-1",
    topicId: null,
    currentVersionId: null,
    draft: { ...EMPTY_QUESTION_DRAFT },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("listQuestionsForCourse", () => {
  it("lists only Questions belonging to the given Course", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { id: "question-1", courseId: "course-1" });
    seedQuestion(db, { id: "question-2", courseId: "other-course" });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("LISTED");
    if (result.outcome === "LISTED") {
      expect(result.questions.map((q) => q.id)).toEqual(["question-1"]);
    }
  });

  it("returns an empty list for a Course with no Questions", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({
      outcome: "LISTED",
      questions: [],
      publishedPromptByQuestionId: {},
      topicById: {},
    });
  });

  it("resolves publishedPromptByQuestionId for a PUBLISHED Question with no pending draft (Run 006 S4 reviewer finding)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { id: "question-1", currentVersionId: "version-1" });
    db.seedVersionContent("version-1", {
      questionType: "SINGLE_CHOICE",
      prompt: "What is the real published prompt?",
      answerOptions: [{ id: "a", content: "A" }],
      correctOptionIds: ["a"],
      explanation: null,
    });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toMatchObject({
      outcome: "LISTED",
      publishedPromptByQuestionId: { "question-1": "What is the real published prompt?" },
    });
  });

  it("does not resolve publishedPromptByQuestionId for a Question with pending draft changes (draft.prompt already carries the real content)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {
      id: "question-1",
      currentVersionId: "version-1",
      draft: { ...EMPTY_QUESTION_DRAFT, prompt: "Edited prompt" },
    });
    db.seedVersionContent("version-1", {
      questionType: "SINGLE_CHOICE",
      prompt: "Original published prompt",
      answerOptions: [{ id: "a", content: "A" }],
      correctOptionIds: ["a"],
      explanation: null,
    });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toMatchObject({ outcome: "LISTED", publishedPromptByQuestionId: {} });
  });

  it("resolves topicById including an archived Topic (Run 006 S1 decision #10 — no forced reassociation)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { id: "question-1", topicId: "topic-1" });
    seedTopic(db, { archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toMatchObject({
      outcome: "LISTED",
      topicById: { "topic-1": { id: "topic-1", name: "Algebra" } },
    });
  });

  it("does not allow a LEARNER to list authoring state", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await listQuestionsForCourse(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow a non-member to list authoring state", async () => {
    const db = new InMemoryQuestionDatabase();

    const result = await listQuestionsForCourse(
      { actorUserId: "stranger-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

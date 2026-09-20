import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { getQuestionForAuthoring } from "../get-question-for-authoring";
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
    id: "question-1",
    courseId: "course-1",
    topicId: null,
    currentVersionId: null,
    draft: { ...EMPTY_QUESTION_DRAFT },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("getQuestionForAuthoring", () => {
  it("returns the Question when the actor can author its Course, with no publishedContent when never published", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toEqual({
      outcome: "FOUND",
      question: expect.objectContaining({ id: "question-1", courseId: "course-1" }),
      publishedContent: null,
      topic: null,
    });
  });

  it("resolves the associated Topic even when it has since been archived (Run 006 S1 decision #10 — no forced reassociation)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { topicId: "topic-1" });
    seedTopic(db, { archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toMatchObject({
      outcome: "FOUND",
      topic: { id: "topic-1", name: "Algebra", archivedAt: new Date("2026-02-01T00:00:00Z") },
    });
  });

  it("resolves publishedContent from the current QuestionVersion when one exists (Run 006 S4 'reopen/edit' support)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { currentVersionId: "version-1" });
    db.seedVersionContent("version-1", {
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toMatchObject({
      outcome: "FOUND",
      publishedContent: {
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
        correctOptionIds: ["b"],
      },
    });
  });

  it("does not allow a LEARNER to read authoring state", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });
    seedQuestion(db, {});

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("returns QUESTION_NOT_FOUND for a nonexistent questionId", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "missing" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("collapses a cross-Course questionId into QUESTION_NOT_FOUND without leaking its real Course (never a distinct outcome)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER", courseId: "course-1" });
    seedQuestion(db, { id: "question-1", courseId: "other-course" });

    const result = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("checks authorization before the Question is loaded (unauthorized caller never learns whether questionId exists)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });
    seedQuestion(db, { id: "question-1", courseId: "course-1" });

    const found = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );
    const missing = await getQuestionForAuthoring(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "does-not-exist" },
      db.repos(),
    );

    expect(found).toEqual({ outcome: "NOT_AUTHORIZED" });
    expect(missing).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

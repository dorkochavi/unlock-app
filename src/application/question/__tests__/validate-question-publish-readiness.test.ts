import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { validateQuestionPublishReadiness } from "../validate-question-publish-readiness";
import { InMemoryQuestionDatabase } from "./in-memory-fakes";
import type { CourseMembership, QuestionAuthoringRecord, Topic } from "../ports";

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

function seedReadyQuestion(db: InMemoryQuestionDatabase, overrides: Partial<QuestionAuthoringRecord> = {}): void {
  db.seedQuestion({
    id: "question-1",
    courseId: "course-1",
    topicId: "topic-1",
    currentVersionId: null,
    draft: {
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("validateQuestionPublishReadiness", () => {
  it("returns READY with normalized content for a complete draft", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db, {});
    seedReadyQuestion(db, {});

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.content).toEqual({
        topicId: "topic-1",
        prompt: "What is 2+2?",
        questionType: "SINGLE_CHOICE",
        answerOptions: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
        correctOptionIds: ["b"],
        explanation: null,
      });
    }
  });

  it("returns NOT_READY with a reason for an incomplete draft, without throwing", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedReadyQuestion(db, { topicId: null, draft: { ...EMPTY_QUESTION_DRAFT } });

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_READY");
    if (result.outcome === "NOT_READY") {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("returns READY even when the associated Topic has since become archived (Run 006 S1 decision #10 — no forced reassociation)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db, { archivedAt: new Date("2026-02-01T00:00:00Z") });
    seedReadyQuestion(db, {});

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
  });

  it("does not allow a LEARNER to validate publish readiness", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });
    seedTopic(db, {});
    seedReadyQuestion(db, {});

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("returns QUESTION_NOT_FOUND for a nonexistent questionId", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "missing" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("collapses a cross-Course questionId into QUESTION_NOT_FOUND without leaking its real Course", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedReadyQuestion(db, { courseId: "other-course" });

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("checks authorization before the Question is loaded (unauthorized caller never learns whether questionId exists)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await validateQuestionPublishReadiness(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "does-not-exist" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

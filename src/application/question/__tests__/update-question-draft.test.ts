import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { updateQuestionDraft } from "../update-question-draft";
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

describe("updateQuestionDraft", () => {
  it("allows an OWNER to save partial draft content", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      {
        actorUserId: "actor-1",
        courseId: "course-1",
        questionId: "question-1",
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome === "UPDATED") {
      expect(result.question.draft).toMatchObject({
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
        answerOptions: null,
        correctOptionIds: null,
      });
    }
  });

  it("allows setting a same-Course Topic", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});
    seedTopic(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome === "UPDATED") {
      expect(result.question.topicId).toBe("topic-1");
    }
  });

  it("rejects a cross-Course Topic as TOPIC_NOT_FOUND without leaking its real Course", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});
    seedTopic(db, { id: "topic-1", courseId: "other-course" });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });

  it("rejects assigning an archived Topic as a NEW association (TOPIC_ARCHIVED)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});
    seedTopic(db, { archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_ARCHIVED" });
  });

  it("allows keeping a Question's own already-associated Topic even after it becomes archived (no forced reassociation)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { topicId: "topic-1" });
    seedTopic(db, { archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await updateQuestionDraft(
      {
        actorUserId: "actor-1",
        courseId: "course-1",
        questionId: "question-1",
        topicId: "topic-1",
        prompt: "Unrelated edit",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome === "UPDATED") {
      expect(result.question.topicId).toBe("topic-1");
    }
  });

  it("rejects a nonexistent Topic id as TOPIC_NOT_FOUND", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", topicId: "missing" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });

  it("allows explicitly clearing the Topic association (topicId: null)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { topicId: "topic-1" });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", topicId: null },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome === "UPDATED") {
      expect(result.question.topicId).toBeNull();
    }
  });

  it("rejects a draft with a duplicate answerOptions id as INVALID_DRAFT", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      {
        actorUserId: "actor-1",
        courseId: "course-1",
        questionId: "question-1",
        answerOptions: [
          { id: "a", content: "First" },
          { id: "a", content: "Second" },
        ],
      },
      db.repos(),
    );

    expect(result.outcome).toBe("INVALID_DRAFT");
  });

  it("allows an incomplete work-in-progress draft (no options yet)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", prompt: "Draft only" },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
  });

  it("does not allow a LEARNER to update a draft", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", prompt: "Hack" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow a revoked OWNER to update a draft", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", prompt: "Hack" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow an archived-but-not-revoked OWNER to update a draft (canAuthorCourse fails closed on archived)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });
    seedQuestion(db, {});

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", prompt: "Hack" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("returns QUESTION_NOT_FOUND for a nonexistent questionId", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "missing", prompt: "X" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("collapses a cross-Course questionId into QUESTION_NOT_FOUND without leaking its real Course", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });
    seedQuestion(db, { id: "question-1", courseId: "other-course" });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "question-1", prompt: "X" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "QUESTION_NOT_FOUND" });
  });

  it("checks authorization before the Question is loaded (unauthorized caller never learns whether questionId exists)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await updateQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1", questionId: "does-not-exist", prompt: "X" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

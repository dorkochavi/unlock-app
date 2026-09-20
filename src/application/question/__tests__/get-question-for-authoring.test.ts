import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { getQuestionForAuthoring } from "../get-question-for-authoring";
import { InMemoryQuestionDatabase } from "./in-memory-fakes";
import type { CourseMembership, QuestionAuthoringRecord } from "../ports";

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
  it("returns the Question when the actor can author its Course", async () => {
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

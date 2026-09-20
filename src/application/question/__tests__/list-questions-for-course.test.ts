import { describe, expect, it } from "vitest";

import { EMPTY_QUESTION_DRAFT } from "../../../domain/question/types";
import { listQuestionsForCourse } from "../list-questions-for-course";
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

    expect(result).toEqual({ outcome: "LISTED", questions: [] });
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

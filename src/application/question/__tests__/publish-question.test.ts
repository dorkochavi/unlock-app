import { describe, expect, it } from "vitest";

import { publishQuestion } from "../publish-question";
import { InMemoryQuestionDatabase } from "./in-memory-fakes";

import type { QuestionAuthoringRecord } from "../../../domain/question/types";

function ownerMembership(userId: string, courseId: string) {
  return {
    id: `membership-${userId}-${courseId}`,
    userId,
    courseId,
    role: "OWNER" as const,
    joinedAt: new Date(),
    revokedAt: null,
    archivedAt: null,
  };
}

function seedPublishableDraftQuestion(
  db: InMemoryQuestionDatabase,
  courseId: string,
  overrides: Partial<QuestionAuthoringRecord> = {},
): QuestionAuthoringRecord {
  const question: QuestionAuthoringRecord = {
    id: "question-1",
    courseId,
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
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  db.seedQuestion(question);
  return question;
}

describe("publishQuestion", () => {
  it("first publish: creates version 1 and repoints current_version_id, clearing the draft", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-1");

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("PUBLISHED");
    if (result.outcome !== "PUBLISHED") throw new Error("unreachable");
    expect(result.question.currentVersionId).toBe(result.versionId);
    expect(result.question.draft).toEqual({
      questionType: null,
      prompt: null,
      answerOptions: null,
      correctOptionIds: null,
      explanation: null,
    });

    const versions = db.listVersionsForQuestion("question-1");
    expect(versions).toHaveLength(1);
    expect(versions[0].versionNumber).toBe(1);
    expect(versions[0].content).toEqual({
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
  });

  it("re-publish: inserts a NEW version, repoints current, and leaves the old version byte-for-byte unchanged", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-1");

    const first = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );
    expect(first.outcome).toBe("PUBLISHED");
    if (first.outcome !== "PUBLISHED") throw new Error("unreachable");
    const firstVersionId = first.versionId;
    const firstVersionSnapshot = db.listVersionsForQuestion("question-1")[0];

    // Edit the draft again, as updateQuestionDraft would after a first publish.
    db.seedQuestion({
      ...first.question,
      draft: {
        questionType: "SINGLE_CHOICE",
        prompt: "What is 3+3?",
        answerOptions: [
          { id: "a", content: "5" },
          { id: "b", content: "6" },
        ],
        correctOptionIds: ["b"],
        explanation: "Edited",
      },
    });

    const second = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(second.outcome).toBe("PUBLISHED");
    if (second.outcome !== "PUBLISHED") throw new Error("unreachable");
    expect(second.versionId).not.toBe(firstVersionId);
    expect(second.question.currentVersionId).toBe(second.versionId);

    const versions = db.listVersionsForQuestion("question-1");
    expect(versions).toHaveLength(2);
    // The old version row is untouched — same id, same content as right after the first publish.
    expect(versions.find((v) => v.id === firstVersionId)).toEqual(firstVersionSnapshot);
    const secondVersion = versions.find((v) => v.id === second.versionId);
    expect(secondVersion?.versionNumber).toBe(2);
    expect(secondVersion?.content.prompt).toBe("What is 3+3?");
  });

  it("NOT_AUTHORIZED for a caller with no Course membership", async () => {
    const db = new InMemoryQuestionDatabase();
    seedPublishableDraftQuestion(db, "course-1");

    const result = await publishQuestion(
      { actorUserId: "stranger", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("NOT_AUTHORIZED for a LEARNER membership", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date(),
      revokedAt: null,
      archivedAt: null,
    });
    seedPublishableDraftQuestion(db, "course-1");

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("QUESTION_NOT_FOUND for a Question belonging to a different Course (cross-Course collapse, never leaks)", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-2");

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("QUESTION_NOT_FOUND");
  });

  it("QUESTION_NOT_FOUND for an unknown questionId", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "does-not-exist" },
      db.uow(),
    );

    expect(result.outcome).toBe("QUESTION_NOT_FOUND");
  });

  it("COURSE_ARCHIVED rejects publish on a terminal ARCHIVED Course", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    db.seedCourseStatus("course-1", "ARCHIVED");
    seedPublishableDraftQuestion(db, "course-1");

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("COURSE_ARCHIVED");
    expect(db.listVersionsForQuestion("question-1")).toHaveLength(0);
  });

  it("NOTHING_TO_PUBLISH for a plain PUBLISHED Question with no pending draft", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-1", {
      currentVersionId: "existing-version",
      draft: {
        questionType: null,
        prompt: null,
        answerOptions: null,
        correctOptionIds: null,
        explanation: null,
      },
    });

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("NOTHING_TO_PUBLISH");
  });

  it("NOT_READY rejects an incomplete draft and creates no version", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-1", {
      draft: {
        questionType: "SINGLE_CHOICE",
        prompt: "",
        answerOptions: null,
        correctOptionIds: null,
        explanation: null,
      },
    });

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("NOT_READY");
    expect(db.listVersionsForQuestion("question-1")).toHaveLength(0);
  });

  it("NOT_READY when no Topic is selected", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedMembership(ownerMembership("user-1", "course-1"));
    seedPublishableDraftQuestion(db, "course-1", { topicId: null });

    const result = await publishQuestion(
      { actorUserId: "user-1", courseId: "course-1", questionId: "question-1" },
      db.uow(),
    );

    expect(result.outcome).toBe("NOT_READY");
  });
});

/**
 * Run 2026-09-20-006 S6 — Integrated Verification walkthrough
 * (CHATGPT_PLAN.md S6 "Required local/test walkthrough"), executed against
 * real PGlite/PostgreSQL: no hosted fixtures are manufactured (per the
 * Plan's explicit "Do not manufacture hosted fixtures"), and every step
 * below drives the REAL application use cases end to end (not raw SQL
 * fixtures) — the same functions the actual API routes call.
 *
 * Walkthrough proven in one coherent journey:
 *   authorized instructor -> open Course -> choose Topic
 *   -> create SINGLE_CHOICE draft -> save/edit -> publish
 *   -> edit again -> re-publish -> verify old version unchanged
 *   -> create MULTIPLE_CHOICE -> verify multi-correct validation -> publish
 *   -> verify draft-only Question is not learner-eligible
 *   -> verify current published QuestionVersion remains compatible with the
 *      learner read/grading architecture
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createQuestionDraft } from "../../../src/application/question/create-question-draft";
import { updateQuestionDraft } from "../../../src/application/question/update-question-draft";
import { publishQuestion } from "../../../src/application/question/publish-question";
import { validateQuestionPublishReadiness } from "../../../src/application/question/validate-question-publish-readiness";
import { PostgresAnswerCorrectnessChecker } from "../../../src/infrastructure/postgres/answer-correctness-checker";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresLearnerQuestionContentRepository } from "../../../src/infrastructure/postgres/learner-question-content-repository";
import { PostgresQuestionRepository } from "../../../src/infrastructure/postgres/question-authoring-repository";
import { PostgresQuestionUnitOfWork } from "../../../src/infrastructure/postgres/postgres-question-unit-of-work";
import { PostgresQuestionVersionRepository } from "../../../src/infrastructure/postgres/question-version-repository";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { PostgresUnseenQuestionRepository } from "../../../src/infrastructure/postgres/unseen-question-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertUser,
  pgliteConnectionProvider,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

function questionRepositories() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    topics: new PostgresTopicRepository(db),
    questions: new PostgresQuestionRepository(db),
  };
}

describe("Run 006 S6 — Question Authoring & Publishing V1 walkthrough", () => {
  it("authorized instructor: create -> publish -> re-publish -> MULTIPLE_CHOICE -> learner eligibility/grading compatibility", async () => {
    // authorized instructor + open Course
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId);
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
    const repos = questionRepositories();

    // choose Topic
    const topic = await repos.topics.createTopic({ courseId, name: "Algebra" });

    // create SINGLE_CHOICE draft
    const created = await createQuestionDraft({ actorUserId: instructorId, courseId }, repos);
    expect(created.outcome).toBe("CREATED");
    if (created.outcome !== "CREATED") throw new Error("unreachable");
    const questionId = created.question.id;

    // save/edit
    const saved = await updateQuestionDraft(
      {
        actorUserId: instructorId,
        courseId,
        questionId,
        topicId: topic.id,
        questionType: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
        answerOptions: [
          { id: "a", content: "3" },
          { id: "b", content: "4" },
        ],
        correctOptionIds: ["b"],
        explanation: null,
      },
      repos,
    );
    expect(saved.outcome).toBe("UPDATED");

    const readiness = await validateQuestionPublishReadiness(
      { actorUserId: instructorId, courseId, questionId },
      repos,
    );
    expect(readiness.outcome).toBe("READY");

    // publish
    const uow = new PostgresQuestionUnitOfWork(pgliteConnectionProvider(db));
    const firstPublish = await publishQuestion({ actorUserId: instructorId, courseId, questionId }, uow);
    expect(firstPublish.outcome).toBe("PUBLISHED");
    if (firstPublish.outcome !== "PUBLISHED") throw new Error("unreachable");
    const versionOne = firstPublish.versionId;

    // edit again
    const editedAgain = await updateQuestionDraft(
      {
        actorUserId: instructorId,
        courseId,
        questionId,
        topicId: topic.id,
        questionType: "SINGLE_CHOICE",
        prompt: "What is 3+3?",
        answerOptions: [
          { id: "a", content: "5" },
          { id: "b", content: "6" },
        ],
        correctOptionIds: ["b"],
        explanation: null,
      },
      repos,
    );
    expect(editedAgain.outcome).toBe("UPDATED");

    // re-publish
    const secondPublish = await publishQuestion({ actorUserId: instructorId, courseId, questionId }, uow);
    expect(secondPublish.outcome).toBe("PUBLISHED");
    if (secondPublish.outcome !== "PUBLISHED") throw new Error("unreachable");
    const versionTwo = secondPublish.versionId;
    expect(versionTwo).not.toBe(versionOne);

    // verify old version unchanged
    const versionOneRow = await db.query<{ prompt: string; version_number: number }>(
      "select prompt, version_number from question_versions where id = $1",
      [versionOne],
    );
    expect(versionOneRow.rows[0]).toEqual({ prompt: "What is 2+2?", version_number: 1 });
    const questionVersionRepo = new PostgresQuestionVersionRepository(db);
    const current = await questionVersionRepo.getCurrentVersion(questionId);
    expect(current?.versionId).toBe(versionTwo);

    // create MULTIPLE_CHOICE
    const mcCreated = await createQuestionDraft({ actorUserId: instructorId, courseId }, repos);
    expect(mcCreated.outcome).toBe("CREATED");
    if (mcCreated.outcome !== "CREATED") throw new Error("unreachable");
    const mcQuestionId = mcCreated.question.id;
    await updateQuestionDraft(
      {
        actorUserId: instructorId,
        courseId,
        questionId: mcQuestionId,
        topicId: topic.id,
        questionType: "MULTIPLE_CHOICE",
        prompt: "Which are even numbers?",
        answerOptions: [
          { id: "a", content: "2" },
          { id: "b", content: "3" },
          { id: "c", content: "4" },
        ],
        correctOptionIds: [],
        explanation: null,
      },
      repos,
    );

    // verify multi-correct validation: zero correct options is NOT publish-ready
    const notReady = await validateQuestionPublishReadiness(
      { actorUserId: instructorId, courseId, questionId: mcQuestionId },
      repos,
    );
    expect(notReady.outcome).toBe("NOT_READY");
    const zeroCorrectPublishAttempt = await publishQuestion(
      { actorUserId: instructorId, courseId, questionId: mcQuestionId },
      uow,
    );
    expect(zeroCorrectPublishAttempt.outcome).toBe("NOT_READY");

    // fix it with two correct options (valid MULTIPLE_CHOICE) and publish
    await updateQuestionDraft(
      { actorUserId: instructorId, courseId, questionId: mcQuestionId, correctOptionIds: ["a", "c"] },
      repos,
    );
    const mcPublish = await publishQuestion({ actorUserId: instructorId, courseId, questionId: mcQuestionId }, uow);
    expect(mcPublish.outcome).toBe("PUBLISHED");
    if (mcPublish.outcome !== "PUBLISHED") throw new Error("unreachable");

    // verify draft-only Question is not learner-eligible
    const draftOnlyCreated = await createQuestionDraft({ actorUserId: instructorId, courseId }, repos);
    expect(draftOnlyCreated.outcome).toBe("CREATED");
    if (draftOnlyCreated.outcome !== "CREATED") throw new Error("unreachable");
    await updateQuestionDraft(
      {
        actorUserId: instructorId,
        courseId,
        questionId: draftOnlyCreated.question.id,
        topicId: topic.id,
        questionType: "SINGLE_CHOICE",
        prompt: "Never published",
        answerOptions: [
          { id: "a", content: "X" },
          { id: "b", content: "Y" },
        ],
        correctOptionIds: ["a"],
        explanation: null,
      },
      repos,
    );

    const learnerId = await insertUser(db);
    const unseenRepo = new PostgresUnseenQuestionRepository(db);
    const unseenCandidates = await unseenRepo.findUnseenQuestions(learnerId, courseId, 10);
    const unseenQuestionIds = unseenCandidates.map((c) => c.questionId);
    expect(unseenQuestionIds).not.toContain(draftOnlyCreated.question.id);
    expect(unseenQuestionIds).toContain(questionId);
    expect(unseenQuestionIds).toContain(mcQuestionId);
    expect(await questionVersionRepo.getCurrentVersion(draftOnlyCreated.question.id)).toBeNull();

    // verify current published QuestionVersion remains compatible with the
    // learner read/grading architecture: the learner-safe projection never
    // exposes correct_answer/explanation, and grading against the CURRENT
    // version (post-re-publish) still works correctly.
    const learnerContentRepo = new PostgresLearnerQuestionContentRepository(db);
    const [learnerContent] = await learnerContentRepo.findManyByVersionIds([versionTwo]);
    expect(learnerContent).toMatchObject({
      questionVersionId: versionTwo,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 3+3?",
      options: [
        { id: "a", content: "5" },
        { id: "b", content: "6" },
      ],
    });
    expect(learnerContent).not.toHaveProperty("correctOptionIds");
    expect(learnerContent).not.toHaveProperty("correctAnswer");
    expect(learnerContent).not.toHaveProperty("explanation");

    const correctnessChecker = new PostgresAnswerCorrectnessChecker(db);
    expect(await correctnessChecker.isCorrect(versionTwo, "b")).toBe(true);
    expect(await correctnessChecker.isCorrect(versionTwo, "a")).toBe(false);
    // The OLD version still grades correctly too — an already-in-flight
    // Attempt referencing version 1 is unaffected by the re-publish.
    expect(await correctnessChecker.isCorrect(versionOne, "b")).toBe(true);

    const mcContent = await questionVersionRepo.getCurrentVersion(mcQuestionId);
    expect(mcContent).not.toBeNull();
    if (mcContent === null) throw new Error("unreachable");
    expect(await correctnessChecker.isCorrect(mcContent.versionId, ["a", "c"])).toBe(true);
    expect(await correctnessChecker.isCorrect(mcContent.versionId, ["a"])).toBe(false);
  });
});

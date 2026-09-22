/**
 * Real-Postgres (PGlite) integration tests for `PostgresQuestionUnitOfWork`
 * (Run 006 S5: `publishQuestion`'s insert-new-version +
 * repoint-current-version-and-clear-draft writes must commit or roll back
 * together). Proves the actual atomicity/rollback contract that
 * `publish-question.test.ts` (in-memory fakes) cannot: its fake
 * `runInTransaction` has no notion of a mid-sequence failure. Mirrors
 * `postgres-course-unit-of-work.test.ts` exactly.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { publishQuestion } from "../../../src/application/question/publish-question";
import { PostgresAttemptRepository } from "../../../src/infrastructure/postgres/attempt-repository";
import { PostgresQuestionRepository } from "../../../src/infrastructure/postgres/question-authoring-repository";
import { PostgresQuestionUnitOfWork } from "../../../src/infrastructure/postgres/postgres-question-unit-of-work";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import type { Attempt } from "../../../src/domain/learning/types";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  pgliteConnectionProvider,
  randomToken,
  setCurrentVersion,
} from "./db-harness";

let db: PGlite;
let uow: PostgresQuestionUnitOfWork;

beforeEach(async () => {
  db = await createTestDb();
  uow = new PostgresQuestionUnitOfWork(pgliteConnectionProvider(db));
});

afterEach(async () => {
  await db.close();
});

async function versionCount(questionId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    "select count(*)::int as count from question_versions where question_id = $1",
    [questionId],
  );
  return Number(result.rows[0].count);
}

describe("PostgresQuestionUnitOfWork", () => {
  it("commits both writes together: the new question_versions row and the repointed current_version_id both persist", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const questionId = await insertQuestion(db, courseId);

    const versionId = await uow.runInTransaction(async (repos) => {
      const { id } = await repos.questions.insertVersion(
        questionId,
        {
          topicId: topic.id,
          prompt: "What is 2+2?",
          questionType: "SINGLE_CHOICE",
          answerOptions: [
            { id: "a", content: "3" },
            { id: "b", content: "4" },
          ],
          correctOptionIds: ["b"],
          explanation: null,
        },
        1,
      );
      await repos.questions.setCurrentVersionAndClearDraft(questionId, id);
      return id;
    });

    expect(await versionCount(questionId)).toBe(1);
    const questionRow = await db.query<{ current_version_id: string }>(
      "select current_version_id from questions where id = $1",
      [questionId],
    );
    expect(questionRow.rows[0].current_version_id).toBe(versionId);
  });

  it("rolls back the version insert when the transaction fails before commit — current_version_id never repoints to an orphan", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const questionId = await insertQuestion(db, courseId);

    await expect(
      uow.runInTransaction(async (repos) => {
        await repos.questions.insertVersion(
          questionId,
          {
            topicId: topic.id,
            prompt: "Doomed version",
            questionType: "SINGLE_CHOICE",
            answerOptions: [
              { id: "a", content: "3" },
              { id: "b", content: "4" },
            ],
            correctOptionIds: ["b"],
            explanation: null,
          },
          1,
        );
        throw new Error("simulated failure after the version insert, before repointing current_version_id");
      }),
    ).rejects.toThrow("simulated failure");

    expect(await versionCount(questionId)).toBe(0);
    const questionRow = await db.query<{ current_version_id: string | null }>(
      "select current_version_id from questions where id = $1",
      [questionId],
    );
    expect(questionRow.rows[0].current_version_id).toBeNull();
  });

  it("publishQuestion (the real use case, wired to real repositories): first publish persists version 1 and repoints atomically", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const questionRepo = new PostgresQuestionRepository(db);
    const draft = await questionRepo.createDraft({ courseId });
    await questionRepo.updateDraft(draft.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });

    const result = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId: draft.id },
      uow,
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
    expect(await versionCount(draft.id)).toBe(1);
  });

  it("publishQuestion re-publish: inserts version 2, repoints current, and leaves version 1 unchanged — old Attempt/DailyPlanItem references stay valid by construction", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const questionRepo = new PostgresQuestionRepository(db);
    const draft = await questionRepo.createDraft({ courseId });
    await questionRepo.updateDraft(draft.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });
    const first = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId: draft.id },
      uow,
    );
    expect(first.outcome).toBe("PUBLISHED");
    if (first.outcome !== "PUBLISHED") throw new Error("unreachable");
    const firstVersionRow = await db.query<{ prompt: string }>(
      "select prompt from question_versions where id = $1",
      [first.versionId],
    );

    // A real re-edit resupplies full content: publish already cleared every
    // draft_* column back to null (`setCurrentVersionAndClearDraft`), so the
    // editor UI re-seeds the form from `publishedContent` before the
    // instructor edits it further (`questions/[questionId]/page.tsx`'s own
    // "reopen/edit" seeding) — a partial `updateDraft` here would leave the
    // other fields null, which is not what this test means to exercise.
    await questionRepo.updateDraft(draft.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 3+3?",
      answerOptions: [
        { id: "a", content: "5" },
        { id: "b", content: "6" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });
    const second = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId: draft.id },
      uow,
    );

    expect(second.outcome).toBe("PUBLISHED");
    if (second.outcome !== "PUBLISHED") throw new Error("unreachable");
    expect(second.versionId).not.toBe(first.versionId);
    expect(await versionCount(draft.id)).toBe(2);

    const firstVersionRowAfter = await db.query<{ prompt: string; version_number: number }>(
      "select prompt, version_number from question_versions where id = $1",
      [first.versionId],
    );
    expect(firstVersionRowAfter.rows[0].prompt).toBe(firstVersionRow.rows[0].prompt);
    expect(firstVersionRowAfter.rows[0].version_number).toBe(1);

    const secondVersionRow = await db.query<{ version_number: number }>(
      "select version_number from question_versions where id = $1",
      [second.versionId],
    );
    expect(secondVersionRow.rows[0].version_number).toBe(2);
  });

  it("publishQuestion rejects publish on an ARCHIVED Course and creates no version row", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId, { status: "ARCHIVED" });
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const questionId = await insertQuestion(db, courseId);

    const result = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId },
      uow,
    );

    expect(result.outcome).toBe("COURSE_ARCHIVED");
    expect(await versionCount(questionId)).toBe(0);
  });

  it("publishQuestion returns NOT_READY for an invalid draft (real Postgres round trip) and creates no version row", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const questionId = await insertQuestion(db, courseId);

    const result = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId },
      uow,
    );

    expect(result.outcome).toBe("NOT_READY");
    expect(await versionCount(questionId)).toBe(0);
  });

  it("publishQuestion returns NOTHING_TO_PUBLISH for a plain PUBLISHED Question with no pending draft", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);

    const result = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId },
      uow,
    );

    expect(result.outcome).toBe("NOTHING_TO_PUBLISH");
    expect(await versionCount(questionId)).toBe(1);
  });

  it("publishQuestion denies an unauthorized caller (no membership) and creates no version row", async () => {
    const ownerId = await insertUser(db);
    const strangerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const questionId = await insertQuestion(db, courseId);

    const result = await publishQuestion(
      { actorUserId: strangerId, courseId, questionId },
      uow,
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    expect(await versionCount(questionId)).toBe(0);
  });

  it("re-publish preserves a historical Attempt's reference to the OLD QuestionVersion (CHATGPT_PLAN.md S5 'historical Attempt reference preserved')", async () => {
    const ownerId = await insertUser(db);
    const learnerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await insertCourseMembership(db, { userId: ownerId, courseId, role: "OWNER" });
    const topicRepo = new PostgresTopicRepository(db);
    const topic = await topicRepo.createTopic({ courseId, name: "Algebra" });
    const questionRepo = new PostgresQuestionRepository(db);
    const draft = await questionRepo.createDraft({ courseId });
    await questionRepo.updateDraft(draft.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2+2?",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });
    const first = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId: draft.id },
      uow,
    );
    expect(first.outcome).toBe("PUBLISHED");
    if (first.outcome !== "PUBLISHED") throw new Error("unreachable");

    // A real learner Attempt, referencing version 1 exactly as
    // `submitAnswer` would persist it — not a raw SQL fixture, so this
    // proves the actual `attempts.question_version_id` FK relationship
    // this test cares about.
    const attemptRepo = new PostgresAttemptRepository(db);
    const attempt: Attempt = {
      id: randomUUID(),
      submissionId: randomToken("submission"),
      userId: learnerId,
      courseId,
      questionId: draft.id,
      questionVersionId: first.versionId,
      answeredAt: new Date("2026-01-01T00:00:00Z"),
      isCorrect: true,
      selectedAnswer: "b",
      confidenceLevel: "high",
      responseTimeSeconds: 4.5,
      dailyPlanId: null,
      dailyPlanItemId: null,
      learningSessionId: randomToken("session"),
      assistanceUsed: "NONE",
      attemptNumberForPresentedItem: 1,
      suspiciousTiming: false,
      answerWasRevealedBeforeResponse: false,
      engineVersion: "test-engine-v1",
    };
    const { wasNew } = await attemptRepo.insertIfNotExists(attempt);
    expect(wasNew).toBe(true);

    // Re-publish: a real re-edit resupplies full content, exactly as the
    // editor UI's "reopen/edit" seeding does.
    await questionRepo.updateDraft(draft.id, {
      topicId: topic.id,
      questionType: "SINGLE_CHOICE",
      prompt: "What is 3+3?",
      answerOptions: [
        { id: "a", content: "5" },
        { id: "b", content: "6" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });
    const second = await publishQuestion(
      { actorUserId: ownerId, courseId, questionId: draft.id },
      uow,
    );
    expect(second.outcome).toBe("PUBLISHED");
    if (second.outcome !== "PUBLISHED") throw new Error("unreachable");
    expect(second.versionId).not.toBe(first.versionId);

    // The Attempt row (and its FK to the now-superseded version 1) survives
    // the re-publish untouched — no cascade, no rewrite.
    const { attempt: reread } = await attemptRepo.insertIfNotExists(attempt);
    expect(reread.questionVersionId).toBe(first.versionId);
    const attemptRow = await db.query<{ question_version_id: string }>(
      "select question_version_id from attempts where id = $1",
      [attempt.id],
    );
    expect(attemptRow.rows[0].question_version_id).toBe(first.versionId);
  });
});

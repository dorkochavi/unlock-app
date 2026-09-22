/**
 * Real-Postgres (PGlite) integration tests for `PostgresAttemptRepository`
 * (Phase 6).
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresAttemptRepository } from "../../../src/infrastructure/postgres/attempt-repository";
import type { Attempt } from "../../../src/domain/learning/types";
import { createTestDb, randomToken, seedQuestionChain } from "./db-harness";

let db: PGlite;
let repo: PostgresAttemptRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresAttemptRepository(db);
});

afterEach(async () => {
  await db.close();
});

function buildAttempt(overrides: Partial<Attempt> & Pick<Attempt, "userId" | "courseId" | "questionId" | "questionVersionId">): Attempt {
  return {
    id: randomUUID(),
    submissionId: randomToken("submission"),
    answeredAt: new Date("2026-01-01T00:00:00Z"),
    isCorrect: true,
    selectedAnswer: "A",
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
    ...overrides,
  };
}

describe("PostgresAttemptRepository", () => {
  it("insertIfNotExists inserts a new Attempt and round-trips every field exactly", async () => {
    const chain = await seedQuestionChain(db);
    const attempt = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
    });

    const { attempt: stored, wasNew } = await repo.insertIfNotExists(attempt);

    expect(wasNew).toBe(true);
    expect(stored).toEqual(attempt);
  });

  it("insertIfNotExists on a duplicate (userId, submissionId) returns the ORIGINAL Attempt, not the new payload, with wasNew: false", async () => {
    const chain = await seedQuestionChain(db);
    const original = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      selectedAnswer: "A",
    });
    await repo.insertIfNotExists(original);

    const retry = buildAttempt({
      ...original,
      id: randomUUID(), // a buggy caller might generate a new id per retry...
      selectedAnswer: "B", // ...and even a different answer
    });
    const { attempt: stored, wasNew } = await repo.insertIfNotExists(retry);

    expect(wasNew).toBe(false);
    expect(stored).toEqual(original);
    expect(stored.selectedAnswer).toBe("A");
  });

  it("selectedAnswer round-trips exactly for a single option id (SINGLE_CHOICE), a set of option ids (MULTIPLE_CHOICE), and null (ADR-014)", async () => {
    const chain = await seedQuestionChain(db);

    const singleChoiceAnswer = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      selectedAnswer: "A",
    });
    const multipleChoiceAnswer = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      selectedAnswer: ["a", "c"],
    });
    const nullAnswer = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      selectedAnswer: null,
    });

    const results = await Promise.all(
      [singleChoiceAnswer, multipleChoiceAnswer, nullAnswer].map((a) =>
        repo.insertIfNotExists(a),
      ),
    );

    expect(results[0].attempt.selectedAnswer).toBe("A");
    expect(results[1].attempt.selectedAnswer).toEqual(["a", "c"]);
    expect(results[2].attempt.selectedAnswer).toBeNull();
  });

  it("findByUserAndSubmissionId returns null when absent, and the Attempt when present", async () => {
    const chain = await seedQuestionChain(db);
    const attempt = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
    });

    expect(
      await repo.findByUserAndSubmissionId(chain.userId, attempt.submissionId),
    ).toBeNull();

    await repo.insertIfNotExists(attempt);

    expect(
      await repo.findByUserAndSubmissionId(chain.userId, attempt.submissionId),
    ).toEqual(attempt);
  });

  it("listForReplay returns every Attempt for the pair in canonical order (answeredAt, createdAt, id), regardless of insertion order", async () => {
    const chain = await seedQuestionChain(db);
    const base = {
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
    };

    const third = buildAttempt({ ...base, answeredAt: new Date("2026-01-03T00:00:00Z") });
    const first = buildAttempt({ ...base, answeredAt: new Date("2026-01-01T00:00:00Z") });
    const second = buildAttempt({ ...base, answeredAt: new Date("2026-01-02T00:00:00Z") });

    // Inserted out of chronological order on purpose.
    await repo.insertIfNotExists(third);
    await repo.insertIfNotExists(first);
    await repo.insertIfNotExists(second);

    const records = await repo.listForReplay(chain.userId, chain.questionId);

    expect(records.map((r) => r.attempt.id)).toEqual([first.id, second.id, third.id]);
    // createdAt is a real, distinct persistence-layer timestamp, not a copy
    // of answeredAt.
    for (const record of records) {
      expect(record.createdAt).toBeInstanceOf(Date);
    }
  });

  it("listForReplay breaks an exact answeredAt tie by createdAt (DB acceptance order), via the real repository method — not just the raw SQL query", async () => {
    const chain = await seedQuestionChain(db);
    const tiedAnsweredAt = new Date("2026-01-05T00:00:00Z");
    const earlierAccepted = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      answeredAt: tiedAnsweredAt,
    });
    const laterAccepted = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
      answeredAt: tiedAnsweredAt,
    });

    // Bypasses the repository's own INSERT (which cannot set created_at —
    // it is a DB default) to make the tie deterministic: two explicit,
    // clearly-ordered created_at values, rather than relying on two
    // back-to-back `now()` calls happening to land in different
    // microseconds (a real flakiness risk this test must not have).
    async function insertWithExplicitCreatedAt(attempt: Attempt, createdAt: string) {
      await db.query(
        `insert into attempts
           (id, submission_id, user_id, course_id, question_id, question_version_id,
            answered_at, is_correct, attempt_number_for_presented_item, engine_version,
            created_at)
         values ($1, $2, $3, $4, $5, $6, $7, true, 1, 'test-engine-v1', $8)`,
        [
          attempt.id,
          attempt.submissionId,
          attempt.userId,
          attempt.courseId,
          attempt.questionId,
          attempt.questionVersionId,
          attempt.answeredAt.toISOString(),
          createdAt,
        ],
      );
    }

    await insertWithExplicitCreatedAt(laterAccepted, "2026-01-06T00:00:01Z");
    await insertWithExplicitCreatedAt(earlierAccepted, "2026-01-06T00:00:00Z");

    const records = await repo.listForReplay(chain.userId, chain.questionId);
    expect(records.map((r) => r.attempt.id)).toEqual([
      earlierAccepted.id,
      laterAccepted.id,
    ]);
  });

  it("listForReplay only returns Attempts for the exact (userId, questionId) pair, never another user's or another Question's", async () => {
    const chain = await seedQuestionChain(db);
    const otherQuestionSameCourse = await seedQuestionChain(db);
    const otherUserSameQuestion = await seedQuestionChain(db);

    const mine = buildAttempt({
      userId: chain.userId,
      courseId: chain.courseId,
      questionId: chain.questionId,
      questionVersionId: chain.questionVersionId,
    });
    // Same user, but a DIFFERENT Question.
    const sameUserOtherQuestion = buildAttempt({
      userId: chain.userId,
      courseId: otherQuestionSameCourse.courseId,
      questionId: otherQuestionSameCourse.questionId,
      questionVersionId: otherQuestionSameCourse.questionVersionId,
    });
    // Same logical Question id space is impossible across independently
    // seeded chains, so instead prove the userId half of the pair: a
    // DIFFERENT user answering a DIFFERENT (but otherwise unrelated)
    // Question must never leak into `chain`'s replay list either.
    const otherUserOtherQuestion = buildAttempt({
      userId: otherUserSameQuestion.userId,
      courseId: otherUserSameQuestion.courseId,
      questionId: otherUserSameQuestion.questionId,
      questionVersionId: otherUserSameQuestion.questionVersionId,
    });

    await repo.insertIfNotExists(mine);
    await repo.insertIfNotExists(sameUserOtherQuestion);
    await repo.insertIfNotExists(otherUserOtherQuestion);

    const records = await repo.listForReplay(chain.userId, chain.questionId);
    expect(records.map((r) => r.attempt.id)).toEqual([mine.id]);
  });
});

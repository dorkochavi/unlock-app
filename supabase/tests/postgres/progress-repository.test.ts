/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresUserQuestionProgressRepository` (Phase 7).
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresUserQuestionProgressRepository } from "../../../src/infrastructure/postgres/progress-repository";
import type { UserQuestionProgress } from "../../../src/domain/learning/types";
import { createTestDb, insertQuestion, insertUser, seedQuestionChain } from "./db-harness";

let db: PGlite;
let repo: PostgresUserQuestionProgressRepository;

beforeEach(async () => {
  db = await createTestDb();
  repo = new PostgresUserQuestionProgressRepository(db);
});

afterEach(async () => {
  await db.close();
});

function buildProgress(
  overrides: Partial<UserQuestionProgress> & Pick<UserQuestionProgress, "userId" | "questionId">,
): UserQuestionProgress {
  return {
    attemptCount: 1,
    correctCount: 1,
    lastAttemptAt: new Date("2026-01-01T00:00:00Z"),
    lastCorrectAt: new Date("2026-01-01T00:00:00Z"),
    lastIncorrectAt: null,
    memory: null,
    retrievalBaselineAt: null,
    retrievalBaselineLearningSessionId: null,
    successfulSpacedRetrievals: 0,
    lapseCount: 0,
    lastLapseAt: null,
    misconceptionState: "none",
    misconceptionScore: 0,
    misconceptionLastSeenAt: null,
    timedAttemptCount: 0,
    averageResponseTimeSeconds: null,
    meaningfulAttemptCount: 1,
    assistedAttemptCount: 0,
    lowQualityAttemptCount: 0,
    invalidForMasteryAttemptCount: 0,
    firstMeaningfulEvidenceAt: new Date("2026-01-01T00:00:00Z"),
    lastMeaningfulEvidenceAt: new Date("2026-01-01T00:00:00Z"),
    evidenceStrength: "early",
    masteryCategory: "learning",
    engineVersion: "test-engine-v1",
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("PostgresUserQuestionProgressRepository", () => {
  it("getForUpdate returns null when no progress row exists yet", async () => {
    const chain = await seedQuestionChain(db);
    expect(await repo.getForUpdate(chain.userId, chain.questionId)).toBeNull();
  });

  it("upsert inserts a new row, and getForUpdate reads it back with every field exact", async () => {
    const chain = await seedQuestionChain(db);
    const progress = buildProgress({ userId: chain.userId, questionId: chain.questionId });

    await repo.upsert(progress);

    expect(await repo.getForUpdate(chain.userId, chain.questionId)).toEqual(progress);
  });

  it("upsert on an existing row updates in place (no duplicate row, ON CONFLICT DO UPDATE)", async () => {
    const chain = await seedQuestionChain(db);
    const first = buildProgress({ userId: chain.userId, questionId: chain.questionId, attemptCount: 1, correctCount: 1 });
    await repo.upsert(first);

    const second = buildProgress({
      userId: chain.userId,
      questionId: chain.questionId,
      attemptCount: 2,
      correctCount: 2,
      meaningfulAttemptCount: 2,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    await repo.upsert(second);

    const result = await repo.getForUpdate(chain.userId, chain.questionId);
    expect(result).toEqual(second);

    const countResult = await db.query<{ count: string }>(
      "select count(*)::int as count from user_question_progress where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(Number(countResult.rows[0].count)).toBe(1);
  });

  it("memory (SchedulerMemoryState) round-trips exactly, including the opaque implementationState.state bag", async () => {
    const chain = await seedQuestionChain(db);
    const progress = buildProgress({
      userId: chain.userId,
      questionId: chain.questionId,
      memory: {
        stability: 3.2,
        difficulty: 5.1,
        scheduledReviewAt: new Date("2026-02-01T00:00:00Z"),
        lastReviewAt: new Date("2026-01-15T00:00:00Z"),
        reviewCount: 4,
        lapseCount: 1,
        implementationState: {
          implementation: "ts-fsrs",
          schemaVersion: 1,
          state: {
            due: "2026-02-01T00:00:00.000Z",
            stability: 3.2,
            difficulty: 5.1,
            elapsed_days: 10,
            scheduled_days: 14,
            learning_steps: 0,
            reps: 4,
            lapses: 1,
            state: "Review",
            last_review: "2026-01-15T00:00:00.000Z",
          },
        },
      },
    });

    await repo.upsert(progress);

    const result = await repo.getForUpdate(chain.userId, chain.questionId);
    expect(result?.memory).toEqual(progress.memory);
  });

  it("memory round-trips null (no ratable evidence yet) as null, not a partially-populated object", async () => {
    const chain = await seedQuestionChain(db);
    const progress = buildProgress({ userId: chain.userId, questionId: chain.questionId, memory: null });

    await repo.upsert(progress);

    expect((await repo.getForUpdate(chain.userId, chain.questionId))?.memory).toBeNull();
  });

  it("listForUser returns progress rows scoped to the given Course only (via question_id -> questions.course_id)", async () => {
    const chain = await seedQuestionChain(db);
    const otherCourseChain = await seedQuestionChain(db);
    // Reuse the same user across two different Courses.
    const secondQuestionInSameCourse = await insertQuestion(db, chain.courseId);

    await repo.upsert(buildProgress({ userId: chain.userId, questionId: chain.questionId }));
    await repo.upsert(
      buildProgress({ userId: chain.userId, questionId: secondQuestionInSameCourse }),
    );
    await repo.upsert(
      buildProgress({ userId: chain.userId, questionId: otherCourseChain.questionId }),
    );

    const forChainCourse = await repo.listForUser(chain.userId, chain.courseId);
    expect(new Set(forChainCourse.map((p) => p.questionId))).toEqual(
      new Set([chain.questionId, secondQuestionInSameCourse]),
    );
  });

  it("listForUser never returns another user's progress even within the same Course", async () => {
    const chain = await seedQuestionChain(db);
    const otherUserId = await insertUser(db);
    // otherUserId has progress on the SAME Question, in the SAME Course.
    await repo.upsert(buildProgress({ userId: chain.userId, questionId: chain.questionId }));
    await repo.upsert(buildProgress({ userId: otherUserId, questionId: chain.questionId }));

    const result = await repo.listForUser(chain.userId, chain.courseId);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe(chain.userId);
  });

  it("getForUpdate throws (does not silently manufacture a value) when the scheduler-memory columns are only PARTIALLY populated — a real data-corruption shape the mapper must never paper over", async () => {
    const chain = await seedQuestionChain(db);
    await repo.upsert(buildProgress({ userId: chain.userId, questionId: chain.questionId }));

    // Bypass the repository entirely to simulate corruption: only
    // memory_stability is set, the other 7 scheduler-memory columns stay
    // null. No CHECK constraint in the migration forbids this combination
    // at the DB level (deliberately — see progress-mapper.ts's own doc
    // comment on why this is enforced in the mapper, not SQL), so this row
    // is only caught when read back.
    await db.query(
      "update user_question_progress set memory_stability = 3.5 where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );

    await expect(repo.getForUpdate(chain.userId, chain.questionId)).rejects.toThrow(
      /expected all-or-none of the scheduler-memory columns to be non-null/,
    );
  });

  it("evidence-quality counters round-trip at the zero boundary (a legitimate all-zero row)", async () => {
    const chain = await seedQuestionChain(db);
    const progress = buildProgress({
      userId: chain.userId,
      questionId: chain.questionId,
      attemptCount: 0,
      correctCount: 0,
      meaningfulAttemptCount: 0,
      assistedAttemptCount: 0,
      lowQualityAttemptCount: 0,
      invalidForMasteryAttemptCount: 0,
      lastAttemptAt: null,
      lastCorrectAt: null,
      firstMeaningfulEvidenceAt: null,
      lastMeaningfulEvidenceAt: null,
      evidenceStrength: "insufficient",
      masteryCategory: "not_started",
    });

    await repo.upsert(progress);
    expect(await repo.getForUpdate(chain.userId, chain.questionId)).toEqual(progress);
  });
});

/**
 * Real-Postgres (PGlite) integration tests for `PostgresUnitOfWork` and
 * `acquireLearnerQuestionLock` (Phases 10-11).
 *
 * What this file DOES prove, against a real PostgreSQL engine: BEGIN/
 * COMMIT/ROLLBACK actually happen; a thrown error inside the transaction
 * callback actually rolls back every write made so far in it, including
 * across multiple repositories; `pg_advisory_xact_lock(hashtextextended(...))`
 * is valid, executable SQL that a real Postgres engine accepts.
 *
 * What this file does NOT and CANNOT prove (see `postgres-unit-of-work.ts`'s
 * own doc comment): that the advisory lock actually BLOCKS a second,
 * concurrent transaction. PGlite is
 * a single in-process WASM engine with no second concurrent backend to
 * contend with — there is no meaningful way to open two truly concurrent
 * transactions against it. That specific property requires a real
 * multi-connection Postgres instance and is recorded as a follow-up
 * requirement, not faked here.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { TransactionalRepositories } from "../../../src/application/learning/ports";
import { pgliteConnectionProvider } from "./db-harness";
import {
  acquireLearnerQuestionLock,
  PostgresUnitOfWork,
} from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import type { SqlExecutor } from "../../../src/infrastructure/postgres/sql-executor";
import {
  createTestDb,
  insertCourse,
  insertQuestion,
  insertQuestionVersion,
  insertUser,
  setCurrentVersion,
} from "./db-harness";
import type { Attempt } from "../../../src/domain/learning/types";

let db: PGlite;
let uow: PostgresUnitOfWork;

beforeEach(async () => {
  db = await createTestDb();
  uow = new PostgresUnitOfWork(pgliteConnectionProvider(db));
});

afterEach(async () => {
  await db.close();
});

function buildAttempt(
  overrides: Partial<Attempt> &
    Pick<Attempt, "userId" | "courseId" | "questionId" | "questionVersionId">,
): Attempt {
  return {
    id: randomUUID(),
    submissionId: randomUUID(),
    answeredAt: new Date("2026-01-01T00:00:00Z"),
    isCorrect: true,
    selectedAnswer: "A",
    confidenceLevel: null,
    responseTimeSeconds: null,
    todaySessionId: null,
    todaySessionItemId: null,
    learningSessionId: null,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "test-engine-v1",
    ...overrides,
  };
}

describe("PostgresUnitOfWork", () => {
  it("commits every write made inside a successful transaction", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);
    const attempt = buildAttempt({
      userId,
      courseId,
      questionId,
      questionVersionId: versionId,
    });

    await uow.runInTransaction(async (repos: TransactionalRepositories) => {
      await repos.acquireLearnerQuestionLock(userId, questionId);
      await repos.attempts.insertIfNotExists(attempt);
    });

    const result = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where id = $1",
      [attempt.id],
    );
    expect(Number(result.rows[0].count)).toBe(1);
  });

  it("rolls back EVERY write made inside the transaction when the callback throws, including across two different repositories in the same transaction", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);
    const versionId = await insertQuestionVersion(db, questionId);
    await setCurrentVersion(db, questionId, versionId);
    const attempt = buildAttempt({
      userId,
      courseId,
      questionId,
      questionVersionId: versionId,
    });

    class BoomError extends Error {}

    await expect(
      uow.runInTransaction(async (repos) => {
        await repos.acquireLearnerQuestionLock(userId, questionId);
        await repos.attempts.insertIfNotExists(attempt);
        await repos.progress.upsert({
          userId,
          questionId,
          attemptCount: 1,
          correctCount: 1,
          lastAttemptAt: attempt.answeredAt,
          lastCorrectAt: attempt.answeredAt,
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
          firstMeaningfulEvidenceAt: attempt.answeredAt,
          lastMeaningfulEvidenceAt: attempt.answeredAt,
          evidenceStrength: "early",
          masteryCategory: "learning",
          engineVersion: "test-engine-v1",
          updatedAt: attempt.answeredAt,
        });
        // Simulate a failure AFTER two different repositories have already
        // written inside this same transaction (e.g. the Today-item-update
        // step failing) — both writes above must be rolled back together.
        throw new BoomError("simulated mid-transaction failure");
      }),
    ).rejects.toThrow(BoomError);

    const attemptCount = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where id = $1",
      [attempt.id],
    );
    const progressCount = await db.query<{ count: string }>(
      "select count(*)::int as count from user_question_progress where user_id = $1 and question_id = $2",
      [userId, questionId],
    );
    expect(Number(attemptCount.rows[0].count)).toBe(0);
    expect(Number(progressCount.rows[0].count)).toBe(0);
  });

  it("re-throws the original error after rollback — it is never swallowed", async () => {
    class SpecificError extends Error {
      constructor() {
        super("specific failure marker");
      }
    }

    await expect(
      uow.runInTransaction(async () => {
        throw new SpecificError();
      }),
    ).rejects.toThrow("specific failure marker");
  });

  it("acquireLearnerQuestionLock is valid, executable SQL against a real Postgres engine (pg_advisory_xact_lock/hashtextextended)", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionId = await insertQuestion(db, courseId);

    await uow.runInTransaction(async (repos) => {
      await expect(
        repos.acquireLearnerQuestionLock(userId, questionId),
      ).resolves.toBeUndefined();
    });
  });

  it("acquireLearnerQuestionLock (via the exported function) does not throw for two DIFFERENT pairs in sequence — same connection, no self-deadlock", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const questionA = await insertQuestion(db, courseId);
    const questionB = await insertQuestion(db, courseId);

    await uow.runInTransaction(async () => {
      const executor = db as unknown as SqlExecutor;
      await acquireLearnerQuestionLock(executor, userId, questionA);
      await acquireLearnerQuestionLock(executor, userId, questionB);
    });
  });
});

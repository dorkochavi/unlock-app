/**
 * Real-Postgres (PGlite) integration test for the `skipDailyPlanItem`
 * application use case (ADR-016, Night-Run Slice 3), wired to the REAL
 * `PostgresDailyPlanRepository` — no fake/test-double port.
 *
 * `skipDailyPlanItem` needs no `UnitOfWork`/transaction (see its own module
 * doc comment) — `PostgresDailyPlanRepository` is constructed directly
 * against the plain PGlite instance, the same "plain read/write" pattern
 * production `route.ts` uses against the real `pg.Pool`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { skipDailyPlanItem } from "../../../src/application/dailyPlan/skip-daily-plan-item";
import { submitAnswer, type SubmitAnswerContext } from "../../../src/application/learning/submit-answer";
import { PostgresDailyPlanRepository } from "../../../src/infrastructure/postgres/daily-plan-repository";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import {
  createTestDb,
  insertUser,
  pgliteConnectionProvider,
  seedDailyPlanWithItem,
  seedQuestionChain,
} from "./db-harness";

const NOW = new Date("2026-02-01T00:00:00.000Z");

let db: PGlite;
let dailyPlanItems: PostgresDailyPlanRepository;

beforeEach(async () => {
  db = await createTestDb();
  dailyPlanItems = new PostgresDailyPlanRepository(db);
});

afterEach(async () => {
  await db.close();
});

function makeContext(): SubmitAnswerContext {
  let counter = 0;
  return {
    now: NOW,
    engineVersion: "test-engine-v1",
    memoryScheduler: {
      initialize: () => {
        throw new Error("not used — Skip must never invoke the scheduler");
      },
      review: () => {
        throw new Error("not used — Skip must never invoke the scheduler");
      },
      estimateRetrievability: () => 0.9,
    },
    retrievalQualificationPolicy: { minGapMsForSpacedRetrieval: 86400000 },
    evidenceStrengthPolicy: {
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 3,
      minMeaningfulAttemptsForStrong: 5,
      minSpacedRetrievalsForModerate: 1,
      minSpacedRetrievalsForStrong: 3,
      minObservationSpanMsForStrong: 3 * 86400000,
    },
    masteryPolicy: {
      minSpacedRetrievalsForStrengthening: 1,
      minSpacedRetrievalsForMastered: 3,
      minEvidenceStrengthForMastered: "strong",
      minRetrievabilityForMastered: 0.8,
    },
    misconceptionPolicy: {
      confidentErrorScoreIncrement: 2,
      recoveryScoreDecrement: 1,
      minScore: 0,
      maxScore: 10,
      suspectedScoreThreshold: 2,
      activeScoreThreshold: 4,
      resolvedScoreThreshold: 0,
    },
    generateId: () => `attempt-${++counter}`,
    determineSuspiciousTiming: () => false,
  };
}

describe("skipDailyPlanItem against real Postgres infrastructure", () => {
  it("owner can skip a real pending item: SKIPPED, item row updated correctly", async () => {
    const chain = await seedQuestionChain(db);
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    const result = await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );

    expect(result.kind).toBe("SKIPPED");

    const itemRow = await db.query<{
      status: string;
      resolved_at: string | null;
      completed_at: string | null;
    }>(
      "select status, resolved_at, completed_at from daily_plan_items where id = $1",
      [dailyPlanItemId],
    );
    expect(itemRow.rows[0].status).toBe("skipped");
    expect(itemRow.rows[0].resolved_at).not.toBeNull();
    expect(itemRow.rows[0].completed_at).toBeNull();
  });

  it("a DIFFERENT user cannot skip: ITEM_NOT_FOUND_OR_NOT_OWNED, item remains pending", async () => {
    const chain = await seedQuestionChain(db);
    const otherUserId = await insertUser(db);
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    const result = await skipDailyPlanItem(
      { userId: otherUserId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );

    expect(result.kind).toBe("ITEM_NOT_FOUND_OR_NOT_OWNED");
    const itemRow = await db.query<{ status: string }>(
      "select status from daily_plan_items where id = $1",
      [dailyPlanItemId],
    );
    expect(itemRow.rows[0].status).toBe("pending");
  });

  it("skipping creates no Attempt and no UserQuestionProgress row — no correctness evidence, no scheduler/mastery/misconception mutation", async () => {
    const chain = await seedQuestionChain(db);
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    const result = await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );
    expect(result.kind).toBe("SKIPPED");

    const attemptRows = await db.query("select id from attempts where user_id = $1", [
      chain.userId,
    ]);
    expect(attemptRows.rows).toHaveLength(0);

    const progressRows = await db.query(
      "select user_id from user_question_progress where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(progressRows.rows).toHaveLength(0);
  });

  it("duplicate skip has no extra effect: second call is ALREADY_RESOLVED with status skipped, resolved_at unchanged", async () => {
    const chain = await seedQuestionChain(db);
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    const first = await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );
    expect(first.kind).toBe("SKIPPED");

    const firstRow = await db.query<{ resolved_at: string }>(
      "select resolved_at from daily_plan_items where id = $1",
      [dailyPlanItemId],
    );

    const later = new Date(NOW.getTime() + 60000);
    const second = await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: later },
      { dailyPlanItems },
    );

    expect(second.kind).toBe("ALREADY_RESOLVED");
    if (second.kind === "ALREADY_RESOLVED") {
      expect(second.status).toBe("skipped");
    }
    const secondRow = await db.query<{ resolved_at: string }>(
      "select resolved_at from daily_plan_items where id = $1",
      [dailyPlanItemId],
    );
    expect(secondRow.rows[0].resolved_at).toEqual(firstRow.rows[0].resolved_at);
  });

  it("a skipped item cannot then be answered — submitAnswer rejects it as DAILY_PLAN_ITEM_ALREADY_RESOLVED (status skipped)", async () => {
    const chain = await seedQuestionChain(db);
    const { dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    const skipResult = await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );
    expect(skipResult.kind).toBe("SKIPPED");

    const uow = new PostgresUnitOfWork(pgliteConnectionProvider(db));
    const answerResult = await submitAnswer(
      {
        submissionId: "sub-after-skip",
        userId: chain.userId,
        courseId: chain.courseId,
        questionId: chain.questionId,
        questionVersionId: chain.questionVersionId,
        answeredAt: NOW,
        selectedAnswer: "A",
        confidenceLevel: null,
        responseTimeSeconds: null,
        todaySessionId: null,
        todaySessionItemId: null,
        dailyPlanId: null,
        dailyPlanItemId,
        learningSessionId: null,
        assistanceUsed: "NONE",
        attemptNumberForPresentedItem: 1,
        answerWasRevealedBeforeResponse: false,
      },
      makeContext(),
      uow,
    );

    expect(answerResult.kind).toBe("DAILY_PLAN_ITEM_ALREADY_RESOLVED");
    if (answerResult.kind === "DAILY_PLAN_ITEM_ALREADY_RESOLVED") {
      expect(answerResult.status).toBe("skipped");
    }
    const attemptRows = await db.query("select id from attempts where user_id = $1", [
      chain.userId,
    ]);
    expect(attemptRows.rows).toHaveLength(0);
  });

  it("no replacement item is created, and the frozen plan's item set is unchanged after a skip", async () => {
    const chain = await seedQuestionChain(db);
    const { dailyPlanId, dailyPlanItemId } = await seedDailyPlanWithItem(db, chain);

    await skipDailyPlanItem(
      { userId: chain.userId, dailyPlanItemId, skippedAt: NOW },
      { dailyPlanItems },
    );

    const itemRows = await db.query<{ id: string }>(
      "select id from daily_plan_items where daily_plan_id = $1",
      [dailyPlanId],
    );
    expect(itemRows.rows).toHaveLength(1);
    expect(itemRows.rows[0].id).toBe(dailyPlanItemId);
  });
});

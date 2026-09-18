/**
 * Phase 12 — real-Postgres (PGlite) integration test for the `submitAnswer`
 * application use case (`src/application/learning/submit-answer.ts`)
 * wired to the REAL Postgres infrastructure built in this session:
 * `PostgresUnitOfWork`, `PostgresAttemptRepository`,
 * `PostgresUserQuestionProgressRepository`, `PostgresQuestionVersionRepository`,
 * `PostgresTodaySessionRepository`, and the real advisory lock.
 *
 * `AnswerCorrectnessChecker` is the ONE exception (Phase 8's documented
 * blocker — see PERSISTENCE_IMPLEMENTATION_REPORT.md): the `answer_options`/
 * `correct_answer` JSON shape on `question_versions` is still an open
 * content-format decision, so a real Postgres implementation cannot be
 * written honestly. `FakeAnswerCorrectnessChecker` below is a plain test
 * double standing in for exactly that one port — clearly labeled as such —
 * while every OTHER port in this test is the real Postgres adapter. This
 * matches the task's own instruction: a blocker in one path is not
 * permission to skip integration-testing everything else.
 *
 * Policy values mirror `src/application/learning/__tests__/
 * submit-answer.test.ts`'s own fixtures exactly, so this suite is testing
 * REAL PERSISTENCE behavior under the same policy configuration already
 * covered by the in-memory unit suite — not a different, undocumented
 * policy universe.
 */
import type { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { EvidenceStrengthPolicy } from "../../../src/domain/learning/evidence-strength";
import type { MasteryPolicy } from "../../../src/domain/learning/mastery";
import type { MisconceptionPolicy } from "../../../src/domain/learning/misconception";
import type { RetrievalQualificationPolicy } from "../../../src/domain/learning/retrieval-qualification";
import { TsFsrsMemoryScheduler } from "../../../src/infrastructure/learning/fsrs/ts-fsrs-memory-scheduler";
import type { AnswerCorrectnessChecker } from "../../../src/application/learning/ports";
import type { UserQuestionProgress } from "../../../src/domain/learning/types";
import {
  submitAnswer,
  type SubmitAnswerCommand,
  type SubmitAnswerContext,
} from "../../../src/application/learning/submit-answer";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import {
  createTestDb,
  insertUser,
  pgliteConnectionProvider,
  seedQuestionChain,
  seedTodaySessionWithItem,
} from "./db-harness";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-02-01T00:00:00.000Z");

const RETRIEVAL_QUALIFICATION_POLICY: RetrievalQualificationPolicy = {
  minGapMsForSpacedRetrieval: 1 * DAY_MS,
};
const EVIDENCE_STRENGTH_POLICY: EvidenceStrengthPolicy = {
  minMeaningfulAttemptsForEarly: 1,
  minMeaningfulAttemptsForModerate: 3,
  minMeaningfulAttemptsForStrong: 5,
  minSpacedRetrievalsForModerate: 1,
  minSpacedRetrievalsForStrong: 3,
  minObservationSpanMsForStrong: 3 * DAY_MS,
};
const MASTERY_POLICY: MasteryPolicy = {
  minSpacedRetrievalsForStrengthening: 1,
  minSpacedRetrievalsForMastered: 3,
  minEvidenceStrengthForMastered: "strong",
  minRetrievabilityForMastered: 0.8,
};
const MISCONCEPTION_POLICY: MisconceptionPolicy = {
  confidentErrorScoreIncrement: 2,
  recoveryScoreDecrement: 1,
  minScore: 0,
  maxScore: 10,
  suspectedScoreThreshold: 2,
  activeScoreThreshold: 4,
  resolvedScoreThreshold: 0,
};

/** Test double for the one Postgres port this session cannot honestly
 * implement yet (Phase 8 blocker) — "B" is always wrong, everything else
 * is correct, which is enough to exercise both is_correct outcomes without
 * inventing a real answer-format decision. */
class FakeAnswerCorrectnessChecker implements AnswerCorrectnessChecker {
  async isCorrect(
    _questionVersionId: string,
    selectedAnswer: string | number | null,
  ): Promise<boolean> {
    if (selectedAnswer === "THROW") {
      throw new Error("simulated AnswerCorrectnessChecker failure");
    }
    return selectedAnswer !== "B";
  }
}

function withoutIdentity(
  progress: UserQuestionProgress,
): Partial<UserQuestionProgress> {
  const clone: Partial<UserQuestionProgress> = { ...progress };
  delete clone.userId;
  delete clone.questionId;
  return clone;
}

let db: PGlite;
let uow: PostgresUnitOfWork;

beforeEach(async () => {
  db = await createTestDb();
  uow = new PostgresUnitOfWork(
    pgliteConnectionProvider(db),
    new FakeAnswerCorrectnessChecker(),
  );
});

afterEach(async () => {
  await db.close();
});

function makeContext(overrides: Partial<SubmitAnswerContext> = {}): SubmitAnswerContext {
  return {
    now: NOW,
    engineVersion: "test-engine-v1",
    memoryScheduler: new TsFsrsMemoryScheduler(),
    retrievalQualificationPolicy: RETRIEVAL_QUALIFICATION_POLICY,
    evidenceStrengthPolicy: EVIDENCE_STRENGTH_POLICY,
    masteryPolicy: MASTERY_POLICY,
    misconceptionPolicy: MISCONCEPTION_POLICY,
    generateId: () => randomUUID(),
    determineSuspiciousTiming: () => false,
    ...overrides,
  };
}

function makeCommand(
  chain: { userId: string; courseId: string; questionId: string; questionVersionId: string },
  overrides: Partial<SubmitAnswerCommand> = {},
): SubmitAnswerCommand {
  return {
    submissionId: randomUUID(),
    userId: chain.userId,
    courseId: chain.courseId,
    questionId: chain.questionId,
    questionVersionId: chain.questionVersionId,
    answeredAt: NOW,
    selectedAnswer: "A",
    confidenceLevel: "medium",
    responseTimeSeconds: 10,
    todaySessionId: null,
    todaySessionItemId: null,
    learningSessionId: randomUUID(),
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    answerWasRevealedBeforeResponse: false,
    ...overrides,
  };
}

describe("submitAnswer against real Postgres infrastructure", () => {
  it("A. first answer is ACCEPTED and creates real Attempt + UserQuestionProgress rows", async () => {
    const chain = await seedQuestionChain(db);
    const command = makeCommand(chain);

    const result = await submitAnswer(command, makeContext(), uow);

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(result.wasIdempotentRetry).toBe(false);
    expect(result.progress.attemptCount).toBe(1);
    expect(result.progress.correctCount).toBe(1);

    const attemptRows = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(Number(attemptRows.rows[0].count)).toBe(1);
  });

  it("B. a chronological second answer updates progress incrementally (O(1) path, not a rebuild)", async () => {
    const chain = await seedQuestionChain(db);
    await submitAnswer(makeCommand(chain), makeContext(), uow);

    const second = await submitAnswer(
      makeCommand(chain, { answeredAt: new Date(NOW.getTime() + 2 * DAY_MS) }),
      makeContext({ now: new Date(NOW.getTime() + 2 * DAY_MS) }),
      uow,
    );

    expect(second.kind).toBe("ACCEPTED");
    if (second.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(second.wasReconciledViaRebuild).toBe(false);
    expect(second.progress.attemptCount).toBe(2);
  });

  it("C. a genuine retry (same submissionId, identical payload) returns the ORIGINAL result and inserts no second Attempt", async () => {
    const chain = await seedQuestionChain(db);
    const command = makeCommand(chain);

    const first = await submitAnswer(command, makeContext(), uow);
    const retry = await submitAnswer(command, makeContext(), uow);

    expect(retry.kind).toBe("ACCEPTED");
    if (retry.kind !== "ACCEPTED" || first.kind !== "ACCEPTED") {
      throw new Error("unreachable");
    }
    expect(retry.wasIdempotentRetry).toBe(true);
    expect(retry.attempt.id).toBe(first.attempt.id);

    const count = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(Number(count.rows[0].count)).toBe(1);
  });

  it("D. the same submissionId reused with a DIFFERENT selectedAnswer is an IDEMPOTENCY_KEY_CONFLICT, not a silent overwrite", async () => {
    const chain = await seedQuestionChain(db);
    const command = makeCommand(chain, { selectedAnswer: "A" });
    await submitAnswer(command, makeContext(), uow);

    const conflicting = await submitAnswer(
      { ...command, selectedAnswer: "B" },
      makeContext(),
      uow,
    );

    expect(conflicting.kind).toBe("IDEMPOTENCY_KEY_CONFLICT");
    if (conflicting.kind !== "IDEMPOTENCY_KEY_CONFLICT") throw new Error("unreachable");
    expect(conflicting.conflictingFields).toContain("selectedAnswer");
  });

  it("E. a questionVersionId belonging to a DIFFERENT Question is a QUESTION_VERSION_CONSISTENCY_VIOLATION", async () => {
    const chain = await seedQuestionChain(db);
    const otherChain = await seedQuestionChain(db);

    const result = await submitAnswer(
      makeCommand(chain, { questionVersionId: otherChain.questionVersionId }),
      makeContext(),
      uow,
    );

    expect(result.kind).toBe("QUESTION_VERSION_CONSISTENCY_VIOLATION");
  });

  it("F. a courseId that does not match the Question's real Course is a QUESTION_VERSION_CONSISTENCY_VIOLATION", async () => {
    const chain = await seedQuestionChain(db);
    const otherChain = await seedQuestionChain(db);

    const result = await submitAnswer(
      makeCommand(chain, { courseId: otherChain.courseId }),
      makeContext(),
      uow,
    );

    expect(result.kind).toBe("QUESTION_VERSION_CONSISTENCY_VIOLATION");
  });

  it("G. a todaySessionItemId owned by a DIFFERENT user is TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED", async () => {
    const chain = await seedQuestionChain(db);
    const { todaySessionId, todaySessionItemId } = await seedTodaySessionWithItem(db, chain);
    const otherUserId = await insertUser(db);

    const result = await submitAnswer(
      makeCommand(chain, {
        userId: otherUserId,
        todaySessionId,
        todaySessionItemId,
      }),
      makeContext(),
      uow,
    );

    expect(result.kind).toBe("TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED");
  });

  it("mutation-review: a todaySessionItemId that is real and owned by the right user, but paired with a DIFFERENT (also real) todaySessionId, is rejected — not silently accepted with a wrong session pointer", async () => {
    const chain = await seedQuestionChain(db);
    const { todaySessionItemId } = await seedTodaySessionWithItem(db, {
      ...chain,
      plannedForDate: "2026-01-10",
    });
    const { todaySessionId: otherSessionId } = await seedTodaySessionWithItem(db, {
      ...chain,
      plannedForDate: "2026-01-11", // a second, genuinely different session
    });

    // submit-answer.ts validates todaySessionItemId's ownership/question/
    // version against the item, but does not itself cross-check the
    // client's separately-supplied todaySessionId against that item's
    // real parent session — that invariant is the database's composite FK
    // (MATCH FULL fix, Phase-2-red-team item N). This proves the whole
    // stack (application + real Postgres) still rejects it end-to-end,
    // and that no Attempt is left half-committed.
    await expect(
      submitAnswer(
        makeCommand(chain, {
          todaySessionId: otherSessionId, // real, but NOT this item's session
          todaySessionItemId,
        }),
        makeContext(),
        uow,
      ),
    ).rejects.toThrow(/foreign key constraint/);

    const attemptCount = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(Number(attemptCount.rows[0].count)).toBe(0);
  });

  it("H. an out-of-order Attempt (earlier answeredAt than the current latest) is reconciled via synchronous rebuild", async () => {
    const chain = await seedQuestionChain(db);
    await submitAnswer(
      makeCommand(chain, { answeredAt: new Date(NOW.getTime() + 2 * DAY_MS) }),
      makeContext({ now: new Date(NOW.getTime() + 2 * DAY_MS) }),
      uow,
    );

    const outOfOrder = await submitAnswer(
      makeCommand(chain, { answeredAt: NOW }), // earlier than the Attempt above
      makeContext(),
      uow,
    );

    expect(outOfOrder.kind).toBe("ACCEPTED");
    if (outOfOrder.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(outOfOrder.wasReconciledViaRebuild).toBe(true);
    expect(outOfOrder.progress.attemptCount).toBe(2);
  });

  it("I. arrival order 1,3,2 produces the SAME final UserQuestionProgress as arrival order 1,2,3", async () => {
    const t1 = NOW;
    const t2 = new Date(NOW.getTime() + 1 * DAY_MS);
    const t3 = new Date(NOW.getTime() + 2 * DAY_MS);
    // Fixed, shared learningSessionIds per logical attempt (NOT
    // `randomUUID()` per call) — both simulations must use the exact same
    // three identities for the comparison below to mean anything; letting
    // `makeCommand`'s default (`randomUUID()` per call) apply here would
    // make `retrievalBaselineLearningSessionId` differ between simulations
    // for a trivial, uninteresting reason (different random tokens), not
    // because rebuild-vs-incremental actually disagreed.
    const session1 = "session-t1";
    const session2 = "session-t2";
    const session3 = "session-t3";

    // Simulation A: submitted in true chronological order 1, 2, 3.
    const chainA = await seedQuestionChain(db);
    await submitAnswer(
      makeCommand(chainA, { answeredAt: t1, learningSessionId: session1 }),
      makeContext(),
      uow,
    );
    await submitAnswer(
      makeCommand(chainA, { answeredAt: t2, learningSessionId: session2 }),
      makeContext(),
      uow,
    );
    const finalA = await submitAnswer(
      makeCommand(chainA, { answeredAt: t3, learningSessionId: session3 }),
      makeContext(),
      uow,
    );

    // Simulation B: submitted out of order — 1, 3, 2.
    const chainB = await seedQuestionChain(db);
    await submitAnswer(
      makeCommand(chainB, { answeredAt: t1, learningSessionId: session1 }),
      makeContext(),
      uow,
    );
    await submitAnswer(
      makeCommand(chainB, { answeredAt: t3, learningSessionId: session3 }),
      makeContext(),
      uow,
    );
    const finalB = await submitAnswer(
      makeCommand(chainB, { answeredAt: t2, learningSessionId: session2 }),
      makeContext(),
      uow,
    );

    if (finalA.kind !== "ACCEPTED" || finalB.kind !== "ACCEPTED") {
      throw new Error("unreachable");
    }
    // userId/questionId genuinely differ between the two independently
    // seeded chains — compare everything else.
    expect(withoutIdentity(finalA.progress)).toEqual(withoutIdentity(finalB.progress));
  });

  it("J. a Today-attached Attempt marks its TodaySessionItem completed in the same transaction", async () => {
    const chain = await seedQuestionChain(db);
    const { todaySessionId, todaySessionItemId } = await seedTodaySessionWithItem(db, chain);

    const result = await submitAnswer(
      makeCommand(chain, { todaySessionId, todaySessionItemId, learningSessionId: null }),
      makeContext(),
      uow,
    );

    expect(result.kind).toBe("ACCEPTED");
    const itemRow = await db.query<{ status: string; completed_at: string | null }>(
      "select status, completed_at from today_session_items where id = $1",
      [todaySessionItemId],
    );
    expect(itemRow.rows[0].status).toBe("completed");
    expect(itemRow.rows[0].completed_at).not.toBeNull();
  });

  it("K. a mid-transaction failure rolls back the already-inserted Attempt — nothing partial is committed", async () => {
    const chain = await seedQuestionChain(db);

    await expect(
      submitAnswer(
        makeCommand(chain, { selectedAnswer: "THROW" }),
        makeContext(),
        uow,
      ),
    ).rejects.toThrow("simulated AnswerCorrectnessChecker failure");

    const attemptCount = await db.query<{ count: string }>(
      "select count(*)::int as count from attempts where user_id = $1 and question_id = $2",
      [chain.userId, chain.questionId],
    );
    expect(Number(attemptCount.rows[0].count)).toBe(0);
  });

  it("L. manual-practice learningSessionId is client-owned: stored as given, and a retry claiming a DIFFERENT one is a conflict", async () => {
    const chain = await seedQuestionChain(db);
    const command = makeCommand(chain, { learningSessionId: "manual-token-1" });

    const first = await submitAnswer(command, makeContext(), uow);
    expect(first.kind).toBe("ACCEPTED");
    if (first.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(first.attempt.learningSessionId).toBe("manual-token-1");

    const conflicting = await submitAnswer(
      { ...command, learningSessionId: "manual-token-2" },
      makeContext(),
      uow,
    );
    expect(conflicting.kind).toBe("IDEMPOTENCY_KEY_CONFLICT");
    if (conflicting.kind !== "IDEMPOTENCY_KEY_CONFLICT") throw new Error("unreachable");
    expect(conflicting.conflictingFields).toContain("learningSessionId");
  });

  it("M. a Today-attached Attempt's learningSessionId is APPLICATION-derived from the TodaySessionItem — the client's claim is ignored, never trusted", async () => {
    const chain = await seedQuestionChain(db);
    const { todaySessionId, todaySessionItemId } = await seedTodaySessionWithItem(db, chain);

    const result = await submitAnswer(
      makeCommand(chain, {
        todaySessionId,
        todaySessionItemId,
        learningSessionId: "client-claimed-value-should-be-ignored",
      }),
      makeContext(),
      uow,
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind !== "ACCEPTED") throw new Error("unreachable");
    expect(result.attempt.learningSessionId).toBe(todaySessionId);
    expect(result.attempt.learningSessionId).not.toBe(
      "client-claimed-value-should-be-ignored",
    );
  });
});

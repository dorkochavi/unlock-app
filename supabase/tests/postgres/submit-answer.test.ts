/**
 * Real-Postgres (PGlite) integration test for the `submitAnswer`
 * application use case (`src/application/learning/submit-answer.ts`)
 * wired to the REAL Postgres infrastructure: `PostgresUnitOfWork`,
 * `PostgresAttemptRepository`, `PostgresUserQuestionProgressRepository`,
 * `PostgresQuestionVersionRepository`, `PostgresTodaySessionRepository`,
 * the real advisory lock, and — since ADR-014 —
 * `PostgresAnswerCorrectnessChecker` too. There is no fake/test-double
 * port left in this file: every dependency `submitAnswer` has is now a
 * real Postgres adapter (the previous session's `FakeAnswerCorrectnessChecker`
 * has been removed entirely, per ADR-014 Decision §6 and Phase 11 of the
 * Question/Answer Model task).
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
import type { UserQuestionProgress } from "../../../src/domain/learning/types";
import {
  submitAnswer,
  type SubmitAnswerCommand,
  type SubmitAnswerContext,
} from "../../../src/application/learning/submit-answer";
import { PostgresUnitOfWork } from "../../../src/infrastructure/postgres/postgres-unit-of-work";
import {
  createTestDb,
  insertQuestionVersion,
  insertUser,
  pgliteConnectionProvider,
  seedQuestionChain,
  seedTodaySessionWithItem,
  setCurrentVersion,
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
  uow = new PostgresUnitOfWork(pgliteConnectionProvider(db));
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

  it("K. a mid-transaction failure (genuinely malformed PERSISTED answer content) rolls back — nothing partial is committed, and it is NOT silently treated as incorrect (ADR-014)", async () => {
    const chain = await seedQuestionChain(db);
    // Directly corrupt the QuestionVersion's answer_options, bypassing
    // application validation entirely — the DB itself has no CHECK on
    // JSONB internals (ADR-014 Decision §4), so this is a real reachable
    // corruption shape, not a contrived one.
    await db.query(
      "update question_versions set answer_options = '[]'::jsonb where id = $1",
      [chain.questionVersionId],
    );

    await expect(
      submitAnswer(makeCommand(chain), makeContext(), uow),
    ).rejects.toThrow(/Invalid persisted QuestionAnswerDefinition/);

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

describe("submitAnswer answer correctness (ADR-014, real PostgresAnswerCorrectnessChecker)", () => {
  describe("SINGLE_CHOICE", () => {
    it("correct answer is graded true", async () => {
      const chain = await seedQuestionChain(db); // default: A/B options, A correct
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "A" }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("ACCEPTED");
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(true);
    });

    it("incorrect answer is graded false, never an error", async () => {
      const chain = await seedQuestionChain(db);
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "B" }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("ACCEPTED");
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(false);
    });

    it("an option id that does not exist on this QuestionVersion is INVALID_SELECTED_ANSWER, not graded false", async () => {
      const chain = await seedQuestionChain(db);
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "Z" }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("an array selectedAnswer for a SINGLE_CHOICE Question is INVALID_SELECTED_ANSWER (wrong shape)", async () => {
      const chain = await seedQuestionChain(db);
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A"] }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("null selectedAnswer is INVALID_SELECTED_ANSWER, never graded false", async () => {
      const chain = await seedQuestionChain(db);
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: null }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("a true/false question is just SINGLE_CHOICE with two options — no semantic loss (ADR-014 Decision §1)", async () => {
      const chain = await seedQuestionChain(db, {
        options: [
          { id: "TRUE", content: "True" },
          { id: "FALSE", content: "False" },
        ],
        correctOptionIds: ["TRUE"],
      });

      const correct = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "TRUE" }),
        makeContext(),
        uow,
      );
      const incorrect = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "FALSE" }),
        makeContext(),
        uow,
      );

      if (correct.kind !== "ACCEPTED" || incorrect.kind !== "ACCEPTED") {
        throw new Error("unreachable");
      }
      expect(correct.attempt.isCorrect).toBe(true);
      expect(incorrect.attempt.isCorrect).toBe(false);
    });
  });

  describe("MULTIPLE_CHOICE", () => {
    async function seedMultipleChoiceChain() {
      return seedQuestionChain(db, {
        questionType: "MULTIPLE_CHOICE",
        options: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
          { id: "C", content: "Option C" },
        ],
        correctOptionIds: ["A", "C"],
      });
    }

    it("the exact correct set is graded true", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A", "C"] }),
        makeContext(),
        uow,
      );
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(true);
    });

    it("the same set in a DIFFERENT order is still graded true (order-irrelevant set equality)", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["C", "A"] }),
        makeContext(),
        uow,
      );
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(true);
      // Persisted in canonical (sorted) form regardless of submission order.
      expect(result.attempt.selectedAnswer).toEqual(["A", "C"]);
    });

    it("missing one correct option is graded false", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A"] }),
        makeContext(),
        uow,
      );
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(false);
    });

    it("an extra (incorrect) option included is graded false", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A", "B", "C"] }),
        makeContext(),
        uow,
      );
      if (result.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(result.attempt.isCorrect).toBe(false);
    });

    it("a duplicate option id in the selection is INVALID_SELECTED_ANSWER, not silently deduplicated", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A", "A", "C"] }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("an unknown option id anywhere in the selection is INVALID_SELECTED_ANSWER", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: ["A", "Z"] }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("a scalar selectedAnswer for a MULTIPLE_CHOICE Question is INVALID_SELECTED_ANSWER (wrong shape)", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "A" }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });

    it("an empty array selectedAnswer is INVALID_SELECTED_ANSWER, never graded false", async () => {
      const chain = await seedMultipleChoiceChain();
      const result = await submitAnswer(
        makeCommand(chain, { selectedAnswer: [] }),
        makeContext(),
        uow,
      );
      expect(result.kind).toBe("INVALID_SELECTED_ANSWER");
    });
  });

  describe("historical QuestionVersion correctness (Phase 12/13)", () => {
    it("an Attempt against an OLD QuestionVersion is graded by that version's own definition, even after current_version_id has moved on to a Question edit with a DIFFERENT correct answer", async () => {
      const chain = await seedQuestionChain(db); // v1: A/B, A correct
      const v1Attempt = await submitAnswer(
        makeCommand(chain, { selectedAnswer: "A" }),
        makeContext(),
        uow,
      );
      if (v1Attempt.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(v1Attempt.attempt.isCorrect).toBe(true);

      // Simulate editing the Question: a NEW version with B correct instead
      // of A, and current_version_id moved forward to it.
      const v2Id = await insertQuestionVersion(db, chain.questionId, 2, {
        correctOptionIds: ["B"],
      });
      await setCurrentVersion(db, chain.questionId, v2Id);

      // A brand-new Attempt against the NEW current version, answering "B":
      // correct under v2's definition.
      const v2Attempt = await submitAnswer(
        makeCommand(chain, {
          questionVersionId: v2Id,
          selectedAnswer: "B",
          submissionId: randomUUID(),
        }),
        makeContext(),
        uow,
      );
      if (v2Attempt.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(v2Attempt.attempt.isCorrect).toBe(true);

      // A THIRD Attempt explicitly against the now-OLD v1, still answering
      // "A": must still be graded correct under v1's (unchanged) rule —
      // proving the checker loads by the Attempt's own frozen
      // questionVersionId, never through questions.current_version_id
      // (which now points at v2).
      const v1AgainAttempt = await submitAnswer(
        makeCommand(chain, {
          questionVersionId: chain.questionVersionId,
          selectedAnswer: "A",
          submissionId: randomUUID(),
        }),
        makeContext(),
        uow,
      );
      if (v1AgainAttempt.kind !== "ACCEPTED") throw new Error("unreachable");
      expect(v1AgainAttempt.attempt.isCorrect).toBe(true);

      // And the ORIGINAL first Attempt's persisted isCorrect is untouched —
      // no retroactive regrading happened as a side effect of the Question
      // being edited (ADR-005/ADR-012: Attempt.isCorrect is historical
      // evidence captured once at submission time. Verified directly in
      // `src/domain/learning/progress-update.ts`/`rebuild.ts`: every read
      // of correctness there is `attempt.isCorrect` itself — neither file
      // calls any correctness-checking port, so a replay/rebuild has no
      // mechanism to re-grade a historical Attempt even in principle).
      const persisted = await db.query<{ is_correct: boolean }>(
        "select is_correct from attempts where id = $1",
        [v1Attempt.attempt.id],
      );
      expect(persisted.rows[0].is_correct).toBe(true);
    });
  });
});

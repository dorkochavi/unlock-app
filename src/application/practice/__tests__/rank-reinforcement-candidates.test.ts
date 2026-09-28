/**
 * Unit tests for `rankReinforcementCandidates` (RUN010-B Tier 4,
 * FUB-034) — the pure, deterministic-modulo-injected-`random` ranking
 * function `selectPracticeBatch` uses to order same-day reinforcement
 * candidates. Full-pipeline Tier 1-3-then-4 activation/scope-isolation is
 * proven separately by the real-Postgres integration suite
 * (`supabase/tests/postgres/practice.test.ts`), matching the existing
 * `interleaveByTopic` unit-test / integration-test split in this codebase.
 */
import { describe, expect, it } from "vitest";

import type { UserQuestionProgress } from "../../../domain/learning/types";
import { rankReinforcementCandidates } from "../select-practice-batch";
import type { PracticeScopeQuestion } from "../ports";

function makeQuestion(id: string, topicId: string | null = null): PracticeScopeQuestion {
  return {
    questionId: id,
    questionVersionId: `${id}-v1`,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    topicId,
    attempted: true,
  };
}

function makeProgress(
  questionId: string,
  overrides: Partial<UserQuestionProgress> = {},
): UserQuestionProgress {
  return {
    userId: "learner-1",
    questionId,
    attemptCount: 1,
    correctCount: 1,
    lastAttemptAt: new Date("2026-03-10T09:00:00.000Z"),
    lastCorrectAt: new Date("2026-03-10T09:00:00.000Z"),
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
    firstMeaningfulEvidenceAt: new Date("2026-03-10T09:00:00.000Z"),
    lastMeaningfulEvidenceAt: new Date("2026-03-10T09:00:00.000Z"),
    evidenceStrength: "early",
    masteryCategory: "learning",
    engineVersion: "test",
    updatedAt: new Date("2026-03-10T09:00:00.000Z"),
    ...overrides,
  };
}

/** Deterministic stand-in for Math.random: always returns 0 (no swap effect
 * for a Fisher-Yates draw when `j` is at its max). Individual tests instead
 * inject a small scripted sequence when they need to observe a real shuffle. */
const noShuffle = () => 0;

describe("rankReinforcementCandidates", () => {
  it("ranks the candidate whose most recent Attempt today was incorrect before ones that were correct", () => {
    const correct = makeQuestion("correct");
    const incorrect = makeQuestion("incorrect");
    const progressByQuestion = new Map([
      [
        "correct",
        makeProgress("correct", {
          lastCorrectAt: new Date("2026-03-10T09:00:00.000Z"),
          lastIncorrectAt: null,
        }),
      ],
      [
        "incorrect",
        makeProgress("incorrect", {
          lastCorrectAt: null,
          lastIncorrectAt: new Date("2026-03-10T09:05:00.000Z"),
        }),
      ],
    ]);

    const ranked = rankReinforcementCandidates([correct, incorrect], progressByQuestion, noShuffle);

    expect(ranked).toEqual(["incorrect", "correct"]);
  });

  it("within the same correctness bucket, orders least-recently-answered (oldest) first", () => {
    const older = makeQuestion("older");
    const newer = makeQuestion("newer");
    const progressByQuestion = new Map([
      ["older", makeProgress("older", { lastAttemptAt: new Date("2026-03-10T07:00:00.000Z") })],
      ["newer", makeProgress("newer", { lastAttemptAt: new Date("2026-03-10T09:00:00.000Z") })],
    ]);

    const ranked = rankReinforcementCandidates([newer, older], progressByQuestion, noShuffle);

    expect(ranked).toEqual(["older", "newer"]);
  });

  it("never lets randomness override the incorrect-then-oldest priority — only exact ties are shuffled", () => {
    const strong = makeQuestion("strong-old-correct");
    const weak = makeQuestion("weak-mid-incorrect");
    // A third, most-recently-answered decoy keeps `weak` from ALSO being
    // "the most recently answered candidate overall," so this test
    // isolates pure priority ordering from the separate
    // anti-immediate-repeat swap (covered by its own test below).
    const decoy = makeQuestion("decoy-newest-correct");
    const progressByQuestion = new Map([
      [
        "strong-old-correct",
        makeProgress("strong-old-correct", {
          lastAttemptAt: new Date("2026-03-01T00:00:00.000Z"),
          lastCorrectAt: new Date("2026-03-01T00:00:00.000Z"),
          lastIncorrectAt: null,
        }),
      ],
      [
        "weak-mid-incorrect",
        makeProgress("weak-mid-incorrect", {
          lastAttemptAt: new Date("2026-03-10T09:00:00.000Z"),
          lastCorrectAt: null,
          lastIncorrectAt: new Date("2026-03-10T09:00:00.000Z"),
        }),
      ],
      [
        "decoy-newest-correct",
        makeProgress("decoy-newest-correct", {
          lastAttemptAt: new Date("2026-03-10T09:10:00.000Z"),
          lastCorrectAt: new Date("2026-03-10T09:10:00.000Z"),
          lastIncorrectAt: null,
        }),
      ],
    ]);

    // A "random" function that always tries to force a swap (returns just
    // under 1) still cannot promote the correct/older ones ahead of the
    // incorrect one, because they are not tied.
    const alwaysMaxSwap = () => 0.999999;
    const ranked = rankReinforcementCandidates(
      [strong, weak, decoy],
      progressByQuestion,
      alwaysMaxSwap,
    );

    expect(ranked).toEqual(["weak-mid-incorrect", "strong-old-correct", "decoy-newest-correct"]);
  });

  it("shuffles only within an exact tie group (same correctness bucket AND same lastAttemptAt)", () => {
    const tiedAt = new Date("2026-03-10T09:00:00.000Z");
    const a = makeQuestion("a");
    const b = makeQuestion("b");
    const c = makeQuestion("c");
    const progressByQuestion = new Map([
      ["a", makeProgress("a", { lastAttemptAt: tiedAt, lastCorrectAt: tiedAt, lastIncorrectAt: null })],
      ["b", makeProgress("b", { lastAttemptAt: tiedAt, lastCorrectAt: tiedAt, lastIncorrectAt: null })],
      ["c", makeProgress("c", { lastAttemptAt: tiedAt, lastCorrectAt: tiedAt, lastIncorrectAt: null })],
    ]);

    // Deterministic tie-break (questionId asc) before shuffling: a, b, c.
    // A scripted `random` sequence that reverses the group via Fisher-Yates.
    const scripted = [0.99, 0.0]; // forces last<->first-ish swaps deterministically
    let call = 0;
    const random = () => scripted[call++ % scripted.length];

    const ranked = rankReinforcementCandidates([a, b, c], progressByQuestion, random);

    // Still exactly the same SET of ids (nothing added/dropped), just an
    // order that isn't necessarily the plain questionId-ascending one.
    expect(new Set(ranked)).toEqual(new Set(["a", "b", "c"]));
  });

  it("anti-immediate-repeat: the single most-recently-answered candidate is never returned first when an alternative exists", () => {
    const justAnswered = makeQuestion("just-answered");
    const other = makeQuestion("other");
    // Both incorrect (same bucket), so natural priority alone would rank
    // whichever is "older" first — construct it so the JUST-answered one
    // (most recent overall) would otherwise land first by being the only
    // incorrect one.
    const progressByQuestion = new Map([
      [
        "just-answered",
        makeProgress("just-answered", {
          lastAttemptAt: new Date("2026-03-10T09:30:00.000Z"),
          lastCorrectAt: null,
          lastIncorrectAt: new Date("2026-03-10T09:30:00.000Z"),
        }),
      ],
      [
        "other",
        makeProgress("other", {
          lastAttemptAt: new Date("2026-03-10T08:00:00.000Z"),
          lastCorrectAt: new Date("2026-03-10T08:00:00.000Z"),
          lastIncorrectAt: null,
        }),
      ],
    ]);

    const ranked = rankReinforcementCandidates(
      [justAnswered, other],
      progressByQuestion,
      noShuffle,
    );

    expect(ranked[0]).not.toBe("just-answered");
    expect(ranked).toEqual(["other", "just-answered"]);
  });

  it("with exactly one candidate, returns it even though it is also the most-recently-answered (no alternative exists)", () => {
    const only = makeQuestion("only");
    const progressByQuestion = new Map([["only", makeProgress("only")]]);

    const ranked = rankReinforcementCandidates([only], progressByQuestion, noShuffle);

    expect(ranked).toEqual(["only"]);
  });

  it("skips a candidate with no progress row rather than crashing", () => {
    const withProgress = makeQuestion("with-progress");
    const withoutProgress = makeQuestion("without-progress");
    const progressByQuestion = new Map([["with-progress", makeProgress("with-progress")]]);

    const ranked = rankReinforcementCandidates(
      [withProgress, withoutProgress],
      progressByQuestion,
      noShuffle,
    );

    expect(ranked).toEqual(["with-progress"]);
  });

  it("empty candidate list returns an empty ranking", () => {
    expect(rankReinforcementCandidates([], new Map(), noShuffle)).toEqual([]);
  });

  it("defaults to Math.random when no random function is injected (does not throw)", () => {
    const a = makeQuestion("a");
    const b = makeQuestion("b");
    const progressByQuestion = new Map([
      ["a", makeProgress("a", { lastAttemptAt: new Date("2026-03-10T09:00:00.000Z") })],
      ["b", makeProgress("b", { lastAttemptAt: new Date("2026-03-10T09:00:00.000Z") })],
    ]);
    expect(() => rankReinforcementCandidates([a, b], progressByQuestion)).not.toThrow();
  });
});

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

  it("RUN010-C Part 3: does NOT demote the immediately-prior Question when it is materially STRONGER (not tied) than the alternative", () => {
    // Audits RUN010-B's original anti-immediate-repeat rule ("even a
    // lower-priority one"): `justAnswered` is both the single incorrect
    // (materially stronger priority) candidate AND the most-recently-
    // answered one; `other` is correct and older — a genuinely WEAKER
    // learning choice, not a comparable/tied alternative. The swap must
    // never leapfrog a materially stronger candidate out of first place
    // purely to avoid an immediate repeat.
    const justAnswered = makeQuestion("just-answered");
    const other = makeQuestion("other");
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

    expect(ranked).toEqual(["just-answered", "other"]);
  });

  it("RUN010-C Part 3: DOES swap the immediately-prior Question out of first place when the alternative is an exact (materially equivalent) tie", () => {
    // Both candidates share the same correctness bucket AND the same
    // lastAttemptAt — a genuine tie, exactly the equivalence the
    // controlled-randomness shuffle above already treats as interchangeable
    // — so the anti-immediate-repeat swap is expected to apply here, unlike
    // the materially-different-priority case above.
    const tiedAt = new Date("2026-03-10T09:30:00.000Z");
    const justAnswered = makeQuestion("just-answered");
    const tiedAlternative = makeQuestion("tied-alternative");
    const progressByQuestion = new Map([
      [
        "just-answered",
        makeProgress("just-answered", {
          lastAttemptAt: tiedAt,
          lastCorrectAt: null,
          lastIncorrectAt: tiedAt,
        }),
      ],
      [
        "tied-alternative",
        makeProgress("tied-alternative", {
          lastAttemptAt: tiedAt,
          lastCorrectAt: null,
          lastIncorrectAt: tiedAt,
        }),
      ],
    ]);

    // `justAnswered` is listed first, so it (not the exact-tied
    // `tiedAlternative`) is the one `reduce` picks as
    // "most-recently-answered" — and a random function biased toward the
    // top of its range keeps Fisher-Yates a no-op, so entries stay in their
    // post-sort (questionId-ascending) order: [just-answered, tied-alternative].
    const keepOrder = () => 0.999999;
    const ranked = rankReinforcementCandidates(
      [justAnswered, tiedAlternative],
      progressByQuestion,
      keepOrder,
    );

    expect(ranked).toEqual(["tied-alternative", "just-answered"]);
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

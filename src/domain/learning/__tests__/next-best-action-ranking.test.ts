import { describe, expect, it } from "vitest";
import type { NextBestActionCandidate } from "../next-best-action";
import {
  rankNextBestActionCandidates,
  type NextBestActionRankingContext,
} from "../next-best-action-ranking";

const NOW = new Date("2026-01-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function makeCandidate(
  overrides: Partial<NextBestActionCandidate> = {},
): NextBestActionCandidate {
  return {
    type: "REVIEW_DUE",
    questionId: "question-1",
    reasons: ["SCHEDULED_REVIEW_DUE"],
    dueAt: null,
    retrievability: null,
    ...overrides,
  };
}

function makeContext(now: Date = NOW): NextBestActionRankingContext {
  return { now };
}

function typesInOrder(
  ranked: ReturnType<typeof rankNextBestActionCandidates>,
): string[] {
  return ranked.map((r) => r.candidate.type);
}

function questionOrder(
  ranked: ReturnType<typeof rankNextBestActionCandidates>,
): string[] {
  return ranked.map((r) => r.candidate.questionId);
}

describe("rankNextBestActionCandidates", () => {
  it("1. unresolved lapse outranks ordinary strengthening", () => {
    const lapse = makeCandidate({
      type: "RELEARN_LAPSE",
      questionId: "q-lapse",
      reasons: ["UNRESOLVED_LAPSE"],
    });
    const strengthen = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-strengthen",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
    });

    const ranked = rankNextBestActionCandidates(
      [strengthen, lapse],
      makeContext(),
    );

    expect(questionOrder(ranked)).toEqual(["q-lapse", "q-strengthen"]);
  });

  it("2. active misconception outranks suspected misconception", () => {
    const active = makeCandidate({
      type: "REPAIR_MISCONCEPTION",
      questionId: "q-active",
      reasons: ["MISCONCEPTION_ACTIVE"],
    });
    const suspected = makeCandidate({
      type: "REPAIR_MISCONCEPTION",
      questionId: "q-suspected",
      reasons: ["MISCONCEPTION_SUSPECTED"],
    });

    const ranked = rankNextBestActionCandidates(
      [suspected, active],
      makeContext(),
    );

    expect(questionOrder(ranked)).toEqual(["q-active", "q-suspected"]);
  });

  it("3. due review outranks strengthening", () => {
    const due = makeCandidate({
      type: "REVIEW_DUE",
      questionId: "q-due",
      dueAt: new Date(NOW.getTime() - DAY_MS),
    });
    const strengthen = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-strengthen",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
    });

    const ranked = rankNextBestActionCandidates(
      [strengthen, due],
      makeContext(),
    );

    expect(questionOrder(ranked)).toEqual(["q-due", "q-strengthen"]);
  });

  it("4. more-overdue REVIEW_DUE outranks less-overdue REVIEW_DUE", () => {
    const veryOverdue = makeCandidate({
      questionId: "q-very-overdue",
      dueAt: new Date(NOW.getTime() - 10 * DAY_MS),
    });
    const slightlyOverdue = makeCandidate({
      questionId: "q-slightly-overdue",
      dueAt: new Date(NOW.getTime() - 1 * DAY_MS),
    });

    const ranked = rankNextBestActionCandidates(
      [slightlyOverdue, veryOverdue],
      makeContext(),
    );

    expect(questionOrder(ranked)).toEqual([
      "q-very-overdue",
      "q-slightly-overdue",
    ]);
  });

  it("5. lower retrievability breaks an otherwise-equal tie (more fragile first)", () => {
    const fragile = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-fragile",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      retrievability: 0.3,
    });
    const strong = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-strong",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      retrievability: 0.9,
    });

    const ranked = rankNextBestActionCandidates(
      [strong, fragile],
      makeContext(),
    );

    expect(questionOrder(ranked)).toEqual(["q-fragile", "q-strong"]);
  });

  it("6. deterministic final tie-break by questionId (ascending)", () => {
    const b = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-b",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
    });
    const a = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-a",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
    });

    const ranked = rankNextBestActionCandidates([b, a], makeContext());

    expect(questionOrder(ranked)).toEqual(["q-a", "q-b"]);
  });

  it("7. multiple candidates on one question collapse to a single non-contradictory recommendation", () => {
    const questionId = "q-overlap";
    const candidates = [
      makeCandidate({
        type: "STRENGTHEN_MEMORY",
        questionId,
        reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      }),
      makeCandidate({
        type: "REVIEW_DUE",
        questionId,
        dueAt: new Date(NOW.getTime() - DAY_MS),
      }),
      makeCandidate({
        type: "REPAIR_MISCONCEPTION",
        questionId,
        reasons: ["MISCONCEPTION_ACTIVE"],
      }),
      makeCandidate({
        type: "RELEARN_LAPSE",
        questionId,
        reasons: ["UNRESOLVED_LAPSE"],
      }),
    ];

    const ranked = rankNextBestActionCandidates(candidates, makeContext());

    expect(ranked.length).toBe(1);
    expect(ranked[0].candidate.questionId).toBe(questionId);
    expect(ranked[0].tier).toBe("REMEDIATION");
    expect(ranked[0].otherApplicableTypes.sort()).toEqual(
      ["REPAIR_MISCONCEPTION", "REVIEW_DUE", "STRENGTHEN_MEMORY"].sort(),
    );
  });

  it("8. active misconception + unresolved lapse on the same question resolves to a deterministic primary action", () => {
    const questionId = "q-both";
    const candidates = [
      makeCandidate({
        type: "REPAIR_MISCONCEPTION",
        questionId,
        reasons: ["MISCONCEPTION_ACTIVE"],
      }),
      makeCandidate({
        type: "RELEARN_LAPSE",
        questionId,
        reasons: ["UNRESOLVED_LAPSE"],
      }),
    ];

    const rankedA = rankNextBestActionCandidates(candidates, makeContext());
    const rankedB = rankNextBestActionCandidates(
      [...candidates].reverse(),
      makeContext(),
    );

    expect(rankedA[0].candidate.type).toBe("RELEARN_LAPSE");
    expect(rankedA[0].otherApplicableTypes).toEqual(["REPAIR_MISCONCEPTION"]);
    expect(rankedB[0].candidate.type).toBe("RELEARN_LAPSE");
  });

  it("9. a REVIEW_DUE candidate ranks normally even when it originated from a mastered item (ranking never sees masteryCategory)", () => {
    const due = makeCandidate({
      type: "REVIEW_DUE",
      questionId: "q-mastered-but-due",
      dueAt: new Date(NOW.getTime() - DAY_MS),
    });

    const ranked = rankNextBestActionCandidates([due], makeContext());

    expect(ranked[0].tier).toBe("DUE_REVIEW");
    expect(ranked[0].candidate.type).toBe("REVIEW_DUE");
  });

  it("10. a non-due strengthening item remains lower priority than due review or remediation", () => {
    const strengthen = makeCandidate({
      type: "STRENGTHEN_MEMORY",
      questionId: "q-strengthen",
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
    });
    const due = makeCandidate({
      type: "REVIEW_DUE",
      questionId: "q-due",
      dueAt: new Date(NOW.getTime() - DAY_MS),
    });
    const lapse = makeCandidate({
      type: "RELEARN_LAPSE",
      questionId: "q-lapse",
      reasons: ["UNRESOLVED_LAPSE"],
    });

    const ranked = rankNextBestActionCandidates(
      [strengthen, due, lapse],
      makeContext(),
    );

    expect(typesInOrder(ranked)).toEqual([
      "RELEARN_LAPSE",
      "REVIEW_DUE",
      "STRENGTHEN_MEMORY",
    ]);
  });

  it("11. ranking the same inputs twice produces identical output", () => {
    const candidates = [
      makeCandidate({ type: "RELEARN_LAPSE", questionId: "q-1" }),
      makeCandidate({
        type: "REPAIR_MISCONCEPTION",
        questionId: "q-2",
        reasons: ["MISCONCEPTION_SUSPECTED"],
      }),
      makeCandidate({
        type: "STRENGTHEN_MEMORY",
        questionId: "q-3",
        reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      }),
    ];

    const resultA = rankNextBestActionCandidates(candidates, makeContext());
    const resultB = rankNextBestActionCandidates(candidates, makeContext());

    expect(resultA).toEqual(resultB);
  });

  it("12. candidate order in input does not affect output", () => {
    const candidates = [
      makeCandidate({ type: "RELEARN_LAPSE", questionId: "q-1" }),
      makeCandidate({
        type: "REVIEW_DUE",
        questionId: "q-2",
        dueAt: new Date(NOW.getTime() - DAY_MS),
      }),
      makeCandidate({
        type: "STRENGTHEN_MEMORY",
        questionId: "q-3",
        reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      }),
    ];
    const shuffled = [candidates[2], candidates[0], candidates[1]];

    const resultA = rankNextBestActionCandidates(candidates, makeContext());
    const resultB = rankNextBestActionCandidates(shuffled, makeContext());

    expect(resultA).toEqual(resultB);
  });

  it("13. contains no numeric fake-precision score", () => {
    const candidates = [
      makeCandidate({ type: "RELEARN_LAPSE", questionId: "q-1" }),
    ];

    const ranked = rankNextBestActionCandidates(candidates, makeContext());

    expect(Object.keys(ranked[0]).sort()).toEqual(
      ["candidate", "otherApplicableTypes", "tier"].sort(),
    );
    expect(typeof ranked[0].tier).toBe("string");
  });

  it("14. the ranking context accepts only { now } today, leaving room for a future exam-urgency field to be added additively", () => {
    // This IS the extension-point proof: today's minimal context works
    // without candidate generation (next-best-action.ts) ever needing to
    // change, and NextBestActionRankingContext is a plain object a future
    // exam-urgency field could extend without breaking this call shape.
    const context: NextBestActionRankingContext = { now: NOW };
    const candidates = [
      makeCandidate({ type: "RELEARN_LAPSE", questionId: "q-1" }),
    ];

    expect(() => rankNextBestActionCandidates(candidates, context)).not.toThrow();
  });

  it("empty input produces empty output", () => {
    expect(rankNextBestActionCandidates([], makeContext())).toEqual([]);
  });
});

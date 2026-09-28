import { describe, expect, it } from "vitest";
import type { NextBestActionCandidate } from "../next-best-action";
import type { NextBestActionRankedCandidate } from "../next-best-action-ranking";
import {
  computeTodayPlanBudget,
  validateTodayPlanBudgetPolicy,
  type TodayPlanBudgetPolicy,
} from "../today-plan-budget";

const POLICY: TodayPlanBudgetPolicy = {
  minUsefulItems: 5,
  typicalRangeMax: 12,
  hardMaximumItems: 15,
};

function makeCandidate(
  overrides: Partial<NextBestActionCandidate> = {},
): NextBestActionCandidate {
  return {
    type: "REVIEW_DUE",
    questionId: "question-1",
    reasons: ["SCHEDULED_REVIEW_DUE"],
    dueAt: null,
    retrievability: null,
    cardPhase: null,
    ...overrides,
  };
}

function makeRanked(
  overrides: Partial<NextBestActionRankedCandidate> = {},
): NextBestActionRankedCandidate {
  return {
    candidate: makeCandidate(),
    tier: "DUE_REVIEW",
    otherApplicableTypes: [],
    ...overrides,
  };
}

function nCandidates(
  n: number,
  make: (index: number) => NextBestActionRankedCandidate,
): NextBestActionRankedCandidate[] {
  return Array.from({ length: n }, (_, i) => make(i));
}

describe("computeTodayPlanBudget", () => {
  it("1. zero candidates -> budget is the minUsefulItems floor, not the hard guardrail", () => {
    const budget = computeTodayPlanBudget([], POLICY);
    expect(budget).toBe(5);
  });

  it("2. only STRENGTHEN-tier candidates (genuinely low need) -> budget is capped at minUsefulItems, never padded to the guardrail", () => {
    const ranked = nCandidates(30, (i) =>
      makeRanked({
        candidate: makeCandidate({ type: "STRENGTHEN_MEMORY", questionId: `q-${i}` }),
        tier: "STRENGTHEN",
      }),
    );

    const budget = computeTodayPlanBudget(ranked, POLICY);

    expect(budget).toBe(5);
  });

  it("3. a small Course with only a couple of genuine DUE_REVIEW candidates -> a small, finite budget, no padding to the guardrail", () => {
    const ranked = nCandidates(2, (i) =>
      makeRanked({
        candidate: makeCandidate({ questionId: `q-${i}`, cardPhase: "review" }),
        tier: "DUE_REVIEW",
      }),
    );

    const budget = computeTodayPlanBudget(ranked, POLICY);

    // core need = 2, floored at minUsefulItems (5) — still far below the
    // hard guardrail (15), and a small real Course typically has nowhere
    // near enough OTHER ranked candidates to actually fill even that.
    expect(budget).toBe(5);
  });

  it("4. a heavy-due Course (many genuine multi-day-due REVIEW_DUE candidates) scales the budget up, bounded by the hard guardrail", () => {
    const ranked = nCandidates(40, (i) =>
      makeRanked({
        candidate: makeCandidate({ questionId: `q-${i}`, cardPhase: "review" }),
        tier: "DUE_REVIEW",
      }),
    );

    const budget = computeTodayPlanBudget(ranked, POLICY);

    expect(budget).toBe(15); // guardrail binds — 40 genuine candidates, capped
  });

  it("5. REMEDIATION-tier candidates default toward full inclusion up to the guardrail, just like genuine DUE_REVIEW", () => {
    const ranked = nCandidates(9, (i) =>
      makeRanked({
        candidate: makeCandidate({
          type: "RELEARN_LAPSE",
          questionId: `q-${i}`,
          reasons: ["UNRESOLVED_LAPSE"],
        }),
        tier: "REMEDIATION",
      }),
    );

    const budget = computeTodayPlanBudget(ranked, POLICY);

    expect(budget).toBe(9); // lands naturally in the documented "typical" range
  });

  it("6. OQ-044: a same-day FSRS learning-step artifact (cardPhase 'learning') does NOT count toward core need the way a genuine due-review item does", () => {
    const genuineOnly = nCandidates(3, (i) =>
      makeRanked({
        candidate: makeCandidate({ questionId: `review-${i}`, cardPhase: "review" }),
        tier: "DUE_REVIEW",
      }),
    );
    const genuinePlusArtifacts = [
      ...genuineOnly,
      ...nCandidates(20, (i) =>
        makeRanked({
          candidate: makeCandidate({
            questionId: `learning-artifact-${i}`,
            cardPhase: "learning",
          }),
          tier: "DUE_REVIEW",
        }),
      ),
    ];

    const budgetGenuineOnly = computeTodayPlanBudget(genuineOnly, POLICY);
    const budgetWithArtifacts = computeTodayPlanBudget(genuinePlusArtifacts, POLICY);

    // Adding 20 same-day Learning-phase "due again" artifacts must NOT
    // inflate the budget toward the guardrail the way 20 more genuine
    // Review-phase due items would (see test 4) — both computations see
    // the same 3 genuine items and land at the same minUsefulItems floor.
    expect(budgetGenuineOnly).toBe(5);
    expect(budgetWithArtifacts).toBe(5);
  });

  it("7. a DUE_REVIEW candidate with an unset/undefined cardPhase is treated as genuine (no positive evidence it is a same-day artifact)", () => {
    const ranked = nCandidates(9, (i) =>
      makeRanked({
        candidate: makeCandidate({ questionId: `q-${i}`, cardPhase: undefined }),
        tier: "DUE_REVIEW",
      }),
    );

    const budget = computeTodayPlanBudget(ranked, POLICY);

    expect(budget).toBe(9);
  });

  it("8. cold-start (empty ranked pool) never manufactures a plan from nothing — the returned budget still relies on generateTodayPlan's own no-filler truncation", () => {
    // computeTodayPlanBudget itself only ever returns a CEILING; it is
    // generateTodayPlan's `slice(0, budget)` over an empty list that
    // actually keeps the plan at zero items. This test documents that
    // contract at this layer: the ceiling is non-zero even with zero
    // candidates (see test 1), which is safe ONLY because it is a ceiling,
    // never a target.
    const budget = computeTodayPlanBudget([], POLICY);
    expect(budget).toBeGreaterThan(0);
  });

  it("validateTodayPlanBudgetPolicy rejects an internally inconsistent policy", () => {
    expect(() =>
      validateTodayPlanBudgetPolicy({
        minUsefulItems: 0,
        typicalRangeMax: 12,
        hardMaximumItems: 15,
      }),
    ).toThrow();
    expect(() =>
      validateTodayPlanBudgetPolicy({
        minUsefulItems: 10,
        typicalRangeMax: 5,
        hardMaximumItems: 15,
      }),
    ).toThrow();
    expect(() =>
      validateTodayPlanBudgetPolicy({
        minUsefulItems: 5,
        typicalRangeMax: 20,
        hardMaximumItems: 15,
      }),
    ).toThrow();
  });

  it("is deterministic and does not mutate its input", () => {
    const ranked = nCandidates(5, (i) =>
      makeRanked({ candidate: makeCandidate({ questionId: `q-${i}` }) }),
    );
    const snapshot = JSON.parse(JSON.stringify(ranked));

    const first = computeTodayPlanBudget(ranked, POLICY);
    const second = computeTodayPlanBudget(ranked, POLICY);

    expect(first).toBe(second);
    expect(ranked).toEqual(snapshot);
  });
});

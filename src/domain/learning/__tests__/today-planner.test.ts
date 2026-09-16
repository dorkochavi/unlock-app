import { describe, expect, it } from "vitest";
import type { NextBestActionCandidate } from "../next-best-action";
import type { NextBestActionRankedCandidate } from "../next-best-action-ranking";
import {
  generateTodayPlan,
  type TodayPlanInput,
  type TodayPlannerPolicy,
} from "../today-planner";

const DATE = "2026-01-10";
const POLICY: TodayPlannerPolicy = { maxItems: 3 };

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

function makeInput(
  rankedCandidates: NextBestActionRankedCandidate[],
  plannedForDate: string = DATE,
): TodayPlanInput {
  return { rankedCandidates, plannedForDate };
}

describe("generateTodayPlan", () => {
  it("1. a ranked list shorter than maxItems includes everything", () => {
    const ranked = [
      makeRanked({ candidate: makeCandidate({ questionId: "q-1" }) }),
      makeRanked({ candidate: makeCandidate({ questionId: "q-2" }) }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items.length).toBe(2);
  });

  it("2. a ranked list longer than maxItems is truncated exactly at maxItems", () => {
    const ranked = ["q-1", "q-2", "q-3", "q-4", "q-5"].map((questionId) =>
      makeRanked({ candidate: makeCandidate({ questionId }) }),
    );

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items.length).toBe(3);
    expect(plan.items.map((i) => i.questionId)).toEqual(["q-1", "q-2", "q-3"]);
  });

  it("3. preserves ranked order exactly", () => {
    const ranked = ["q-c", "q-a", "q-b"].map((questionId) =>
      makeRanked({ candidate: makeCandidate({ questionId }) }),
    );

    const plan = generateTodayPlan(
      makeInput(ranked),
      { maxItems: 10 },
    );

    expect(plan.items.map((i) => i.questionId)).toEqual([
      "q-c",
      "q-a",
      "q-b",
    ]);
  });

  it("4. produces no duplicate questionId in output", () => {
    const ranked = ["q-1", "q-2", "q-3"].map((questionId) =>
      makeRanked({ candidate: makeCandidate({ questionId }) }),
    );

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    const uniqueIds = new Set(plan.items.map((i) => i.questionId));
    expect(uniqueIds.size).toBe(plan.items.length);
  });

  it("5. the same input produces an identical plan when called twice", () => {
    const ranked = ["q-1", "q-2"].map((questionId) =>
      makeRanked({ candidate: makeCandidate({ questionId }) }),
    );
    const input = makeInput(ranked);

    const planA = generateTodayPlan(input, POLICY);
    const planB = generateTodayPlan(input, POLICY);

    expect(planA).toEqual(planB);
  });

  it("6. does not rerank — preserves the given order even when it looks 'out of priority order'", () => {
    // A STRENGTHEN-tier item deliberately placed BEFORE a REMEDIATION-tier
    // item — if this planner re-ranked, REMEDIATION would move first. It
    // must not.
    const ranked = [
      makeRanked({
        candidate: makeCandidate({
          type: "STRENGTHEN_MEMORY",
          questionId: "q-strengthen",
          reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
        }),
        tier: "STRENGTHEN",
      }),
      makeRanked({
        candidate: makeCandidate({
          type: "RELEARN_LAPSE",
          questionId: "q-lapse",
          reasons: ["UNRESOLVED_LAPSE"],
        }),
        tier: "REMEDIATION",
      }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items.map((i) => i.questionId)).toEqual([
      "q-strengthen",
      "q-lapse",
    ]);
  });

  it("7. preserves otherApplicableTypes", () => {
    const ranked = [
      makeRanked({
        candidate: makeCandidate({ questionId: "q-1" }),
        otherApplicableTypes: ["REPAIR_MISCONCEPTION", "STRENGTHEN_MEMORY"],
      }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items[0].otherApplicableTypes).toEqual([
      "REPAIR_MISCONCEPTION",
      "STRENGTHEN_MEMORY",
    ]);
  });

  it("8. preserves the chosen candidate's reasons", () => {
    const ranked = [
      makeRanked({
        candidate: makeCandidate({
          type: "RELEARN_LAPSE",
          questionId: "q-1",
          reasons: ["UNRESOLVED_LAPSE"],
        }),
        tier: "REMEDIATION",
      }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items[0].reasons).toEqual(["UNRESOLVED_LAPSE"]);
  });

  it("9. a mastered-but-due REVIEW_DUE candidate can appear in Today (the planner never sees masteryCategory)", () => {
    const ranked = [
      makeRanked({
        candidate: makeCandidate({
          type: "REVIEW_DUE",
          questionId: "q-mastered-but-due",
          reasons: ["SCHEDULED_REVIEW_DUE"],
        }),
        tier: "DUE_REVIEW",
      }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items[0].actionType).toBe("REVIEW_DUE");
  });

  it("10. a remediation item appears before strengthening when ranking already placed it first", () => {
    const ranked = [
      makeRanked({
        candidate: makeCandidate({
          type: "RELEARN_LAPSE",
          questionId: "q-lapse",
          reasons: ["UNRESOLVED_LAPSE"],
        }),
        tier: "REMEDIATION",
      }),
      makeRanked({
        candidate: makeCandidate({
          type: "STRENGTHEN_MEMORY",
          questionId: "q-strengthen",
          reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
        }),
        tier: "STRENGTHEN",
      }),
    ];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items[0].questionId).toBe("q-lapse");
    expect(plan.items[1].questionId).toBe("q-strengthen");
  });

  it("11. empty ranked input produces an empty Today plan", () => {
    const plan = generateTodayPlan(makeInput([]), POLICY);

    expect(plan.items).toEqual([]);
    expect(plan.plannedForDate).toBe(DATE);
  });

  it("12. rejects an invalid maxItems (zero, negative, or non-integer)", () => {
    const ranked = [makeRanked()];

    for (const maxItems of [0, -1, 1.5]) {
      expect(() =>
        generateTodayPlan(makeInput(ranked), { maxItems }),
      ).toThrow();
    }
  });

  it("13. produces no randomization — repeated calls stay identical", () => {
    const ranked = ["q-1", "q-2", "q-3"].map((questionId) =>
      makeRanked({ candidate: makeCandidate({ questionId }) }),
    );
    const input = makeInput(ranked);

    const plans = [1, 2, 3, 4, 5].map(() => generateTodayPlan(input, POLICY));

    for (const plan of plans.slice(1)) {
      expect(plan).toEqual(plans[0]);
    }
  });

  it("14. never invents filler NEW_LEARNING/EXPAND_COVERAGE items when input is short or empty", () => {
    const oneItemPlan = generateTodayPlan(
      makeInput([makeRanked({ candidate: makeCandidate({ questionId: "q-1" }) })]),
      POLICY,
    );
    expect(oneItemPlan.items.length).toBe(1); // not padded to maxItems(3)

    const emptyPlan = generateTodayPlan(makeInput([]), POLICY);
    expect(emptyPlan.items.length).toBe(0);
  });

  it("15. does not implement topic interleaving (no topic metadata exists to interleave on)", () => {
    // Three same-tier items that would conceptually be "the same topic" —
    // since candidates carry no topic field at all, the planner cannot
    // and does not interleave them; they stay in the exact given order.
    const ranked = ["q-1", "q-2", "q-3"].map((questionId) =>
      makeRanked({
        candidate: makeCandidate({
          type: "STRENGTHEN_MEMORY",
          questionId,
          reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
        }),
        tier: "STRENGTHEN",
      }),
    );

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(plan.items.map((i) => i.questionId)).toEqual(["q-1", "q-2", "q-3"]);
  });

  it("16. contains no mutable learner-state snapshot — only the documented explainability fields", () => {
    const ranked = [makeRanked({ candidate: makeCandidate({ questionId: "q-1" }) })];

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(Object.keys(plan.items[0]).sort()).toEqual(
      [
        "position",
        "questionId",
        "actionType",
        "tier",
        "otherApplicableTypes",
        "reasons",
      ].sort(),
    );
  });

  it("17. is structurally serializable (survives a JSON round-trip unchanged)", () => {
    const ranked = ["q-1", "q-2"].map((questionId) =>
      makeRanked({
        candidate: makeCandidate({ questionId }),
        otherApplicableTypes: ["STRENGTHEN_MEMORY"],
      }),
    );

    const plan = generateTodayPlan(makeInput(ranked), POLICY);
    const roundTripped = JSON.parse(JSON.stringify(plan));

    expect(roundTripped).toEqual(plan);
  });

  it("18. does not mutate its input arrays/candidates", () => {
    const ranked = [
      makeRanked({
        candidate: makeCandidate({ questionId: "q-1" }),
        otherApplicableTypes: ["STRENGTHEN_MEMORY"],
      }),
    ];
    const rankedSnapshot = JSON.parse(JSON.stringify(ranked));

    const plan = generateTodayPlan(makeInput(ranked), POLICY);

    expect(ranked).toEqual(rankedSnapshot); // untouched
    expect(plan.items[0].otherApplicableTypes).not.toBe(
      ranked[0].otherApplicableTypes,
    ); // defensive copy, not a shared reference
    expect(plan.items[0].reasons).not.toBe(ranked[0].candidate.reasons);
  });

  it("rejects a malformed plannedForDate", () => {
    expect(() =>
      generateTodayPlan(makeInput([], "not-a-date"), POLICY),
    ).toThrow();
    expect(() =>
      generateTodayPlan(makeInput([], "2026-1-1"), POLICY),
    ).toThrow();
  });
});

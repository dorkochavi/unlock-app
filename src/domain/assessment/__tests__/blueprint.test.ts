/**
 * Tests for the pure Assessment Blueprint prototype
 * (Run 2026-10-08-ASSESSMENT-ENGINE-003, Slice C3). Hand-written fixtures only.
 */
import { describe, expect, it } from "vitest";

import {
  compareCoverage,
  validateBlueprint,
  type Blueprint,
  type BlueprintCell,
  type CoverageItem,
  type DeclaredObjective,
  MAX_BLUEPRINT_COUNT,
} from "../blueprint/blueprint";

const U: DeclaredObjective[] = [
  { id: "O1", topicId: "T1" },
  { id: "O2", topicId: "T1" },
  { id: "O3", topicId: "T2" },
];

function bp(cells: BlueprintCell[], targetTotal: number | null = null): Blueprint {
  return { id: "B", name: "plan", courseId: "C", targetTotal, cells };
}
const cell = (objectiveId: string, min: number, max: number | null): BlueprintCell => ({
  objectiveId,
  min,
  max,
});
const codes = (b: Blueprint, u = U) => validateBlueprint(b, u).map((i) => i.code);
const item = (questionId: string, ...objectiveIds: string[]): CoverageItem => ({
  questionId,
  objectiveIds,
});

describe("validateBlueprint", () => {
  it("clean plan yields no issues", () => {
    const b = bp([cell("O1", 1, 2), cell("O2", 0, 3), cell("O3", 1, null)], 4);
    expect(validateBlueprint(b, U)).toEqual([]);
  });

  describe("BLUEPRINT_CELL_COUNT_INVALID", () => {
    for (const bad of [NaN, -1, 1.5, Infinity, -Infinity]) {
      it(`min=${bad} flagged`, () => {
        const r = validateBlueprint(bp([cell("O1", bad, null), cell("O2", 0, 1), cell("O3", 0, 1)]), U);
        expect(r.filter((i) => i.code === "BLUEPRINT_CELL_COUNT_INVALID")).toEqual([
          expect.objectContaining({ severity: "ERROR", objectiveId: "O1" }),
        ]);
      });
      it(`max=${bad} flagged`, () => {
        expect(codes(bp([cell("O1", 0, bad), cell("O2", 0, 1), cell("O3", 0, 1)]))).toContain(
          "BLUEPRINT_CELL_COUNT_INVALID",
        );
      });
    }
    it("counts above MAX_BLUEPRINT_COUNT are invalid; MAX itself is valid (sums stay safe)", () => {
      expect(MAX_BLUEPRINT_COUNT).toBe(1_000_000);
      const over = MAX_BLUEPRINT_COUNT + 1;
      for (const b of [
        bp([cell("O1", over, null)]),
        bp([cell("O1", 0, over)]),
        bp([cell("O1", Number.MAX_SAFE_INTEGER, null)]),
      ]) {
        expect(codes(b)).toContain("BLUEPRINT_CELL_COUNT_INVALID");
      }
      expect(codes(bp([cell("O1", MAX_BLUEPRINT_COUNT, MAX_BLUEPRINT_COUNT)]))).not.toContain(
        "BLUEPRINT_CELL_COUNT_INVALID",
      );
    });
    it("targetTotal above MAX_BLUEPRINT_COUNT is TOTAL_INVALID; MAX is accepted", () => {
      expect(codes(bp([], MAX_BLUEPRINT_COUNT + 1))).toContain("BLUEPRINT_TOTAL_INVALID");
      expect(codes(bp([], MAX_BLUEPRINT_COUNT))).not.toContain("BLUEPRINT_TOTAL_INVALID");
    });
    it("non-number min flagged without throwing", () => {
      const weird = { objectiveId: "O1", min: "2", max: null } as unknown as BlueprintCell;
      expect(codes(bp([weird, cell("O2", 0, 1), cell("O3", 0, 1)]))).toContain(
        "BLUEPRINT_CELL_COUNT_INVALID",
      );
    });
    it("negative case: min=0 and max=0 are valid", () => {
      const b = bp([cell("O1", 0, 0), cell("O2", 0, null), cell("O3", 0, 0)]);
      expect(validateBlueprint(b, U)).toEqual([]);
    });
  });

  describe("BLUEPRINT_CELL_MIN_GT_MAX", () => {
    it("positive", () => {
      expect(codes(bp([cell("O1", 3, 2), cell("O2", 0, 1), cell("O3", 0, 1)]))).toEqual([
        "BLUEPRINT_CELL_MIN_GT_MAX",
      ]);
    });
    it("negative: min == max", () => {
      expect(codes(bp([cell("O1", 2, 2), cell("O2", 0, 1), cell("O3", 0, 1)]))).toEqual([]);
    });
  });

  describe("BLUEPRINT_CELL_DUPLICATE", () => {
    it("reported once per id even with three cells; never merged", () => {
      const b = bp([cell("O1", 1, 1), cell("O1", 1, 1), cell("O1", 2, 2), cell("O2", 0, 1), cell("O3", 0, 1)]);
      const r = validateBlueprint(b, U);
      expect(r.filter((i) => i.code === "BLUEPRINT_CELL_DUPLICATE")).toHaveLength(1);
      expect(r.find((i) => i.code === "BLUEPRINT_CELL_DUPLICATE")?.objectiveId).toBe("O1");
    });
    it("duplicate contributes no cells to sums", () => {
      // O1 cells excluded: sumMin = 0 (O2,O3), so total 0 is fine
      const b = bp([cell("O1", 5, 5), cell("O1", 5, 5), cell("O2", 0, 1), cell("O3", 0, 1)], 0);
      expect(codes(b)).toEqual(["BLUEPRINT_CELL_DUPLICATE"]);
    });
    it("negative: distinct ids", () => {
      expect(codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)]))).toEqual([]);
    });
  });

  describe("BLUEPRINT_OBJECTIVE_UNKNOWN", () => {
    it("positive; excluded from totals", () => {
      const b = bp([cell("OX", 9, 9), cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)], 2);
      const r = validateBlueprint(b, U);
      expect(r.map((i) => i.code)).toEqual(["BLUEPRINT_OBJECTIVE_UNKNOWN"]);
      expect(r[0].objectiveId).toBe("OX");
    });
    it("negative: known ids", () => {
      expect(codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)]))).toEqual([]);
    });
  });

  describe("BLUEPRINT_TOTAL_INVALID", () => {
    for (const bad of [NaN, -1, 2.5, Infinity]) {
      it(`targetTotal=${bad}`, () => {
        const r = codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)], bad));
        expect(r).toEqual(["BLUEPRINT_TOTAL_INVALID"]);
      });
    }
    it("negative: 0 and null are not invalid", () => {
      expect(codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)], 0))).toEqual([]);
      expect(codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)], null))).toEqual([]);
    });
  });

  describe("totals vs mins/maxes", () => {
    const base = [cell("O1", 2, 3), cell("O2", 1, 2), cell("O3", 0, 1)];
    it("BELOW_MINS positive (sumMin 3, total 2)", () => {
      expect(codes(bp(base, 2))).toEqual(["BLUEPRINT_TOTAL_BELOW_MINS"]);
    });
    it("BELOW_MINS negative (total == sumMin)", () => {
      expect(codes(bp(base, 3))).toEqual([]);
    });
    it("ABOVE_MAXES positive (sumMax 6, total 7)", () => {
      expect(codes(bp(base, 7))).toEqual(["BLUEPRINT_TOTAL_ABOVE_MAXES"]);
    });
    it("ABOVE_MAXES negative (total == sumMax)", () => {
      expect(codes(bp(base, 6))).toEqual([]);
    });
    it("ABOVE_MAXES skipped when any valid cell is unbounded", () => {
      expect(codes(bp([cell("O1", 2, 3), cell("O2", 1, null), cell("O3", 0, 1)], 100))).toEqual([]);
    });
    it("an unbounded cell that is invalid does not suppress the check", () => {
      // O2 unbounded but unknown-duplicated => not valid; remaining valid all bounded
      const b = bp([cell("O1", 0, 1), cell("O3", 0, 1), cell("O2", 5, null), cell("O2", 5, null)], 10);
      expect(codes(b)).toEqual(["BLUEPRINT_CELL_DUPLICATE", "BLUEPRINT_TOTAL_ABOVE_MAXES"]);
    });
    it("targetTotal=0 valid only when all mins are 0", () => {
      expect(codes(bp([cell("O1", 0, 0), cell("O2", 0, 0), cell("O3", 0, 0)], 0))).toEqual([]);
      expect(codes(bp([cell("O1", 1, 1), cell("O2", 0, 0), cell("O3", 0, 0)], 0))).toEqual([
        "BLUEPRINT_TOTAL_BELOW_MINS",
      ]);
    });
    it("empty blueprint with a total is not an above-maxes error", () => {
      expect(codes(bp([], 5))).not.toContain("BLUEPRINT_TOTAL_ABOVE_MAXES");
    });
  });

  describe("BLUEPRINT_OBJECTIVE_UNALLOCATED", () => {
    it("positive: WARNING per declared objective with no cell, empty blueprint valid", () => {
      const r = validateBlueprint(bp([]), U);
      expect(r.map((i) => [i.code, i.severity, i.objectiveId])).toEqual([
        ["BLUEPRINT_OBJECTIVE_UNALLOCATED", "WARNING", "O1"],
        ["BLUEPRINT_OBJECTIVE_UNALLOCATED", "WARNING", "O2"],
        ["BLUEPRINT_OBJECTIVE_UNALLOCATED", "WARNING", "O3"],
      ]);
    });
    it("negative: all allocated", () => {
      expect(codes(bp([cell("O1", 0, 1), cell("O2", 0, 1), cell("O3", 0, 1)]))).toEqual([]);
    });
    it("empty universe and empty blueprint: no issues", () => {
      expect(validateBlueprint(bp([]), [])).toEqual([]);
    });
  });

  it("issues sorted by code then objectiveId", () => {
    const b = bp([cell("O3", 2, 1), cell("O1", 3, 2), cell("OZ", 0, 1), cell("OA", 0, 1)]);
    const r = validateBlueprint(b, U);
    const keys = r.map((i) => `${i.code}|${i.objectiveId ?? ""}`);
    expect(keys).toEqual([...keys].sort());
  });

  it("messages are mechanical (no normative wording)", () => {
    const b = bp([cell("O1", 5, 1)], 0);
    for (const i of validateBlueprint(b, U)) {
      expect(i.message).not.toMatch(/deserv|should|important|good|right amount|%/i);
    }
  });

  it("order independence", () => {
    const cells = [cell("O3", 2, 1), cell("O1", 1, 1), cell("O1", 2, 2), cell("OX", 0, 1), cell("O2", NaN, 1)];
    const a = validateBlueprint(bp(cells, 3), U);
    const b = validateBlueprint(bp([...cells].reverse(), 3), [...U].reverse());
    expect(b).toEqual(a);
  });

  it("does not mutate inputs", () => {
    const b = bp([cell("O3", 2, 1), cell("O1", 1, 1)], 3);
    const u = [...U];
    const bSnap = structuredClone(b);
    const uSnap = structuredClone(u);
    validateBlueprint(b, u);
    expect(b).toEqual(bSnap);
    expect(u).toEqual(uSnap);
  });

  it("Hebrew ids pass through untouched", () => {
    const hu: DeclaredObjective[] = [{ id: "מטרה-א", topicId: "נושא-1" }];
    const r = validateBlueprint({ ...bp([cell("מטרה-ב", 0, 1)]), name: "תכנית" }, hu);
    expect(r.map((i) => [i.code, i.objectiveId])).toEqual([
      ["BLUEPRINT_OBJECTIVE_UNALLOCATED", "מטרה-א"],
      ["BLUEPRINT_OBJECTIVE_UNKNOWN", "מטרה-ב"],
    ].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  });
});

describe("compareCoverage", () => {
  it("per-cell UNDER / OVER / OK and total status", () => {
    const b = bp([cell("O1", 2, 3), cell("O2", 0, 1), cell("O3", 1, null)], 3);
    const items = [item("q1", "O1"), item("q2", "O2"), item("q3", "O2"), item("q4", "O3")];
    const r = compareCoverage(b, U, items);
    expect(r.cells.map((c) => [c.objectiveId, c.actual, c.status])).toEqual([
      ["O1", 1, "UNDER"],
      ["O2", 2, "OVER"],
      ["O3", 1, "OK"],
    ]);
    expect(r.totalDistinctQuestions).toBe(4);
    expect(r.totalStatus).toBe("OVER");
  });

  it("total UNDER, OK, NOT_EVALUATED (absent and invalid)", () => {
    const items = [item("q1", "O1"), item("q2", "O2")];
    const cells = [cell("O1", 0, 5)];
    expect(compareCoverage(bp(cells, 3), U, items).totalStatus).toBe("UNDER");
    expect(compareCoverage(bp(cells, 2), U, items).totalStatus).toBe("OK");
    expect(compareCoverage(bp(cells, null), U, items).totalStatus).toBe("NOT_EVALUATED");
    expect(compareCoverage(bp(cells, -2), U, items).totalStatus).toBe("NOT_EVALUATED");
    expect(compareCoverage(bp(cells, NaN), U, items).totalStatus).toBe("NOT_EVALUATED");
  });

  it("max=0 means explicitly excluded: any linked question is OVER", () => {
    const r = compareCoverage(bp([cell("O1", 0, 0)]), U, [item("q1", "O1")]);
    expect(r.cells[0]).toMatchObject({ actual: 1, status: "OVER" });
  });

  it("min=0 with zero actual is OK", () => {
    const r = compareCoverage(bp([cell("O1", 0, null)]), U, []);
    expect(r.cells[0]).toMatchObject({ actual: 0, status: "OK" });
  });

  it("invalid cells get no status; objective is unallocated with its actual", () => {
    const b = bp([cell("O1", 3, 2), cell("O2", 0, 1), cell("OX", 0, 1)]);
    const r = compareCoverage(b, U, [item("q1", "O1")]);
    expect(r.cells.map((c) => c.objectiveId)).toEqual(["O2"]);
    expect(r.unallocated).toEqual([
      { objectiveId: "O1", actual: 1 },
      { objectiveId: "O3", actual: 0 },
    ]);
  });

  it("duplicate-id cells are not valid cells", () => {
    const r = compareCoverage(bp([cell("O1", 0, 1), cell("O1", 0, 1)]), U, []);
    expect(r.cells).toEqual([]);
    expect(r.unallocated.map((u) => u.objectiveId)).toContain("O1");
  });

  it("multi-objective question: once per objective, once in total", () => {
    const b = bp([cell("O1", 1, 1), cell("O3", 1, 1)], 1);
    const r = compareCoverage(b, U, [item("q1", "O1", "O3")]);
    expect(r.cells.map((c) => c.actual)).toEqual([1, 1]);
    expect(r.totalDistinctQuestions).toBe(1);
    expect(r.totalStatus).toBe("OK");
    expect(r.distribution.reduce((s, d) => s + d.actual, 0)).toBe(2);
  });

  it("repeated objective id inside one item collapses", () => {
    const r = compareCoverage(bp([cell("O1", 0, 5)]), U, [item("q1", "O1", "O1", "O1")]);
    expect(r.cells[0].actual).toBe(1);
  });

  it("unlinked question counts in total, toward no objective or topic", () => {
    const r = compareCoverage(bp([]), U, [item("q1"), item("q2", "O1")]);
    expect(r.unlinkedQuestionIds).toEqual(["q1"]);
    expect(r.totalDistinctQuestions).toBe(2);
    expect(r.topics.reduce((s, t) => s + t.distinctQuestions, 0)).toBe(1);
  });

  it("question with only unknown refs is unlinked and refs are listed", () => {
    const r = compareCoverage(bp([]), U, [item("q1", "OX", "OY")]);
    expect(r.unlinkedQuestionIds).toEqual(["q1"]);
    expect(r.unknownObjectiveRefs).toEqual([
      { questionId: "q1", objectiveId: "OX" },
      { questionId: "q1", objectiveId: "OY" },
    ]);
  });

  it("unknown refs on an otherwise linked question are listed, not counted", () => {
    const r = compareCoverage(bp([]), U, [item("q1", "O1", "OX")]);
    expect(r.unlinkedQuestionIds).toEqual([]);
    expect(r.unknownObjectiveRefs).toEqual([{ questionId: "q1", objectiveId: "OX" }]);
    expect(r.coverage.covered).toBe(1);
  });

  it("duplicate questionId: first (canonical) wins, listed once, not counted", () => {
    const r = compareCoverage(bp([cell("O1", 0, 9), cell("O2", 0, 9)]), U, [
      item("q1", "O1"),
      item("q1", "O2"),
      item("q1", "O2"),
    ]);
    expect(r.duplicateQuestionIds).toEqual(["q1"]);
    expect(r.totalDistinctQuestions).toBe(1);
    expect(r.cells.map((c) => c.actual)).toEqual([1, 0]);
  });

  it("duplicate questionId: an empty-objective copy sorts first, wins, and counts as unlinked", () => {
    const r = compareCoverage(bp([cell("O1", 0, 9)]), U, [item("q1", "O1"), item("q1")]);
    expect(r.duplicateQuestionIds).toEqual(["q1"]);
    expect(r.totalDistinctQuestions).toBe(1);
    expect(r.unlinkedQuestionIds).toEqual(["q1"]);
    expect(r.cells[0].actual).toBe(0);
  });

  it("coverage ratio and distribution", () => {
    const r = compareCoverage(bp([cell("O1", 1, 2)]), U, [item("q1", "O1"), item("q2", "O3")]);
    expect(r.coverage).toEqual({ covered: 2, declared: 3, ratio: 2 / 3 });
    expect(r.distribution).toEqual([
      { objectiveId: "O1", actual: 1, min: 1, max: 2 },
      { objectiveId: "O2", actual: 0 },
      { objectiveId: "O3", actual: 1 },
    ]);
  });

  it("empty universe and empty blueprint: ratio null, no topics", () => {
    const r = compareCoverage(bp([]), [], []);
    expect(r.coverage).toEqual({ covered: 0, declared: 0, ratio: null });
    expect(r.topics).toEqual([]);
    expect(r.totalDistinctQuestions).toBe(0);
    expect(r.totalStatus).toBe("NOT_EVALUATED");
  });

  it("empty universe with items: all unlinked/unknown, ratio null", () => {
    const r = compareCoverage(bp([]), [], [item("q1", "O1")]);
    expect(r.coverage.ratio).toBeNull();
    expect(r.unlinkedQuestionIds).toEqual(["q1"]);
  });

  it("topic roll-up", () => {
    const b = bp([cell("O1", 1, 2), cell("O2", 0, 3), cell("O3", 1, null)]);
    const r = compareCoverage(b, U, [item("q1", "O1", "O2"), item("q2", "O2"), item("q3", "O3")]);
    expect(r.topics).toEqual([
      { topicId: "T1", declaredObjectives: 2, coveredObjectives: 2, distinctQuestions: 2, sumMin: 1, sumMax: 5 },
      { topicId: "T2", declaredObjectives: 1, coveredObjectives: 1, distinctQuestions: 1, sumMin: 1, sumMax: null },
    ]);
  });

  it("topic sumMax is null when the topic has no valid cells", () => {
    const r = compareCoverage(bp([]), U, []);
    expect(r.topics.every((t) => t.sumMax === null && t.sumMin === 0)).toBe(true);
  });

  it("order independence (cells, universe, items, objectiveIds)", () => {
    const cells = [cell("O3", 1, null), cell("O1", 1, 2), cell("O2", 0, 3)];
    const items = [item("q3", "O3", "OX"), item("q1", "O2", "O1"), item("q2"), item("q1", "O3"), item("q1", "O3")];
    const a = compareCoverage(bp(cells, 3), U, items);
    const b = compareCoverage(
      bp([...cells].reverse(), 3),
      [...U].reverse(),
      [...items].reverse().map((i) => ({ ...i, objectiveIds: [...i.objectiveIds].reverse() })),
    );
    expect(b).toEqual(a);
  });

  it("does not mutate inputs", () => {
    const b = bp([cell("O3", 1, null), cell("O1", 1, 2)], 3);
    const items = [item("q2", "O3", "O1"), item("q1", "O1", "O1")];
    const u = [...U].reverse();
    const snap = structuredClone({ b, items, u });
    compareCoverage(b, u, items);
    expect({ b, items, u }).toEqual(snap);
  });

  it("deterministic: same input gives deep-equal output", () => {
    const b = bp([cell("O1", 1, 2)], 2);
    const items = [item("q1", "O1")];
    expect(compareCoverage(b, U, items)).toEqual(compareCoverage(b, U, items));
  });

  it("bad plan data does not throw", () => {
    const weird = { objectiveId: "O1", min: NaN, max: Infinity } as BlueprintCell;
    expect(() => compareCoverage(bp([weird], Infinity), U, [item("q1", "O1")])).not.toThrow();
  });

  it("Hebrew ids pass through untouched", () => {
    const hu: DeclaredObjective[] = [
      { id: "מטרה-א", topicId: "נושא-1" },
      { id: "מטרה-ב", topicId: "נושא-1" },
    ];
    const b: Blueprint = { id: "ב1", name: "תכנית בחינה", courseId: "קורס", targetTotal: 1, cells: [cell("מטרה-א", 1, 1)] };
    const r = compareCoverage(b, hu, [item("שאלה-1", "מטרה-א", "מטרה-ג")]);
    expect(r.cells).toEqual([{ objectiveId: "מטרה-א", min: 1, max: 1, actual: 1, status: "OK" }]);
    expect(r.unallocated).toEqual([{ objectiveId: "מטרה-ב", actual: 0 }]);
    expect(r.unknownObjectiveRefs).toEqual([{ questionId: "שאלה-1", objectiveId: "מטרה-ג" }]);
    expect(r.topics[0].topicId).toBe("נושא-1");
  });

  it("scales linearly enough for a large batch", () => {
    const items: CoverageItem[] = Array.from({ length: 20000 }, (_, i) => item(`q${i}`, "O1", "O2"));
    const r = compareCoverage(bp([cell("O1", 0, null)]), U, items);
    expect(r.totalDistinctQuestions).toBe(20000);
  });
});

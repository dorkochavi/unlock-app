/**
 * Golden scenario tests for the Assessment Blueprint prototype
 * (Run 2026-10-08-ASSESSMENT-ENGINE-003, Slice C4). Synthetic fixtures only.
 */
import { describe, expect, it } from "vitest";

import { compareCoverage, validateBlueprint } from "../blueprint/blueprint";
import {
  ALL_SCENARIOS,
  COGNITIVE_DIFFICULTY_NOT_EVALUATED,
  type BlueprintScenario,
} from "../blueprint/blueprint-scenarios";

const NORMATIVE =
  /deserv|should|important|good|right amount|ideal|appropriate|adequate|enough|poor|%/i;

const byId = (id: string): BlueprintScenario => {
  const s = ALL_SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`missing scenario ${id}`);
  return s;
};

describe("blueprint golden scenarios", () => {
  it("has unique scenario ids", () => {
    const ids = ALL_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(ALL_SCENARIOS.map((s) => [s.id, s] as [string, BlueprintScenario]))(
    "%s",
    (_id, s) => {
      it("validateBlueprint yields exactly the declared issues", () => {
        const got = validateBlueprint(s.blueprint, s.declared).map((i) => ({
          code: i.code,
          severity: i.severity,
          ...(i.objectiveId === undefined ? {} : { objectiveId: i.objectiveId }),
        }));
        expect(got).toEqual(s.expected.issues);
      });

      it("compareCoverage yields the declared statuses", () => {
        const r = compareCoverage(s.blueprint, s.declared, s.items);
        expect(r.totalStatus).toBe(s.expected.totalStatus);
        expect(Object.fromEntries(r.cells.map((c) => [c.objectiveId, c.status]))).toEqual(
          s.expected.cellStatuses,
        );
        expect(r.unallocated.map((u) => u.objectiveId)).toEqual(s.expected.unallocated);
        expect(r.coverage.covered).toBe(s.expected.covered);
        expect(r.coverage.declared).toBe(s.expected.declared);
        if (s.expected.topics) expect(r.topics).toEqual(s.expected.topics);
      });

      it("is deterministic, order independent, and does not mutate fixtures", () => {
        const before = JSON.stringify(s);
        const a = compareCoverage(s.blueprint, s.declared, s.items);
        const b = compareCoverage(s.blueprint, s.declared, [...s.items].reverse());
        expect(b).toEqual(a);
        expect(JSON.stringify(s)).toBe(before);
      });

      it("documents the coverage/quality boundary", () => {
        // Coverage facts come first; the quality part must disclaim, never assert.
        const m = /^DETERMINISTIC COVERAGE: ([\s\S]+?) PEDAGOGICAL QUALITY: ([\s\S]+)$/.exec(s.boundary);
        expect(m).not.toBeNull();
        expect(m![2]).toMatch(/\b(not|never|no)\b/i);
        expect(s.notes.length).toBeGreaterThan(0);
      });
    },
  );

  it("allocation-within-bounds has coverage ratio 1; omitted objective has ratio below 1 and O3 at zero", () => {
    const bal = byId("allocation-within-bounds");
    expect(compareCoverage(bal.blueprint, bal.declared, bal.items).coverage.ratio).toBe(1);
    const om = byId("objective-omitted");
    const r = compareCoverage(om.blueprint, om.declared, om.items);
    expect(r.coverage.ratio).toBeLessThan(1);
    expect(r.cells.find((c) => c.objectiveId === "O3")).toMatchObject({
      actual: 0,
      status: "UNDER",
    });
  });

  it("overrepresented objective reports OVER with actual above max", () => {
    const s = byId("objective-overrepresented");
    const cell = compareCoverage(s.blueprint, s.declared, s.items).cells.find(
      (c) => c.objectiveId === "O1",
    );
    expect(cell).toMatchObject({ actual: 2, max: 1, status: "OVER" });
  });

  it("cognitive/difficulty metadata is ignored: same report as without it, no findings", () => {
    const s = COGNITIVE_DIFFICULTY_NOT_EVALUATED;
    const stripped = s.items.map((i) => ({
      questionId: i.questionId,
      objectiveIds: i.objectiveIds,
    }));
    const withMeta = compareCoverage(s.blueprint, s.declared, s.items);
    expect(withMeta).toEqual(compareCoverage(s.blueprint, s.declared, stripped));
    expect(JSON.stringify(withMeta)).not.toMatch(/cognitive|difficulty/i);
    expect(validateBlueprint(s.blueprint, s.declared)).toEqual([]);
  });

  it("no issue message in any scenario contains normative wording", () => {
    let seen = 0;
    for (const s of ALL_SCENARIOS) {
      for (const i of validateBlueprint(s.blueprint, s.declared)) {
        seen += 1;
        expect(i.message).not.toMatch(NORMATIVE);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });
});

/**
 * Golden Dataset v0.1 + calibration harness tests (Run 2026-10-08-ASSESSMENT-ENGINE-002, Slices B5/B6).
 *
 * The EXPECTED_* constants below are a REGRESSION GUARD: if a linter heuristic, threshold or fixture changes,
 * the calibration report changes and this test shows the diff. Updating them is a deliberate, reviewed act
 * (and docs/ASSESSMENT_CALIBRATION_V0_1.md must be regenerated from formatCalibrationMarkdown).
 * Ratios come from a tiny synthetic fixture and are indicative only.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { formatCalibrationMarkdown, runCalibration } from "../golden/calibration";
import { GOLDEN_DATASET_V0_1 } from "../golden/golden-dataset-v0-1";
import type { GoldenDataset } from "../golden/golden-types";
import { lintQuestionItem } from "../question-lint";

/** [code, expected, TP, FN, FP, negativeLabels] */
const EXPECTED_CHECKS: ReadonlyArray<readonly [string, number, number, number, number, number]> = [
  ["ARTICLE_MISMATCH", 1, 0, 1, 0, 0],
  ["CORRECT_COUNT_INVALID", 2, 2, 0, 0, 18],
  ["CORRECT_IDS_TOO_MANY", 1, 1, 0, 0, 16],
  ["CORRECT_ID_UNKNOWN", 1, 1, 0, 0, 17],
  ["DUPLICATE_STEM_EXACT", 1, 1, 0, 0, 8],
  ["DUPLICATE_STEM_NORMALIZED", 2, 2, 0, 0, 7],
  ["EXPLANATION_MISSING", 1, 1, 0, 0, 16],
  ["INPUT_UNREADABLE", 1, 1, 0, 0, 16],
  ["KEY_LONGEST_OPTION", 3, 3, 0, 0, 19],
  ["KEY_POSITION_IMBALANCE", 1, 1, 0, 0, 4],
  ["KEY_POSITION_RUN", 1, 1, 0, 0, 4],
  ["KEY_STEM_LEXICAL_OVERLAP", 5, 4, 1, 0, 16],
  ["NEAR_DUPLICATE_STEM", 3, 2, 1, 0, 5],
  ["OPTIONS_TOO_FEW", 2, 2, 0, 0, 16],
  ["OPTIONS_TOO_MANY", 1, 1, 0, 0, 16],
  ["OPTION_ABSOLUTE_TERM", 3, 3, 0, 0, 16],
  ["OPTION_ALL_OF_ABOVE", 3, 3, 0, 0, 18],
  ["OPTION_COMBINATION_REFERENCE", 1, 0, 1, 0, 0],
  ["OPTION_DUPLICATE_EXACT", 1, 1, 0, 0, 26],
  ["OPTION_DUPLICATE_NORMALIZED", 10, 10, 0, 0, 18],
  ["OPTION_EMPTY", 1, 1, 0, 0, 16],
  ["OPTION_ID_DUPLICATE", 1, 1, 0, 0, 16],
  ["OPTION_LENGTH_IMBALANCE", 2, 2, 0, 0, 19],
  ["OPTION_NONE_OF_ABOVE", 2, 2, 0, 0, 19],
  ["OPTION_OVERLAP_HIGH", 2, 1, 1, 0, 16],
  ["OPTION_STYLE_OUTLIER", 1, 0, 1, 0, 0],
  ["OPTION_WHITESPACE_ANOMALY", 4, 4, 0, 0, 16],
  ["QUESTION_TYPE_UNSUPPORTED", 3, 3, 0, 0, 16],
  ["SET_ANALYSIS_TRUNCATED", 1, 1, 0, 0, 2],
  ["SET_ITEMS_TRUNCATED", 1, 1, 0, 0, 2],
  ["SET_KEY_LENGTH_BIAS", 1, 1, 0, 0, 3],
  ["SET_TOO_SMALL", 1, 1, 0, 0, 2],
  ["STEM_EMPTY", 2, 2, 0, 0, 16],
  ["STEM_NEGATIVE_WORDING", 3, 3, 0, 0, 16],
  ["STEM_TEMPLATE_REPEATED", 1, 1, 0, 0, 3],
  ["STEM_TOO_SHORT", 1, 1, 0, 0, 17],
  ["TEXT_TRUNCATED", 2, 2, 0, 0, 16],
];

const EXPECTED_COUNTS = {
  total: 89,
  item: 72,
  set: 17,
  clean: 18,
  unsupportedSemantic: 6,
  withKnownMiss: 6,
  withKnownFalsePositive: 0,
};

const EXPECTED_TOTALS = {
  expectedDetections: 73,
  truePositive: 67,
  falseNegative: 6,
  falseNegativeHeuristicGap: 3,
  falseNegativeNotImplemented: 3,
  falsePositive: 0,
  cleanCases: 18,
  cleanCasesWithWarningOrError: 0,
};

const EXPECTED_SUMMARY = [
  "RECALL-LIKE (all labelled detections): 67/73 caught.",
  "FN count: 6 (3 HEURISTIC_GAP on implemented checks, 3 NOT_IMPLEMENTED checks).",
  "PRECISION-LIKE (labelled detections vs false alarms): 67/67.",
  "FP count: 0 (all documented as KNOWN_FALSE_POSITIVE: yes).",
  "CLEAN cases with a WARNING/ERROR: 0 of 18.",
  "UNSUPPORTED SEMANTIC CASES: 6 (intentionally not asserted against the linter).",
  "Tiny synthetic fixture: all ratios are INDICATIVE ONLY, not statistics. Thresholds remain product-design defaults.",
];

const EXPECTED_KNOWN_MISS_IDS = [
  "WEAK-LEAKAGE-HE-INFLECTION-01",
  "WEAK-GRAMMAR-CUE-EN-01",
  "WEAK-STYLE-CUE-HE-01",
  "WEAK-COMBINATION-EN-01",
  "OVERLAP-OPTIONS-HE-BOUNDARY-01",
  "SET-NEAR-DUP-INFLECTION-01",
];

const EXPECTED_KNOWN_FP_IDS: string[] = [];

const EXPECTED_SEMANTIC_IDS = [
  "SEM-AMBIGUOUS-01",
  "SEM-DISTRACTORS-PLAUSIBLE-01",
  "SEM-DISTRACTORS-IMPLAUSIBLE-01",
  "SEM-EQUIVALENT-STEMS-NOTE-01",
  "SET-TOPIC-UNDERCOVERAGE-01",
  "SET-RECALL-OVERUSE-01",
];

describe("Golden Dataset v0.1 hygiene", () => {
  const cases = GOLDEN_DATASET_V0_1.cases;

  it("has unique ids, tags and a description for every case", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    for (const c of cases) {
      expect(c.tags.length, c.id).toBeGreaterThan(0);
      expect(c.description.length, c.id).toBeGreaterThan(10);
    }
  });

  it("is Hebrew-first, with an English and a mixed-script slice", () => {
    const has = (tag: string): number => cases.filter((c) => c.tags.includes(tag)).length;
    expect(has("hebrew")).toBeGreaterThan(has("english"));
    expect(has("english")).toBeGreaterThanOrEqual(8);
    expect(has("mixed-script")).toBeGreaterThanOrEqual(3);
  });

  it("labels semantic judgments with SEMANTIC_EXPECTATION and never mixes them into CLEAN cases", () => {
    for (const c of cases) {
      const e = c.expected;
      if (e.semanticExpectation !== undefined) {
        expect(e.semanticExpectation.startsWith("SEMANTIC_EXPECTATION:"), c.id).toBe(true);
        expect(e.clean, c.id).not.toBe(true);
      }
      if (e.clean === true) expect(e.expectedCodes, c.id).toEqual([]);
    }
  });

  it("contains only synthetic content: no real-course markers", () => {
    expect(JSON.stringify(cases.filter((c) => c.id !== "ADV-THROWING-INPUT-01"))).not.toMatch(/רופין|ruppin/i);
  });
});

describe("calibration report (regression guard)", () => {
  const report = runCalibration(GOLDEN_DATASET_V0_1);

  it("has no undocumented disagreement: every miss is KNOWN_MISS and every false alarm is KNOWN_FALSE_POSITIVE", () => {
    expect(report.undocumentedFindings).toEqual([]);
  });

  it("matches the exact case counts and totals", () => {
    expect(report.caseCounts).toEqual(EXPECTED_COUNTS);
    expect(report.totals).toEqual(EXPECTED_TOTALS);
  });

  it("matches the exact per-check results", () => {
    const actual = report.checks.map((c) => [c.code, c.expectedDetections, c.truePositive, c.falseNegative, c.falsePositive, c.negativeLabels]);
    expect(actual).toEqual(EXPECTED_CHECKS.map((r) => [...r]));
  });

  it("matches the exact plain-language summary", () => {
    expect(report.summary).toEqual(EXPECTED_SUMMARY);
  });

  it("lists exactly the documented KNOWN_MISS, KNOWN_FALSE_POSITIVE and unsupported semantic cases", () => {
    expect(report.knownMisses.map((m) => m.caseId)).toEqual(EXPECTED_KNOWN_MISS_IDS);
    expect(report.knownFalsePositives.map((m) => m.caseId)).toEqual(EXPECTED_KNOWN_FP_IDS);
    expect(report.unsupportedSemanticCases.map((m) => m.caseId)).toEqual(EXPECTED_SEMANTIC_IDS);
  });

  it("is deterministic", () => {
    expect(runCalibration(GOLDEN_DATASET_V0_1)).toEqual(report);
    expect(formatCalibrationMarkdown(runCalibration(GOLDEN_DATASET_V0_1))).toBe(formatCalibrationMarkdown(report));
  });

  it("keeps unimplemented checks identifiable", () => {
    const notImpl = report.checks.filter((c) => !c.implemented).map((c) => c.code);
    expect(notImpl).toEqual(["ARTICLE_MISMATCH", "OPTION_COMBINATION_REFERENCE", "OPTION_STYLE_OUTLIER"]);
  });
});

describe("named false-positive guards (Hebrew and English near-misses)", () => {
  const byId = (id: string) => {
    const c = GOLDEN_DATASET_V0_1.cases.find((x) => x.id === id);
    if (!c || c.scope !== "ITEM") throw new Error(`missing item case ${id}`);
    return c;
  };

  it.each(["CLEAN-HE-MALE-01", "CLEAN-HE-MALE-02", "CLEAN-HE-MELACHA-01", "CLEAN-EN-NEARMISS-01", "CLEAN-HE-KAL-01"])(
    "%s produces no issue at all",
    (id) => {
      expect(lintQuestionItem(byId(id).input)).toEqual([]);
    },
  );
});

describe("harness self-test: a drift must surface", () => {
  it("flags an undocumented miss, a stale KNOWN_MISS and an undocumented false positive", () => {
    const base = GOLDEN_DATASET_V0_1.cases.find((c) => c.id === "STRONG-SC-HE-01");
    const dup = GOLDEN_DATASET_V0_1.cases.find((c) => c.id === "DUP-EXACT-01");
    if (!base || !dup) throw new Error("fixture missing");
    const broken: GoldenDataset = {
      version: "test",
      cases: [
        { ...base, id: "X-UNDOC-MISS", expected: { expectedCodes: ["OPTION_ABSOLUTE_TERM"], forbiddenCodes: [] } },
        {
          ...dup,
          id: "X-STALE-MISS",
          expected: {
            expectedCodes: ["OPTION_DUPLICATE_EXACT"],
            forbiddenCodes: [],
            knownMiss: { codes: ["OPTION_DUPLICATE_EXACT"], kind: "HEURISTIC_GAP", reason: "stale" },
          },
        },
        { ...dup, id: "X-FP", expected: { expectedCodes: [], forbiddenCodes: ["OPTION_DUPLICATE_EXACT"] } },
      ],
    };
    expect(runCalibration(broken).undocumentedFindings).toEqual([
      "X-UNDOC-MISS: UNDOCUMENTED miss OPTION_ABSOLUTE_TERM",
      "X-STALE-MISS: STALE knownMiss OPTION_DUPLICATE_EXACT (linter now emits it)",
      "X-FP: UNDOCUMENTED false positive OPTION_DUPLICATE_EXACT",
    ]);
  });
});

describe("docs/ASSESSMENT_CALIBRATION_V0_1.md", () => {
  it("embeds the current generated report (drift guard)", () => {
    const path = fileURLToPath(new URL("../../../../docs/ASSESSMENT_CALIBRATION_V0_1.md", import.meta.url));
    const doc = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
    expect(doc).toContain(formatCalibrationMarkdown(runCalibration(GOLDEN_DATASET_V0_1)));
  });
});

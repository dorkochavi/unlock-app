/**
 * Held-out evaluation (Golden Dataset v0.3, FRESH_HELD_OUT_V0_3) tests (Run 2026-10-09-ASSESSMENT-ENGINE-007, Slice E1).
 *
 * Provenance: MODEL_AUTHORED_HELD_OUT corpus, MODEL_LABELED_NOT_HUMAN_APPROVED labels. NOT human ground truth; never pooled
 * with v0.1 / v0.2 / FIRST_BLIND. The linter is FROZEN and evaluated unchanged. The EXPECTED_* constants are the FIRST
 * OBSERVED values, recorded as a REGRESSION GUARD: results, not targets. Nothing here may be used to tune the linter,
 * thresholds, cue lists, labels or cases. Language is derived from the corpus text (any Hebrew letter => HEBREW); stratum
 * comes from author-intent.json.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { IMPLEMENTED_ITEM_CODES, IMPLEMENTED_SET_CODES } from "../golden/calibration";
import {
  KNOWN_NOT_IMPLEMENTED_CODES,
  runHeldOutEvaluation,
  runHeldOutEvaluationByGroup,
  type HeldOutCorpus,
  type HeldOutLabels,
  type HeldOutReport,
} from "../golden/heldout-eval";

const DIR = "../golden/heldout-v0-3/";
const readRaw = (name: string): string => readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");
const sha256Lf = (s: string): string => createHash("sha256").update(s.replace(/\r\n/g, "\n"), "utf8").digest("hex");

const corpus = JSON.parse(readRaw("corpus.json")) as HeldOutCorpus;
const labels = JSON.parse(readRaw("labels.json")) as HeldOutLabels;
const intent = (JSON.parse(readRaw("author-intent.json")) as { intent: Record<string, { stratum: string }> }).intent;
const report = runHeldOutEvaluation(corpus, labels);

const HEBREW = /[֐-׿]/;
const languageOf: Record<string, string> = {};
const stratumOf: Record<string, string> = {};
for (const c of corpus.cases) {
  languageOf[c.caseId] = HEBREW.test(JSON.stringify(c)) ? "HEBREW" : "ENGLISH";
  stratumOf[c.caseId] = intent[c.caseId]?.stratum ?? "MISSING";
}
const byLanguage = runHeldOutEvaluationByGroup(corpus, labels, languageOf);
const byStratum = runHeldOutEvaluationByGroup(corpus, labels, stratumOf);

/** [code, expected, TP, FN, FP, unlabeled] */
type CheckRow = readonly [string, number, number, number, number, number];
const EXPECTED_CHECKS: CheckRow[] = [
  ["EXPLANATION_MISSING", 1, 1, 0, 0, 0],
  ["KEY_LONGEST_OPTION", 5, 5, 0, 0, 1],
  ["KEY_POSITION_IMBALANCE", 1, 1, 0, 0, 0],
  ["KEY_POSITION_RUN", 1, 1, 0, 0, 0],
  ["OPTION_ABSOLUTE_TERM", 10, 10, 0, 0, 0],
  ["OPTION_ALL_OF_ABOVE", 1, 1, 0, 0, 0], // Run 008 change: HO3-071 now caught (FUB-077)
  ["OPTION_DUPLICATE_EXACT", 1, 1, 0, 0, 0],
  ["OPTION_LENGTH_IMBALANCE", 3, 3, 0, 0, 0],
  ["OPTION_NUMERIC_UNORDERED", 1, 0, 1, 0, 0],
  ["OPTION_PUNCTUATION_INCONSISTENT", 1, 0, 1, 0, 0],
  ["OPTION_STYLE_OUTLIER", 2, 0, 2, 0, 0],
  ["STEM_NEGATIVE_WORDING", 1, 1, 0, 0, 0], // Run 008 change: HO3-005 FP and HO3-058 unlabeled gone (FUB-076)
  ["STEM_TOO_SHORT", 9, 5, 4, 0, 0], // Run 008 change: HO3-071 unlabeled gone (FUB-075 מהם)
];

const EXPECTED_COUNTS = {
  total: 72,
  item: 70,
  set: 2,
  clean: 38,
  flawed: 34,
  withSemanticExpectation: 18,
  semanticOnly: 4,
  languageReviewRequired: 6,
};

const EXPECTED_TOTALS = {
  expectedDetections: 37,
  // Run 008 change: TP 28->29, FN 9->8 (gap 5->4), FP 1->0, clean-warned 1->0, unlabeled 3->1
  truePositive: 29,
  falseNegative: 8,
  falseNegativeHeuristicGap: 4,
  falseNegativeNotImplemented: 4,
  falsePositive: 0,
  cleanCases: 38,
  cleanCasesWithWarningOrError: 0,
  unlabeledEmissions: 1,
};

const EXPECTED_SET_LEVEL = {
  setScope: { expected: 2, tp: 2, fn: 0, fp: 0 },
  itemInSet: { expected: 1, tp: 0, fn: 1, fp: 0 },
};

const EXPECTED_SUMMARY = [
  "RECALL-LIKE (all labelled detections): 29/37 caught.",
  "FN count: 8 (4 HEURISTIC_GAP on implemented checks, 4 NOT_IMPLEMENTED checks).",
  "PRECISION-LIKE (labelled detections vs false alarms): 29/29.",
  "FP count: 0 (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).",
  "CLEAN cases with a WARNING/ERROR: 0 of 38.",
  "UNLABELED_EMISSIONS: 1 (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).",
  "SEMANTIC-ONLY cases: 4 (FLAWED with no deterministic expectation; not assertable against the linter).",
  "Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1.",
];

/** "ref|code" -> kind */
const EXPECTED_FN_KINDS: Array<readonly [string, string]> = [
  ["HO3-032|OPTION_PUNCTUATION_INCONSISTENT", "NOT_IMPLEMENTED"],
  ["HO3-032|OPTION_STYLE_OUTLIER", "NOT_IMPLEMENTED"],
  ["HO3-038|STEM_TOO_SHORT", "HEURISTIC_GAP"],
  ["HO3-040|STEM_TOO_SHORT", "HEURISTIC_GAP"],
  ["HO3-042|STEM_TOO_SHORT", "HEURISTIC_GAP"],
  ["HO3-044|STEM_TOO_SHORT", "HEURISTIC_GAP"],
  ["HO3-065|OPTION_STYLE_OUTLIER", "NOT_IMPLEMENTED"],
  ["HO3-070/item3|OPTION_NUMERIC_UNORDERED", "NOT_IMPLEMENTED"],
  // Run 008 change: ["HO3-071|OPTION_ALL_OF_ABOVE", "HEURISTIC_GAP"] removed (now TP, FUB-077)
];
// Run 008 change: HO3-005 FP, HO3-058 and HO3-071|STEM_TOO_SHORT unlabeled removed (FUB-076, FUB-075)
const EXPECTED_FP: string[] = [];
const EXPECTED_UNLABELED = ["HO3-048|KEY_LONGEST_OPTION"];
const EXPECTED_SEMANTIC_ONLY = ["HO3-025", "HO3-028", "HO3-033", "HO3-058"];

interface GroupExpectation {
  /** [total, clean, flawed] */
  cases: [number, number, number];
  /** [expectedDetections, TP, FN, FN heuristic gap, FN not implemented, FP, clean cases with warning/error, unlabeled] */
  totals: [number, number, number, number, number, number, number, number];
  checks: CheckRow[];
  fn: string[];
  fp: string[];
  unl: string[];
}
const EXPECTED_BY_LANGUAGE: Record<string, GroupExpectation> = {
  ENGLISH: {
    cases: [27, 13, 14],
    totals: [16, 11, 5, 2, 3, 0, 0, 0],
    checks: [
      ["EXPLANATION_MISSING", 1, 1, 0, 0, 0],
      ["KEY_LONGEST_OPTION", 2, 2, 0, 0, 0],
      ["OPTION_ABSOLUTE_TERM", 5, 5, 0, 0, 0],
      ["OPTION_LENGTH_IMBALANCE", 1, 1, 0, 0, 0],
      ["OPTION_NUMERIC_UNORDERED", 1, 0, 1, 0, 0],
      ["OPTION_PUNCTUATION_INCONSISTENT", 1, 0, 1, 0, 0],
      ["OPTION_STYLE_OUTLIER", 1, 0, 1, 0, 0],
      ["STEM_TOO_SHORT", 4, 2, 2, 0, 0],
    ],
    fn: ["HO3-032|OPTION_PUNCTUATION_INCONSISTENT", "HO3-032|OPTION_STYLE_OUTLIER", "HO3-038|STEM_TOO_SHORT", "HO3-044|STEM_TOO_SHORT", "HO3-070/item3|OPTION_NUMERIC_UNORDERED"],
    fp: [],
    unl: [],
  },
  HEBREW: {
    cases: [45, 25, 20],
    totals: [21, 18, 3, 2, 1, 0, 0, 1], // Run 008 change
    checks: [
      ["KEY_LONGEST_OPTION", 3, 3, 0, 0, 1],
      ["KEY_POSITION_IMBALANCE", 1, 1, 0, 0, 0],
      ["KEY_POSITION_RUN", 1, 1, 0, 0, 0],
      ["OPTION_ABSOLUTE_TERM", 5, 5, 0, 0, 0],
      ["OPTION_ALL_OF_ABOVE", 1, 1, 0, 0, 0],
      ["OPTION_DUPLICATE_EXACT", 1, 1, 0, 0, 0],
      ["OPTION_LENGTH_IMBALANCE", 2, 2, 0, 0, 0],
      ["OPTION_STYLE_OUTLIER", 1, 0, 1, 0, 0],
      ["STEM_NEGATIVE_WORDING", 1, 1, 0, 0, 0],
      ["STEM_TOO_SHORT", 5, 3, 2, 0, 0],
    ],
    fn: ["HO3-040|STEM_TOO_SHORT", "HO3-042|STEM_TOO_SHORT", "HO3-065|OPTION_STYLE_OUTLIER"],
    fp: [],
    unl: ["HO3-048|KEY_LONGEST_OPTION"],
  },
};
const EXPECTED_BY_STRATUM: Record<string, GroupExpectation> = {
  A: {
    cases: [18, 10, 8],
    totals: [8, 8, 0, 0, 0, 0, 0, 0], // Run 008 change: HO3-005 FP gone
    checks: [
      ["OPTION_ABSOLUTE_TERM", 8, 8, 0, 0, 0],
    ],
    fn: [],
    fp: [],
    unl: [],
  },
  B: {
    cases: [16, 9, 7],
    totals: [8, 6, 2, 0, 2, 0, 0, 0],
    checks: [
      ["KEY_LONGEST_OPTION", 4, 4, 0, 0, 0],
      ["OPTION_LENGTH_IMBALANCE", 2, 2, 0, 0, 0],
      ["OPTION_PUNCTUATION_INCONSISTENT", 1, 0, 1, 0, 0],
      ["OPTION_STYLE_OUTLIER", 1, 0, 1, 0, 0],
    ],
    fn: ["HO3-032|OPTION_PUNCTUATION_INCONSISTENT", "HO3-032|OPTION_STYLE_OUTLIER"],
    fp: [],
    unl: [],
  },
  C: {
    cases: [18, 9, 9],
    totals: [9, 5, 4, 4, 0, 0, 0, 1],
    checks: [
      ["KEY_LONGEST_OPTION", 0, 0, 0, 0, 1],
      ["STEM_TOO_SHORT", 9, 5, 4, 0, 0],
    ],
    fn: ["HO3-038|STEM_TOO_SHORT", "HO3-040|STEM_TOO_SHORT", "HO3-042|STEM_TOO_SHORT", "HO3-044|STEM_TOO_SHORT"],
    fp: [],
    unl: ["HO3-048|KEY_LONGEST_OPTION"],
  },
  D: {
    cases: [12, 9, 3],
    totals: [2, 2, 0, 0, 0, 0, 0, 0], // Run 008 change: HO3-058 unlabeled gone
    checks: [
      ["OPTION_ABSOLUTE_TERM", 2, 2, 0, 0, 0],
    ],
    fn: [],
    fp: [],
    unl: [],
  },
  E: {
    cases: [8, 1, 7],
    totals: [10, 8, 2, 0, 2, 0, 0, 0], // Run 008 change
    checks: [
      ["EXPLANATION_MISSING", 1, 1, 0, 0, 0],
      ["KEY_LONGEST_OPTION", 1, 1, 0, 0, 0],
      ["KEY_POSITION_IMBALANCE", 1, 1, 0, 0, 0],
      ["KEY_POSITION_RUN", 1, 1, 0, 0, 0],
      ["OPTION_ALL_OF_ABOVE", 1, 1, 0, 0, 0],
      ["OPTION_DUPLICATE_EXACT", 1, 1, 0, 0, 0],
      ["OPTION_LENGTH_IMBALANCE", 1, 1, 0, 0, 0],
      ["OPTION_NUMERIC_UNORDERED", 1, 0, 1, 0, 0],
      ["OPTION_STYLE_OUTLIER", 1, 0, 1, 0, 0],
      ["STEM_NEGATIVE_WORDING", 1, 1, 0, 0, 0],
    ],
    fn: ["HO3-065|OPTION_STYLE_OUTLIER", "HO3-070/item3|OPTION_NUMERIC_UNORDERED"],
    fp: [],
    unl: [],
  },
};

const key = (f: { ref: string; code: string }): string => f.ref + "|" + f.code;
const rows = (r: HeldOutReport): Array<Array<string | number>> => r.checks.map((c) => [c.code, c.expected, c.tp, c.fn, c.fp, c.unlabeled]);
const totalsTuple = (r: HeldOutReport): number[] => [
  r.totals.expectedDetections, r.totals.truePositive, r.totals.falseNegative, r.totals.falseNegativeHeuristicGap,
  r.totals.falseNegativeNotImplemented, r.totals.falsePositive, r.totals.cleanCasesWithWarningOrError, r.totals.unlabeledEmissions,
];

describe("held-out v0.3 freeze invariant", () => {
  it("matches the sha256 record of the frozen files (LF-normalized)", () => {
    const rec = JSON.parse(readRaw("freeze-hashes.json")) as {
      version: string;
      evidenceIdentity: string;
      cases: number;
      sha256: Record<string, string>;
    };
    expect(rec.version).toBe("v0.3-heldout");
    expect(rec.evidenceIdentity).toBe("FRESH_HELD_OUT_V0_3");
    expect(Object.keys(rec.sha256).sort()).toEqual(["author-intent.json", "corpus.json", "label-review.json", "labels.json"]);
    for (const [name, hash] of Object.entries(rec.sha256)) expect(sha256Lf(readRaw(name)), name).toBe(hash);
    expect(rec.cases).toBe(corpus.cases.length);
  });
});

describe("held-out v0.3 ids / labels coherence", () => {
  const vocabulary = new Set<string>([...IMPLEMENTED_ITEM_CODES, ...IMPLEMENTED_SET_CODES, ...KNOWN_NOT_IMPLEMENTED_CODES]);

  it("labels every case exactly once, with matching scope", () => {
    const ids = corpus.cases.map((c) => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(labels.labels.map((l) => l.caseId).sort()).toEqual([...ids].sort());
    expect(report.integrityFindings).toEqual([]);
  });

  it("assigns every case a stratum A-E and a language", () => {
    for (const c of corpus.cases) expect(["A", "B", "C", "D", "E"], c.caseId).toContain(stratumOf[c.caseId]);
    expect(Object.keys(byLanguage)).toEqual(["ENGLISH", "HEBREW"]);
  });

  it("uses only known vocabulary codes in every label", () => {
    for (const l of labels.labels) {
      const codes = [
        ...(l.expectedCodes ?? []), ...(l.forbiddenCodes ?? []), ...(l.expectedSetCodes ?? []), ...(l.forbiddenSetCodes ?? []),
        ...Object.values(l.itemCodes ?? {}).flat(),
      ];
      for (const code of codes) expect(vocabulary.has(code), l.caseId + " " + code).toBe(true);
    }
  });

  it("keeps CLEAN labels free of expected codes", () => {
    for (const l of labels.labels) {
      if (l.label !== "CLEAN") continue;
      expect([...(l.expectedCodes ?? []), ...(l.expectedSetCodes ?? []), ...Object.values(l.itemCodes ?? {}).flat()], l.caseId).toEqual([]);
    }
  });
});

describe("held-out v0.3 evaluation (first-observed regression guard)", () => {
  it("matches the exact case counts, totals and set-level split", () => {
    expect(report.caseCounts).toEqual(EXPECTED_COUNTS);
    expect(report.totals).toEqual(EXPECTED_TOTALS);
    expect(report.setLevel).toEqual(EXPECTED_SET_LEVEL);
  });

  it("matches the exact per-check results", () => {
    expect(rows(report)).toEqual(EXPECTED_CHECKS.map((r) => [...r]));
  });

  it("matches the exact summary", () => {
    expect(report.summary).toEqual(EXPECTED_SUMMARY);
  });

  it("lists exactly the observed FN / FP / UNLABELED_EMISSION / semantic-only findings", () => {
    expect(report.falseNegatives.map(key)).toEqual(EXPECTED_FN_KINDS.map((x) => x[0]));
    expect(report.falsePositives.map(key)).toEqual(EXPECTED_FP);
    expect(report.unlabeledEmissions.map(key)).toEqual(EXPECTED_UNLABELED);
    expect(report.semanticOnlyCases.map((s) => s.caseId)).toEqual(EXPECTED_SEMANTIC_ONLY);
  });

  it("classifies every FN as NOT_IMPLEMENTED exactly when the linter has no such check, matching the observed kinds", () => {
    const impl = new Set([...IMPLEMENTED_ITEM_CODES, ...IMPLEMENTED_SET_CODES]);
    const kinds = new Map(EXPECTED_FN_KINDS);
    for (const f of report.falseNegatives) {
      expect(f.kind, key(f)).toBe(impl.has(f.code) ? "HEURISTIC_GAP" : "NOT_IMPLEMENTED");
      expect(f.kind, key(f)).toBe(kinds.get(key(f)));
    }
  });

  it("records the Run-006 target rules (KEY_STEM_LEXICAL_OVERLAP is neither emitted nor expected)", () => {
    const row = (r: HeldOutReport, code: string) => r.checks.find((c) => c.code === code);
    expect(row(report, "KEY_STEM_LEXICAL_OVERLAP")).toBeUndefined();
    expect(row(byLanguage.ENGLISH, "OPTION_ABSOLUTE_TERM")).toMatchObject({ expected: 5, tp: 5, fn: 0, fp: 0, unlabeled: 0 });
    expect(row(byLanguage.HEBREW, "OPTION_ABSOLUTE_TERM")).toMatchObject({ expected: 5, tp: 5, fn: 0, fp: 0, unlabeled: 0 });
    expect(row(byLanguage.ENGLISH, "STEM_TOO_SHORT")).toMatchObject({ expected: 4, tp: 2, fn: 2, fp: 0, unlabeled: 0 });
    expect(row(byLanguage.HEBREW, "STEM_TOO_SHORT")).toMatchObject({ expected: 5, tp: 3, fn: 2, fp: 0, unlabeled: 0 }); // Run 008 change: HO3-071 unlabeled gone
  });

  for (const [name, groups, expected] of [
    ["language", byLanguage, EXPECTED_BY_LANGUAGE],
    ["stratum", byStratum, EXPECTED_BY_STRATUM],
  ] as const) {
    it(`matches the exact per-${name} breakdown`, () => {
      expect(Object.keys(groups)).toEqual(Object.keys(expected));
      for (const [g, e] of Object.entries(expected)) {
        const r = groups[g];
        expect([r.caseCounts.total, r.caseCounts.clean, r.caseCounts.flawed], g).toEqual(e.cases);
        expect(totalsTuple(r), g).toEqual(e.totals);
        expect(rows(r), g).toEqual(e.checks.map((c) => [...c]));
        expect(r.falseNegatives.map(key), g).toEqual(e.fn);
        expect(r.falsePositives.map(key), g).toEqual(e.fp);
        expect(r.unlabeledEmissions.map(key), g).toEqual(e.unl);
      }
    });

    it(`per-${name} breakdown partitions the whole-corpus totals`, () => {
      const sum = (f: (r: HeldOutReport) => number): number => Object.values(groups).reduce((a, r) => a + f(r), 0);
      expect(sum((r) => r.caseCounts.total)).toBe(report.caseCounts.total);
      expect(sum((r) => r.totals.truePositive)).toBe(report.totals.truePositive);
      expect(sum((r) => r.totals.falseNegative)).toBe(report.totals.falseNegative);
      expect(sum((r) => r.totals.falsePositive)).toBe(report.totals.falsePositive);
      expect(sum((r) => r.totals.unlabeledEmissions)).toBe(report.totals.unlabeledEmissions);
    });
  }

  it("is deterministic", () => {
    expect(runHeldOutEvaluation(corpus, labels)).toEqual(report);
    expect(runHeldOutEvaluationByGroup(corpus, labels, languageOf)).toEqual(byLanguage);
  });
});

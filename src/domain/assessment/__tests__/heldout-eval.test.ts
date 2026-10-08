/**
 * Held-out evaluation (Golden Dataset v0.2) tests (Run 2026-10-09-ASSESSMENT-ENGINE-004, Slice A4; FUB-063).
 *
 * Provenance: MODEL_AUTHORED_HELD_OUT corpus, MODEL_LABELED_NOT_HUMAN_APPROVED labels. NOT human ground truth.
 * The EXPECTED_* constants are the FIRST-RUN observed numbers, recorded as a REGRESSION GUARD. They are results,
 * not targets: nothing here may be used to tune the linter, thresholds, cue lists, labels or cases.
 * Changing the frozen files must fail the freeze test; changing the linter must surface in the numbers.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { IMPLEMENTED_ITEM_CODES, IMPLEMENTED_SET_CODES } from "../golden/calibration";
import {
  formatHeldOutMarkdown,
  KNOWN_NOT_IMPLEMENTED_CODES,
  runHeldOutEvaluation,
  type HeldOutCorpus,
  type HeldOutLabels,
} from "../golden/heldout-eval";

const DIR = "../golden/heldout-v0-2/";
const readRaw = (name: string): string => readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");
const sha256Lf = (s: string): string => createHash("sha256").update(s.replace(/\r\n/g, "\n"), "utf8").digest("hex");

const corpus = JSON.parse(readRaw("corpus.json")) as HeldOutCorpus;
const labels = JSON.parse(readRaw("labels.json")) as HeldOutLabels;
const report = runHeldOutEvaluation(corpus, labels);

/** [code, expected, TP, FN, FP, unlabeled] */
const EXPECTED_CHECKS: ReadonlyArray<readonly [string, number, number, number, number, number]> = [
  ["CORRECT_COUNT_INVALID", 2, 2, 0, 0, 0],
  ["CORRECT_ID_UNKNOWN", 1, 1, 0, 0, 0],
  ["DUPLICATE_STEM_EXACT", 1, 1, 0, 0, 0],
  ["DUPLICATE_STEM_NORMALIZED", 1, 1, 0, 0, 0],
  ["EXPLANATION_MISSING", 5, 5, 0, 0, 0],
  ["EXPLANATION_NAMES_ONLY_KEY", 9, 0, 9, 0, 0],
  ["KEY_LONGEST_OPTION", 22, 18, 4, 0, 0],
  ["KEY_POSITION_IMBALANCE", 6, 5, 1, 0, 0],
  ["KEY_POSITION_RUN", 5, 5, 0, 0, 0],
  ["KEY_STEM_LEXICAL_OVERLAP", 1, 0, 1, 0, 3],
  ["NEAR_DUPLICATE_STEM", 1, 1, 0, 0, 1],
  ["OPTIONS_TOO_FEW", 1, 1, 0, 0, 0],
  ["OPTION_ABSOLUTE_TERM", 9, 9, 0, 1, 6],
  ["OPTION_ALL_OF_ABOVE", 1, 1, 0, 0, 0],
  ["OPTION_COMBINATION_REFERENCE", 3, 0, 3, 0, 0],
  ["OPTION_COUNT_UNUSUAL", 1, 0, 1, 0, 0],
  ["OPTION_DUPLICATE_EXACT", 1, 1, 0, 0, 0],
  ["OPTION_LENGTH_IMBALANCE", 15, 15, 0, 0, 3],
  ["OPTION_NONE_OF_ABOVE", 3, 3, 0, 0, 0],
  ["OPTION_NUMERIC_UNORDERED", 9, 0, 9, 0, 0],
  ["OPTION_OVERLAP_HIGH", 0, 0, 0, 1, 1],
  ["OPTION_PREFIX_STEM_REPEAT", 1, 0, 1, 0, 0],
  ["OPTION_PUNCTUATION_INCONSISTENT", 3, 0, 3, 0, 0],
  ["OPTION_STYLE_OUTLIER", 5, 0, 5, 0, 0],
  ["OPTION_WHITESPACE_ANOMALY", 1, 1, 0, 0, 0],
  ["SET_KEY_LENGTH_BIAS", 2, 1, 1, 1, 0],
  ["STEM_DOUBLE_NEGATIVE", 2, 0, 2, 0, 0],
  ["STEM_NEGATIVE_WORDING", 7, 6, 1, 0, 1],
  ["STEM_NO_QUESTION_FORM", 3, 0, 3, 0, 0],
  ["STEM_TEMPLATE_REPEATED", 1, 1, 0, 0, 0],
  ["STEM_TOO_SHORT", 2, 2, 0, 1, 7],
];

const EXPECTED_COUNTS = {
  total: 78,
  item: 70,
  set: 8,
  clean: 20,
  flawed: 58,
  withSemanticExpectation: 29,
  semanticOnly: 12,
  languageReviewRequired: 1
};

const EXPECTED_TOTALS = {
  expectedDetections: 124,
  truePositive: 80,
  falseNegative: 44,
  falseNegativeHeuristicGap: 8,
  falseNegativeNotImplemented: 36,
  falsePositive: 4,
  cleanCases: 20,
  cleanCasesWithWarningOrError: 3,
  unlabeledEmissions: 22
};

const EXPECTED_SET_LEVEL = {
  setScope: {
    expected: 17,
    tp: 15,
    fn: 2,
    fp: 1
  },
  itemInSet: {
    expected: 46,
    tp: 27,
    fn: 19,
    fp: 0
  }
};

const EXPECTED_SUMMARY = [
  "RECALL-LIKE (all labelled detections): 80/124 caught.",
  "FN count: 44 (8 HEURISTIC_GAP on implemented checks, 36 NOT_IMPLEMENTED checks).",
  "PRECISION-LIKE (labelled detections vs false alarms): 80/84.",
  "FP count: 4 (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).",
  "CLEAN cases with a WARNING/ERROR: 3 of 20.",
  "UNLABELED_EMISSIONS: 22 (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).",
  "SEMANTIC-ONLY cases: 12 (FLAWED with no deterministic expectation; not assertable against the linter).",
  "Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1."
];

/** "ref|code" */
const EXPECTED_FN = [
  "HO-017|OPTION_PREFIX_STEM_REPEAT",
  "HO-022|STEM_DOUBLE_NEGATIVE",
  "HO-022|EXPLANATION_NAMES_ONLY_KEY",
  "HO-026|OPTION_COMBINATION_REFERENCE",
  "HO-027|OPTION_COMBINATION_REFERENCE",
  "HO-029|OPTION_PUNCTUATION_INCONSISTENT",
  "HO-029|OPTION_STYLE_OUTLIER",
  "HO-029|KEY_LONGEST_OPTION",
  "HO-030|STEM_NO_QUESTION_FORM",
  "HO-031|EXPLANATION_NAMES_ONLY_KEY",
  "HO-034|OPTION_NUMERIC_UNORDERED",
  "HO-035|OPTION_PUNCTUATION_INCONSISTENT",
  "HO-039|OPTION_COUNT_UNUSUAL",
  "HO-049|OPTION_STYLE_OUTLIER",
  "HO-049|KEY_LONGEST_OPTION",
  "HO-055|KEY_STEM_LEXICAL_OVERLAP",
  "HO-057|STEM_NO_QUESTION_FORM",
  "HO-057|EXPLANATION_NAMES_ONLY_KEY",
  "HO-063|STEM_NEGATIVE_WORDING",
  "HO-064|OPTION_COMBINATION_REFERENCE",
  "HO-067|OPTION_PUNCTUATION_INCONSISTENT",
  "HO-068|OPTION_STYLE_OUTLIER",
  "HO-070|OPTION_STYLE_OUTLIER",
  "HO-071/item3|EXPLANATION_NAMES_ONLY_KEY",
  "HO-072/item1|OPTION_NUMERIC_UNORDERED",
  "HO-072/item2|OPTION_NUMERIC_UNORDERED",
  "HO-072/item3|OPTION_NUMERIC_UNORDERED",
  "HO-072/item5|OPTION_NUMERIC_UNORDERED",
  "HO-072/item6|OPTION_NUMERIC_UNORDERED",
  "HO-072/item7|OPTION_NUMERIC_UNORDERED",
  "HO-072/item8|OPTION_NUMERIC_UNORDERED",
  "HO-072/item9|OPTION_NUMERIC_UNORDERED",
  "HO-073/item8|KEY_LONGEST_OPTION",
  "HO-074/item3|EXPLANATION_NAMES_ONLY_KEY",
  "HO-074/item4|EXPLANATION_NAMES_ONLY_KEY",
  "HO-074/item6|EXPLANATION_NAMES_ONLY_KEY",
  "HO-074/item7|EXPLANATION_NAMES_ONLY_KEY",
  "HO-074/item10|EXPLANATION_NAMES_ONLY_KEY",
  "HO-077|SET_KEY_LENGTH_BIAS",
  "HO-077|KEY_POSITION_IMBALANCE",
  "HO-077/item2|KEY_LONGEST_OPTION",
  "HO-078/item2|STEM_DOUBLE_NEGATIVE",
  "HO-078/item3|OPTION_STYLE_OUTLIER",
  "HO-078/item5|STEM_NO_QUESTION_FORM",
];
const EXPECTED_FP = [
  "HO-001|STEM_TOO_SHORT",
  "HO-011|OPTION_ABSOLUTE_TERM",
  "HO-012|OPTION_OVERLAP_HIGH",
  "HO-073|SET_KEY_LENGTH_BIAS",
];
const EXPECTED_UNLABELED = [
  "HO-015|OPTION_ABSOLUTE_TERM",
  "HO-020|STEM_TOO_SHORT",
  "HO-023|OPTION_LENGTH_IMBALANCE",
  "HO-027|OPTION_ABSOLUTE_TERM",
  "HO-027|OPTION_LENGTH_IMBALANCE",
  "HO-031|OPTION_OVERLAP_HIGH",
  "HO-041|STEM_TOO_SHORT",
  "HO-042|STEM_TOO_SHORT",
  "HO-051|KEY_STEM_LEXICAL_OVERLAP",
  "HO-051|OPTION_ABSOLUTE_TERM",
  "HO-052|OPTION_ABSOLUTE_TERM",
  "HO-055|OPTION_ABSOLUTE_TERM",
  "HO-072/item3|STEM_TOO_SHORT",
  "HO-073/item8|STEM_NEGATIVE_WORDING",
  "HO-075|NEAR_DUPLICATE_STEM",
  "HO-076/item1|KEY_STEM_LEXICAL_OVERLAP",
  "HO-076/item4|STEM_TOO_SHORT",
  "HO-076/item6|STEM_TOO_SHORT",
  "HO-076/item9|KEY_STEM_LEXICAL_OVERLAP",
  "HO-077/item1|OPTION_ABSOLUTE_TERM",
  "HO-077/item4|OPTION_LENGTH_IMBALANCE",
  "HO-078/item8|STEM_TOO_SHORT",
];
const EXPECTED_SEMANTIC_ONLY = ["HO-028","HO-033","HO-042","HO-044","HO-045","HO-046","HO-047","HO-056","HO-058","HO-061","HO-062","HO-065"];

const key = (f: { ref: string; code: string }): string => f.ref + "|" + f.code;

describe("held-out v0.2 freeze invariant", () => {
  it("matches the sha256 record of the frozen files (LF-normalized)", () => {
    const rec = JSON.parse(readRaw("freeze-hashes.json")) as { cases: number; sha256: Record<string, string> };
    expect(Object.keys(rec.sha256).sort()).toEqual(["author-intent.json", "corpus.json", "labels.json"]);
    for (const [name, hash] of Object.entries(rec.sha256)) expect(sha256Lf(readRaw(name)), name).toBe(hash);
    expect(rec.cases).toBe(corpus.cases.length);
  });
});

describe("held-out v0.2 ids / labels coherence", () => {
  const vocabulary = new Set<string>([...IMPLEMENTED_ITEM_CODES, ...IMPLEMENTED_SET_CODES, ...KNOWN_NOT_IMPLEMENTED_CODES]);

  it("labels every case exactly once, with matching scope", () => {
    const ids = corpus.cases.map((c) => c.caseId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(labels.labels.map((l) => l.caseId).sort()).toEqual([...ids].sort());
    expect(report.integrityFindings).toEqual([]);
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

describe("held-out v0.2 evaluation (first-run regression guard)", () => {
  it("matches the exact case counts, totals and set-level split", () => {
    expect(report.caseCounts).toEqual(EXPECTED_COUNTS);
    expect(report.totals).toEqual(EXPECTED_TOTALS);
    expect(report.setLevel).toEqual(EXPECTED_SET_LEVEL);
  });

  it("matches the exact per-check results", () => {
    const actual = report.checks.map((c) => [c.code, c.expected, c.tp, c.fn, c.fp, c.unlabeled]);
    expect(actual).toEqual(EXPECTED_CHECKS.map((r) => [...r]));
  });

  it("matches the exact summary", () => {
    expect(report.summary).toEqual(EXPECTED_SUMMARY);
  });

  it("lists exactly the observed FN / FP / UNLABELED_EMISSION / semantic-only findings", () => {
    expect(report.falseNegatives.map(key)).toEqual(EXPECTED_FN);
    expect(report.falsePositives.map(key)).toEqual(EXPECTED_FP);
    expect(report.unlabeledEmissions.map(key)).toEqual(EXPECTED_UNLABELED);
    expect(report.semanticOnlyCases.map((s) => s.caseId)).toEqual(EXPECTED_SEMANTIC_ONLY);
  });

  it("classifies every FN as NOT_IMPLEMENTED exactly when the linter has no such check", () => {
    const impl = new Set([...IMPLEMENTED_ITEM_CODES, ...IMPLEMENTED_SET_CODES]);
    for (const f of report.falseNegatives) expect(f.kind, key(f)).toBe(impl.has(f.code) ? "HEURISTIC_GAP" : "NOT_IMPLEMENTED");
  });

  it("is deterministic", () => {
    expect(runHeldOutEvaluation(corpus, labels)).toEqual(report);
  });
});

describe("docs/ASSESSMENT_HELDOUT_V0_2.md", () => {
  const doc = readFileSync(fileURLToPath(new URL("../../../../docs/ASSESSMENT_HELDOUT_V0_2.md", import.meta.url)), "utf8").replace(/\r\n/g, "\n");

  it("embeds the current generated report (drift guard)", () => {
    expect(doc).toContain(formatHeldOutMarkdown(report));
  });

  it("classifies every FN / FP / UNLABELED_EMISSION exactly once", () => {
    const section = doc.split("<!-- CLASSIFICATION:BEGIN -->")[1]?.split("<!-- CLASSIFICATION:END -->")[0] ?? "";
    const rows = section.split("\n").filter((l) => /^\| (FN|FP|UNL) \|/.test(l));
    const keys = rows.map((l) => { const p = l.split("|").map((s) => s.trim()); return p[1] + "|" + p[2] + "|" + p[3]; });
    const want = [
      ...report.falseNegatives.map((f) => "FN|" + key(f)),
      ...report.falsePositives.map((f) => "FP|" + key(f)),
      ...report.unlabeledEmissions.map((f) => "UNL|" + key(f)),
    ];
    expect([...keys].sort()).toEqual([...want].sort());
    const cats = new Set(["LIKELY_LINTER_BUG", "LIKELY_HEURISTIC_LIMIT", "LIKELY_LABEL_QUESTION", "SEMANTIC_ONLY", "NEEDS_HUMAN_HEBREW_REVIEW", "NEEDS_MORE_DATA"]);
    for (const l of rows) expect(cats.has(l.split("|")[4].trim()), l).toBe(true);
  });
});

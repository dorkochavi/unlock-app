/**
 * Held-out evaluation (Golden Dataset v0.4, FRESH_HELD_OUT_V0_4) tests (Run 2026-10-09-ASSESSMENT-ENGINE-009, Slice F1).
 *
 * Evidence class: FRESH_HELD_OUT_V0_4. Provenance: MODEL_AUTHORED_HELD_OUT corpus, MODEL_LABELED_NOT_HUMAN_APPROVED labels.
 * NOT human ground truth; never pooled with v0.1 / v0.2 / v0.3 / FIRST_BLIND, and never itself FIRST_BLIND. The linter is
 * evaluated UNCHANGED. The EXPECTED_* constants are the FIRST OBSERVED values, recorded as a REGRESSION GUARD: results, not
 * targets. Nothing here may be used to tune the linter, thresholds, cue lists, labels or cases. Language is derived from the
 * corpus text (any Hebrew letter => HEBREW); stratum comes from author-intent.json; type is the item questionType (SET for
 * SET cases). The freeze invariant is covered by heldout-v0-4-freeze.test.ts.
 */
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

const DIR = "../golden/heldout-v0-4/";
const readRaw = (name: string): string => readFileSync(fileURLToPath(new URL(DIR + name, import.meta.url)), "utf8");

const corpus = JSON.parse(readRaw("corpus.json")) as HeldOutCorpus;
const labels = JSON.parse(readRaw("labels.json")) as HeldOutLabels;
const intent = (JSON.parse(readRaw("author-intent.json")) as { intent: Record<string, { stratum: string }> }).intent;
const report = runHeldOutEvaluation(corpus, labels);

const HEBREW = /[֐-׿]/;
const languageOf: Record<string, string> = {};
const stratumOf: Record<string, string> = {};
const typeOf: Record<string, string> = {};
for (const c of corpus.cases) {
  languageOf[c.caseId] = HEBREW.test(JSON.stringify(c)) ? "HEBREW" : "ENGLISH";
  stratumOf[c.caseId] = intent[c.caseId]?.stratum ?? "MISSING";
  typeOf[c.caseId] = c.scope === "SET" ? "SET" : (c.item as { questionType: string }).questionType;
}
const byLanguage = runHeldOutEvaluationByGroup(corpus, labels, languageOf);
const byStratum = runHeldOutEvaluationByGroup(corpus, labels, stratumOf);
const byType = runHeldOutEvaluationByGroup(corpus, labels, typeOf);

/** [code, expected, TP, FN, FP, unlabeled] */
type CheckRow = readonly [string, number, number, number, number, number];
const EXPECTED_CHECKS: CheckRow[] = [
  ["EXPLANATION_MISSING",2,2,0,0,0],
  ["KEY_LONGEST_OPTION",11,11,0,0,0],
  ["KEY_POSITION_IMBALANCE",2,2,0,0,0],
  ["KEY_POSITION_RUN",2,2,0,0,0],
  ["OPTION_ABSOLUTE_TERM",3,3,0,0,0],
  ["OPTION_ALL_OF_ABOVE",4,4,0,0,0],
  ["OPTION_DUPLICATE_EXACT",1,1,0,0,0],
  ["OPTION_DUPLICATE_NORMALIZED",1,1,0,0,0],
  ["OPTION_LENGTH_IMBALANCE",9,9,0,0,0],
  ["OPTION_NONE_OF_ABOVE",2,2,0,0,0],
  ["OPTION_NUMERIC_UNORDERED",5,0,5,0,0],
  ["OPTION_OVERLAP_HIGH",0,0,0,0,1],
  ["OPTION_PUNCTUATION_INCONSISTENT",4,0,4,0,0],
  ["OPTION_STYLE_OUTLIER",26,0,26,0,0],
  ["QUESTION_TYPE_MONO",3,0,3,0,0],
  ["SET_KEY_LENGTH_BIAS",0,0,0,0,1],
  ["STEM_NEGATIVE_WORDING",6,5,1,5,0],
  ["STEM_NO_QUESTION_FORM",8,0,8,0,0],
  ["STEM_TOO_SHORT",4,4,0,1,0],
];

const EXPECTED_COUNTS = {
  "total": 75,
  "item": 72,
  "set": 3,
  "clean": 25,
  "flawed": 50,
  "withSemanticExpectation": 9,
  "semanticOnly": 5,
  "languageReviewRequired": 26
};

const EXPECTED_TOTALS = {
  "expectedDetections": 93,
  "truePositive": 46,
  "falseNegative": 47,
  "falseNegativeHeuristicGap": 1,
  "falseNegativeNotImplemented": 46,
  "falsePositive": 6,
  "cleanCases": 25,
  "cleanCasesWithWarningOrError": 5,
  "unlabeledEmissions": 2
};

const EXPECTED_SET_LEVEL = {
  "setScope": {
    "expected": 7,
    "tp": 4,
    "fn": 3,
    "fp": 0
  },
  "itemInSet": {
    "expected": 7,
    "tp": 0,
    "fn": 7,
    "fp": 0
  }
};

const EXPECTED_SUMMARY = [
  "RECALL-LIKE (all labelled detections): 46/93 caught.",
  "FN count: 47 (1 HEURISTIC_GAP on implemented checks, 46 NOT_IMPLEMENTED checks).",
  "PRECISION-LIKE (labelled detections vs false alarms): 46/52.",
  "FP count: 6 (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).",
  "CLEAN cases with a WARNING/ERROR: 5 of 25.",
  "UNLABELED_EMISSIONS: 2 (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).",
  "SEMANTIC-ONLY cases: 5 (FLAWED with no deterministic expectation; not assertable against the linter).",
  "Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1."
];

/** "ref|code" -> kind */
const EXPECTED_FN_KINDS: Array<readonly [string, string]> = [
  ["HO4-001|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-003|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-004|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-005|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-006|OPTION_NUMERIC_UNORDERED","NOT_IMPLEMENTED"],
  ["HO4-012|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-014|OPTION_PUNCTUATION_INCONSISTENT","NOT_IMPLEMENTED"],
  ["HO4-014|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-016|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-019|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-022|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-023|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-028|OPTION_NUMERIC_UNORDERED","NOT_IMPLEMENTED"],
  ["HO4-029|OPTION_PUNCTUATION_INCONSISTENT","NOT_IMPLEMENTED"],
  ["HO4-029|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-031|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-035|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-037|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-039|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-040|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-041|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-042|STEM_NO_QUESTION_FORM","NOT_IMPLEMENTED"],
  ["HO4-049|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-052|STEM_NEGATIVE_WORDING","HEURISTIC_GAP"],
  ["HO4-052|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-054|OPTION_PUNCTUATION_INCONSISTENT","NOT_IMPLEMENTED"],
  ["HO4-054|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-055|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-056|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-057|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-058|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-059|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-060|OPTION_PUNCTUATION_INCONSISTENT","NOT_IMPLEMENTED"],
  ["HO4-060|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-061|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-069|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-070|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-073|QUESTION_TYPE_MONO","NOT_IMPLEMENTED"],
  ["HO4-074|QUESTION_TYPE_MONO","NOT_IMPLEMENTED"],
  ["HO4-074/item1|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-074/item6|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-074/item7|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-074/item9|OPTION_NUMERIC_UNORDERED","NOT_IMPLEMENTED"],
  ["HO4-075|QUESTION_TYPE_MONO","NOT_IMPLEMENTED"],
  ["HO4-075/item3|OPTION_NUMERIC_UNORDERED","NOT_IMPLEMENTED"],
  ["HO4-075/item4|OPTION_STYLE_OUTLIER","NOT_IMPLEMENTED"],
  ["HO4-075/item9|OPTION_NUMERIC_UNORDERED","NOT_IMPLEMENTED"],
];
const EXPECTED_FP: string[] = [
  "HO4-007|STEM_NEGATIVE_WORDING",
  "HO4-008|STEM_NEGATIVE_WORDING",
  "HO4-015|STEM_NEGATIVE_WORDING",
  "HO4-042|STEM_TOO_SHORT",
  "HO4-062|STEM_NEGATIVE_WORDING",
  "HO4-063|STEM_NEGATIVE_WORDING"
];
const EXPECTED_UNLABELED = ["HO4-075|SET_KEY_LENGTH_BIAS","HO4-075/item7|OPTION_OVERLAP_HIGH"];
const EXPECTED_SEMANTIC_ONLY = ["HO4-066","HO4-067","HO4-068","HO4-071","HO4-072"];
/** Label codes outside the known vocabulary lists (documented, never added to the lists). None observed. */
const EXPECTED_OUT_OF_VOCABULARY: string[] = [];

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
  "ENGLISH": {
    cases: [29,4,25],
    totals: [50,23,27,0,27,0,0,0],
    checks: [
      ["EXPLANATION_MISSING",1,1,0,0,0],
      ["KEY_LONGEST_OPTION",5,5,0,0,0],
      ["KEY_POSITION_IMBALANCE",1,1,0,0,0],
      ["KEY_POSITION_RUN",1,1,0,0,0],
      ["OPTION_ABSOLUTE_TERM",1,1,0,0,0],
      ["OPTION_ALL_OF_ABOVE",2,2,0,0,0],
      ["OPTION_DUPLICATE_NORMALIZED",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",5,5,0,0,0],
      ["OPTION_NONE_OF_ABOVE",2,2,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",2,0,2,0,0],
      ["OPTION_PUNCTUATION_INCONSISTENT",4,0,4,0,0],
      ["OPTION_STYLE_OUTLIER",16,0,16,0,0],
      ["QUESTION_TYPE_MONO",1,0,1,0,0],
      ["STEM_NEGATIVE_WORDING",3,3,0,0,0],
      ["STEM_NO_QUESTION_FORM",4,0,4,0,0],
      ["STEM_TOO_SHORT",1,1,0,0,0],
    ],
    fn: ["HO4-004|STEM_NO_QUESTION_FORM","HO4-006|OPTION_NUMERIC_UNORDERED","HO4-012|OPTION_STYLE_OUTLIER","HO4-014|OPTION_PUNCTUATION_INCONSISTENT","HO4-014|OPTION_STYLE_OUTLIER","HO4-016|OPTION_STYLE_OUTLIER","HO4-019|OPTION_STYLE_OUTLIER","HO4-023|OPTION_STYLE_OUTLIER","HO4-029|OPTION_PUNCTUATION_INCONSISTENT","HO4-029|OPTION_STYLE_OUTLIER","HO4-031|STEM_NO_QUESTION_FORM","HO4-035|STEM_NO_QUESTION_FORM","HO4-040|STEM_NO_QUESTION_FORM","HO4-049|OPTION_STYLE_OUTLIER","HO4-054|OPTION_PUNCTUATION_INCONSISTENT","HO4-054|OPTION_STYLE_OUTLIER","HO4-056|OPTION_STYLE_OUTLIER","HO4-058|OPTION_STYLE_OUTLIER","HO4-060|OPTION_PUNCTUATION_INCONSISTENT","HO4-060|OPTION_STYLE_OUTLIER","HO4-069|OPTION_STYLE_OUTLIER","HO4-070|OPTION_STYLE_OUTLIER","HO4-074|QUESTION_TYPE_MONO","HO4-074/item1|OPTION_STYLE_OUTLIER","HO4-074/item6|OPTION_STYLE_OUTLIER","HO4-074/item7|OPTION_STYLE_OUTLIER","HO4-074/item9|OPTION_NUMERIC_UNORDERED"],
    fp: [],
    unl: [],
  },
  "HEBREW": {
    cases: [46,21,25],
    totals: [43,23,20,1,19,6,5,2],
    checks: [
      ["EXPLANATION_MISSING",1,1,0,0,0],
      ["KEY_LONGEST_OPTION",6,6,0,0,0],
      ["KEY_POSITION_IMBALANCE",1,1,0,0,0],
      ["KEY_POSITION_RUN",1,1,0,0,0],
      ["OPTION_ABSOLUTE_TERM",2,2,0,0,0],
      ["OPTION_ALL_OF_ABOVE",2,2,0,0,0],
      ["OPTION_DUPLICATE_EXACT",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",4,4,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",3,0,3,0,0],
      ["OPTION_OVERLAP_HIGH",0,0,0,0,1],
      ["OPTION_STYLE_OUTLIER",10,0,10,0,0],
      ["QUESTION_TYPE_MONO",2,0,2,0,0],
      ["SET_KEY_LENGTH_BIAS",0,0,0,0,1],
      ["STEM_NEGATIVE_WORDING",3,2,1,5,0],
      ["STEM_NO_QUESTION_FORM",4,0,4,0,0],
      ["STEM_TOO_SHORT",3,3,0,1,0],
    ],
    fn: ["HO4-001|OPTION_STYLE_OUTLIER","HO4-003|STEM_NO_QUESTION_FORM","HO4-005|OPTION_STYLE_OUTLIER","HO4-022|OPTION_STYLE_OUTLIER","HO4-028|OPTION_NUMERIC_UNORDERED","HO4-037|OPTION_STYLE_OUTLIER","HO4-039|STEM_NO_QUESTION_FORM","HO4-041|STEM_NO_QUESTION_FORM","HO4-042|STEM_NO_QUESTION_FORM","HO4-052|STEM_NEGATIVE_WORDING","HO4-052|OPTION_STYLE_OUTLIER","HO4-055|OPTION_STYLE_OUTLIER","HO4-057|OPTION_STYLE_OUTLIER","HO4-059|OPTION_STYLE_OUTLIER","HO4-061|OPTION_STYLE_OUTLIER","HO4-073|QUESTION_TYPE_MONO","HO4-075|QUESTION_TYPE_MONO","HO4-075/item3|OPTION_NUMERIC_UNORDERED","HO4-075/item4|OPTION_STYLE_OUTLIER","HO4-075/item9|OPTION_NUMERIC_UNORDERED"],
    fp: ["HO4-007|STEM_NEGATIVE_WORDING","HO4-008|STEM_NEGATIVE_WORDING","HO4-015|STEM_NEGATIVE_WORDING","HO4-042|STEM_TOO_SHORT","HO4-062|STEM_NEGATIVE_WORDING","HO4-063|STEM_NEGATIVE_WORDING"],
    unl: ["HO4-075|SET_KEY_LENGTH_BIAS","HO4-075/item7|OPTION_OVERLAP_HIGH"],
  },
};
const EXPECTED_BY_STRATUM: Record<string, GroupExpectation> = {
  "A": {
    cases: [28,20,8],
    totals: [10,4,6,0,6,2,2,0],
    checks: [
      ["KEY_LONGEST_OPTION",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",1,1,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",1,0,1,0,0],
      ["OPTION_STYLE_OUTLIER",3,0,3,0,0],
      ["STEM_NEGATIVE_WORDING",2,2,0,2,0],
      ["STEM_NO_QUESTION_FORM",2,0,2,0,0],
    ],
    fn: ["HO4-001|OPTION_STYLE_OUTLIER","HO4-006|OPTION_NUMERIC_UNORDERED","HO4-031|STEM_NO_QUESTION_FORM","HO4-037|OPTION_STYLE_OUTLIER","HO4-040|STEM_NO_QUESTION_FORM","HO4-049|OPTION_STYLE_OUTLIER"],
    fp: ["HO4-007|STEM_NEGATIVE_WORDING","HO4-015|STEM_NEGATIVE_WORDING"],
    unl: [],
  },
  "B": {
    cases: [22,0,22],
    totals: [46,27,19,1,18,0,0,0],
    checks: [
      ["EXPLANATION_MISSING",2,2,0,0,0],
      ["KEY_LONGEST_OPTION",5,5,0,0,0],
      ["OPTION_ABSOLUTE_TERM",3,3,0,0,0],
      ["OPTION_ALL_OF_ABOVE",4,4,0,0,0],
      ["OPTION_DUPLICATE_EXACT",1,1,0,0,0],
      ["OPTION_DUPLICATE_NORMALIZED",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",4,4,0,0,0],
      ["OPTION_NONE_OF_ABOVE",2,2,0,0,0],
      ["OPTION_PUNCTUATION_INCONSISTENT",4,0,4,0,0],
      ["OPTION_STYLE_OUTLIER",13,0,13,0,0],
      ["STEM_NEGATIVE_WORDING",4,3,1,0,0],
      ["STEM_NO_QUESTION_FORM",1,0,1,0,0],
      ["STEM_TOO_SHORT",2,2,0,0,0],
    ],
    fn: ["HO4-005|OPTION_STYLE_OUTLIER","HO4-012|OPTION_STYLE_OUTLIER","HO4-014|OPTION_PUNCTUATION_INCONSISTENT","HO4-014|OPTION_STYLE_OUTLIER","HO4-022|OPTION_STYLE_OUTLIER","HO4-029|OPTION_PUNCTUATION_INCONSISTENT","HO4-029|OPTION_STYLE_OUTLIER","HO4-039|STEM_NO_QUESTION_FORM","HO4-052|STEM_NEGATIVE_WORDING","HO4-052|OPTION_STYLE_OUTLIER","HO4-054|OPTION_PUNCTUATION_INCONSISTENT","HO4-054|OPTION_STYLE_OUTLIER","HO4-055|OPTION_STYLE_OUTLIER","HO4-056|OPTION_STYLE_OUTLIER","HO4-058|OPTION_STYLE_OUTLIER","HO4-059|OPTION_STYLE_OUTLIER","HO4-060|OPTION_PUNCTUATION_INCONSISTENT","HO4-060|OPTION_STYLE_OUTLIER","HO4-061|OPTION_STYLE_OUTLIER"],
    fp: [],
    unl: [],
  },
  "C": {
    cases: [14,5,9],
    totals: [16,7,9,0,9,4,3,0],
    checks: [
      ["KEY_LONGEST_OPTION",4,4,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",2,2,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",1,0,1,0,0],
      ["OPTION_STYLE_OUTLIER",4,0,4,0,0],
      ["STEM_NEGATIVE_WORDING",0,0,0,3,0],
      ["STEM_NO_QUESTION_FORM",4,0,4,0,0],
      ["STEM_TOO_SHORT",1,1,0,1,0],
    ],
    fn: ["HO4-003|STEM_NO_QUESTION_FORM","HO4-004|STEM_NO_QUESTION_FORM","HO4-016|OPTION_STYLE_OUTLIER","HO4-019|OPTION_STYLE_OUTLIER","HO4-023|OPTION_STYLE_OUTLIER","HO4-028|OPTION_NUMERIC_UNORDERED","HO4-041|STEM_NO_QUESTION_FORM","HO4-042|STEM_NO_QUESTION_FORM","HO4-057|OPTION_STYLE_OUTLIER"],
    fp: ["HO4-008|STEM_NEGATIVE_WORDING","HO4-042|STEM_TOO_SHORT","HO4-062|STEM_NEGATIVE_WORDING","HO4-063|STEM_NEGATIVE_WORDING"],
    unl: [],
  },
  "D": {
    cases: [8,0,8],
    totals: [7,4,3,0,3,0,0,0],
    checks: [
      ["KEY_LONGEST_OPTION",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",2,2,0,0,0],
      ["OPTION_STYLE_OUTLIER",2,0,2,0,0],
      ["STEM_NO_QUESTION_FORM",1,0,1,0,0],
      ["STEM_TOO_SHORT",1,1,0,0,0],
    ],
    fn: ["HO4-035|STEM_NO_QUESTION_FORM","HO4-069|OPTION_STYLE_OUTLIER","HO4-070|OPTION_STYLE_OUTLIER"],
    fp: [],
    unl: [],
  },
  "E": {
    cases: [3,0,3],
    totals: [14,4,10,0,10,0,0,2],
    checks: [
      ["KEY_POSITION_IMBALANCE",2,2,0,0,0],
      ["KEY_POSITION_RUN",2,2,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",3,0,3,0,0],
      ["OPTION_OVERLAP_HIGH",0,0,0,0,1],
      ["OPTION_STYLE_OUTLIER",4,0,4,0,0],
      ["QUESTION_TYPE_MONO",3,0,3,0,0],
      ["SET_KEY_LENGTH_BIAS",0,0,0,0,1],
    ],
    fn: ["HO4-073|QUESTION_TYPE_MONO","HO4-074|QUESTION_TYPE_MONO","HO4-074/item1|OPTION_STYLE_OUTLIER","HO4-074/item6|OPTION_STYLE_OUTLIER","HO4-074/item7|OPTION_STYLE_OUTLIER","HO4-074/item9|OPTION_NUMERIC_UNORDERED","HO4-075|QUESTION_TYPE_MONO","HO4-075/item3|OPTION_NUMERIC_UNORDERED","HO4-075/item4|OPTION_STYLE_OUTLIER","HO4-075/item9|OPTION_NUMERIC_UNORDERED"],
    fp: [],
    unl: ["HO4-075|SET_KEY_LENGTH_BIAS","HO4-075/item7|OPTION_OVERLAP_HIGH"],
  },
};
const EXPECTED_BY_TYPE: Record<string, GroupExpectation> = {
  "MULTIPLE_CHOICE": {
    cases: [14,5,9],
    totals: [9,5,4,0,4,0,0,0],
    checks: [
      ["EXPLANATION_MISSING",1,1,0,0,0],
      ["OPTION_ABSOLUTE_TERM",2,2,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",1,1,0,0,0],
      ["OPTION_STYLE_OUTLIER",3,0,3,0,0],
      ["STEM_NEGATIVE_WORDING",1,1,0,0,0],
      ["STEM_NO_QUESTION_FORM",1,0,1,0,0],
    ],
    fn: ["HO4-031|STEM_NO_QUESTION_FORM","HO4-037|OPTION_STYLE_OUTLIER","HO4-049|OPTION_STYLE_OUTLIER","HO4-055|OPTION_STYLE_OUTLIER"],
    fp: [],
    unl: [],
  },
  "SET": {
    cases: [3,0,3],
    totals: [14,4,10,0,10,0,0,2],
    checks: [
      ["KEY_POSITION_IMBALANCE",2,2,0,0,0],
      ["KEY_POSITION_RUN",2,2,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",3,0,3,0,0],
      ["OPTION_OVERLAP_HIGH",0,0,0,0,1],
      ["OPTION_STYLE_OUTLIER",4,0,4,0,0],
      ["QUESTION_TYPE_MONO",3,0,3,0,0],
      ["SET_KEY_LENGTH_BIAS",0,0,0,0,1],
    ],
    fn: ["HO4-073|QUESTION_TYPE_MONO","HO4-074|QUESTION_TYPE_MONO","HO4-074/item1|OPTION_STYLE_OUTLIER","HO4-074/item6|OPTION_STYLE_OUTLIER","HO4-074/item7|OPTION_STYLE_OUTLIER","HO4-074/item9|OPTION_NUMERIC_UNORDERED","HO4-075|QUESTION_TYPE_MONO","HO4-075/item3|OPTION_NUMERIC_UNORDERED","HO4-075/item4|OPTION_STYLE_OUTLIER","HO4-075/item9|OPTION_NUMERIC_UNORDERED"],
    fp: [],
    unl: ["HO4-075|SET_KEY_LENGTH_BIAS","HO4-075/item7|OPTION_OVERLAP_HIGH"],
  },
  "SINGLE_CHOICE": {
    cases: [58,20,38],
    totals: [70,37,33,1,32,6,5,0],
    checks: [
      ["EXPLANATION_MISSING",1,1,0,0,0],
      ["KEY_LONGEST_OPTION",11,11,0,0,0],
      ["OPTION_ABSOLUTE_TERM",1,1,0,0,0],
      ["OPTION_ALL_OF_ABOVE",4,4,0,0,0],
      ["OPTION_DUPLICATE_EXACT",1,1,0,0,0],
      ["OPTION_DUPLICATE_NORMALIZED",1,1,0,0,0],
      ["OPTION_LENGTH_IMBALANCE",8,8,0,0,0],
      ["OPTION_NONE_OF_ABOVE",2,2,0,0,0],
      ["OPTION_NUMERIC_UNORDERED",2,0,2,0,0],
      ["OPTION_PUNCTUATION_INCONSISTENT",4,0,4,0,0],
      ["OPTION_STYLE_OUTLIER",19,0,19,0,0],
      ["STEM_NEGATIVE_WORDING",5,4,1,5,0],
      ["STEM_NO_QUESTION_FORM",7,0,7,0,0],
      ["STEM_TOO_SHORT",4,4,0,1,0],
    ],
    fn: ["HO4-001|OPTION_STYLE_OUTLIER","HO4-003|STEM_NO_QUESTION_FORM","HO4-004|STEM_NO_QUESTION_FORM","HO4-005|OPTION_STYLE_OUTLIER","HO4-006|OPTION_NUMERIC_UNORDERED","HO4-012|OPTION_STYLE_OUTLIER","HO4-014|OPTION_PUNCTUATION_INCONSISTENT","HO4-014|OPTION_STYLE_OUTLIER","HO4-016|OPTION_STYLE_OUTLIER","HO4-019|OPTION_STYLE_OUTLIER","HO4-022|OPTION_STYLE_OUTLIER","HO4-023|OPTION_STYLE_OUTLIER","HO4-028|OPTION_NUMERIC_UNORDERED","HO4-029|OPTION_PUNCTUATION_INCONSISTENT","HO4-029|OPTION_STYLE_OUTLIER","HO4-035|STEM_NO_QUESTION_FORM","HO4-039|STEM_NO_QUESTION_FORM","HO4-040|STEM_NO_QUESTION_FORM","HO4-041|STEM_NO_QUESTION_FORM","HO4-042|STEM_NO_QUESTION_FORM","HO4-052|STEM_NEGATIVE_WORDING","HO4-052|OPTION_STYLE_OUTLIER","HO4-054|OPTION_PUNCTUATION_INCONSISTENT","HO4-054|OPTION_STYLE_OUTLIER","HO4-056|OPTION_STYLE_OUTLIER","HO4-057|OPTION_STYLE_OUTLIER","HO4-058|OPTION_STYLE_OUTLIER","HO4-059|OPTION_STYLE_OUTLIER","HO4-060|OPTION_PUNCTUATION_INCONSISTENT","HO4-060|OPTION_STYLE_OUTLIER","HO4-061|OPTION_STYLE_OUTLIER","HO4-069|OPTION_STYLE_OUTLIER","HO4-070|OPTION_STYLE_OUTLIER"],
    fp: ["HO4-007|STEM_NEGATIVE_WORDING","HO4-008|STEM_NEGATIVE_WORDING","HO4-015|STEM_NEGATIVE_WORDING","HO4-042|STEM_TOO_SHORT","HO4-062|STEM_NEGATIVE_WORDING","HO4-063|STEM_NEGATIVE_WORDING"],
    unl: [],
  },
};

const key = (f: { ref: string; code: string }): string => f.ref + "|" + f.code;
const rows = (r: HeldOutReport): Array<Array<string | number>> => r.checks.map((c) => [c.code, c.expected, c.tp, c.fn, c.fp, c.unlabeled]);
const totalsTuple = (r: HeldOutReport): number[] => [
  r.totals.expectedDetections, r.totals.truePositive, r.totals.falseNegative, r.totals.falseNegativeHeuristicGap,
  r.totals.falseNegativeNotImplemented, r.totals.falsePositive, r.totals.cleanCasesWithWarningOrError, r.totals.unlabeledEmissions,
];

describe("held-out v0.4 ids / labels coherence", () => {
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

  it("uses only known vocabulary codes in every label (out-of-vocabulary codes are an explicit documented list)", () => {
    const outOfVocabulary: string[] = [];
    for (const l of labels.labels) {
      const codes = [
        ...(l.expectedCodes ?? []), ...(l.forbiddenCodes ?? []), ...(l.expectedSetCodes ?? []), ...(l.forbiddenSetCodes ?? []),
        ...Object.values(l.itemCodes ?? {}).flat(),
      ];
      for (const code of codes) if (!vocabulary.has(code)) outOfVocabulary.push(l.caseId + "|" + code);
    }
    expect(outOfVocabulary).toEqual(EXPECTED_OUT_OF_VOCABULARY);
  });

  it("keeps CLEAN labels free of expected codes", () => {
    for (const l of labels.labels) {
      if (l.label !== "CLEAN") continue;
      expect([...(l.expectedCodes ?? []), ...(l.expectedSetCodes ?? []), ...Object.values(l.itemCodes ?? {}).flat()], l.caseId).toEqual([]);
    }
  });
});

describe("held-out v0.4 evaluation (first-observed regression guard)", () => {
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

  for (const [name, groups, expected] of [
    ["language", byLanguage, EXPECTED_BY_LANGUAGE],
    ["stratum", byStratum, EXPECTED_BY_STRATUM],
    ["type", byType, EXPECTED_BY_TYPE],
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

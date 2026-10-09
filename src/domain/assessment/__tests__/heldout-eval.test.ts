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
  applyHumanAdjudication,
  compareFrozenAndPostHuman,
  formatHeldOutMarkdown,
  formatPostHumanMarkdown,
  HUMAN_REVIEWED_CASE_IDS,
  KNOWN_NOT_IMPLEMENTED_CODES,
  runHeldOutEvaluation,
  type HeldOutCorpus,
  type HeldOutLabel,
  type HeldOutLabels,
  type HumanAdjudicationOverlay,
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
  ["KEY_STEM_LEXICAL_OVERLAP", 1, 0, 1, 0, 0],
  ["NEAR_DUPLICATE_STEM", 1, 1, 0, 0, 1],
  ["OPTIONS_TOO_FEW", 1, 1, 0, 0, 0],
  ["OPTION_ABSOLUTE_TERM", 9, 5, 4, 0, 0],
  ["OPTION_ALL_OF_ABOVE", 1, 1, 0, 0, 0],
  ["OPTION_COMBINATION_REFERENCE", 3, 3, 0, 0, 0],
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
  ["STEM_TOO_SHORT", 2, 2, 0, 0, 0],
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
  truePositive: 79,
  falseNegative: 45,
  falseNegativeHeuristicGap: 12,
  falseNegativeNotImplemented: 33,
  falsePositive: 2,
  cleanCases: 20,
  cleanCasesWithWarningOrError: 1,
  unlabeledEmissions: 6
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
    tp: 26,
    fn: 20,
    fp: 0
  }
};

const EXPECTED_SUMMARY = [
  "RECALL-LIKE (all labelled detections): 79/124 caught.",
  "FN count: 45 (12 HEURISTIC_GAP on implemented checks, 33 NOT_IMPLEMENTED checks).",
  "PRECISION-LIKE (labelled detections vs false alarms): 79/81.",
  "FP count: 2 (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).",
  "CLEAN cases with a WARNING/ERROR: 1 of 20.",
  "UNLABELED_EMISSIONS: 6 (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).",
  "SEMANTIC-ONLY cases: 12 (FLAWED with no deterministic expectation; not assertable against the linter).",
  "Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1."
];

/** "ref|code" */
const EXPECTED_FN = [
  "HO-017|OPTION_ABSOLUTE_TERM",
  "HO-017|OPTION_PREFIX_STEM_REPEAT",
  "HO-022|STEM_DOUBLE_NEGATIVE",
  "HO-022|EXPLANATION_NAMES_ONLY_KEY",
  "HO-029|OPTION_PUNCTUATION_INCONSISTENT",
  "HO-029|OPTION_STYLE_OUTLIER",
  "HO-029|KEY_LONGEST_OPTION",
  "HO-030|STEM_NO_QUESTION_FORM",
  "HO-031|EXPLANATION_NAMES_ONLY_KEY",
  "HO-034|OPTION_NUMERIC_UNORDERED",
  "HO-035|OPTION_PUNCTUATION_INCONSISTENT",
  "HO-039|OPTION_COUNT_UNUSUAL",
  "HO-048|OPTION_ABSOLUTE_TERM",
  "HO-049|OPTION_STYLE_OUTLIER",
  "HO-049|KEY_LONGEST_OPTION",
  "HO-055|KEY_STEM_LEXICAL_OVERLAP",
  "HO-057|STEM_NO_QUESTION_FORM",
  "HO-057|EXPLANATION_NAMES_ONLY_KEY",
  "HO-063|STEM_NEGATIVE_WORDING",
  "HO-063|OPTION_ABSOLUTE_TERM",
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
  "HO-073/item8|OPTION_ABSOLUTE_TERM",
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
  "HO-012|OPTION_OVERLAP_HIGH",
  "HO-073|SET_KEY_LENGTH_BIAS",
];
const EXPECTED_UNLABELED = [
  "HO-023|OPTION_LENGTH_IMBALANCE",
  "HO-027|OPTION_LENGTH_IMBALANCE",
  "HO-031|OPTION_OVERLAP_HIGH",
  "HO-073/item8|STEM_NEGATIVE_WORDING",
  "HO-075|NEAR_DUPLICATE_STEM",
  "HO-077/item4|OPTION_LENGTH_IMBALANCE",
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

// ---------------------------------------------------------------------------------------------------------------------
// Post-evaluation human adjudication (Run 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001, Slice H1).
// POST_HUMAN numbers are the FIRST observed values (recorded, not tuned). They are not FIRST_BLIND and never pooled.
// ---------------------------------------------------------------------------------------------------------------------
const overlayRaw = readRaw("human-adjudication.json");
const overlay = JSON.parse(overlayRaw) as HumanAdjudicationOverlay;
const post = applyHumanAdjudication(labels, overlay);
const cmp = compareFrozenAndPostHuman(corpus, labels, overlay);
const postLabel = (id: string) => post.labels.find((l) => l.caseId === id)!;
const frozenLabel = (id: string) => labels.labels.find((l) => l.caseId === id)!;

describe("human adjudication overlay (post-evaluation)", () => {
  it("is LF-only UTF-8 JSON with literal Hebrew and is not part of the freeze hashes", () => {
    expect(overlayRaw.includes("\r")).toBe(false);
    expect(overlayRaw.endsWith("}\n")).toBe(true);
    expect(overlayRaw.includes("\\u05")).toBe(false);
    expect(overlayRaw).toContain("מהי תפקיד");
    const rec = JSON.parse(readRaw("freeze-hashes.json")) as { sha256: Record<string, string> };
    expect(Object.keys(rec.sha256)).not.toContain("human-adjudication.json");
    expect(overlay.provenance).toBe("HUMAN_APPROVED");
    expect(overlay.reviewer).toBe("Dor");
    expect(overlay.reviewDate).toBe("2026-10-09");
  });

  it("touches exactly the 9 reviewed ids and changes only three labels", () => {
    expect(overlay.decisions.map((d) => d.caseId).sort()).toEqual([...HUMAN_REVIEWED_CASE_IDS].sort());
    expect(HUMAN_REVIEWED_CASE_IDS).toHaveLength(9);
    const noForbid = (l: HeldOutLabel): HeldOutLabel => {
      const c = JSON.parse(JSON.stringify(l)) as HeldOutLabel;
      delete c.forbiddenCodes;
      delete c.forbiddenItemCodes;
      return c;
    };
    const changed = labels.labels.filter((l) => JSON.stringify(noForbid(l)) !== JSON.stringify(noForbid(postLabel(l.caseId)))).map((l) => l.caseId);
    expect(changed.sort()).toEqual(["HO-017", "HO-063", "HO-069"]);
    // Final precision decisions (Run 003): exactly three forbidden additions, nothing else differs in the forbidden fields.
    const forbidDiff = labels.labels
      .filter((l) => JSON.stringify([l.forbiddenCodes, l.forbiddenItemCodes]) !== JSON.stringify([postLabel(l.caseId).forbiddenCodes, postLabel(l.caseId).forbiddenItemCodes]))
      .map((l) => l.caseId);
    expect(forbidDiff.sort()).toEqual(["HO-015", "HO-063", "HO-076"]);
    expect(postLabel("HO-015").forbiddenCodes).toEqual(["STEM_NEGATIVE_WORDING", "OPTION_ABSOLUTE_TERM"]);
    expect(postLabel("HO-063").forbiddenCodes).toEqual(["OPTION_ABSOLUTE_TERM"]);
    expect(postLabel("HO-076").forbiddenItemCodes).toEqual({ "1": ["KEY_STEM_LEXICAL_OVERLAP"] });
    expect(frozenLabel("HO-076").forbiddenItemCodes).toBeUndefined();
    expect(post.labels).toHaveLength(78);
  });

  it("carries HUMAN_APPROVED provenance for exactly the 9 reviewed cases", () => {
    const human = Object.entries(post.provenanceById).filter(([, p]) => p === "HUMAN_APPROVED").map(([id]) => id);
    expect(human.sort()).toEqual([...HUMAN_REVIEWED_CASE_IDS].sort());
    const others = Object.entries(post.provenanceById).filter(([id]) => !HUMAN_REVIEWED_CASE_IDS.includes(id));
    expect(others).toHaveLength(69);
    for (const [, p] of others) expect(p).toBe("MODEL_LABELED_NOT_HUMAN_APPROVED");
  });

  it("applies each of the 9 decisions exactly", () => {
    // HO-017: CLEAN, no expected codes.
    expect(postLabel("HO-017").label).toBe("CLEAN");
    expect(postLabel("HO-017").expectedCodes).toEqual([]);
    expect(postLabel("HO-017").forbiddenCodes).toEqual([]);
    // HO-063: negative wording kept, absolute term removed from expectations and (final decision) forbidden.
    expect(postLabel("HO-063").label).toBe("FLAWED");
    expect(postLabel("HO-063").expectedCodes).toEqual(["STEM_NEGATIVE_WORDING"]);
    expect(postLabel("HO-063").forbiddenCodes).toEqual(["OPTION_ABSOLUTE_TERM"]);
    // HO-069: FLAWED with the (NOT_IMPLEMENTED) numeric-order check.
    expect(postLabel("HO-069").label).toBe("FLAWED");
    expect(postLabel("HO-069").expectedCodes).toEqual(["OPTION_NUMERIC_UNORDERED"]);
    // The other six are recorded approvals: labels unchanged.
    for (const id of ["HO-049", "HO-070", "HO-032", "HO-073"]) expect(postLabel(id), id).toEqual(frozenLabel(id));
    expect(postLabel("HO-049").expectedCodes).toEqual(["OPTION_STYLE_OUTLIER", "KEY_LONGEST_OPTION"]);
    expect(postLabel("HO-070").expectedCodes).toEqual(["OPTION_STYLE_OUTLIER"]);
    expect(postLabel("HO-015").expectedCodes).toEqual(["KEY_LONGEST_OPTION"]);
    expect(postLabel("HO-032").label).toBe("CLEAN");
    expect(postLabel("HO-076").languageReviewRequired).toBe(true);
    expect(postLabel("HO-076").itemCodes?.["1"]).toEqual(["KEY_LONGEST_OPTION", "OPTION_LENGTH_IMBALANCE"]);
    expect(postLabel("HO-073").forbiddenSetCodes).toEqual(["KEY_POSITION_IMBALANCE", "KEY_POSITION_RUN", "SET_KEY_LENGTH_BIAS"]);
    const d = (id: string) => overlay.decisions.find((x) => x.caseId === id)!;
    expect(d("HO-076").decision).toBe("APPROVED_PARTIAL");
    expect(d("HO-076").patch).toEqual({ addForbiddenItemCodes: { "1": ["KEY_STEM_LEXICAL_OVERLAP"] } });
    expect(d("HO-017").decision).toBe("CHANGED");
    expect(d("HO-063").decision).toBe("CHANGED");
    expect(d("HO-069").decision).toBe("CHANGED");
  });

  it("does not mutate the frozen labels and leaves the frozen-label evaluation untouched", () => {
    expect(runHeldOutEvaluation(corpus, labels)).toEqual(report);
    expect(cmp.currentLinterOnFrozen).toEqual(report);
    expect(cmp.currentLinterOnFrozen.totals).toEqual(EXPECTED_TOTALS);
    expect(cmp.currentLinterOnFrozen.setLevel).toEqual(EXPECTED_SET_LEVEL);
    expect(cmp.currentLinterOnFrozen.summary).toEqual(EXPECTED_SUMMARY);
  });

  it("rejects invalid overlays", () => {
    const clone = (): HumanAdjudicationOverlay => JSON.parse(overlayRaw) as HumanAdjudicationOverlay;
    const o1 = clone();
    o1.decisions[0].caseId = "HO-001";
    expect(() => applyHumanAdjudication(labels, o1)).toThrow(/not one of the 9/);
    const o2 = clone();
    o2.decisions.find((d) => d.caseId === "HO-063")!.patch.removeExpectedCodes = ["OPTION_NUMERIC_UNORDERED"];
    expect(() => applyHumanAdjudication(labels, o2)).toThrow(/was not expected/);
    const o3 = clone();
    o3.decisions.find((d) => d.caseId === "HO-049")!.decision = "CHANGED";
    expect(() => applyHumanAdjudication(labels, o3)).toThrow(/changes nothing/);
    const o4 = clone();
    o4.decisions.find((d) => d.caseId === "HO-017")!.patch.removeExpectedCodes = ["OPTION_ABSOLUTE_TERM"];
    expect(() => applyHumanAdjudication(labels, o4)).toThrow(/CLEAN label must have no expected codes/);
    const o5 = clone();
    o5.decisions.find((d) => d.caseId === "HO-070")!.before.label = "CLEAN";
    expect(() => applyHumanAdjudication(labels, o5)).toThrow(/does not match the frozen label/);
    const o6 = clone();
    o6.decisions.push(o6.decisions[0]);
    expect(() => applyHumanAdjudication(labels, o6)).toThrow(/duplicate/);
  });
});

describe("POST_HUMAN evaluation (first observed values, recorded not tuned)", () => {
  const p = cmp.postHuman;
  const keys = (fs: Array<{ ref: string; code: string }>): string[] => fs.map(key);

  it("matches the exact POST_HUMAN counts, totals and set-level split", () => {
    expect(p.integrityFindings).toEqual([]);
    expect(p.caseCounts).toEqual(EXPECTED_COUNTS);
    expect(p.totals).toEqual({
      expectedDetections: 122, truePositive: 79, falseNegative: 43, falseNegativeHeuristicGap: 10, falseNegativeNotImplemented: 33,
      falsePositive: 2, cleanCases: 20, cleanCasesWithWarningOrError: 1, unlabeledEmissions: 6,
    });
    // FUB-066: the HO-076 item-1 final-forbidden emission (KEY_STEM_LEXICAL_OVERLAP) no longer exists; no set-level movement.
    expect(p.setLevel).toEqual(EXPECTED_SET_LEVEL);
    expect(cmp.delta.totals).toEqual({
      expectedDetections: -2, truePositive: 0, falseNegative: -2, falseNegativeHeuristicGap: -2, falseNegativeNotImplemented: 0,
      falsePositive: 0, cleanCases: 0, cleanCasesWithWarningOrError: 0, unlabeledEmissions: 0,
    });
    // POST_HUMAN_BEFORE_FINAL_FORBIDDEN: after FUB-066 none of the three final-forbidden codes is emitted any more,
    // so it coincides with POST_HUMAN_FINAL (historically it differed by FP 5 -> 8, UNLABELED 23 -> 20).
    const m = cmp.postHumanBeforeFinalForbidden;
    expect(m.totals).toEqual(p.totals);
    expect(m.caseCounts).toEqual(p.caseCounts);
    expect(m.setLevel).toEqual(EXPECTED_SET_LEVEL);
    expect(cmp.delta.setLevel).toEqual({ setScope: { expected: 0, tp: 0, fn: 0, fp: 0 }, itemInSet: { expected: 0, tp: 0, fn: 0, fp: 0 } });
  });

  it("differs from the current-linter frozen-label evaluation only in the findings caused by the three label changes", () => {
    const expectedFn = EXPECTED_FN
      .filter((k) => !["HO-017|OPTION_PREFIX_STEM_REPEAT", "HO-017|OPTION_ABSOLUTE_TERM", "HO-063|OPTION_ABSOLUTE_TERM"].includes(k))
      .flatMap((k) => (k === "HO-070|OPTION_STYLE_OUTLIER" ? ["HO-069|OPTION_NUMERIC_UNORDERED", k] : [k]));
    expect(keys(p.falseNegatives)).toEqual(expectedFn);
    expect(keys(p.falsePositives)).toEqual(["HO-012|OPTION_OVERLAP_HIGH", "HO-073|SET_KEY_LENGTH_BIAS"]);
    expect(keys(p.unlabeledEmissions)).toEqual(EXPECTED_UNLABELED);
    // FUB-066 special checks (accepted human principles): none of the three final-forbidden emissions, nor the HO-017
    // symmetric-item and HO-032 colon-stem false positives, is emitted any more under the current linter.
    for (const k of ["HO-015", "HO-063", "HO-017", "HO-032", "HO-076/item1"]) expect(p.falsePositives.find((f) => f.ref === k), k).toBeUndefined();
    expect(p.unlabeledEmissions.find((f) => f.ref === "HO-015")).toBeUndefined();
    expect(p.semanticOnlyCases.map((s) => s.caseId)).toEqual(EXPECTED_SEMANTIC_ONLY);
    // HO-069's new expectation is a documented NOT_IMPLEMENTED check.
    expect(p.falseNegatives.find((f) => f.ref === "HO-069")?.kind).toBe("NOT_IMPLEMENTED");
    // HO-073 SET_KEY_LENGTH_BIAS stays a forbidden false positive.
    expect(p.falsePositives.find((f) => f.ref === "HO-073")?.basis).toBe("FORBIDDEN");
  });

  it("reports the per-case taxonomy for the 9 reviewed cases (all decisions definitive)", () => {
    const LC = "HUMAN_DECIDED_LABEL_CHANGE";
    const NLC = "HUMAN_DECIDED_NO_LABEL_CHANGE";
    const ME = "METRIC_EFFECT";
    const NME = "HUMAN_DECIDED_BUT_NO_METRIC_EFFECT";
    expect(cmp.reviewedCases.map((r) => [r.caseId, r.labelEffect, r.metricEffect, r.declinedEmissionsLeftUnlabeled])).toEqual([
      ["HO-049", NLC, NME, []],
      ["HO-070", NLC, NME, []],
      ["HO-076", NLC, NME, []],
      ["HO-017", LC, ME, []],
      ["HO-015", NLC, NME, []],
      ["HO-063", LC, ME, []],
      ["HO-032", NLC, NME, []],
      ["HO-069", LC, ME, []],
      ["HO-073", NLC, NME, []],
    ]);
    expect(cmp.trueRemainingAmbiguity).toBe(0);
    const out = formatPostHumanMarkdown(cmp);
    expect(out).toContain("TRUE_REMAINING_AMBIGUITY = 0");
    expect(out).toContain("not human uncertainty");
    expect(out.toLowerCase()).not.toContain("ambiguity remaining");
    expect(JSON.stringify(cmp.reviewedCases).toLowerCase()).not.toContain("ambiguity remaining");
    const row = (id: string) => cmp.reviewedCases.find((r) => r.caseId === id)!;
    expect([row("HO-017").first, row("HO-017").post]).toEqual([{ tp: 0, fn: 2, fp: 0, unlabeled: 0 }, { tp: 0, fn: 0, fp: 0, unlabeled: 0 }]);
    expect([row("HO-063").first, row("HO-063").post]).toEqual([{ tp: 0, fn: 2, fp: 0, unlabeled: 0 }, { tp: 0, fn: 1, fp: 0, unlabeled: 0 }]);
    expect([row("HO-015").first, row("HO-015").post]).toEqual([{ tp: 1, fn: 0, fp: 0, unlabeled: 0 }, { tp: 1, fn: 0, fp: 0, unlabeled: 0 }]);
    expect([row("HO-069").first, row("HO-069").post]).toEqual([{ tp: 0, fn: 0, fp: 0, unlabeled: 0 }, { tp: 0, fn: 1, fp: 0, unlabeled: 0 }]);
    for (const id of ["HO-049", "HO-070", "HO-032", "HO-073"]) expect(row(id).first, id).toEqual(row(id).post);
  });

  it("is deterministic", () => {
    expect(compareFrozenAndPostHuman(corpus, labels, overlay)).toEqual(cmp);
  });
});

describe("docs/ASSESSMENT_HELDOUT_V0_2.md post-human block", () => {
  const doc = readFileSync(fileURLToPath(new URL("../../../../docs/ASSESSMENT_HELDOUT_V0_2.md", import.meta.url)), "utf8").replace(/\r\n/g, "\n");

  it("embeds the current POST_HUMAN generated block (drift guard) and keeps the frozen-label block", () => {
    expect(doc).toContain(formatPostHumanMarkdown(cmp));
    expect(doc).toContain(formatHeldOutMarkdown(report));
    expect(formatPostHumanMarkdown(cmp)).toContain("HUMAN-ADJUDICATED / POST-EVALUATION metrics");
    expect(formatPostHumanMarkdown(cmp)).toContain("not FIRST-BLIND metrics");
    // Evidence naming: generated blocks must never present current-linter numbers as FIRST_BLIND; the historical record stays in the doc header.
    expect(formatPostHumanMarkdown(cmp)).toContain("| Measure | CURRENT_LINTER_ON_FROZEN_V0_2 |");
    expect(formatPostHumanMarkdown(cmp)).not.toContain("| FIRST_BLIND |");
    expect(formatHeldOutMarkdown(report)).not.toContain("FIRST_BLIND");
    expect(doc).toContain("HISTORICAL FIRST_BLIND (Run 004, immutable): TP 80 / FN 44 / FP 4 / UNLABELED 22");
    expect(doc.split("<!-- GENERATED:BEGIN formatPostHumanMarkdown").length - 1).toBe(1);
  });
});

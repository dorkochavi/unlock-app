/**
 * Held-out evaluation harness for the unwired deterministic question linter
 * (Run 2026-10-09-ASSESSMENT-ENGINE-004, Slice A4; FUB-063).
 *
 * Pure and deterministic: no fs, no IO. Takes the parsed frozen Golden Dataset v0.2 corpus + labels and returns a
 * structured report. NO TUNING: this module only measures; it never changes the linter, the labels or the corpus.
 * NO single opaque score and NO pooling with the v0.1 (DEV / CALIBRATION) results.
 *
 * Conventions (mirror calibration.ts, differences documented):
 *   expected detection = an expected code from the labels (ITEM: expectedCodes; SET: expectedSetCodes + every itemCodes entry)
 *   TP                 = expected and emitted
 *   FN                 = expected and not emitted; kind NOT_IMPLEMENTED when the linter has no such check, else HEURISTIC_GAP
 *   FP                 = emitted code listed in forbidden(Set)Codes, OR any emitted code (all are WARNING/ERROR) on a CLEAN case
 *   UNLABELED_EMISSION = emitted code on a FLAWED case that is neither expected nor forbidden. NOT counted as FP: it is a
 *                        label-question / over-flag candidate. (v0.1 had exhaustive negatives; v0.2 labels only list
 *                        forbiddenCodes for "tempting but not applicable" cases, so this separate bucket is needed.)
 *   semantic-only      = FLAWED case with no expected deterministic code at all and a non-null semanticExpectation
 *
 * SET mapping (read from question-lint.ts): lintQuestionSet returns SET-scope issues only. So
 *   - SET-scope codes: lintQuestionSet(set) compared with expectedSetCodes / forbiddenSetCodes;
 *   - ITEM-level codes inside a set: lintQuestionItem(set[i]) compared with itemCodes, keyed by 1-BASED item number
 *     (labels.json uses "1".."N"; e.g. HO-074 labels item "10" of 10 items). Items not listed in itemCodes may emit
 *     codes: those are UNLABELED_EMISSION (CLEAN sets: FP). There is no forbidden-item-code list for sets.
 */
import {
  IMPLEMENTED_ITEM_CODES,
  IMPLEMENTED_SET_CODES,
} from "./calibration";
import { lintQuestionItem, lintQuestionSet } from "../question-lint";

/** Documented-but-unimplemented check codes (question-lint.ts header, sections 10.3/11.1). */
export const KNOWN_NOT_IMPLEMENTED_CODES: readonly string[] = [
  "STEM_NO_QUESTION_FORM", "STEM_DOUBLE_NEGATIVE", "OPTION_COMBINATION_REFERENCE", "OPTION_STYLE_OUTLIER",
  "OPTION_PREFIX_STEM_REPEAT", "ARTICLE_MISMATCH", "OPTION_NUMERIC_UNORDERED", "OPTION_COUNT_UNUSUAL",
  "OPTION_PUNCTUATION_INCONSISTENT", "EXPLANATION_NAMES_ONLY_KEY", "NEAR_DUPLICATE_ITEM", "SET_OPTION_COUNT_MIXED",
  "ALL_OR_NONE_OVERUSE", "QUESTION_TYPE_MONO",
];

export interface HeldOutCorpusCase {
  caseId: string;
  scope: "ITEM" | "SET";
  item?: unknown;
  set?: unknown[];
}
export interface HeldOutCorpus {
  cases: HeldOutCorpusCase[];
}
export interface HeldOutLabel {
  caseId: string;
  scope: "ITEM" | "SET";
  label: "CLEAN" | "FLAWED";
  expectedCodes?: string[];
  forbiddenCodes?: string[];
  expectedSetCodes?: string[];
  forbiddenSetCodes?: string[];
  itemCodes?: Record<string, string[]>;
  semanticExpectation: string | null;
  rationale: string;
  confidence: string;
  languageReviewRequired: boolean;
}
export interface HeldOutLabels {
  labels: HeldOutLabel[];
}

export type MissKind = "NOT_IMPLEMENTED" | "HEURISTIC_GAP";
export interface HeldOutFinding {
  /** Case id, or `HO-0xx/itemN` (1-based) for an item inside a SET case. */
  ref: string;
  caseId: string;
  level: "ITEM" | "SET" | "ITEM_IN_SET";
  code: string;
  /** FN only. */
  kind?: MissKind;
  /** FP only: why it is a false positive. */
  basis?: "FORBIDDEN" | "CLEAN_CASE";
}

export interface HeldOutCheckRow {
  code: string;
  implemented: boolean;
  expected: number;
  tp: number;
  fn: number;
  fp: number;
  unlabeled: number;
}

export interface HeldOutSetRow {
  caseId: string;
  label: "CLEAN" | "FLAWED";
  expectedSetCodes: string[];
  emittedSetCodes: string[];
  setTp: number;
  setFn: number;
  setFp: number;
  itemTp: number;
  itemFn: number;
  itemFp: number;
  unlabeled: number;
}

export interface HeldOutReport {
  datasetVersion: string;
  caseCounts: {
    total: number;
    item: number;
    set: number;
    clean: number;
    flawed: number;
    withSemanticExpectation: number;
    /** FLAWED, no expected deterministic code, non-null semanticExpectation. */
    semanticOnly: number;
    languageReviewRequired: number;
  };
  totals: {
    expectedDetections: number;
    truePositive: number;
    falseNegative: number;
    falseNegativeHeuristicGap: number;
    falseNegativeNotImplemented: number;
    falsePositive: number;
    cleanCases: number;
    cleanCasesWithWarningOrError: number;
    unlabeledEmissions: number;
  };
  /** Same split restricted to SET cases (set-scope codes only / item-in-set codes only). */
  setLevel: {
    setScope: { expected: number; tp: number; fn: number; fp: number };
    itemInSet: { expected: number; tp: number; fn: number; fp: number };
  };
  checks: HeldOutCheckRow[];
  setRows: HeldOutSetRow[];
  falseNegatives: HeldOutFinding[];
  falsePositives: HeldOutFinding[];
  unlabeledEmissions: HeldOutFinding[];
  semanticOnlyCases: Array<{ caseId: string; semanticExpectation: string }>;
  /** Corpus/label registry problems (missing label, orphan label, scope mismatch). MUST be empty. */
  integrityFindings: string[];
  summary: string[];
}

const CAVEAT =
  "Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1.";

function ratio(num: number, den: number): string {
  return den === 0 ? "n/a" : `${num}/${den}`;
}

interface Tally {
  expected: number;
  tp: number;
  fn: number;
  fp: number;
  unlabeled: number;
}

export function runHeldOutEvaluation(corpus: HeldOutCorpus, labels: HeldOutLabels): HeldOutReport {
  const implItem = new Set(IMPLEMENTED_ITEM_CODES);
  const implSet = new Set(IMPLEMENTED_SET_CODES);
  const tallies = new Map<string, Tally>();
  const tally = (code: string): Tally => {
    let t = tallies.get(code);
    if (!t) {
      t = { expected: 0, tp: 0, fn: 0, fp: 0, unlabeled: 0 };
      tallies.set(code, t);
    }
    return t;
  };

  const integrity: string[] = [];
  const labelById = new Map<string, HeldOutLabel>();
  for (const l of labels.labels) {
    if (labelById.has(l.caseId)) integrity.push(`${l.caseId}: duplicate label`);
    labelById.set(l.caseId, l);
  }
  const seen = new Set<string>();

  const fns: HeldOutFinding[] = [];
  const fps: HeldOutFinding[] = [];
  const unl: HeldOutFinding[] = [];
  const semanticOnlyCases: Array<{ caseId: string; semanticExpectation: string }> = [];
  const setRows: HeldOutSetRow[] = [];
  const setLevel = {
    setScope: { expected: 0, tp: 0, fn: 0, fp: 0 },
    itemInSet: { expected: 0, tp: 0, fn: 0, fp: 0 },
  };
  let itemCases = 0;
  let setCases = 0;
  let cleanCases = 0;
  let flawedCases = 0;
  let withSemantic = 0;
  let langReview = 0;
  let cleanWithIssue = 0;

  /** Compare one emitted code set against expectations; updates tallies and finding lists. Returns local counts. */
  function compare(args: {
    caseId: string;
    ref: string;
    level: HeldOutFinding["level"];
    clean: boolean;
    emitted: ReadonlySet<string>;
    expected: readonly string[];
    forbidden: readonly string[];
    implemented: ReadonlySet<string>;
  }): { expected: number; tp: number; fn: number; fp: number; unlabeled: number } {
    const expectedSet = new Set(args.expected);
    const forbiddenSet = new Set(args.forbidden);
    const out = { expected: 0, tp: 0, fn: 0, fp: 0, unlabeled: 0 };
    for (const code of expectedSet) {
      const t = tally(code);
      t.expected += 1;
      out.expected += 1;
      if (args.emitted.has(code)) {
        t.tp += 1;
        out.tp += 1;
      } else {
        t.fn += 1;
        out.fn += 1;
        fns.push({
          ref: args.ref,
          caseId: args.caseId,
          level: args.level,
          code,
          kind: args.implemented.has(code) ? "HEURISTIC_GAP" : "NOT_IMPLEMENTED",
        });
      }
    }
    for (const code of Array.from(args.emitted).sort()) {
      if (expectedSet.has(code)) continue;
      if (forbiddenSet.has(code) || args.clean) {
        tally(code).fp += 1;
        out.fp += 1;
        fps.push({ ref: args.ref, caseId: args.caseId, level: args.level, code, basis: forbiddenSet.has(code) ? "FORBIDDEN" : "CLEAN_CASE" });
      } else {
        tally(code).unlabeled += 1;
        out.unlabeled += 1;
        unl.push({ ref: args.ref, caseId: args.caseId, level: args.level, code });
      }
    }
    return out;
  }

  for (const c of corpus.cases) {
    const lab = labelById.get(c.caseId);
    seen.add(c.caseId);
    if (!lab) {
      integrity.push(`${c.caseId}: no label`);
      continue;
    }
    if (lab.scope !== c.scope) integrity.push(`${c.caseId}: scope mismatch corpus=${c.scope} label=${lab.scope}`);
    const clean = lab.label === "CLEAN";
    if (clean) cleanCases += 1;
    else flawedCases += 1;
    if (lab.semanticExpectation !== null) withSemantic += 1;
    if (lab.languageReviewRequired) langReview += 1;
    let caseHasEmission = false;
    let expectedCount = 0;

    if (c.scope === "ITEM") {
      itemCases += 1;
      const emitted = new Set(lintQuestionItem(c.item).map((i) => i.code));
      caseHasEmission = emitted.size > 0;
      expectedCount = new Set(lab.expectedCodes ?? []).size;
      compare({
        caseId: c.caseId, ref: c.caseId, level: "ITEM", clean, emitted,
        expected: lab.expectedCodes ?? [], forbidden: lab.forbiddenCodes ?? [], implemented: implItem,
      });
    } else {
      setCases += 1;
      const items = c.set ?? [];
      const setEmitted = new Set(lintQuestionSet(items).map((i) => i.code));
      const sc = compare({
        caseId: c.caseId, ref: c.caseId, level: "SET", clean, emitted: setEmitted,
        expected: lab.expectedSetCodes ?? [], forbidden: lab.forbiddenSetCodes ?? [], implemented: implSet,
      });
      const ic = { expected: 0, tp: 0, fn: 0, fp: 0, unlabeled: 0 };
      let itemEmission = false;
      const labeledIdx = lab.itemCodes ?? {};
      for (const key of Object.keys(labeledIdx)) {
        const n = Number(key);
        if (!Number.isInteger(n) || n < 1 || n > items.length) integrity.push(`${c.caseId}: itemCodes index ${key} out of range 1..${items.length}`);
      }
      items.forEach((it, idx) => {
        const num = idx + 1;
        const emitted = new Set(lintQuestionItem(it).map((i) => i.code));
        if (emitted.size > 0) itemEmission = true;
        const r = compare({
          caseId: c.caseId, ref: `${c.caseId}/item${num}`, level: "ITEM_IN_SET", clean, emitted,
          expected: labeledIdx[String(num)] ?? [], forbidden: [], implemented: implItem,
        });
        ic.expected += r.expected; ic.tp += r.tp; ic.fn += r.fn; ic.fp += r.fp; ic.unlabeled += r.unlabeled;
      });
      caseHasEmission = setEmitted.size > 0 || itemEmission;
      expectedCount = new Set(lab.expectedSetCodes ?? []).size + ic.expected;
      setLevel.setScope.expected += sc.expected; setLevel.setScope.tp += sc.tp; setLevel.setScope.fn += sc.fn; setLevel.setScope.fp += sc.fp;
      setLevel.itemInSet.expected += ic.expected; setLevel.itemInSet.tp += ic.tp; setLevel.itemInSet.fn += ic.fn; setLevel.itemInSet.fp += ic.fp;
      setRows.push({
        caseId: c.caseId,
        label: lab.label,
        expectedSetCodes: [...(lab.expectedSetCodes ?? [])],
        emittedSetCodes: Array.from(setEmitted).sort(),
        setTp: sc.tp, setFn: sc.fn, setFp: sc.fp,
        itemTp: ic.tp, itemFn: ic.fn, itemFp: ic.fp,
        unlabeled: sc.unlabeled + ic.unlabeled,
      });
    }
    if (clean && caseHasEmission) cleanWithIssue += 1;
    if (!clean && expectedCount === 0 && lab.semanticExpectation !== null) {
      semanticOnlyCases.push({ caseId: c.caseId, semanticExpectation: lab.semanticExpectation });
    }
  }
  for (const id of labelById.keys()) if (!seen.has(id)) integrity.push(`${id}: label without corpus case`);

  const checks: HeldOutCheckRow[] = Array.from(tallies.keys())
    .sort()
    .map((code) => {
      const t = tally(code);
      return {
        code,
        implemented: implItem.has(code) || implSet.has(code),
        expected: t.expected, tp: t.tp, fn: t.fn, fp: t.fp, unlabeled: t.unlabeled,
      };
    });
  const sum = (f: (c: HeldOutCheckRow) => number): number => checks.reduce((a, c) => a + f(c), 0);
  const fnHeur = fns.filter((f) => f.kind === "HEURISTIC_GAP").length;
  const fnNot = fns.filter((f) => f.kind === "NOT_IMPLEMENTED").length;
  const totals = {
    expectedDetections: sum((c) => c.expected),
    truePositive: sum((c) => c.tp),
    falseNegative: sum((c) => c.fn),
    falseNegativeHeuristicGap: fnHeur,
    falseNegativeNotImplemented: fnNot,
    falsePositive: sum((c) => c.fp),
    cleanCases,
    cleanCasesWithWarningOrError: cleanWithIssue,
    unlabeledEmissions: sum((c) => c.unlabeled),
  };
  const summary = [
    `RECALL-LIKE (all labelled detections): ${ratio(totals.truePositive, totals.truePositive + totals.falseNegative)} caught.`,
    `FN count: ${totals.falseNegative} (${fnHeur} HEURISTIC_GAP on implemented checks, ${fnNot} NOT_IMPLEMENTED checks).`,
    `PRECISION-LIKE (labelled detections vs false alarms): ${ratio(totals.truePositive, totals.truePositive + totals.falsePositive)}.`,
    `FP count: ${totals.falsePositive} (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).`,
    `CLEAN cases with a WARNING/ERROR: ${cleanWithIssue} of ${cleanCases}.`,
    `UNLABELED_EMISSIONS: ${totals.unlabeledEmissions} (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).`,
    `SEMANTIC-ONLY cases: ${semanticOnlyCases.length} (FLAWED with no deterministic expectation; not assertable against the linter).`,
    CAVEAT,
  ];

  return {
    datasetVersion: "v0.2-heldout",
    caseCounts: {
      total: corpus.cases.length,
      item: itemCases,
      set: setCases,
      clean: cleanCases,
      flawed: flawedCases,
      withSemanticExpectation: withSemantic,
      semanticOnly: semanticOnlyCases.length,
      languageReviewRequired: langReview,
    },
    totals,
    setLevel,
    checks,
    setRows,
    falseNegatives: fns,
    falsePositives: fps,
    unlabeledEmissions: unl,
    semanticOnlyCases,
    integrityFindings: integrity,
    summary,
  };
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Deterministic Markdown rendering of the generated block of docs/ASSESSMENT_HELDOUT_V0_2.md. */
export function formatHeldOutMarkdown(r: HeldOutReport): string {
  const lines: string[] = [];
  lines.push("<!-- GENERATED:BEGIN formatHeldOutMarkdown (src/domain/assessment/golden/heldout-eval.ts) -->");
  lines.push("## Headline (generated)");
  lines.push("");
  for (const s of r.summary) lines.push(`- ${s}`);
  lines.push("");
  lines.push("## Case counts (generated)");
  lines.push("");
  lines.push("| Measure | Count |");
  lines.push("|---|---|");
  lines.push(`| Total cases | ${r.caseCounts.total} |`);
  lines.push(`| ITEM cases | ${r.caseCounts.item} |`);
  lines.push(`| SET cases | ${r.caseCounts.set} |`);
  lines.push(`| CLEAN cases | ${r.caseCounts.clean} |`);
  lines.push(`| FLAWED cases | ${r.caseCounts.flawed} |`);
  lines.push(`| Cases with a semanticExpectation | ${r.caseCounts.withSemanticExpectation} |`);
  lines.push(`| SEMANTIC-ONLY cases | ${r.caseCounts.semanticOnly} |`);
  lines.push(`| languageReviewRequired | ${r.caseCounts.languageReviewRequired} |`);
  lines.push(`| Expected deterministic detections | ${r.totals.expectedDetections} |`);
  lines.push(`| TP | ${r.totals.truePositive} |`);
  lines.push(`| FN (HEURISTIC_GAP / NOT_IMPLEMENTED) | ${r.totals.falseNegative} (${r.totals.falseNegativeHeuristicGap} / ${r.totals.falseNegativeNotImplemented}) |`);
  lines.push(`| FP | ${r.totals.falsePositive} |`);
  lines.push(`| CLEAN cases with a WARNING/ERROR | ${r.totals.cleanCasesWithWarningOrError} of ${r.totals.cleanCases} |`);
  lines.push(`| UNLABELED_EMISSION | ${r.totals.unlabeledEmissions} |`);
  lines.push("");
  lines.push("## Set-level behaviour (generated)");
  lines.push("");
  lines.push("| Level | Expected | TP | FN | FP |");
  lines.push("|---|---|---|---|---|");
  lines.push(`| SET-scope codes (lintQuestionSet) | ${r.setLevel.setScope.expected} | ${r.setLevel.setScope.tp} | ${r.setLevel.setScope.fn} | ${r.setLevel.setScope.fp} |`);
  lines.push(`| ITEM codes inside SET cases (lintQuestionItem per item) | ${r.setLevel.itemInSet.expected} | ${r.setLevel.itemInSet.tp} | ${r.setLevel.itemInSet.fn} | ${r.setLevel.itemInSet.fp} |`);
  lines.push("");
  lines.push("| SET case | Label | Expected set codes | Emitted set codes | Set TP/FN/FP | Item TP/FN/FP | Unlabeled |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const s of r.setRows) {
    lines.push(
      `| ${s.caseId} | ${s.label} | ${s.expectedSetCodes.join(", ") || "-"} | ${s.emittedSetCodes.join(", ") || "-"} | ${s.setTp}/${s.setFn}/${s.setFp} | ${s.itemTp}/${s.itemFn}/${s.itemFp} | ${s.unlabeled} |`,
    );
  }
  lines.push("");
  lines.push("## Per-check results (generated)");
  lines.push("");
  lines.push("TP = caught, FN = missed, FP = false alarm (forbidden, or any code on a CLEAN case), UNLAB = unlabeled emission on a FLAWED case (not an FP).");
  lines.push("");
  lines.push("| Check code | Implemented | Expected | TP | FN | FP | UNLAB | PRECISION-LIKE | RECALL-LIKE |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const c of r.checks) {
    lines.push(
      `| ${c.code} | ${c.implemented ? "yes" : "NO"} | ${c.expected} | ${c.tp} | ${c.fn} | ${c.fp} | ${c.unlabeled} | ${ratio(c.tp, c.tp + c.fp)} | ${ratio(c.tp, c.tp + c.fn)} |`,
    );
  }
  lines.push("");
  lines.push("## False negatives (generated)");
  lines.push("");
  lines.push("| Ref | Level | Code | Kind |");
  lines.push("|---|---|---|---|");
  for (const f of r.falseNegatives) lines.push(`| ${f.ref} | ${f.level} | ${f.code} | ${f.kind ?? ""} |`);
  lines.push("");
  lines.push("## False positives (generated)");
  lines.push("");
  lines.push("| Ref | Level | Code | Basis |");
  lines.push("|---|---|---|---|");
  for (const f of r.falsePositives) lines.push(`| ${f.ref} | ${f.level} | ${f.code} | ${f.basis ?? ""} |`);
  lines.push("");
  lines.push("## Unlabeled emissions (generated)");
  lines.push("");
  lines.push("| Ref | Level | Code |");
  lines.push("|---|---|---|");
  for (const f of r.unlabeledEmissions) lines.push(`| ${f.ref} | ${f.level} | ${f.code} |`);
  lines.push("");
  lines.push("## Semantic-only cases (generated)");
  lines.push("");
  lines.push("| Case | semanticExpectation |");
  lines.push("|---|---|");
  for (const s of r.semanticOnlyCases) lines.push(`| ${s.caseId} | ${cell(s.semanticExpectation)} |`);
  lines.push("<!-- GENERATED:END -->");
  return lines.join("\n");
}

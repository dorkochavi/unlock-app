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
  /** Per-item forbidden codes inside a SET case (key = 1-based item number). Absent in the frozen labels; only a post-human overlay adds it. */
  forbiddenItemCodes?: Record<string, string[]>;
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
          expected: labeledIdx[String(num)] ?? [], forbidden: lab.forbiddenItemCodes?.[String(num)] ?? [], implemented: implItem,
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

// ---------------------------------------------------------------------------------------------------------------------
// Post-evaluation human adjudication (Run 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001, Slice H1).
// The frozen labels stay untouched. A separate overlay (human-adjudication.json, deliberately NOT in the freeze hashes)
// patches 9 labels in code. The frozen-label evaluation (CURRENT_LINTER_ON_FROZEN_V0_2) is reproducible from the frozen labels; POST_HUMAN is a separate set.
// NOTE: "FIRST_BLIND" is a historical Run-004 event (TP 80 / FN 44 / FP 4 / UNLABELED 22), not something this harness can recompute once the linter changes.
// This is NOT linter tuning: no linter, threshold, cue list or corpus is changed by anything below.
// ---------------------------------------------------------------------------------------------------------------------

/** The only case ids a human adjudication overlay may touch. */
export const HUMAN_REVIEWED_CASE_IDS: readonly string[] = [
  "HO-049", "HO-070", "HO-076", "HO-017", "HO-015", "HO-063", "HO-032", "HO-069", "HO-073",
];
export const MODEL_PROVENANCE = "MODEL_LABELED_NOT_HUMAN_APPROVED";
export const HUMAN_PROVENANCE = "HUMAN_APPROVED";

export interface HumanDecision {
  caseId: string;
  decision: "APPROVED" | "CHANGED" | "APPROVED_PARTIAL";
  /** Snapshot copied from the frozen label; validated against it. */
  before: Record<string, unknown>;
  patch: {
    label?: "CLEAN" | "FLAWED";
    removeExpectedCodes?: string[];
    addExpectedCodes?: string[];
    /** Final precision decision: the human ruled the emission a real false positive (not a flaw). ITEM labels only. */
    addForbiddenCodes?: string[];
    /** Same, for items inside a SET case (key = 1-based item number). SET labels only. */
    addForbiddenItemCodes?: Record<string, string[]>;
    rationale?: string;
  };
  humanReasoning: string;
  humanRule: string;
  humanNotes?: string;
  /**
   * `ref|code` findings that the decision touched (declined/removed as an expectation, without an explicit forbid).
   * If the linter still emits one, the harness counts it as UNLABELED_EMISSION: an accounting convention, not human uncertainty.
   */
  touchedFindings?: string[];
  /** Explicit marker for a decision that is genuinely unresolved. Absent (undefined) for all 9 decisions: every one is definitive. */
  trueAmbiguity?: boolean;
}
export interface HumanAdjudicationOverlay {
  version: string;
  reviewer: string;
  reviewDate: string;
  provenance: string;
  evaluationStatus: string;
  decisions: HumanDecision[];
}
export interface ProvenancedLabels extends HeldOutLabels {
  provenanceById: Record<string, string>;
}

/** Restores the frozen forbidden fields on a copy, so forbidden-only additions do not count as a label change. */
function withoutForbidAdditions(next: HeldOutLabel, frozen: HeldOutLabel): HeldOutLabel {
  const out: HeldOutLabel = JSON.parse(JSON.stringify(next)) as HeldOutLabel;
  if (frozen.forbiddenCodes === undefined) delete out.forbiddenCodes;
  else out.forbiddenCodes = frozen.forbiddenCodes;
  if (frozen.forbiddenItemCodes === undefined) delete out.forbiddenItemCodes;
  else out.forbiddenItemCodes = frozen.forbiddenItemCodes;
  return out;
}

/** Pure. Applies the overlay on top of the frozen labels (inputs are not mutated). Throws on any invalid overlay. */
export function applyHumanAdjudication(labels: HeldOutLabels, overlay: HumanAdjudicationOverlay): ProvenancedLabels {
  const allowed = new Set(HUMAN_REVIEWED_CASE_IDS);
  const byId = new Map(labels.labels.map((l) => [l.caseId, l]));
  const seen = new Set<string>();
  const patched = new Map<string, HeldOutLabel>();
  for (const d of overlay.decisions) {
    const where = `human adjudication ${d.caseId}`;
    if (seen.has(d.caseId)) throw new Error(`${where}: duplicate decision`);
    seen.add(d.caseId);
    if (!allowed.has(d.caseId)) throw new Error(`${where}: not one of the 9 reviewed case ids`);
    const frozen = byId.get(d.caseId);
    if (!frozen) throw new Error(`${where}: no such frozen label`);
    for (const [k, v] of Object.entries(d.before)) {
      if (JSON.stringify((frozen as unknown as Record<string, unknown>)[k]) !== JSON.stringify(v)) {
        throw new Error(`${where}: before.${k} does not match the frozen label`);
      }
    }
    const next: HeldOutLabel = JSON.parse(JSON.stringify(frozen)) as HeldOutLabel;
    const expected = next.expectedCodes ?? [];
    const removes = d.patch.removeExpectedCodes ?? [];
    const adds = d.patch.addExpectedCodes ?? [];
    for (const code of removes) {
      if (!expected.includes(code)) throw new Error(`${where}: removed code ${code} was not expected`);
    }
    let after = expected.filter((c) => !removes.includes(c));
    for (const code of adds) if (!after.includes(code)) after = [...after, code];
    if (removes.length + adds.length > 0) {
      if (next.scope !== "ITEM") throw new Error(`${where}: code patches apply to ITEM labels only`);
      next.expectedCodes = after;
    }
    const addForbidden = d.patch.addForbiddenCodes ?? [];
    if (addForbidden.length > 0) {
      if (next.scope !== "ITEM") throw new Error(`${where}: addForbiddenCodes applies to ITEM labels only`);
      for (const code of addForbidden) {
        if ((next.expectedCodes ?? []).includes(code)) throw new Error(`${where}: cannot forbid expected code ${code}`);
      }
      next.forbiddenCodes = Array.from(new Set([...(next.forbiddenCodes ?? []), ...addForbidden]));
    }
    const addForbiddenItems = d.patch.addForbiddenItemCodes ?? {};
    if (Object.keys(addForbiddenItems).length > 0) {
      if (next.scope !== "SET") throw new Error(`${where}: addForbiddenItemCodes applies to SET labels only`);
      const merged: Record<string, string[]> = { ...(next.forbiddenItemCodes ?? {}) };
      for (const [idx, codes] of Object.entries(addForbiddenItems)) {
        if (!Object.prototype.hasOwnProperty.call(next.itemCodes ?? {}, idx)) throw new Error(`${where}: forbidden item index ${idx} is not a labeled item`);
        for (const code of codes) {
          if ((next.itemCodes?.[idx] ?? []).includes(code)) throw new Error(`${where}: cannot forbid expected code ${code} at item ${idx}`);
        }
        merged[idx] = Array.from(new Set([...(merged[idx] ?? []), ...codes]));
      }
      next.forbiddenItemCodes = merged;
    }
    if (d.patch.label !== undefined) next.label = d.patch.label;
    if (d.patch.rationale !== undefined) next.rationale = d.patch.rationale;
    // Forbidden-only additions are precision flags, not label changes: the human decision itself is unchanged.
    const changed = JSON.stringify(withoutForbidAdditions(next, frozen)) !== JSON.stringify(frozen);
    if (d.decision === "CHANGED" && !changed) throw new Error(`${where}: CHANGED decision changes nothing`);
    if (d.decision !== "CHANGED" && changed) throw new Error(`${where}: ${d.decision} decision must not change the label`);
    if (next.label === "CLEAN") {
      const codes = [...(next.expectedCodes ?? []), ...(next.expectedSetCodes ?? []), ...Object.values(next.itemCodes ?? {}).flat()];
      if (codes.length > 0 || next.semanticExpectation !== null) {
        throw new Error(`${where}: CLEAN label must have no expected codes or semantic expectation`);
      }
    }
    patched.set(d.caseId, next);
  }
  const provenanceById: Record<string, string> = {};
  const out = labels.labels.map((l) => {
    const p = patched.get(l.caseId);
    provenanceById[l.caseId] = p ? overlay.provenance : MODEL_PROVENANCE;
    return p ?? l;
  });
  return { labels: out, provenanceById };
}

export interface CaseCounts {
  tp: number;
  fn: number;
  fp: number;
  unlabeled: number;
}
export interface PostHumanCaseRow {
  caseId: string;
  decision: HumanDecision["decision"];
  first: CaseCounts;
  post: CaseCounts;
  /** Findings (`KIND ref code`) present only in CURRENT_LINTER_ON_FROZEN_V0_2 / only in POST_HUMAN. */
  removed: string[];
  added: string[];
  /** Did the applied human decision change the label or its expected codes? Forbidden-code (precision) additions are excluded; they show up as METRIC_EFFECT. */
  labelEffect: "HUMAN_DECIDED_LABEL_CHANGE" | "HUMAN_DECIDED_NO_LABEL_CHANGE";
  /** Does any FN/FP/UNL finding, or any TP/FN/FP/UNL count, differ between CURRENT_LINTER_ON_FROZEN_V0_2 and POST_HUMAN for this case? */
  metricEffect: "METRIC_EFFECT" | "HUMAN_DECIDED_BUT_NO_METRIC_EFFECT";
  /**
   * Touched `ref|code` findings that are still UNLABELED_EMISSIONs after adjudication. Accounting note ONLY: a declined or
   * removed expectation that was not explicitly forbidden is counted as UNLABELED_EMISSION by harness convention. This is NOT
   * human ambiguity; the human decision is definitive.
   */
  declinedEmissionsLeftUnlabeled: string[];
}
export interface PostHumanComparison {
  /** Frozen labels evaluated with the CURRENT linter. Not FIRST_BLIND (a historical Run-004 event). */
  currentLinterOnFrozen: HeldOutReport;
  postHuman: HeldOutReport;
  /** POST_HUMAN with the final precision (forbidden) additions withheld: the state before Run HELDOUT-HUMAN-REVIEW-003. */
  postHumanBeforeFinalForbidden: HeldOutReport;
  /** post - first for every numeric metric. */
  delta: {
    caseCounts: HeldOutReport["caseCounts"];
    totals: HeldOutReport["totals"];
    setLevel: HeldOutReport["setLevel"];
  };
  reviewedCases: PostHumanCaseRow[];
  /** Count of decisions with an explicit `trueAmbiguity: true`. 0 for all 9 decisions (all are definitive). */
  trueRemainingAmbiguity: number;
}

function diffNumbers<T extends object>(post: T, first: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(post)) {
    const f = (first as Record<string, unknown>)[k];
    out[k] = typeof v === "number" ? v - (f as number) : diffNumbers(v as object, f as object);
  }
  return out as T;
}

function findingKeys(r: HeldOutReport): string[] {
  const k = (kind: string, f: { ref: string; code: string }): string => `${kind} ${f.ref} ${f.code}`;
  return [
    ...r.falseNegatives.map((f) => k("FN", f)),
    ...r.falsePositives.map((f) => k("FP", f)),
    ...r.unlabeledEmissions.map((f) => k("UNL", f)),
  ];
}

function caseSlice(corpus: HeldOutCorpus, labels: HeldOutLabels, caseId: string): HeldOutReport {
  return runHeldOutEvaluation(
    { cases: corpus.cases.filter((c) => c.caseId === caseId) },
    { labels: labels.labels.filter((l) => l.caseId === caseId) },
  );
}

/** Pure. CURRENT_LINTER_ON_FROZEN_V0_2 (frozen labels) vs POST_HUMAN (overlay applied), delta, and the per-case table of the 9 reviewed cases. */
export function compareFrozenAndPostHuman(
  corpus: HeldOutCorpus,
  labels: HeldOutLabels,
  overlay: HumanAdjudicationOverlay,
): PostHumanComparison {
  const post = applyHumanAdjudication(labels, overlay);
  const currentLinterOnFrozen = runHeldOutEvaluation(corpus, labels);
  const postHuman = runHeldOutEvaluation(corpus, post);
  const withoutFinalForbidden: HumanAdjudicationOverlay = {
    ...overlay,
    decisions: overlay.decisions.map((d) => ({ ...d, patch: { ...d.patch, addForbiddenCodes: undefined, addForbiddenItemCodes: undefined } })),
  };
  const postHumanBeforeFinalForbidden = runHeldOutEvaluation(corpus, applyHumanAdjudication(labels, withoutFinalForbidden));
  const counts = (r: HeldOutReport): CaseCounts => ({
    tp: r.totals.truePositive, fn: r.totals.falseNegative, fp: r.totals.falsePositive, unlabeled: r.totals.unlabeledEmissions,
  });
  const reviewedCases = overlay.decisions.map((d): PostHumanCaseRow => {
    const a = caseSlice(corpus, labels, d.caseId);
    const b = caseSlice(corpus, post, d.caseId);
    const ka = new Set(findingKeys(a));
    const kb = new Set(findingKeys(b));
    const removed = Array.from(ka).filter((x) => !kb.has(x));
    const added = Array.from(kb).filter((x) => !ka.has(x));
    const touched = new Set(d.touchedFindings ?? []);
    const declinedEmissionsLeftUnlabeled = b.unlabeledEmissions
      .map((f) => `${f.ref}|${f.code}`)
      .filter((x) => touched.has(x));
    const before = labels.labels.find((l) => l.caseId === d.caseId);
    const after = post.labels.find((l) => l.caseId === d.caseId);
    const labelEffect: PostHumanCaseRow["labelEffect"] =
      before && after && JSON.stringify(withoutForbidAdditions(after, before)) !== JSON.stringify(before)
        ? "HUMAN_DECIDED_LABEL_CHANGE"
        : "HUMAN_DECIDED_NO_LABEL_CHANGE";
    const first = counts(a);
    const postCounts = counts(b);
    const metricChanged =
      removed.length > 0 || added.length > 0 || (Object.keys(first) as Array<keyof CaseCounts>).some((k) => first[k] !== postCounts[k]);
    const metricEffect: PostHumanCaseRow["metricEffect"] = metricChanged ? "METRIC_EFFECT" : "HUMAN_DECIDED_BUT_NO_METRIC_EFFECT";
    return { caseId: d.caseId, decision: d.decision, first, post: postCounts, removed, added, labelEffect, metricEffect, declinedEmissionsLeftUnlabeled };
  });
  return {
    currentLinterOnFrozen,
    postHuman,
    postHumanBeforeFinalForbidden,
    delta: {
      caseCounts: diffNumbers(postHuman.caseCounts, currentLinterOnFrozen.caseCounts),
      totals: diffNumbers(postHuman.totals, currentLinterOnFrozen.totals),
      setLevel: diffNumbers(postHuman.setLevel, currentLinterOnFrozen.setLevel),
    },
    reviewedCases,
    trueRemainingAmbiguity: overlay.decisions.filter((d) => d.trueAmbiguity === true).length,
  };
}

/** Deterministic Markdown rendering of the SECOND generated block of docs/ASSESSMENT_HELDOUT_V0_2.md. */
export function formatPostHumanMarkdown(c: PostHumanComparison): string {
  const a = c.currentLinterOnFrozen;
  const b = c.postHuman;
  const m = c.postHumanBeforeFinalForbidden;
  const d = c.delta;
  const sgn = (n: number): string => (n > 0 ? `+${n}` : String(n));
  const lines: string[] = [];
  lines.push("<!-- GENERATED:BEGIN formatPostHumanMarkdown (src/domain/assessment/golden/heldout-eval.ts) -->");
  lines.push("## POST-HUMAN-ADJUDICATION / POST-EVALUATION metrics (generated)");
  lines.push("");
  lines.push(
    "These are HUMAN-ADJUDICATED / POST-EVALUATION metrics (9 labels reviewed by Dor on 2026-10-09 and applied as an overlay on the frozen labels), not FIRST-BLIND metrics, and they are not pooled with v0.1. The CURRENT_LINTER_ON_FROZEN_V0_2 column is the frozen labels evaluated with the current linter (regression evidence); the historical FIRST_BLIND result (Run 004, before OPTION_COMBINATION_REFERENCE existed) is recorded in the document header and is not recomputed here. Only the 9 reviewed rows are HUMAN_APPROVED; the other 69 remain MODEL_LABELED_NOT_HUMAN_APPROVED.",
  );
  lines.push("");
  lines.push("| Measure | CURRENT_LINTER_ON_FROZEN_V0_2 | POST_HUMAN_BEFORE_FINAL_FORBIDDEN | POST_HUMAN_FINAL | DELTA (FINAL - CURRENT_LINTER_ON_FROZEN_V0_2) |");
  lines.push("|---|---|---|---|---|");
  const row = (name: string, x: number, y: number, dd: number, mid: number): void => {
    lines.push(`| ${name} | ${x} | ${mid} | ${y} | ${sgn(dd)} |`);
  };
  row("CLEAN cases", a.caseCounts.clean, b.caseCounts.clean, d.caseCounts.clean, m.caseCounts.clean);
  row("FLAWED cases", a.caseCounts.flawed, b.caseCounts.flawed, d.caseCounts.flawed, m.caseCounts.flawed);
  row("SEMANTIC-ONLY cases", a.caseCounts.semanticOnly, b.caseCounts.semanticOnly, d.caseCounts.semanticOnly, m.caseCounts.semanticOnly);
  row("Expected deterministic detections", a.totals.expectedDetections, b.totals.expectedDetections, d.totals.expectedDetections, m.totals.expectedDetections);
  row("TP", a.totals.truePositive, b.totals.truePositive, d.totals.truePositive, m.totals.truePositive);
  row("FN (total)", a.totals.falseNegative, b.totals.falseNegative, d.totals.falseNegative, m.totals.falseNegative);
  row("FN HEURISTIC_GAP", a.totals.falseNegativeHeuristicGap, b.totals.falseNegativeHeuristicGap, d.totals.falseNegativeHeuristicGap, m.totals.falseNegativeHeuristicGap);
  row("FN NOT_IMPLEMENTED", a.totals.falseNegativeNotImplemented, b.totals.falseNegativeNotImplemented, d.totals.falseNegativeNotImplemented, m.totals.falseNegativeNotImplemented);
  row("FP", a.totals.falsePositive, b.totals.falsePositive, d.totals.falsePositive, m.totals.falsePositive);
  lines.push(
    `| CLEAN cases with a WARNING/ERROR | ${a.totals.cleanCasesWithWarningOrError} of ${a.totals.cleanCases} | ${m.totals.cleanCasesWithWarningOrError} of ${m.totals.cleanCases} | ${b.totals.cleanCasesWithWarningOrError} of ${b.totals.cleanCases} | ${sgn(d.totals.cleanCasesWithWarningOrError)} |`,
  );
  row("UNLABELED_EMISSION", a.totals.unlabeledEmissions, b.totals.unlabeledEmissions, d.totals.unlabeledEmissions, m.totals.unlabeledEmissions);
  type Lvl = { expected: number; tp: number; fn: number; fp: number };
  const lvl = (name: string, x: Lvl, y: Lvl, dd: Lvl, mid: Lvl): void => {
    lines.push(
      `| ${name} (expected / TP / FN / FP) | ${x.expected} / ${x.tp} / ${x.fn} / ${x.fp} | ${mid.expected} / ${mid.tp} / ${mid.fn} / ${mid.fp} | ${y.expected} / ${y.tp} / ${y.fn} / ${y.fp} | ${sgn(dd.expected)} / ${sgn(dd.tp)} / ${sgn(dd.fn)} / ${sgn(dd.fp)} |`,
    );
  };
  lvl("SET-scope codes", a.setLevel.setScope, b.setLevel.setScope, d.setLevel.setScope, m.setLevel.setScope);
  lvl("ITEM codes inside SET cases", a.setLevel.itemInSet, b.setLevel.itemInSet, d.setLevel.itemInSet, m.setLevel.itemInSet);
  lines.push("");
  lines.push("### The 9 reviewed cases (generated)");
  lines.push("");
  lines.push(
    "Counts are TP/FN/FP/UNLABELED per case. All 9 human decisions are definitive: TRUE_REMAINING_AMBIGUITY = " + String(c.trueRemainingAmbiguity) + ". Label effect: HUMAN_DECIDED_LABEL_CHANGE (the applied decision changed the label) or HUMAN_DECIDED_NO_LABEL_CHANGE. Metric effect: METRIC_EFFECT (a finding or a TP/FN/FP/UNL count differs from CURRENT_LINTER_ON_FROZEN_V0_2) or HUMAN_DECIDED_BUT_NO_METRIC_EFFECT. \"Declined emissions left UNLABELED by convention\" lists a linter emission whose expectation the human declined or removed without ruling it forbidden: the harness counts that as UNLABELED_EMISSION. This is a harness accounting convention (a declined expectation was not a forbid), not human uncertainty.",
  );
  lines.push("");
  lines.push("| Case | Decision | CURRENT_LINTER_ON_FROZEN_V0_2 TP/FN/FP/UNL | POST_HUMAN TP/FN/FP/UNL | Findings removed | Findings added | Label effect | Metric effect | Declined emissions left UNLABELED by convention |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  const cc = (x: CaseCounts): string => `${x.tp}/${x.fn}/${x.fp}/${x.unlabeled}`;
  for (const r of c.reviewedCases) {
    lines.push(
      `| ${r.caseId} | ${r.decision} | ${cc(r.first)} | ${cc(r.post)} | ${r.removed.join(", ") || "-"} | ${r.added.join(", ") || "-"} | ${r.labelEffect} | ${r.metricEffect} | ${r.declinedEmissionsLeftUnlabeled.map((x) => x.replace("|", " ")).join(", ") || "-"} |`,
    );
  }
  lines.push("<!-- GENERATED:END -->");
  return lines.join("\n");
}

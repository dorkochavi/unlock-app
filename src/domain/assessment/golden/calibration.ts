/**
 * Calibration harness for the unwired deterministic question linter
 * (Run 2026-10-08-ASSESSMENT-ENGINE-002, Slice B6; AE-034 / AE-046).
 *
 * Pure and deterministic: runs the Golden Dataset through lintQuestionItem / lintQuestionSet and compares
 * emitted codes with ground-truth labels. NO single opaque score: the report is a per-check table plus
 * plain-language counts. The dataset is a tiny fixture, so every ratio is INDICATIVE ONLY.
 *
 * Terms (plain language):
 *   expected detections  = ground-truth codes a case says must fire
 *   TP (caught)          = expected and emitted
 *   FN (missed)          = expected but not emitted (documented as KNOWN_MISS)
 *   FP (false alarm)     = emitted although forbidden, or any WARNING/ERROR on a CLEAN case
 *                          (documented as KNOWN_FALSE_POSITIVE)
 *   PRECISION-LIKE       = TP / (TP + FP)       RECALL-LIKE = TP / (TP + FN)
 *   UNSUPPORTED SEMANTIC = cases whose quality judgment (SEMANTIC_EXPECTATION) the linter cannot prove;
 *                          never asserted against the linter
 */
import { lintQuestionItem, lintQuestionSet, type QuestionLintIssue } from "../question-lint";
import type { GoldenCase, GoldenDataset, KnownMissKind } from "./golden-types";

/** Codes the linter implements (question-lint.ts header). Codes outside this list can only appear as NOT_IMPLEMENTED misses. */
export const IMPLEMENTED_ITEM_CODES: readonly string[] = [
  "INPUT_UNREADABLE", "STEM_EMPTY", "QUESTION_TYPE_UNSUPPORTED", "OPTIONS_TOO_MANY", "OPTIONS_TOO_FEW",
  "OPTION_EMPTY", "OPTION_ID_DUPLICATE", "OPTION_DUPLICATE_EXACT", "OPTION_DUPLICATE_NORMALIZED",
  "CORRECT_IDS_TOO_MANY", "CORRECT_COUNT_INVALID", "CORRECT_ID_UNKNOWN",
  "TEXT_TRUNCATED", "STEM_TOO_SHORT", "STEM_NEGATIVE_WORDING", "OPTION_ALL_OF_ABOVE", "OPTION_NONE_OF_ABOVE",
  "OPTION_ABSOLUTE_TERM", "KEY_LONGEST_OPTION", "OPTION_LENGTH_IMBALANCE", "KEY_STEM_LEXICAL_OVERLAP",
  "OPTION_OVERLAP_HIGH", "OPTION_WHITESPACE_ANOMALY", "EXPLANATION_MISSING",
];
export const IMPLEMENTED_SET_CODES: readonly string[] = [
  "SET_TOO_SMALL", "SET_ITEMS_TRUNCATED", "DUPLICATE_STEM_EXACT", "DUPLICATE_STEM_NORMALIZED",
  "NEAR_DUPLICATE_STEM", "SET_ANALYSIS_TRUNCATED", "KEY_POSITION_IMBALANCE", "KEY_POSITION_RUN",
  "SET_KEY_LENGTH_BIAS", "STEM_TEMPLATE_REPEATED",
];

export interface CheckCalibration {
  code: string;
  implemented: boolean;
  /** Cases that expect this code. */
  expectedDetections: number;
  truePositive: number;
  falseNegative: number;
  falsePositive: number;
  /** Cases labelled as a negative for this code (forbidden, or CLEAN case of matching scope). */
  negativeLabels: number;
  precisionLike: string;
  recallLike: string;
}

export interface KnownMissEntry {
  caseId: string;
  codes: string[];
  kind: KnownMissKind;
  reason: string;
}
export interface KnownFalsePositiveEntry {
  caseId: string;
  codes: string[];
  reason: string;
}

export interface CalibrationReport {
  datasetVersion: string;
  caveat: string;
  caseCounts: {
    total: number;
    item: number;
    set: number;
    clean: number;
    /** Intentionally unsupported semantic cases (SEMANTIC_EXPECTATION). */
    unsupportedSemantic: number;
    withKnownMiss: number;
    withKnownFalsePositive: number;
  };
  checks: CheckCalibration[];
  totals: {
    expectedDetections: number;
    truePositive: number;
    falseNegative: number;
    falseNegativeHeuristicGap: number;
    falseNegativeNotImplemented: number;
    falsePositive: number;
    cleanCases: number;
    cleanCasesWithWarningOrError: number;
  };
  knownMisses: KnownMissEntry[];
  knownFalsePositives: KnownFalsePositiveEntry[];
  unsupportedSemanticCases: Array<{ caseId: string; semanticExpectation: string }>;
  /** Labelling / registry problems; MUST be empty (every disagreement must be a documented KNOWN_*). */
  undocumentedFindings: string[];
  summary: string[];
}

const CAVEAT =
  "Tiny synthetic fixture: all ratios are INDICATIVE ONLY, not statistics. Thresholds remain product-design defaults.";

function emitted(c: GoldenCase): QuestionLintIssue[] {
  return c.scope === "ITEM" ? lintQuestionItem(c.input) : lintQuestionSet(c.set);
}

function ratio(num: number, den: number): string {
  return den === 0 ? "n/a" : `${num}/${den}`;
}

interface Tally {
  expected: number;
  tp: number;
  fn: number;
  fp: number;
  negatives: number;
}

export function runCalibration(dataset: GoldenDataset): CalibrationReport {
  const implementedItem = new Set(IMPLEMENTED_ITEM_CODES);
  const implementedSet = new Set(IMPLEMENTED_SET_CODES);
  const tallies = new Map<string, Tally>();
  const tally = (code: string): Tally => {
    let t = tallies.get(code);
    if (!t) {
      t = { expected: 0, tp: 0, fn: 0, fp: 0, negatives: 0 };
      tallies.set(code, t);
    }
    return t;
  };

  const knownMisses: KnownMissEntry[] = [];
  const knownFalsePositives: KnownFalsePositiveEntry[] = [];
  const unsupportedSemanticCases: Array<{ caseId: string; semanticExpectation: string }> = [];
  const undocumented: string[] = [];
  let cleanCases = 0;
  let cleanWithIssue = 0;
  let itemCases = 0;
  let setCases = 0;
  let withMiss = 0;
  let withFp = 0;
  let fnGap = 0;
  let fnNotImpl = 0;
  const seenIds = new Set<string>();

  for (const c of dataset.cases) {
    if (seenIds.has(c.id)) undocumented.push(`${c.id}: duplicate case id`);
    seenIds.add(c.id);
    if (c.scope === "ITEM") itemCases += 1;
    else setCases += 1;

    const e = c.expected;
    const fired = new Set(emitted(c).map((i) => i.code));
    const expectedSet = new Set(e.expectedCodes);
    const forbiddenSet = new Set(e.forbiddenCodes);
    const implementedForScope = c.scope === "ITEM" ? implementedItem : implementedSet;

    if (e.semanticExpectation !== undefined) {
      unsupportedSemanticCases.push({ caseId: c.id, semanticExpectation: e.semanticExpectation });
    }
    if (e.clean === true) {
      cleanCases += 1;
      if (fired.size > 0) cleanWithIssue += 1;
    }
    for (const code of expectedSet) if (forbiddenSet.has(code)) undocumented.push(`${c.id}: ${code} is both expected and forbidden`);

    // Expected detections.
    const missed: string[] = [];
    for (const code of expectedSet) {
      const t = tally(code);
      t.expected += 1;
      if (fired.has(code)) t.tp += 1;
      else {
        t.fn += 1;
        missed.push(code);
      }
    }

    // False positives: forbidden, or any code on a CLEAN case that is not expected.
    const falsePositives: string[] = [];
    const negativeCodes = new Set<string>(forbiddenSet);
    if (e.clean === true) {
      for (const code of implementedForScope) if (!expectedSet.has(code)) negativeCodes.add(code);
    }
    for (const code of negativeCodes) {
      const t = tally(code);
      t.negatives += 1;
      if (fired.has(code)) {
        t.fp += 1;
        falsePositives.push(code);
      }
    }
    if (e.clean === true) {
      for (const code of fired) {
        if (!negativeCodes.has(code) && !expectedSet.has(code)) {
          // An emitted code that the scope table does not know (should not happen); treat as FP.
          tally(code).fp += 1;
          falsePositives.push(code);
        }
      }
    }

    // Registry cross-checks: every disagreement must be documented, every documentation must be live.
    const km = e.knownMiss;
    if (km) {
      withMiss += 1;
      knownMisses.push({ caseId: c.id, codes: [...km.codes], kind: km.kind, reason: km.reason });
      for (const code of km.codes) {
        if (!expectedSet.has(code)) undocumented.push(`${c.id}: knownMiss ${code} is not in expectedCodes`);
        if (fired.has(code)) undocumented.push(`${c.id}: STALE knownMiss ${code} (linter now emits it)`);
      }
    }
    for (const code of missed) {
      if (!km || !km.codes.includes(code)) undocumented.push(`${c.id}: UNDOCUMENTED miss ${code}`);
      else if (km.kind === "NOT_IMPLEMENTED") fnNotImpl += 1;
      else fnGap += 1;
      if (km && km.kind === "NOT_IMPLEMENTED" && implementedForScope.has(code)) {
        undocumented.push(`${c.id}: ${code} marked NOT_IMPLEMENTED but is implemented`);
      }
      if (km && km.kind === "HEURISTIC_GAP" && !implementedForScope.has(code)) {
        undocumented.push(`${c.id}: ${code} marked HEURISTIC_GAP but is not implemented`);
      }
    }

    const kf = e.knownFalsePositive;
    if (kf) {
      withFp += 1;
      knownFalsePositives.push({ caseId: c.id, codes: [...kf.codes], reason: kf.reason });
      for (const code of kf.codes) {
        if (!negativeCodes.has(code)) undocumented.push(`${c.id}: knownFalsePositive ${code} is not forbidden or covered by CLEAN`);
        if (!fired.has(code)) undocumented.push(`${c.id}: STALE knownFalsePositive ${code} (linter no longer emits it)`);
      }
    }
    for (const code of falsePositives) {
      if (!kf || !kf.codes.includes(code)) undocumented.push(`${c.id}: UNDOCUMENTED false positive ${code}`);
    }
  }

  const checks: CheckCalibration[] = Array.from(tallies.keys())
    .sort()
    .map((code) => {
      const t = tally(code);
      return {
        code,
        implemented: implementedItem.has(code) || implementedSet.has(code),
        expectedDetections: t.expected,
        truePositive: t.tp,
        falseNegative: t.fn,
        falsePositive: t.fp,
        negativeLabels: t.negatives,
        precisionLike: ratio(t.tp, t.tp + t.fp),
        recallLike: ratio(t.tp, t.tp + t.fn),
      };
    });

  const sum = (f: (c: CheckCalibration) => number): number => checks.reduce((a, c) => a + f(c), 0);
  const totals = {
    expectedDetections: sum((c) => c.expectedDetections),
    truePositive: sum((c) => c.truePositive),
    falseNegative: sum((c) => c.falseNegative),
    falseNegativeHeuristicGap: fnGap,
    falseNegativeNotImplemented: fnNotImpl,
    falsePositive: sum((c) => c.falsePositive),
    cleanCases,
    cleanCasesWithWarningOrError: cleanWithIssue,
  };

  const summary = [
    `RECALL-LIKE (all labelled detections): ${ratio(totals.truePositive, totals.truePositive + totals.falseNegative)} caught.`,
    `FN count: ${totals.falseNegative} (${totals.falseNegativeHeuristicGap} HEURISTIC_GAP on implemented checks, ${totals.falseNegativeNotImplemented} NOT_IMPLEMENTED checks).`,
    `PRECISION-LIKE (labelled detections vs false alarms): ${ratio(totals.truePositive, totals.truePositive + totals.falsePositive)}.`,
    `FP count: ${totals.falsePositive} (all documented as KNOWN_FALSE_POSITIVE: ${undocumented.length === 0 ? "yes" : "NO, see undocumented findings"}).`,
    `CLEAN cases with a WARNING/ERROR: ${cleanWithIssue} of ${cleanCases}.`,
    `UNSUPPORTED SEMANTIC CASES: ${unsupportedSemanticCases.length} (intentionally not asserted against the linter).`,
    CAVEAT,
  ];

  return {
    datasetVersion: dataset.version,
    caveat: CAVEAT,
    caseCounts: {
      total: dataset.cases.length,
      item: itemCases,
      set: setCases,
      clean: cleanCases,
      unsupportedSemantic: unsupportedSemanticCases.length,
      withKnownMiss: withMiss,
      withKnownFalsePositive: withFp,
    },
    checks,
    totals,
    knownMisses,
    knownFalsePositives,
    unsupportedSemanticCases,
    undocumentedFindings: undocumented,
    summary,
  };
}

function cell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

/** Deterministic Markdown rendering of the generated sections of docs/ASSESSMENT_CALIBRATION_V0_1.md. */
export function formatCalibrationMarkdown(r: CalibrationReport): string {
  const lines: string[] = [];
  lines.push("<!-- GENERATED:BEGIN formatCalibrationMarkdown (src/domain/assessment/golden/calibration.ts) -->");
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
  lines.push(`| CLEAN cases (no WARNING/ERROR is correct) | ${r.caseCounts.clean} |`);
  lines.push(`| UNSUPPORTED SEMANTIC CASES | ${r.caseCounts.unsupportedSemantic} |`);
  lines.push(`| Cases with a KNOWN_MISS | ${r.caseCounts.withKnownMiss} |`);
  lines.push(`| Cases with a KNOWN_FALSE_POSITIVE | ${r.caseCounts.withKnownFalsePositive} |`);
  lines.push("");
  lines.push("## Per-check results (generated)");
  lines.push("");
  lines.push("TP = caught, FN = missed, FP = false alarm. NEG = cases labelled as a negative for the code (forbidden, or a CLEAN case of that scope): FP is only measured over those.");
  lines.push("");
  lines.push("| Check code | Implemented | Expected | TP | FN | FP | NEG | PRECISION-LIKE | RECALL-LIKE |");
  lines.push("|---|---|---|---|---|---|---|---|---|");
  for (const c of r.checks) {
    lines.push(
      `| ${c.code} | ${c.implemented ? "yes" : "NO"} | ${c.expectedDetections} | ${c.truePositive} | ${c.falseNegative} | ${c.falsePositive} | ${c.negativeLabels} | ${c.precisionLike} | ${c.recallLike} |`,
    );
  }
  lines.push("");
  lines.push("## KNOWN_MISS list (generated)");
  lines.push("");
  lines.push("| Case | Codes | Kind | Reason |");
  lines.push("|---|---|---|---|");
  for (const m of r.knownMisses) lines.push(`| ${m.caseId} | ${m.codes.join(", ")} | ${m.kind} | ${cell(m.reason)} |`);
  lines.push("");
  lines.push("## KNOWN_FALSE_POSITIVE list (generated)");
  lines.push("");
  lines.push("| Case | Codes | Reason |");
  lines.push("|---|---|---|");
  for (const f of r.knownFalsePositives) lines.push(`| ${f.caseId} | ${f.codes.join(", ")} | ${cell(f.reason)} |`);
  lines.push("");
  lines.push("## Intentionally unsupported semantic cases (generated)");
  lines.push("");
  lines.push("| Case | SEMANTIC_EXPECTATION |");
  lines.push("|---|---|");
  for (const s of r.unsupportedSemanticCases) lines.push(`| ${s.caseId} | ${cell(s.semanticExpectation)} |`);
  lines.push("<!-- GENERATED:END -->");
  return lines.join("\n");
}

/**
 * Pure deterministic question-quality linter PROTOTYPE
 * (docs/ASSESSMENT_ENGINE.md sections 9-11; Run 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001, Slice H).
 *
 * Status: NOT wired into import, publish, API or UI. No publish automation.
 * Pure functions: no IO, no network, no AI, no Date/random. Independent of the
 * learning engine / scheduler. Never throws: garbage input yields issues.
 *
 * Issues are content-blind: codes, ids, positions and numeric metrics only,
 * never authored text.
 *
 * All thresholds below are PRODUCT-DESIGN DEFAULTS, NOT research-backed. They are
 * named constants to be tuned against a Golden Dataset and instructor feedback.
 *
 * Implemented ITEM ERRORS: STEM_EMPTY, OPTIONS_TOO_FEW, OPTION_EMPTY, OPTION_ID_DUPLICATE,
 *   OPTION_DUPLICATE_EXACT, OPTION_DUPLICATE_NORMALIZED, CORRECT_COUNT_INVALID, CORRECT_ID_UNKNOWN.
 * Implemented ITEM WARNINGS: STEM_TOO_SHORT, STEM_NEGATIVE_WORDING, OPTION_ALL_OF_ABOVE,
 *   OPTION_NONE_OF_ABOVE, OPTION_ABSOLUTE_TERM, KEY_LONGEST_OPTION, OPTION_LENGTH_IMBALANCE,
 *   KEY_STEM_LEXICAL_OVERLAP, OPTION_OVERLAP_HIGH, OPTION_WHITESPACE_ANOMALY, EXPLANATION_MISSING.
 * Implemented SET WARNINGS: SET_TOO_SMALL, DUPLICATE_STEM_EXACT, DUPLICATE_STEM_NORMALIZED,
 *   NEAR_DUPLICATE_STEM, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN, SET_KEY_LENGTH_BIAS,
 *   STEM_TEMPLATE_REPEATED.
 * NOT implemented (documented in section 10.3/11.1): STEM_NO_QUESTION_FORM, STEM_DOUBLE_NEGATIVE,
 *   OPTION_COMBINATION_REFERENCE, OPTION_STYLE_OUTLIER, OPTION_PREFIX_STEM_REPEAT, ARTICLE_MISMATCH,
 *   OPTION_NUMERIC_UNORDERED, OPTION_COUNT_UNUSUAL, OPTION_PUNCTUATION_INCONSISTENT,
 *   EXPLANATION_NAMES_ONLY_KEY, NEAR_DUPLICATE_ITEM, SET_OPTION_COUNT_MIXED, ALL_OR_NONE_OVERUSE,
 *   QUESTION_TYPE_MONO, and every META check (PROVENANCE_*, TOPIC_*, OBJECTIVE_*, COGNITIVE_*,
 *   DIFFICULTY_*, RECALL_EXCESS, *_COVERAGE_*, TOPIC_CONCENTRATION, CONCEPT_*): they need
 *   provenance/topic/objective/difficulty metadata that does not exist today.
 */

import {
  collapseWhitespace,
  comparisonKey,
  containsTerm,
  duplicateKey,
  jaccard,
  measureLength,
  similarityTokenSet,
  stripHebrewPrefixes,
  tokenize,
} from "./text-normalize";

export type LintSeverity = "ERROR" | "WARNING";
export type LintScope = "ITEM" | "SET";

export interface QuestionLintIssue {
  code: string;
  severity: LintSeverity;
  scope: LintScope;
  /** Set when produced via lintQuestionBatch for an item-scope issue. */
  itemIndex?: number;
  /** Set-scope issues: affected item indexes (ascending). */
  itemIndexes?: number[];
  /** Affected option ids in option order. */
  optionIds?: string[];
  /** Numbers only; never authored text. */
  metrics?: Record<string, number>;
}

/** Structural input; CanonicalQuestionRow is accepted (extra fields ignored). */
export interface QuestionLintInput {
  questionType: string;
  prompt: string;
  answerOptions: ReadonlyArray<{ id: string; content: string }>;
  correctOptionIds: ReadonlyArray<string>;
  explanation?: string | null;
}

// ---- Thresholds (product defaults, NOT research-backed) ----
export const MIN_OPTION_COUNT = 2;
export const STEM_MIN_WORDS = 4;
export const KEY_LONGEST_RATIO = 1.2;
export const KEY_LONGEST_MIN_CHAR_DIFF = 15;
export const LENGTH_IMBALANCE_RATIO = 3.0;
export const LENGTH_IMBALANCE_MIN_CHAR_DIFF = 20;
export const KEY_STEM_OVERLAP_MIN_TOKENS = 2;
export const KEY_STEM_OVERLAP_MIN_TOKEN_LENGTH = 3;
export const OPTION_OVERLAP_JACCARD = 0.85;
export const MIN_SET_SIZE = 8;
export const NEAR_DUPLICATE_STEM_JACCARD = 0.8;
export const KEY_POSITION_SHARE_FACTOR = 1.5;
export const KEY_POSITION_RUN_LENGTH = 4;
export const SET_KEY_LENGTH_BIAS_SHARE = 0.5;
export const STEM_TEMPLATE_TOKEN_COUNT = 3;
export const STEM_TEMPLATE_SHARE = 0.4;

// ---- Seed term lists (to be curated; comparison-normalized at module init) ----
const norm = (terms: readonly string[]): string[] => terms.map((t) => comparisonKey(t));

const NEGATION_TERMS = norm(["not", "except", "never", "least", "לא", "אינו", "אינה", "מלבד", "חוץ"]);
const ABSOLUTE_TERMS = norm([
  "always", "never", "only", "all", "none", "completely", "entirely", "every",
  "תמיד", "אף פעם", "רק", "לעולם", "כל", "בלבד", "בהכרח", "אף אחד", "שום",
]);
const ALL_OF_ABOVE_PHRASES = norm([
  "all of the above", "all of these", "all the above", "all of the answers",
  "כל התשובות", "כולן נכונות", "כל האמור לעיל", 'כל הנ"ל',
]);
const NONE_OF_ABOVE_PHRASES = norm([
  "none of the above", "none of these", "none of the answers",
  "אף אחת מהתשובות", "אף תשובה", "אף אחד מהאמור", "אף אחת מהן", "אין תשובה נכונה", "אין אף תשובה",
]);
const STOP_WORDS = new Set(
  norm([
    "the", "and", "for", "with", "that", "this", "from", "are", "was", "what", "which", "who", "how",
    "את", "של", "על", "עם", "הוא", "היא", "אלה", "הבא", "מהי", "מהו", "איזה", "איזו",
  ]).map(stripHebrewPrefixes),
);

// ---- Safe view of arbitrary input ----
interface SafeOption {
  id: string;
  content: string;
}
interface SafeItem {
  questionType: string;
  prompt: string;
  options: SafeOption[];
  correct: string[];
  explanation: string | null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function sanitize(raw: unknown): SafeItem {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const opts: SafeOption[] = [];
  if (Array.isArray(o.answerOptions)) {
    for (const x of o.answerOptions) {
      const e = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
      opts.push({ id: str(e.id), content: str(e.content) });
    }
  }
  const correct = Array.isArray(o.correctOptionIds) ? o.correctOptionIds.map(str) : [];
  return {
    questionType: str(o.questionType),
    prompt: str(o.prompt),
    options: opts,
    correct,
    explanation: typeof o.explanation === "string" ? o.explanation : null,
  };
}

function issue(
  code: string,
  severity: LintSeverity,
  scope: LintScope,
  extra: Partial<QuestionLintIssue> = {},
): QuestionLintIssue {
  return { code, severity, scope, ...extra };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Resolved single key (SINGLE_CHOICE, exactly one distinct correct id matching an option). */
function singleKeyIndex(item: SafeItem): number {
  if (item.questionType !== "SINGLE_CHOICE") return -1;
  const distinct = Array.from(new Set(item.correct));
  if (distinct.length !== 1) return -1;
  const matches: number[] = [];
  item.options.forEach((opt, i) => {
    if (opt.id === distinct[0]) matches.push(i);
  });
  return matches.length === 1 ? matches[0] : -1;
}

function contentTokenKeys(text: string): Set<string> {
  const out = new Set<string>();
  for (const t of tokenize(text)) {
    const k = stripHebrewPrefixes(t);
    if (Array.from(k).length >= KEY_STEM_OVERLAP_MIN_TOKEN_LENGTH && !STOP_WORDS.has(k)) out.add(k);
  }
  return out;
}

/** Groups indexes by key, returning groups of size >= 2 in first-occurrence order. */
function groupDuplicates(keys: ReadonlyArray<string | null>): number[][] {
  const map = new Map<string, number[]>();
  keys.forEach((k, i) => {
    if (k === null) return;
    const arr = map.get(k);
    if (arr) arr.push(i);
    else map.set(k, [i]);
  });
  return Array.from(map.values()).filter((g) => g.length > 1);
}

/** Lint a single item. Returns issues in a fixed order: ERRORs then WARNINGs, each in table order. */
export function lintQuestionItem(input: unknown): QuestionLintIssue[] {
  const item = sanitize(input);
  const out: QuestionLintIssue[] = [];
  const ids = item.options.map((o) => o.id);
  const trimmed = item.options.map((o) => o.content.trim());
  const nonEmpty = (i: number): boolean => trimmed[i].length > 0;

  // ---- ERRORS ----
  if (item.prompt.trim().length === 0) out.push(issue("STEM_EMPTY", "ERROR", "ITEM"));

  if (item.options.length < MIN_OPTION_COUNT) {
    out.push(issue("OPTIONS_TOO_FEW", "ERROR", "ITEM", { metrics: { optionCount: item.options.length, minimum: MIN_OPTION_COUNT } }));
  }

  const emptyIds = ids.filter((_, i) => !nonEmpty(i));
  if (emptyIds.length > 0) out.push(issue("OPTION_EMPTY", "ERROR", "ITEM", { optionIds: emptyIds }));

  const dupIdIdx = groupDuplicates(ids).flat().sort((a, b) => a - b);
  if (dupIdIdx.length > 0) {
    out.push(issue("OPTION_ID_DUPLICATE", "ERROR", "ITEM", { optionIds: dupIdIdx.map((i) => ids[i]) }));
  }

  const exactGroups = groupDuplicates(trimmed.map((t, i) => (nonEmpty(i) ? t : null)));
  const exactIdx = exactGroups.flat().sort((a, b) => a - b);
  if (exactIdx.length > 0) {
    out.push(issue("OPTION_DUPLICATE_EXACT", "ERROR", "ITEM", { optionIds: exactIdx.map((i) => ids[i]), metrics: { groupCount: exactGroups.length } }));
  }

  // Normalized duplicates: equal duplicate-key but not identical after trim. Pairs already exact are excluded.
  const normGroups = groupDuplicates(trimmed.map((t, i) => (nonEmpty(i) ? duplicateKey(t) : null)))
    .map((g) => {
      const firstOfText = new Map<string, number>();
      for (const i of g) if (!firstOfText.has(trimmed[i])) firstOfText.set(trimmed[i], i);
      // keep only if the group spans >= 2 distinct trimmed texts
      return firstOfText.size > 1 ? g : [];
    })
    .filter((g) => g.length > 0);
  const normIdx = normGroups.flat().sort((a, b) => a - b);
  if (normIdx.length > 0) {
    out.push(issue("OPTION_DUPLICATE_NORMALIZED", "ERROR", "ITEM", { optionIds: normIdx.map((i) => ids[i]), metrics: { groupCount: normGroups.length } }));
  }

  const distinctCorrect = Array.from(new Set(item.correct));
  const count = distinctCorrect.length;
  if (
    (item.questionType === "SINGLE_CHOICE" && count !== 1) ||
    (item.questionType === "MULTIPLE_CHOICE" && count < 1)
  ) {
    out.push(issue("CORRECT_COUNT_INVALID", "ERROR", "ITEM", { metrics: { correctCount: count } }));
  }

  const unknown = distinctCorrect.filter((c) => !ids.includes(c));
  if (unknown.length > 0) out.push(issue("CORRECT_ID_UNKNOWN", "ERROR", "ITEM", { metrics: { unknownCount: unknown.length } }));

  // ---- WARNINGS ----
  const promptTokens = tokenize(item.prompt);
  const wordCount = collapseWhitespace(item.prompt).split(" ").filter((w) => w.length > 0).length;
  if (wordCount > 0 && wordCount < STEM_MIN_WORDS) {
    out.push(issue("STEM_TOO_SHORT", "WARNING", "ITEM", { metrics: { wordCount, minimum: STEM_MIN_WORDS } }));
  }

  const negations = NEGATION_TERMS.filter((t) => containsTerm(promptTokens, t)).length;
  if (negations > 0) out.push(issue("STEM_NEGATIVE_WORDING", "WARNING", "ITEM", { metrics: { negationTermCount: negations } }));

  const allIdx: number[] = [];
  const noneIdx: number[] = [];
  const absIdx: number[] = [];
  item.options.forEach((opt, i) => {
    if (!nonEmpty(i)) return;
    const key = duplicateKey(opt.content);
    const isAll = ALL_OF_ABOVE_PHRASES.some((p) => key.includes(p));
    const isNone = NONE_OF_ABOVE_PHRASES.some((p) => key.includes(p));
    if (isAll) allIdx.push(i);
    if (isNone) noneIdx.push(i);
    if (!isAll && !isNone) {
      const toks = tokenize(opt.content);
      if (ABSOLUTE_TERMS.some((t) => containsTerm(toks, t))) absIdx.push(i);
    }
  });
  if (allIdx.length > 0) out.push(issue("OPTION_ALL_OF_ABOVE", "WARNING", "ITEM", { optionIds: allIdx.map((i) => ids[i]) }));
  if (noneIdx.length > 0) out.push(issue("OPTION_NONE_OF_ABOVE", "WARNING", "ITEM", { optionIds: noneIdx.map((i) => ids[i]) }));
  if (absIdx.length > 0) out.push(issue("OPTION_ABSOLUTE_TERM", "WARNING", "ITEM", { optionIds: absIdx.map((i) => ids[i]) }));

  const lengths = item.options.map((o) => measureLength(o.content));

  const keyIdx = singleKeyIndex(item);
  if (keyIdx >= 0 && item.options.length >= 2) {
    const others = lengths.filter((_, i) => i !== keyIdx);
    const nextLongest = Math.max(...others);
    if (nextLongest > 0 && lengths[keyIdx] >= KEY_LONGEST_RATIO * nextLongest && lengths[keyIdx] - nextLongest >= KEY_LONGEST_MIN_CHAR_DIFF) {
      out.push(issue("KEY_LONGEST_OPTION", "WARNING", "ITEM", { optionIds: [ids[keyIdx]], metrics: { ratio: round3(lengths[keyIdx] / nextLongest) } }));
    }
  }

  const nonEmptyLens = lengths.filter((_, i) => nonEmpty(i));
  if (nonEmptyLens.length >= 2) {
    const max = Math.max(...nonEmptyLens);
    const min = Math.min(...nonEmptyLens);
    if (min > 0 && max / min >= LENGTH_IMBALANCE_RATIO && max - min >= LENGTH_IMBALANCE_MIN_CHAR_DIFF) {
      out.push(issue("OPTION_LENGTH_IMBALANCE", "WARNING", "ITEM", { metrics: { ratio: round3(max / min), charDifference: max - min } }));
    }
  }

  if (keyIdx >= 0 && item.options.length >= 2) {
    const stemKeys = contentTokenKeys(item.prompt);
    const overlaps = item.options.map((o) => {
      let n = 0;
      for (const k of contentTokenKeys(o.content)) if (stemKeys.has(k)) n += 1;
      return n;
    });
    const maxOther = Math.max(...overlaps.filter((_, i) => i !== keyIdx));
    if (overlaps[keyIdx] >= KEY_STEM_OVERLAP_MIN_TOKENS && overlaps[keyIdx] > maxOther) {
      out.push(issue("KEY_STEM_LEXICAL_OVERLAP", "WARNING", "ITEM", { optionIds: [ids[keyIdx]], metrics: { keyOverlap: overlaps[keyIdx], maxDistractorOverlap: maxOther } }));
    }
  }

  // Smallest reading: report each similar (not equal-key) pair; one issue listing all involved ids.
  const optSets = item.options.map((o) => similarityTokenSet(o.content));
  const dupKeys = item.options.map((o) => duplicateKey(o.content));
  const overlapIdx = new Set<number>();
  let pairCount = 0;
  let maxSim = 0;
  for (let i = 0; i < item.options.length; i += 1) {
    for (let j = i + 1; j < item.options.length; j += 1) {
      if (!nonEmpty(i) || !nonEmpty(j) || dupKeys[i] === dupKeys[j]) continue;
      const sim = jaccard(optSets[i], optSets[j]);
      if (sim >= OPTION_OVERLAP_JACCARD) {
        overlapIdx.add(i);
        overlapIdx.add(j);
        pairCount += 1;
        maxSim = Math.max(maxSim, sim);
      }
    }
  }
  if (overlapIdx.size > 0) {
    out.push(issue("OPTION_OVERLAP_HIGH", "WARNING", "ITEM", {
      optionIds: Array.from(overlapIdx).sort((a, b) => a - b).map((i) => ids[i]),
      metrics: { pairCount, maxSimilarity: round3(maxSim) },
    }));
  }

  const wsIdx: number[] = [];
  item.options.forEach((opt, i) => {
    if (opt.content.length > 0 && /^\s|\s$|\s{2,}|[\p{Cc}​-‏‪-‮⁦-⁩]/u.test(opt.content)) wsIdx.push(i);
  });
  if (wsIdx.length > 0) out.push(issue("OPTION_WHITESPACE_ANOMALY", "WARNING", "ITEM", { optionIds: wsIdx.map((i) => ids[i]) }));

  if (item.explanation === null || item.explanation.trim().length === 0) {
    out.push(issue("EXPLANATION_MISSING", "WARNING", "ITEM"));
  }

  return out;
}

/** Lint a set (SET-scope issues only, deterministic order). Pass item-level results via lintQuestionBatch. */
export function lintQuestionSet(inputs: unknown): QuestionLintIssue[] {
  const items = (Array.isArray(inputs) ? inputs : []).map(sanitize);
  const n = items.length;
  const out: QuestionLintIssue[] = [];
  const small = n < MIN_SET_SIZE;

  if (small) out.push(issue("SET_TOO_SMALL", "WARNING", "SET", { metrics: { itemCount: n, minimum: MIN_SET_SIZE } }));

  // Stem duplicates.
  const trimmedPrompts = items.map((it) => it.prompt.trim());
  const exactGroups = groupDuplicates(trimmedPrompts.map((p) => (p.length > 0 ? p : null)));
  for (const g of exactGroups) out.push(issue("DUPLICATE_STEM_EXACT", "WARNING", "SET", { itemIndexes: g, metrics: { itemCount: g.length } }));

  const dupKeys = trimmedPrompts.map((p) => (p.length > 0 ? duplicateKey(p) : null));
  for (const g of groupDuplicates(dupKeys)) {
    if (new Set(g.map((i) => trimmedPrompts[i])).size > 1) {
      out.push(issue("DUPLICATE_STEM_NORMALIZED", "WARNING", "SET", { itemIndexes: g, metrics: { itemCount: g.length } }));
    }
  }

  const stemSets = items.map((it) => similarityTokenSet(it.prompt));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (dupKeys[i] === null || dupKeys[j] === null || dupKeys[i] === dupKeys[j]) continue;
      const sim = jaccard(stemSets[i], stemSets[j]);
      if (sim >= NEAR_DUPLICATE_STEM_JACCARD) {
        out.push(issue("NEAR_DUPLICATE_STEM", "WARNING", "SET", { itemIndexes: [i, j], metrics: { similarity: round3(sim) } }));
      }
    }
  }

  if (small) return out;

  // Key position imbalance: SINGLE_CHOICE items with a resolved key, grouped by option count k.
  const keyed: Array<{ index: number; position: number; k: number }> = [];
  items.forEach((it, index) => {
    const ki = singleKeyIndex(it);
    if (ki >= 0) keyed.push({ index, position: ki, k: it.options.length });
  });
  const byK = new Map<number, typeof keyed>();
  for (const e of keyed) {
    const arr = byK.get(e.k);
    if (arr) arr.push(e);
    else byK.set(e.k, [e]);
  }
  for (const k of Array.from(byK.keys()).sort((a, b) => a - b)) {
    const group = byK.get(k) ?? [];
    if (group.length < MIN_SET_SIZE) continue;
    for (let pos = 0; pos < k; pos += 1) {
      const at = group.filter((e) => e.position === pos);
      if (at.length / group.length > KEY_POSITION_SHARE_FACTOR / k) {
        out.push(issue("KEY_POSITION_IMBALANCE", "WARNING", "SET", {
          itemIndexes: at.map((e) => e.index),
          metrics: { position: pos + 1, optionCount: k, count: at.length, total: group.length },
        }));
      }
    }
  }

  // Key position run over the item sequence; an item without a resolved key breaks the run.
  let runStart = 0;
  const positionAt = (i: number): number => (i < n ? singleKeyIndex(items[i]) : -2);
  for (let i = 1; i <= n; i += 1) {
    const prev = positionAt(runStart);
    if (i === n || prev < 0 || positionAt(i) !== prev) {
      const len = i - runStart;
      if (prev >= 0 && len >= KEY_POSITION_RUN_LENGTH) {
        out.push(issue("KEY_POSITION_RUN", "WARNING", "SET", {
          itemIndexes: Array.from({ length: len }, (_, d) => runStart + d),
          metrics: { position: prev + 1, runLength: len },
        }));
      }
      runStart = i;
    }
  }

  // Set-level longest-key bias (strictly longest key among SINGLE_CHOICE items with resolved key and >= 2 options).
  const longest: number[] = [];
  let eligible = 0;
  items.forEach((it, index) => {
    const ki = singleKeyIndex(it);
    if (ki < 0 || it.options.length < 2) return;
    eligible += 1;
    const lens = it.options.map((o) => measureLength(o.content));
    if (lens.every((l, i) => i === ki || lens[ki] > l)) longest.push(index);
  });
  if (eligible > 0 && longest.length / eligible >= SET_KEY_LENGTH_BIAS_SHARE) {
    out.push(issue("SET_KEY_LENGTH_BIAS", "WARNING", "SET", { itemIndexes: longest, metrics: { count: longest.length, eligible } }));
  }

  // Repeated stem template: share of prompts with the same first N tokens.
  const templates = new Map<string, number[]>();
  items.forEach((it, index) => {
    const toks = tokenize(it.prompt);
    if (toks.length < STEM_TEMPLATE_TOKEN_COUNT) return;
    const key = toks.slice(0, STEM_TEMPLATE_TOKEN_COUNT).join(" ");
    const arr = templates.get(key);
    if (arr) arr.push(index);
    else templates.set(key, [index]);
  });
  const templateGroups = Array.from(templates.values())
    .filter((g) => g.length / n >= STEM_TEMPLATE_SHARE)
    .sort((a, b) => a[0] - b[0]);
  for (const g of templateGroups) {
    out.push(issue("STEM_TEMPLATE_REPEATED", "WARNING", "SET", { itemIndexes: g, metrics: { count: g.length, total: n } }));
  }

  return out;
}

/** Convenience: item issues (tagged with itemIndex, in item order) followed by set issues. */
export function lintQuestionBatch(inputs: unknown): QuestionLintIssue[] {
  const list = Array.isArray(inputs) ? inputs : [];
  const out: QuestionLintIssue[] = [];
  list.forEach((it, itemIndex) => {
    for (const i of lintQuestionItem(it)) out.push({ ...i, itemIndex });
  });
  return out.concat(lintQuestionSet(list));
}

export interface LintSummary {
  errorCount: number;
  warningCount: number;
  totalCount: number;
  /** True when any hard-failure (ERROR) issue exists. */
  hasErrors: boolean;
  /** Counts per code, keys sorted alphabetically. */
  byCode: Record<string, number>;
}

export function summarizeLintIssues(issues: ReadonlyArray<QuestionLintIssue>): LintSummary {
  let errorCount = 0;
  let warningCount = 0;
  const counts = new Map<string, number>();
  for (const i of issues) {
    if (i.severity === "ERROR") errorCount += 1;
    else warningCount += 1;
    counts.set(i.code, (counts.get(i.code) ?? 0) + 1);
  }
  const byCode: Record<string, number> = {};
  for (const code of Array.from(counts.keys()).sort()) byCode[code] = counts.get(code) ?? 0;
  return { errorCount, warningCount, totalCount: issues.length, hasErrors: errorCount > 0, byCode };
}

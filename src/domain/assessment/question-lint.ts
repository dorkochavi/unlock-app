/**
 * Pure deterministic question-quality linter PROTOTYPE
 * (docs/ASSESSMENT_ENGINE.md sections 9-11; Run 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001, Slice H).
 *
 * Status: NOT wired into import, publish, API or UI. No publish automation.
 * Pure functions: no IO, no network, no AI, no Date/random. Independent of the
 * learning engine / scheduler. Never throws: garbage input yields issues.
 * Hardened in Run 2026-10-08-ASSESSMENT-ENGINE-002, Slice B4.
 *
 * CONTRACT (decision B4): this is a SECONDARY QUALITY LINTER, not the structural validator.
 *   - Precondition: canonical structural/publish validation (the import validator and the
 *     publish-readiness validator) owns structural and publish validity and runs first.
 *     The linter is never the authority on whether a question may be imported or published.
 *   - Defensive totality: the linter NEVER relies on that precondition for its own safety. It
 *     never throws, does bounded work and is ReDoS-safe on arbitrary (hostile, nullish,
 *     non-string, huge) input.
 *   - Structural defects it happens to see are reported through its ERROR codes as DEFENSIVE
 *     STRUCTURAL DIAGNOSTICS, NOT AUTHORITATIVE VALIDATION. A clean lint result never implies
 *     structural validity, and an ERROR here never replaces the canonical validator's verdict.
 *   - Supported questionType values mirror the canonical set (QUESTION_TYPES in
 *     src/domain/learning/answer.ts: SINGLE_CHOICE, MULTIPLE_CHOICE). Any other value (missing,
 *     wrong case, non-string) raises QUESTION_TYPE_UNSUPPORTED; type-independent checks still run,
 *     type-dependent checks (correct-count rule, key-based checks) are skipped.
 *   - NO SILENT TRUNCATION: every cap that cuts input or analysis yields an explicit, content-blind
 *     issue (OPTIONS_TOO_MANY, CORRECT_IDS_TOO_MANY, TEXT_TRUNCATED, SET_ITEMS_TRUNCATED,
 *     SET_ANALYSIS_TRUNCATED), so incomplete diagnosis is always visible.
 *
 * BOUNDS (n = items read <= MAX_LINT_BATCH_ITEMS, k = options <= MAX_LINT_OPTIONS,
 *   T = chars per text <= MAX_LINT_TEXT_CHARS): sanitize O(k*T) per item; lintQuestionItem
 *   O(k^2*T) worst (pairwise option overlap), O(k*T) typical; near-duplicate stems at most
 *   MAX_NEAR_DUP_COMPARISONS pair comparisons, each O(T); remaining set checks O(n*k*T).
 *
 * Issues are content-blind: codes, ids, positions and numeric metrics only,
 * never authored text.
 *
 * All thresholds below are PRODUCT-DESIGN DEFAULTS, NOT research-backed. They are
 * named constants to be tuned against a Golden Dataset and instructor feedback.
 *
 * Implemented ITEM ERRORS (defensive structural diagnostics): INPUT_UNREADABLE, STEM_EMPTY,
 *   QUESTION_TYPE_UNSUPPORTED, OPTIONS_TOO_MANY, OPTIONS_TOO_FEW, OPTION_EMPTY, OPTION_ID_DUPLICATE,
 *   OPTION_DUPLICATE_EXACT, OPTION_DUPLICATE_NORMALIZED, CORRECT_IDS_TOO_MANY, CORRECT_COUNT_INVALID,
 *   CORRECT_ID_UNKNOWN.
 * Implemented ITEM WARNINGS: TEXT_TRUNCATED, STEM_TOO_SHORT, STEM_NEGATIVE_WORDING, OPTION_ALL_OF_ABOVE,
 *   OPTION_NONE_OF_ABOVE, OPTION_COMBINATION_REFERENCE, OPTION_ABSOLUTE_TERM, KEY_LONGEST_OPTION, OPTION_LENGTH_IMBALANCE,
 *   OPTION_OVERLAP_HIGH, OPTION_WHITESPACE_ANOMALY, EXPLANATION_MISSING.
 * Implemented SET WARNINGS: SET_TOO_SMALL, SET_ITEMS_TRUNCATED, DUPLICATE_STEM_EXACT,
 *   DUPLICATE_STEM_NORMALIZED, NEAR_DUPLICATE_STEM, SET_ANALYSIS_TRUNCATED, KEY_POSITION_IMBALANCE,
 *   KEY_POSITION_RUN, SET_KEY_LENGTH_BIAS, STEM_TEMPLATE_REPEATED.
 * No longer emitted (FUB-066): KEY_STEM_LEXICAL_OVERLAP (code retained for history/consumers).
 * NOT implemented (documented in section 10.3/11.1): STEM_NO_QUESTION_FORM, STEM_DOUBLE_NEGATIVE,
 *   OPTION_STYLE_OUTLIER, OPTION_PREFIX_STEM_REPEAT, ARTICLE_MISMATCH,
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
  isBlank,
  jaccard,
  measureLength,
  similarityTokenSet,
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
  /**
   * Affected option ids in option order. An id is echoed only if it matches /^[A-Za-z0-9]{1,8}$/;
   * otherwise the positional marker "#<position>" is substituted (content-blind).
   */
  optionIds?: string[];
  /** 0-based positions of the affected options, parallel to optionIds. */
  optionPositions?: number[];
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
export const OPTION_OVERLAP_JACCARD = 0.85;
export const MIN_SET_SIZE = 8;
export const NEAR_DUPLICATE_STEM_JACCARD = 0.8;
export const KEY_POSITION_SHARE_FACTOR = 1.5;
export const KEY_POSITION_RUN_LENGTH = 4;
export const SET_KEY_LENGTH_BIAS_SHARE = 0.5;
export const STEM_TEMPLATE_TOKEN_COUNT = 3;
export const STEM_TEMPLATE_SHARE = 0.4;
/** Above this option count only the cheap structural checks run (OPTIONS_TOO_MANY). */
export const MAX_LINT_OPTIONS = 50;
/** SET_KEY_LENGTH_BIAS needs at least this many eligible items (else it is statistically meaningless). */
export const SET_KEY_LENGTH_BIAS_MIN_ELIGIBLE = MIN_SET_SIZE;
/** More correctOptionIds than this raises CORRECT_IDS_TOO_MANY (never silently truncated). */
export const MAX_LINT_CORRECT_IDS = MAX_LINT_OPTIONS;
/** Per-text cap (prompt, option content); longer text is analysed on its prefix and raises TEXT_TRUNCATED. */
export const MAX_LINT_TEXT_CHARS = 5000;
/** Per-id cap (option ids, correct ids); longer ids are cut and counted in TEXT_TRUNCATED. */
export const MAX_LINT_ID_CHARS = 256;
/** At most this many items are read by lintQuestionSet / lintQuestionBatch; more raises SET_ITEMS_TRUNCATED. */
export const MAX_LINT_BATCH_ITEMS = 2000;
/** At most this many stem pairs are compared for NEAR_DUPLICATE_STEM; more raises SET_ANALYSIS_TRUNCATED. */
export const MAX_NEAR_DUP_COMPARISONS = 20000;
/** Canonical question types (mirrors QUESTION_TYPES in src/domain/learning/answer.ts; not imported on purpose). */
const SUPPORTED_QUESTION_TYPES: readonly string[] = ["SINGLE_CHOICE", "MULTIPLE_CHOICE"];
const SAFE_ID = /^[A-Za-z0-9]{1,8}$/;

// ---- Seed term lists (to be curated; comparison-normalized at module init) ----
const norm = (terms: readonly string[]): string[] => terms.map((t) => comparisonKey(t));
/** Phrases are stored as space-joined tokens so matching is whole-token (word-boundary) matching. */
const normPhrases = (phrases: readonly string[]): string[] => phrases.map((p) => tokenize(p).join(" "));

const NEGATION_TERMS_EN = norm(["not", "except", "never"]);
/** "least" is negative wording ("the LEAST likely") except in "at least" / "at the least". */
function hasNegativeLeast(tokens: readonly string[]): boolean {
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i] !== "least") continue;
    const p1 = i >= 1 ? tokens[i - 1] : "";
    const p2 = i >= 2 ? tokens[i - 2] : "";
    if (p1 === "at" || (p1 === "the" && p2 === "at")) continue;
    return true;
  }
  return false;
}
/**
 * Hebrew "חוץ" is a negation cue only as the exception preposition "חוץ מ…" (next token begins with מ, attached
 * or hyphenated); as a noun ("מדיניות חוץ", "משרד החוץ") or in "מחוץ"/"בחוץ" it is not. Optional וש prefixes allowed.
 */
const HUTZ = norm(["חוץ"])[0];
function hasHutzException(tokens: readonly string[]): boolean {
  const mem = comparisonKey("מ")[0];
  for (let i = 0; i + 1 < tokens.length; i += 1) {
    if (!containsTerm([tokens[i]], HUTZ, NEGATION_HE_PREFIX_LETTERS, NEGATION_HE_PREFIX_MAX)) continue;
    if (tokens[i + 1].startsWith(mem)) return true;
  }
  return false;
}
/**
 * Hebrew negation words match as WHOLE tokens only, optionally with a single conjunction/relativizer
 * prefix (ו, ש, וש). Other prefix letters are NOT accepted, so "מלא" (full), "הלא", "אלא", "מלאכה",
 * "מחוץ" never read as negation. Final letters are folded by norm().
 */
const NEGATION_TERMS_HE = norm(["לא", "אין", "אינו", "אינה", "אינם", "אינן", "בלתי", "בלא", "ללא", "מלבד"]);
const NEGATION_HE_PREFIX_LETTERS = "וש";
const NEGATION_HE_PREFIX_MAX = 2;
/**
 * OPTION_ABSOLUTE_TERM (FUB-066): STRONG frequency/totality adverbs only. The weak quantifier/exclusive tier
 * (כל, שום, רק, בלבד, all, only, every, none, אף אחד) is deliberately NOT here: it is content-essential or natural
 * far too often and is left to HUMAN_REVIEW / AI_OPTIONAL.
 */
const ABSOLUTE_TERMS = norm([
  "always", "never", "completely", "entirely",
  "תמיד", "אף פעם", "לעולם", "בהכרח",
]);
/**
 * STEM_TOO_SHORT exemption (FUB-066): a short stem whose FIRST word is a closed-class interrogative/imperative
 * (optionally with exactly one Hebrew prefix letter) or that ends with ":" (completion form) is not a bare fragment.
 */
const STEM_LEAD_WORDS = new Set(
  norm([
    "מה", "מהי", "מהו", "מי", "איזה", "איזו", "כמה", "מדוע", "למה", "היכן", "הגדר", "ציין",
    "what", "which", "who", "how", "where", "why", "when", "define", "name", "list",
  ]),
);
const HE_LEAD_WORDS = new Set(
  norm(["מה", "מהי", "מהו", "מי", "איזה", "איזו", "כמה", "מדוע", "למה", "היכן", "הגדר", "ציין"]),
);
const STEM_LEAD_PREFIXES = new Set(norm(["ו", "ש", "ה", "ב", "ל"]));
function isExemptShortStem(prompt: string): boolean {
  if (prompt.trimEnd().endsWith(":")) return true;
  const first = collapseWhitespace(prompt).split(" ").find((w) => w.length > 0) ?? "";
  const chars = Array.from(first);
  const isWordChar = (c: string): boolean => /[\p{L}\p{N}]/u.test(c);
  let start = 0;
  let end = chars.length;
  while (start < end && !isWordChar(chars[start])) start += 1;
  while (end > start && !isWordChar(chars[end - 1])) end -= 1;
  const word = comparisonKey(chars.slice(start, end).join(""));
  if (word.length === 0) return false;
  if (STEM_LEAD_WORDS.has(word)) return true;
  const rest = Array.from(word).slice(1).join("");
  return STEM_LEAD_PREFIXES.has(Array.from(word)[0] ?? "") && HE_LEAD_WORDS.has(rest);
}
const ALL_OF_ABOVE_PHRASES = normPhrases([
  "all of the above", "all of these", "all the above", "all of the answers",
  "כל התשובות", "כל התשובות נכונות", "כולן נכונות", "כולם נכונים", "כל האמור לעיל", 'כל הנ"ל',
]);
const NONE_OF_ABOVE_PHRASES = normPhrases([
  "none of the above", "none of these", "none of the answers",
  "אף אחת מהתשובות", "אף אחד מהתשובות", "אף תשובה", "אף אחד מהאמור", "אף אחת מהן", "אף אחד מהם",
  "אין תשובה נכונה", "אין אף תשובה",
]);
/**
 * OPTION_COMBINATION_REFERENCE (FUB-064): an option that is wholly a reference to a combination of OTHER options
 * ("Both a and c", "תשובות א ו-ג נכונות"). Shape: [filler] cue [filler] >= 2 distinct references [filler], nothing else.
 * Bare "and"/"or"/"ו" never trigger it; a letter without a cue, or with extra content words, is ordinary text.
 */
const COMBO_CUES = new Set(
  norm([
    "both", "option", "options", "answer", "answers", "choice", "choices",
    "תשובה", "תשובות", "אפשרות", "אפשרויות", "התשובות", "האפשרויות",
  ]),
);
const COMBO_JOINERS = new Set(norm(["and", "or", "או", "ו"]));
const COMBO_FILLER = new Set(
  norm(["the", "of", "are", "is", "only", "correct", "true", "right", "together", "נכונות", "נכונים", "נכונה", "נכון", "בלבד", "הן", "הם"]),
);
/** Ordinal positions of Hebrew letters used as option labels (vav is excluded as a reference: it is the conjunction). */
const HE_LABELS = "אבגדהוזח";
const HE_REF = /^ו?-?([אבגדהזח])$/;
const LATIN_REF = /^[a-z]$/;
const MAX_LATIN_ORDINAL = 8;

/** Index of the option a single reference token points to, or -1. Id match (case-insensitive) wins over ordinal letter. */
function resolveOptionRef(token: string, idIndex: ReadonlyMap<string, number>, optionCount: number): number {
  const he = HE_REF.exec(token);
  if (he) {
    const pos = HE_LABELS.indexOf(he[1]);
    return pos < optionCount ? pos : -1;
  }
  if (!LATIN_REF.test(token)) return -1;
  const byId = idIndex.get(token);
  if (byId !== undefined) return byId;
  const pos = token.charCodeAt(0) - 97;
  return pos < MAX_LATIN_ORDINAL && pos < optionCount ? pos : -1;
}

function isCombinationReference(tokens: readonly string[], self: number, idIndex: ReadonlyMap<string, number>, optionCount: number): boolean {
  const refs = new Set<number>();
  let cueBeforeRef = false;
  let sawCue = false;
  let runState: "before" | "in" | "after" = "before";
  for (const t of tokens) {
    const isCue = COMBO_CUES.has(t);
    const isRefShape = HE_REF.test(t) || LATIN_REF.test(t);
    if (isRefShape && (sawCue || runState === "in")) {
      if (runState === "after") return false;
      const target = resolveOptionRef(t, idIndex, optionCount);
      if (target < 0 || target === self) return false;
      if (runState === "before") cueBeforeRef = sawCue;
      runState = "in";
      refs.add(target);
      continue;
    }
    if (isCue) {
      sawCue = true;
      if (runState === "in") runState = "after";
      continue;
    }
    if (COMBO_JOINERS.has(t)) continue;
    if (COMBO_FILLER.has(t)) {
      if (runState === "in") runState = "after";
      continue;
    }
    return false;
  }
  return cueBeforeRef && refs.size >= 2;
}

// ---- Safe view of arbitrary input ----
interface SafeOption {
  id: string;
  content: string;
  /** Content was cut to MAX_LINT_TEXT_CHARS. */
  truncated: boolean;
}
interface SafeItem {
  unreadable: boolean;
  questionType: string;
  prompt: string;
  promptTruncated: boolean;
  /** At most MAX_LINT_OPTIONS + 1 options are copied; see optionCount for the true length. */
  options: SafeOption[];
  optionCount: number;
  /** First MAX_LINT_CORRECT_IDS correct ids; see correctCount for the true length. */
  correct: string[];
  correctCount: number;
  /** Number of option/correct ids cut to MAX_LINT_ID_CHARS. */
  idTruncatedCount: number;
  explanation: string | null;
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

function emptyItem(unreadable: boolean): SafeItem {
  return {
    unreadable, questionType: "", prompt: "", promptTruncated: false, options: [], optionCount: 0,
    correct: [], correctCount: 0, idTruncatedCount: 0, explanation: null,
  };
}

function capText(s: string): { v: string; cut: boolean } {
  return s.length > MAX_LINT_TEXT_CHARS ? { v: s.slice(0, MAX_LINT_TEXT_CHARS), cut: true } : { v: s, cut: false };
}

/** Total: never throws (throwing getters / Proxies yield an unreadable item). */
function sanitize(raw: unknown): SafeItem {
  try {
    const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
    const opts: SafeOption[] = [];
    let optionCount = 0;
    let idTruncatedCount = 0;
    const readId = (v: unknown): string => {
      const s = str(v);
      if (s.length > MAX_LINT_ID_CHARS) {
        idTruncatedCount += 1;
        return s.slice(0, MAX_LINT_ID_CHARS);
      }
      return s;
    };
    const ao = o.answerOptions;
    if (Array.isArray(ao)) {
      optionCount = ao.length;
      const take = Math.min(optionCount, MAX_LINT_OPTIONS + 1);
      for (let i = 0; i < take; i += 1) {
        const x: unknown = ao[i];
        const e = (typeof x === "object" && x !== null ? x : {}) as Record<string, unknown>;
        const c = capText(str(e.content));
        opts.push({ id: readId(e.id), content: c.v, truncated: c.cut });
      }
    }
    const correct: string[] = [];
    let correctCount = 0;
    const co = o.correctOptionIds;
    if (Array.isArray(co)) {
      correctCount = co.length;
      const take = Math.min(correctCount, MAX_LINT_CORRECT_IDS);
      for (let i = 0; i < take; i += 1) correct.push(readId(co[i]));
    }
    const expl = o.explanation;
    const p = capText(str(o.prompt));
    return {
      unreadable: false,
      questionType: str(o.questionType),
      prompt: p.v,
      promptTruncated: p.cut,
      options: opts,
      optionCount,
      correct,
      correctCount,
      idTruncatedCount,
      // Only emptiness is read, via a linear trim; never truncated.
      explanation: typeof expl === "string" ? expl : null,
    };
  } catch {
    return emptyItem(true);
  }
}

function issue(
  code: string,
  severity: LintSeverity,
  scope: LintScope,
  extra: Partial<QuestionLintIssue> = {},
): QuestionLintIssue {
  return { code, severity, scope, ...extra };
}

/** Content-blind option references: safe ids echoed, others replaced by "#<position>". */
function optRefs(idx: ReadonlyArray<number>, ids: ReadonlyArray<string>): { optionIds: string[]; optionPositions: number[] } {
  return {
    optionIds: idx.map((i) => (SAFE_ID.test(ids[i]) ? ids[i] : `#${i}`)),
    optionPositions: idx.slice(),
  };
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Resolved single key (SINGLE_CHOICE, exactly one distinct correct id matching an option). */
function singleKeyIndex(item: SafeItem): number {
  if (item.unreadable || item.optionCount > MAX_LINT_OPTIONS || item.correctCount > MAX_LINT_CORRECT_IDS) return -1;
  if (item.questionType !== "SINGLE_CHOICE") return -1;
  const distinct = Array.from(new Set(item.correct));
  if (distinct.length !== 1) return -1;
  const matches: number[] = [];
  item.options.forEach((opt, i) => {
    if (opt.id === distinct[0]) matches.push(i);
  });
  return matches.length === 1 ? matches[0] : -1;
}

/** A duplicate key that collapsed to nothing (punctuation-only text) must not group: null. */
function nonEmptyKey(k: string): string | null {
  return k.length > 0 ? k : null;
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
  if (item.unreadable) return [issue("INPUT_UNREADABLE", "ERROR", "ITEM")];

  // ---- ERRORS ----
  if (isBlank(item.prompt)) out.push(issue("STEM_EMPTY", "ERROR", "ITEM"));

  const typeSupported = SUPPORTED_QUESTION_TYPES.includes(item.questionType);
  if (!typeSupported) out.push(issue("QUESTION_TYPE_UNSUPPORTED", "ERROR", "ITEM"));

  if (item.optionCount > MAX_LINT_OPTIONS) {
    // Cap: skip all per-option and pairwise checks (bounded work for hostile input).
    out.push(issue("OPTIONS_TOO_MANY", "ERROR", "ITEM", { metrics: { optionCount: item.optionCount, maximum: MAX_LINT_OPTIONS } }));
    return out;
  }

  const ids = item.options.map((o) => o.id);
  const trimmed = item.options.map((o) => o.content.trim());
  const blank = item.options.map((o) => isBlank(o.content));
  const nonEmpty = (i: number): boolean => !blank[i];

  if (item.options.length < MIN_OPTION_COUNT) {
    out.push(issue("OPTIONS_TOO_FEW", "ERROR", "ITEM", { metrics: { optionCount: item.options.length, minimum: MIN_OPTION_COUNT } }));
  }

  const emptyIdx = ids.map((_, i) => i).filter((i) => !nonEmpty(i));
  if (emptyIdx.length > 0) out.push(issue("OPTION_EMPTY", "ERROR", "ITEM", optRefs(emptyIdx, ids)));

  const dupIdIdx = groupDuplicates(ids).flat().sort((a, b) => a - b);
  if (dupIdIdx.length > 0) {
    out.push(issue("OPTION_ID_DUPLICATE", "ERROR", "ITEM", optRefs(dupIdIdx, ids)));
  }

  const exactGroups = groupDuplicates(trimmed.map((t, i) => (nonEmpty(i) ? t : null)));
  const exactIdx = exactGroups.flat().sort((a, b) => a - b);
  if (exactIdx.length > 0) {
    out.push(issue("OPTION_DUPLICATE_EXACT", "ERROR", "ITEM", { ...optRefs(exactIdx, ids), metrics: { groupCount: exactGroups.length } }));
  }

  // Normalized duplicates: equal duplicate-key but not identical after trim. Pairs already exact are excluded.
  const normGroups = groupDuplicates(trimmed.map((t, i) => (nonEmpty(i) ? nonEmptyKey(duplicateKey(t)) : null)))
    .map((g) => {
      const firstOfText = new Map<string, number>();
      for (const i of g) if (!firstOfText.has(trimmed[i])) firstOfText.set(trimmed[i], i);
      // keep only if the group spans >= 2 distinct trimmed texts
      return firstOfText.size > 1 ? g : [];
    })
    .filter((g) => g.length > 0);
  const normIdx = normGroups.flat().sort((a, b) => a - b);
  if (normIdx.length > 0) {
    out.push(issue("OPTION_DUPLICATE_NORMALIZED", "ERROR", "ITEM", { ...optRefs(normIdx, ids), metrics: { groupCount: normGroups.length } }));
  }

  if (item.correctCount > MAX_LINT_CORRECT_IDS) {
    // Only a prefix was read: correct-count / unknown-id checks would be wrong, so they are skipped explicitly.
    out.push(issue("CORRECT_IDS_TOO_MANY", "ERROR", "ITEM", { metrics: { correctIdCount: item.correctCount, maximum: MAX_LINT_CORRECT_IDS } }));
  } else {
    const distinctCorrect = Array.from(new Set(item.correct));
    const count = distinctCorrect.length;
    if (
      (item.questionType === "SINGLE_CHOICE" && count !== 1) ||
      (item.questionType === "MULTIPLE_CHOICE" && (count < 1 || count >= item.options.length))
    ) {
      out.push(issue("CORRECT_COUNT_INVALID", "ERROR", "ITEM", { metrics: { correctCount: count } }));
    }

    const idSet = new Set(ids);
    const unknown = distinctCorrect.filter((c) => !idSet.has(c));
    if (unknown.length > 0) out.push(issue("CORRECT_ID_UNKNOWN", "ERROR", "ITEM", { metrics: { unknownCount: unknown.length } }));
  }

  // ---- WARNINGS ----
  const truncatedOptionIdx = item.options.map((o, i) => (o.truncated ? i : -1)).filter((i) => i >= 0);
  if (item.promptTruncated || truncatedOptionIdx.length > 0 || item.idTruncatedCount > 0) {
    out.push(issue("TEXT_TRUNCATED", "WARNING", "ITEM", {
      ...optRefs(truncatedOptionIdx, ids),
      metrics: {
        promptTruncated: item.promptTruncated ? 1 : 0,
        optionTruncatedCount: truncatedOptionIdx.length,
        idTruncatedCount: item.idTruncatedCount,
        maxTextChars: MAX_LINT_TEXT_CHARS,
        maxIdChars: MAX_LINT_ID_CHARS,
      },
    }));
  }
  const promptTokens = tokenize(item.prompt);
  const wordCount = collapseWhitespace(item.prompt).split(" ").filter((w) => w.length > 0).length;
  if (wordCount > 0 && wordCount < STEM_MIN_WORDS && !isExemptShortStem(item.prompt)) {
    out.push(issue("STEM_TOO_SHORT", "WARNING", "ITEM", { metrics: { wordCount, minimum: STEM_MIN_WORDS } }));
  }

  const negations =
    NEGATION_TERMS_EN.filter((t) => containsTerm(promptTokens, t, "", 0)).length +
    NEGATION_TERMS_HE.filter((t) => containsTerm(promptTokens, t, NEGATION_HE_PREFIX_LETTERS, NEGATION_HE_PREFIX_MAX)).length +
    (hasNegativeLeast(promptTokens) ? 1 : 0) +
    (hasHutzException(promptTokens) ? 1 : 0);
  if (negations > 0) out.push(issue("STEM_NEGATIVE_WORDING", "WARNING", "ITEM", { metrics: { negationTermCount: negations } }));

  const allIdx: number[] = [];
  const noneIdx: number[] = [];
  const strongIdx: number[] = [];
  item.options.forEach((opt, i) => {
    if (!nonEmpty(i)) return;
    const toks = tokenize(opt.content);
    // Whole-token phrase matching: "nonexistent ..." / "allocation" never match "none ..." / "all ...".
    const isAll = ALL_OF_ABOVE_PHRASES.some((p) => containsTerm(toks, p));
    const isNone = NONE_OF_ABOVE_PHRASES.some((p) => containsTerm(toks, p));
    if (isAll) allIdx.push(i);
    if (isNone) noneIdx.push(i);
    if (!isAll && !isNone && ABSOLUTE_TERMS.some((t) => containsTerm(toks, t))) strongIdx.push(i);
  });
  if (allIdx.length > 0) out.push(issue("OPTION_ALL_OF_ABOVE", "WARNING", "ITEM", optRefs(allIdx, ids)));
  if (noneIdx.length > 0) out.push(issue("OPTION_NONE_OF_ABOVE", "WARNING", "ITEM", optRefs(noneIdx, ids)));
  // OPTION_ABSOLUTE_TERM: strong term in a NON-correct option, only if no correct option has one and not every
  // non-blank option has one (symmetry). No resolvable correct option, or unsupported type: fail closed.
  if (typeSupported && item.correctCount <= MAX_LINT_CORRECT_IDS && strongIdx.length > 0) {
    const correctSet = new Set(item.correct);
    const correctIdx = ids.map((_, i) => i).filter((i) => correctSet.has(ids[i]));
    const strongSet = new Set(strongIdx);
    const nonBlankCount = ids.filter((_, i) => nonEmpty(i)).length;
    const flagged = strongIdx.filter((i) => !correctSet.has(ids[i]));
    if (
      correctIdx.length > 0 &&
      !correctIdx.some((i) => strongSet.has(i)) &&
      strongIdx.length < nonBlankCount &&
      flagged.length > 0
    ) {
      out.push(issue("OPTION_ABSOLUTE_TERM", "WARNING", "ITEM", optRefs(flagged, ids)));
    }
  }

  const idIndex = new Map<string, number>();
  ids.forEach((id, i) => {
    const key = id.toLowerCase();
    if (!idIndex.has(key)) idIndex.set(key, i);
  });
  const comboIdx: number[] = [];
  item.options.forEach((opt, i) => {
    if (nonEmpty(i) && isCombinationReference(tokenize(opt.content), i, idIndex, item.options.length)) comboIdx.push(i);
  });
  if (comboIdx.length > 0) out.push(issue("OPTION_COMBINATION_REFERENCE", "WARNING", "ITEM", optRefs(comboIdx, ids)));

  const lengths = item.options.map((o) => measureLength(o.content));

  const keyIdx = singleKeyIndex(item);
  if (keyIdx >= 0 && item.options.length >= 2) {
    let nextLongest = 0;
    for (let i = 0; i < lengths.length; i += 1) if (i !== keyIdx && lengths[i] > nextLongest) nextLongest = lengths[i];
    if (nextLongest > 0 && lengths[keyIdx] >= KEY_LONGEST_RATIO * nextLongest && lengths[keyIdx] - nextLongest >= KEY_LONGEST_MIN_CHAR_DIFF) {
      out.push(issue("KEY_LONGEST_OPTION", "WARNING", "ITEM", { ...optRefs([keyIdx], ids), metrics: { ratio: round3(lengths[keyIdx] / nextLongest) } }));
    }
  }

  const nonEmptyLens = lengths.filter((_, i) => nonEmpty(i));
  if (nonEmptyLens.length >= 2) {
    let max = -Infinity;
    let min = Infinity;
    for (const l of nonEmptyLens) {
      if (l > max) max = l;
      if (l < min) min = l;
    }
    if (min > 0 && max / min >= LENGTH_IMBALANCE_RATIO && max - min >= LENGTH_IMBALANCE_MIN_CHAR_DIFF) {
      out.push(issue("OPTION_LENGTH_IMBALANCE", "WARNING", "ITEM", { metrics: { ratio: round3(max / min), charDifference: max - min } }));
    }
  }

  // KEY_STEM_LEXICAL_OVERLAP is no longer emitted (FUB-066): lexical overlap != leakage; routed to AI_REQUIRED / HUMAN_REVIEW.

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
      ...optRefs(Array.from(overlapIdx).sort((a, b) => a - b), ids),
      metrics: { pairCount, maxSimilarity: round3(maxSim) },
    }));
  }

  const wsIdx: number[] = [];
  item.options.forEach((opt, i) => {
    if (opt.content.length > 0 && /^\s|\s$|\s{2,}|[\p{Cc}​-‏‪-‮⁦-⁩]/u.test(opt.content)) wsIdx.push(i);
  });
  if (wsIdx.length > 0) out.push(issue("OPTION_WHITESPACE_ANOMALY", "WARNING", "ITEM", optRefs(wsIdx, ids)));

  if (item.explanation === null || item.explanation.trim().length === 0) {
    out.push(issue("EXPLANATION_MISSING", "WARNING", "ITEM"));
  }

  return out;
}

const UNREADABLE_ELEMENT: unknown = new Proxy({}, { get() { throw new Error("unreadable"); } });

/**
 * Total, capped list reader. Reads at most MAX_LINT_BATCH_ITEMS elements; `total` is the true length
 * so callers can raise SET_ITEMS_TRUNCATED. An unreadable element becomes an unreadable placeholder.
 */
function readRawList(inputs: unknown): { list: unknown[]; total: number } {
  const list: unknown[] = [];
  try {
    if (!Array.isArray(inputs)) return { list, total: 0 };
    const total = inputs.length;
    const take = Math.min(total, MAX_LINT_BATCH_ITEMS);
    for (let i = 0; i < take; i += 1) {
      try {
        list.push(inputs[i]);
      } catch {
        list.push(UNREADABLE_ELEMENT);
      }
    }
    return { list, total };
  } catch {
    return { list: [], total: 0 };
  }
}

/** Lint a set (SET-scope issues only, deterministic order). Pass item-level results via lintQuestionBatch. */
export function lintQuestionSet(inputs: unknown): QuestionLintIssue[] {
  const { list, total } = readRawList(inputs);
  return lintSetFromList(list, total);
}

function lintSetFromList(list: ReadonlyArray<unknown>, total: number): QuestionLintIssue[] {
  const items: SafeItem[] = list.map((raw) => {
    try {
      return sanitize(raw);
    } catch {
      return emptyItem(true);
    }
  });
  const n = items.length;
  const out: QuestionLintIssue[] = [];
  const small = n < MIN_SET_SIZE;

  if (small) out.push(issue("SET_TOO_SMALL", "WARNING", "SET", { metrics: { itemCount: n, minimum: MIN_SET_SIZE } }));
  if (total > n) {
    out.push(issue("SET_ITEMS_TRUNCATED", "WARNING", "SET", { metrics: { itemCount: total, analyzedCount: n, maximum: MAX_LINT_BATCH_ITEMS } }));
  }

  // Stem duplicates.
  const trimmedPrompts = items.map((it) => it.prompt.trim());
  const promptBlank = items.map((it) => isBlank(it.prompt));
  const exactGroups = groupDuplicates(trimmedPrompts.map((p, i) => (promptBlank[i] ? null : p)));
  for (const g of exactGroups) out.push(issue("DUPLICATE_STEM_EXACT", "WARNING", "SET", { itemIndexes: g, metrics: { itemCount: g.length } }));

  const dupKeys = trimmedPrompts.map((p, i) => (promptBlank[i] ? null : nonEmptyKey(duplicateKey(p))));
  for (const g of groupDuplicates(dupKeys)) {
    if (new Set(g.map((i) => trimmedPrompts[i])).size > 1) {
      out.push(issue("DUPLICATE_STEM_NORMALIZED", "WARNING", "SET", { itemIndexes: g, metrics: { itemCount: g.length } }));
    }
  }

  const stemSets = items.map((it) => similarityTokenSet(it.prompt));
  // Bounded work: at most MAX_NEAR_DUP_COMPARISONS candidate pairs (lexicographic order) are examined;
  // if more exist, the cut is reported explicitly (never a silent partial diagnosis).
  const candidates: number[] = [];
  for (let i = 0; i < n; i += 1) if (dupKeys[i] !== null) candidates.push(i);
  const pairsPlanned = (candidates.length * (candidates.length - 1)) / 2;
  let pairsCompared = 0;
  nearDup: for (let a = 0; a < candidates.length; a += 1) {
    for (let b = a + 1; b < candidates.length; b += 1) {
      if (pairsCompared >= MAX_NEAR_DUP_COMPARISONS) break nearDup;
      pairsCompared += 1;
      const i = candidates[a];
      const j = candidates[b];
      if (dupKeys[i] === dupKeys[j]) continue;
      const sim = jaccard(stemSets[i], stemSets[j]);
      if (sim >= NEAR_DUPLICATE_STEM_JACCARD) {
        out.push(issue("NEAR_DUPLICATE_STEM", "WARNING", "SET", { itemIndexes: [i, j], metrics: { similarity: round3(sim) } }));
      }
    }
  }
  if (pairsCompared < pairsPlanned) {
    out.push(issue("SET_ANALYSIS_TRUNCATED", "WARNING", "SET", {
      metrics: { eligibleItems: candidates.length, pairsPlanned, pairsCompared, maximumPairs: MAX_NEAR_DUP_COMPARISONS },
    }));
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
  if (eligible >= SET_KEY_LENGTH_BIAS_MIN_ELIGIBLE && longest.length / eligible >= SET_KEY_LENGTH_BIAS_SHARE) {
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

/** Convenience: item issues (tagged with itemIndex, in item order) followed by set issues. Reads at most MAX_LINT_BATCH_ITEMS items. */
export function lintQuestionBatch(inputs: unknown): QuestionLintIssue[] {
  const { list, total } = readRawList(inputs);
  const out: QuestionLintIssue[] = [];
  list.forEach((it, itemIndex) => {
    for (const i of lintQuestionItem(it)) out.push({ ...i, itemIndex });
  });
  return out.concat(lintSetFromList(list, total));
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

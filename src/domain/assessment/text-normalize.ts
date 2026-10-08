/**
 * Comparison-only text normalization for the question linter
 * (docs/ASSESSMENT_ENGINE.md section 10.2; Run 2026-10-08-ASSESSMENT-ENGINE-NIGHT-001, Slice H).
 *
 * Pure, deterministic, total. Raw text is never altered in storage; these keys are
 * for comparison only. Independent of learning/scheduler code.
 */

/** Hebrew prefix letters (ha, vav, bet, kaf, lamed, mem, shin) that attach to the next word. */
const HEBREW_PREFIX_LETTERS = "הובכלמש";

/** Product-default minimum remainder length (letters) after stripping a prefix letter. */
export const PREFIX_STRIP_MIN_REMAINDER = 3;

/** Product-default maximum number of prefix letters stripped from one token. */
export const PREFIX_STRIP_MAX_LETTERS = 3;

// Zero-width, bidi and other invisible format characters (incl. soft hyphen, ALM, word joiner, BOM).
const BIDI_AND_ZERO_WIDTH = /[­؜​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
// Niqqud + cantillation U+0591-U+05C7, keeping maqaf U+05BE; geresh/gershayim (U+05F3/4) are outside the range.
const NIQQUD = /[֑-ֽֿ-ׇ]/g;
const FINAL_LETTERS: Readonly<Record<string, string>> = {
  "ך": "כ",
  "ם": "מ",
  "ן": "נ",
  "ף": "פ",
  "ץ": "צ",
};
const HEBREW_WORD = /^[א-ת]+$/;

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** Steps 1-2 only: NFC, strip bidi/zero-width, collapse whitespace, trim. */
export function collapseWhitespace(text: unknown): string {
  return asString(text).normalize("NFC").replace(BIDI_AND_ZERO_WIDTH, "").replace(/\s+/g, " ").trim();
}

/** Strip bidi/zero-width and niqqud, collapse whitespace; used for length measures. */
export function stripForLength(text: unknown): string {
  return collapseWhitespace(asString(text).replace(NIQQUD, ""));
}

/** Number of code points after niqqud/bidi stripping (language-agnostic length measure). */
export function measureLength(text: unknown): number {
  return Array.from(stripForLength(text)).length;
}

/** Comparison key per section 10.2 steps 1-7 (terminal punctuation retained). */
export function comparisonKey(text: unknown): string {
  let s = collapseWhitespace(text);
  s = s.replace(NIQQUD, "");
  s = s.replace(/[ךםןףץ]/g, (c) => FINAL_LETTERS[c] ?? c);
  s = s.replace(/[‘’‛׳`´]/g, "'");
  s = s.replace(/[“”„״]/g, '"');
  s = s.replace(/[‐‑‒–—―−־]/g, "-");
  s = s.replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  s = s.replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
  s = s.replace(/\s+/g, " ").trim();
  return s.toLowerCase();
}

const TERMINAL_PUNCT = new Set([".", ",", ";", ":", "!", "?", "…", "'", '"', "-"]);
const QUOTE_DASH = new Set(["'", '"', "-"]);

/** Linear trailing trim of whitespace + terminal punctuation (no backtracking regex). */
function trimTerminal(s: string): string {
  let end = s.length;
  while (end > 0 && (TERMINAL_PUNCT.has(s[end - 1]) || /\s/.test(s[end - 1]))) end -= 1;
  return s.slice(0, end);
}

/**
 * Bounded confusable table (lowercase Cyrillic/Greek letters visually identical to a Latin letter -> Latin).
 * Subset of the UTS #39 idea, deliberately small: only unambiguous lookalikes, no digits/punctuation/Hebrew.
 * Injective over Cyrillic-only and Greek-only strings, so two genuinely different words in one script never
 * collide; a collision means Latin vs lookalike (visually indistinguishable to a reader). Duplicate key only.
 */
const CONFUSABLE_TO_LATIN: Readonly<Record<string, string>> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "һ": "h",
  "ο": "o", "ν": "v", "ρ": "p",
};
const CONFUSABLE_CHARS = /[аеорсухіјѕһονρ]/g;

/** Duplicate key: comparison key plus confusable folding plus step 8 (terminal punctuation stripped). May be empty for punctuation-only text. */
export function duplicateKey(text: unknown): string {
  const folded = comparisonKey(text).replace(CONFUSABLE_CHARS, (c) => CONFUSABLE_TO_LATIN[c] ?? c);
  return trimTerminal(folded).trim();
}

/** Linear strip of leading/trailing quote/hyphen characters. */
function trimQuoteDash(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && QUOTE_DASH.has(s[start])) start += 1;
  while (end > start && QUOTE_DASH.has(s[end - 1])) end -= 1;
  return s.slice(start, end);
}

/** Tokens of the comparison key (split on whitespace/punctuation; keeps inner apostrophe/quote/hyphen). */
export function tokenize(text: unknown): string[] {
  const out: string[] = [];
  for (const raw of comparisonKey(text).split(/[^\p{L}\p{N}\p{M}'"-]+/u)) {
    const token = trimQuoteDash(raw);
    if (token.length > 0) out.push(token);
  }
  return out;
}

/** True when text has no visible content (empty after removing whitespace and zero-width/bidi/format characters). */
export function isBlank(text: unknown): boolean {
  return collapseWhitespace(text).length === 0;
}

/**
 * Heuristic Hebrew prefix stripping (section 10.2). Strips up to
 * PREFIX_STRIP_MAX_LETTERS leading prefix letters while the remainder keeps at
 * least PREFIX_STRIP_MIN_REMAINDER letters. Known false positives/negatives
 * (e.g. roots that begin with a prefix-like letter); WARNING-only use.
 */
export function stripHebrewPrefixes(token: string): string {
  if (!HEBREW_WORD.test(token)) return token;
  let t = token;
  for (let i = 0; i < PREFIX_STRIP_MAX_LETTERS; i += 1) {
    if (t.length - 1 >= PREFIX_STRIP_MIN_REMAINDER && HEBREW_PREFIX_LETTERS.includes(t[0])) {
      t = t.slice(1);
    } else {
      break;
    }
  }
  return t;
}

/** Token key used by similarity checks (prefix-stripped for Hebrew words). */
export function similarityTokenSet(text: unknown): Set<string> {
  return new Set(tokenize(text).map(stripHebrewPrefixes));
}

/** Jaccard similarity of two sets; 0 when both are empty. */
export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let inter = 0;
  for (const x of small) if (large.has(x)) inter += 1;
  return inter / (a.size + b.size - inter);
}

/**
 * True when `term` (already comparison-normalized, space-joined tokens, may be multi-word)
 * occurs as a WHOLE-TOKEN sequence in `tokens` (word-boundary matching: never a substring of a
 * longer word). The first token may carry up to `maxPrefixLetters` attached Hebrew prefix letters
 * drawn from `prefixLetters` ("shelo", "vetamid"). Pass prefixLetters "" for exact-token matching
 * (English terms, or Hebrew words whose prefixed forms are ambiguous). WARNING-only heuristic.
 */
export function containsTerm(
  tokens: readonly string[],
  term: string,
  prefixLetters: string = HEBREW_PREFIX_LETTERS,
  maxPrefixLetters: number = PREFIX_STRIP_MAX_LETTERS,
): boolean {
  const parts = term.split(" ");
  for (let i = 0; i + parts.length <= tokens.length; i += 1) {
    let ok = true;
    for (let j = 0; j < parts.length && ok; j += 1) {
      const tok = tokens[i + j];
      const want = parts[j];
      if (tok === want) continue;
      if (j === 0 && maxPrefixLetters > 0 && HEBREW_WORD.test(tok) && tok.length > want.length && tok.endsWith(want)) {
        const prefix = tok.slice(0, tok.length - want.length);
        // With the full default prefix set, short terms (< PREFIX_STRIP_MIN_REMAINDER letters, e.g. רק, כל) collide
        // with ordinary words that merely begin with a prefix letter (מרק, ברק, שכל), so they accept only the
        // conjunction ו (ורק, וכל). An explicitly narrowed caller-supplied set (e.g. negation "וש") is used as given.
        const allowed =
          want.length < PREFIX_STRIP_MIN_REMAINDER && prefixLetters === HEBREW_PREFIX_LETTERS ? "ו" : prefixLetters;
        if (prefix.length <= maxPrefixLetters && Array.from(prefix).every((c) => allowed.includes(c))) {
          continue;
        }
      }
      ok = false;
    }
    if (ok) return true;
  }
  return false;
}

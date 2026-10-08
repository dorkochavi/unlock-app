/**
 * Plain-text ingestion FOUNDATION (Run 2026-10-08-ASSESSMENT-ENGINE-002, Slice B7; docs/ASSESSMENT_ENGINE.md
 * sections 20-21, ledger AE-025).
 *
 * BOUNDARY: ordinary learning material (prose a lecturer pastes) is NOT a structured question import.
 * This module only turns one plain string into a NormalizedDocument for a FUTURE Assessment Engine stage
 * (knowledge map / blueprint / generation). It is NOT wired into any route, UI, import flow or persistence,
 * generates no questions, uses no AI, and parses no document formats. CSV/JSON import (src/domain/import) is
 * untouched. Entity names are not mandated by the design doc and may change.
 *
 * Properties: pure, total (never throws), deterministic (no Date/random), bounded (explicit caps; exceeding a
 * cap REJECTS with a diagnostic, never silently truncates), content-blind diagnostics (codes and numbers only).
 *
 * OFFSET SEMANTICS: `start`/`end` are UTF-16 code-unit offsets (JS string indices, end exclusive) into the
 * ORIGINAL input, so `input.slice(start, end)` recovers the raw block (internal line breaks, invisible and
 * control characters included). A block's range is trimmed of leading/trailing whitespace and invisible
 * characters (BOM, bidi controls, zero-width). `text` is the cleaned form: NFC, NUL/control chars and invisible
 * format chars removed, lone surrogates replaced by U+FFFD, whitespace runs collapsed to one space.
 * Invisible characters are therefore retained in offsets but absent from `text`.
 *
 * HEADINGS: only unambiguous markdown ATX lines (up to 3 spaces indent, 1-6 '#', whitespace, non-empty title).
 * Numbering-style headings ("1.2 Title") are deliberately NOT detected (ambiguous with list items/prose).
 *
 * contentHash is a NON-cryptographic deterministic fingerprint (two FNV-1a-style 32-bit lanes over UTF-16 code
 * units); suitable for identity/dedupe hints, not for security.
 */
import { collapseWhitespace } from "../assessment/text-normalize";

export const PLAIN_TEXT_NORMALIZER_VERSION = "plain-text-v1";
export const MAX_INPUT_CHARS = 2_000_000;
export const MAX_PARAGRAPHS = 5_000;
export const MAX_LABEL_CHARS = 120;

export type IngestionDiagnosticCode =
  | "NOT_A_STRING"
  | "INPUT_TOO_LONG"
  | "TOO_MANY_PARAGRAPHS"
  | "EMPTY_DOCUMENT"
  | "BOM_REMOVED"
  | "NUL_REMOVED"
  | "CONTROL_CHARS_REMOVED"
  | "INVISIBLE_CHARS_REMOVED"
  | "LONE_SURROGATES_REPLACED"
  | "MIXED_LINE_ENDINGS"
  | "LABEL_TRUNCATED";

/** Content-blind: code plus optional counts only. */
export interface IngestionDiagnostic {
  readonly code: IngestionDiagnosticCode;
  readonly count?: number;
  readonly limit?: number;
}

export interface ContentSourceRef {
  readonly sourceKind: "PLAIN_TEXT";
  /** Caller-supplied opaque label (never interpreted), truncated to MAX_LABEL_CHARS; null if absent. */
  readonly label: string | null;
  /** UTF-16 code units of the original input. */
  readonly charLength: number;
  /** UTF-8 bytes of the original input (lone surrogates counted as 3, like U+FFFD). */
  readonly utf8ByteLength: number;
  /** 16 lowercase hex chars; non-cryptographic. */
  readonly contentHash: string;
}

export interface NormalizedParagraph {
  readonly id: string;
  readonly sectionId: string;
  readonly kind: "HEADING" | "PARAGRAPH";
  readonly headingLevel: number | null;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface NormalizedSection {
  readonly id: string;
  /** Paragraph id of the heading, or null for the leading preamble section. */
  readonly headingParagraphId: string | null;
  readonly level: number | null;
  readonly title: string | null;
  readonly paragraphIds: readonly string[];
  readonly start: number;
  readonly end: number;
}

export interface NormalizedDocument {
  readonly source: ContentSourceRef;
  readonly normalizerVersion: string;
  readonly sections: readonly NormalizedSection[];
  readonly paragraphs: readonly NormalizedParagraph[];
}

export type NormalizePlainTextResult =
  | { readonly ok: true; readonly document: NormalizedDocument; readonly diagnostics: readonly IngestionDiagnostic[] }
  | { readonly ok: false; readonly diagnostics: readonly IngestionDiagnostic[] };

export interface NormalizePlainTextOptions {
  readonly label?: unknown;
  /** Lower-only overrides of the caps (values above the constants are clamped). */
  readonly maxInputChars?: number;
  readonly maxParagraphs?: number;
}

const INVISIBLE_CLASS = "­؜​-‏‪-‮⁠-⁤⁦-⁩﻿";
const INVISIBLE_G = new RegExp(`[${INVISIBLE_CLASS}]`, "g");
const SPACE_OR_INVISIBLE = new RegExp(`[\\s${INVISIBLE_CLASS}]`);
// C0 controls except TAB, LF, VT, FF, CR (whitespace-like, handled by collapse), plus DEL; NUL counted separately.
const CONTROL_G = /[\u0001-\u0008\u000E-\u001F\u007F]/g;
const NUL_G = /\u0000/g;
/** Linear-time removal of an ATX closing "#" sequence (avoids a backtracking regex on long space runs). */
function stripClosingHashes(t: string): string {
  let e = t.length;
  while (e > 0 && (t[e - 1] === " " || t[e - 1] === "	")) e--;
  let h = e;
  while (h > 0 && t[h - 1] === "#") h--;
  if (h === e) return t.slice(0, e);
  if (h === 0) return "";
  const c = t[h - 1];
  return c === " " || c === "	" ? t.slice(0, h) : t.slice(0, e);
}

const HEADING_RE = /^(#{1,6})[ \t]+(.*)$/;

function clampCap(requested: unknown, max: number): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) return max;
  return Math.max(0, Math.min(max, Math.floor(requested)));
}

function countMatches(s: string, re: RegExp): number {
  const m = s.match(re);
  return m ? m.length : 0;
}

/** Replace lone surrogates with U+FFFD; returns the string and the number replaced. */
function fixLoneSurrogates(s: string): { text: string; count: number } {
  let count = 0;
  let out = "";
  let last = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (n >= 0xdc00 && n <= 0xdfff) {
        i += 1;
        continue;
      }
    } else if (!(c >= 0xdc00 && c <= 0xdfff)) {
      continue;
    }
    out += s.slice(last, i) + "�";
    last = i + 1;
    count += 1;
  }
  return { text: count === 0 ? s : out + s.slice(last), count };
}

function utf8Length(s: string): number {
  let bytes = 0;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length && s.charCodeAt(i + 1) >= 0xdc00 && s.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function fingerprint(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193 ^ 0x9e3779b9;
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ ((c * 31 + i) & 0xffff), 0x01000193) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

function cleanText(raw: string): string {
  const { text } = fixLoneSurrogates(raw);
  return collapseWhitespace(text.replace(NUL_G, "").replace(CONTROL_G, ""));
}

function trimRange(s: string, start: number, end: number): [number, number] {
  let a = start;
  let b = end;
  while (a < b && SPACE_OR_INVISIBLE.test(s[a])) a += 1;
  while (b > a && SPACE_OR_INVISIBLE.test(s[b - 1])) b -= 1;
  return [a, b];
}

interface Block {
  start: number;
  end: number;
  heading: { level: number; title: string } | null;
}

interface MutableSection {
  id: string;
  headingParagraphId: string | null;
  level: number | null;
  title: string | null;
  paragraphIds: string[];
  start: number;
  end: number;
}

/** Pure, total conversion of a plain string to a NormalizedDocument. Never throws. */
export function normalizePlainText(input: unknown, opts?: NormalizePlainTextOptions): NormalizePlainTextResult {
  try {
    return normalizeUnsafe(input, opts);
  } catch {
    // Defensive: should be unreachable; never leak details.
    return { ok: false, diagnostics: [{ code: "NOT_A_STRING" }] };
  }
}

function normalizeUnsafe(input: unknown, opts?: NormalizePlainTextOptions): NormalizePlainTextResult {
  if (typeof input !== "string") return { ok: false, diagnostics: [{ code: "NOT_A_STRING" }] };
  const maxChars = clampCap(opts?.maxInputChars, MAX_INPUT_CHARS);
  const maxParas = clampCap(opts?.maxParagraphs, MAX_PARAGRAPHS);
  if (input.length > maxChars) {
    return { ok: false, diagnostics: [{ code: "INPUT_TOO_LONG", count: input.length, limit: maxChars }] };
  }

  const diagnostics: IngestionDiagnostic[] = [];
  const hasBom = input.charCodeAt(0) === 0xfeff;
  if (hasBom) diagnostics.push({ code: "BOM_REMOVED" });
  const nul = countMatches(input, NUL_G);
  if (nul > 0) diagnostics.push({ code: "NUL_REMOVED", count: nul });
  const ctrl = countMatches(input, CONTROL_G);
  if (ctrl > 0) diagnostics.push({ code: "CONTROL_CHARS_REMOVED", count: ctrl });
  const inv = countMatches(input, INVISIBLE_G) - (hasBom ? 1 : 0);
  if (inv > 0) diagnostics.push({ code: "INVISIBLE_CHARS_REMOVED", count: inv });
  const lone = fixLoneSurrogates(input).count;
  if (lone > 0) diagnostics.push({ code: "LONE_SURROGATES_REPLACED", count: lone });

  // Line scan over the ORIGINAL string (CRLF, CR, LF).
  const lines: Array<{ start: number; end: number }> = [];
  const kinds = new Set<string>();
  let ls = 0;
  for (let i = 0; i <= input.length; i += 1) {
    const c = i < input.length ? input[i] : "\n";
    if (c === "\n" || c === "\r") {
      lines.push({ start: ls, end: i });
      if (i < input.length) {
        if (c === "\r" && input[i + 1] === "\n") {
          kinds.add("CRLF");
          i += 1;
        } else kinds.add(c === "\r" ? "CR" : "LF");
      }
      ls = i + 1;
    }
  }
  if (kinds.size > 1) diagnostics.push({ code: "MIXED_LINE_ENDINGS", count: kinds.size });

  // Group into blocks: headings stand alone; other non-blank lines join until a blank line.
  const blocks: Block[] = [];
  let cur: Block | null = null;
  for (const line of lines) {
    const [a, b] = trimRange(input, line.start, line.end);
    if (cleanText(input.slice(a, b)) === "") {
      cur = null;
      continue;
    }
    let heading: Block["heading"] = null;
    const indent = input.slice(line.start, a).replace(INVISIBLE_G, "");
    if (!indent.includes("\t") && indent.length <= 3) {
      const m = HEADING_RE.exec(input.slice(a, b));
      if (m) {
        const title = cleanText(stripClosingHashes(m[2]));
        if (title !== "") heading = { level: m[1].length, title };
      }
    }
    if (heading) {
      blocks.push({ start: a, end: b, heading });
      cur = null;
    } else if (cur) {
      cur.end = b;
    } else {
      cur = { start: a, end: b, heading: null };
      blocks.push(cur);
    }
    if (blocks.length > maxParas) {
      return { ok: false, diagnostics: [{ code: "TOO_MANY_PARAGRAPHS", limit: maxParas }] };
    }
  }

  const paragraphs: NormalizedParagraph[] = [];
  const sections: MutableSection[] = [];
  let section: MutableSection | null = null;
  for (let idx = 0; idx < blocks.length; idx += 1) {
    const blk = blocks[idx];
    const id = `p${idx + 1}`;
    if (blk.heading || section === null) {
      section = {
        id: `s${sections.length + 1}`,
        headingParagraphId: blk.heading ? id : null,
        level: blk.heading ? blk.heading.level : null,
        title: blk.heading ? blk.heading.title : null,
        paragraphIds: [],
        start: blk.start,
        end: blk.end,
      };
      sections.push(section);
    }
    section.paragraphIds.push(id);
    section.end = blk.end;
    paragraphs.push({
      id,
      sectionId: section.id,
      kind: blk.heading ? "HEADING" : "PARAGRAPH",
      headingLevel: blk.heading ? blk.heading.level : null,
      start: blk.start,
      end: blk.end,
      text: blk.heading ? blk.heading.title : cleanText(input.slice(blk.start, blk.end)),
    });
  }
  if (paragraphs.length === 0) diagnostics.push({ code: "EMPTY_DOCUMENT" });

  let label: string | null = null;
  if (typeof opts?.label === "string") {
    label = opts.label.slice(0, MAX_LABEL_CHARS);
    if (opts.label.length > MAX_LABEL_CHARS) {
      diagnostics.push({ code: "LABEL_TRUNCATED", count: opts.label.length, limit: MAX_LABEL_CHARS });
    }
  }

  return {
    ok: true,
    diagnostics,
    document: {
      source: {
        sourceKind: "PLAIN_TEXT",
        label,
        charLength: input.length,
        utf8ByteLength: utf8Length(input),
        contentHash: fingerprint(input),
      },
      normalizerVersion: PLAIN_TEXT_NORMALIZER_VERSION,
      sections,
      paragraphs,
    },
  };
}

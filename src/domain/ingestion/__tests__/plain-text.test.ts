import { describe, expect, it } from "vitest";

import {
  MAX_INPUT_CHARS,
  MAX_LABEL_CHARS,
  MAX_PARAGRAPHS,
  normalizePlainText,
  type NormalizePlainTextResult,
} from "../plain-text";

function ok(r: NormalizePlainTextResult) {
  if (!r.ok) throw new Error("expected ok");
  return r;
}
const codes = (r: NormalizePlainTextResult) => r.diagnostics.map((d) => d.code);

describe("normalizePlainText", () => {
  it("roundtrips offsets to the original string for all paragraphs", () => {
    const inputs = [
      "# כותרת\r\n\r\nפסקה ראשונה with English 123.\rשורה שנייה\n\n\n## Sub\nbody ‏mixed‫ text\n\n   indented tail  ",
      "﻿# T\n\npara\u0000x\u0007y",
    ];
    for (const input of inputs) {
      const { document } = ok(normalizePlainText(input));
      expect(document.paragraphs.length).toBeGreaterThan(0);
      for (const p of document.paragraphs) {
        const raw = input.slice(p.start, p.end);
        expect(raw.length).toBeGreaterThan(0);
        expect(raw).toBe(raw.trim());
        if (p.kind === "PARAGRAPH") {
          expect(p.text).toBe(raw.replace(/[\u0000\u0007‏‫]/g, "").replace(/\s+/g, " ").trim());
        }
      }
    }
  });

  it("handles Hebrew, English and numerals", () => {
    const { document } = ok(normalizePlainText("שלום world 12345 מספר 3.14\n\nשני: Second ٣٤"));
    expect(document.paragraphs.map((p) => p.text)).toEqual(["שלום world 12345 מספר 3.14", "שני: Second ٣٤"]);
  });

  it("treats CRLF, CR and LF alike and flags mixed endings", () => {
    const a = ok(normalizePlainText("a\r\nb\r\n\r\nc"));
    const b = ok(normalizePlainText("a\rb\r\rc"));
    const c = ok(normalizePlainText("a\nb\n\nc"));
    for (const r of [a, b, c]) expect(r.document.paragraphs.map((p) => p.text)).toEqual(["a b", "c"]);
    expect(codes(a)).not.toContain("MIXED_LINE_ENDINGS");
    expect(codes(ok(normalizePlainText("a\r\nb\rc\n\nd")))).toContain("MIXED_LINE_ENDINGS");
  });

  it("removes a BOM from text but keeps offsets into the original", () => {
    const input = "﻿hello\n\nworld";
    const r = ok(normalizePlainText(input));
    expect(r.document.paragraphs[0].start).toBe(1);
    expect(input.slice(r.document.paragraphs[0].start, r.document.paragraphs[0].end)).toBe("hello");
    expect(codes(r)).toContain("BOM_REMOVED");
    expect(codes(r)).not.toContain("INVISIBLE_CHARS_REMOVED");
  });

  it("detects a heading after a BOM", () => {
    const r = ok(normalizePlainText("﻿# Title\n\nbody"));
    expect(r.document.paragraphs[0]).toMatchObject({ kind: "HEADING", headingLevel: 1, text: "Title" });
  });

  it("returns an empty document for empty and whitespace-only input", () => {
    for (const s of ["", "   \n\t\r\n  ", "​‏﻿"]) {
      const r = ok(normalizePlainText(s));
      expect(r.document.paragraphs).toEqual([]);
      expect(r.document.sections).toEqual([]);
      expect(codes(r)).toContain("EMPTY_DOCUMENT");
    }
  });

  it("rejects over-long input and too many paragraphs explicitly", () => {
    const long = normalizePlainText("a".repeat(MAX_INPUT_CHARS + 1));
    expect(long).toEqual({
      ok: false,
      diagnostics: [{ code: "INPUT_TOO_LONG", count: MAX_INPUT_CHARS + 1, limit: MAX_INPUT_CHARS }],
    });
    const many = normalizePlainText(Array.from({ length: 11 }, (_, i) => `p${i}`).join("\n\n"), { maxParagraphs: 10 });
    expect(many).toEqual({ ok: false, diagnostics: [{ code: "TOO_MANY_PARAGRAPHS", limit: 10 }] });
    const exactly = Array.from({ length: 10 }, (_, i) => `p${i}`).join("\n\n");
    expect(ok(normalizePlainText(exactly, { maxParagraphs: 10 })).document.paragraphs).toHaveLength(10);
    // Overrides cannot raise the caps.
    expect(normalizePlainText("a".repeat(MAX_INPUT_CHARS + 1), { maxInputChars: MAX_INPUT_CHARS * 10 }).ok).toBe(false);
    expect(MAX_PARAGRAPHS).toBeGreaterThan(0);
  });

  it("is total for hostile non-string inputs", () => {
    const hostile: unknown[] = [
      undefined,
      null,
      0,
      NaN,
      BigInt(1),
      true,
      {},
      [],
      ["a"],
      () => "x",
      Symbol("s"),
      new String("x"),
      {
        toString: () => {
          throw new Error("boom");
        },
      },
    ];
    for (const h of hostile) {
      expect(normalizePlainText(h)).toEqual({ ok: false, diagnostics: [{ code: "NOT_A_STRING" }] });
    }
    const badLabel = {
      toString: () => {
        throw new Error("x");
      },
    };
    expect(() => normalizePlainText("x", { label: badLabel, maxInputChars: NaN })).not.toThrow();
  });

  it("is deterministic including ids and hash, and hash differs for different input", () => {
    const s = "# A\n\nשלום\n\n## B\n\ntext";
    expect(normalizePlainText(s)).toEqual(normalizePlainText(s));
    const h1 = ok(normalizePlainText(s)).document.source.contentHash;
    expect(h1).toMatch(/^[0-9a-f]{16}$/);
    expect(ok(normalizePlainText(s + " ")).document.source.contentHash).not.toBe(h1);
  });

  it("detects only unambiguous markdown headings and builds sections", () => {
    const input = "intro\n\n# One\ntext one\n\n### Deep ###\n\n1.2 Not a heading\n\n    # indented\n\n#nospace\n\n#\n";
    const { document } = ok(normalizePlainText(input));
    const headings = document.paragraphs.filter((p) => p.kind === "HEADING");
    expect(headings.map((h) => [h.headingLevel, h.text])).toEqual([
      [1, "One"],
      [3, "Deep"],
    ]);
    expect(document.sections.map((s) => [s.id, s.title])).toEqual([
      ["s1", null],
      ["s2", "One"],
      ["s3", "Deep"],
    ]);
    expect(document.paragraphs.map((p) => p.id)).toEqual(document.paragraphs.map((_, i) => `p${i + 1}`));
    const s2 = document.sections[1];
    expect(s2.paragraphIds).toEqual(["p2", "p3"]);
    expect(input.slice(s2.start, s2.end)).toBe("# One\ntext one");
    expect(document.paragraphs.find((p) => p.text === "1.2 Not a heading")?.kind).toBe("PARAGRAPH");
    expect(document.paragraphs.find((p) => p.text === "# indented")?.kind).toBe("PARAGRAPH");
  });

  it("replaces lone surrogates in text, keeps valid pairs, and counts them", () => {
    const input = "ab\uD800cd\n\n\uDC00x😀y";
    const r = ok(normalizePlainText(input));
    expect(r.document.paragraphs.map((p) => p.text)).toEqual(["ab�cd", "�x😀y"]);
    expect(r.diagnostics).toContainEqual({ code: "LONE_SURROGATES_REPLACED", count: 2 });
    // ab(2) + lone(3) + cd(2) + 2 newlines(2) + lone(3) + x(1) + emoji(4) + y(1)
    expect(r.document.source.utf8ByteLength).toBe(18);
  });

  it("keeps bidi and zero-width chars in offsets but cleans them from text", () => {
    const input = "a​b‮c⁧d";
    const r = ok(normalizePlainText(input));
    const p = r.document.paragraphs[0];
    expect(input.slice(p.start, p.end)).toBe(input);
    expect(p.text).toBe("abcd");
    expect(r.diagnostics).toContainEqual({ code: "INVISIBLE_CHARS_REMOVED", count: 3 });
  });

  it("removes NUL and control characters with counts only", () => {
    const r = ok(normalizePlainText("a\u0000b\u0001c\u007Fd"));
    expect(r.document.paragraphs[0].text).toBe("abcd");
    expect(r.diagnostics).toContainEqual({ code: "NUL_REMOVED", count: 1 });
    expect(r.diagnostics).toContainEqual({ code: "CONTROL_CHARS_REMOVED", count: 2 });
  });

  it("diagnostics are content-blind and the label is bounded", () => {
    const secret = "SECRET-CONTENT";
    const r = ok(normalizePlainText(`${secret}\u0000`, { label: "L".repeat(MAX_LABEL_CHARS + 5) }));
    expect(JSON.stringify(r.diagnostics)).not.toContain(secret);
    expect(r.document.source.label).toHaveLength(MAX_LABEL_CHARS);
    expect(codes(r)).toContain("LABEL_TRUNCATED");
    expect(ok(normalizePlainText("x", { label: 5 })).document.source.label).toBeNull();
  });
});

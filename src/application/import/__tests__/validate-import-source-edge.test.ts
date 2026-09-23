import { describe, expect, it } from "vitest";

import { validateImportSource } from "../validate-import-source";

const OK_ROW = {
  topic: "Alpha",
  type: "SINGLE_CHOICE",
  prompt: "Synthetic prompt",
  options: [
    { key: "A", content: "a" },
    { key: "B", content: "b" },
  ],
  correctOptions: ["A"],
};
const CSV_HEADER = "topic,type,prompt,option_a,option_b,correct_options,explanation";

function codes(report: ReturnType<typeof validateImportSource>): string[] {
  return report.issues.map((i) => i.code);
}

describe("validateImportSource — edge inputs (synthetic)", () => {
  // This test protects against: a blank/whitespace file being treated as valid or crashing the CLI.
  it.each(["JSON", "CSV"] as const)("%s: empty and whitespace-only sources FAIL without throwing", (format) => {
    for (const sourceText of ["", "   \n\t "]) {
      const report = validateImportSource({ format, sourceText });
      expect(report.result).toBe("FAIL");
      expect(codes(report).length).toBeGreaterThan(0);
    }
  });

  // This test protects against: the library silently accepting a BOM that the canonical JSON adapter rejects
  // (parity). BOM stripping is the CLI/browser decoding layer's job (see the CLI test below).
  it("JSON with a leading BOM is rejected exactly as the canonical adapter rejects it", () => {
    const report = validateImportSource({ format: "JSON", sourceText: "﻿" + JSON.stringify([OK_ROW]) });
    expect(codes(report)).toEqual(["MALFORMED_SOURCE"]);
  });
  it("CSV with a leading BOM keeps the first column recognised", () => {
    const csv = `﻿${CSV_HEADER}\nAlpha,SINGLE_CHOICE,P1,x,y,A,`;
    const report = validateImportSource({ format: "CSV", sourceText: csv });
    expect(report.result).toBe("PASS");
    expect(report.counts.questionsPerTopic).toEqual({ alpha: 1 });
  });

  // This test protects against: a non-array JSON document or null/scalar rows crashing instead of failing cleanly.
  it("JSON that is not an array, or has non-object rows, FAILs cleanly", () => {
    expect(validateImportSource({ format: "JSON", sourceText: '{"a":1}' }).result).toBe("FAIL");
    expect(validateImportSource({ format: "JSON", sourceText: "null" }).result).toBe("FAIL");
    const rows = validateImportSource({ format: "JSON", sourceText: JSON.stringify([null, 5, "x", OK_ROW]) });
    expect(rows.result).toBe("FAIL");
    expect(rows.counts).toMatchObject({ totalRows: 4, validRows: 1 });
  });

  // This test protects against: empty answer keys / invalid type slipping through as valid.
  it("empty correctOptions and unknown type are errors, never valid", () => {
    const report = validateImportSource({
      format: "JSON",
      sourceText: JSON.stringify([
        { ...OK_ROW, correctOptions: [] },
        { ...OK_ROW, prompt: "p2", type: "TRUE_FALSE" },
      ]),
    });
    expect(report.result).toBe("FAIL");
    expect(report.counts.validRows).toBe(0);
  });

  // This test protects against: prompt normalisation (case/whitespace/NBSP-free collapse) missing duplicates in Hebrew+Latin text.
  it("duplicate prompts are found across case and inner whitespace, and reported with stable row order", () => {
    const report = validateImportSource({
      format: "JSON",
      sourceText: JSON.stringify([
        { ...OK_ROW, prompt: "What is  Alpha?" },
        { ...OK_ROW, prompt: "unrelated" },
        { ...OK_ROW, prompt: " what is alpha? " },
      ]),
    });
    expect(report.issues).toEqual([{ code: "DUPLICATE_PROMPT", severity: "WARNING", rows: [1, 3] }]);
  });

  // This test protects against: malformed CSV (unterminated quote, ragged rows) crashing or echoing source text.
  it("malformed CSV FAILs without echoing content", () => {
    const report = validateImportSource({
      format: "CSV",
      sourceText: `${CSV_HEADER}\nAlpha,SINGLE_CHOICE,"SECRET-PROMPT unterminated,x,y,A,`,
    });
    expect(report.result).toBe("FAIL");
    expect(JSON.stringify(report)).not.toContain("SECRET-PROMPT");
  });

  // This test protects against: CRLF line endings (Windows exports) producing phantom rows.
  it("CRLF CSV yields the same row count as LF CSV", () => {
    const lf = `${CSV_HEADER}\nAlpha,SINGLE_CHOICE,P1,x,y,A,\nAlpha,SINGLE_CHOICE,P2,x,y,B,\n`;
    const crlf = lf.replace(/\n/g, "\r\n");
    const a = validateImportSource({ format: "CSV", sourceText: lf });
    const b = validateImportSource({ format: "CSV", sourceText: crlf });
    expect(b.counts).toEqual(a.counts);
    expect(a.counts.totalRows).toBe(2);
  });

  // This test protects against: nondeterministic issue ordering across runs / map insertion order.
  it("issue ordering is deterministic for a multi-error file", () => {
    const rows = [
      { ...OK_ROW, topic: "Zed", correctOptions: ["A", "B"] },
      { ...OK_ROW, prompt: "", topic: "Nope" },
      { ...OK_ROW, topic: " " },
    ];
    const run = () => validateImportSource({ format: "JSON", sourceText: JSON.stringify(rows), knownTopics: ["Alpha"] });
    expect(run()).toEqual(run());
  });
});

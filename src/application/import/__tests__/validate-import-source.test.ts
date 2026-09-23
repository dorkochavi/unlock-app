import { describe, expect, it } from "vitest";

import { MAX_IMPORT_ROWS } from "../limits";
import { validateImportSource } from "../validate-import-source";

function jsonRow(overrides: Record<string, unknown> = {}) {
  return {
    topic: "Alpha",
    type: "SINGLE_CHOICE",
    prompt: "Synthetic prompt 1",
    options: [
      { key: "A", content: "opt a" },
      { key: "B", content: "opt b" },
    ],
    correctOptions: ["A"],
    ...overrides,
  };
}

function validate(rows: unknown[], extra: { knownTopics?: string[]; minQuestions?: number } = {}) {
  return validateImportSource({ format: "JSON", sourceText: JSON.stringify(rows), ...extra });
}

describe("validateImportSource", () => {
  it("PASSes a well-formed file with counts per topic", () => {
    const report = validate([
      jsonRow(),
      jsonRow({ prompt: "Synthetic prompt 2", topic: "Beta" }),
      jsonRow({ prompt: "Synthetic prompt 3", topic: " alpha " }),
    ]);
    expect(report.result).toBe("PASS");
    expect(report.issues).toEqual([]);
    expect(report.counts).toMatchObject({ totalRows: 3, validRows: 3, invalidRows: 0, topicsReferenced: 2 });
    expect(report.counts.questionsPerTopic).toEqual({ alpha: 2, beta: 1 });
  });

  it("FAILs malformed JSON without echoing source content", () => {
    const report = validateImportSource({ format: "JSON", sourceText: "{not json SECRET-TEXT" });
    expect(report.result).toBe("FAIL");
    expect(report.issues.map((i) => i.code)).toEqual(["MALFORMED_SOURCE"]);
    expect(JSON.stringify(report)).not.toContain("SECRET-TEXT");
  });

  it("FAILs an empty array as NO_ROWS", () => {
    expect(validate([]).issues.map((i) => i.code)).toEqual(["NO_ROWS"]);
  });

  it("FAILs above the canonical row limit", () => {
    const report = validate(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => jsonRow()));
    expect(report.result).toBe("FAIL");
    expect(report.issues[0].code).toBe("TOO_MANY_ROWS");
  });

  it("reports SINGLE_CHOICE with two correct options by row number", () => {
    const report = validate([jsonRow(), jsonRow({ prompt: "p2", correctOptions: ["A", "B"] })]);
    expect(report.result).toBe("FAIL");
    const content = report.issues.find((i) => i.code === "ROW_CONTENT_INVALID");
    expect(content?.rows).toEqual([2]);
    expect(content?.detail).toContain("SINGLE_CHOICE");
    expect(report.counts).toMatchObject({ validRows: 1, invalidRows: 1 });
  });

  it("reports empty options / prompt and too few options as content errors", () => {
    const report = validate([
      jsonRow({ prompt: "   " }),
      jsonRow({ prompt: "p2", options: [{ key: "A", content: "only" }], correctOptions: ["A"] }),
      jsonRow({ prompt: "p3", options: [{ key: "A", content: " " }, { key: "B", content: "b" }] }),
    ]);
    const details = report.issues.filter((i) => i.code === "ROW_CONTENT_INVALID").map((i) => i.detail);
    expect(details).toEqual(
      expect.arrayContaining([
        "prompt must not be empty",
        "at least 2 options are required",
        'option "A" must not be empty',
      ]),
    );
    expect(report.result).toBe("FAIL");
  });

  it("reports parse-level errors (bad type, zero options) as ROW_PARSE_ERROR with rows only", () => {
    const report = validate([
      jsonRow({ prompt: "p1", type: "ESSAY-LEAK" }),
      jsonRow({ prompt: "p2", options: [], correctOptions: [] }),
      jsonRow({ prompt: "p3" }),
    ]);
    const parseIssue = report.issues.find((i) => i.code === "ROW_PARSE_ERROR");
    expect(parseIssue?.rows).toEqual([1, 2]);
    expect(parseIssue?.detail).toBeUndefined();
    expect(JSON.stringify(report)).not.toContain("ESSAY-LEAK");
  });

  it("flags a correctOptions reference to an undefined option key", () => {
    const report = validate([jsonRow({ correctOptions: ["Z"] })]);
    expect(report.result).toBe("FAIL");
    expect(report.issues.some((i) => i.code === "ROW_PARSE_ERROR" || i.code === "ROW_CONTENT_INVALID")).toBe(true);
  });

  it("flags blank topics without needing a topic list", () => {
    const report = validate([jsonRow({ topic: "  " })]);
    expect(report.issues.map((i) => i.code)).toContain("TOPIC_BLANK");
    expect(report.result).toBe("FAIL");
  });

  it("with a topic list: unknown topic FAILs, empty topic only warns", () => {
    const report = validate([jsonRow(), jsonRow({ prompt: "p2", topic: "Gamma" })], {
      knownTopics: ["Alpha", "Delta"],
    });
    expect(report.result).toBe("FAIL");
    expect(report.issues.find((i) => i.code === "TOPIC_UNKNOWN")).toMatchObject({ topic: "Gamma", rows: [2], severity: "ERROR" });
    expect(report.issues.find((i) => i.code === "TOPIC_WITHOUT_QUESTIONS")).toMatchObject({ topic: "Delta", severity: "WARNING" });
  });

  it("topic matching is trimmed and case-insensitive; ambiguous list entries FAIL", () => {
    expect(validate([jsonRow({ topic: " ALPHA " })], { knownTopics: ["alpha"] }).result).toBe("PASS");
    const ambiguous = validate([jsonRow()], { knownTopics: ["Alpha", "alpha "] });
    expect(ambiguous.issues.map((i) => i.code)).toContain("TOPIC_AMBIGUOUS");
    expect(ambiguous.result).toBe("FAIL");
  });

  it("duplicate prompts (whitespace/case-insensitive) only warn", () => {
    const report = validate([jsonRow({ prompt: "Same  Prompt" }), jsonRow({ prompt: "same prompt" })]);
    expect(report.result).toBe("PASS");
    expect(report.issues).toEqual([{ code: "DUPLICATE_PROMPT", severity: "WARNING", rows: [1, 2] }]);
  });

  it("minQuestions counts only fully valid questions and is opt-in", () => {
    const rows = [jsonRow(), jsonRow({ prompt: "p2", correctOptions: ["A", "B"] })];
    expect(validate(rows).issues.map((i) => i.code)).not.toContain("BELOW_MIN_QUESTIONS");
    const report = validate(rows, { minQuestions: 2 });
    expect(report.issues.find((i) => i.code === "BELOW_MIN_QUESTIONS")?.detail).toBe("1 < 2");
  });

  it("validates CSV through the same pipeline", () => {
    const csv = [
      "topic,type,prompt,option_a,option_b,correct_options,explanation",
      "Alpha,SINGLE_CHOICE,Synthetic csv prompt,x,y,A,",
      "Alpha,SINGLE_CHOICE,Second csv prompt,x,y,\"A,B\",",
    ].join("\n");
    const report = validateImportSource({ format: "CSV", sourceText: csv });
    expect(report.result).toBe("FAIL");
    expect(report.counts).toMatchObject({ totalRows: 2, validRows: 1, invalidRows: 1 });
  });

  it("is deterministic", () => {
    const rows = [jsonRow(), jsonRow({ prompt: "p2", topic: "B", correctOptions: ["A", "B"] })];
    expect(validate(rows)).toEqual(validate(rows));
  });

  it("never includes prompt or option text in the report", () => {
    const report = validate([jsonRow({ prompt: "UNIQUE-PROMPT-TEXT", correctOptions: ["A", "B"], options: [
      { key: "A", content: "UNIQUE-OPTION-TEXT" }, { key: "B", content: "b" },
    ] })]);
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("UNIQUE-PROMPT-TEXT");
    expect(serialized).not.toContain("UNIQUE-OPTION-TEXT");
  });
});

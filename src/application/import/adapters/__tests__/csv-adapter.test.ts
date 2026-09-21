import { describe, expect, it } from "vitest";

import { parseCsvImportSource } from "../csv-adapter";

const HEADER = "topic,type,prompt,option_a,option_b,option_c,correct_options,explanation";

describe("parseCsvImportSource", () => {
  it("parses well-formed rows into the same canonical shape as the JSON adapter", () => {
    const csv = [
      HEADER,
      'Introduction,SINGLE_CHOICE,"What is the correct answer?",Option A,Option B,,B,B is correct',
      "Advanced Topics,MULTIPLE_CHOICE,Select all that apply.,First,Second,Third,\"A,C\",",
    ].join("\n");

    const result = parseCsvImportSource(csv);

    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows).toHaveLength(2);

    expect(result.rows[0]).toEqual({
      sourceRowNumber: 1,
      outcome: "PARSED",
      row: {
        sourceRowNumber: 1,
        topicName: "Introduction",
        questionType: "SINGLE_CHOICE",
        prompt: "What is the correct answer?",
        answerOptions: [
          { id: "A", content: "Option A" },
          { id: "B", content: "Option B" },
        ],
        correctOptionIds: ["B"],
        explanation: "B is correct",
      },
    });

    expect(result.rows[1]).toEqual({
      sourceRowNumber: 2,
      outcome: "PARSED",
      row: {
        sourceRowNumber: 2,
        topicName: "Advanced Topics",
        questionType: "MULTIPLE_CHOICE",
        prompt: "Select all that apply.",
        answerOptions: [
          { id: "A", content: "First" },
          { id: "B", content: "Second" },
          { id: "C", content: "Third" },
        ],
        correctOptionIds: ["A", "C"],
        explanation: null,
      },
    });
  });

  it("reports MALFORMED_SOURCE when a required column is missing", () => {
    const csv = ["topic,type,prompt,option_a,option_b", "x,SINGLE_CHOICE,p,A,B"].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("MALFORMED_SOURCE");
    if (result.outcome !== "MALFORMED_SOURCE") throw new Error("unreachable");
    expect(result.error).toContain("correct_options");
  });

  it("treats a blank option column as unused for that row, without requiring every option_* column", () => {
    const csv = [HEADER, "Intro,SINGLE_CHOICE,Prompt,Only option,,,A,"].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.answerOptions).toEqual([{ id: "A", content: "Only option" }]);
  });

  it("reports a PARSE_ERROR for an unknown question type, without failing other rows", () => {
    const csv = [
      HEADER,
      "Intro,TRUE_FALSE,Prompt,A text,B text,,A,",
      "Intro,SINGLE_CHOICE,Prompt,A text,B text,,A,",
    ].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    expect(result.rows[1].outcome).toBe("PARSED");
  });

  it("reports a PARSE_ERROR when correct_options references a blank/unknown option letter", () => {
    const csv = [HEADER, "Intro,SINGLE_CHOICE,Prompt,A text,,,B,"].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    if (result.rows[0].outcome !== "PARSE_ERROR") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("unknown or blank option"))).toBe(true);
  });

  it("reports a PARSE_ERROR for a duplicate letter in correct_options", () => {
    const csv = [HEADER, '"Intro",SINGLE_CHOICE,Prompt,A text,B text,,"A,A",'].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    if (result.rows[0].outcome !== "PARSE_ERROR") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("duplicate option"))).toBe(true);
  });

  it("reports one row's column-count mismatch as that row's own PARSE_ERROR, without dropping the other valid rows", () => {
    const csv = [
      HEADER,
      "Intro,SINGLE_CHOICE,p1,A text,B text,,A,",
      // Row 2 has an unescaped stray comma in an unquoted field -> too many
      // fields for the header (a common real-world CSV authoring mistake).
      "Intro,SINGLE_CHOICE,p2 with, a stray comma,A text,B text,,A,",
      "Intro,SINGLE_CHOICE,p3,A text,B text,,A,",
    ].join("\n");

    const result = parseCsvImportSource(csv);

    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].outcome).toBe("PARSED");
    expect(result.rows[1].outcome).toBe("PARSE_ERROR");
    if (result.rows[1].outcome !== "PARSE_ERROR") throw new Error("unreachable");
    expect(result.rows[1].errors.some((e) => e.includes("column count mismatch"))).toBe(true);
    expect(result.rows[2].outcome).toBe("PARSED");
    if (result.rows[2].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[2].row.prompt).toBe("p3");
  });

  it("passes a blank topic through unresolved (parity with the JSON adapter — Topic-name resolution is S2's job, not S1's)", () => {
    const csv = [HEADER, ",SINGLE_CHOICE,Prompt,A text,B text,,A,"].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.topicName).toBe("");
  });

  it("normalizes a whitespace-only explanation to null (parity with the JSON adapter)", () => {
    const csv = [HEADER, 'Intro,SINGLE_CHOICE,Prompt,A text,B text,,A,"   "'].join("\n");
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.explanation).toBeNull();
  });

  it("handles a quoted field containing an embedded comma correctly (RFC 4180)", () => {
    const csv = [HEADER, '"Intro","SINGLE_CHOICE","Pick one, please",A text,B text,,A,'].join(
      "\n",
    );
    const result = parseCsvImportSource(csv);
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.prompt).toBe("Pick one, please");
  });
});

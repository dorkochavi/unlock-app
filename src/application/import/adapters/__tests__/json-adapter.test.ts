import { describe, expect, it } from "vitest";

import { parseJsonImportSource } from "../json-adapter";

const WELL_FORMED_SOURCE = JSON.stringify([
  {
    topic: "Introduction",
    type: "SINGLE_CHOICE",
    prompt: "What is the correct answer?",
    options: [
      { key: "A", content: "Option A" },
      { key: "B", content: "Option B" },
    ],
    correctOptions: ["B"],
    explanation: "B is correct because...",
  },
  {
    topic: "Advanced Topics",
    type: "MULTIPLE_CHOICE",
    prompt: "Select all that apply.",
    options: [
      { key: "a", content: "First" },
      { key: "b", content: "Second" },
      { key: "c", content: "Third" },
    ],
    correctOptions: ["a", "c"],
  },
]);

describe("parseJsonImportSource", () => {
  it("parses a well-formed source into canonical rows, normalizing option keys to uppercase", () => {
    const result = parseJsonImportSource(WELL_FORMED_SOURCE);

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
        explanation: "B is correct because...",
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

  it("reports MALFORMED_SOURCE for invalid JSON", () => {
    const result = parseJsonImportSource("{not valid json");
    expect(result.outcome).toBe("MALFORMED_SOURCE");
  });

  it("reports MALFORMED_SOURCE for well-formed JSON that is not a top-level array", () => {
    const result = parseJsonImportSource(JSON.stringify({ topic: "x" }));
    expect(result.outcome).toBe("MALFORMED_SOURCE");
  });

  it("reports a PARSE_ERROR for a row with an unknown question type, without failing other rows", () => {
    const source = JSON.stringify([
      { ...JSON.parse(WELL_FORMED_SOURCE)[0], type: "TRUE_FALSE" },
      JSON.parse(WELL_FORMED_SOURCE)[1],
    ]);
    const result = parseJsonImportSource(source);

    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    expect(result.rows[1].outcome).toBe("PARSED");
  });

  it("reports a PARSE_ERROR for a duplicate option key within one row", () => {
    const row = {
      topic: "Introduction",
      type: "SINGLE_CHOICE",
      prompt: "Prompt",
      options: [
        { key: "A", content: "First" },
        { key: "a", content: "Second" },
      ],
      correctOptions: ["A"],
    };
    const result = parseJsonImportSource(JSON.stringify([row]));

    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    if (result.rows[0].outcome !== "PARSE_ERROR") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("duplicate option key"))).toBe(true);
  });

  it("reports a PARSE_ERROR when correctOptions references an option key that was never defined", () => {
    const row = {
      topic: "Introduction",
      type: "SINGLE_CHOICE",
      prompt: "Prompt",
      options: [{ key: "A", content: "Only option" }],
      correctOptions: ["Z"],
    };
    const result = parseJsonImportSource(JSON.stringify([row]));

    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
    if (result.rows[0].outcome !== "PARSE_ERROR") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("unknown option key"))).toBe(true);
  });

  it("reports a PARSE_ERROR for a row that is not a JSON object", () => {
    const result = parseJsonImportSource(JSON.stringify(["not an object"]));
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSE_ERROR");
  });

  it("passes a blank topic through unresolved (parity with the CSV adapter — Topic-name resolution is S2's job, not S1's)", () => {
    const row = { ...JSON.parse(WELL_FORMED_SOURCE)[0], topic: "" };
    const result = parseJsonImportSource(JSON.stringify([row]));
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.topicName).toBe("");
  });

  it("normalizes a whitespace-only explanation to null (parity with the CSV adapter)", () => {
    const row = { ...JSON.parse(WELL_FORMED_SOURCE)[0], explanation: "   " };
    const result = parseJsonImportSource(JSON.stringify([row]));
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.explanation).toBeNull();
  });

  it("trims a non-blank explanation (parity with the CSV adapter)", () => {
    const row = { ...JSON.parse(WELL_FORMED_SOURCE)[0], explanation: "  Because B.  " };
    const result = parseJsonImportSource(JSON.stringify([row]));
    expect(result.outcome).toBe("PARSED");
    if (result.outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("PARSED");
    if (result.rows[0].outcome !== "PARSED") throw new Error("unreachable");
    expect(result.rows[0].row.explanation).toBe("Because B.");
  });
});

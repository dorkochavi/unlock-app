import { describe, expect, it } from "vitest";

import { parseCsvImportSource } from "../csv-adapter";
import { parseJsonImportSource } from "../json-adapter";

/**
 * Both source adapters must produce byte-identical `CanonicalQuestionRow`s
 * for semantically equivalent input — S2/S3 are built to treat JSON and CSV
 * identically once a canonical row exists (`docs/CHATGPT_PLAN.md` §1/§8's
 * "format-independent" pipeline requirement).
 */
describe("JSON/CSV adapter parity", () => {
  it("produces the same canonical row for equivalent well-formed input", () => {
    const json = parseJsonImportSource(
      JSON.stringify([
        {
          topic: "Introduction",
          type: "SINGLE_CHOICE",
          prompt: "What is the correct answer?",
          options: [
            { key: "A", content: "Option A" },
            { key: "B", content: "Option B" },
          ],
          correctOptions: ["B"],
          explanation: "B is correct",
        },
      ]),
    );
    const csv = parseCsvImportSource(
      [
        "topic,type,prompt,option_a,option_b,correct_options,explanation",
        "Introduction,SINGLE_CHOICE,What is the correct answer?,Option A,Option B,B,B is correct",
      ].join("\n"),
    );

    expect(json.outcome).toBe("PARSED");
    expect(csv.outcome).toBe("PARSED");
    if (json.outcome !== "PARSED" || csv.outcome !== "PARSED") throw new Error("unreachable");
    expect(json.rows[0].outcome).toBe("PARSED");
    expect(csv.rows[0].outcome).toBe("PARSED");
    if (json.rows[0].outcome !== "PARSED" || csv.rows[0].outcome !== "PARSED") {
      throw new Error("unreachable");
    }
    expect(csv.rows[0].row).toEqual(json.rows[0].row);
  });

  it("normalizes a blank topic and a whitespace-only explanation identically", () => {
    const json = parseJsonImportSource(
      JSON.stringify([
        {
          topic: "",
          type: "SINGLE_CHOICE",
          prompt: "Prompt",
          options: [
            { key: "A", content: "A" },
            { key: "B", content: "B" },
          ],
          correctOptions: ["A"],
          explanation: "   ",
        },
      ]),
    );
    const csv = parseCsvImportSource(
      ["topic,type,prompt,option_a,option_b,correct_options,explanation", ',SINGLE_CHOICE,Prompt,A,B,A,"   "'].join(
        "\n",
      ),
    );

    if (json.outcome !== "PARSED" || csv.outcome !== "PARSED") throw new Error("unreachable");
    if (json.rows[0].outcome !== "PARSED" || csv.rows[0].outcome !== "PARSED") {
      throw new Error("unreachable");
    }
    expect(csv.rows[0].row).toEqual(json.rows[0].row);
    expect(json.rows[0].row.topicName).toBe("");
    expect(json.rows[0].row.explanation).toBeNull();
  });
});

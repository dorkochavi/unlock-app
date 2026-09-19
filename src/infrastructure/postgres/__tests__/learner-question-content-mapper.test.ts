/**
 * Fast, DB-free unit tests for `mapLearnerQuestionContentRow` — this
 * codebase's dedicated learner-facing, `correct_answer`-free read path.
 */
import { describe, expect, it } from "vitest";
import { MalformedRowError } from "../row-validation";
import { mapLearnerQuestionContentRow } from "../learner-question-content-mapper";

function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: "qv-1",
    question_type: "SINGLE_CHOICE",
    prompt: "What is 2 + 2?",
    answer_options: [
      { id: "a", content: "3" },
      { id: "b", content: "4" },
    ],
    ...overrides,
  };
}

describe("mapLearnerQuestionContentRow", () => {
  it("maps a valid SINGLE_CHOICE row", () => {
    expect(mapLearnerQuestionContentRow(row({}))).toEqual({
      questionVersionId: "qv-1",
      questionType: "SINGLE_CHOICE",
      prompt: "What is 2 + 2?",
      options: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
    });
  });

  it("maps a valid MULTIPLE_CHOICE row", () => {
    const result = mapLearnerQuestionContentRow(
      row({ question_type: "MULTIPLE_CHOICE" }),
    );
    expect(result.questionType).toBe("MULTIPLE_CHOICE");
  });

  it("throws for an unrecognized question_type", () => {
    expect(() => mapLearnerQuestionContentRow(row({ question_type: "ESSAY" }))).toThrow(
      MalformedRowError,
    );
  });

  it("throws when prompt is missing/not a string", () => {
    expect(() => mapLearnerQuestionContentRow(row({ prompt: null }))).toThrow(
      MalformedRowError,
    );
  });

  it("throws when answer_options is not an array", () => {
    expect(() =>
      mapLearnerQuestionContentRow(row({ answer_options: { id: "a" } })),
    ).toThrow(MalformedRowError);
  });

  it("throws when an answer_options element is missing content", () => {
    expect(() =>
      mapLearnerQuestionContentRow(row({ answer_options: [{ id: "a" }] })),
    ).toThrow(MalformedRowError);
  });

  it("security regression: never reads or forwards correct_answer, even if a row accidentally carries it", () => {
    // A real query never selects `correct_answer` (see the repository's own
    // regression test), but this asserts the mapper's OWN contract
    // independently: even a row that DOES carry the field must never have
    // it appear on the mapped output, under any key name.
    const result = mapLearnerQuestionContentRow(
      row({ correct_answer: ["b"], explanation: "because 2+2=4" }),
    );

    expect(result).not.toHaveProperty("correctAnswer");
    expect(result).not.toHaveProperty("correctOptionIds");
    expect(result).not.toHaveProperty("explanation");
    expect(Object.keys(result).sort()).toEqual(
      ["options", "prompt", "questionType", "questionVersionId"].sort(),
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("correct_answer");
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("explanation");
  });
});

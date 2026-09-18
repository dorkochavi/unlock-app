import { describe, expect, it } from "vitest";
import {
  assertValidQuestionAnswerDefinition,
  canonicalizeSelectedAnswer,
  evaluateAnswerCorrectness,
  InvalidQuestionAnswerDefinitionError,
  InvalidSelectedAnswerError,
  type QuestionAnswerDefinition,
  type SelectedAnswer,
} from "../answer";

const SINGLE_CHOICE_DEF: QuestionAnswerDefinition = {
  questionType: "SINGLE_CHOICE",
  options: [
    { id: "a", content: "A" },
    { id: "b", content: "B" },
  ],
  correctOptionIds: ["a"],
};

const MULTIPLE_CHOICE_DEF: QuestionAnswerDefinition = {
  questionType: "MULTIPLE_CHOICE",
  options: [
    { id: "a", content: "A" },
    { id: "b", content: "B" },
    { id: "c", content: "C" },
  ],
  correctOptionIds: ["a", "c"],
};

describe("canonicalizeSelectedAnswer", () => {
  it("passes strings and null through unchanged", () => {
    expect(canonicalizeSelectedAnswer("a")).toBe("a");
    expect(canonicalizeSelectedAnswer(null)).toBeNull();
  });

  it("sorts an array ascending, returning a NEW array (never mutates the input)", () => {
    const input = ["b", "a"];
    const result = canonicalizeSelectedAnswer(input);
    expect(result).toEqual(["a", "b"]);
    expect(input).toEqual(["b", "a"]); // untouched
  });

  it("throws InvalidSelectedAnswerError on a duplicate id — never silently deduplicates", () => {
    expect(() => canonicalizeSelectedAnswer(["a", "a"])).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("hostile-review: throws InvalidSelectedAnswerError (not a raw TypeError) for a non-array/string/null value that only type-checked callers are prevented from passing", () => {
    // Simulates data arriving from an untyped boundary (e.g. JSON.parse of
    // a future API request) before it has been validated as a real
    // SelectedAnswer.
    const malformed = { not: "a valid shape" } as unknown as SelectedAnswer;
    expect(() => canonicalizeSelectedAnswer(malformed)).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("hostile-review: throws InvalidSelectedAnswerError for a non-string array element", () => {
    const malformed = ["a", 1] as unknown as SelectedAnswer;
    expect(() => canonicalizeSelectedAnswer(malformed)).toThrow(
      InvalidSelectedAnswerError,
    );
  });
});

describe("assertValidQuestionAnswerDefinition", () => {
  it("accepts a valid SINGLE_CHOICE definition", () => {
    expect(() => assertValidQuestionAnswerDefinition(SINGLE_CHOICE_DEF)).not.toThrow();
  });

  it("accepts a valid MULTIPLE_CHOICE definition", () => {
    expect(() => assertValidQuestionAnswerDefinition(MULTIPLE_CHOICE_DEF)).not.toThrow();
  });

  it("accepts a MULTIPLE_CHOICE definition where ALL options are correct (Phase 2 item J — explicitly allowed)", () => {
    const allCorrect: QuestionAnswerDefinition = {
      ...MULTIPLE_CHOICE_DEF,
      correctOptionIds: ["a", "b", "c"],
    };
    expect(() => assertValidQuestionAnswerDefinition(allCorrect)).not.toThrow();
  });

  it("rejects an empty options array", () => {
    const bad: QuestionAnswerDefinition = { ...SINGLE_CHOICE_DEF, options: [] };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects a duplicate option id", () => {
    const bad: QuestionAnswerDefinition = {
      ...SINGLE_CHOICE_DEF,
      options: [
        { id: "a", content: "A" },
        { id: "a", content: "A duplicate" },
      ],
    };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects correctOptionIds referencing a missing option", () => {
    const bad: QuestionAnswerDefinition = {
      ...SINGLE_CHOICE_DEF,
      correctOptionIds: ["missing"],
    };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects a duplicate entry in correctOptionIds", () => {
    const bad: QuestionAnswerDefinition = {
      ...MULTIPLE_CHOICE_DEF,
      correctOptionIds: ["a", "a"],
    };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects SINGLE_CHOICE with two correct options", () => {
    const bad: QuestionAnswerDefinition = {
      ...SINGLE_CHOICE_DEF,
      correctOptionIds: ["a", "b"],
    };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects SINGLE_CHOICE with zero correct options", () => {
    const bad: QuestionAnswerDefinition = { ...SINGLE_CHOICE_DEF, correctOptionIds: [] };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });

  it("rejects MULTIPLE_CHOICE with zero correct options", () => {
    const bad: QuestionAnswerDefinition = {
      ...MULTIPLE_CHOICE_DEF,
      correctOptionIds: [],
    };
    expect(() => assertValidQuestionAnswerDefinition(bad)).toThrow(
      InvalidQuestionAnswerDefinitionError,
    );
  });
});

describe("evaluateAnswerCorrectness — SINGLE_CHOICE", () => {
  it("returns true for the correct option id", () => {
    expect(evaluateAnswerCorrectness(SINGLE_CHOICE_DEF, "a")).toBe(true);
  });

  it("returns false for an incorrect (but valid) option id", () => {
    expect(evaluateAnswerCorrectness(SINGLE_CHOICE_DEF, "b")).toBe(false);
  });

  it("throws for an unknown option id — never silently false", () => {
    expect(() => evaluateAnswerCorrectness(SINGLE_CHOICE_DEF, "z")).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("throws for an array selectedAnswer (wrong shape for SINGLE_CHOICE)", () => {
    expect(() => evaluateAnswerCorrectness(SINGLE_CHOICE_DEF, ["a"])).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("throws for null", () => {
    expect(() => evaluateAnswerCorrectness(SINGLE_CHOICE_DEF, null)).toThrow(
      InvalidSelectedAnswerError,
    );
  });
});

describe("evaluateAnswerCorrectness — MULTIPLE_CHOICE", () => {
  it("returns true for the exact correct set", () => {
    expect(evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["a", "c"])).toBe(true);
  });

  it("returns true for the same set in a different order (set equality)", () => {
    expect(evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["c", "a"])).toBe(true);
  });

  it("returns false when missing one correct option", () => {
    expect(evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["a"])).toBe(false);
  });

  it("returns false when an extra incorrect option is included", () => {
    expect(evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["a", "b", "c"])).toBe(false);
  });

  it("throws for a duplicate id in the selection", () => {
    expect(() =>
      evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["a", "a", "c"]),
    ).toThrow(InvalidSelectedAnswerError);
  });

  it("throws for an unknown option id anywhere in the selection", () => {
    expect(() => evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, ["a", "z"])).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("throws for a scalar selectedAnswer (wrong shape for MULTIPLE_CHOICE)", () => {
    expect(() => evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, "a")).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("throws for an empty array — never silently false", () => {
    expect(() => evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, [])).toThrow(
      InvalidSelectedAnswerError,
    );
  });

  it("throws for null", () => {
    expect(() => evaluateAnswerCorrectness(MULTIPLE_CHOICE_DEF, null)).toThrow(
      InvalidSelectedAnswerError,
    );
  });
});

describe("TRUE_FALSE as SINGLE_CHOICE (ADR-014 Decision §1 — no semantic loss)", () => {
  const trueFalseDef: QuestionAnswerDefinition = {
    questionType: "SINGLE_CHOICE",
    options: [
      { id: "TRUE", content: "True" },
      { id: "FALSE", content: "False" },
    ],
    correctOptionIds: ["TRUE"],
  };

  it("grades a two-option true/false question exactly like any other SINGLE_CHOICE question", () => {
    expect(() => assertValidQuestionAnswerDefinition(trueFalseDef)).not.toThrow();
    expect(evaluateAnswerCorrectness(trueFalseDef, "TRUE")).toBe(true);
    expect(evaluateAnswerCorrectness(trueFalseDef, "FALSE")).toBe(false);
  });
});

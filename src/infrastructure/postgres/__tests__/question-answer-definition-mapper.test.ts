/**
 * Fast, DB-free unit tests for `mapQuestionAnswerDefinitionRow` (Phase 8).
 * Only JSON-SHAPE validation is this mapper's job — `readEnum` here is the
 * same closed-set reader used throughout `src/infrastructure/postgres/`,
 * so an unrecognized `question_type` is rejected the same way any other
 * CHECK-constrained text column is (in practice the DB's own CHECK
 * constraint on `question_type` already prevents this from ever being a
 * real persisted row — this test defends the mapper's OWN contract
 * independently of that DB constraint, e.g. against a future migration
 * that widens the CHECK before this reader is updated to match).
 */
import { describe, expect, it } from "vitest";
import { MalformedRowError } from "../row-validation";
import { mapQuestionAnswerDefinitionRow } from "../question-answer-definition-mapper";

function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    question_type: "SINGLE_CHOICE",
    answer_options: [
      { id: "a", content: "A" },
      { id: "b", content: "B" },
    ],
    correct_answer: ["a"],
    ...overrides,
  };
}

describe("mapQuestionAnswerDefinitionRow", () => {
  it("maps a valid SINGLE_CHOICE row", () => {
    expect(mapQuestionAnswerDefinitionRow(row({}))).toEqual({
      questionType: "SINGLE_CHOICE",
      options: [
        { id: "a", content: "A" },
        { id: "b", content: "B" },
      ],
      correctOptionIds: ["a"],
    });
  });

  it("maps a valid MULTIPLE_CHOICE row", () => {
    const result = mapQuestionAnswerDefinitionRow(
      row({ question_type: "MULTIPLE_CHOICE", correct_answer: ["a", "b"] }),
    );
    expect(result.questionType).toBe("MULTIPLE_CHOICE");
    expect(result.correctOptionIds).toEqual(["a", "b"]);
  });

  it("throws for an unrecognized question_type", () => {
    expect(() => mapQuestionAnswerDefinitionRow(row({ question_type: "ESSAY" }))).toThrow(
      MalformedRowError,
    );
  });

  it("throws when answer_options is not an array", () => {
    expect(() =>
      mapQuestionAnswerDefinitionRow(row({ answer_options: { id: "a" } })),
    ).toThrow(MalformedRowError);
  });

  it("throws when an answer_options element is missing content", () => {
    expect(() =>
      mapQuestionAnswerDefinitionRow(row({ answer_options: [{ id: "a" }] })),
    ).toThrow(MalformedRowError);
  });

  it("throws when an answer_options element's id is not a string", () => {
    expect(() =>
      mapQuestionAnswerDefinitionRow(row({ answer_options: [{ id: 1, content: "A" }] })),
    ).toThrow(MalformedRowError);
  });

  it("throws when correct_answer is not an array (a bare scalar, the OLD pre-ADR-014 shape)", () => {
    expect(() => mapQuestionAnswerDefinitionRow(row({ correct_answer: "a" }))).toThrow(
      MalformedRowError,
    );
  });

  it("throws when a correct_answer element is not a string", () => {
    expect(() => mapQuestionAnswerDefinitionRow(row({ correct_answer: [1] }))).toThrow(
      MalformedRowError,
    );
  });

  it("does NOT itself validate cross-field semantics (duplicate ids, unknown correctOptionIds references, cardinality) — that is assertValidQuestionAnswerDefinition's job, called separately", () => {
    // A structurally well-shaped but semantically invalid definition
    // (correct_answer references an option that doesn't exist) — the
    // mapper alone must NOT throw; only the domain-level assertion does.
    expect(() =>
      mapQuestionAnswerDefinitionRow(row({ correct_answer: ["nonexistent"] })),
    ).not.toThrow();
  });
});

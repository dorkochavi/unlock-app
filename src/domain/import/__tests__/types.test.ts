import { describe, expect, it } from "vitest";

import {
  buildTopicNameIndex,
  MIN_PUBLISHABLE_OPTION_COUNT,
  resolveTopicByName,
  validateCanonicalQuestionRowContent,
} from "../types";

const VALID_CONTENT = {
  questionType: "SINGLE_CHOICE" as const,
  prompt: "What is the correct answer?",
  answerOptions: [
    { id: "A", content: "Option A" },
    { id: "B", content: "Option B" },
  ],
  correctOptionIds: ["B"],
};

describe("validateCanonicalQuestionRowContent", () => {
  it("returns no errors for valid SINGLE_CHOICE content", () => {
    expect(validateCanonicalQuestionRowContent(VALID_CONTENT)).toEqual([]);
  });

  it("returns no errors for valid MULTIPLE_CHOICE content with more than one correct option", () => {
    expect(
      validateCanonicalQuestionRowContent({
        questionType: "MULTIPLE_CHOICE",
        prompt: "Select all that apply.",
        answerOptions: [
          { id: "A", content: "First" },
          { id: "B", content: "Second" },
          { id: "C", content: "Third" },
        ],
        correctOptionIds: ["A", "C"],
      }),
    ).toEqual([]);
  });

  it("rejects an empty (or whitespace-only) prompt", () => {
    const errors = validateCanonicalQuestionRowContent({ ...VALID_CONTENT, prompt: "   " });
    expect(errors.some((e) => e.includes("prompt"))).toBe(true);
  });

  it(`rejects fewer than ${MIN_PUBLISHABLE_OPTION_COUNT} options`, () => {
    const errors = validateCanonicalQuestionRowContent({
      ...VALID_CONTENT,
      answerOptions: [{ id: "A", content: "Only option" }],
      correctOptionIds: ["A"],
    });
    expect(errors.some((e) => e.includes("options are required"))).toBe(true);
  });

  it("rejects an empty/whitespace-only option content", () => {
    const errors = validateCanonicalQuestionRowContent({
      ...VALID_CONTENT,
      answerOptions: [
        { id: "A", content: "Option A" },
        { id: "B", content: "   " },
      ],
    });
    expect(errors.some((e) => e.includes('option "B"'))).toBe(true);
  });

  it("rejects SINGLE_CHOICE with more than one correct option (per-type cardinality, reused from assertValidQuestionAnswerDefinition)", () => {
    const errors = validateCanonicalQuestionRowContent({
      ...VALID_CONTENT,
      correctOptionIds: ["A", "B"],
    });
    expect(errors.some((e) => e.includes("exactly one correct option"))).toBe(true);
  });

  it("rejects MULTIPLE_CHOICE with zero correct options", () => {
    const errors = validateCanonicalQuestionRowContent({
      questionType: "MULTIPLE_CHOICE",
      prompt: "Prompt",
      answerOptions: [
        { id: "A", content: "First" },
        { id: "B", content: "Second" },
      ],
      correctOptionIds: [],
    });
    expect(errors.some((e) => e.includes("at least one correct option"))).toBe(true);
  });

  it("collects multiple distinct errors for the same row rather than stopping at the first", () => {
    const errors = validateCanonicalQuestionRowContent({
      questionType: "SINGLE_CHOICE",
      prompt: "",
      answerOptions: [{ id: "A", content: "Only option" }],
      correctOptionIds: ["A"],
    });
    expect(errors.length).toBeGreaterThanOrEqual(2);
    expect(errors.some((e) => e.includes("prompt"))).toBe(true);
    expect(errors.some((e) => e.includes("options are required"))).toBe(true);
  });
});

describe("resolveTopicByName / buildTopicNameIndex", () => {
  it("resolves a unique trimmed, case-insensitive match", () => {
    const index = buildTopicNameIndex([
      { id: "topic-1", name: "Introduction" },
      { id: "topic-2", name: "Advanced Topics" },
    ]);
    expect(resolveTopicByName("  introduction  ", index)).toEqual({
      outcome: "RESOLVED",
      topicId: "topic-1",
    });
  });

  it("reports NOT_FOUND for a name matching no Topic", () => {
    const index = buildTopicNameIndex([{ id: "topic-1", name: "Introduction" }]);
    expect(resolveTopicByName("Nonexistent", index)).toEqual({ outcome: "NOT_FOUND" });
  });

  it("reports AMBIGUOUS when more than one Topic normalizes to the same name, never choosing arbitrarily", () => {
    const index = buildTopicNameIndex([
      { id: "topic-1", name: "Introduction" },
      { id: "topic-2", name: "  introduction" },
    ]);
    expect(resolveTopicByName("introduction", index)).toEqual({ outcome: "AMBIGUOUS" });
  });

  it("resolves against an empty Topic list as NOT_FOUND, never throwing", () => {
    const index = buildTopicNameIndex([]);
    expect(resolveTopicByName("Anything", index)).toEqual({ outcome: "NOT_FOUND" });
  });
});

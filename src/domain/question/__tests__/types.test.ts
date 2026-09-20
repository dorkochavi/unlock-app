import { describe, expect, it } from "vitest";

import {
  assertSaveableQuestionDraftContent,
  computeQuestionAuthoringState,
  EMPTY_QUESTION_DRAFT,
  InvalidQuestionDraftContentError,
} from "../types";

describe("computeQuestionAuthoringState", () => {
  it("is DRAFT_ONLY when there is no current version, regardless of draft content", () => {
    expect(
      computeQuestionAuthoringState({ currentVersionId: null, draft: EMPTY_QUESTION_DRAFT }),
    ).toBe("DRAFT_ONLY");

    expect(
      computeQuestionAuthoringState({
        currentVersionId: null,
        draft: { ...EMPTY_QUESTION_DRAFT, prompt: "What is 2+2?" },
      }),
    ).toBe("DRAFT_ONLY");
  });

  it("is PUBLISHED when a current version exists and every draft field is null", () => {
    expect(
      computeQuestionAuthoringState({ currentVersionId: "version-1", draft: EMPTY_QUESTION_DRAFT }),
    ).toBe("PUBLISHED");
  });

  it("is PUBLISHED_WITH_DRAFT_CHANGES when a current version exists and any draft field is set", () => {
    expect(
      computeQuestionAuthoringState({
        currentVersionId: "version-1",
        draft: { ...EMPTY_QUESTION_DRAFT, explanation: "Because math." },
      }),
    ).toBe("PUBLISHED_WITH_DRAFT_CHANGES");
  });
});

describe("assertSaveableQuestionDraftContent", () => {
  it("allows a completely empty draft", () => {
    expect(() => assertSaveableQuestionDraftContent({})).not.toThrow();
  });

  it("allows an incomplete work-in-progress draft (no options, no correct answer)", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({ questionType: "SINGLE_CHOICE", prompt: "Draft only" }),
    ).not.toThrow();
  });

  it("allows correctOptionIds that do not (yet) reference a real option id", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({ correctOptionIds: ["not-a-real-option-yet"] }),
    ).not.toThrow();
  });

  it("allows SINGLE_CHOICE with zero or more than one correct option (publish-ready cardinality is a separate, stricter check)", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({
        questionType: "SINGLE_CHOICE",
        answerOptions: [
          { id: "a", content: "A" },
          { id: "b", content: "B" },
        ],
        correctOptionIds: ["a", "b"],
      }),
    ).not.toThrow();
  });

  it("rejects a duplicate answerOptions id", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({
        answerOptions: [
          { id: "a", content: "First" },
          { id: "a", content: "Second" },
        ],
      }),
    ).toThrow(InvalidQuestionDraftContentError);
  });

  it("rejects a duplicate correctOptionIds entry", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({ correctOptionIds: ["a", "a"] }),
    ).toThrow(InvalidQuestionDraftContentError);
  });

  it("rejects an unknown questionType", () => {
    expect(() =>
      assertSaveableQuestionDraftContent({
        // Simulates an untyped caller (e.g. a future raw API boundary) passing an invalid string.
        questionType: "TRUE_FALSE" as unknown as "SINGLE_CHOICE",
      }),
    ).toThrow(InvalidQuestionDraftContentError);
  });
});

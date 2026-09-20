import { describe, expect, it } from "vitest";

import {
  assertQuestionPublishReady,
  assertSaveableQuestionDraftContent,
  computeQuestionAuthoringState,
  EMPTY_QUESTION_DRAFT,
  InvalidQuestionDraftContentError,
  QuestionNotPublishReadyError,
  type QuestionPublishCandidateContent,
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

function validSingleChoiceCandidate(
  overrides: Partial<QuestionPublishCandidateContent> = {},
): QuestionPublishCandidateContent {
  return {
    topicId: "topic-1",
    questionType: "SINGLE_CHOICE",
    prompt: "What is 2+2?",
    answerOptions: [
      { id: "a", content: "3" },
      { id: "b", content: "4" },
    ],
    correctOptionIds: ["b"],
    explanation: null,
    ...overrides,
  };
}

describe("assertQuestionPublishReady", () => {
  it("accepts a complete, valid SINGLE_CHOICE draft and returns normalized content", () => {
    const result = assertQuestionPublishReady(validSingleChoiceCandidate());

    expect(result).toEqual({
      topicId: "topic-1",
      prompt: "What is 2+2?",
      questionType: "SINGLE_CHOICE",
      answerOptions: [
        { id: "a", content: "3" },
        { id: "b", content: "4" },
      ],
      correctOptionIds: ["b"],
      explanation: null,
    });
  });

  it("accepts a complete, valid MULTIPLE_CHOICE draft with more than one correct option", () => {
    const result = assertQuestionPublishReady(
      validSingleChoiceCandidate({
        questionType: "MULTIPLE_CHOICE",
        correctOptionIds: ["a", "b"],
      }),
    );

    expect(result.correctOptionIds).toEqual(["a", "b"]);
  });

  it("trims prompt and option content, and trims explanation to null when blank", () => {
    const result = assertQuestionPublishReady(
      validSingleChoiceCandidate({
        prompt: "  What is 2+2?  ",
        answerOptions: [
          { id: "a", content: "  3  " },
          { id: "b", content: "  4  " },
        ],
        explanation: "   ",
      }),
    );

    expect(result.prompt).toBe("What is 2+2?");
    expect(result.answerOptions).toEqual([
      { id: "a", content: "3" },
      { id: "b", content: "4" },
    ]);
    expect(result.explanation).toBeNull();
  });

  it("rejects a draft with no Topic chosen", () => {
    expect(() => assertQuestionPublishReady(validSingleChoiceCandidate({ topicId: null }))).toThrow(
      QuestionNotPublishReadyError,
    );
  });

  it("does not re-validate an already-associated Topic's archived state (Run 006 S1 decision #10) — publish readiness only requires a Topic id to be present", () => {
    // This function has no repository access and therefore cannot check
    // archived state itself either way — this test documents that the
    // CONTRACT only requires `topicId !== null`, matching the decision that
    // a since-archived already-associated Topic must not block publish.
    expect(() => assertQuestionPublishReady(validSingleChoiceCandidate({ topicId: "archived-topic" }))).not.toThrow();
  });

  it("rejects an empty prompt", () => {
    expect(() => assertQuestionPublishReady(validSingleChoiceCandidate({ prompt: "" }))).toThrow(
      QuestionNotPublishReadyError,
    );
  });

  it("rejects a whitespace-only prompt", () => {
    expect(() => assertQuestionPublishReady(validSingleChoiceCandidate({ prompt: "   " }))).toThrow(
      QuestionNotPublishReadyError,
    );
  });

  it("rejects a null prompt", () => {
    expect(() => assertQuestionPublishReady(validSingleChoiceCandidate({ prompt: null }))).toThrow(
      QuestionNotPublishReadyError,
    );
  });

  it("rejects a missing question type", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ questionType: null })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects zero options", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ answerOptions: [] })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects exactly one option (not a meaningful option count)", () => {
    expect(() =>
      assertQuestionPublishReady(
        validSingleChoiceCandidate({ answerOptions: [{ id: "a", content: "Only one" }] }),
      ),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects null answerOptions", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ answerOptions: null })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects whitespace-only option content", () => {
    expect(() =>
      assertQuestionPublishReady(
        validSingleChoiceCandidate({
          answerOptions: [
            { id: "a", content: "   " },
            { id: "b", content: "4" },
          ],
        }),
      ),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects null correctOptionIds", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ correctOptionIds: null })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects empty correctOptionIds", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ correctOptionIds: [] })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects a duplicate option id (reuses assertValidQuestionAnswerDefinition, not a second vocabulary)", () => {
    expect(() =>
      assertQuestionPublishReady(
        validSingleChoiceCandidate({
          answerOptions: [
            { id: "a", content: "First" },
            { id: "a", content: "Second" },
          ],
        }),
      ),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects correctOptionIds referencing a removed/unknown option", () => {
    expect(() =>
      assertQuestionPublishReady(validSingleChoiceCandidate({ correctOptionIds: ["not-an-option"] })),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects SINGLE_CHOICE with more than one correct option (switched from MULTIPLE_CHOICE without updating the correct answer)", () => {
    expect(() =>
      assertQuestionPublishReady(
        validSingleChoiceCandidate({ questionType: "SINGLE_CHOICE", correctOptionIds: ["a", "b"] }),
      ),
    ).toThrow(QuestionNotPublishReadyError);
  });

  it("rejects MULTIPLE_CHOICE with zero correct options", () => {
    expect(() =>
      assertQuestionPublishReady(
        validSingleChoiceCandidate({ questionType: "MULTIPLE_CHOICE", correctOptionIds: [] }),
      ),
    ).toThrow(QuestionNotPublishReadyError);
  });
});

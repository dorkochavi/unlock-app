import { describe, expect, it } from "vitest";
import { classifyAttemptEvidence } from "../evidence";
import type { Attempt } from "../types";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    submissionId: "submission-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "question-version-1",
    answeredAt: new Date("2026-09-16T17:00:00.000Z"),
    isCorrect: true,
    selectedAnswer: 1,
    confidenceLevel: "medium",
    responseTimeSeconds: 12,
    todaySessionId: "today-1",
    todaySessionItemId: "today-item-1",
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "learning_engine_v1.0",
    ...overrides,
  };
}

describe("classifyAttemptEvidence", () => {
  it("classifies a normal first unassisted attempt as full evidence", () => {
    const result = classifyAttemptEvidence(makeAttempt());

    expect(result.quality).toBe("FULL_EVIDENCE");
    expect(result.reasons).toEqual([]);
  });

  it("classifies a 50/50-assisted answer as assisted evidence", () => {
    const result = classifyAttemptEvidence(
      makeAttempt({ assistanceUsed: "FIFTY_FIFTY" }),
    );

    expect(result.quality).toBe("ASSISTED_EVIDENCE");
  });

  it("does not let a second attempt become full mastery evidence", () => {
    const result = classifyAttemptEvidence(
      makeAttempt({
        attemptNumberForPresentedItem: 2,
        isCorrect: true,
      }),
    );

    expect(result.quality).toBe("LOW_QUALITY_EVIDENCE");
  });

  it("classifies a revealed answer as invalid for mastery", () => {
    const result = classifyAttemptEvidence(
      makeAttempt({
        assistanceUsed: "ANSWER_REVEALED",
      }),
    );

    expect(result.quality).toBe("INVALID_FOR_MASTERY");
  });

  it("downgrades suspicious timing instead of using a hard seconds threshold", () => {
    const result = classifyAttemptEvidence(
      makeAttempt({
        responseTimeSeconds: 0.9,
        suspiciousTiming: true,
      }),
    );

    expect(result.quality).toBe("LOW_QUALITY_EVIDENCE");
  });

  it("does not treat missing response time as invalid evidence", () => {
    const result = classifyAttemptEvidence(
      makeAttempt({
        responseTimeSeconds: null,
      }),
    );

    expect(result.quality).toBe("FULL_EVIDENCE");
  });
});

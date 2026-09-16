import { describe, expect, it } from "vitest";
import { classifyAttemptEvidence } from "../evidence";
import { mapEvidenceToSchedulerRating } from "../scheduler-rating";
import type { Attempt } from "../types";

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    submissionId: "submission-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "question-version-1",
    answeredAt: new Date("2026-09-16T18:00:00.000Z"),
    isCorrect: true,
    selectedAnswer: 1,
    confidenceLevel: "medium",
    responseTimeSeconds: 10,
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

describe("mapEvidenceToSchedulerRating", () => {
  it("maps clean correct evidence to GOOD", () => {
    const evidence = classifyAttemptEvidence(makeAttempt({ isCorrect: true }));

    expect(
      mapEvidenceToSchedulerRating({
        evidence,
        confidenceLevel: "high",
      }),
    ).toEqual({
      kind: "RATED",
      rating: "GOOD",
      reason: "full_evidence_correct",
    });
  });

  it("maps clean incorrect evidence to AGAIN", () => {
    const evidence = classifyAttemptEvidence(makeAttempt({ isCorrect: false }));

    expect(
      mapEvidenceToSchedulerRating({
        evidence,
        confidenceLevel: "high",
      }),
    ).toEqual({
      kind: "RATED",
      rating: "AGAIN",
      reason: "full_evidence_incorrect",
    });
  });

  it("does not infer HARD from a slow correct answer", () => {
    const evidence = classifyAttemptEvidence(
      makeAttempt({
        isCorrect: true,
        responseTimeSeconds: 120,
      }),
    );

    const decision = mapEvidenceToSchedulerRating({
      evidence,
      confidenceLevel: "low",
    });

    expect(decision).toMatchObject({
      kind: "RATED",
      rating: "GOOD",
    });
  });

  it("does not infer EASY from high confidence", () => {
    const evidence = classifyAttemptEvidence(
      makeAttempt({
        isCorrect: true,
        confidenceLevel: "high",
      }),
    );

    const decision = mapEvidenceToSchedulerRating({
      evidence,
      confidenceLevel: "high",
    });

    expect(decision).toMatchObject({
      kind: "RATED",
      rating: "GOOD",
    });
  });

  it("does not rate 50/50-assisted evidence yet", () => {
    const evidence = classifyAttemptEvidence(
      makeAttempt({
        isCorrect: true,
        assistanceUsed: "FIFTY_FIFTY",
      }),
    );

    expect(
      mapEvidenceToSchedulerRating({
        evidence,
        confidenceLevel: "medium",
      }),
    ).toEqual({
      kind: "NOT_RATABLE",
      reason: "evidence_quality:ASSISTED_EVIDENCE",
    });
  });

  it("does not rate second-attempt evidence", () => {
    const evidence = classifyAttemptEvidence(
      makeAttempt({
        isCorrect: true,
        attemptNumberForPresentedItem: 2,
      }),
    );

    expect(
      mapEvidenceToSchedulerRating({
        evidence,
        confidenceLevel: "medium",
      }),
    ).toEqual({
      kind: "NOT_RATABLE",
      reason: "evidence_quality:LOW_QUALITY_EVIDENCE",
    });
  });
});

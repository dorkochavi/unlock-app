import { describe, expect, it } from "vitest";

import { validateEvidenceStrengthPolicy } from "../../../domain/learning/evidence-strength";
import { validateRetrievalQualificationPolicy } from "../../../domain/learning/retrieval-qualification";
import { validateTodayPlannerPolicy } from "../../../domain/learning/today-planner";
import {
  PRODUCTION_ENGINE_VERSION,
  PRODUCTION_EVIDENCE_STRENGTH_POLICY,
  PRODUCTION_MASTERY_POLICY,
  PRODUCTION_MISCONCEPTION_POLICY,
  PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
  PRODUCTION_TODAY_PLANNER_POLICY,
} from "../production-policy-defaults";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("production policy defaults", () => {
  it("match the documented RetrievalQualificationPolicy default (docs/OPEN_QUESTIONS.md #12)", () => {
    expect(PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY).toEqual({
      minGapMsForSpacedRetrieval: DAY_MS,
    });
    expect(() =>
      validateRetrievalQualificationPolicy(
        PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
      ),
    ).not.toThrow();
  });

  it("match the documented EvidenceStrengthPolicy default", () => {
    expect(PRODUCTION_EVIDENCE_STRENGTH_POLICY).toEqual({
      minMeaningfulAttemptsForEarly: 1,
      minMeaningfulAttemptsForModerate: 3,
      minMeaningfulAttemptsForStrong: 5,
      minSpacedRetrievalsForModerate: 1,
      minSpacedRetrievalsForStrong: 3,
      minObservationSpanMsForStrong: 3 * DAY_MS,
    });
    expect(() =>
      validateEvidenceStrengthPolicy(PRODUCTION_EVIDENCE_STRENGTH_POLICY),
    ).not.toThrow();
  });

  it("match the documented MasteryPolicy default (docs/OPEN_QUESTIONS.md #11, docs/LEARNING_ENGINE.md §16b)", () => {
    expect(PRODUCTION_MASTERY_POLICY).toEqual({
      minSpacedRetrievalsForStrengthening: 1,
      minSpacedRetrievalsForMastered: 3,
      minEvidenceStrengthForMastered: "strong",
      minRetrievabilityForMastered: 0.8,
    });
  });

  it("match the documented MisconceptionPolicy default (docs/OPEN_QUESTIONS.md #13)", () => {
    expect(PRODUCTION_MISCONCEPTION_POLICY).toEqual({
      confidentErrorScoreIncrement: 2,
      recoveryScoreDecrement: 1,
      minScore: 0,
      maxScore: 10,
      suspectedScoreThreshold: 2,
      activeScoreThreshold: 4,
      resolvedScoreThreshold: 0,
    });
  });

  it("a single confident-error signal never reaches activeScoreThreshold alone", () => {
    const { minScore, confidentErrorScoreIncrement, activeScoreThreshold } =
      PRODUCTION_MISCONCEPTION_POLICY;
    expect(minScore + confidentErrorScoreIncrement).toBeLessThan(
      activeScoreThreshold,
    );
  });

  it("match the documented TodayPlannerPolicy default (docs/OPEN_QUESTIONS.md #16, ADR-016 §5 hard maximum)", () => {
    expect(PRODUCTION_TODAY_PLANNER_POLICY).toEqual({ maxItems: 15 });
    expect(() =>
      validateTodayPlannerPolicy(PRODUCTION_TODAY_PLANNER_POLICY),
    ).not.toThrow();
  });

  it("has a stable, non-empty production engine version", () => {
    expect(PRODUCTION_ENGINE_VERSION).toBe("learning-engine-v1");
  });
});

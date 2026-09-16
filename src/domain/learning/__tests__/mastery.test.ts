import { describe, expect, it } from "vitest";
import {
  deriveMasteryCategory,
  type MasteryPolicy,
} from "../mastery";

const TEST_POLICY: MasteryPolicy = {
  minSpacedRetrievalsForStrengthening: 1,
  minSpacedRetrievalsForMastered: 3,
  minEvidenceStrengthForMastered: "moderate",
  minRetrievabilityForMastered: 0.85,
};

describe("deriveMasteryCategory", () => {
  it("returns not_started when there is no meaningful evidence", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 0,
          successfulSpacedRetrievals: 0,
          lapseCount: 0,
          evidenceStrength: "insufficient",
          retrievabilityEstimate: null,
          hasUnresolvedLapse: false,
        },
        TEST_POLICY,
      ),
    ).toBe("not_started");
  });

  it("does not allow same-session volume alone to create mastery", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 5,
          successfulSpacedRetrievals: 0,
          lapseCount: 0,
          evidenceStrength: "early",
          retrievabilityEstimate: 0.99,
          hasUnresolvedLapse: false,
        },
        TEST_POLICY,
      ),
    ).toBe("learning");
  });

  it("moves to strengthening after sufficient spaced retrieval evidence", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 3,
          successfulSpacedRetrievals: 1,
          lapseCount: 0,
          evidenceStrength: "early",
          retrievabilityEstimate: 0.8,
          hasUnresolvedLapse: false,
        },
        TEST_POLICY,
      ),
    ).toBe("strengthening");
  });

  it("can reach mastered when spacing, evidence strength, and retrievability all qualify", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 6,
          successfulSpacedRetrievals: 3,
          lapseCount: 0,
          evidenceStrength: "strong",
          retrievabilityEstimate: 0.92,
          hasUnresolvedLapse: false,
        },
        TEST_POLICY,
      ),
    ).toBe("mastered");
  });

  it("does not remain mastered while a lapse is unresolved", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 8,
          successfulSpacedRetrievals: 5,
          lapseCount: 1,
          evidenceStrength: "strong",
          retrievabilityEstimate: 0.95,
          hasUnresolvedLapse: true,
        },
        TEST_POLICY,
      ),
    ).toBe("strengthening");
  });

  it("does not fake mastery when retrievability is unavailable but the policy requires it", () => {
    expect(
      deriveMasteryCategory(
        {
          meaningfulAttemptCount: 8,
          successfulSpacedRetrievals: 5,
          lapseCount: 0,
          evidenceStrength: "strong",
          retrievabilityEstimate: null,
          hasUnresolvedLapse: false,
        },
        TEST_POLICY,
      ),
    ).toBe("strengthening");
  });
});

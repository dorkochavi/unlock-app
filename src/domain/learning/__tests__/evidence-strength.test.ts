import { describe, expect, it } from "vitest";
import {
  deriveEvidenceStrength,
  type EvidenceStrengthInput,
  type EvidenceStrengthPolicy,
} from "../evidence-strength";

const DAY_MS = 24 * 60 * 60 * 1000;

const TEST_POLICY: EvidenceStrengthPolicy = {
  minMeaningfulAttemptsForEarly: 1,
  minMeaningfulAttemptsForModerate: 3,
  minMeaningfulAttemptsForStrong: 5,
  minSpacedRetrievalsForModerate: 1,
  minSpacedRetrievalsForStrong: 3,
  minObservationSpanMsForStrong: 3 * DAY_MS,
};

const EVIDENCE_STRENGTH_RANK = {
  insufficient: 0,
  early: 1,
  moderate: 2,
  strong: 3,
} as const;

function makeInput(
  overrides: Partial<EvidenceStrengthInput> = {},
): EvidenceStrengthInput {
  return {
    meaningfulAttemptCount: 0,
    successfulSpacedRetrievals: 0,
    observationSpanMs: null,
    assistedAttemptCount: 0,
    lowQualityAttemptCount: 0,
    hasOnlySameSessionEvidence: null,
    ...overrides,
  };
}

describe("deriveEvidenceStrength", () => {
  it("A. returns insufficient when there is no meaningful evidence", () => {
    const result = deriveEvidenceStrength(makeInput(), TEST_POLICY);

    expect(result.strength).toBe("insufficient");
    expect(result.reasons).toEqual(["NO_MEANINGFUL_EVIDENCE"]);
  });

  it("B. returns early for one clean meaningful attempt", () => {
    const result = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 1,
        hasOnlySameSessionEvidence: true,
      }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("early");
    expect(result.reasons).toEqual(["EARLY_EVIDENCE"]);
  });

  it("C. cannot become strong from repeated same-session attempts without spaced retrieval", () => {
    const result = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 10,
        successfulSpacedRetrievals: 0,
        observationSpanMs: 0,
        hasOnlySameSessionEvidence: true,
      }),
      TEST_POLICY,
    );

    expect(result.strength).not.toBe("strong");
    expect(result.strength).toBe("early");
    expect(result.reasons).toEqual(["EARLY_EVIDENCE", "INSUFFICIENT_SPACING"]);
  });

  it("C2. caps at moderate for same-session-only evidence even when attempts/spacing/span alone would qualify as strong", () => {
    // Regression test isolating the explicit session gate: every other
    // strong-tier gate is satisfied here, so this proves the cap is a
    // real, independent check rather than an accident of the spacing gate.
    const result = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 5,
        successfulSpacedRetrievals: 3,
        observationSpanMs: 4 * DAY_MS,
        hasOnlySameSessionEvidence: true,
      }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("moderate");
    expect(result.reasons).toEqual(["MODERATE_EVIDENCE", "SAME_SESSION_ONLY"]);
  });

  it("D. reaches moderate with sufficient meaningful attempts and some spaced retrievals", () => {
    const result = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 3,
        successfulSpacedRetrievals: 1,
        observationSpanMs: 1 * DAY_MS,
        hasOnlySameSessionEvidence: false,
      }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("moderate");
    expect(result.reasons).toEqual(["MODERATE_EVIDENCE"]);
  });

  it("E. reaches strong with multiple spaced retrievals and a long enough observation span", () => {
    const result = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 5,
        successfulSpacedRetrievals: 3,
        observationSpanMs: 4 * DAY_MS,
        hasOnlySameSessionEvidence: false,
      }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("strong");
    expect(result.reasons).toEqual(["STRONG_EVIDENCE"]);
  });

  it("F. does not become moderate/strong from an assisted-only history", () => {
    const result = deriveEvidenceStrength(
      makeInput({ assistedAttemptCount: 8 }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("insufficient");
    expect(result.reasons).toEqual(["ASSISTANCE_HEAVY"]);
  });

  it("G. does not become moderate/strong from a low-quality-only history", () => {
    const result = deriveEvidenceStrength(
      makeInput({ lowQualityAttemptCount: 6 }),
      TEST_POLICY,
    );

    expect(result.strength).toBe("insufficient");
    expect(result.reasons).toEqual(["ASSISTANCE_HEAVY"]);
  });

  it("H. does not reduce strength when valid spaced evidence is added", () => {
    const moderate = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 3,
        successfulSpacedRetrievals: 1,
        observationSpanMs: 1 * DAY_MS,
        hasOnlySameSessionEvidence: false,
      }),
      TEST_POLICY,
    );

    const strong = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 5,
        successfulSpacedRetrievals: 3,
        observationSpanMs: 4 * DAY_MS,
        hasOnlySameSessionEvidence: false,
      }),
      TEST_POLICY,
    );

    expect(EVIDENCE_STRENGTH_RANK[strong.strength]).toBeGreaterThanOrEqual(
      EVIDENCE_STRENGTH_RANK[moderate.strength],
    );
  });

  it("I. rejects a policy with contradictory thresholds", () => {
    const contradictoryPolicy: EvidenceStrengthPolicy = {
      ...TEST_POLICY,
      minMeaningfulAttemptsForModerate: 5,
      minMeaningfulAttemptsForStrong: 2,
    };

    expect(() =>
      deriveEvidenceStrength(makeInput(), contradictoryPolicy),
    ).toThrow(/contradictory/);
  });

  it("J. is deterministic for identical input", () => {
    const input = makeInput({
      meaningfulAttemptCount: 5,
      successfulSpacedRetrievals: 3,
      observationSpanMs: 4 * DAY_MS,
      hasOnlySameSessionEvidence: false,
    });

    const resultA = deriveEvidenceStrength(input, TEST_POLICY);
    const resultB = deriveEvidenceStrength(input, TEST_POLICY);

    expect(resultA).toEqual(resultB);
  });

  it("K. does not let a missing observation span silently become a positive strength signal", () => {
    const spanUnknown = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 5,
        successfulSpacedRetrievals: 3,
        observationSpanMs: null,
        hasOnlySameSessionEvidence: false,
      }),
      TEST_POLICY,
    );

    expect(spanUnknown.strength).toBe("moderate");
    expect(spanUnknown.reasons).toEqual([
      "MODERATE_EVIDENCE",
      "INSUFFICIENT_OBSERVATION_SPAN",
    ]);

    const sessionUnknown = deriveEvidenceStrength(
      makeInput({
        meaningfulAttemptCount: 5,
        successfulSpacedRetrievals: 3,
        observationSpanMs: 4 * DAY_MS,
        hasOnlySameSessionEvidence: null,
      }),
      TEST_POLICY,
    );

    expect(sessionUnknown.strength).toBe("moderate");
    expect(sessionUnknown.reasons).toEqual([
      "MODERATE_EVIDENCE",
      "SESSION_DIVERSITY_UNKNOWN",
    ]);
  });

  it("L. reasons explain the outcome with typed codes", () => {
    expect(deriveEvidenceStrength(makeInput(), TEST_POLICY).reasons).toEqual([
      "NO_MEANINGFUL_EVIDENCE",
    ]);

    expect(
      deriveEvidenceStrength(
        makeInput({ meaningfulAttemptCount: 1 }),
        TEST_POLICY,
      ).reasons,
    ).toEqual(["EARLY_EVIDENCE"]);

    expect(
      deriveEvidenceStrength(
        makeInput({
          meaningfulAttemptCount: 3,
          successfulSpacedRetrievals: 1,
          hasOnlySameSessionEvidence: false,
        }),
        TEST_POLICY,
      ).reasons,
    ).toEqual(["MODERATE_EVIDENCE"]);

    expect(
      deriveEvidenceStrength(
        makeInput({
          meaningfulAttemptCount: 5,
          successfulSpacedRetrievals: 3,
          observationSpanMs: 4 * DAY_MS,
          hasOnlySameSessionEvidence: false,
        }),
        TEST_POLICY,
      ).reasons,
    ).toEqual(["STRONG_EVIDENCE"]);
  });
});

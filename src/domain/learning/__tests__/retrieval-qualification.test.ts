import { describe, expect, it } from "vitest";
import {
  qualifyRetrieval,
  type RetrievalQualificationInput,
  type RetrievalQualificationPolicy,
} from "../retrieval-qualification";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const TEST_POLICY: RetrievalQualificationPolicy = {
  minGapMsForSpacedRetrieval: 1 * DAY_MS,
};

function makeInput(
  overrides: Partial<RetrievalQualificationInput> = {},
): RetrievalQualificationInput {
  return {
    currentAttemptAt: new Date("2026-01-10T00:00:00.000Z"),
    isCorrect: true,
    currentEvidenceQuality: "FULL_EVIDENCE",
    previousRetrievalBaselineAt: null,
    isSameLearningSession: false,
    ...overrides,
  };
}

describe("qualifyRetrieval", () => {
  it("A. does not qualify a first clean correct retrieval with no prior qualifying retrieval", () => {
    const result = qualifyRetrieval(
      makeInput({ previousRetrievalBaselineAt: null }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.gapMs).toBeNull();
    expect(result.reason).toBe("NO_PRIOR_RETRIEVAL");
  });

  it("B. does not qualify a second clean correct retrieval in the same session, even with a large gap", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-02-01T00:00:00.000Z"),
        isSameLearningSession: true,
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("SAME_SESSION");
    expect(result.gapMs).toBe(31 * DAY_MS);
  });

  it("C. does not qualify a second clean correct retrieval in a different session with too short a gap", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-01T12:00:00.000Z"),
        isSameLearningSession: false,
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("GAP_TOO_SHORT");
    expect(result.gapMs).toBe(12 * HOUR_MS);
  });

  it("D. qualifies a second clean correct retrieval in a different session with a sufficient gap", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-03T00:00:00.000Z"),
        isSameLearningSession: false,
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(true);
    expect(result.reason).toBe("QUALIFYING_SPACED_RETRIEVAL");
    expect(result.gapMs).toBe(2 * DAY_MS);
  });

  it("E. does not qualify an assisted correct answer", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
        isSameLearningSession: false,
        currentEvidenceQuality: "ASSISTED_EVIDENCE",
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("NOT_FULL_EVIDENCE");
    expect(result.gapMs).toBeNull();
  });

  it("F. does not qualify second-attempt/low-quality evidence", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
        isSameLearningSession: false,
        currentEvidenceQuality: "LOW_QUALITY_EVIDENCE",
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("NOT_FULL_EVIDENCE");
    expect(result.gapMs).toBeNull();
  });

  it("G. does not qualify a clean incorrect attempt", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
        isSameLearningSession: false,
        isCorrect: false,
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("INCORRECT");
    expect(result.gapMs).toBeNull();
  });

  it("H. does not qualify when session identity is unknown, under the conservative policy", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
        isSameLearningSession: null,
      }),
      TEST_POLICY,
    );

    expect(result.qualifies).toBe(false);
    expect(result.reason).toBe("SESSION_UNKNOWN");
    expect(result.gapMs).toBe(4 * DAY_MS);
  });

  it("I. qualifies at exactly the threshold gap (policy uses >=)", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date(
          new Date("2026-01-01T00:00:00.000Z").getTime() +
            TEST_POLICY.minGapMsForSpacedRetrieval,
        ),
        isSameLearningSession: false,
      }),
      TEST_POLICY,
    );

    expect(result.gapMs).toBe(TEST_POLICY.minGapMsForSpacedRetrieval);
    expect(result.qualifies).toBe(true);
    expect(result.reason).toBe("QUALIFYING_SPACED_RETRIEVAL");
  });

  it("J. rejects an invalid policy (negative, NaN, or infinite min gap)", () => {
    for (const invalidGap of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() =>
        qualifyRetrieval(makeInput(), {
          minGapMsForSpacedRetrieval: invalidGap,
        }),
      ).toThrow();
    }
  });

  it("K. is deterministic for identical input", () => {
    const input = makeInput({
      previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
      currentAttemptAt: new Date("2026-01-03T00:00:00.000Z"),
      isSameLearningSession: false,
    });

    const resultA = qualifyRetrieval(input, TEST_POLICY);
    const resultB = qualifyRetrieval(input, TEST_POLICY);

    expect(resultA).toEqual(resultB);
  });

  it("L. reports an explicit and correct gapMs when a prior qualifying retrieval exists", () => {
    const result = qualifyRetrieval(
      makeInput({
        previousRetrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
        currentAttemptAt: new Date("2026-01-04T06:00:00.000Z"),
        isSameLearningSession: false,
      }),
      TEST_POLICY,
    );

    expect(result.gapMs).toBe(3 * DAY_MS + 6 * HOUR_MS);
  });

  it("M. fails fast rather than silently computing a negative gap when currentAttemptAt is earlier than previousRetrievalBaselineAt", () => {
    expect(() =>
      qualifyRetrieval(
        makeInput({
          previousRetrievalBaselineAt: new Date("2026-01-10T00:00:00.000Z"),
          currentAttemptAt: new Date("2026-01-01T00:00:00.000Z"),
          isSameLearningSession: false,
        }),
        TEST_POLICY,
      ),
    ).toThrow(/earlier than/);
  });
});

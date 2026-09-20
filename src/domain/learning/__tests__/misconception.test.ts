import { describe, expect, it } from "vitest";
import { classifyAttemptEvidence } from "../evidence";
import {
  applyMisconceptionSignal,
  type MisconceptionPolicy,
  type MisconceptionSnapshot,
} from "../misconception";
import type { Attempt } from "../types";

const TEST_POLICY: MisconceptionPolicy = {
  confidentErrorScoreIncrement: 2,
  recoveryScoreDecrement: 1,
  minScore: 0,
  maxScore: 10,
  suspectedScoreThreshold: 2,
  activeScoreThreshold: 4,
  resolvedScoreThreshold: 0,
};

function makeAttempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "attempt-1",
    submissionId: "submission-1",
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "question-version-1",
    answeredAt: new Date("2026-01-01T00:00:00.000Z"),
    isCorrect: false,
    selectedAnswer: "1",
    confidenceLevel: "high",
    responseTimeSeconds: 10,
    todaySessionId: null,
    todaySessionItemId: null,
    dailyPlanId: null,
    dailyPlanItemId: null,
    learningSessionId: null,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "learning_engine_v1.0",
    ...overrides,
  };
}

/**
 * Mirrors progress-update.ts's CONFIDENT_ERROR gate exactly, so these
 * tests prove realistic wiring without actually coupling misconception.ts
 * to evidence.ts/progress-update.ts.
 */
function isConfidentErrorSignal(attempt: Attempt): boolean {
  const evidence = classifyAttemptEvidence(attempt);
  return (
    !attempt.isCorrect &&
    attempt.confidenceLevel === "high" &&
    evidence.quality === "FULL_EVIDENCE"
  );
}

describe("applyMisconceptionSignal", () => {
  it("A. moves none -> suspected on a first clean high-confidence wrong answer, under a policy requiring >1 signal for active", () => {
    const attempt = makeAttempt();
    const observedAt = attempt.answeredAt;

    const result = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: isConfidentErrorSignal(attempt),
        isQualifyingRecoveryEvidence: false,
        observedAt,
      },
      TEST_POLICY,
    );

    expect(isConfidentErrorSignal(attempt)).toBe(true);
    expect(result.score).toBe(2);
    expect(result.state).toBe("suspected");
    expect(result.reason).toBe("MISCONCEPTION_SUSPECTED");
    expect(result.lastSeenAt).toEqual(observedAt);
  });

  it("B. escalates suspected -> active once the repeated confident-error signals cross the activation threshold", () => {
    const first = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      TEST_POLICY,
    );
    expect(first.state).toBe("suspected");
    expect(first.reason).toBe("MISCONCEPTION_SUSPECTED");

    const second = applyMisconceptionSignal(
      first,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      TEST_POLICY,
    );

    expect(second.score).toBe(4);
    expect(second.state).toBe("active");
    expect(second.reason).toBe("MISCONCEPTION_ACTIVATED");
  });

  it("C. does not escalate misconception for an assisted high-confidence wrong answer", () => {
    const attempt = makeAttempt({ assistanceUsed: "FIFTY_FIFTY" });

    expect(isConfidentErrorSignal(attempt)).toBe(false);

    const result = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: isConfidentErrorSignal(attempt),
        isQualifyingRecoveryEvidence: false,
        observedAt: attempt.answeredAt,
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("none");
    expect(result.score).toBe(0);
    expect(result.reason).toBe("NO_CHANGE");
  });

  it("D. does not escalate misconception for a second-attempt high-confidence wrong answer", () => {
    const attempt = makeAttempt({ attemptNumberForPresentedItem: 2 });

    expect(isConfidentErrorSignal(attempt)).toBe(false);

    const result = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: isConfidentErrorSignal(attempt),
        isQualifyingRecoveryEvidence: false,
        observedAt: attempt.answeredAt,
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("none");
    expect(result.reason).toBe("NO_CHANGE");
  });

  it("E. does not escalate misconception for revealed-answer/invalid evidence", () => {
    const attempt = makeAttempt({
      assistanceUsed: "ANSWER_REVEALED",
      answerWasRevealedBeforeResponse: true,
    });

    expect(isConfidentErrorSignal(attempt)).toBe(false);

    const result = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: isConfidentErrorSignal(attempt),
        isQualifyingRecoveryEvidence: false,
        observedAt: attempt.answeredAt,
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("none");
    expect(result.reason).toBe("NO_CHANGE");
  });

  it("F. does not treat an ordinary low-confidence wrong answer as the strong misconception signal", () => {
    const attempt = makeAttempt({ confidenceLevel: "low" });

    expect(isConfidentErrorSignal(attempt)).toBe(false);

    const result = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: isConfidentErrorSignal(attempt),
        isQualifyingRecoveryEvidence: false,
        observedAt: attempt.answeredAt,
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("none");
    expect(result.score).toBe(0);
    expect(result.reason).toBe("NO_CHANGE");
  });

  it("G. does not resolve automatically on one immediate correct answer while active", () => {
    const active: MisconceptionSnapshot = {
      state: "active",
      score: 4,
      lastSeenAt: new Date("2026-01-03T00:00:00.000Z"),
    };

    const result = applyMisconceptionSignal(
      active,
      {
        isConfidentErrorSignal: false,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-03T00:05:00.000Z"),
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("active");
    expect(result.score).toBe(4);
    expect(result.reason).toBe("NO_CHANGE");
    // NO_CHANGE must not update lastSeenAt.
    expect(result.lastSeenAt).toEqual(active.lastSeenAt);
  });

  it("H. moves active -> recovering on qualifying recovery evidence", () => {
    const active: MisconceptionSnapshot = {
      state: "active",
      score: 4,
      lastSeenAt: new Date("2026-01-03T00:00:00.000Z"),
    };

    const result = applyMisconceptionSignal(
      active,
      {
        isConfidentErrorSignal: false,
        isQualifyingRecoveryEvidence: true,
        observedAt: new Date("2026-01-10T00:00:00.000Z"),
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("recovering");
    expect(result.score).toBe(3);
    expect(result.reason).toBe("MISCONCEPTION_RECOVERING");
  });

  it("H2. reactivates directly to active on a new confident error while recovering, per the score-driven design", () => {
    // Regression test for the previously-unvalidated (recovering +
    // confident-error) path. This is intentionally NOT special-cased in
    // deriveNextState: a confident-error signal only ever escalates based
    // on where the resulting score lands relative to the thresholds,
    // regardless of previousState. Starting from H's exact post-state
    // (recovering, score 3), the increment (2) lands the score at 5,
    // which is >= activeScoreThreshold (4), so this reactivates directly
    // to "active" rather than passing back through "suspected".
    const recovering: MisconceptionSnapshot = {
      state: "recovering",
      score: 3,
      lastSeenAt: new Date("2026-01-10T00:00:00.000Z"),
    };

    const result = applyMisconceptionSignal(
      recovering,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-12T00:00:00.000Z"),
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("active");
    expect(result.score).toBe(5);
    expect(result.reason).toBe("MISCONCEPTION_ACTIVATED");
    expect(result.lastSeenAt).toEqual(new Date("2026-01-12T00:00:00.000Z"));
  });

  it("I. moves recovering -> resolved once enough qualifying recovery evidence is observed", () => {
    let snapshot: MisconceptionSnapshot = {
      state: "recovering",
      score: 3,
      lastSeenAt: new Date("2026-01-10T00:00:00.000Z"),
    };

    let day = 11;
    let last = applyMisconceptionSignal(
      snapshot,
      {
        isConfidentErrorSignal: false,
        isQualifyingRecoveryEvidence: true,
        observedAt: new Date(`2026-01-${day}T00:00:00.000Z`),
      },
      TEST_POLICY,
    );
    expect(last.state).toBe("recovering");
    expect(last.score).toBe(2);

    while (last.state === "recovering") {
      day += 1;
      snapshot = last;
      last = applyMisconceptionSignal(
        snapshot,
        {
          isConfidentErrorSignal: false,
          isQualifyingRecoveryEvidence: true,
          observedAt: new Date(`2026-01-${day}T00:00:00.000Z`),
        },
        TEST_POLICY,
      );
    }

    expect(last.state).toBe("resolved");
    expect(last.score).toBe(0);
    expect(last.reason).toBe("MISCONCEPTION_RESOLVED");
  });

  it("J. allows a new confident error after resolved to reopen/suspect misconception", () => {
    const resolved: MisconceptionSnapshot = {
      state: "resolved",
      score: 0,
      lastSeenAt: new Date("2026-01-20T00:00:00.000Z"),
    };

    const result = applyMisconceptionSignal(
      resolved,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      TEST_POLICY,
    );

    expect(result.state).toBe("suspected");
    expect(result.reason).toBe("MISCONCEPTION_SUSPECTED");
    expect(result.score).toBe(2);
  });

  it("K. keeps the score within the policy-documented bounds", () => {
    let snapshot: MisconceptionSnapshot | null = null;

    for (let i = 0; i < 20; i += 1) {
      snapshot = applyMisconceptionSignal(
        snapshot,
        {
          isConfidentErrorSignal: true,
          isQualifyingRecoveryEvidence: false,
          observedAt: new Date(2026, 0, 1 + i),
        },
        TEST_POLICY,
      );
    }

    expect(snapshot?.score).toBeLessThanOrEqual(TEST_POLICY.maxScore);
    expect(snapshot?.score).toBeGreaterThanOrEqual(TEST_POLICY.minScore);

    for (let i = 0; i < 20; i += 1) {
      snapshot = applyMisconceptionSignal(
        snapshot,
        {
          isConfidentErrorSignal: false,
          isQualifyingRecoveryEvidence: true,
          observedAt: new Date(2026, 1, 1 + i),
        },
        TEST_POLICY,
      );
    }

    expect(snapshot?.score).toBeLessThanOrEqual(TEST_POLICY.maxScore);
    expect(snapshot?.score).toBeGreaterThanOrEqual(TEST_POLICY.minScore);
  });

  it("L. is deterministic for the same inputs", () => {
    const previous: MisconceptionSnapshot = {
      state: "suspected",
      score: 2,
      lastSeenAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const input = {
      isConfidentErrorSignal: true,
      isQualifyingRecoveryEvidence: false,
      observedAt: new Date("2026-01-05T00:00:00.000Z"),
    };

    const resultA = applyMisconceptionSignal(previous, input, TEST_POLICY);
    const resultB = applyMisconceptionSignal(previous, input, TEST_POLICY);

    expect(resultA).toEqual(resultB);
  });

  it("M. lastSeenAt reflects the last misconception-relevant evidence observed, not the last state transition", () => {
    const first = applyMisconceptionSignal(
      null,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      TEST_POLICY,
    );
    expect(first.state).toBe("suspected");
    expect(first.lastSeenAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));

    // This signal DOES cause a transition (suspected -> active); lastSeenAt
    // still moves to the new evidence's timestamp either way.
    const second = applyMisconceptionSignal(
      first,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
      TEST_POLICY,
    );
    expect(second.state).toBe("active");
    expect(second.lastSeenAt).toEqual(new Date("2026-01-02T00:00:00.000Z"));

    // A further confident-error signal while already "active" (score
    // clamped at maxScore) causes NO state transition, but the signal was
    // still observed, so lastSeenAt must still move.
    const third = applyMisconceptionSignal(
      second,
      {
        isConfidentErrorSignal: true,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-03T00:00:00.000Z"),
      },
      TEST_POLICY,
    );
    expect(third.state).toBe("active");
    expect(third.reason).toBe("CONFIDENT_ERROR_OBSERVED");
    expect(third.lastSeenAt).toEqual(new Date("2026-01-03T00:00:00.000Z"));

    // NO_CHANGE (no misconception-relevant signal) must NOT move
    // lastSeenAt forward.
    const fourth = applyMisconceptionSignal(
      third,
      {
        isConfidentErrorSignal: false,
        isQualifyingRecoveryEvidence: false,
        observedAt: new Date("2026-01-04T00:00:00.000Z"),
      },
      TEST_POLICY,
    );
    expect(fourth.reason).toBe("NO_CHANGE");
    expect(fourth.lastSeenAt).toEqual(third.lastSeenAt);
  });
});

import { describe, expect, it } from "vitest";
import {
  generateNextBestActionCandidates,
  type NextBestActionContext,
} from "../next-best-action";
import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../scheduler";
import type { MisconceptionState, UserQuestionProgress } from "../types";

const NOW = new Date("2026-01-10T00:00:00.000Z");

/** Fixed retrievability so tests never depend on FSRS's specific formula. */
class FakeMemoryScheduler implements MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryReviewResult {
    throw new Error("not used by next-best-action tests: " + input.rating);
  }

  review(
    _state: SchedulerMemoryState,
    input: ReviewEvidence,
  ): MemoryReviewResult {
    throw new Error("not used by next-best-action tests: " + input.rating);
  }

  estimateRetrievability(): number {
    return 0.6;
  }
}

function makeContext(now: Date = NOW): NextBestActionContext {
  return {
    now,
    memoryScheduler: new FakeMemoryScheduler(),
  };
}

function makeMemory(
  overrides: Partial<SchedulerMemoryState> = {},
): SchedulerMemoryState {
  return {
    stability: 5,
    difficulty: 5,
    scheduledReviewAt: new Date("2026-01-15T00:00:00.000Z"),
    lastReviewAt: new Date("2026-01-05T00:00:00.000Z"),
    reviewCount: 3,
    lapseCount: 0,
    implementationState: {
      implementation: "fake",
      schemaVersion: 1,
      state: {},
    },
    ...overrides,
  };
}

function makeProgress(
  overrides: Partial<UserQuestionProgress> = {},
): UserQuestionProgress {
  return {
    userId: "user-1",
    questionId: "question-1",
    attemptCount: 1,
    correctCount: 1,
    lastAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
    lastCorrectAt: new Date("2026-01-05T00:00:00.000Z"),
    lastIncorrectAt: null,
    memory: null,
    retrievalBaselineAt: new Date("2026-01-05T00:00:00.000Z"),
    retrievalBaselineLearningSessionId: null,
    successfulSpacedRetrievals: 0,
    lapseCount: 0,
    lastLapseAt: null,
    misconceptionState: "none",
    misconceptionScore: 0,
    misconceptionLastSeenAt: null,
    timedAttemptCount: 1,
    averageResponseTimeSeconds: 10,
    meaningfulAttemptCount: 1,
    assistedAttemptCount: 0,
    lowQualityAttemptCount: 0,
    invalidForMasteryAttemptCount: 0,
    firstMeaningfulEvidenceAt: new Date("2026-01-05T00:00:00.000Z"),
    lastMeaningfulEvidenceAt: new Date("2026-01-05T00:00:00.000Z"),
    evidenceStrength: "early",
    masteryCategory: "learning",
    engineVersion: "learning_engine_v1.0",
    updatedAt: new Date("2026-01-05T00:00:00.000Z"),
    ...overrides,
  };
}

function typesOf(
  candidates: ReturnType<typeof generateNextBestActionCandidates>,
): string[] {
  return candidates.map((c) => c.type);
}

describe("generateNextBestActionCandidates", () => {
  it("1. unresolved lapse produces a RELEARN_LAPSE candidate", () => {
    const progress = makeProgress({
      retrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLapseAt: new Date("2026-01-03T00:00:00.000Z"), // after baseline
      lapseCount: 1,
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toContain("RELEARN_LAPSE");
    const candidate = candidates.find((c) => c.type === "RELEARN_LAPSE");
    expect(candidate?.reasons).toEqual(["UNRESOLVED_LAPSE"]);
  });

  it("2. a historically resolved lapse produces no RELEARN_LAPSE candidate, regardless of lapseCount", () => {
    const progress = makeProgress({
      retrievalBaselineAt: new Date("2026-01-05T00:00:00.000Z"), // moved past the lapse
      lastLapseAt: new Date("2026-01-01T00:00:00.000Z"),
      lapseCount: 3, // historical count alone must not matter
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).not.toContain("RELEARN_LAPSE");
  });

  it("3. active misconception produces a REPAIR_MISCONCEPTION candidate", () => {
    const progress = makeProgress({ misconceptionState: "active" });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toContain("REPAIR_MISCONCEPTION");
    const candidate = candidates.find(
      (c) => c.type === "REPAIR_MISCONCEPTION",
    );
    expect(candidate?.reasons).toEqual(["MISCONCEPTION_ACTIVE"]);
  });

  it("4. resolved misconception produces no REPAIR_MISCONCEPTION candidate", () => {
    const progress = makeProgress({ misconceptionState: "resolved" });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).not.toContain("REPAIR_MISCONCEPTION");
  });

  it("4b. every MisconceptionState maps to the correct REPAIR_MISCONCEPTION applicability", () => {
    const expected: Record<MisconceptionState, boolean> = {
      none: false,
      suspected: true,
      active: true,
      recovering: false, // already improving via ordinary spaced review
      resolved: false,
    };

    for (const [state, shouldApply] of Object.entries(expected)) {
      const candidates = generateNextBestActionCandidates(
        makeProgress({ misconceptionState: state as MisconceptionState }),
        makeContext(),
      );
      expect(typesOf(candidates).includes("REPAIR_MISCONCEPTION")).toBe(
        shouldApply,
      );
    }
  });

  it("5. scheduler-due memory produces a REVIEW_DUE candidate", () => {
    const progress = makeProgress({
      memory: makeMemory({
        scheduledReviewAt: new Date("2026-01-09T00:00:00.000Z"), // before NOW
      }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toContain("REVIEW_DUE");
    const candidate = candidates.find((c) => c.type === "REVIEW_DUE");
    expect(candidate?.dueAt).toEqual(new Date("2026-01-09T00:00:00.000Z"));
    expect(candidate?.retrievability).toBe(0.6);
  });

  it("6. scheduler memory not yet due produces no REVIEW_DUE candidate", () => {
    const progress = makeProgress({
      memory: makeMemory({
        scheduledReviewAt: new Date("2026-01-20T00:00:00.000Z"), // after NOW
      }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).not.toContain("REVIEW_DUE");
  });

  it("7. a mastered item can still be REVIEW_DUE", () => {
    const progress = makeProgress({
      masteryCategory: "mastered",
      memory: makeMemory({
        scheduledReviewAt: new Date("2026-01-09T00:00:00.000Z"),
      }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toContain("REVIEW_DUE");
  });

  it("8. a strengthening item qualifies for STRENGTHEN_MEMORY under the narrow predicate", () => {
    const progress = makeProgress({ masteryCategory: "strengthening" });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toContain("STRENGTHEN_MEMORY");
  });

  it("8b. STRENGTHEN_MEMORY does not fire for every non-mastered item", () => {
    for (const masteryCategory of ["not_started", "learning"] as const) {
      const candidates = generateNextBestActionCandidates(
        makeProgress({ masteryCategory }),
        makeContext(),
      );
      expect(typesOf(candidates)).not.toContain("STRENGTHEN_MEMORY");
    }
  });

  it("9. assisted/invalid history alone does not create false candidates", () => {
    const progress = makeProgress({
      attemptCount: 10,
      assistedAttemptCount: 6,
      invalidForMasteryAttemptCount: 3,
      meaningfulAttemptCount: 1,
      memory: null, // assisted/invalid attempts never advance the scheduler
      masteryCategory: "learning",
      misconceptionState: "none",
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(candidates).toEqual([]);
  });

  it("10. no progress generates no fake question-level actions", () => {
    const candidates = generateNextBestActionCandidates(null, makeContext());

    expect(candidates).toEqual([]);
  });

  it("11. candidate generation is deterministic", () => {
    const progress = makeProgress({
      misconceptionState: "active",
      retrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLapseAt: new Date("2026-01-03T00:00:00.000Z"),
      memory: makeMemory({
        scheduledReviewAt: new Date("2026-01-09T00:00:00.000Z"),
      }),
      masteryCategory: "strengthening",
    });

    const resultA = generateNextBestActionCandidates(progress, makeContext());
    const resultB = generateNextBestActionCandidates(progress, makeContext());

    expect(resultA).toEqual(resultB);
  });

  it("12. multiple candidates coexist truthfully (unresolved lapse + active misconception) without collapsing to one winner", () => {
    const progress = makeProgress({
      misconceptionState: "active",
      retrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLapseAt: new Date("2026-01-03T00:00:00.000Z"), // unresolved
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toEqual(
      expect.arrayContaining(["RELEARN_LAPSE", "REPAIR_MISCONCEPTION"]),
    );
    expect(candidates.length).toBe(2);
  });

  it("13. STRENGTHEN_MEMORY and REVIEW_DUE can coexist truthfully", () => {
    const progress = makeProgress({
      masteryCategory: "strengthening",
      memory: makeMemory({
        scheduledReviewAt: new Date("2026-01-09T00:00:00.000Z"),
      }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toEqual(
      expect.arrayContaining(["STRENGTHEN_MEMORY", "REVIEW_DUE"]),
    );
  });

  it("14. STRENGTHEN_MEMORY and RELEARN_LAPSE can coexist truthfully", () => {
    const progress = makeProgress({
      masteryCategory: "strengthening",
      retrievalBaselineAt: new Date("2026-01-01T00:00:00.000Z"),
      lastLapseAt: new Date("2026-01-03T00:00:00.000Z"), // unresolved
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(),
    );

    expect(typesOf(candidates)).toEqual(
      expect.arrayContaining(["STRENGTHEN_MEMORY", "RELEARN_LAPSE"]),
    );
  });

  it("qualifies at exactly the due threshold (scheduledReviewAt === now)", () => {
    const progress = makeProgress({
      memory: makeMemory({ scheduledReviewAt: NOW }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(NOW),
    );

    expect(typesOf(candidates)).toContain("REVIEW_DUE");
  });

  it("does not fabricate REVIEW_DUE one millisecond before due", () => {
    const progress = makeProgress({
      memory: makeMemory({
        scheduledReviewAt: new Date(NOW.getTime() + 1),
      }),
    });

    const candidates = generateNextBestActionCandidates(
      progress,
      makeContext(NOW),
    );

    expect(typesOf(candidates)).not.toContain("REVIEW_DUE");
  });
});

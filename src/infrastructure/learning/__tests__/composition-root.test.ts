import { afterEach, describe, expect, it, vi } from "vitest";

import { getOrCreateTodaySession } from "../../../application/learning/today-session";
import { submitAnswer } from "../../../application/learning/submit-answer";
import { InMemoryLearningDatabase } from "../../../application/learning/__tests__/in-memory-fakes";
import { TsFsrsMemoryScheduler } from "../fsrs/ts-fsrs-memory-scheduler";
import {
  createProductionSubmitAnswerContext,
  createProductionTodaySessionContext,
} from "../composition-root";
import {
  PRODUCTION_ENGINE_VERSION,
  PRODUCTION_EVIDENCE_STRENGTH_POLICY,
  PRODUCTION_MASTERY_POLICY,
  PRODUCTION_MISCONCEPTION_POLICY,
  PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
  PRODUCTION_TODAY_PLANNER_POLICY,
} from "../production-policy-defaults";

const NOW = new Date("2026-03-01T00:00:00.000Z");

describe("createProductionSubmitAnswerContext", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("builds successfully with production defaults", () => {
    const context = createProductionSubmitAnswerContext(NOW);

    expect(context.now).toBe(NOW);
    expect(context.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
    expect(context.memoryScheduler).toBeInstanceOf(TsFsrsMemoryScheduler);
    expect(context.retrievalQualificationPolicy).toEqual(
      PRODUCTION_RETRIEVAL_QUALIFICATION_POLICY,
    );
    expect(context.evidenceStrengthPolicy).toEqual(
      PRODUCTION_EVIDENCE_STRENGTH_POLICY,
    );
    expect(context.masteryPolicy).toEqual(PRODUCTION_MASTERY_POLICY);
    expect(context.misconceptionPolicy).toEqual(
      PRODUCTION_MISCONCEPTION_POLICY,
    );
    expect(context.determineSuspiciousTiming({
      responseTimeSeconds: 1,
      questionId: "q",
      userId: "u",
    })).toBe(false);
  });

  it("wires a real id generator (distinct, UUID-shaped ids across calls)", () => {
    const context = createProductionSubmitAnswerContext(NOW);
    const a = context.generateId();
    const b = context.generateId();

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(a).toMatch(uuidPattern);
    expect(b).toMatch(uuidPattern);
    expect(a).not.toBe(b);
  });

  it("is deterministic and never reads the clock itself: `now` is exactly the injected value, not the faked system time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const context = createProductionSubmitAnswerContext(NOW);

    vi.useRealTimers();

    expect(context.now).toEqual(NOW);
    expect(context.now).not.toEqual(new Date("2099-01-01T00:00:00.000Z"));
  });

  it("produces identical policy configuration across repeated calls", () => {
    const first = createProductionSubmitAnswerContext(NOW);
    const second = createProductionSubmitAnswerContext(NOW);

    expect(first.retrievalQualificationPolicy).toEqual(
      second.retrievalQualificationPolicy,
    );
    expect(first.evidenceStrengthPolicy).toEqual(second.evidenceStrengthPolicy);
    expect(first.masteryPolicy).toEqual(second.masteryPolicy);
    expect(first.misconceptionPolicy).toEqual(second.misconceptionPolicy);
    expect(first.engineVersion).toBe(second.engineVersion);
  });

  it("actually drives submitAnswer end-to-end (real production defaults, not a test fixture)", async () => {
    const db = new InMemoryLearningDatabase();
    db.setQuestionVersion("qv-1", "question-1", "course-1");
    db.setCorrectAnswer("qv-1", "A");

    const result = await submitAnswer(
      {
        submissionId: "sub-1",
        userId: "user-1",
        courseId: "course-1",
        questionId: "question-1",
        questionVersionId: "qv-1",
        answeredAt: NOW,
        selectedAnswer: "A",
        confidenceLevel: "medium",
        responseTimeSeconds: 10,
        todaySessionId: null,
        todaySessionItemId: null,
        learningSessionId: null,
        assistanceUsed: "NONE",
        attemptNumberForPresentedItem: 1,
        answerWasRevealedBeforeResponse: false,
      },
      createProductionSubmitAnswerContext(NOW),
      db,
    );

    expect(result.kind).toBe("ACCEPTED");
    if (result.kind === "ACCEPTED") {
      expect(result.attempt.isCorrect).toBe(true);
      expect(result.attempt.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
      expect(result.progress.attemptCount).toBe(1);
    }
  });
});

describe("createProductionTodaySessionContext", () => {
  it("builds successfully with production defaults", () => {
    const context = createProductionTodaySessionContext(NOW);

    expect(context.now).toBe(NOW);
    expect(context.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
    expect(context.memoryScheduler).toBeInstanceOf(TsFsrsMemoryScheduler);
    expect(context.todayPlannerPolicy).toEqual(PRODUCTION_TODAY_PLANNER_POLICY);
  });

  it("is deterministic: `now` is exactly the injected value, not the faked system time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));

    const context = createProductionTodaySessionContext(NOW);

    vi.useRealTimers();

    expect(context.now).toEqual(NOW);
  });

  it("actually drives getOrCreateTodaySession end-to-end for a learner with no ranked candidates yet (current architecture permits this: an empty progress list produces a legitimately empty plan, not an error)", async () => {
    const db = new InMemoryLearningDatabase();

    const session = await getOrCreateTodaySession(
      { userId: "user-1", courseId: "course-1", plannedForDate: "2026-03-01" },
      createProductionTodaySessionContext(NOW),
      db,
    );

    expect(session.userId).toBe("user-1");
    expect(session.courseId).toBe("course-1");
    expect(session.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
    expect(session.items).toEqual([]);
  });
});

describe("production policy defaults are immutable", () => {
  // `PRODUCTION_*_POLICY` constants are shared by reference across every
  // factory call (see production-policy-defaults.ts's module doc comment)
  // — this describe block proves that an accidental in-place mutation of
  // one returned context's policy field cannot silently corrupt the
  // default a later, independently-created context receives. The chosen
  // hardening is `Object.freeze`, so mutation THROWS (a `TypeError`, this
  // codebase's ES modules being strict-mode) rather than being silently
  // isolated by a defensive copy — that throwing behavior is asserted
  // explicitly below, not merely implied by the isolation checks.

  // These mutation attempts are valid TypeScript (`MasteryPolicy` et al.
  // deliberately keep mutable, non-`readonly` fields — this hardening does
  // not change any policy interface) and only fail at RUNTIME, because the
  // underlying object is frozen. Cast through `Record<string, unknown>` so
  // the assignment itself type-checks cleanly, exactly like any other
  // runtime-only invariant this codebase proves via a test rather than the
  // type system (e.g. `MalformedRowError`'s callers).

  it("throws when mutating MasteryPolicy on a returned SubmitAnswerContext", () => {
    const context = createProductionSubmitAnswerContext(NOW);

    expect(() => {
      (context.masteryPolicy as unknown as Record<string, unknown>)
        .minRetrievabilityForMastered = 0.1;
    }).toThrow(TypeError);
  });

  it("throws when mutating MisconceptionPolicy on a returned SubmitAnswerContext", () => {
    const context = createProductionSubmitAnswerContext(NOW);

    expect(() => {
      (context.misconceptionPolicy as unknown as Record<string, unknown>)
        .activeScoreThreshold = 999;
    }).toThrow(TypeError);
  });

  it("throws when mutating TodayPlannerPolicy on a returned TodaySessionContext", () => {
    const context = createProductionTodaySessionContext(NOW);

    expect(() => {
      (context.todayPlannerPolicy as unknown as Record<string, unknown>).maxItems = 1;
    }).toThrow(TypeError);
  });

  it("MasteryPolicy: a failed mutation attempt never alters a later, independently-created context", () => {
    const first = createProductionSubmitAnswerContext(NOW);
    try {
      (first.masteryPolicy as unknown as Record<string, unknown>)
        .minRetrievabilityForMastered = 0.1;
    } catch {
      // Expected — frozen object rejects the write.
    }

    const second = createProductionSubmitAnswerContext(NOW);

    expect(second.masteryPolicy).toEqual(PRODUCTION_MASTERY_POLICY);
    expect(second.masteryPolicy.minRetrievabilityForMastered).toBe(0.8);
  });

  it("MisconceptionPolicy: a failed mutation attempt never alters a later, independently-created context", () => {
    const first = createProductionSubmitAnswerContext(NOW);
    try {
      (first.misconceptionPolicy as unknown as Record<string, unknown>)
        .activeScoreThreshold = 999;
    } catch {
      // Expected — frozen object rejects the write.
    }

    const second = createProductionSubmitAnswerContext(NOW);

    expect(second.misconceptionPolicy).toEqual(PRODUCTION_MISCONCEPTION_POLICY);
    expect(second.misconceptionPolicy.activeScoreThreshold).toBe(4);
  });

  it("TodayPlannerPolicy: a failed mutation attempt never alters a later, independently-created context", () => {
    const first = createProductionTodaySessionContext(NOW);
    try {
      (first.todayPlannerPolicy as unknown as Record<string, unknown>).maxItems = 1;
    } catch {
      // Expected — frozen object rejects the write.
    }

    const second = createProductionTodaySessionContext(NOW);

    expect(second.todayPlannerPolicy).toEqual(PRODUCTION_TODAY_PLANNER_POLICY);
    expect(second.todayPlannerPolicy.maxItems).toBe(15);
  });
});

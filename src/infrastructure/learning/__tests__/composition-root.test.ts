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

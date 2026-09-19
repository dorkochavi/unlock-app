import { describe, expect, it } from "vitest";
import type { TodayPlannerPolicy } from "../../../domain/learning/today-planner";
import type { UserQuestionProgress } from "../../../domain/learning/types";
import type { DailyPlan, DailyPlanKey } from "../ports";
import {
  generateDailyPlanForResolvedInputs,
  type DailyPlanGenerationContext,
} from "../generate-daily-plan-for-resolved-inputs";
import { InMemoryDailyPlanDatabase } from "./in-memory-fakes";

const NOW = new Date("2026-01-10T00:00:00.000Z");
const KEY: DailyPlanKey = { userId: "user-1", plannedForDate: "2026-01-10" };

function makeContext(
  overrides: Partial<DailyPlanGenerationContext> = {},
): DailyPlanGenerationContext {
  const policy: TodayPlannerPolicy = { maxItems: 15 };
  return {
    now: NOW,
    engineVersion: "test-engine-v1",
    memoryScheduler: {
      initialize: () => {
        throw new Error("not used");
      },
      review: () => {
        throw new Error("not used");
      },
      estimateRetrievability: () => 0.9,
    },
    todayPlannerPolicy: policy,
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
    memory: {
      stability: 5,
      difficulty: 5,
      scheduledReviewAt: new Date("2026-01-09T00:00:00.000Z"), // already due
      lastReviewAt: new Date("2026-01-05T00:00:00.000Z"),
      reviewCount: 1,
      lapseCount: 0,
      implementationState: { implementation: "fake", schemaVersion: 1, state: {} },
    },
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
    engineVersion: "test-engine-v1",
    updatedAt: new Date("2026-01-05T00:00:00.000Z"),
    ...overrides,
  };
}

describe("generateDailyPlanForResolvedInputs", () => {
  it("A. resumes an existing DailyPlan without re-reading progress/candidates/versions", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress());
    db.setCurrentVersion("question-1", "qv-1");

    const first = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext(),
      db,
    );
    expect(first.items.length).toBe(1);

    const listForUserCallsAfterFirst = db.listForUserCallCount;
    const getCurrentVersionCallsAfterFirst = db.getCurrentVersionCallCount;

    const second = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext(),
      db,
    );

    expect(second).toEqual(first);
    expect(db.listForUserCallCount).toBe(listForUserCallsAfterFirst);
    expect(db.getCurrentVersionCallCount).toBe(getCurrentVersionCallsAfterFirst);
    expect(db.findByKeyCallCount).toBe(2);
  });

  it("B. pools progress across multiple Courses and ranks once globally", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress({ questionId: "question-a" }));
    db.seedProgress("course-2", makeProgress({ questionId: "question-b" }));
    db.setCurrentVersion("question-a", "qv-a");
    db.setCurrentVersion("question-b", "qv-b");

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1", "course-2"] },
      makeContext(),
      db,
    );

    expect(plan.items.length).toBe(2);
    const byQuestion = new Map(plan.items.map((i) => [i.questionId, i]));
    expect(byQuestion.get("question-a")?.courseId).toBe("course-1");
    expect(byQuestion.get("question-b")?.courseId).toBe("course-2");
  });

  it("C. truncates to maxItems when more candidates are ranked than the policy allows", async () => {
    const db = new InMemoryDailyPlanDatabase();
    for (let i = 0; i < 20; i++) {
      const questionId = `question-${i}`;
      db.seedProgress("course-1", makeProgress({ questionId }));
      db.setCurrentVersion(questionId, `qv-${i}`);
    }

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext({ todayPlannerPolicy: { maxItems: 15 } }),
      db,
    );

    expect(plan.items.length).toBe(15);
  });

  it("D. persists exactly the ranked candidate count when fewer than maxItems, with no filler", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress({ questionId: "question-1" }));
    db.setCurrentVersion("question-1", "qv-1");

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext({ todayPlannerPolicy: { maxItems: 15 } }),
      db,
    );

    expect(plan.items.length).toBe(1);
  });

  it("E1. persists a zero-item DailyPlan when there are no eligible Courses", async () => {
    const db = new InMemoryDailyPlanDatabase();

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: [] },
      makeContext(),
      db,
    );

    expect(plan.items).toEqual([]);
    expect(db.hasDailyPlan(KEY)).toBe(true);
  });

  it("E2. persists a zero-item DailyPlan when Courses exist but there is no progress", async () => {
    const db = new InMemoryDailyPlanDatabase();

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1", "course-2"] },
      makeContext(),
      db,
    );

    expect(plan.items).toEqual([]);
    expect(db.hasDailyPlan(KEY)).toBe(true);
  });

  it("F. freezes the current QuestionVersion at generation time and never re-resolves it on resume", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress({ questionId: "question-1" }));
    db.setCurrentVersion("question-1", "qv-1");

    const first = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext(),
      db,
    );
    expect(first.items[0].questionVersionId).toBe("qv-1");

    db.setCurrentVersion("question-1", "qv-2");

    const second = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext(),
      db,
    );
    expect(second.items[0].questionVersionId).toBe("qv-1");
  });

  it("G. rolls back the whole transaction on a persistence failure — no partial plan/items survive", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress({ questionId: "question-1" }));
    db.setCurrentVersion("question-1", "qv-1");
    db.shouldFailOnCreateIfNotExists = true;

    await expect(
      generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      ),
    ).rejects.toThrow("forced createIfNotExists failure");

    expect(db.hasDailyPlan(KEY)).toBe(false);
  });

  it("H. returns the concurrent winner rather than the locally generated plan", async () => {
    const db = new InMemoryDailyPlanDatabase();
    db.seedProgress("course-1", makeProgress({ questionId: "question-1" }));
    db.setCurrentVersion("question-1", "qv-1");

    const winner: DailyPlan = {
      id: "daily-plan-winner",
      userId: KEY.userId,
      plannedForDate: KEY.plannedForDate,
      status: "prepared",
      engineVersion: "other-engine-v1",
      generatedAt: NOW,
      startedAt: null,
      completedAt: null,
      items: [],
    };
    db.seedConcurrentWinner(KEY, winner);

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1"] },
      makeContext(),
      db,
    );

    expect(plan).toEqual(winner);
  });
});

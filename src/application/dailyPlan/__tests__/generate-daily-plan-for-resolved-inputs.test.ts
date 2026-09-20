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

  it("I. deduplicates eligibleCourseIds — listForUser called once, no duplicated candidate-derived metadata", async () => {
    const db = new InMemoryDailyPlanDatabase();
    // masteryCategory "strengthening" + the fixture's already-due
    // scheduledReviewAt makes BOTH REVIEW_DUE and STRENGTHEN_MEMORY
    // applicable to the same Question, so a duplicated pool would produce
    // a visibly duplicated otherApplicableTypes entry if deduplication
    // were broken.
    db.seedProgress(
      "course-1",
      makeProgress({ questionId: "question-1", masteryCategory: "strengthening" }),
    );
    db.setCurrentVersion("question-1", "qv-1");

    const callsBefore = db.listForUserCallCount;

    const plan = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: ["course-1", "course-1"] },
      makeContext(),
      db,
    );

    expect(db.listForUserCallCount).toBe(callsBefore + 1);
    expect(plan.items.length).toBe(1);
    expect(plan.items[0].otherApplicableTypes).toEqual(["STRENGTHEN_MEMORY"]);
  });

  it("J. throws and does not persist a DailyPlan when the same questionId is observed under conflicting courseIds", async () => {
    const db = new InMemoryDailyPlanDatabase();
    // Simulates a malformed/buggy UserQuestionProgressRepository:
    // question-x is returned under two DIFFERENT courseIds — schema-
    // impossible for the real repository (questions.course_id is a single
    // NOT NULL FK), but nothing stops a fake/buggy implementation from
    // doing it.
    db.seedProgress("course-1", makeProgress({ questionId: "question-x" }));
    db.seedProgress("course-2", makeProgress({ questionId: "question-x" }));
    db.setCurrentVersion("question-x", "qv-x");

    await expect(
      generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1", "course-2"] },
        makeContext(),
        db,
      ),
    ).rejects.toThrow(/question-x/);

    expect(db.hasDailyPlan(KEY)).toBe(false);
  });

  it("K. resumes a persisted empty plan without regenerating on a second call", async () => {
    const db = new InMemoryDailyPlanDatabase();

    const first = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: [] },
      makeContext(),
      db,
    );
    expect(first.items).toEqual([]);

    const listForUserCallsAfterFirst = db.listForUserCallCount;
    const getCurrentVersionCallsAfterFirst = db.getCurrentVersionCallCount;

    const second = await generateDailyPlanForResolvedInputs(
      { ...KEY, eligibleCourseIds: [] },
      makeContext(),
      db,
    );

    expect(second).toEqual(first);
    expect(db.listForUserCallCount).toBe(listForUserCallsAfterFirst);
    expect(db.getCurrentVersionCallCount).toBe(getCurrentVersionCallsAfterFirst);
  });

  describe("New-material fallback (ADR-017, Night-Run Slice 5)", () => {
    it("L. fresh learner (zero progress) with 5 eligible unseen questions across 2 Courses receives exactly 3, globally ordered by (createdAt, questionId)", async () => {
      const db = new InMemoryDailyPlanDatabase();
      db.seedUnseenQuestion("course-1", {
        questionId: "q-3rd",
        courseId: "course-1",
        questionVersionId: "qv-3rd",
        createdAt: new Date("2026-01-03T00:00:00.000Z"),
      });
      db.seedUnseenQuestion("course-1", {
        questionId: "q-1st",
        courseId: "course-1",
        questionVersionId: "qv-1st",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      db.seedUnseenQuestion("course-2", {
        questionId: "q-2nd",
        courseId: "course-2",
        questionVersionId: "qv-2nd",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      db.seedUnseenQuestion("course-2", {
        questionId: "q-4th",
        courseId: "course-2",
        questionVersionId: "qv-4th",
        createdAt: new Date("2026-01-04T00:00:00.000Z"),
      });
      db.seedUnseenQuestion("course-1", {
        questionId: "q-5th",
        courseId: "course-1",
        questionVersionId: "qv-5th",
        createdAt: new Date("2026-01-05T00:00:00.000Z"),
      });

      const plan = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1", "course-2"] },
        makeContext(),
        db,
      );

      expect(plan.items).toHaveLength(3);
      expect(plan.items.map((item) => item.questionId)).toEqual([
        "q-1st",
        "q-2nd",
        "q-3rd",
      ]);
      expect(plan.items.map((item) => item.position)).toEqual([0, 1, 2]);
      for (const item of plan.items) {
        expect(item.actionType).toBe("NEW_LEARNING");
        expect(item.tier).toBe("NEW_MATERIAL");
        expect(item.reasons).toEqual(["UNSEEN_MATERIAL"]);
        expect(item.otherApplicableTypes).toEqual([]);
        expect(item.status).toBe("pending");
      }
      expect(plan.items.find((item) => item.questionId === "q-2nd")?.courseId).toBe(
        "course-2",
      );
    });

    it("M. when only 2 eligible unseen questions exist, selects only those — no filler to reach 3", async () => {
      const db = new InMemoryDailyPlanDatabase();
      db.seedUnseenQuestion("course-1", {
        questionId: "q-1",
        courseId: "course-1",
        questionVersionId: "qv-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      db.seedUnseenQuestion("course-1", {
        questionId: "q-2",
        courseId: "course-1",
        questionVersionId: "qv-2",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      });

      const plan = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );

      expect(plan.items).toHaveLength(2);
    });

    it("N. when at least one normal candidate exists, the unseen fallback NEVER activates — no mixing, even if eligible unseen questions also exist", async () => {
      const db = new InMemoryDailyPlanDatabase();
      db.seedProgress("course-1", makeProgress({ questionId: "question-due" }));
      db.setCurrentVersion("question-due", "qv-due");
      db.seedUnseenQuestion("course-1", {
        questionId: "q-unseen",
        courseId: "course-1",
        questionVersionId: "qv-unseen",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const plan = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );

      expect(plan.items).toHaveLength(1);
      expect(plan.items[0].questionId).toBe("question-due");
      expect(plan.items[0].actionType).not.toBe("NEW_LEARNING");
      // The fallback path must not even be QUERIED when normal candidates
      // exist — not merely filtered out afterward.
      expect(db.findUnseenQuestionsCallCount).toBe(0);
    });

    it("O. zero eligible unseen questions AND zero normal candidates: Today may be legitimately empty, no filler fabricated", async () => {
      const db = new InMemoryDailyPlanDatabase();

      const plan = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );

      expect(plan.items).toEqual([]);
    });

    it("P. resuming an existing new-material-fallback plan does not re-query unseen questions", async () => {
      const db = new InMemoryDailyPlanDatabase();
      db.seedUnseenQuestion("course-1", {
        questionId: "q-1",
        courseId: "course-1",
        questionVersionId: "qv-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const first = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );
      expect(first.items).toHaveLength(1);
      const callsAfterFirst = db.findUnseenQuestionsCallCount;

      const second = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );

      expect(second).toEqual(first);
      expect(db.findUnseenQuestionsCallCount).toBe(callsAfterFirst);
    });

    it("Q. new-material selection creates no UserQuestionProgress row — placement is not evidence", async () => {
      const db = new InMemoryDailyPlanDatabase();
      db.seedUnseenQuestion("course-1", {
        questionId: "q-1",
        courseId: "course-1",
        questionVersionId: "qv-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      // InMemoryDailyPlanDatabase's progress.upsert fake throws if ever
      // called ("not used by DailyPlan generation") — a passing call here
      // is itself the proof that generation never wrote a progress row for
      // the newly-selected unseen question.
      const plan = await generateDailyPlanForResolvedInputs(
        { ...KEY, eligibleCourseIds: ["course-1"] },
        makeContext(),
        db,
      );

      expect(plan.items).toHaveLength(1);
    });
  });
});

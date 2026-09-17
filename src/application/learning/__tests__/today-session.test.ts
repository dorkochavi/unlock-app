import { describe, expect, it } from "vitest";
import type { TodayPlannerPolicy } from "../../../domain/learning/today-planner";
import type { UserQuestionProgress } from "../../../domain/learning/types";
import {
  getOrCreateTodaySession,
  getTodaySession,
  type TodaySessionContext,
} from "../today-session";
import { InMemoryLearningDatabase } from "./in-memory-fakes";

const NOW = new Date("2026-01-10T00:00:00.000Z");

function makeContext(
  overrides: Partial<TodaySessionContext> = {},
): TodaySessionContext {
  const policy: TodayPlannerPolicy = { maxItems: 10 };
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

describe("getOrCreateTodaySession / getTodaySession", () => {
  it("generates a session from ranked NBA candidates on first call", async () => {
    const db = new InMemoryLearningDatabase();
    db.seedProgress(makeProgress());
    db.setCurrentVersion("question-1", "qv-1");
    db.setQuestionCourse("question-1", "course-1");

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };

    const session = await getOrCreateTodaySession(key, makeContext(), db);

    expect(session.items.length).toBe(1);
    expect(session.items[0].questionId).toBe("question-1");
    expect(session.items[0].actionType).toBe("REVIEW_DUE");
    expect(session.items[0].questionVersionId).toBe("qv-1");
  });

  it("10. never invents/chooses a Question of its own — items are drawn only from what candidate generation produced", async () => {
    const db = new InMemoryLearningDatabase();
    // Two progress rows: one due, one not due and not otherwise eligible —
    // the second should NOT produce a candidate/item at all.
    db.seedProgress(makeProgress({ questionId: "question-due" }));
    db.seedProgress(
      makeProgress({
        questionId: "question-not-due",
        memory: {
          stability: 5,
          difficulty: 5,
          scheduledReviewAt: new Date("2026-01-20T00:00:00.000Z"), // future
          lastReviewAt: new Date("2026-01-05T00:00:00.000Z"),
          reviewCount: 1,
          lapseCount: 0,
          implementationState: { implementation: "fake", schemaVersion: 1, state: {} },
        },
        masteryCategory: "learning",
        misconceptionState: "none",
      }),
    );
    db.setCurrentVersion("question-due", "qv-due");
    db.setCurrentVersion("question-not-due", "qv-not-due");
    db.setQuestionCourse("question-due", "course-1");
    db.setQuestionCourse("question-not-due", "course-1");

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };

    const session = await getOrCreateTodaySession(key, makeContext(), db);

    const questionIds = session.items.map((i) => i.questionId);
    expect(questionIds).toEqual(["question-due"]);
    expect(questionIds).not.toContain("question-not-due");
    expect(questionIds).not.toContain("some-fabricated-question");
  });

  it("Today create race: a second call for the same key returns the SAME session rather than creating a new one", async () => {
    const db = new InMemoryLearningDatabase();
    db.seedProgress(makeProgress());
    db.setCurrentVersion("question-1", "qv-1");
    db.setQuestionCourse("question-1", "course-1");

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };
    const context = makeContext();

    const first = await getOrCreateTodaySession(key, context, db);
    const second = await getOrCreateTodaySession(key, context, db);

    expect(second.id).toBe(first.id);
    expect(second.items).toEqual(first.items);
  });

  it("Today resume: getTodaySession is a pure read that returns the existing session unchanged", async () => {
    const db = new InMemoryLearningDatabase();
    db.seedProgress(makeProgress());
    db.setCurrentVersion("question-1", "qv-1");
    db.setQuestionCourse("question-1", "course-1");

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };
    const created = await getOrCreateTodaySession(key, makeContext(), db);

    const resumed = await getTodaySession(key, db);

    expect(resumed).toEqual(created);
  });

  it("getTodaySession returns null when no session exists yet, without creating one", async () => {
    const db = new InMemoryLearningDatabase();

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };

    const result = await getTodaySession(key, db);

    expect(result).toBeNull();
  });

  it("an empty ranked-candidate pool produces an empty (but real) Today session, not an error", async () => {
    const db = new InMemoryLearningDatabase();

    const key = {
      userId: "user-1",
      courseId: "course-1",
      plannedForDate: "2026-01-10",
    };

    const session = await getOrCreateTodaySession(key, makeContext(), db);

    expect(session.items).toEqual([]);
  });
});

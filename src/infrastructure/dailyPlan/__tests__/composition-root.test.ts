import { describe, expect, it } from "vitest";

import { InMemoryCourseDatabase } from "../../../application/course/__tests__/in-memory-fakes";
import { InMemoryDailyPlanDatabase } from "../../../application/dailyPlan/__tests__/in-memory-fakes";
import { InMemoryUserDatabase } from "../../../application/user/__tests__/in-memory-fakes";
import { getOrCreateDailyPlanForToday } from "../../../application/dailyPlan/get-or-create-daily-plan-for-today";
import { PostgresCourseMembershipRepository } from "../../postgres/course-membership-repository";
import { PostgresDailyPlanUnitOfWork } from "../../postgres/daily-plan-unit-of-work";
import { PostgresUserRepository } from "../../postgres/user-repository";
import { TsFsrsMemoryScheduler } from "../../learning/fsrs/ts-fsrs-memory-scheduler";
import {
  PRODUCTION_ENGINE_VERSION,
  PRODUCTION_TODAY_PLANNER_POLICY,
} from "../../learning/production-policy-defaults";
import {
  createProductionDailyPlanGenerationSettings,
  createProductionDailyPlanPorts,
} from "../composition-root";

const NOW = new Date("2026-03-01T00:00:00.000Z");

describe("createProductionDailyPlanGenerationSettings", () => {
  it("builds successfully with production defaults", () => {
    const settings = createProductionDailyPlanGenerationSettings();

    expect(settings.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
    expect(settings.memoryScheduler).toBeInstanceOf(TsFsrsMemoryScheduler);
    expect(settings.todayPlannerPolicy).toEqual(PRODUCTION_TODAY_PLANNER_POLICY);
  });

  it("throws when mutating TodayPlannerPolicy — shares the same frozen production default", () => {
    const settings = createProductionDailyPlanGenerationSettings();

    expect(() => {
      (settings.todayPlannerPolicy as unknown as Record<string, unknown>).maxItems = 1;
    }).toThrow(TypeError);
  });

  it("actually drives getOrCreateDailyPlanForToday end-to-end with real production settings (in-memory ports)", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser("user-1", "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership({
      id: "membership-1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: NOW,
      revokedAt: null,
      archivedAt: null,
    });
    const dailyPlans = new InMemoryDailyPlanDatabase();
    // `memory: null` deliberately — STRENGTHEN_MEMORY is applicable without
    // any scheduler state, so this exercises the REAL TsFsrsMemoryScheduler
    // wired by the production factory without needing to construct a valid
    // FSRS-internal implementationState fixture (that scheduler's own
    // behavior is unit-tested separately, in `ts-fsrs-memory-scheduler
    // .test.ts` — this test's job is to prove the composition root wires a
    // real instance, not to re-prove FSRS math).
    dailyPlans.seedProgress("course-1", {
      userId: "user-1",
      questionId: "question-1",
      attemptCount: 1,
      correctCount: 1,
      lastAttemptAt: new Date("2026-02-20T00:00:00.000Z"),
      lastCorrectAt: new Date("2026-02-20T00:00:00.000Z"),
      lastIncorrectAt: null,
      memory: null,
      retrievalBaselineAt: new Date("2026-02-20T00:00:00.000Z"),
      retrievalBaselineLearningSessionId: null,
      successfulSpacedRetrievals: 1,
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
      firstMeaningfulEvidenceAt: new Date("2026-02-20T00:00:00.000Z"),
      lastMeaningfulEvidenceAt: new Date("2026-02-20T00:00:00.000Z"),
      evidenceStrength: "moderate",
      masteryCategory: "strengthening",
      engineVersion: PRODUCTION_ENGINE_VERSION,
      updatedAt: new Date("2026-02-20T00:00:00.000Z"),
    });
    dailyPlans.setCurrentVersion("question-1", "qv-1");

    const result = await getOrCreateDailyPlanForToday(
      { userId: "user-1", now: NOW },
      createProductionDailyPlanGenerationSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.engineVersion).toBe(PRODUCTION_ENGINE_VERSION);
      expect(result.plan.items.length).toBe(1);
      expect(result.plan.items[0].actionType).toBe("STRENGTHEN_MEMORY");
    }
  });
});

describe("createProductionDailyPlanPorts", () => {
  it("constructs the real Postgres-backed port instances from a caller-supplied executor/connection provider", () => {
    const fakeExecutor = { query: async () => ({ rows: [] }) };
    const fakeConnectionProvider = {
      withConnection: async <T>(fn: (db: typeof fakeExecutor) => Promise<T>) =>
        fn(fakeExecutor),
    };

    const ports = createProductionDailyPlanPorts(fakeExecutor, fakeConnectionProvider);

    expect(ports.users).toBeInstanceOf(PostgresUserRepository);
    expect(ports.courseMemberships).toBeInstanceOf(PostgresCourseMembershipRepository);
    expect(ports.dailyPlanUnitOfWork).toBeInstanceOf(PostgresDailyPlanUnitOfWork);
  });
});

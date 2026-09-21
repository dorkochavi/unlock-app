import { describe, expect, it } from "vitest";
import type { CourseMembership, CourseMembershipRepository } from "../../course/ports";
import { InMemoryCourseDatabase } from "../../course/__tests__/in-memory-fakes";
import { InMemoryUserDatabase } from "../../user/__tests__/in-memory-fakes";
import type { TodayPlannerPolicy } from "../../../domain/learning/today-planner";
import type { UserQuestionProgress } from "../../../domain/learning/types";
import {
  getOrCreateDailyPlanForToday,
  type DailyPlanGenerationSettings,
} from "../get-or-create-daily-plan-for-today";
import { InMemoryDailyPlanDatabase } from "./in-memory-fakes";

const USER_ID = "user-1";

function makeSettings(
  overrides: Partial<DailyPlanGenerationSettings> = {},
): DailyPlanGenerationSettings {
  const policy: TodayPlannerPolicy = { maxItems: 15 };
  return {
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
    userId: USER_ID,
    questionId: "question-1",
    attemptCount: 1,
    correctCount: 1,
    lastAttemptAt: new Date("2026-01-05T00:00:00.000Z"),
    lastCorrectAt: new Date("2026-01-05T00:00:00.000Z"),
    lastIncorrectAt: null,
    memory: {
      stability: 5,
      difficulty: 5,
      scheduledReviewAt: new Date("2020-01-01T00:00:00.000Z"), // long since due
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

function makeMembership(overrides: Partial<CourseMembership> = {}): CourseMembership {
  return {
    id: `membership-${overrides.courseId ?? "x"}`,
    userId: USER_ID,
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

/**
 * Local call-count spy around `listActiveForUser` only — deliberately NOT
 * added to the shared `InMemoryCourseDatabase` fake (used by other course
 * tests), to avoid modifying a fake beyond this file's own needs.
 */
function countingMemberships(repo: CourseMembershipRepository): {
  repo: CourseMembershipRepository;
  callCount: () => number;
} {
  let calls = 0;
  return {
    repo: {
      ...repo,
      listActiveForUser: async (userId) => {
        calls++;
        return repo.listActiveForUser(userId);
      },
    },
    callCount: () => calls,
  };
}

describe("getOrCreateDailyPlanForToday", () => {
  it("A. returns USER_NOT_FOUND without any membership lookup or generation transaction", async () => {
    const users = new InMemoryUserDatabase();
    const courses = new InMemoryCourseDatabase();
    const dailyPlans = new InMemoryDailyPlanDatabase();
    const { repo: membershipsSpy, callCount } = countingMemberships(
      courses.repos().memberships,
    );

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: membershipsSpy,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result).toEqual({ outcome: "USER_NOT_FOUND" });
    expect(callCount()).toBe(0);
    expect(dailyPlans.findByKeyCallCount).toBe(0);
  });

  it("B. returns TIMEZONE_NOT_SET without any membership lookup or generation transaction", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, null);
    const courses = new InMemoryCourseDatabase();
    const dailyPlans = new InMemoryDailyPlanDatabase();
    const { repo: membershipsSpy, callCount } = countingMemberships(
      courses.repos().memberships,
    );

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: membershipsSpy,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result).toEqual({ outcome: "TIMEZONE_NOT_SET" });
    expect(callCount()).toBe(0);
    expect(dailyPlans.findByKeyCallCount).toBe(0);
  });

  it("C1. derives the Asia/Jerusalem local date even when it differs from the UTC date", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "Asia/Jerusalem");
    const courses = new InMemoryCourseDatabase();
    const dailyPlans = new InMemoryDailyPlanDatabase();

    // 23:00 UTC + winter UTC+2 = 01:00 the NEXT day in Jerusalem.
    const now = new Date("2026-01-10T23:00:00.000Z");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.plannedForDate).toBe("2026-01-11");
    }
  });

  it("C2. derives the America/New_York local date even when it differs from the UTC date", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "America/New_York");
    const courses = new InMemoryCourseDatabase();
    const dailyPlans = new InMemoryDailyPlanDatabase();

    // 03:00 UTC - winter UTC-5 = 22:00 the PREVIOUS day in New York.
    const now = new Date("2026-01-10T03:00:00.000Z");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.plannedForDate).toBe("2026-01-09");
    }
  });

  it("D. pools progress only from LEARNER-role Courses, excluding OWNER/INSTRUCTOR", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-a", role: "LEARNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-b", role: "OWNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-c", role: "INSTRUCTOR" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress("course-a", makeProgress({ questionId: "question-a" }));
    dailyPlans.seedProgress("course-b", makeProgress({ questionId: "question-b" }));
    dailyPlans.seedProgress("course-c", makeProgress({ questionId: "question-c" }));
    dailyPlans.setCurrentVersion("question-a", "qv-a");
    dailyPlans.setCurrentVersion("question-b", "qv-b");
    dailyPlans.setCurrentVersion("question-c", "qv-c");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items.length).toBe(1);
      expect(result.plan.items[0].questionId).toBe("question-a");
      expect(result.plan.items[0].courseId).toBe("course-a");
    }
    // Only course-a was ever queried — course-b/course-c were excluded
    // before any progress read, not merely filtered from the output.
    expect(dailyPlans.listForUserCallCount).toBe(1);
  });

  it("E. excludes an archived LEARNER membership's Course entirely", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(
      makeMembership({
        courseId: "course-a",
        role: "LEARNER",
        archivedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress("course-a", makeProgress({ questionId: "question-a" }));
    dailyPlans.setCurrentVersion("question-a", "qv-a");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items).toEqual([]);
    }
    expect(dailyPlans.listForUserCallCount).toBe(0);
  });

  it("F. excludes a revoked LEARNER membership's Course entirely", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(
      makeMembership({
        courseId: "course-a",
        role: "LEARNER",
        revokedAt: new Date("2026-01-02T00:00:00.000Z"),
      }),
    );

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress("course-a", makeProgress({ questionId: "question-a" }));
    dailyPlans.setCurrentVersion("question-a", "qv-a");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items).toEqual([]);
    }
    expect(dailyPlans.listForUserCallCount).toBe(0);
  });

  it("G. persists a READY empty DailyPlan when there are zero eligible LEARNER memberships", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-b", role: "OWNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-c", role: "INSTRUCTOR" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items).toEqual([]);
      expect(dailyPlans.hasDailyPlan({ userId: USER_ID, plannedForDate: result.plan.plannedForDate })).toBe(true);
    }
  });

  it("H. a call on the next local day produces a different DailyPlan", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-a", role: "LEARNER" }));
    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress("course-a", makeProgress({ questionId: "question-a" }));
    dailyPlans.setCurrentVersion("question-a", "qv-a");

    const ports = {
      users: users.repo(),
      courseMemberships: courses.repos().memberships,
      courses: courses.repos().courses,
      dailyPlanUnitOfWork: dailyPlans,
    };

    const first = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T10:00:00.000Z") },
      makeSettings(),
      ports,
    );
    const second = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-11T10:00:00.000Z") },
      makeSettings(),
      ports,
    );

    expect(first.outcome).toBe("READY");
    expect(second.outcome).toBe("READY");
    if (first.outcome === "READY" && second.outcome === "READY") {
      expect(first.plan.plannedForDate).toBe("2026-01-10");
      expect(second.plan.plannedForDate).toBe("2026-01-11");
      expect(second.plan.id).not.toBe(first.plan.id);
    }
  });

  it("I. two calls on the same local day return the same persisted DailyPlan without regeneration", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-a", role: "LEARNER" }));
    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress("course-a", makeProgress({ questionId: "question-a" }));
    dailyPlans.setCurrentVersion("question-a", "qv-a");

    const ports = {
      users: users.repo(),
      courseMemberships: courses.repos().memberships,
      courses: courses.repos().courses,
      dailyPlanUnitOfWork: dailyPlans,
    };

    const first = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T08:00:00.000Z") },
      makeSettings(),
      ports,
    );

    const listForUserCallsAfterFirst = dailyPlans.listForUserCallCount;
    const getCurrentVersionCallsAfterFirst = dailyPlans.getCurrentVersionCallCount;

    const second = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T20:00:00.000Z") },
      makeSettings(),
      ports,
    );

    expect(first.outcome).toBe("READY");
    expect(second.outcome).toBe("READY");
    if (first.outcome === "READY" && second.outcome === "READY") {
      expect(second.plan).toEqual(first.plan);
    }
    expect(dailyPlans.listForUserCallCount).toBe(listForUserCallsAfterFirst);
    expect(dailyPlans.getCurrentVersionCallCount).toBe(getCurrentVersionCallsAfterFirst);
  });

  it("J. duplicate LEARNER memberships for the same Course do not leak duplicated processing", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    // A real DB's UNIQUE (user_id, course_id) prevents this; the fake's
    // listActiveForUser has no such constraint, so this exercises the
    // internal generation core's own eligibleCourseIds deduplication
    // (added in the "harden daily plan generation inputs" slice) via this
    // public entry point, without reimplementing it here.
    const membershipsRepo = courses.repos().memberships;
    const doubledMemberships: CourseMembershipRepository = {
      ...membershipsRepo,
      listActiveForUser: async (userId) => {
        const real = await membershipsRepo.listActiveForUser(userId);
        return [...real, ...real];
      },
    };
    courses.seedMembership(makeMembership({ courseId: "course-a", role: "LEARNER" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress(
      "course-a",
      makeProgress({ questionId: "question-a", masteryCategory: "strengthening" }),
    );
    dailyPlans.setCurrentVersion("question-a", "qv-a");

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: doubledMemberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items.length).toBe(1);
      expect(result.plan.items[0].otherApplicableTypes).toEqual(["STRENGTHEN_MEMORY"]);
    }
    expect(dailyPlans.listForUserCallCount).toBe(1);
  });

  it("K. fresh learner regression (ADR-017, Night-Run Slice 5): active LEARNER membership, zero Attempts, zero UserQuestionProgress, but eligible unseen Questions — Today is non-empty, not the previously-real empty-plan gap", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-a", role: "LEARNER" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();
    // Deliberately NO seedProgress call — this is the exact fresh-learner
    // state the gap described in docs/DEV_STATUS.md (pre-ADR-017) produced
    // an empty Today for.
    dailyPlans.seedUnseenQuestion("course-a", {
      questionId: "question-new",
      courseId: "course-a",
      questionVersionId: "qv-new",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items).toHaveLength(1);
      expect(result.plan.items[0].actionType).toBe("NEW_LEARNING");
      expect(result.plan.items[0].questionId).toBe("question-new");
    }
  });

  it("L. new-material discovery reuses the SAME LEARNER-only eligible Course set as normal candidates — OWNER/INSTRUCTOR Courses are never queried for unseen questions either", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedMembership(makeMembership({ courseId: "course-learner", role: "LEARNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-owner", role: "OWNER" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedUnseenQuestion("course-learner", {
      questionId: "question-learner",
      courseId: "course-learner",
      questionVersionId: "qv-learner",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    dailyPlans.seedUnseenQuestion("course-owner", {
      questionId: "question-owner",
      courseId: "course-owner",
      questionVersionId: "qv-owner",
      createdAt: new Date("2025-01-01T00:00:00.000Z"), // earlier — would win if wrongly included
    });

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.plan.items).toHaveLength(1);
      expect(result.plan.items[0].questionId).toBe("question-learner");
    }
  });

  it("M. excludes a Course whose OWN status is ARCHIVED, even though the LEARNER membership itself is neither revoked nor archived (Run 008 S4) — both ranked-progress and unseen/new-material candidates", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    // Explicitly seed the Course as ARCHIVED before the membership — this
    // is `courses.status`, Run 005's whole-Course instructor-lifecycle
    // field, NOT `CourseMembership.archivedAt` (already covered by test E,
    // a distinct per-learner fact, ADR-015 §9). The membership row here is
    // fully active: `archivedAt: null`, `revokedAt: null`.
    courses.seedCourse("course-archived", "AUTHORIZED_ONLY", "Archived Course", "ARCHIVED");
    courses.seedMembership(makeMembership({ courseId: "course-archived", role: "LEARNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-active", role: "LEARNER" }));

    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedProgress(
      "course-archived",
      makeProgress({ questionId: "question-archived-progress", masteryCategory: "strengthening" }),
    );
    dailyPlans.setCurrentVersion("question-archived-progress", "qv-archived-progress");
    dailyPlans.seedUnseenQuestion("course-archived", {
      questionId: "question-archived-unseen",
      courseId: "course-archived",
      questionVersionId: "qv-archived-unseen",
      createdAt: new Date("2025-01-01T00:00:00.000Z"), // earlier — would win if wrongly included
    });
    dailyPlans.seedUnseenQuestion("course-active", {
      questionId: "question-active-unseen",
      courseId: "course-active",
      questionVersionId: "qv-active-unseen",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      const questionIds = result.plan.items.map((item) => item.questionId);
      expect(questionIds).not.toContain("question-archived-progress");
      expect(questionIds).not.toContain("question-archived-unseen");
      expect(questionIds).toContain("question-active-unseen");
    }
  });

  it("N. excludes an ARCHIVED Course's unseen/new-material candidate specifically via the fallback path — zero ranked/progress candidates anywhere, isolating the fallback branch (Run 008 S4, addresses review rigor note on test M)", async () => {
    const users = new InMemoryUserDatabase();
    users.seedUser(USER_ID, "UTC");
    const courses = new InMemoryCourseDatabase();
    courses.seedCourse("course-archived", "AUTHORIZED_ONLY", "Archived Course", "ARCHIVED");
    courses.seedMembership(makeMembership({ courseId: "course-archived", role: "LEARNER" }));
    courses.seedMembership(makeMembership({ courseId: "course-active", role: "LEARNER" }));

    // No `seedProgress` call anywhere in this test — zero ranked candidates
    // exist for either Course, so `generateDailyPlanForResolvedInputs`'s
    // unseen/new-material fallback (ADR-017) is the ONLY path that could
    // possibly place an item, isolating exactly the branch the S4 review
    // noted test M's ranked-progress candidate left unexercised.
    const dailyPlans = new InMemoryDailyPlanDatabase();
    dailyPlans.seedUnseenQuestion("course-archived", {
      questionId: "question-archived-unseen-only",
      courseId: "course-archived",
      questionVersionId: "qv-archived-unseen-only",
      createdAt: new Date("2025-01-01T00:00:00.000Z"), // earlier — would win if wrongly included
    });
    dailyPlans.seedUnseenQuestion("course-active", {
      questionId: "question-active-unseen-only",
      courseId: "course-active",
      questionVersionId: "qv-active-unseen-only",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const result = await getOrCreateDailyPlanForToday(
      { userId: USER_ID, now: new Date("2026-01-10T00:00:00.000Z") },
      makeSettings(),
      {
        users: users.repo(),
        courseMemberships: courses.repos().memberships,
        courses: courses.repos().courses,
        dailyPlanUnitOfWork: dailyPlans,
      },
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      const questionIds = result.plan.items.map((item) => item.questionId);
      expect(questionIds).not.toContain("question-archived-unseen-only");
      expect(questionIds).toContain("question-active-unseen-only");
    }
  });
});

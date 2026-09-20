import { describe, expect, it } from "vitest";

import { getCourseContextForLearner } from "../get-course-context-for-learner";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("getCourseContextForLearner", () => {
  it("returns COURSE_NOT_FOUND for an unknown course", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "does-not-exist" },
      db.repos(),
    );

    expect(result.outcome).toBe("COURSE_NOT_FOUND");
  });

  it("returns NOT_A_MEMBER for an authenticated user with no membership", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Intro to Economics");

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_A_MEMBER");
  });

  it("returns ACCESS_REVOKED for a revoked membership", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Intro to Economics");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-01-10T00:00:00Z"),
      archivedAt: null,
    });

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ACCESS_REVOKED");
  });

  it("returns READY with course and membership for an active member", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Intro to Economics");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    expect(result.course).toEqual({ id: "course-1", title: "Intro to Economics" });
    expect(result.membership.role).toBe("LEARNER");
  });

  it("returns READY for an active OWNER membership without downgrading it", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Owned Course");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    expect(result.membership.role).toBe("OWNER");
  });

  it("does not leak another user's membership as this user's context", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Intro to Economics");
    db.seedMembership({
      id: "m1",
      userId: "user-2",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseContextForLearner(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_A_MEMBER");
  });
});

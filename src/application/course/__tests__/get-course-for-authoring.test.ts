import { describe, expect, it } from "vitest";

import { getCourseForAuthoring } from "../get-course-for-authoring";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("getCourseForAuthoring", () => {
  it("returns full authoring context for an active OWNER", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
    if (result.outcome !== "READY") throw new Error("unreachable");
    expect(result.course.status).toBe("DRAFT");
  });

  it("returns full authoring context for an active INSTRUCTOR", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "INSTRUCTOR",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("READY");
  });

  it("denies a LEARNER", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("denies a non-member", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("denies a revoked OWNER", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      archivedAt: null,
    });

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("denies an archived INSTRUCTOR", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "INSTRUCTOR",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("never leaks COURSE_NOT_FOUND to an unauthorized caller (authorization checked before existence)", async () => {
    const db = new InMemoryCourseDatabase();
    // No seeded course at all.
    const result = await getCourseForAuthoring(
      { actorUserId: "user-1", courseId: "does-not-exist" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });
});

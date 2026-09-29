import { describe, expect, it } from "vitest";

import { listMyCourses } from "../list-my-courses";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("listMyCourses", () => {
  it("returns no courses for a learner with zero memberships", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([]);
  });

  it("returns active courses with title and role", async () => {
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

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([
      { courseId: "course-1", title: "Intro to Economics", role: "LEARNER", isAuthor: false },
    ]);
  });

  it("excludes a revoked membership", async () => {
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

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([]);
  });

  it("excludes an archived membership", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Intro to Economics");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: new Date("2026-01-10T00:00:00Z"),
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([]);
  });

  it("does not downgrade or hide an active OWNER membership", async () => {
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

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    // RUN010-H.1's backfill gives an active OWNER membership a matching
    // active course_authors grant, so `isAuthor` is also true.
    expect(result).toEqual([
      { courseId: "course-1", title: "Owned Course", role: "OWNER", isAuthor: true },
    ]);
  });

  // RUN010-H.2 (FUB-036, Option 4 architecture, required DTO/API surface
  // change): a Part-B-created Course's creator has NO course_memberships row
  // at all — must still appear in "My Courses" (otherwise it would silently
  // vanish from both My Courses and the instructor Courses list).
  it("includes a Course the actor only authors, with no course_memberships row, as role: null / isAuthor: true", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "New Course", "DRAFT");
    db.seedAuthorGrant({
      userId: "user-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([
      { courseId: "course-1", title: "New Course", role: null, isAuthor: true },
    ]);
  });

  it("does not duplicate a Course covered by both an active membership and an active course_authors grant", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Owned Course");
    // seedMembership auto-derives the matching course_authors grant
    // (RUN010-H.1 backfill semantics) — no separate seedAuthorGrant call.
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ courseId: "course-1", title: "Owned Course", role: "OWNER", isAuthor: true });
  });

  it("a revoked course_authors grant does not make isAuthor true", async () => {
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
    db.seedAuthorGrant({
      userId: "user-1",
      courseId: "course-1",
      capability: "INSTRUCTOR",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([
      { courseId: "course-1", title: "Intro to Economics", role: "LEARNER", isAuthor: false },
    ]);
  });

  it("cannot read another user's memberships", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Someone Else's Course");
    db.seedMembership({
      id: "m1",
      userId: "user-2",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result).toEqual([]);
  });

  it("sorts multiple active courses deterministically by title", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-b", "OPEN", "Zoology");
    db.seedCourse("course-a", "OPEN", "Astronomy");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-b",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });
    db.seedMembership({
      id: "m2",
      userId: "user-1",
      courseId: "course-a",
      role: "LEARNER",
      joinedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await listMyCourses({ actorUserId: "user-1" }, db.repos());

    expect(result.map((entry) => entry.title)).toEqual(["Astronomy", "Zoology"]);
  });
});

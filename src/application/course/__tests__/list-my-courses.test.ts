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
      { courseId: "course-1", title: "Intro to Economics", role: "LEARNER" },
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

    expect(result).toEqual([{ courseId: "course-1", title: "Owned Course", role: "OWNER" }]);
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

import { describe, expect, it } from "vitest";

import { publishCourse } from "../publish-course";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

function seedOwner(db: InMemoryCourseDatabase, status: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
  db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", status);
  db.seedMembership({
    id: "m1",
    userId: "user-1",
    courseId: "course-1",
    role: "OWNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
  });
}

describe("publishCourse", () => {
  it("publishes a DRAFT course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "DRAFT");

    const result = await publishCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("PUBLISHED");
    if (result.outcome !== "PUBLISHED") throw new Error("unreachable");
    expect(result.course.status).toBe("PUBLISHED");
  });

  it("rejects publishing an already-PUBLISHED course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "PUBLISHED");

    const result = await publishCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("INVALID_TRANSITION");
    if (result.outcome !== "INVALID_TRANSITION") throw new Error("unreachable");
    expect(result.from).toBe("PUBLISHED");
  });

  it("rejects publishing an ARCHIVED course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "ARCHIVED");

    const result = await publishCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("INVALID_TRANSITION");
    if (result.outcome !== "INVALID_TRANSITION") throw new Error("unreachable");
    expect(result.from).toBe("ARCHIVED");
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

    const result = await publishCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("returns NOT_AUTHORIZED (never COURSE_NOT_FOUND) for a non-member against an unknown course — existence is never leaked", async () => {
    const db = new InMemoryCourseDatabase();
    const result = await publishCourse(
      { actorUserId: "user-1", courseId: "does-not-exist" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  // This test protects against: the management check ignoring `revokedAt`, letting a
  // revoked OWNER/INSTRUCTOR change Course lifecycle state.
  it.each([
    ["revoked OWNER", "OWNER"],
    ["revoked INSTRUCTOR", "INSTRUCTOR"],
  ] as const)("denies a %s", async (_label, role) => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role,
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-02-01T00:00:00Z"),
      archivedAt: null,
    });

    const result = await publishCourse({ actorUserId: "user-1", courseId: "course-1" }, db.repos());

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });
});

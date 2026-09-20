import { describe, expect, it } from "vitest";

import { archiveCourse } from "../archive-course";
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

describe("archiveCourse", () => {
  it("archives a DRAFT course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "DRAFT");

    const result = await archiveCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ARCHIVED");
  });

  it("archives a PUBLISHED course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "PUBLISHED");

    const result = await archiveCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ARCHIVED");
  });

  it("rejects archiving an already-ARCHIVED course", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db, "ARCHIVED");

    const result = await archiveCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("INVALID_TRANSITION");
    if (result.outcome !== "INVALID_TRANSITION") throw new Error("unreachable");
    expect(result.from).toBe("ARCHIVED");
  });

  it("denies a LEARNER", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "PUBLISHED");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await archiveCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });
});

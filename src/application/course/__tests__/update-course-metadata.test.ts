import { describe, expect, it } from "vitest";

import { updateCourseMetadata } from "../update-course-metadata";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

function seedOwner(db: InMemoryCourseDatabase, courseId = "course-1") {
  db.seedCourse(courseId, "AUTHORIZED_ONLY", "Original Title", "DRAFT");
  db.seedMembership({
    id: "m1",
    userId: "user-1",
    courseId,
    role: "OWNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
  });
}

describe("updateCourseMetadata", () => {
  it("updates only the title when examDate is omitted", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db);

    const result = await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "course-1", title: "New Title" },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome !== "UPDATED") throw new Error("unreachable");
    expect(result.course.title).toBe("New Title");
    expect(result.course.examDate).toBeNull();
  });

  it("clears examDate when explicitly passed null", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db);
    await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "course-1", examDate: "2026-12-01" },
      db.repos(),
    );

    const result = await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "course-1", examDate: null },
      db.repos(),
    );

    expect(result.outcome).toBe("UPDATED");
    if (result.outcome !== "UPDATED") throw new Error("unreachable");
    expect(result.course.examDate).toBeNull();
  });

  it("rejects an empty title", async () => {
    const db = new InMemoryCourseDatabase();
    seedOwner(db);

    const result = await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "course-1", title: "   " },
      db.repos(),
    );

    expect(result.outcome).toBe("INVALID_TITLE");
  });

  it("denies a LEARNER", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY", "Original Title", "DRAFT");
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "course-1", title: "New Title" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("returns COURSE_NOT_FOUND when the course no longer exists after authorization passes", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "ghost-course",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await updateCourseMetadata(
      { actorUserId: "user-1", courseId: "ghost-course", title: "New Title" },
      db.repos(),
    );

    expect(result.outcome).toBe("COURSE_NOT_FOUND");
  });
});

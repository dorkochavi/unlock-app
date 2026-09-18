import { describe, expect, it } from "vitest";

import { setCourseJoinPolicy } from "../set-course-join-policy";
import { InMemoryCourseDatabase } from "./in-memory-fakes";
import type { CourseMembership } from "../ports";

function seedActor(
  db: InMemoryCourseDatabase,
  overrides: Partial<CourseMembership>,
): void {
  db.seedMembership({
    id: "actor-membership",
    userId: "actor-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  });
}

describe("setCourseJoinPolicy", () => {
  it("allows an OWNER to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, { role: "OWNER" });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "UPDATED", joinPolicy: "OPEN" });
  });

  it("allows an INSTRUCTOR to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, { role: "INSTRUCTOR" });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "UPDATED", joinPolicy: "OPEN" });
  });

  it("does not allow a LEARNER to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, { role: "LEARNER" });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
    const policy = await db.repos().courses.getJoinPolicy("course-1");
    expect(policy).toBe("AUTHORIZED_ONLY");
  });

  it("does not allow a revoked management member to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, { role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  // ADR-015 §9: archive is per-user learning-participation state, independent
  // of §7's access/management facts — an archived (but not revoked) OWNER or
  // INSTRUCTOR retains full management capability over the Course.
  it("allows an archived-but-not-revoked OWNER to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "UPDATED", joinPolicy: "OPEN" });
  });

  it("allows an archived-but-not-revoked INSTRUCTOR to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");
    seedActor(db, {
      role: "INSTRUCTOR",
      archivedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const result = await setCourseJoinPolicy(
      { actorUserId: "actor-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "UPDATED", joinPolicy: "OPEN" });
  });

  it("does not allow a non-member to change joinPolicy", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");

    const result = await setCourseJoinPolicy(
      { actorUserId: "stranger-1", courseId: "course-1", joinPolicy: "OPEN" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

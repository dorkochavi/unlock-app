import { describe, expect, it } from "vitest";

import { joinCourse } from "../join-course";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("joinCourse", () => {
  it("permits authenticated self-join as LEARNER for an OPEN course", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN");

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("JOINED");
    if (result.outcome !== "JOINED") throw new Error("unreachable");
    expect(result.membership.role).toBe("LEARNER");
    expect(result.membership.userId).toBe("user-1");
    expect(result.membership.courseId).toBe("course-1");
    expect(result.membership.revokedAt).toBeNull();
    expect(result.membership.archivedAt).toBeNull();
  });

  it("does not permit unauthorized self-join against AUTHORIZED_ONLY", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "AUTHORIZED_ONLY");

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    // Possession of the courseId alone (ADR-015 §6) never creates a membership.
    const membership = await db.repos().memberships.findMembership("user-1", "course-1");
    expect(membership).toBeNull();
  });

  it("returns COURSE_NOT_FOUND for an unknown course", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "does-not-exist" },
      db.repos(),
    );

    expect(result.outcome).toBe("COURSE_NOT_FOUND");
  });

  it("does not create a duplicate membership on a repeated join", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN");
    const repos = db.repos();

    const first = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      repos,
    );
    const second = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      repos,
    );

    expect(first.outcome).toBe("JOINED");
    expect(second.outcome).toBe("ALREADY_MEMBER");
    if (first.outcome !== "JOINED" || second.outcome !== "ALREADY_MEMBER") {
      throw new Error("unreachable");
    }
    expect(second.membership.id).toBe(first.membership.id);

    const active = await repos.memberships.listActiveForUser("user-1");
    expect(active).toHaveLength(1);
  });

  it("does not downgrade a pre-existing OWNER membership on self-join against an OPEN course", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN");
    db.seedMembership({
      id: "owner-membership",
      userId: "user-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ALREADY_MEMBER");
    if (result.outcome !== "ALREADY_MEMBER") throw new Error("unreachable");
    expect(result.membership.role).toBe("OWNER");
  });

  it("does not overwrite a pre-existing INSTRUCTOR membership on self-join against an OPEN course", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN");
    db.seedMembership({
      id: "instructor-membership",
      userId: "user-1",
      courseId: "course-1",
      role: "INSTRUCTOR",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ALREADY_MEMBER");
    if (result.outcome !== "ALREADY_MEMBER") throw new Error("unreachable");
    expect(result.membership.role).toBe("INSTRUCTOR");
  });

  // Open Question #43: not a decided product rule — pins the current
  // conservative behavior. A revoked membership's row already exists, so
  // `createMembership`'s ON-CONFLICT-DO-NOTHING path returns it unchanged
  // (still revoked) rather than restoring access. The ALREADY_MEMBER outcome
  // label for a still-revoked membership is a known open follow-up, not a
  // designed signal.
  it("does not restore access when a revoked member attempts to rejoin an OPEN course (Open Question #43)", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN");
    db.seedMembership({
      id: "revoked-membership",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-01-15T00:00:00Z"),
      archivedAt: null,
    });

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ALREADY_MEMBER");
    if (result.outcome !== "ALREADY_MEMBER") throw new Error("unreachable");
    expect(result.membership.revokedAt).not.toBeNull();

    const active = await db.repos().memberships.listActiveForUser("user-1");
    expect(active).toHaveLength(0);
  });
});

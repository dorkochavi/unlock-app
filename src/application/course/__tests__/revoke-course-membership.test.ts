import { describe, expect, it } from "vitest";

import { revokeCourseMembership } from "../revoke-course-membership";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("revokeCourseMembership", () => {
  it("removes active access when an OWNER revokes a member", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "owner-membership",
      userId: "owner-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });
    db.seedMembership({
      id: "learner-membership",
      userId: "learner-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });
    const repos = db.repos();

    const result = await revokeCourseMembership(
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "learner-1" },
      repos,
    );

    expect(result.outcome).toBe("REVOKED");
    if (result.outcome !== "REVOKED") throw new Error("unreachable");
    expect(result.membership.revokedAt).not.toBeNull();

    // Row preserved (history durability, ADR-015 §8) — not deleted.
    const stillExists = await repos.memberships.findMembership("learner-1", "course-1");
    expect(stillExists).not.toBeNull();

    const active = await repos.memberships.listActiveForUser("learner-1");
    expect(active).toHaveLength(0);
  });

  it("does not allow a LEARNER to revoke another member", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "learner-membership",
      userId: "learner-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });
    db.seedMembership({
      id: "other-membership",
      userId: "other-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await revokeCourseMembership(
      { actorUserId: "learner-1", courseId: "course-1", targetUserId: "other-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("returns NOT_MEMBER when revoking a user with no membership", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "owner-membership",
      userId: "owner-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });

    const result = await revokeCourseMembership(
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "nobody" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_MEMBER" });
  });
});

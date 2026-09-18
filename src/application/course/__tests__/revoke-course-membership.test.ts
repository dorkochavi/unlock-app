import { afterEach, describe, expect, it, vi } from "vitest";

import { revokeCourseMembership } from "../revoke-course-membership";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("revokeCourseMembership", () => {
  // Safety net in case the fake-timers test below throws before reaching its
  // own `vi.useRealTimers()` call — must not leak faked time into other tests.
  afterEach(() => {
    vi.useRealTimers();
  });

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

  // ADR-015 §9: archive is per-user learning-participation state, independent
  // of §7's access/management facts — an archived (but not revoked) OWNER or
  // INSTRUCTOR retains full management capability, including revoking others.
  it("allows an archived-but-not-revoked OWNER to revoke another member", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "owner-membership",
      userId: "owner-1",
      courseId: "course-1",
      role: "OWNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: new Date("2026-02-01T00:00:00Z"),
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

    const result = await revokeCourseMembership(
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "learner-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("REVOKED");
  });

  // Open Question #43: not a decided product rule — pins the current,
  // unguarded behavior so a future decision changes it deliberately, not by
  // accident. A sole management member can revoke their own management
  // access, leaving the Course with zero management members.
  it("currently allows a sole OWNER to revoke their own membership (Open Question #43)", async () => {
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
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "owner-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("REVOKED");
    if (result.outcome !== "REVOKED") throw new Error("unreachable");
    expect(result.membership.revokedAt).not.toBeNull();
  });

  // Open Question #43: not a decided audit guarantee — pins the current
  // behavior that a second revoke call moves the timestamp forward rather
  // than preserving the first revocation's timestamp. Harmless to the
  // boolean access fact (still revoked either way).
  it("currently overwrites revokedAt on a repeated revoke call (Open Question #43)", async () => {
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

    // Fake timers guarantee the two `new Date()` calls inside
    // revokeCourseMembership land on distinct instants — real-clock timing
    // could otherwise coincide within the same millisecond and make this
    // assertion flaky.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
    const first = await revokeCourseMembership(
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "learner-1" },
      repos,
    );
    vi.setSystemTime(new Date("2026-03-01T00:00:01.000Z"));
    const second = await revokeCourseMembership(
      { actorUserId: "owner-1", courseId: "course-1", targetUserId: "learner-1" },
      repos,
    );
    vi.useRealTimers();

    if (first.outcome !== "REVOKED" || second.outcome !== "REVOKED") {
      throw new Error("unreachable");
    }
    expect(second.membership.revokedAt).not.toEqual(first.membership.revokedAt);
  });
});

import { describe, expect, it } from "vitest";

import {
  archiveCourseMembership,
  unarchiveCourseMembership,
} from "../archive-course-membership";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("archiveCourseMembership / unarchiveCourseMembership", () => {
  it("archives a membership: preserved, but excluded from active memberships", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: null,
    });
    const repos = db.repos();

    const result = await archiveCourseMembership(
      { actorUserId: "user-1", courseId: "course-1" },
      repos,
    );

    expect(result.outcome).toBe("ARCHIVED");
    if (result.outcome !== "ARCHIVED") throw new Error("unreachable");
    expect(result.membership.archivedAt).not.toBeNull();
    // Still accessible — archive never revokes access (ADR-015 §7).
    expect(result.membership.revokedAt).toBeNull();

    const stillExists = await repos.memberships.findMembership("user-1", "course-1");
    expect(stillExists).not.toBeNull();

    const active = await repos.memberships.listActiveForUser("user-1");
    expect(active).toHaveLength(0);
  });

  it("unarchiving restores active membership", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedMembership({
      id: "m1",
      userId: "user-1",
      courseId: "course-1",
      role: "LEARNER",
      joinedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
      archivedAt: new Date("2026-01-15T00:00:00Z"),
    });
    const repos = db.repos();

    const result = await unarchiveCourseMembership(
      { actorUserId: "user-1", courseId: "course-1" },
      repos,
    );

    expect(result.outcome).toBe("UNARCHIVED");
    if (result.outcome !== "UNARCHIVED") throw new Error("unreachable");
    expect(result.membership.archivedAt).toBeNull();

    const active = await repos.memberships.listActiveForUser("user-1");
    expect(active).toHaveLength(1);
  });

  it("returns NOT_MEMBER when archiving a nonexistent membership", async () => {
    const db = new InMemoryCourseDatabase();

    const result = await archiveCourseMembership(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_MEMBER" });
  });
});

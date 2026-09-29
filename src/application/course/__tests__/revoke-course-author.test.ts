import { describe, expect, it } from "vitest";

import { revokeCourseAuthor } from "../revoke-course-author";
import { InMemoryCourseDatabase } from "./in-memory-fakes";

describe("revokeCourseAuthor", () => {
  it("revokes one of several active authors successfully", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    db.seedAuthorGrant({
      userId: "instructor-1",
      courseId: "course-1",
      capability: "INSTRUCTOR",
      grantedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "instructor-1",
        capability: "INSTRUCTOR",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("REVOKED");
    if (result.outcome !== "REVOKED") throw new Error("unreachable");
    expect(result.grant.revokedAt).not.toBeNull();

    const remaining = await db.repos().authors.findActiveCapabilities("owner-1", "course-1");
    expect(remaining).toHaveLength(1);
  });

  // RUN010-H.3 (FUB-036, Option 4 decision 2, APPROVED 2026-09-29): the
  // approved last-author-protection rule.
  it("fails closed with LAST_AUTHOR when revoking the sole active author/capability on a Course, mutating nothing", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "owner-1",
        capability: "OWNER",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("LAST_AUTHOR");

    // Nothing mutated — the grant is still active.
    const remaining = await db.repos().authors.findActiveCapabilities("owner-1", "course-1");
    expect(remaining).toHaveLength(1);
    expect(remaining[0].revokedAt).toBeNull();
  });

  it("does not allow a non-author to revoke", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    db.seedAuthorGrant({
      userId: "instructor-1",
      courseId: "course-1",
      capability: "INSTRUCTOR",
      grantedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "no-grant-user",
        courseId: "course-1",
        targetUserId: "instructor-1",
        capability: "INSTRUCTOR",
      },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("returns NOT_A_GRANT_HOLDER when the target holds no such capability", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "nobody",
        capability: "INSTRUCTOR",
      },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_A_GRANT_HOLDER" });
  });

  it("distinguishes 'zero active rows total' from 'this user holds another still-active capability' — revoking one of a dual-capability user's two grants (leaving the other active) succeeds, not LAST_AUTHOR", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "INSTRUCTOR",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "owner-1",
        capability: "INSTRUCTOR",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("REVOKED");

    // The last remaining row (OWNER) makes any FURTHER revoke hit LAST_AUTHOR.
    const second = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "owner-1",
        capability: "OWNER",
      },
      db.repos(),
    );
    expect(second.outcome).toBe("LAST_AUTHOR");
  });

  it("does not touch a different Course's active grant count", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    db.seedAuthorGrant({
      userId: "owner-1",
      courseId: "course-2",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    db.seedAuthorGrant({
      userId: "instructor-1",
      courseId: "course-1",
      capability: "INSTRUCTOR",
      grantedAt: new Date("2026-01-02T00:00:00Z"),
      revokedAt: null,
    });

    const result = await revokeCourseAuthor(
      {
        actorUserId: "owner-1",
        courseId: "course-1",
        targetUserId: "instructor-1",
        capability: "INSTRUCTOR",
      },
      db.repos(),
    );

    expect(result.outcome).toBe("REVOKED");
    const course2Grants = await db.repos().authors.findActiveCapabilities("owner-1", "course-2");
    expect(course2Grants).toHaveLength(1);
    expect(course2Grants[0].revokedAt).toBeNull();
  });
});

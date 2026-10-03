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

  it("does not permit self-join against a DRAFT course even when OPEN (Run 005 S2)", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Test Course", "DRAFT");

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    const membership = await db.repos().memberships.findMembership("user-1", "course-1");
    expect(membership).toBeNull();
  });

  it("does not permit self-join against an ARCHIVED course even when OPEN (Run 005 S2)", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Test Course", "ARCHIVED");

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    const membership = await db.repos().memberships.findMembership("user-1", "course-1");
    expect(membership).toBeNull();
  });

  it("permits self-join against a PUBLISHED OPEN course (Run 005 S2 default)", async () => {
    const db = new InMemoryCourseDatabase();
    db.seedCourse("course-1", "OPEN", "Test Course", "PUBLISHED");

    const result = await joinCourse(
      { actorUserId: "user-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("JOINED");
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

  // RUN010-H.3 (FUB-036, Option 4 decision 1, APPROVED 2026-09-29): the
  // approved narrow author self-enrollment exception (DRAFT/AUTHORIZED_ONLY;
  // ARCHIVED is excluded per OQ-045 — see the nested describe below).
  describe("author self-enrollment bypass", () => {
    it("permits an active Course Author to self-join their own DRAFT Course as LEARNER", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      });

      const result = await joinCourse(
        { actorUserId: "author-1", courseId: "course-1" },
        db.repos(),
      );

      expect(result.outcome).toBe("JOINED");
      if (result.outcome !== "JOINED") throw new Error("unreachable");
      expect(result.membership.role).toBe("LEARNER");
      expect(result.membership.revokedAt).toBeNull();
      expect(result.membership.archivedAt).toBeNull();
    });

    it("permits an active Course Author to self-join their own AUTHORIZED_ONLY PUBLISHED Course as LEARNER", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "PUBLISHED");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "INSTRUCTOR",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      });

      const result = await joinCourse(
        { actorUserId: "author-1", courseId: "course-1" },
        db.repos(),
      );

      expect(result.outcome).toBe("JOINED");
    });

    it("does not permit a non-author to use the bypass against the same DRAFT Course", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      });

      const result = await joinCourse(
        { actorUserId: "stranger-1", courseId: "course-1" },
        db.repos(),
      );

      expect(result.outcome).toBe("NOT_AUTHORIZED");
      const membership = await db.repos().memberships.findMembership("stranger-1", "course-1");
      expect(membership).toBeNull();
    });

    it("scopes the bypass to exactly the Course the actor authors, not global", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "AUTHORIZED_ONLY", "Author's Course", "DRAFT");
      db.seedCourse("course-2", "AUTHORIZED_ONLY", "Someone Else's Course", "DRAFT");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      });

      const result = await joinCourse(
        { actorUserId: "author-1", courseId: "course-2" },
        db.repos(),
      );

      expect(result.outcome).toBe("NOT_AUTHORIZED");
      const membership = await db.repos().memberships.findMembership("author-1", "course-2");
      expect(membership).toBeNull();
    });

    it("does not permit the bypass once the author's grant is revoked", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "DRAFT");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: new Date("2026-02-01T00:00:00Z"),
      });

      const result = await joinCourse(
        { actorUserId: "author-1", courseId: "course-1" },
        db.repos(),
      );

      expect(result.outcome).toBe("NOT_AUTHORIZED");
    });

    it("still uses the normal ordinary self-join path (no bypass needed) when the Course is already OPEN/PUBLISHED, even for an author", async () => {
      const db = new InMemoryCourseDatabase();
      db.seedCourse("course-1", "OPEN", "Test Course", "PUBLISHED");
      db.seedAuthorGrant({
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER",
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      });

      const result = await joinCourse(
        { actorUserId: "author-1", courseId: "course-1" },
        db.repos(),
      );

      expect(result.outcome).toBe("JOINED");
      if (result.outcome !== "JOINED") throw new Error("unreachable");
      expect(result.membership.role).toBe("LEARNER");
    });

    // OQ-045 Option B (POST-RUN010-PRODUCT-FIX-001): ARCHIVED is a hard-stop
    // for NEW enrollment, even for an active Course Author.
    describe("ARCHIVED lifecycle hard-stop (OQ-045 Option B)", () => {
      const author = {
        userId: "author-1",
        courseId: "course-1",
        capability: "OWNER" as const,
        grantedAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
      };

      it("denies an active author with no membership on an ARCHIVED Course and creates nothing", async () => {
        for (const policy of ["OPEN", "AUTHORIZED_ONLY"] as const) {
          const db = new InMemoryCourseDatabase();
          db.seedCourse("course-1", policy, "Test Course", "ARCHIVED");
          db.seedAuthorGrant(author);

          const result = await joinCourse(
            { actorUserId: "author-1", courseId: "course-1" },
            db.repos(),
          );

          expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
          expect(await db.repos().memberships.findMembership("author-1", "course-1")).toBeNull();
          expect(await db.repos().memberships.listActiveForUser("author-1")).toHaveLength(0);
        }
      });

      it("returns idempotent ALREADY_MEMBER for an author with an existing ACTIVE LEARNER membership, leaving it unchanged", async () => {
        const db = new InMemoryCourseDatabase();
        db.seedCourse("course-1", "AUTHORIZED_ONLY", "Test Course", "ARCHIVED");
        db.seedAuthorGrant(author);
        const seeded = {
          id: "learner-membership",
          userId: "author-1",
          courseId: "course-1",
          role: "LEARNER" as const,
          joinedAt: new Date("2026-01-02T00:00:00Z"),
          revokedAt: null,
          archivedAt: null,
        };
        db.seedMembership(seeded);

        const result = await joinCourse(
          { actorUserId: "author-1", courseId: "course-1" },
          db.repos(),
        );

        expect(result.outcome).toBe("ALREADY_MEMBER");
        if (result.outcome !== "ALREADY_MEMBER") throw new Error("unreachable");
        expect(result.membership).toEqual(seeded);
        expect(await db.repos().memberships.findMembership("author-1", "course-1")).toEqual(seeded);
      });

      it("fails closed (NOT_AUTHORIZED, unchanged) for an author whose existing membership is revoked (OQ-043 unresolved)", async () => {
        const db = new InMemoryCourseDatabase();
        db.seedCourse("course-1", "OPEN", "Test Course", "ARCHIVED");
        db.seedAuthorGrant(author);
        const seeded = {
          id: "revoked-membership",
          userId: "author-1",
          courseId: "course-1",
          role: "LEARNER" as const,
          joinedAt: new Date("2026-01-02T00:00:00Z"),
          revokedAt: new Date("2026-01-15T00:00:00Z"),
          archivedAt: null,
        };
        db.seedMembership(seeded);

        const result = await joinCourse(
          { actorUserId: "author-1", courseId: "course-1" },
          db.repos(),
        );

        expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
        expect(await db.repos().memberships.findMembership("author-1", "course-1")).toEqual(seeded);
      });

      it("fails closed for an author whose existing membership is archived", async () => {
        const db = new InMemoryCourseDatabase();
        db.seedCourse("course-1", "OPEN", "Test Course", "ARCHIVED");
        db.seedAuthorGrant(author);
        const seeded = {
          id: "archived-membership",
          userId: "author-1",
          courseId: "course-1",
          role: "LEARNER" as const,
          joinedAt: new Date("2026-01-02T00:00:00Z"),
          revokedAt: null,
          archivedAt: new Date("2026-01-15T00:00:00Z"),
        };
        db.seedMembership(seeded);

        const result = await joinCourse(
          { actorUserId: "author-1", courseId: "course-1" },
          db.repos(),
        );

        expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
        expect(await db.repos().memberships.findMembership("author-1", "course-1")).toEqual(seeded);
      });

      it("still denies a non-author on an ARCHIVED Course, even with an existing active membership (unchanged non-author behavior)", async () => {
        const db = new InMemoryCourseDatabase();
        db.seedCourse("course-1", "OPEN", "Test Course", "ARCHIVED");
        db.seedAuthorGrant(author);
        db.seedMembership({
          id: "stranger-membership",
          userId: "stranger-1",
          courseId: "course-1",
          role: "LEARNER",
          joinedAt: new Date("2026-01-02T00:00:00Z"),
          revokedAt: null,
          archivedAt: null,
        });

        const result = await joinCourse(
          { actorUserId: "stranger-1", courseId: "course-1" },
          db.repos(),
        );
        const noMembership = await joinCourse(
          { actorUserId: "stranger-2", courseId: "course-1" },
          db.repos(),
        );

        expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
        expect(noMembership).toEqual({ outcome: "NOT_AUTHORIZED" });
      });

      it("denies an author of a DIFFERENT Course on an ARCHIVED Course", async () => {
        const db = new InMemoryCourseDatabase();
        db.seedCourse("course-1", "OPEN", "Archived", "ARCHIVED");
        db.seedCourse("course-2", "OPEN", "Other", "PUBLISHED");
        db.seedAuthorGrant({ ...author, courseId: "course-2" });

        const result = await joinCourse(
          { actorUserId: "author-1", courseId: "course-1" },
          db.repos(),
        );

        expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
        expect(await db.repos().memberships.findMembership("author-1", "course-1")).toBeNull();
      });
    });
  });
});

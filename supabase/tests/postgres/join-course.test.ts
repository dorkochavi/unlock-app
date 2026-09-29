/**
 * Real-Postgres (PGlite) integration test for the `joinCourse` application
 * use case (ADR-015, Night-Run Slice 6), wired to the REAL
 * `PostgresCourseRepository`/`PostgresCourseMembershipRepository` pair — no
 * fake/test-double ports. `join-course.test.ts` (application layer) already
 * covers this orchestration against in-memory fakes; this file proves the
 * same behavior survives the real migrated schema/constraints, mirroring
 * `skip-daily-plan-item.test.ts`'s own precedent for a use case wired
 * against real repositories together.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { joinCourse } from "../../../src/application/course/join-course";
import { PostgresCourseAuthorRepository } from "../../../src/infrastructure/postgres/course-author-repository";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertUser,
} from "./db-harness";

let db: PGlite;
let courses: PostgresCourseRepository;
let memberships: PostgresCourseMembershipRepository;
let authors: PostgresCourseAuthorRepository;

beforeEach(async () => {
  db = await createTestDb();
  courses = new PostgresCourseRepository(db);
  memberships = new PostgresCourseMembershipRepository(db);
  authors = new PostgresCourseAuthorRepository(db);
});

afterEach(async () => {
  await db.close();
});

describe("joinCourse against real Postgres infrastructure", () => {
  it("joins an OPEN course as LEARNER, persisting a real course_memberships row", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await courses.setJoinPolicy(courseId, "OPEN");
    const learnerId = await insertUser(db);

    const result = await joinCourse(
      { actorUserId: learnerId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("JOINED");
    if (result.outcome !== "JOINED") throw new Error("unreachable");
    expect(result.membership.role).toBe("LEARNER");

    const row = await db.query<{ role: string; user_id: string; course_id: string }>(
      "select role, user_id, course_id from course_memberships where user_id = $1 and course_id = $2",
      [learnerId, courseId],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].role).toBe("LEARNER");
  });

  it("rejects self-join against a default AUTHORIZED_ONLY course, no row created", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const learnerId = await insertUser(db);

    const result = await joinCourse(
      { actorUserId: learnerId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    const row = await db.query(
      "select id from course_memberships where user_id = $1 and course_id = $2",
      [learnerId, courseId],
    );
    expect(row.rows).toHaveLength(0);
  });

  it("repeat join against an OPEN course is idempotent — a single real row, not a duplicate", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await courses.setJoinPolicy(courseId, "OPEN");
    const learnerId = await insertUser(db);

    const first = await joinCourse(
      { actorUserId: learnerId, courseId },
      { courses, memberships, authors },
    );
    const second = await joinCourse(
      { actorUserId: learnerId, courseId },
      { courses, memberships, authors },
    );

    expect(first.outcome).toBe("JOINED");
    expect(second.outcome).toBe("ALREADY_MEMBER");
    const row = await db.query(
      "select id from course_memberships where user_id = $1 and course_id = $2",
      [learnerId, courseId],
    );
    expect(row.rows).toHaveLength(1);
  });

  it("does not restore a revoked membership on rejoin against a real OPEN course (Open Question #43) — fails closed", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    await courses.setJoinPolicy(courseId, "OPEN");
    const learnerId = await insertUser(db);
    await insertCourseMembership(db, {
      userId: learnerId,
      courseId,
      role: "LEARNER",
      revokedAt: new Date("2026-01-15T00:00:00Z"),
    });

    const result = await joinCourse(
      { actorUserId: learnerId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("ALREADY_MEMBER");
    if (result.outcome !== "ALREADY_MEMBER") throw new Error("unreachable");
    expect(result.membership.revokedAt).not.toBeNull();

    const row = await db.query<{ revoked_at: string | null }>(
      "select revoked_at from course_memberships where user_id = $1 and course_id = $2",
      [learnerId, courseId],
    );
    expect(row.rows[0].revoked_at).not.toBeNull();
  });

  // RUN010-H.3 (FUB-036, Option 4 decision 1): the old "never downgrades a
  // pre-existing real OWNER row" scenario this test used to pin is now
  // schema-impossible — course_memberships is learner-participation-only
  // (Migration B narrows its role CHECK constraint to 'LEARNER'-only), so an
  // OWNER row can never exist there again. Replaced by the approved author
  // self-enrollment bypass's own real-Postgres proof below.
  it("an active Course Author self-joins their own DRAFT Course as LEARNER via the bypass", async () => {
    const authorId = await insertUser(db);
    const courseId = await insertCourse(db, authorId, { status: "DRAFT" });
    await authors.grant({
      userId: authorId,
      courseId,
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await joinCourse(
      { actorUserId: authorId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("JOINED");
    if (result.outcome !== "JOINED") throw new Error("unreachable");
    expect(result.membership.role).toBe("LEARNER");

    const row = await db.query<{ role: string }>(
      "select role from course_memberships where user_id = $1 and course_id = $2",
      [authorId, courseId],
    );
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].role).toBe("LEARNER");
  });

  it("a non-author cannot use the bypass against the same DRAFT Course", async () => {
    const authorId = await insertUser(db);
    const courseId = await insertCourse(db, authorId, { status: "DRAFT" });
    await authors.grant({
      userId: authorId,
      courseId,
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    const strangerId = await insertUser(db);

    const result = await joinCourse(
      { actorUserId: strangerId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    const row = await db.query(
      "select id from course_memberships where user_id = $1 and course_id = $2",
      [strangerId, courseId],
    );
    expect(row.rows).toHaveLength(0);
  });

  it("the bypass is scoped to exactly the Course the actor authors, not global", async () => {
    const authorId = await insertUser(db);
    const ownCourseId = await insertCourse(db, authorId, { status: "DRAFT" });
    await authors.grant({
      userId: authorId,
      courseId: ownCourseId,
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    const otherOwnerId = await insertUser(db);
    const otherCourseId = await insertCourse(db, otherOwnerId, { status: "DRAFT" });

    const result = await joinCourse(
      { actorUserId: authorId, courseId: otherCourseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    const row = await db.query(
      "select id from course_memberships where user_id = $1 and course_id = $2",
      [authorId, otherCourseId],
    );
    expect(row.rows).toHaveLength(0);
  });

  it("a revoked author grant does not authorize the bypass", async () => {
    const authorId = await insertUser(db);
    const courseId = await insertCourse(db, authorId, { status: "DRAFT" });
    await authors.grant({
      userId: authorId,
      courseId,
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: new Date("2026-01-15T00:00:00Z"),
    });

    const result = await joinCourse(
      { actorUserId: authorId, courseId },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("returns COURSE_NOT_FOUND for an unknown course, no row created", async () => {
    const learnerId = await insertUser(db);

    const result = await joinCourse(
      { actorUserId: learnerId, courseId: "00000000-0000-0000-0000-000000000000" },
      { courses, memberships, authors },
    );

    expect(result.outcome).toBe("COURSE_NOT_FOUND");
  });
});

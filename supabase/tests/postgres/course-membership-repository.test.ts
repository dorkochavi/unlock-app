/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresCourseMembershipRepository` — proves the SQL against the actual
 * migrated schema, including the `UNIQUE (user_id, course_id)`-backed
 * race-free create path.
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertUser,
} from "./db-harness";
import type { PGlite } from "@electric-sql/pglite";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("PostgresCourseMembershipRepository", () => {
  it("round-trips a membership through findMembership", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId, role: "OWNER" });

    const repo = new PostgresCourseMembershipRepository(db);
    const membership = await repo.findMembership(userId, courseId);

    expect(membership).not.toBeNull();
    expect(membership?.userId).toBe(userId);
    expect(membership?.courseId).toBe(courseId);
    expect(membership?.role).toBe("OWNER");
    expect(membership?.revokedAt).toBeNull();
    expect(membership?.archivedAt).toBeNull();
    expect(membership?.joinedAt).toBeInstanceOf(Date);
  });

  it("returns null when no membership exists", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseMembershipRepository(db);

    expect(await repo.findMembership(userId, courseId)).toBeNull();
  });

  it("createMembership is race-free: a second create for the same pair returns the existing row, not a duplicate", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const learnerId = await insertUser(db);
    const repo = new PostgresCourseMembershipRepository(db);

    const first = await repo.createMembership({
      userId: learnerId,
      courseId,
      role: "LEARNER",
      joinedAt: new Date(),
      revokedAt: null,
      archivedAt: null,
    });
    const second = await repo.createMembership({
      userId: learnerId,
      courseId,
      role: "LEARNER",
      joinedAt: new Date(),
      revokedAt: null,
      archivedAt: null,
    });

    expect(first.wasNew).toBe(true);
    expect(second.wasNew).toBe(false);
    expect(second.membership.id).toBe(first.membership.id);

    const rows = await db.query(
      "select count(*)::int as count from course_memberships where user_id = $1 and course_id = $2",
      [learnerId, courseId],
    );
    expect((rows.rows[0] as { count: number }).count).toBe(1);
  });

  it("listActiveForUser excludes archived and revoked memberships", async () => {
    const userId = await insertUser(db);
    const owner = await insertUser(db);
    const activeCourseId = await insertCourse(db, owner);
    const archivedCourseId = await insertCourse(db, owner);
    const revokedCourseId = await insertCourse(db, owner);

    await insertCourseMembership(db, { userId, courseId: activeCourseId });
    await insertCourseMembership(db, {
      userId,
      courseId: archivedCourseId,
      archivedAt: new Date(),
    });
    await insertCourseMembership(db, {
      userId,
      courseId: revokedCourseId,
      revokedAt: new Date(),
    });

    const repo = new PostgresCourseMembershipRepository(db);
    const active = await repo.listActiveForUser(userId);

    expect(active).toHaveLength(1);
    expect(active[0].courseId).toBe(activeCourseId);
  });

  it("setArchived archives and unarchives", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId });
    const repo = new PostgresCourseMembershipRepository(db);

    const archived = await repo.setArchived(userId, courseId, new Date());
    expect(archived?.archivedAt).not.toBeNull();
    expect(archived?.revokedAt).toBeNull();

    const unarchived = await repo.setArchived(userId, courseId, null);
    expect(unarchived?.archivedAt).toBeNull();
  });

  it("setArchived returns null for a nonexistent membership", async () => {
    const repo = new PostgresCourseMembershipRepository(db);
    expect(await repo.setArchived(randomUUID(), randomUUID(), new Date())).toBeNull();
  });

  it("revoke removes active access without deleting the row", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseMembership(db, { userId, courseId });
    const repo = new PostgresCourseMembershipRepository(db);

    const revoked = await repo.revoke(userId, courseId, new Date());
    expect(revoked?.revokedAt).not.toBeNull();

    const stillExists = await repo.findMembership(userId, courseId);
    expect(stillExists).not.toBeNull();
    expect(stillExists?.revokedAt).not.toBeNull();
  });
});

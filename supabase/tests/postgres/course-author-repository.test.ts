/**
 * Real-Postgres (PGlite) integration tests for
 * `PostgresCourseAuthorRepository` (RUN010-H.1, FUB-036 Option 4
 * architecture) — proves the SQL against the actual migrated `course_authors`
 * schema, mirroring `course-membership-repository.test.ts`'s own structure.
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PostgresCourseAuthorRepository } from "../../../src/infrastructure/postgres/course-author-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseAuthor,
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

describe("PostgresCourseAuthorRepository", () => {
  it("findActiveCapabilities round-trips a granted capability", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseAuthor(db, { userId, courseId, capability: "OWNER" });

    const repo = new PostgresCourseAuthorRepository(db);
    const grants = await repo.findActiveCapabilities(userId, courseId);

    expect(grants).toHaveLength(1);
    expect(grants[0].userId).toBe(userId);
    expect(grants[0].courseId).toBe(courseId);
    expect(grants[0].capability).toBe("OWNER");
    expect(grants[0].revokedAt).toBeNull();
    expect(grants[0].grantedAt).toBeInstanceOf(Date);
  });

  it("findActiveCapabilities returns empty array when no grant exists", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseAuthorRepository(db);

    expect(await repo.findActiveCapabilities(userId, courseId)).toEqual([]);
  });

  it("findActiveCapabilities excludes a revoked grant", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseAuthor(db, {
      userId,
      courseId,
      capability: "OWNER",
      revokedAt: new Date(),
    });

    const repo = new PostgresCourseAuthorRepository(db);
    expect(await repo.findActiveCapabilities(userId, courseId)).toEqual([]);
  });

  it("findActiveCapabilities can return BOTH OWNER and INSTRUCTOR for the same user/Course (forward-compatible shape, unique per capability)", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseAuthor(db, { userId, courseId, capability: "OWNER" });
    await insertCourseAuthor(db, { userId, courseId, capability: "INSTRUCTOR" });

    const repo = new PostgresCourseAuthorRepository(db);
    const grants = await repo.findActiveCapabilities(userId, courseId);

    expect(grants).toHaveLength(2);
    expect(grants.map((g) => g.capability).sort()).toEqual(["INSTRUCTOR", "OWNER"]);
  });

  it("grant is race-free: a second identical grant returns the existing row, not a duplicate", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseAuthorRepository(db);

    const first = await repo.grant({
      userId,
      courseId,
      capability: "INSTRUCTOR",
      grantedAt: new Date(),
      revokedAt: null,
    });
    const second = await repo.grant({
      userId,
      courseId,
      capability: "INSTRUCTOR",
      grantedAt: new Date(),
      revokedAt: null,
    });

    expect(first.wasNew).toBe(true);
    expect(second.wasNew).toBe(false);
    expect(second.grant.id).toBe(first.grant.id);

    const rows = await db.query(
      "select count(*)::int as count from course_authors where user_id = $1 and course_id = $2 and capability = $3",
      [userId, courseId, "INSTRUCTOR"],
    );
    expect((rows.rows[0] as { count: number }).count).toBe(1);
  });

  it("grant allows a second, different capability for the same user/Course pair", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseAuthorRepository(db);

    const owner = await repo.grant({
      userId,
      courseId,
      capability: "OWNER",
      grantedAt: new Date(),
      revokedAt: null,
    });
    const instructor = await repo.grant({
      userId,
      courseId,
      capability: "INSTRUCTOR",
      grantedAt: new Date(),
      revokedAt: null,
    });

    expect(owner.wasNew).toBe(true);
    expect(instructor.wasNew).toBe(true);
    expect(owner.grant.id).not.toBe(instructor.grant.id);
  });

  it("revoke removes active capability without deleting the row, and does not affect a separate capability", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    await insertCourseAuthor(db, { userId, courseId, capability: "OWNER" });
    await insertCourseAuthor(db, { userId, courseId, capability: "INSTRUCTOR" });
    const repo = new PostgresCourseAuthorRepository(db);

    const revoked = await repo.revoke(userId, courseId, "OWNER", new Date());
    expect(revoked?.revokedAt).not.toBeNull();
    expect(revoked?.capability).toBe("OWNER");

    const remaining = await repo.findActiveCapabilities(userId, courseId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].capability).toBe("INSTRUCTOR");

    const rowCount = await db.query(
      "select count(*)::int as count from course_authors where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect((rowCount.rows[0] as { count: number }).count).toBe(2);
  });

  it("revoke returns null for a nonexistent grant", async () => {
    const repo = new PostgresCourseAuthorRepository(db);
    expect(
      await repo.revoke(randomUUID(), randomUUID(), "OWNER", new Date()),
    ).toBeNull();
  });
});

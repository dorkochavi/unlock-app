/**
 * Real-Postgres (PGlite) integration tests for `PostgresCourseUnitOfWork`
 * (Run 005 S2 DB review finding: `createCourse`'s two writes — `courses`
 * insert + creator's OWNER `course_memberships` insert — must commit or
 * roll back together). Proves the actual atomicity/rollback contract that
 * `create-course.test.ts` (in-memory fakes) cannot: its fake
 * `runInTransaction` has no notion of a mid-sequence failure.
 */
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCourse } from "../../../src/application/course/create-course";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import { createTestDb, insertUser, pgliteConnectionProvider } from "./db-harness";

let db: PGlite;
let uow: PostgresCourseUnitOfWork;

beforeEach(async () => {
  db = await createTestDb();
  uow = new PostgresCourseUnitOfWork(pgliteConnectionProvider(db));
});

afterEach(async () => {
  await db.close();
});

async function courseCount(): Promise<number> {
  const result = await db.query<{ count: string }>("select count(*)::int as count from courses");
  return Number(result.rows[0].count);
}

describe("PostgresCourseUnitOfWork", () => {
  it("commits both writes together: the courses row and the OWNER membership both persist", async () => {
    const userId = await insertUser(db);

    const courseId = await uow.runInTransaction(async (repos) => {
      const course = await repos.courses.createCourse({
        ownerUserId: userId,
        title: "Intro to Economics",
        examDate: null,
      });
      await repos.memberships.createMembership({
        userId,
        courseId: course.id,
        role: "OWNER",
        joinedAt: new Date(),
        revokedAt: null,
        archivedAt: null,
      });
      return course.id;
    });

    expect(await courseCount()).toBe(1);
    const membershipRow = await db.query<{ role: string }>(
      "select role from course_memberships where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect(membershipRow.rows).toHaveLength(1);
    expect(membershipRow.rows[0].role).toBe("OWNER");
  });

  it("rolls back the courses insert when the transaction fails before commit — no orphaned, unmanageable Course row", async () => {
    const userId = await insertUser(db);

    await expect(
      uow.runInTransaction(async (repos) => {
        await repos.courses.createCourse({
          ownerUserId: userId,
          title: "Doomed Course",
          examDate: null,
        });
        throw new Error("simulated failure after the courses insert, before the membership insert");
      }),
    ).rejects.toThrow("simulated failure");

    expect(await courseCount()).toBe(0);
  });

  it("createCourse (the real use case, wired to real repositories) persists both rows atomically", async () => {
    const userId = await insertUser(db);

    const result = await createCourse(
      { actorUserId: userId, title: "Real Wiring Course", examDate: "2026-11-12" },
      uow,
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome !== "CREATED") throw new Error("unreachable");

    const membershipRow = await db.query<{ role: string }>(
      "select role from course_memberships where user_id = $1 and course_id = $2",
      [userId, result.course.id],
    );
    expect(membershipRow.rows).toHaveLength(1);
    expect(membershipRow.rows[0].role).toBe("OWNER");
  });

  it("createCourse for an unknown owner rolls back cleanly (owner_user_id FK violation leaves no courses row)", async () => {
    const result = createCourse(
      { actorUserId: randomUUID(), title: "Orphan Owner Course", examDate: null },
      uow,
    );

    await expect(result).rejects.toThrow();
    expect(await courseCount()).toBe(0);
  });
});

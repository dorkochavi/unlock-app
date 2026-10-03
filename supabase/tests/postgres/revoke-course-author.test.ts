/**
 * Real-Postgres (PGlite) proof for `revokeCourseAuthor`'s transactional
 * last-author protection (POST-RUN010-PRODUCT-FIX-001, FUB-042 item 1).
 *
 * LIMIT (stated honestly): PGlite is a single connection. These tests prove
 * the SQL (`SELECT ... FOR UPDATE` executes against the real schema), the
 * committed-state last-author invariant across sequential revokes, and that
 * a failure inside the transaction rolls the revoke back. They do NOT prove
 * true multi-connection lock blocking/serialization between two concurrent
 * revokes — that rests on PostgreSQL's documented FOR UPDATE + READ COMMITTED
 * re-check semantics and is unproven locally.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { revokeCourseAuthor } from "../../../src/application/course/revoke-course-author";
import { PostgresCourseAuthorRepository } from "../../../src/infrastructure/postgres/course-author-repository";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import {
  createTestDb,
  insertCourse,
  insertCourseAuthor,
  insertUser,
  pgliteConnectionProvider,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

async function activeCount(courseId: string): Promise<number> {
  const r = await db.query<{ n: number }>(
    "select count(*)::int as n from course_authors where course_id = $1 and revoked_at is null",
    [courseId],
  );
  return r.rows[0].n;
}

async function setup() {
  const ownerId = await insertUser(db);
  const otherId = await insertUser(db);
  const courseId = await insertCourse(db, ownerId);
  await insertCourseAuthor(db, { userId: ownerId, courseId, capability: "OWNER" });
  await insertCourseAuthor(db, { userId: otherId, courseId, capability: "INSTRUCTOR" });
  const uow = new PostgresCourseUnitOfWork(pgliteConnectionProvider(db));
  return { ownerId, otherId, courseId, uow };
}

describe("revokeCourseAuthor against real PostgreSQL schema (PGlite)", () => {
  it("listActiveForCourseForUpdate returns only active grants of that Course", async () => {
    const { courseId, otherId } = await setup();
    await insertCourseAuthor(db, {
      userId: await insertUser(db),
      courseId,
      capability: "INSTRUCTOR",
      revokedAt: new Date(),
    });
    const repo = new PostgresCourseAuthorRepository(db);
    await db.query("begin");
    const rows = await repo.listActiveForCourseForUpdate(courseId);
    await db.query("commit");
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.userId)).toContain(otherId);
  });

  it("revokes one of two authors, leaving at least one active", async () => {
    const { ownerId, otherId, courseId, uow } = await setup();
    const result = await revokeCourseAuthor(
      { actorUserId: ownerId, courseId, targetUserId: otherId, capability: "INSTRUCTOR" },
      uow,
    );
    expect(result.outcome).toBe("REVOKED");
    expect(await activeCount(courseId)).toBe(1);
  });

  it("refuses to revoke the last active author (LAST_AUTHOR) and mutates nothing", async () => {
    const { ownerId, otherId, courseId, uow } = await setup();
    const first = await revokeCourseAuthor(
      { actorUserId: ownerId, courseId, targetUserId: otherId, capability: "INSTRUCTOR" },
      uow,
    );
    expect(first.outcome).toBe("REVOKED");

    // Sequential stand-in for the race's second revoke: it must evaluate the
    // count against COMMITTED state (1 left), not any stale pre-read of 2.
    const second = await revokeCourseAuthor(
      { actorUserId: ownerId, courseId, targetUserId: ownerId, capability: "OWNER" },
      uow,
    );
    expect(second.outcome).toBe("LAST_AUTHOR");
    expect(await activeCount(courseId)).toBe(1);
  });

  it("returns NOT_A_GRANT_HOLDER / NOT_AUTHORIZED with no mutation", async () => {
    const { ownerId, courseId, uow } = await setup();
    const stranger = await insertUser(db);
    const notHolder = await revokeCourseAuthor(
      { actorUserId: ownerId, courseId, targetUserId: stranger, capability: "INSTRUCTOR" },
      uow,
    );
    expect(notHolder.outcome).toBe("NOT_A_GRANT_HOLDER");
    const notAuthorized = await revokeCourseAuthor(
      { actorUserId: stranger, courseId, targetUserId: ownerId, capability: "OWNER" },
      uow,
    );
    expect(notAuthorized.outcome).toBe("NOT_AUTHORIZED");
    expect(await activeCount(courseId)).toBe(2);
  });

  it("rolls back the revoke if the transaction fails afterwards, without masking the original error", async () => {
    const { otherId, courseId, uow } = await setup();
    await expect(
      uow.runInTransaction(async (repos) => {
        await repos.authors.listActiveForCourseForUpdate(courseId);
        await repos.authors.revoke(otherId, courseId, "INSTRUCTOR", new Date());
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await activeCount(courseId)).toBe(2);
  });
});

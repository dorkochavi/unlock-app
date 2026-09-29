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
import { getCourseForAuthoring } from "../../../src/application/course/get-course-for-authoring";
import { publishCourse } from "../../../src/application/course/publish-course";
import { setCourseJoinPolicy } from "../../../src/application/course/set-course-join-policy";
import { createTopic } from "../../../src/application/topic/create-topic";
import { PostgresCourseAuthorRepository } from "../../../src/infrastructure/postgres/course-author-repository";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
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

  // RUN010-H.2 (FUB-036, Option 4 architecture): createCourse now grants a
  // course_authors OWNER capability instead of a course_memberships OWNER
  // row — see create-course.ts's own doc comment. This test's own name/claim
  // updated accordingly; the atomicity claim itself (both writes commit
  // together) is unchanged, only which second table is written.
  it("createCourse (the real use case, wired to real repositories) persists the Course and the creator's course_authors OWNER grant atomically, with NO course_memberships row", async () => {
    const userId = await insertUser(db);

    const result = await createCourse(
      { actorUserId: userId, title: "Real Wiring Course", examDate: "2026-11-12" },
      uow,
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome !== "CREATED") throw new Error("unreachable");

    const authorRow = await db.query<{ capability: string; revoked_at: string | null }>(
      "select capability, revoked_at from course_authors where user_id = $1 and course_id = $2",
      [userId, result.course.id],
    );
    expect(authorRow.rows).toHaveLength(1);
    expect(authorRow.rows[0].capability).toBe("OWNER");
    expect(authorRow.rows[0].revoked_at).toBeNull();

    // RUN010-H.2's own central invariant: no course_memberships row at all
    // for the creator.
    const membershipRow = await db.query<{ role: string }>(
      "select role from course_memberships where user_id = $1 and course_id = $2",
      [userId, result.course.id],
    );
    expect(membershipRow.rows).toHaveLength(0);
  });

  it("createCourse for an unknown owner rolls back cleanly (owner_user_id FK violation leaves no courses row)", async () => {
    const result = createCourse(
      { actorUserId: randomUUID(), title: "Orphan Owner Course", examDate: null },
      uow,
    );

    await expect(result).rejects.toThrow();
    expect(await courseCount()).toBe(0);
  });

  // RUN010-H.2's own required integration proof: a Course created through
  // the real Postgres-wired createCourse (a) has a real course_authors OWNER
  // grant, (b) has zero course_memberships rows for the creator, and (c)
  // every authoring action still succeeds for that creator end-to-end
  // through the new course_authors path — no course_memberships row is ever
  // needed.
  it("lets the creator author their new Course end-to-end (topic create, publish, join-policy) with zero course_memberships rows", async () => {
    const userId = await insertUser(db);

    const created = await createCourse(
      { actorUserId: userId, title: "Real Authoring Round Trip", examDate: null },
      uow,
    );
    expect(created.outcome).toBe("CREATED");
    if (created.outcome !== "CREATED") throw new Error("unreachable");
    const courseId = created.course.id;

    // (a) real course_authors OWNER grant exists.
    const authorRow = await db.query<{ capability: string; revoked_at: string | null }>(
      "select capability, revoked_at from course_authors where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect(authorRow.rows).toHaveLength(1);
    expect(authorRow.rows[0]).toMatchObject({ capability: "OWNER", revoked_at: null });

    // (b) zero course_memberships rows for the creator.
    const membershipRows = await db.query(
      "select 1 from course_memberships where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect(membershipRows.rows).toHaveLength(0);

    // (c) every authoring action succeeds through the course_authors path.
    const memberships = new PostgresCourseMembershipRepository(db);
    const authors = new PostgresCourseAuthorRepository(db);
    const courses = new PostgresCourseRepository(db);
    const topics = new PostgresTopicRepository(db);

    const topicResult = await createTopic(
      { actorUserId: userId, courseId, name: "Algebra" },
      { memberships, authors, topics },
    );
    expect(topicResult.outcome).toBe("CREATED");

    const joinPolicyResult = await setCourseJoinPolicy(
      { actorUserId: userId, courseId, joinPolicy: "OPEN" },
      { memberships, authors, courses },
    );
    expect(joinPolicyResult.outcome).toBe("UPDATED");

    const publishResult = await publishCourse(
      { actorUserId: userId, courseId },
      { memberships, authors, courses },
    );
    expect(publishResult.outcome).toBe("PUBLISHED");

    const authoringContext = await getCourseForAuthoring(
      { actorUserId: userId, courseId },
      { memberships, authors, courses },
    );
    expect(authoringContext.outcome).toBe("READY");
  });
});

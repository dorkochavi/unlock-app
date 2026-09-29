/**
 * RUN010-H.3 (FUB-036, Option 4 architecture) — proves the Migration B
 * narrowing migration's own effect
 * (`supabase/migrations/20260929020000_course_membership_learner_only_v1.sql`)
 * against REAL pre-existing `course_memberships`/`course_authors` data, not
 * just an empty-table shape.
 *
 * Deliberately does NOT reuse `db-harness.ts`'s `createTestDb()`, which
 * applies every migration (including this one) in one batched `db.exec()`
 * call before any test data exists — that harness cannot exercise a
 * destructive migration against pre-existing rows. Instead this file applies
 * every migration OLDER than the new one, seeds `course_memberships` (and,
 * for the "course_authors unaffected" proof, `course_authors`) rows
 * directly, THEN applies only the new migration file and asserts on its
 * effect — the same migration-ordering-sensitive test shape
 * `course-authors-backfill.test.ts` (H.1) already established.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(dir, "../../migrations");
const NEW_MIGRATION_FILE = "20260929020000_course_membership_learner_only_v1.sql";

const allMigrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (!allMigrationFiles.includes(NEW_MIGRATION_FILE)) {
  // Fails loudly rather than silently testing nothing if the migration is
  // ever renamed without updating this file.
  throw new Error(
    `course-membership-learner-only-narrowing.test.ts: expected migration ` +
      `file "${NEW_MIGRATION_FILE}" not found in ${MIGRATIONS_DIR}`,
  );
}

const priorMigrationSql = allMigrationFiles
  .filter((file) => file < NEW_MIGRATION_FILE)
  .map((file) => readFileSync(path.join(MIGRATIONS_DIR, file), "utf8"))
  .join("\n");

const newMigrationSql = readFileSync(
  path.join(MIGRATIONS_DIR, NEW_MIGRATION_FILE),
  "utf8",
);

let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  // Same minimal `auth.users` stand-in as `db-harness.ts`'s `createTestDb`.
  await db.exec(`
    create schema auth;
    create table auth.users (
      id uuid primary key
    );
  `);
  await db.exec(priorMigrationSql);
});

afterEach(async () => {
  await db.close();
});

async function insertUser(): Promise<string> {
  const id = randomUUID();
  await db.query("insert into users (id) values ($1)", [id]);
  return id;
}

async function insertCourse(ownerUserId: string): Promise<string> {
  const id = randomUUID();
  await db.query(
    "insert into courses (id, owner_user_id, title, status) values ($1, $2, 'Test Course', 'PUBLISHED')",
    [id, ownerUserId],
  );
  return id;
}

async function insertCourseMembership(args: {
  userId: string;
  courseId: string;
  role: "OWNER" | "INSTRUCTOR" | "LEARNER";
  revokedAt?: Date | null;
  archivedAt?: Date | null;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into course_memberships (id, user_id, course_id, role, revoked_at, archived_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      args.userId,
      args.courseId,
      args.role,
      args.revokedAt ?? null,
      args.archivedAt ?? null,
    ],
  );
  return id;
}

async function insertCourseAuthor(args: {
  userId: string;
  courseId: string;
  capability: "OWNER" | "INSTRUCTOR";
  revokedAt?: Date | null;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into course_authors (id, user_id, course_id, capability, revoked_at)
     values ($1, $2, $3, $4, $5)`,
    [id, args.userId, args.courseId, args.capability, args.revokedAt ?? null],
  );
  return id;
}

describe("course_memberships learner-only narrowing (RUN010-H.3 Migration B)", () => {
  it("deletes every legacy OWNER/INSTRUCTOR course_memberships row", async () => {
    const owner = await insertUser();
    const courseId = await insertCourse(owner);
    await insertCourseMembership({ userId: owner, courseId, role: "OWNER" });
    const instructorUser = await insertUser();
    await insertCourseMembership({ userId: instructorUser, courseId, role: "INSTRUCTOR" });
    const revokedInstructor = await insertUser();
    await insertCourseMembership({
      userId: revokedInstructor,
      courseId,
      role: "INSTRUCTOR",
      revokedAt: new Date("2026-01-01T00:00:00Z"),
    });

    await db.exec(newMigrationSql);

    const remaining = await db.query(
      "select count(*)::int as count from course_memberships where role in ('OWNER', 'INSTRUCTOR')",
    );
    expect((remaining.rows[0] as { count: number }).count).toBe(0);
  });

  it("leaves existing LEARNER course_memberships rows completely untouched (including revoked/archived state)", async () => {
    const owner = await insertUser();
    const courseId = await insertCourse(owner);
    const learnerId = await insertUser();
    const learnerMembershipId = await insertCourseMembership({
      userId: learnerId,
      courseId,
      role: "LEARNER",
    });
    const archivedLearnerId = await insertUser();
    await insertCourseMembership({
      userId: archivedLearnerId,
      courseId,
      role: "LEARNER",
      archivedAt: new Date("2026-02-01T00:00:00Z"),
    });

    const before = await db.query("select * from course_memberships where role = 'LEARNER' order by user_id");

    await db.exec(newMigrationSql);

    const after = await db.query("select * from course_memberships where role = 'LEARNER' order by user_id");
    expect(after.rows).toEqual(before.rows);
    const stillThere = await db.query("select id from course_memberships where id = $1", [learnerMembershipId]);
    expect(stillThere.rows).toHaveLength(1);
  });

  it("does not modify course_authors in any way (row count, fields, and revoked_at all unaffected)", async () => {
    const owner = await insertUser();
    const courseId = await insertCourse(owner);
    // Mirrors a real post-H.1-backfill state: an active OWNER grant and a
    // revoked INSTRUCTOR grant, matching two of the course_memberships rows
    // this migration is about to delete.
    await insertCourseAuthor({ userId: owner, courseId, capability: "OWNER" });
    const revokedInstructor = await insertUser();
    await insertCourseAuthor({
      userId: revokedInstructor,
      courseId,
      capability: "INSTRUCTOR",
      revokedAt: new Date("2026-01-01T00:00:00Z"),
    });
    await insertCourseMembership({ userId: owner, courseId, role: "OWNER" });
    await insertCourseMembership({ userId: revokedInstructor, courseId, role: "INSTRUCTOR" });

    const before = await db.query("select * from course_authors order by user_id");

    await db.exec(newMigrationSql);

    const after = await db.query("select * from course_authors order by user_id");
    expect(after.rows).toEqual(before.rows);
  });

  it("the narrowed CHECK constraint rejects a non-LEARNER insert attempt", async () => {
    const owner = await insertUser();
    const courseId = await insertCourse(owner);

    await db.exec(newMigrationSql);

    await expect(
      db.query(
        `insert into course_memberships (id, user_id, course_id, role)
         values ($1, $2, $3, 'OWNER')`,
        [randomUUID(), owner, courseId],
      ),
    ).rejects.toThrow();
    await expect(
      db.query(
        `insert into course_memberships (id, user_id, course_id, role)
         values ($1, $2, $3, 'INSTRUCTOR')`,
        [randomUUID(), owner, courseId],
      ),
    ).rejects.toThrow();

    // A LEARNER insert still succeeds normally after the narrowing.
    await db.query(
      `insert into course_memberships (id, user_id, course_id, role)
       values ($1, $2, $3, 'LEARNER')`,
      [randomUUID(), owner, courseId],
    );
    const rows = await db.query(
      "select count(*)::int as count from course_memberships where user_id = $1 and course_id = $2",
      [owner, courseId],
    );
    expect((rows.rows[0] as { count: number }).count).toBe(1);
  });
});

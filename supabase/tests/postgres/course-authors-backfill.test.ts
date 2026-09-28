/**
 * RUN010-H.1 (FUB-036, Option 4 architecture) — proves the `course_authors`
 * migration's own backfill statement
 * (`supabase/migrations/20260929010000_course_authors_v1.sql`) against REAL
 * pre-existing `course_memberships` data, not just the empty-table shape
 * `course-author-repository.test.ts` exercises.
 *
 * Deliberately does NOT reuse `db-harness.ts`'s `createTestDb()`, which
 * applies every migration (including this one) in one batched `db.exec()`
 * call before any test data exists — that harness cannot exercise a backfill
 * against pre-existing rows. Instead this file applies every migration
 * OLDER than the new one, seeds `course_memberships` rows directly, THEN
 * applies only the new migration file and asserts on its effect — the
 * migration-ordering-sensitive test shape a backfill claim actually needs.
 */
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const dir = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(dir, "../../migrations");
const NEW_MIGRATION_FILE = "20260929010000_course_authors_v1.sql";

const allMigrationFiles = readdirSync(MIGRATIONS_DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();

if (!allMigrationFiles.includes(NEW_MIGRATION_FILE)) {
  // Fails loudly rather than silently testing nothing if the migration is
  // ever renamed without updating this file.
  throw new Error(
    `course-authors-backfill.test.ts: expected migration file ` +
      `"${NEW_MIGRATION_FILE}" not found in ${MIGRATIONS_DIR}`,
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
  // Same minimal `auth.users` stand-in as `db-harness.ts`'s `createTestDb`
  // — required before the migration chain applies at all (see that file's
  // own comment for why).
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
  joinedAt?: Date;
  revokedAt?: Date | null;
}): Promise<string> {
  const id = randomUUID();
  await db.query(
    `insert into course_memberships (id, user_id, course_id, role, joined_at, revoked_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      args.userId,
      args.courseId,
      args.role,
      args.joinedAt ?? new Date(),
      args.revokedAt ?? null,
    ],
  );
  return id;
}

describe("course_authors backfill (RUN010-H.1 migration)", () => {
  it("row-count parity: count(course_authors) equals count(course_memberships where role in (OWNER, INSTRUCTOR)) after the migration runs", async () => {
    const owner1 = await insertUser();
    const course1 = await insertCourse(owner1);
    await insertCourseMembership({ userId: owner1, courseId: course1, role: "OWNER" });

    const instructorUser = await insertUser();
    await insertCourseMembership({
      userId: instructorUser,
      courseId: course1,
      role: "INSTRUCTOR",
    });

    const learnerUser = await insertUser();
    await insertCourseMembership({
      userId: learnerUser,
      courseId: course1,
      role: "LEARNER",
    });

    const owner2 = await insertUser();
    const course2 = await insertCourse(owner2);
    await insertCourseMembership({ userId: owner2, courseId: course2, role: "OWNER" });
    const learner2 = await insertUser();
    await insertCourseMembership({
      userId: learner2,
      courseId: course2,
      role: "LEARNER",
    });

    await db.exec(newMigrationSql);

    const membershipCount = await db.query(
      "select count(*)::int as count from course_memberships where role in ('OWNER', 'INSTRUCTOR')",
    );
    const authorCount = await db.query(
      "select count(*)::int as count from course_authors",
    );
    expect((authorCount.rows[0] as { count: number }).count).toBe(3);
    expect((authorCount.rows[0] as { count: number }).count).toBe(
      (membershipCount.rows[0] as { count: number }).count,
    );
  });

  it("field-level parity: user_id/course_id/capability/granted_at/revoked_at all match the source course_memberships row exactly", async () => {
    const ownerUserId = await insertUser();
    const courseId = await insertCourse(ownerUserId);
    const joinedAt = new Date("2026-02-01T10:00:00.000Z");
    await insertCourseMembership({
      userId: ownerUserId,
      courseId,
      role: "OWNER",
      joinedAt,
    });

    await db.exec(newMigrationSql);

    const result = await db.query(
      "select * from course_authors where user_id = $1 and course_id = $2",
      [ownerUserId, courseId],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row.user_id).toBe(ownerUserId);
    expect(row.course_id).toBe(courseId);
    expect(row.capability).toBe("OWNER");
    expect(new Date(row.granted_at as string).getTime()).toBe(joinedAt.getTime());
    expect(row.revoked_at).toBeNull();
  });

  it("preserves revoked_at for a revoked OWNER/INSTRUCTOR row — not silently reactivated", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);
    const revokedAt = new Date("2026-03-15T00:00:00.000Z");
    await insertCourseMembership({
      userId,
      courseId,
      role: "INSTRUCTOR",
      revokedAt,
    });

    await db.exec(newMigrationSql);

    const result = await db.query(
      "select * from course_authors where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as Record<string, unknown>;
    expect(row.revoked_at).not.toBeNull();
    expect(new Date(row.revoked_at as string).getTime()).toBe(revokedAt.getTime());
  });

  it("does NOT copy LEARNER course_memberships rows into course_authors", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);
    await insertCourseMembership({ userId, courseId, role: "LEARNER" });

    await db.exec(newMigrationSql);

    const result = await db.query(
      "select count(*)::int as count from course_authors where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect((result.rows[0] as { count: number }).count).toBe(0);
  });

  it("does NOT modify or delete any course_memberships row (purely additive)", async () => {
    const userId = await insertUser();
    const courseId = await insertCourse(userId);
    await insertCourseMembership({ userId, courseId, role: "OWNER" });

    const before = await db.query(
      "select * from course_memberships where user_id = $1 and course_id = $2",
      [userId, courseId],
    );

    await db.exec(newMigrationSql);

    const after = await db.query(
      "select * from course_memberships where user_id = $1 and course_id = $2",
      [userId, courseId],
    );
    expect(after.rows).toEqual(before.rows);
  });
});

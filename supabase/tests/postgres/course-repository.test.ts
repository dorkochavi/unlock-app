/**
 * Real-Postgres (PGlite) integration tests for `PostgresCourseRepository`
 * (`courses.join_policy`).
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { createTestDb, insertCourse, insertUser } from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("PostgresCourseRepository", () => {
  it("defaults a new course to AUTHORIZED_ONLY", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseRepository(db);

    expect(await repo.getJoinPolicy(courseId)).toBe("AUTHORIZED_ONLY");
  });

  it("returns null for an unknown course", async () => {
    const repo = new PostgresCourseRepository(db);
    expect(await repo.getJoinPolicy(randomUUID())).toBeNull();
  });

  it("setJoinPolicy updates and persists the new value", async () => {
    const userId = await insertUser(db);
    const courseId = await insertCourse(db, userId);
    const repo = new PostgresCourseRepository(db);

    const updated = await repo.setJoinPolicy(courseId, "OPEN");
    expect(updated).toBe("OPEN");
    expect(await repo.getJoinPolicy(courseId)).toBe("OPEN");
  });

  it("setJoinPolicy returns null for an unknown course", async () => {
    const repo = new PostgresCourseRepository(db);
    expect(await repo.setJoinPolicy(randomUUID(), "OPEN")).toBeNull();
  });

  it("getCourseSummary returns exactly {id, title} against the real schema — never owner_user_id/join_policy/timestamps", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresCourseRepository(db);

    const summary = await repo.getCourseSummary(courseId);

    expect(summary).not.toBeNull();
    expect(summary?.id).toBe(courseId);
    expect(typeof summary?.title).toBe("string");
    expect(Object.keys(summary ?? {}).sort()).toEqual(["id", "title"]);
  });

  it("getCourseSummary returns null for an unknown course", async () => {
    const repo = new PostgresCourseRepository(db);
    expect(await repo.getCourseSummary(randomUUID())).toBeNull();
  });

  it("getCourseSummaries returns a summary per existing id against the real `= any($1::uuid[])` query", async () => {
    const ownerId = await insertUser(db);
    const courseId1 = await insertCourse(db, ownerId);
    const courseId2 = await insertCourse(db, ownerId);
    const repo = new PostgresCourseRepository(db);

    const summaries = await repo.getCourseSummaries([courseId1, courseId2]);

    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.id).sort()).toEqual([courseId1, courseId2].sort());
    for (const summary of summaries) {
      expect(Object.keys(summary).sort()).toEqual(["id", "title"]);
    }
  });

  it("getCourseSummaries silently omits ids that do not exist", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresCourseRepository(db);

    const summaries = await repo.getCourseSummaries([courseId, randomUUID()]);

    expect(summaries).toHaveLength(1);
    expect(summaries[0].id).toBe(courseId);
  });

  it("getCourseSummaries returns an empty array for an empty input without querying Postgres", async () => {
    const repo = new PostgresCourseRepository(db);
    expect(await repo.getCourseSummaries([])).toEqual([]);
  });
});

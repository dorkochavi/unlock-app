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
});

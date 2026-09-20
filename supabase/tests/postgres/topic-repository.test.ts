/**
 * Real-Postgres (PGlite) integration tests for `PostgresTopicRepository`
 * (`topics`, Run 005 S4).
 */
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";

import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { createTestDb, insertCourse, insertUser } from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

describe("PostgresTopicRepository", () => {
  it("createTopic persists an active Topic scoped to the given Course", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);

    const created = await repo.createTopic({ courseId, name: "Algebra" });

    expect(created.courseId).toBe(courseId);
    expect(created.name).toBe("Algebra");
    expect(created.archivedAt).toBeNull();

    const reread = await repo.getTopic(created.id);
    expect(reread).toEqual(created);
  });

  it("getTopic returns null for an unknown id", async () => {
    const repo = new PostgresTopicRepository(db);
    expect(await repo.getTopic(randomUUID())).toBeNull();
  });

  it("listActiveForCourse returns only active Topics for that Course, in creation order", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const otherCourseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);

    const first = await repo.createTopic({ courseId, name: "First" });
    const second = await repo.createTopic({ courseId, name: "Second" });
    const archived = await repo.createTopic({ courseId, name: "Archived" });
    await repo.archiveTopic(archived.id);
    await repo.createTopic({ courseId: otherCourseId, name: "Other Course" });

    const active = await repo.listActiveForCourse(courseId);

    expect(active.map((t) => t.id)).toEqual([first.id, second.id]);
  });

  it("listActiveForCourse returns an empty array for a Course with no Topics", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);

    expect(await repo.listActiveForCourse(courseId)).toEqual([]);
  });

  it("renameTopic updates and persists the new name", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);
    const created = await repo.createTopic({ courseId, name: "Original" });

    const updated = await repo.renameTopic(created.id, "Renamed");

    expect(updated?.name).toBe("Renamed");
    expect((await repo.getTopic(created.id))?.name).toBe("Renamed");
  });

  it("renameTopic returns null for an unknown id", async () => {
    const repo = new PostgresTopicRepository(db);
    expect(await repo.renameTopic(randomUUID(), "X")).toBeNull();
  });

  it("archiveTopic sets archivedAt and excludes the Topic from listActiveForCourse", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);
    const created = await repo.createTopic({ courseId, name: "Algebra" });

    const archived = await repo.archiveTopic(created.id);

    expect(archived?.archivedAt).not.toBeNull();
    expect(await repo.listActiveForCourse(courseId)).toEqual([]);
  });

  it("archiveTopic is idempotent — a second call keeps the original archivedAt instant", async () => {
    const ownerId = await insertUser(db);
    const courseId = await insertCourse(db, ownerId);
    const repo = new PostgresTopicRepository(db);
    const created = await repo.createTopic({ courseId, name: "Algebra" });

    const firstArchive = await repo.archiveTopic(created.id);
    const secondArchive = await repo.archiveTopic(created.id);

    expect(firstArchive?.archivedAt).toEqual(secondArchive?.archivedAt);
  });

  it("archiveTopic returns null for an unknown id", async () => {
    const repo = new PostgresTopicRepository(db);
    expect(await repo.archiveTopic(randomUUID())).toBeNull();
  });

  it("rejects a Topic referencing a nonexistent Course (FK constraint)", async () => {
    const repo = new PostgresTopicRepository(db);
    await expect(repo.createTopic({ courseId: randomUUID(), name: "Orphan" })).rejects.toThrow();
  });
});

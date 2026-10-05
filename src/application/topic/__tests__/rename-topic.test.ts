import { describe, expect, it } from "vitest";

import { renameTopic } from "../rename-topic";
import { buildTopicNameIndex, resolveTopicByName } from "../../../domain/import/types";
import { InMemoryTopicDatabase } from "./in-memory-fakes";
import type { CourseMembership, Topic } from "../ports";

function seedActor(db: InMemoryTopicDatabase, overrides: Partial<CourseMembership>): void {
  db.seedMembership({
    id: "actor-membership",
    userId: "actor-1",
    courseId: "course-1",
    role: "LEARNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  });
}

function seedTopic(db: InMemoryTopicDatabase, overrides: Partial<Topic> = {}): void {
  db.seedTopic({
    id: "topic-1",
    courseId: "course-1",
    name: "Original",
    archivedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  });
}

describe("renameTopic", () => {
  it("allows an OWNER to rename their Course's Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result.outcome).toBe("RENAMED");
    if (result.outcome === "RENAMED") {
      expect(result.topic.name).toBe("Renamed");
    }
  });

  it("does not allow a LEARNER to rename a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "LEARNER" });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  // RUN010-H.2 required proof (a): active course_authors grant, no
  // course_memberships row at all.
  it("allows an actor with an active course_authors grant but no course_memberships row", async () => {
    const db = new InMemoryTopicDatabase();
    db.seedAuthorGrant({
      userId: "actor-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result.outcome).toBe("RENAMED");
  });

  // RUN010-H.2 — intentional, documented behavior change: authorization now
  // sources from `course_authors`, which has no `archivedAt` concept at all
  // (`hasActiveAuthorGrant`'s own doc comment). An archived-but-not-revoked
  // management `course_memberships` row still backfills an ACTIVE
  // `course_authors` grant, so this actor IS authorized — archival is a
  // per-learner Today-exclusion fact, never an authoring-capability gate,
  // under the new model.
  it("allows an archived-but-not-revoked OWNER to rename a Topic (course_authors has no archived concept)", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result.outcome).toBe("RENAMED");
  });

  it("rejects a nonexistent topicId", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "missing", name: "Renamed" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });

  it("rejects a Topic that belongs to a different Course than the caller is authorized on (cross-Course association)", async () => {
    const db = new InMemoryTopicDatabase();
    // Actor is OWNER of course-1, but the Topic actually belongs to course-2.
    seedActor(db, { role: "OWNER" });
    seedTopic(db, { courseId: "course-2" });

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });

  it("rejects an empty (or whitespace-only) name", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "   " },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "INVALID_NAME" });
  });

  describe("duplicate active name guard", () => {
    const rename = (db: InMemoryTopicDatabase, topicId: string, name: string, courseId = "course-1") =>
      renameTopic({ actorUserId: "actor-1", courseId, topicId, name }, db.repos());

    function setup(): InMemoryTopicDatabase {
      const db = new InMemoryTopicDatabase();
      seedActor(db, { role: "OWNER" });
      seedTopic(db, { id: "topic-1", name: "Original" });
      seedTopic(db, { id: "topic-2", name: "Algebra" });
      return db;
    }

    it.each(["Algebra", "algebra", "  ALGEBRA  "])("rejects renaming into a duplicate (%j)", async (name) => {
      const db = setup();
      expect(await rename(db, "topic-1", name)).toEqual({ outcome: "DUPLICATE_NAME" });
      expect((await db.repos().topics.getTopic("topic-1"))?.name).toBe("Original");
    });

    it("allows renaming a Topic to its own name or a case/whitespace variant of it", async () => {
      const db = setup();
      const same = await rename(db, "topic-2", "Algebra");
      expect(same.outcome).toBe("RENAMED");
      const variant = await rename(db, "topic-2", "  ALGEBRA ");
      expect(variant.outcome).toBe("RENAMED");
      if (variant.outcome === "RENAMED") expect(variant.topic.name).toBe("ALGEBRA");
    });

    it("allows the same name as a Topic in a different Course", async () => {
      const db = setup();
      seedTopic(db, { id: "topic-3", courseId: "course-2", name: "Geometry" });
      expect((await rename(db, "topic-1", "geometry")).outcome).toBe("RENAMED");
    });

    it("an archived Topic does not block renaming another Topic to its name (conservative)", async () => {
      const db = new InMemoryTopicDatabase();
      seedActor(db, { role: "OWNER" });
      seedTopic(db, { id: "topic-1", name: "Original" });
      seedTopic(db, { id: "topic-2", name: "Algebra", archivedAt: new Date("2026-02-01T00:00:00Z") });
      expect((await rename(db, "topic-1", "algebra")).outcome).toBe("RENAMED");
    });

    it("a legacy duplicate pair can still be renamed away or touched by a case-only change", async () => {
      const db = new InMemoryTopicDatabase();
      seedActor(db, { role: "OWNER" });
      seedTopic(db, { id: "topic-1", name: "Algebra" });
      seedTopic(db, { id: "topic-2", name: "algebra " });
      expect((await rename(db, "topic-1", "ALGEBRA")).outcome).toBe("RENAMED");
      expect((await rename(db, "topic-1", "Algebra II")).outcome).toBe("RENAMED");
    });

    it("authorization is checked before the duplicate check", async () => {
      const db = setup();
      const result = await renameTopic(
        { actorUserId: "stranger", courseId: "course-1", topicId: "topic-1", name: "Algebra" },
        db.repos(),
      );
      expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
    });

    it("import name resolution stays unambiguous when authoring goes through the guard", async () => {
      const db = setup();
      await rename(db, "topic-1", "ALGEBRA"); // rejected
      const active = await db.repos().topics.listActiveForCourse("course-1");
      const index = buildTopicNameIndex(active);
      expect(resolveTopicByName("  algebra ", index)).toEqual({ outcome: "RESOLVED", topicId: "topic-2" });
    });
  });
});

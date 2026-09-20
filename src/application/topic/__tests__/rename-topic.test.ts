import { describe, expect, it } from "vitest";

import { renameTopic } from "../rename-topic";
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

  it("does not allow an archived-but-not-revoked OWNER to rename a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });
    seedTopic(db);

    const result = await renameTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1", name: "Renamed" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
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
});

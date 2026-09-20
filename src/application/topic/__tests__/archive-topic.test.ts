import { describe, expect, it } from "vitest";

import { archiveTopic } from "../archive-topic";
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

describe("archiveTopic", () => {
  it("allows an OWNER to archive their Course's Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db);

    const result = await archiveTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ARCHIVED");
    if (result.outcome === "ARCHIVED") {
      expect(result.topic.archivedAt).not.toBeNull();
    }
  });

  it("is idempotent: archiving an already-archived Topic succeeds and keeps the original archivedAt", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    const originalArchivedAt = new Date("2026-01-05T00:00:00Z");
    seedTopic(db, { archivedAt: originalArchivedAt });

    const result = await archiveTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("ARCHIVED");
    if (result.outcome === "ARCHIVED") {
      expect(result.topic.archivedAt).toEqual(originalArchivedAt);
    }
  });

  it("does not allow a LEARNER to archive a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "LEARNER" });
    seedTopic(db);

    const result = await archiveTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("rejects a nonexistent topicId", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await archiveTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "missing" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });

  it("rejects a Topic that belongs to a different Course than the caller is authorized on (cross-Course association)", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    seedTopic(db, { courseId: "course-2" });

    const result = await archiveTopic(
      { actorUserId: "actor-1", courseId: "course-1", topicId: "topic-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "TOPIC_NOT_FOUND" });
  });
});

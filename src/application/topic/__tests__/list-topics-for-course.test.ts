import { describe, expect, it } from "vitest";

import { listTopicsForCourse } from "../list-topics-for-course";
import { InMemoryTopicDatabase } from "./in-memory-fakes";
import type { CourseMembership } from "../ports";

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

describe("listTopicsForCourse", () => {
  it("returns only active Topics for the Course, in creation order", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedTopic({
      id: "topic-1",
      courseId: "course-1",
      name: "Second",
      archivedAt: null,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    db.seedTopic({
      id: "topic-2",
      courseId: "course-1",
      name: "First",
      archivedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });
    db.seedTopic({
      id: "topic-3",
      courseId: "course-1",
      name: "Archived",
      archivedAt: new Date("2026-01-03T00:00:00Z"),
      createdAt: new Date("2026-01-03T00:00:00Z"),
      updatedAt: new Date("2026-01-03T00:00:00Z"),
    });
    db.seedTopic({
      id: "topic-4",
      courseId: "course-2",
      name: "Other Course",
      archivedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    const result = await listTopicsForCourse({ actorUserId: "actor-1", courseId: "course-1" }, db.repos());

    expect(result.outcome).toBe("READY");
    if (result.outcome === "READY") {
      expect(result.topics.map((t) => t.name)).toEqual(["First", "Second"]);
    }
  });

  it("does not allow a LEARNER to list Topics", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await listTopicsForCourse({ actorUserId: "actor-1", courseId: "course-1" }, db.repos());

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow a non-member to list Topics", async () => {
    const db = new InMemoryTopicDatabase();

    const result = await listTopicsForCourse(
      { actorUserId: "stranger-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

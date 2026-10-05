import { describe, expect, it } from "vitest";

import { createTopic } from "../create-topic";
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

describe("createTopic", () => {
  it("allows an OWNER to create a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome === "CREATED") {
      expect(result.topic).toMatchObject({ courseId: "course-1", name: "Algebra", archivedAt: null });
    }
  });

  it("allows an active INSTRUCTOR to create a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "INSTRUCTOR" });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  it("does not allow a LEARNER to create a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow a revoked OWNER to create a Topic", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  // RUN010-H.2 — intentional, documented behavior change: see
  // `rename-topic.test.ts`'s equivalent test for the full explanation.
  // `course_authors` has no `archivedAt` concept; this actor's backfilled
  // grant is active, so they are authorized.
  it("allows an archived-but-not-revoked OWNER to create a Topic (course_authors has no archived concept)", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  // RUN010-H.2 required proof (a): a freshly-created-post-H.2 Course's
  // creator has an active course_authors grant but NO course_memberships
  // row at all — must still be authorized.
  it("allows an actor with an active course_authors grant but no course_memberships row", async () => {
    const db = new InMemoryTopicDatabase();
    db.seedAuthorGrant({
      userId: "actor-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  it("does not allow a non-member to create a Topic", async () => {
    const db = new InMemoryTopicDatabase();

    const result = await createTopic(
      { actorUserId: "stranger-1", courseId: "course-1", name: "Algebra" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("rejects an empty (or whitespace-only) name", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "   " },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "INVALID_NAME" });
  });

  describe("duplicate active name guard", () => {
    const seedActive = (db: InMemoryTopicDatabase, courseId = "course-1", archivedAt: Date | null = null) =>
      db.seedTopic({
        id: `t-${courseId}-${archivedAt ? "arch" : "act"}`,
        courseId,
        name: "Algebra",
        archivedAt,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      });

    it.each(["Algebra", "algebra", "ALGEBRA", "  Algebra  ", " aLgEbRa\t"])(
      "rejects %j as a duplicate of an active Topic and creates nothing",
      async (name) => {
        const db = new InMemoryTopicDatabase();
        seedActor(db, { role: "OWNER" });
        seedActive(db);

        const result = await createTopic({ actorUserId: "actor-1", courseId: "course-1", name }, db.repos());

        expect(result).toEqual({ outcome: "DUPLICATE_NAME" });
        expect(await db.repos().topics.listActiveForCourse("course-1")).toHaveLength(1);
      },
    );

    it("allows the same name in a different Course", async () => {
      const db = new InMemoryTopicDatabase();
      seedActor(db, { role: "OWNER" });
      seedActive(db, "course-2");

      const result = await createTopic(
        { actorUserId: "actor-1", courseId: "course-1", name: "Algebra" },
        db.repos(),
      );
      expect(result.outcome).toBe("CREATED");
    });

    it("an archived Topic does not block reuse of its name (conservative; no restore path exists)", async () => {
      const db = new InMemoryTopicDatabase();
      seedActor(db, { role: "OWNER" });
      seedActive(db, "course-1", new Date("2026-02-01T00:00:00Z"));

      const result = await createTopic(
        { actorUserId: "actor-1", courseId: "course-1", name: "algebra" },
        db.repos(),
      );
      expect(result.outcome).toBe("CREATED");
    });

    it("does not leak duplicate status to an unauthorized actor", async () => {
      const db = new InMemoryTopicDatabase();
      seedActive(db);

      const result = await createTopic(
        { actorUserId: "stranger-1", courseId: "course-1", name: "Algebra" },
        db.repos(),
      );
      expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
    });
  });

  it("trims the name before persisting", async () => {
    const db = new InMemoryTopicDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await createTopic(
      { actorUserId: "actor-1", courseId: "course-1", name: "  Algebra  " },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome === "CREATED") {
      expect(result.topic.name).toBe("Algebra");
    }
  });
});

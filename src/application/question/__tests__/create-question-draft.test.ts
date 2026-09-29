import { describe, expect, it } from "vitest";

import { createQuestionDraft } from "../create-question-draft";
import { InMemoryQuestionDatabase } from "./in-memory-fakes";
import type { CourseMembership } from "../ports";

function seedActor(db: InMemoryQuestionDatabase, overrides: Partial<CourseMembership>): void {
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

describe("createQuestionDraft", () => {
  it("allows an OWNER to create an empty, never-published draft Question", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER" });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
    if (result.outcome === "CREATED") {
      expect(result.question).toMatchObject({
        courseId: "course-1",
        topicId: null,
        currentVersionId: null,
        draft: {
          questionType: null,
          prompt: null,
          answerOptions: null,
          correctOptionIds: null,
          explanation: null,
        },
      });
    }
  });

  it("allows an active INSTRUCTOR to create a draft Question", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "INSTRUCTOR" });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  // RUN010-H.2 required proof (a): active course_authors grant, no
  // course_memberships row at all.
  it("allows an actor with an active course_authors grant but no course_memberships row", async () => {
    const db = new InMemoryQuestionDatabase();
    db.seedAuthorGrant({
      userId: "actor-1",
      courseId: "course-1",
      capability: "OWNER",
      grantedAt: new Date("2026-01-01T00:00:00Z"),
      revokedAt: null,
    });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  it("does not allow a LEARNER to create a draft Question", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "LEARNER" });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  it("does not allow a revoked OWNER to create a draft Question", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER", revokedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });

  // RUN010-H.2 — intentional, documented behavior change: see
  // `topic/__tests__/rename-topic.test.ts`'s equivalent test for the full
  // explanation. `course_authors` has no `archivedAt` concept; this actor's
  // backfilled grant is active, so they are authorized.
  it("allows an archived-but-not-revoked OWNER to create a draft Question (course_authors has no archived concept)", async () => {
    const db = new InMemoryQuestionDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-02-01T00:00:00Z") });

    const result = await createQuestionDraft(
      { actorUserId: "actor-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result.outcome).toBe("CREATED");
  });

  it("does not allow a non-member to create a draft Question", async () => {
    const db = new InMemoryQuestionDatabase();

    const result = await createQuestionDraft(
      { actorUserId: "stranger-1", courseId: "course-1" },
      db.repos(),
    );

    expect(result).toEqual({ outcome: "NOT_AUTHORIZED" });
  });
});

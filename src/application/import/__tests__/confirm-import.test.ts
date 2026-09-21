import { describe, expect, it } from "vitest";

import { confirmImport } from "../confirm-import";
import { MAX_IMPORT_ROWS } from "../limits";
import { InMemoryImportDatabase, InMemoryImportUnitOfWork } from "./in-memory-fakes";
import type { CourseMembership } from "../ports";

const ACTOR_ID = "actor-1";
const COURSE_ID = "course-1";

function seedActor(db: InMemoryImportDatabase, overrides: Partial<CourseMembership>): void {
  db.seedMembership({
    id: "actor-membership",
    userId: ACTOR_ID,
    courseId: COURSE_ID,
    role: "OWNER",
    joinedAt: new Date("2026-01-01T00:00:00Z"),
    revokedAt: null,
    archivedAt: null,
    ...overrides,
  });
}

function deps(db: InMemoryImportDatabase) {
  return { previewRepos: db.repos(), uow: new InMemoryImportUnitOfWork(db) };
}

const WELL_FORMED_JSON = JSON.stringify([
  {
    topic: "Introduction",
    type: "SINGLE_CHOICE",
    prompt: "What is the correct answer?",
    options: [
      { key: "A", content: "Option A" },
      { key: "B", content: "Option B" },
    ],
    correctOptions: ["B"],
  },
]);

describe("confirmImport — authorization / Course state (Phase 1 reparse)", () => {
  it("rejects a caller with no membership in the Course, creates no Question", async () => {
    const db = new InMemoryImportDatabase();
    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects a LEARNER membership, creates no Question", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "LEARNER" });
    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects an ARCHIVED Course even for an authorized OWNER, creates no Question", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    db.seedCourseStatus(COURSE_ID, "ARCHIVED");
    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );
    expect(result.outcome).toBe("COURSE_ARCHIVED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });
});

describe("confirmImport — malformed source", () => {
  it("reports MALFORMED_SOURCE and creates no Question", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: "{not valid" },
      deps(db),
    );
    expect(result.outcome).toBe("MALFORMED_SOURCE");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });
});

describe("confirmImport — row-count limit (Run 008 S1.D)", () => {
  it("reports TOO_MANY_ROWS and creates no Question, never opening a transaction", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    const oneRow = JSON.parse(WELL_FORMED_JSON)[0];
    const tooManyRows = JSON.stringify(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => oneRow));

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: tooManyRows },
      deps(db),
    );

    expect(result.outcome).toBe("TOO_MANY_ROWS");
    if (result.outcome !== "TOO_MANY_ROWS") throw new Error("unreachable");
    expect(result.totalRows).toBe(MAX_IMPORT_ROWS + 1);
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });
});

describe("confirmImport — all-or-nothing on invalid rows", () => {
  it("rejects the whole batch with zero Questions created when one row among several is invalid", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const mixed = JSON.stringify([
      JSON.parse(WELL_FORMED_JSON)[0],
      { ...JSON.parse(WELL_FORMED_JSON)[0], topic: "Nonexistent Topic" },
    ]);

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: mixed },
      deps(db),
    );

    expect(result.outcome).toBe("INVALID_ROWS");
    if (result.outcome !== "INVALID_ROWS") throw new Error("unreachable");
    expect(result.totalRows).toBe(2);
    expect(result.invalidCount).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects a Topic-ambiguous batch with zero Questions created", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    db.seedActiveTopic(COURSE_ID, "  introduction");

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );

    expect(result.outcome).toBe("INVALID_ROWS");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects an archived-Course-eligible batch with a no-match Topic, zero Questions created", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    // No Topics seeded — every row fails Topic resolution.
    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );
    expect(result.outcome).toBe("INVALID_ROWS");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });
});

describe("confirmImport — successful atomic confirm", () => {
  it("creates real DRAFT_ONLY Questions for every valid row, matching the resolved Topic/content", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const topic = db.seedActiveTopic(COURSE_ID, "Introduction");

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      deps(db),
    );

    expect(result.outcome).toBe("CONFIRMED");
    if (result.outcome !== "CONFIRMED") throw new Error("unreachable");
    expect(result.createdCount).toBe(1);
    expect(result.createdQuestionIds).toHaveLength(1);

    const created = db.getQuestion(result.createdQuestionIds[0]);
    expect(created).toBeDefined();
    expect(created?.courseId).toBe(COURSE_ID);
    expect(created?.topicId).toBe(topic.id);
    expect(created?.currentVersionId).toBeNull();
    expect(created?.draft.questionType).toBe("SINGLE_CHOICE");
    expect(created?.draft.prompt).toBe("What is the correct answer?");
    expect(created?.draft.correctOptionIds).toEqual(["B"]);
  });

  it("creates one Question per valid row for a multi-row batch across distinct Topics", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    db.seedActiveTopic(COURSE_ID, "Advanced");

    const rows = JSON.stringify([
      JSON.parse(WELL_FORMED_JSON)[0],
      { ...JSON.parse(WELL_FORMED_JSON)[0], topic: "Advanced" },
    ]);

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: rows },
      deps(db),
    );

    expect(result.outcome).toBe("CONFIRMED");
    if (result.outcome !== "CONFIRMED") throw new Error("unreachable");
    expect(result.createdCount).toBe(2);
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(2);
  });

  it("routes CSV through the same pipeline to the same DRAFT_ONLY outcome", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const csv = [
      "topic,type,prompt,option_a,option_b,correct_options",
      "Introduction,SINGLE_CHOICE,What is the correct answer?,Option A,Option B,B",
    ].join("\n");

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "CSV", sourceText: csv },
      deps(db),
    );

    expect(result.outcome).toBe("CONFIRMED");
    if (result.outcome !== "CONFIRMED") throw new Error("unreachable");
    expect(result.createdCount).toBe(1);
  });
});

describe("confirmImport — Phase 2 TOCTOU re-check", () => {
  it("rejects with STATE_CHANGED and creates no Question when the resolved Topic was archived after Phase 1's reparse", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const topic = db.seedActiveTopic(COURSE_ID, "Introduction");

    // Simulate a concurrent archive between the caller's preview and this
    // confirm call's own Phase 1 reparse by archiving the Topic through a
    // fake ImportUnitOfWork whose transaction phase sees the already-stale
    // topicId resolved moments earlier by the real (unmodified) Phase 1.
    const originalTopics = db.repos().topics;
    const staleAwareUow = {
      async runInTransaction<T>(fn: (repos: import("../ports").ImportRepositories) => Promise<T>): Promise<T> {
        // Archive the Topic right before the transaction phase's own re-check runs.
        await originalTopics.archiveTopic(topic.id);
        return fn(db.importRepos());
      },
    };

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      { previewRepos: db.repos(), uow: staleAwareUow },
    );

    expect(result.outcome).toBe("STATE_CHANGED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects with COURSE_ARCHIVED and creates no Question when the Course was archived after Phase 1's reparse", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const staleAwareUow = {
      async runInTransaction<T>(fn: (repos: import("../ports").ImportRepositories) => Promise<T>): Promise<T> {
        db.seedCourseStatus(COURSE_ID, "ARCHIVED");
        return fn(db.importRepos());
      },
    };

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      { previewRepos: db.repos(), uow: staleAwareUow },
    );

    expect(result.outcome).toBe("COURSE_ARCHIVED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });

  it("rejects with NOT_AUTHORIZED and creates no Question when the actor's membership was revoked after Phase 1's reparse", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const staleAwareUow = {
      async runInTransaction<T>(fn: (repos: import("../ports").ImportRepositories) => Promise<T>): Promise<T> {
        // Simulate a concurrent revoke between Phase 1's (already-completed)
        // reparse and Phase 2's own membership re-check.
        await db.repos().memberships.revoke(ACTOR_ID, COURSE_ID, new Date());
        return fn(db.importRepos());
      },
    };

    const result = await confirmImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      { previewRepos: db.repos(), uow: staleAwareUow },
    );

    expect(result.outcome).toBe("NOT_AUTHORIZED");
    expect(db.listQuestionsForCourse(COURSE_ID)).toHaveLength(0);
  });
});

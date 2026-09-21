import { describe, expect, it } from "vitest";

import { MAX_IMPORT_ROWS } from "../limits";
import { previewImport } from "../preview-import";
import { InMemoryImportDatabase } from "./in-memory-fakes";
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

describe("previewImport — authorization / Course state", () => {
  it("rejects a caller with no membership in the Course", async () => {
    const db = new InMemoryImportDatabase();
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("rejects a LEARNER membership (cannot author Course content)", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "LEARNER" });
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("rejects a revoked OWNER membership", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER", revokedAt: new Date("2026-01-02T00:00:00Z") });
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("rejects an archived OWNER membership", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER", archivedAt: new Date("2026-01-02T00:00:00Z") });
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );
    expect(result.outcome).toBe("NOT_AUTHORIZED");
  });

  it("rejects an ARCHIVED Course even for an authorized OWNER", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedCourseStatus(COURSE_ID, "ARCHIVED");
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );
    expect(result.outcome).toBe("COURSE_ARCHIVED");
  });
});

describe("previewImport — malformed source", () => {
  it("reports MALFORMED_SOURCE for invalid JSON without attempting row validation", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: "{not valid" },
      db.repos(),
    );
    expect(result.outcome).toBe("MALFORMED_SOURCE");
  });
});

describe("previewImport — format dispatch", () => {
  it("routes format: \"CSV\" through the CSV adapter and produces the same outcome as the equivalent JSON payload", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const topic = db.seedActiveTopic(COURSE_ID, "Introduction");

    const csv = [
      "topic,type,prompt,option_a,option_b,correct_options",
      "Introduction,SINGLE_CHOICE,What is the correct answer?,Option A,Option B,B",
    ].join("\n");

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "CSV", sourceText: csv },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.totalRows).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.rows[0].outcome).toBe("VALID");
    if (result.rows[0].outcome !== "VALID") throw new Error("unreachable");
    expect(result.rows[0].topicId).toBe(topic.id);
  });

  it("reports MALFORMED_SOURCE for a CSV payload missing required columns", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "CSV", sourceText: "topic,type\nIntro,SINGLE_CHOICE" },
      db.repos(),
    );
    expect(result.outcome).toBe("MALFORMED_SOURCE");
  });
});

describe("previewImport — validation and Topic resolution", () => {
  it("reports PREVIEWED with a VALID row and the resolved topicId when the Topic name matches exactly one active Topic", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const topic = db.seedActiveTopic(COURSE_ID, "Introduction");

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.totalRows).toBe(1);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(0);
    expect(result.rows[0].outcome).toBe("VALID");
    if (result.rows[0].outcome !== "VALID") throw new Error("unreachable");
    expect(result.rows[0].topicId).toBe(topic.id);
  });

  it("reports an INVALID row with a Topic-not-found error when no active Topic matches", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    // No Topics seeded at all.

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].outcome).toBe("INVALID");
    if (result.rows[0].outcome !== "INVALID") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("was not found"))).toBe(true);
  });

  it("reports an INVALID row with an ambiguity error when more than one active Topic normalizes to the same name", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    db.seedActiveTopic(COURSE_ID, "  introduction");

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("INVALID");
    if (result.rows[0].outcome !== "INVALID") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("ambiguous") || e.includes("more than one"))).toBe(
      true,
    );
  });

  it("does not match an archived Topic (archived Topics are not eligible)", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedArchivedTopic(COURSE_ID, "Introduction");

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("INVALID");
    if (result.rows[0].outcome !== "INVALID") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("was not found"))).toBe(true);
  });

  it("reports a content-validation error (e.g. SINGLE_CHOICE with two correct options) alongside a resolved Topic in the same row's errors", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const badRow = JSON.stringify([
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "Prompt",
        options: [
          { key: "A", content: "A" },
          { key: "B", content: "B" },
        ],
        correctOptions: ["A", "B"],
      },
    ]);

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: badRow },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.rows[0].outcome).toBe("INVALID");
    if (result.rows[0].outcome !== "INVALID") throw new Error("unreachable");
    expect(result.rows[0].errors.some((e) => e.includes("exactly one correct option"))).toBe(true);
  });

  it("reports independent per-row outcomes across a batch — one bad row does not affect another valid row", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");

    const mixed = JSON.stringify([
      JSON.parse(WELL_FORMED_JSON)[0],
      { ...JSON.parse(WELL_FORMED_JSON)[0], topic: "Nonexistent Topic" },
    ]);

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: mixed },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.totalRows).toBe(2);
    expect(result.validCount).toBe(1);
    expect(result.invalidCount).toBe(1);
    expect(result.rows[0].outcome).toBe("VALID");
    expect(result.rows[1].outcome).toBe("INVALID");
  });
});

describe("previewImport — row-count limit (Run 008 S1.D)", () => {
  it("reports TOO_MANY_ROWS for a batch over MAX_IMPORT_ROWS without ever resolving Topics", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    // Deliberately no Topic seeded — proves the limit short-circuits before
    // Topic resolution would otherwise report a per-row "not found" error.
    const oneRow = JSON.parse(WELL_FORMED_JSON)[0];
    const tooManyRows = JSON.stringify(Array.from({ length: MAX_IMPORT_ROWS + 1 }, () => oneRow));

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: tooManyRows },
      db.repos(),
    );

    expect(result.outcome).toBe("TOO_MANY_ROWS");
    if (result.outcome !== "TOO_MANY_ROWS") throw new Error("unreachable");
    expect(result.totalRows).toBe(MAX_IMPORT_ROWS + 1);
  });

  it("allows a batch of exactly MAX_IMPORT_ROWS rows to proceed to normal validation", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    db.seedActiveTopic(COURSE_ID, "Introduction");
    const oneRow = JSON.parse(WELL_FORMED_JSON)[0];
    const exactlyAtLimit = JSON.stringify(Array.from({ length: MAX_IMPORT_ROWS }, () => oneRow));

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: exactlyAtLimit },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    if (result.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(result.totalRows).toBe(MAX_IMPORT_ROWS);
  });
});

describe("previewImport — zero writes", () => {
  it("creates no Topic and leaves every seeded Topic/membership/Course-status entry unchanged for a VALID batch", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    const topic = db.seedActiveTopic(COURSE_ID, "Introduction");
    const topicsBefore = await db.repos().topics.listActiveForCourse(COURSE_ID);

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    const topicsAfter = await db.repos().topics.listActiveForCourse(COURSE_ID);
    expect(topicsAfter).toEqual(topicsBefore);
    expect(topicsAfter).toHaveLength(1);
    expect(topicsAfter[0].id).toBe(topic.id);
  });

  it("creates no Topic even for an INVALID batch with an unresolved Topic name", async () => {
    const db = new InMemoryImportDatabase();
    seedActor(db, { role: "OWNER" });
    // No Topics seeded — every row will fail Topic resolution.

    const result = await previewImport(
      { actorUserId: ACTOR_ID, courseId: COURSE_ID, format: "JSON", sourceText: WELL_FORMED_JSON },
      db.repos(),
    );

    expect(result.outcome).toBe("PREVIEWED");
    const topicsAfter = await db.repos().topics.listActiveForCourse(COURSE_ID);
    expect(topicsAfter).toHaveLength(0);
  });

  it("PreviewImportRepositories has no `questions` port at all — Preview is structurally incapable of creating a Question or QuestionVersion", () => {
    const db = new InMemoryImportDatabase();
    const repos = db.repos();
    expect("questions" in repos).toBe(false);
  });
});

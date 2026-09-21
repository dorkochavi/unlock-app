/**
 * Run 2026-09-21-007 S6 — Integrated Structured Import walkthrough
 * (`docs/CHATGPT_PLAN.md` §13), executed against real PGlite/PostgreSQL: no
 * hosted fixtures are manufactured, and every step below drives the REAL
 * application use cases end to end (not raw SQL fixtures) — the same
 * functions the actual API routes (`src/app/api/courses/[courseId]/import/
 * {preview,confirm}/route.ts`) call. Mirrors
 * `run-006-question-authoring-walkthrough.test.ts`'s own shape/harness
 * exactly.
 *
 * Proven in one coherent journey plus a handful of focused edge-case
 * scenarios, per the Plan's own S6 acceptance list:
 *   - JSON happy path (multiple rows/Topics) -> preview counts correct ->
 *     confirm creates real DRAFT_ONLY Questions;
 *   - CSV happy path through the same canonical pipeline, same outcome;
 *   - an imported Question is then publishable through the existing,
 *     unmodified `publishQuestion` action, and is not learner-eligible
 *     before that publish;
 *   - all-or-nothing: one invalid row blocks the whole confirm — via
 *     `confirmImport`'s Phase 1 (reparse/re-authorize/re-validate), never
 *     opening a transaction at all — zero Questions created;
 *   - Topic-name resolution: unique active match succeeds, no match fails,
 *     ambiguous normalized match fails;
 *   - an ARCHIVED Course is rejected at both preview and confirm;
 *   - confirm re-resolves Topic state against the database on every call,
 *     rather than trusting anything computed by an earlier `previewImport`
 *     call.
 *
 * Genuine mid-transaction ROLLBACK (`docs/CHATGPT_PLAN.md` §13
 * "transactional rollback prevents partial imports") is NOT provable here:
 * every zero-Questions-created scenario in this file is rejected by Phase 1,
 * before any transaction opens. That proof — a real Postgres `ROLLBACK`
 * discarding an already-issued write when a LATER write in the same
 * transaction fails — lives in the dedicated
 * `postgres-import-unit-of-work.test.ts`, mirroring how
 * `postgres-question-unit-of-work.test.ts` (not this file's own Run 006
 * counterpart) is where Run 006 proves the equivalent for
 * `PostgresQuestionUnitOfWork`.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { confirmImport } from "../../../src/application/import/confirm-import";
import { previewImport } from "../../../src/application/import/preview-import";
import { publishQuestion } from "../../../src/application/question/publish-question";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresImportUnitOfWork } from "../../../src/infrastructure/postgres/postgres-import-unit-of-work";
import { PostgresQuestionUnitOfWork } from "../../../src/infrastructure/postgres/postgres-question-unit-of-work";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { PostgresUnseenQuestionRepository } from "../../../src/infrastructure/postgres/unseen-question-repository";
import {
  createTestDb,
  insertCourse,
  insertCourseMembership,
  insertUser,
  pgliteConnectionProvider,
} from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

function previewRepos() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
    topics: new PostgresTopicRepository(db),
  };
}

function confirmDeps() {
  return {
    previewRepos: previewRepos(),
    uow: new PostgresImportUnitOfWork(pgliteConnectionProvider(db)),
  };
}

async function countQuestions(courseId: string): Promise<number> {
  const result = await db.query<{ count: string }>(
    "select count(*)::text as count from questions where course_id = $1",
    [courseId],
  );
  return Number(result.rows[0].count);
}

describe("Run 007 S6 — Structured Import V1 walkthrough", () => {
  it("JSON happy path: preview counts correct -> confirm creates real DRAFT_ONLY Questions -> publishable through the unmodified publish flow -> not learner-eligible before that publish", async () => {
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId);
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
    const repos = previewRepos();

    const introTopic = await repos.topics.createTopic({ courseId, name: "Introduction" });
    const advancedTopic = await repos.topics.createTopic({ courseId, name: "Advanced" });

    const sourceText = JSON.stringify([
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "What is 2+2?",
        options: [
          { key: "A", content: "3" },
          { key: "B", content: "4" },
        ],
        correctOptions: ["B"],
      },
      {
        topic: "Advanced",
        type: "MULTIPLE_CHOICE",
        prompt: "Which are even numbers?",
        options: [
          { key: "A", content: "2" },
          { key: "B", content: "3" },
          { key: "C", content: "4" },
        ],
        correctOptions: ["A", "C"],
      },
    ]);

    const preview = await previewImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      repos,
    );
    expect(preview.outcome).toBe("PREVIEWED");
    if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(preview.totalRows).toBe(2);
    expect(preview.validCount).toBe(2);
    expect(preview.invalidCount).toBe(0);

    const confirm = await confirmImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      confirmDeps(),
    );
    expect(confirm.outcome).toBe("CONFIRMED");
    if (confirm.outcome !== "CONFIRMED") throw new Error("unreachable");
    expect(confirm.createdCount).toBe(2);
    expect(await countQuestions(courseId)).toBe(2);

    const rows = await db.query<{
      id: string;
      topic_id: string;
      current_version_id: string | null;
      draft_question_type: string;
      draft_prompt: string;
    }>(
      "select id, topic_id, current_version_id, draft_question_type, draft_prompt from questions where course_id = $1 order by created_at",
      [courseId],
    );
    expect(rows.rows).toHaveLength(2);
    expect(rows.rows[0].topic_id).toBe(introTopic.id);
    expect(rows.rows[0].current_version_id).toBeNull();
    expect(rows.rows[0].draft_question_type).toBe("SINGLE_CHOICE");
    expect(rows.rows[0].draft_prompt).toBe("What is 2+2?");
    expect(rows.rows[1].topic_id).toBe(advancedTopic.id);
    expect(rows.rows[1].draft_question_type).toBe("MULTIPLE_CHOICE");

    const importedQuestionId = confirm.createdQuestionIds[0];

    // Draft-only imported Question is not learner-eligible before publish.
    const learnerId = await insertUser(db);
    const unseenRepo = new PostgresUnseenQuestionRepository(db);
    const beforePublish = await unseenRepo.findUnseenQuestions(learnerId, courseId, 10);
    expect(beforePublish.map((c) => c.questionId)).not.toContain(importedQuestionId);

    // Publishable through the existing, UNMODIFIED publishQuestion action.
    const uow = new PostgresQuestionUnitOfWork(pgliteConnectionProvider(db));
    const published = await publishQuestion(
      { actorUserId: instructorId, courseId, questionId: importedQuestionId },
      uow,
    );
    expect(published.outcome).toBe("PUBLISHED");
    if (published.outcome !== "PUBLISHED") throw new Error("unreachable");

    const versionRow = await db.query<{ prompt: string; question_type: string }>(
      "select prompt, question_type from question_versions where id = $1",
      [published.versionId],
    );
    expect(versionRow.rows[0]).toEqual({ prompt: "What is 2+2?", question_type: "SINGLE_CHOICE" });

    const afterPublish = await unseenRepo.findUnseenQuestions(learnerId, courseId, 10);
    expect(afterPublish.map((c) => c.questionId)).toContain(importedQuestionId);
  });

  it("CSV happy path through the same canonical pipeline: preview counts correct -> confirm creates a real DRAFT_ONLY Question", async () => {
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId);
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
    const repos = previewRepos();
    await repos.topics.createTopic({ courseId, name: "Introduction" });

    const sourceText = [
      "topic,type,prompt,option_a,option_b,correct_options",
      "Introduction,SINGLE_CHOICE,What is the correct answer?,Option A,Option B,B",
    ].join("\n");

    const preview = await previewImport(
      { actorUserId: instructorId, courseId, format: "CSV", sourceText },
      repos,
    );
    expect(preview.outcome).toBe("PREVIEWED");
    if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(preview.totalRows).toBe(1);
    expect(preview.validCount).toBe(1);

    const confirm = await confirmImport(
      { actorUserId: instructorId, courseId, format: "CSV", sourceText },
      confirmDeps(),
    );
    expect(confirm.outcome).toBe("CONFIRMED");
    if (confirm.outcome !== "CONFIRMED") throw new Error("unreachable");
    expect(confirm.createdCount).toBe(1);
    expect(await countQuestions(courseId)).toBe(1);
  });

  it("all-or-nothing: one invalid row among several blocks the whole confirm — zero Questions created", async () => {
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId);
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
    const repos = previewRepos();
    await repos.topics.createTopic({ courseId, name: "Introduction" });

    const sourceText = JSON.stringify([
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "A valid question?",
        options: [
          { key: "A", content: "Yes" },
          { key: "B", content: "No" },
        ],
        correctOptions: ["A"],
      },
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "   ",
        options: [
          { key: "A", content: "Yes" },
          { key: "B", content: "No" },
        ],
        correctOptions: ["A"],
      },
    ]);

    const preview = await previewImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      repos,
    );
    expect(preview.outcome).toBe("PREVIEWED");
    if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(preview.validCount).toBe(1);
    expect(preview.invalidCount).toBe(1);

    const confirm = await confirmImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      confirmDeps(),
    );
    expect(confirm.outcome).toBe("INVALID_ROWS");
    expect(await countQuestions(courseId)).toBe(0);
  });

  describe("Topic-name resolution", () => {
    it("a unique active match succeeds", async () => {
      const instructorId = await insertUser(db);
      const courseId = await insertCourse(db, instructorId);
      await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
      const repos = previewRepos();
      const topic = await repos.topics.createTopic({ courseId, name: "Introduction" });

      const sourceText = JSON.stringify([
        {
          topic: "Introduction",
          type: "SINGLE_CHOICE",
          prompt: "Prompt?",
          options: [
            { key: "A", content: "A" },
            { key: "B", content: "B" },
          ],
          correctOptions: ["A"],
        },
      ]);

      const preview = await previewImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText },
        repos,
      );
      expect(preview.outcome).toBe("PREVIEWED");
      if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
      expect(preview.rows[0].outcome).toBe("VALID");
      if (preview.rows[0].outcome !== "VALID") throw new Error("unreachable");
      expect(preview.rows[0].topicId).toBe(topic.id);
    });

    it("no match fails preview and confirm", async () => {
      const instructorId = await insertUser(db);
      const courseId = await insertCourse(db, instructorId);
      await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
      const repos = previewRepos();
      // No Topic created at all.

      const sourceText = JSON.stringify([
        {
          topic: "Nonexistent Topic",
          type: "SINGLE_CHOICE",
          prompt: "Prompt?",
          options: [
            { key: "A", content: "A" },
            { key: "B", content: "B" },
          ],
          correctOptions: ["A"],
        },
      ]);

      const preview = await previewImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText },
        repos,
      );
      expect(preview.outcome).toBe("PREVIEWED");
      if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
      expect(preview.rows[0].outcome).toBe("INVALID");
      if (preview.rows[0].outcome !== "INVALID") throw new Error("unreachable");
      expect(preview.rows[0].errors.some((e) => e.includes("was not found"))).toBe(true);

      const confirm = await confirmImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText },
        confirmDeps(),
      );
      expect(confirm.outcome).toBe("INVALID_ROWS");
      expect(await countQuestions(courseId)).toBe(0);
    });

    it("an ambiguous normalized match fails preview and confirm", async () => {
      const instructorId = await insertUser(db);
      const courseId = await insertCourse(db, instructorId);
      await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
      const repos = previewRepos();
      // Two distinct active Topics that normalize (trim + lowercase) to the same name.
      await repos.topics.createTopic({ courseId, name: "Stats" });
      await repos.topics.createTopic({ courseId, name: "STATS" });

      const sourceText = JSON.stringify([
        {
          topic: "Stats",
          type: "SINGLE_CHOICE",
          prompt: "Prompt?",
          options: [
            { key: "A", content: "A" },
            { key: "B", content: "B" },
          ],
          correctOptions: ["A"],
        },
      ]);

      const preview = await previewImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText },
        repos,
      );
      expect(preview.outcome).toBe("PREVIEWED");
      if (preview.outcome !== "PREVIEWED") throw new Error("unreachable");
      expect(preview.rows[0].outcome).toBe("INVALID");
      if (preview.rows[0].outcome !== "INVALID") throw new Error("unreachable");
      expect(
        preview.rows[0].errors.some((e) => e.includes("ambiguous") || e.includes("more than one")),
      ).toBe(true);

      const confirm = await confirmImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText },
        confirmDeps(),
      );
      expect(confirm.outcome).toBe("INVALID_ROWS");
      expect(await countQuestions(courseId)).toBe(0);
    });
  });

  it("an ARCHIVED Course is rejected at both preview and confirm", async () => {
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId, { status: "ARCHIVED" });
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });

    const sourceText = JSON.stringify([
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "Prompt?",
        options: [
          { key: "A", content: "A" },
          { key: "B", content: "B" },
        ],
        correctOptions: ["A"],
      },
    ]);

    const preview = await previewImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      previewRepos(),
    );
    expect(preview.outcome).toBe("COURSE_ARCHIVED");

    const confirm = await confirmImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      confirmDeps(),
    );
    expect(confirm.outcome).toBe("COURSE_ARCHIVED");
    expect(await countQuestions(courseId)).toBe(0);
  });

  it("confirm re-resolves Topic-name state against the CURRENT database on every call, not anything computed by an earlier previewImport call", async () => {
    const instructorId = await insertUser(db);
    const courseId = await insertCourse(db, instructorId);
    await insertCourseMembership(db, { userId: instructorId, courseId, role: "OWNER" });
    const repos = previewRepos();
    const topic = await repos.topics.createTopic({ courseId, name: "Introduction" });

    const sourceText = JSON.stringify([
      {
        topic: "Introduction",
        type: "SINGLE_CHOICE",
        prompt: "Prompt?",
        options: [
          { key: "A", content: "A" },
          { key: "B", content: "B" },
        ],
        correctOptions: ["A"],
      },
    ]);

    const stalePreview = await previewImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      repos,
    );
    expect(stalePreview.outcome).toBe("PREVIEWED");
    if (stalePreview.outcome !== "PREVIEWED") throw new Error("unreachable");
    expect(stalePreview.validCount).toBe(1);

    // The Topic is renamed away after `stalePreview` resolved it — proving
    // `confirmImport` re-runs its own Topic-name resolution against
    // whatever is in the database right now (via its own internal
    // `previewImport` reparse), not anything `stalePreview` itself computed.
    // `ConfirmImportCommand` structurally cannot accept a client preview
    // payload at all (only raw `format`/`sourceText`), so this test's real
    // value is proving the re-resolution itself, not a "trusts a passed-in
    // preview object" regression that the type signature already rules out.
    await repos.topics.renameTopic(topic.id, "Renamed Away");

    const confirm = await confirmImport(
      { actorUserId: instructorId, courseId, format: "JSON", sourceText },
      confirmDeps(),
    );
    expect(confirm.outcome).toBe("INVALID_ROWS");
    expect(await countQuestions(courseId)).toBe(0);
  });
});

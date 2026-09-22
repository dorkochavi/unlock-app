/**
 * Run 2026-09-22-008 S5 — Integrated Instructor-to-Learner Authoring Proof
 * (`docs/CHATGPT_PLAN.md` §12), executed against real PGlite/PostgreSQL: no
 * hosted fixtures are manufactured, and every step below drives the REAL
 * application use cases end to end (not raw SQL fixtures, except for
 * `insertUser` itself) — the same functions the actual API routes call.
 * Mirrors `run-006-question-authoring-walkthrough.test.ts`/
 * `run-007-structured-import-walkthrough.test.ts`'s own shape/harness.
 *
 * Where those two Slices each proved ONE capability in isolation (manual
 * authoring; Structured Import), this file's job is the cross-Run
 * integration those two never needed to prove together: a Course created
 * through the real Course-lifecycle use cases (Run 005), carrying BOTH a
 * manually authored Question (Run 006) AND an imported Question
 * (Run 007) side by side, published through the same unmodified
 * `publishQuestion`/`publishCourse` actions, joined by a real learner
 * through the real `joinCourse` use case (Run 005), with learner
 * eligibility proven through the real `getOrCreateDailyPlanForToday`
 * pipeline (Run 008 S4 hardened it to also respect Course archival) —
 * per the Plan's own S5 acceptance list:
 *   1. create Course through the application/product boundary;
 *   2. configure it (join policy);
 *   3. create active Topics;
 *   4. create at least one Question manually;
 *   5. import at least one Question through Structured Import;
 *   6. verify both remain drafts before explicit publish;
 *   7. publish Questions using the existing Run 006 path;
 *   8. publish Course;
 *   9. establish/join active learner membership through the existing
 *      supported product path;
 *   10. prove only intended published Questions become learner eligible;
 *   11. prove draft-only/unpublished content does not leak;
 *   12. prove historical versioning remains intact where re-publish is
 *       involved.
 */
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createCourse } from "../../../src/application/course/create-course";
import { joinCourse } from "../../../src/application/course/join-course";
import { publishCourse } from "../../../src/application/course/publish-course";
import { setCourseJoinPolicy } from "../../../src/application/course/set-course-join-policy";
import { createProductionDailyPlanGenerationSettings } from "../../../src/infrastructure/dailyPlan/composition-root";
import { getOrCreateDailyPlanForToday } from "../../../src/application/dailyPlan/get-or-create-daily-plan-for-today";
import { confirmImport } from "../../../src/application/import/confirm-import";
import { previewImport } from "../../../src/application/import/preview-import";
import { createQuestionDraft } from "../../../src/application/question/create-question-draft";
import { publishQuestion } from "../../../src/application/question/publish-question";
import { updateQuestionDraft } from "../../../src/application/question/update-question-draft";
import { createTopic } from "../../../src/application/topic/create-topic";
import { PostgresCourseMembershipRepository } from "../../../src/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "../../../src/infrastructure/postgres/course-repository";
import { PostgresCourseUnitOfWork } from "../../../src/infrastructure/postgres/postgres-course-unit-of-work";
import { PostgresDailyPlanUnitOfWork } from "../../../src/infrastructure/postgres/daily-plan-unit-of-work";
import { PostgresImportUnitOfWork } from "../../../src/infrastructure/postgres/postgres-import-unit-of-work";
import { PostgresQuestionRepository } from "../../../src/infrastructure/postgres/question-authoring-repository";
import { PostgresQuestionUnitOfWork } from "../../../src/infrastructure/postgres/postgres-question-unit-of-work";
import { PostgresTopicRepository } from "../../../src/infrastructure/postgres/topic-repository";
import { PostgresUnseenQuestionRepository } from "../../../src/infrastructure/postgres/unseen-question-repository";
import { PostgresUserRepository } from "../../../src/infrastructure/postgres/user-repository";
import { setUserTimezone } from "../../../src/application/user/set-user-timezone";
import { createTestDb, insertUser, pgliteConnectionProvider } from "./db-harness";

let db: PGlite;

beforeEach(async () => {
  db = await createTestDb();
});

afterEach(async () => {
  await db.close();
});

function courseRepos() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
  };
}

function questionRepos() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    topics: new PostgresTopicRepository(db),
    questions: new PostgresQuestionRepository(db),
  };
}

function importPreviewRepos() {
  return {
    memberships: new PostgresCourseMembershipRepository(db),
    courses: new PostgresCourseRepository(db),
    topics: new PostgresTopicRepository(db),
  };
}

async function currentVersionId(questionId: string): Promise<string | null> {
  const result = await db.query<{ current_version_id: string | null }>(
    "select current_version_id from questions where id = $1",
    [questionId],
  );
  return result.rows[0].current_version_id;
}

describe("Run 008 S5 — Integrated Instructor-to-Learner Authoring Proof", () => {
  it(
    "Course (Run 005) -> Topics -> manual authoring (Run 006) + Structured Import (Run 007), both draft " +
      "-> publish Questions -> publish Course -> learner join (Run 005) -> only published content is " +
      "learner-eligible (Run 008 S4) -> draft-only content never leaks -> re-publish preserves history",
    async () => {
      // 1. create Course through the real application/product boundary
      // (Run 005), never a raw SQL insert.
      const instructorId = await insertUser(db);
      const courseUow = new PostgresCourseUnitOfWork(pgliteConnectionProvider(db));
      const createResult = await createCourse(
        { actorUserId: instructorId, title: "Pilot Course", examDate: null },
        courseUow,
      );
      expect(createResult.outcome).toBe("CREATED");
      if (createResult.outcome !== "CREATED") throw new Error("unreachable");
      const courseId = createResult.course.id;
      expect(createResult.course.status).toBe("DRAFT");

      // 2. configure it — OPEN join policy, so a learner can self-join later.
      const policyResult = await setCourseJoinPolicy(
        { actorUserId: instructorId, courseId, joinPolicy: "OPEN" },
        courseRepos(),
      );
      expect(policyResult.outcome).toBe("UPDATED");

      // 3. create active Topics through the real createTopic application
      // use case (Run 005 S4) — not a raw repository call.
      const qRepos = questionRepos();
      const manualTopicResult = await createTopic(
        { actorUserId: instructorId, courseId, name: "Manual Topic" },
        qRepos,
      );
      expect(manualTopicResult.outcome).toBe("CREATED");
      if (manualTopicResult.outcome !== "CREATED") throw new Error("unreachable");
      const manualTopic = manualTopicResult.topic;
      // "Import Topic" is resolved by name (not id) by the Structured Import
      // pipeline below — the return value here is intentionally unused.
      const importTopicResult = await createTopic(
        { actorUserId: instructorId, courseId, name: "Import Topic" },
        qRepos,
      );
      expect(importTopicResult.outcome).toBe("CREATED");

      // 4. create at least one Question manually (Run 006).
      const draftResult = await createQuestionDraft({ actorUserId: instructorId, courseId }, qRepos);
      expect(draftResult.outcome).toBe("CREATED");
      if (draftResult.outcome !== "CREATED") throw new Error("unreachable");
      const manualQuestionId = draftResult.question.id;
      const manualSaved = await updateQuestionDraft(
        {
          actorUserId: instructorId,
          courseId,
          questionId: manualQuestionId,
          topicId: manualTopic.id,
          questionType: "SINGLE_CHOICE",
          prompt: "What is 2+2?",
          answerOptions: [
            { id: "a", content: "3" },
            { id: "b", content: "4" },
          ],
          correctOptionIds: ["b"],
          explanation: null,
        },
        qRepos,
      );
      expect(manualSaved.outcome).toBe("UPDATED");

      // 5. import at least one Question through Structured Import (Run 007).
      const importSourceText = JSON.stringify([
        {
          topic: "Import Topic",
          type: "SINGLE_CHOICE",
          prompt: "What is the capital of France?",
          options: [
            { key: "A", content: "Paris" },
            { key: "B", content: "London" },
          ],
          correctOptions: ["A"],
        },
      ]);
      const previewResult = await previewImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText: importSourceText },
        importPreviewRepos(),
      );
      expect(previewResult.outcome).toBe("PREVIEWED");
      if (previewResult.outcome !== "PREVIEWED") throw new Error("unreachable");
      expect(previewResult.validCount).toBe(1);

      const confirmResult = await confirmImport(
        { actorUserId: instructorId, courseId, format: "JSON", sourceText: importSourceText },
        {
          previewRepos: importPreviewRepos(),
          uow: new PostgresImportUnitOfWork(pgliteConnectionProvider(db)),
        },
      );
      expect(confirmResult.outcome).toBe("CONFIRMED");
      if (confirmResult.outcome !== "CONFIRMED") throw new Error("unreachable");
      const importedQuestionId = confirmResult.createdQuestionIds[0];

      // A THIRD Question, authored but deliberately left in draft — this one
      // must never become learner-eligible (step 11 below).
      const leftInDraft = await createQuestionDraft({ actorUserId: instructorId, courseId }, qRepos);
      expect(leftInDraft.outcome).toBe("CREATED");
      if (leftInDraft.outcome !== "CREATED") throw new Error("unreachable");
      const draftOnlyQuestionId = leftInDraft.question.id;
      const draftOnlySaved = await updateQuestionDraft(
        {
          actorUserId: instructorId,
          courseId,
          questionId: draftOnlyQuestionId,
          topicId: manualTopic.id,
          questionType: "SINGLE_CHOICE",
          prompt: "Never published",
          answerOptions: [
            { id: "a", content: "X" },
            { id: "b", content: "Y" },
          ],
          correctOptionIds: ["a"],
          explanation: null,
        },
        qRepos,
      );
      expect(draftOnlySaved.outcome).toBe("UPDATED");

      // 6. verify all three remain DRAFT_ONLY before explicit publish.
      expect(await currentVersionId(manualQuestionId)).toBeNull();
      expect(await currentVersionId(importedQuestionId)).toBeNull();
      expect(await currentVersionId(draftOnlyQuestionId)).toBeNull();

      // 7. publish the manual and imported Questions through the existing,
      // UNMODIFIED Run 006 publish action — `draftOnlyQuestionId` is
      // deliberately never published.
      const questionUow = new PostgresQuestionUnitOfWork(pgliteConnectionProvider(db));
      const manualPublished = await publishQuestion(
        { actorUserId: instructorId, courseId, questionId: manualQuestionId },
        questionUow,
      );
      expect(manualPublished.outcome).toBe("PUBLISHED");
      if (manualPublished.outcome !== "PUBLISHED") throw new Error("unreachable");
      const manualFirstVersionId = manualPublished.versionId;

      const importedPublished = await publishQuestion(
        { actorUserId: instructorId, courseId, questionId: importedQuestionId },
        questionUow,
      );
      expect(importedPublished.outcome).toBe("PUBLISHED");

      // 8. publish the Course — never implies the Questions got published;
      // they already were, independently, in step 7.
      const coursePublished = await publishCourse({ actorUserId: instructorId, courseId }, courseRepos());
      expect(coursePublished.outcome).toBe("PUBLISHED");

      // 9. a real learner joins through the real, existing joinCourse use
      // case (Run 005) — never a raw membership insert.
      const learnerId = await insertUser(db);
      const timezoneResult = await setUserTimezone(
        { actorUserId: learnerId, timezone: "UTC" },
        new PostgresUserRepository(db),
      );
      expect(timezoneResult.outcome).toBe("UPDATED");
      const joinResult = await joinCourse({ actorUserId: learnerId, courseId }, courseRepos());
      expect(joinResult.outcome).toBe("JOINED");

      // 10. only intended published content is learner-eligible — proven at
      // two layers: the direct unseen-question read path, AND the full
      // getOrCreateDailyPlanForToday pipeline (Run 008 S4 hardened this to
      // also respect Course archival — exercising it here proves S4's fix
      // composes correctly with a genuinely fresh, just-published Course).
      const unseenRepo = new PostgresUnseenQuestionRepository(db);
      const unseenForLearner = await unseenRepo.findUnseenQuestions(learnerId, courseId, 10);
      const unseenQuestionIds = unseenForLearner.map((c) => c.questionId);
      expect(unseenQuestionIds).toContain(manualQuestionId);
      expect(unseenQuestionIds).toContain(importedQuestionId);
      // 11. draft-only/unpublished content does not leak.
      expect(unseenQuestionIds).not.toContain(draftOnlyQuestionId);

      const dailyPlanPorts = {
        users: new PostgresUserRepository(db),
        courseMemberships: new PostgresCourseMembershipRepository(db),
        courses: new PostgresCourseRepository(db),
        dailyPlanUnitOfWork: new PostgresDailyPlanUnitOfWork(pgliteConnectionProvider(db)),
      };
      const planResult = await getOrCreateDailyPlanForToday(
        { userId: learnerId, now: new Date("2026-01-10T10:00:00Z") },
        createProductionDailyPlanGenerationSettings(),
        dailyPlanPorts,
      );
      expect(planResult.outcome).toBe("READY");
      if (planResult.outcome !== "READY") throw new Error("unreachable");
      const planQuestionIds = planResult.plan.items.map((item) => item.questionId);
      expect(planQuestionIds).not.toContain(draftOnlyQuestionId);
      // At least one of the two published Questions reached Today (both are
      // eligible; the planner's own policy decides ordering/inclusion up to
      // maxItems — this only asserts eligibility, not a specific ranking).
      expect(
        planQuestionIds.includes(manualQuestionId) || planQuestionIds.includes(importedQuestionId),
      ).toBe(true);

      // 12. historical versioning remains intact across a re-publish: the
      // manually authored Question is edited and re-published — the ORIGINAL
      // QuestionVersion row must remain unchanged (immutable history), and
      // `current_version_id` must now point at the NEW version, never the
      // old one rewritten in place.
      const reEdited = await updateQuestionDraft(
        {
          actorUserId: instructorId,
          courseId,
          questionId: manualQuestionId,
          topicId: manualTopic.id,
          questionType: "SINGLE_CHOICE",
          prompt: "What is 2+2? (revised)",
          answerOptions: [
            { id: "a", content: "3" },
            { id: "b", content: "4" },
          ],
          correctOptionIds: ["b"],
          explanation: "Basic arithmetic.",
        },
        qRepos,
      );
      expect(reEdited.outcome).toBe("UPDATED");

      const republished = await publishQuestion(
        { actorUserId: instructorId, courseId, questionId: manualQuestionId },
        questionUow,
      );
      expect(republished.outcome).toBe("PUBLISHED");
      if (republished.outcome !== "PUBLISHED") throw new Error("unreachable");
      const manualSecondVersionId = republished.versionId;
      expect(manualSecondVersionId).not.toBe(manualFirstVersionId);

      const oldVersionRow = await db.query<{ prompt: string }>(
        "select prompt from question_versions where id = $1",
        [manualFirstVersionId],
      );
      expect(oldVersionRow.rows).toHaveLength(1);
      expect(oldVersionRow.rows[0].prompt).toBe("What is 2+2?"); // unchanged, not rewritten

      const newVersionRow = await db.query<{ prompt: string }>(
        "select prompt from question_versions where id = $1",
        [manualSecondVersionId],
      );
      expect(newVersionRow.rows[0].prompt).toBe("What is 2+2? (revised)");

      expect(await currentVersionId(manualQuestionId)).toBe(manualSecondVersionId);
    },
  );
});

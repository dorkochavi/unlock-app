/**
 * publishQuestion — the application-layer use case for the atomic, immutable
 * publish/re-publish transaction (Run 006 S5, CHATGPT_PLAN.md "Atomic
 * Immutable Publish + Re-publish"). Mirrors `createCourse`'s
 * `CourseUnitOfWork` pattern (Run 005 S2 DB review finding) exactly — the
 * ENTIRE decision (authorize, load, validate) plus the write runs inside one
 * `QuestionUnitOfWork` transaction, the same discipline `submitAnswer`
 * already uses (`src/application/learning/submit-answer.ts`) for a
 * multi-step operation that must not partially apply: every outcome other
 * than `PUBLISHED` is signalled by throwing a typed `PublishOutcomeSignal`,
 * caught only by the outer `publishQuestion` wrapper, so a failed
 * authorization/validation check can never leave a half-written
 * `question_versions` row or a `current_version_id` pointing at nothing.
 *
 * ## Core transaction (CHATGPT_PLAN.md S5 "Core transaction")
 *
 * 1. authorize actor/Course (`canAuthorCourse`);
 * 2. reject a terminal ARCHIVED Course (Run 006 S4 security-reviewer
 *    carried-forward finding, `scratch/development_checkpoint.md`'s S4
 *    section: archived-Course authoring was enforced only in the UI through
 *    S2-S4; this is the point — the first point that creates new immutable
 *    learner-facing content — where a server-side check closes that gap.
 *    `createQuestionDraft`/`updateQuestionDraft` are deliberately left
 *    unchanged: the reviewer explicitly scoped the fix to publish, the only
 *    action with real product consequence);
 * 3. load the authoritative Question draft;
 * 4. reject `NOTHING_TO_PUBLISH` for a plain `PUBLISHED` Question with no
 *    pending draft (Run 006 S3's own forward note: `assertQuestionPublishReady`
 *    always validates `draft.*`, which is empty after a successful publish —
 *    without this guard a `PUBLISHED` Question with nothing pending would
 *    surface S3's raw "prompt must not be empty" `NOT_READY` message, which
 *    is misleading for an instructor who has nothing to publish);
 * 5. validate publish-ready state server-side (`assertQuestionPublishReady`
 *    — the ONE authoritative contract, Run 006 S3; never re-implemented
 *    here);
 * 6. insert a new immutable `question_versions` row;
 * 7. repoint `questions.current_version_id` to it and clear `draft_*` back
 *    to `null`;
 * 8. commit.
 *
 * First publish: `currentVersionId` starts `null`, the new version becomes
 * version 1. Re-publish: a NEW `question_versions` row is inserted (never an
 * update to the existing one — `insertVersion`'s own doc comment), and
 * `current_version_id` is repointed; the OLD version row is never touched by
 * any statement this transaction issues, so every existing Attempt/
 * DailyPlanItem referencing it via the existing composite FKs
 * (`on delete restrict`, never cascade) remains valid by construction.
 *
 * ## Topic/history semantics (CHATGPT_PLAN.md S5 "Topic/history semantics")
 *
 * `topicId` is current (not versioned) `questions` metadata — decided in
 * Run 006 S1 (`scratch/development_checkpoint.md` finding #4) and already
 * encoded in `20260928000000_question_authoring_v1.sql`'s own column
 * comment. Publish therefore does NOT snapshot `topicId` into the new
 * `question_versions` row: `correctness` is fully determined by the frozen
 * version content (prompt/options/type/correct answer), and Topic
 * association is an organizational concern that must be free to change
 * later without retroactively reinterpreting any historical Attempt. This is
 * stated explicitly here, not left ambiguous, per the Plan's requirement.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import {
  assertQuestionPublishReady,
  computeQuestionAuthoringState,
  QuestionNotPublishReadyError,
} from "../../domain/question/types";
import type {
  PublishQuestionRepositories,
  QuestionAuthoringRecord,
  QuestionUnitOfWork,
} from "./ports";

export interface PublishQuestionCommand {
  actorUserId: string;
  courseId: string;
  questionId: string;
}

export type PublishQuestionResult =
  | { outcome: "PUBLISHED"; question: QuestionAuthoringRecord; versionId: string }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "QUESTION_NOT_FOUND" }
  | { outcome: "COURSE_ARCHIVED" }
  | { outcome: "NOTHING_TO_PUBLISH" }
  | { outcome: "NOT_READY"; reason: string };

class PublishOutcomeSignal extends Error {
  constructor(public readonly result: Exclude<PublishQuestionResult, { outcome: "PUBLISHED" }>) {
    super(`publishQuestion: ${result.outcome}`);
    this.name = "PublishOutcomeSignal";
  }
}

export async function publishQuestion(
  command: PublishQuestionCommand,
  uow: QuestionUnitOfWork,
): Promise<PublishQuestionResult> {
  try {
    return await uow.runInTransaction((repos) => publishQuestionInTransaction(command, repos));
  } catch (error) {
    if (error instanceof PublishOutcomeSignal) {
      return error.result;
    }
    throw error;
  }
}

async function publishQuestionInTransaction(
  command: PublishQuestionCommand,
  repos: PublishQuestionRepositories,
): Promise<PublishQuestionResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    throw new PublishOutcomeSignal({ outcome: "NOT_AUTHORIZED" });
  }

  const course = await repos.courses.getCourseForAuthoring(command.courseId);
  if (course === null) {
    // Unreachable in practice: `actorMembership` above already proves a
    // `course_memberships` row exists for this exact `courseId`, and that
    // row's own FK guarantees the Course itself exists. Handled defensively
    // rather than assumed, matching `publishCourse`'s own established style.
    throw new PublishOutcomeSignal({ outcome: "QUESTION_NOT_FOUND" });
  }
  if (course.status === "ARCHIVED") {
    throw new PublishOutcomeSignal({ outcome: "COURSE_ARCHIVED" });
  }

  const question = await repos.questions.getForAuthoring(command.questionId);
  if (question === null || question.courseId !== command.courseId) {
    // Cross-Course collapse, same pattern as every other Question-authoring
    // use case (`getQuestionForAuthoring`'s own doc comment) — never leaks
    // which Course a Question actually belongs to.
    throw new PublishOutcomeSignal({ outcome: "QUESTION_NOT_FOUND" });
  }

  if (computeQuestionAuthoringState(question) === "PUBLISHED") {
    throw new PublishOutcomeSignal({ outcome: "NOTHING_TO_PUBLISH" });
  }

  let content;
  try {
    content = assertQuestionPublishReady({
      topicId: question.topicId,
      questionType: question.draft.questionType,
      prompt: question.draft.prompt,
      answerOptions: question.draft.answerOptions,
      correctOptionIds: question.draft.correctOptionIds,
      explanation: question.draft.explanation,
    });
  } catch (error) {
    if (error instanceof QuestionNotPublishReadyError) {
      throw new PublishOutcomeSignal({ outcome: "NOT_READY", reason: error.message });
    }
    throw error;
  }

  const versionNumber = await repos.questions.getNextVersionNumber(command.questionId);
  const { id: versionId } = await repos.questions.insertVersion(
    command.questionId,
    content,
    versionNumber,
  );
  const updated = await repos.questions.setCurrentVersionAndClearDraft(
    command.questionId,
    versionId,
  );
  if (updated === null) {
    // Reachable only if the Question was deleted between the read above and
    // this write — not a normal V1 path (no code deletes a `questions` row).
    throw new Error(
      `publishQuestion: Question ${command.questionId} disappeared mid-transaction`,
    );
  }

  return { outcome: "PUBLISHED", question: updated, versionId };
}

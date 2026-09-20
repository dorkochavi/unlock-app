/**
 * updateQuestionDraft — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR editing a Question's draft content and/or Topic
 * association (Run 006 S2). Every field is independently optional
 * (`undefined` = leave unchanged) — this is deliberately a partial-save
 * "work in progress" write, not a publish (Run 006 S5 owns publish-ready
 * validation and the immutable QuestionVersion transaction).
 *
 * Authorization and the same-Course Topic guard both follow
 * `renameTopic`'s established pattern exactly
 * (`src/application/topic/rename-topic.ts`'s module doc comment):
 * authorize by `command.courseId` FIRST (an unauthorized caller never learns
 * whether `questionId`/`topicId` exist at all), then collapse any
 * cross-Course id into the same not-found-shaped outcome as a nonexistent
 * one.
 *
 * An archived Topic may not be assigned as a NEW association (Run 006 S1
 * audit finding #10, `scratch/development_checkpoint.md`): assigning
 * `topicId` to an archived Topic's id is rejected as `TOPIC_ARCHIVED`,
 * UNLESS it is exactly the Question's own already-associated Topic (a
 * no-op re-send, not a new choice) — an existing Question that already
 * points at a since-archived Topic must keep working without forced
 * reassociation, matching `20260927000000_topics_v1.sql`'s own
 * "archive, never delete, preserve referential integrity" design.
 *

 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import {
  assertSaveableQuestionDraftContent,
  InvalidQuestionDraftContentError,
  type QuestionDraftContent,
} from "../../domain/question/types";
import type {
  QuestionAuthoringRecord,
  QuestionRepositories,
  UpdateQuestionDraftInput,
} from "./ports";

export interface UpdateQuestionDraftCommand extends UpdateQuestionDraftInput {
  actorUserId: string;
  courseId: string;
  questionId: string;
}

export type UpdateQuestionDraftResult =
  | { outcome: "UPDATED"; question: QuestionAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "QUESTION_NOT_FOUND" }
  | { outcome: "TOPIC_NOT_FOUND" }
  | { outcome: "TOPIC_ARCHIVED" }
  | { outcome: "INVALID_DRAFT"; message: string };

export async function updateQuestionDraft(
  command: UpdateQuestionDraftCommand,
  repos: QuestionRepositories,
): Promise<UpdateQuestionDraftResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const question = await repos.questions.getForAuthoring(command.questionId);
  if (question === null || question.courseId !== command.courseId) {
    return { outcome: "QUESTION_NOT_FOUND" };
  }

  if (command.topicId !== undefined && command.topicId !== null) {
    const topic = await repos.topics.getTopic(command.topicId);
    if (topic === null || topic.courseId !== command.courseId) {
      return { outcome: "TOPIC_NOT_FOUND" };
    }
    if (topic.archivedAt !== null && topic.id !== question.topicId) {
      return { outcome: "TOPIC_ARCHIVED" };
    }
  }

  const draftPatch: Partial<QuestionDraftContent> = {};
  if (command.questionType !== undefined) draftPatch.questionType = command.questionType;
  if (command.prompt !== undefined) draftPatch.prompt = command.prompt;
  if (command.answerOptions !== undefined) draftPatch.answerOptions = command.answerOptions;
  if (command.correctOptionIds !== undefined) draftPatch.correctOptionIds = command.correctOptionIds;
  if (command.explanation !== undefined) draftPatch.explanation = command.explanation;

  try {
    assertSaveableQuestionDraftContent(draftPatch);
  } catch (error) {
    if (error instanceof InvalidQuestionDraftContentError) {
      return { outcome: "INVALID_DRAFT", message: error.message };
    }
    throw error;
  }

  const updated = await repos.questions.updateDraft(command.questionId, {
    topicId: command.topicId,
    questionType: command.questionType,
    prompt: command.prompt,
    answerOptions: command.answerOptions,
    correctOptionIds: command.correctOptionIds,
    explanation: command.explanation,
  });
  if (updated === null) {
    // Reachable only if the Question was deleted between the read above and
    // this write — not a normal V1 path (no code deletes a `questions` row).
    return { outcome: "QUESTION_NOT_FOUND" };
  }
  return { outcome: "UPDATED", question: updated };
}

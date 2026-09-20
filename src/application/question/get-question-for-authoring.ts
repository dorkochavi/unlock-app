/**
 * getQuestionForAuthoring — the application-layer use case for an
 * authorized OWNER/active-INSTRUCTOR reading one Question's authoring state
 * (Run 006 S2). Mirrors `renameTopic`'s cross-Course-association guard
 * pattern exactly (`src/application/topic/rename-topic.ts`'s module doc
 * comment): authorize by `command.courseId` FIRST, then collapse a
 * `questionId` that exists but belongs to a DIFFERENT Course into the same
 * `QUESTION_NOT_FOUND` outcome as a nonexistent one — never leaks which
 * Course a Question actually belongs to.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 *
 * Also resolves `publishedContent` (Run 006 S4): the CURRENT QuestionVersion's
 * full content (including `correctOptionIds`), so an authoring UI can let an
 * instructor "reopen/edit" a Question that has no pending draft — without
 * this, `question.draft` alone would show only `null` fields for a plain
 * `PUBLISHED` Question, even though it has real published content. This is
 * a DISPLAY-only convenience: it never writes to `draft_*`, and is `null`
 * whenever there is no current version yet (`currentVersionId === null`).
 *
 * Also resolves `topic` (Run 006 S4, reviewer finding): the associated
 * Topic's own record, via `TopicRepository.getTopic` — which, unlike
 * `listActiveForCourse`, does NOT filter by `archived_at`. Without this, an
 * authoring UI that only has access to the active-Topics list would show a
 * Question's since-archived Topic as unset, even though the association is
 * still real (Run 006 S1 finding #10: an already-associated Topic remaining
 * archived must not force reassociation). `null` whenever `topicId` is
 * `null`.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { QuestionAuthoringRecord, QuestionDraftContent, QuestionRepositories, Topic } from "./ports";

export interface GetQuestionForAuthoringCommand {
  actorUserId: string;
  courseId: string;
  questionId: string;
}

export type GetQuestionForAuthoringResult =
  | {
      outcome: "FOUND";
      question: QuestionAuthoringRecord;
      publishedContent: QuestionDraftContent | null;
      topic: Topic | null;
    }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "QUESTION_NOT_FOUND" };

export async function getQuestionForAuthoring(
  command: GetQuestionForAuthoringCommand,
  repos: QuestionRepositories,
): Promise<GetQuestionForAuthoringResult> {
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

  const publishedContent =
    question.currentVersionId === null
      ? null
      : await repos.questions.getVersionContent(question.currentVersionId);

  const topic = question.topicId === null ? null : await repos.topics.getTopic(question.topicId);

  return { outcome: "FOUND", question, publishedContent, topic };
}

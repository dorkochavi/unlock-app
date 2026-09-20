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
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { QuestionAuthoringRecord, QuestionRepositories } from "./ports";

export interface GetQuestionForAuthoringCommand {
  actorUserId: string;
  courseId: string;
  questionId: string;
}

export type GetQuestionForAuthoringResult =
  | { outcome: "FOUND"; question: QuestionAuthoringRecord }
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
  return { outcome: "FOUND", question };
}

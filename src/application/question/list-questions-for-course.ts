/**
 * listQuestionsForCourse — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR listing every Question (any authoring state) in
 * their Course (Run 006 S2). Mirrors `listTopicsForCourse`'s own
 * authorization shape exactly.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { QuestionAuthoringRecord, QuestionRepositories } from "./ports";

export interface ListQuestionsForCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type ListQuestionsForCourseResult =
  | { outcome: "LISTED"; questions: QuestionAuthoringRecord[] }
  | { outcome: "NOT_AUTHORIZED" };

export async function listQuestionsForCourse(
  command: ListQuestionsForCourseCommand,
  repos: QuestionRepositories,
): Promise<ListQuestionsForCourseResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const questions = await repos.questions.listForCourse(command.courseId);
  return { outcome: "LISTED", questions };
}

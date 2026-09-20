/**
 * createQuestionDraft — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR starting a new, never-published Question draft in
 * their Course (Run 006 S2). Deliberately minimal: creates an empty draft
 * (no Topic, no content) — `updateQuestionDraft` fills it in. Mirrors
 * `createTopic`'s own authorization shape exactly (`canAuthorCourse`, same
 * content-authoring policy as every other Run-005/006 authoring surface).
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { QuestionAuthoringRecord, QuestionRepositories } from "./ports";

export interface CreateQuestionDraftCommand {
  actorUserId: string;
  courseId: string;
}

export type CreateQuestionDraftResult =
  | { outcome: "CREATED"; question: QuestionAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" };

export async function createQuestionDraft(
  command: CreateQuestionDraftCommand,
  repos: QuestionRepositories,
): Promise<CreateQuestionDraftResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const question = await repos.questions.createDraft({ courseId: command.courseId });
  return { outcome: "CREATED", question };
}

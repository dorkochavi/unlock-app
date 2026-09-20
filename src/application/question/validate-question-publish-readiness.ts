/**
 * validateQuestionPublishReadiness — the application-layer entry point into
 * the ONE authoritative Publish-Ready Validation Contract
 * (`assertQuestionPublishReady`, `src/domain/question/types.ts`, Run 006
 * S3). Used both by the authoring UI (Run 006 S4, to show a "ready to
 * publish" indicator without side effects) and internally by the publish
 * transaction itself (Run 006 S5, which must re-validate server-side
 * immediately before writing rather than trusting a client's earlier
 * check).
 *
 * Read-only: never creates an Attempt, never touches `current_version_id`,
 * never writes a `question_versions` row — validating readiness is not
 * publishing.
 *
 * Authorization and the cross-Course collapse-to-`QUESTION_NOT_FOUND`
 * pattern both mirror `getQuestionForAuthoring` exactly.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import {
  assertQuestionPublishReady,
  QuestionNotPublishReadyError,
  type PublishableQuestionVersionContent,
} from "../../domain/question/types";
import type { QuestionRepositories } from "./ports";

export interface ValidateQuestionPublishReadinessCommand {
  actorUserId: string;
  courseId: string;
  questionId: string;
}

export type ValidateQuestionPublishReadinessResult =
  | { outcome: "READY"; content: PublishableQuestionVersionContent }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "QUESTION_NOT_FOUND" }
  | { outcome: "NOT_READY"; reason: string };

export async function validateQuestionPublishReadiness(
  command: ValidateQuestionPublishReadinessCommand,
  repos: QuestionRepositories,
): Promise<ValidateQuestionPublishReadinessResult> {
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

  try {
    const content = assertQuestionPublishReady({
      topicId: question.topicId,
      questionType: question.draft.questionType,
      prompt: question.draft.prompt,
      answerOptions: question.draft.answerOptions,
      correctOptionIds: question.draft.correctOptionIds,
      explanation: question.draft.explanation,
    });
    return { outcome: "READY", content };
  } catch (error) {
    if (error instanceof QuestionNotPublishReadyError) {
      return { outcome: "NOT_READY", reason: error.message };
    }
    throw error;
  }
}

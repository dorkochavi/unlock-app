/**
 * Testable core of `POST /api/courses/:courseId/questions/:questionId/publish`
 * (Run 006 S5 — atomic immutable publish/re-publish). No request body.
 * Mirrors `courses/[courseId]/publish/handle-publish-course.ts`'s
 * authenticate-then-validate-then-invoke split exactly.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` or `questionId` -> 404,
 *   `{error: {code: "QUESTION_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `QUESTION_NOT_FOUND` -> 404, `{error: {code: "QUESTION_NOT_FOUND"}}`.
 * - `COURSE_ARCHIVED` -> 409, `{error: {code: "COURSE_ARCHIVED"}}` — a real,
 *   existing state conflicting with the requested action, matching this
 *   codebase's established `INVALID_TRANSITION`/`TOPIC_ARCHIVED` 409
 *   precedent.
 * - `NOTHING_TO_PUBLISH` -> 409, `{error: {code: "NOTHING_TO_PUBLISH"}}` —
 *   distinct from `NOT_READY`: the Question is already `PUBLISHED` with no
 *   pending draft, not "started but incomplete" (Run 006 S3's own forward
 *   note, resolved here).
 * - `NOT_READY` -> 400, `{error: {code: "NOT_READY", reason}}` — `reason`
 *   comes only from this codebase's own controlled domain validator
 *   (`assertQuestionPublishReady`), never a raw exception.
 * - `PUBLISHED` -> 200, `{question: QuestionAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../../lib/uuid";
import { toQuestionAuthoringDto } from "../../question-dto";

import type { PublishQuestionResult } from "@/application/question/publish-question";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandlePublishQuestionDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  questionId: string;
  publish: (
    command: { actorUserId: string; courseId: string; questionId: string },
  ) => Promise<PublishQuestionResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function questionNotFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "QUESTION_NOT_FOUND" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handlePublishQuestion(
  deps: HandlePublishQuestionDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/questions/:questionId/publish: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId) || !isUuid(deps.questionId)) {
    return questionNotFoundResponse();
  }

  let result: PublishQuestionResult;
  try {
    result = await deps.publish({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      questionId: deps.questionId,
    });
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/questions/:questionId/publish: unexpected error during publish",
      error,
    );
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "QUESTION_NOT_FOUND":
      return questionNotFoundResponse();

    case "COURSE_ARCHIVED":
      return { status: 409, body: { error: { code: "COURSE_ARCHIVED" } } };

    case "NOTHING_TO_PUBLISH":
      return { status: 409, body: { error: { code: "NOTHING_TO_PUBLISH" } } };

    case "NOT_READY":
      return { status: 400, body: { error: { code: "NOT_READY", reason: result.reason } } };

    case "PUBLISHED":
      return { status: 200, body: { question: toQuestionAuthoringDto(result.question) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/questions/:questionId/publish: unhandled PublishQuestionResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

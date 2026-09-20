/**
 * Testable core of `GET /api/courses/:courseId/questions/:questionId` (Run
 * 006 S4 — "read one Question's authoring state"). Mirrors
 * `courses/[courseId]/manage/handle-get-course-for-authoring.ts`'s shape.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` or `questionId` -> 404,
 *   `{error: {code: "QUESTION_NOT_FOUND"}}` — matches
 *   `getQuestionForAuthoring`'s own non-leaking cross-Course collapse: a
 *   malformed id is treated identically to "does not exist," never a
 *   distinct client-visible category.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `QUESTION_NOT_FOUND` -> 404, `{error: {code: "QUESTION_NOT_FOUND"}}`.
 * - `FOUND` -> 200, `{question: QuestionAuthoringDto, publishedContent: QuestionAuthoringDraftDto | null, topic: TopicSummaryDto | null}`.
 *   `publishedContent` is the current QuestionVersion's full content (Run
 *   006 S4 "reopen/edit" support) — `null` only when the Question has never
 *   been published. `topic` is the associated Topic's own record (including
 *   an archived one — Run 006 S1 decision #10), `null` only when no Topic
 *   is associated.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../lib/uuid";
import { toQuestionAuthoringDto, toQuestionDraftContentDto, toTopicSummaryDto } from "../question-dto";

import type { GetQuestionForAuthoringResult } from "@/application/question/get-question-for-authoring";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleGetQuestionForAuthoringDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  questionId: string;
  get: (command: {
    actorUserId: string;
    courseId: string;
    questionId: string;
  }) => Promise<GetQuestionForAuthoringResult>;
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

export async function handleGetQuestionForAuthoring(
  deps: HandleGetQuestionForAuthoringDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "GET /api/courses/:courseId/questions/:questionId: unexpected error during authentication",
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

  let result: GetQuestionForAuthoringResult;
  try {
    result = await deps.get({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      questionId: deps.questionId,
    });
  } catch (error) {
    console.error("GET /api/courses/:courseId/questions/:questionId: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "QUESTION_NOT_FOUND":
      return questionNotFoundResponse();

    case "FOUND":
      return {
        status: 200,
        body: {
          question: toQuestionAuthoringDto(result.question),
          publishedContent: toQuestionDraftContentDto(result.publishedContent),
          topic: result.topic === null ? null : toTopicSummaryDto(result.topic),
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/questions/:questionId: unhandled GetQuestionForAuthoringResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

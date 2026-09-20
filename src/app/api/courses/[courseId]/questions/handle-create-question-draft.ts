/**
 * Testable core of `POST /api/courses/:courseId/questions` (Run 006 S4 —
 * "create Question draft"). Mirrors
 * `courses/[courseId]/topics/handle-create-topic.ts`'s shape, minus body
 * validation: `createQuestionDraft` takes no fields beyond `courseId` — the
 * created Question always starts with no Topic, no draft content, and no
 * current version (never-published); every other field is filled in later
 * via `PATCH /api/courses/:courseId/questions/:questionId`.
 *
 * ## Trust boundary
 *
 * `authenticate` is the only source of `actorUserId`. `courseId` comes from
 * the URL path. The request body is not read at all.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `CREATED` -> 201, `{question: QuestionAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toQuestionAuthoringDto } from "./question-dto";

import type { CreateQuestionDraftResult } from "@/application/question/create-question-draft";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleCreateQuestionDraftDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  create: (command: { actorUserId: string; courseId: string }) => Promise<CreateQuestionDraftResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleCreateQuestionDraft(
  deps: HandleCreateQuestionDraftDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/courses/:courseId/questions: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: CreateQuestionDraftResult;
  try {
    result = await deps.create({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("POST /api/courses/:courseId/questions: unexpected error during creation", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "CREATED":
      return { status: 201, body: { question: toQuestionAuthoringDto(result.question) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/questions: unhandled CreateQuestionDraftResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

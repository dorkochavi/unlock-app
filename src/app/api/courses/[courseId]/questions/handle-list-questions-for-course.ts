/**
 * Testable core of `GET /api/courses/:courseId/questions` (Run 006 S4 —
 * "list Questions"). Mirrors
 * `courses/[courseId]/topics/handle-list-topics-for-course.ts`'s shape
 * exactly.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `LISTED` -> 200, `{questions: QuestionAuthoringDto[], publishedPromptByQuestionId: Record<string,string>, topicById: Record<string,TopicSummaryDto>}`.
 *   `publishedPromptByQuestionId` carries a PUBLISHED (no pending draft)
 *   Question's real prompt (its own `draft.prompt` is `null` by S2's
 *   publish-clears-draft contract) — prompt-only, never `correctOptionIds`.
 *   `topicById` includes an archived Topic's own entry (Run 006 S1 decision
 *   #10), so a Question's real Topic association is never misrendered as
 *   unset merely because that Topic was archived after the fact.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toQuestionAuthoringDto, toTopicSummaryDto } from "./question-dto";

import type { ListQuestionsForCourseResult } from "@/application/question/list-questions-for-course";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleListQuestionsForCourseDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  listQuestions: (command: { actorUserId: string; courseId: string }) => Promise<ListQuestionsForCourseResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleListQuestionsForCourse(
  deps: HandleListQuestionsForCourseDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/questions: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: ListQuestionsForCourseResult;
  try {
    result = await deps.listQuestions({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("GET /api/courses/:courseId/questions: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "LISTED":
      return {
        status: 200,
        body: {
          questions: result.questions.map(toQuestionAuthoringDto),
          publishedPromptByQuestionId: result.publishedPromptByQuestionId,
          topicById: Object.fromEntries(
            Object.entries(result.topicById).map(([topicId, topic]) => [topicId, toTopicSummaryDto(topic)]),
          ),
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/questions: unhandled ListQuestionsForCourseResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

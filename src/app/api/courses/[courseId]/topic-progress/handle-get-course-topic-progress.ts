/**
 * Testable core of `GET /api/courses/:courseId/topic-progress` (Run 009 S1).
 * Mirrors `item-analysis/handle-get-course-item-analysis.ts`.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_ACTIVE` -> 409, `{error: {code: "COURSE_NOT_ACTIVE"}}`.
 * - `READY` -> 200, `{topics}` — the caller's OWN qualitative Topic states
 *   plus a plain attempted/total coverage count; no percentage or score.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";

import type { GetCourseTopicProgressResult } from "@/application/progress/get-course-topic-progress";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleGetCourseTopicProgressDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  getTopicProgress: (command: {
    actorUserId: string;
    courseId: string;
  }) => Promise<GetCourseTopicProgressResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetCourseTopicProgress(
  deps: HandleGetCourseTopicProgressDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-progress: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: GetCourseTopicProgressResult;
  try {
    result = await deps.getTopicProgress({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
    });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-progress: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_ACTIVE":
      return { status: 409, body: { error: { code: "COURSE_NOT_ACTIVE" } } };

    case "READY":
      return {
        status: 200,
        body: {
          topics: result.topics.map((topic) => ({
            topicId: topic.topicId,
            name: topic.name,
            state: topic.state,
            attemptedCount: topic.attemptedCount,
            totalCount: topic.totalCount,
          })),
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/topic-progress: unhandled GetCourseTopicProgressResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

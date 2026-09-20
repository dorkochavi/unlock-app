/**
 * Testable core of `GET /api/courses/:courseId/topics` (Run 005 S4 —
 * "list Topics"). Mirrors `courses/[courseId]/manage/handle-get-course-for-authoring.ts`'s
 * shape exactly.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `READY` -> 200, `{topics: TopicDto[]}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toTopicDto } from "./topic-dto";

import type { ListTopicsForCourseResult } from "@/application/topic/list-topics-for-course";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleListTopicsForCourseDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  listTopics: (command: { actorUserId: string; courseId: string }) => Promise<ListTopicsForCourseResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleListTopicsForCourse(
  deps: HandleListTopicsForCourseDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/topics: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: ListTopicsForCourseResult;
  try {
    result = await deps.listTopics({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topics: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "READY":
      return { status: 200, body: { topics: result.topics.map(toTopicDto) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/topics: unhandled ListTopicsForCourseResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

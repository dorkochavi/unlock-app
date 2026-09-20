/**
 * Testable core of `GET /api/courses/:courseId/manage` (Run 005 S2 —
 * "read editable Course context"). Mirrors
 * `courses/[courseId]/context/handle-get-course-context.ts`'s shape.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`
 *   (same malformed-id hardening as the learner Course View route).
 * - `NOT_AUTHORIZED` (no membership, revoked, archived, or LEARNER role) ->
 *   403, `{error: {code: "NOT_AUTHORIZED"}}` — deliberately NOT 404, since
 *   distinguishing "not authorized" from "doesn't exist" here would leak
 *   nothing sensitive (the caller already knows the id they're managing)
 *   and 403 is the more accurate signal for an authoring surface.
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `READY` -> 200, `{course: CourseAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toCourseAuthoringDto } from "../../authoring-dto";

import type { GetCourseForAuthoringResult } from "@/application/course/get-course-for-authoring";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleGetCourseForAuthoringDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  getCourse: (command: {
    actorUserId: string;
    courseId: string;
  }) => Promise<GetCourseForAuthoringResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetCourseForAuthoring(
  deps: HandleGetCourseForAuthoringDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/manage: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: GetCourseForAuthoringResult;
  try {
    result = await deps.getCourse({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("GET /api/courses/:courseId/manage: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_FOUND":
      return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };

    case "READY":
      return { status: 200, body: { course: toCourseAuthoringDto(result.course) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/manage: unhandled GetCourseForAuthoringResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

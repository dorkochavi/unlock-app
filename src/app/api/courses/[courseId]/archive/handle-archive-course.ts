/**
 * Testable core of `POST /api/courses/:courseId/archive` (Run 005 S2 —
 * DRAFT/PUBLISHED -> ARCHIVED transition). No request body. Mirrors
 * `handle-publish-course.ts` exactly.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `INVALID_TRANSITION` -> 409, `{error: {code: "INVALID_TRANSITION", from}}`.
 * - `ARCHIVED` -> 200, `{course: CourseAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toCourseAuthoringDto } from "../../authoring-dto";

import type { ArchiveCourseResult } from "@/application/course/archive-course";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleArchiveCourseDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  archive: (command: { actorUserId: string; courseId: string }) => Promise<ArchiveCourseResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleArchiveCourse(
  deps: HandleArchiveCourseDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/courses/:courseId/archive: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: ArchiveCourseResult;
  try {
    result = await deps.archive({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("POST /api/courses/:courseId/archive: unexpected error during archive", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_FOUND":
      return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };

    case "INVALID_TRANSITION":
      return { status: 409, body: { error: { code: "INVALID_TRANSITION", from: result.from } } };

    case "ARCHIVED":
      return { status: 200, body: { course: toCourseAuthoringDto(result.course) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/archive: unhandled ArchiveCourseResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

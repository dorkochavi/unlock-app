/**
 * Testable core of `GET /api/courses/:courseId/context` (Run 004 Slice 4 —
 * Learner Course View V1). Unlike the sibling PUBLIC
 * `GET /api/courses/:courseId` (join-page title lookup), this route
 * requires the caller to already have a real `CourseMembership` and fails
 * closed otherwise — see `getCourseContextForLearner`'s own doc comment.
 *
 * A malformed/non-UUID `courseId` is rejected here, before any query
 * reaches Postgres, and mapped to the same `COURSE_NOT_FOUND` outcome as a
 * well-formed-but-nonexistent id — never a generic 500 (Run 004 Slice 5's
 * known gap, closed for this new route from the start rather than
 * introduced and fixed later).
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed courseId or `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_A_MEMBER` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `ACCESS_REVOKED` -> 403, `{error: {code: "ACCESS_REVOKED"}}`.
 * - `READY` -> 200, `{course: {id, title}, membership: {role, joinedAt}}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import type { GetCourseContextForLearnerResult } from "../../../../../application/course/get-course-context-for-learner";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleGetCourseContextDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  getContext: (command: {
    actorUserId: string;
    courseId: string;
  }) => Promise<GetCourseContextForLearnerResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function notFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetCourseContext(
  deps: HandleGetCourseContextDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "GET /api/courses/:courseId/context: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return notFoundResponse();
  }

  let result: GetCourseContextForLearnerResult;
  try {
    result = await deps.getContext({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("GET /api/courses/:courseId/context: unexpected error", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "COURSE_NOT_FOUND":
      return notFoundResponse();

    case "NOT_A_MEMBER":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "ACCESS_REVOKED":
      return { status: 403, body: { error: { code: "ACCESS_REVOKED" } } };

    case "READY":
      return {
        status: 200,
        body: {
          course: { id: result.course.id, title: result.course.title },
          membership: {
            role: result.membership.role,
            joinedAt: result.membership.joinedAt.toISOString(),
          },
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/context: unhandled outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

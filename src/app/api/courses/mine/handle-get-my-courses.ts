/**
 * Testable core of `GET /api/courses/mine` (Run 004 Slice 3 — My Courses
 * V1). Mirrors `daily-plan/today/handle-get-daily-plan-today.ts`'s
 * authenticate-then-invoke split. No request body, no client-supplied
 * `userId` — the only input is the authenticated caller's own identity.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - authenticated -> 200, `{courses: [{id, title, role, isAuthor}]}` (possibly empty;
 *   `role` is `null` for a Course the actor only authors, with no `course_memberships` row).
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import type { MyCourseEntry } from "../../../../application/course/list-my-courses";
import type { RequireAuthenticatedUserResult } from "../../../../infrastructure/supabase/require-authenticated-user";
import { logUnexpectedError } from "@/lib/ops-log";

export interface HandleGetMyCoursesDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  listCourses: (actorUserId: string) => Promise<MyCourseEntry[]>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetMyCourses(
  deps: HandleGetMyCoursesDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    logUnexpectedError("GET /api/courses/mine: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  let courses: MyCourseEntry[];
  try {
    courses = await deps.listCourses(authResult.userId);
  } catch (error) {
    logUnexpectedError("GET /api/courses/mine: unexpected error while listing courses", error);
    return internalErrorResponse();
  }

  return {
    status: 200,
    body: {
      courses: courses.map((entry) => ({
        id: entry.courseId,
        title: entry.title,
        role: entry.role,
        isAuthor: entry.isAuthor,
      })),
    },
  };
}

/**
 * Testable core of `POST /api/courses/:courseId/join` (ADR-015 §4/§5,
 * Night-Run Slice 6). Mirrors `daily-plan/items/.../answer`'s
 * `handle-*`/`route.ts` split exactly. No request body — the only inputs
 * are the authenticated `userId` and the URL path `courseId`.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` (AUTHORIZED_ONLY Course, self-join not allowed,
 *   ADR-015 §5) -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `ALREADY_MEMBER` with a REVOKED existing membership -> 403,
 *   `{error: {code: "ACCESS_REVOKED"}}`. `joinCourse` itself deliberately
 *   does not restore access on a revoked member's rejoin attempt (ADR-015
 *   Addendum, `docs/OPEN_QUESTIONS.md` #43 — fails closed, no rejoin
 *   policy invented) — this is the ROUTE layer's job to surface that as a
 *   real failure rather than a false "you're in" success, since
 *   `joinCourse`'s own `ALREADY_MEMBER` outcome does not distinguish
 *   "already an active member" from "already exists but revoked."
 * - `ALREADY_MEMBER` with an active (non-revoked) existing membership ->
 *   200, `{status: "ALREADY_MEMBER", role}` — idempotent success,
 *   including for a pre-existing `OWNER`/`INSTRUCTOR` membership, which is
 *   NEVER downgraded (`joinCourse`'s `createMembership` call is a race-free
 *   `INSERT ... ON CONFLICT DO NOTHING` that never touches an existing
 *   row's role).
 * - `JOINED` -> 200, `{status: "JOINED", role: "LEARNER"}`.
 * - An unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import type { JoinCourseResult } from "../../../../../application/course/join-course";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleJoinCourseDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  join: (command: { actorUserId: string; courseId: string }) => Promise<JoinCourseResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function unauthenticatedResponse(): RouteJsonResponse {
  return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleJoinCourse(
  deps: HandleJoinCourseDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/courses/:courseId/join: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return unauthenticatedResponse();
  }

  let result: JoinCourseResult;
  try {
    result = await deps.join({ actorUserId: authResult.userId, courseId: deps.courseId });
  } catch (error) {
    console.error("POST /api/courses/:courseId/join: unexpected error during join", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "COURSE_NOT_FOUND":
      return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };

    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "ALREADY_MEMBER":
      if (result.membership.revokedAt !== null) {
        return { status: 403, body: { error: { code: "ACCESS_REVOKED" } } };
      }
      return {
        status: 200,
        body: { status: "ALREADY_MEMBER", role: result.membership.role },
      };

    case "JOINED":
      return { status: 200, body: { status: "JOINED", role: result.membership.role } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/join: unhandled JoinCourseResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

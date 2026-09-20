/**
 * Testable core of `PATCH /api/courses/:courseId/join-policy` (Run 005 S3 —
 * the first live route wiring for `setCourseJoinPolicy`). Deliberately its
 * own route, not folded into `manage` PATCH: `updateCourseMetadata`'s own
 * doc comment already states join policy "has its own dedicated use case
 * ... and is not touched here."
 *
 * ## Authorization — deliberately NOT `canAuthorCourse`
 *
 * This route calls `setCourseJoinPolicy` unchanged, which checks only
 * `revokedAt` (via `isManagementRole`), not `archivedAt` — ADR-015's
 * Addendum pins this exact behavior: "Archived-but-not-revoked management
 * members retain management rights ... `setCourseJoinPolicy` ... already
 * only check[s] `revokedAt`, never `archivedAt`, for this reason." This is
 * an accepted ADR, not a bug to reconcile toward `canAuthorCourse` (Run 005
 * S1/S2's own doc comment on `canAuthorCourse` already says the same:
 * "not a retroactive change to that earlier behavior"). In practice an
 * archived-but-not-revoked actor never reaches this control through the
 * product UI: the `manage` page that hosts it gates entry via
 * `getCourseForAuthoring` (`canAuthorCourse`), so the asymmetry stays
 * dormant on that page. This does NOT restrict a direct API caller — an
 * archived-but-not-revoked OWNER/INSTRUCTOR CAN still call this route
 * successfully, which is the correct, ADR-015-intended outcome, not a gap
 * this route needs to close — see Run 005 checkpoint S3 investigation note.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`
 *   (same malformed-id hardening as every other authoring route).
 * - missing/invalid `joinPolicy` (not `"OPEN"`/`"AUTHORIZED_ONLY"`) -> 400,
 *   `{error: {code: "INVALID_REQUEST"}}` — checked BEFORE `deps.setJoinPolicy`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `UPDATED` -> 200, `{joinPolicy}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";

import { COURSE_JOIN_POLICIES } from "@/domain/course/types";
import type { SetCourseJoinPolicyResult } from "@/application/course/set-course-join-policy";
import type { CourseJoinPolicy } from "@/domain/course/types";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleSetCourseJoinPolicyDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  body: unknown;
  setJoinPolicy: (command: {
    actorUserId: string;
    courseId: string;
    joinPolicy: CourseJoinPolicy;
  }) => Promise<SetCourseJoinPolicyResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

function readJoinPolicy(body: Record<string, unknown>): CourseJoinPolicy | undefined {
  const value = body.joinPolicy;
  return typeof value === "string" &&
    (COURSE_JOIN_POLICIES as readonly string[]).includes(value)
    ? (value as CourseJoinPolicy)
    : undefined;
}

export async function handleSetCourseJoinPolicy(
  deps: HandleSetCourseJoinPolicyDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/join-policy: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  if (deps.body === null || typeof deps.body !== "object") {
    return invalidRequestResponse();
  }
  const body = deps.body as Record<string, unknown>;

  const joinPolicy = readJoinPolicy(body);
  if (joinPolicy === undefined) {
    return invalidRequestResponse();
  }

  let result: SetCourseJoinPolicyResult;
  try {
    result = await deps.setJoinPolicy({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      joinPolicy,
    });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/join-policy: unexpected error during update", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_FOUND":
      return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };

    case "UPDATED":
      return { status: 200, body: { joinPolicy: result.joinPolicy } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "PATCH /api/courses/:courseId/join-policy: unhandled SetCourseJoinPolicyResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

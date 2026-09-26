/**
 * Testable core of `GET /api/courses/:courseId/practice?topicId=&skip=` —
 * Course/Topic Practice batch retrieval (Run UX-02 P3, ADR-020).
 *
 * ## Trust boundary
 *
 * `authenticate` is the ONLY source of `userId`. `courseId` is a path
 * parameter, `topicId` an optional scope query parameter, and `skip` a
 * comma-separated list of Question ids the client has skipped in the current
 * Practice run. `skip` is an UNTRUSTED exclusion hint: it is validated
 * (uuid shape, bounded count) and can only NARROW the pool (the application
 * ignores unknown/foreign ids). No user id, session id or time comes from the
 * request; `now` is captured once at the route boundary.
 *
 * ## HTTP mapping
 *
 * - unauthenticated -> 401 `UNAUTHENTICATED` (before anything else).
 * - malformed `courseId` -> 404 `COURSE_NOT_FOUND` (same as the context route).
 * - malformed `topicId` / `skip` -> 400 `INVALID_REQUEST`.
 * - `NOT_ELIGIBLE` (not a member, wrong role, revoked/archived membership,
 *   non-PUBLISHED Course, unknown Course) -> 403 `PRACTICE_NOT_AVAILABLE`.
 *   One code for all of them: no existence/membership oracle.
 * - `TOPIC_NOT_FOUND` -> 404 `TOPIC_NOT_FOUND`.
 * - `TIMEZONE_NOT_SET` -> 422 `TIMEZONE_NOT_SET` (same as Today).
 * - `READY` -> 200 `{scope, items, hasMore}`; items carry learner-safe
 *   content only (never a correct answer or explanation).
 * - unexpected error -> 500 `INTERNAL_ERROR`, logged server-side only.
 */
import { isUuid } from "../../../../../lib/uuid";
import type { SelectPracticeBatchResult } from "../../../../../application/practice/select-practice-batch";
import type { RequireAuthenticatedUserResult } from "../../../../../infrastructure/supabase/require-authenticated-user";

/** Client-held skipped ids; more than this is a malformed request, not silently truncated. */
export const MAX_SKIP_IDS = 200;

export interface HandleGetPracticeDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  /** Raw query values (`null` when absent). */
  topicIdParam: string | null;
  skipParams: string[];
  now: Date;
  select: (command: {
    userId: string;
    courseId: string;
    topicId: string | null;
    skippedQuestionIds: string[];
    now: Date;
  }) => Promise<SelectPracticeBatchResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

const error = (status: number, code: string): RouteJsonResponse => ({
  status,
  body: { error: { code } },
});

/** Accepts `skip=a,b` and repeated `skip=a&skip=b`; null on any malformed value. */
export function parseSkipIds(skipParams: string[]): string[] | null {
  const ids = skipParams.flatMap((value) => value.split(",")).filter((value) => value !== "");
  if (ids.length > MAX_SKIP_IDS || !ids.every(isUuid)) return null;
  return [...new Set(ids)];
}

export async function handleGetPractice(
  deps: HandleGetPracticeDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (cause) {
    console.error("GET /api/courses/:courseId/practice: unexpected error during authentication", cause);
    return error(500, "INTERNAL_ERROR");
  }
  if (authResult.outcome === "UNAUTHENTICATED") return error(401, "UNAUTHENTICATED");

  if (!isUuid(deps.courseId)) return error(404, "COURSE_NOT_FOUND");
  if (deps.topicIdParam !== null && !isUuid(deps.topicIdParam)) {
    return error(400, "INVALID_REQUEST");
  }
  const skippedQuestionIds = parseSkipIds(deps.skipParams);
  if (skippedQuestionIds === null) return error(400, "INVALID_REQUEST");

  let result: SelectPracticeBatchResult;
  try {
    result = await deps.select({
      userId: authResult.userId,
      courseId: deps.courseId,
      topicId: deps.topicIdParam,
      skippedQuestionIds,
      now: deps.now,
    });
  } catch (cause) {
    console.error("GET /api/courses/:courseId/practice: unexpected error", cause);
    return error(500, "INTERNAL_ERROR");
  }

  switch (result.outcome) {
    case "NOT_ELIGIBLE":
      return error(403, "PRACTICE_NOT_AVAILABLE");
    case "TOPIC_NOT_FOUND":
      return error(404, "TOPIC_NOT_FOUND");
    case "TIMEZONE_NOT_SET":
      return error(422, "TIMEZONE_NOT_SET");
    case "READY":
      return {
        status: 200,
        body: {
          scope: { kind: result.scope.kind, title: result.scope.title },
          items: result.items.map((item) => ({
            questionId: item.questionId,
            questionVersionId: item.questionVersionId,
            questionType: item.questionType,
            prompt: item.prompt,
            answerOptions: item.options.map((option) => ({ id: option.id, content: option.content })),
          })),
          hasMore: result.hasMore,
        },
      };
    default: {
      const exhaustiveCheck: never = result;
      console.error("GET /api/courses/:courseId/practice: unhandled outcome", exhaustiveCheck);
      return error(500, "INTERNAL_ERROR");
    }
  }
}

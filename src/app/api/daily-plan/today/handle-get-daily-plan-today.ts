/**
 * Testable core of `GET /api/daily-plan/today` — pure dependency-injected
 * logic, no Next.js/`next/server` types, no Supabase SDK types, no `pg`
 * types. `route.ts` (the actual Next.js file) is a thin wrapper that
 * constructs these dependencies from real infrastructure and adapts this
 * function's plain `{status, body}` result into a `Response`; every
 * decision worth testing lives here instead.
 *
 * ## `userId` boundary
 *
 * `authenticate` is the ONLY source of `userId` — this function's
 * dependency shape has no `userId`/request/query/header parameter
 * anywhere for one to leak in through. The value passed to
 * `generateDailyPlan` is always exactly `authResult.userId`, nothing else
 * (`docs/API_V1_DRAFT.md` §3).
 *
 * ## `now` boundary
 *
 * `now` is a plain `Date` VALUE supplied by the caller (`route.ts` calls
 * `new Date()` exactly once, at the true HTTP boundary), not a clock
 * function — this function never calls `Date.now()`/`new Date()` itself,
 * so "no hidden clock" is true by construction, not by convention.
 *
 * ## HTTP mapping, the exact choices made here
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`
 *   (per this slice's explicit instruction).
 * - `READY` -> 200, `{plan: <DailyPlanDto>}`.
 * - `TIMEZONE_NOT_SET` -> 422 Unprocessable Entity, `{error: {code:
 *   "TIMEZONE_NOT_SET"}}`. Chosen over 409 Conflict: nothing about this
 *   request actually conflicts with existing resource state (no
 *   competing write, no version mismatch) — the request is well-formed,
 *   but cannot be processed because a precondition on the caller's own
 *   profile (a detected timezone) is not yet met, which is exactly what
 *   422 is for.
 * - `USER_NOT_FOUND` -> 500, `{error: {code:
 *   "USER_PROVISIONING_INCONSISTENT"}}`, NEVER a 404. An authenticated
 *   Supabase user with no matching `public.users` row means the
 *   `auth.users -> public.users` provisioning trigger
 *   (`20260923000000_auth_user_provisioning.sql`) did not do its job —
 *   that is a server-side data-consistency fault, not something the
 *   client did wrong, so it is never presented as an ordinary
 *   client-facing "not found." Logged server-side for operability, never
 *   leaked into the response body.
 * - An unexpected thrown error (from `generateDailyPlan` OR from
 *   `authenticate` itself) -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 *   The error's own message/stack is logged server-side only, never
 *   included in the response — matches `docs/API_V1_DRAFT.md`'s "never
 *   exposed... a real infrastructure fault" framing for the equivalent
 *   `submitAnswer` case, extended here.
 *
 * ## Learner-facing question content
 *
 * On `READY`, this function additionally loads learner-facing question
 * content (prompt/options/type) via `deps.loadLearnerQuestionContent`, by
 * the EXACT persisted `questionVersionId` of every item on the plan — never
 * "the Question's current version." This is a SEPARATE call from
 * `generateDailyPlan`, made only after a plan is already known to exist for
 * this authenticated user, using ids that come only from that already-
 * authorized plan (never a client-supplied id) — there is no code path
 * here through which an arbitrary `questionVersionId` could be requested.
 *
 * Skipped entirely when the plan has no items (nothing to enrich, avoiding
 * a needless round trip). A content-loading failure, or the loaded content
 * being incomplete (missing an entry for some item's `questionVersionId`,
 * which should be unreachable since QuestionVersion rows are immutable and
 * never deleted), both map to the same generic 500 `INTERNAL_ERROR` used
 * elsewhere in this function — never a silent substitution of different
 * content and never a partially-enriched item.
 */
import { toDailyPlanDto } from "./daily-plan-dto";
import type {
  GetOrCreateDailyPlanForTodayResult,
} from "../../../../application/dailyPlan/get-or-create-daily-plan-for-today";
import type { LearnerQuestionContent } from "../../../../application/learning/ports";
import type { RequireAuthenticatedUserResult } from "../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleGetDailyPlanTodayDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  now: Date;
  generateDailyPlan: (command: {
    userId: string;
    now: Date;
  }) => Promise<GetOrCreateDailyPlanForTodayResult>;
  loadLearnerQuestionContent: (
    questionVersionIds: string[],
  ) => Promise<LearnerQuestionContent[]>;
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

export async function handleGetDailyPlanToday(
  deps: HandleGetDailyPlanTodayDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/daily-plan/today: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return unauthenticatedResponse();
  }

  let result: GetOrCreateDailyPlanForTodayResult;
  try {
    result = await deps.generateDailyPlan({ userId: authResult.userId, now: deps.now });
  } catch (error) {
    console.error("GET /api/daily-plan/today: unexpected error during generation", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "READY": {
      const uniqueVersionIds = Array.from(
        new Set(result.plan.items.map((item) => item.questionVersionId)),
      );

      if (uniqueVersionIds.length === 0) {
        return { status: 200, body: { plan: toDailyPlanDto(result.plan, new Map()) } };
      }

      let content: LearnerQuestionContent[];
      try {
        content = await deps.loadLearnerQuestionContent(uniqueVersionIds);
      } catch (error) {
        console.error(
          "GET /api/daily-plan/today: unexpected error loading learner-facing question content",
          error,
        );
        return internalErrorResponse();
      }

      const contentByVersionId = new Map(
        content.map((item) => [item.questionVersionId, item] as const),
      );
      const missingVersionId = uniqueVersionIds.find(
        (versionId) => !contentByVersionId.has(versionId),
      );
      if (missingVersionId !== undefined) {
        console.error(
          `GET /api/daily-plan/today: no learner-facing content found for questionVersionId ` +
            `(${missingVersionId}) referenced by a persisted DailyPlanItem — this should be ` +
            `unreachable since QuestionVersion rows are immutable and never deleted; treated ` +
            `as a server-side data-consistency fault, never silently substituted with another ` +
            `version's content.`,
        );
        return internalErrorResponse();
      }

      return { status: 200, body: { plan: toDailyPlanDto(result.plan, contentByVersionId) } };
    }

    case "TIMEZONE_NOT_SET":
      return { status: 422, body: { error: { code: "TIMEZONE_NOT_SET" } } };

    case "USER_NOT_FOUND":
      console.error(
        `GET /api/daily-plan/today: USER_NOT_FOUND for an authenticated userId ` +
          `(${authResult.userId}) — the auth.users -> public.users provisioning ` +
          `trigger should make this unreachable; this is a server-side ` +
          `data-consistency fault, not a client error.`,
      );
      return {
        status: 500,
        body: { error: { code: "USER_PROVISIONING_INCONSISTENT" } },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/daily-plan/today: unhandled GetOrCreateDailyPlanForTodayResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

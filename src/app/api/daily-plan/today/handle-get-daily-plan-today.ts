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
 */
import { toDailyPlanDto } from "./daily-plan-dto";
import type {
  GetOrCreateDailyPlanForTodayResult,
} from "../../../../application/dailyPlan/get-or-create-daily-plan-for-today";
import type { RequireAuthenticatedUserResult } from "../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleGetDailyPlanTodayDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  now: Date;
  generateDailyPlan: (command: {
    userId: string;
    now: Date;
  }) => Promise<GetOrCreateDailyPlanForTodayResult>;
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
    case "READY":
      return { status: 200, body: { plan: toDailyPlanDto(result.plan) } };

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

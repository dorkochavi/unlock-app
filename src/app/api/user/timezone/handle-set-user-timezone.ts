/**
 * Testable core of `POST /api/user/timezone` — mirrors
 * `daily-plan/today/handle-get-daily-plan-today.ts`'s shape exactly: pure
 * dependency-injected logic, no Next.js/Supabase/`pg` types. `route.ts` is
 * a thin wrapper that constructs these dependencies from real
 * infrastructure and adapts this function's plain `{status, body}` result
 * into a `Response`.
 *
 * ## `userId` boundary
 *
 * `authenticate` is the ONLY source of `userId` — exactly
 * `handleGetDailyPlanToday`'s own established convention. The value passed
 * to `persistTimezone` is always exactly `authResult.userId`.
 *
 * ## `persistTimezone` is a lazy closure, not a `UserRepository` port
 *
 * Mirrors `handleGetDailyPlanToday`'s `generateDailyPlan` closure
 * convention exactly, for the same reason: `route.ts` constructs
 * `getPool()`/`PostgresUserRepository` INSIDE this closure, so Postgres
 * runtime construction is structurally unreachable until AFTER
 * authentication (and body validation) succeed — an unauthenticated or
 * malformed request never requires `DATABASE_URL`.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - request body's `timezone` is not a string -> 400, `{error: {code:
 *   "INVALID_TIMEZONE"}}`, checked BEFORE `persistTimezone` is ever
 *   called (validation before persistence).
 * - `UPDATED` -> 200, `{timezone: string}`.
 * - `INVALID_TIMEZONE` (a string that fails `isValidIanaTimezone`) -> 400,
 *   same code as the missing/non-string case above — the client-facing
 *   contract does not distinguish "missing" from "not a real IANA zone".
 * - `USER_NOT_FOUND` -> 500, `{error: {code:
 *   "USER_PROVISIONING_INCONSISTENT"}}`, NEVER a 404 — same reasoning as
 *   `handleGetDailyPlanToday`'s own `USER_NOT_FOUND` mapping: an
 *   authenticated Supabase user with no matching `public.users` row is a
 *   server-side provisioning fault, not a client error.
 * - An unexpected thrown error (from `authenticate` or `persistTimezone`)
 *   -> 500, `{error: {code: "INTERNAL_ERROR"}}`. Logged server-side only.
 */
import type {
  SetUserTimezoneCommand,
  SetUserTimezoneResult,
} from "../../../../application/user/set-user-timezone";
import type { RequireAuthenticatedUserResult } from "../../../../infrastructure/supabase/require-authenticated-user";

export interface HandleSetUserTimezoneDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  /** Raw client-supplied request body value — validated here, never trusted as-is. */
  timezone: unknown;
  persistTimezone: (command: SetUserTimezoneCommand) => Promise<SetUserTimezoneResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function unauthenticatedResponse(): RouteJsonResponse {
  return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
}

function invalidTimezoneResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_TIMEZONE" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleSetUserTimezone(
  deps: HandleSetUserTimezoneDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/user/timezone: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return unauthenticatedResponse();
  }

  if (typeof deps.timezone !== "string") {
    return invalidTimezoneResponse();
  }

  let result: SetUserTimezoneResult;
  try {
    result = await deps.persistTimezone({
      actorUserId: authResult.userId,
      timezone: deps.timezone,
    });
  } catch (error) {
    console.error("POST /api/user/timezone: unexpected error during persistence", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "UPDATED":
      return { status: 200, body: { timezone: result.timezone } };

    case "INVALID_TIMEZONE":
      return invalidTimezoneResponse();

    case "USER_NOT_FOUND":
      console.error(
        `POST /api/user/timezone: USER_NOT_FOUND for an authenticated userId ` +
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
        "POST /api/user/timezone: unhandled SetUserTimezoneResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

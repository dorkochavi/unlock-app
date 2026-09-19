/**
 * requireAuthenticatedUser — the ONLY source of a trusted `userId` at the
 * server boundary (`docs/API_V1_DRAFT.md` §3: "`userId` never travels
 * from client to server as data"). Never accepts `userId` from a query
 * param, request body, header, or manually-parsed cookie — the
 * authenticated Supabase user's own `id`, verified server-side, is the
 * only value this function ever returns as `userId`.
 *
 * Takes an already-constructed, request-scoped Supabase client as a
 * parameter (built via `createSupabaseServerClient()`) rather than
 * constructing one itself — matches this codebase's established explicit-
 * dependencies convention (every application function takes its ports as
 * parameters, never reaches for a global/service locator) and makes this
 * function trivially unit-testable against a fake client.
 *
 * Uses `supabase.auth.getUser()`, NEVER `getSession()`, for the
 * authorization decision. This is a security-critical distinction, not a
 * style preference: `getSession()` only reads the session cookie's
 * payload without re-verifying it, while `getUser()` makes a real
 * round-trip to Supabase's own Auth server and cryptographically
 * re-verifies the JWT. Using `getSession()` alone to authorize a request
 * would trust a value the caller could otherwise have tampered with.
 *
 * Error handling, the exact choice made here: `getUser()` returning a
 * populated `error` (e.g. an expired/invalid/missing token) is an
 * EXPECTED, typed outcome — mapped to `UNAUTHENTICATED`, never thrown —
 * matching this codebase's established "typed result for expected
 * non-happy states, never an exception" convention
 * (`GetUserTimezoneResult`, `GetOrCreateDailyPlanForTodayResult`,
 * `SubmitAnswerResult`, ...). If `supabase.auth.getUser()` itself THROWS
 * (a genuinely unexpected SDK/runtime failure, not a normal auth-failure
 * signal), that throw is NOT caught here and propagates to the caller
 * unchanged — matching `docs/ARCHITECTURE.md` §21's "never swallow an
 * error" discipline, applied identically everywhere else in this
 * codebase (e.g. `submitAnswer`'s own "any other error is unexpected —
 * re-thrown, never swallowed").
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type RequireAuthenticatedUserResult =
  | { outcome: "AUTHENTICATED"; userId: string }
  | { outcome: "UNAUTHENTICATED" };

export async function requireAuthenticatedUser(
  supabase: SupabaseClient,
): Promise<RequireAuthenticatedUserResult> {
  const { data, error } = await supabase.auth.getUser();

  if (error || data.user === null) {
    return { outcome: "UNAUTHENTICATED" };
  }

  return { outcome: "AUTHENTICATED", userId: data.user.id };
}

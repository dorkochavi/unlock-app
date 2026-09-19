/**
 * GET /api/daily-plan/today — the first real HTTP entry point into the
 * production DailyPlan path. Deliberately thin: every decision worth
 * testing lives in `handle-get-daily-plan-today.ts`
 * (`handleGetDailyPlanToday`), which has no Next.js/Supabase/`pg` types in
 * its own signature and is exercised entirely by unit tests, no real
 * network/DB connection. This file's only job is wiring real
 * infrastructure into that function and adapting its plain
 * `{status, body}` result into a `Response`.
 *
 * Explicit Node runtime: `pg` depends on Node's native `net`/`tls`
 * modules and has no Edge-runtime build.
 *
 * Accepts NO query params, request body, or custom headers — the only
 * input this route reads at all is the incoming Supabase session cookie,
 * via `createSupabaseServerClient()` -> `requireAuthenticatedUser()`. There
 * is structurally no code path here through which a client-supplied
 * `userId` could reach `getOrCreateDailyPlanForToday`
 * (`docs/API_V1_DRAFT.md` §3).
 *
 * `now = new Date()` is called exactly once, right here — never inside
 * `handleGetDailyPlanToday`, `getOrCreateDailyPlanForToday`, or anything
 * deeper.
 *
 * ## Auth before database, stated explicitly (fixes a real ordering bug
 * found in review)
 *
 * `getPool()`/`PgConnectionProvider`/the production ports/settings are
 * built LAZILY, INSIDE the `generateDailyPlan` closure below — not
 * eagerly before it. `handleGetDailyPlanToday`'s own control flow already
 * calls `authenticate()` first and returns immediately on
 * `UNAUTHENTICATED`, before ever invoking `generateDailyPlan` — so this
 * closure body, and therefore `getPool()`/`DATABASE_URL`, is now
 * structurally UNREACHABLE for an unauthenticated request. This required
 * no change to `handle-get-daily-plan-today.ts` at all: that file's
 * control flow was already correct; the bug was that THIS file
 * previously constructed Postgres infrastructure before calling it,
 * defeating that ordering. `getPool()` itself remains the existing lazy,
 * memoized, per-process singleton — calling it here (now only for an
 * authenticated request) does NOT construct a new `pg.Pool` per request;
 * it returns the same one every time.
 *
 * ## Route-level error handling
 *
 * ONE outer try/catch wraps this whole function, mapping to the same
 * `{error: {code: "INTERNAL_ERROR"}}` / 500 contract
 * `handleGetDailyPlanToday` already uses internally. No double-logging:
 * `handleGetDailyPlanToday` never throws — it catches its own internal
 * failures (`authenticate()`/`generateDailyPlan()` throwing) and already
 * logs + returns a clean `{status, body}` result for those, so this outer
 * catch only ever fires for a genuinely route-level failure that occurs
 * BEFORE `handleGetDailyPlanToday` is even called (e.g.
 * `createSupabaseServerClient()` throwing on missing Supabase env vars) —
 * the two boundaries do not overlap in what they actually catch.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getOrCreateDailyPlanForToday } from "@/application/dailyPlan/get-or-create-daily-plan-for-today";
import {
  createProductionDailyPlanGenerationSettings,
  createProductionDailyPlanPorts,
} from "@/infrastructure/dailyPlan/composition-root";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresLearnerQuestionContentRepository } from "@/infrastructure/postgres/learner-question-content-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleGetDailyPlanToday } from "./handle-get-daily-plan-today";

export async function GET(): Promise<Response> {
  const now = new Date();

  try {
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetDailyPlanToday({
      authenticate: () => requireAuthenticatedUser(supabase),
      now,
      generateDailyPlan: async (command) => {
        // Reached ONLY for an already-authenticated request — see this
        // file's own module doc comment.
        const pool = getPool();
        const connectionProvider = new PgConnectionProvider(pool);
        const ports = createProductionDailyPlanPorts(pool, connectionProvider);
        const settings = createProductionDailyPlanGenerationSettings();
        return getOrCreateDailyPlanForToday(command, settings, ports);
      },
      loadLearnerQuestionContent: async (questionVersionIds) => {
        // Reached ONLY when handleGetDailyPlanToday has a READY plan with
        // at least one item — i.e. only for an already-authenticated
        // request, same as generateDailyPlan above.
        const pool = getPool();
        const repository = new PostgresLearnerQuestionContentRepository(pool);
        return repository.findManyByVersionIds(questionVersionIds);
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/daily-plan/today: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

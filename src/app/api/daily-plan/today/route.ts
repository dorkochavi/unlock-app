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
 * `getPool()` is the existing lazy, memoized, per-process singleton
 * (`src/infrastructure/postgres/pg-pool.ts`) — calling it here does NOT
 * construct a new `pg.Pool` per request; it returns the same one every
 * time. `PgConnectionProvider`/the production ports/settings bundles are
 * cheap, stateless wrappers with no resources of their own, so
 * constructing them fresh per request is harmless and avoids any
 * module-level state beyond the Pool singleton itself.
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
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleGetDailyPlanToday } from "./handle-get-daily-plan-today";

export async function GET(): Promise<Response> {
  const now = new Date();

  const supabase = await createSupabaseServerClient();

  const pool = getPool();
  const connectionProvider = new PgConnectionProvider(pool);
  const ports = createProductionDailyPlanPorts(pool, connectionProvider);
  const settings = createProductionDailyPlanGenerationSettings();

  const { status, body } = await handleGetDailyPlanToday({
    authenticate: () => requireAuthenticatedUser(supabase),
    now,
    generateDailyPlan: (command) => getOrCreateDailyPlanForToday(command, settings, ports),
  });

  return NextResponse.json(body, { status });
}

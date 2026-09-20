/**
 * POST /api/daily-plan/items/:itemId/skip — the real server-side Skip path
 * (ADR-016, Night-Run Slice 3). Deliberately thin, mirrors
 * `answer/route.ts` exactly. No request body is read at all — Skip has no
 * learner-controlled data.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/`PostgresDailyPlanRepository` are constructed LAZILY, inside
 * the `skip` closure below. `handleSkipDailyPlanItem`'s own control flow
 * calls `authenticate()` first and returns immediately on
 * `UNAUTHENTICATED` — so this closure body, and therefore
 * `getPool()`/`DATABASE_URL`, is structurally unreachable for an
 * unauthenticated request.
 *
 * No `PostgresUnitOfWork`/transaction here at all: `skipDailyPlanItem`
 * needs none (see its own module doc comment) — `PostgresDailyPlanRepository`
 * is constructed directly against the plain pool, the same "plain read/
 * write, no transaction" convention already used for the answer route's own
 * pre-fetch.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { skipDailyPlanItem } from "@/application/dailyPlan/skip-daily-plan-item";
import { PostgresDailyPlanRepository } from "@/infrastructure/postgres/daily-plan-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleSkipDailyPlanItem } from "./handle-skip-daily-plan-item";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ itemId: string }> },
): Promise<Response> {
  const now = new Date();

  try {
    const { itemId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleSkipDailyPlanItem({
      authenticate: () => requireAuthenticatedUser(supabase),
      itemId,
      now,
      skip: (command) => {
        // Reached ONLY for an already-authenticated request — see this
        // file's own module doc comment.
        const pool = getPool();
        return skipDailyPlanItem(command, {
          dailyPlanItems: new PostgresDailyPlanRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/skip: unexpected route-level error",
      error,
    );
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

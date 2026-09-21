/**
 * POST /api/daily-plan/items/:itemId/answer — the real server-side path for
 * "a learner answers one question from Today" (ADR-016, Night-Run Slice 1).
 * Deliberately thin: every decision worth testing lives in
 * `handle-submit-daily-plan-item-answer.ts`, exercised entirely by unit
 * tests, no real network/DB connection. This file's only job is wiring real
 * infrastructure into that function and adapting its plain `{status, body}`
 * result into a `Response` — mirrors `daily-plan/today/route.ts` and
 * `user/timezone/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * `itemId` comes from the URL path segment — never trusted as "this item
 * belongs to the caller" by itself; ownership is verified server-side
 * inside `submitDailyPlanItemAnswer`/`submitAnswer`.
 *
 * ## Auth before database
 *
 * `getPool()`/`PostgresDailyPlanRepository`/`PostgresUnitOfWork` are
 * constructed LAZILY, inside the `submit` closure below — not eagerly
 * before it. `handleSubmitDailyPlanItemAnswer`'s own control flow calls
 * `authenticate()` first and returns immediately on `UNAUTHENTICATED`, and
 * validates the request body BEFORE ever invoking `submit` — so this
 * closure body, and therefore `getPool()`/`DATABASE_URL`, is structurally
 * unreachable for an unauthenticated or malformed request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { submitDailyPlanItemAnswer } from "@/application/dailyPlan/submit-daily-plan-item-answer";
import { createProductionSubmitAnswerContext } from "@/infrastructure/learning/composition-root";
import { PostgresDailyPlanRepository } from "@/infrastructure/postgres/daily-plan-repository";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresUnitOfWork } from "@/infrastructure/postgres/postgres-unit-of-work";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

import { handleSubmitDailyPlanItemAnswer } from "./handle-submit-daily-plan-item-answer";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> },
): Promise<Response> {
  const now = new Date();

  try {
    const { itemId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth before body parsing (Run 008 S1.E).
    let authResult: RequireAuthenticatedUserResult;
    try {
      authResult = await requireAuthenticatedUser(supabase);
    } catch (error) {
      console.error(
        "POST /api/daily-plan/items/:itemId/answer: unexpected error during authentication",
        error,
      );
      return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
    if (authResult.outcome === "UNAUTHENTICATED") {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      // Malformed/absent JSON body — handleSubmitDailyPlanItemAnswer already
      // maps a non-object body to a stable 400.
      body = null;
    }

    const { status, body: responseBody } = await handleSubmitDailyPlanItemAnswer({
      authenticate: async () => authResult,
      itemId,
      body,
      now,
      submit: (command) => {
        // Reached ONLY for an already-authenticated, well-formed request —
        // see this file's own module doc comment.
        const pool = getPool();
        const connectionProvider = new PgConnectionProvider(pool);
        return submitDailyPlanItemAnswer(
          {
            ...command,
            // Not yet exposed by any UI feature in this slice — see this
            // file's own module doc comment.
            assistanceUsed: "NONE",
            answerWasRevealedBeforeResponse: false,
          },
          {
            // Plain (non-transactional) read, same convention as
            // `PostgresUserRepository`/`PostgresLearnerQuestionContentRepository`
            // — `pool` satisfies `SqlExecutor` structurally.
            items: new PostgresDailyPlanRepository(pool),
            context: createProductionSubmitAnswerContext(now),
            uow: new PostgresUnitOfWork(connectionProvider),
          },
        );
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error(
      "POST /api/daily-plan/items/:itemId/answer: unexpected route-level error",
      error,
    );
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

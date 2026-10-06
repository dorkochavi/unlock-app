/**
 * POST /api/courses/:courseId/practice/answer — answer one Practice Question
 * (Run UX-02 P3). Thin wrapper: every decision lives in
 * `handle-submit-practice-answer.ts`.
 *
 * ## Auth before body parsing and before the database
 *
 * Authentication runs FIRST (Run 008 S1.E convention); the body is parsed
 * only for an authenticated caller, and `getPool()`/production ports are
 * built lazily inside the `submit` closure, reached only for a well-formed
 * request. `now` (the Attempt's `answeredAt`) is captured once here — never
 * client-supplied.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { submitPracticeAnswer } from "@/application/practice/submit-practice-answer";
import { createProductionSubmitAnswerContext } from "@/infrastructure/learning/composition-root";
import {
  createProductionPracticePorts,
  createProductionPracticeSettings,
} from "@/infrastructure/practice/composition-root";
import { PostgresAnswerFeedbackContentRepository } from "@/infrastructure/postgres/answer-feedback-content-repository";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

import { handleSubmitPracticeAnswer } from "./handle-submit-practice-answer";
import { logUnexpectedError } from "@/lib/ops-log";
import { timeStage, withServerTiming } from "@/lib/server-timing";

export function POST(...args: Parameters<typeof postImpl>): Promise<Response> {
  return withServerTiming(() => postImpl(...args));
}

async function postImpl(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const now = new Date();

  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    let authResult: RequireAuthenticatedUserResult;
    try {
      authResult = await timeStage("auth", () => requireAuthenticatedUser(supabase));
    } catch (error) {
      logUnexpectedError("POST /api/courses/:courseId/practice/answer: error during authentication", error);
      return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
    if (authResult.outcome === "UNAUTHENTICATED") {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null; // the handler maps a non-object body to a stable 400
    }

    const { status, body: responseBody } = await handleSubmitPracticeAnswer({
      authenticate: async () => authResult,
      courseId,
      body,
      now,
      submit: (command) => {
        // Reached ONLY for an authenticated, well-formed request.
        const pool = getPool();
        const ports = createProductionPracticePorts(pool, new PgConnectionProvider(pool));
        return timeStage("uc", () => submitPracticeAnswer(
          command,
          createProductionPracticeSettings(),
          createProductionSubmitAnswerContext(now),
          ports,
        ));
      },
      getFeedbackContent: (questionVersionId) => {
        const pool = getPool();
        return timeStage("content", () =>
          new PostgresAnswerFeedbackContentRepository(pool).findByVersionId(questionVersionId),
        );
      },
    });

    return NextResponse.json(responseBody, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logUnexpectedError("POST /api/courses/:courseId/practice/answer: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

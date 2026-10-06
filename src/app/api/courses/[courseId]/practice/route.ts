/**
 * GET /api/courses/:courseId/practice — Course/Topic Practice batch (Run
 * UX-02 P3). Thin wrapper: every decision lives in `handle-get-practice.ts`.
 *
 * ## Auth before database
 *
 * Authentication runs first; `getPool()` and the production ports are built
 * LAZILY inside the `select` closure, which `handleGetPractice` reaches only
 * for an authenticated request with well-formed input. `now` is captured
 * once here, never inside the handler or application layer.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { selectPracticeBatch } from "@/application/practice/select-practice-batch";
import {
  createProductionPracticePorts,
  createProductionPracticeSettings,
} from "@/infrastructure/practice/composition-root";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleGetPractice } from "./handle-get-practice";
import { logUnexpectedError } from "@/lib/ops-log";
import { timeStage, withServerTiming } from "@/lib/server-timing";

export function GET(...args: Parameters<typeof getImpl>): Promise<Response> {
  return withServerTiming(() => getImpl(...args));
}

async function getImpl(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const now = new Date();

  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();
    const searchParams = new URL(request.url).searchParams;

    const { status, body } = await handleGetPractice({
      authenticate: () => timeStage("auth", () => requireAuthenticatedUser(supabase)),
      courseId,
      topicIdParam: searchParams.get("topicId"),
      skipParams: searchParams.getAll("skip"),
      now,
      select: (command) => {
        // Reached ONLY for an authenticated, well-formed request.
        const pool = getPool();
        const ports = createProductionPracticePorts(pool, new PgConnectionProvider(pool));
        return timeStage("uc", () => selectPracticeBatch(command, createProductionPracticeSettings(), ports));
      },
    });

    return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logUnexpectedError("GET /api/courses/:courseId/practice: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

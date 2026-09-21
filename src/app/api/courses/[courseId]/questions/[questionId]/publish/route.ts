/**
 * POST /api/courses/:courseId/questions/:questionId/publish — Run 006 S5
 * atomic immutable publish/re-publish. Deliberately thin, mirrors
 * `courses/[courseId]/publish/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/`PostgresQuestionUnitOfWork` construction is LAZY, inside the
 * `publish` closure below — `handlePublishQuestion`'s own control flow calls
 * `authenticate()` first and returns immediately on `UNAUTHENTICATED`, so
 * this closure body, and therefore `getPool()`/`DATABASE_URL`, is
 * structurally unreachable for an unauthenticated request.
 *
 * `publishQuestion`'s insert-new-version + repoint-current-version-and-
 * clear-draft writes run inside one transaction via
 * `PostgresQuestionUnitOfWork`/`PgConnectionProvider` — see
 * `publish-question.ts`'s own doc comment.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handlePublishQuestion } from "./handle-publish-question";

import { publishQuestion } from "@/application/question/publish-question";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresQuestionUnitOfWork } from "@/infrastructure/postgres/postgres-question-unit-of-work";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; questionId: string }> },
): Promise<Response> {
  try {
    const { courseId, questionId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handlePublishQuestion({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      questionId,
      publish: (command) => {
        const pool = getPool();
        const uow = new PostgresQuestionUnitOfWork(new PgConnectionProvider(pool));
        return publishQuestion(command, uow);
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/questions/:questionId/publish: unexpected route-level error",
      error,
    );
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

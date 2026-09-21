/**
 * POST /api/courses/:courseId/import/confirm — Run 007 S4. Deliberately
 * thin, mirrors `../preview/route.ts` and
 * `courses/[courseId]/questions/[questionId]/publish/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository/UnitOfWork construction is LAZY, inside the
 * closure below. `handleConfirmImport` calls `authenticate()` first and
 * returns immediately on `UNAUTHENTICATED` — so the closure body, and
 * therefore `getPool()`/`DATABASE_URL`, is not structurally reachable for
 * an unauthenticated request.
 *
 * ## Auth before body parsing (Run 008 S1.E)
 *
 * This route additionally authenticates BEFORE calling `request.json()` —
 * an unauthenticated request never pays for parsing a (potentially large,
 * up to `MAX_IMPORT_SOURCE_LENGTH`) body it can never use. Note this still
 * does not add transport-level request-size protection: the body is still
 * received off the wire before this check runs, only the userland JSON
 * parse work is skipped.
 *
 * `confirmImport`'s re-check + per-row write phase runs inside one
 * transaction via `PostgresImportUnitOfWork`/`PgConnectionProvider` — see
 * `confirm-import.ts`'s own doc comment for the full two-phase design.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleConfirmImport } from "./handle-confirm-import";

import { confirmImport } from "@/application/import/confirm-import";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { PgConnectionProvider } from "@/infrastructure/postgres/pg-connection-provider";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresImportUnitOfWork } from "@/infrastructure/postgres/postgres-import-unit-of-work";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    let authResult: RequireAuthenticatedUserResult;
    try {
      authResult = await requireAuthenticatedUser(supabase);
    } catch (error) {
      console.error(
        "POST /api/courses/:courseId/import/confirm: unexpected error during authentication",
        error,
      );
      return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
    if (authResult.outcome === "UNAUTHENTICATED") {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleConfirmImport({
      authenticate: async () => authResult,
      courseId,
      body,
      confirm: (command) => {
        const pool = getPool();
        return confirmImport(command, {
          previewRepos: {
            memberships: new PostgresCourseMembershipRepository(pool),
            courses: new PostgresCourseRepository(pool),
            topics: new PostgresTopicRepository(pool),
          },
          uow: new PostgresImportUnitOfWork(new PgConnectionProvider(pool)),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/import/confirm: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

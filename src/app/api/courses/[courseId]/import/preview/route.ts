/**
 * POST /api/courses/:courseId/import/preview — Run 007 S3. Deliberately
 * thin, mirrors `courses/[courseId]/questions/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the closure below.
 * `handlePreviewImport` calls `authenticate()` first and returns immediately
 * on `UNAUTHENTICATED` — so the closure body, and therefore
 * `getPool()`/`DATABASE_URL`, is not structurally reachable for an
 * unauthenticated request.
 *
 * Stateless: `previewImport` (Run 007 S2) never writes.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handlePreviewImport } from "./handle-preview-import";

import { previewImport } from "@/application/import/preview-import";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    let body: unknown = null;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handlePreviewImport({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      body,
      preview: (command) => {
        const pool = getPool();
        return previewImport(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
          topics: new PostgresTopicRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/import/preview: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

/**
 * POST /api/courses/:courseId/publish — Run 005 S2 DRAFT -> PUBLISHED
 * transition. Deliberately thin, mirrors `courses/[courseId]/join/route.ts`
 * exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction are LAZY, inside the `publish`
 * closure below — unreachable for an unauthenticated request, since
 * `handlePublishCourse` returns immediately on `UNAUTHENTICATED`.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handlePublishCourse } from "./handle-publish-course";

import { publishCourse } from "@/application/course/publish-course";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handlePublishCourse({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      publish: (command) => {
        const pool = getPool();
        return publishCourse(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/publish: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

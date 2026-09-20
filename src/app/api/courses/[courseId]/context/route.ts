/**
 * GET /api/courses/:courseId/context — Learner Course View V1 (Run 004
 * Slice 4). Deliberately thin, mirrors `courses/:courseId/join/route.ts`:
 * authentication runs first, and `getPool()`/repository construction is
 * lazy inside the `getContext` closure, so it is structurally unreachable
 * for an unauthenticated request.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { getCourseContextForLearner } from "@/application/course/get-course-context-for-learner";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleGetCourseContext } from "./handle-get-course-context";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetCourseContext({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      getContext: (command) => {
        // Reached ONLY for an already-authenticated request with a
        // well-formed courseId — see this file's own module doc comment.
        const pool = getPool();
        return getCourseContextForLearner(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId/context: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

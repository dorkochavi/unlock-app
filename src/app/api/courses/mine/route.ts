/**
 * GET /api/courses/mine — My Courses V1 (Run 004 Slice 3). Deliberately
 * thin, mirrors `daily-plan/today/route.ts` exactly: authentication runs
 * first, and `getPool()`/repository construction is lazy inside the
 * `listCourses` closure, so it is structurally unreachable for an
 * unauthenticated request.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { listMyCourses } from "@/application/course/list-my-courses";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleGetMyCourses } from "./handle-get-my-courses";

export async function GET(): Promise<Response> {
  try {
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetMyCourses({
      authenticate: () => requireAuthenticatedUser(supabase),
      listCourses: (actorUserId) => {
        // Reached ONLY for an already-authenticated request — see this
        // file's own module doc comment.
        const pool = getPool();
        return listMyCourses(
          { actorUserId },
          {
            memberships: new PostgresCourseMembershipRepository(pool),
            courses: new PostgresCourseRepository(pool),
          },
        );
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/mine: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

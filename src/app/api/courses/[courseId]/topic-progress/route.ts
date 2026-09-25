/**
 * GET /api/courses/:courseId/topic-progress — Run 009 S1 learner Topic
 * Progress. Deliberately thin, mirrors `item-analysis/route.ts`.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the closure below;
 * `handleGetCourseTopicProgress` authenticates first and returns on
 * `UNAUTHENTICATED`, so `getPool()`/`DATABASE_URL` is structurally
 * unreachable for an unauthenticated request. The learner identity comes
 * only from the authenticated session, never from the request.
 *
 * `Cache-Control: no-store` — per-learner derived state.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleGetCourseTopicProgress } from "./handle-get-course-topic-progress";

import { getCourseTopicProgress } from "@/application/progress/get-course-topic-progress";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresLearnerTopicProgressRepository } from "@/infrastructure/postgres/topic-progress-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetCourseTopicProgress({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      getTopicProgress: (command) => {
        const pool = getPool();
        return getCourseTopicProgress(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
          topicProgress: new PostgresLearnerTopicProgressRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-progress: unexpected route-level error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR" } },
      { status: 500, headers: NO_STORE },
    );
  }
}

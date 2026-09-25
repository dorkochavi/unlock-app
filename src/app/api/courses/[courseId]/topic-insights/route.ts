/**
 * GET /api/courses/:courseId/topic-insights — Run 009 S3 instructor Topic
 * Insights. Deliberately thin, mirrors `item-analysis/route.ts`.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the closure below.
 * `handleGetCourseTopicInsights` calls `authenticate()` first and returns
 * immediately on `UNAUTHENTICATED`, so `getPool()`/`DATABASE_URL` is
 * structurally unreachable for an unauthenticated request.
 *
 * `Cache-Control: no-store` — learner-derived aggregate data must never be
 * served from a shared/browser cache; manual refresh must always re-read.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleGetCourseTopicInsights } from "./handle-get-course-topic-insights";

import { getCourseTopicInsights } from "@/application/insights/get-course-topic-insights";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { PostgresItemAnalysisRepository } from "@/infrastructure/postgres/item-analysis-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
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

    const { status, body } = await handleGetCourseTopicInsights({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      now: () => new Date(),
      getTopicInsights: (command) => {
        const pool = getPool();
        return getCourseTopicInsights(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
          itemAnalysis: new PostgresItemAnalysisRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status, headers: NO_STORE });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-insights: unexpected route-level error", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR" } },
      { status: 500, headers: NO_STORE },
    );
  }
}

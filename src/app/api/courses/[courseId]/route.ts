/**
 * GET /api/courses/:courseId — a deliberately PUBLIC, unauthenticated
 * course-title lookup (Night-Run Slice 6). See
 * `handle-get-course-summary.ts`'s own doc comment for why no auth
 * boundary applies to this specific route.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";

import { handleGetCourseSummary } from "./handle-get-course-summary";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;

    const { status, body } = await handleGetCourseSummary({
      courseId,
      getSummary: (id) => {
        const pool = getPool();
        return new PostgresCourseRepository(pool).getCourseSummary(id);
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

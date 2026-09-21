/**
 * GET/PATCH /api/courses/:courseId/manage — Run 005 S2 authoring context
 * read + metadata update. Deliberately thin, mirrors
 * `courses/[courseId]/context/route.ts` and
 * `daily-plan/items/.../answer/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction are LAZY, inside each closure below.
 * Both `handleGetCourseForAuthoring` and `handleUpdateCourseMetadata` call
 * `authenticate()` first and return immediately on `UNAUTHENTICATED` — so
 * neither closure body, and therefore `getPool()`/`DATABASE_URL`, is
 * structurally reachable for an unauthenticated request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleGetCourseForAuthoring } from "./handle-get-course-for-authoring";
import { handleUpdateCourseMetadata } from "./handle-update-course-metadata";

import { getCourseForAuthoring } from "@/application/course/get-course-for-authoring";
import { updateCourseMetadata } from "@/application/course/update-course-metadata";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetCourseForAuthoring({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      getCourse: (command) => {
        const pool = getPool();
        return getCourseForAuthoring(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId/manage: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth before body parsing (Run 008 S1.E).
    let authResult: RequireAuthenticatedUserResult;
    try {
      authResult = await requireAuthenticatedUser(supabase);
    } catch (error) {
      console.error(
        "PATCH /api/courses/:courseId/manage: unexpected error during authentication",
        error,
      );
      return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
    }
    if (authResult.outcome === "UNAUTHENTICATED") {
      return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleUpdateCourseMetadata({
      authenticate: async () => authResult,
      courseId,
      body,
      update: (command) => {
        const pool = getPool();
        return updateCourseMetadata(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/manage: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

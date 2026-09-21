/**
 * PATCH /api/courses/:courseId/join-policy — Run 005 S3, the first live
 * route wiring for `setCourseJoinPolicy` (ADR-015 §3). Deliberately thin,
 * mirrors `courses/[courseId]/manage/route.ts`'s PATCH handler exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the `setJoinPolicy`
 * closure below. `handleSetCourseJoinPolicy` calls `authenticate()` first
 * and returns immediately on `UNAUTHENTICATED` — so this closure body, and
 * therefore `getPool()`/`DATABASE_URL`, is structurally unreachable for an
 * unauthenticated request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleSetCourseJoinPolicy } from "./handle-set-course-join-policy";

import { setCourseJoinPolicy } from "@/application/course/set-course-join-policy";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

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
        "PATCH /api/courses/:courseId/join-policy: unexpected error during authentication",
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

    const { status, body: responseBody } = await handleSetCourseJoinPolicy({
      authenticate: async () => authResult,
      courseId,
      body,
      setJoinPolicy: (command) => {
        const pool = getPool();
        return setCourseJoinPolicy(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/join-policy: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

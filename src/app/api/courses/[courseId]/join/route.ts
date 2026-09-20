/**
 * POST /api/courses/:courseId/join — the real server-side Open-Course join
 * path (ADR-015 §4, Night-Run Slice 6). Deliberately thin, mirrors
 * `daily-plan/items/[itemId]/answer/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction are LAZY, inside the `join` closure
 * below. `handleJoinCourse`'s own control flow calls `authenticate()` first
 * and returns immediately on `UNAUTHENTICATED` — so this closure body, and
 * therefore `getPool()`/`DATABASE_URL`, is structurally unreachable for an
 * unauthenticated request.
 *
 * No `UnitOfWork`/transaction here: `joinCourse` needs none (its own
 * `ports.ts` doc comment — race-free by a single `INSERT ... ON CONFLICT
 * DO NOTHING`).
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { joinCourse } from "@/application/course/join-course";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { PostgresCourseRepository } from "@/infrastructure/postgres/course-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import { handleJoinCourse } from "./handle-join-course";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleJoinCourse({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      join: (command) => {
        // Reached ONLY for an already-authenticated request — see this
        // file's own module doc comment.
        const pool = getPool();
        return joinCourse(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          courses: new PostgresCourseRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/join: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

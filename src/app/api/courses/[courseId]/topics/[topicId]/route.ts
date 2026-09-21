/**
 * PATCH /api/courses/:courseId/topics/:topicId — Run 005 S4 rename Topic.
 * Deliberately thin, mirrors `courses/[courseId]/manage/route.ts`'s PATCH
 * handler.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the `rename` closure
 * below — unreachable for an unauthenticated request, since
 * `handleRenameTopic` returns immediately on `UNAUTHENTICATED`.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleRenameTopic } from "./handle-rename-topic";

import { renameTopic } from "@/application/topic/rename-topic";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string; topicId: string }> },
): Promise<Response> {
  try {
    const { courseId, topicId } = await params;
    const supabase = await createSupabaseServerClient();

    // Auth before body parsing (Run 008 S1.E).
    let authResult: RequireAuthenticatedUserResult;
    try {
      authResult = await requireAuthenticatedUser(supabase);
    } catch (error) {
      console.error(
        "PATCH /api/courses/:courseId/topics/:topicId: unexpected error during authentication",
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

    const { status, body: responseBody } = await handleRenameTopic({
      authenticate: async () => authResult,
      courseId,
      topicId,
      body,
      rename: (command) => {
        const pool = getPool();
        return renameTopic(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/topics/:topicId: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

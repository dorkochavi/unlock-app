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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string; topicId: string }> },
): Promise<Response> {
  try {
    const { courseId, topicId } = await params;
    const supabase = await createSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleRenameTopic({
      authenticate: () => requireAuthenticatedUser(supabase),
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

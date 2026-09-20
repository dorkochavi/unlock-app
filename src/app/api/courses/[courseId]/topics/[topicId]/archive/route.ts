/**
 * POST /api/courses/:courseId/topics/:topicId/archive — Run 005 S4 archive
 * Topic. Deliberately thin, mirrors `courses/[courseId]/archive/route.ts`
 * exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside the `archive`
 * closure below — unreachable for an unauthenticated request, since
 * `handleArchiveTopic` returns immediately on `UNAUTHENTICATED`.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleArchiveTopic } from "./handle-archive-topic";

import { archiveTopic } from "@/application/topic/archive-topic";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; topicId: string }> },
): Promise<Response> {
  try {
    const { courseId, topicId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleArchiveTopic({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      topicId,
      archive: (command) => {
        const pool = getPool();
        return archiveTopic(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/topics/:topicId/archive: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

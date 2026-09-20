/**
 * GET/POST /api/courses/:courseId/topics — Run 005 S4 list/create flat
 * Topics. Deliberately thin, mirrors `courses/[courseId]/manage/route.ts`
 * exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside each closure below.
 * Both `handleListTopicsForCourse` and `handleCreateTopic` call
 * `authenticate()` first and return immediately on `UNAUTHENTICATED` — so
 * neither closure body, and therefore `getPool()`/`DATABASE_URL`, is
 * structurally reachable for an unauthenticated request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleCreateTopic } from "./handle-create-topic";
import { handleListTopicsForCourse } from "./handle-list-topics-for-course";

import { createTopic } from "@/application/topic/create-topic";
import { listTopicsForCourse } from "@/application/topic/list-topics-for-course";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleListTopicsForCourse({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      listTopics: (command) => {
        const pool = getPool();
        return listTopicsForCourse(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topics: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleCreateTopic({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      body,
      create: (command) => {
        const pool = getPool();
        return createTopic(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/topics: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

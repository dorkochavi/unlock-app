/**
 * GET/POST /api/courses/:courseId/questions — Run 006 S4 list/create
 * Question drafts. Deliberately thin, mirrors
 * `courses/[courseId]/topics/route.ts` exactly.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside each closure below.
 * Both `handleListQuestionsForCourse` and `handleCreateQuestionDraft` call
 * `authenticate()` first and return immediately on `UNAUTHENTICATED` — so
 * neither closure body, and therefore `getPool()`/`DATABASE_URL`, is
 * structurally reachable for an unauthenticated request.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleCreateQuestionDraft } from "./handle-create-question-draft";
import { handleListQuestionsForCourse } from "./handle-list-questions-for-course";

import { createQuestionDraft } from "@/application/question/create-question-draft";
import { listQuestionsForCourse } from "@/application/question/list-questions-for-course";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresQuestionRepository } from "@/infrastructure/postgres/question-authoring-repository";
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

    const { status, body } = await handleListQuestionsForCourse({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      listQuestions: (command) => {
        const pool = getPool();
        return listQuestionsForCourse(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
          questions: new PostgresQuestionRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId/questions: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  try {
    const { courseId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleCreateQuestionDraft({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      create: (command) => {
        const pool = getPool();
        return createQuestionDraft(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
          questions: new PostgresQuestionRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("POST /api/courses/:courseId/questions: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

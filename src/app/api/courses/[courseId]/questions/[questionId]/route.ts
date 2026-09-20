/**
 * GET/PATCH /api/courses/:courseId/questions/:questionId — Run 006 S4 read
 * one Question's authoring state / save its draft. Deliberately thin,
 * mirrors `courses/[courseId]/topics/[topicId]/route.ts`.
 *
 * Explicit Node runtime: `pg` has no Edge-runtime build.
 *
 * ## Auth before database
 *
 * `getPool()`/repository construction is LAZY, inside each closure below —
 * unreachable for an unauthenticated request, since both handlers return
 * immediately on `UNAUTHENTICATED`.
 */
export const runtime = "nodejs";

import { NextResponse } from "next/server";

import { handleGetQuestionForAuthoring } from "./handle-get-question-for-authoring";
import { handleUpdateQuestionDraft } from "./handle-update-question-draft";

import { getQuestionForAuthoring } from "@/application/question/get-question-for-authoring";
import { updateQuestionDraft } from "@/application/question/update-question-draft";
import { PostgresCourseMembershipRepository } from "@/infrastructure/postgres/course-membership-repository";
import { getPool } from "@/infrastructure/postgres/pg-pool";
import { PostgresQuestionRepository } from "@/infrastructure/postgres/question-authoring-repository";
import { PostgresTopicRepository } from "@/infrastructure/postgres/topic-repository";
import { requireAuthenticatedUser } from "@/infrastructure/supabase/require-authenticated-user";
import { createSupabaseServerClient } from "@/infrastructure/supabase/server-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ courseId: string; questionId: string }> },
): Promise<Response> {
  try {
    const { courseId, questionId } = await params;
    const supabase = await createSupabaseServerClient();

    const { status, body } = await handleGetQuestionForAuthoring({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      questionId,
      get: (command) => {
        const pool = getPool();
        return getQuestionForAuthoring(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
          questions: new PostgresQuestionRepository(pool),
        });
      },
    });

    return NextResponse.json(body, { status });
  } catch (error) {
    console.error("GET /api/courses/:courseId/questions/:questionId: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ courseId: string; questionId: string }> },
): Promise<Response> {
  try {
    const { courseId, questionId } = await params;
    const supabase = await createSupabaseServerClient();

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      body = null;
    }

    const { status, body: responseBody } = await handleUpdateQuestionDraft({
      authenticate: () => requireAuthenticatedUser(supabase),
      courseId,
      questionId,
      body,
      update: (command) => {
        const pool = getPool();
        return updateQuestionDraft(command, {
          memberships: new PostgresCourseMembershipRepository(pool),
          topics: new PostgresTopicRepository(pool),
          questions: new PostgresQuestionRepository(pool),
        });
      },
    });

    return NextResponse.json(responseBody, { status });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/questions/:questionId: unexpected route-level error", error);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR" } }, { status: 500 });
  }
}

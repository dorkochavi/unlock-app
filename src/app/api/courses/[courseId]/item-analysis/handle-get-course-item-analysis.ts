/**
 * Testable core of `GET /api/courses/:courseId/item-analysis` (Pre-Pilot S2).
 * Mirrors `questions/handle-list-questions-for-course.ts`'s shape.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_ACTIVE` -> 409, `{error: {code: "COURSE_NOT_ACTIVE"}}`
 *   (DRAFT/ARCHIVED Course — same 409 precedent as `COURSE_ARCHIVED`).
 * - `READY` -> 200, `{generatedAt, items}` — aggregate-only; a non-ELIGIBLE
 *   item carries `stats: null` and no numbers.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 *
 * The clock is injected (`now`) — this handler never reads `Date` itself.
 */
import { isUuid } from "../../../../../lib/uuid";

import type { GetCourseItemAnalysisResult } from "@/application/insights/get-course-item-analysis";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleGetCourseItemAnalysisDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  now: () => Date;
  getItemAnalysis: (command: {
    actorUserId: string;
    courseId: string;
    now: Date;
  }) => Promise<GetCourseItemAnalysisResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetCourseItemAnalysis(
  deps: HandleGetCourseItemAnalysisDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/item-analysis: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: GetCourseItemAnalysisResult;
  try {
    result = await deps.getItemAnalysis({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      now: deps.now(),
    });
  } catch (error) {
    console.error("GET /api/courses/:courseId/item-analysis: unexpected error during read", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_ACTIVE":
      return { status: 409, body: { error: { code: "COURSE_NOT_ACTIVE" } } };

    case "READY":
      return {
        status: 200,
        body: {
          generatedAt: result.generatedAt.toISOString(),
          items: result.items.map((item) => ({
            questionId: item.questionId,
            questionVersionId: item.questionVersionId,
            prompt: item.prompt,
            disclosure: item.disclosure,
            stats: item.stats,
          })),
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/item-analysis: unhandled GetCourseItemAnalysisResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

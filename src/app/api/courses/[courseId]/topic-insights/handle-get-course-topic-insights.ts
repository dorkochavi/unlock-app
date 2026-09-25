/**
 * Testable core of `GET /api/courses/:courseId/topic-insights` (Run 009 S3).
 * Mirrors `item-analysis/handle-get-course-item-analysis.ts`.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_ACTIVE` -> 409, `{error: {code: "COURSE_NOT_ACTIVE"}}`.
 * - `READY` -> 200, `{generatedAt, topics}` — F-02 contract: each Topic
 *   carries only `topicId`/`name` (null = the "no Topic" bucket), `archived`,
 *   `disclosure` (`ELIGIBLE` | `INSUFFICIENT_DATA`) and a coarse descriptive
 *   `band` (null unless ELIGIBLE). Never a count, percentage, learner
 *   identity, or per-option data.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 *
 * The clock is injected (`now`) — this handler never reads `Date` itself.
 */
import { isUuid } from "../../../../../lib/uuid";

import type { GetCourseTopicInsightsResult } from "@/application/insights/get-course-topic-insights";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleGetCourseTopicInsightsDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  now: () => Date;
  getTopicInsights: (command: {
    actorUserId: string;
    courseId: string;
    now: Date;
  }) => Promise<GetCourseTopicInsightsResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleGetCourseTopicInsights(
  deps: HandleGetCourseTopicInsightsDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-insights: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  let result: GetCourseTopicInsightsResult;
  try {
    result = await deps.getTopicInsights({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      now: deps.now(),
    });
  } catch (error) {
    console.error("GET /api/courses/:courseId/topic-insights: unexpected error during read", error);
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
          topics: result.topics.map((topic) => ({
            topicId: topic.topicId,
            name: topic.name,
            archived: topic.archived,
            disclosure: topic.disclosure,
            band: topic.band,
          })),
        },
      };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "GET /api/courses/:courseId/topic-insights: unhandled GetCourseTopicInsightsResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

/**
 * Testable core of `POST /api/courses/:courseId/topics/:topicId/archive`
 * (Run 005 S4 — "archive Topic"). Mirrors
 * `courses/[courseId]/archive/handle-archive-course.ts`'s shape.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` or `topicId` -> 404,
 *   `{error: {code: "TOPIC_NOT_FOUND"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `TOPIC_NOT_FOUND` (includes cross-Course mismatch) -> 404,
 *   `{error: {code: "TOPIC_NOT_FOUND"}}`.
 * - `ARCHIVED` -> 200, `{topic: TopicDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../../lib/uuid";
import { toTopicDto } from "../../topic-dto";

import type { ArchiveTopicResult } from "@/application/topic/archive-topic";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleArchiveTopicDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  topicId: string;
  archive: (command: {
    actorUserId: string;
    courseId: string;
    topicId: string;
  }) => Promise<ArchiveTopicResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function topicNotFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "TOPIC_NOT_FOUND" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleArchiveTopic(
  deps: HandleArchiveTopicDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/topics/:topicId/archive: unexpected error during authentication",
      error,
    );
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId) || !isUuid(deps.topicId)) {
    return topicNotFoundResponse();
  }

  let result: ArchiveTopicResult;
  try {
    result = await deps.archive({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      topicId: deps.topicId,
    });
  } catch (error) {
    console.error(
      "POST /api/courses/:courseId/topics/:topicId/archive: unexpected error during archive",
      error,
    );
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "TOPIC_NOT_FOUND":
      return topicNotFoundResponse();

    case "ARCHIVED":
      return { status: 200, body: { topic: toTopicDto(result.topic) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "POST /api/courses/:courseId/topics/:topicId/archive: unhandled ArchiveTopicResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

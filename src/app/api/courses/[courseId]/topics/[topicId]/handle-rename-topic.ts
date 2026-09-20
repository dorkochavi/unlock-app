/**
 * Testable core of `PATCH /api/courses/:courseId/topics/:topicId` (Run 005
 * S4 — "rename Topic"). Mirrors
 * `courses/[courseId]/manage/handle-update-course-metadata.ts`'s shape.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` or `topicId` -> 404,
 *   `{error: {code: "TOPIC_NOT_FOUND"}}` — same malformed-id hardening as
 *   every other authoring route, checked BEFORE `deps.rename`.
 * - missing/non-string `name` -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `TOPIC_NOT_FOUND` (includes a Topic that exists but belongs to a
 *   different Course than `courseId` — the cross-Course guard) -> 404,
 *   `{error: {code: "TOPIC_NOT_FOUND"}}`.
 * - `INVALID_NAME` (empty after trim) -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `RENAMED` -> 200, `{topic: TopicDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../../lib/uuid";
import { toTopicDto } from "../topic-dto";

import type { RenameTopicResult } from "@/application/topic/rename-topic";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleRenameTopicDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  topicId: string;
  body: unknown;
  rename: (command: {
    actorUserId: string;
    courseId: string;
    topicId: string;
    name: string;
  }) => Promise<RenameTopicResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

function topicNotFoundResponse(): RouteJsonResponse {
  return { status: 404, body: { error: { code: "TOPIC_NOT_FOUND" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleRenameTopic(
  deps: HandleRenameTopicDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error(
      "PATCH /api/courses/:courseId/topics/:topicId: unexpected error during authentication",
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

  if (deps.body === null || typeof deps.body !== "object") {
    return invalidRequestResponse();
  }
  const body = deps.body as Record<string, unknown>;

  const name = body.name;
  if (typeof name !== "string") {
    return invalidRequestResponse();
  }

  let result: RenameTopicResult;
  try {
    result = await deps.rename({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      topicId: deps.topicId,
      name,
    });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/topics/:topicId: unexpected error during rename", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "TOPIC_NOT_FOUND":
      return topicNotFoundResponse();

    case "INVALID_NAME":
      return invalidRequestResponse();

    case "RENAMED":
      return { status: 200, body: { topic: toTopicDto(result.topic) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "PATCH /api/courses/:courseId/topics/:topicId: unhandled RenameTopicResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

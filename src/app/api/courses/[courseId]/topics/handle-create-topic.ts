/**
 * Testable core of `POST /api/courses/:courseId/topics` (Run 005 S4 —
 * "add Topic"). Mirrors `courses/handle-create-course.ts`'s
 * authenticate-then-validate-then-invoke split.
 *
 * ## Trust boundary
 *
 * `authenticate` is the only source of `actorUserId`. `courseId` comes from
 * the URL path. The request body may only supply `name` (required,
 * non-empty after trim).
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - missing/non-string `name` -> 400, `{error: {code: "INVALID_REQUEST"}}` —
 *   checked BEFORE `deps.create`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `INVALID_NAME` (empty after trim) -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `CREATED` -> 201, `{topic: TopicDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toTopicDto } from "./topic-dto";

import type { CreateTopicResult } from "@/application/topic/create-topic";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleCreateTopicDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  body: unknown;
  create: (command: { actorUserId: string; courseId: string; name: string }) => Promise<CreateTopicResult>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

function invalidRequestResponse(): RouteJsonResponse {
  return { status: 400, body: { error: { code: "INVALID_REQUEST" } } };
}

function internalErrorResponse(): RouteJsonResponse {
  return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
}

export async function handleCreateTopic(
  deps: HandleCreateTopicDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/courses/:courseId/topics: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (!isUuid(deps.courseId)) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  if (deps.body === null || typeof deps.body !== "object") {
    return invalidRequestResponse();
  }
  const body = deps.body as Record<string, unknown>;

  const name = body.name;
  if (typeof name !== "string") {
    return invalidRequestResponse();
  }

  let result: CreateTopicResult;
  try {
    result = await deps.create({ actorUserId: authResult.userId, courseId: deps.courseId, name });
  } catch (error) {
    console.error("POST /api/courses/:courseId/topics: unexpected error during creation", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "INVALID_NAME":
      return invalidRequestResponse();

    case "CREATED":
      return { status: 201, body: { topic: toTopicDto(result.topic) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error("POST /api/courses/:courseId/topics: unhandled CreateTopicResult outcome", exhaustiveCheck);
      return internalErrorResponse();
    }
  }
}

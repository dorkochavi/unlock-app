/**
 * Testable core of `POST /api/courses` (Run 005 S2 — Course create). Mirrors
 * `daily-plan/items/.../answer/handle-submit-daily-plan-item-answer.ts`'s
 * authenticate-then-validate-then-invoke split.
 *
 * ## Trust boundary
 *
 * `authenticate` is the only source of `actorUserId`. The request body may
 * only supply `title` (required, non-empty after trim) and `examDate`
 * (optional, `YYYY-MM-DD` or `null`) — never `ownerUserId`, `status`, or
 * `joinPolicy`: every new Course always starts DRAFT/AUTHORIZED_ONLY
 * (`createCourse`'s own module doc comment).
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - missing/non-string `title`, or a malformed `examDate` -> 400,
 *   `{error: {code: "INVALID_REQUEST"}}` — checked BEFORE `deps.create` is
 *   ever called.
 * - `INVALID_TITLE` (empty after trim) -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `CREATED` -> 201, `{course: CourseAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { toCourseAuthoringDto } from "./authoring-dto";

import { isValidDateOnly } from "@/lib/date-only";

import type { CreateCourseResult } from "@/application/course/create-course";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

export interface HandleCreateCourseDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  body: unknown;
  create: (command: {
    actorUserId: string;
    title: string;
    examDate: string | null;
  }) => Promise<CreateCourseResult>;
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

function readExamDate(body: Record<string, unknown>): string | null | undefined {
  const value = body.examDate;
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && isValidDateOnly(value)) return value;
  return undefined;
}

export async function handleCreateCourse(
  deps: HandleCreateCourseDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("POST /api/courses: unexpected error during authentication", error);
    return internalErrorResponse();
  }

  if (authResult.outcome === "UNAUTHENTICATED") {
    return { status: 401, body: { error: { code: "UNAUTHENTICATED" } } };
  }

  if (deps.body === null || typeof deps.body !== "object") {
    return invalidRequestResponse();
  }
  const body = deps.body as Record<string, unknown>;

  const title = body.title;
  if (typeof title !== "string") {
    return invalidRequestResponse();
  }

  const examDate = readExamDate(body);
  if (examDate === undefined) {
    return invalidRequestResponse();
  }

  let result: CreateCourseResult;
  try {
    result = await deps.create({ actorUserId: authResult.userId, title, examDate });
  } catch (error) {
    console.error("POST /api/courses: unexpected error during creation", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "INVALID_TITLE":
      return invalidRequestResponse();

    case "CREATED":
      return { status: 201, body: { course: toCourseAuthoringDto(result.course) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error("POST /api/courses: unhandled CreateCourseResult outcome", exhaustiveCheck);
      return internalErrorResponse();
    }
  }
}

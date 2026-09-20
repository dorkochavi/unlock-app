/**
 * Testable core of `PATCH /api/courses/:courseId/manage` (Run 005 S2 —
 * "update allowed metadata"). Only `title`/`examDate` are accepted —
 * `join_policy` has its own dedicated route
 * (`courses/[courseId]/join-policy`, not part of this Slice), and
 * `status` has its own dedicated publish/archive routes with explicit
 * transition rules.
 *
 * ## HTTP mapping
 *
 * - `UNAUTHENTICATED` -> 401, `{error: {code: "UNAUTHENTICATED"}}`.
 * - malformed/non-UUID `courseId` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - malformed body (`title` present but non-string, or `examDate` present
 *   but neither `YYYY-MM-DD` nor `null`) -> 400,
 *   `{error: {code: "INVALID_REQUEST"}}` — checked BEFORE `deps.update`.
 * - `NOT_AUTHORIZED` -> 403, `{error: {code: "NOT_AUTHORIZED"}}`.
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - `INVALID_TITLE` (empty after trim) -> 400, `{error: {code: "INVALID_REQUEST"}}`.
 * - `UPDATED` -> 200, `{course: CourseAuthoringDto}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import { isUuid } from "../../../../../lib/uuid";
import { toCourseAuthoringDto } from "../../authoring-dto";

import type { UpdateCourseMetadataResult } from "@/application/course/update-course-metadata";
import type { RequireAuthenticatedUserResult } from "@/infrastructure/supabase/require-authenticated-user";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface HandleUpdateCourseMetadataDependencies {
  authenticate: () => Promise<RequireAuthenticatedUserResult>;
  courseId: string;
  body: unknown;
  update: (command: {
    actorUserId: string;
    courseId: string;
    title?: string;
    examDate?: string | null;
  }) => Promise<UpdateCourseMetadataResult>;
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

/** `undefined` sentinel result = "field absent, leave unchanged" (distinguished from an invalid value below). */
const ABSENT = Symbol("absent");

function readTitle(body: Record<string, unknown>): string | typeof ABSENT | undefined {
  if (!("title" in body)) return ABSENT;
  return typeof body.title === "string" ? body.title : undefined;
}

function readExamDate(body: Record<string, unknown>): string | null | typeof ABSENT | undefined {
  if (!("examDate" in body)) return ABSENT;
  const value = body.examDate;
  if (value === null) return null;
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) return value;
  return undefined;
}

export async function handleUpdateCourseMetadata(
  deps: HandleUpdateCourseMetadataDependencies,
): Promise<RouteJsonResponse> {
  let authResult: RequireAuthenticatedUserResult;
  try {
    authResult = await deps.authenticate();
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/manage: unexpected error during authentication", error);
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

  const title = readTitle(body);
  if (title === undefined) {
    return invalidRequestResponse();
  }
  const examDate = readExamDate(body);
  if (examDate === undefined) {
    return invalidRequestResponse();
  }

  let result: UpdateCourseMetadataResult;
  try {
    result = await deps.update({
      actorUserId: authResult.userId,
      courseId: deps.courseId,
      ...(title !== ABSENT ? { title } : {}),
      ...(examDate !== ABSENT ? { examDate } : {}),
    });
  } catch (error) {
    console.error("PATCH /api/courses/:courseId/manage: unexpected error during update", error);
    return internalErrorResponse();
  }

  switch (result.outcome) {
    case "NOT_AUTHORIZED":
      return { status: 403, body: { error: { code: "NOT_AUTHORIZED" } } };

    case "COURSE_NOT_FOUND":
      return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };

    case "INVALID_TITLE":
      return invalidRequestResponse();

    case "UPDATED":
      return { status: 200, body: { course: toCourseAuthoringDto(result.course) } };

    default: {
      const exhaustiveCheck: never = result;
      console.error(
        "PATCH /api/courses/:courseId/manage: unhandled UpdateCourseMetadataResult outcome",
        exhaustiveCheck,
      );
      return internalErrorResponse();
    }
  }
}

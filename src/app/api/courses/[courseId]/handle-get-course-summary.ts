/**
 * Testable core of `GET /api/courses/:courseId` — a deliberately PUBLIC,
 * unauthenticated read (Night-Run Slice 6): a Course's own title is not
 * sensitive, and showing it on the join page before sign-in matches the
 * demo flow (`QR → Course → sign in → join`, ADR-015 §4). No `userId`,
 * ownership, or join-policy information is ever returned — see
 * `CourseSummary`'s own doc comment for why the underlying query cannot
 * leak them.
 *
 * ## HTTP mapping
 *
 * - `COURSE_NOT_FOUND` -> 404, `{error: {code: "COURSE_NOT_FOUND"}}`.
 * - found -> 200, `{course: {id, title}}`.
 * - unexpected thrown error -> 500, `{error: {code: "INTERNAL_ERROR"}}`.
 */
import type { CourseSummary } from "../../../../application/course/ports";

export interface HandleGetCourseSummaryDependencies {
  courseId: string;
  getSummary: (courseId: string) => Promise<CourseSummary | null>;
}

export interface RouteJsonResponse {
  status: number;
  body: unknown;
}

export async function handleGetCourseSummary(
  deps: HandleGetCourseSummaryDependencies,
): Promise<RouteJsonResponse> {
  let summary: CourseSummary | null;
  try {
    summary = await deps.getSummary(deps.courseId);
  } catch (error) {
    console.error("GET /api/courses/:courseId: unexpected error", error);
    return { status: 500, body: { error: { code: "INTERNAL_ERROR" } } };
  }

  if (summary === null) {
    return { status: 404, body: { error: { code: "COURSE_NOT_FOUND" } } };
  }

  return { status: 200, body: { course: summary } };
}

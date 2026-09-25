/**
 * Run 009 S3 — whether the instructor Course UI should render the visible
 * "ניתוח תשובות" entry point (FUB-028, D5). Mirrors the analysis endpoints'
 * own Course-state rule (`COURSE_NOT_ACTIVE` unless PUBLISHED), so the link
 * is never rendered where the destination can only answer "not active" (an
 * F-13-style dead link). Authorization is NOT decided here: the Course
 * management page is only reachable by an OWNER/INSTRUCTOR who passed
 * `canAuthorCourse`, and the endpoints re-enforce it server-side.
 */
import type { CourseStatus } from "../course/types";

export function canOpenAnswerAnalysis(courseStatus: CourseStatus): boolean {
  return courseStatus === "PUBLISHED";
}

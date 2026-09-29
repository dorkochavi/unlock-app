/**
 * Shared authorization + Course-state gate for the instructor answer-analysis
 * surface (Item Analysis and Topic Insights, Run 009 S3), so both read
 * models apply exactly the same rule.
 *
 * Fail closed: RUN010-H.2 — authorizes via `hasActiveAuthorGrant` over
 * `course_authors` (no active OWNER/INSTRUCTOR grant is `NOT_AUTHORIZED`),
 * checked BEFORE Course status so a non-member learns nothing about the
 * Course. "Active" reuses the DailyPlan
 * meaning: `status === "PUBLISHED"`; DRAFT and ARCHIVED are
 * `COURSE_NOT_ACTIVE`.
 */
import { hasActiveAuthorGrant } from "../../domain/course/types";
import type { CourseAuthorRepository, CourseMembershipRepository, CourseRepository } from "../course/ports";

export type AnalysisAccessResult = "ALLOWED" | "NOT_AUTHORIZED" | "COURSE_NOT_ACTIVE";

export async function checkAnalysisAccess(
  actorUserId: string,
  courseId: string,
  repos: { memberships: CourseMembershipRepository; authors: CourseAuthorRepository; courses: CourseRepository },
): Promise<AnalysisAccessResult> {
  const authorGrants = await repos.authors.findActiveCapabilities(actorUserId, courseId);
  if (!hasActiveAuthorGrant(authorGrants)) {
    return "NOT_AUTHORIZED";
  }

  const statuses = await repos.courses.listStatuses([courseId]);
  const course = statuses.find((entry) => entry.id === courseId);
  if (course === undefined || course.status !== "PUBLISHED") {
    return "COURSE_NOT_ACTIVE";
  }
  return "ALLOWED";
}

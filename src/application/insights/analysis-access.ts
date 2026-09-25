/**
 * Shared authorization + Course-state gate for the instructor answer-analysis
 * surface (Item Analysis and Topic Insights, Run 009 S3), so both read
 * models apply exactly the same rule.
 *
 * Fail closed: reuses `canAuthorCourse` (a missing, revoked, or LEARNER
 * membership is `NOT_AUTHORIZED`), checked BEFORE Course status so a
 * non-member learns nothing about the Course. "Active" reuses the DailyPlan
 * meaning: `status === "PUBLISHED"`; DRAFT and ARCHIVED are
 * `COURSE_NOT_ACTIVE`.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { CourseMembershipRepository, CourseRepository } from "../course/ports";

export type AnalysisAccessResult = "ALLOWED" | "NOT_AUTHORIZED" | "COURSE_NOT_ACTIVE";

export async function checkAnalysisAccess(
  actorUserId: string,
  courseId: string,
  repos: { memberships: CourseMembershipRepository; courses: CourseRepository },
): Promise<AnalysisAccessResult> {
  const membership = await repos.memberships.findMembership(actorUserId, courseId);
  if (membership === null || !canAuthorCourse(membership)) {
    return "NOT_AUTHORIZED";
  }

  const statuses = await repos.courses.listStatuses([courseId]);
  const course = statuses.find((entry) => entry.id === courseId);
  if (course === undefined || course.status !== "PUBLISHED") {
    return "COURSE_NOT_ACTIVE";
  }
  return "ALLOWED";
}

/**
 * getCourseContextForLearner — the application-layer use case behind
 * Learner Course View V1 (Run 004 Slice 4): course context for a learner
 * who may legitimately access this Course, using only currently supported
 * data (Course title + the caller's own membership state).
 *
 * This is deliberately NOT the public `CourseRepository.getCourseSummary`
 * path (`GET /api/courses/:courseId`) — that route is intentionally
 * unauthenticated for the pre-join join-page display. Course View is the
 * opposite case: it requires the caller to already have a real
 * `CourseMembership`, and fails closed otherwise, matching this Slice's
 * "fail safely for a user without allowed course access" requirement.
 *
 * Does not create an independent per-course Today/plan — this function only
 * reads a Course summary and the caller's own membership row.
 */
import type { CourseMembership, CourseRepositories, CourseSummary } from "./ports";

export interface GetCourseContextForLearnerCommand {
  actorUserId: string;
  courseId: string;
}

export type GetCourseContextForLearnerResult =
  | { outcome: "COURSE_NOT_FOUND" }
  | { outcome: "NOT_A_MEMBER" }
  | { outcome: "ACCESS_REVOKED" }
  | { outcome: "READY"; course: CourseSummary; membership: CourseMembership };

export async function getCourseContextForLearner(
  command: GetCourseContextForLearnerCommand,
  repos: CourseRepositories,
): Promise<GetCourseContextForLearnerResult> {
  const course = await repos.courses.getCourseSummary(command.courseId);
  if (course === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }

  const membership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (membership === null) {
    // Possession of a valid Course id is never itself authorization
    // (ADR-015 §6, same principle `joinCourse` already applies) — an
    // authenticated user with no membership row at all gets the same
    // fail-closed outcome as an AUTHORIZED_ONLY non-member.
    return { outcome: "NOT_A_MEMBER" };
  }
  if (membership.revokedAt !== null) {
    return { outcome: "ACCESS_REVOKED" };
  }

  return { outcome: "READY", course, membership };
}

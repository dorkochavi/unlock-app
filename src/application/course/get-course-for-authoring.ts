/**
 * getCourseForAuthoring — the application-layer use case for reading a
 * Course's full editable context (Run 005 S2 "read editable Course
 * context"). Authorized OWNER/active-INSTRUCTOR only — see
 * `CourseAuthoringRecord`'s own doc comment for why this projection must
 * never reach a learner-facing read path.
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { CourseAuthoringRecord, CourseRepositories } from "./ports";

export interface GetCourseForAuthoringCommand {
  actorUserId: string;
  courseId: string;
}

export type GetCourseForAuthoringResult =
  | { outcome: "READY"; course: CourseAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" };

export async function getCourseForAuthoring(
  command: GetCourseForAuthoringCommand,
  repos: CourseRepositories,
): Promise<GetCourseForAuthoringResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  // Checking the actor's membership before the Course's existence means a
  // caller with no legitimate relationship to this Course never learns
  // whether the courseId is valid — same principle as
  // `setCourseJoinPolicy`.
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const course = await repos.courses.getCourseForAuthoring(command.courseId);
  if (course === null) {
    // Reachable only if the Course was deleted after the membership
    // lookup above — not a normal V1 path (no code deletes a Course).
    return { outcome: "COURSE_NOT_FOUND" };
  }

  return { outcome: "READY", course };
}

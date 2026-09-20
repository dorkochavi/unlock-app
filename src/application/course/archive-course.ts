/**
 * archiveCourse — the application-layer use case for archiving a Course
 * (Run 005 S2 "Course lifecycle"). Allowed from either DRAFT or PUBLISHED
 * — an instructor may abandon an unpublished Course just as validly as
 * retiring a published one. Already-ARCHIVED rejects with
 * `INVALID_TRANSITION` rather than silently succeeding again (Run 005 S2
 * "invalid transition behavior"). V1 has no un-archive path — archiving is
 * terminal, and "do not infer delete semantics from archive" (Run 005
 * CHATGPT_PLAN.md "Course lifecycle") means all historical data (Attempts,
 * QuestionVersions, progress, CourseMemberships) remains untouched and
 * preserved; this use case only ever writes `courses.status`.
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { CourseAuthoringRecord, CourseRepositories } from "./ports";

export interface ArchiveCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type ArchiveCourseResult =
  | { outcome: "ARCHIVED"; course: CourseAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" }
  | { outcome: "INVALID_TRANSITION"; from: CourseAuthoringRecord["status"] };

export async function archiveCourse(
  command: ArchiveCourseCommand,
  repos: CourseRepositories,
): Promise<ArchiveCourseResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const current = await repos.courses.getCourseForAuthoring(command.courseId);
  if (current === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }
  if (current.status === "ARCHIVED") {
    return { outcome: "INVALID_TRANSITION", from: current.status };
  }

  const updated = await repos.courses.setCourseStatus(command.courseId, "ARCHIVED");
  if (updated === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }
  return { outcome: "ARCHIVED", course: updated };
}

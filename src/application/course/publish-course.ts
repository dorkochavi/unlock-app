/**
 * publishCourse — the application-layer use case for the DRAFT -> PUBLISHED
 * Course lifecycle transition (Run 005 S2 "Course lifecycle" / "Publish
 * UX": "Do not auto-publish a Course merely because it was created").
 *
 * Publish is only ever legal from DRAFT — an already-PUBLISHED or
 * ARCHIVED Course rejects with `INVALID_TRANSITION` rather than silently
 * succeeding or re-publishing (Run 005 S2 "invalid transition behavior").
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { CourseAuthoringRecord, CourseRepositories } from "./ports";

export interface PublishCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type PublishCourseResult =
  | { outcome: "PUBLISHED"; course: CourseAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" }
  | { outcome: "INVALID_TRANSITION"; from: CourseAuthoringRecord["status"] };

export async function publishCourse(
  command: PublishCourseCommand,
  repos: CourseRepositories,
): Promise<PublishCourseResult> {
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
  if (current.status !== "DRAFT") {
    return { outcome: "INVALID_TRANSITION", from: current.status };
  }

  const updated = await repos.courses.setCourseStatus(command.courseId, "PUBLISHED");
  if (updated === null) {
    // Reachable only if the Course was deleted between the read above and
    // this write — not a normal V1 path (no code deletes a Course).
    return { outcome: "COURSE_NOT_FOUND" };
  }
  return { outcome: "PUBLISHED", course: updated };
}

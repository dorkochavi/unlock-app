/**
 * updateCourseMetadata — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR editing a Course's title/exam date (Run 005 S2
 * "update allowed metadata"). Join policy has its own dedicated use case
 * (`set-course-join-policy.ts`) and is not touched here. Lifecycle status
 * has its own dedicated use cases (`publish-course.ts`/`archive-course.ts`)
 * with explicit transition rules and is not touched here either.
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { CourseAuthoringRecord, CourseRepositories, UpdateCourseMetadataInput } from "./ports";

export interface UpdateCourseMetadataCommand {
  actorUserId: string;
  courseId: string;
  /** `undefined` = leave title unchanged. */
  title?: string;
  /** `undefined` = leave exam date unchanged. `null` = clear it. */
  examDate?: string | null;
}

export type UpdateCourseMetadataResult =
  | { outcome: "UPDATED"; course: CourseAuthoringRecord }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" }
  | { outcome: "INVALID_TITLE" };

export async function updateCourseMetadata(
  command: UpdateCourseMetadataCommand,
  repos: CourseRepositories,
): Promise<UpdateCourseMetadataResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const input: UpdateCourseMetadataInput = {};
  if (command.title !== undefined) {
    const title = command.title.trim();
    if (title.length === 0) {
      return { outcome: "INVALID_TITLE" };
    }
    input.title = title;
  }
  if (command.examDate !== undefined) {
    input.examDate = command.examDate;
  }

  const course = await repos.courses.updateCourseMetadata(command.courseId, input);
  return course === null
    ? { outcome: "COURSE_NOT_FOUND" }
    : { outcome: "UPDATED", course };
}

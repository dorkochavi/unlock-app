/**
 * createCourse — the application-layer use case for an authenticated user
 * creating a new Course as its OWNER (Run 005 S2 "Course lifecycle").
 *
 * New Courses always start DRAFT and AUTHORIZED_ONLY (existing
 * `courses.join_policy` default) — an instructor must explicitly publish
 * and explicitly open the Course before any learner can reach it (Run 005
 * S3 "Do not auto-publish a Course merely because it was created").
 *
 * `courses.owner_user_id` remains the sole V1 ownership fact (ADR-015 §1
 * "kept as-is, unaffected") — this use case additionally creates an OWNER
 * `CourseMembership` for the creator so every other Run-005 authoring use
 * case can authorize through the same `CourseMembership` path as every
 * other management action, rather than special-casing `owner_user_id`.
 *
 * Both writes run inside one transaction (`CourseUnitOfWork`): this is a
 * genuinely atomic two-statement operation, not merely a concurrency
 * concern — a partial failure between the two inserts (dropped connection,
 * transient error) would otherwise leave a `courses` row with NO
 * `CourseMembership` at all, which every other Run-005 authoring use case
 * (`get-course-for-authoring.ts`/`update-course-metadata.ts`/
 * `publish-course.ts`/`archive-course.ts`) authorizes exclusively through
 * `CourseMembership` — such a Course would become permanently unmanageable
 * by anyone (DB review finding, Run 005 S2).
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import type { CourseAuthoringRecord, CourseUnitOfWork } from "./ports";

export interface CreateCourseCommand {
  actorUserId: string;
  title: string;
  examDate: string | null;
}

export type CreateCourseResult =
  | { outcome: "CREATED"; course: CourseAuthoringRecord }
  | { outcome: "INVALID_TITLE" };

export async function createCourse(
  command: CreateCourseCommand,
  uow: CourseUnitOfWork,
): Promise<CreateCourseResult> {
  const title = command.title.trim();
  if (title.length === 0) {
    return { outcome: "INVALID_TITLE" };
  }

  return uow.runInTransaction(async (repos) => {
    const course = await repos.courses.createCourse({
      ownerUserId: command.actorUserId,
      title,
      examDate: command.examDate,
    });

    await repos.memberships.createMembership({
      userId: command.actorUserId,
      courseId: course.id,
      role: "OWNER",
      joinedAt: new Date(),
      revokedAt: null,
      archivedAt: null,
    });

    return { outcome: "CREATED", course };
  });
}

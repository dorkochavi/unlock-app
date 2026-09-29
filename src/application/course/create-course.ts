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
 * `course_authors` grant for the creator so every authoring use case can
 * authorize through the same `course_authors` path as every other
 * management action, rather than special-casing `owner_user_id`.
 *
 * RUN010-H.2 (FUB-036, Option 4 architecture): this use case no longer
 * creates a `course_memberships` row at all for the creator — only the
 * `course_authors` OWNER grant. A Course's creator therefore has NO
 * `course_memberships` row immediately after creation (they are not
 * automatically a LEARNER in their own Course); the approved author
 * self-enrollment bypass is RUN010-H.3's job, not this one's. Every
 * authoring use case (topics/questions/import/insights/course management)
 * already authorizes via `course_authors` as of this same Slice, so this
 * change does not leave the Course unmanageable.
 *
 * Both writes run inside one transaction (`CourseUnitOfWork`): this is a
 * genuinely atomic two-statement operation, not merely a concurrency
 * concern — a partial failure between the two inserts (dropped connection,
 * transient error) would otherwise leave a `courses` row with NO
 * `course_authors` grant at all, which every authoring use case now
 * authorizes exclusively through — such a Course would become permanently
 * unmanageable by anyone (DB review finding, Run 005 S2, carried forward).
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

    await repos.authors.grant({
      userId: command.actorUserId,
      courseId: course.id,
      capability: "OWNER",
      grantedAt: new Date(),
      revokedAt: null,
    });

    return { outcome: "CREATED", course };
  });
}

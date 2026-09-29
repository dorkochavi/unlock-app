/**
 * listMyCourses — the application-layer use case behind My Courses V1
 * (Run 004 Slice 3): "the Courses an authenticated learner actively belongs
 * to," based purely on authoritative persisted `CourseMembership` state.
 *
 * Reuses `CourseMembershipRepository.listActiveForUser` exactly as-is —
 * that method already implements `isActiveMembership`
 * (`src/domain/course/types.ts`: not revoked, not archived) at the SQL
 * layer, so this function does not re-derive or duplicate that filter. It
 * does not filter by role: an existing OWNER/INSTRUCTOR membership is
 * listed unchanged (never downgraded, never hidden) — this function only
 * projects Course identity onto each active membership, it does not
 * interpret role.
 *
 * RUN010-H.2 (FUB-036, Option 4 architecture, required DTO/API surface
 * change): also unions in every Course the actor actively AUTHORS via
 * `course_authors` (`CourseAuthorRepository.listActiveForUser`), even when
 * no `course_memberships` row exists for it — otherwise a Course created
 * after this Slice (which grants `course_authors` only, no
 * `course_memberships` row — see `create-course.ts`) would silently vanish
 * from "My Courses"/the instructor Courses list for its own creator. A
 * Course covered by BOTH sources (the common case for an existing pre-H.2
 * OWNER/INSTRUCTOR, backfilled into `course_authors` by RUN010-H.1) appears
 * once, with `role` from the membership and `isAuthor: true`. A Course
 * covered ONLY by `course_authors` gets `role: null` and `isAuthor: true`.
 * `isAuthor` is always independently derived from `course_authors` — never
 * inferred from `role`.
 */
import { isActiveAuthorGrant } from "../../domain/course/types";
import type { CourseRepositories, CourseRole } from "./ports";

export interface ListMyCoursesCommand {
  actorUserId: string;
}

export interface MyCourseEntry {
  courseId: string;
  title: string;
  /** `null` only when the actor has no `course_memberships` row for this Course (author-only, no learner enrollment). */
  role: CourseRole | null;
  /** RUN010-H.2 — independent `course_authors` signal, never derived from `role`. */
  isAuthor: boolean;
}

export async function listMyCourses(
  command: ListMyCoursesCommand,
  repos: CourseRepositories,
): Promise<MyCourseEntry[]> {
  const memberships = await repos.memberships.listActiveForUser(command.actorUserId);
  const authorGrants = await repos.authors.listActiveForUser(command.actorUserId);

  const roleByCourseId = new Map(memberships.map((m) => [m.courseId, m.role]));
  // `listActiveForUser` already filters to non-revoked grants at the SQL
  // layer; `isActiveAuthorGrant` is re-applied here defensively (same
  // discipline as `hasActiveAuthorGrant` elsewhere), not because a real
  // Postgres call is expected to return a revoked row.
  const authorCourseIds = new Set(
    authorGrants.filter(isActiveAuthorGrant).map((grant) => grant.courseId),
  );

  const courseIds = new Set<string>([
    ...memberships.map((m) => m.courseId),
    ...authorCourseIds,
  ]);
  if (courseIds.size === 0) {
    return [];
  }

  const summaries = await repos.courses.getCourseSummaries([...courseIds]);
  const titleByCourseId = new Map(summaries.map((summary) => [summary.id, summary.title]));

  return [...courseIds]
    .filter((courseId) => titleByCourseId.has(courseId))
    .map((courseId) => ({
      courseId,
      title: titleByCourseId.get(courseId) as string,
      role: roleByCourseId.get(courseId) ?? null,
      isAuthor: authorCourseIds.has(courseId),
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

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
 */
import type { CourseMembership, CourseRepositories, CourseRole } from "./ports";

export interface ListMyCoursesCommand {
  actorUserId: string;
}

export interface MyCourseEntry {
  courseId: string;
  title: string;
  role: CourseRole;
}

export async function listMyCourses(
  command: ListMyCoursesCommand,
  repos: CourseRepositories,
): Promise<MyCourseEntry[]> {
  const memberships = await repos.memberships.listActiveForUser(command.actorUserId);
  if (memberships.length === 0) {
    return [];
  }

  const summaries = await repos.courses.getCourseSummaries(
    memberships.map((membership) => membership.courseId),
  );
  const titleByCourseId = new Map(summaries.map((summary) => [summary.id, summary.title]));

  return memberships
    .filter((membership): membership is CourseMembership & { courseId: string } =>
      titleByCourseId.has(membership.courseId),
    )
    .map((membership) => ({
      courseId: membership.courseId,
      title: titleByCourseId.get(membership.courseId) as string,
      role: membership.role,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

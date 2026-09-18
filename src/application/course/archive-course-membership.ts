/**
 * archiveCourseMembership / unarchiveCourseMembership — the application-layer
 * use cases for ADR-015 §7/§9: archive is per-user, is independent of
 * revocation, and never removes access — it only excludes the Course from
 * that learner's active learning set (automatic Today). Self-service only:
 * a learner archives/unarchives their OWN membership, matching ADR-015's
 * framing of archive as "a fact about one learner's relationship to a
 * Course" — there is no product requirement for a management role to
 * archive on another user's behalf, so this slice does not add one.
 */
import type { CourseMembership, CourseRepositories } from "./ports";

export interface ArchiveCourseMembershipCommand {
  actorUserId: string;
  courseId: string;
}

export type ArchiveCourseMembershipResult =
  | { outcome: "ARCHIVED"; membership: CourseMembership }
  | { outcome: "NOT_MEMBER" };

export async function archiveCourseMembership(
  command: ArchiveCourseMembershipCommand,
  repos: CourseRepositories,
): Promise<ArchiveCourseMembershipResult> {
  const membership = await repos.memberships.setArchived(
    command.actorUserId,
    command.courseId,
    new Date(),
  );
  return membership === null
    ? { outcome: "NOT_MEMBER" }
    : { outcome: "ARCHIVED", membership };
}

export type UnarchiveCourseMembershipResult =
  | { outcome: "UNARCHIVED"; membership: CourseMembership }
  | { outcome: "NOT_MEMBER" };

export async function unarchiveCourseMembership(
  command: ArchiveCourseMembershipCommand,
  repos: CourseRepositories,
): Promise<UnarchiveCourseMembershipResult> {
  const membership = await repos.memberships.setArchived(
    command.actorUserId,
    command.courseId,
    null,
  );
  return membership === null
    ? { outcome: "NOT_MEMBER" }
    : { outcome: "UNARCHIVED", membership };
}

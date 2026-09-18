/**
 * revokeCourseMembership — the application-layer use case for ADR-015 §7:
 * a management action (OWNER/INSTRUCTOR) that removes a target user's
 * Course access without deleting the membership row or any learner history
 * (ADR-015 §8 — this function never touches Attempts/UserQuestionProgress,
 * and neither does `CourseMembershipRepository.revoke`, which only ever
 * issues an `UPDATE course_memberships`).
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { isManagementRole } from "../../domain/course/types";
import type { CourseMembership, CourseRepositories } from "./ports";

export interface RevokeCourseMembershipCommand {
  actorUserId: string;
  courseId: string;
  targetUserId: string;
}

export type RevokeCourseMembershipResult =
  | { outcome: "REVOKED"; membership: CourseMembership }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "NOT_MEMBER" };

export async function revokeCourseMembership(
  command: RevokeCourseMembershipCommand,
  repos: CourseRepositories,
): Promise<RevokeCourseMembershipResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );

  if (
    actorMembership === null ||
    actorMembership.revokedAt !== null ||
    !isManagementRole(actorMembership.role)
  ) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const updated = await repos.memberships.revoke(
    command.targetUserId,
    command.courseId,
    new Date(),
  );

  return updated === null
    ? { outcome: "NOT_MEMBER" }
    : { outcome: "REVOKED", membership: updated };
}

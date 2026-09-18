/**
 * setCourseJoinPolicy — the application-layer use case for changing a
 * Course's join policy, implementing ADR-015 §3: "only a Course-management
 * role (OWNER or INSTRUCTOR) on that specific Course may set it."
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { isManagementRole } from "../../domain/course/types";
import type { CourseJoinPolicy, CourseRepositories } from "./ports";

export interface SetCourseJoinPolicyCommand {
  actorUserId: string;
  courseId: string;
  joinPolicy: CourseJoinPolicy;
}

export type SetCourseJoinPolicyResult =
  | { outcome: "UPDATED"; joinPolicy: CourseJoinPolicy }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" };

export async function setCourseJoinPolicy(
  command: SetCourseJoinPolicyCommand,
  repos: CourseRepositories,
): Promise<SetCourseJoinPolicyResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );

  // No membership at all, a revoked membership, or a non-management role
  // are all NOT_AUTHORIZED — a learner (or a non-member, or a revoked
  // former member) may never change join policy, regardless of whether the
  // Course itself exists. Checking the actor's membership before the
  // Course's existence also means a caller with no legitimate relationship
  // to this Course never learns whether the courseId is valid.
  if (
    actorMembership === null ||
    actorMembership.revokedAt !== null ||
    !isManagementRole(actorMembership.role)
  ) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const updated = await repos.courses.setJoinPolicy(
    command.courseId,
    command.joinPolicy,
  );
  if (updated === null) {
    // Reachable only if the Course was deleted between the membership
    // lookup above and this write — not a normal V1 path (no code deletes
    // a Course), surfaced honestly rather than assumed impossible.
    return { outcome: "COURSE_NOT_FOUND" };
  }

  return { outcome: "UPDATED", joinPolicy: updated };
}

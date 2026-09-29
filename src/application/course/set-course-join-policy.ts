/**
 * setCourseJoinPolicy — the application-layer use case for changing a
 * Course's join policy, implementing ADR-015 §3: "only a Course-management
 * role (OWNER or INSTRUCTOR) on that specific Course may set it."
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { hasActiveAuthorGrant } from "../../domain/course/types";
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
  // No active `course_authors` grant at all (never granted, or granted then
  // revoked) is NOT_AUTHORIZED — a learner (or a non-member, or someone
  // whose authoring capability was revoked) may never change join policy,
  // regardless of whether the Course itself exists. Checking authorization
  // before the Course's existence also means a caller with no legitimate
  // relationship to this Course never learns whether the courseId is valid.
  const authorGrants = await repos.authors.findActiveCapabilities(
    command.actorUserId,
    command.courseId,
  );
  if (!hasActiveAuthorGrant(authorGrants)) {
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

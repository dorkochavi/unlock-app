/**
 * joinCourse — the application-layer use case for "an authenticated user
 * joins a Course as a LEARNER," implementing ADR-015 §4/§5.
 *
 * `actorUserId` is trusted as-is at this boundary, matching
 * `SubmitAnswerCommand.userId`'s existing precedent
 * (`src/application/learning/submit-answer.ts`) — deriving it from a real
 * authenticated principal, never client-supplied request data, is the
 * API boundary's job (`src/app/api/courses/[courseId]/join/route.ts`,
 * ADR-015 Consequences), not implemented here. This function does not fake
 * authentication; it simply does not implement it.
 *
 * Possession of a Course id/link is never itself authorization (ADR-015
 * §6) — this function never branches on "the caller knows the courseId,"
 * only on the Course's actual persisted `joinPolicy`.
 */
import { canSelfJoinCourse } from "../../domain/course/types";
import type { CourseMembership, CourseRepositories } from "./ports";

export interface JoinCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type JoinCourseResult =
  | { outcome: "JOINED"; membership: CourseMembership }
  | { outcome: "ALREADY_MEMBER"; membership: CourseMembership }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_FOUND" };

export async function joinCourse(
  command: JoinCourseCommand,
  repos: CourseRepositories,
): Promise<JoinCourseResult> {
  const eligibility = await repos.courses.getJoinEligibility(command.courseId);
  if (eligibility === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }

  if (!canSelfJoinCourse(eligibility)) {
    // AUTHORIZED_ONLY join_policy, or a non-PUBLISHED Course (DRAFT/
    // ARCHIVED — Run 005 S2 "Join behavior"): self-join must NOT silently
    // self-authorize (ADR-015 §5). No separate eligibility mechanism is
    // decided or implemented, so there is no further check to run — this
    // is a deliberate dead end, not an omission.
    return { outcome: "NOT_AUTHORIZED" };
  }

  const { membership, wasNew } = await repos.memberships.createMembership({
    userId: command.actorUserId,
    courseId: command.courseId,
    role: "LEARNER",
    joinedAt: new Date(),
    revokedAt: null,
    archivedAt: null,
  });

  return wasNew
    ? { outcome: "JOINED", membership }
    : { outcome: "ALREADY_MEMBER", membership };
}

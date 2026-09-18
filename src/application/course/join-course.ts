/**
 * joinCourse — the application-layer use case for "an authenticated user
 * joins a Course as a LEARNER," implementing ADR-015 §4/§5.
 *
 * `actorUserId` is trusted as-is at this boundary, matching
 * `SubmitAnswerCommand.userId`'s existing precedent
 * (`src/application/learning/submit-answer.ts`) — deriving it from a real
 * authenticated principal, never client-supplied request data, is the
 * future API boundary's job (`docs/API_V1_DRAFT.md`, ADR-015
 * Consequences), not implemented here. This function does not fake
 * authentication; it simply does not implement it.
 *
 * Possession of a Course id/link is never itself authorization (ADR-015
 * §6) — this function never branches on "the caller knows the courseId,"
 * only on the Course's actual persisted `joinPolicy`.
 */
import { canSelfJoin } from "../../domain/course/types";
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
  const joinPolicy = await repos.courses.getJoinPolicy(command.courseId);
  if (joinPolicy === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }

  if (!canSelfJoin(joinPolicy)) {
    // AUTHORIZED_ONLY: self-join must NOT silently self-authorize
    // (ADR-015 §5). No separate eligibility mechanism is decided or
    // implemented by this slice, so there is no further check to run —
    // this is a deliberate dead end, not an omission.
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

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
 *
 * RUN010-H.3 (FUB-036, Option 4 architecture, human decision 1, APPROVED
 * 2026-09-29): a narrow author self-enrollment exception. An active Course
 * Author (an active `course_authors` grant on THIS specific Course) may
 * self-enroll as an ordinary LEARNER even when `canSelfJoinCourse` would
 * otherwise deny it (DRAFT, AUTHORIZED_ONLY, ARCHIVED, or any other reason
 * that predicate returns false). This is a bypass of the eligibility GATE
 * only — the resulting `course_memberships` row is byte-identical to any
 * other learner's (plain `role: "LEARNER"`, `revokedAt: null`,
 * `archivedAt: null`) and gets no special treatment anywhere downstream
 * (Today/Practice/Attempts/Evidence/Progress/FSRS/Insights all read this row
 * exactly as they would for any learner — none of them consult
 * `course_authors` at all). Authoring capability itself never grants learner
 * eligibility on its own; this is the one narrow, Course-scoped exception the
 * approved decision authorizes — `findActiveCapabilities` is checked against
 * `command.courseId` specifically, never any other Course the actor might
 * also author.
 */
import { canSelfJoinCourse, hasActiveAuthorGrant } from "../../domain/course/types";
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
    // self-authorize (ADR-015 §5) UNLESS the actor is an active author of
    // this exact Course (RUN010-H.3's own narrow, approved exception — see
    // this module's doc comment).
    const authorGrants = await repos.authors.findActiveCapabilities(
      command.actorUserId,
      command.courseId,
    );
    if (!hasActiveAuthorGrant(authorGrants)) {
      return { outcome: "NOT_AUTHORIZED" };
    }
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

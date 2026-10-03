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
 * otherwise deny it for a setup/access-policy reason: a DRAFT Course or an
 * AUTHORIZED_ONLY join policy. This is a bypass of the eligibility GATE
 * only — the resulting `course_memberships` row is byte-identical to any
 * other learner's (plain `role: "LEARNER"`, `revokedAt: null`,
 * `archivedAt: null`) and gets no special treatment anywhere downstream
 * (Today/Practice/Attempts/Evidence/Progress/FSRS/Insights all read this row
 * exactly as they would for any learner — none of them consult
 * `course_authors` at all). Authoring capability itself never grants learner
 * eligibility on its own; `findActiveCapabilities` is checked against
 * `command.courseId` specifically, never any other Course the actor might
 * also author.
 *
 * OQ-045 (human decision, POST-RUN010-PRODUCT-FIX-001, Option B): ARCHIVED is
 * a terminal lifecycle hard-stop for NEW enrollment, even for an active
 * Course Author — the bypass above does NOT cover ARCHIVED. An author with an
 * existing ACTIVE membership in an ARCHIVED Course still gets the idempotent
 * `ALREADY_MEMBER` (nothing is created, mutated, or revoked). An existing
 * NON-active (revoked/archived) membership in an ARCHIVED Course fails closed
 * with `NOT_AUTHORIZED` (OQ-043 revoke/rejoin semantics remain unresolved;
 * none are invented here).
 */
import { canSelfJoinCourse, hasActiveAuthorGrant, isActiveMembership } from "../../domain/course/types";
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
    // this exact Course AND the Course is not ARCHIVED (RUN010-H.3's narrow
    // exception covers DRAFT/AUTHORIZED_ONLY only — see this module's doc
    // comment).
    const authorGrants = await repos.authors.findActiveCapabilities(
      command.actorUserId,
      command.courseId,
    );
    if (!hasActiveAuthorGrant(authorGrants)) {
      return { outcome: "NOT_AUTHORIZED" };
    }
    if (eligibility.status === "ARCHIVED") {
      // OQ-045 Option B: hard-stop for NEW enrollment, authors included.
      // Only an existing ACTIVE LEARNER membership stays idempotent; anything
      // else (none, revoked, archived, other role) fails closed, no mutation.
      const existing = await repos.memberships.findMembership(
        command.actorUserId,
        command.courseId,
      );
      if (existing !== null && existing.role === "LEARNER" && isActiveMembership(existing)) {
        return { outcome: "ALREADY_MEMBER", membership: existing };
      }
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

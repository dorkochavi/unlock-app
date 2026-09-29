/**
 * getCourseContextForLearner — the application-layer use case behind
 * Learner Course View V1 (Run 004 Slice 4): course context for a learner
 * who may legitimately access this Course, using only currently supported
 * data (Course title + the caller's own membership state).
 *
 * This is deliberately NOT the public `CourseRepository.getCourseSummary`
 * path (`GET /api/courses/:courseId`) — that route is intentionally
 * unauthenticated for the pre-join join-page display. Course View is the
 * opposite case: it requires the caller to already have a real
 * `CourseMembership`, and fails closed otherwise, matching this Slice's
 * "fail safely for a user without allowed course access" requirement.
 *
 * Does not create an independent per-course Today/plan — this function only
 * reads a Course summary and the caller's own membership row.
 *
 * RUN010-H.2 (FUB-036, Option 4 architecture, required DTO/API surface
 * change): a Course created after this Slice has NO `course_memberships`
 * row at all for its creator (`create-course.ts` now grants `course_authors`
 * only — RUN010-H.3's self-enrollment bypass does not exist yet). Without a
 * change here, that creator would get `NOT_A_MEMBER` calling this endpoint
 * for their own brand-new Course. `isAuthor` is therefore threaded through
 * as a genuinely independent signal (sourced from `course_authors`, never
 * derived from `membership.role`): when no membership row exists AND the
 * actor holds an active author grant, this now returns `READY` with
 * `membership: null` instead of `NOT_A_MEMBER`. When a membership row DOES
 * exist, behavior is unchanged (`isAuthor` is simply added alongside it).
 */
import { hasActiveAuthorGrant } from "../../domain/course/types";
import { isPracticeEligible } from "../practice/practice-eligibility";
import type { CourseMembership, CourseRepositories, CourseSummary } from "./ports";

export interface GetCourseContextForLearnerCommand {
  actorUserId: string;
  courseId: string;
}

export type GetCourseContextForLearnerResult =
  | { outcome: "COURSE_NOT_FOUND" }
  | { outcome: "NOT_A_MEMBER" }
  | { outcome: "ACCESS_REVOKED" }
  | {
      outcome: "READY";
      course: CourseSummary;
      /**
       * `null` only when the actor has no `course_memberships` row at all —
       * reachable only via `isAuthor: true` (a Part-B-created Course's
       * creator, pre-H.3 self-enrollment). A real learner/author WITH a
       * membership row always gets it populated, exactly as before this
       * Slice.
       */
      membership: CourseMembership | null;
      /** RUN010-H.2 — independent `course_authors` signal, never derived from `membership.role`. */
      isAuthor: boolean;
      /**
       * Server-computed (Run UX-02, ADR-020 §6): LEARNER + active non-archived
       * membership + PUBLISHED Course. The client never derives this itself.
       * Always `false` when `membership` is `null` — an author with no
       * learner enrollment has nothing to practice as a learner.
       */
      practiceAvailable: boolean;
    };

export async function getCourseContextForLearner(
  command: GetCourseContextForLearnerCommand,
  repos: CourseRepositories,
): Promise<GetCourseContextForLearnerResult> {
  const course = await repos.courses.getCourseSummary(command.courseId);
  if (course === null) {
    return { outcome: "COURSE_NOT_FOUND" };
  }

  const membership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  const authorGrants = await repos.authors.findActiveCapabilities(
    command.actorUserId,
    command.courseId,
  );
  const isAuthor = hasActiveAuthorGrant(authorGrants);

  if (membership === null) {
    if (!isAuthor) {
      // Possession of a valid Course id is never itself authorization
      // (ADR-015 §6, same principle `joinCourse` already applies) — an
      // authenticated user with no membership row and no author grant
      // gets the same fail-closed outcome as an AUTHORIZED_ONLY non-member.
      return { outcome: "NOT_A_MEMBER" };
    }
    return { outcome: "READY", course, membership: null, isAuthor: true, practiceAvailable: false };
  }
  if (membership.revokedAt !== null) {
    return { outcome: "ACCESS_REVOKED" };
  }

  const practiceAvailable = await isPracticeEligible(
    repos,
    command.actorUserId,
    command.courseId,
  );

  return { outcome: "READY", course, membership, isAuthor, practiceAvailable };
}

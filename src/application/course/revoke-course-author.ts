/**
 * revokeCourseAuthor — the application-layer use case for revoking a
 * `course_authors` management-capability grant (RUN010-H.3, FUB-036 Option 4
 * architecture). Mirrors `revokeCourseMembership`'s own shape/style
 * deliberately closely (`src/application/course/revoke-course-membership.ts`)
 * — same trust boundary for `actorUserId`, same "authorize, then write"
 * structure.
 *
 * Implements the approved last-author-protection decision (human decision 2,
 * APPROVED 2026-09-29): fails closed with the explicit `LAST_AUTHOR` outcome
 * — never a generic error, and no row mutated — if revoking this specific
 * grant would leave this Course with zero active `course_authors` rows.
 * `CourseAuthorRepository.revoke`'s own doc comment
 * (`src/application/course/ports.ts`) explicitly defers this exact
 * protection to this caller.
 *
 * `actorUserId` is trusted as-is at this boundary — see `join-course.ts`'s
 * module doc comment for why.
 */
import { hasActiveAuthorGrant } from "../../domain/course/types";
import type { CourseAuthorCapability, CourseAuthorGrant, CourseRepositories } from "./ports";

export interface RevokeCourseAuthorCommand {
  actorUserId: string;
  courseId: string;
  targetUserId: string;
  capability: CourseAuthorCapability;
}

export type RevokeCourseAuthorResult =
  | { outcome: "REVOKED"; grant: CourseAuthorGrant }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "NOT_A_GRANT_HOLDER" }
  | { outcome: "LAST_AUTHOR" };

export async function revokeCourseAuthor(
  command: RevokeCourseAuthorCommand,
  repos: CourseRepositories,
): Promise<RevokeCourseAuthorResult> {
  const actorGrants = await repos.authors.findActiveCapabilities(
    command.actorUserId,
    command.courseId,
  );
  if (!hasActiveAuthorGrant(actorGrants)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  // Read every active grant on this Course BEFORE writing, so the
  // last-author check sees the pre-revoke state (the same accepted
  // check-then-write race window this module's other use cases already
  // document — see `ports.ts`'s `CourseAuthorRepository.revoke` doc comment).
  const activeGrantsForCourse = await repos.authors.listActiveForCourse(command.courseId);
  const targetGrant = activeGrantsForCourse.find(
    (grant) =>
      grant.userId === command.targetUserId && grant.capability === command.capability,
  );
  if (targetGrant === undefined) {
    return { outcome: "NOT_A_GRANT_HOLDER" };
  }
  if (activeGrantsForCourse.length === 1) {
    // Revoking this grant would leave a non-deleted Course with zero active
    // course_authors rows — fail closed (approved last-author-protection
    // decision). Nothing mutated.
    return { outcome: "LAST_AUTHOR" };
  }

  const updated = await repos.authors.revoke(
    command.targetUserId,
    command.courseId,
    command.capability,
    new Date(),
  );

  // `null` is reachable only via a genuine race between the pre-check above
  // and this write (a concurrent revoke of the exact same grant) — treated
  // the same as "no matching grant" rather than throwing.
  return updated === null
    ? { outcome: "NOT_A_GRANT_HOLDER" }
    : { outcome: "REVOKED", grant: updated };
}

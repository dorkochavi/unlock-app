/**
 * UNLOCK Course Membership V1 domain contracts — ADR-015.
 *
 * `CourseMembership` is the single explicit User<->Course relationship;
 * there is no other path to Course access (ADR-015 §1). This module
 * contains pure types and pure policy functions only — no persistence, no
 * IO, matching `docs/ARCHITECTURE.md`'s domain/application/infrastructure
 * separation (`docs/ARCHITECTURE.md` §20/§29 for the "small explicit types,
 * not a generic abstraction" precedent `src/domain/learning/` already
 * follows).
 */

export const COURSE_ROLES = ["OWNER", "INSTRUCTOR", "LEARNER"] as const;
export type CourseRole = (typeof COURSE_ROLES)[number];

/** OWNER and INSTRUCTOR may manage Course content and membership (ADR-015 §2). */
export const MANAGEMENT_COURSE_ROLES: readonly CourseRole[] = [
  "OWNER",
  "INSTRUCTOR",
];

export function isManagementRole(role: CourseRole): boolean {
  return (MANAGEMENT_COURSE_ROLES as readonly string[]).includes(role);
}

export const COURSE_JOIN_POLICIES = ["AUTHORIZED_ONLY", "OPEN"] as const;
export type CourseJoinPolicy = (typeof COURSE_JOIN_POLICIES)[number];

/**
 * Run 005 S2. DRAFT: instructor setup/editing state, not intended for
 * learner onboarding/normal participation. PUBLISHED: available according
 * to join policy and normal learner flows. ARCHIVED: no longer active for
 * normal learner participation; historical data remains preserved. Do not
 * infer delete semantics from ARCHIVED.
 */
export const COURSE_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type CourseStatus = (typeof COURSE_STATUSES)[number];

/**
 * The single explicit User<->Course relationship (ADR-015 §1). `revokedAt`
 * and `archivedAt` are independent facts, never conflated (ADR-015 §7):
 *
 * - `revokedAt` null = currently has access; non-null = access revoked.
 * - `archivedAt` null = participates in this learner's active learning set;
 *   non-null = excluded from automatic Today for this learner only, while
 *   remaining accessible and manually practiceable (ADR-015 §7, §9).
 */
export interface CourseMembership {
  id: string;
  userId: string;
  courseId: string;
  role: CourseRole;
  joinedAt: Date;
  revokedAt: Date | null;
  archivedAt: Date | null;
}

/**
 * A membership currently grants Course access. Revocation is the only fact
 * that removes access (ADR-015 §7) — archive status does not.
 */
export function hasAccess(membership: CourseMembership): boolean {
  return membership.revokedAt === null;
}

/**
 * A membership participates in this learner's active learning set:
 * currently has access AND is not archived (ADR-015 §7, §9). Used to
 * exclude both revoked and archived memberships from automatic
 * active-Course enumeration (`CourseMembershipRepository.listActiveForUser`,
 * used by `listMyCourses` and DailyPlan course discovery). The predicate
 * itself belongs in domain code since it is pure policy, not a persistence
 * concern.
 */
export function isActiveMembership(membership: CourseMembership): boolean {
  return hasAccess(membership) && membership.archivedAt === null;
}

/**
 * ADR-015 §4/§5: whether an authenticated user's self-join attempt against
 * a Course with the given join policy is currently allowed. `OPEN` always
 * allows self-join as `LEARNER`. `AUTHORIZED_ONLY` never allows self-join
 * through this predicate — ADR-015 §5 explicitly does not decide (and this
 * slice does not implement) any separate eligibility mechanism, so
 * `AUTHORIZED_ONLY` self-join has no path to success in V1. This is a pure
 * policy decision, not a stand-in that a future eligibility check merely
 * refines — a real future eligibility mechanism is a distinct, additional
 * authorization input, not a change to this function's meaning for the
 * plain self-join case.
 */
export function canSelfJoin(joinPolicy: CourseJoinPolicy): boolean {
  return joinPolicy === "OPEN";
}

/**
 * Run 005 S2: learner self-join additionally requires the Course itself to
 * be PUBLISHED — a DRAFT Course is instructor setup/editing state, and an
 * ARCHIVED Course is no longer active for normal learner participation
 * (Run 005 CHATGPT_PLAN.md "Course lifecycle" / "Join behavior"), regardless
 * of `join_policy`. `join_policy` alone (`canSelfJoin`) still governs OPEN
 * vs AUTHORIZED_ONLY for an otherwise-eligible PUBLISHED Course.
 */
export function canSelfJoinCourse(course: {
  status: CourseStatus;
  joinPolicy: CourseJoinPolicy;
}): boolean {
  return course.status === "PUBLISHED" && canSelfJoin(course.joinPolicy);
}

/**
 * Run 005 S2: default Run-005 authoring authorization (Run 005
 * CHATGPT_PLAN.md S1 "Important authorization decision") — OWNER and active
 * INSTRUCTOR may author Course/Topic/Question content; LEARNER may not;
 * revoked OR archived management memberships fail closed. Deliberately
 * stricter than `isManagementRole` alone (existing management actions like
 * `setCourseJoinPolicy` only check `revokedAt`, not `archivedAt` — Run 005's
 * authoring surface is new product scope with its own explicit fail-closed
 * requirement, not a retroactive change to that earlier behavior).
 */
export function canAuthorCourse(membership: CourseMembership): boolean {
  return (
    hasAccess(membership) &&
    membership.archivedAt === null &&
    isManagementRole(membership.role)
  );
}

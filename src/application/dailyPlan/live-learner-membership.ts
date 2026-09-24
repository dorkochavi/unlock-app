/**
 * Live membership authorization for mutating an EXISTING DailyPlanItem
 * (answer / skip) — F-04a.
 *
 * DailyPlan generation only admits Courses with an active LEARNER membership
 * (`get-or-create-daily-plan-for-today.ts`), but the DailyPlan freeze
 * (ADR-016) covers content/order, not authorization. A membership revoked or
 * archived AFTER the plan was generated must not let the learner keep
 * mutating that Course's items (ADR-015: revoked => Course no longer
 * accessible to the learner).
 *
 * Uses the domain's `hasAccess` (not revoked — the ONLY fact that removes
 * access, ADR-015 §7) plus `role === "LEARNER"` (the role that generation
 * admits). It deliberately does NOT use `isActiveMembership`: `archivedAt` is
 * the learner's own per-user "hide from automatic Today" flag, and ADR-015
 * §7/§9 + ADR-016 §16 state an archived membership remains accessible and
 * manually practiceable, so archiving after generation must not lock the
 * learner out of an existing item. Deliberately does NOT look at the
 * Course's own status: Course PUBLISHED -> ARCHIVED after generation is a
 * separate, still-undecided question (F-04b).
 *
 * Race note: this is a read before the mutation, not a lock. A revoke that
 * commits between this check and the write can still let that single
 * in-flight request through; no strict revoke-vs-answer serialization is
 * claimed.
 */
import { hasAccess } from "../../domain/course/types";
import type { CourseMembershipRepository } from "../course/ports";

export type LiveLearnerMembershipLookup = Pick<CourseMembershipRepository, "findMembership">;

export async function hasActiveLearnerMembership(
  memberships: LiveLearnerMembershipLookup,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const membership = await memberships.findMembership(userId, courseId);
  return membership !== null && membership.role === "LEARNER" && hasAccess(membership);
}

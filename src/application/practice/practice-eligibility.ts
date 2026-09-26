/**
 * Practice eligibility V1 (ADR-020 §6/§7): PUBLISHED Course AND an ACTIVE
 * (not revoked, not archived) LEARNER membership. Fails closed: any missing
 * fact means "not eligible". This is the ONE definition — batch selection,
 * answer submission and the server-computed `practiceAvailable` all use it.
 *
 * Deliberately stricter than ADR-016 §16 (archived membership stays
 * practiceable) — an explicit temporary deviation recorded in ADR-020 §7.
 */
import { isActiveMembership } from "../../domain/course/types";
import type { CourseMembershipRepository, CourseRepository } from "../course/ports";

export interface PracticeEligibilityPorts {
  memberships: Pick<CourseMembershipRepository, "findMembership">;
  courses: Pick<CourseRepository, "listStatuses">;
}

export async function isPracticeEligible(
  ports: PracticeEligibilityPorts,
  userId: string,
  courseId: string,
): Promise<boolean> {
  const membership = await ports.memberships.findMembership(userId, courseId);
  if (membership === null || membership.role !== "LEARNER" || !isActiveMembership(membership)) {
    return false;
  }
  const statuses = await ports.courses.listStatuses([courseId]);
  return statuses.some((course) => course.id === courseId && course.status === "PUBLISHED");
}

/** Ids reach uuid columns; a malformed id is treated as "not found", never a DB crash. */
export { isUuid } from "../../lib/uuid";

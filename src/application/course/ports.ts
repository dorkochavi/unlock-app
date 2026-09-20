/**
 * Persistence ports for the course-membership application layer — ADR-015.
 *
 * Small, explicit interfaces, not a generic `Repository<T>`
 * (`docs/ARCHITECTURE.md` §20/§29, same discipline `src/application/
 * learning/ports.ts` already follows). No Postgres/Supabase types leak into
 * any of these signatures.
 *
 * No `UnitOfWork`/transaction wrapper exists here, deliberately: unlike
 * `submitAnswer` (ADR-010), no operation in this slice needs multiple
 * statements to be atomic together. `joinCourse` is race-free by a single
 * `INSERT ... ON CONFLICT DO NOTHING` (mirroring `TodaySessionRepository
 * .createIfNotExists`); `setJoinPolicy`/`setArchived`/`revoke` are each a
 * single conditional `UPDATE`. The narrow read-then-write window in
 * `setCourseJoinPolicy`/`revokeCourseMembership` (checking the actor's
 * management role, then writing) is an accepted, non-corrupting race for
 * this V1 slice — a demoted actor could in principle still complete one
 * in-flight write — not a data-integrity concern, since every constraint
 * this migration cares about (valid role/join_policy values, one
 * membership per user/Course) is enforced by the database regardless.
 */
import type { CourseJoinPolicy, CourseMembership, CourseRole } from "../../domain/course/types";

export type { CourseMembership };

export interface CourseMembershipRepository {
  /** Any membership for this (userId, courseId) pair, in any state. */
  findMembership(
    userId: string,
    courseId: string,
  ): Promise<CourseMembership | null>;

  /**
   * Race-free by construction (`INSERT ... ON CONFLICT (user_id, course_id)
   * DO NOTHING RETURNING`, mirroring `TodaySessionRepository
   * .createIfNotExists`). `wasNew: false` means a membership for this pair
   * already existed — the returned `membership` is that pre-existing row
   * (in whatever state it is in — revoked or archived included), NOT the
   * one passed in. This port does not itself decide what a caller should do
   * with a pre-existing membership; that is `joinCourse`
   * (`src/application/course/join-course.ts`)'s job.
   */
  createMembership(
    membership: Omit<CourseMembership, "id">,
  ): Promise<{ membership: CourseMembership; wasNew: boolean }>;

  /**
   * Every membership for `userId` that currently participates in that
   * learner's active learning set: `revokedAt IS NULL AND archivedAt IS
   * NULL` (`isActiveMembership`, `src/domain/course/types.ts`).
   */
  listActiveForUser(userId: string): Promise<CourseMembership[]>;

  /**
   * Sets `archivedAt` to `archivedAt` (a Date to archive, `null` to
   * unarchive). Returns the updated membership, or `null` if no membership
   * exists for this `(userId, courseId)` pair. Does not touch `revokedAt`.
   */
  setArchived(
    userId: string,
    courseId: string,
    archivedAt: Date | null,
  ): Promise<CourseMembership | null>;

  /**
   * Sets `revokedAt`. Returns the updated membership, or `null` if no
   * membership exists for this `(userId, courseId)` pair. Never deletes the
   * row and never touches any learner-history table (ADR-015 §8) — this
   * method has no way to, since it only ever issues an `UPDATE
   * course_memberships`.
   */
  revoke(
    userId: string,
    courseId: string,
    revokedAt: Date,
  ): Promise<CourseMembership | null>;
}

/**
 * Deliberately minimal — `id`/`title` only. Never `owner_user_id`,
 * `join_policy`, or any other admin-only field (Night-Run Slice 6 §6G:
 * "Do not expose admin-only metadata"). Used for the public join-page
 * display only, before the actual join decision is made.
 */
export interface CourseSummary {
  id: string;
  title: string;
}

export interface CourseRepository {
  /** `null` if the Course does not exist. */
  getJoinPolicy(courseId: string): Promise<CourseJoinPolicy | null>;

  /** `null` if the Course does not exist. Public-safe read — see `CourseSummary`. */
  getCourseSummary(courseId: string): Promise<CourseSummary | null>;

  /**
   * Returns `null` if the Course does not exist; otherwise the join policy
   * actually persisted after the write (always equal to `joinPolicy`).
   * Does not itself check the caller's authorization — that is
   * `setCourseJoinPolicy` (`src/application/course/set-course-join-policy.ts`)'s
   * job (ADR-015 §3: "only a Course-management role... may set it").
   */
  setJoinPolicy(
    courseId: string,
    joinPolicy: CourseJoinPolicy,
  ): Promise<CourseJoinPolicy | null>;
}

export type { CourseJoinPolicy, CourseRole };

export interface CourseRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
}

/**
 * Persistence ports for the course-membership application layer — ADR-015.
 *
 * Small, explicit interfaces, not a generic `Repository<T>`
 * (`docs/ARCHITECTURE.md` §20/§29, same discipline `src/application/
 * learning/ports.ts` already follows). No Postgres/Supabase types leak into
 * any of these signatures.
 *
 * No `UnitOfWork`/transaction wrapper exists for MOST operations here,
 * deliberately: unlike `submitAnswer` (ADR-010), most operations in this
 * module need only one statement to be atomic. `joinCourse` is race-free by
 * a single `INSERT ... ON CONFLICT DO NOTHING` (mirroring
 * `TodaySessionRepository.createIfNotExists`); `setJoinPolicy`/
 * `setArchived`/`revoke`/`updateCourseMetadata`/`setCourseStatus` are each a
 * single conditional `UPDATE`. The narrow read-then-write window in
 * `setCourseJoinPolicy`/`revokeCourseMembership` (checking the actor's
 * management role, then writing) is an accepted, non-corrupting race for
 * this V1 slice — a demoted actor could in principle still complete one
 * in-flight write — not a data-integrity concern, since every constraint
 * this migration cares about (valid role/join_policy values, one
 * membership per user/Course) is enforced by the database regardless.
 * `createCourse` (Run 005 S2) IS the one genuine exception — it writes
 * across two repositories (`courses` + the creator's OWNER
 * `course_memberships`) that must commit or roll back together, so it is
 * the only operation routed through `CourseUnitOfWork` below rather than
 * `CourseRepositories` directly (Run 005 S2 DB review finding).
 */
import type { CourseJoinPolicy, CourseMembership, CourseRole, CourseStatus } from "../../domain/course/types";

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

/**
 * Full authoring-only view of a Course — id/title/status/joinPolicy/examDate
 * plus timestamps. NEVER the same projection as `CourseSummary` (learner
 * join-page) or the learner-facing Course View read: this record is only
 * ever returned to an already-authorized OWNER/INSTRUCTOR caller (Run 005
 * S2 "Authorization").
 */
export interface CourseAuthoringRecord {
  id: string;
  title: string;
  status: CourseStatus;
  joinPolicy: CourseJoinPolicy;
  /** `YYYY-MM-DD`, or `null` if unset (`row-validation.ts`'s `readDateOnlyString` convention). */
  examDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCourseInput {
  ownerUserId: string;
  title: string;
  examDate: string | null;
}

export interface UpdateCourseMetadataInput {
  title?: string;
  examDate?: string | null;
}

export interface CourseRepository {
  /** `null` if the Course does not exist. */
  getJoinPolicy(courseId: string): Promise<CourseJoinPolicy | null>;

  /**
   * `null` if the Course does not exist. Narrow read used only by
   * `joinCourse` (Run 005 S2 "Join behavior") to decide learner self-join
   * eligibility — deliberately not the full `CourseAuthoringRecord`, which
   * carries admin-only fields this join-eligibility check has no reason to
   * touch.
   */
  getJoinEligibility(
    courseId: string,
  ): Promise<{ status: CourseStatus; joinPolicy: CourseJoinPolicy } | null>;

  /** `null` if the Course does not exist. Public-safe read — see `CourseSummary`. */
  getCourseSummary(courseId: string): Promise<CourseSummary | null>;

  /**
   * Batched form of `getCourseSummary` for listing several Courses at once
   * (e.g. My Courses) without one query per Course. Returns only the
   * summaries that exist — silently omits any `courseId` with no matching
   * row rather than throwing, since a membership referencing a since-deleted
   * Course is a caller-side concern, not this port's. Order is not
   * guaranteed to match `courseIds`.
   */
  getCourseSummaries(courseIds: string[]): Promise<CourseSummary[]>;

  /**
   * Batched Course-status lookup (Run 008 S4) — silently omits any
   * `courseId` with no matching row, same convention as
   * `getCourseSummaries`. Used to gate automatic learner-facing DailyPlan
   * eligibility by Course lifecycle status
   * (`get-or-create-daily-plan-for-today.ts`): an ARCHIVED Course is "no
   * longer active for normal learner participation" (`canSelfJoinCourse`'s
   * own doc comment, Run 005 CHATGPT_PLAN.md "Course lifecycle"/"Join
   * behavior") — that already-accepted rule was enforced at join time but
   * not yet for an existing membership whose Course is archived afterward.
   * Deliberately independent of `CourseSummary` (the learner-display
   * projection, `id`/`title` only) — status is a separate, narrower read
   * for a separate purpose.
   */
  listStatuses(courseIds: string[]): Promise<{ id: string; status: CourseStatus }[]>;

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

  /** New Courses always start DRAFT (Run 005 S3 "Do not auto-publish a Course merely because it was created"). */
  createCourse(input: CreateCourseInput): Promise<CourseAuthoringRecord>;

  /** `null` if the Course does not exist. Authoring-only — see `CourseAuthoringRecord`. */
  getCourseForAuthoring(courseId: string): Promise<CourseAuthoringRecord | null>;

  /**
   * Updates only the fields present in `input` (`title`/`examDate` each
   * independently optional — `examDate: null` explicitly clears it, `undefined`/absent
   * leaves it unchanged). Returns `null` if the Course does not exist.
   */
  updateCourseMetadata(
    courseId: string,
    input: UpdateCourseMetadataInput,
  ): Promise<CourseAuthoringRecord | null>;

  /**
   * Unconditional status write — the *legality* of the transition (Run 005
   * S2 "invalid transition behavior") is an application-layer concern
   * (`publish-course.ts`/`archive-course.ts`), not this port's. Returns
   * `null` if the Course does not exist.
   */
  setCourseStatus(
    courseId: string,
    status: CourseStatus,
  ): Promise<CourseAuthoringRecord | null>;
}

export type { CourseJoinPolicy, CourseRole, CourseStatus };

export interface CourseRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
}

/**
 * Transaction boundary for Course use cases that must write across more
 * than one repository atomically — currently only `createCourse`
 * (`courses` insert + the creator's OWNER `course_memberships` insert; Run
 * 005 S2 DB review finding). Every other write in this module is a single
 * UPDATE statement and is therefore already atomic without this — do not
 * route them through a transaction merely for uniformity. Mirrors
 * `src/application/learning/ports.ts`'s `UnitOfWork` shape, narrowed to
 * this module's own `CourseRepositories`.
 */
export interface CourseUnitOfWork {
  runInTransaction<T>(fn: (repos: CourseRepositories) => Promise<T>): Promise<T>;
}

/**
 * In-memory fakes for the course-membership application layer's persistence
 * ports — proves application-layer orchestration semantics only (policy
 * checks, idempotent join, the "no rows found" cases), not PostgreSQL
 * constraint/race behavior. Mirrors
 * `src/application/learning/__tests__/in-memory-fakes.ts`'s own scope note.
 */
import type {
  CourseAuthoringRecord,
  CourseAuthorGrant,
  CourseAuthorRepository,
  CourseJoinPolicy,
  CourseMembership,
  CourseMembershipRepository,
  CourseRepositories,
  CourseRepository,
  CourseUnitOfWork,
} from "../ports";
import {
  isActiveAuthorGrant,
  isManagementRole,
  type CourseAuthorCapability,
  type CourseStatus,
} from "../../../domain/course/types";

function key(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

function authorKey(userId: string, courseId: string, capability: CourseAuthorCapability): string {
  return `${userId}:${courseId}:${capability}`;
}

let nextId = 1;
function nextMembershipId(): string {
  return `membership-${nextId++}`;
}

let nextCourseId = 1;
function nextCourseIdValue(): string {
  return `course-${nextCourseId++}`;
}

let nextAuthorGrantSeq = 1;
function nextAuthorGrantId(): string {
  return `author-grant-${nextAuthorGrantSeq++}`;
}

export class InMemoryCourseDatabase {
  private memberships = new Map<string, CourseMembership>();
  /** RUN010-H.2 — mirrors `course_authors`; auto-populated from `seedMembership` (see its own doc comment) plus the explicit `seedAuthorGrant`/`revokeAuthorGrant` helpers for author-only (no-membership) fixtures. */
  private authorGrants = new Map<string, CourseAuthorGrant>();
  private joinPolicies = new Map<string, CourseJoinPolicy>();
  private courseTitles = new Map<string, string>();
  /** Defaults to PUBLISHED for `seedCourse` — matches Run 005 S2's real
   *  migration backfill for pre-existing Courses, so every test written
   *  before Run 005 keeps passing without modification. */
  private courseStatuses = new Map<string, CourseStatus>();
  private courseExamDates = new Map<string, string | null>();
  private courseTimestamps = new Map<string, { createdAt: Date; updatedAt: Date }>();

  /** Test setup helper — not part of any port. */
  seedCourse(
    courseId: string,
    joinPolicy: CourseJoinPolicy = "AUTHORIZED_ONLY",
    title = "Test Course",
    status: CourseStatus = "PUBLISHED",
  ): void {
    this.joinPolicies.set(courseId, joinPolicy);
    this.courseTitles.set(courseId, title);
    this.courseStatuses.set(courseId, status);
    if (!this.courseExamDates.has(courseId)) {
      this.courseExamDates.set(courseId, null);
    }
    if (!this.courseTimestamps.has(courseId)) {
      const now = new Date();
      this.courseTimestamps.set(courseId, { createdAt: now, updatedAt: now });
    }
  }

  private authoringRecord(courseId: string): CourseAuthoringRecord | null {
    const title = this.courseTitles.get(courseId);
    const status = this.courseStatuses.get(courseId);
    const joinPolicy = this.joinPolicies.get(courseId);
    const timestamps = this.courseTimestamps.get(courseId);
    if (title === undefined || status === undefined || joinPolicy === undefined || timestamps === undefined) {
      return null;
    }
    return {
      id: courseId,
      title,
      status,
      joinPolicy,
      examDate: this.courseExamDates.get(courseId) ?? null,
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
    };
  }

  /**
   * Test setup helper — not part of any port. Also defaults the
   * membership's Course to `PUBLISHED` if no status was explicitly seeded
   * for it yet (same default/rationale as `seedCourse` above: a real
   * `course_memberships` row's `course_id` always has a matching `courses`
   * row via FK, so a membership without an explicitly seeded Course status
   * should not silently behave as if the Course doesn't exist — this keeps
   * every test written before Run 008 S4's `listStatuses` passing without
   * modification, matching `seedCourse`'s own stated precedent).
   */
  seedMembership(membership: CourseMembership): void {
    this.memberships.set(key(membership.userId, membership.courseId), membership);
    if (!this.courseStatuses.has(membership.courseId)) {
      this.courseStatuses.set(membership.courseId, "PUBLISHED");
    }
    // RUN010-H.2 — mirrors RUN010-H.1's real migration backfill exactly:
    // every OWNER/INSTRUCTOR membership also gets an active `course_authors`
    // grant, preserving `revokedAt` (a revoked management membership backfills
    // as a revoked grant, never silently reactivated). LEARNER rows never
    // produce a grant. `archivedAt` has no equivalent on `course_authors` at
    // all (`hasActiveAuthorGrant`'s own doc comment) — deliberately NOT
    // consulted here, matching the real backfill/migration exactly.
    if (isManagementRole(membership.role)) {
      const capability = membership.role as CourseAuthorCapability;
      const k = authorKey(membership.userId, membership.courseId, capability);
      this.authorGrants.set(k, {
        id: this.authorGrants.get(k)?.id ?? nextAuthorGrantId(),
        userId: membership.userId,
        courseId: membership.courseId,
        capability,
        grantedAt: membership.joinedAt,
        revokedAt: membership.revokedAt,
      });
    }
  }

  /**
   * Test setup helper — not part of any port. For an author-only fixture (no
   * `course_memberships` row at all), e.g. proving a Part-B-created Course's
   * creator is authorized purely via `course_authors`.
   */
  seedAuthorGrant(grant: Omit<CourseAuthorGrant, "id">): CourseAuthorGrant {
    const k = authorKey(grant.userId, grant.courseId, grant.capability);
    const full: CourseAuthorGrant = { ...grant, id: nextAuthorGrantId() };
    this.authorGrants.set(k, full);
    return full;
  }

  /** Test setup helper — not part of any port. */
  revokeAuthorGrant(userId: string, courseId: string, capability: CourseAuthorCapability, revokedAt: Date): void {
    const k = authorKey(userId, courseId, capability);
    const existing = this.authorGrants.get(k);
    if (existing) {
      this.authorGrants.set(k, { ...existing, revokedAt });
    }
  }

  repos(): CourseRepositories {
    const authors: CourseAuthorRepository = {
      findActiveCapabilities: async (userId, courseId) => {
        return [...this.authorGrants.values()].filter(
          (g) => g.userId === userId && g.courseId === courseId && isActiveAuthorGrant(g),
        );
      },
      listActiveForUser: async (userId) => {
        return [...this.authorGrants.values()].filter(
          (g) => g.userId === userId && isActiveAuthorGrant(g),
        );
      },
      listActiveForCourse: async (courseId) => {
        return [...this.authorGrants.values()].filter(
          (g) => g.courseId === courseId && isActiveAuthorGrant(g),
        );
      },
      listActiveForCourseForUpdate: async (courseId) => {
        return [...this.authorGrants.values()].filter(
          (g) => g.courseId === courseId && isActiveAuthorGrant(g),
        );
      },
      grant: async (grant) => {
        const k = authorKey(grant.userId, grant.courseId, grant.capability);
        const existing = this.authorGrants.get(k);
        if (existing) {
          return { grant: existing, wasNew: false };
        }
        const full: CourseAuthorGrant = { ...grant, id: nextAuthorGrantId() };
        this.authorGrants.set(k, full);
        return { grant: full, wasNew: true };
      },
      revoke: async (userId, courseId, capability, revokedAt) => {
        const k = authorKey(userId, courseId, capability);
        const existing = this.authorGrants.get(k);
        if (!existing) return null;
        const updated = { ...existing, revokedAt };
        this.authorGrants.set(k, updated);
        return updated;
      },
    };

    const memberships: CourseMembershipRepository = {
      findMembership: async (userId, courseId) => {
        return this.memberships.get(key(userId, courseId)) ?? null;
      },
      createMembership: async (membership) => {
        const k = key(membership.userId, membership.courseId);
        const existing = this.memberships.get(k);
        if (existing) {
          return { membership: existing, wasNew: false };
        }
        const full: CourseMembership = { ...membership, id: nextMembershipId() };
        this.memberships.set(k, full);
        return { membership: full, wasNew: true };
      },
      listActiveForUser: async (userId) => {
        const results: CourseMembership[] = [];
        for (const m of this.memberships.values()) {
          if (m.userId === userId && m.revokedAt === null && m.archivedAt === null) {
            results.push(m);
          }
        }
        return results;
      },
      setArchived: async (userId, courseId, archivedAt) => {
        const k = key(userId, courseId);
        const existing = this.memberships.get(k);
        if (!existing) return null;
        const updated = { ...existing, archivedAt };
        this.memberships.set(k, updated);
        return updated;
      },
      revoke: async (userId, courseId, revokedAt) => {
        const k = key(userId, courseId);
        const existing = this.memberships.get(k);
        if (!existing) return null;
        const updated = { ...existing, revokedAt };
        this.memberships.set(k, updated);
        return updated;
      },
    };

    const courses: CourseRepository = {
      getCourseSummary: async (courseId) => {
        const title = this.courseTitles.get(courseId);
        return title === undefined ? null : { id: courseId, title };
      },
      getCourseSummaries: async (courseIds) => {
        return courseIds.flatMap((courseId) => {
          const title = this.courseTitles.get(courseId);
          return title === undefined ? [] : [{ id: courseId, title }];
        });
      },
      listStatuses: async (courseIds) => {
        return courseIds.flatMap((courseId) => {
          const status = this.courseStatuses.get(courseId);
          return status === undefined ? [] : [{ id: courseId, status }];
        });
      },
      listExamDates: async (courseIds) => {
        return courseIds.flatMap((courseId) => {
          if (!this.courseExamDates.has(courseId)) return [];
          return [{ id: courseId, examDate: this.courseExamDates.get(courseId) ?? null }];
        });
      },
      getJoinPolicy: async (courseId) => {
        return this.joinPolicies.get(courseId) ?? null;
      },
      getJoinEligibility: async (courseId) => {
        const joinPolicy = this.joinPolicies.get(courseId);
        const status = this.courseStatuses.get(courseId);
        return joinPolicy === undefined || status === undefined
          ? null
          : { status, joinPolicy };
      },
      setJoinPolicy: async (courseId, joinPolicy) => {
        if (!this.joinPolicies.has(courseId)) return null;
        this.joinPolicies.set(courseId, joinPolicy);
        return joinPolicy;
      },
      createCourse: async (input) => {
        const courseId = nextCourseIdValue();
        const now = new Date();
        this.courseTitles.set(courseId, input.title);
        this.joinPolicies.set(courseId, "AUTHORIZED_ONLY");
        this.courseStatuses.set(courseId, "DRAFT");
        this.courseExamDates.set(courseId, input.examDate);
        this.courseTimestamps.set(courseId, { createdAt: now, updatedAt: now });
        return this.authoringRecord(courseId)!;
      },
      getCourseForAuthoring: async (courseId) => {
        return this.authoringRecord(courseId);
      },
      updateCourseMetadata: async (courseId, input) => {
        if (!this.courseTitles.has(courseId)) return null;
        if (input.title !== undefined) {
          this.courseTitles.set(courseId, input.title);
        }
        if (input.examDate !== undefined) {
          this.courseExamDates.set(courseId, input.examDate);
        }
        const timestamps = this.courseTimestamps.get(courseId);
        if (timestamps) {
          timestamps.updatedAt = new Date();
        }
        return this.authoringRecord(courseId);
      },
      setCourseStatus: async (courseId, status) => {
        if (!this.courseStatuses.has(courseId)) return null;
        this.courseStatuses.set(courseId, status);
        const timestamps = this.courseTimestamps.get(courseId);
        if (timestamps) {
          timestamps.updatedAt = new Date();
        }
        return this.authoringRecord(courseId);
      },
    };

    return { memberships, authors, courses };
  }

  /**
   * Structural fake for `CourseUnitOfWork` — proves application-layer
   * orchestration (what `createCourse` does inside the transaction), not
   * real rollback-on-failure behavior. `PostgresCourseUnitOfWork`'s own
   * PGlite integration tests (`supabase/tests/postgres/`) prove the actual
   * atomicity/rollback contract.
   */
  uow(): CourseUnitOfWork {
    return {
      runInTransaction: (fn) => fn(this.repos()),
    };
  }
}

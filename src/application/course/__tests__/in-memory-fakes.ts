/**
 * In-memory fakes for the course-membership application layer's persistence
 * ports — proves application-layer orchestration semantics only (policy
 * checks, idempotent join, the "no rows found" cases), not PostgreSQL
 * constraint/race behavior. Mirrors
 * `src/application/learning/__tests__/in-memory-fakes.ts`'s own scope note.
 */
import type {
  CourseAuthoringRecord,
  CourseJoinPolicy,
  CourseMembership,
  CourseMembershipRepository,
  CourseRepositories,
  CourseRepository,
  CourseUnitOfWork,
} from "../ports";
import type { CourseStatus } from "../../../domain/course/types";

function key(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

let nextId = 1;
function nextMembershipId(): string {
  return `membership-${nextId++}`;
}

let nextCourseId = 1;
function nextCourseIdValue(): string {
  return `course-${nextCourseId++}`;
}

export class InMemoryCourseDatabase {
  private memberships = new Map<string, CourseMembership>();
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
  }

  repos(): CourseRepositories {
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

    return { memberships, courses };
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

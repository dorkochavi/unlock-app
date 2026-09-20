/**
 * In-memory fakes for the course-membership application layer's persistence
 * ports — proves application-layer orchestration semantics only (policy
 * checks, idempotent join, the "no rows found" cases), not PostgreSQL
 * constraint/race behavior. Mirrors
 * `src/application/learning/__tests__/in-memory-fakes.ts`'s own scope note.
 */
import type {
  CourseJoinPolicy,
  CourseMembership,
  CourseMembershipRepository,
  CourseRepositories,
  CourseRepository,
} from "../ports";

function key(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

let nextId = 1;
function nextMembershipId(): string {
  return `membership-${nextId++}`;
}

export class InMemoryCourseDatabase {
  private memberships = new Map<string, CourseMembership>();
  private joinPolicies = new Map<string, CourseJoinPolicy>();
  private courseTitles = new Map<string, string>();

  /** Test setup helper — not part of any port. */
  seedCourse(
    courseId: string,
    joinPolicy: CourseJoinPolicy = "AUTHORIZED_ONLY",
    title = "Test Course",
  ): void {
    this.joinPolicies.set(courseId, joinPolicy);
    this.courseTitles.set(courseId, title);
  }

  /** Test setup helper — not part of any port. */
  seedMembership(membership: CourseMembership): void {
    this.memberships.set(key(membership.userId, membership.courseId), membership);
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
      getJoinPolicy: async (courseId) => {
        return this.joinPolicies.get(courseId) ?? null;
      },
      setJoinPolicy: async (courseId, joinPolicy) => {
        if (!this.joinPolicies.has(courseId)) return null;
        this.joinPolicies.set(courseId, joinPolicy);
        return joinPolicy;
      },
    };

    return { memberships, courses };
  }
}

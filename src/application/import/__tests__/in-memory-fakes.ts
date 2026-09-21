/**
 * In-memory fake for `previewImport`'s persistence ports (Run 007 S2) —
 * proves application-layer orchestration semantics only (authorization,
 * ARCHIVED-Course rejection, Topic resolution against seeded active
 * Topics), not PostgreSQL constraint/query behavior. One small fake per
 * feature area, matching `src/application/question/__tests__/in-memory-fakes.ts`'s
 * and `src/application/topic/__tests__/in-memory-fakes.ts`'s own
 * established convention — deliberately not a shared cross-feature harness.
 */
import type { CourseStatus } from "../../../domain/course/types";
import type {
  CourseMembership,
  CourseMembershipRepository,
  CourseRepository,
  PreviewImportRepositories,
  Topic,
  TopicRepository,
} from "../ports";

function membershipKey(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

export class InMemoryImportDatabase {
  private memberships = new Map<string, CourseMembership>();
  private topics = new Map<string, Topic>();
  private courseStatuses = new Map<string, CourseStatus>();
  private nextTopicId = 1;

  /** Test setup helper — not part of any port. */
  seedMembership(membership: CourseMembership): void {
    this.memberships.set(membershipKey(membership.userId, membership.courseId), membership);
  }

  /** Test setup helper — not part of any port. */
  seedActiveTopic(courseId: string, name: string): Topic {
    const now = new Date();
    const topic: Topic = {
      id: `topic-${this.nextTopicId++}`,
      courseId,
      name,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.topics.set(topic.id, topic);
    return topic;
  }

  /** Test setup helper — not part of any port. */
  seedArchivedTopic(courseId: string, name: string): Topic {
    const topic = this.seedActiveTopic(courseId, name);
    const archived = { ...topic, archivedAt: new Date() };
    this.topics.set(topic.id, archived);
    return archived;
  }

  /** Test setup helper — not part of any port. Defaults to PUBLISHED. */
  seedCourseStatus(courseId: string, status: CourseStatus = "PUBLISHED"): void {
    this.courseStatuses.set(courseId, status);
  }

  repos(): PreviewImportRepositories {
    const memberships: CourseMembershipRepository = {
      findMembership: async (userId, courseId) => {
        return this.memberships.get(membershipKey(userId, courseId)) ?? null;
      },
      createMembership: async () => {
        throw new Error("InMemoryImportDatabase: createMembership is not used by previewImport");
      },
      listActiveForUser: async () => [],
      setArchived: async () => null,
      revoke: async () => null,
    };

    const topics: TopicRepository = {
      createTopic: async () => {
        throw new Error("InMemoryImportDatabase: createTopic is not used by previewImport");
      },
      listActiveForCourse: async (courseId) => {
        return [...this.topics.values()].filter(
          (topic) => topic.courseId === courseId && topic.archivedAt === null,
        );
      },
      getTopic: async (topicId) => this.topics.get(topicId) ?? null,
      renameTopic: async () => null,
      archiveTopic: async () => null,
    };

    const courses: CourseRepository = {
      getCourseSummary: async () => {
        throw new Error("InMemoryImportDatabase: getCourseSummary is not used by previewImport");
      },
      getCourseSummaries: async () => [],
      getJoinPolicy: async () => null,
      getJoinEligibility: async () => null,
      setJoinPolicy: async () => null,
      createCourse: async () => {
        throw new Error("InMemoryImportDatabase: createCourse is not used by previewImport");
      },
      getCourseForAuthoring: async (courseId) => {
        const status = this.courseStatuses.get(courseId) ?? "PUBLISHED";
        return {
          id: courseId,
          title: "Test Course",
          status,
          joinPolicy: "AUTHORIZED_ONLY",
          examDate: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      },
      updateCourseMetadata: async () => null,
      setCourseStatus: async () => null,
    };

    return { memberships, courses, topics };
  }
}

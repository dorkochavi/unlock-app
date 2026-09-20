/**
 * In-memory fakes for the Topic application layer's persistence ports (Run
 * 005 S4) — proves application-layer orchestration semantics only (policy
 * checks, cross-Course rejection, idempotent archive), not PostgreSQL
 * constraint/race behavior. Mirrors
 * `src/application/course/__tests__/in-memory-fakes.ts`'s own scope note
 * and membership-map shape exactly, since Topic authorization reuses
 * `CourseMembershipRepository` unchanged.
 */
import type { CourseMembership, CourseMembershipRepository, Topic, TopicRepositories, TopicRepository } from "../ports";

function key(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

let nextTopicId = 1;
function nextTopicIdValue(): string {
  return `topic-${nextTopicId++}`;
}

export class InMemoryTopicDatabase {
  private memberships = new Map<string, CourseMembership>();
  private topics = new Map<string, Topic>();

  /** Test setup helper — not part of any port. */
  seedMembership(membership: CourseMembership): void {
    this.memberships.set(key(membership.userId, membership.courseId), membership);
  }

  /** Test setup helper — not part of any port. */
  seedTopic(topic: Topic): void {
    this.topics.set(topic.id, topic);
  }

  repos(): TopicRepositories {
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
        const full: CourseMembership = { ...membership, id: `membership-${k}` };
        this.memberships.set(k, full);
        return { membership: full, wasNew: true };
      },
      listActiveForUser: async (userId) => {
        return [...this.memberships.values()].filter(
          (m) => m.userId === userId && m.revokedAt === null && m.archivedAt === null,
        );
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

    const topics: TopicRepository = {
      createTopic: async (input) => {
        const now = new Date();
        const topic: Topic = {
          id: nextTopicIdValue(),
          courseId: input.courseId,
          name: input.name,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        };
        this.topics.set(topic.id, topic);
        return topic;
      },
      listActiveForCourse: async (courseId) => {
        return [...this.topics.values()]
          .filter((t) => t.courseId === courseId && t.archivedAt === null)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      getTopic: async (topicId) => {
        return this.topics.get(topicId) ?? null;
      },
      renameTopic: async (topicId, name) => {
        const existing = this.topics.get(topicId);
        if (!existing) return null;
        const updated = { ...existing, name, updatedAt: new Date() };
        this.topics.set(topicId, updated);
        return updated;
      },
      archiveTopic: async (topicId) => {
        const existing = this.topics.get(topicId);
        if (!existing) return null;
        const updated = { ...existing, archivedAt: existing.archivedAt ?? new Date(), updatedAt: new Date() };
        this.topics.set(topicId, updated);
        return updated;
      },
    };

    return { memberships, topics };
  }
}

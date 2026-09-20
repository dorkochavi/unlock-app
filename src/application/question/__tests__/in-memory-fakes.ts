/**
 * In-memory fakes for the Question-authoring application layer's
 * persistence ports (Run 006 S2) — proves application-layer orchestration
 * semantics only (policy checks, cross-Course rejection, draft-state
 * transitions), not PostgreSQL constraint/race behavior. Mirrors
 * `src/application/topic/__tests__/in-memory-fakes.ts`'s own scope note and
 * membership-map shape exactly.
 */
import {
  EMPTY_QUESTION_DRAFT,
  type QuestionAuthoringRecord,
} from "../../../domain/question/types";
import type {
  CourseMembership,
  CourseMembershipRepository,
  QuestionRepositories,
  QuestionRepository,
  Topic,
  TopicRepository,
} from "../ports";

function membershipKey(userId: string, courseId: string): string {
  return `${userId}:${courseId}`;
}

let nextQuestionId = 1;
function nextQuestionIdValue(): string {
  return `question-${nextQuestionId++}`;
}

export class InMemoryQuestionDatabase {
  private memberships = new Map<string, CourseMembership>();
  private topics = new Map<string, Topic>();
  private questions = new Map<string, QuestionAuthoringRecord>();

  /** Test setup helper — not part of any port. */
  seedMembership(membership: CourseMembership): void {
    this.memberships.set(membershipKey(membership.userId, membership.courseId), membership);
  }

  /** Test setup helper — not part of any port. */
  seedTopic(topic: Topic): void {
    this.topics.set(topic.id, topic);
  }

  /** Test setup helper — not part of any port. */
  seedQuestion(question: QuestionAuthoringRecord): void {
    this.questions.set(question.id, question);
  }

  repos(): QuestionRepositories {
    const memberships: CourseMembershipRepository = {
      findMembership: async (userId, courseId) => {
        return this.memberships.get(membershipKey(userId, courseId)) ?? null;
      },
      createMembership: async (membership) => {
        const k = membershipKey(membership.userId, membership.courseId);
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
        const k = membershipKey(userId, courseId);
        const existing = this.memberships.get(k);
        if (!existing) return null;
        const updated = { ...existing, archivedAt };
        this.memberships.set(k, updated);
        return updated;
      },
      revoke: async (userId, courseId, revokedAt) => {
        const k = membershipKey(userId, courseId);
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
          id: `topic-${this.topics.size + 1}`,
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
        return [...this.topics.values()].filter(
          (t) => t.courseId === courseId && t.archivedAt === null,
        );
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

    const questions: QuestionRepository = {
      createDraft: async (input) => {
        const now = new Date();
        const question: QuestionAuthoringRecord = {
          id: nextQuestionIdValue(),
          courseId: input.courseId,
          topicId: null,
          currentVersionId: null,
          draft: { ...EMPTY_QUESTION_DRAFT },
          createdAt: now,
          updatedAt: now,
        };
        this.questions.set(question.id, question);
        return question;
      },
      getForAuthoring: async (questionId) => {
        return this.questions.get(questionId) ?? null;
      },
      listForCourse: async (courseId) => {
        return [...this.questions.values()]
          .filter((q) => q.courseId === courseId)
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      },
      updateDraft: async (questionId, input) => {
        const existing = this.questions.get(questionId);
        if (!existing) return null;
        const updated: QuestionAuthoringRecord = {
          ...existing,
          topicId: input.topicId !== undefined ? input.topicId : existing.topicId,
          draft: {
            questionType:
              input.questionType !== undefined ? input.questionType : existing.draft.questionType,
            prompt: input.prompt !== undefined ? input.prompt : existing.draft.prompt,
            answerOptions:
              input.answerOptions !== undefined ? input.answerOptions : existing.draft.answerOptions,
            correctOptionIds:
              input.correctOptionIds !== undefined
                ? input.correctOptionIds
                : existing.draft.correctOptionIds,
            explanation:
              input.explanation !== undefined ? input.explanation : existing.draft.explanation,
          },
          updatedAt: new Date(),
        };
        this.questions.set(questionId, updated);
        return updated;
      },
    };

    return { memberships, topics, questions };
  }
}

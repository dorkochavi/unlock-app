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
  type PublishableQuestionVersionContent,
  type QuestionAuthoringRecord,
  type QuestionDraftContent,
} from "../../../domain/question/types";
import type { CourseStatus } from "../../../domain/course/types";
import type {
  CourseMembership,
  CourseMembershipRepository,
  CourseRepository,
  PublishQuestionRepositories,
  QuestionRepositories,
  QuestionRepository,
  QuestionUnitOfWork,
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
  private versionContents = new Map<string, QuestionDraftContent>();
  /** Run 006 S5 — Course status, for `publishQuestion`'s ARCHIVED-Course guard. Defaults to PUBLISHED (not a fixture concern for S2-S4's own tests). */
  private courseStatuses = new Map<string, CourseStatus>();
  /** Run 006 S5 — every persisted `question_versions` row, keyed by version id; a Question's history is every entry with a matching `questionId`, never mutated once inserted (mirrors the real table's immutability). */
  private versions = new Map<
    string,
    { questionId: string; versionNumber: number; content: PublishableQuestionVersionContent }
  >();
  private nextVersionId = 1;

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

  /** Test setup helper — not part of any port. Seeds a published QuestionVersion's full content, keyed by versionId. */
  seedVersionContent(versionId: string, content: QuestionDraftContent): void {
    this.versionContents.set(versionId, content);
  }

  /** Test setup helper — not part of any port. Defaults to PUBLISHED, matching the real migration's backfill for pre-existing rows. */
  seedCourseStatus(courseId: string, status: CourseStatus = "PUBLISHED"): void {
    this.courseStatuses.set(courseId, status);
  }

  /** Test assertion helper — not part of any port. Every version row ever inserted for a Question, in insertion order — proves an old version was never rewritten. */
  listVersionsForQuestion(
    questionId: string,
  ): Array<{ id: string; versionNumber: number; content: PublishableQuestionVersionContent }> {
    return [...this.versions.entries()]
      .filter(([, v]) => v.questionId === questionId)
      .map(([id, v]) => ({ id, versionNumber: v.versionNumber, content: v.content }))
      .sort((a, b) => a.versionNumber - b.versionNumber);
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
      getVersionContent: async (versionId) => {
        return this.versionContents.get(versionId) ?? null;
      },
      getVersionPrompts: async (versionIds) => {
        const prompts = new Map<string, string>();
        for (const versionId of versionIds) {
          const content = this.versionContents.get(versionId);
          if (content?.prompt != null) {
            prompts.set(versionId, content.prompt);
          }
        }
        return prompts;
      },
      getNextVersionNumber: async (questionId) => {
        const existing = this.listVersionsForQuestion(questionId);
        return existing.length === 0 ? 1 : existing[existing.length - 1].versionNumber + 1;
      },
      insertVersion: async (questionId, content, versionNumber) => {
        const id = `version-${this.nextVersionId++}`;
        this.versions.set(id, { questionId, versionNumber, content });
        this.versionContents.set(id, {
          questionType: content.questionType,
          prompt: content.prompt,
          answerOptions: content.answerOptions,
          correctOptionIds: content.correctOptionIds,
          explanation: content.explanation,
        });
        return { id };
      },
      setCurrentVersionAndClearDraft: async (questionId, versionId) => {
        const existing = this.questions.get(questionId);
        if (!existing) return null;
        const updated: QuestionAuthoringRecord = {
          ...existing,
          currentVersionId: versionId,
          draft: { ...EMPTY_QUESTION_DRAFT },
          updatedAt: new Date(),
        };
        this.questions.set(questionId, updated);
        return updated;
      },
    };

    return { memberships, topics, questions };
  }

  /**
   * Run 006 S5 — the narrower repository set `publishQuestion` actually
   * needs (`PublishQuestionRepositories`): `memberships` + `questions`
   * unchanged from `repos()` above, plus a minimal in-memory `courses` read
   * (status only — the only field `publishQuestion` reads).
   */
  private publishRepos(): PublishQuestionRepositories {
    const { memberships, questions } = this.repos();
    const courses: CourseRepository = {
      getCourseSummary: async () => {
        throw new Error("InMemoryQuestionDatabase.publishRepos: getCourseSummary is not used by publishQuestion");
      },
      getCourseSummaries: async () => [],
      getJoinPolicy: async () => null,
      getJoinEligibility: async () => null,
      setJoinPolicy: async () => null,
      createCourse: async () => {
        throw new Error("InMemoryQuestionDatabase.publishRepos: createCourse is not used by publishQuestion");
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
    return { memberships, courses, questions };
  }

  /**
   * Structural fake for `QuestionUnitOfWork` — proves application-layer
   * orchestration (what `publishQuestion` does inside the transaction), not
   * real rollback-on-failure behavior. `PostgresQuestionUnitOfWork`'s own
   * PGlite integration tests prove the actual atomicity/rollback contract —
   * mirrors `InMemoryCourseDatabase.uow()`'s own scope note exactly.
   */
  uow(): QuestionUnitOfWork {
    return {
      runInTransaction: (fn) => fn(this.publishRepos()),
    };
  }
}

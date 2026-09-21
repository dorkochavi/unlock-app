/**
 * In-memory fake for `previewImport`'s persistence ports (Run 007 S2) —
 * proves application-layer orchestration semantics only (authorization,
 * ARCHIVED-Course rejection, Topic resolution against seeded active
 * Topics), not PostgreSQL constraint/query behavior. One small fake per
 * feature area, matching `src/application/question/__tests__/in-memory-fakes.ts`'s
 * and `src/application/topic/__tests__/in-memory-fakes.ts`'s own
 * established convention — deliberately not a shared cross-feature harness.
 */
import { EMPTY_QUESTION_DRAFT, type QuestionAuthoringRecord } from "../../../domain/question/types";
import type { CourseStatus } from "../../../domain/course/types";
import type {
  CourseMembership,
  CourseMembershipRepository,
  CourseRepository,
  ImportRepositories,
  ImportUnitOfWork,
  PreviewImportRepositories,
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

export class InMemoryImportDatabase {
  private memberships = new Map<string, CourseMembership>();
  private topics = new Map<string, Topic>();
  private courseStatuses = new Map<string, CourseStatus>();
  private questions = new Map<string, QuestionAuthoringRecord>();
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

  /** Test assertion helper — not part of any port. */
  getQuestion(questionId: string): QuestionAuthoringRecord | undefined {
    return this.questions.get(questionId);
  }

  /** Test assertion helper — not part of any port. */
  listQuestionsForCourse(courseId: string): QuestionAuthoringRecord[] {
    return [...this.questions.values()].filter((q) => q.courseId === courseId);
  }

  private buildMemberships(): CourseMembershipRepository {
    return {
      findMembership: async (userId, courseId) => {
        return this.memberships.get(membershipKey(userId, courseId)) ?? null;
      },
      createMembership: async () => {
        throw new Error("InMemoryImportDatabase: createMembership is not used by import");
      },
      listActiveForUser: async () => [],
      setArchived: async () => null,
      revoke: async (userId, courseId, revokedAt) => {
        const k = membershipKey(userId, courseId);
        const existing = this.memberships.get(k);
        if (!existing) return null;
        const updated = { ...existing, revokedAt };
        this.memberships.set(k, updated);
        return updated;
      },
    };
  }

  private buildTopics(): TopicRepository {
    return {
      createTopic: async () => {
        throw new Error("InMemoryImportDatabase: createTopic is not used by import");
      },
      listActiveForCourse: async (courseId) => {
        return [...this.topics.values()].filter(
          (topic) => topic.courseId === courseId && topic.archivedAt === null,
        );
      },
      getTopic: async (topicId) => this.topics.get(topicId) ?? null,
      renameTopic: async () => null,
      archiveTopic: async (topicId) => {
        const existing = this.topics.get(topicId);
        if (!existing) return null;
        const updated = { ...existing, archivedAt: existing.archivedAt ?? new Date() };
        this.topics.set(topicId, updated);
        return updated;
      },
    };
  }

  private buildCourses(): CourseRepository {
    return {
      getCourseSummary: async () => {
        throw new Error("InMemoryImportDatabase: getCourseSummary is not used by import");
      },
      getCourseSummaries: async () => [],
      listStatuses: async () => {
        throw new Error("InMemoryImportDatabase: listStatuses is not used by import");
      },
      getJoinPolicy: async () => null,
      getJoinEligibility: async () => null,
      setJoinPolicy: async () => null,
      createCourse: async () => {
        throw new Error("InMemoryImportDatabase: createCourse is not used by import");
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
  }

  private buildQuestions(): QuestionRepository {
    return {
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
      getForAuthoring: async (questionId) => this.questions.get(questionId) ?? null,
      listForCourse: async (courseId) => {
        return [...this.questions.values()].filter((q) => q.courseId === courseId);
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
            explanation: input.explanation !== undefined ? input.explanation : existing.draft.explanation,
          },
          updatedAt: new Date(),
        };
        this.questions.set(questionId, updated);
        return updated;
      },
      getVersionContent: async () => {
        throw new Error("InMemoryImportDatabase: getVersionContent is not used by import");
      },
      getVersionPrompts: async () => new Map(),
      getNextVersionNumber: async () => {
        throw new Error("InMemoryImportDatabase: getNextVersionNumber is not used by import");
      },
      insertVersion: async () => {
        throw new Error("InMemoryImportDatabase: insertVersion is not used by import — imported Questions stay DRAFT_ONLY");
      },
      setCurrentVersionAndClearDraft: async () => {
        throw new Error(
          "InMemoryImportDatabase: setCurrentVersionAndClearDraft is not used by import — imported Questions stay DRAFT_ONLY",
        );
      },
    };
  }

  repos(): PreviewImportRepositories {
    return { memberships: this.buildMemberships(), courses: this.buildCourses(), topics: this.buildTopics() };
  }

  /** Run 007 S4 — the write-capable repository set `confirmImport`'s transaction phase needs. */
  importRepos(): ImportRepositories {
    return {
      memberships: this.buildMemberships(),
      courses: this.buildCourses(),
      topics: this.buildTopics(),
      questions: this.buildQuestions(),
    };
  }
}

/**
 * In-memory `ImportUnitOfWork` fake — Run 007 S4. Calls `fn` directly
 * against `db.importRepos()` with no real BEGIN/COMMIT/ROLLBACK: proves
 * `confirmImport`'s orchestration (re-check ordering, all-or-nothing at the
 * pre-write validation level) only. Real transactional atomicity/rollback
 * on a genuine write failure is PGlite/real-PostgreSQL evidence (Run 007
 * S6), not something an in-memory fake can prove.
 */
export class InMemoryImportUnitOfWork implements ImportUnitOfWork {
  constructor(private readonly db: InMemoryImportDatabase) {}

  async runInTransaction<T>(fn: (repos: ImportRepositories) => Promise<T>): Promise<T> {
    return fn(this.db.importRepos());
  }
}

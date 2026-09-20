/**
 * Persistence ports for the Question-authoring application layer — Run 006
 * S2. Small, explicit interfaces, not a generic `Repository<T>`, matching
 * `src/application/topic/ports.ts`/`src/application/course/ports.ts`'s own
 * established discipline.
 *
 * Reuses `CourseMembershipRepository` (authorization) and `TopicRepository`
 * (same-Course Topic association guard) unchanged from their existing
 * modules — this module owns no copy of either.
 */
import type { CourseMembership, CourseMembershipRepository } from "../course/ports";
import type { Topic, TopicRepository } from "../topic/ports";

import type {
  AnswerOption,
  QuestionAuthoringRecord,
  QuestionDraftContent,
  QuestionType,
} from "../../domain/question/types";

export type {
  AnswerOption,
  CourseMembership,
  CourseMembershipRepository,
  QuestionAuthoringRecord,
  QuestionDraftContent,
  QuestionType,
  Topic,
  TopicRepository,
};

export interface CreateQuestionDraftInput {
  courseId: string;
}

/**
 * Every field independently optional (`undefined` = leave unchanged),
 * mirroring `UpdateCourseMetadataInput`'s own established shape
 * (`src/application/course/ports.ts`) — `null` is a meaningful explicit
 * value distinct from "not provided" for every nullable field (e.g.
 * `topicId: null` explicitly clears the Topic association).
 */
export interface UpdateQuestionDraftInput {
  topicId?: string | null;
  questionType?: QuestionType | null;
  prompt?: string | null;
  answerOptions?: AnswerOption[] | null;
  correctOptionIds?: string[] | null;
  explanation?: string | null;
}

export interface QuestionRepository {
  /** New Questions always start with no Topic, no draft content, and no current version (never-published). */
  createDraft(input: CreateQuestionDraftInput): Promise<QuestionAuthoringRecord>;

  /** `null` if no Question exists with this id. Authoring-only — never the learner-safe read path. */
  getForAuthoring(questionId: string): Promise<QuestionAuthoringRecord | null>;

  /** Every Question (any authoring state) for one Course, ordered by creation order. */
  listForCourse(courseId: string): Promise<QuestionAuthoringRecord[]>;

  /**
   * Updates only the fields present in `input`. Returns `null` if the
   * Question does not exist. Does not itself validate draft content
   * structurally (that is `updateQuestionDraft`'s job, via
   * `assertSaveableQuestionDraftContent`) or check Topic/Course
   * authorization (that is also the application layer's job) — this port is
   * a pure persistence write.
   */
  updateDraft(
    questionId: string,
    input: UpdateQuestionDraftInput,
  ): Promise<QuestionAuthoringRecord | null>;
}

export interface QuestionRepositories {
  memberships: CourseMembershipRepository;
  topics: TopicRepository;
  questions: QuestionRepository;
}

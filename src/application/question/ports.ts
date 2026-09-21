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
import type { CourseMembership, CourseMembershipRepository, CourseRepository } from "../course/ports";
import type { Topic, TopicRepository } from "../topic/ports";

import type {
  AnswerOption,
  PublishableQuestionVersionContent,
  QuestionAuthoringRecord,
  QuestionDraftContent,
  QuestionType,
} from "../../domain/question/types";

export type {
  AnswerOption,
  CourseMembership,
  CourseMembershipRepository,
  CourseRepository,
  PublishableQuestionVersionContent,
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

  /**
   * Full content of one already-published `QuestionVersion` — including
   * `correctOptionIds` — keyed by `questionId`'s own `current_version_id`.
   * Authoring-only: never used by any learner-facing read path (which uses
   * `LearnerQuestionContentRepository` instead, deliberately excluding
   * `correct_answer`). Exists solely so `getQuestionForAuthoring` (Run 006
   * S4) can let an authorized instructor "reopen/edit" a Question that has
   * no pending draft — the current published content is for display/
   * edit-seeding only, never written back to `draft_*` unless the
   * instructor explicitly saves. `null` if the version does not exist
   * (should not happen for a real `current_version_id`, since that FK is
   * `on delete restrict` and no code ever deletes a `question_versions`
   * row — treated as a caller-visible `null`, not an exception, matching
   * this port's other methods' discipline).
   */
  getVersionContent(versionId: string): Promise<QuestionDraftContent | null>;

  /**
   * Batched prompt-only read for one or more already-published
   * QuestionVersions — used by `listQuestionsForCourse` (Run 006 S4) so a
   * Course's Question list can show a PUBLISHED Question's real prompt
   * without leaking `correctOptionIds` into a list view (use
   * `getVersionContent` instead when full content is genuinely needed for
   * one specific Question). Returns only the ids that actually exist; a
   * caller-supplied id with no matching row is silently omitted, matching
   * `CourseRepository.getCourseSummaries`'s own established "omit, don't
   * throw" convention for a batched read.
   */
  getVersionPrompts(versionIds: readonly string[]): Promise<Map<string, string>>;

  /**
   * Run 006 S5 — the version number for the NEXT `question_versions` row for
   * this Question: 1 for a never-published Question, otherwise `max(existing
   * version_number) + 1`. Never reused/decremented — matches `question_
   * versions`' own `UNIQUE (question_id, version_number)` and "no code path
   * updates an existing row" invariant (`getVersionContent`'s doc comment).
   *
   * **Accepted V1 concurrency assumption** (Run 006 S5 DB-review finding):
   * this read and the subsequent `insertVersion` are NOT serialized against
   * a concurrent publish of the SAME Question — no `FOR UPDATE`/advisory
   * lock is taken. Two overlapping publish transactions can compute the
   * same next `version_number`; the DB's `UNIQUE (question_id,
   * version_number)` constraint then fails the losing transaction's insert,
   * which `PostgresQuestionUnitOfWork` rolls back cleanly (no orphaned row,
   * no corrupted `current_version_id`) — this is fail-safe, not a
   * data-integrity gap. The losing request currently surfaces only as an
   * unmapped `INTERNAL_ERROR` (no typed "someone already published, please
   * retry" outcome exists). Accepted for V1's expected usage — one
   * instructor editing their own draft, not concurrent co-editors — revisit
   * if/when concurrent co-authoring becomes a real product scenario.
   */
  getNextVersionNumber(questionId: string): Promise<number>;

  /**
   * Inserts ONE new immutable `question_versions` row — never updates an
   * existing one (Run 006 S5 "no update-in-place path exists for published
   * QuestionVersion content"). Does not itself touch `questions.
   * current_version_id`/`draft_*` — that is `setCurrentVersionAndClearDraft`'s
   * job, so the two writes can be composed inside one atomic
   * `QuestionUnitOfWork` transaction by the `publishQuestion` use case.
   */
  insertVersion(
    questionId: string,
    content: PublishableQuestionVersionContent,
    versionNumber: number,
  ): Promise<{ id: string }>;

  /**
   * Repoints `questions.current_version_id` to `versionId` and clears every
   * `draft_*` column back to `null` in one statement (Run 006 S5: "a
   * successful publish CLEARS every field back to null" — `QuestionDraftContent`'s
   * own doc comment). Does not touch `topic_id` (current, not versioned,
   * metadata — unaffected by publish). Returns `null` if the Question does
   * not exist.
   */
  setCurrentVersionAndClearDraft(
    questionId: string,
    versionId: string,
  ): Promise<QuestionAuthoringRecord | null>;
}

export interface QuestionRepositories {
  memberships: CourseMembershipRepository;
  topics: TopicRepository;
  questions: QuestionRepository;
}

/**
 * Run 006 S5 — the narrow repository set the atomic publish transaction
 * actually needs. Deliberately NOT `QuestionRepositories` + `courses`: the
 * publish transaction never touches Topic (the domain layer's own decision,
 * `assertQuestionPublishReady`'s doc comment: "does NOT re-validate that a
 * non-null topicId actually exists/belongs to this Question's own Course" —
 * the DB composite FK already guarantees that at write time, not at publish
 * time), so requiring a `TopicRepository` here would be an unused
 * dependency. `courses` is reused, unchanged, from `../course/ports` — see
 * `publishQuestion`'s own doc comment for why a Course-archived check
 * belongs here (Run 006 S4 security-reviewer carried-forward finding).
 */
export interface PublishQuestionRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  questions: QuestionRepository;
}

/**
 * Transaction boundary for `publishQuestion` (Run 006 S5) — the ONE
 * genuinely atomic multi-statement Question-authoring write (insert a new
 * `question_versions` row, then repoint `current_version_id` and clear
 * `draft_*`). Mirrors `CourseUnitOfWork`'s shape and rationale exactly
 * (`src/application/course/ports.ts`), narrowed to `PublishQuestionRepositories`.
 * `createDraft`/`updateQuestionDraft` remain single-statement writes and
 * intentionally do NOT go through a UnitOfWork — only publish does.
 */
export interface QuestionUnitOfWork {
  runInTransaction<T>(fn: (repos: PublishQuestionRepositories) => Promise<T>): Promise<T>;
}

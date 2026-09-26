/**
 * Read port for Course/Topic Practice (Run UX-02 P2, ADR-020,
 * `docs/LEARNING_ENGINE.md` §39A). Deliberately small and read-only: Practice
 * never writes through this port — answers go through `submitAnswer`, and the
 * learning-day session is the learner's DailyPlan (`getOrCreateDailyPlanForToday`).
 */

export interface PracticeScopeQuestion {
  questionId: string;
  /** The Question's CURRENT published version (`questions.current_version_id`). */
  questionVersionId: string;
  createdAt: Date;
  /** Current Topic attribution (ADR-018); null = Topic-less (Course Practice only). */
  topicId: string | null;
  /** Any real Attempt by this learner on the Question (ADR-017 "seen"). */
  attempted: boolean;
}

export interface PracticeReadRepository {
  /**
   * Published Questions (current version present) of one Course; with
   * `topicId` only those currently attributed to that Topic. `topicId` MUST
   * be a valid uuid (callers validate). Ordered `created_at asc, id asc`.
   */
  listScopeQuestions(
    userId: string,
    courseId: string,
    topicId: string | null,
  ): Promise<PracticeScopeQuestion[]>;

  /**
   * One published Question of the Course with its current version and
   * current Topic, or null when it does not exist, belongs to another
   * Course, or has no current version. `questionId` MUST be a valid uuid.
   */
  findScopeQuestion(
    courseId: string,
    questionId: string,
  ): Promise<{ questionId: string; questionVersionId: string; topicId: string | null } | null>;

  /** Distinct Question ids the learner has answered in one learning session. */
  listQuestionIdsAnsweredInSession(
    userId: string,
    learningSessionId: string,
  ): Promise<string[]>;
}

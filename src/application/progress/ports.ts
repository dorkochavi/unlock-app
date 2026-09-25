/**
 * Read-only persistence port for the learner Topic Progress read model
 * (Run 009 S1). Own-state only: every method is scoped to one learner.
 */
import type { CourseMembershipRepository, CourseRepository } from "../course/ports";
import type { TopicQuestionLearnerState } from "../../domain/progress/topic-progress";

/**
 * One current published Question (a Question with a current QuestionVersion)
 * of the Course, with its CURRENT Topic (D6: `questions.topic_id`, never a
 * snapshot) and this learner's state on it.
 */
export interface LearnerCourseQuestionRow {
  questionId: string;
  /** Null only defensively: published Questions normally require a Topic. */
  topicId: string | null;
  topicName: string | null;
  topicArchived: boolean;
  learnerState: TopicQuestionLearnerState;
}

export interface LearnerTopicProgressRepository {
  /**
   * Rows for the Course's published Questions, ordered deterministically by
   * Topic creation then Question creation. `attempted` reflects ANY real
   * Attempt by this learner on the Question (any version — ADR-017), so
   * Attempts follow the Question's CURRENT Topic.
   */
  listCourseQuestionsForLearner(
    userId: string,
    courseId: string,
  ): Promise<LearnerCourseQuestionRow[]>;
}

export interface LearnerTopicProgressRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  topicProgress: LearnerTopicProgressRepository;
}

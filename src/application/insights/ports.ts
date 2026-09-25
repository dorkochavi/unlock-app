/**
 * Read-only persistence port for the instructor Item Analysis read model
 * (Pre-Pilot S2). Aggregate-only by construction: no method returns any
 * learner identifier, selected answer, or per-learner row.
 */
import type { CourseMembershipRepository, CourseRepository } from "../course/ports";

export interface CurrentVersionItemStats {
  questionId: string;
  /** The Question's CURRENT QuestionVersion id at read time. */
  questionVersionId: string;
  prompt: string;
  /**
   * Distinct active LEARNERs whose FIRST persisted Attempt on this exact
   * current QuestionVersion is counted (repeat Attempts never add to this).
   */
  distinctResponderCount: number;
  /** Of those responders, how many were correct on that first Attempt. */
  correctCount: number;
}

/**
 * One Topic bucket of pooled first-attempt evidence (Run 009 S3). Counts are
 * INTERNAL to the application layer (eligibility + band derivation) and are
 * never returned by any use case or API.
 */
export interface TopicFirstAttemptStats {
  /** Null = the "no Topic" bucket (published Questions with no Topic). */
  topicId: string | null;
  topicName: string | null;
  topicArchived: boolean;
  /** Distinct active LEARNERs with at least one counted first attempt in this Topic. */
  distinctResponderCount: number;
  /** Counted first attempts pooled across the Topic's current published Questions. */
  firstAttemptCount: number;
  /** Of those, how many were correct. */
  correctAttemptCount: number;
}

export interface ItemAnalysisRepository {
  /**
   * Active LEARNER memberships in the Course — `role = 'LEARNER'` with
   * neither `revoked_at` nor `archived_at` set, mirroring
   * `isActiveMembership` (`src/domain/course/types.ts`).
   */
  countActiveLearners(courseId: string): Promise<number>;

  /**
   * One row per Question in the Course that has a current QuestionVersion
   * (draft-only Questions are excluded), in creation order, including
   * zero-response Questions. Attempts on older versions are excluded.
   */
  listCurrentVersionItemStats(courseId: string): Promise<CurrentVersionItemStats[]>;

  /**
   * One row per Topic that has current published Questions (archived Topics
   * included and flagged), plus one `topicId: null` row when published
   * Questions have no Topic, ordered by Topic creation (no-Topic last), with
   * zero-evidence Topics present. Topic is CURRENT (`questions.topic_id`).
   * Evidence: first persisted Attempt per (Question, active LEARNER) on the
   * Question's CURRENT QuestionVersion — same counting rule as
   * `listCurrentVersionItemStats`.
   */
  listTopicFirstAttemptStats(courseId: string): Promise<TopicFirstAttemptStats[]>;
}

export interface ItemAnalysisRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  itemAnalysis: ItemAnalysisRepository;
}

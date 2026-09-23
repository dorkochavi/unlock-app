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
}

export interface ItemAnalysisRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  itemAnalysis: ItemAnalysisRepository;
}

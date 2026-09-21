/**
 * Persistence ports for the Structured Import application layer — Run 007
 * S2/S4. Reuses `CourseMembershipRepository` (authorization),
 * `CourseRepository` (ARCHIVED-Course guard), `TopicRepository`
 * (Topic-name resolution/re-check), and `QuestionRepository`
 * (`createDraft`/`updateDraft`, Run 006, unchanged) from their existing
 * modules, mirroring `src/application/question/ports.ts`'s own established
 * discipline of small, explicit, read-only-where-possible interfaces.
 */
import type { CourseAuthoringRecord, CourseMembership, CourseMembershipRepository, CourseRepository } from "../course/ports";
import type { QuestionRepository } from "../question/ports";
import type { Topic, TopicRepository } from "../topic/ports";

export type { CourseAuthoringRecord, CourseMembership, CourseMembershipRepository, CourseRepository, QuestionRepository, Topic, TopicRepository };

/** The narrow repository set `previewImport` (Run 007 S2) needs — read-only, no `questions` port, since Preview never writes. */
export interface PreviewImportRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  topics: TopicRepository;
}

/**
 * The repository set `confirmImport` (Run 007 S4) needs INSIDE its atomic
 * transaction: the same mutable-invariant re-check reads `previewImport`
 * already needs (`memberships`, `courses`, `topics`) plus `questions` for
 * the actual `createDraft`/`updateDraft` write loop — see
 * `confirm-import.ts`'s own doc comment for why the transaction covers only
 * this re-check + write phase, not the earlier parse/full-validation phase
 * (which reuses `PreviewImportRepositories` against a plain, non-transactional
 * connection, exactly like the S3 preview route already does).
 */
export interface ImportRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  questions: QuestionRepository;
  topics: TopicRepository;
}

/**
 * Transaction boundary for `confirmImport` (Run 007 S4) — mirrors
 * `QuestionUnitOfWork`'s shape exactly (`src/application/question/ports.ts`),
 * narrowed to `ImportRepositories`.
 */
export interface ImportUnitOfWork {
  runInTransaction<T>(fn: (repos: ImportRepositories) => Promise<T>): Promise<T>;
}

/**
 * Persistence ports for the Structured Import application layer — Run 007
 * S2. Reuses `CourseMembershipRepository` (authorization),
 * `CourseRepository` (ARCHIVED-Course guard), and `TopicRepository`
 * (Topic-name resolution) unchanged from their existing modules, mirroring
 * `src/application/question/ports.ts`'s own established discipline of
 * small, explicit, read-only-where-possible interfaces.
 */
import type { CourseAuthoringRecord, CourseMembership, CourseMembershipRepository, CourseRepository } from "../course/ports";
import type { Topic, TopicRepository } from "../topic/ports";

export type { CourseAuthoringRecord, CourseMembership, CourseMembershipRepository, CourseRepository, Topic, TopicRepository };

/** The narrow repository set `previewImport` (Run 007 S2) needs — read-only, no `questions` port, since Preview never writes. */
export interface PreviewImportRepositories {
  memberships: CourseMembershipRepository;
  courses: CourseRepository;
  topics: TopicRepository;
}

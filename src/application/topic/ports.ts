/**
 * Persistence ports for the Topic application layer — Run 005 S4. Small,
 * explicit interfaces, not a generic `Repository<T>`, matching
 * `src/application/course/ports.ts`'s own established discipline.
 *
 * Reuses `CourseMembershipRepository` from the course module unchanged —
 * Topic authorization is derived from the same `CourseMembership` this
 * course module already owns; this module does not need its own copy of
 * that port.
 */
import type { CourseMembership, CourseMembershipRepository } from "../course/ports";

import type { Topic } from "../../domain/topic/types";

export type { CourseMembership, CourseMembershipRepository, Topic };

export interface CreateTopicInput {
  courseId: string;
  name: string;
}

export interface TopicRepository {
  createTopic(input: CreateTopicInput): Promise<Topic>;

  /** Active (non-archived) Topics for one Course, ordered by creation order. */
  listActiveForCourse(courseId: string): Promise<Topic[]>;

  /** `null` if no Topic exists with this id (archived or not). */
  getTopic(topicId: string): Promise<Topic | null>;

  /** Returns `null` if no Topic exists with this id. */
  renameTopic(topicId: string, name: string): Promise<Topic | null>;

  /**
   * Idempotent: archiving an already-archived Topic keeps its original
   * `archivedAt` instant rather than bumping it. Returns `null` if no Topic
   * exists with this id.
   */
  archiveTopic(topicId: string): Promise<Topic | null>;
}

export interface TopicRepositories {
  memberships: CourseMembershipRepository;
  topics: TopicRepository;
}

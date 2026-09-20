/**
 * archiveTopic — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR archiving one of their Course's Topics (Run 005
 * S4). Never deletes the row — see `Topic.archivedAt`'s own doc comment
 * (`src/domain/topic/types.ts`) for why. Idempotent: archiving an
 * already-archived Topic succeeds again without error, matching
 * `TopicRepository.archiveTopic`'s own contract.
 *
 * Same cross-Course guard as `rename-topic.ts` — see that module's doc
 * comment for the full reasoning, identical here.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { Topic, TopicRepositories } from "./ports";

export interface ArchiveTopicCommand {
  actorUserId: string;
  courseId: string;
  topicId: string;
}

export type ArchiveTopicResult =
  | { outcome: "ARCHIVED"; topic: Topic }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "TOPIC_NOT_FOUND" };

export async function archiveTopic(
  command: ArchiveTopicCommand,
  repos: TopicRepositories,
): Promise<ArchiveTopicResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const topic = await repos.topics.getTopic(command.topicId);
  if (topic === null || topic.courseId !== command.courseId) {
    return { outcome: "TOPIC_NOT_FOUND" };
  }

  const updated = await repos.topics.archiveTopic(command.topicId);
  if (updated === null) {
    return { outcome: "TOPIC_NOT_FOUND" };
  }
  return { outcome: "ARCHIVED", topic: updated };
}

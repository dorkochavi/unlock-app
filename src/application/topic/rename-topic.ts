/**
 * renameTopic — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR renaming one of their Course's Topics (Run 005
 * S4).
 *
 * `courseId` is always taken from the caller's own authoring context (the
 * URL path, at the route layer) and checked against the Topic's actual
 * persisted `courseId` below — never inferred from `topicId` alone. This
 * is what "Do not allow cross-Course Topic association" (Run 005
 * CHATGPT_PLAN.md S4) means at the application layer: a `topicId` that
 * exists but belongs to a DIFFERENT Course than `command.courseId` is
 * treated identically to a nonexistent Topic (`TOPIC_NOT_FOUND`), not a
 * distinct "wrong Course" outcome — so this never leaks which Course a
 * Topic actually belongs to.
 *
 * Authorization is checked BEFORE the Topic is loaded, using only
 * `command.courseId` (the same order `getCourseForAuthoring` already
 * uses) — an unauthorized caller never learns whether `topicId` exists at
 * all, let alone which Course it belongs to.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { Topic, TopicRepositories } from "./ports";

export interface RenameTopicCommand {
  actorUserId: string;
  courseId: string;
  topicId: string;
  name: string;
}

export type RenameTopicResult =
  | { outcome: "RENAMED"; topic: Topic }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "TOPIC_NOT_FOUND" }
  | { outcome: "INVALID_NAME" };

export async function renameTopic(
  command: RenameTopicCommand,
  repos: TopicRepositories,
): Promise<RenameTopicResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const name = command.name.trim();
  if (name.length === 0) {
    return { outcome: "INVALID_NAME" };
  }

  const topic = await repos.topics.getTopic(command.topicId);
  if (topic === null || topic.courseId !== command.courseId) {
    return { outcome: "TOPIC_NOT_FOUND" };
  }

  const updated = await repos.topics.renameTopic(command.topicId, name);
  if (updated === null) {
    // Reachable only if the Topic was deleted between the read above and
    // this write — not a normal V1 path (no code deletes a Topic row).
    return { outcome: "TOPIC_NOT_FOUND" };
  }
  return { outcome: "RENAMED", topic: updated };
}

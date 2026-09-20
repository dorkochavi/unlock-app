/**
 * createTopic — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR adding a flat Topic to their Course (Run 005 S4).
 * Authorization mirrors every other Run-005 authoring use case
 * (`canAuthorCourse`) exactly — Topic authoring is the same content-
 * authoring surface as Course metadata, not a separate policy.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { Topic, TopicRepositories } from "./ports";

export interface CreateTopicCommand {
  actorUserId: string;
  courseId: string;
  name: string;
}

export type CreateTopicResult =
  | { outcome: "CREATED"; topic: Topic }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "INVALID_NAME" };

export async function createTopic(
  command: CreateTopicCommand,
  repos: TopicRepositories,
): Promise<CreateTopicResult> {
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

  const topic = await repos.topics.createTopic({ courseId: command.courseId, name });
  return { outcome: "CREATED", topic };
}

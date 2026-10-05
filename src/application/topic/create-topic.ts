/**
 * createTopic — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR adding a flat Topic to their Course (Run 005 S4).
 * Authorization mirrors every other Run-005 authoring use case (RUN010-H.2:
 * `hasActiveAuthorGrant` over `course_authors`) exactly — Topic authoring is
 * the same content-authoring surface as Course metadata, not a separate
 * policy.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { hasActiveAuthorGrant } from "../../domain/course/types";
import { normalizeTopicName } from "../../domain/topic/types";
import type { Topic, TopicRepositories } from "./ports";

export interface CreateTopicCommand {
  actorUserId: string;
  courseId: string;
  name: string;
}

export type CreateTopicResult =
  | { outcome: "CREATED"; topic: Topic }
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "INVALID_NAME" }
  | { outcome: "DUPLICATE_NAME" };

export async function createTopic(
  command: CreateTopicCommand,
  repos: TopicRepositories,
): Promise<CreateTopicResult> {
  const authorGrants = await repos.authors.findActiveCapabilities(
    command.actorUserId,
    command.courseId,
  );
  if (!hasActiveAuthorGrant(authorGrants)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const name = command.name.trim();
  if (name.length === 0) {
    return { outcome: "INVALID_NAME" };
  }

  // Duplicate guard: at most one ACTIVE Topic per normalized name per Course
  // (same normalization Structured Import resolves with). Archived Topics do
  // not participate. Application-level check only — see handoff re: the
  // un-serialized check-then-insert race (no DB constraint, by design).
  const wanted = normalizeTopicName(name);
  const active = await repos.topics.listActiveForCourse(command.courseId);
  if (active.some((t) => normalizeTopicName(t.name) === wanted)) {
    return { outcome: "DUPLICATE_NAME" };
  }

  const topic = await repos.topics.createTopic({ courseId: command.courseId, name });
  return { outcome: "CREATED", topic };
}

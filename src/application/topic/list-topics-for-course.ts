/**
 * listTopicsForCourse — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR listing their Course's active flat Topics (Run
 * 005 S4). Authorized-only, same as every other Run-005 authoring read —
 * this is not a learner-facing Topic listing (no such surface exists yet).
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import type { Topic, TopicRepositories } from "./ports";

export interface ListTopicsForCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type ListTopicsForCourseResult =
  | { outcome: "READY"; topics: Topic[] }
  | { outcome: "NOT_AUTHORIZED" };

export async function listTopicsForCourse(
  command: ListTopicsForCourseCommand,
  repos: TopicRepositories,
): Promise<ListTopicsForCourseResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const topics = await repos.topics.listActiveForCourse(command.courseId);
  return { outcome: "READY", topics };
}

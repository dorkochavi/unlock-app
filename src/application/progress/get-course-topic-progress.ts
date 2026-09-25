/**
 * getCourseTopicProgress — Run 009 S1. A learner's own qualitative Topic
 * states for one Course. Read-only; no persisted aggregate.
 *
 * ## Authorization (fail closed)
 * Requires a LEARNER membership with `hasAccess` (not revoked) — ADR-015
 * §7/§8, same predicate as F-04a (`live-learner-membership.ts`). An ARCHIVED
 * but non-revoked learner stays authorized to read their own Progress:
 * archiving only removes the Course from the automatic Today set, not access
 * to the learner's own history. Missing, revoked, or OWNER/INSTRUCTOR
 * memberships are `NOT_AUTHORIZED` — an instructor is not treated as a
 * learner. Checked before Course status so a non-member learns nothing about
 * the Course.
 *
 * ## Active Course
 * Same meaning as Today/the Courses page: `status === "PUBLISHED"`;
 * otherwise `COURSE_NOT_ACTIVE`. No new archived-Course behavior (F-04b).
 *
 * ## Topics
 * Topic is CURRENT-DERIVED (Plan D6): Attempts follow the Question's current
 * `topic_id`. Archived Topics are not an active Progress destination and are
 * omitted; Today is unchanged and may still serve their Questions (per-Topic
 * denominators, so no other Topic's coverage is distorted). A Question with
 * no Topic is never shown as an "Uncategorized" Topic. Topics keep the
 * repository's deterministic order. `actorUserId` is trusted as-is at this
 * boundary (see `src/application/course/join-course.ts`).
 */
import { hasAccess } from "../../domain/course/types";
import {
  deriveLearnerTopicProgress,
  type LearnerTopicState,
  type TopicQuestionLearnerState,
} from "../../domain/progress/topic-progress";
import type { LearnerTopicProgressRepositories } from "./ports";

export interface GetCourseTopicProgressCommand {
  actorUserId: string;
  courseId: string;
}

export interface LearnerTopicProgressItem {
  topicId: string;
  name: string;
  state: LearnerTopicState;
  attemptedCount: number;
  totalCount: number;
}

export type GetCourseTopicProgressResult =
  | { outcome: "NOT_AUTHORIZED" }
  | { outcome: "COURSE_NOT_ACTIVE" }
  | { outcome: "READY"; topics: LearnerTopicProgressItem[] };

export async function getCourseTopicProgress(
  command: GetCourseTopicProgressCommand,
  repos: LearnerTopicProgressRepositories,
): Promise<GetCourseTopicProgressResult> {
  const membership = await repos.memberships.findMembership(command.actorUserId, command.courseId);
  if (membership === null || membership.role !== "LEARNER" || !hasAccess(membership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const statuses = await repos.courses.listStatuses([command.courseId]);
  const course = statuses.find((entry) => entry.id === command.courseId);
  if (course === undefined || course.status !== "PUBLISHED") {
    return { outcome: "COURSE_NOT_ACTIVE" };
  }

  const rows = await repos.topicProgress.listCourseQuestionsForLearner(
    command.actorUserId,
    command.courseId,
  );

  const byTopic = new Map<string, { name: string; questions: TopicQuestionLearnerState[] }>();
  for (const row of rows) {
    if (row.topicId === null || row.topicName === null || row.topicArchived) continue;
    let entry = byTopic.get(row.topicId);
    if (entry === undefined) {
      entry = { name: row.topicName, questions: [] };
      byTopic.set(row.topicId, entry);
    }
    entry.questions.push(row.learnerState);
  }

  const topics: LearnerTopicProgressItem[] = [...byTopic].map(([topicId, entry]) => ({
    topicId,
    name: entry.name,
    ...deriveLearnerTopicProgress(entry.questions),
  }));

  return { outcome: "READY", topics };
}

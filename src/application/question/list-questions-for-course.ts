/**
 * listQuestionsForCourse — the application-layer use case for an authorized
 * OWNER/active-INSTRUCTOR listing every Question (any authoring state) in
 * their Course (Run 006 S2). Mirrors `listTopicsForCourse`'s own
 * authorization shape exactly.
 *
 * Also resolves (Run 006 S4, reviewer finding):
 * - `publishedPromptByQuestionId` — the CURRENT QuestionVersion's prompt for
 *   every Question in the plain `PUBLISHED` state (no pending draft, so
 *   `question.draft.prompt` alone is `null` even though the Question has
 *   real, live, learner-facing content). Batched (one query for every
 *   Question needing it, via `getVersionPrompts`), and deliberately
 *   PROMPT-ONLY — a list view has no reason to receive `correctOptionIds`
 *   (that stays scoped to `getQuestionForAuthoring`'s single-Question
 *   "reopen/edit" support).
 * - `topicById` — every DISTINCT Topic actually referenced by a Question in
 *   this list, INCLUDING an archived one: `TopicRepository.getTopic` (unlike
 *   `listActiveForCourse`) does not filter by `archived_at`, so a Question
 *   whose Topic has since been archived (an explicitly supported state —
 *   Run 006 S1 finding #10, "no forced reassociation") still shows its real
 *   Topic name instead of silently rendering as "no Topic". Bounded by the
 *   number of DISTINCT Topics actually in use for this Course (small, not a
 *   per-row N+1), and fetched in parallel.
 *
 * `actorUserId` is trusted as-is at this boundary — see
 * `src/application/course/join-course.ts`'s module doc comment for why.
 */
import { canAuthorCourse } from "../../domain/course/types";
import { computeQuestionAuthoringState } from "../../domain/question/types";
import type { QuestionAuthoringRecord, QuestionRepositories, Topic } from "./ports";

export interface ListQuestionsForCourseCommand {
  actorUserId: string;
  courseId: string;
}

export type ListQuestionsForCourseResult =
  | {
      outcome: "LISTED";
      questions: QuestionAuthoringRecord[];
      publishedPromptByQuestionId: Record<string, string>;
      topicById: Record<string, Topic>;
    }
  | { outcome: "NOT_AUTHORIZED" };

export async function listQuestionsForCourse(
  command: ListQuestionsForCourseCommand,
  repos: QuestionRepositories,
): Promise<ListQuestionsForCourseResult> {
  const actorMembership = await repos.memberships.findMembership(
    command.actorUserId,
    command.courseId,
  );
  if (actorMembership === null || !canAuthorCourse(actorMembership)) {
    return { outcome: "NOT_AUTHORIZED" };
  }

  const questions = await repos.questions.listForCourse(command.courseId);

  const publishedVersionIds = [
    ...new Set(
      questions
        .filter((question) => computeQuestionAuthoringState(question) === "PUBLISHED")
        .map((question) => question.currentVersionId as string),
    ),
  ];
  const promptsByVersionId =
    publishedVersionIds.length > 0
      ? await repos.questions.getVersionPrompts(publishedVersionIds)
      : new Map<string, string>();
  const publishedPromptByQuestionId: Record<string, string> = {};
  for (const question of questions) {
    if (question.currentVersionId !== null) {
      const prompt = promptsByVersionId.get(question.currentVersionId);
      if (prompt !== undefined) {
        publishedPromptByQuestionId[question.id] = prompt;
      }
    }
  }

  const uniqueTopicIds = [
    ...new Set(questions.map((question) => question.topicId).filter((id): id is string => id !== null)),
  ];
  const topicEntries = await Promise.all(
    uniqueTopicIds.map(async (topicId) => [topicId, await repos.topics.getTopic(topicId)] as const),
  );
  const topicById: Record<string, Topic> = {};
  for (const [topicId, topic] of topicEntries) {
    if (topic !== null) {
      topicById[topicId] = topic;
    }
  }

  return { outcome: "LISTED", questions, publishedPromptByQuestionId, topicById };
}

/**
 * selectPracticeBatch — Course/Topic Practice selection (Run UX-02 P2,
 * ADR-020, `docs/LEARNING_ENGINE.md` §39A). NOT a second ranking engine: it
 * calls the SAME pure NBA candidate generation + ranking Today uses, on
 * in-scope progress, then appends the two §39A fallback tiers.
 *
 * Order: (1) canonical NBA ranking; (2) unseen (ADR-017 order: created_at,
 * id); (3) broader coverage (earliest `scheduledReviewAt`, then id).
 *
 * Exclusions: Questions PENDING in today's DailyPlan, Questions already
 * answered in the current learning-day session (Today or Practice), and the
 * client's skip hints — which are untrusted and can only NARROW the pool.
 *
 * Starting Practice get-or-creates today's DailyPlan first (ADR-020 §2): the
 * plan id IS the learning session; once it exists Practice never mutates it.
 * Eligibility is checked BEFORE the plan is created (fail closed).
 */
import { generateNextBestActionCandidates } from "../../domain/learning/next-best-action";
import { rankNextBestActionCandidates } from "../../domain/learning/next-best-action-ranking";
import type { UserQuestionProgress } from "../../domain/learning/types";
import {
  getOrCreateDailyPlanForToday,
  type DailyPlanGenerationSettings,
  type GetOrCreateDailyPlanForTodayPorts,
} from "../dailyPlan/get-or-create-daily-plan-for-today";
import type {
  LearnerQuestionContent,
  LearnerQuestionContentRepository,
  UserQuestionProgressRepository,
} from "../learning/ports";
import type { TopicRepository } from "../topic/ports";
import { isPracticeEligible, isUuid } from "./practice-eligibility";
import type { PracticeReadRepository } from "./ports";

export const PRACTICE_BATCH_SIZE = 10;
/** Bound on client-supplied hints; extras are ignored (narrowing-only, so this is safe). */
const MAX_SKIP_HINTS = 500;

export interface SelectPracticeBatchCommand {
  userId: string;
  courseId: string;
  /** null = Course Practice. */
  topicId: string | null;
  /** Untrusted client hints: may only exclude, never add. */
  skippedQuestionIds: readonly string[];
  /** Explicit request-scoped clock. */
  now: Date;
}

export interface SelectPracticeBatchPorts extends GetOrCreateDailyPlanForTodayPorts {
  topics: Pick<TopicRepository, "getTopic">;
  practice: PracticeReadRepository;
  progress: Pick<UserQuestionProgressRepository, "listForUser">;
  content: LearnerQuestionContentRepository;
}

export interface PracticeBatchItem extends LearnerQuestionContent {
  questionId: string;
}

export type SelectPracticeBatchResult =
  | { outcome: "NOT_ELIGIBLE" }
  | { outcome: "TOPIC_NOT_FOUND" }
  | { outcome: "TIMEZONE_NOT_SET" }
  | {
      outcome: "READY";
      scope: { kind: "COURSE" | "TOPIC"; title: string };
      items: PracticeBatchItem[];
      hasMore: boolean;
    };

export function eligibilityPorts(ports: GetOrCreateDailyPlanForTodayPorts) {
  return { memberships: ports.courseMemberships, courses: ports.courses };
}

export async function selectPracticeBatch(
  command: SelectPracticeBatchCommand,
  settings: DailyPlanGenerationSettings,
  ports: SelectPracticeBatchPorts,
): Promise<SelectPracticeBatchResult> {
  if (!isUuid(command.courseId)) return { outcome: "NOT_ELIGIBLE" };
  if (!(await isPracticeEligible(eligibilityPorts(ports), command.userId, command.courseId))) {
    return { outcome: "NOT_ELIGIBLE" };
  }

  let scopeTitle: string;
  if (command.topicId !== null) {
    if (!isUuid(command.topicId)) return { outcome: "TOPIC_NOT_FOUND" };
    const topic = await ports.topics.getTopic(command.topicId);
    if (topic === null || topic.courseId !== command.courseId || topic.archivedAt !== null) {
      return { outcome: "TOPIC_NOT_FOUND" };
    }
    scopeTitle = topic.name;
  } else {
    const course = await ports.courses.getCourseSummary(command.courseId);
    if (course === null) return { outcome: "NOT_ELIGIBLE" };
    scopeTitle = course.title;
  }

  // ADR-020: get-or-create today's frozen plan; its id is the learning session.
  const planResult = await getOrCreateDailyPlanForToday(
    { userId: command.userId, now: command.now },
    settings,
    ports,
  );
  if (planResult.outcome === "TIMEZONE_NOT_SET") return { outcome: "TIMEZONE_NOT_SET" };
  if (planResult.outcome === "USER_NOT_FOUND") return { outcome: "NOT_ELIGIBLE" };
  const plan = planResult.plan;

  const excluded = new Set<string>();
  for (const item of plan.items) {
    if (item.status === "pending") excluded.add(item.questionId);
  }
  for (const questionId of await ports.practice.listQuestionIdsAnsweredInSession(
    command.userId,
    plan.id,
  )) {
    excluded.add(questionId);
  }
  for (const hint of command.skippedQuestionIds.slice(0, MAX_SKIP_HINTS)) {
    excluded.add(hint);
  }

  const scopeQuestions = await ports.practice.listScopeQuestions(
    command.userId,
    command.courseId,
    command.topicId,
  );
  const eligible = scopeQuestions.filter((question) => !excluded.has(question.questionId));
  const eligibleIds = new Set(eligible.map((question) => question.questionId));

  // Tier 1 — the canonical NBA policy, unchanged, on in-scope eligible progress.
  const allProgress = await ports.progress.listForUser(command.userId, command.courseId);
  const progressByQuestion = new Map<string, UserQuestionProgress>();
  for (const progress of allProgress) {
    if (eligibleIds.has(progress.questionId)) progressByQuestion.set(progress.questionId, progress);
  }
  const nbaContext = { now: command.now, memoryScheduler: settings.memoryScheduler };
  const ranked = rankNextBestActionCandidates(
    [...progressByQuestion.values()].flatMap((progress) =>
      generateNextBestActionCandidates(progress, nbaContext),
    ),
    { now: command.now },
  );
  const ordered: string[] = ranked.map((entry) => entry.candidate.questionId);
  const chosen = new Set(ordered);

  // Tier 2 — unseen (no prior real Attempt); `eligible` is already created_at, id ordered.
  for (const question of eligible) {
    if (!question.attempted && !chosen.has(question.questionId)) {
      ordered.push(question.questionId);
      chosen.add(question.questionId);
    }
  }

  // Tier 3 — broader coverage: earliest scheduledReviewAt, then id.
  const coverage = eligible
    .filter((question) => !chosen.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      dueAt:
        progressByQuestion.get(question.questionId)?.memory?.scheduledReviewAt.getTime() ??
        Infinity,
    }))
    .sort(
      (a, b) =>
        a.dueAt - b.dueAt ||
        (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0),
    );
  for (const entry of coverage) ordered.push(entry.questionId);

  const versionByQuestion = new Map(eligible.map((q) => [q.questionId, q.questionVersionId]));
  const batchIds = ordered.slice(0, PRACTICE_BATCH_SIZE);
  const contents = await ports.content.findManyByVersionIds(
    batchIds.map((questionId) => versionByQuestion.get(questionId) as string),
  );
  const contentByVersion = new Map(contents.map((content) => [content.questionVersionId, content]));

  const items: PracticeBatchItem[] = [];
  for (const questionId of batchIds) {
    const content = contentByVersion.get(versionByQuestion.get(questionId) as string);
    if (content !== undefined) items.push({ questionId, ...content });
  }

  return {
    outcome: "READY",
    scope: { kind: command.topicId === null ? "COURSE" : "TOPIC", title: scopeTitle },
    items,
    hasMore: ordered.length > PRACTICE_BATCH_SIZE,
  };
}

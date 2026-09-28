/**
 * selectPracticeBatch — Course/Topic Practice selection (Run UX-02 P2,
 * ADR-020, `docs/LEARNING_ENGINE.md` §39A). NOT a second ranking engine: it
 * calls the SAME pure NBA candidate generation + ranking Today uses, on
 * in-scope progress, then appends the §39A fallback tiers.
 *
 * Order: (1) canonical NBA ranking; (2) unseen (ADR-017 order: created_at,
 * id); (3) broader coverage (earliest `scheduledReviewAt`, then id);
 * (4) RUN010-B same-day reinforcement (FUB-034) — see below.
 *
 * Exclusions from Tiers 1-3: Questions PENDING in today's DailyPlan,
 * Questions already answered in the current learning-day session (Today or
 * Practice), and the client's skip hints — which are untrusted and can only
 * NARROW the pool.
 *
 * ## Tier 4 — same-day reinforcement (RUN010-B, resolves FUB-034)
 *
 * Tiers 1-3 together always exhaust `eligible` entirely (every eligible
 * Question ends up somewhere in `ordered` after Tier 3 — Tier 3's "coverage"
 * sweep has no further filter beyond "not already chosen"). So
 * `ordered.length === 0` after Tier 3 means every Question in this scope is
 * either already answered today or excluded (pending-in-Today/skip-hinted)
 * — Tier 1-3 have nothing left to offer, which is the literal "first-pass
 * exhaustion" that used to dead-end Practice into `NoMore` for the rest of
 * the day. Tier 4 activates in EXACTLY that case (never merely "this page
 * is short" — a scope with, say, 13 never-answered Questions still returns
 * a genuine, un-padded 10/3 split across two calls; reinforcement never
 * displaces or delays first-pass content). If nothing in scope has actually
 * been ANSWERED yet either (e.g. everything is still pending-in-Today),
 * Tier 4's own candidate pool is correctly empty too — an honest `NoMore`,
 * not a bug.
 *
 * Candidates are every Question in scope that already has an Attempt this
 * learning-day session (drawn from the SAME exclusion query as above),
 * minus the client's skip hints (still narrowing-only), ranked by
 * `rankReinforcementCandidates` (weaker/incorrect evidence first, then
 * least-recently-answered first, with controlled randomness only among
 * exact ties and an anti-immediate-repeat swap — see that function's own
 * doc comment). This is the ONLY tier that ever resurfaces an
 * already-answered Question; it participates in the SAME `ordered`
 * array/slice/`hasMore` pipeline as Tiers 1-3, not a bypass.
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
import type { PracticeReadRepository, PracticeScopeQuestion } from "./ports";

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
  /**
   * RUN010-B: source of "controlled variability" for Tier 4 reinforcement
   * ordering — used ONLY to shuffle among candidates that are EXACT ties
   * on the weak/incorrect-then-least-recently-answered ranking (see
   * `rankReinforcementCandidates`), never to override that ordering.
   * Optional and defaults to `Math.random` so no existing caller needs to
   * change; tests inject a deterministic function instead. Every other
   * tier stays fully deterministic (see `interleaveByTopic`'s own doc
   * comment on why Tiers 2/3 deliberately use no randomness at all).
   */
  random?: () => number;
}

export interface SelectPracticeBatchPorts extends GetOrCreateDailyPlanForTodayPorts {
  topics: Pick<TopicRepository, "getTopic">;
  practice: PracticeReadRepository;
  progress: Pick<UserQuestionProgressRepository, "listForUser">;
  content: LearnerQuestionContentRepository;
}

export interface PracticeBatchItem extends LearnerQuestionContent {
  questionId: string;
  /**
   * UX-03-QA1 Finding 7: current Topic attribution (ADR-018), exposed on the
   * wire so the batch-completion summary can honestly report how many
   * distinct Topics the learner touched in this batch — no new persistence,
   * reusing the same `topicId` `PracticeScopeQuestion` already carries.
   */
  topicId: string | null;
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

/**
 * UX-03-QA1 Finding 5: interleaves an already-sorted list by Topic, so a
 * Practice batch does not surface content in raw import/creation order (all
 * of Topic A, then all of Topic B, ...) merely because Tier 2/3 have no other
 * ranking signal. Preserves each item's RELATIVE order within its own Topic
 * (the canonical `created_at`/id or `dueAt`/id tie-break stays intact
 * per-Topic); only regroups ACROSS Topics, via deterministic round-robin —
 * no randomness, fully reproducible for the same input.
 *
 * Deliberately never applied to Tier 1 (the canonical NBA ranking — the
 * SAME shared, pure function Today's own generation calls, see
 * `next-best-action-ranking.ts`): this function only ever receives Tier 2/3
 * candidates below, which are wholly owned by Practice selection and have no
 * effect on Today. "Randomize ties, not learning priorities" — Tier order
 * (1 before 2 before 3) and each Tier's own ranking signal are both
 * untouched; only which Topic's item comes first among otherwise-equal
 * candidates changes.
 */
export function interleaveByTopic<T extends { topicId: string | null }>(
  items: readonly T[],
): T[] {
  const buckets = new Map<string, T[]>();
  const bucketOrder: string[] = [];
  for (const item of items) {
    const key = item.topicId ?? "";
    let bucket = buckets.get(key);
    if (bucket === undefined) {
      bucket = [];
      buckets.set(key, bucket);
      bucketOrder.push(key);
    }
    bucket.push(item);
  }
  const result: T[] = [];
  for (let round = 0; result.length < items.length; round++) {
    for (const key of bucketOrder) {
      const bucket = buckets.get(key) as T[];
      if (round < bucket.length) {
        result.push(bucket[round]);
      }
    }
  }
  return result;
}

/**
 * RUN010-B Tier 4 — orders same-day reinforcement candidates (Questions
 * already answered at least once today, in scope) by:
 *
 *   1. weaker evidence first — the candidate's most recent Attempt TODAY
 *      was incorrect (derived from `lastCorrectAt`/`lastIncorrectAt`,
 *      never from a raw Attempt scan);
 *   2. then least-recently-answered first (`lastAttemptAt` ascending),
 *      within the same bucket from (1);
 *   3. `questionId` as the final deterministic tie-break, before any
 *      randomness is applied.
 *
 * Controlled randomness (the injected `random`) is applied ONLY by
 * shuffling within a group of candidates that are EXACT ties on (1) and
 * (2) together — it can never promote a "weaker"/older candidate behind a
 * "stronger"/newer one, matching `interleaveByTopic`'s own
 * "randomize ties, not priorities" discipline.
 *
 * Anti-immediate-repeat (Part 1 Q1/Q3): after ranking, if the top-ranked
 * candidate is the Question with the single most-recently-answered
 * Attempt among ALL candidates (i.e. the Question the learner most likely
 * just finished), and at least one OTHER candidate exists, it is swapped
 * with the next one — never returned first when any alternative exists,
 * even a lower-priority one. With exactly one candidate, that candidate is
 * unavoidably returned (the only coherent fallback for a tiny scope).
 *
 * Defensive: a candidate missing a progress row (should not happen — every
 * "answered today" Question has one) is silently skipped rather than
 * crashing.
 */
export function rankReinforcementCandidates(
  candidates: readonly PracticeScopeQuestion[],
  progressByQuestion: ReadonlyMap<string, UserQuestionProgress>,
  random: () => number = Math.random,
): string[] {
  interface Entry {
    questionId: string;
    wasLastAttemptIncorrect: boolean;
    lastAttemptAtMs: number;
  }

  const entries: Entry[] = [];
  for (const candidate of candidates) {
    const progress = progressByQuestion.get(candidate.questionId);
    if (progress === undefined) continue;
    const lastCorrectMs = progress.lastCorrectAt?.getTime() ?? -Infinity;
    const lastIncorrectMs = progress.lastIncorrectAt?.getTime() ?? -Infinity;
    entries.push({
      questionId: candidate.questionId,
      wasLastAttemptIncorrect: lastIncorrectMs > lastCorrectMs,
      lastAttemptAtMs: progress.lastAttemptAt?.getTime() ?? -Infinity,
    });
  }
  if (entries.length === 0) return [];

  const mostRecentlyAnsweredQuestionId = entries.reduce((mostRecent, entry) =>
    entry.lastAttemptAtMs > mostRecent.lastAttemptAtMs ? entry : mostRecent,
  ).questionId;

  entries.sort((a, b) => {
    if (a.wasLastAttemptIncorrect !== b.wasLastAttemptIncorrect) {
      return a.wasLastAttemptIncorrect ? -1 : 1;
    }
    if (a.lastAttemptAtMs !== b.lastAttemptAtMs) {
      return a.lastAttemptAtMs - b.lastAttemptAtMs;
    }
    return a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0;
  });

  // Fisher-Yates shuffle, restricted to each run of exact ties.
  let groupStart = 0;
  for (let i = 1; i <= entries.length; i++) {
    const atBoundary =
      i === entries.length ||
      entries[i].wasLastAttemptIncorrect !== entries[groupStart].wasLastAttemptIncorrect ||
      entries[i].lastAttemptAtMs !== entries[groupStart].lastAttemptAtMs;
    if (atBoundary) {
      for (let j = i - 1; j > groupStart; j--) {
        const k = groupStart + Math.floor(random() * (j - groupStart + 1));
        [entries[j], entries[k]] = [entries[k], entries[j]];
      }
      groupStart = i;
    }
  }

  const ranked = entries.map((entry) => entry.questionId);
  if (ranked.length > 1 && ranked[0] === mostRecentlyAnsweredQuestionId) {
    [ranked[0], ranked[1]] = [ranked[1], ranked[0]];
  }
  return ranked;
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

  const answeredInSessionIds = await ports.practice.listQuestionIdsAnsweredInSession(
    command.userId,
    plan.id,
  );
  const answeredInSessionSet = new Set(answeredInSessionIds);
  const skipHints = new Set(command.skippedQuestionIds.slice(0, MAX_SKIP_HINTS));

  const excluded = new Set<string>();
  for (const item of plan.items) {
    if (item.status === "pending") excluded.add(item.questionId);
  }
  for (const questionId of answeredInSessionSet) excluded.add(questionId);
  for (const questionId of skipHints) excluded.add(questionId);

  const scopeQuestions = await ports.practice.listScopeQuestions(
    command.userId,
    command.courseId,
    command.topicId,
  );
  const eligible = scopeQuestions.filter((question) => !excluded.has(question.questionId));
  const eligibleIds = new Set(eligible.map((question) => question.questionId));

  // Tier 1 — the canonical NBA policy, unchanged, on in-scope eligible progress.
  // Also indexes EVERY scope Question's progress (not just eligible), so
  // Tier 4 reinforcement (below) can rank already-answered-today Questions
  // without a second `listForUser` call.
  const allProgress = await ports.progress.listForUser(command.userId, command.courseId);
  const allProgressByQuestion = new Map<string, UserQuestionProgress>();
  const progressByQuestion = new Map<string, UserQuestionProgress>();
  for (const progress of allProgress) {
    allProgressByQuestion.set(progress.questionId, progress);
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

  // Tier 2 — unseen (no prior real Attempt); `eligible` is already created_at,
  // id ordered. UX-03-QA1 Finding 5: Topic-interleaved (see
  // `interleaveByTopic`'s own doc comment) — a fresh, just-imported course has
  // ALL its Questions in this tier with no other ranking signal, which is
  // exactly where raw import order was visible to the learner as a
  // predictable sequence.
  const unseen = eligible.filter(
    (question) => !question.attempted && !chosen.has(question.questionId),
  );
  for (const question of interleaveByTopic(unseen)) {
    ordered.push(question.questionId);
    chosen.add(question.questionId);
  }

  // Tier 3 — broader coverage: earliest scheduledReviewAt, then id; then
  // Topic-interleaved on top of that tie-break, same reasoning as Tier 2.
  const coverage = eligible
    .filter((question) => !chosen.has(question.questionId))
    .map((question) => ({
      questionId: question.questionId,
      topicId: question.topicId,
      dueAt:
        progressByQuestion.get(question.questionId)?.memory?.scheduledReviewAt.getTime() ??
        Infinity,
    }))
    .sort(
      (a, b) =>
        a.dueAt - b.dueAt ||
        (a.questionId < b.questionId ? -1 : a.questionId > b.questionId ? 1 : 0),
    );
  for (const entry of interleaveByTopic(coverage)) ordered.push(entry.questionId);

  // Tier 4 — RUN010-B same-day reinforcement (FUB-034). Activates only when
  // Tiers 1-3 produced NOTHING for this scope — see this module's doc
  // comment for why `ordered.length === 0` here means precisely "every
  // Question in scope has already been answered today," not merely "this
  // page is short."
  if (ordered.length === 0) {
    const reinforcementCandidates = scopeQuestions.filter(
      (question) => answeredInSessionSet.has(question.questionId) && !skipHints.has(question.questionId),
    );
    for (const questionId of rankReinforcementCandidates(
      reinforcementCandidates,
      allProgressByQuestion,
      command.random,
    )) {
      ordered.push(questionId);
    }
  }

  const versionByQuestion = new Map(scopeQuestions.map((q) => [q.questionId, q.questionVersionId]));
  const topicByQuestion = new Map(scopeQuestions.map((q) => [q.questionId, q.topicId]));
  const batchIds = ordered.slice(0, PRACTICE_BATCH_SIZE);
  const contents = await ports.content.findManyByVersionIds(
    batchIds.map((questionId) => versionByQuestion.get(questionId) as string),
  );
  const contentByVersion = new Map(contents.map((content) => [content.questionVersionId, content]));

  const items: PracticeBatchItem[] = [];
  for (const questionId of batchIds) {
    const content = contentByVersion.get(versionByQuestion.get(questionId) as string);
    if (content !== undefined) {
      items.push({ questionId, topicId: topicByQuestion.get(questionId) ?? null, ...content });
    }
  }

  return {
    outcome: "READY",
    scope: { kind: command.topicId === null ? "COURSE" : "TOPIC", title: scopeTitle },
    items,
    hasMore: ordered.length > PRACTICE_BATCH_SIZE,
  };
}

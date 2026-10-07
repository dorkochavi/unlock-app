/**
 * Today learning recap (RUN TODAY-LEARNING-RECAP-004) — a PURE, presentation-
 * only summary of what the learner did in ONE DailyPlan so far.
 *
 * It is derived on every read from persisted evidence (plan items + the
 * Attempts linked to this plan). It is never persisted, never written back,
 * and never feeds scheduling/mastery; "strong today" / "revisit" are
 * descriptive labels of today's answers, NOT mastery or weakness claims.
 *
 * ## Inputs
 * - `items`: the plan items (`status`, id). Order/eligibility are not used.
 * - `attempts`: one row per Attempt made on this plan (daily_plan_id = plan):
 *   `isCorrect`, `confidenceLevel` ('high' | 'medium' | 'low' | null) and the
 *   question's CURRENT topic (`topicId`/`topicName` nullable, `topicArchived`).
 *
 * ## Derivation rules
 * - answered  = plan items that have an Attempt row (earliest row wins if a
 *   duplicate ever exists; rows pointing at no plan item are ignored).
 * - skipped   = plan items with status "skipped". Skips have no Attempt and are
 *   NEVER counted as wrong.
 * - correct   = answered items whose Attempt is_correct; incorrect = answered - correct.
 * - sureIncorrect = answered, confidence "high", not correct.
 * - sureCorrect   = answered, confidence "high", correct.
 *   (null/"low"/"medium" confidence contribute to neither; null is not "unsure".)
 * - Topic groups use only answered items with a non-null, non-archived topic
 *   name (null/archived topics still count in the totals above, but form no
 *   group and are not named).
 *   - strongTopics  = groups with answered > 0 and every answer correct.
 *   - revisitTopics = groups with at least one incorrect answer.
 *   - topicsWorked  = number of such groups.
 *   Lists are sorted by first-answered order (stable, deterministic); the UI
 *   caps what it shows.
 */

export interface LearningRecapPlanItem {
  id: string;
  status: string;
}

export interface LearningRecapAttemptRow {
  dailyPlanItemId: string;
  isCorrect: boolean;
  confidenceLevel: string | null;
  topicId: string | null;
  topicName: string | null;
  topicArchived: boolean;
}

export interface TodayLearningRecap {
  answered: number;
  skipped: number;
  correct: number;
  incorrect: number;
  sureIncorrect: number;
  sureCorrect: number;
  topicsWorked: number;
  strongTopics: string[];
  revisitTopics: string[];
}

/** Port: attempts of ONE plan for ONE (authenticated) user. */
export interface DailyPlanAttemptReader {
  findAttemptsForPlan(userId: string, dailyPlanId: string): Promise<LearningRecapAttemptRow[]>;
}

export function deriveLearningRecap(
  items: readonly LearningRecapPlanItem[],
  attempts: readonly LearningRecapAttemptRow[],
): TodayLearningRecap {
  const itemIds = new Set(items.map((item) => item.id));
  const byItem = new Map<string, LearningRecapAttemptRow>();
  for (const row of attempts) {
    if (!itemIds.has(row.dailyPlanItemId) || byItem.has(row.dailyPlanItemId)) continue;
    byItem.set(row.dailyPlanItemId, row);
  }
  const answeredRows = [...byItem.values()];

  let correct = 0;
  let sureIncorrect = 0;
  let sureCorrect = 0;
  const topics = new Map<string, { name: string; anyIncorrect: boolean }>();
  for (const row of answeredRows) {
    if (row.isCorrect) correct += 1;
    if (row.confidenceLevel === "high") {
      if (row.isCorrect) sureCorrect += 1;
      else sureIncorrect += 1;
    }
    const name = row.topicName?.trim() ?? "";
    if (row.topicId !== null && !row.topicArchived && name !== "") {
      const group = topics.get(row.topicId) ?? { name, anyIncorrect: false };
      if (!row.isCorrect) group.anyIncorrect = true;
      topics.set(row.topicId, group);
    }
  }

  const groups = [...topics.values()];
  return {
    answered: answeredRows.length,
    skipped: items.filter((item) => item.status === "skipped").length,
    correct,
    incorrect: answeredRows.length - correct,
    sureIncorrect,
    sureCorrect,
    topicsWorked: groups.length,
    strongTopics: groups.filter((g) => !g.anyIncorrect).map((g) => g.name),
    revisitTopics: groups.filter((g) => g.anyIncorrect).map((g) => g.name),
  };
}

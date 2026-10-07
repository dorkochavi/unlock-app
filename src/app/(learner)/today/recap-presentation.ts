/**
 * Pure presentation helpers for the Today home recap/orientation copy
 * (Run TODAY-LEARNING-RECAP-004). No fetching, no state, no persistence:
 * everything is derived from fields the Today payload already carries (the
 * plan items' frozen `actionType`/`status` and the server-derived
 * `learningRecap`). Wording is neutral and descriptive — never mastery,
 * improvement or weakness claims, and a skip is never "wrong".
 */
import type { TodayLearningRecap } from "@/application/dailyPlan/derive-learning-recap";
import { interpolate } from "@/lib/interpolate";
import { getMessages } from "@/messages";

export const MAX_RECAP_TOPICS = 3;
/** Sure-and-correct is only mentioned from this many answers up (single is not an insight). */
export const MIN_SURE_CORRECT_FOR_INSIGHT = 2;

const ORIENTATION_ORDER = [
  "REVIEW_DUE",
  "STRENGTHEN_MEMORY",
  "RELEARN_LAPSE",
  "REPAIR_MISCONCEPTION",
  "NEW_LEARNING",
] as const;

/** Before starting: one quiet line from the frozen actionType counts; null when there is nothing sensible to say. */
export function orientationLine(items: readonly { actionType: string }[]): string | null {
  const m = getMessages().today.recap;
  const parts: string[] = [];
  for (const type of ORIENTATION_ORDER) {
    const count = items.filter((item) => item.actionType === type).length;
    if (count === 0) continue;
    const forms = m.orientationParts[type];
    parts.push(count === 1 ? forms.one : interpolate(forms.other, { count }));
  }
  if (parts.length === 0) return null;
  const last = parts[parts.length - 1];
  const joiner = /^\d/.test(last) ? `${m.orientationJoin}־` : m.orientationJoin;
  const list =
    parts.length === 1
      ? last
      : `${parts.slice(0, -1).join(m.orientationSeparator)} ${joiner}${last}`;
  return interpolate(m.orientation, { parts: list });
}

/** In progress: "עד עכשיו: X מתוך Y נכונות"; null when nothing was answered (e.g. only skipped) or no recap. */
export function soFarLine(recap: TodayLearningRecap | undefined): string | null {
  if (recap === undefined || recap.answered <= 0) return null;
  return interpolate(getMessages().today.recap.soFar, {
    correct: recap.correct,
    answered: recap.answered,
  });
}

/** Done: at most ONE confidence line. Sure-but-incorrect wins; sure-and-correct needs >= 2. */
export function confidenceInsight(recap: TodayLearningRecap): string | null {
  const m = getMessages().today.recap;
  if (recap.sureIncorrect === 1) return m.sureIncorrectOne;
  if (recap.sureIncorrect > 1) return interpolate(m.sureIncorrect, { count: recap.sureIncorrect });
  if (recap.sureCorrect >= MIN_SURE_CORRECT_FOR_INSIGHT) {
    return interpolate(m.sureCorrect, { count: recap.sureCorrect });
  }
  return null;
}

/** Cap a topic list at `max` names + a "ועוד N" remainder. */
export function capTopics(
  names: readonly string[],
  max: number = MAX_RECAP_TOPICS,
): { shown: string[]; moreLabel: string | null } {
  if (names.length <= max) return { shown: [...names], moreLabel: null };
  return {
    shown: names.slice(0, max),
    moreLabel: interpolate(getMessages().today.recap.topicsMore, { count: names.length - max }),
  };
}

export interface RecapOverview {
  correctOfAnswered: string | null;
  topicsWorked: string | null;
}

/** Done overview lines (skips are already shown by the hero's summary chips). */
export function recapOverview(recap: TodayLearningRecap): RecapOverview {
  const m = getMessages().today.recap;
  return {
    correctOfAnswered:
      recap.answered > 0
        ? interpolate(m.correctOfAnswered, { correct: recap.correct, answered: recap.answered })
        : null,
    topicsWorked:
      recap.topicsWorked === 1
        ? m.topicsWorkedOne
        : recap.topicsWorked > 1
          ? interpolate(m.topicsWorked, { count: recap.topicsWorked })
          : null,
  };
}

/** True when the done recap has at least one line worth a surface (never render an empty card). */
export function hasRecapContent(recap: TodayLearningRecap | undefined): recap is TodayLearningRecap {
  if (recap === undefined || recap.answered <= 0) return false;
  return true;
}

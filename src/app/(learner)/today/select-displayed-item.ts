import type { DailyPlanItemDto } from "@/app/api/daily-plan/today/daily-plan-dto";

export type AnswerFeedback = { itemId: string; isCorrect: boolean };

/**
 * Which item the Today page shows, and the feedback (if any) bound to it.
 *
 * While valid feedback exists, the just-answered item (already `completed`
 * server-side/locally) stays displayed so the learner sees correct/incorrect
 * and Continue. Feedback is valid only if it references an existing,
 * non-pending item; anything else is ignored so it can never block progress.
 * With no valid feedback, the first pending item is shown (null = complete).
 */
export function selectDisplayedItem(
  items: readonly DailyPlanItemDto[],
  feedback: AnswerFeedback | null,
): { item: DailyPlanItemDto | null; feedback: AnswerFeedback | null } {
  if (feedback !== null) {
    const answered = items.find((item) => item.id === feedback.itemId);
    if (answered !== undefined && answered.status !== "pending") {
      return { item: answered, feedback };
    }
  }
  return { item: items.find((item) => item.status === "pending") ?? null, feedback: null };
}

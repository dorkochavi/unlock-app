/**
 * Run 009 S3 — the coarse, descriptive first-answer band shared by Item
 * Analysis (per Question) and Topic Insights (per Topic), under the F-02
 * privacy contract (CHATGPT_PLAN.md D1).
 *
 * Over the ELIGIBLE first accepted answers (c correct of n), with
 * integer-safe comparisons only (no floats, no percentages):
 * - MOSTLY_CORRECT:   3c > 2n   (more than 2/3 correct)
 * - MIXED:            n <= 3c <= 2n   (between 1/3 and 2/3 inclusive — exactly
 *                     1/3 and exactly 2/3 are MIXED)
 * - MOSTLY_INCORRECT: 3c < n    (fewer than 1/3 correct)
 *
 * The band is the ONLY thing derived from c and n that leaves the read
 * model: neither number nor any percentage is ever returned. The band names
 * are descriptive of the metric ("first answers"), never interpretive.
 */
export const ANSWER_BANDS = ["MOSTLY_CORRECT", "MIXED", "MOSTLY_INCORRECT"] as const;
export type AnswerBand = (typeof ANSWER_BANDS)[number];

/**
 * Non-integer, negative, `n === 0`, or `c > n` inputs are a caller bug, not a
 * band — throws rather than guessing (fail closed). Callers must check
 * disclosure eligibility (n >= the responder minimum) before classifying.
 */
export function deriveAnswerBand(correct: number, total: number): AnswerBand {
  if (!Number.isInteger(correct) || !Number.isInteger(total) || total <= 0 || correct < 0 || correct > total) {
    throw new Error(`deriveAnswerBand: invalid counts (correct=${correct}, total=${total})`);
  }
  if (3 * correct > 2 * total) return "MOSTLY_CORRECT";
  if (3 * correct < total) return "MOSTLY_INCORRECT";
  return "MIXED";
}

/**
 * Exam Urgency Amplifier V1 (RUN010-D).
 *
 * Origin: docs/GLOBAL_TODAY_PRIORITY_MODEL.md §3/§7/§12/§14 ("Option C —
 * hybrid", accepted direction). Exam urgency is a MULTIPLICATIVE amplifier
 * on an already-computed base need value, confined to the within-tier
 * tie-break layer (next-best-action-ranking.ts) — NEVER an additive term,
 * and NEVER able to promote a candidate across a priority tier boundary.
 * §3 explains why additive is wrong: a Course with no exam date has only
 * one sane additive contribution — zero — which silently becomes a
 * structural penalty inside a summed score. A multiplicative amplifier
 * naturally defaults to neutral (1.0, a complete no-op) for an exam-free
 * Course instead.
 *
 * Source of the exam date: `courses.exam_date` alone
 * (docs/OPEN_QUESTIONS.md #2 reasoning, recorded at the call site in
 * generate-daily-plan-for-resolved-inputs.ts) — no personal/learner-level
 * exam date field exists anywhere in the schema, so there is no hierarchy
 * to resolve here.
 *
 * KNOWN SIMPLIFICATION (RUN010-D review, non-blocking): `daysUntilExam` is
 * computed against `now` as a raw instant, with `examDate` parsed as UTC
 * midnight of its `YYYY-MM-DD` string — NOT the learner's own IANA-timezone
 * local day (`deriveLocalDateString`, used elsewhere for `plannedForDate`).
 * For a learner far from UTC this can shift the amplifier's curve by up to
 * ~10-14 hours relative to their own local exam day. Because the curve is
 * smooth/continuous and confined to a within-tier tie-break (never a tier
 * or applicability decision), this is judged low-impact today, but should
 * be aligned to the learner-local-day convention if/when this amplifier is
 * calibrated further.
 *
 * Curve shape: deliberately SMOOTH (continuous, monotonically decreasing as
 * the exam recedes), not the product spec's illustrative two-stage
 * piecewise shape ("rises ~14 days before, more sharply ~3-4 days before").
 * docs/GLOBAL_TODAY_PRIORITY_MODEL.md §12 explicitly warns against adopting
 * that piecewise shape literally without further design work, citing
 * discontinuity risk ("why did this suddenly rank higher") — an exponential
 * decay avoids any discontinuity while preserving the same qualitative
 * "cost of forgetting rises as the exam approaches" intuition.
 *
 * STATUS: the constants below (AMPLITUDE, DECAY_HALF_LIFE_DAYS) are an
 * INITIAL CALIBRATION CANDIDATE, explicitly NOT final — exactly the same
 * status docs/OPEN_QUESTIONS.md #16 gives the Today Plan Budget's 5/8-12/15
 * numbers. The architecture (multiplicative, within-tier-only, neutral when
 * absent) does not depend on these exact values being permanent.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** No-op amplifier — a complete pass-through on whatever it multiplies. */
export const NEUTRAL_EXAM_URGENCY_AMPLIFIER = 1;

/**
 * How much amplifier "headroom" exists above neutral at the exam's own due
 * moment (daysUntilExam === 0): amplifier caps out at
 * `NEUTRAL_EXAM_URGENCY_AMPLIFIER + EXAM_URGENCY_AMPLITUDE`. Calibration
 * candidate — see module doc comment.
 */
export const EXAM_URGENCY_AMPLITUDE = 1;

/**
 * Smoothing constant for the exponential decay (in days) — roughly how
 * quickly the amplifier decays back toward neutral as the exam recedes.
 * Calibration candidate — see module doc comment.
 */
export const EXAM_URGENCY_DECAY_HALF_LIFE_DAYS = 7;

/**
 * Computes the exam-urgency amplifier for a single Course's exam date, at
 * `now`. Pure, deterministic: no Date.now().
 *
 * - `examDate === null` (no exam set for this Course) -> NEUTRAL (1.0),
 *   always — an exam-free Course must never be penalized or boosted
 *   (docs/GLOBAL_TODAY_PRIORITY_MODEL.md §3/§8).
 * - `examDate` already in the past (relative to `now`) -> NEUTRAL — a
 *   lapsed exam date carries no forward-looking urgency to amplify, and
 *   treating a stale exam date as maximally urgent forever would be a
 *   silent bug, not a feature.
 * - otherwise -> a smooth, monotonically-increasing-as-the-exam-approaches
 *   value in `(NEUTRAL, NEUTRAL + EXAM_URGENCY_AMPLITUDE]`, via exponential
 *   decay in `daysUntilExam`. At `daysUntilExam === 0` (exam is today), the
 *   amplifier reaches its maximum. Far from the exam, the amplifier
 *   converges to NEUTRAL (in double-precision arithmetic, effectively
 *   indistinguishable from exactly 1.0 well before a year out).
 */
export function computeExamUrgencyAmplifier(
  examDate: Date | null,
  now: Date,
): number {
  if (examDate === null) {
    return NEUTRAL_EXAM_URGENCY_AMPLIFIER;
  }

  const daysUntilExam = (examDate.getTime() - now.getTime()) / MS_PER_DAY;
  if (daysUntilExam < 0) {
    return NEUTRAL_EXAM_URGENCY_AMPLIFIER;
  }

  return (
    NEUTRAL_EXAM_URGENCY_AMPLIFIER +
    EXAM_URGENCY_AMPLITUDE *
      Math.exp(-daysUntilExam / EXAM_URGENCY_DECAY_HALF_LIFE_DAYS)
  );
}

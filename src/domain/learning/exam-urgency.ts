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
 * Exam-date semantics (accepted decision OQ-046): `exam_date` is the
 * learner's LOCAL calendar date. `daysUntilExam` is the whole number of
 * local calendar days between the learner's current local date (the same
 * local date that keys the DailyPlan, `plannedForDate`) and `exam_date`.
 * The exam date itself => 0 days => maximum amplifier; a local date after
 * `exam_date` => neutral. There is no separate learning-day boundary and no
 * instant/timezone math in this module: both inputs are `YYYY-MM-DD`
 * strings and the difference is plain UTC date arithmetic on them.
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
 * STATUS: the constants below (AMPLITUDE, DECAY_DAYS) are an
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
 * E-folding (decay) constant, in days, of `exp(-daysUntilExam / this)`: the
 * excess over neutral shrinks by a factor of e every this-many days. This is
 * NOT a half-life (the true half-life is ln(2) * 7 ~= 4.85 days).
 * Calibration candidate — see module doc comment.
 */
export const EXAM_URGENCY_DECAY_DAYS = 7;

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateStringToUtcDayNumber(value: string, label: string): number {
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    throw new Error(`computeExamUrgencyAmplifier: ${label} must be YYYY-MM-DD, got "${value}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new Error(`computeExamUrgencyAmplifier: ${label} is not a real date: "${value}"`);
  }
  return ms / MS_PER_DAY;
}

/**
 * Whole local calendar days from `localDate` to `examDate` (both
 * `YYYY-MM-DD`). Negative when `examDate` is before `localDate`.
 */
export function wholeDaysUntilExamDate(examDate: string, localDate: string): number {
  return (
    dateStringToUtcDayNumber(examDate, "examDate") -
    dateStringToUtcDayNumber(localDate, "localDate")
  );
}

/**
 * Computes the exam-urgency amplifier for a single Course's exam date, given
 * the learner's current local calendar date. Pure, deterministic: no
 * Date.now(), no instants, no timezone lookup.
 *
 * - `examDate === null` (no exam set for this Course) -> NEUTRAL (1.0),
 *   always — an exam-free Course must never be penalized or boosted
 *   (docs/GLOBAL_TODAY_PRIORITY_MODEL.md §3/§8).
 * - `examDate` before `learnerLocalDate` (exam passed) -> NEUTRAL — a
 *   lapsed exam date carries no forward-looking urgency to amplify.
 * - otherwise -> `NEUTRAL + AMPLITUDE * exp(-days / EXAM_URGENCY_DECAY_DAYS)`
 *   with `days` the whole local calendar days until the exam. On the exam
 *   date itself (days === 0) the amplifier is exactly its maximum (2.0).
 */
export function computeExamUrgencyAmplifier(
  examDate: string | null,
  learnerLocalDate: string,
): number {
  if (examDate === null) {
    return NEUTRAL_EXAM_URGENCY_AMPLIFIER;
  }

  const daysUntilExam = wholeDaysUntilExamDate(examDate, learnerLocalDate);
  if (daysUntilExam < 0) {
    return NEUTRAL_EXAM_URGENCY_AMPLIFIER;
  }

  return (
    NEUTRAL_EXAM_URGENCY_AMPLIFIER +
    EXAM_URGENCY_AMPLITUDE * Math.exp(-daysUntilExam / EXAM_URGENCY_DECAY_DAYS)
  );
}

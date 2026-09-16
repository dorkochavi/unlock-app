/**
 * Today Planner V1.
 *
 * NBA ranking (next-best-action-ranking.ts) answers "what should come
 * first?". This file answers a DIFFERENT question: "which items should be
 * included in today's session, and in what order?". The two
 * responsibilities are deliberately kept separate — this file never
 * re-ranks, re-scores, or reorders; it only decides HOW MANY of an
 * already-ranked list to include.
 *
 * Input: the ALREADY-ranked output of rankNextBestActionCandidates(). This
 * file does not call generateNextBestActionCandidates() or
 * rankNextBestActionCandidates() itself — it consumes their result, never
 * regenerates it (docs/LEARNING_ENGINE.md §35's flow: candidates -> ranking
 * -> session constraints, in that order, as separate stages).
 *
 * Session size (docs/OPEN_QUESTIONS.md #16, still OPEN): no default
 * `maxItems` is chosen here — it is injected via `TodayPlannerPolicy`, the
 * same pattern as every other threshold-bearing module in this domain
 * (RetrievalQualificationPolicy, EvidenceStrengthPolicy, MasteryPolicy,
 * MisconceptionPolicy). No `minItems` — V1 has no behavior that depends on
 * a minimum, so no field is added for one (see "empty/short plans" below).
 *
 * One question once: rankNextBestActionCandidates() already guarantees one
 * primary candidate per questionId. This file TRUSTS that contract rather
 * than re-implementing defensive deduplication — doing so here would blur
 * candidate-generation/ranking's responsibility into this file's. If that
 * contract is ever violated upstream, it is a ranking bug to fix there,
 * not something this file should silently paper over.
 *
 * Ordering: preserves the ranked input order exactly. `rankedCandidates
 * .slice(0, maxItems)` — a pure truncation, never a re-sort. Today Planner
 * must never override NBA priority with a hidden scoring of its own.
 *
 * Interleaving (docs/LEARNING_ENGINE.md §34/§36): the docs conceptually
 * want topic/action diversity for established learners, but
 * NextBestActionCandidate/NextBestActionRankedCandidate carry no topic or
 * unit field at all — only `questionId` — and docs/OPEN_QUESTIONS.md #31
 * confirms Course/Topic structure is still undecided. Implementing
 * interleaving here would mean fabricating metadata that does not exist.
 * V1 deliberately does NOT implement interleaving; this is a clean,
 * documented deferral pending course-structure design, not a silent gap.
 *
 * Calibration / starter learners: Today Planner V1 only plans from ranked
 * learner-state actions (REVIEW_DUE, RELEARN_LAPSE, REPAIR_MISCONCEPTION,
 * STRENGTHEN_MEMORY — see next-best-action.ts). If `rankedCandidates` is
 * empty (for example a brand-new learner with zero UserQuestionProgress),
 * the resulting plan legitimately has zero items — this file does NOT
 * fabricate NEW_LEARNING/EXPAND_COVERAGE filler. Starter/calibration
 * planning (docs/OPEN_QUESTIONS.md #4/#5) is a deliberately separate,
 * still-deferred future input path, not something this planner invents.
 *
 * Explainability: each TodayPlanItem preserves questionId, the chosen
 * actionType, its priority tier, the OTHER action types that also applied
 * to that Question (otherApplicableTypes), and the reasons for the chosen
 * action — reusing NextBestAction's own types rather than inventing new
 * ones. It deliberately does NOT copy `dueAt`/`retrievability` or any
 * UserQuestionProgress field onto the item — this is not a learner-state
 * snapshot, only enough context to explain "why this is in Today".
 *
 * Stable identity / persistence readiness: no DB id is generated here.
 * `position` is a plain 0-based array position (this Question's index
 * within `items`), not a database sequence number — a future persistence
 * layer is free to renumber, add its own id, and copy this shape into
 * TodaySessionItems (docs/MASTER_SPEC.md §27) without this file knowing
 * about that layer at all. No randomness anywhere.
 *
 * Session date: `plannedForDate` is an explicit, caller-supplied ISO
 * calendar-date string (YYYY-MM-DD) — never derived from Date.now(). This
 * file validates only the STRING FORMAT (a stable, serializable calendar
 * date), never which definition of "today" produced it — the Today
 * Session Boundary question (docs/OPEN_QUESTIONS.md #3: local calendar day
 * vs. rolling 24h vs. learner-defined) remains open and is the caller's
 * decision, not this file's.
 *
 * Replanning boundary: this file is a pure "snapshot in, plan out"
 * function — given the same ranked candidates and policy, it always
 * produces the same plan. It does NOT decide whether to create a new
 * session, resume an existing one, or recalculate the next day; that is
 * an application/persistence-layer concern (docs/MASTER_SPEC.md §27's
 * today_sessions status model) entirely outside this file's scope. This
 * file must never be called automatically mid-session by itself — a
 * caller decides when (re)planning happens.
 *
 * Empty/short plans: if fewer ranked items exist than `maxItems`, only the
 * available items are included — no filler questions are invented.
 *
 * Design rules this file follows (matching the rest of src/domain/learning):
 * - pure, deterministic: no Date.now(), no randomness, no DB, no LLM;
 * - never mutates its inputs (`rankedCandidates`, or any candidate/array
 *   within it) — every output array is a fresh copy.
 */

import type {
  NextBestActionPriorityTier,
  NextBestActionRankedCandidate,
} from "./next-best-action-ranking";
import type { NextBestActionReason, NextBestActionType } from "./next-best-action";

/**
 * ISO calendar-date string (YYYY-MM-DD). Format only — this file does not
 * decide what counts as "today" (docs/OPEN_QUESTIONS.md #3 is open).
 */
const PLANNED_FOR_DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/;

export interface TodayPlannerPolicy {
  /** Maximum number of items included in one Today plan. No default. */
  maxItems: number;
}

export interface TodayPlanInput {
  /**
   * The output of rankNextBestActionCandidates(), already in final
   * priority order. This file never re-ranks it.
   */
  rankedCandidates: NextBestActionRankedCandidate[];
  /** ISO calendar-date string (YYYY-MM-DD), supplied by the caller. */
  plannedForDate: string;
}

export interface TodayPlanItem {
  /** 0-based position within `items` — not a database sequence number. */
  position: number;
  questionId: string;
  actionType: NextBestActionType;
  tier: NextBestActionPriorityTier;
  otherApplicableTypes: NextBestActionType[];
  reasons: NextBestActionReason[];
}

export interface TodayPlan {
  plannedForDate: string;
  items: TodayPlanItem[];
}

/**
 * Validates policy configuration. Throws rather than letting an invalid
 * policy silently produce ambiguous output.
 */
export function validateTodayPlannerPolicy(policy: TodayPlannerPolicy): void {
  if (!Number.isInteger(policy.maxItems) || policy.maxItems <= 0) {
    throw new Error(
      `TodayPlannerPolicy.maxItems must be a positive integer, got ${policy.maxItems}`,
    );
  }
}

function validatePlannedForDate(plannedForDate: string): void {
  if (!PLANNED_FOR_DATE_FORMAT.test(plannedForDate)) {
    throw new Error(
      "TodayPlanInput.plannedForDate must be an ISO calendar date string " +
        `(YYYY-MM-DD), got ${JSON.stringify(plannedForDate)}. This module ` +
        'does not decide what counts as "today" (docs/OPEN_QUESTIONS.md #3 ' +
        "is still open) — only that the format is a stable, serializable " +
        "calendar date string.",
    );
  }
}

/**
 * Produces a deterministic Today plan by truncating the already-ranked
 * input to `policy.maxItems`, preserving ranked order exactly.
 *
 * Deterministic: given the same `input` and `policy`, always returns the
 * same plan.
 */
export function generateTodayPlan(
  input: TodayPlanInput,
  policy: TodayPlannerPolicy,
): TodayPlan {
  validateTodayPlannerPolicy(policy);
  validatePlannedForDate(input.plannedForDate);

  const items: TodayPlanItem[] = input.rankedCandidates
    .slice(0, policy.maxItems)
    .map((ranked, position) => ({
      position,
      questionId: ranked.candidate.questionId,
      actionType: ranked.candidate.type,
      tier: ranked.tier,
      otherApplicableTypes: [...ranked.otherApplicableTypes],
      reasons: [...ranked.candidate.reasons],
    }));

  return {
    plannedForDate: input.plannedForDate,
    items,
  };
}

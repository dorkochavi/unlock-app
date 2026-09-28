/**
 * Today Plan Budget V1 (RUN010-D) — tiered need buckets + a whole-plan
 * guardrail.
 *
 * Origin: docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §2 (the accepted
 * RECOMMENDED model — hybrid of (d) tiered need buckets as the primary
 * sizing mechanism, plus (b)'s "dynamically computed N" repurposed as a
 * rare-case whole-plan guardrail, not the everyday driver) and its §0b
 * accepted DEFAULT DIRECTION for the actual numbers (not final
 * calibration): minimum useful plan ~5 items, typical range ~8-12 items,
 * hard maximum ~15 items (docs/OPEN_QUESTIONS.md #16, status CALIBRATION).
 * These are CONSERVATIVE PRODUCTION DEFAULT CANDIDATES, not locked product
 * invariants — the architecture below does not depend on these exact
 * numbers being permanent (see that doc's own "Status" line, §0b).
 *
 * This file computes the single integer `today-planner.ts`'s
 * `generateTodayPlan` truncates an already-ranked candidate list to.
 * `generateTodayPlan` itself is UNCHANGED by this Slice and stays a pure
 * top-N truncation — this keeps the bucket/guardrail computation an
 * explicit, independently testable domain function rather than folding it
 * into that file (matching docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §7/§8's own
 * observation that the recommended model "mirrors today-planner.ts's
 * existing truncation shape... the only change... is that the ceiling is a
 * backstop... rather than the everyday primary sizing mechanism").
 *
 * OQ-044 (FSRS same-day learning-step artifacts — confirmed stock ts-fsrs
 * default behavior by RUN010-C, docs/OPEN_QUESTIONS.md #44): a REVIEW_DUE
 * candidate can be genuinely due again minutes after a learner's first
 * correct answer while the underlying FSRS card is still in a short-term
 * Learning/Relearning phase — this is a same-day consolidation-step
 * artifact, not a multi-day forgetting-risk signal. This file distinguishes
 * the two via `NextBestActionCandidate.cardPhase` — recomputed by
 * next-best-action.ts via `MemoryScheduler.estimateCardPhase()` at
 * candidate-generation time (never a persisted field: see that method's own
 * doc comment, scheduler.ts, for why a stored field would not survive a
 * real Postgres round-trip): a DUE_REVIEW-tier candidate whose
 * `cardPhase === "learning"` is EXCLUDED from the "core need" count this
 * file computes for bucket-sizing purposes, so a burst of same-day
 * learning-step artifacts cannot, by itself, inflate today's budget toward
 * the hard guardrail. This is a SIZING-only distinction: it never changes
 * applicability (next-best-action.ts) or tier membership
 * (next-best-action-ranking.ts) — a "learning"-phase REVIEW_DUE candidate
 * remains a real, correctly-applicable candidate and can still appear in
 * the final plan if the computed budget leaves room for it.
 * `cardPhase === "review"` (graduated to ordinary long-term spaced review)
 * counts at full weight. A missing/undefined `cardPhase` (no scheduler
 * memory field set — e.g. most existing test fixtures, which predate this
 * Slice) is treated as "review": there is no positive evidence it is a
 * short-term artifact, so it must not be silently discounted.
 */
import type { NextBestActionRankedCandidate } from "./next-best-action-ranking";

export interface TodayPlanBudgetPolicy {
  /**
   * Minimum useful plan size — the small, visible-but-bounded budget used
   * on a day with zero "core need" (see `computeTodayPlanBudget`), so a
   * genuinely low-need day still produces a non-padded but non-suspiciously
   * -empty plan (docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §2/§6). Origin:
   * docs/OPEN_QUESTIONS.md #16.
   */
  minUsefulItems: number;
  /**
   * Documented EXPECTED typical-day upper end — origin:
   * docs/OPEN_QUESTIONS.md #16. NOT a fill target `computeTodayPlanBudget`
   * enforces directly: docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §2/§4 is
   * explicit that bucket sizes should resolve into this range NATURALLY
   * from genuine per-tier candidate counts, not from a forced/artificial
   * fill rule ("not a fixed per-tier target"). Kept as a named policy field
   * (rather than a bare comment) so it is validated for internal
   * consistency and so a future calibration change has one place to land,
   * exactly like `minUsefulItems`/`hardMaximumItems`.
   */
  typicalRangeMax: number;
  /**
   * The whole-plan guardrail — a rare-case circuit breaker for a
   * pathological multi-Course pile-up (docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md
   * §7), NOT the everyday sizing driver. Origin: docs/OPEN_QUESTIONS.md #16.
   */
  hardMaximumItems: number;
}

export function validateTodayPlanBudgetPolicy(
  policy: TodayPlanBudgetPolicy,
): void {
  if (!Number.isInteger(policy.minUsefulItems) || policy.minUsefulItems <= 0) {
    throw new Error(
      `TodayPlanBudgetPolicy.minUsefulItems must be a positive integer, got ${policy.minUsefulItems}`,
    );
  }
  if (
    !Number.isInteger(policy.typicalRangeMax) ||
    policy.typicalRangeMax < policy.minUsefulItems
  ) {
    throw new Error(
      `TodayPlanBudgetPolicy.typicalRangeMax must be an integer >= minUsefulItems ` +
        `(${policy.minUsefulItems}), got ${policy.typicalRangeMax}`,
    );
  }
  if (
    !Number.isInteger(policy.hardMaximumItems) ||
    policy.hardMaximumItems < policy.typicalRangeMax
  ) {
    throw new Error(
      `TodayPlanBudgetPolicy.hardMaximumItems must be an integer >= typicalRangeMax ` +
        `(${policy.typicalRangeMax}), got ${policy.hardMaximumItems}`,
    );
  }
}

/**
 * Computes how many of an already-ranked, already-tiered candidate list
 * (`rankNextBestActionCandidates`'s output) should be included in today's
 * plan. Pure, deterministic: no Date.now(), no randomness — this function
 * runs exactly once, at generation time, matching
 * docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §8's "sizing happens once... never
 * re-evaluates size after generation" requirement (this file has no
 * awareness of, or hook into, anything that happens after generation).
 *
 * Rule:
 * - "core need" = every REMEDIATION-tier candidate, plus every DUE_REVIEW
 *   -tier candidate whose `cardPhase` is NOT `"learning"` (see OQ-044 note
 *   in the module doc comment) — REMEDIATION/genuine-DUE_REVIEW default
 *   toward full inclusion, bounded only by the hard guardrail.
 * - zero core need (a genuinely low-need day — 0 REMEDIATION, 0 genuine
 *   DUE_REVIEW, possibly some LOWER_SEVERITY_REPAIR/STRENGTHEN/same-day
 *   artifacts) -> the budget is capped at `minUsefulItems`, never the full
 *   guardrail (docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md §6: "0 REMEDIATION, 0
 *   DUE_REVIEW, maybe 1-2 STRENGTHEN items" — a small, positive "you're in
 *   good shape" plan, not one padded up to 15).
 * - non-zero core need -> the budget is `max(core need, minUsefulItems)`,
 *   capped at `hardMaximumItems` — genuine need drives the size (landing in
 *   the "typical" range on an ordinary day purely because that is how many
 *   genuinely qualify, per §2/§4), and the guardrail only binds on a
 *   genuinely large pile-up (§7).
 *
 * This function does NOT itself decide what ends up in the plan — whenever
 * fewer candidates exist than the returned budget, `generateTodayPlan`'s
 * own truncation/no-filler behavior (unchanged by this Slice) still governs
 * the real output size.
 */
export function computeTodayPlanBudget(
  rankedCandidates: readonly NextBestActionRankedCandidate[],
  policy: TodayPlanBudgetPolicy,
): number {
  validateTodayPlanBudgetPolicy(policy);

  let coreNeed = 0;
  for (const ranked of rankedCandidates) {
    if (ranked.tier === "REMEDIATION") {
      coreNeed++;
    } else if (
      ranked.tier === "DUE_REVIEW" &&
      ranked.candidate.cardPhase !== "learning"
    ) {
      coreNeed++;
    }
  }

  if (coreNeed === 0) {
    return Math.min(policy.hardMaximumItems, policy.minUsefulItems);
  }
  return Math.min(
    policy.hardMaximumItems,
    Math.max(coreNeed, policy.minUsefulItems),
  );
}

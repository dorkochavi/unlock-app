/**
 * Next Best Action V1 — ranking.
 *
 * Candidate generation (next-best-action.ts) answers "what is applicable?".
 * This file answers a DIFFERENT question: "what should come first?". The
 * two responsibilities are deliberately kept in separate files/functions —
 * this file never decides applicability, and next-best-action.ts never
 * decides order.
 *
 * Model: discrete priority TIERS + deterministic tie-breakers, not a
 * numeric weighted score. docs/LEARNING_ENGINE.md §28 shows an example
 * output with a numeric score, but frames it explicitly as illustrative
 * ("Do not begin with one opaque score... the user sees a reason, not the
 * number") — no weight/threshold/normalization is resolved anywhere in
 * docs/OPEN_QUESTIONS.md. A tiered model avoids inventing that fake
 * precision while staying fully explainable: the returned array's ORDER
 * is the ranking, `tier` is a named label (never a raw number), and the
 * tie-break fields consumed (dueAt, retrievability, questionId) are
 * already present on the candidate rather than a new synthetic score.
 *
 * Primary-action-per-question: candidates are first collapsed to ONE
 * primary candidate per questionId, then the primaries are ranked
 * globally. All 4 current candidate types point at the same single
 * Question — surfacing that Question twice in one ranked list (e.g. once
 * as RELEARN_LAPSE, again lower down as REPAIR_MISCONCEPTION) would be a
 * redundant, contradictory-looking recommendation for any downstream
 * consumer. The demoted candidate types for that Question are not
 * discarded silently — they're exposed via `otherApplicableTypes` for
 * explainability, but they do not influence the primary's own reasons.
 *
 * Priority tiers (docs/LEARNING_ENGINE.md §27's 4 currently-implemented
 * action types, ordered):
 *
 * 1. REMEDIATION            — RELEARN_LAPSE, REPAIR_MISCONCEPTION(active).
 *    Both represent something already BROKEN (a genuinely failed
 *    retrieval, or a confidently-held wrong belief), not routine
 *    maintenance or positive progress.
 * 2. DUE_REVIEW             — REVIEW_DUE. Routine scheduled maintenance;
 *    necessary, but not "broken" the way remediation is.
 * 3. LOWER_SEVERITY_REPAIR  — REPAIR_MISCONCEPTION(suspected). A real
 *    signal, but the score hasn't reached the "active" threshold.
 * 4. STRENGTHEN             — STRENGTHEN_MEMORY. Positive-progress state;
 *    least time-pressured of the four.
 *
 * Known, explicitly-flagged ambiguity (not silently decided): no doc or
 * existing signal ranks RELEARN_LAPSE against REPAIR_MISCONCEPTION(active)
 * — they are qualitatively different problems (forgotten fact vs. wrong
 * belief) of comparable severity. When both apply to the SAME Question
 * (both land in the REMEDIATION tier), the same-question primary pick
 * uses a fixed, documented, arbitrary-but-deterministic tie-break
 * (RELEARN_LAPSE before REPAIR_MISCONCEPTION) — this is NOT a severity
 * claim, just a stable default a product decision can override later.
 *
 * Tie-break chain, applied in order once tier is equal:
 * 1. same-question primary pick: declared type order (see above);
 * 2. `now - dueAt` DESCENDING (more overdue ranks first). No dueAt is
 *    treated as the LEAST urgent by this measure (sorts last), never as
 *    "infinitely overdue." No grace window is applied anywhere.
 * 3. `retrievability` ASCENDING (lower/more fragile ranks first). No
 *    retrievability is treated as the LEAST urgent by this measure (sorts
 *    last) — unknown fragility must never look like "maximally fragile."
 *    This is deliberately only a FINAL tie-break, not a tier driver: for
 *    REVIEW_DUE/RELEARN_LAPSE, the applicability condition already
 *    captures "memory is weak" (due / lapsed) — using retrievability again
 *    as a primary driver would double-count the same underlying signal.
 * 4. `questionId` ASCENDING — stable, arbitrary, final tie-break.
 *
 * Signals deliberately NOT used in V1:
 * - lapse recency (lastLapseAt): RELEARN_LAPSE's existence already fully
 *   captures "unresolved lapse"; ranking multiple simultaneously-unresolved
 *   lapses by exact recency would need a new, unjustified severity
 *   judgment. This is also why ranking does NOT receive UserQuestionProgress
 *   at all — only candidates — keeping candidate-generation vs. ranking
 *   cleanly separated;
 * - EXAM_PRIORITY: deferred (docs/LEARNING_ENGINE.md §29: exam urgency
 *   changes ranking, not memory truth; the exam-date hierarchy itself is
 *   still open — docs/OPEN_QUESTIONS.md #2). `NextBestActionRankingContext`
 *   is a plain, extensible interface (just `{ now }` today) specifically
 *   so an exam-urgency field/tier can be added later additively, without
 *   redesigning candidate generation or this function's existing contract.
 *
 * Design rules this file follows (matching the rest of src/domain/learning):
 * - pure, deterministic: no Date.now(), no randomness, no DB, no LLM;
 * - does not mutate UserQuestionProgress and does not call progress-update.ts
 *   — it consumes NextBestActionCandidate[] plus an explicit ranking
 *   context, nothing else;
 * - no numeric score anywhere in the output.
 */

import type {
  NextBestActionCandidate,
  NextBestActionType,
} from "./next-best-action";

export const NEXT_BEST_ACTION_PRIORITY_TIERS = [
  "REMEDIATION",
  "DUE_REVIEW",
  "LOWER_SEVERITY_REPAIR",
  "STRENGTHEN",
] as const;

export type NextBestActionPriorityTier =
  (typeof NEXT_BEST_ACTION_PRIORITY_TIERS)[number];

/**
 * Fixed, documented, arbitrary-but-deterministic order used ONLY to break
 * a same-tier tie among candidates for the SAME Question (currently only
 * possible between RELEARN_LAPSE and REPAIR_MISCONCEPTION(active), both
 * in the REMEDIATION tier). Not a severity claim — see the file-level
 * doc comment.
 */
const TYPE_TIE_BREAK_ORDER: readonly NextBestActionType[] = [
  "RELEARN_LAPSE",
  "REPAIR_MISCONCEPTION",
  "REVIEW_DUE",
  "STRENGTHEN_MEMORY",
];

export interface NextBestActionRankingContext {
  /** Injected clock, used for the overdue-ms tie-break. Never Date.now(). */
  now: Date;
}

/**
 * One Question's ranked recommendation: the chosen primary candidate, its
 * priority tier, and — for explainability only, never affecting order —
 * the OTHER candidate types that also applied to this same Question but
 * were not chosen as primary.
 */
export interface NextBestActionRankedCandidate {
  candidate: NextBestActionCandidate;
  tier: NextBestActionPriorityTier;
  otherApplicableTypes: NextBestActionType[];
}

function tierOf(candidate: NextBestActionCandidate): NextBestActionPriorityTier {
  if (candidate.type === "RELEARN_LAPSE") {
    return "REMEDIATION";
  }
  if (candidate.type === "REPAIR_MISCONCEPTION") {
    return candidate.reasons.includes("MISCONCEPTION_ACTIVE")
      ? "REMEDIATION"
      : "LOWER_SEVERITY_REPAIR";
  }
  if (candidate.type === "REVIEW_DUE") {
    return "DUE_REVIEW";
  }
  // STRENGTHEN_MEMORY
  return "STRENGTHEN";
}

function tierRank(tier: NextBestActionPriorityTier): number {
  return NEXT_BEST_ACTION_PRIORITY_TIERS.indexOf(tier);
}

function typeTieBreakRank(type: NextBestActionType): number {
  return TYPE_TIE_BREAK_ORDER.indexOf(type);
}

/**
 * `now - dueAt` in ms. Larger means more overdue. No dueAt sorts as the
 * LEAST urgent by this measure (never "infinitely overdue").
 */
function overdueRankValue(
  candidate: NextBestActionCandidate,
  now: Date,
): number {
  if (candidate.dueAt === null) {
    return Number.NEGATIVE_INFINITY;
  }
  return now.getTime() - candidate.dueAt.getTime();
}

/**
 * Lower retrievability sorts first. No retrievability sorts as the LEAST
 * urgent by this measure (never "maximally fragile") — unknown fragility
 * must not masquerade as known fragility.
 */
function retrievabilityRankValue(candidate: NextBestActionCandidate): number {
  return candidate.retrievability ?? Number.POSITIVE_INFINITY;
}

/**
 * Larger-first comparator. Plain subtraction breaks when both sides are
 * `-Infinity` (e.g. two candidates with no dueAt): `-Infinity - -Infinity`
 * is `NaN`, not `0`, which would short-circuit the tie-break chain before
 * ever reaching the next dimension. Comparing directly avoids that.
 */
function compareDescending(a: number, b: number): number {
  if (a === b) {
    return 0;
  }
  return a > b ? -1 : 1;
}

/** Smaller-first comparator. Same NaN-avoidance reasoning as above. */
function compareAscending(a: number, b: number): number {
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

/**
 * Picks the single primary candidate for one Question's applicable
 * candidates (all sharing the same questionId), plus the other candidate
 * types that were not chosen.
 */
function choosePrimary(candidates: NextBestActionCandidate[]): {
  primary: NextBestActionCandidate;
  otherApplicableTypes: NextBestActionType[];
} {
  let primary = candidates[0];
  let bestTierRank = tierRank(tierOf(primary));

  for (const candidate of candidates.slice(1)) {
    const candidateTierRank = tierRank(tierOf(candidate));
    if (
      candidateTierRank < bestTierRank ||
      (candidateTierRank === bestTierRank &&
        typeTieBreakRank(candidate.type) < typeTieBreakRank(primary.type))
    ) {
      primary = candidate;
      bestTierRank = candidateTierRank;
    }
  }

  const otherApplicableTypes = candidates
    .filter((c) => c !== primary)
    .map((c) => c.type);

  return { primary, otherApplicableTypes };
}

/**
 * Ranks a flat pool of NextBestActionCandidates — typically produced by
 * calling generateNextBestActionCandidates() once per Question and
 * concatenating the results — into a deterministic, explainable order.
 *
 * Deterministic: given the same `candidates` (in any input order) and
 * `context`, always returns the same output in the same order.
 */
export function rankNextBestActionCandidates(
  candidates: NextBestActionCandidate[],
  context: NextBestActionRankingContext,
): NextBestActionRankedCandidate[] {
  const byQuestionId = new Map<string, NextBestActionCandidate[]>();
  for (const candidate of candidates) {
    const existing = byQuestionId.get(candidate.questionId);
    if (existing) {
      existing.push(candidate);
    } else {
      byQuestionId.set(candidate.questionId, [candidate]);
    }
  }

  const ranked: NextBestActionRankedCandidate[] = [];
  for (const questionCandidates of byQuestionId.values()) {
    const { primary, otherApplicableTypes } = choosePrimary(questionCandidates);
    ranked.push({
      candidate: primary,
      tier: tierOf(primary),
      otherApplicableTypes,
    });
  }

  ranked.sort((a, b) => {
    const tierDelta = tierRank(a.tier) - tierRank(b.tier);
    if (tierDelta !== 0) {
      return tierDelta;
    }

    const overdueComparison = compareDescending(
      overdueRankValue(a.candidate, context.now),
      overdueRankValue(b.candidate, context.now),
    );
    if (overdueComparison !== 0) {
      return overdueComparison;
    }

    const retrievabilityComparison = compareAscending(
      retrievabilityRankValue(a.candidate),
      retrievabilityRankValue(b.candidate),
    );
    if (retrievabilityComparison !== 0) {
      return retrievabilityComparison;
    }

    return a.candidate.questionId < b.candidate.questionId ? -1 : 1;
  });

  return ranked;
}

/**
 * Deterministic unresolved-lapse rule.
 *
 * A small, dedicated domain module because this rule is not specific to
 * progress-update.ts's orchestration — it is a reusable learner-state
 * fact that any caller holding a UserQuestionProgress's `lastLapseAt`/
 * `retrievalBaselineAt` fields may need (progress-update.ts computes
 * `hasUnresolvedLapse` for mastery.ts's gate; next-best-action.ts uses the
 * same rule for the RELEARN_LAPSE candidate). Keeping it here instead of
 * inlined in either caller prevents the two from drifting out of sync.
 *
 * No policy/threshold is injected here — there is none. This rule is a
 * pure function of two already-derived Date fields.
 */

/**
 * Unresolved means a lapse has occurred and retrievalBaselineAt has not
 * moved past it since — i.e. no subsequent QUALIFYING_SPACED_RETRIEVAL (or
 * the very first baseline-setting retrieval) has occurred after the
 * lapse. Deliberately conservative: a same-session or gap-too-short
 * correct answer, though clean (FULL_EVIDENCE + correct), does NOT
 * resolve a lapse, because retrievalBaselineAt does not move for either
 * case (see progress-update.ts's nextRetrievalBaseline). NOT derived from
 * lapseCount > 0 (would make every lapse permanent), and NOT from raw
 * lastCorrectAt (would let an assisted "correct" answer silently resolve
 * a lapse).
 *
 * A baseline exactly equal to the lapse timestamp counts as resolved
 * (strict `>`, not `>=`) — the baseline-setting event itself is at least
 * as recent as the lapse, so there is nothing more recent to still be
 * unresolved about.
 */
export function deriveHasUnresolvedLapse(
  lastLapseAt: Date | null,
  retrievalBaselineAt: Date | null,
): boolean {
  return (
    lastLapseAt !== null &&
    (retrievalBaselineAt === null ||
      lastLapseAt.getTime() > retrievalBaselineAt.getTime())
  );
}

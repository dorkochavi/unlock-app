/**
 * Deterministic derivation of "is this Attempt in the same learning
 * session as the current retrieval baseline?"
 *
 * A small, dedicated module (matching lapse.ts's precedent) because this
 * rule must be reused identically by two callers that must never drift
 * apart: the online `submitAnswer` application use case, and any future
 * rebuild/replay of `UserQuestionProgress` from `Attempt` history.
 * `isSameLearningSession` (consumed by retrieval-qualification.ts) is
 * always DERIVED here from two stable, reorder-safe identities
 * (`Attempt.learningSessionId`, `UserQuestionProgress
 * .retrievalBaselineLearningSessionId`) — it is never itself persisted as
 * a snapshot, because its old relational meaning ("same session as
 * whichever Attempt happened to be baseline at original processing time")
 * cannot survive a chronological reorder: which Attempt is "baseline" can
 * differ between original (arrival-order) processing and a later
 * canonical-order replay.
 *
 * `retrieval-qualification.ts`'s `RetrievalQualificationInput
 * .isSameLearningSession` keeps its original `boolean | null` signature —
 * this file does not change that contract. It only decides, once and in
 * one place, what value every caller should compute for it.
 */

/**
 * `null` (unknown) whenever either side's session identity is unknown —
 * conservative, matching retrieval-qualification.ts's own treatment of
 * `null` as "never optimistically assume a different session." Otherwise
 * a plain identity comparison.
 */
export function deriveIsSameLearningSession(
  currentLearningSessionId: string | null,
  baselineLearningSessionId: string | null,
): boolean | null {
  if (currentLearningSessionId === null || baselineLearningSessionId === null) {
    return null;
  }
  return currentLearningSessionId === baselineLearningSessionId;
}

/**
 * RUN010-B (FUB-034 same-day reinforcement) — "does the current Attempt have
 * ANY earlier Attempt (for the same userId/questionId pair) in the exact
 * same learning session?" This is a DIFFERENT question from
 * `deriveIsSameLearningSession` above: that one compares against the
 * retrieval-qualification BASELINE (which only moves on qualifying/
 * first-ever retrievals, so it can lag behind by days), whereas this one
 * must be true for the Question's 2nd+ Attempt of the day REGARDLESS of
 * whether any earlier Attempt today was itself correct, assisted, or
 * otherwise non-qualifying (an incorrect first practice answer must not
 * make a same-day 2nd attempt look like "a different session" merely
 * because the baseline never moved).
 *
 * Deliberately takes the plain list of every prior Attempt's
 * `learningSessionId` for the pair (not a single "last session" value):
 * this is trivially and identically derivable both by the online
 * `submitAnswer` path (query the persisted Attempts for the pair, before
 * inserting the new one) and by `rebuildUserQuestionProgress`'s
 * canonical-order replay (the growing prefix of already-processed
 * records) — see progress-update.ts's `ProgressUpdateContext
 * .isReinforcementAttempt` and its two callers for exactly how each
 * assembles this list. No new persisted field is needed on
 * UserQuestionProgress: `learningSessionId` already exists on every
 * Attempt (ADR-020), so this is fully reconstructable from immutable
 * Attempt history alone (ADR-012 rebuild parity).
 *
 * A `null` `currentLearningSessionId` never matches anything — same
 * conservative "never optimistically claim a match" stance as
 * `deriveIsSameLearningSession`'s own `null` handling.
 */
export function deriveIsReinforcementAttempt(
  currentLearningSessionId: string | null,
  priorAttemptLearningSessionIds: readonly (string | null)[],
): boolean {
  if (currentLearningSessionId === null) {
    return false;
  }
  return priorAttemptLearningSessionIds.some(
    (id) => id !== null && id === currentLearningSessionId,
  );
}

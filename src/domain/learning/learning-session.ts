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

/**
 * Attempt -> Evidence -> Scheduler -> UserQuestionProgress.
 *
 * The smallest deterministic pure function that applies one immutable
 * Attempt to a learner's UserQuestionProgress for a Question.
 *
 * Rules this file deliberately follows:
 * - pure domain logic only: no DB, no network, no ts-fsrs, no Date.now(),
 *   no Math.random(). All time/versioning/scheduler/policy dependencies
 *   are injected via `ProgressUpdateContext`;
 * - the Attempt itself is never mutated or rewritten (see ADR-005);
 * - retrieval qualification (successfulSpacedRetrievals /
 *   retrievalBaselineAt) is now applied here, via the injected
 *   `RetrievalQualificationPolicy` and `isSameLearningSession` context —
 *   see retrieval-qualification.ts;
 * - evidenceStrength is now derived here too, via the injected
 *   `EvidenceStrengthPolicy`, AFTER the current Attempt's evidence-summary
 *   counters/timestamps and spaced-retrieval update, so the current
 *   Attempt contributes to the freshly-derived strength rather than
 *   lagging one Attempt behind. `hasOnlySameSessionEvidence` is derived
 *   from `successfulSpacedRetrievals >= 1` — never invented from
 *   timestamps or todaySessionId — see the design note above
 *   `nextEvidenceSummary`/the evidenceStrengthResult computation for the
 *   proof of why that's a sound (never falsely-positive) derivation;
 * - masteryCategory is now derived here too, via the injected
 *   `MasteryPolicy`, AFTER scheduler memory, retrieval qualification,
 *   evidence summary, and evidenceStrength are all updated, so the
 *   current Attempt affects mastery immediately rather than lagging one
 *   Attempt behind. Two inputs mastery.ts needs are computed fresh here,
 *   never persisted as static state (both are time/history-dependent):
 *   - retrievabilityEstimate: `context.memoryScheduler.estimateRetrievability
 *     (memory, context.now)` — evaluated at `context.now` (the same "as of"
 *     timestamp already stamped on `updatedAt`), not `attempt.answeredAt`
 *     (which would be near-tautological immediately after that same
 *     Attempt just set the scheduler's `due`/`last_review` to it);
 *   - hasUnresolvedLapse: `lapse.ts`'s `deriveHasUnresolvedLapse`, given
 *     the new `lastLapseAt` field (timestamp of the most recent Attempt
 *     with `isLapse === true`) compared against the EXISTING
 *     `retrievalBaselineAt` — a small dedicated module rather than
 *     inlined here, since next-best-action.ts's RELEARN_LAPSE candidate
 *     needs the exact same rule and must not re-derive it. Conservative
 *     V1 rule: `retrievalBaselineAt` only moves on the first baseline-
 *     setting retrieval or a later QUALIFYING_SPACED_RETRIEVAL, so a
 *     lapse stays "unresolved" until genuine longitudinal (qualifying/
 *     spaced) evidence occurs — a same-session or gap-too-short correct
 *     answer does NOT resolve it, even though it is otherwise clean. NOT
 *     derived from `lapseCount > 0` (would make every lapse permanent),
 *     and NOT from raw `lastCorrectAt` (would let an assisted "correct"
 *     answer silently resolve a lapse and indirectly unlock mastery);
 * - misconceptionState/Score/LastSeenAt are now derived here too, via the
 *   injected `MisconceptionPolicy`, independently of mastery (mastery.ts
 *   consumes no misconception field). Both misconception.ts inputs are
 *   REUSES of already-derived signals, never re-implemented:
 *   isConfidentErrorSignal = `baseReasons.includes("CONFIDENT_ERROR")`
 *   (identical condition to misconception.ts's own requirement), and
 *   isQualifyingRecoveryEvidence = `baseReasons.includes(
 *   "SPACED_RETRIEVAL_SUCCESS")` (structurally already excludes assisted,
 *   low-quality, second-attempt, answer-revealed, and same-session
 *   evidence — see qualifyRetrieval). `StateUpdateReason.MISCONCEPTION_
 *   RECOVERY` is appended only when misconception.ts reports an actual
 *   state transition in the recovery direction this Attempt
 *   (MISCONCEPTION_RECOVERING or MISCONCEPTION_RESOLVED), not merely
 *   RECOVERY_EVIDENCE_OBSERVED;
 * - this function still does NOT decide the spacing/evidence-strength/
 *   mastery/misconception threshold values themselves, nor desired
 *   retention or exam behavior. Those remain unresolved policy
 *   (docs/OPEN_QUESTIONS.md) and are preserved unchanged here so the real
 *   policies can be plugged in later without rewriting this function.
 */

import { classifyAttemptEvidence } from "./evidence";
import {
  deriveEvidenceStrength,
  type EvidenceStrengthPolicy,
  type EvidenceStrengthResult,
} from "./evidence-strength";
import { deriveHasUnresolvedLapse } from "./lapse";
import {
  deriveMasteryCategory,
  type MasteryDecisionInput,
  type MasteryPolicy,
} from "./mastery";
import {
  applyMisconceptionSignal,
  type MisconceptionPolicy,
  type MisconceptionResult,
  type MisconceptionSnapshot,
} from "./misconception";
import {
  qualifyRetrieval,
  type RetrievalQualificationPolicy,
  type RetrievalQualificationReason,
  type RetrievalQualificationResult,
} from "./retrieval-qualification";
import {
  mapEvidenceToSchedulerRating,
  type SchedulerRatingDecision,
} from "./scheduler-rating";
import type { MemoryScheduler, SchedulerMemoryState } from "./scheduler";
import type {
  Attempt,
  ClassifiedEvidence,
  EvidenceQuality,
  StateUpdateReason,
  UserQuestionProgress,
} from "./types";

export interface ProgressUpdateContext {
  /**
   * Injected clock for `updatedAt`. Never call Date.now() in this file.
   */
  now: Date;
  engineVersion: string;
  memoryScheduler: MemoryScheduler;

  /**
   * Threshold policy for retrieval-qualification.ts. No production default
   * is chosen here — see docs/OPEN_QUESTIONS.md #12.
   */
  retrievalQualificationPolicy: RetrievalQualificationPolicy;

  /**
   * Whether the current Attempt is in the same learning session/occasion
   * as the previous qualifying retrieval, or null when unknown. This file
   * never infers session identity from timestamps or todaySessionId —
   * the caller must supply it explicitly (docs/OPEN_QUESTIONS.md #3 is
   * still open).
   */
  isSameLearningSession: boolean | null;

  /**
   * Threshold policy for evidence-strength.ts. No production default is
   * chosen here — see docs/OPEN_QUESTIONS.md.
   */
  evidenceStrengthPolicy: EvidenceStrengthPolicy;

  /**
   * Threshold policy for mastery.ts. No production default is chosen
   * here — see docs/OPEN_QUESTIONS.md.
   */
  masteryPolicy: MasteryPolicy;

  /**
   * Threshold policy for misconception.ts. No production default is
   * chosen here — see docs/OPEN_QUESTIONS.md #13.
   */
  misconceptionPolicy: MisconceptionPolicy;
}

export interface ProgressUpdateResult {
  progress: UserQuestionProgress;
  evidence: ClassifiedEvidence;
  schedulerRatingDecision: SchedulerRatingDecision;
  retrievalQualification: RetrievalQualificationResult;
  evidenceStrengthResult: EvidenceStrengthResult;
  /**
   * The exact input assembled for deriveMasteryCategory() this call,
   * exposed for explainability (mirrors `evidence`/`retrievalQualification`
   * — reuses mastery.ts's own type rather than inventing a new one).
   */
  masteryDecisionInput: MasteryDecisionInput;
  /**
   * The result of applying misconception.ts's policy to this Attempt
   * (mirrors evidenceStrengthResult/masteryDecisionInput — reuses
   * misconception.ts's own type rather than inventing a new one).
   */
  misconceptionResult: MisconceptionResult;
  /**
   * Every unambiguous StateUpdateReason signal this Attempt truthfully
   * produced, in a fixed deterministic order (see
   * deriveStateUpdateReasons's doc comment) — NOT a single "winning"
   * reason. More than one can legitimately apply at once (for example a
   * FULL_EVIDENCE, high-confidence, incorrect Attempt against already-
   * established scheduler memory is simultaneously CONFIDENT_ERROR and
   * LAPSE), and this array must contain all of them rather than picking
   * one. Empty when no defined reason unambiguously applies yet (for
   * example, an unremarkable non-first correct answer that isn't a
   * qualifying spaced retrieval, before a mastery/misconception policy is
   * available to classify it further).
   */
  reasons: StateUpdateReason[];
}

/**
 * Applies one accepted Attempt to the previous UserQuestionProgress (or
 * null for a brand-new user/question pair), producing the next progress
 * state.
 *
 * This function assumes it is called exactly once for an accepted Attempt.
 * Duplicate-submission protection is an application/transaction-layer
 * concern, not a domain concern (see docs/DATABASE.md §12).
 *
 * Contract: this is the incremental ONLINE update path — one new Attempt
 * applied to the current UserQuestionProgress as it happens. Evidence-
 * summary fields (meaningfulAttemptCount, firstMeaningfulEvidenceAt,
 * lastMeaningfulEvidenceAt) tolerate out-of-order answeredAt values
 * because they take min/max against chronological evidence time rather
 * than assuming arrival order. Retrieval/spacing semantics
 * (retrievalBaselineAt, successfulSpacedRetrievals — see
 * retrieval-qualification.ts) do NOT: they require Attempts to be applied
 * in nondecreasing answeredAt order, and retrieval-qualification.ts fails
 * fast rather than silently computing a negative gap when that's
 * violated. A future rebuild/replay of UserQuestionProgress from
 * immutable Attempt history (not implemented here) must therefore feed
 * Attempts through this function in nondecreasing answeredAt order — it
 * must not feed arbitrary historical order into retrieval qualification.
 */
export function applyAttemptToProgress(
  previousProgress: UserQuestionProgress | null,
  attempt: Attempt,
  context: ProgressUpdateContext,
): ProgressUpdateResult {
  const evidence = classifyAttemptEvidence(attempt);

  const schedulerRatingDecision = mapEvidenceToSchedulerRating({
    evidence,
    confidenceLevel: attempt.confidenceLevel,
  });

  const { memory, isLapse } = nextSchedulerMemory(
    previousProgress?.memory ?? null,
    attempt,
    schedulerRatingDecision,
    context.memoryScheduler,
  );

  const retrievalQualification = qualifyRetrieval(
    {
      currentAttemptAt: attempt.answeredAt,
      isCorrect: attempt.isCorrect,
      currentEvidenceQuality: evidence.quality,
      previousRetrievalBaselineAt: previousProgress?.retrievalBaselineAt ?? null,
      isSameLearningSession: context.isSameLearningSession,
    },
    context.retrievalQualificationPolicy,
  );

  const {
    retrievalBaselineAt,
    retrievalBaselineLearningSessionId,
    successfulSpacedRetrievals,
  } = nextRetrievalBaseline(
    previousProgress?.retrievalBaselineAt ?? null,
    previousProgress?.retrievalBaselineLearningSessionId ?? null,
    previousProgress?.successfulSpacedRetrievals ?? 0,
    attempt,
    retrievalQualification,
  );

  const baseReasons = deriveStateUpdateReasons({
    isFirstAttempt: previousProgress === null,
    attempt,
    evidenceQuality: evidence.quality,
    isLapse,
    retrievalQualificationReason: retrievalQualification.reason,
  });

  // Misconception derivation is independent of mastery (mastery.ts's
  // MasteryDecisionInput consumes no misconception field) — computed here
  // purely from already-derived signals, not gated on or feeding into the
  // mastery computation below.
  //
  // Both flags are REUSES of already-derived signals, not re-implemented:
  // - isConfidentErrorSignal: CONFIDENT_ERROR's condition (FULL_EVIDENCE +
  //   incorrect + high confidence) is word-for-word what
  //   misconception.ts's isConfidentErrorSignal requires;
  // - isQualifyingRecoveryEvidence: SPACED_RETRIEVAL_SUCCESS structurally
  //   requires FULL_EVIDENCE + correct + a confirmed different session +
  //   a sufficient gap — i.e. it already excludes assisted, low-quality,
  //   second-attempt, answer-revealed, and same-session evidence, which
  //   is exactly what recovery evidence must exclude.
  const isConfidentErrorSignal = baseReasons.includes("CONFIDENT_ERROR");
  const isQualifyingRecoveryEvidence = baseReasons.includes(
    "SPACED_RETRIEVAL_SUCCESS",
  );

  const previousMisconceptionSnapshot: MisconceptionSnapshot | null =
    previousProgress === null
      ? null
      : {
          state: previousProgress.misconceptionState,
          score: previousProgress.misconceptionScore,
          lastSeenAt: previousProgress.misconceptionLastSeenAt,
        };

  const misconceptionResult = applyMisconceptionSignal(
    previousMisconceptionSnapshot,
    {
      isConfidentErrorSignal,
      isQualifyingRecoveryEvidence,
      observedAt: attempt.answeredAt,
    },
    context.misconceptionPolicy,
  );

  // MISCONCEPTION_RECOVERY is emitted only for an actual STATE TRANSITION
  // in the recovery direction this Attempt — not merely "recovery
  // evidence was observed" (misconception.ts's RECOVERY_EVIDENCE_OBSERVED
  // covers, for example, "recovering" staying "recovering" with a lower
  // score, or a no-op nudge on "none"/"resolved"). "Genuinely moves in
  // the recovery direction" is interpreted as a visible movement in
  // misconceptionState, matching how other StateUpdateReason values mark
  // structurally significant events.
  const misconceptionRecoveryOccurred =
    misconceptionResult.reason === "MISCONCEPTION_RECOVERING" ||
    misconceptionResult.reason === "MISCONCEPTION_RESOLVED";

  // MISCONCEPTION_RECOVERY can only be true when isQualifyingRecoveryEvidence
  // is true, which requires SPACED_RETRIEVAL_SUCCESS to already be in
  // baseReasons — and SPACED_RETRIEVAL_SUCCESS is mutually exclusive with
  // every other reason (see deriveStateUpdateReasons's doc comment), so
  // whenever MISCONCEPTION_RECOVERY applies, baseReasons is always
  // exactly ["SPACED_RETRIEVAL_SUCCESS"]. Appending keeps it immediately
  // after SPACED_RETRIEVAL_SUCCESS without needing to search/splice.
  const reasons: StateUpdateReason[] = misconceptionRecoveryOccurred
    ? [...baseReasons, "MISCONCEPTION_RECOVERY"]
    : baseReasons;

  // Driven directly by `isLapse` (the actual scheduler-level lapse event
  // computed above), NOT by `reasons.includes("LAPSE")` or any
  // presentation-precedence outcome. A FULL_EVIDENCE, high-confidence,
  // incorrect Attempt against established scheduler memory is
  // simultaneously CONFIDENT_ERROR and a genuine lapse — lapseCount and
  // lastLapseAt must record the lapse regardless of what else is also
  // true about this Attempt.
  const lapseCount = (previousProgress?.lapseCount ?? 0) + (isLapse ? 1 : 0);

  // Chronological evidence time, same min/max treatment as
  // firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt — see
  // nextEvidenceSummary's design note. Only moved when THIS Attempt is
  // itself the lapse (per `isLapse`); otherwise preserved unchanged.
  const lastLapseAt = isLapse
    ? laterDate(previousProgress?.lastLapseAt ?? null, attempt.answeredAt)
    : (previousProgress?.lastLapseAt ?? null);

  const previousTimedAttemptCount = previousProgress?.timedAttemptCount ?? 0;

  const evidenceSummary = nextEvidenceSummary(
    previousProgress,
    attempt,
    evidence.quality,
  );

  // Derived AFTER the current Attempt's evidence classification,
  // evidence-summary counters/timestamps, and spaced-retrieval update, so
  // the current Attempt contributes to the newly-derived strength rather
  // than the strength lagging one Attempt behind.
  const observationSpanMs =
    evidenceSummary.firstMeaningfulEvidenceAt !== null &&
    evidenceSummary.lastMeaningfulEvidenceAt !== null
      ? evidenceSummary.lastMeaningfulEvidenceAt.getTime() -
        evidenceSummary.firstMeaningfulEvidenceAt.getTime()
      : null;

  // See the module-level design note above nextEvidenceSummary/this
  // function for the proof: successfulSpacedRetrievals >= 1 can only be
  // true when qualifyRetrieval has returned QUALIFYING_SPACED_RETRIEVAL,
  // which requires an explicit isSameLearningSession === false
  // confirmation. This is never optimistically claimed as "true" (no
  // signal here can prove ALL evidence is single-occasion).
  const hasOnlySameSessionEvidence =
    successfulSpacedRetrievals >= 1 ? false : null;

  const evidenceStrengthResult = deriveEvidenceStrength(
    {
      meaningfulAttemptCount: evidenceSummary.meaningfulAttemptCount,
      successfulSpacedRetrievals,
      observationSpanMs,
      assistedAttemptCount: evidenceSummary.assistedAttemptCount,
      lowQualityAttemptCount: evidenceSummary.lowQualityAttemptCount,
      hasOnlySameSessionEvidence,
    },
    context.evidenceStrengthPolicy,
  );

  // Time-dependent — recomputed here, never persisted. Evaluated at
  // context.now (see the module-level design note for why, not
  // attempt.answeredAt).
  const retrievabilityEstimate =
    memory !== null
      ? context.memoryScheduler.estimateRetrievability(memory, context.now)
      : null;

  // See the module-level design note: unresolved means a lapse has
  // occurred and retrievalBaselineAt has not moved past it since — i.e.
  // no subsequent QUALIFYING_SPACED_RETRIEVAL (or the very first
  // baseline-setting retrieval) has occurred after the lapse. This is
  // deliberately conservative: a same-session or gap-too-short correct
  // answer, though clean (FULL_EVIDENCE + correct), does NOT resolve a
  // lapse, because retrievalBaselineAt does not move for either of those
  // cases (see nextRetrievalBaseline). Only genuine longitudinal
  // (qualifying/spaced) evidence resolves a lapse — never derived from
  // lapseCount > 0 or raw lastCorrectAt.
  const hasUnresolvedLapse = deriveHasUnresolvedLapse(
    lastLapseAt,
    retrievalBaselineAt,
  );

  const masteryDecisionInput: MasteryDecisionInput = {
    meaningfulAttemptCount: evidenceSummary.meaningfulAttemptCount,
    successfulSpacedRetrievals,
    lapseCount,
    evidenceStrength: evidenceStrengthResult.strength,
    retrievabilityEstimate,
    hasUnresolvedLapse,
  };

  const masteryCategory = deriveMasteryCategory(
    masteryDecisionInput,
    context.masteryPolicy,
  );

  const progress: UserQuestionProgress = {
    userId: attempt.userId,
    questionId: attempt.questionId,

    attemptCount: (previousProgress?.attemptCount ?? 0) + 1,
    correctCount:
      (previousProgress?.correctCount ?? 0) + (attempt.isCorrect ? 1 : 0),

    lastAttemptAt: attempt.answeredAt,
    lastCorrectAt: attempt.isCorrect
      ? attempt.answeredAt
      : (previousProgress?.lastCorrectAt ?? null),
    lastIncorrectAt: attempt.isCorrect
      ? (previousProgress?.lastIncorrectAt ?? null)
      : attempt.answeredAt,

    memory,

    retrievalBaselineAt,
    retrievalBaselineLearningSessionId,
    successfulSpacedRetrievals,
    lapseCount,
    lastLapseAt,

    misconceptionState: misconceptionResult.state,
    misconceptionScore: misconceptionResult.score,
    misconceptionLastSeenAt: misconceptionResult.lastSeenAt,

    timedAttemptCount:
      previousTimedAttemptCount + (attempt.responseTimeSeconds !== null ? 1 : 0),
    averageResponseTimeSeconds: nextAverageResponseTimeSeconds(
      previousProgress?.averageResponseTimeSeconds ?? null,
      previousTimedAttemptCount,
      attempt.responseTimeSeconds,
    ),

    ...evidenceSummary,

    evidenceStrength: evidenceStrengthResult.strength,
    masteryCategory,

    engineVersion: context.engineVersion,
    updatedAt: context.now,
  };

  return {
    progress,
    evidence,
    schedulerRatingDecision,
    retrievalQualification,
    evidenceStrengthResult,
    masteryDecisionInput,
    misconceptionResult,
    reasons,
  };
}

/**
 * Baseline-tracking rule (see the `retrievalBaselineAt` doc comment in
 * types.ts): the baseline is set or moved in exactly two cases, both
 * identified directly by retrieval-qualification.ts's own reason —
 *
 * - "NO_PRIOR_RETRIEVAL": this is the first-ever clean FULL_EVIDENCE
 *   correct retrieval. It does not itself count as spaced (nothing prior
 *   to be spaced from), but it establishes the baseline future retrievals
 *   are compared against.
 * - "QUALIFYING_SPACED_RETRIEVAL": this retrieval qualifies. Increment
 *   the count and move the baseline forward to this Attempt's timestamp,
 *   so the NEXT retrieval is compared against this one, not the original.
 *
 * Every other reason (NOT_FULL_EVIDENCE, INCORRECT, SAME_SESSION,
 * SESSION_UNKNOWN, GAP_TOO_SHORT) must leave both values untouched —
 * including same-session/gap-too-short/session-unknown rejections of an
 * otherwise-clean correct retrieval, which must not silently move the
 * baseline just because the evidence itself was clean.
 *
 * `retrievalBaselineLearningSessionId` moves in exact lockstep with
 * `retrievalBaselineAt` — whenever the timestamp moves to this Attempt's
 * `answeredAt`, the session-id reference moves to this Attempt's
 * `learningSessionId` too, so `deriveIsSameLearningSession`
 * (learning-session.ts) always has a truthful, reorder-safe reference to
 * compare the next Attempt's `learningSessionId` against.
 */
function nextRetrievalBaseline(
  previousBaselineAt: Date | null,
  previousBaselineLearningSessionId: string | null,
  previousSuccessfulSpacedRetrievals: number,
  attempt: Attempt,
  qualification: RetrievalQualificationResult,
): {
  retrievalBaselineAt: Date | null;
  retrievalBaselineLearningSessionId: string | null;
  successfulSpacedRetrievals: number;
} {
  if (qualification.reason === "NO_PRIOR_RETRIEVAL") {
    return {
      retrievalBaselineAt: attempt.answeredAt,
      retrievalBaselineLearningSessionId: attempt.learningSessionId,
      successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals,
    };
  }

  if (qualification.reason === "QUALIFYING_SPACED_RETRIEVAL") {
    return {
      retrievalBaselineAt: attempt.answeredAt,
      retrievalBaselineLearningSessionId: attempt.learningSessionId,
      successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals + 1,
    };
  }

  return {
    retrievalBaselineAt: previousBaselineAt,
    retrievalBaselineLearningSessionId: previousBaselineLearningSessionId,
    successfulSpacedRetrievals: previousSuccessfulSpacedRetrievals,
  };
}

/**
 * Evidence-category counters and meaningful-evidence timestamps (see the
 * doc comment on these fields in types.ts). Exactly one of the four
 * counters increments per call, matching classifyAttemptEvidence()'s
 * exactly-one-quality-per-Attempt guarantee — never derived by
 * subtraction.
 *
 * firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt reflect chronological
 * evidence time (attempt.answeredAt), not processing/ingestion order.
 * Nothing in this codebase or docs/ guarantees Attempts are applied in
 * answeredAt order (docs/DATABASE.md and docs/TESTING.md only discuss
 * replay/backfill as things to guard against, never as an ordering
 * guarantee) — so these fields must stay correct under replay, backfill,
 * import, or otherwise out-of-order application. Each call therefore
 * takes the min/max against attempt.answeredAt rather than assuming this
 * call is chronologically the latest.
 */
function nextEvidenceSummary(
  previousProgress: UserQuestionProgress | null,
  attempt: Attempt,
  quality: EvidenceQuality,
): {
  meaningfulAttemptCount: number;
  assistedAttemptCount: number;
  lowQualityAttemptCount: number;
  invalidForMasteryAttemptCount: number;
  firstMeaningfulEvidenceAt: Date | null;
  lastMeaningfulEvidenceAt: Date | null;
} {
  const isMeaningful = quality === "FULL_EVIDENCE";

  return {
    meaningfulAttemptCount:
      (previousProgress?.meaningfulAttemptCount ?? 0) + (isMeaningful ? 1 : 0),
    assistedAttemptCount:
      (previousProgress?.assistedAttemptCount ?? 0) +
      (quality === "ASSISTED_EVIDENCE" ? 1 : 0),
    lowQualityAttemptCount:
      (previousProgress?.lowQualityAttemptCount ?? 0) +
      (quality === "LOW_QUALITY_EVIDENCE" ? 1 : 0),
    invalidForMasteryAttemptCount:
      (previousProgress?.invalidForMasteryAttemptCount ?? 0) +
      (quality === "INVALID_FOR_MASTERY" ? 1 : 0),

    firstMeaningfulEvidenceAt: isMeaningful
      ? earlierDate(
          previousProgress?.firstMeaningfulEvidenceAt ?? null,
          attempt.answeredAt,
        )
      : (previousProgress?.firstMeaningfulEvidenceAt ?? null),
    lastMeaningfulEvidenceAt: isMeaningful
      ? laterDate(
          previousProgress?.lastMeaningfulEvidenceAt ?? null,
          attempt.answeredAt,
        )
      : (previousProgress?.lastMeaningfulEvidenceAt ?? null),
  };
}

function earlierDate(previous: Date | null, current: Date): Date {
  if (previous === null) {
    return current;
  }
  return previous.getTime() <= current.getTime() ? previous : current;
}

function laterDate(previous: Date | null, current: Date): Date {
  if (previous === null) {
    return current;
  }
  return previous.getTime() >= current.getTime() ? previous : current;
}

function nextSchedulerMemory(
  previousMemory: SchedulerMemoryState | null,
  attempt: Attempt,
  ratingDecision: SchedulerRatingDecision,
  memoryScheduler: MemoryScheduler,
): { memory: SchedulerMemoryState | null; isLapse: boolean } {
  if (ratingDecision.kind === "NOT_RATABLE") {
    // Assisted, second-attempt, and otherwise non-full evidence must not
    // silently advance scheduler memory.
    return { memory: previousMemory, isLapse: false };
  }

  if (previousMemory === null) {
    const result = memoryScheduler.initialize({
      reviewedAt: attempt.answeredAt,
      rating: ratingDecision.rating,
    });
    return { memory: result.nextState, isLapse: false };
  }

  const result = memoryScheduler.review(previousMemory, {
    reviewedAt: attempt.answeredAt,
    rating: ratingDecision.rating,
  });

  // A lapse requires a previously established scheduler state (there is
  // nothing to lapse from on the very first scheduler event).
  const isLapse = ratingDecision.rating === "AGAIN";

  return { memory: result.nextState, isLapse };
}

/**
 * Collects EVERY unambiguous StateUpdateReason signal this Attempt
 * truthfully produced. This is NOT a "pick the winner" precedence chain —
 * multiple signals can be simultaneously true and must all be returned.
 *
 * Corrected history: an earlier version of this function returned only
 * the first matching reason (a single `StateUpdateReason | null`), on the
 * documented but INCORRECT assumption that CONFIDENT_ERROR and LAPSE were
 * mutually exclusive. They are not: both require `!attempt.isCorrect`,
 * and a FULL_EVIDENCE, high-confidence, incorrect Attempt against
 * already-established scheduler memory (`isLapse`) satisfies both
 * conditions at once. Under the old single-winner model, CONFIDENT_ERROR
 * was checked first and LAPSE was silently dropped — and because
 * `lapseCount`/`lastLapseAt` were driven by `reason === "LAPSE"`, a
 * genuine lapse could fail to be recorded at all. `lapseCount`/
 * `lastLapseAt` are now driven directly by the `isLapse` boolean instead
 * (see where they're computed above), independent of this function and
 * of any ordering choice made here.
 *
 * Deterministic ordering (diagnostic/behavioral signals before the
 * structural label, most specific first): CONFIDENT_ERROR, LAPSE,
 * SPACED_RETRIEVAL_SUCCESS, ASSISTED_SUCCESS, INITIAL_ATTEMPT. This
 * mirrors the old precedence order, just collecting matches instead of
 * returning the first one. INITIAL_ATTEMPT is a true structural fact
 * about this Attempt whenever it applies, so it is included alongside
 * any behavioral signals rather than suppressed by them (for example, a
 * first-ever high-confidence wrong answer is both CONFIDENT_ERROR and
 * INITIAL_ATTEMPT).
 *
 * CONFIDENT_ERROR additionally requires FULL_EVIDENCE. Assisted,
 * second-attempt, revealed-answer, or otherwise low-quality evidence is
 * not clean enough to support this diagnostic signal, even when
 * confidence was reported as high.
 *
 * Known exclusivity that still holds (documented, not assumed): LAPSE
 * requires `previousMemory !== null`, which requires `previousProgress
 * !== null`, so LAPSE and INITIAL_ATTEMPT cannot co-occur. SPACED_
 * RETRIEVAL_SUCCESS requires `isCorrect` (excludes CONFIDENT_ERROR/
 * LAPSE), FULL_EVIDENCE (excludes ASSISTED_SUCCESS), and an existing
 * `previousProgress`/baseline (excludes INITIAL_ATTEMPT) — so it never
 * co-occurs with any other reason. ASSISTED_SUCCESS requires `isCorrect`
 * (excludes CONFIDENT_ERROR/LAPSE) and ASSISTED_EVIDENCE (excludes
 * SPACED_RETRIEVAL_SUCCESS/CONFIDENT_ERROR), but CAN co-occur with
 * INITIAL_ATTEMPT (a first-ever assisted correct answer).
 *
 * SAME_SESSION_SUCCESS is intentionally never returned here: no
 * session-success policy is available yet. MISCONCEPTION_RECOVERY is also
 * never produced by this function — it depends on misconception.ts's
 * result, which isn't available until after this function returns, so
 * the caller (applyAttemptToProgress) appends it to this array afterward
 * when a real recovery state transition occurred. See that call site for
 * why appending is always correctly ordered.
 */
function deriveStateUpdateReasons(input: {
  isFirstAttempt: boolean;
  attempt: Attempt;
  evidenceQuality: EvidenceQuality;
  isLapse: boolean;
  retrievalQualificationReason: RetrievalQualificationReason;
}): StateUpdateReason[] {
  const {
    isFirstAttempt,
    attempt,
    evidenceQuality,
    isLapse,
    retrievalQualificationReason,
  } = input;

  const reasons: StateUpdateReason[] = [];

  if (
    !attempt.isCorrect &&
    attempt.confidenceLevel === "high" &&
    evidenceQuality === "FULL_EVIDENCE"
  ) {
    reasons.push("CONFIDENT_ERROR");
  }

  if (isLapse) {
    reasons.push("LAPSE");
  }

  if (retrievalQualificationReason === "QUALIFYING_SPACED_RETRIEVAL") {
    reasons.push("SPACED_RETRIEVAL_SUCCESS");
  }

  if (evidenceQuality === "ASSISTED_EVIDENCE" && attempt.isCorrect) {
    reasons.push("ASSISTED_SUCCESS");
  }

  if (isFirstAttempt) {
    reasons.push("INITIAL_ATTEMPT");
  }

  return reasons;
}

/**
 * Running average of response time, using only timed attempts. A missing
 * response time must never be treated as 0 — it simply does not
 * contribute to the average.
 */
function nextAverageResponseTimeSeconds(
  previousAverage: number | null,
  previousTimedAttemptCount: number,
  responseTimeSeconds: number | null,
): number | null {
  if (responseTimeSeconds === null) {
    return previousAverage;
  }

  if (previousAverage === null || previousTimedAttemptCount === 0) {
    return responseTimeSeconds;
  }

  const previousTotal = previousAverage * previousTimedAttemptCount;
  return (previousTotal + responseTimeSeconds) / (previousTimedAttemptCount + 1);
}

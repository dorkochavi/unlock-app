/**
 * UNLOCK Learning Engine V1 domain contracts.
 *
 * These types intentionally avoid coupling the domain to a specific
 * spaced-repetition library (for example, ts-fsrs).
 */

import type { SelectedAnswer } from "./answer";
import type { SchedulerMemoryState } from "./scheduler";

export type { SelectedAnswer };

export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const ASSISTANCE_TYPES = [
  "NONE",
  "FIFTY_FIFTY",
  "HINT",
  "SECOND_ATTEMPT",
  "ANSWER_REVEALED",
  "OTHER",
] as const;
export type AssistanceType = (typeof ASSISTANCE_TYPES)[number];

export const EVIDENCE_QUALITIES = [
  "FULL_EVIDENCE",
  "ASSISTED_EVIDENCE",
  "LOW_QUALITY_EVIDENCE",
  "INVALID_FOR_MASTERY",
] as const;
export type EvidenceQuality = (typeof EVIDENCE_QUALITIES)[number];

export const MASTERY_CATEGORIES = [
  "not_started",
  "learning",
  "strengthening",
  "mastered",
] as const;
export type MasteryCategory = (typeof MASTERY_CATEGORIES)[number];

export const MISCONCEPTION_STATES = [
  "none",
  "suspected",
  "active",
  "recovering",
  "resolved",
] as const;
export type MisconceptionState = (typeof MISCONCEPTION_STATES)[number];

export const EVIDENCE_STRENGTHS = [
  "insufficient",
  "early",
  "moderate",
  "strong",
] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const STATE_UPDATE_REASONS = [
  "INITIAL_ATTEMPT",
  "SAME_SESSION_SUCCESS",
  "SPACED_RETRIEVAL_SUCCESS",
  "LAPSE",
  "CONFIDENT_ERROR",
  "ASSISTED_SUCCESS",
  "MISCONCEPTION_RECOVERY",
] as const;
export type StateUpdateReason = (typeof STATE_UPDATE_REASONS)[number];

/**
 * Immutable raw learning evidence.
 *
 * The first submitted answer is the primary measurement event.
 * Later retries may still be learning events, but they must never rewrite
 * the original Attempt.
 */
export interface Attempt {
  id: string;
  submissionId: string;

  userId: string;
  courseId: string;
  questionId: string;
  questionVersionId: string;

  answeredAt: Date;

  isCorrect: boolean;
  /**
   * ADR-014: option-id-based (never a raw numeric index/value). See
   * `./answer.ts`'s own doc comment for the full contract, including why
   * `number` is no longer part of this type (it was never a decided
   * format — dropped once a real one existed, rather than keeping two
   * representations of "a choice" alive simultaneously).
   */
  selectedAnswer: SelectedAnswer;

  confidenceLevel: ConfidenceLevel | null;
  responseTimeSeconds: number | null;

  /**
   * ADR-016. The DailyPlan/DailyPlanItem this Attempt resolves, or null for
   * manual practice. For a DailyPlan-attached Attempt, the APPLICATION
   * derives both fields from the persisted DailyPlanItem, never a
   * client-supplied value — see `submit-answer.ts`'s
   * `resolveLearningSessionId`.
   */
  dailyPlanId: string | null;
  dailyPlanItemId: string | null;

  /**
   * Stable identity of the continuous learning session/occasion this
   * Attempt belongs to (e.g. a Today session id, or a client-generated
   * token for manual practice), or null when genuinely unknown.
   *
   * This is an INTRINSIC, reorder-safe fact about the Attempt itself —
   * deliberately NOT a snapshot of the relational "was this the same
   * session as whatever the baseline retrieval happened to be at
   * processing time" boolean that retrieval-qualification.ts's
   * `isSameLearningSession` represents. That relational boolean cannot be
   * persisted and replayed safely: which Attempt counts as "the baseline"
   * can differ between original (arrival-order) processing and a later
   * canonical-order replay/rebuild, so a stored true/false could silently
   * misrepresent history after any reorder. `learningSessionId` has no
   * such problem — it never depends on which Attempt happens to be
   * baseline. `isSameLearningSession` is always DERIVED fresh (never
   * stored) by comparing two learningSessionIds — see
   * `deriveIsSameLearningSession` in learning-session.ts — using
   * whichever Attempt is currently baseline, at derivation time, in
   * whatever order Attempts are actually being processed.
   *
   * Ownership (a later audit, see `submit-answer.ts`'s module doc comment
   * and ADR-012 §5): for a DailyPlan-attached Attempt, the APPLICATION
   * derives this value from the persisted `DailyPlanItem.dailyPlanId` —
   * deliberately not a client-supplied value for that case, since an
   * arbitrary client value here would directly corrupt
   * `deriveIsSameLearningSession`'s retrieval-qualification outcome. Only
   * for manual practice (no DailyPlanItem) does the client supply and own
   * this identity directly. Either way, this field on the domain `Attempt`
   * type always holds whichever value was actually authoritative at
   * persistence time — this type itself does not encode who chose it.
   */
  learningSessionId: string | null;

  assistanceUsed: AssistanceType;
  attemptNumberForPresentedItem: number;

  /**
   * Set upstream only when a deterministic timing/anomaly rule has enough
   * evidence to flag the response. V1 should not infer "cheating" from a
   * universal raw-seconds threshold here.
   */
  suspiciousTiming: boolean;

  /**
   * True only when the answer was revealed before this response was made.
   */
  answerWasRevealedBeforeResponse: boolean;

  engineVersion: string;
}

/**
 * Current derived learner-specific state for a Question.
 *
 * This is not historical truth. It is reconstructable derived state whose
 * meaning is versioned by engineVersion.
 */
export interface UserQuestionProgress {
  userId: string;
  questionId: string;

  attemptCount: number;
  correctCount: number;

  lastAttemptAt: Date | null;
  lastCorrectAt: Date | null;
  lastIncorrectAt: Date | null;

  /**
   * Scheduler-owned memory state, or null when no ratable evidence has been
   * applied yet. This carries the full `SchedulerMemoryState`, including
   * `implementationState`, so the same scheduler adapter (e.g. ts-fsrs) can
   * faithfully reconstruct its state on the next review rather than
   * reinitializing.
   */
  memory: SchedulerMemoryState | null;

  /**
   * Baseline timestamp the next retrieval is compared against by
   * retrieval-qualification.ts. Set by the first-ever clean FULL_EVIDENCE
   * correct retrieval (which does NOT itself count as a spaced retrieval —
   * there is nothing prior to be spaced from) and moved forward by any
   * later retrieval that DOES qualify. Deliberately not named
   * "lastQualifyingRetrievalAt": that first retrieval that sets it did not
   * qualify, so a name implying every value here came from a qualifying
   * event would be misleading. See src/domain/learning/retrieval-qualification.ts.
   */
  retrievalBaselineAt: Date | null;

  /**
   * `learningSessionId` of whichever Attempt currently set/last-moved
   * `retrievalBaselineAt` (tracked in exact lockstep with it — see
   * `nextRetrievalBaseline` in progress-update.ts). Together with the
   * CURRENT Attempt's own `learningSessionId`, this is what
   * `deriveIsSameLearningSession` (learning-session.ts) compares to
   * derive `isSameLearningSession` fresh, every time, for
   * retrieval-qualification.ts — never a stored relational snapshot. Null
   * whenever `retrievalBaselineAt` is null, or when the baseline-setting
   * Attempt itself had no known session identity.
   */
  retrievalBaselineLearningSessionId: string | null;

  successfulSpacedRetrievals: number;
  lapseCount: number;
  /**
   * Timestamp of the most recent Attempt that produced a LAPSE
   * (StateUpdateReason), or null if none has occurred yet. Chronological
   * evidence time (attempt.answeredAt), not processing order — same
   * min/max treatment as firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt
   * (see progress-update.ts). Unlike lapseCount (a pure historical count),
   * this exists so a caller can determine whether a lapse is still
   * "unresolved" (no clean successful retrieval — see retrievalBaselineAt —
   * has occurred since), without treating every past lapse as permanent.
   */
  lastLapseAt: Date | null;

  misconceptionState: MisconceptionState;
  /** Bounded diagnostic score, not a probability. See src/domain/learning/misconception.ts. */
  misconceptionScore: number;
  /**
   * Timestamp of the most recent misconception-relevant evidence observed
   * (not the last state transition). See src/domain/learning/misconception.ts.
   */
  misconceptionLastSeenAt: Date | null;

  timedAttemptCount: number;
  averageResponseTimeSeconds: number | null;

  /**
   * Evidence-category counters and timestamps, tracked so a future caller
   * of deriveEvidenceStrength()/deriveMasteryCategory() (mastery.ts,
   * evidence-strength.ts) does not need to rescan Attempt history.
   *
   * EvidenceQuality (evidence.ts) is mutually exclusive and exhaustive by
   * construction: classifyAttemptEvidence() is a strict if/else-return
   * chain, so every Attempt is classified into exactly one of
   * FULL_EVIDENCE / ASSISTED_EVIDENCE / LOW_QUALITY_EVIDENCE /
   * INVALID_FOR_MASTERY. Given that, these four counters always satisfy:
   *
   *   attemptCount === meaningfulAttemptCount + assistedAttemptCount
   *     + lowQualityAttemptCount + invalidForMasteryAttemptCount
   *
   * None of them is ever derived from the others by subtraction — each is
   * incremented directly from classifyAttemptEvidence()'s own result, so
   * this invariant stays true even if the EvidenceQuality model changes
   * later (a change would show up as a failing test here, not a silent
   * miscount).
   */

  /** Count of FULL_EVIDENCE attempts only — see evidence.ts. */
  meaningfulAttemptCount: number;
  /** Count of ASSISTED_EVIDENCE attempts. */
  assistedAttemptCount: number;
  /** Count of LOW_QUALITY_EVIDENCE attempts. */
  lowQualityAttemptCount: number;
  /** Count of INVALID_FOR_MASTERY attempts. */
  invalidForMasteryAttemptCount: number;

  /**
   * Earliest FULL_EVIDENCE attempt.answeredAt observed for this Question
   * (chronological evidence time, not processing/ingestion order — see
   * progress-update.ts's nextEvidenceSummary for why). Assisted/low-quality/
   * invalid attempts never move it.
   */
  firstMeaningfulEvidenceAt: Date | null;
  /**
   * Latest FULL_EVIDENCE attempt.answeredAt observed for this Question
   * (chronological evidence time, not processing/ingestion order — see
   * progress-update.ts's nextEvidenceSummary for why). Assisted/low-quality/
   * invalid attempts never move it. A future caller derives observation
   * span from firstMeaningfulEvidenceAt/lastMeaningfulEvidenceAt at
   * decision time rather than reading a stored duration.
   */
  lastMeaningfulEvidenceAt: Date | null;

  evidenceStrength: EvidenceStrength;
  masteryCategory: MasteryCategory;

  engineVersion: string;
  updatedAt: Date;
}

/**
 * The result of classifying an Attempt before it is allowed to influence
 * mastery/memory logic.
 */
export interface ClassifiedEvidence {
  attempt: Attempt;
  quality: EvidenceQuality;
  reasons: string[];
}

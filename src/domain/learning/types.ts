/**
 * UNLOCK Learning Engine V1 domain contracts.
 *
 * These types intentionally avoid coupling the domain to a specific
 * spaced-repetition library (for example, ts-fsrs).
 */

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
  selectedAnswer: string | number | null;

  confidenceLevel: ConfidenceLevel | null;
  responseTimeSeconds: number | null;

  todaySessionId: string | null;
  todaySessionItemId: string | null;

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
 * Scheduler-owned memory state.
 *
 * UNLOCK intentionally keeps these generic so the domain is not coupled
 * to one specific FSRS implementation/version.
 */
export interface MemoryState {
  stability: number | null;
  difficulty: number | null;
  scheduledReviewAt: Date | null;
  retrievabilityEstimate: number | null;
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

  memory: MemoryState;

  successfulSpacedRetrievals: number;
  lapseCount: number;

  misconceptionState: MisconceptionState;
  misconceptionScore: number;
  misconceptionLastSeenAt: Date | null;

  timedAttemptCount: number;
  averageResponseTimeSeconds: number | null;

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

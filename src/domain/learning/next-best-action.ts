/**
 * Next Best Action V1 — candidate generation only.
 *
 * This file answers exactly one question per Question a learner has
 * progress for:
 *
 *   "Is this action truthfully applicable to this learner-question state
 *   right now?"
 *
 * It deliberately does NOT answer "which action wins?" — there is no
 * ranking, no numeric score, no weight, no priority, and no precedence
 * between candidate types here. Multiple candidates may legitimately
 * coexist for the same Question (see the overlap notes below); that is
 * expected, not a bug to resolve in this file. Ranking/selection is a
 * separate, later step (docs/LEARNING_ENGINE.md §28).
 *
 * Scope: this file only implements the 4 of the 7 conceptual action types
 * (docs/LEARNING_ENGINE.md §27) that are fully defined by EXISTING
 * question-level derived state, with no new policy/threshold invented:
 *
 * - REVIEW_DUE
 * - RELEARN_LAPSE
 * - REPAIR_MISCONCEPTION
 * - STRENGTHEN_MEMORY
 *
 * The remaining 3 are deliberately NOT implemented here:
 *
 * - EXPAND_COVERAGE, NEW_LEARNING: these require course/topic coverage
 *   context that does not exist on UserQuestionProgress (a Question with
 *   zero Attempts has no progress row to reason from at all — see
 *   docs/OPEN_QUESTIONS.md #31, #5). Modeling them here would mean
 *   fabricating a course-aggregate contract that hasn't been designed.
 * - EXAM_PRIORITY: docs/LEARNING_ENGINE.md §29 is explicit that exam
 *   urgency changes ranking, not memory truth, and the exam-date
 *   hierarchy itself is still open (docs/OPEN_QUESTIONS.md #2). This
 *   belongs in the ranking step, not candidate generation.
 *
 * Design rules this file follows (matching the rest of src/domain/learning):
 * - pure, deterministic: no Date.now(), no randomness, no DB, no LLM. All
 *   time/scheduler dependencies are injected via `NextBestActionContext`;
 * - reuses already-derived signals rather than re-deriving them:
 *   RELEARN_LAPSE reuses `lapse.ts`'s `deriveHasUnresolvedLapse` against
 *   the same two persisted fields (lastLapseAt, retrievalBaselineAt) that
 *   progress-update.ts also feeds it, so the "unresolved" definition
 *   cannot drift between the two callers. `lapse.ts` is a small dedicated
 *   module (not owned by progress-update.ts) specifically so this file
 *   does not need to depend on the progress-update orchestrator;
 * - this file is NOT wired into progress-update.ts's pipeline — neither
 *   file imports from the other; both import the shared `lapse.ts` rule
 *   independently. NBA consumes current derived UserQuestionProgress; it
 *   never mutates it;
 * - retrievability is recomputed here via the injected MemoryScheduler,
 *   never persisted or read from a stale field, matching progress-update.ts's
 *   own treatment of retrievability;
 * - `dueAt`/`retrievability` are attached uniformly to every candidate for
 *   a Question (from `progress.memory`, when present) as explainability
 *   context — they are not type-specific gates. Only REVIEW_DUE's
 *   applicability is actually gated on `scheduledReviewAt`.
 *
 * Documented overlaps (intentional — not resolved by precedence here):
 * - STRENGTHEN_MEMORY + REVIEW_DUE: a "strengthening" item can also be
 *   scheduler-due at the same time.
 * - STRENGTHEN_MEMORY + RELEARN_LAPSE: mastery.ts's "strengthening" branch
 *   does not check hasUnresolvedLapse (only "mastered" does), so a
 *   strengthening item can simultaneously have an unresolved lapse.
 * - RELEARN_LAPSE + REPAIR_MISCONCEPTION: a confident-error Attempt is
 *   simultaneously CONFIDENT_ERROR and LAPSE (see progress-update.ts), so
 *   an unresolved lapse and an active/suspected misconception routinely
 *   co-occur for the same Question.
 */

import { deriveHasUnresolvedLapse } from "./lapse";
import type { MemoryScheduler } from "./scheduler";
import type { UserQuestionProgress } from "./types";

export const NEXT_BEST_ACTION_TYPES = [
  "REVIEW_DUE",
  "RELEARN_LAPSE",
  "REPAIR_MISCONCEPTION",
  "STRENGTHEN_MEMORY",
] as const;

export type NextBestActionType = (typeof NEXT_BEST_ACTION_TYPES)[number];

export const NEXT_BEST_ACTION_REASONS = [
  "SCHEDULED_REVIEW_DUE",
  "UNRESOLVED_LAPSE",
  "MISCONCEPTION_SUSPECTED",
  "MISCONCEPTION_ACTIVE",
  "STRENGTHENING_NOT_YET_MASTERED",
] as const;

export type NextBestActionReason = (typeof NEXT_BEST_ACTION_REASONS)[number];

/**
 * One truthfully-applicable candidate action for one Question. Explainable
 * by construction: `reasons` states exactly why this candidate exists,
 * and `dueAt`/`retrievability` expose the scheduler context a later
 * ranking step (or a human debugging output) would need, without this
 * file itself making any ranking decision.
 */
export interface NextBestActionCandidate {
  type: NextBestActionType;
  questionId: string;
  reasons: NextBestActionReason[];
  /**
   * The scheduler's current scheduledReviewAt for this Question, or null
   * when no scheduler memory exists yet. Present on every candidate type
   * as context, not only on REVIEW_DUE.
   */
  dueAt: Date | null;
  /**
   * Retrievability estimated at `context.now`, or null when no scheduler
   * memory exists yet. Recomputed here, never persisted (matches
   * progress-update.ts's own treatment).
   */
  retrievability: number | null;
}

export interface NextBestActionContext {
  /** Injected clock. Never call Date.now() in this file. */
  now: Date;
  memoryScheduler: MemoryScheduler;
}

/**
 * Generates every truthfully-applicable NextBestActionCandidate for one
 * Question, given its current UserQuestionProgress (or null when no
 * progress exists yet for this learner-question pair).
 *
 * Deterministic: given the same `progress` and `context`, always returns
 * the same candidates in the same order.
 */
export function generateNextBestActionCandidates(
  progress: UserQuestionProgress | null,
  context: NextBestActionContext,
): NextBestActionCandidate[] {
  if (progress === null) {
    // No progress means no question-level truth to generate a candidate
    // from — never fabricate a NEW_LEARNING-style candidate here (that
    // requires course/topic coverage context this file does not have).
    return [];
  }

  const dueAt = progress.memory?.scheduledReviewAt ?? null;
  const retrievability =
    progress.memory !== null
      ? context.memoryScheduler.estimateRetrievability(
          progress.memory,
          context.now,
        )
      : null;

  const candidates: NextBestActionCandidate[] = [];

  if (
    progress.memory !== null &&
    progress.memory.scheduledReviewAt.getTime() <= context.now.getTime()
  ) {
    candidates.push({
      type: "REVIEW_DUE",
      questionId: progress.questionId,
      reasons: ["SCHEDULED_REVIEW_DUE"],
      dueAt,
      retrievability,
    });
  }

  if (
    deriveHasUnresolvedLapse(progress.lastLapseAt, progress.retrievalBaselineAt)
  ) {
    candidates.push({
      type: "RELEARN_LAPSE",
      questionId: progress.questionId,
      reasons: ["UNRESOLVED_LAPSE"],
      dueAt,
      retrievability,
    });
  }

  if (
    progress.misconceptionState === "suspected" ||
    progress.misconceptionState === "active"
  ) {
    candidates.push({
      type: "REPAIR_MISCONCEPTION",
      questionId: progress.questionId,
      reasons: [
        progress.misconceptionState === "active"
          ? "MISCONCEPTION_ACTIVE"
          : "MISCONCEPTION_SUSPECTED",
      ],
      dueAt,
      retrievability,
    });
  }

  if (progress.masteryCategory === "strengthening") {
    candidates.push({
      type: "STRENGTHEN_MEMORY",
      questionId: progress.questionId,
      reasons: ["STRENGTHENING_NOT_YET_MASTERED"],
      dueAt,
      retrievability,
    });
  }

  return candidates;
}

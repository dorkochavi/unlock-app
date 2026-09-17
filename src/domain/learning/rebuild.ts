/**
 * Pure, deterministic rebuild of UserQuestionProgress from immutable
 * Attempt history.
 *
 * Design decision (durable — see ADR-012): a rebuild reinterprets
 * historical Attempts using the CURRENT Learning Engine logic, scheduler
 * implementation, and policies — never an attempt to replay through
 * whatever engine/scheduler version was active at original processing
 * time. `Attempt.engineVersion` remains historical metadata describing
 * what was active when an Attempt was ORIGINALLY folded into progress
 * online; it is not a dispatch key this function reads or branches on.
 * This is possible to do any other way today anyway: none of
 * `RetrievalQualificationPolicy`/`EvidenceStrengthPolicy`/`MasteryPolicy`/
 * `MisconceptionPolicy`, nor the concrete `MemoryScheduler`
 * implementation/parameters, are versioned or persisted anywhere — "use
 * current logic" is not merely a preference, it is the only thing this
 * codebase's persisted data actually supports.
 *
 * `AttemptReplayRecord` deliberately keeps `createdAt` (DB
 * persistence/acceptance time) OUTSIDE the pure `Attempt` domain type —
 * `createdAt` is a repository/persistence-layer concept (when a row was
 * inserted), not a fact about the learning evidence itself, and does not
 * belong on `Attempt` merely to support sorting. It is bundled into a
 * separate, small envelope type instead, owned by this file.
 *
 * This module never mutates any Attempt, and calls `applyAttemptToProgress`
 * — never anything else — exactly once per replay record, threading
 * `.progress` forward, starting from `previousProgress = null`. No
 * `Date.now()`, no randomness, no DB, no LLM.
 */

import { deriveIsSameLearningSession } from "./learning-session";
import {
  applyAttemptToProgress,
  type ProgressUpdateContext,
} from "./progress-update";
import type { Attempt, UserQuestionProgress } from "./types";

/**
 * One immutable Attempt plus the one piece of persistence-layer context a
 * truthful replay needs beyond the Attempt itself: when it was actually
 * accepted/processed, used only as the canonical ordering's secondary
 * tie-break (see `sortReplayRecords` below). Never read by
 * `applyAttemptToProgress` itself.
 */
export interface AttemptReplayRecord {
  attempt: Attempt;
  createdAt: Date;
}

/**
 * Canonical replay order: `answeredAt ASC, createdAt ASC, id ASC`.
 *
 * - `answeredAt ASC` is not a choice — `retrieval-qualification.ts`'s
 *   `OutOfOrderRetrievalError` already requires Attempts to be fed through
 *   `applyAttemptToProgress` in nondecreasing `answeredAt` order.
 * - `createdAt ASC` is the tie-break for exactly-equal `answeredAt` values
 *   (coarse client timestamp granularity, or two devices submitting at the
 *   same instant): it reflects the DB's actual acceptance order — what the
 *   live system actually did — rather than an arbitrary key.
 * - `id ASC` is the final, purely mechanical tie-break for the
 *   vanishingly-unlikely case of two records sharing both `answeredAt` and
 *   `createdAt`.
 */
export function sortReplayRecords(
  records: readonly AttemptReplayRecord[],
): AttemptReplayRecord[] {
  return [...records].sort((a, b) => {
    const answeredAtDelta =
      a.attempt.answeredAt.getTime() - b.attempt.answeredAt.getTime();
    if (answeredAtDelta !== 0) {
      return answeredAtDelta;
    }
    const createdAtDelta = a.createdAt.getTime() - b.createdAt.getTime();
    if (createdAtDelta !== 0) {
      return createdAtDelta;
    }
    return a.attempt.id < b.attempt.id ? -1 : a.attempt.id > b.attempt.id ? 1 : 0;
  });
}

/**
 * Rebuilds `UserQuestionProgress` for one `(userId, questionId)` pair from
 * its full immutable Attempt history, under the CURRENT engine/scheduler/
 * policies supplied via `context`.
 *
 * `records` does not need to already be sorted — this function always
 * sorts defensively via `sortReplayRecords` rather than trusting the
 * caller, since the comparator is cheap and a caller-ordering bug here
 * would otherwise silently corrupt the rebuilt state.
 *
 * `context.isSameLearningSession` is ignored/overwritten for each replay
 * step — it is derived fresh per-Attempt from `attempt.learningSessionId`
 * and the in-progress `retrievalBaselineLearningSessionId`, via
 * `deriveIsSameLearningSession` (learning-session.ts), exactly the same
 * way the online `submitAnswer` path derives it. This is what makes
 * rebuild safe under reordering: the OLD relational
 * `isSameLearningSession` boolean could not be trusted after a reorder,
 * but comparing two stable `learningSessionId`s can be redone truthfully
 * for any pair of Attempts in any order.
 *
 * Returns `null` when `records` is empty (no history to rebuild from).
 *
 * Deterministic: given the same records and context, always returns the
 * same result. Never mutates any Attempt.
 */
export function rebuildUserQuestionProgress(
  records: readonly AttemptReplayRecord[],
  context: ProgressUpdateContext,
): UserQuestionProgress | null {
  const ordered = sortReplayRecords(records);

  let progress: UserQuestionProgress | null = null;
  for (const record of ordered) {
    const isSameLearningSession = deriveIsSameLearningSession(
      record.attempt.learningSessionId,
      progress?.retrievalBaselineLearningSessionId ?? null,
    );
    const result = applyAttemptToProgress(progress, record.attempt, {
      ...context,
      isSameLearningSession,
    });
    progress = result.progress;
  }

  return progress;
}

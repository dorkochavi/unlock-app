/**
 * ts-fsrs adapter implementing UNLOCK's `MemoryScheduler` domain interface.
 *
 * Per ADR-008 (docs/DECISIONS/008-fsrs-memory-scheduler.md):
 * - this file (and ts-fsrs-mapper.ts) is the only place allowed to import
 *   ts-fsrs;
 * - this adapter owns memory scheduling / retrievability only — it does not
 *   decide Next Best Action, misconceptions, exam urgency, or Today
 *   planning;
 * - desired retention is intentionally left at the ts-fsrs default. This is
 *   an open product decision (docs/OPEN_QUESTIONS.md #12), not something to
 *   invent here.
 */

import { createEmptyCard, fsrs } from "ts-fsrs";
import type { Card, CardInput, FSRS } from "ts-fsrs";

import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "@/domain/learning/scheduler";

import {
  fromFsrsCard,
  mapSchedulerRatingToFsrsGrade,
  toFsrsCardInput,
} from "./ts-fsrs-mapper";

/**
 * Fuzz is disabled here so scheduler output is deterministic for our
 * domain/golden tests. This is an implementation/testing choice for this
 * spike, not a product decision about interval randomization — it can be
 * revisited when that becomes a real product question.
 *
 * No other parameter is set here. In particular, `request_retention` is
 * intentionally left at the ts-fsrs default rather than being pinned to
 * 0.9 in code: desired retention is still an open decision
 * (docs/OPEN_QUESTIONS.md #12).
 */
const ADAPTER_FSRS_PARAMETERS = {
  enable_fuzz: false,
} as const;

export class TsFsrsMemoryScheduler implements MemoryScheduler {
  private readonly fsrs: FSRS;

  constructor() {
    this.fsrs = fsrs(ADAPTER_FSRS_PARAMETERS);
  }

  initialize(input: InitialReviewInput): MemoryReviewResult {
    const grade = mapSchedulerRatingToFsrsGrade(input.rating);
    const emptyCard: Card = createEmptyCard(input.reviewedAt);
    const { card } = this.fsrs.next(emptyCard, input.reviewedAt, grade);

    return {
      previousState: null,
      nextState: fromFsrsCard(card),
      rating: input.rating,
      reviewedAt: input.reviewedAt,
    };
  }

  review(
    state: SchedulerMemoryState,
    input: ReviewEvidence,
  ): MemoryReviewResult {
    const previousCard: CardInput = toFsrsCardInput(state);
    const grade = mapSchedulerRatingToFsrsGrade(input.rating);
    const { card } = this.fsrs.next(previousCard, input.reviewedAt, grade);

    return {
      previousState: state,
      nextState: fromFsrsCard(card),
      rating: input.rating,
      reviewedAt: input.reviewedAt,
    };
  }

  estimateRetrievability(state: SchedulerMemoryState, at: Date): number {
    const card: CardInput = toFsrsCardInput(state);
    return this.fsrs.get_retrievability(card, at, false);
  }
}

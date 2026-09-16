import { describe, expect, it } from "vitest";
import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "../scheduler";

/**
 * This fake proves the domain contract is usable without installing a real
 * scheduler package yet.
 */
class FakeMemoryScheduler implements MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryReviewResult {
    return {
      previousState: null,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
      nextState: {
        stability: 1,
        difficulty: 5,
        scheduledReviewAt: new Date(
          input.reviewedAt.getTime() + 24 * 60 * 60 * 1000,
        ),
        lastReviewAt: input.reviewedAt,
        reviewCount: 1,
        lapseCount: input.rating === "AGAIN" ? 1 : 0,
      },
    };
  }

  review(
    state: SchedulerMemoryState,
    input: ReviewEvidence,
  ): MemoryReviewResult {
    return {
      previousState: state,
      rating: input.rating,
      reviewedAt: input.reviewedAt,
      nextState: {
        ...state,
        lastReviewAt: input.reviewedAt,
        reviewCount: state.reviewCount + 1,
        lapseCount:
          state.lapseCount + (input.rating === "AGAIN" ? 1 : 0),
      },
    };
  }

  estimateRetrievability(
    _state: SchedulerMemoryState,
    _at: Date,
  ): number {
    return 0.9;
  }
}

describe("MemoryScheduler contract", () => {
  it("can initialize scheduler state behind the interface", () => {
    const scheduler: MemoryScheduler = new FakeMemoryScheduler();
    const reviewedAt = new Date("2026-09-16T18:00:00.000Z");

    const result = scheduler.initialize({
      reviewedAt,
      rating: "GOOD",
    });

    expect(result.previousState).toBeNull();
    expect(result.nextState.reviewCount).toBe(1);
    expect(result.rating).toBe("GOOD");
  });

  it("can review existing state without exposing implementation details", () => {
    const scheduler: MemoryScheduler = new FakeMemoryScheduler();
    const reviewedAt = new Date("2026-09-17T18:00:00.000Z");

    const state: SchedulerMemoryState = {
      stability: 1,
      difficulty: 5,
      scheduledReviewAt: reviewedAt,
      lastReviewAt: new Date("2026-09-16T18:00:00.000Z"),
      reviewCount: 1,
      lapseCount: 0,
    };

    const result = scheduler.review(state, {
      reviewedAt,
      rating: "AGAIN",
    });

    expect(result.previousState).toEqual(state);
    expect(result.nextState.reviewCount).toBe(2);
    expect(result.nextState.lapseCount).toBe(1);
  });

  it("exposes retrievability through the domain boundary", () => {
    const scheduler: MemoryScheduler = new FakeMemoryScheduler();

    const state: SchedulerMemoryState = {
      stability: 1,
      difficulty: 5,
      scheduledReviewAt: new Date("2026-09-17T18:00:00.000Z"),
      lastReviewAt: new Date("2026-09-16T18:00:00.000Z"),
      reviewCount: 1,
      lapseCount: 0,
    };

    expect(
      scheduler.estimateRetrievability(
        state,
        new Date("2026-09-17T12:00:00.000Z"),
      ),
    ).toBe(0.9);
  });
});

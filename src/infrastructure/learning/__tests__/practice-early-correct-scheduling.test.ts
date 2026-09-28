/**
 * Run UX-02 P1 — LEARNING_ENGINE.md §39A scheduling cases for Practice
 * Attempts (no DailyPlanItem, ADR-020), exercised through the real
 * production pipeline: `applyAttemptToProgress` + the real ts-fsrs adapter
 * + production policy defaults. Lives under infrastructure only because it
 * uses the concrete scheduler; the rule itself is pure domain logic
 * (`progress-update.ts`'s `nextSchedulerMemory`).
 *
 * Cases:
 * 1. never scheduled → initialize (Practice or Today, identical);
 * 2. due (answeredAt >= scheduledReviewAt, incl. exactly equal) → review;
 * 3. early incorrect → normal review (AGAIN), lapse, may pull earlier;
 * 4. early correct → NOT a scheduler review: the ENTIRE scheduler state is
 *    carried over unchanged; evidence/progress rules still apply;
 * 5. not ratable → scheduler untouched (existing behavior).
 * Plus: Today-attached Attempts unchanged; replay/rebuild parity.
 */
import { describe, expect, it } from "vitest";

import { deriveIsSameLearningSession } from "@/domain/learning/learning-session";
import {
  applyAttemptToProgress,
  type ProgressUpdateContext,
  type ProgressUpdateResult,
} from "@/domain/learning/progress-update";
import {
  type AttemptReplayRecord,
  rebuildUserQuestionProgress,
} from "@/domain/learning/rebuild";
import type {
  InitialReviewInput,
  MemoryReviewResult,
  MemoryScheduler,
  ReviewEvidence,
  SchedulerMemoryState,
} from "@/domain/learning/scheduler";
import type { Attempt, UserQuestionProgress } from "@/domain/learning/types";

import { createProductionSubmitAnswerContext } from "../composition-root";
import { TsFsrsMemoryScheduler } from "../fsrs/ts-fsrs-memory-scheduler";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const T0 = new Date("2026-03-01T08:00:00.000Z");

/** Records every scheduler call, delegating to the real ts-fsrs adapter. */
class RecordingScheduler implements MemoryScheduler {
  readonly inner = new TsFsrsMemoryScheduler();
  initializeCalls = 0;
  reviewCalls = 0;

  initialize(input: InitialReviewInput): MemoryReviewResult {
    this.initializeCalls += 1;
    return this.inner.initialize(input);
  }
  review(state: SchedulerMemoryState, input: ReviewEvidence): MemoryReviewResult {
    this.reviewCalls += 1;
    return this.inner.review(state, input);
  }
  estimateRetrievability(state: SchedulerMemoryState, at: Date): number {
    return this.inner.estimateRetrievability(state, at);
  }
}

function contextFor(
  now: Date,
  previous: UserQuestionProgress | null,
  attempt: Attempt,
  scheduler: MemoryScheduler = new TsFsrsMemoryScheduler(),
  // RUN010-B: every pre-existing case in this file uses a fresh, unique
  // `learningSessionId` per Attempt (see `attemptAt`'s default), so
  // `isReinforcementAttempt` is truthfully `false` unless a caller
  // explicitly proves otherwise (see the "RUN010-B same-day reinforcement"
  // describe block below, which passes the real derivation).
  isReinforcementAttempt = false,
): ProgressUpdateContext {
  return {
    ...createProductionSubmitAnswerContext(now),
    memoryScheduler: scheduler,
    // Derived exactly as submitAnswer / rebuild derive it.
    isSameLearningSession: deriveIsSameLearningSession(
      attempt.learningSessionId,
      previous?.retrievalBaselineLearningSessionId ?? null,
    ),
    isReinforcementAttempt,
  };
}

let attemptSeq = 0;
function attemptAt(
  answeredAt: Date,
  overrides: Partial<Attempt> & { today?: boolean } = {},
): Attempt {
  attemptSeq += 1;
  const { today = false, ...rest } = overrides;
  const id = `a-${String(attemptSeq).padStart(4, "0")}`;
  return {
    id,
    submissionId: `sub-${id}`,
    userId: "user-1",
    courseId: "course-1",
    questionId: "question-1",
    questionVersionId: "qv-1",
    answeredAt,
    isCorrect: true,
    selectedAnswer: "opt-a",
    confidenceLevel: "medium",
    responseTimeSeconds: 12,
    dailyPlanId: today ? `plan-${id}` : null,
    dailyPlanItemId: today ? `item-${id}` : null,
    learningSessionId: today ? `plan-${id}` : `practice-${id}`,
    assistanceUsed: "NONE",
    attemptNumberForPresentedItem: 1,
    suspiciousTiming: false,
    answerWasRevealedBeforeResponse: false,
    engineVersion: "test",
    ...rest,
  };
}

function apply(
  previous: UserQuestionProgress | null,
  attempt: Attempt,
  scheduler?: MemoryScheduler,
  isReinforcementAttempt = false,
): ProgressUpdateResult {
  return applyAttemptToProgress(
    previous,
    attempt,
    contextFor(attempt.answeredAt, previous, attempt, scheduler, isReinforcementAttempt),
  );
}

/**
 * Builds an established Question: a Today-attached first answer, then
 * Today-attached correct reviews exactly at each due time, until the
 * current interval is at least `minIntervalDays` long. Returns the
 * progress after the last review.
 */
function establishedProgress(minIntervalDays = 4): UserQuestionProgress {
  let progress = apply(null, attemptAt(T0, { today: true })).progress;
  for (let i = 0; i < 20; i += 1) {
    const memory = progress.memory!;
    const interval =
      memory.scheduledReviewAt.getTime() - memory.lastReviewAt!.getTime();
    if (interval >= minIntervalDays * DAY_MS) {
      return progress;
    }
    progress = apply(
      progress,
      attemptAt(memory.scheduledReviewAt, { today: true }),
    ).progress;
  }
  throw new Error("fixture never reached the requested interval");
}

/** Deep, serialization-level snapshot (catches Date/JSON drift too). */
function snapshot(memory: SchedulerMemoryState | null): string {
  return JSON.stringify(memory);
}

describe("§39A Practice scheduling (real ts-fsrs, production policies)", () => {
  describe("case 4 — early correct Practice: NOT a scheduler review", () => {
    it("leaves the ENTIRE scheduler state identical (every field, incl. implementation state)", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const beforeSnapshot = snapshot(before);
      const answeredAt = new Date(before.lastReviewAt!.getTime() + 1 * DAY_MS);
      expect(answeredAt.getTime()).toBeLessThan(before.scheduledReviewAt.getTime());

      const scheduler = new RecordingScheduler();
      const result = apply(previous, attemptAt(answeredAt), scheduler);
      const after = result.progress.memory!;

      // The scheduler was not consulted at all for this Attempt.
      expect(scheduler.reviewCalls).toBe(0);
      expect(scheduler.initializeCalls).toBe(0);

      // Field by field.
      expect(after.stability).toBe(before.stability);
      expect(after.difficulty).toBe(before.difficulty);
      expect(after.scheduledReviewAt.getTime()).toBe(before.scheduledReviewAt.getTime());
      expect(after.lastReviewAt!.getTime()).toBe(before.lastReviewAt!.getTime());
      expect(after.reviewCount).toBe(before.reviewCount);
      expect(after.lapseCount).toBe(before.lapseCount);
      expect(after.implementationState).toStrictEqual(before.implementationState);
      expect(after.implementationState.implementation).toBe("ts-fsrs");
      // Whole object, deep and serialized.
      expect(after).toStrictEqual(before);
      expect(snapshot(after)).toBe(beforeSnapshot);
      // The previous state object itself was not mutated.
      expect(snapshot(previous.memory)).toBe(beforeSnapshot);

      // No lapse from a correct answer.
      expect(result.progress.lapseCount).toBe(previous.lapseCount);
      expect(result.progress.lastLapseAt).toStrictEqual(previous.lastLapseAt);
      expect(result.reasons).not.toContain("LAPSE");
    });

    it("is not vacuous: a real FSRS review at the same moment WOULD have changed the state", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.lastReviewAt!.getTime() + 1 * DAY_MS);
      const reviewed = new TsFsrsMemoryScheduler().review(before, {
        reviewedAt: answeredAt,
        rating: "GOOD",
      }).nextState;
      expect(snapshot(reviewed)).not.toBe(snapshot(before));
      expect(reviewed.lastReviewAt!.getTime()).toBe(answeredAt.getTime());
      expect(reviewed.reviewCount).toBe(before.reviewCount + 1);
    });

    it("holds 1 ms before due and never postpones the scheduled review, across repeated early practice", () => {
      let progress = establishedProgress();
      const before = progress.memory!;
      const due = before.scheduledReviewAt.getTime();
      const times = [
        before.lastReviewAt!.getTime() + 1 * HOUR_MS,
        before.lastReviewAt!.getTime() + 1 * DAY_MS,
        before.lastReviewAt!.getTime() + 2 * DAY_MS,
        due - 1,
      ];
      for (const t of times) {
        progress = apply(progress, attemptAt(new Date(t))).progress;
        expect(snapshot(progress.memory)).toBe(snapshot(before));
      }
    });

    it("still applies every evidence/progress rule (counters, retrieval, lapse, misconception, mastery) exactly as a Today-attached answer would", () => {
      const previous = establishedProgress();
      const answeredAt = new Date(previous.memory!.lastReviewAt!.getTime() + 1 * DAY_MS);
      const practice = apply(previous, attemptAt(answeredAt));
      const today = apply(previous, attemptAt(answeredAt, { today: true }));

      // Evidence was recorded.
      expect(practice.progress.attemptCount).toBe(previous.attemptCount + 1);
      expect(practice.progress.correctCount).toBe(previous.correctCount + 1);
      expect(practice.progress.lastAttemptAt).toStrictEqual(answeredAt);
      expect(practice.progress.lastCorrectAt).toStrictEqual(answeredAt);
      expect(practice.progress.meaningfulAttemptCount).toBe(previous.meaningfulAttemptCount + 1);
      // Different learning session, gap >= 1 day → qualifying spaced retrieval.
      expect(practice.retrievalQualification.reason).toBe("QUALIFYING_SPACED_RETRIEVAL");
      expect(practice.progress.successfulSpacedRetrievals).toBe(previous.successfulSpacedRetrievals + 1);

      // Identical non-scheduler outcome to the Today-attached counterpart.
      const nonScheduler = (p: UserQuestionProgress) => ({
        attemptCount: p.attemptCount,
        correctCount: p.correctCount,
        lastAttemptAt: p.lastAttemptAt,
        lastCorrectAt: p.lastCorrectAt,
        lastIncorrectAt: p.lastIncorrectAt,
        retrievalBaselineAt: p.retrievalBaselineAt,
        successfulSpacedRetrievals: p.successfulSpacedRetrievals,
        lapseCount: p.lapseCount,
        lastLapseAt: p.lastLapseAt,
        misconceptionState: p.misconceptionState,
        misconceptionScore: p.misconceptionScore,
        misconceptionLastSeenAt: p.misconceptionLastSeenAt,
        meaningfulAttemptCount: p.meaningfulAttemptCount,
        assistedAttemptCount: p.assistedAttemptCount,
        lowQualityAttemptCount: p.lowQualityAttemptCount,
        invalidForMasteryAttemptCount: p.invalidForMasteryAttemptCount,
        firstMeaningfulEvidenceAt: p.firstMeaningfulEvidenceAt,
        lastMeaningfulEvidenceAt: p.lastMeaningfulEvidenceAt,
        evidenceStrength: p.evidenceStrength,
      });
      expect(nonScheduler(practice.progress)).toStrictEqual(nonScheduler(today.progress));
      expect(practice.reasons).toStrictEqual(today.reasons);
      expect(practice.misconceptionResult).toStrictEqual(today.misconceptionResult);
      expect(practice.masteryDecisionInput.hasUnresolvedLapse).toBe(
        today.masteryDecisionInput.hasUnresolvedLapse,
      );
      // Mastery's retrievability is evaluated on the UNCHANGED memory.
      expect(practice.masteryDecisionInput.retrievabilityEstimate).toBe(
        new TsFsrsMemoryScheduler().estimateRetrievability(previous.memory!, answeredAt),
      );
      // Only the scheduler differs: Today reviewed, Practice did not.
      expect(today.progress.memory!.reviewCount).toBe(previous.memory!.reviewCount + 1);
      expect(practice.progress.memory).toStrictEqual(previous.memory);
    });

    it("resolves an unresolved lapse and records misconception recovery evidence under the existing rules, without a scheduler review", () => {
      // Lapse (confident wrong at due) → relearning reviews at due with an
      // unknown session (SESSION_UNKNOWN never moves the retrieval
      // baseline, so the lapse stays unresolved) → early correct Practice
      // on a later day in a known, different session.
      const established = establishedProgress();
      const lapse = apply(
        established,
        attemptAt(established.memory!.scheduledReviewAt, {
          today: true,
          isCorrect: false,
          confidenceLevel: "high",
          learningSessionId: "plan-lapse",
        }),
      );
      expect(lapse.reasons).toContain("LAPSE");
      expect(lapse.progress.misconceptionScore).toBeGreaterThan(0);

      let progress = apply(
        lapse.progress,
        attemptAt(lapse.progress.memory!.scheduledReviewAt, {
          today: true,
          learningSessionId: null,
        }),
      ).progress;
      // Keep reviewing at due until the next due is more than a day and a
      // half away.
      for (let i = 0; i < 10; i += 1) {
        const m = progress.memory!;
        if (m.scheduledReviewAt.getTime() - m.lastReviewAt!.getTime() > 1.5 * DAY_MS) break;
        progress = apply(
          progress,
          attemptAt(m.scheduledReviewAt, { today: true, learningSessionId: null }),
        ).progress;
      }
      const lapseAt = progress.lastLapseAt!;
      const before = progress.memory!;
      const answeredAt = new Date(
        Math.max(lapseAt.getTime(), progress.retrievalBaselineAt!.getTime()) + 1 * DAY_MS + MINUTE_MS,
      );
      expect(answeredAt.getTime()).toBeLessThan(before.scheduledReviewAt.getTime());

      const probe = apply(progress, attemptAt(answeredAt, { learningSessionId: "practice-later" }));
      // Precondition: the lapse was still unresolved before this Attempt.
      expect(progress.retrievalBaselineAt!.getTime()).toBeLessThan(lapseAt.getTime());

      expect(probe.progress.memory).toStrictEqual(before);
      expect(probe.retrievalQualification.reason).toBe("QUALIFYING_SPACED_RETRIEVAL");
      expect(probe.masteryDecisionInput.hasUnresolvedLapse).toBe(false);
      expect(probe.progress.lapseCount).toBe(progress.lapseCount);
      expect(probe.progress.misconceptionScore).toBeLessThan(progress.misconceptionScore);
    });
  });

  describe("case 2 — due Practice: normal review", () => {
    it("exactly-due boundary (answeredAt == scheduledReviewAt) is a normal review", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.scheduledReviewAt.getTime());
      const scheduler = new RecordingScheduler();
      const result = apply(previous, attemptAt(answeredAt), scheduler);

      const expected = new TsFsrsMemoryScheduler().review(before, {
        reviewedAt: answeredAt,
        rating: "GOOD",
      }).nextState;
      expect(scheduler.reviewCalls).toBe(1);
      expect(result.progress.memory).toStrictEqual(expected);
      expect(result.progress.memory!.reviewCount).toBe(before.reviewCount + 1);
      expect(result.progress.memory!.lastReviewAt!.getTime()).toBe(answeredAt.getTime());
      expect(result.progress.memory!.scheduledReviewAt.getTime()).toBeGreaterThan(
        before.scheduledReviewAt.getTime(),
      );
    });

    it("late (overdue) correct Practice is a normal review", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.scheduledReviewAt.getTime() + 2 * DAY_MS);
      const result = apply(previous, attemptAt(answeredAt));
      expect(result.progress.memory).toStrictEqual(
        new TsFsrsMemoryScheduler().review(before, { reviewedAt: answeredAt, rating: "GOOD" })
          .nextState,
      );
    });
  });

  describe("case 3 — early incorrect Practice: normal review (AGAIN)", () => {
    it("reviews with AGAIN, counts a lapse, and pulls the next review earlier", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.lastReviewAt!.getTime() + 1 * DAY_MS);
      expect(answeredAt.getTime()).toBeLessThan(before.scheduledReviewAt.getTime());

      const scheduler = new RecordingScheduler();
      const result = apply(previous, attemptAt(answeredAt, { isCorrect: false }), scheduler);
      const expected = new TsFsrsMemoryScheduler().review(before, {
        reviewedAt: answeredAt,
        rating: "AGAIN",
      }).nextState;

      expect(scheduler.reviewCalls).toBe(1);
      expect(result.progress.memory).toStrictEqual(expected);
      expect(result.progress.memory!.lapseCount).toBe(before.lapseCount + 1);
      expect(result.progress.memory!.scheduledReviewAt.getTime()).toBeLessThan(
        before.scheduledReviewAt.getTime(),
      );
      expect(result.reasons).toContain("LAPSE");
      expect(result.progress.lapseCount).toBe(previous.lapseCount + 1);
      expect(result.progress.lastLapseAt).toStrictEqual(answeredAt);
    });
  });

  describe("case 1 — never-scheduled Practice: initialize normally", () => {
    it.each([
      ["correct", true, "GOOD"],
      ["incorrect", false, "AGAIN"],
    ] as const)("first-ever %s Practice answer initializes the scheduler", (_l, isCorrect, rating) => {
      const scheduler = new RecordingScheduler();
      const result = apply(null, attemptAt(T0, { isCorrect }), scheduler);
      expect(scheduler.initializeCalls).toBe(1);
      expect(scheduler.reviewCalls).toBe(0);
      expect(result.progress.memory).toStrictEqual(
        new TsFsrsMemoryScheduler().initialize({ reviewedAt: T0, rating }).nextState,
      );
      // Identical to the Today-attached first answer.
      expect(result.progress.memory).toStrictEqual(
        apply(null, attemptAt(T0, { isCorrect, today: true })).progress.memory,
      );
    });

    it("an earlier non-ratable Attempt leaves memory null, so the first ratable Practice answer initializes", () => {
      const assisted = apply(null, attemptAt(T0, { assistanceUsed: "HINT" }));
      expect(assisted.progress.memory).toBeNull();
      const scheduler = new RecordingScheduler();
      const answeredAt = new Date(T0.getTime() + HOUR_MS);
      const result = apply(assisted.progress, attemptAt(answeredAt), scheduler);
      expect(scheduler.initializeCalls).toBe(1);
      expect(result.progress.memory).toStrictEqual(
        new TsFsrsMemoryScheduler().initialize({ reviewedAt: answeredAt, rating: "GOOD" }).nextState,
      );
    });
  });

  describe("case 5 — non-ratable Practice evidence never touches the scheduler", () => {
    it.each([
      ["assisted", { assistanceUsed: "HINT" }],
      ["second attempt", { attemptNumberForPresentedItem: 2 }],
      ["answer revealed", { answerWasRevealedBeforeResponse: true }],
    ] as const)("%s early answer leaves memory identical", (_l, overrides) => {
      const previous = establishedProgress();
      const answeredAt = new Date(previous.memory!.lastReviewAt!.getTime() + 1 * DAY_MS);
      const scheduler = new RecordingScheduler();
      const result = apply(previous, attemptAt(answeredAt, overrides), scheduler);
      expect(scheduler.reviewCalls).toBe(0);
      expect(result.progress.memory).toStrictEqual(previous.memory);
    });
  });

  describe("Today-attached Attempts are unchanged", () => {
    it.each([
      ["early correct", true, 1 * DAY_MS, "GOOD"],
      ["early incorrect", false, 1 * DAY_MS, "AGAIN"],
    ] as const)("%s Today answer is still a normal scheduler review", (_l, isCorrect, offset, rating) => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.lastReviewAt!.getTime() + offset);
      expect(answeredAt.getTime()).toBeLessThan(before.scheduledReviewAt.getTime());
      const scheduler = new RecordingScheduler();
      const result = apply(previous, attemptAt(answeredAt, { isCorrect, today: true }), scheduler);
      expect(scheduler.reviewCalls).toBe(1);
      expect(result.progress.memory).toStrictEqual(
        new TsFsrsMemoryScheduler().review(before, { reviewedAt: answeredAt, rating }).nextState,
      );
    });

    it("an early correct Today answer moves lastReviewAt and postpones the due date (pre-P1 behavior)", () => {
      const previous = establishedProgress();
      const before = previous.memory!;
      const answeredAt = new Date(before.lastReviewAt!.getTime() + 1 * DAY_MS);
      const after = apply(previous, attemptAt(answeredAt, { today: true })).progress.memory!;
      expect(after.lastReviewAt!.getTime()).toBe(answeredAt.getTime());
      expect(after.reviewCount).toBe(before.reviewCount + 1);
    });
  });

  describe("replay / rebuild parity (ADR-012)", () => {
    /**
     * Mirrors submitAnswer's online algorithm: incremental update when
     * the Attempt is not older than lastAttemptAt, otherwise a full
     * canonical rebuild of every Attempt received so far. Reports how many
     * times the rebuild branch ran, so a test can prove which path it
     * actually exercised.
     */
    function online(arrivals: AttemptReplayRecord[]): {
      progress: UserQuestionProgress | null;
      rebuilds: number;
    } {
      let progress: UserQuestionProgress | null = null;
      let rebuilds = 0;
      const received: AttemptReplayRecord[] = [];
      for (const record of arrivals) {
        received.push(record);
        const { attempt } = record;
        const isOutOfOrder: boolean =
          progress !== null &&
          progress.lastAttemptAt !== null &&
          attempt.answeredAt.getTime() < progress.lastAttemptAt.getTime();
        if (isOutOfOrder) {
          rebuilds += 1;
          progress = rebuildUserQuestionProgress(
            received,
            contextFor(attempt.answeredAt, null, attempt),
          );
        } else {
          progress = apply(progress, attempt).progress;
        }
      }
      return { progress, rebuilds };
    }

    function rebuild(records: AttemptReplayRecord[], now: Date): UserQuestionProgress | null {
      return rebuildUserQuestionProgress(records, contextFor(now, null, records[0].attempt));
    }

    /**
     * A strictly chronological mixed history built incrementally from real
     * scheduler output: Practice first answer (initialize), Today reviews
     * at due, early correct Practice (carried over), exactly-due Practice
     * (review), early incorrect Practice (AGAIN, lapse), Today relearning
     * reviews, a second early correct Practice after the lapse, an
     * assisted Practice answer, and a late Today review.
     */
    function mixedHistory(): AttemptReplayRecord[] {
      const records: AttemptReplayRecord[] = [];
      let progress: UserQuestionProgress | null = null;
      const push = (attempt: Attempt) => {
        const previous = records[records.length - 1];
        if (previous !== undefined) {
          expect(attempt.answeredAt.getTime()).toBeGreaterThan(
            previous.attempt.answeredAt.getTime(),
          );
        }
        records.push({ attempt, createdAt: attempt.answeredAt });
        progress = apply(progress, attempt).progress;
      };
      const m = () => progress!.memory!;
      const pushEarlyCorrect = () => {
        const before = snapshot(m());
        const at = new Date(m().lastReviewAt!.getTime() + 1 * DAY_MS);
        expect(at.getTime()).toBeLessThan(m().scheduledReviewAt.getTime());
        push(attemptAt(at));
        expect(snapshot(m())).toBe(before);
      };
      const reviewAtDueUntilIntervalDays = (days: number) => {
        for (let i = 0; i < 20; i += 1) {
          if (m().scheduledReviewAt.getTime() - m().lastReviewAt!.getTime() >= days * DAY_MS) return;
          push(attemptAt(m().scheduledReviewAt, { today: true }));
        }
        throw new Error("interval never reached");
      };

      push(attemptAt(T0)); // Practice, never scheduled → initialize
      reviewAtDueUntilIntervalDays(2);
      pushEarlyCorrect(); // early correct Practice → carried over
      push(attemptAt(m().scheduledReviewAt)); // exactly-due Practice → review
      reviewAtDueUntilIntervalDays(2);
      push(attemptAt(new Date(m().lastReviewAt!.getTime() + 1 * DAY_MS), { isCorrect: false })); // early incorrect
      reviewAtDueUntilIntervalDays(2); // Today relearning
      pushEarlyCorrect(); // early correct Practice after the lapse
      push(
        attemptAt(new Date(records[records.length - 1].attempt.answeredAt.getTime() + 2 * HOUR_MS), {
          assistanceUsed: "HINT",
        }),
      );
      push(attemptAt(new Date(m().scheduledReviewAt.getTime() + 3 * DAY_MS), { today: true }));
      return records;
    }

    it("rebuild of the full history equals the incremental result (in-order arrival, incremental path only)", () => {
      const records = mixedHistory();
      const last = records[records.length - 1].attempt.answeredAt;
      const { progress: incremental, rebuilds } = online(records);
      expect(rebuilds).toBe(0);
      expect(incremental).not.toBeNull();
      expect(rebuild(records, last)).toStrictEqual(incremental);
    });

    it("rebuild is independent of input order (reversed and rotated)", () => {
      const records = mixedHistory();
      const last = records[records.length - 1].attempt.answeredAt;
      const expected = rebuild(records, last);
      expect(rebuild([...records].reverse(), last)).toStrictEqual(expected);
      expect(rebuild([...records.slice(5), ...records.slice(0, 5)], last)).toStrictEqual(expected);
    });

    it("out-of-order arrival (a late-arriving early-correct Practice Attempt) reconciles to the canonical result", () => {
      const records = mixedHistory();
      const last = records[records.length - 1].attempt.answeredAt;
      const canonical = rebuild(records, last);

      // Move the first early-correct Practice Attempt to arrive last.
      const index = records.findIndex(
        (r, i) =>
          i > 0 &&
          r.attempt.dailyPlanItemId === null &&
          r.attempt.isCorrect &&
          r.attempt.assistanceUsed === "NONE" &&
          r.attempt.answeredAt.getTime() < records[i - 1].attempt.answeredAt.getTime() + 2 * DAY_MS &&
          snapshot(rebuild(records.slice(0, i + 1), r.attempt.answeredAt)!.memory) ===
            snapshot(rebuild(records.slice(0, i), r.attempt.answeredAt)!.memory),
      );
      expect(index).toBeGreaterThan(0);
      const arrivals = [...records.slice(0, index), ...records.slice(index + 1), records[index]];
      const { progress: reconciled, rebuilds } = online(arrivals);
      expect(rebuilds).toBe(1);
      // The final rebuild ran with now = the late Attempt's answeredAt;
      // compare everything except the processing-time stamp.
      expect({ ...reconciled!, updatedAt: null }).toStrictEqual({ ...canonical!, updatedAt: null });
      expect(reconciled!.memory).toStrictEqual(canonical!.memory);
    });
  });

  describe("RUN010-B — same-day reinforcement: a Question's 2nd+ same-session Attempt never re-invokes the scheduler", () => {
    it("a genuine due review, then a same-day CORRECT reinforcement Attempt (itself overdue relative to the NEW due date) is frozen — not merely 'still early'", () => {
      const previous = establishedProgress();
      const dueAt = previous.memory!.scheduledReviewAt;
      const session = "practice-session-shared-correct";
      const scheduler = new RecordingScheduler();

      // First same-day Attempt: genuinely due -> a real scheduler review.
      const first = apply(previous, attemptAt(dueAt, { learningSessionId: session }), scheduler, false);
      expect(scheduler.reviewCalls).toBe(1);
      const afterFirstReview = first.progress.memory!;

      // Second same-day Attempt: deliberately AFTER the NEW due date (not
      // "early" by the pre-existing case-4 rule at all) — only the
      // reinforcement flag can freeze this one.
      const reinforcedAt = new Date(afterFirstReview.scheduledReviewAt.getTime() + DAY_MS);
      const second = apply(
        first.progress,
        attemptAt(reinforcedAt, { learningSessionId: session }),
        scheduler,
        true,
      );

      expect(scheduler.reviewCalls).toBe(1); // no second review call
      expect(second.progress.memory).toStrictEqual(afterFirstReview);
      // Evidence is still fully recorded.
      expect(second.progress.attemptCount).toBe(first.progress.attemptCount + 1);
      expect(second.progress.correctCount).toBe(first.progress.correctCount + 1);
    });

    it("a genuine due review, then a same-day INCORRECT reinforcement Attempt does not retrigger AGAIN or a second lapse, but still records CONFIDENT_ERROR evidence", () => {
      const previous = establishedProgress();
      const dueAt = previous.memory!.scheduledReviewAt;
      const session = "practice-session-shared-incorrect";
      const scheduler = new RecordingScheduler();

      const first = apply(previous, attemptAt(dueAt, { learningSessionId: session }), scheduler, false);
      expect(scheduler.reviewCalls).toBe(1);
      const afterFirstReview = first.progress.memory!;

      const reinforcedAt = new Date(afterFirstReview.scheduledReviewAt.getTime() + DAY_MS);
      const second = apply(
        first.progress,
        attemptAt(reinforcedAt, {
          learningSessionId: session,
          isCorrect: false,
          confidenceLevel: "high",
        }),
        scheduler,
        true,
      );

      // No second scheduler review: memory frozen at the post-first-review state.
      expect(scheduler.reviewCalls).toBe(1);
      expect(second.progress.memory).toStrictEqual(afterFirstReview);
      // No second lapse: a same-day reinforcement wrong answer does not
      // perturb lapseCount/lastLapseAt a second time (Part 1 Q6/Q8).
      expect(second.progress.lapseCount).toBe(first.progress.lapseCount);
      expect(second.progress.lastLapseAt).toStrictEqual(first.progress.lastLapseAt);
      expect(second.reasons).not.toContain("LAPSE");
      // The wrong answer still "counts" qualitatively (Part 1 Q8): it is a
      // confident error, an immutable Attempt, and moves the raw evidence
      // counters — only the scheduler transition/lapse are frozen.
      expect(second.reasons).toContain("CONFIDENT_ERROR");
      expect(second.progress.attemptCount).toBe(first.progress.attemptCount + 1);
      expect(second.progress.lastIncorrectAt).toStrictEqual(reinforcedAt);
    });

    it("regression control: WITHOUT the reinforcement flag, the identical same-day incorrect Attempt WOULD have retriggered a real AGAIN review and a second lapse", () => {
      // Proves the two tests above are not vacuous: absent
      // isReinforcementAttempt, this exact scenario (a due review already
      // happened today; a later same-day wrong answer on the same
      // Question) really would corrupt the scheduler a second time in one
      // day — which is exactly the FUB-034 risk RUN010-B closes.
      const previous = establishedProgress();
      const dueAt = previous.memory!.scheduledReviewAt;
      const session = "practice-session-control";
      const scheduler = new RecordingScheduler();

      const first = apply(previous, attemptAt(dueAt, { learningSessionId: session }), scheduler, false);
      const afterFirstReview = first.progress.memory!;
      const reinforcedAt = new Date(afterFirstReview.scheduledReviewAt.getTime() + DAY_MS);

      const secondWithoutFlag = apply(
        first.progress,
        attemptAt(reinforcedAt, {
          learningSessionId: session,
          isCorrect: false,
          confidenceLevel: "high",
        }),
        scheduler,
        false, // deliberately NOT marked as reinforcement
      );

      expect(scheduler.reviewCalls).toBe(2);
      expect(secondWithoutFlag.reasons).toContain("LAPSE");
      expect(secondWithoutFlag.progress.lapseCount).toBe(first.progress.lapseCount + 1);
      expect(secondWithoutFlag.progress.memory).not.toStrictEqual(afterFirstReview);
    });
  });
});

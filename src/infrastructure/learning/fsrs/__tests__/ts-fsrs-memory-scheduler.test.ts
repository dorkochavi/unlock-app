import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import type { SchedulerMemoryState } from "@/domain/learning/scheduler";

import { toFsrsCardInput } from "../ts-fsrs-mapper";
import { TsFsrsMemoryScheduler } from "../ts-fsrs-memory-scheduler";

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

describe("TsFsrsMemoryScheduler", () => {
  it("initializes valid scheduler state from a GOOD review", () => {
    const scheduler = new TsFsrsMemoryScheduler();
    const reviewedAt = new Date("2026-01-01T00:00:00.000Z");

    const result = scheduler.initialize({ reviewedAt, rating: "GOOD" });

    expect(result.previousState).toBeNull();
    expect(result.nextState.reviewCount).toBe(1);
    expect(result.nextState.lapseCount).toBe(0);
    expect(result.nextState.implementationState.implementation).toBe(
      "ts-fsrs",
    );
    expect(result.nextState.implementationState.schemaVersion).toBe(1);
  });

  it("reconstructs the prior card across reviews instead of resetting it", () => {
    const scheduler = new TsFsrsMemoryScheduler();
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    const t1 = addDays(t0, 5);
    const t2 = addDays(t1, 10);

    const state1 = scheduler.initialize({
      reviewedAt: t0,
      rating: "GOOD",
    }).nextState;
    expect(state1.reviewCount).toBe(1);

    const state2 = scheduler.review(state1, {
      reviewedAt: t1,
      rating: "GOOD",
    }).nextState;
    expect(state2.reviewCount).toBe(2);

    const state3 = scheduler.review(state2, {
      reviewedAt: t2,
      rating: "GOOD",
    }).nextState;
    expect(state3.reviewCount).toBe(3);

    // If the adapter silently reset state instead of reconstructing the
    // prior card, elapsed_days here would not reflect the real gap since
    // the previous review.
    const elapsedDays = state3.implementationState.state.elapsed_days;
    expect(elapsedDays).toBe(10);
  });

  it("increases lapses on AGAIN once the card has graduated to Review, per ts-fsrs", () => {
    const scheduler = new TsFsrsMemoryScheduler();
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    const t1 = addDays(t0, 10);
    const t2 = addDays(t1, 20);
    const t3 = addDays(t2, 20);

    const s1 = scheduler.initialize({ reviewedAt: t0, rating: "GOOD" })
      .nextState;
    const s2 = scheduler.review(s1, { reviewedAt: t1, rating: "GOOD" })
      .nextState;
    const s3 = scheduler.review(s2, { reviewedAt: t2, rating: "GOOD" })
      .nextState;

    // Confirm the card has graduated to Review by inspecting real ts-fsrs
    // output, rather than assuming its internal state machine.
    expect(s3.implementationState.state.state).toBe("Review");

    const goodBranch = scheduler.review(s3, { reviewedAt: t3, rating: "GOOD" })
      .nextState;
    const againBranch = scheduler.review(s3, {
      reviewedAt: t3,
      rating: "AGAIN",
    }).nextState;

    expect(goodBranch.lapseCount).toBe(s3.lapseCount);
    expect(againBranch.lapseCount).toBe(s3.lapseCount + 1);
  });

  it("returns retrievability as a number in [0, 1]", () => {
    const scheduler = new TsFsrsMemoryScheduler();
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    const state = scheduler.initialize({ reviewedAt: t0, rating: "GOOD" })
      .nextState;

    const retrievability = scheduler.estimateRetrievability(
      state,
      addDays(t0, 5),
    );

    expect(typeof retrievability).toBe("number");
    expect(retrievability).toBeGreaterThanOrEqual(0);
    expect(retrievability).toBeLessThanOrEqual(1);
  });

  it("round-trips through JSON.stringify/JSON.parse and remains usable for the next review", () => {
    const scheduler = new TsFsrsMemoryScheduler();
    const t0 = new Date("2026-01-01T00:00:00.000Z");
    const t1 = addDays(t0, 3);

    const state = scheduler.initialize({ reviewedAt: t0, rating: "GOOD" })
      .nextState;

    const serialized = JSON.stringify(state);
    const parsed = JSON.parse(serialized) as Omit<
      SchedulerMemoryState,
      "scheduledReviewAt" | "lastReviewAt"
    > & {
      scheduledReviewAt: string;
      lastReviewAt: string | null;
    };

    // `implementationState` is already JSON-safe (strings/numbers/null) and
    // needs no conversion. The top-level Date fields are a normal
    // persistence-layer concern, not something the ts-fsrs adapter itself
    // needs revived to keep working, since it only reads
    // `implementationState`.
    const revived: SchedulerMemoryState = {
      ...parsed,
      scheduledReviewAt: new Date(parsed.scheduledReviewAt),
      lastReviewAt: parsed.lastReviewAt ? new Date(parsed.lastReviewAt) : null,
    };

    const result = scheduler.review(revived, {
      reviewedAt: t1,
      rating: "GOOD",
    });

    expect(result.nextState.reviewCount).toBe(state.reviewCount + 1);
  });

  it("refuses to reconstruct state produced by a different implementation", () => {
    const foreignState: SchedulerMemoryState = {
      stability: 1,
      difficulty: 5,
      scheduledReviewAt: new Date("2026-01-01T00:00:00.000Z"),
      lastReviewAt: null,
      reviewCount: 1,
      lapseCount: 0,
      implementationState: {
        implementation: "some-other-scheduler",
        schemaVersion: 1,
        state: {},
      },
    };

    expect(() => toFsrsCardInput(foreignState)).toThrow(
      /cannot reconstruct scheduler state/,
    );
  });

  it("refuses to reconstruct state with a missing/invalid field instead of inventing one", () => {
    const incompleteState: SchedulerMemoryState = {
      stability: 1,
      difficulty: 5,
      scheduledReviewAt: new Date("2026-01-01T00:00:00.000Z"),
      lastReviewAt: null,
      reviewCount: 1,
      lapseCount: 0,
      implementationState: {
        implementation: "ts-fsrs",
        schemaVersion: 1,
        state: {
          // "due" is intentionally missing.
          stability: 1,
          difficulty: 5,
          elapsed_days: 0,
          scheduled_days: 0,
          learning_steps: 0,
          reps: 1,
          lapses: 0,
          state: "New",
          last_review: null,
        },
      },
    };

    expect(() => toFsrsCardInput(incompleteState)).toThrow(
      /expected string field "due"/,
    );
  });

  it("keeps ts-fsrs out of the domain layer", () => {
    const testFileDir = dirname(fileURLToPath(import.meta.url));
    const domainDir = join(testFileDir, "..", "..", "..", "..", "domain");

    // Checks for an actual import/require of the package, not for the
    // string "ts-fsrs" anywhere — domain files are expected to *mention*
    // ts-fsrs in comments explaining this exact boundary.
    const tsFsrsImportPattern = /(?:from\s+|require\()\s*["']ts-fsrs["']/;

    const files = collectTsFiles(domainDir);
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const contents = readFileSync(file, "utf8");
      expect(tsFsrsImportPattern.test(contents)).toBe(false);
    }
  });
});

function collectTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      return collectTsFiles(fullPath);
    }
    return fullPath.endsWith(".ts") ? [fullPath] : [];
  });
}

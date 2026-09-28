import { describe, expect, it } from "vitest";
import {
  computeExamUrgencyAmplifier,
  NEUTRAL_EXAM_URGENCY_AMPLIFIER,
} from "../exam-urgency";

const NOW = new Date("2026-01-10T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysFromNow(days: number): Date {
  return new Date(NOW.getTime() + days * DAY_MS);
}

describe("computeExamUrgencyAmplifier", () => {
  it("1. no exam_date set -> exactly neutral (1.0), always", () => {
    expect(computeExamUrgencyAmplifier(null, NOW)).toBe(NEUTRAL_EXAM_URGENCY_AMPLIFIER);
    expect(computeExamUrgencyAmplifier(null, NOW)).toBe(1);
  });

  it("2. a far-future exam is effectively neutral", () => {
    const amplifier = computeExamUrgencyAmplifier(daysFromNow(365), NOW);
    expect(amplifier).toBeCloseTo(1, 10);
  });

  it("3. a past exam date is neutral — no runaway urgency for a stale exam", () => {
    const amplifier = computeExamUrgencyAmplifier(daysFromNow(-1), NOW);
    expect(amplifier).toBe(NEUTRAL_EXAM_URGENCY_AMPLIFIER);
  });

  it("4. an imminent exam (today) amplifies above neutral", () => {
    const amplifier = computeExamUrgencyAmplifier(daysFromNow(0), NOW);
    expect(amplifier).toBeGreaterThan(1);
  });

  it("5. monotonically increasing as the exam approaches — no discontinuity", () => {
    const far = computeExamUrgencyAmplifier(daysFromNow(30), NOW);
    const medium = computeExamUrgencyAmplifier(daysFromNow(14), NOW);
    const near = computeExamUrgencyAmplifier(daysFromNow(3), NOW);
    const imminent = computeExamUrgencyAmplifier(daysFromNow(0), NOW);

    expect(far).toBeLessThan(medium);
    expect(medium).toBeLessThan(near);
    expect(near).toBeLessThan(imminent);
  });

  it("6. smooth curve — no sharp jump between adjacent days near the illustrative 14-day/3-4-day boundaries (docs/GLOBAL_TODAY_PRIORITY_MODEL.md §12)", () => {
    // A discontinuous two-stage curve would show a large jump right at the
    // boundary; a smooth exponential should not — adjacent-day deltas stay
    // comparable in magnitude across the boundary rather than spiking.
    const day15 = computeExamUrgencyAmplifier(daysFromNow(15), NOW);
    const day14 = computeExamUrgencyAmplifier(daysFromNow(14), NOW);
    const day13 = computeExamUrgencyAmplifier(daysFromNow(13), NOW);
    const day4 = computeExamUrgencyAmplifier(daysFromNow(4), NOW);
    const day3 = computeExamUrgencyAmplifier(daysFromNow(3), NOW);
    const day2 = computeExamUrgencyAmplifier(daysFromNow(2), NOW);

    const deltaAt14 = day14 - day15;
    const deltaAt13 = day13 - day14;
    const deltaAt3 = day3 - day4;
    const deltaAt2 = day2 - day3;

    // Consecutive one-day deltas near a "boundary" stay within the same
    // order of magnitude as their neighbors — no >2x spike anywhere.
    expect(deltaAt13).toBeLessThan(deltaAt14 * 2 + 1e-9);
    expect(deltaAt2).toBeLessThan(deltaAt3 * 2 + 1e-9);
  });

  it("7. is a pure function of (examDate, now) — deterministic, no side effects", () => {
    const a = computeExamUrgencyAmplifier(daysFromNow(5), NOW);
    const b = computeExamUrgencyAmplifier(daysFromNow(5), NOW);
    expect(a).toBe(b);
  });
});

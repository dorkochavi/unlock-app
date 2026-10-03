import { describe, expect, it } from "vitest";
import {
  computeExamUrgencyAmplifier,
  EXAM_URGENCY_AMPLITUDE,
  EXAM_URGENCY_DECAY_DAYS,
  NEUTRAL_EXAM_URGENCY_AMPLIFIER,
  wholeDaysUntilExamDate,
} from "../exam-urgency";
import { deriveLocalDateString } from "../../user/local-date";
import { parseIanaTimezone } from "../../user/timezone";

const TODAY = "2026-01-10";

function localDateOffset(days: number): string {
  const d = new Date(Date.UTC(2026, 0, 10 + days));
  return d.toISOString().slice(0, 10);
}

describe("computeExamUrgencyAmplifier (learner-local calendar-day semantics, OQ-046)", () => {
  it("1. no exam_date set -> exactly neutral (1.0), always", () => {
    expect(computeExamUrgencyAmplifier(null, TODAY)).toBe(NEUTRAL_EXAM_URGENCY_AMPLIFIER);
    expect(computeExamUrgencyAmplifier(null, TODAY)).toBe(1);
  });

  it("2. a far-future exam is effectively neutral", () => {
    expect(computeExamUrgencyAmplifier(localDateOffset(365), TODAY)).toBeCloseTo(1, 10);
  });

  it("3. exam already passed (local date after exam_date) -> exactly neutral", () => {
    expect(computeExamUrgencyAmplifier(localDateOffset(-1), TODAY)).toBe(1);
    expect(computeExamUrgencyAmplifier(localDateOffset(-400), TODAY)).toBe(1);
  });

  it("4. exam today -> exactly the maximum amplifier 2.0", () => {
    expect(computeExamUrgencyAmplifier(TODAY, TODAY)).toBe(2);
    expect(NEUTRAL_EXAM_URGENCY_AMPLIFIER + EXAM_URGENCY_AMPLITUDE).toBe(2);
  });

  it("5. exam tomorrow -> 1 + exp(-1/7); N days away -> 1 + exp(-N/7)", () => {
    expect(computeExamUrgencyAmplifier(localDateOffset(1), TODAY)).toBe(1 + Math.exp(-1 / 7));
    for (const n of [2, 3, 7, 14, 30]) {
      expect(computeExamUrgencyAmplifier(localDateOffset(n), TODAY)).toBe(1 + Math.exp(-n / 7));
    }
    expect(EXAM_URGENCY_DECAY_DAYS).toBe(7);
  });

  it("6. monotonically increasing as the exam approaches", () => {
    const days = [30, 14, 3, 1, 0];
    const values = days.map((n) => computeExamUrgencyAmplifier(localDateOffset(n), TODAY));
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeGreaterThan(values[i - 1]);
    }
  });

  it("7. smooth curve — no >2x spike between adjacent-day deltas", () => {
    const at = (n: number) => computeExamUrgencyAmplifier(localDateOffset(n), TODAY);
    expect(at(13) - at(14)).toBeLessThan((at(14) - at(15)) * 2 + 1e-9);
    expect(at(2) - at(3)).toBeLessThan((at(3) - at(4)) * 2 + 1e-9);
  });

  it("8. same-local-day result is independent of time of day (exam day yields 2.0 at every local time)", () => {
    const tz = parseIanaTimezone("Asia/Jerusalem");
    const instants = [
      "2026-10-09T21:00:00.000Z", // 2026-10-10 00:00 local (IDT, UTC+3)
      "2026-10-10T00:30:00.000Z",
      "2026-10-10T08:00:00.000Z",
      "2026-10-10T20:59:59.000Z", // 2026-10-10 23:59:59 local
    ];
    for (const iso of instants) {
      const local = deriveLocalDateString(new Date(iso), tz);
      expect(local).toBe("2026-10-10");
      expect(computeExamUrgencyAmplifier("2026-10-10", local)).toBe(2);
    }
    // One second after local midnight -> exam passed.
    const after = deriveLocalDateString(new Date("2026-10-10T21:00:00.000Z"), tz);
    expect(after).toBe("2026-10-11");
    expect(computeExamUrgencyAmplifier("2026-10-10", after)).toBe(1);
    // One second before local midnight of exam day -> 1 day away.
    const before = deriveLocalDateString(new Date("2026-10-09T20:59:59.000Z"), tz);
    expect(before).toBe("2026-10-09");
    expect(computeExamUrgencyAmplifier("2026-10-10", before)).toBe(1 + Math.exp(-1 / 7));
  });

  it("9. same instant, different learner timezones -> different local dates -> different amplifiers", () => {
    const instant = new Date("2026-10-10T08:00:00.000Z");
    const jerusalem = deriveLocalDateString(instant, parseIanaTimezone("Asia/Jerusalem")); // 11:00 on 10-10
    const losAngeles = deriveLocalDateString(instant, parseIanaTimezone("America/Los_Angeles")); // 01:00 on 10-10
    expect(jerusalem).toBe("2026-10-10");
    expect(losAngeles).toBe("2026-10-10");
    // Both on the exam day: previously (UTC-midnight instant) this was neutral.
    expect(computeExamUrgencyAmplifier("2026-10-10", jerusalem)).toBe(2);
    expect(computeExamUrgencyAmplifier("2026-10-10", losAngeles)).toBe(2);

    const lateInstant = new Date("2026-10-10T22:00:00.000Z");
    const jerusalemLate = deriveLocalDateString(lateInstant, parseIanaTimezone("Asia/Jerusalem")); // 10-11 01:00
    const laLate = deriveLocalDateString(lateInstant, parseIanaTimezone("America/Los_Angeles")); // 10-10 15:00
    expect(jerusalemLate).toBe("2026-10-11");
    expect(laLate).toBe("2026-10-10");
    expect(computeExamUrgencyAmplifier("2026-10-10", jerusalemLate)).toBe(1); // passed
    expect(computeExamUrgencyAmplifier("2026-10-10", laLate)).toBe(2); // exam day
  });

  it("10. month/year boundaries and DST-adjacent dates count whole calendar days", () => {
    expect(wholeDaysUntilExamDate("2026-03-01", "2026-02-28")).toBe(1);
    expect(wholeDaysUntilExamDate("2028-03-01", "2028-02-28")).toBe(2); // leap year
    expect(wholeDaysUntilExamDate("2027-01-01", "2026-12-31")).toBe(1);
    expect(wholeDaysUntilExamDate("2026-12-31", "2027-01-01")).toBe(-1);
    // US DST spring-forward (2026-03-08) and fall-back (2026-11-01): still whole days.
    expect(wholeDaysUntilExamDate("2026-03-09", "2026-03-07")).toBe(2);
    expect(wholeDaysUntilExamDate("2026-11-02", "2026-10-31")).toBe(2);
    // Israel DST end (2026-10-25).
    expect(wholeDaysUntilExamDate("2026-10-26", "2026-10-24")).toBe(2);
    expect(computeExamUrgencyAmplifier("2026-03-09", "2026-03-07")).toBe(1 + Math.exp(-2 / 7));
  });

  it("11. malformed or impossible dates fail loudly rather than silently mis-ranking", () => {
    expect(() => computeExamUrgencyAmplifier("2026-02-30", TODAY)).toThrow();
    expect(() => computeExamUrgencyAmplifier("10/10/2026", TODAY)).toThrow();
    expect(() => computeExamUrgencyAmplifier(TODAY, "not-a-date")).toThrow();
  });

  it("12. pure and deterministic", () => {
    expect(computeExamUrgencyAmplifier(localDateOffset(5), TODAY)).toBe(
      computeExamUrgencyAmplifier(localDateOffset(5), TODAY),
    );
  });
});

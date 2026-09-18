import { describe, expect, it } from "vitest";

import { deriveLocalDateString } from "../local-date";
import { parseIanaTimezone } from "../timezone";

describe("deriveLocalDateString", () => {
  it("derives the local date for Asia/Jerusalem", () => {
    const tz = parseIanaTimezone("Asia/Jerusalem");
    // 12:00 UTC is well inside the same calendar day in UTC+2/+3.
    expect(deriveLocalDateString(new Date("2026-01-10T12:00:00Z"), tz)).toBe(
      "2026-01-10",
    );
  });

  it("derives the local date for America/New_York", () => {
    const tz = parseIanaTimezone("America/New_York");
    expect(deriveLocalDateString(new Date("2026-01-10T12:00:00Z"), tz)).toBe(
      "2026-01-10",
    );
  });

  it("crosses local midnight ahead of UTC (Asia/Jerusalem, UTC+2 in January)", () => {
    const tz = parseIanaTimezone("Asia/Jerusalem");
    // 23:30 UTC on the 10th is 01:30 local on the 11th.
    expect(deriveLocalDateString(new Date("2026-01-10T23:30:00Z"), tz)).toBe(
      "2026-01-11",
    );
  });

  it("crosses local midnight behind UTC (America/New_York, UTC-5 in January)", () => {
    const tz = parseIanaTimezone("America/New_York");
    // 03:30 UTC on the 11th is 22:30 local on the 10th.
    expect(deriveLocalDateString(new Date("2026-01-11T03:30:00Z"), tz)).toBe(
      "2026-01-10",
    );
  });

  it("is deterministic for the same instant and timezone", () => {
    const tz = parseIanaTimezone("Europe/London");
    const instant = new Date("2026-06-15T05:00:00Z");
    expect(deriveLocalDateString(instant, tz)).toBe(
      deriveLocalDateString(instant, tz),
    );
  });
});

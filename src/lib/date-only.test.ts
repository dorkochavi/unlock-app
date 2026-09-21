import { describe, expect, it } from "vitest";

import { isValidDateOnly } from "./date-only";

describe("isValidDateOnly", () => {
  it.each(["2026-01-15", "2026-02-28", "2024-02-29", "2026-12-31", "2026-01-01"])(
    "accepts real calendar date %s",
    (value) => {
      expect(isValidDateOnly(value)).toBe(true);
    },
  );

  it.each(["0099-01-01", "0001-06-15", "0000-12-31"])(
    "accepts a real calendar date with a year in the 0000-0099 range %s (not silently remapped to 19xx, unlike the JS Date/Date.UTC constructor's legacy two-digit-year behavior)",
    (value) => {
      expect(isValidDateOnly(value)).toBe(true);
    },
  );

  it.each([
    "2026-99-99",
    "2026-02-30",
    "2026-02-29",
    "2023-02-29",
    "2026-13-01",
    "2026-00-01",
    "2026-01-00",
    "2026-01-32",
    "2026-04-31",
  ])("rejects shape-valid but calendar-impossible date %s", (value) => {
    expect(isValidDateOnly(value)).toBe(false);
  });

  it.each(["2026-1-15", "26-01-15", "2026/01/15", "2026-01-15T00:00:00Z", "not-a-date", ""])(
    "rejects malformed shape %s",
    (value) => {
      expect(isValidDateOnly(value)).toBe(false);
    },
  );
});

/**
 * Regression coverage for a real bug found during real-Supabase smoke
 * testing (`GET /api/daily-plan/today`): `readDateOnlyString`'s
 * `Date`-instance branch used to convert via `toISOString().slice(0, 10)`
 * (UTC), but `pg`'s own default type parser for a `date` column (OID 1082)
 * constructs that `Date` from LOCAL calendar components, never UTC midnight
 * — so the old code was off by one calendar day whenever the Node
 * process's own OS timezone had a nonzero UTC offset. See `row-validation
 * .ts`'s own doc comment on `readDateOnlyString` for the full explanation.
 *
 * `withProcessTz` temporarily overrides `process.env.TZ` (Node/V8 re-reads
 * it per-call for local `Date` getters/constructors — verified directly,
 * not assumed) so these tests exercise this bug deterministically
 * regardless of whichever timezone the machine actually running the suite
 * happens to be in, and restores the original value afterward so no other
 * test is affected.
 */
import { afterEach, describe, expect, it } from "vitest";

import { deriveLocalDateString } from "../../../domain/user/local-date";
import { parseIanaTimezone } from "../../../domain/user/timezone";
import { readDateOnlyString } from "../row-validation";

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

function withProcessTz<T>(tz: string, fn: () => T): T {
  process.env.TZ = tz;
  return fn();
}

/**
 * Mirrors `pg`'s own default OID-1082 (`date`) type parser exactly: it
 * builds the returned `Date` from the column text's LOCAL calendar
 * components (`new Date(year, month - 1, day)`), never `Date.UTC(...)`.
 * Not imported from the real `pg-types` package (a transitive, unpinned
 * dependency) — this reproduces the documented behavior directly so the
 * test does not depend on that package's own internal layout.
 */
function asPgDateColumnValue(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

describe("readDateOnlyString", () => {
  it("passes a plain YYYY-MM-DD string through unchanged", () => {
    const row = { planned_for_date: "2026-09-19" };
    expect(readDateOnlyString(row, "daily_plans", "planned_for_date")).toBe(
      "2026-09-19",
    );
  });

  it("recovers the correct local calendar date from a pg-style Date instance under a positive UTC offset (Asia/Jerusalem)", () => {
    withProcessTz("Asia/Jerusalem", () => {
      const row = { planned_for_date: asPgDateColumnValue("2026-09-19") };
      expect(readDateOnlyString(row, "daily_plans", "planned_for_date")).toBe(
        "2026-09-19",
      );
    });
  });

  it("recovers the correct local calendar date from a pg-style Date instance under a negative UTC offset (America/Los_Angeles)", () => {
    withProcessTz("America/Los_Angeles", () => {
      const row = { planned_for_date: asPgDateColumnValue("2026-09-19") };
      expect(readDateOnlyString(row, "daily_plans", "planned_for_date")).toBe(
        "2026-09-19",
      );
    });
  });

  it("recovers the correct local calendar date from a pg-style Date instance under UTC itself", () => {
    withProcessTz("UTC", () => {
      const row = { planned_for_date: asPgDateColumnValue("2026-09-19") };
      expect(readDateOnlyString(row, "daily_plans", "planned_for_date")).toBe(
        "2026-09-19",
      );
    });
  });

  it(
    "end-to-end regression: now=2026-09-19T16:56:17.843Z, timezone=Asia/Jerusalem " +
      "derives plannedForDate=2026-09-19 on write, and a pg round-trip of that " +
      "same value reads back as 2026-09-19, not 2026-09-18",
    () => {
      withProcessTz("Asia/Jerusalem", () => {
        const tz = parseIanaTimezone("Asia/Jerusalem");
        const now = new Date("2026-09-19T16:56:17.843Z");

        const plannedForDate = deriveLocalDateString(now, tz);
        expect(plannedForDate).toBe("2026-09-19");

        const roundTripped = readDateOnlyString(
          { planned_for_date: asPgDateColumnValue(plannedForDate) },
          "daily_plans",
          "planned_for_date",
        );
        expect(roundTripped).toBe("2026-09-19");
      });
    },
  );

  it("throws MalformedRowError for a value that is neither a date-only string nor a Date instance", () => {
    const row = { planned_for_date: 12345 };
    expect(() =>
      readDateOnlyString(row, "daily_plans", "planned_for_date"),
    ).toThrow(/expected a YYYY-MM-DD date value/);
  });
});

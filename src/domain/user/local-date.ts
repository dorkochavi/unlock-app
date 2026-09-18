/**
 * Deterministic server-side local-date derivation — the foundation
 * `docs/OPEN_QUESTIONS.md` #35 / `docs/DATABASE.md` §26 calls for so a
 * future DailyPlan (ADR-016; not implemented by this slice) can compute
 * "today" from a persisted IANA timezone rather than a value recalculated
 * per-request/device.
 */
import type { IanaTimezone } from "./timezone";

/**
 * Returns the `YYYY-MM-DD` local calendar date for `instant` in `timezone`.
 * Built from `Intl.DateTimeFormat.formatToParts` rather than a formatted
 * string, so the result never depends on a locale's separator/ordering
 * conventions — only on the platform's IANA tzdata, which is what makes
 * this deterministic and dependency-free.
 */
export function deriveLocalDateString(
  instant: Date,
  timezone: IanaTimezone,
): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    // Unreachable for any timezone that passed `parseIanaTimezone` — surfaced
    // loudly rather than silently returning a malformed date string.
    throw new Error(
      `deriveLocalDateString: could not derive a local date for timezone "${timezone}"`,
    );
  }

  return `${year}-${month}-${day}`;
}

/**
 * Canonical `YYYY-MM-DD` calendar-date validator for API-boundary input
 * (Run 008 S1.C). A shape-only regex (`/^\d{4}-\d{2}-\d{2}$/`) accepts
 * syntactically well-formed but calendar-impossible strings such as
 * `2026-99-99` or `2026-02-30` — those previously flowed unvalidated
 * through `createCourse`/`updateCourseMetadata` into a parameterized
 * Postgres `date` column insert/update, where Postgres itself rejects
 * them as a raw, unhandled error (falls through to a generic 500
 * `INTERNAL_ERROR` instead of a controlled 400 `INVALID_REQUEST`).
 *
 * Validates calendar correctness via UTC round-trip construction
 * (`Date.UTC` then re-reading the UTC components back) — pure calendar
 * arithmetic, never a local-timezone conversion, so it is not subject to
 * the local-vs-UTC day-shift bug `readDateOnlyString`'s doc comment
 * describes (`src/infrastructure/postgres/row-validation.ts`). The
 * validated value itself is returned/used as the original `YYYY-MM-DD`
 * string end to end — this never introduces timestamp/timezone semantics
 * into a DATE-only field.
 */
const DATE_ONLY_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY_SHAPE.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  // `new Date(Date.UTC(year, ...))` is deliberately NOT used here: both the
  // `Date` constructor and `Date.UTC` apply ECMAScript's legacy two-digit-year
  // mapping (any `year` 0-99 becomes `1900 + year`), which would silently
  // reject an otherwise-valid year in that range (e.g. `0099-01-01`).
  // `setUTCFullYear` has no such special case — it always sets the literal
  // year given — so an epoch placeholder is constructed first and every
  // component is then set explicitly via `setUTCFullYear`.
  const asUtc = new Date(0);
  asUtc.setUTCFullYear(year, month - 1, day);
  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
}

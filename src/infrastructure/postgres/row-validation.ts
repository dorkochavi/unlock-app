/**
 * Small, shared "fail loudly on structurally invalid persisted data" helpers
 * used by every mapper in this directory (Phase 5's mapping-audit
 * requirement: mapping code must never silently manufacture a domain value
 * from a malformed row — it must throw).
 *
 * These are deliberately narrow readers over `Record<string, unknown>` rows
 * — not a general runtime-validation library (Zod etc.) — because the shape
 * being validated here is fully pinned by this repo's own migration DDL
 * (`supabase/migrations/20260917203000_initial_schema.sql`), not external
 * input crossing a trust boundary. `docs/ARCHITECTURE.md` §22 reserves Zod
 * for when runtime schema validation has an actual demonstrated use beyond
 * this; a handful of typed field readers is enough here and does not
 * warrant a new dependency.
 */

export class MalformedRowError extends Error {
  constructor(table: string, column: string, detail: string) {
    super(`Malformed row from "${table}.${column}": ${detail}`);
    this.name = "MalformedRowError";
  }
}

export function readString(
  row: Record<string, unknown>,
  table: string,
  column: string,
): string {
  const value = row[column];
  if (typeof value !== "string") {
    throw new MalformedRowError(
      table,
      column,
      `expected string, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export function readNullableString(
  row: Record<string, unknown>,
  table: string,
  column: string,
): string | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new MalformedRowError(
      table,
      column,
      `expected string or null, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export function readBoolean(
  row: Record<string, unknown>,
  table: string,
  column: string,
): boolean {
  const value = row[column];
  if (typeof value !== "boolean") {
    throw new MalformedRowError(
      table,
      column,
      `expected boolean, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

/**
 * Postgres `int`/`int4` columns already arrive as JS numbers via both `pg`
 * and PGlite; `numeric`/`decimal` columns arrive as strings (to avoid
 * silent float-precision loss) — this reader accepts either representation
 * and fails loudly on anything else (including `NaN`/non-finite results).
 */
export function readNumber(
  row: Record<string, unknown>,
  table: string,
  column: string,
): number {
  const value = row[column];
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) {
    throw new MalformedRowError(
      table,
      column,
      `expected a finite number, got ${JSON.stringify(value)}`,
    );
  }
  return parsed;
}

export function readNullableNumber(
  row: Record<string, unknown>,
  table: string,
  column: string,
): number | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return readNumber(row, table, column);
}

export function readDate(
  row: Record<string, unknown>,
  table: string,
  column: string,
): Date {
  const value = row[column];
  const date =
    value instanceof Date
      ? value
      : typeof value === "string"
        ? new Date(value)
        : null;
  if (date === null || Number.isNaN(date.getTime())) {
    throw new MalformedRowError(
      table,
      column,
      `expected a valid timestamp, got ${JSON.stringify(value)}`,
    );
  }
  return date;
}

export function readNullableDate(
  row: Record<string, unknown>,
  table: string,
  column: string,
): Date | null {
  const value = row[column];
  if (value === null || value === undefined) {
    return null;
  }
  return readDate(row, table, column);
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Reads a Postgres `date` column as a logical `YYYY-MM-DD` string —
 * `planned_for_date`'s own domain meaning (`docs/OPEN_QUESTIONS.md` #3: no
 * timezone/day-boundary logic exists anywhere in this codebase; it is
 * treated as an opaque caller-supplied label, never a `Date` with a time
 * component). Accepts either representation a driver might hand back for a
 * `date` column (a `YYYY-MM-DD` string, or occasionally a `Date` instance
 * depending on driver type-parsing configuration) and normalizes to the
 * string form either way — but never accepts a value carrying an actual
 * time-of-day/timezone component, since that would silently smuggle
 * exactly the day-boundary semantics this column is documented not to
 * have.
 */
export function readDateOnlyString(
  row: Record<string, unknown>,
  table: string,
  column: string,
): string {
  const value = row[column];
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    return value;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  throw new MalformedRowError(
    table,
    column,
    `expected a YYYY-MM-DD date value, got ${JSON.stringify(value)}`,
  );
}

/**
 * Validates `value` is one of `allowed` and narrows the return type — used
 * for every `text CHECK (col IN (...))` column, so an unrecognized value
 * (e.g. a future migration adding a new enum member the running code
 * doesn't know about yet) throws instead of silently widening to `string`.
 */
export function readEnum<T extends string>(
  row: Record<string, unknown>,
  table: string,
  column: string,
  allowed: readonly T[],
): T {
  const value = readString(row, table, column);
  if (!(allowed as readonly string[]).includes(value)) {
    throw new MalformedRowError(
      table,
      column,
      `value ${JSON.stringify(value)} is not one of ${JSON.stringify(allowed)}`,
    );
  }
  return value as T;
}

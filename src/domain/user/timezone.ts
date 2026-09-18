/**
 * IANA timezone identifier boundary — V1 user timezone persistence
 * (`docs/OPEN_QUESTIONS.md` #35, RESOLVED at the product level;
 * `docs/DATABASE.md` §26).
 *
 * Deliberately not a timezone library: validity/canonicalization is
 * delegated entirely to the JS platform's own IANA tzdata via
 * `Intl.DateTimeFormat` (available in every supported Node/browser
 * runtime), so this module never bundles or duplicates a timezone
 * database. An arbitrary client-supplied string must never be trusted as a
 * real IANA identifier without passing through here first.
 */

declare const IANA_TIMEZONE_BRAND: unique symbol;

/** A string proven valid by `parseIanaTimezone` — never constructed directly. */
export type IanaTimezone = string & { readonly [IANA_TIMEZONE_BRAND]: true };

export class InvalidTimezoneError extends Error {
  constructor(value: string) {
    super(`"${value}" is not a valid IANA timezone identifier`);
    this.name = "InvalidTimezoneError";
  }
}

export function isValidIanaTimezone(value: string): boolean {
  if (value.trim() === "") {
    return false;
  }
  try {
    // `Intl.DateTimeFormat` throws `RangeError` for any `timeZone` value the
    // platform's tzdata does not recognize — the standard, dependency-free
    // way to validate an IANA identifier.
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates `value` and returns its canonical IANA form (e.g.
 * `"asia/jerusalem"` -> `"Asia/Jerusalem"`), so two differently-cased
 * inputs for the same zone never get persisted as distinct values. Throws
 * `InvalidTimezoneError` for anything the platform's tzdata does not
 * recognize.
 */
export function parseIanaTimezone(value: string): IanaTimezone {
  if (!isValidIanaTimezone(value)) {
    throw new InvalidTimezoneError(value);
  }
  const canonical = new Intl.DateTimeFormat("en-US", {
    timeZone: value,
  }).resolvedOptions().timeZone;
  return canonical as IanaTimezone;
}

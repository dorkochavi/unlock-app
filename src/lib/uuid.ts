/**
 * Format-only check for "does this look like a UUID Postgres would accept
 * for a `uuid` column." Used at API boundaries to reject a malformed
 * `courseId` path parameter BEFORE it reaches a parameterized SQL query —
 * without this, Postgres itself throws `invalid input syntax for type
 * uuid`, which is an unhandled error that falls through to a generic 500
 * response instead of a controlled not-found response.
 *
 * Deliberately permissive about UUID version/variant bits (accepts any
 * RFC 4122-shaped value) since this is a syntax check, not an identity
 * check — the database is still the source of truth for whether a
 * well-formed id actually exists.
 */
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

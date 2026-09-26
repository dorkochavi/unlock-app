/**
 * Explicit allowlist of internal app destinations a `next` redirect param
 * is permitted to resolve to (Night-Run Slice 6 §6F). Deliberately NOT a
 * general "is this a safe relative path" validator — that class of check is
 * easy to get subtly wrong (protocol-relative `//evil.com`, backslash
 * tricks, an embedded scheme like `/\tjavascript:...`). An explicit
 * allowlist of exactly the destinations this app's own links ever generate
 * has no such failure mode: anything that doesn't match falls back to a
 * safe default, never partially trusted.
 */
// Run UX-01 UX-2: the learner Browse destinations (`/courses`, `/progress`,
// `/courses/:courseId`) are allowlisted so a learner who signs in again from
// one of them returns there. Same exact-match, id-charset-restricted shape as
// `/join/:courseId`; nothing broader.
//
// Run UX-02 P3: the Practice screen `/courses/:id/practice` is allowlisted with
// EXACTLY the two query parameters it uses — `topic=<id>` and
// `from=course|progress` (each at most once, either order) — so a learner whose
// session expires on Practice signs in and returns to the same scope and origin.
const ID = "[0-9a-fA-F-]{1,64}";
const FROM = "from=(?:course|progress)";
const TOPIC = `topic=${ID}`;
const PRACTICE_PATH = `courses\\/${ID}\\/practice(?:\\?(?:${TOPIC}(?:&${FROM})?|${FROM}(?:&${TOPIC})?))?`;
const SAFE_NEXT_PATTERN = new RegExp(
  `^\\/(today|courses|progress|courses\\/${ID}|join\\/${ID}|${PRACTICE_PATH})$`,
);
const DEFAULT_NEXT_PATH = "/today";

/**
 * The sign-in link for a learner page whose session is missing/expired.
 * Carries `next` only for an allowlisted destination other than the default
 * (the login page resolves `next` through `resolveSafeNextPath` again).
 */
export function buildSignInHref(currentPath: string): string {
  const safeNext = resolveSafeNextPath(currentPath);
  return safeNext === DEFAULT_NEXT_PATH || safeNext !== currentPath
    ? "/login"
    : `/login?next=${encodeURIComponent(safeNext)}`;
}

export function resolveSafeNextPath(candidate: string | null): string {
  if (candidate !== null && SAFE_NEXT_PATTERN.test(candidate)) {
    return candidate;
  }
  return DEFAULT_NEXT_PATH;
}

/**
 * Resolves the post-auth destination from a location search string
 * (`window.location.search`, e.g. `?next=%2Fjoin%2F<id>`), always through
 * `resolveSafeNextPath`. Pure so the parsing is testable.
 *
 * IMPORTANT for callers: read `window.location.search` at the moment of USE
 * (e.g. inside a submit handler), never in a render-time initializer. In the
 * Next.js App Router a client-side navigation (`router.push`) renders the
 * destination page BEFORE it updates the browser URL (`HistoryUpdater` runs at
 * commit), so a render-time read sees the PREVIOUS URL and silently drops
 * `next` — which lost join intent for /join/:id -> /login navigations.
 */
export function resolveNextPathFromSearch(search: string): string {
  return resolveSafeNextPath(new URLSearchParams(search).get("next"));
}

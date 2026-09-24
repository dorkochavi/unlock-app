import { resolveSafeNextPath } from "./safe-redirect";

const DEFAULT_NEXT_PATH = "/today";

/**
 * Builds the `emailRedirectTo` for `supabase.auth.signUp` so the email
 * confirmation link returns to `/login` carrying the learner's validated
 * internal destination (FUB-027).
 *
 * The result is composed ONLY from a normalized http(s) origin, the fixed
 * `/login` path, and the output of `resolveSafeNextPath` — raw `next` input
 * is never appended. Returns `null` for an unusable origin; the caller then
 * omits `emailRedirectTo` (Supabase falls back to its Site URL) rather than
 * failing signup. Supabase still enforces its own hosted Redirect URL
 * allow-list; this does not replace it.
 */
export function buildSignUpEmailRedirectTo(
  origin: string | null,
  rawNext: string | null,
): string | null {
  let normalizedOrigin: string;
  try {
    const url = new URL(origin ?? "");
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    normalizedOrigin = url.origin;
  } catch {
    return null;
  }

  const safeNext = resolveSafeNextPath(rawNext);
  if (safeNext === DEFAULT_NEXT_PATH) {
    return `${normalizedOrigin}/login`;
  }
  return `${normalizedOrigin}/login?next=${encodeURIComponent(safeNext)}`;
}

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
const SAFE_NEXT_PATTERN = /^\/(today|join\/[0-9a-fA-F-]{1,64})$/;
const DEFAULT_NEXT_PATH = "/today";

export function resolveSafeNextPath(candidate: string | null): string {
  if (candidate !== null && SAFE_NEXT_PATTERN.test(candidate)) {
    return candidate;
  }
  return DEFAULT_NEXT_PATH;
}

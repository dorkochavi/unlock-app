# PILOT-HARDENING-EVIDENCE-001 — Slice D: Auth redirect / `next=` audit

RUN_ID 2026-10-04-PILOT-HARDENING-EVIDENCE-001 | START_HEAD 8409881 | test commit 0c12526
Provenance: [REPO] = read from committed code/tests this slice; [TEST] = executed locally this slice; [DOC] = prior docs; [HUMAN] = cannot be verified from repo.

## Code facts [REPO]
- No auth callback / confirm route, no middleware/proxy, no server-side `redirect()` using `next`, no use of Host/X-Forwarded-* headers anywhere in `src`.
- `next` is consumed in exactly one place: `src/app/login/page.tsx` (client), read from `window.location.search` at submit time via `resolveNextPathFromSearch` -> `resolveSafeNextPath` (`src/lib/safe-redirect.ts`), then `router.push(nextPath)` (client navigation, internal path only).
- `resolveSafeNextPath` is an exact-match allowlist regex (`/today`, `/courses`, `/progress`, `/courses/:id`, `/join/:id`, `/courses/:id/practice` with only `topic`/`from` params; id charset `[0-9a-fA-F-]{1,64}`); anything else returns `/today`. Not a generic "is relative" check.
- `emailRedirectTo` = `buildSignUpEmailRedirectTo(window.location.origin, nextPath)`: normalized http(s) origin + fixed `/login` + `encodeURIComponent(allowlisted path)`; raw next never appended; unusable origin -> option omitted. Origin comes from the browser, not request headers (there is no server-side construction).
- Link producers (`buildSignInHref`, join page) only emit allowlisted paths. `/instructor/courses/new` is emitted by the instructor page but is NOT allowlisted -> falls back to `/today` (known minor, FUB-027 note; a UX matter, not security).

## Scenario x result
| # | Negative scenario | Result | Evidence |
|---|---|---|---|
| 1 | `https://evil.example` / `http://` absolute | fallback /today | [TEST] existing |
| 2 | `//evil.example` protocol-relative | fallback | [TEST] existing |
| 3 | Backslash variants: `/\evil`, `/\/evil`, `\evil`, `/%5Cevil` | fallback | [TEST] existing + added; the `/\/evil` it.each row was originally a duplicate of `//evil` (JS-literal escape) and was corrected in 6/n to true backslash literals |
| 4 | `%2F%2Fevil` (raw and via query string), double-encoded `%252F` | fallback (no decoding is ever applied) | [TEST] added |
| 5 | `javascript:`, mixed-case `JaVaScRiPt:`, `data:` | fallback | [TEST] existing + added |
| 6 | CR/LF header-injection, trailing `\r`/`\n`, tab, leading/trailing space, NUL | fallback (JS `$` without `m` flag does not tolerate trailing newline) | [TEST] existing + added |
| 7 | Unicode slash lookalikes (U+FF0F, U+2215) | fallback | [TEST] added |
| 8 | nested `next` (`/login?next=...`, `?next=a&next=evil`), fragment `#//evil`, `/../` traversal | fallback / first value only, allowlisted or default | [TEST] added |
| 9 | Non-allowlisted internal paths (`/admin`, `/instructor/...`, `/courses/x/edit`, other practice params/duplicates) | fallback | [TEST] existing |
| 10 | `emailRedirectTo` with hostile next | always bare `<origin>/login` | [TEST] existing (14 cases) |
| 11 | `emailRedirectTo` from untrusted Host/X-Forwarded-Host | N/A: built client-side from `window.location.origin`; no server code reads headers [REPO]. Unusable origins (javascript:, file:, data:, null, empty) -> null [TEST] existing | |
| 12 | Open redirect via confirm/callback route | N/A: no such route exists [REPO] | |

Commands [TEST]: `npx vitest run src/lib/safe-redirect.test.ts src/lib/safe-redirect-practice.test.ts src/lib/auth-redirect.test.ts src/lib/next-path-from-search.test.ts` -> 4 files, 79 tests pass; `tsc --noEmit` and eslint on the changed test clean. Only change: test additions in `src/lib/safe-redirect.test.ts` (no product code touched).

## Classification
1. Existing accepted behavior: allowlist-only `next`, safe fallback to `/today`, fixed-shape `emailRedirectTo` (FUB-027, Run 009 `04597b4`, UX-01/02 extensions).
2. App-side security gap: NONE found. No open redirect via `next`; no server redirect or header-derived origin surface.
3. Hosted-config hardening (human-owned, [HUMAN], unverifiable from repo): Supabase Dashboard -> Authentication -> URL Configuration: (a) Site URL = production origin; (b) Redirect URLs contain `<prod origin>/login` and a query-matching pattern such as `<prod origin>/login**` (also confirm the pattern accepts `/login?next=%2Fjoin%2F<id>`, `%2Fcourses`, `%2Fprogress`, `%2Fcourses%2F<id>`, practice `next` values); (c) no broad `/**` or preview-domain wildcard; localhost entry only if needed; (d) Confirm-signup email template uses `{{ .ConfirmationURL }}`. Failure mode if missing: Supabase falls back to Site URL (join/next intent lost), not a security hole. Join intent via signup confirmation was already HOSTED + MANUAL VERIFIED on Production 2026-09-25 [DOC]; the remaining unverified part is only the newer UX-01/02 `next` shapes.
4. Product decision needed: none for security. Optional UX: allowlist `/instructor/courses/new` (currently falls back to `/today`) - not required.

## Recommendation
- DEV_STATUS line reword: "Hosted Supabase Auth Redirect URL allow-list: app side audited (2026-10-04, no open-redirect path; allowlist-only `next`). Remaining human dashboard check that the pattern accepts newer `/login?next=` shapes (courses/progress/practice); fails safe to Site URL. Non-blocking."
- Backlog: keep a single human-check item (the dashboard checklist above); no code follow-up.

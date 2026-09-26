# UNLOCK — Follow-Up Backlog: Closed Items (archive)

**Status:** ARCHIVE — historical, not current authority

Closed items moved unchanged from `docs/FOLLOW_UP_BACKLOG.md` on 2026-09-26. Source of truth for history is Git. IDs are not reused.

---

# FUB-005 — Structured Import Source Size/Row Limits

**Status:** `RESOLVED` — Run 008 S1.D added `MAX_IMPORT_ROWS` (2,000,
`src/application/import/limits.ts`), enforced in `previewImport` right
after parsing, inherited by `confirmImport`'s Phase 1 reparse. Kept for
traceability; the original observation below is historical.
**Priority:** `LOW`
**Area:** Run 007 / Structured Import

## Observation

Run 007 S1's JSON/CSV import adapters (`src/application/import/adapters/`)
are pure parsing functions with no upper bound on payload size or row
count — a multi-megabyte JSON array or a CSV with hundreds of thousands of
rows is parsed synchronously in one call. Flagged during S1's
`/review-commit` general review.

## Important Constraint

Not a defect in S1 itself: S1 has no API/auth boundary yet (it is only
called by the S3 preview/confirm routes, not yet built), so there is
nowhere for a request-size limit to attach today.

## Follow-Up Investigation

When S3 (Preview API + Instructor Preview UI) is implemented, decide a
concrete request-body/row-count limit for the preview/confirm routes and
enforce it at that HTTP boundary — not inside the format-independent
adapters themselves.

## Do Not Do Yet

Do not add a size/row cap to the adapters in S1/S2 — no HTTP boundary
exists yet to make that limit meaningful, and guessing a number now would
be exactly the kind of premature constraint `.claude/rules/api.md` asks to
avoid inventing ahead of the real boundary.

---

# FUB-012 — Legacy TodaySession Retirement Investigation

**Status:** `RESOLVED` — retired pre-Run-009 (dedicated cleanup Slice,
2026-09-23). Confirmed human evidence before deletion: hosted
`today_sessions` = 0 rows, `today_session_items` = 0 rows,
`attempts.today_session_item_id IS NOT NULL` = 0 rows. A runtime
reachability audit confirmed no live `src/app` route created/retrieved a
TodaySession. All TodaySession application/domain/infrastructure code and
tests were removed; `DailyPlan`/`DailyPlanItem` (ADR-016) is now the sole
active Today model. A forward-only migration
(`supabase/migrations/20260929000000_retire_today_session.sql`) drops
`today_sessions`/`today_session_items` and
`attempts.today_session_id`/`attempts.today_session_item_id`. That migration
is committed and locally/PGlite-verified; it was deliberately not applied
hosted as part of this Slice, and was later applied hosted by a human
(2026-09-23) after the backup gate closed; see `docs/DEV_STATUS.md`. ADR-011 updated to
reflect retirement. Kept for traceability; the original observation below is
historical.
**Priority:** `LOW`
**Area:** Repository Maintainability

## Observation

Legacy `today_sessions`/`today_session_items` tables and associated code
may no longer be required now that persisted DailyPlan/DailyPlanItems
(ADR-016) own Today.

## Follow-Up Investigation

Investigate whether these can eventually be removed once no required
compatibility path remains.

## Do Not Do Yet

Do not delete now — no proof yet that nothing depends on them.

---

# FUB-027 — Signup Confirmation Redirect / Join-Intent Preservation

**Status:** `HOSTED + MANUAL VERIFIED` — `RESOLVED` for current Pre-Pilot scope (2026-09-25 real-phone rehearsal on Production: join → signup → email confirmation → login → Today, see `docs/PILOT_READINESS.md` (full evidence tables: `git show afcd750:docs/CHATGPT_PLAN.md`, "S4 Real-Device Evidence #1")). Earlier text below is historical.
**Priority:** was `HIGH` for the pilot (previously blocked a clean S4 re-test)
**Area:** Auth UX / `src/app/login/page.tsx`, `src/lib/auth-redirect.ts`

## Observation

`signUp({ email, password })` passed no `emailRedirectTo`; no tracked auth callback, middleware
or reader of `NEXT_PUBLIC_APP_URL` exists, so the confirmation link target was the hosted
Supabase Site URL (observed: `http://localhost:3000`). Join intent lives only in
`/login?next=/join/<id>`; sign-in and instant-session sign-up preserved it, but the
confirmation-email path dropped it, so a confirmed learner landed on `/login` with no `next`
and reached an empty Today.

## Current State

`buildSignUpEmailRedirectTo` builds `<origin>/login[?next=<safe path>]` from a normalized http(s)
origin plus `resolveSafeNextPath` output only; `login/page.tsx` passes it as `signUp`
`options.emailRedirectTo` (omitted if the origin is unusable, falling back to the Site URL).
`safe-redirect.ts` is unchanged. After confirmation the learner lands on
`/login?next=/join/<id>` and signs in (the account is already confirmed). Whether the link also
auto-establishes a session is NOT relied upon — verify in the real retest, including that
`/login` behaves cleanly for an already-signed-in user. Minor: `safe-redirect.ts` does not allow
`/instructor/courses/new`, so that `next` falls back to `/today`.

## Addendum (Run 009, 2026-09-26) — `next` is now read at submit time

The statement above that sign-in preserved the join intent was true only when `/login?next=…` was loaded
directly (typed URL, confirmation-email link). On the soft navigation from `/join/:id` (the join page's
`router.push`), the login page read `window.location.search` during render, before the App Router had
updated the URL, so `next` was lost and sign-in landed on `/today` (found in Run 009 S2 Preview). Fixed in
`04597b4` ("Fix join intent preservation across authentication"): `next` is read at submit time via
`resolveNextPathFromSearch` (still gated by the unchanged `resolveSafeNextPath` allowlist), including for the
sign-up `emailRedirectTo`. After sign-in the learner returns to `/join/:id` and taps Join (explicit consent; no
auto-join). Preview-verified. Everything else in this entry is unchanged.

## Human Dashboard Checks (not performed by the agent)

1. Supabase → Authentication → URL Configuration → **Site URL** = the deployed origin
   (the production origin is not tracked in the repo; the human must supply and verify it).
2. **Redirect URLs** allow-list: add BOTH `<production origin>/login` (the default-destination
   case emits a bare `/login`) and a pattern that matches `/login?next=...`, e.g.
   `<production origin>/login**`. A bare `/login` entry probably does NOT match the
   query-bearing form. Supabase validates `redirect_to` before appending any PKCE `code`, so the
   pattern only needs to match `/login?next=%2Fjoin%2F<id>`. Exact glob semantics are unverified
   offline — confirm in the dashboard/real test. Avoid a broad `/**` or preview-domain wildcard.
   If not allow-listed, Supabase silently falls back to the Site URL (join intent lost again).
3. Keep `http://localhost:3000/login` allow-listed only if local testing needs it.
4. Check the Confirm-signup email template still uses `{{ .ConfirmationURL }}` (not a hardcoded host).
5. Retest with a fresh phone/email: `/join/<id>` → sign up → confirm email → lands on
   `/login?next=…` → sign in → join → Today.

## Do Not Do Yet

No further auth change until the hosted retest shows whether this is sufficient.

---

# FUB-028 — Item Analysis Discoverability

**Status:** `RESOLVED` — PRODUCTION VERIFIED 2026-09-26 (`v0.1.0`, `8e137e6`). The instructor Course page shows a "ניתוח תשובות" entry point in the Questions section header, rendered only for a PUBLISHED Course by design (DRAFT/ARCHIVED Courses expose no dead link); the analysis page loads and passed the privacy check in Production. Code: Run 009 S3 (`aa9f858`). The original premise below ("reachable only by direct URL") was inaccurate: an unconditional small text link already existed since Pre-Pilot S2; S3 made it an intentional, Course-state-safe button. Kept for traceability; the observation below is historical.
**Area:** Instructor Course UI navigation

Observed 2026-09-25 (manual QA): Item Analysis works and is authorized correctly but is only
reachable by direct URL; there is no visible entry from the normal instructor Course UI. The
Plan does not require discoverability. The protocol names the path `Course → ניתוח תשובות לפי
שאלה`; a link would be a small deliberate UI change.

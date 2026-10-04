# UNLOCK — Run Report: 2026-10-05-PILOT-CLOSURE-OVERNIGHT-001

Run: `2026-10-05-PILOT-CLOSURE-OVERNIGHT-001`
Status: COMPLETE (eligible queue exhausted; human actions remain)
START_HEAD: `36d5b57`; code head `2d9d3bc`. Branch `feature/run-010-learning-intelligence`, local only, NOT pushed.
HOSTED_MUTATION: NONE. REMOTE_GIT_MUTATION: NONE. No real email sent. Secrets not read.

## 1. Slice A — Pilot 13(a)
Canonical wording allows derivation from authoritative records; result: satisfied, no `today_opened`. Derivation and the not-observable list: `docs/PILOT_EVIDENCE_OPERATIONS.md` §3.1. New finding: Practice also creates the DailyPlan, so `plans_generated` means first Today-or-Practice activity of the day. Proof: PGlite `pilot-evidence-aggregates.test.ts` 8/8. Commit `93d0ce2`.

## 2. Slice B — Password recovery
`/login` modes forgot / recovery (`?mode=recovery`), PKCE via the existing browser client, fixed same-origin `redirectTo`, no new route, no server route (Supabase requires the recovery session). Password policy = existing min 6. Tests: `src/lib/password-recovery.test.ts` (22). Security review (`unlock-security-reviewer`): 0 HIGH; M1 429-enumeration oracle FIXED (429 now shows the same message as sent; test); L1 other sessions revoked best-effort FIXED (test); L2 cross-browser link = invalid state (accepted, UX); L3 `mode=recovery` with a stale session shows the form (no privilege gain; accepted); L4 dead `code` stays in URL on failed exchange (negligible, accepted); L5 page wiring untested (node env). Delta fixes were not re-reviewed (small, test-covered). Commit `2d9d3bc`.

## 3. Slice C — Backlog triage (36 open items)
GREEN_NOW 0; NOT_WORTH_NOW 9 (001,002,003,004,006,013,015,016,017: each explicitly "do not do yet" with an unmet promotion trigger); HUMAN_DECISION 14 (018-022,024,029,033,034,035,037,038,042,045); WATCH 11 (007,008,010,011,014,023,026,031,032,044,047); HOSTED/HUMAN_ACTION 2 (009,048); OBSOLETE/RESOLVED 0. Bodies read in detail for ~15 items; the rest classified from title/status/trigger (Run 011/012 roadmap or product-owned). Nothing promoted or implemented. FUB-009 and FUB-023 narrowed with provenance.

## 4. Verification
Full unit 170 files passed, 1 skipped; 2004 tests passed, 4 skipped. Typecheck clean; lint 0 errors (+ known statusline.mjs warning); `git diff --check` clean; schema evidence test 8/8. Not run: build, browser E2E, other schema suites (no DB/route change), hosted anything.

## 5. Provenance
SMTP/Resend/60-per-hour/Free-plan facts are HUMAN_REPORTED, not repo-verified. Recovery UX end-to-end (real email, code exchange) is unproven.

## 6. Human actions
1. Verify Supabase Redirect URLs contain `https://unlock-app-pied.vercel.app/login**` (else add `/login?mode=recovery`); then test one real recovery on a Preview in the same browser.
2. Report Vercel Runtime Logs retention (V2) to settle 13(b).
3. Decide OQ-039 (privacy/data ownership, options A/B/C).
4. Content gate: real Ruppin material + sign-off.
5. Review and push when satisfied (human action).

## 7. Mechanism / telemetry
Thin parent + 2 workers (implementer, security reviewer); isolation held, sequential; no compaction. KEEP.

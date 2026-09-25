# Run 2026-09-24-OVERNIGHT-PREPILOT (support run, not Run009)

Local-only Pre-Pilot hardening, BASE `30580b8`. No push, no hosted access, no dev server/E2E/build. Sections N1–N4 are historical evidence from the first overnight pass; the "F-series status" and later sections are the current status after local integration.

## N1 — S4 blocker diagnosis (historical; S4 still NOT COMPLETE)
- The app passed no `emailRedirectTo` on sign-up and has no auth callback/middleware; the localhost target is most likely the hosted Supabase Site URL (CONFIRMED FROM CODE that the app set none; hosted value UNKNOWN UNTIL DASHBOARD CHECK).
- Join intent existed only in `/login?next=/join/<id>`: kept for sign-in and instant-session sign-up, DROPPED on the email-confirmation path.
- Fixing Site URL alone fixes the redirect host but lands on the site root, not `/join/<id>`. The app change (`emailRedirectTo=<origin>/login?next=…`, URL allow-listed) is now implemented locally — see FUB-027 in `docs/FOLLOW_UP_BACKLOG.md` for current status and the human dashboard checklist.

## N3 — Offline content validator
`scripts/validate-import.mjs` + `validate-import-source.ts` reuse the canonical adapters/domain validation (no parallel rules); codes/rows/counts only; exit 0/1/2. Docs: `docs/PILOT_CONTENT_VALIDATOR.md`. Synthetic tests only (source, edge, CLI, and a parity test against `previewImport`). `jiti` (used to load the TypeScript) is now a declared devDependency. General reviewer (original pass): two CLI robustness points (one already handled by `trim()`, one fixed).

## N2 / N4
N2: no qualifying gap (every handler/use case has tests; answer/join/DailyPlan paths dense); nothing added. N4: skipped, not justified.

## F-series status (current)
| Item | Status |
|---|---|
| F-12 | MANUAL UI VERIFIED, RESOLVED (2026-09-25 real-phone rehearsal) |
| F-13, F-14 | MANUAL UI VERIFIED, RESOLVED (2026-09-25 Production QA) |
| FUB-027 | HOSTED + MANUAL VERIFIED, RESOLVED (2026-09-25 real-phone rehearsal) |
| F-01 | MITIGATED; design issue deferred, not resolved |
| F-04a | RESOLVED LOCALLY |
| F-04b | DECISION PENDING |
| F-02 | DECISION PENDING |

Also added as test-only evidence: revoked OWNER/INSTRUCTOR publish/archive denial tests and an exhaustive Item Analysis bucketing test (n=5..60).

## F-04a — live membership on existing DailyPlan items
Root cause: generation requires an active LEARNER membership, but answer/skip only checked item ownership, so a learner revoked after generation could keep mutating the plan (ADR-015 §7; the plan freeze covers content/order, not authorization).
Rule: `hasActiveLearnerMembership` (`src/application/dailyPlan/live-learner-membership.ts`) = membership exists for the ITEM's course, `role === LEARNER`, `revokedAt === null` (domain `hasAccess`). Runs after the ownership check and before any transaction/Attempt/`markSkipped`. Denial reuses `ITEM_NOT_FOUND_OR_NOT_OWNED` (404 `ITEM_NOT_FOUND`); no new public code.
Deliberate: a learner-ARCHIVED (not revoked) membership keeps access (ADR-015 §7/§9, ADR-016 §16). Course status is not consulted, so F-04b is untouched (pinned by a test). Race: read-then-write, no lock; a revoke committing between the check and the write can let that one in-flight request through. Security reviewer: no blocking findings; optional future hardening = re-check inside the answer transaction.

## F-04b — DECISION PENDING
Course PUBLISHED -> ARCHIVED after the plan exists: whether answer/skip/plan reopen should stop is undecided. Nothing here changes it.

## F-02 — decision memo (no code changed) — HUMAN DECISION REQUIRED
Problem: threshold 5 (Course size and responders); exact `distinctResponderCount` plus incorrect-rate rounded to 10 pts. For n=5..10 every incorrect count k maps to a distinct rounded percentage, so the output is the exact k (first collisions appear at n=11). An instructor who refreshes after each response can infer that responder's correctness. Insider differencing, not an external leak.
- A. Keep as is, accept the residual risk. No change; the risk stays at n=5..10 and refresh-after-window remains the only mitigation.
- B. Drop the responder count, keep the rounded %. DTO field removed; page copy updated; no schema change. Reduces but does not remove it: n is still roughly known (≥5, Course size) and at small n a one-response change moves the % visibly.
- C. Drop the count, show a coarse band. New pure domain function beside `aggregate-disclosure.ts`; DTO replaces `approximateIncorrectRatePercent` (and `distinctResponderCount`); page + `he.ts` copy; no schema change. Any deterministic banding still leaks the single response that crosses a boundary; bands only make that rare.
Candidate band systems (k incorrect of n; integer comparisons):
- C1 thirds: MOSTLY_CORRECT if 3k<n; MIXED if n≤3k≤2n; MOSTLY_INCORRECT if 3k>2n. At n=5: k0-1 / 2-3 / 4-5.
- C2 success-framed: HIGH_SUCCESS if 5k≤n (≤20% incorrect); MIXED if 5k>n and 2k<n; LOW_SUCCESS if 2k≥n (≥50%). At n=5: k0-1 / 2 / 3-5.
- C3 two-band: ON_TRACK if 2k<n; NEEDS_ATTENTION if 2k≥n. Least information, fewest boundary crossings, no "mixed".
Responder count: omit, or bucket (e.g. 5–9 / 10–19 / 20+; a bucket change reveals a response exists, not its correctness). Threshold 5 can stay if bands are used; raising the responder minimum (e.g. 8) shrinks boundary-flip exposure at the cost of empty output in small pilots.
Recommended pilot contract (thresholds NOT decided): Option C with C1, responder count bucketed, threshold unchanged, "refresh after the answering window" copy retained.
Decisions needed from the human: (1) A/B/C; (2) band system and exact boundaries; (3) responder count omitted vs bucketed (and buckets); (4) keep threshold 5 or raise; (5) accept residual boundary-crossing risk.

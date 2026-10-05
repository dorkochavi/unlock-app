# UNLOCK — Run Report: 2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001

Status: COMPLETE. START_HEAD `c584a07` (+ Plan-only commit `d5afb72`). Branch `main`, local only, NOT pushed.
HOSTED_MUTATION: NONE. PUSH: NONE. No migration created.

## 1. Slice A — Author → Learner self-enroll (`1f534c7`)
Finding: dual-role already supported (join path author-bypass for DRAFT/AUTHORIZED_ONLY, RUN010-H.3; FUB-036 resolved); gap was discoverability only. Added `OwnCourseActions` to the instructor course page: "לניהול הקורס" + "ללמוד את הקורס" (explicit POST to existing /api/courses/:id/join, then /courses/:id). No auto-enroll, no server change. Tests: new view/outcome tests; 86 targeted. No reviewer (UI-only over unchanged contract). Residuals: FUB-042 item 8 (idempotent POST for existing learner, no jsdom click test, no test asserting learner membership survives author revoke — independence is structural).

## 2. Slice B — Duplicate Topic names (`21d1f8e`)
App-level DUPLICATE_NAME guard on create and rename using the shared import normalizer (trim + case-insensitive); archived topics do not block; same-name/case-only rename allowed; API 409 + Hebrew message. General reviewer: no blocking. No migration: check-then-insert race remains; legacy duplicates untouched; a partial unique index would fail on existing duplicates. Human gate: Production pre-check + decision (OQ-049, FUB-053).

## 3. Slice C — Performance audit (no code)
Static only (no runtime timing exists; no Server-Timing/Vercel Analytics). Prior hosted evidence: Today p95 4.85s / Answer 3.18s at pool=5, 30 learners; cost is round trips, not SQL. Top 5: (1) cut Answer round trips Today/Practice P0; (2) confirm Vercel↔Supabase region (Dor) P0/P1; (3) Today repeat-open skip generation pre-reads P1; (4) Progress waterfall/N+1 P1; (5) Practice next-batch prefetch P1 (Skip optimistic advance needs product call). Proposed budgets and a P1–P6 Performance Run outline: FUB-026 addendum (PROPOSAL, not approved). Nothing implemented.

## 4. Slice D/E — Docs (`4a983ec`)
FUB-052 Pre-Pilot Modern Visual Experience (new); FUB-053 Topic race (WATCH); OQ-049 (3 questions); FUB-026 priority→MEDIUM, PROMOTE_NEXT candidate. WATCH: FUB-011, FUB-053. KEEP_DEFERRED: 047/048/049/050/051/009. Nothing OBSOLETE/SUPERSEDED.

## 5. Verification
Full unit: 171 files passed, 1 skipped; 2027 tests passed, 4 skipped. Typecheck clean; eslint src clean; `git diff --check` clean. Not run: build (worker ran a clean local build in C), browser E2E, schema/PGlite (no SQL touched), hosted anything.

## 6. Human actions
1. Decide OQ-049 (archived-name reuse; DB index vs lock vs accept race); Production duplicate pre-check if index wanted.
2. Confirm Vercel and Supabase regions match.
3. Decide whether to run the Performance Run (FUB-026) and approve/adjust budgets.
4. Decide FUB-052 visual refresh timing/scope.
5. Review and push when satisfied (human action).

## 7. Mechanism
Thin parent + 4 sequential fresh workers (A, B, C, D+E); isolation held; no compaction; no STOP events. KEEP.

# UNLOCK — PERFORMANCE-RUN-001 — Instrument → reduce round trips → remove blocking UX

PLAN_VERSION: 019
RUN_ID: 2026-10-06-PERFORMANCE-RUN-001
START_HEAD: `e261f65`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `4a983ec`
STATUS: **IN_PROGRESS** — long autonomous LOCAL Run. No push, no deploy, no hosted mutation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
UNLOCK should feel instant: reduce "time until the user can continue". Measure/prove structural waste → smallest correct change → verify → re-measure. Learning evidence integrity (Attempt immutability, idempotency, frozen Today, scheduler/evidence rules, authorization) is never traded for speed.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`. Owner of performance backlog: FUB-026 (do not duplicate; FUB-052 visual redesign OUT OF SCOPE; FUB-053 WATCH; OQ-049 closed).
Human-reported context: Vercel Function Region was changed (iad1 → Frankfurt-aligned) 2026-10-06; NOT deployed; post-region latency NOT measured.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Lightweight timing/instrumentation foundation (no vendor) | REVIEW_GATE | PENDING |
| B | Today repeat-open round-trip reduction | REVIEW_GATE | PENDING |
| C | Answer-path (Today + Practice) round-trip audit; one safe reduction or proposal | REVIEW_GATE | PENDING |
| D | Progress N+1 / waterfall | REVIEW_GATE | PENDING |
| E | Practice continuity / next-batch UX | REVIEW_GATE | PENDING |
| F | Proven-redundant client refreshes | AUTO | PENDING |
| G | Proposed budgets + Run close | FINAL_GATE | PENDING |

## 4. Current Status
Run started. Pushing/deploying are human actions.

## History

Reports are the archive:

- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- PILOT-CLOSURE-OVERNIGHT-001: `docs/RUNS/2026-10-05-PILOT-CLOSURE-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

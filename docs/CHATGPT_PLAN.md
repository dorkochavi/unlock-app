# UNLOCK — PERFORMANCE-RUN-001 — Instrument → reduce round trips → remove blocking UX

PLAN_VERSION: 019
RUN_ID: 2026-10-06-PERFORMANCE-RUN-001
START_HEAD: `e261f65`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `370d62b`
STATUS: **COMPLETE** — local Run. No push, no deploy, no hosted mutation. Human actions remain (Run report).

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
UNLOCK should feel instant: reduce "time until the user can continue". Measure/prove structural waste → smallest correct change → verify → re-measure. Learning evidence integrity (Attempt immutability, idempotency, frozen Today, scheduler/evidence rules, authorization) is never traded for speed.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`. Owner of performance backlog: FUB-026 (do not duplicate; FUB-052 visual redesign OUT OF SCOPE; FUB-053 WATCH; OQ-049 closed).
Human-reported context: Vercel Function Region was changed (iad1 → Frankfurt-aligned) 2026-10-06; NOT deployed; post-region latency NOT measured.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Lightweight timing/instrumentation foundation (no vendor) | REVIEW_GATE | DONE (`c247288`) |
| B | Today repeat-open round-trip reduction | REVIEW_GATE | DONE (`82a9069`) |
| C | Answer-path (Today + Practice) round-trip audit; one safe reduction or proposal | REVIEW_GATE | DONE (audit only; proposals in FUB-026) |
| D | Progress N+1 / waterfall | REVIEW_GATE | STOP (already parallel; see FUB-026) |
| E | Practice continuity / next-batch UX | REVIEW_GATE | DONE (`370d62b`) |
| F | Proven-redundant client refreshes | AUTO | STOP (unproven; kept) |
| G | Proposed budgets + Run close | FINAL_GATE | DONE |

## 4. Current Status
Run COMPLETE. Report: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`. Pushing/deploying are human actions.

## History

Reports are the archive:

- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- PILOT-CLOSURE-OVERNIGHT-001: `docs/RUNS/2026-10-05-PILOT-CLOSURE-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

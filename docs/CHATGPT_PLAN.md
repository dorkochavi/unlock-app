# UNLOCK — TODAY-LEARNING-RECAP-004 — Remove Today question checklist → evidence-based learning recap

PLAN_VERSION: 023
RUN_ID: 2026-10-07-TODAY-LEARNING-RECAP-004
START_HEAD: `64b3219`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `64b3219`
STATUS: **IN PROGRESS** — local Run. No push, no deploy, no hosted mutation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Human product decision (Dor): Today home must NOT show a question queue/checklist ("שאלה N", "הושלם"). Replace with orientation before/during Today and an evidence-based, conservative learning recap when Today is complete. Every learner-facing statement must be derivable from real existing evidence; no fabricated/AI insight; no new tables/migrations; no Today-repeat performance regression; frozen-Today/DailyPlan/Attempt/scheduler/Practice semantics untouched; Soft Premium Canvas visual language; no push/deploy/hosted mutation.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md` (api, auth, learning-engine, testing), ADR-016/017. Owner of Today UX: `docs/UX_SPEC.md`. Screens: `scratch/today-learning-recap-004/{before,after,comparison}`.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Evidence map (read-only inspection of Today data flow + Attempt evidence) | AUTO | PENDING |
| B | Recap derivation + (if needed) minimal derived response + queue removal + UI states + tests | REVIEW_GATE | PENDING |
| C | Screens, review, perf evidence, docs, verification, Run close | FINAL_GATE | PENDING |

## History

- TODAY-LEARNING-RECAP-004: (in progress)
- VISUAL-POLISH-RUN-003: `docs/RUNS/2026-10-07-VISUAL-POLISH-RUN-003.md`
- DESIGN-REFRESH-OVERNIGHT-002: `docs/RUNS/2026-10-07-DESIGN-REFRESH-OVERNIGHT-002.md`
- VISUAL-SYSTEM-RUN-001: `docs/RUNS/2026-10-06-VISUAL-SYSTEM-RUN-001.md`
- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

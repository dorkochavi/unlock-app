# UNLOCK — DESIGN-REFRESH-OVERNIGHT-002 — Market research → visual direction → visible redesign

PLAN_VERSION: 021
RUN_ID: 2026-10-07-DESIGN-REFRESH-OVERNIGHT-002
START_HEAD: `71801eb`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `71801eb`
STATUS: **IN PROGRESS** — local Run. No push, no deploy, no hosted mutation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Make UNLOCK visibly closer to a polished, modern, premium 2026 consumer learning product, building ON the VISUAL-SYSTEM-RUN-001 foundation (tokens, primitives, a11y, RTL). Evidence-driven: current-market research and reference snapshots → three directions → one chosen autonomously → real implementation → before/after snapshots → perf-safe verification.

Invariants: visual-only. No change to learning/Attempt/scheduler/frozen-Today/Practice-selection semantics, authorization, DB/migrations, IA/navigation routes, brand/logo identity. No new heavy UI/animation dependency; no server→client conversion for styling; prefers-reduced-motion respected; a11y foundation (44px targets, focus-visible, non-color cues, RTL logical props) preserved. No push, no deploy, no hosted mutation.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`. Backlog owner: FUB-052. Raw research and screenshots live in ignored `scratch/design-refresh-002/{before,inspiration,after,comparison}`.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Preview harness (fixture-rendered, uncommitted) + baseline screenshots | AUTO | PENDING |
| B | Market research + reference snapshots + synthesis | AUTO | PENDING |
| C | Three directions + autonomous choice; foundation (tokens/type/surfaces/primitives) | REVIEW_GATE | PENDING |
| D | Courses + shell/bottom nav | REVIEW_GATE | PENDING |
| E | Today home + question experience | REVIEW_GATE | PENDING |
| F | Practice + Progress | REVIEW_GATE | PENDING |
| G | Login/Join + Instructor course page | REVIEW_GATE | PENDING |
| H | States, dark mode pass, self-review pass, full verification, Run close | FINAL_GATE | PENDING |

## History

- VISUAL-SYSTEM-RUN-001: `docs/RUNS/2026-10-06-VISUAL-SYSTEM-RUN-001.md`
- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

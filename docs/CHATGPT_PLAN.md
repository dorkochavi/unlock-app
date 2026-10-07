# UNLOCK — Q3-A11Y-NIGHT-001 — Q3 Accessibility Hardening (bounded autonomous Run)

PLAN_VERSION: 024
RUN_ID: 2026-10-08-Q3-A11Y-NIGHT-001
START_HEAD: `0ac70d1`
RUN_STATUS: IN_PROGRESS
STATUS: **IN PROGRESS** — bounded autonomous Run N0 → N1 → N2 → N3 → STOP. Local only: no push/merge/deploy/tag/hosted mutation/migration/dependency change.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Two smallest-possible Q3 accessibility fixes from the Q3 Measure findings (no P0/P1; Q3 Pilot Gate: NO PILOT BLOCKER FOUND), then record truth and STOP:
- Q3-A: focused learner controls must not be obscured by sticky mobile UI (CSS-only `scroll-padding-bottom`, no layout shift, no JS).
- Q3-B: Instructor Question Editor option inputs / correct-answer controls get distinct accessible names (human-approved: `אפשרות {n}`, `סימון אפשרות {n} כתשובה נכונה`, 1-based current rendered order). No domain/persistence/learner change.

Out of scope (remain P3/WATCH/HUMAN): Q3-F3 headings, Q3-F4 small Instructor targets/placeholders, Q3-F5 Hebrew error/not-found pages, Q3-F6 new-tab hint, Q3-W1 learner radio/checkbox vs aria-pressed, Q3-W2 bidi. The "הסרה" button wording is unchanged. FUB-044 stays open / DEFERRED.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/autonomous-run/SKILL.md`. Browser evidence: run-local mocked probe under `scratch/q3-a11y-night-001/` (localhost only, `/api/**` mocked, every non-localhost request aborted; mocked-browser evidence only).

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| N0 | Run setup: Plan identity + run-local mocked browser probe | AUTO | DONE |
| N1 | Q3-A sticky focus clearance (CSS-only) | REVIEW_GATE | PENDING |
| N2 | Q3-B instructor option accessible names | REVIEW_GATE | PENDING |
| N3 | Governance + Run close | FINAL_GATE | PENDING |

## History

- TODAY-LEARNING-RECAP-004 (Plan body replaced at this Run open): `docs/RUNS/2026-10-07-TODAY-LEARNING-RECAP-004.md`
- TODAY-LEARNING-RECAP-004: `docs/RUNS/2026-10-07-TODAY-LEARNING-RECAP-004.md`
- VISUAL-POLISH-RUN-003: `docs/RUNS/2026-10-07-VISUAL-POLISH-RUN-003.md`
- DESIGN-REFRESH-OVERNIGHT-002: `docs/RUNS/2026-10-07-DESIGN-REFRESH-OVERNIGHT-002.md`
- VISUAL-SYSTEM-RUN-001: `docs/RUNS/2026-10-06-VISUAL-SYSTEM-RUN-001.md`
- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

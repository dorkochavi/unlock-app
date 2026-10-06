# UNLOCK — VISUAL-SYSTEM-RUN-001 — Audit → design-system foundation → controlled learner rollout

PLAN_VERSION: 020
RUN_ID: 2026-10-06-VISUAL-SYSTEM-RUN-001
START_HEAD: `27401cb`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `370d62b`
STATUS: **IN PROGRESS** — local Run. No push, no deploy, no hosted mutation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Make UNLOCK feel like one modern, calm, fast, RTL-native, accessible learning product: build a small reusable visual system (tokens + primitives) and apply it to the key learner journeys. Visual-only: no change to learning semantics, scheduler, Attempt, frozen Today, Practice selection, authorization, DB schema, IA/navigation, brand identity. No new UI/animation dependency. Speed is a product principle: no server→client component conversion for styling; respect prefers-reduced-motion.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`. Canonical owner of this work: FUB-052 (do not duplicate; no new design docs). Current UNLOCK identity is the brand base.
Human gates (STOP, do not decide alone): new brand/logo/primary-color change, icon family, font-brand, navigation/IA change, dashboard structure, removing information, gamification, illustrations, large motion, dark mode, instructor IA redesign.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Current UI audit (compact, P0/P1/P2) | AUTO | PENDING |
| B | Design token foundation (CSS vars / Tailwind v4 tokens, type scale, radius, controls) | REVIEW_GATE | PENDING |
| C | Shared primitives (only where repetition justifies) | REVIEW_GATE | PENDING |
| D | Global shell / navigation (within existing IA) | REVIEW_GATE | PENDING |
| E | Learner Courses | AUTO | PENDING |
| F | Today | REVIEW_GATE | PENDING |
| G | Practice | REVIEW_GATE | PENDING |
| H | Progress | AUTO | PENDING |
| I | Login / Join / Author→Learn | AUTO | PENDING |
| J | Loading/empty/error consistency + Run close | FINAL_GATE | PENDING |

## 4. Current Status
Run opened. Slice A next.

## History

Reports are the archive:

- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- PILOT-CLOSURE-OVERNIGHT-001: `docs/RUNS/2026-10-05-PILOT-CLOSURE-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

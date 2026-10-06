# UNLOCK — VISUAL-SYSTEM-RUN-001 — Audit → design-system foundation → controlled learner rolloutundefinedDONE (audit only; no commit) |undefinedDONE (`b43ebca`) |undefinedDONE (`9c00965`) |undefinedDONE (`ae4d110`) |undefinedDONE (`e0ce88c`) |undefinedDONE (`f50308e`) |undefinedDONE (`2e958a1`) |undefinedDONE (`b1d26e6`) |undefinedDONE (`8d57ea2`) |undefinedDONE (Run close commit; verification in Run report) |

PLAN_VERSION: 020
RUN_ID: 2026-10-06-VISUAL-SYSTEM-RUN-001
START_HEAD: `27401cb`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `8d57ea2`
STATUS: **COMPLETE** — local Run. No push, no deploy, no hosted mutation. Human visual walkthrough required before any push (Run report).

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Make UNLOCK feel like one modern, calm, fast, RTL-native, accessible learning product: build a small reusable visual system (tokens + primitives) and apply it to the key learner journeys. Visual-only: no change to learning semantics, scheduler, Attempt, frozen Today, Practice selection, authorization, DB schema, IA/navigation, brand identity. No new UI/animation dependency. Speed is a product principle: no server→client component conversion for styling; respect prefers-reduced-motion.

## 2. Authority / References
`CLAUDE.md`, `.claude/rules/*.md`. Canonical owner of this work: FUB-052 (do not duplicate; no new design docs). Current UNLOCK identity is the brand base.
Human gates (STOP, do not decide alone): new brand/logo/primary-color change, icon family, font-brand, navigation/IA change, dashboard structure, removing information, gamification, illustrations, large motion, dark mode, instructor IA redesign.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Current UI audit (compact, P0/P1/P2) | AUTO | DONE (audit only; no commit) |
| B | Design token foundation (CSS vars / Tailwind v4 tokens, type scale, radius, controls) | REVIEW_GATE | DONE (`b43ebca`) |
| C | Shared primitives (only where repetition justifies) | REVIEW_GATE | DONE (`9c00965`) |
| D | Global shell / navigation (within existing IA) | REVIEW_GATE | DONE (`ae4d110`) |
| E | Learner Courses | AUTO | DONE (`e0ce88c`) |
| F | Today | REVIEW_GATE | DONE (`f50308e`) |
| G | Practice | REVIEW_GATE | DONE (`2e958a1`) |
| H | Progress | AUTO | DONE (`b1d26e6`) |
| I | Login / Join / Author→Learn | AUTO | DONE (`8d57ea2`) |
| J | Loading/empty/error consistency + Run close | FINAL_GATE | DONE (Run close commit; verification in Run report) |

## 4. Current Status
Run complete locally. Foundation (tokens + primitives, `docs/UX_SPEC.md` §6) and learner rollout (Courses, Today, Practice, Progress, Login/Join/Author→Learn) done; full unit/typecheck/lint/build green. Human visual walkthrough and the open design decisions are pending (Run report; owner FUB-052). No push.

## History

Reports are the archive:

- VISUAL-SYSTEM-RUN-001: `docs/RUNS/2026-10-06-VISUAL-SYSTEM-RUN-001.md`
- PERFORMANCE-RUN-001: `docs/RUNS/2026-10-06-PERFORMANCE-RUN-001.md`
- PILOT-FRICTION-PERF-OVERNIGHT-001: `docs/RUNS/2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001.md`
- PILOT-CLOSURE-OVERNIGHT-001: `docs/RUNS/2026-10-05-PILOT-CLOSURE-OVERNIGHT-001.md`
- (earlier Runs: see `docs/RUNS/**`)

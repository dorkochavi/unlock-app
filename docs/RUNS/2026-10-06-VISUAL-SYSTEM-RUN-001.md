# Run Report — 2026-10-06-VISUAL-SYSTEM-RUN-001

Status: `COMPLETE` (local only; no push, deploy, or hosted mutation)

Baseline: `27401cb` (Plan-only commit `e23ed61`). Last code commit: `8d57ea2`. Owner: FUB-052.

## 1. Goal
Audit -> small visual system (tokens + primitives) -> controlled learner rollout. Visual-only: no learning semantics, IA,
brand, DB, auth or dependency change.

## 2. Audit summary (Slice A, read-only)
- P0: `ConfidenceChip` tap target ~32px on every Today/Practice question.
- P1 (15): no type scale / radius / control-height tokens; container width duplicated in 3 files; `--subtle` ~4.4:1 on
  surface-muted; disabled = bare opacity; Input shorter than Button; text-only loading vs one skeleton; StateBlock with no
  tone cue; ad-hoc error/notice paragraphs; physical `border-l-4` status accent in RTL; border overuse / flat hierarchy;
  raw buttons/inputs in instructor pages (out of scope).
- Human gates raised: typeface/`next/font`, sign-out/nav placement, dark toggle, `aria-pressed` -> radio, status cue.

## 3. Foundation decisions
- Tokens in `src/app/globals.css` (owner doc `docs/UX_SPEC.md` §6): radius roles, type roles (page/title/section/body/
  secondary/meta), control heights (44px), one `:focus-visible` ring, `state-disabled`, `page-container`, one raised shadow,
  `--subtle` darkened (>=5.0:1 on surface-muted, verified in Slice B).
- Primitives only where repetition justified: Notice, Field, LinkRow, ProgressBar, LearnHeader, icons; Button/Input/Card/
  StateBlock/Skeleton/PageHeader/StatusPill adjusted.
- Performance principle kept: no new dependency, no server->client conversion, short transitions only.

## 4. Rollout
| Slice | Commit | Result |
|---|---|---|
| A | none | audit |
| B | `b43ebca` | tokens |
| C | `9c00965` | primitives (+ tests) |
| D | `ae4d110` | shell: shared container, compact utility bar (className only) |
| E | `e0ce88c` | Courses + Course page: LinkRow, skeleton, logical `border-s` accent |
| F | `f50308e` | Today + shared question-card: 44px chip, incorrect-feedback icon, StateBlock tones |
| G | `2e958a1` | Practice: LearnHeader/ProgressBar, batch-complete cards, Notice; continuity untouched |
| H | `b1d26e6` | Progress: LinkRow cards, activity pill, skeleton; loader untouched |
| I | `8d57ea2` | Login / Join / Author->Learn presentational |
| J | close commit | final verification + docs |

## 5. Verification (Slice J, local)
- `git diff --check 27401cb..HEAD`: clean.
- `npm test` (full unit): 176 files passed, 1 skipped; 2092 tests passed, 4 skipped.
- `npm run typecheck`: pass. `npm run build`: pass (14 static pages; build prints no first-load JS sizes; not compared to START_HEAD).
- `npm run lint`: 0 errors, 1 warning (`.claude/telemetry/statusline.mjs` unused var, not in this Run's diff).
- Not run (no DB/auth change): schema/PGlite, e2e.
- Review: `unlock-reviewer` on C, E, F, G, H, I; no BLOCKER/CORRECTION outstanding (2 minor CORRECTIONS in C fixed). B (CSS tokens) and D (className-only) had no reviewer.

## 6. Mechanism evidence (performance / accessibility)
- `package.json` / `package-lock.json` unchanged (no dependency). No added `"use client"` and no `next/font`. Global
  `prefers-reduced-motion` rule still present. No new keyframes/animations; only short transitions.
- Concrete accessibility improvements (not a WCAG claim): ConfidenceChip 44px; global focus-visible ring; `--subtle`
  contrast raised; incorrect-feedback icon (not color alone); Notice with roles; Field label association; 44px inputs;
  legible disabled state; skeletons announced; logical `border-s` accent for RTL.

## 7. VISUAL_VERIFICATION (honest scope)
All learner screens were rendered with mocked API data in headless Chromium at 360/390/430/768/1280 with no horizontal
overflow; a subset of screenshots was viewed by the workers. Dark mode, real authenticated data, hover/focus states and the
Author->Learn button were NOT visually reviewed. Dor's human walkthrough is required before any push. No "looks good" claim.

## 8. Open human design decisions
1. Sign-out placement: PageHeader trailing slot / profile overflow in nav (IA change) / keep as is.
2. Typeface: keep Segoe-first system stack vs one Hebrew-first webfont via `next/font` (brand + perf tradeoff).
3. Dark mode: keep automatic `prefers-color-scheme` vs add a user toggle; verify dark contrast.

Deferred notes (not decisions): `aria-pressed` -> radio semantics; Course-card brand-tint hover (RUN010-I primary-soft) was
dropped. Other deferred polish lives in FUB-052.

## 9. Human actions
Visual walkthrough (light + dark, real data); decide the three items above; review; push/deploy only on Dor's decision.

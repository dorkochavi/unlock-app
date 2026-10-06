# Run Report — 2026-10-07-DESIGN-REFRESH-OVERNIGHT-002

Status: `COMPLETE` (local only; no push, deploy, hosted mutation, DB or auth change). Owner: FUB-052.
START_HEAD `71801eb`; Plan-open `9d651cd`; last code commit `34c74f0`. Raw research/screens (git-ignored): `scratch/design-refresh-002/{inspiration,before,after,comparison,harness}`.

## 1. Research (19 products, 37 snapshots; 12 viewed)
Index: `scratch/design-refresh-002/inspiration/INDEX.md`; synthesis: `SYNTHESIS.md`. Caveat: automation reached marketing pages only (cookie banners; quiz/feedback patterns come from embedded app mockups + knowledge of live apps); Quizlet/Calm/WHOOP blocked.

| Reference | Pattern | UNLOCK takeaway |
|---|---|---|
| Brilliant, Things, Linear, Mimo (brilliant.org, culturedcode.com/things, linear.app, mimo.org) | tinted page, cards one tone off, hairlines instead of borders | tinted canvas + raised surfaces, soft 2-layer shadow |
| Duolingo, Gizmo, Wolt, monday | full-width 48–56px rounded CTA, weaker secondary | 52px primary, tinted secondary |
| Gizmo, Duolingo | slim top progress, one question, big tappable options, sticky action | question bar + segmented progress, 56px option cards, sticky submit |
| Gizmo/Duolingo feedback | tinted bottom panel, short explanation + Continue | verdict + explanation panels with icon+text, Continue 52px |
| Headspace, Wolt, Bit | 20–24px radii, pill chips, heavy Hebrew display weight | radii 20/24, chips, Heebo 700–800 |
| Mimo, Khan | indigo reads premium as accent + deep hero | keep #4338ca anchor, deep-indigo hero |
| Things | calm daily list with remaining count | Today hero + queue |

Rejected: mascots, XP/streaks, confetti, saturated cartoon palettes (gamification gate).

## 2. Directions and choice
A Editorial Ink (typography-led, flat) / B Soft Premium Canvas / C Energetic Progress (gamified accents). Chosen **B** (`scratch/design-refresh-002/DIRECTIONS.md`): largest visible change at CSS-only cost, calm, keeps the indigo identity; borrows A's type-led hierarchy and a restrained form of C's progress emphasis.

## 3. Baseline problems (`before/BASELINE_NOTES.md`)
Generic white cards on white, flat type hierarchy, thin nav, floating sign-out, Today = one small card + dead space, radio-look options, clipped confidence chips, text-only Progress, bare Login/Join, dense Instructor page.

## 4. Implementation (commits)
- `bab5494` foundation: tinted canvas/surfaces/hero tokens (light+dark), Heebo, radii, shadows, primitives.
- `0b3f2f2` shell + Courses + Course detail: anchored utility header, floating pill bottom nav, library cards (initial tile, role chip), indigo course hero, topic rows with coverage bar. Copy change: LEARNER role chip "לומד/ת" (was blank). Also fixed a CSS bug (`*/` inside a comment silently dropped `chip`/`eyebrow` utilities under webpack).
- `bc286fd` Today hero home (date, N left, segmented progress, CTA), queue, done/empty/loading states; question experience: tactile 56px options with letter tiles, segmented confidence, sticky 52px submit + quiet Skip, verdict/explanation panels after the options (amber for wrong, never danger).
- `e7b6e19` Practice end-of-batch hero + stat chips (continuity untouched), segmented practice progress, Progress overview hero + course cards (existing data only).
- `17cb702` Login/Join (wordmark + raised card, join hero), Instructor course management (hero, grouped cards, danger zone, tidy question rows), instructor list.
- `34c74f0` polish: Card padding override fix, progress header chips, visible practice affordance on mobile.

## 5. Typography / accessibility / performance
Typography CHANGED: Heebo variable via next/font/google (hebrew 12KB + latin 30KB, swap, Segoe/Arial fallback); reversible. Accessibility preserved: 44px+ targets (inputs 48, CTAs 52), focus-visible, aria-pressed/labels kept, correct/incorrect = icon + text, logical props, reduced motion; new token text pairs checked AA light+dark in Slice C. Not a WCAG audit. Performance: 0 new dependencies, 0 server→client conversions, CSS-only, no images; +~42KB font.

## 6. Visual review
Harness: `node scratch/design-refresh-002/harness/shoot.mjs after` (Playwright with mocked `/api`, dev server). Reviewed at 390/360/1280, RTL, and dark for Today question/feedback, Courses, Progress, Practice, Login, Instructor. Honest weaknesses: desktop learner pages remain a ~720px centered column; Courses/Progress cards still fairly similar; indigo hero on every screen is dominant by design; Progress is a long scroll; Instructor management is still the most admin-like screen; dark primary chips have lower contrast than light (unmeasured); skeletons not exhaustively signed off.

## 7. Review
General reviewer on C–F and on G: no BLOCKER/CORRECTION. Optional notes handled in `34c74f0`. Open notes: Today queue shows question prompts before start (product-intent check); LEARNER chip copy.

## 8. Verification
Full `npm test` 176 files / 2089 passed, 4 skipped; typecheck clean; lint 0 errors (1 pre-existing warning in `.claude/telemetry/statusline.mjs`); `npm run build` passed (font fetched); `git diff --check` clean. Browser evidence = mocked-API screenshots only: NOT real authenticated hosted data, NOT a production build.

## 9. Mechanism
Thin parent + 7 fresh sequential workers (A and B ran concurrently: B was scratch-only) + 2 read-only reviewers; no STOP/ESCALATE events.

## 10. Open decisions for Dor (max 3)
1. Keep Heebo (vs the previous system stack) and the "לומד/ת" learner chip copy.
2. Today queue showing question prompts before start — keep or hide.
3. Desktop learner layout: keep the centered column or introduce a wider two-pane composition (IA-adjacent).

Hosted actions: NONE. Push: NONE.

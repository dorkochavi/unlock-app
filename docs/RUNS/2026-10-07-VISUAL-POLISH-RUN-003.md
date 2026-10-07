# Run Report — 2026-10-07-VISUAL-POLISH-RUN-003

Status: `COMPLETE` (local only; no push, deploy, hosted mutation, DB or auth change). Owner: FUB-052.
START_HEAD `f551706`; Plan-open `86ddc1b`. Polish of the accepted "Soft Premium Canvas" direction from Dor's human review. Screens (git-ignored): `scratch/visual-polish-003/{before,after,comparison}`; harness `scratch/visual-polish-003/harness/shoot.mjs`.

## Human findings addressed
| Finding | Result |
|---|---|
| Today question: sticky area vs content | Measured with Playwright at 360/390 (also 360x640), long Hebrew question + long options, before/after selection, feedback, light/dark: last content bottom 20px above the sticky bar, overlap=false. Real defects were a 40px blank strip under the bar (Learn-Mode `pb-10`) and a bulky bar; bar now ~73px and flush. Nav is not rendered in Learn Mode (no double stacking). Sticky kept (not cramped). iOS `env(safe-area-inset-bottom)` is applied but not verifiable in headless Chromium. |
| Feedback hierarchy | Option rows after answering: neutral surface + hairline + thin inline-start accent; icon + text labels kept (not color alone); verdict banner is the one saturated block, then explanation, then primary Continue. DOM order unchanged (no layout jump). |
| Progress too busy | Light tinted overview (one sentence, one bar, muted inline state counts); course section = title + one summary line + one bar; topic rows plain divided rows with quiet dot+text status; per-topic bar dropped (duplicated coverage text); no information removed. |
| Course detail hero tall | Hero 310px -> 257px at 390 (-17%); Practice 48px, Today 44px targets; copy kept. Topic list shared with Progress. |
| Instructor desktop | Management page at lg+: wider container (max-w-5xl/6xl, header widened by a path regex), main column (details, topics, questions) + secondary column (publish, share, join policy, danger zone); mobile stays single column; no handler/conditional/route change (reviewer verified). Sticky sidebar dropped after review (could trap bottom cards on short viewports). |
| Purple/hero overuse | Deep-indigo hero only on Today, Practice batch-complete, Course detail. New `surface-tint` / `Card variant="tint"` for Progress overview, Join ready card, Instructor header; quiet StatusPill; fewer purple labels. |
| Bottom nav | Kept. At 360–1280 last content clears nav by 40–70px; active state clear; no overflow in 45/45 light and 27/27 dark width checks. |
| Queue spoiler | Today queue (and done list) no longer shows question prompts: "שאלה N" + reason + next/status chip; no topic name (not in DTO; no new queries). |
| Typography | Heebo kept; build ships 5 woff2, 2 preloaded; mixed Hebrew/English renders correctly. |

## Dark mode
Today home/question/feedback, Progress, Practice, Courses, Course detail, Instructor viewed; no regressions. Contrast measured (WCAG): primary-soft-foreground on primary-soft 8.39 light / 10.09 dark; primary on primary-soft 6.68 / 5.47; primary on tint 6.94 / 6.28; muted on tint 6.50 / 7.60; state label text >=5.74 light, >=6.98 dark. All text pairs >= 4.5:1; no token change needed. Incorrect-feedback in dark was shot but not individually inspected.

## Performance guardrail
0 dependencies, 0 images, 0 server→client conversions (`instructor/layout.tsx` was already client; adds `usePathname`), Heebo unchanged. CSS/markup only.

## Review
General reviewer on the full diff (86ddc1b..c2496cf): no BLOCKER/CORRECTION. Optional note on sticky sidebar applied; indentation drift in the instructor page is cosmetic.

## Verification
Full `npm test` 176 files / 2089 passed, 4 skipped; typecheck clean; lint 0 errors (1 pre-existing warning, unused `normalizeSlashes`); `npm run build` passed (at `7b1e1e9`); `git diff --check` clean. After the last one-line className removal (sticky) typecheck, lint and instructor tests (34) were re-run; full test/build were not repeated (class-only change). Browser evidence = mocked-API Playwright screenshots on the dev server, not real authenticated data or a production build.

## Commits
`cb09c61`, `b431cb9` Today composition/queue/feedback; `e6f41cc`, `5145e35` Progress/detail/tint surfaces; `c2496cf` Instructor desktop; `7b1e1e9` topic-chip truncation fix; sticky removal; docs close.

## Remaining weaknesses
Instructor management at 360 truncates long topic names (ellipsis side in mixed scripts); Courses/Today/Course detail leave empty space below short content on wide desktop (intentional); iOS safe-area unverified; instructor question-editor page not restyled; Progress 1280 screenshots show duplicated fixtures.

Hosted actions: NONE. Push: NONE.

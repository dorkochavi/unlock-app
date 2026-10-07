# Run Report — 2026-10-07-TODAY-LEARNING-RECAP-004

Status: `COMPLETE` (local only; no push, deploy, hosted mutation, migration or schema change). Owner of Today UX: `docs/UX_SPEC.md` §2 (items 15, 15a). Visual backlog: FUB-052.
START_HEAD `64b3219`; Plan-open `e3a592c`. Scratch (git-ignored): `scratch/today-learning-recap-004/{EVIDENCE_MAP.md,before,after,comparison,harness}`.

## Product decision (Dor)
Today home never exposes its question queue/checklist. Removed the numbered "שאלה N" rows, reason/next/status chips and completed rows (not merely hidden). Replaced by orientation before starting, a "so far" line during, and an evidence-based recap when complete.

## Evidence map (summary; full table in `EVIDENCE_MAP.md`)
- Plan items store only status/timestamps; correctness exists only in `attempts.is_correct` (linked via `daily_plan_item_id`/`daily_plan_id`, one attempt per item application-enforced). Confidence persisted (UI sends only high/low/null). Topic is the question's CURRENT topic (nullable/archivable). Skip has no evidence. `actionType` is the frozen selection reason, not an outcome (NEW_LEARNING wrong = first exposure). Mastery/misconception have no before-snapshot, so "improved" cannot be claimed. Plan-level `status/startedAt/completedAt` are unused; completion is derived from item statuses.

## Recap model
- Before Today: hero + one orientation line from frozen reason counts ("בתוכנית היום: …"); omitted if empty. No prompts, numbers, topics.
- During: hero + "עד עכשיו: X מתוך Y נכונות" (only if Y>0).
- Complete: quiet tinted panel "סיכום הלמידה שלך היום": "X מתוך Y נכונות · עבדת על N נושאים"; "ענית נכון ב:" topics; "כדאי לחזור על:" topics; at most one confidence line; sections with no content omitted; topic lists capped at 3 + "ועוד N". Hero's done state and "לצפייה בהתקדמות" unchanged.

## Deterministic derivation (`src/application/dailyPlan/derive-learning-recap.ts`)
answered = plan items with an attempt (earliest row wins); skipped = skipped items (never wrong); correct/incorrect from `is_correct`; sureIncorrect = answered, confidence high, incorrect; sureCorrect = high + correct (shown only if >=2); null/low/medium count for neither. Topic groups only from answered items with non-null, non-archived topic names; strong = all answered in the topic correct; revisit = >=1 incorrect. Presentation-only, never persisted, never called mastery. Review-driven: heading reworded from "ענית נכון על הכול ב:" to the scoped "ענית נכון ב:" (a single correct answer must not read as "everything in the topic"). No claims of improvement/weakness/mastery; no AI text; closing "UNLOCK will use this" line omitted (not verified against ADRs).

## Data / performance
One new optional dependency `loadPlanAttempts(userId, planId)` in the Today GET handler: a single plain select (attempts left join questions left join topics, `user_id=$1 and daily_plan_id=$2`), authenticated user + own plan only, built after auth, run only once >=1 item is completed; failure is logged server-side and the recap omitted (Today still 200, nothing leaked). Optional additive `plan.learningRecap`; `getOrCreateDailyPlanForToday` and its pinned counts untouched. Statement counts (PGlite counter through the real handler/repos): not-started repeat open 4 (3 plan reads + content read, unchanged), after >=1 completed 5 (+1), skipped-only 4. Cold open unchanged. PGlite proves structure, not latency. New Server-Timing stage `recap`. Client: recap-only refresh through the existing GET /today after the last item resolves, on Learn Mode exit, and in the existing 409 path; latest-wins guard; recap cleared on refresh failure. Index note: `attempts.daily_plan_id` unindexed (query uses the `user_id` prefix of `attempts_replay_idx`); fine at pilot scale, growth watch only.

## Review
General reviewer: 1 CORRECTION (copy overclaim) — fixed (`259426b`), plus robustness notes (stale recap on failure, request race, aria association) — fixed. DB reviewer: no findings. Security reviewer: no findings (auth-before-privilege, user/plan scoping, no answer/PII leakage, no error leakage).

## Verification
Full `npm test` 180 files / 2128 passed, 4 skipped; `npm run test:schema` 39 files / 369 passed (at `cc4a2cd`; no SQL change after); typecheck clean; lint 0 errors (1 pre-existing warning); `npm run build` passed; `git diff --check` clean. Browser evidence: mocked-API Playwright screenshots (not real authenticated data/production build): before/after/comparison for not-started, in-progress, complete (390; complete also 1280 and dark).

## Commits
`dece737` recap read + derivation; `cc4a2cd` Today UI; `259426b` review fixes; docs close.

## Remaining
Rename of a topic later changes how past recaps display (current-topic semantics). During-progress line can be briefly stale until the exit refresh returns. Optional later hardening: partial index on `attempts(daily_plan_id)`, unique per `daily_plan_item_id`. Recap wording ("ענית נכון ב:" vs "חיזקת היום:") is a Hebrew-copy choice for Dor.

Hosted actions: NONE. Push: NONE.

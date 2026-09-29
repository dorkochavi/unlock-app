# Course / Topic Practice — Design Evidence (Run UX-02 P0.5–P0.7)

Status: DESIGN EVIDENCE for Run UX-02 (not an authority) — P0–P0.7 approved 2026-09-26
Load level: COLD

Authorities stay where they are: presentation → `docs/UX_SPEC.md` §10; session/Today invariants → ADR-020;
scheduling/selection policy → `docs/LEARNING_ENGINE.md` §39A. This file records WHY those texts say what they say:
the affordance map (P0.5), a bounded research pass (P0.6) and a selector simulation (P0.7). Where evidence changed a
proposal, the change is listed in §4.

---

## 1. P0.5 — Practice UX Architecture & Affordance Map

Inspected: the learner UI after Run UX-01 (`src/app/(learner)/**`, `src/components/**`, `docs/UX_SPEC.md`).

### 1.1 CTA hierarchy map (after UX-02)

| Surface | Primary (one, visually dominant) | Secondary | Tertiary | Practice affordance |
| --- | --- | --- | --- | --- |
| Today landing | "התחל ללמוד" / "המשך ללמוד" (exists) | — | "התנתקות" (header) | none — Today is system-selected |
| Today Learn Mode | "שליחה" → "המשך" (exists) | — | "דלג", "יציאה" (exist) | none |
| Today Complete | "המשך ללמוד" → `/courses` (exists, decided) | — | "לצפייה בהתקדמות" (exists) | none — never auto-starts Practice |
| My Courses | none (each card is one link, exists) | — | "ניהול קורסים כמרצה" (exists) | none on cards |
| Course page (LEARNER, eligible) | **"תרגול בקורס"** (NEW) | "לעבור להיום שלי" (exists) | — | Course Practice + Topic rows |
| Course Topic rows | — | — | **row link "תרגול ›"** (NEW) | Topic Practice |
| Progress | none (decided) | "לעבור להיום שלי" (exists) | Course heading links (exist) | Topic rows only |
| Progress Topic rows | — | — | **row link "תרגול ›"** (NEW) | Topic Practice |
| Practice Learn Mode | "שליחה" → "המשך" | — | "דלג" (NEW semantics, §1.4), "יציאה" | — |
| Practice batch end | **"עוד 10"** (only if more remain) | — | "חזרה לקורס" / "חזרה להתקדמות" (by origin) | — |
| Practice no-more-questions | none | "חזרה לקורס" / "חזרה להתקדמות" | — | — |
| Practice error / expired | "ניסיון נוסף" (error) / "מעבר להתחברות" (signed out) | — | "יציאה" | — |

### 1.2 Practice affordance matrix

| Surface | Label | Exists | Level | Placement & rationale | Mobile / desktop | Mode | Token / color | Icon | States | Keyboard / a11y | Destination | Back / exit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Course page | "תרגול בקורס" | new | Primary | Directly under the Course header, above the existing secondary "לעבור להיום שלי"; the Course is the learner-chosen scope, so this is the page's main action | Full width in the 2xl container on both | Browse | `bg-primary` / `text-primary-contrast` | none | Shown only when the Course context says `practiceAvailable: true` (NEW server-computed field: role LEARNER + active, non-archived membership + PUBLISHED Course — the existing context endpoint does NOT check Course status or membership archival, so the client cannot infer it). Otherwise the CTA is simply absent; the secondary Today link remains. No disabled variant | Native link, focus ring `outline-primary` | `/courses/:id/practice?from=course` | Browser back returns here |
| Course Topic row | "תרגול ›" inside the row | new | Tertiary (row link) | The whole row becomes ONE link (name, coverage, state pill, trailing "תרגול ›") — one affordance per row, no extra buttons | Row min-height ≥ 56 px; trailing text stays on the row at 375 px (pill + label fit; name wraps) | Browse | Row: `border-border` hover `bg-surface-muted`; label `text-primary`; pill keeps its state tone | chevron (functional, RTL-rotated) | Only when `practiceAvailable` and the row has `totalCount > 0`; rows render after Topics load (loading/error/empty lines unchanged) | Link with accessible name "תרגול בנושא {name}, {state}"; focus ring | `/courses/:id/practice?topic=:tid&from=course` | Back returns here |
| Progress Topic row | same as above | new | Tertiary (row link) | Same shared `TopicList` component → identical behavior on both pages | same | Browse | same | same | Only under a Course whose progress is `ready` (Progress already lists only PUBLISHED Courses with a non-archived, non-revoked LEARNER membership via `/api/courses/mine` + topic-progress); unavailable/error Courses show their text and no actions | same | `/courses/:id/practice?topic=:tid&from=progress` | Back returns to Progress |
| Course / Topic Practice start | (no button — the route loads) | new | — | Loading happens inside Learn Mode | same | Learn | `LoadingState` | none | loading → first question; timezone first-login handled as on Today; empty pool → no-more state; error → retry; 401 → signed-out with `next=` | Loading has `role=status` | — | "יציאה" → origin |
| Practice Learn Mode | "שליחה"/"המשך", "דלג", "יציאה" | reuse | P / T / T | Same `QuestionCard` and context bar as Today; context bar title = Course title or Topic name; "שאלה N מתוך M" for the batch | Sticky action bar on mobile, static on desktop | Learn (nav hidden) | same as Today | "יציאה" X | submit error inline red; answer 401 → "not saved"; 409 "no longer available" → moves on | Focus: prompt on each question, "המשך" after feedback, status region | — | "יציאה" → origin; browser back → origin |
| Practice batch end | "עוד 10" | new | Primary | Card: title "סיימת סבב תרגול", summary "ענית על X · דילגת על Y" (counts only, no score) | same | Learn | `bg-primary` | none | Primary shown only if the server says more remain; otherwise the no-more variant | Focus moves to the card title | next batch | tertiary "חזרה לקורס"/"חזרה להתקדמות" |
| No more questions | — | new | — | Neutral StateBlock: "אין כרגע עוד שאלות לתרגול כאן" / "חזרות נוספות יופיעו בתוכניות הלמידה הבאות." | same | Learn | neutral (not error) | none | at start or after a batch | `role=status` | — | secondary back to origin |

`from` is an explicit whitelisted value (`course` | `progress`), so Exit is deterministic and never depends on
browser history.

### 1.3 Required restructuring

- `TopicList` (shared by Course page and Progress) gains an optional per-row practice link; rows become one link
  each when enabled. No other structural change.
- Course page LEARNER block: primary "תרגול בקורס" is added ABOVE the existing secondary "לעבור להיום שלי"; the
  hint line under it is removed (the Topic list already explains itself).
- Progress: no page-level primary is added; the secondary Today link stays.
- New Learn-Mode-only route `/courses/[courseId]/practice`.
- Course context response (`GET /api/courses/:id/context`) gains a server-computed `practiceAvailable` boolean
  (inspection found it checks membership/revocation only, not Course status or membership archival). This is the
  only way the Course page can avoid rendering a Practice CTA that would lead to an unavailable state.

### 1.4 CTA overload and fake-functionality prevention

Intentionally absent, with reason:
- **Today landing / Today Learn Mode / Today Complete:** Today is the system-selected finite path; a Practice CTA
  there would compete with its one primary action and blur Today vs Practice. Today Complete keeps "המשך ללמוד" →
  `/courses` (decided).
- **My Courses cards:** a Practice button per card would put N equal buttons on one screen; the card link already
  leads to the Course page where Practice is the primary.
- **Bottom navigation:** no Practice tab (UX_SPEC item 2).
- **Progress page-level primary:** Progress is diagnosis; the action lives on each Topic row, where the diagnosis is.
- **Instructor / non-LEARNER roles, non-PUBLISHED Courses, revoked or archived memberships, archived Topics, Topics
  with no published Questions:** no Practice affordance is rendered at all — never a disabled or dead button.
- **Skip in Practice** (decision requested): adopt a tertiary "דלג" with Practice semantics — no Attempt, no
  Progress/FSRS change, never counted as incorrect, excluded for the rest of the current Practice run. Smallest safe
  implementation: client-held list of skipped Question ids for the current Practice run, sent as an exclusion hint
  when requesting "עוד 10"; the server treats it only as an extra filter (it can only narrow selection, never
  mutate state), so it needs no persistence and no write endpoint. After leaving the Practice route the list is
  gone, so a skipped Question may return in a later run (intended).

---

## 2. P0.6 — Bounded Product / Evidence Research

Evidence, not authority. Sources, with a source-quality label, at the end.

| Pattern observed | Fit for UNLOCK | Changes a proposal? |
| --- | --- | --- |
| Anki "review ahead" (filtered deck, reschedule on) gives early reviews a new delay scaled by how early they are; the manual warns it is "not appropriate for repeated use" because intervals come out shorter. Anki also offers a mode with rescheduling OFF ("preview"): cards return "exactly as they started". | Confirms the risk our rule targets: repeated early practice must not silently reshape schedules. Our rule is a hybrid: correct early answer ≈ preview (no reschedule), wrong early answer ≈ reschedule. | No change — supports §39A case 4 and case 3. |
| FSRS guidance: reviewing before retrievability drops "gives the model little signal"; FSRS-5/6 only apply a same-day heuristic. | Supports treating early correct answers as evidence, not a scheduler review. | No change. |
| Anki finished-deck screen ("Congratulations! You have finished this deck for now") then offers optional custom study. | Same shape as Today Complete → learner-chosen Course → Practice; UNLOCK deliberately does not auto-start. | No change (decision 7 kept). |
| Duolingo Practice Hub: a separate tab with a daily-refreshing, personalized session and a "Mistakes" mode. | Top-level tab and system-chosen daily session conflict with UNLOCK's model (Today is the system-selected path; Practice is learner-scoped). A "practise my mistakes" scope is a possible later idea. | No change; noted for later. |
| Quizlet Learn: study in rounds with a checkpoint between rounds. | Supports bounded batches with an explicit continue. | No change (10 + "עוד 10"). |
| Khan Academy: "I haven't learned this yet" lets a learner move on without penalty inside a practice/mastery challenge. | Strong analogue for a no-penalty skip in optional practice — especially relevant because Practice is the main path to unseen Questions (§3 F-A). | **Yes — adopt tertiary "דלג" in Practice** with no-evidence semantics (§1.4). |

---

## 3. P0.7 — Selector Simulation / Policy Proof

Method: scratch-only harness (`scratch/ux02/selector.sim.test.ts`, not committed product code). REAL code:
`applyAttemptToProgress` (evidence, mastery, lapse, misconception, retrieval qualification), `TsFsrsMemoryScheduler`,
`deriveIsSameLearningSession`, `generateNextBestActionCandidates`, `rankNextBestActionCandidates`,
`generateTodayPlan` and every `PRODUCTION_*` policy (Today `maxItems` 15). SIMULATED: the §39A early-correct rule
(scheduler wrapper returning the prior state) and the proposed selector (exclusions → ranked NBA → unseen → coverage).
Learner histories are replayed day by day; "today" = day 21, 08:00. Each Attempt's session = its day; confidence
is null (production did not capture confidence at design time; Run 010 now sends sure / not-sure).

Fixture — Course A: Topic T1 "זיכרון" A01–A08, Topic T2 "תפיסה" A09–A14, no Topic A15–A16; Course B: B01–B12
(one old correct answer each, all due).

| Q | History (day: result) | State on day 21 |
| --- | --- | --- |
| A01 | d0 ✓, d3 ✓, d10 ✓ (Today, early) | strengthening, due d49 |
| A02 | d2 ✓, d12 ✗ | unresolved lapse |
| A03 | d14 ✓ | due since d14 |
| A04 | d19 ✓ | due since d19 (see F-B) |
| A05, A06, A13, A14, A16 | — | unseen |
| A07 | d0 ✓, d3 ✓, d12 ✓ **Practice, early** | due d17 kept (without the rule: d57) |
| A08 | d0 ✓, d3 ✓, d12 ✗ **Practice, early** | pulled to d12, lapse |
| A09, A10, A15 | d9 / d11 / d13 ✓ | due |
| A11 | d4 ✓, d15 ✗ | unresolved lapse |
| A12 | d20 ✓ | due since d20 (see F-B) |

**Today's plan on day 21 (real planner, both Courses):** A02, A08, A11 (RELEARN_LAPSE, remediation) + B06, B12, B01,
B07, B02, B08, B03, B09, B04, B10, B05, B11 (REVIEW_DUE, most overdue first) — 15 items.

### Scenarios

**S1 — Course A Practice, Today generated but not yet answered (mixture + pending exclusions).** Excluded: A02, A08,
A11 (pending in Today).

| # | Q | Tier | Why |
| --- | --- | --- | --- |
| 1 | A09 | NBA / DUE_REVIEW | due d9, most overdue, R 0.77 |
| 2 | A10 | NBA / DUE_REVIEW | due d11, R 0.78 |
| 3 | A15 | NBA / DUE_REVIEW | due d13 (Topic-less — Course scope only) |
| 4 | A03 | NBA / DUE_REVIEW | due d14 |
| 5 | A07 | NBA / DUE_REVIEW (+STRENGTHEN) | due d17 — still due BECAUSE the early correct Practice answer did not postpone it |
| 6 | A04 | NBA / DUE_REVIEW | due d19 |
| 7 | A12 | NBA / DUE_REVIEW | due d20 |
| 8 | A01 | NBA / STRENGTHEN | not due (d49), strengthening |
| 9 | A05 | unseen | ADR-017 order |
| 10 | A06 | unseen | ADR-017 order |

Remainder: A13, A14, A16. Course A's due reviews did not fit Today (Course B's were more overdue) — Practice serves
them; the remediation items stay with Today.

**S2 — Course A after Today is completed (Today items already answered).** A02, A08, A11 are now excluded as
"answered this learning day" instead of "pending" — the batch is identical to S1. Completed Today items are never
re-served automatically on the same day.

**S3 — Topic T1 after Today completed (fewer than 10).** Excluded A02, A08. Batch: A03 (due), A07 (due), A04 (due),
A01 (strengthen), A05, A06 (unseen) — 6 questions, nothing remains → batch end shows no "עוד 10".

**S4 — Topic T2 after Today completed.** Excluded A11. Batch: A09, A10, A12 (due), A13, A14 (unseen) — 5 questions.
Topic-less A15/A16 appear in neither Topic (only in Course scope, S1).

**S5 — Course B Practice while Today pending.** All 12 B questions are pending in Today → empty pool → "no more
questions" state immediately (correct: Today already covers them).

**S6 — "עוד 10" after answering S2's batch.** Excluded: 13 questions answered this learning day. Batch: A13, A14,
A16 (unseen) — 3 questions, nothing remains.

**S7 — Empty pool.** After S6, every in-scope Question is excluded → "no more questions".

**S8 — Topic T1 with Skip.** Same as S3 with A05 skipped in the current run: A05 is excluded; A06 takes its place;
5 questions. No Attempt or state change for A05.

**Early-correct / early-wrong proof (A07, A08), real FSRS:**
- A07 early correct Practice on d12 (due d17): **with the rule** due stays d17, mastery evidence still updates
  (strengthening); **without the rule** due jumps to d57 (+40 days) — one early practice answer would have hidden
  the review for almost six weeks.
- A08 early wrong Practice on d12: due pulled from d17 to d12 and a lapse is recorded → it becomes a remediation
  item and was the #2 item in Today's plan. Rule 6 works through the existing engine.

### Findings

- **F-A — Practice is the main path to NEW material.** Today serves unseen Questions only when there are zero
  ordinary candidates (ADR-017); this learner has candidates, so Today never shows A05/A06/A13/A14/A16. In Practice
  they come after every NBA candidate, including not-due STRENGTHEN items (A01, R 0.97, due in four weeks). Kept as
  canonical for V1 (decision 3); recorded as an open policy question (§4, Q1).
- **F-B — "Due" includes barely-learned items.** With the current FSRS adapter a first correct answer schedules the
  next review minutes later (short-term learning steps), so A04 (answered d19) and A12 (answered yesterday) are
  REVIEW_DUE with R ≈ 0.95–1.00. Existing engine behavior that affects Today equally; not a Practice issue; recorded
  as an open calibration question (§4, Q2).
- **F-C — The misconception tier cannot fire in production.** Misconception state needs confident errors;
  production captures no confidence, so REPAIR_MISCONCEPTION is empty. Existing; no Practice change.
- **F-D — Today's 15-item cap makes Practice complementary, not duplicative.** Remediation and the most overdue
  reviews stay in Today; overflow reviews, strengthening and new material flow to Practice.
- **F-E — Small scopes exhaust fast.** Topic scopes produced 5–6 questions; the "no more questions" state and a
  server-provided `hasMore` are first-class UX, not edge cases.

---

## 4. What the evidence changed

1. **Skip in Practice: adopted** (was "no Skip") — tertiary "דלג", no Attempt/Progress/FSRS, excluded for the rest
   of the Practice run; client-held exclusion hint (§1.4). → UX_SPEC §10, §39A, Plan P2–P4.
2. **`hasMore` is required** so "עוד 10" is offered only when something remains. → §39A, Plan P2/P3.
3. **Scope label and origin (`from`)** are part of the Practice contract. → UX_SPEC §10, Plan P3/P4.
4. **Batch-end summary shows counts only** (answered, skipped), not correct counts or scores. → UX_SPEC §10.
4a. **`practiceAvailable` on the Course context** — found by inspection: without it the Course page would show a
   Practice CTA for DRAFT/ARCHIVED Courses or learner-archived memberships (dead CTA). → Plan P3/P4.
5. No change to ADR-020 invariants or to §39A scheduling cases — both were supported by the simulation and research.

Decisions on the open questions (2026-09-26):
- **Q1 — decided:** keep the canonical NBA ranking in V1; not-due strengthen/remediation candidates stay above
  unseen Questions in Practice. No Practice-specific ranking difference in Run UX-02.
- **Q2 — recorded:** `docs/OPEN_QUESTIONS.md` OQ-044 (CALIBRATION, open, non-blocking). Not solved in Run UX-02
  unless implementation shows a correctness bug rather than a tuning issue.

## Sources (P0.6)

Source quality: **[O]** official product documentation or the product's own blog; **[T]** technical write-up by an
algorithm contributor / open-source project documentation; **[C]** community forum or third-party secondary source
(weaker — used only to illustrate a pattern, never as sole support for a decision). The Skip decision rests on a
[C]-quoted Khan Academy pattern plus UNLOCK's own simulation (F-A), not on that source alone.

- [O] [Anki Manual — Filtered Decks](https://docs.ankiweb.net/filtered-decks.html)
- [C] [Anki Forums — Custom Study Review Ahead Intervals](https://forums.ankiweb.net/t/custom-study-review-ahead-intervals/57759)
- [T] [Expertium — A technical explanation of FSRS](https://expertium.github.io/Algorithm.html)
- [T] [open-spaced-repetition — fsrs4anki tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md)
- [C] [Anki Forums — "Congratulations! You have finished this deck for now"](https://forums.ankiweb.net/t/help-how-to-review-cards-continuously-every-day-or-anytime-i-want-when-anki-says-congratulations-you-have-finished-this-deck-for-now/61446)
- [O] [Duolingo Blog — Guide to the Practice Hub](https://blog.duolingo.com/guide-to-duolingo-practice-hub/)
- [C] [Duoplanet — Duolingo Practice Hub](https://duoplanet.com/duolingo-practice-hub/)
- [O] [Quizlet Help — Studying with Learn](https://help.quizlet.com/hc/en-us/articles/360030986971-Studying-with-Learn)
- [C] [Khan Academy (teacher page quoting "I haven't learned this yet")](https://sites.google.com/pvlearners.net/burgess/khan-academy)

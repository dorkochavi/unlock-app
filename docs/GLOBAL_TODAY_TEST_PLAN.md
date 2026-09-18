# Global Today — Test Plan (DRAFT / FUTURE SPECIFICATION)

Status: **SPECIFICATION ONLY.** This document describes what a future test
suite SHOULD assert once Global Today is implemented. It is not code, and
**no runtime test files are added to the repo in this session** — nothing
under `src/**/__tests__/` or `supabase/tests/` is created or modified by
this document. Global Today itself is not implemented
(`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`, "PRODUCT DIRECTION ACCEPTED ... NOT
YET AN ADR, NOT IMPLEMENTED"), so nothing here can be executed yet.

**Reconciliation note (post-decision):** Dor's product-owner review has
since accepted the `DailyPlan`/`DailyPlanItem` architecture (ADR-016,
Status: ACCEPTED — see `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s Option
A) and several product rules this plan was written before. Scenario 2.1's
"whatever that key turns out to be" is now `(user_id, planned_for_date)` on
`daily_plans`, per `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`. **One
scenario this plan is missing, flagged here rather than added as new test
prose (out of this reconciliation task's scope):** a test for the newly
accepted decision that a resolved `DailyPlanItem` (COMPLETED or SKIPPED)
must reject a second Today answer attempt as a conflict, not accept it as a
new normal Attempt (`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §6) — this
sits alongside 2.19's idempotency scenario but is a distinct rule (idempotent
retry of the *same* `submissionId` vs. a *new* `submissionId` against an
*already-resolved* item) that this plan did not anticipate. Scenario 2.10
("no Course floor/quota") remains accurate as written; it is not in tension
with the newly accepted tier-crossing requirement (decision #5), since that
requirement concerns severity escalation of a genuinely elevated-need
candidate, not floor/quota representation for a genuinely quiet Course.

This plan follows the project's existing testing conventions rather than
inventing new ones:

- **Framework**: Vitest (`docs/TESTING.md`).
- **Layer folders**: `src/domain/learning/__tests__/`,
  `src/application/learning/__tests__/`, `src/infrastructure/postgres/__tests__/`,
  `supabase/tests/postgres/*.test.ts` (PGlite-backed — a real, WASM-compiled
  single-connection Postgres engine, per `supabase/tests/postgres/db-harness.ts`
  and `docs/TESTING.md` §15), `supabase/tests/schema.integration.test.ts`
  (pure schema/constraint verification, also PGlite).
- **Testing pyramid** (`docs/TESTING.md` §2): many unit tests, fewer
  integration tests, a small number of E2E tests. Core learning logic
  testable without UI/network.
- **Golden-scenario style** (`docs/GOLDEN_SCENARIOS.md`): each significant
  learner-history behavior gets a named, product-language scenario tied to
  the exact test file(s) that would prove it — this plan follows that
  format for Global Today's own new rules, without touching the existing
  Golden Scenarios A–J (which remain the Course-scoped-Today record and are
  not superseded by this document).
- **Honesty framework for concurrency** (`docs/INVARIANT_MATRIX.md` rows
  18/20): PGlite is a real Postgres engine but a **single connection** — it
  can prove constraint/orchestration shape, but it structurally CANNOT
  prove two real concurrent transactions racing each other. That gap is
  already documented as "confirmed, not fixable with current architecture"
  for rows 18/20, and requires a genuinely separate multi-connection `pg`
  harness (`docs/REAL_POSTGRES_VERIFICATION_PLAN.md`) not available in this
  environment (no Docker/Supabase CLI). This plan reuses that exact
  classification for every Global Today scenario below, rather than
  overclaiming coverage.

---

## 1. Layer definitions used below

| Label | Meaning | Matches existing convention |
|---|---|---|
| **Domain** | Pure function test, no DB, no clock/randomness ambient, injected context | `src/domain/learning/__tests__/` |
| **Application** | Orchestration test against in-memory fakes (`in-memory-fakes.ts`-style), no real DB | `src/application/learning/__tests__/` |
| **Persistence (PGlite)** | Real single-connection Postgres (WASM), real migrations, real constraints — but single connection | `supabase/tests/postgres/*.test.ts`, `src/infrastructure/postgres/__tests__/` |
| **Real Postgres (multi-connection)** | Genuinely concurrent, two-or-more real `pg` client connections against a live Postgres instance | Not currently buildable in this repo/environment — `docs/REAL_POSTGRES_VERIFICATION_PLAN.md` |
| **API** | A route/DTO boundary test | Not yet buildable — `docs/API_V1_DRAFT.md` is unimplemented |
| **E2E** | Full-stack browser-driven flow | `docs/TESTING.md` §20 |

For each scenario below: **Provable today** = Domain/Application/
Persistence(PGlite) are sufficient. **Real-Postgres-only** = genuinely
requires multi-connection Postgres and cannot be honestly claimed proven by
PGlite or in-memory fakes, matching rows 18/20's own framework.

---

## 2. Scenarios

### 2.1 One Daily Plan per user per local day

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §5): exactly one plan exists
for a given user/local-day, however many Today views are opened.

**Test description**: Given no plan exists for day D, opening any Today
view creates exactly one plan. Opening a second view (or the same view
again) the same day does not create a second plan; it resumes the first.

- **Domain/Application**: a "get-or-create" orchestration test analogous to
  the existing `today-session.test.ts` "Today create race" test, adapted to
  Global Today's plan-identity key (whatever that key turns out to be, per
  the undecided architecture in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20).
- **Persistence (PGlite)**: insert-or-return-existing against the real
  unique constraint that would back this (analogous to the existing
  `today_sessions` `UNIQUE (user_id, course_id, planned_for_date)` pattern).
- **Provable today**: Yes, for the single-request orchestration and
  constraint shape.
- **Real-Postgres-only aspect**: whether TWO REAL concurrent first-opens
  (two devices, or a double-tap) can create two plans is the direct Global
  Today analogue of Invariant Matrix row 20 (`TodaySession` uniqueness
  race). **Confirmed real-Postgres-only**, same classification as row 20.

### 2.2 Global/Course shared completion (same underlying record)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3, §14, example in §19):
completing an item via Course Today is visible as completed via Global
Today, and vice versa — exactly one write.

**Test description**: Complete item X via the Course Today view's
completion path; then read the plan via the Global Today view's read path;
assert item X shows `completed` with the same identity/timestamp/
completing-Attempt reference as the Course-view write produced. Repeat
symmetrically (complete via Global, read via Course).

- **Domain**: N/A (no domain-level "view" concept expected).
- **Application**: primary layer — two different read/query entry points
  over one persisted item.
- **Persistence (PGlite)**: confirm no duplicate row/record is created by
  the two entry points, and there is exactly one completing Attempt
  referencing the item (mirrors the existing "no reverse pointer, one
  writer" discipline for `today_session_items`/`attempts`).
- **Provable today**: Yes.
- **Real-Postgres-only aspect**: none beyond the general write-race
  concern already covered generically in 2.15 below.

### 2.3 Manual Practice on a Today Question does not resolve the Today item

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §14, example in §19).

**Test description**: Question Q17 is a pending item in today's plan.
Learner submits a Manual Practice Attempt for Q17 (via the existing
`submitAnswer` path with `todaySessionItemId: null`, per the existing
`learningSessionId` ownership rules in Invariant Matrix rows 13/14).
Assert: (a) a new Attempt is created and learning state (mastery/progress)
updates exactly as any Attempt would; (b) the Today item for Q17 remains
`pending`; (c) Q17 may still be presented/resolved later inside Today.

- **Domain**: N/A.
- **Application**: primary layer — reuses the existing `submitAnswer`
  manual-practice path (already tested for `learningSessionId` ownership in
  `submit-answer.test.ts`); the new assertion is specifically that the
  Today item is untouched.
- **Persistence (PGlite)**: confirm the real FK/column state of the
  `today_session_items` row is unchanged after the Manual Practice Attempt
  commits.
- **Provable today**: Yes — this is a same-transaction-boundary,
  single-connection scenario.

### 2.4 Skip resolves the item but does not improve mastery

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §13): Skip is neither
COMPLETED learning nor scored INCORRECT; mastery must not update as if the
learner succeeded or failed.

**Test description**: Given a pending item with prior `UserQuestionProgress`
state, mark it skipped. Assert: (a) the item's `status` becomes `skipped`
with a `completed_at`-equivalent resolution timestamp; (b) NO Attempt is
created; (c) `UserQuestionProgress` (mastery category, evidence-quality
counters, misconception state, scheduler memory) is byte-for-byte unchanged
from before the skip.

- **Domain**: if a domain-level "resolve as skip" function is introduced,
  test it directly returns the item's next state without touching any
  progress/mastery type.
- **Application**: primary layer — assert no call reaches the
  mastery/progress update pipeline (`applyAttemptToProgress` et al. never
  invoked for a skip).
- **Persistence (PGlite)**: confirm `user_question_progress` row is
  unchanged (all columns) after a skip write commits.
- **Provable today**: Yes.

### 2.5 Skip does not trigger replenishment

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §13).

**Test description**: A 10-item plan; skip 3 items. Assert the plan still
has exactly 10 `today_session_items` rows — no new rows are inserted as a
result of the skip, and total item count is stable before/after.

- **Domain/Application**: assert the skip operation's own effect set is
  limited to the single skipped item's status — no planner/insert call is
  made as a side effect.
- **Persistence (PGlite)**: row-count assertion before/after.
- **Provable today**: Yes.

### 2.6 No automatic carry-over day to day

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §16, example in §19: 14
planned, 6 completed, 8 incomplete yesterday).

**Test description**: Given yesterday's plan with 8 unresolved
(`pending`) items at day rollover, generate today's plan fresh from current
learning state. Assert: (a) today's plan is NOT literally yesterday's 8
items reinserted; (b) today's plan is generated purely from current
ranking/need signals (may legitimately re-select some of the same
Questions if their need is still high, but via ranking, not via a
carry-over mechanism); (c) no code path reads yesterday's specific
unresolved item rows as an input to today's generation.

- **Domain**: the planner function itself should be provably ignorant of
  "yesterday's leftover items" as a concept — inspect its input signature/
  test with a fixture where a Question was left pending yesterday but has
  since dropped in need, and assert it is NOT force-included today.
- **Application**: orchestration test confirming plan generation is keyed
  only by `(user, local day)` and current state, never by a prior day's
  session id.
- **Persistence (PGlite)**: confirm two full sessions/plans exist as
  independent rows (no FK/reference from today's session to yesterday's).
- **Provable today**: Yes.

### 2.7 First-open generation (whichever view opens first creates the plan)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §5).

**Test description**: Two sub-scenarios: (a) Global Today opened first —
plan generated from Global's request; a subsequent Course Today open the
same day resumes the same plan, filtered to that Course. (b) Course Today
opened first — plan generated from Course's request; a subsequent Global
Today open the same day resumes the same plan, unfiltered.

- **Application**: primary layer — both orderings tested, asserting
  identical resulting plan identity/content regardless of which view
  triggered generation, and that generation uses learning state "at the
  moment of that first open" (inject a clock/state snapshot and confirm a
  LATER state change is not what the plan reflects).
- **Persistence (PGlite)**: confirm only one `today_sessions`-equivalent
  row set exists regardless of open order.
- **Provable today**: Yes, for sequential (non-racing) opens. The
  simultaneous-open race is covered by 2.1's real-Postgres-only note.

### 2.8 Exam-free Course still able to outrank a distant-exam Course

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §8, example in §19: Course Y,
no exam, `MISCONCEPTION_ACTIVE`, outranks Course X's routine review with a
40-day-distant exam).

**Test description**: A golden-scenario-style test (matching
`docs/GOLDEN_SCENARIOS.md`'s format): given Course X (exam 40 days out, one
routine `REVIEW_DUE` item, no misconception) and Course Y (no exam,
`MISCONCEPTION_ACTIVE`), assert Global Today's ranking places Y's item
strictly above X's.

- **Domain**: primary layer — a pure ranking-function unit/golden test,
  analogous to existing `next-best-action-ranking.ts` tests, using injected
  candidates from both Courses.
- **Application**: confirm the cross-Course candidate set reaching the
  ranking step actually includes both Courses' candidates (no per-Course
  filtering happens before ranking).
- **Provable today**: Yes — this is pure ranking-function logic, fully
  domain-testable with injected fixtures, once the ranking model itself
  exists (`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` — exact weights not yet
  decided, so this scenario's assertion is about ORDERING/precedence
  direction, not specific numeric scores).

### 2.9 80% of Today from one Course is allowed (not a bug)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §7, example in §19).

**Test description**: Given a candidate pool where 8 of 10 highest-ranked
items belong to Course A during a simulated midterm-week state, assert the
resulting plan is exactly those 10 (8 A / 2 B) with NO rebalancing,
quota-clipping, or artificial B-item promotion applied.

- **Domain**: primary layer — assert the ranking/selection function
  contains no per-Course cap/quota logic path at all (a negative test:
  confirm the function's output is the literal top-N by score, unmodified).
- **Provable today**: Yes.

### 2.10 No Course floor/quota

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §7: no per-Course quota, no
fairness balancing, no minimum representation, no maintenance floor).

**Test description**: Given a Course C with zero elevated-need signals
(nothing overdue, no misconception, no exam urgency), assert Global Today
produces ZERO items from C — not one "floor" item — matching the Course C
example in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §19 ("likely zero Course C
items today ... not a bug").

- **Domain**: primary layer — golden scenario asserting empty
  representation for a genuinely quiet Course is a valid, expected output,
  not filtered/patched afterward to inject a minimum item.
- **Provable today**: Yes.

### 2.11 New-material exposure is not counted as mastery

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9): initial exposure
questions are exposure, not proof of mastery.

**Test description**: After a small number of new-material exposure
questions are answered correctly, assert `UserQuestionProgress`'s mastery
category does NOT jump directly to `mastered`/a fully-confident state
purely from exposure-question volume — it must go through the same
evidence-strength/retrieval-qualification pipeline as any other Attempt
(no special-cased "exposure success ⇒ mastery" shortcut).

- **Domain**: primary layer — reuses existing mastery/evidence-strength
  domain tests' fixtures, adding an exposure-labeled Attempt sequence and
  asserting no divergent mastery-update code path is taken for it.
- **Provable today**: Partially — provable once "new-material exposure" is
  actually modeled as a distinct candidate type (`docs/NEW_MATERIAL_EXPOSURE_MODEL.md`
  — not yet implemented per `src/domain/learning/next-best-action.ts`'s own
  comment that `NEW_LEARNING`/`EXPAND_COVERAGE` are deliberately NOT
  implemented there yet). Until that model exists, this scenario can only
  be specified, not written.

### 2.12 Novelty budget (fewer new topics preferred)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §10).

**Test description**: Given multiple Courses each with an unseen new
topic, assert the plan prefers concentrating exposure in fewer topics with
several representative questions each, over touching many topics with one
question each. Exact numeric budget not decided
(`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20), so the test should assert the
qualitative preference direction (comparative, not an exact count) —
e.g., given topics T1..T5 all equally new, the plan should not include a
single question from all 5.

- **Domain**: primary layer, once `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`'s
  novelty-budget mechanism exists.
- **Provable today**: No — not implementable as a concrete assertion until
  the novelty-budget mechanism is designed/built; specified here as a
  placeholder shape only.

### 2.13 Significant-event adaptation (bounded, future-items-only)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12).

**Test description**: Mid-session, a candidate significant event occurs
(e.g., confident wrong answer on an unattempted Question). Assert: (a) a
small, bounded number of future (`pending`) items are replaced/inserted;
(b) already-`completed` items are byte-for-byte unchanged; (c) no full
replan occurs (item count growth is bounded, not proportional to unrelated
material); (d) an adaptation record is created (per
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md` §2.d/§4's append-only
recommendation) capturing the trigger and the pre-adaptation state of any
replaced item, rather than the replaced item's original content being
silently lost.

- **Domain**: primary layer for the "which future items get replaced"
  selection logic, once `docs/TODAY_ADAPTATION_MODEL.md`'s thresholds
  exist.
- **Application**: orchestration test confirming completed items are never
  passed to whatever function performs the mutation.
- **Persistence (PGlite)**: confirm the append-only shape — assert the
  original item's row still exists/is queryable (superseded, not deleted)
  and a new adaptation-record row references it, per §2.d's design
  constraint.
- **Provable today**: No — blocked on `docs/TODAY_ADAPTATION_MODEL.md`'s
  thresholds and the actual adaptation-record schema not existing yet;
  specified here as the shape a future test must take, with the
  append-only persistence assertion flagged as the most important part not
  to skip once it is buildable.

### 2.14 Frozen plan (completed items never change)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §11) — extends the existing
per-Course freeze model (Invariant Matrix row 21) to Global Today.

**Test description**: After an item is completed, assert its frozen
plan-shape fields (`position`, `action_type`, `tier`,
`other_applicable_types`, `reasons`, `question_version_id`) are identical
before and after any subsequent event in the same session (including a
significant-event adaptation elsewhere in the plan, per §12's "future items
only" boundary).

- **Application/Persistence (PGlite)**: directly analogous to the existing
  `today-session.test.ts` "pure read... unchanged" test and Invariant
  Matrix row 21 — extend the same test shape to cover a completed item
  specifically surviving an adaptation event elsewhere in the same plan
  (row 21's own gap note already flags "state change injected in between"
  as untested for the single-Course case; Global Today's adaptation
  feature makes this gap more load-bearing, not less).
- **Provable today**: Yes for the read-after-write shape; the
  adaptation-survives case is blocked on 2.13's same dependency.

### 2.15 Real finish line (COMPLETED+SKIPPED = all items → done)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §13, example in §19: 7
completed + 3 skipped = 10 resolved = "Done for today").

**Test description**: Given a plan where every item's status is either
`completed` or `skipped`, assert a "done for today" read/derived value is
true; given any single `pending` item remains, assert it is false. No
separate "isDone" column needed — reconstructable per
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md` §2.b.

- **Domain**: primary layer — a pure `isPlanResolved(items)` function
  test, boundary cases: 0 items (edge case — must not read as trivially
  "done" if the plan legitimately has zero items, e.g. a quiet-day Global
  Today per 2.10 — this boundary needs explicit product confirmation, not
  assumed by this test plan).
- **Provable today**: Yes for the pure function; the zero-item boundary
  behavior itself is a product-definition gap this test plan surfaces but
  does not resolve.

### 2.16 Archived Course excluded from automatic Global Today

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §17, ADR-015).

**Test description**: Given a `CourseMembership` with `archivedAt != null`,
assert none of that Course's Questions are included as Global Today
candidates during automatic plan generation, while the Course remains
independently reachable via Manual Practice (a separate, unaffected code
path).

- **Domain/Application**: primary layer — candidate-gathering step must
  filter on `archivedAt IS NULL` (and non-revoked, per ADR-015) before
  candidates ever reach ranking; test with one archived + one active
  Course, assert the archived Course contributes zero candidates.
- **Persistence (PGlite)**: confirm the real query used for candidate
  gathering actually applies this filter against real `course_memberships`
  rows (not just an in-memory fake's filter logic).
- **Provable today**: Yes, once the candidate-gathering query exists.

### 2.17 Midnight continuation (active session not interrupted at exactly 00:00)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §15, example in §19: session
started 23:50, still active at 00:05).

**Test description**: With an injected clock, start a session at 23:50 day
D; simulate continued activity (e.g., resolving an item) at 00:05 day D+1
within the "same active session"; assert the item resolves against day D's
plan, not a newly generated D+1 plan, and no D+1 plan is silently created
mid-session as a side effect of that resolution.

- **Domain/Application**: primary layer, once the session-continuation
  boundary mechanic is decided (`docs/TODAY_TIMEZONE_EDGE_CASES.md` —
  explicitly "analyzed, not decided" per the product spec §15). This
  scenario can be specified now but not made concrete until that mechanic
  (e.g., a session-liveness window, or explicit continuation token) exists.
- **Provable today**: No — blocked on `docs/TODAY_TIMEZONE_EDGE_CASES.md`'s
  undecided continuation mechanics; specified as a placeholder shape.

### 2.18 Reopening after midnight gets the new day's plan

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §15).

**Test description**: With an injected clock, no active session from day D
is open; the learner opens Today fresh at 00:05 day D+1; assert a new plan
for D+1 is generated (or, if one already exists from an earlier D+1 open,
resumed) — day D's plan is not returned.

- **Domain/Application**: primary layer — this is the "no active session"
  counterpart to 2.17, and does NOT depend on the undecided continuation
  mechanics (it's the simpler, already-fully-specified half of §15).
- **Provable today**: Yes.

### 2.19 Retry/idempotency (no duplicate Attempts, no duplicate adaptation from a retried submission)

**Rule**: extends the existing idempotency model (ADR-010, `submitAnswer`'s
`(user_id, submission_id)` key) to Global Today's completion/skip/
adaptation paths.

**Test description**: (a) Submitting the same completion/skip command
twice (same idempotency key) produces exactly one resolved-item state
change and exactly one Attempt (for completion) — the second call returns
the same result without creating a duplicate. (b) If a significant event
that would trigger adaptation is retried under the same idempotency key,
assert exactly one `today_plan_adaptations` row is created, not two.

- **Application**: primary layer — directly extends the existing
  `submit-answer.test.ts` idempotent-retry test pattern to the new
  skip/adaptation code paths.
- **Persistence (PGlite)**: confirm the real unique constraint
  (`UNIQUE (user_id, submission_id)`-equivalent) actually rejects/collapses
  the duplicate at the DB level, not just in application logic.
- **Provable today**: Yes for sequential retries. **Real-Postgres-only**
  for the case of two genuinely concurrent retries of the same idempotency
  key racing each other — same class of gap as Invariant Matrix row 18
  (advisory-lock serialization), since the existing in-memory fakes cannot
  interleave two "simultaneous" calls.

### 2.20 History durability (adaptation/skip events survive and are queryable later)

**Rule** (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §18).

**Test description**: After a session with a mix of completed, skipped,
and adapted items is fully resolved, assert that ALL of §1's required
history questions (recommended/completed/skipped/incomplete, Courses
represented and order, adaptations and why, start/completion times,
resolution rate) can be answered by querying persisted state alone, with
no dependency on in-memory/application-runtime state that would be lost on
process restart.

- **Persistence (PGlite)**: primary layer — seed a full session's worth of
  rows (including adaptation records per §2.d), restart the query context
  (new connection against the same PGlite instance, or equivalent), and
  assert every §1 question is answerable purely from SQL against the
  seeded rows.
- **Provable today**: Yes, once the `today_plan_adaptations` (or equivalent)
  schema exists — this is precisely a durability/query test, not a
  concurrency test, so PGlite's single-connection limitation does not
  apply here.

---

## 3. API and E2E layers

Per `docs/API_V1_DRAFT.md`, no API route exists yet for Today (Global or
Course), and per `docs/TESTING.md` §20, E2E tests are reserved for a small
number of critical full-stack flows. Both layers are listed here for
completeness of the layer taxonomy the prompt asked for, but neither has
concrete scenarios to specify yet beyond restating the domain/application
scenarios above through a thin, not-yet-built boundary:

- **API**: once a Today route exists, every scenario above that mentions
  "submitting a command" should be re-verified at the DTO boundary
  specifically for the existing project-wide rule that `userId` must come
  from the authenticated principal, never client-supplied request data
  (CLAUDE.md §6) — this applies identically to Global Today's future route
  as it does to any other.
- **E2E**: at most one or two critical flows once UI exists (e.g., "open
  Global Today, complete all items, see Done" and "skip an item, see it
  resolved without replenishment") — not a substitute for the
  domain/application/persistence coverage above, per the testing pyramid.

---

## 4. Real-Postgres-only summary

Matching `docs/INVARIANT_MATRIX.md`'s own "Summary of confirmed real gaps"
framing, the scenarios above that are genuinely NOT provable with PGlite or
in-memory fakes, and require a real multi-connection Postgres harness
(`docs/REAL_POSTGRES_VERIFICATION_PLAN.md`, not available in this
environment):

1. **2.1** — two simultaneous first-opens racing plan creation (direct
   Global Today analogue of Invariant Matrix row 20).
2. **2.19 (concurrent case only)** — two simultaneous retries of the same
   idempotency key racing each other (direct analogue of row 18).

Every other scenario in §2 is classified as provable today (fully or
partially, with dependencies on not-yet-built mechanisms noted per
scenario) using Domain/Application/Persistence(PGlite) tests, following
this project's existing honesty framework rather than claiming broader
coverage than the architecture can actually support.

---

## 5. Explicit restatement

This is a **future test specification**. No test files are added to
`src/**/__tests__/`, `supabase/tests/`, or anywhere else in this repo as
part of producing this document. Every scenario above is blocked, in whole
or in part, on Global Today's own not-yet-decided design pieces (the
priority model's weights, the adaptation model's thresholds, the
persistence architecture, the timezone/continuation mechanics) — this
document specifies what a test SHOULD assert once those pieces exist, it
does not build any of them.

## Related documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
- `docs/TODAY_HISTORY_ANALYTICS_PLAN.md`
- `docs/TESTING.md`, `docs/GOLDEN_SCENARIOS.md`, `docs/INVARIANT_MATRIX.md`
- `docs/REAL_POSTGRES_VERIFICATION_PLAN.md`
- `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`, `docs/TODAY_ADAPTATION_MODEL.md`,
  `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`, `docs/TODAY_TIMEZONE_EDGE_CASES.md`
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (ADR-010),
  `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  (ADR-015)
- `src/domain/learning/next-best-action.ts`

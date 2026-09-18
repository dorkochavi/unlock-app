# Global Today — Implementation Slices

Status: **ANALYSIS ONLY — NOT AN IMPLEMENTATION PLAN COMMITMENT, NOT
SEQUENCED APPROVAL BEYOND THE ORDERING ITSELF.** No code in this document
is authorized by writing it. This document has been reordered (2026-09-19)
to reflect the now-ACCEPTED `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016) and the accepted Ruppin demo strategy
(`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7, ADR-016 §20). The original
per-slice analysis below (files affected, tests needed, rollback risk) is
left intact as reference — only the **ordering** and the **architecture
premise** are updated by this revision; see "Accepted sequencing," below.

This document slices the accepted `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` /
ADR-016 direction into small, reversible engineering units, each grounded
in the real files this session found under `src/domain/learning/`,
`src/application/learning/`, `src/infrastructure/postgres/`, and
`supabase/migrations/`.

**Architecture premise is now decided, not provisional.** ADR-016 §1
accepts **Option A** (own `DailyPlan`/`DailyPlanItem` entity, Course Today
as a filtered view) as the target architecture — this was open when the
slices below were first drafted; it is no longer open. Slice 3's "shape
depends on option chosen" language, below, should now be read as "shape
follows Option A specifically," not as a still-open menu. No migration has
been written yet; this document does not authorize writing one.

Blocking status in each slice cites `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`
by name for anything that document was expected to resolve — that document
is now RESOLVED (all 9 items accepted 2026-09-19); read each "Blocked on
Dor" note below as historical (what was blocking) rather than current
(nothing in the 9 decisions is still blocking).

---

## Accepted sequencing (Ruppin strategy) — read this before the slice list

Per the accepted decisions (ADR-016 §20, resolving
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7), the implementation plan is
reordered into three phases. This supersedes any implied ordering from the
"Summary ordering table" at the bottom of this document where the two
disagree — the phases below are authoritative.

**Phase 1 — Correct DailyPlan foundation + single-Course vertical slice
(build this first, unconditionally).** The goal is a real, usable,
single-Course Today built directly on the `DailyPlan`/`DailyPlanItem`
architecture from day one — never a Course-only architecture that would
later need to be thrown away. This phase includes, in roughly this order:
- **Slice 3** (Global Daily Plan persistence schema) — but scoped down: the
  migration only needs to stand up `DailyPlan`/`DailyPlanItem` for a
  **single Course's items at a time**; it does not need multi-Course
  candidate merging to exist yet. This is now unblocked on "which option" —
  Option A is decided — but remains blocked on the production composition
  root (see "Learning Engine production-composition blocker," below) and
  on ADR-015's `CourseMembership` migration for real Course/membership
  data to generate a plan against.
- **Slice 0** (Skip semantics) — ports directly onto `DailyPlanItem`
  instead of `TodaySessionItem`; otherwise unchanged, and remains shippable
  independently.
- **Slice 6** (Manual Practice confirm/harden) — unchanged; confirm the
  existing `todaySessionItemId === null` separation holds identically for
  `DailyPlanItem`.
- The single-use resolution rule (ADR-016 §19: a resolved `DailyPlanItem`
  rejects a second Today answer attempt as a conflict) — not separately
  sliced in the original document; add it to Slice 3's acceptance criteria
  now that it is decided, rather than treating it as a later slice.
- Real usable UI, Auth, CourseMembership, QR join — tracked elsewhere
  (outside this document's scope; ADR-015 and the Ruppin demo plan cover
  these), but are part of Phase 1's demo-readiness bar per ADR-016 §20.

**Phase 2 — Usable Ruppin flow.** Once Phase 1's single-Course vertical
slice is real and demoable end-to-end (generate → present → answer →
skip → complete → "done for today" → persisted history), harden it for the
actual pilot: real Course content, real learners, real CourseMembership
data, and whatever UI polish the demo needs. Multi-Course Global Today
work does not start here.

**Phase 3 — Multi-Course Global behavior, if time permits / immediately
after the demo.** Slices 1, 2, 4, 5, 7 (cross-Course candidate pool,
double-count guard, first-open orchestration, Global read view, archive
exclusion) belong here. None of this is a hard demo requirement. Because
Phase 1 was built directly on the `DailyPlan`/`DailyPlanItem` architecture,
this phase is additive work on the same foundation, not a rebuild.

**Not phased — ongoing/deferred regardless of demo timing:** Slice 8
(significant-event adaptation) remains the hardest, most heavily blocked
slice (now further scoped by ADR-016 §4 to Today-sourced Attempts only,
which removes one axis of ambiguity but not the others) and Slice 9
(timezone handling) remains blocked on `docs/OPEN_QUESTIONS.md` #35. Neither
is required for Phase 1 or Phase 2.

## First recommended implementation slice, concretely

**The exact next slice is a scoped-down Slice 3: a `daily_plans` /
`daily_plan_items` migration and repository sized for single-Course
generation only**, done in parallel with (or immediately followed by) Slice
0 (skip semantics, ported to `DailyPlanItem`). Do this before Slice 1
(cross-Course pooling) — Slice 1's multi-Course scaffolding has no user
visible until Phase 3, while a real single-Course `DailyPlan` unblocks
Phase 1's entire vertical slice, including the demo-critical Skip and
Manual Practice confirmation work. This slice is itself blocked on two
prerequisites that are not Global-Today-specific and must land first
(see below).

## Learning Engine production-composition blocker

Per `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (audit only, not
solved here): **no production composition root exists anywhere in `src/`,
and no policy/config object (`TodayPlannerPolicy`, `MasteryPolicy`,
`MisconceptionPolicy`, `EvidenceStrengthPolicy`,
`RetrievalQualificationPolicy`) has a production default.** This blocks
Phase 1 independently of everything else in this document — even a
single-Course `DailyPlan` cannot be generated end-to-end without concrete
values for these policies, because `getOrCreateTodaySession`'s
DailyPlan-based successor still requires a `TodaySessionContext`-equivalent
built from real policy values, not test-only literals.

This blocker must be resolved **before** Phase 1's vertical slice can run
against real data (it can remain unresolved while Slice 3's schema/
repository work proceeds, since that work does not itself require running
the engine end-to-end). Resolving it requires separating three distinct
kinds of work, per the audit's own classification (§7) — **this document
does not invent any of the following values**:

- **Product decisions** (must come from Dor, not engineering): `MasteryPolicy`
  (what "mastered" means to a learner), `MisconceptionPolicy` (when a
  misconception is surfaced), `TodayPlannerPolicy.maxItems`-equivalent
  sizing bounds (superseded by ADR-016 §5's dynamic-size model, but the
  model's own bounds are still undecided).
- **Conservative engineering defaults** (engineering may propose a
  starting value, but per the audit it must be flagged as provisional and
  reviewed, not shipped silently): `RetrievalQualificationPolicy.minGapMsForSpacedRetrieval`,
  `EvidenceStrengthPolicy`'s attempt-count/span thresholds.
- **Later calibration** (safe to pick conservatively now and revise): exact
  numeric weights within the priority/adaptation/plan-size models already
  flagged as open throughout ADR-016 (§5/§10 tier-crossing weights, §4
  adaptation thresholds, §5 plan-size bounds, §14 novelty limits).

A composition root (wherever it eventually lives — likely
`src/infrastructure/` or a new `src/app/` route-adjacent module) must be
built once these values exist. Building the composition root's *code shape*
does not itself require the values to be final — it can be built now with
explicitly-provisional values sourced from the "conservative engineering
defaults" category above, clearly marked as such, while the "product
decisions" category is separately tracked as a Dor-blocking prerequisite,
not invented.

---

## Slice 0 — Skip semantics (Course-scoped Today) — **can ship independently, today, with zero Global Today architecture decided**

This is the one slice in this document that is not actually about Global
Today at all — it closes a gap in the *existing*, already-shipped
Course-scoped Today (ADR-011), and does not depend on ADR-016 being
accepted, on the persistence-architecture question, or on any other slice
below. It is listed first because it is real, immediately valuable, and
completely decoupled from everything else in this document.

**What already exists.** `TodaySessionItem.status` is already typed as
`"pending" | "completed" | "skipped"` in
`src/application/learning/ports.ts` (line 170), the Postgres CHECK
constraint on `today_session_items.status` already allows `'skipped'`
(`supabase/migrations/20260917203000_initial_schema.sql`, line 260), and
`src/infrastructure/postgres/today-session-mapper.ts` /
`today-session-repository.ts` both already list `"skipped"` in their status
enums. **No code anywhere writes that value.** There is a
`TodaySessionRepository.markItemCompleted` method
(`src/application/learning/ports.ts`, implemented in
`src/infrastructure/postgres/today-session-repository.ts`); there is no
`markItemSkipped`. `src/domain/learning/answer.ts` (lines 78–86) already
notes "skip is tracked on `TodaySessionItem.status`, not a null Attempt" as
a designed-for future state.

**Prerequisites.**
- Other slices: none.
- Product decisions already settled (do not re-derive): ADR-016 §7 / product
  spec §13 — Skip is RESOLVED-but-not-completed/-not-incorrect, mastery is
  not touched, it does not reappear in the same plan, it is persisted, and
  it never triggers replenishment.
- Blocked on Dor: nothing, to ship the mechanism itself. **Explicitly NOT
  in scope for this slice**: "repeated skipping may become a future
  behavioral signal" (product spec §13, ADR-016 "Explicitly deferred") is
  policy Dor has not decided — this slice only persists skip events; it
  must not invent a skip-count threshold or any consequence of repeated
  skipping.
- Blocked on other engineering work: none.

**Files likely affected.**
- `src/application/learning/ports.ts` — add `markItemSkipped(itemId, skippedAt): Promise<void>` (or a single `resolveItem(itemId, { status, resolvedAt })`-style method — naming is an implementation choice, not a product one) to `TodaySessionRepository`.
- New `src/application/learning/skip-today-item.ts` — a small application use case mirroring `submit-answer.ts`'s ownership-check style but far simpler: no advisory lock is needed (this never reads or writes `UserQuestionProgress`/`Attempt`, so ADR-010's locking discipline does not apply), no grading, no idempotency-key model beyond "this item is no longer pending." Should return a typed result distinguishing success from "item not found / not owned by this user" and "item is no longer pending" (see Acceptance Criteria below), the same discipline `submit-answer.ts` already uses for its own typed failure cases.
- `src/infrastructure/postgres/today-session-repository.ts` — implement the new port method as a single conditional `UPDATE ... SET status = 'skipped', <resolved-at column> = $2 WHERE id = $1 AND status = 'pending' RETURNING id`, mirroring `markItemCompleted`'s existing shape but gated on current status (see "Concurrency note" below — `markItemCompleted` itself is currently NOT gated this way, which this slice should not silently inherit).
- Possibly `src/domain/learning/` — optional, small: a pure guard (e.g. `canSkipTodaySessionItem(status): boolean`) if the project wants the "only pending items are skippable" rule expressed as domain policy rather than an inline SQL `WHERE` clause. Given how thin this rule is, inlining it at the application/persistence boundary (as `submitAnswer`'s own ownership checks already do) is also defensible — this is a judgment call, not a settled architecture question.

**Schema changes (conceptual, additive only).** `today_session_items`
currently has one mutable timestamp, `completed_at`, semantically named for
completion only. Two options, described conceptually (no SQL here):
1. Add a new nullable `skipped_at` column, leaving `completed_at` meaning
   exactly what it already means. Fully additive; no existing column,
   constraint, or query changes shape.
2. Reuse `completed_at` as a generic "resolved_at" for both outcomes.
   Cheaper (no migration), but semantically muddies a column whose name
   already promises "completion," and would require the mapper
   (`today-session-mapper.ts`) to stop treating a non-null `completed_at`
   as "meaning completed" (it currently would, once `status` disambiguates
   it — this is fixable but adds a subtle coupling).

Recommendation: option 1 (new column) — it costs one additive migration and
avoids overloading an existing column's meaning, at essentially zero extra
complexity.

**Tests needed.**
- Domain (if the guard function is added): `src/domain/learning/__tests__/` — pure transition-legality test (pending→skipped allowed; completed→skipped rejected; skipped→skipped rejected/no-op).
- Application (in-memory fakes, `src/application/learning/__tests__/`, extending `in-memory-fakes.ts`): skip a pending item succeeds; skip a completed item is rejected (not silently overwritten); skip an item the user does not own is rejected; skipping does not touch `UserQuestionProgress`/`Attempt` at all (assert the in-memory progress/attempt fakes are untouched).
- Real-Postgres integration (`supabase/tests/postgres/today-session-repository.test.ts`, using the existing `db-harness.ts`): the conditional `UPDATE ... WHERE status = 'pending'` is race-safe against a concurrent `markItemCompleted` on the same row (whichever commits first wins; the loser's caller gets a typed "no longer pending" result, not a silent overwrite) — this is the one genuinely new concurrency surface this slice introduces, and it is small and self-contained, unlike the mid-day-adaptation concurrency surface flagged in Slice 8.
- Schema (`supabase/tests/schema.integration.test.ts`, `npm run test:schema`): the CHECK constraint already covers `'skipped'` (already true today, per this session's baseline of 97 passing schema tests) — if a new `skipped_at` column is added, add a column-existence/nullability assertion consistent with this file's existing style.

**Acceptance criteria.**
- A pending `TodaySessionItem` can be marked skipped exactly once.
- Skipping never creates an `Attempt` and never updates `UserQuestionProgress` — mastery/evidence/misconception state is provably unchanged (assert equality before/after in tests, not merely "no error thrown").
- Skipping an already-completed or already-skipped item does not silently succeed or silently overwrite — it returns a distinct, typed outcome the caller can act on.
- A skipped item does not reappear in the same `TodaySession` (already true by construction — nothing regenerates an existing session's items; this criterion is really "don't accidentally build a regenerate-on-skip path").
- No replenishment: skipping never changes the number of items in the session or triggers any new candidate generation.

**Rollback risk: very low.** This is a strictly additive port method, one
new application function, one new conditional UPDATE query, and (if chosen)
one new nullable column. Reverting means removing the new call sites; no
existing `pending`/`completed` flow, query, or constraint is touched.

---

## Slice 1 — Cross-Course candidate-pool assembly (application-layer scaffolding, not yet user-facing)

Confirms and operationalizes `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3's core
finding: `generateNextBestActionCandidates`
(`src/domain/learning/next-best-action.ts`),
`rankNextBestActionCandidates`
(`src/domain/learning/next-best-action-ranking.ts`), and
`generateTodayPlan` (`src/domain/learning/today-planner.ts`) already carry
no `courseId` concept anywhere in their types, so a cross-Course ranked
plan can be produced by concatenating per-Course candidate lists **before**
they reach `rankNextBestActionCandidates`, with zero changes to any of
those three domain files. This slice builds exactly that concatenation
step, in the application layer, as scaffolding — it does not yet wire into
any user-facing endpoint, persist anything new, or solve the
plan-membership double-counting problem (that is Slice 2).

**Prerequisites.**
- Other slices: none required, though it is naturally done alongside/after Slice 0 since both touch the same application-layer neighborhood.
- Product decisions already settled: ADR-016 §10/§11 (no quota, no fairness floor, exam-urgency-as-amplifier-not-gate) govern how a *future* ranking extension should behave, but this slice does not need them yet — it only concatenates and ranks with the **existing, unmodified** tiered ranking (no exam-urgency dimension exists in code yet — see Slice 8's cousin in `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`, which is itself explicitly "analysis only, no coefficients decided").
- Blocked on Dor: none for the scaffolding itself. `docs/OPEN_QUESTIONS.md` #33 (Multiple Active Courses) remains OPEN — ADR-016 and the design draft both proceed "assuming yes" without resolving it; this slice inherits that same assumption and should not be read as resolving #33 either.
- Blocked on other engineering work: **the set of "active Courses" for a learner is not yet knowable in a principled way** — `CourseMembership` (ADR-015) has no migration yet, so there is no real query for "this learner's active, non-archived, non-revoked Courses" today. This slice can be built and unit-tested against an explicit, caller-supplied list of `courseId`s (sidestepping the missing membership table entirely), but cannot be wired into a real endpoint until either ADR-015's migration exists or a temporary substitute (e.g. "every Course this learner has ever submitted an Attempt in") is explicitly accepted as an interim approximation — which is itself a product call, not an engineering default to invent silently.

**Files likely affected.**
- New `src/application/learning/global-candidate-pool.ts` (naming illustrative) — a pure-ish application function: given a `userId`, a list of `courseId`s, and the existing `NextBestActionContext`, calls `repos.progress.listForUser(userId, courseId)` once per Course (existing port, `src/application/learning/ports.ts`, no signature change needed — `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §7 confirms this "repeated calls, concatenated" path needs no port change), runs `generateNextBestActionCandidates` per progress row exactly as `today-session.ts` already does, concatenates, and calls `rankNextBestActionCandidates` **once** over the merged pool.
- For downstream bookkeeping (double-counting guard in Slice 2, per-Course analytics in Slice 5), each ranked candidate's `courseId` needs to be recoverable. Per the design draft §4's own recommendation, do this via the *cheapest* existing lookup — `QuestionVersionRepository.resolveVersionContext` or an equivalent `questionId -> courseId` lookup — at the boundary, **not** by threading a new `courseId` field through `NextBestActionCandidate`/`NextBestActionRankedCandidate`/`TodayPlanItem`. This preserves the "ranking/planning stay Course-agnostic" property the design draft calls "the clearest reuse-unchanged finding."
- No changes to `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`, or `today-planner.ts`.

**Schema changes:** none. This slice reads existing `user_question_progress` rows via the existing port; nothing is persisted yet.

**Tests needed.**
- Application (in-memory fakes, `src/application/learning/__tests__/`): given progress rows seeded across 2–3 fake Courses, assert the merged, ranked output matches what calling `rankNextBestActionCandidates` directly on the manually-concatenated candidate list would produce (i.e., prove "no new ranking logic was introduced" by comparing against the existing function's own output, not a hand-rolled expectation) — this is the test that actually verifies "zero code changes to ranking" holds, not just an assertion that it should.
- A specific regression test asserting `next-best-action.ts` / `next-best-action-ranking.ts` / `today-planner.ts` source files are unmodified by this slice's diff is unnecessary formally, but the PR/commit for this slice should make it trivially visible (e.g. via `git diff --stat`) that those three files have zero changes — call this out explicitly in the slice's own PR description when it is eventually built.

**Acceptance criteria.**
- Given candidates from N Courses, the function returns one ranked list, in the same tier + tie-break order `rankNextBestActionCandidates` already guarantees, with each item's source Course recoverable.
- No modification to any of the three domain ranking/planning files.
- Not yet wired into any endpoint, UI, or persisted plan — this slice's output is provably correct in isolation, nothing more.

**Rollback risk: very low.** New file, no schema, no existing call site
changed. Deleting it has zero effect on anything already shipped (Slice 0,
or the existing Course-scoped Today).

---

## Slice 2 — Plan-membership double-counting guard (contract-level, deliberately architecture-agnostic)

This is the slice `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §6's "sub-risk 2"
names as "the real, not-yet-closed risk": nothing today prevents the same
`questionId` from being independently selected into both a Global Today
plan and that Question's own Course's Today plan on the same day, because
neither generation path is aware of the other. §8 (Consequences) of the
same design draft already found this "likely needs new persisted state...
regardless of which [persistence] option is chosen" — meaning this guard's
*existence* is not contingent on Option A/B/C, even though its *storage
shape* eventually is.

**Prerequisites.**
- Other slices: Slice 1 (needs a candidate pool to guard).
- Product decisions already settled: ADR-016 §1 / product spec §3
  ("exactly one write, visible from both views") — this is the product rule
  this guard exists to satisfy.
- Blocked on Dor: `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §6's own open
  question — "which one runs first," "does completing one un-claim it from
  the other," "what happens if the learner opens Course Today before
  Global Today exists yet that day" — these are sequencing/product
  decisions, not engineering defaults, and should be tracked as open in
  `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`. **This slice can still be
  built without them answered**, using the interim approach below, but the
  interim approach embeds an implicit sequencing assumption (see next
  bullet) that must be surfaced, not silently baked in as if it were
  decided.
- Blocked on other engineering work: none — the interim implementation
  below needs no new table.

**Interim, architecture-agnostic implementation.** Rather than building a
new persisted "claim" table before the architecture choice (Slice 3) is
made, implement the guard as a **read-time exclusion query**: before
generating a new plan (Global or Course), query for `questionId`s that
already have a `today_session_item` for this `(userId, plannedForDate)`
across **any** of the learner's Course sessions (a simple `SELECT DISTINCT
question_id FROM today_session_items JOIN today_sessions ON ... WHERE
user_id = $1 AND planned_for_date = $2`), and exclude those from the new
candidate pool before ranking. This is correct under Option B (pure
composition) by construction and remains correct as a *defensive* guard
even under Option A or C — it does not need to be replaced when the
persistence-architecture decision (Slice 3) lands, only possibly
supplemented.

**Files likely affected.**
- `src/application/learning/ports.ts` — a new read method, e.g. `TodaySessionRepository.listPlannedQuestionIds(userId, plannedForDate): Promise<string[]>` (naming illustrative).
- `src/infrastructure/postgres/today-session-repository.ts` — the query above.
- `src/application/learning/global-candidate-pool.ts` (from Slice 1) — filter the merged pool against this exclusion set before calling `rankNextBestActionCandidates`.

**Schema changes:** none for the interim implementation.

**Tests needed.**
- Application (in-memory fakes): a Question already planned in a fake Course-A session for date D is excluded from a Global-pool generation for the same `(userId, D)`.
- Real-Postgres (`supabase/tests/postgres/`): the exclusion query correctly spans multiple `today_sessions` rows for one user/date and correctly scopes to `plannedForDate` (does not leak across days).

**Acceptance criteria.**
- The same `questionId` never appears as a plannable candidate in two independently-generated sessions for the same `(userId, plannedForDate)`.
- This guard does not itself decide which of two "generate" calls should have priority when raced concurrently — that remains a real, documented concurrency question for Slice 4 (orchestration), not solved here.

**Rollback risk: low.** One new read query and one new filter step. Removing
it reopens the double-counting risk but does not corrupt any already-shipped
state (it is a pre-write filter, not a data transformation).

---

## Slice 3 — Global Daily Plan persistence schema (architecture-dependent — the slice most likely to change shape)

**This is the slice most sensitive to the still-forthcoming
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` / `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`
recommendation.** Everything below is written against
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md`'s own three options so that whichever
one the firmer analysis lands on, this slice's shape is already anticipated
rather than discovered from scratch.

**Prerequisites.**
- Other slices: Slices 1–2 (a candidate pool and a double-counting guard should exist before there is anything meaningful to persist).
- Product decisions already settled: ADR-016 §1's "exactly one write,
  visible from both views" rule is a **real constraint on this slice**, not
  a preference — per `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §16, this
  rule, read literally, forecloses Option A (an independent item copy)
  unless Option A also builds an explicit cross-table dedup mechanism
  equivalent to what Option B/C get for free by construction.
- Blocked on Dor: **the persistence architecture itself** (Option A vs. B
  vs. C) — explicitly deferred by ADR-016 ("Explicitly deferred" section)
  to the companion architecture/persistence documents, which had not yet
  produced a firm recommendation at the time of writing. Also blocked on:
  the per-Course-vs.-Global `TodaySession.status` completion question
  (`docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §14, classified "UNCLEAR —
  REQUIRES DOR" — this was already unresolved for the single-Course case
  before Global Today existed as a direction).
- Blocked on other engineering work: none beyond Slices 1–2.

**Files likely affected (shape depends on option chosen).**
- New `supabase/migrations/<timestamp>_global_today_plan.sql` — under Option A: `global_today_sessions` + `global_today_session_items` (each item carrying its own `course_id`, unlike today's `today_session_items` which inherit Course from their parent session's composite FK — this is a genuinely new invariant to enforce, per design draft §9's Option A cons). Under Option C: a single, smaller `global_today_plans` table referencing `(course_id, today_session_item_id)` pairs from already-existing `today_session_items`, no duplicated item content. Under Option B: no migration at all (this slice would not exist).
- New `src/infrastructure/postgres/global-today-*.ts` repository implementation(s), matching whichever port shape Slice 3 introduces into `src/application/learning/ports.ts`.
- `docs/PERSISTENCE_SCHEMA_V1.md` would need a new section (out of scope for this document to write, since it is not one of this session's two deliverables, but flagged so it is not forgotten).

**Schema changes:** additive only in every option considered — per design
draft §8, no option found requires altering or dropping `today_sessions`'
or `today_session_items`' existing columns or constraints.

**Tests needed.**
- Application unit (in-memory fakes) for the new port(s).
- Real-Postgres (new file under `supabase/tests/postgres/`, following the existing `today-session-repository.test.ts` / `db-harness.ts` pattern) for the new table's race-freedom on creation (an equivalent `INSERT ... ON CONFLICT DO NOTHING` pattern to ADR-010's, per design draft §7's "session creation race, generalized" analysis) and for the composite-FK-style consistency guarantees appropriate to whichever option is chosen.
- Schema tests (`supabase/tests/schema.integration.test.ts`) for the new table's constraints, following this file's existing conventions.

**Acceptance criteria:** cannot be finalized until the option is chosen —
this is precisely why this slice is sequenced this late.

**Rollback risk:** low regardless of option, **for the schema itself**
(additive, no existing table altered) — but **high for behavior** if
shipped and then the option is reversed later, since Slice 4 (orchestration)
and Slice 5 (the Global read view) will be built directly against whichever
shape this slice picks. This is the main reason this document defers this
slice as late as safely possible rather than starting here.

---

## Slice 4 — First-open cross-Course generation orchestration

Per `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §11, ADR-016 §2's
"whichever Today view opens first" rule is new orchestration responsibility
that does not exist today: `getOrCreateTodaySession`
(`src/application/learning/today-session.ts`) only ever generates one
Course's session. Under Option B/C, opening any Today view before any
per-Course session exists yet that day may need to trigger generation for
*every* active Course at once, not just the one opened.

**Prerequisites.**
- Other slices: Slice 3 (needs somewhere to record the Global plan, unless Option B, in which case this slice's job is simpler — "call `getOrCreateTodaySession` once per active Course" with no separate Global row to also create).
- Product decisions already settled: ADR-016 §2 (first-open generation), §9 (dynamic size — see caveat under Slice 8-adjacent risk in the adversarial review; this slice must not silently assume a sizing model that does not exist yet).
- Blocked on Dor: none new beyond Slice 3's architecture choice.
- Blocked on other engineering work: **this is where "active Courses" must be real.** `CourseMembership` (ADR-015) has no migration yet — this slice cannot correctly enumerate "this learner's active, non-archived, non-revoked Courses" (ADR-016 §16 / ADR-015 §7/§9) until that migration exists. This is a hard, independent blocker: the exclusion rule ADR-015 already accepted at the product level has no schema to enforce it with today, regardless of anything Global-Today-specific.

**Files likely affected.**
- `src/application/learning/today-session.ts` or a new sibling file — new orchestration function that, given a `userId` and a set of active `courseId`s (from wherever the eventual `CourseMembership` query lives), calls `getOrCreateTodaySession`-equivalent logic once per Course, or generates the Global plan directly per Slice 3's chosen shape.

**Schema changes:** none beyond what Slice 3 and the (separately-tracked, non-Global-Today) ADR-015 migration already introduce.

**Tests needed:** application-layer (in-memory fakes) for "opening Course B's Today first still results in a coherent cross-Course plan for the day"; real-Postgres for the multi-Course generation race (design draft §7's "concurrent generation of Global Today and a Course Today for the same day" risk — a genuinely new concurrency surface, not present in the single-Course-Today world).

**Acceptance criteria:** a second Today view opened later the same day
resumes the already-generated plan; it never triggers a second generation
(ADR-016 §2, restated).

**Rollback risk: moderate.** Unlike Slices 0–2, this slice changes *when*
generation happens for the existing Course-scoped path too (a Course Today
open might now also trigger sibling-Course generation) — reverting it
needs care to make sure Course-scoped Today's existing, already-shipped
behavior (generate only the opened Course's session) is fully restored, not
partially.

---

## Slice 5 — Global Today read view + Course Today consistency confirmation

**Files likely affected:** a new read-only application query (e.g.
`getGlobalTodayView(userId, date)`) composing per-Course sessions/items per
whichever shape Slice 3 chose; no changes expected to
`getTodaySession`/`getOrCreateTodaySession`'s existing Course-scoped
behavior — `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §18 already
confirms `getTodaySession`'s pure-read semantics are unaffected.

**Prerequisites:** Slices 3–4.
**Blocked on Dor:** whether Global Today replaces Course Today as the
default Home entry point, or the two remain parallel (product spec §20,
still explicitly not decided) — this affects the read view's shape (does it
need to also expose "which Course sessions exist" for a switcher UI?) but
not its correctness.
**Blocked on other engineering:** none beyond Slice 4.

**Tests needed:** application-layer tests asserting "completing an item via
Course Today shows as completed via the Global read view immediately after,
within the same underlying data" (the concrete worked example from product
spec §19, "Course Today completion reflected in Global Today").

**Acceptance criteria:** matches product spec §19's worked examples
directly — this document treats those examples as the acceptance test
suite for this slice.

**Rollback risk: low** — this is a pure read/query layer; removing it does
not affect any write path already shipped by earlier slices.

---

## Slice 6 — Manual Practice separation — confirm/harden, not build from scratch

**This slice is mostly already done.** `src/application/learning/submit-answer.ts`'s
`command.todaySessionItemId === null` branch is already, structurally, the
Manual Practice / Today separation ADR-016 §8 and product spec §14
describe: when `todaySessionItemId` is `null`, learning state updates
exactly as any other Attempt (via `applyAttemptToProgress`/
`rebuildUserQuestionProgress`), but no `TodaySessionItem` is ever touched —
`repos.todaySessions.markItemCompleted` is only called in the `!== null`
branch (`submit-answer.ts`, "Step 7"). This already satisfies "Manual
Practice does not satisfy the Daily Plan" for the existing Course-scoped
case.

**What this slice actually needs to do:**
1. Write the regression tests that pin this behavior down explicitly for
   Global Today's benefit (they may not exist as targeted tests today,
   only as an emergent property of `submit-answer.ts`'s existing test
   suite, `src/application/learning/__tests__/submit-answer.test.ts`) —
   specifically: manually answering a Question that is *also* item N of
   today's plan updates progress but leaves the plan item `pending`, and
   the item can still be presented/answered again through Today afterward.
2. Confirm this holds identically once Global Today exists — i.e., a
   manual Attempt on a Question that is item 4 of the *Global* plan (per
   whichever Slice 3 shape) still does not mark that Global item
   completed, using the exact same `todaySessionItemId === null` code path,
   with no Global-specific branch needed.
3. **Do not build a second "manual practice" concept for Global Today** —
   there is exactly one Manual Practice path in the codebase today, and
   ADR-016 gives no reason to duplicate it.

**Prerequisites:** none technically (this can be done any time — even
before Slice 0), though it is more meaningful once Slice 3 exists to
confirm against.
**Blocked on Dor:** none.
**Blocked on other engineering work:** none.

**Files likely affected:** primarily test files —
`src/application/learning/__tests__/submit-answer.test.ts` (add/confirm
cases), possibly a new test file scoped to the Global-plan interaction once
Slice 3 lands.

**Tests needed:** application-layer only — this is a confirmation slice, not
a new mechanism, so no new domain or real-Postgres tests are strictly
required beyond what already exercises `submitAnswer`.

**Acceptance criteria:** the concrete worked example in product spec §19
("Manual practice of a Question that remains in Today") passes as a named
test case.

**Rollback risk: essentially none** — this slice adds tests and
confirmation, not new production code paths.

---

## Slice 7 — Course-archive exclusion for Global Today candidate assembly

**Prerequisites:** Slice 1 (needs a candidate-pool assembly step to filter).
**Blocked on Dor:** none — ADR-015 already settled the product rule
(archived Courses excluded from automatic Today, remain manually
practiceable/reactivatable).
**Blocked on other engineering work: hard blocker.** `CourseMembership`
(ADR-015) has no migration yet — there is no `archivedAt` column anywhere
in the committed schema to filter on. This slice cannot be implemented
before that migration exists, and that migration is not Global-Today-
specific work; it is a pre-existing, independent gap this session's grounding
notes already call out (see Slice 4).

**Files likely affected:** once the ADR-015 migration exists, Slice 1's
candidate-pool assembly function gains a filter step excluding
`courseId`s where the learner's `CourseMembership.archivedAt IS NOT NULL`.

**Schema changes:** none beyond the ADR-015 migration itself (out of scope
for this document — it is not Global-Today-specific work).

**Tests needed:** application-layer test confirming an archived Course's
Questions never appear in the Global candidate pool, while remaining
answerable via Manual Practice (Slice 6's separation) and via that Course's
own (still-accessible) Course Today, per ADR-015 §7.

**Acceptance criteria:** matches ADR-015 §7's "archived: remains accessible,
remains manually practiceable, excluded from automatic Today" directly.

**Rollback risk: low** — a filter step; removing it re-includes archived
Courses, which is a behavior regression but not a data-integrity risk.

---

## Slice 8 — Significant-event adaptation (hardest slice; heavily blocked)

**Prerequisites:** Slices 3–5 (there must be a frozen plan to adapt).
**Blocked on Dor — genuinely, on multiple independent axes:**
- No definition exists anywhere in `docs/` for "significant learning
  event" beyond the illustrative candidate-trigger list in product spec
  §12 / ADR-016 §4 — exact thresholds are explicitly deferred (ADR-016
  "Explicitly deferred"; see `docs/TODAY_ADAPTATION_MODEL.md`, which was
  not present in `docs/` at the time of writing this document, only
  referenced).
- Whether Manual Practice (outside any Today view) can itself trigger
  adaptation of Today's remaining items is a genuinely open direction
  question this document does not answer — see
  `docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` for why this is not a minor
  detail.
**Blocked on other engineering work:** a same-day partial-replan write path
against an already-frozen, already-persisted plan is new transaction
surface with no precedent in the current codebase — today's model is
"generate once, never regenerate, only mark items completed/skipped." Per
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §7, this needs its own transaction
design, analogous to but distinct from `submitAnswer`'s advisory-lock
pattern (ADR-010) — not assumed safe by analogy.

**Files likely affected:** unknown in detail until the above are resolved;
at minimum, a new write path in whichever repository Slice 3 introduces,
plus (per the adversarial review's finding on plan-history auditability) a
new append-only event/audit record distinct from the current
in-place-mutable `status`/`completed_at` columns, so that "explain why
Today changed" (product spec §18) is actually answerable after an
adaptation occurs.

**Tests needed:** domain (once thresholds exist), application, and
real-Postgres concurrency tests for the new write path racing against
concurrent item completion.

**Rollback risk: high** — this is the slice most likely to interact badly
with concurrent completion of the same plan, and the one with the least
existing precedent to build from. Recommend building it behind a feature
flag / entirely inert-by-default trigger set, so it can be disabled without
touching the frozen-plan generation/completion paths Slices 0–7 already
depend on.

---

## Slice 9 — Timezone / day-boundary handling

**Prerequisites:** Slice 4 (the first-open trigger is where "what day is it"
actually gets evaluated).
**Blocked on Dor:** `docs/OPEN_QUESTIONS.md` #35 (Learner Time Zone) is
OPEN — account setting vs. browser-derived vs. stored IANA timezone is not
decided, and `docs/TODAY_TIMEZONE_EDGE_CASES.md` (referenced by the product
spec as the place session-continuation/DST mechanics are analyzed) was not
present in `docs/` at the time of writing this document. See
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` for a concrete DST/travel scenario
this slice must not hand-wave past.
**Blocked on other engineering work:** none beyond needing #35 answered.

**Files likely affected:** `src/domain/learning/today-planner.ts`'s
`plannedForDate` validation already only checks string format and
explicitly defers "what counts as today" to the caller
(`docs/OPEN_QUESTIONS.md` #3) — this slice's work lives entirely in the
application layer (whatever computes `plannedForDate` before calling into
the existing domain functions), not in the domain layer itself.

**Tests needed:** application-layer tests for the specific DST/travel
scenario in the adversarial review, once a timezone source is decided.

**Rollback risk: moderate** — day-boundary logic, once wrong, can produce
duplicate or missing plans for real users; recommend shipping behind
extensive real-Postgres integration tests before any production traffic.

---

## Summary ordering table (historical — see "Accepted sequencing" above for the current authoritative phase order)

This table reflects the original per-slice dependency analysis and is kept
for reference. It predates the accepted architecture and Ruppin-sequencing
decisions — read the "Accepted sequencing" section above first; where the
two disagree on ordering, that section governs, not this table.

| # | Slice | Needs architecture (A/B/C) decided? | Needs Dor decision? | Needs ADR-015 migration? | Ship independently now? | Phase (accepted sequencing) |
|---|---|---|---|---|---|---|
| 0 | Skip semantics | No | No | No | **Yes** | 1 |
| 1 | Cross-Course candidate pool (scaffolding) | No | No | Only to wire into a real endpoint | Scaffolding only | 3 |
| 2 | Double-count guard (interim) | No | Partially (sequencing policy) | No | Scaffolding only | 3 |
| 3 | Global Daily Plan persistence schema | Decided: Option A | Resolved | No | **Yes, scoped to single-Course** | 1 |
| 4 | First-open orchestration | Decided: Option A | No new | **Yes, hard blocker** | No | 3 |
| 5 | Global read view | Decided: Option A | Resolved (Home entry point) | No | No | 3 |
| 6 | Manual Practice confirm/harden | No | No | No | **Yes** (tests only) | 1 |
| 7 | Archive exclusion | No | No | **Yes, hard blocker** | No | 3 |
| 8 | Significant-event adaptation | Decided: Option A | Partially (Today-only trigger origin resolved; thresholds not) | No | No | Not phased |
| 9 | Timezone handling | No | Yes (#35, still open) | No | No | Not phased |

Not in the original table: the **production composition root / policy
defaults** blocker (see "Learning Engine production-composition blocker"
above) is a Phase 1 prerequisite that this document's original slicing did
not track, because it is not Global-Today-specific work.

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`, `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016, ACCEPTED — source of every product rule cited and of the accepted sequencing/architecture)
- `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` (RESOLVED — the 9-item checklist ADR-016 formalizes)
- `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (source of the composition-root blocker, above)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`, `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md`, `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`
- `docs/DECISIONS/011-today-is-course-scoped-v1.md`, `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
- `docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` (companion document, this session)
- `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`, `today-planner.ts`
- `src/application/learning/today-session.ts`, `submit-answer.ts`, `ports.ts`
- `src/infrastructure/postgres/today-session-repository.ts`, `today-session-mapper.ts`
- `supabase/migrations/20260917203000_initial_schema.sql`

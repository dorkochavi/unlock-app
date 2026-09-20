# Global Today — Historical Implementation Slices

Status: **HISTORICAL IMPLEMENTATION ANALYSIS — NOT THE CURRENT EXECUTION QUEUE.**

This document records the slice decomposition used while ADR-016 was being implemented. Many "not implemented", "blocked", migration, Auth, timezone, API, and CourseMembership statements in the body are now historical and are intentionally preserved as a record of how the implementation was decomposed.

Current execution comes only from `docs/CHATGPT_PLAN.md`.
Current repository truth comes from `docs/DEV_STATUS.md`.
Current product/architecture truth comes from accepted ADRs and `docs/MASTER_SPEC.md`.

As of the Development OS V1 baseline, the following work described as future in this historical document has been implemented locally: CourseMembership, user timezone persistence, production Learning Engine composition, DailyPlan/DailyPlanItem persistence, learner-local first-open generation, Today read API/UI, DailyPlan answer submission, Skip, ADR-017 New Material fallback, Auth flow, and OPEN-course onboarding. The two newest DailyPlan migrations may still be pending explicit hosted application; `docs/DEV_STATUS.md` is authoritative for remote state.

Do not use this file to decide what Claude should build next.


---

## Accepted sequencing (updated 2026-09-19) — read this before the slice list

Per the accepted decisions (ADR-016 §20, resolving
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7) and the subsequent
production-defaults formalization (`docs/OPEN_QUESTIONS.md` #11, #13, #16,
#35; `docs/LEARNING_ENGINE.md` §16a/§20a;
`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` §7a), the
implementation-readiness order is now:

```text
1. CourseMembership / joinPolicy persistence and runtime foundation (ADR-015)
2. user profile timezone persistence/source-of-truth support (OPEN_QUESTIONS #35)
3. Learning Engine production composition root
4. conservative production policy defaults for:
   - MasteryPolicy
   - MisconceptionPolicy
   - Today sizing
5. DailyPlan / DailyPlanItem migration and domain/application layer
6. single-Course Today vertical slice
7. usable Ruppin flow
8. multi-Course Global Today later / if schedule permits
```

This supersedes any implied ordering from the "Summary ordering table" at
the bottom of this document and from the previous revision's three-phase
framing where the two disagree — the list above is authoritative. It is a
refinement, not a reversal, of the previous "Phase 1/2/3" framing: steps
1–5 below are what Phase 1 actually requires, made concrete and ordered;
step 6 is the previous Phase 1's deliverable; step 7 is the previous Phase
2; step 8 is the previous Phase 3.

**1. CourseMembership / joinPolicy persistence and runtime foundation
(ADR-015).** No migration exists yet. This is the hard blocker already
flagged in Slices 4 and 7 below ("active Courses" cannot be enumerated
without it) and is a prerequisite for step 5 (a `DailyPlan` needs to know
which Course(s) a learner actually belongs to).

**2. User profile timezone persistence/source-of-truth support.** Per the
accepted decision (`docs/OPEN_QUESTIONS.md` #35, RESOLVED): store an IANA
timezone identifier on the user profile, detected client-side on first
registration/relevant session, persisted as the server-side source of
truth thereafter. No column or detection code exists yet. This is a
prerequisite for step 5/6 — `DailyPlan`'s local-day calculation (ADR-016
§17) needs a real timezone source, not a placeholder.

**3. Learning Engine production composition root.** Per
`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (unchanged
headline finding, §4): no composition root exists anywhere in `src/`. This
is the code-shape work — wiring together `SubmitAnswerContext`/
`TodaySessionContext`-equivalent construction — which can be built now,
ahead of every value being final, per the audit's §7a update.

**4. Conservative production policy defaults.** Now fully unblocked — all
previously-blocking policy groups (`MasteryPolicy`, `MisconceptionPolicy`,
Today sizing) have an accepted conservative production default; see
"Learning Engine production-composition blocker," below, for the exact
values and what remains open (calibration, not a product decision).

**5. `DailyPlan`/`DailyPlanItem` migration and domain/application layer —
PERSISTENCE FOUNDATION IMPLEMENTED (2026-09-21); INTERNAL GENERATION CORE
IMPLEMENTED; PUBLIC ENTRY POINT IMPLEMENTED; PRODUCTION COMPOSITION
(construction/policy wiring) IMPLEMENTED; PG RUNTIME ADAPTER IMPLEMENTED
(all 2026-09-19 session) — no real environment/database configured, no
API route/UI/Auth.** These are four separable claims, not one — read
each "IMPLEMENTED" paragraph below for exactly what it covers; none of
them means a real request can reach this code path yet.
`supabase/migrations/20260921000000_daily_plan_v1.sql` adds
`daily_plans`/`daily_plan_items`, purely additive alongside
`today_sessions`/`today_session_items` (unmodified, per
`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` §13). `src/domain/dailyPlan/types.ts`,
`src/application/dailyPlan/ports.ts`, and
`src/infrastructure/postgres/daily-plan-{repository,mapper}.ts` implement
the single-use resolution rule (ADR-016 §19: `markCompleted`/`markSkipped`
are each a conditional `UPDATE ... WHERE status = 'pending'`, returning a
typed `RESOLVED`/`ALREADY_RESOLVED`/`NOT_FOUND` outcome).

**IMPLEMENTED — internal generation core:**
`generateDailyPlanForResolvedInputs`
(`src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`) —
takes an explicit, caller-supplied `eligibleCourseIds` list and an
already-resolved `plannedForDate`, and orchestrates the same unmodified
`generateNextBestActionCandidates` -> `rankNextBestActionCandidates` ->
`generateTodayPlan` pipeline `getOrCreateTodaySession` uses, extended to
pool `UserQuestionProgress` across every `eligibleCourseId` and rank once,
globally, before persisting via `DailyPlanRepository.createIfNotExists`.
Also implemented: a DailyPlan-scoped transaction contract
(`DailyPlanTransactionalRepositories`/`DailyPlanUnitOfWork`, in
`application/dailyPlan/ports.ts`), deliberately independent of
`application/learning/ports.ts`'s own `UnitOfWork`; `eligibleCourseIds`
deduplication and a loud throw on a conflicting `questionId -> courseId`
mapping (defensive only — real schema already makes the conflict
unreachable). 12 application-layer tests
(`application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`).

**IMPLEMENTED — public entry point:** `getOrCreateDailyPlanForToday`
(`src/application/dailyPlan/get-or-create-daily-plan-for-today.ts`) —
resolves `UserRepository.findTimezone` -> `deriveLocalDateString` ->
`CourseMembershipRepository.listActiveForUser` -> eligible `courseId`s,
then delegates unchanged to `generateDailyPlanForResolvedInputs`. Accepts
no `courseId`/`courseIds`/`scope` parameter — course discovery is this
function's own job (ADR-016 §1). Typed result
(`{outcome: "READY" | "USER_NOT_FOUND" | "TIMEZONE_NOT_SET"}`), never
throws for either expected non-ready state. **Accepted product decision,
now implemented and recorded (`docs/OPEN_QUESTIONS.md` #44, RESOLVED):
only `CourseMembership.role === "LEARNER"` is eligible for automatic
DailyPlan participation — `OWNER`/`INSTRUCTOR` memberships never
automatically contribute their Course.** Same-day resume still performs
one `listActiveForUser` read even when a plan already exists for that day
(stated explicitly in the file's own doc comment as a deliberate,
low-cost tradeoff — avoiding it cleanly would need either a new
non-transactional `DailyPlanRepository` read port or a second transaction
per resume, neither authorized by this slice). 11 application-layer tests
(`application/dailyPlan/__tests__/get-or-create-daily-plan-for-today.test.ts`),
including `Asia/Jerusalem`/`America/New_York` UTC-vs-local-date boundary
cases, LEARNER-only filtering, archived/revoked exclusion, and same-day
resume with no regeneration.

**IMPLEMENTED — Postgres wiring and production composition (construction/
policy wiring, not a runtime connection):** `PostgresDailyPlanUnitOfWork`
(`src/infrastructure/postgres/daily-plan-unit-of-work.ts`) — mirrors
`PostgresUnitOfWork`'s BEGIN/COMMIT/ROLLBACK pattern exactly, scoped to
exactly the three repositories generation needs
(`dailyPlans`/`progress`/`questionVersions`); deliberately does NOT
acquire `submitAnswer`'s advisory lock (generation only ever reads
`UserQuestionProgress`, never reads-then-writes it). Production
composition root at `src/infrastructure/dailyPlan/composition-root.ts`
(`createProductionDailyPlanGenerationSettings`,
`createProductionDailyPlanPorts`) — reuses the same centralized
`PRODUCTION_ENGINE_VERSION`/`PRODUCTION_TODAY_PLANNER_POLICY`/
`TsFsrsMemoryScheduler` the learning composition root already uses; no new
policy values. At the time this was built, it took a caller-supplied
`SqlExecutor`/`ConnectionProvider` because no concrete implementation of
either existed anywhere in this codebase yet — that gap is what the next
paragraph closes. 4 unit tests
(`src/infrastructure/dailyPlan/__tests__/composition-root.test.ts`,
in-memory ports) plus 5 real-Postgres (PGlite) integration tests
(`supabase/tests/postgres/daily-plan-unit-of-work.test.ts`) proving:
transaction atomicity across `daily_plans`/`daily_plan_items` (a forced
failure after the plan row and one item are written rolls back both
tables to zero rows); sequential first-open calls for the same
`(userId, local date)` produce exactly one `daily_plans` row with no
mixed/duplicated items (PGlite has no true multi-connection concurrency —
this proves the race-free-by-construction property sequentially, the same
honest limitation already documented for `submitAnswer`'s advisory lock —
see `daily-plan-repository.ts`'s own doc comment for the `READ COMMITTED`
isolation-level assumption this reasoning depends on); end-to-end
generation with correct `Asia/Jerusalem` local-date derivation and
same-day resume against a real migrated schema; LEARNER-only role
filtering against real `course_memberships` rows; and confirmation that no
`today_sessions`/`today_session_items`/`attempts` row is written as a side
effect.

**IMPLEMENTED — pg runtime adapter (this closes the "no concrete
`ConnectionProvider`" gap above, still no real database configured):**
`PgConnectionProvider` (`src/infrastructure/postgres/
pg-connection-provider.ts`) — a real `pg.Pool`-backed `ConnectionProvider`
implementation; `pg.PoolClient` satisfies `SqlExecutor` by direct
TypeScript structural typing, no wrapper needed. Owns ONLY connection
checkout/release (always releases in a `finally`, even on error) — never
`BEGIN`/`COMMIT`/`ROLLBACK`, which remain entirely
`PostgresUnitOfWork`/`PostgresDailyPlanUnitOfWork`'s job, unchanged.
`getPool()` (`src/infrastructure/postgres/pg-pool.ts`) provides the one
`pg.Pool` per server process: lazy (constructed on first actual call, not
at module-import time, so importing this module during a test run or
build never opens a connection or requires `DATABASE_URL`), memoized, and
`globalThis`-guarded outside production so Next.js dev HMR module
reloads recover the same `Pool` instead of leaking a new one. Throws
immediately and clearly if `getPool()` is called with `DATABASE_URL`
unset. SSL is deliberately not hardcoded in code (no
`rejectUnauthorized: false`-style default) — `pg` already honors
`sslmode`/`ssl` query parameters embedded directly in `DATABASE_URL`,
which is where the per-environment choice belongs. 10 unit tests (`src/
infrastructure/postgres/__tests__/{pg-connection-provider,pg-pool}
.test.ts`) against fake `Pool`/`PoolClient` shapes — no real network
connection, no `DATABASE_URL` required to run them. `pg`/`@types/pg` are
now real dependencies of this project (`package.json`); `@supabase/*` are
still not installed.

**Still NOT implemented**: no `DATABASE_URL` (or any other real
environment configuration) has actually been set anywhere — `getPool()`
has never been called against a real database, local or remote, by
anything in this session; no API route or UI exists (no HTTP handler
calls `getOrCreateDailyPlanForToday` yet, so nothing in this codebase
actually constructs `PgConnectionProvider`/`getPool()` outside their own
unit tests); Supabase Auth wiring (no `auth.users` -> `public.users`
provisioning trigger exists either — see the runtime/auth audit); any
`submitAnswer` integration (`DailyPlanItem` completion is not wired to
real Attempts); Skip as a callable use case; and mid-day adaptation.
**Global Today is not usable end-to-end by a real user yet** — every
piece up through a real Postgres connection ADAPTER is now proven
correct (via PGlite integration tests and adapter unit tests), but no
real database has been configured and no request path reaches any of it.

**6. Single-Course Today vertical slice.** Real usable UI, Auth,
CourseMembership, QR join, persistence — the full demo-readiness bar per
ADR-016 §20, built on steps 1–5.

**7. Usable Ruppin flow.** Harden step 6 for the actual pilot: real Course
content, real learners, real CourseMembership data, whatever UI polish the
demo needs. Multi-Course Global Today work does not start here.

**8. Multi-Course Global Today, later / if schedule permits.** Slices 1,
2, 4, 5, 7 below (cross-Course candidate pool, double-count guard,
first-open orchestration, Global read view, archive exclusion) belong
here. None of this is a hard demo requirement. Because step 5 was built
directly on the `DailyPlan`/`DailyPlanItem` architecture, this step is
additive work on the same foundation, not a rebuild.

**Not phased — ongoing/deferred regardless of demo timing:** Slice 8
(significant-event adaptation, scoped by ADR-016 §4 to Today-sourced
Attempts only) and Slice 9 (timezone edge-case mechanics beyond step 2's
storage model — DST, travel, session-continuation boundary, still blocked
on `docs/TODAY_TIMEZONE_EDGE_CASES.md`). Neither is required for steps 1–7.

## First recommended implementation slice, concretely

**The exact next slice is step 1: CourseMembership/joinPolicy persistence
(ADR-015), done in parallel with step 2 (timezone persistence)** — both are
small, independent, non-Global-Today-specific foundational gaps that
currently block everything downstream (Slice 4 and Slice 7's "active
Courses" enumeration; step 5's DailyPlan generation needing a real
timezone). Step 3 (composition root code shape) can start in parallel with
either, since it does not depend on them. Step 5 (scoped-down `DailyPlan`/
`DailyPlanItem` migration, i.e. Slice 3 below scoped to single-Course) is
the next slice after 1–4 land, not before — building it earlier would mean
generating plans with no real Course-membership or timezone data to
generate them against.

## Learning Engine production-composition blocker — RESOLVED at the product-decision level (2026-09-19)

Per `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (audit only, not
solved here; updated §7a/§7b per the production-defaults decisions): **no
production composition root exists anywhere in `src/` yet** (§4's finding
is still literally true of the code) — but as of §7b, **no product
decision remains outstanding** for the values that root would need. Policy/
config object status, final:

- **`TodayPlannerPolicy.maxItems`-equivalent (Today sizing)** —
  **CONSERVATIVE PRODUCTION DEFAULT available**: minimum 5, typical 8–12,
  hard maximum 15 (`docs/OPEN_QUESTIONS.md` #16,
  `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` §0b). Usable now, explicitly
  provisional pending calibration.
- **`MisconceptionPolicy` (7 fields)** — **CONSERVATIVE PRODUCTION DEFAULT
  CANDIDATE available**: the illustrative score model (normal wrong +1,
  high-confidence wrong +2, cross-question reinforcement, ACTIVE near
  cumulative score 3 — `docs/LEARNING_ENGINE.md` §20a). Usable now,
  explicitly provisional pending calibration.
- **`MasteryPolicy` (4 fields) — RESOLVED, no longer blocked.**
  Conservative initial defaults accepted (`docs/LEARNING_ENGINE.md` §16b):
  `minSpacedRetrievalsForStrengthening = 1` (STRONG, plus no unresolved
  lapse); `minSpacedRetrievalsForMastered = 3` AND
  `minEvidenceStrengthForMastered = "strong"` AND
  `minRetrievabilityForMastered = 0.80` AND no unresolved lapse (MASTERED,
  reversible). Usable now, explicitly provisional pending calibration —
  this was the last remaining product blocker and is now closed at the
  decision level.
- **`RetrievalQualificationPolicy.minGapMsForSpacedRetrieval` and
  `EvidenceStrengthPolicy` — unchanged**, ENGINEERING CALIBRATION with
  required product visibility; no accepted decision touched these, but
  engineering may propose a provisional starting value per the audit's
  original §7 guidance.

**No product blocker remains before implementation.** All four
policy groups a composition root needs now have an accepted, usable
starting value. A composition root (wherever it eventually lives — likely
`src/infrastructure/` or a new `src/app/` route-adjacent module) can now be
built end-to-end with explicitly-provisional values for all of
`TodayPlannerPolicy`, `MisconceptionPolicy`, and `MasteryPolicy` — nothing
is invented here beyond what each source document already accepted; this
is a Documentation update recording that fact, not new engineering work.
This does not mean these numbers are final — every value above remains a
configurable conservative default, explicitly subject to recalibration
once real pilot data exists, per each source document's own framing.

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

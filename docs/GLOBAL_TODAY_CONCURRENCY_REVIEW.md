# Global Today — Concurrency Review (DESIGN ONLY)

Status: **ANALYSIS ONLY — NOT AN ADR, NOT DECIDED, NOT IMPLEMENTED.**

This document analyzes concurrency surfaces Global Today would introduce or
touch, grounded in the actual committed mechanisms (`ADR-010`'s advisory
lock and idempotency model, `ADR-011`'s `TodaySession` uniqueness) and the
honesty framing `docs/INVARIANT_MATRIX.md` already established for what the
current test suite can and cannot prove. It implements nothing and invents
no new locking/uniqueness scheme as decided — it identifies what each
scenario needs and where the existing pattern already covers it.

Working assumption: the same Option C ("`GlobalTodayPlan` references
existing `TodaySessionItem` rows") lean used in
`docs/GLOBAL_TODAY_APPLICATION_FLOW.md` §0. Where a scenario's answer would
differ under Option A/B, that is noted.

Honesty bar, restated from `docs/INVARIANT_MATRIX.md`: **PGlite is one
process, one connection — it cannot observe two backends racing.** The
in-memory fakes (`in-memory-fakes.ts`) are explicitly single-threaded
no-ops for locking. Nothing below claims a NEW mechanism is "race-free" on
the strength of hand-tracing or a fake alone, when the existing rows
18/20 gaps already establish that even the CURRENT mechanisms of the same
class are unproven that way.

---

## 1. Two devices first-open Today at the same time (same view)

**Scenario**: learner opens Course Today for the same Course, same day, on
phone and laptop simultaneously. (The Global-view equivalent is scenario 3
below — this is the baseline, already-existing case, restated as the floor
every Global scenario is compared against.)

- **DB-level protections — existing**: `UNIQUE (user_id, course_id,
  planned_for_date)` on `today_sessions`.
- **Application-level protections — existing**: `createIfNotExists` =
  `INSERT ... ON CONFLICT DO NOTHING RETURNING` + fallback `SELECT`
  (`today-session.ts`, ADR-010/011). No advisory lock is used or needed
  here — the unique index itself is the serialization mechanism.
- **Idempotency keys involved**: none directly (this is a session-creation
  race, not an Attempt-submission race) — the "key" is the unique index
  tuple itself.
- **Where advisory locking would help / not needed**: not needed. This is
  exactly the case `INVARIANT_MATRIX.md` row 20 already documents as
  correctly designed around a unique index rather than a lock, because
  both racing transactions computing the SAME candidate plan and
  discarding one is acceptable (cheap, deterministic, no data loss) —
  unlike `UserQuestionProgress`, there is no accumulating counter that a
  lost race would corrupt.
- **What PGlite/fakes cannot prove**: `INVARIANT_MATRIX.md` row 20 — "Not
  provable with the current test suite... the fake cannot prove two REAL
  concurrent transactions racing the actual unique index." This scenario
  is not new; it is the existing confirmed gap.
- **What real Postgres must verify**: `docs/REAL_POSTGRES_VERIFICATION_PLAN.md`
  scenario 4, already designed, not yet executed.

---

## 2. Two tabs both trying to create a Daily Plan (Global)

**Scenario**: learner opens Global Today in two tabs at the same moment,
neither of which has generated anything yet for today.

- **DB-level protections — needed, PROVISIONAL**: a
  `UNIQUE (user_id, planned_for_date)` index on the new `GlobalTodayPlan`
  table — the direct Global analogue of `today_sessions`'s existing
  constraint. This is additive schema (`GLOBAL_TODAY_DESIGN_DRAFT.md` §8),
  not decided by this document, but it is the only mechanism consistent
  with every other "session-shaped" uniqueness already in this codebase.
- **Application-level protections — needed, PROVISIONAL**:
  `GlobalTodayPlanRepository.createIfNotExists` structurally identical to
  `TodaySessionRepository.createIfNotExists` — `INSERT ... ON CONFLICT DO
  NOTHING RETURNING` + fallback `SELECT`. Same reasoning as scenario 1: no
  advisory lock needed for the plan-row creation itself.
- **A GENUINELY NEW layer this scenario adds, absent from scenario 1**:
  before either tab's transaction reaches its own
  `INSERT ... GlobalTodayPlan`, EACH one independently runs
  `docs/GLOBAL_TODAY_APPLICATION_FLOW.md` §3's step (c) — calling
  `getOrCreateTodaySession` once per active Course. If tab A and tab B are
  racing, BOTH tabs' transactions may independently trigger
  `getOrCreateTodaySession` for the SAME Course at nearly the same moment.
  This nested race is exactly scenario 1, but now happening as a SIDE
  EFFECT of a Global-plan generation, potentially from inside a LARGER
  enclosing transaction rather than as its own top-level `submitAnswer`-
  style call. **Whether the per-Course `getOrCreateTodaySession` calls in
  step (c) run in their OWN sub-transactions or inside one single
  transaction spanning the whole Global-plan generation is not decided
  anywhere and materially changes the failure mode**:
  - if each per-Course call is its own transaction, a partial failure
    (e.g. the 3rd of 5 active Courses' generation throws) can leave the
    Global-plan generation with some Course sessions committed and others
    not, and no single transaction boundary to roll all of it back atomically;
  - if all of it runs in one enclosing transaction, `getOrCreateTodaySession`'s
    OWN internal `uow.runInTransaction` call (today-session.ts line 60)
    would need to become reentrant/nested-transaction-safe, which it is
    NOT designed for today — it assumes it owns the whole transaction it
    runs in.
  This is a genuinely new architectural question, not merely a race —
  flagged for `GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`, not resolved here.
- **Idempotency keys involved**: `(user_id, planned_for_date)` for the
  Global plan; `(user_id, course_id, planned_for_date)` for each
  constituent Course session — two different granularities racing
  together for the first time.
- **Where advisory locking may help**: a transaction-scoped advisory lock
  keyed by `(user_id, planned_for_date)` (Global, no course_id — a new key
  shape not used anywhere today), acquired BEFORE step (c)'s loop begins,
  would serialize two Global-plan generations for the same learner/day
  the same way ADR-010's lock serializes two first-Attempts — this is the
  closest existing pattern, but note it does NOT protect a Global
  generation racing a DIRECT Course-Today open for the same Course
  (scenario 3) unless that path takes the same lock too, which it
  currently has no reason to.
- **What PGlite/fakes cannot prove**: same class of gap as scenario 1,
  compounded by the reentrant-transaction question above, which is not
  even a "can PGlite prove this" question — it is a code-structure
  question that must be resolved before any test (real or fake) could
  meaningfully exercise it.
- **What real Postgres must verify**: a NEW scenario, not in
  `docs/REAL_POSTGRES_VERIFICATION_PLAN.md` today — analogous to that
  document's scenario 4, but for `GlobalTodayPlan`, AND additionally
  covering the nested multi-Course-session-creation path this scenario
  identifies as architecturally undecided.

---

## 3. Course Today and Global Today resolving the same item concurrently

**Scenario**: learner opens Course Today for Course A in one tab, Global
Today in another, at nearly the same moment, on a day where NEITHER
Course A's `TodaySession` NOR any `GlobalTodayPlan` exists yet.

- **DB-level protections — existing for the Course-session part**:
  `UNIQUE (user_id, course_id, planned_for_date)`, unaffected.
- **The NEW risk (per `GLOBAL_TODAY_DESIGN_DRAFT.md` §6/§7, restated
  precisely for Option C)**: under Option C, this is actually LESS risky
  than Option A/B would be, because a Global item is never an independent
  copy — it is a reference to the real `TodaySessionItem`. So there is no
  "same Question selected into two independent plans" double-write risk
  for the ITEM CONTENT itself. What remains is a race over WHICH
  transaction's candidate computation "wins" the Course A session
  creation: if the Global-Today tab's step (c) call and the direct
  Course-Today tab's call both attempt `getOrCreateTodaySession` for
  Course A at the same moment, this is EXACTLY scenario 1's race — one
  wins, one falls back to `SELECT`. The Global-Today tab's subsequent
  `GlobalTodayPlanItem` insert must reference whichever `TodaySessionItem`
  ids actually survived (the winner's), not ids it locally, speculatively
  computed before the fallback `SELECT` ran — a genuine ordering
  dependency inside the Global generation transaction that does not exist
  in today's single-Course flow at all.
- **Application-level protections — needed**: the Global-plan generation
  path must read back the WINNING `TodaySession`'s actual persisted
  `TodaySessionItem` ids (via the fallback `SELECT` path
  `getOrCreateTodaySession` already returns) before constructing
  `GlobalTodayPlanItem` rows — never construct them from its own
  locally-ranked, possibly-discarded candidate computation. This is a
  correctness requirement on the Global generation code, not a new
  locking primitive.
- **Idempotency keys involved**: none new — this composes the existing
  `(user_id, course_id, planned_for_date)` key with the new
  `(user_id, planned_for_date)` key from scenario 2.
- **Where advisory locking may or may not help**: locking is not what
  closes this race — reading the AUTHORITATIVE post-creation state (the
  unique-index winner) rather than a locally-computed value is what
  closes it, the same discipline `getOrCreateTodaySession` already
  applies to itself via its own fallback `SELECT`.
- **What PGlite/fakes cannot prove**: whether the Global generation code
  path actually re-reads the winner correctly under a REAL race (a fake
  or PGlite test can prove the SEQUENTIAL case — second call returns the
  first's session — but not that a genuinely concurrent Global-plan
  transaction observes and uses the winner's real ids rather than its own
  stale local computation).
- **What real Postgres must verify**: a NEW scenario — two connections,
  one running `getOrCreateTodaySession` directly, one running a Global
  generation that ALSO calls `getOrCreateTodaySession` for the same
  Course concurrently; assert the Global plan's persisted
  `GlobalTodayPlanItem` rows reference `today_session_item_id`s that
  actually exist and belong to the single winning `today_sessions` row —
  never orphaned/mismatched ids from a discarded candidate computation.

---

## 4. Skip vs. Complete race on the same item

**Scenario**: learner (or two devices/tabs for the same learner) issues a
skip for `TodaySessionItem` X and a `submitAnswer` completing X at nearly
the same moment.

- **DB-level protections — needed**: a `WHERE status = 'pending'` guard on
  BOTH the skip write and `markItemCompleted`'s write, so whichever
  transaction commits first "wins" the transition and the second either
  no-ops or is told the item is no longer pending, rather than silently
  overwriting `status`/`completedAt` a second time. This does not exist
  today because `markItemCompleted` (current single-writer path) has never
  had a status-transition competitor.
- **Application-level protections — needed**: the new `skipTodayItem` use
  case (`GLOBAL_TODAY_APPLICATION_FLOW.md` §8) and `submitAnswer`'s
  existing `markItemCompleted` call both need to check-and-report the
  PRE-transition status, and the caller needs a defined result for "item
  was already resolved by the other path" (e.g. a new result kind,
  analogous to `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED`, rather than
  silently succeeding twice).
- **Idempotency keys involved**: none directly for the skip write itself
  (skip has no `submissionId`-equivalent designed yet —
  `GLOBAL_TODAY_APPLICATION_FLOW.md` §8 flags this as new). A skip
  request has no natural idempotency key the way `submitAnswer` does
  unless one is added (e.g. a client-generated skip-action id) — a plain
  retry of a skip request (network timeout, double-click) has no
  documented safe-retry story yet; this is a genuine open gap the
  skip design must close, not something inherited safely from
  `submitAnswer`'s pattern.
- **Where advisory locking may help**: a transaction-scoped advisory lock
  keyed by `(user_id, today_session_item_id)` (a NEW lock granularity, not
  the existing `(user_id, question_id)` one — an item and a Question are
  not the same axis once skip exists as an independent per-item action),
  acquired by BOTH the skip and the complete path before reading/writing
  that item's status, would serialize the two the same way ADR-010's lock
  serializes first-Attempts. A `WHERE status = 'pending'` conditional
  UPDATE (an `UPDATE ... WHERE id = ... AND status = 'pending' RETURNING`
  pattern) could achieve the same outcome WITHOUT a new lock, closer to
  how `TodaySession` creation uses a unique index rather than a lock —
  this is likely the cheaper, more consistent-with-existing-style choice,
  but is not decided here.
- **What PGlite/fakes cannot prove**: whether the conditional-update (or
  lock) approach actually excludes the race under two REAL concurrent
  connections — same class of gap as rows 18/20, for a mechanism that
  does not exist yet.
- **What real Postgres must verify**: a NEW scenario (not in
  `REAL_POSTGRES_VERIFICATION_PLAN.md`) — two connections, one skipping
  and one completing the same `today_session_item_id` concurrently;
  assert exactly one transition wins and the loser observes a defined,
  non-corrupting outcome (not a silently overwritten `completedAt`, not
  an item that ends up both "skipped" AND has an `attempt_id` set).

---

## 5. Adaptation vs. completion race

**Scenario**: a significant-event adaptation (triggered by Attempt X's
processing) is, in the same transaction as X, about to replace/insert
future `TodaySessionItem` rows for a Course session, while — concurrently,
in a different transaction — the learner completes a DIFFERENT
not-yet-resolved item Y in that same session.

- **DB-level protections — needed**: adaptation's writes must be scoped to
  rows still `status = 'pending'` at write time (the same conditional
  pattern as scenario 4), so that if Y's completion commits first, Y is
  simply excluded from whatever the adaptation touches (adaptation
  should never revert an already-completed Y back toward "future" — the
  product rule "never touching already-completed items"
  (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12) makes this a hard correctness
  requirement, not just a performance nicety).
- **Application-level protections — needed**: adaptation's candidate
  selection (which pending items to replace/insert) should be computed
  from a read taken AFTER acquiring whatever lock/guard closes this race
  — not from a stale pre-transaction snapshot — mirroring ADR-010's
  "acquire lock, then read" ordering.
- **Idempotency keys involved**: none new for completion (unchanged,
  scenario 15 below); adaptation itself has no documented idempotency key
  yet — if `submitAnswer` retries (Flow 15) and the retry path
  SHORT-CIRCUITS before adaptation even runs (the existing fast-path
  return for a genuine retry, `submit-answer.ts`'s
  `findByUserAndSubmissionId` check), adaptation must not re-run a SECOND
  time for what is actually the same original Attempt — this needs
  explicit design once adaptation is built; not analyzed further in this
  document beyond flagging it.
- **Where advisory locking may help**: if adaptation and completion run
  as part of `submitAnswer`'s EXISTING `(user_id, question_id)` advisory
  lock (because both are triggered inside Attempt processing for
  different Questions in the SAME Course session), note the lock
  granularity is per-`(user, question)`, NOT per-session — two different
  Questions' Attempts in the same Course session can still run
  concurrently and both attempt to touch the SAME session's pending items
  from different transactions. A session-scoped guard (e.g. per-item
  conditional UPDATE, or a `(user_id, today_session_id)` advisory lock
  around the adaptation write specifically) is a genuinely new
  requirement the existing per-question lock does not cover.
- **What PGlite/fakes cannot prove**: this entire mechanism does not exist
  yet, so nothing today even attempts to prove it — flagged as a full new
  surface requiring its own future test design, not an extension of an
  existing unproven claim.
- **What real Postgres must verify**: to be designed once adaptation
  itself is designed (`docs/TODAY_ADAPTATION_MODEL.md`) — not yet
  scoped in `REAL_POSTGRES_VERIFICATION_PLAN.md`.

---

## 6. Adaptation vs. adaptation race

**Scenario**: two different Attempts (e.g. two Questions answered in quick
succession, possibly from two tabs) each independently qualify as a
significant event for the SAME Course session in the SAME short window.

- **DB-level protections — needed**: same conditional-on-`pending`-status
  writes as scenario 5 prevent a corrupted end state, but do NOT by
  themselves prevent the product-level violation product spec §12
  prohibits: "endless growth" / more than a SMALL cumulative change if two
  adaptations both fire and each independently adds items without
  awareness of the other's just-added items.
- **Application-level protections — needed**: whatever budget/limit
  TODAY_ADAPTATION_MODEL.md eventually defines for "small change" needs to
  be evaluated against the CURRENT persisted state at write time (read
  inside the same transaction, after any lock/guard is acquired), not
  against a pre-transaction count — otherwise two concurrent adaptations
  can each independently believe they are making the FIRST small change
  of the day and jointly exceed the intended cap. This is a genuine
  TOCTOU (time-of-check-to-time-of-use) risk specific to a budgeted/capped
  resource, distinct from the simpler "exactly one row survives" races
  above.
- **Idempotency keys involved**: none designed yet.
- **Where advisory locking helps**: a `(user_id, today_session_id)`
  advisory lock, held for the duration of an adaptation's read-budget-
  then-write sequence, is the natural mechanism here — unlike scenario 1's
  session-creation race (where a unique index suffices because there is no
  budget to protect, only single-row existence), a CUMULATIVE budget check
  genuinely needs the same "read under lock, then write" discipline
  ADR-010 uses for `UserQuestionProgress`, not a unique-index trick.
- **What PGlite/fakes cannot prove**: same as scenario 5 — nothing exists
  yet to test.
- **What real Postgres must verify**: to be designed alongside scenario 5,
  specifically covering the budget/cap TOCTOU case with two genuinely
  concurrent adaptation-triggering Attempts.

---

## 7. Midnight boundary race

**Scenario A — a session spanning midnight**: per
`GLOBAL_TODAY_APPLICATION_FLOW.md` §11, nothing server-side is clock-
driven, so there is no "server decides the day rolled over" race at all —
the only live question is whether an in-flight `submitAnswer` or skip
targeting day D's `todaySessionItemId`, submitted at local time just after
midnight, is processed correctly. It is: `submitAnswer` has no
date/day-boundary check anywhere in its validation chain (confirmed by
reading `submit-answer.ts` in full) — an Attempt against a `todaySessionItemId`
that happens to belong to a session dated "yesterday" is accepted exactly
like any other, because ownership/version/session-consistency checks are
the only gates, none of which reference `plannedForDate` or the current
wall-clock date. No new protection is needed for this half of the
scenario; it is already correct by the absence of a check that would
otherwise have to race a clock.

**Scenario B — a new plan-generation attempt arriving right at the
boundary**: two requests for `plannedForDate` computed as "D" and "D+1"
respectively (e.g. two devices with slightly different clocks, or a client
computing local-day right at the 00:00 instant) for the SAME learner.

- **DB-level protections — existing/needed**: this is NOT actually a race
  in the database sense — `(user_id, course_id, "D")` and
  `(user_id, course_id, "D+1")` are two DIFFERENT unique-index keys, so
  both `INSERT`s succeed independently, no conflict. The real risk is
  entirely an APPLICATION-layer correctness question (which date does
  EACH client compute), not a persistence race — `docs/OPEN_QUESTIONS.md`
  #3 / `docs/TODAY_TIMEZONE_EDGE_CASES.md` territory, not something a
  lock or unique index can resolve, since both rows being created is the
  CORRECT outcome if the two clients genuinely disagree about which local
  day it currently is.
- **Application-level protections — needed**: none at the concurrency
  level; this is a clock-skew/timezone-computation correctness problem,
  explicitly out of this document's scope (per the task framing, this
  document covers concurrency, not timezone semantics — see
  `docs/TODAY_TIMEZONE_EDGE_CASES.md`).
- **Idempotency keys involved**: the two different `plannedForDate`
  values ARE, in effect, two different idempotency scopes — this is
  working as designed, not a bug to fix here.
- **What PGlite/fakes cannot prove / what real Postgres must verify**: not
  applicable — there is no database-level race to prove here at all, only
  an application clock-computation question.

---

## 8. Archiving a Course while its Today is open in another tab

**Scenario**: learner archives Course A (sets `CourseMembership.archivedAt`)
in tab 1, while tab 2 has Course A's Today (or Global Today including
Course A's items) already open and, concurrently, the learner in tab 2
completes or skips one of Course A's items, or a Global-plan generation in
tab 2 is mid-flight and about to call `getOrCreateTodaySession` for Course
A for the FIRST time today.

- **DB-level protections — needed, PROVISIONAL**: none of the EXISTING
  completion/skip paths (`markItemCompleted`, the new skip use case) need
  to check `CourseMembership.archivedAt` at all — per
  `GLOBAL_TODAY_APPLICATION_FLOW.md` §13 step 4, archiving is explicitly
  NOT retroactive to an already-frozen item, and per ADR-015 §7, an
  archived Course "remains manually practiceable" — so tab 2 completing an
  already-frozen item is CORRECT behavior even if the archive committed a
  microsecond earlier. There is no race to close here, because both
  orderings (archive-then-complete, complete-then-archive) are equally
  valid outcomes.
- **The GENUINE race**: if tab 2's Global-plan generation had NOT yet
  called `getOrCreateTodaySession` for Course A (i.e. Course A's session
  for today does not exist yet) at the moment tab 1's archive commits, and
  tab 2's `CourseMembershipRepository.listActive(userId)` read (Flow 3
  step b) happens to run AFTER the archive commits, Course A is correctly
  excluded — no new item is generated for an already-archived Course. But
  if tab 2's `listActive` read happens to run BEFORE the archive commits
  (a completely ordinary race, not a bug), Course A's session IS generated
  for today, and product spec §17/ADR-015 accept this as correct too
  ("was active at the moment of that first open" — `GLOBAL_TODAY_APPLICATION_FLOW.md`
  §1 step 4's "generation uses ... state at the moment of that first
  open"). **This is not a race that needs closing — it is an inherent,
  accepted read-consistency boundary**, exactly analogous to any
  "state at time of generation, frozen after" read in this system.
- **Application-level protections — needed**: none beyond what already
  exists — `listActive` should be read inside the SAME transaction as the
  rest of Global-plan generation (ordinary transactional consistency, not
  a new concurrency primitive), so that within one generation attempt, the
  active-Course list is at least internally consistent (no Course
  half-counted).
- **Idempotency keys involved**: none new.
- **Where advisory locking may or may not help**: not needed — this is a
  case where "either outcome is correct" makes locking pure overhead with
  no correctness benefit, the same reasoning ADR-010 used to reject
  `SERIALIZABLE` isolation as broader than needed.
- **What PGlite/fakes cannot prove**: nothing to prove — there is no
  incorrect outcome for a fake or real Postgres to fail to reproduce, once
  `listActive` is read transactionally.
- **What real Postgres must verify**: nothing new beyond ordinary
  transactional-read correctness, already covered by existing patterns.

---

## 9. Answer retry — confirm no NEW idempotency risk

Per `GLOBAL_TODAY_DESIGN_DRAFT.md` §5's own finding, restated and
confirmed, not re-litigated: **`submitAnswer`'s idempotency model
(`UNIQUE (user_id, submission_id)`, canonical command-identity field
comparison) is entirely independent of which Today view (Global or
Course) presented the item.** Under Option C, a Global-Today-presented
item's `todaySessionItemId` IS the same real id a Course-Today-presented
item would carry — `submitAnswer` has no branch anywhere that inspects
"was this reached via Global or Course," and none is needed. This document
confirms this finding still holds after designing Flows 3/6/15 in
`GLOBAL_TODAY_APPLICATION_FLOW.md` in detail: nothing in those flows adds
a field, a branch, or a new comparison to `submitAnswer`'s existing
`CANONICAL_COMMAND_IDENTITY_FIELDS` list or `resolveLearningSessionId`.
The one place Global Today COULD have introduced a new idempotency
surface — if Option A/B had given Global its own independent Attempt-like
credit record — does not exist under the Option C lean this document and
`GLOBAL_TODAY_APPLICATION_FLOW.md` both assume.

---

## 10. Repeated `submitAnswer` calls

Not re-litigated in depth — this is exactly ADR-010's existing, already-
proven-by-pattern (not yet by real Postgres, per rows 18/20) mechanism,
unaffected by Global Today per scenario 9 above. The one NEW interaction
surface repeated `submitAnswer` calls create, specific to this session's
analysis, is scenario 5's "does adaptation re-run on a retry" question —
flagged there, not duplicated here.

---

## 11. Plan resume after stale client state

**Scenario**: a client holds a stale in-memory copy of a Global or Course
Today plan (e.g. backgrounded mobile app, long-idle tab) from EARLIER in
the day, and the learner acts on an item using stale local state — e.g.
the client believes item X is still "pending" when it was already
completed/skipped via a different device in the meantime, or the client
attempts to act on an item that a significant-event adaptation (scenario
5/6) has since replaced.

- **DB-level protections — existing/needed**: for completion — the
  existing `TodaySessionItem` ownership/consistency checks in
  `submitAnswer` (`todaySessionItem.userId`/`questionId`/`questionVersionId`
  match) already reject a stale client's attempt to submit against an item
  that has since been REPLACED by an adaptation (a replaced item would
  have a different `todaySessionItemId`, or the same id with different
  `questionVersionId` if content rotated — either mismatch throws
  `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED` or
  `QUESTION_VERSION_CONSISTENCY_VIOLATION` today). For an item ALREADY
  completed by another device: `submitAnswer` does not currently check
  "is this item still pending" before processing a NEW Attempt against
  it — it happily processes a second, DIFFERENT `submissionId` against an
  already-`completed` item, producing a legitimate second Attempt and
  RE-RUNNING `markItemCompleted` (idempotent at the row level — setting
  `completed_at`/`attempt_id` again is not harmful on its own) but this
  means a stale client can silently generate what LOOKS like a duplicate
  "completion" using a genuinely different Attempt/submissionId, which is
  a real evidence question (a second real Attempt on an already-completed
  Question is ordinary retrieval practice, not a bug) but a real UX/product
  question ("should re-answering an already-completed Today item from
  stale state count toward Today, or just update mastery like Manual
  Practice would") that this document flags as unresolved, not a
  concurrency defect — the DATA stays consistent either way (evidence-
  wise), only the "what does the UI say happened" story is ambiguous, and
  that is a product decision, not a locking gap.
- **For skip** (once built): the `WHERE status = 'pending'` guard from
  scenario 4 is exactly what protects a stale client from skipping an
  item another device already completed (or vice versa) — the stale
  client's skip attempt would see zero rows affected and should surface a
  defined "already resolved" result rather than silently succeeding.
- **Idempotency keys involved**: unchanged — `submissionId` for
  completion; a to-be-designed skip-action id for skip (scenario 4).
- **Where advisory locking may help**: none beyond what scenarios 4/5
  already establish — this scenario is really "what happens when a
  correctly-guarded action arrives against already-resolved state," not a
  new race in itself.
- **What PGlite/fakes cannot prove**: whether a real second connection's
  stale-state action, arriving concurrently with (not just after) the
  resolving action from another device, observes the guard correctly —
  same class of gap as scenario 4, not a separate mechanism.
- **What real Postgres must verify**: covered by scenario 4's proposed new
  test once skip exists; for completion, no new mechanism is proposed
  here (the ownership/consistency checks are existing and already
  covered by `submit-answer.test.ts`'s ownership tests, at the fake-DB
  level).

---

## Summary table

| # | Scenario | New DB mechanism needed? | New app mechanism needed? | Advisory lock or unique index? | Proven today? |
|---|---|---|---|---|---|
| 1 | Two devices, same Course Today | No (existing) | No (existing) | Unique index (existing) | No — confirmed gap, row 20 |
| 2 | Two tabs create Global plan | Yes — `GlobalTodayPlan` unique index | Yes — nested multi-Course orchestration, transaction-boundary question unresolved | Unique index for plan row; lock candidate for the `(user, date)` orchestration span | No — new surface, no test exists |
| 3 | Course + Global resolve same item concurrently | No new constraint | Yes — must re-read winner's real item ids, not local computation | Unique index (existing, reused) | No — new surface |
| 4 | Skip vs. Complete | Yes — conditional-on-status write | Yes — new skip use case, new result kind for "already resolved" | Conditional UPDATE preferred over new lock | No — mechanism doesn't exist yet |
| 5 | Adaptation vs. completion | Yes — conditional-on-status write | Yes — adaptation must read post-lock state | Session-scoped lock likely needed (existing per-question lock insufficient) | No — mechanism doesn't exist yet |
| 6 | Adaptation vs. adaptation | Yes — same as 5, plus budget check | Yes — budget check must be read-under-lock, not pre-transaction | Session-scoped lock (TOCTOU protection) | No — mechanism doesn't exist yet |
| 7 | Midnight boundary | No (not a DB race) | No (clock-computation problem, not concurrency) | Neither | N/A |
| 8 | Archive during open Today | No | No (either ordering is correct) | Neither | N/A — no incorrect outcome exists |
| 9 | Answer retry / Global | No (confirmed unchanged) | No (confirmed unchanged) | Existing advisory lock, unaffected | Same as existing rows 18 |
| 10 | Repeated submitAnswer | No (confirmed unchanged) | No (confirmed unchanged) | Existing | Same as existing rows 18 |
| 11 | Stale client resume | No new constraint for completion; conditional write for skip | Flagged product-decision (does stale re-completion count), not a data-integrity gap | Scenario 4's mechanism, once built | No — depends on scenario 4 |

## What this confirms about the existing honesty framing

Every scenario above that reuses an EXISTING mechanism (1, 3, 9, 10)
inherits that mechanism's EXISTING unproven status (`INVARIANT_MATRIX.md`
rows 18/20) rather than introducing a new one. Every scenario that
proposes a NEW mechanism (2, 4, 5, 6) is explicitly marked "no test
exists" — this document does not claim any new design is race-free by
hand-tracing alone, consistent with the bar `INVARIANT_MATRIX.md` already
set for the CURRENT mechanisms of the same class. `docs/REAL_POSTGRES_VERIFICATION_PLAN.md`
exists and defines scenarios 1–6 for the CURRENT system; scenarios 2–6
above are new additions that document would need to grow into once each
mechanism is actually designed (they cannot be scoped as concretely as
that document's existing scenarios are, because — unlike advisory-lock
and `TodaySession` creation — the underlying mechanisms for
`GlobalTodayPlan` creation, skip, and adaptation do not exist yet to write
concrete SQL/assertions against).

## Related Documents

- `docs/GLOBAL_TODAY_APPLICATION_FLOW.md` (companion document, this
  session — flows referenced by number above)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (§6 double-counting, §7 concurrency)
- `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` (persistence-shape decision,
  written in parallel — the reentrant-transaction question in scenario 2
  is a direct input to that decision)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`,
  `011-today-is-course-scoped-v1.md`
- `docs/INVARIANT_MATRIX.md` (rows 18, 20 — the honesty bar this document
  applies to every new claim)
- `docs/REAL_POSTGRES_VERIFICATION_PLAN.md` (scenarios 1–6, existing;
  scenarios needed for `GlobalTodayPlan`/skip/adaptation are new, not yet
  added there)
- `src/application/learning/submit-answer.ts`, `today-session.ts`,
  `ports.ts`

# Global Today — Architecture Review (PROPOSAL ONLY)

Status: **ARCHITECTURE COMPARISON AND PROPOSAL — NOT AN ADR, NOT DECIDED, NOT
IMPLEMENTED.** This document does not modify
`docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011), which remains
the current accepted V1 behavior until a future ADR explicitly supersedes it.
Nothing here is authorized to be built from this document alone.

**Reconciliation note (post-decision):** Dor's product-owner review has since
**ACCEPTED this document's recommended Option A** — a single
`DailyPlan`/`DailyPlanItem` entity, with Course Today served as a pure
read-time filter (this document's Option D) — as the architecture, formalized
in `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016, now Status: ACCEPTED) and `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`
§1. ADR-011 is correspondingly superseded on this point, not merely
proposed-against. Everything below remains the reasoning trail for *why* —
it is not rewritten, since the comparative analysis (why A beat B/C/D/E) is
still the historical justification for the now-accepted choice. Only the
recommendation in §4 has moved from PROPOSAL to ACCEPTED; the "explicitly not
decided by this recommendation" list in §4 still stands except where the 9
accepted decisions elsewhere resolve it (see
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`).

This document compares persistence architectures for Global Today given the
now-accepted product direction in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
(status: product direction accepted by Dor, not yet an ADR) and the prior
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (status: design impact analysis only,
written earlier in this session, before the product spec's exact "one plan,
not two" framing was finalized). Every technical claim below is grounded in
committed code/schema, cited by file path.

---

## 0. Lettering note — this document uses A–E, DIFFERENT from the design draft's A/B/C

The design draft already proposed three options, labeled A/B/C there. This
document is asked to independently compare a different five-option split,
labeled A–E here. **These are two different lettering schemes for
overlapping territory — do not conflate "Option A" between the two
documents.** A cross-reference table:

| This document | Design draft | Relationship |
|---|---|---|
| **A** — Replace `TodaySession` with a `DailyPlan` entity (recommended) | Option A (own persisted entity) | Same table SHAPE, but this document's A **replaces** Course-scoped generation entirely; the design draft's A was explicitly **additive** (kept per-Course sessions running independently, added Global alongside) |
| **B** — Keep `today_sessions`, make `course_id` nullable | *(no equivalent — novel)* | Not considered in the design draft; shown below to be the technically weakest option for a concrete Postgres reason the design draft did not need to find |
| **C** — Persist one Global `DailyPlan`, keep old tables running (additive) | Option A (own persisted entity) | This is the *literal* match for the design draft's Option A — a new entity added **alongside** unchanged per-Course `today_sessions` |
| **D** — Persist the global plan; Course Today is always a pure `WHERE course_id = X` read filter, never its own row | Option B (pure read-time composition) — **inverted** | Design draft's B derives **Global from Course** (aggregate N per-Course sessions into one view). This document's D derives **Course from Global** (filter one persisted plan's items down to one Course) — the mirror image. See §3.4/§4 for why the inversion is the single most important finding of this document. |
| **E** — no materially better option found | Option C (hybrid reference table) | Discussed and explicitly **not** adopted — see §4's disagreement with the design draft's own lean |

---

## 1. Product constraints that filter the option space

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (accepted direction, read in full) fixes
several things the design draft could only discuss as open questions.
These now act as hard filters on architecture, not preferences:

- **§3: "Global Today and Course Today are different VIEWS of the SAME
  plan (not two plans)."** Completing an item via either view resolves the
  same underlying record. This is stronger than the design draft's framing
  ("Global Today is ALSO available," §1 of the design draft), which left
  open whether Course Today sessions continue to be generated independently
  of Global Today. The product spec forecloses that: there is exactly **one**
  generation event, one record, per user per day.
- **§5/§11: the plan is generated once (first Today-open of the day,
  whichever view), persisted, and frozen by default.** This rules out any
  architecture where Global Today is computed fresh on every read with
  nothing persisted (design draft's Option B, taken literally, without a
  persisted plan) — there is nothing to freeze if nothing is stored.
- **§17 (ADR-015):** only non-archived, non-revoked `CourseMembership` rows
  feed generation. This is an application-layer candidate-pool filter, not a
  schema concern for any of the options below — it applies identically to
  all of them.
- **§7:** no per-Course quota/fairness/floor in ranking. This has no
  schema consequence either — `rankNextBestActionCandidates`
  (`src/domain/learning/next-best-action-ranking.ts`) already ranks a merged
  candidate pool with no Course-awareness (design draft §3, confirmed by
  reading the file: `NextBestActionCandidate` carries no `courseId` field).

Given §3 specifically, **any option that keeps Course Today as an
independently-generated session (i.e. ADR-011's current model, unmodified,
running forever alongside a new Global concept) is already in tension with
the accepted product direction**, not merely an inferior implementation
choice. This is the central fact that separates this document's conclusion
from the design draft's lean — see §4.

---

## 2. The options, in detail

### Option A — Replace `TodaySession` with a `DailyPlan` entity (RECOMMENDED)

One new pair of tables, e.g. `daily_plans` (`UNIQUE (user_id,
planned_for_date)`, no `course_id` at all) and `daily_plan_items` (one row
per planned Question, each carrying **its own** `course_id`, independent of
any other item's Course). `today_sessions`/`today_session_items` stop
receiving new writes going forward; existing rows and FKs are left in place,
not dropped (see `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` for the exact
migration posture). Course Today is `SELECT ... FROM daily_plan_items WHERE
daily_plan_id = X AND course_id = Y ORDER BY position` — a query, not a
second persisted concept. Global Today is the same query without the
`course_id` filter.

**Why this is not the same as the design draft's Option A**: the design
draft's Option A kept ADR-011's per-Course generation running, side by side,
requiring an explicit new cross-table double-counting guard (design draft
§6/§9, "a genuine gap... most likely by having whichever generation runs
second exclude Questions already claimed by the other"). Option A **here**
has no second generation path to reconcile with — Course Today never
independently selects anything; it only ever reads a subset of what Global
generation already selected. Double-counting is closed **by construction**:
`UNIQUE (daily_plan_id, question_id)` (the same constraint shape
`today_session_items` already has: `UNIQUE (today_session_id, question_id)`)
makes it structurally impossible for the same Question to occupy two rows
in one day's plan, because there is only ever one row, one table, one
generation event.

**Per-dimension analysis:**

- **Conceptual clarity**: Matches the product's own mental model (§2 of the
  spec: "There is one Today") almost exactly — one entity per user per day.
  Global/Course/Manual map to "no filter" / "filter by course_id" / "a
  different code path entirely," respectively.
- **Schema change**: Two new tables. Item shape mirrors
  `today_session_items` closely (`docs/PERSISTENCE_SCHEMA_V1.md`'s column
  list: `position`, `question_id`, `question_version_id`, `action_type`,
  `tier`, `other_applicable_types`, `reasons`, `status`, `completed_at`),
  plus a `course_id` that is now a first-class, independently-varying item
  column rather than a value inherited from (and forced equal to) a single
  parent session's Course. See `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` for
  the full proposed shape.
- **Compatibility with ADR-011**: Requires ADR-011 to be **superseded, not
  merely amended** — its core decision ("Today is course-scoped... `UNIQUE
  (user_id, course_id, planned_for_date)`") is replaced outright. This is
  not a violation of ADR-011's own intent: ADR-011's Decision section
  explicitly states "Global, cross-course Today... is explicitly deferred
  beyond V1 — not implemented, not designed further here" and "not for all
  time — a future cross-course Today remains an available extension, not a
  closed door." A future ADR superseding ADR-011 is exactly the reopening
  ADR-011 itself anticipated, not a reversal of it.
- **Migration difficulty**: Low, confirmed by checking both existing
  migrations (`supabase/migrations/20260917203000_initial_schema.sql`,
  `20260918000000_question_answer_model_v1.sql`) for `insert into` — neither
  contains any seed/backfill data. No production Today data can exist yet.
  The new tables are purely additive; no existing table's column or
  constraint changes.
- **Frozen-plan semantics**: Reuses ADR-010's exact frozen-column list
  (`position`, `action_type`, `tier`, `other_applicable_types`, `reasons`,
  `question_version_id`) verbatim, just relocated to `daily_plan_items`. No
  new freeze policy is invented.
- **Course Today filtering approach**: A pure read-time `WHERE` filter over
  already-frozen, already-persisted rows. Never its own write path, never
  its own generation trigger, never its own "session" identity distinct from
  the one `DailyPlan` row.
- **Manual Practice separation**: Unaffected in substance. `submitAnswer`'s
  `todaySessionItemId === null` branch (`src/application/learning/submit-answer.ts`)
  becomes, mechanically, `dailyPlanItemId === null` — a rename/retarget of
  which table the non-null id points at, not a semantic change. See
  `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` for explicit confirmation.
- **Idempotency**: ADR-010's `UNIQUE (user_id, submission_id)` and its
  canonical command-identity field list (`submit-answer.ts`'s
  `CANONICAL_COMMAND_IDENTITY_FIELDS`) are untouched — `todaySessionId`/
  `todaySessionItemId` remain client-command-identity fields, now pointing
  at the new tables. No new idempotency risk introduced (matches design
  draft §5's finding that idempotency itself was never the real risk).
- **`learningSessionId` derivation (ADR-012 §5)**: This is where Option A
  gives the cleanest possible answer to the exact question the design draft
  raises in its §5/§11 as unresolved: "if the same Question is reached via
  both a Global item and a Course item with different session ids, should
  retrieval-qualification treat two same-day attempts as same-session or
  different-session evidence?" Under Option A **there is only ever one
  candidate session id for that Question that day** — `DailyPlanItem
  .dailyPlanId` — because there is only one row. A learner reaching the same
  Question via Global Today or via a Course-filtered view of the identical
  row derives the identical `learningSessionId` every time, by construction.
  The open product question the design draft flags is not answered here —
  it is made **inapplicable**, because the situation it describes (two
  different session ids for the same Question, same day) cannot arise under
  this schema. This is the single strongest architectural argument for
  Option A found in this review.
- **Resume behavior**: Symmetric with today's: `findByKey({userId,
  plannedForDate})` (no `courseId` parameter) returns the frozen plan;
  opening Global or Course Today both resolve to the same lookup, differing
  only in whether a `course_id` filter is applied to the returned items.
- **Skip**: `daily_plan_items.status = 'skipped'` — the same column, same
  three-value domain (`pending`/`completed`/`skipped`) `today_session_items`
  already has (`docs/PERSISTENCE_SCHEMA_V1.md` §`today_session_items`), just
  now actually exercised (see §"currently-unused candidate value" note in
  the persistence plan). Skipping via any view resolves the one row every
  other view sees.
- **Adaptation (§12-style mid-day mutation)**: Not solved by table shape
  alone under any option — this is a genuinely new write path regardless
  (design draft §7 already establishes this; not re-litigated here). Under
  Option A it only ever needs to touch one table (`daily_plan_items`) rather
  than reconciling a mutation across two independently-generated
  representations. See `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` for the
  proposed append-only adaptation-event log.
- **Historical auditability**: One coherent per-day record answers every
  §18 history question (which Courses were represented, in what order, what
  was completed/skipped, when) with a single query against
  `daily_plan_items` for one `daily_plan_id` — no cross-table reconciliation
  between a Global representation and N Course representations is ever
  needed, because there is only one representation.
- **Concurrency**: The creation race is structurally identical to today's —
  `INSERT ... ON CONFLICT DO NOTHING RETURNING` + fallback `SELECT` against
  a new `UNIQUE (user_id, planned_for_date)` key, the same mechanism
  `getOrCreateTodaySession` (`src/application/learning/today-session.ts`)
  already uses. **This document makes no stronger race-freedom claim than
  the existing one.** `docs/INVARIANT_MATRIX.md` row 20 already documents
  that even today's `UNIQUE (user_id, course_id, planned_for_date)`
  race-freedom is "confirmed real gap... requires a real multi-connection
  Postgres instance, cannot be proven by PGlite/in-memory fakes." The
  identical honesty applies to a new `UNIQUE (user_id, planned_for_date)`
  key: structurally the same protection, equally unproven by the current
  test suite, and it would need its own entry alongside
  `docs/REAL_POSTGRES_VERIFICATION_PLAN.md`'s existing scenarios 1/2/4 —
  not claimed proven here. The mid-day adaptation write path (§12) is a
  **new** concurrency surface under every option, with no existing
  precedent to inherit safety from (design draft §7's "Mid-day 'significant
  event' replanning" finding applies unchanged).
- **Timezone/day identity**: `planned_for_date` remains a caller-supplied
  `DATE`, exactly as ADR-010 specifies ("no day-boundary or timezone logic
  exists in the domain or persistence layer" — `docs/OPEN_QUESTIONS.md` #3
  remains open, unaffected by this document). Option A does not need to
  solve this; it inherits the identical open status. If anything, it
  slightly *simplifies* the reasoning versus a multi-session world, since
  there is exactly one date decision per learner per day rather than N
  independent per-Course ones that could theoretically (never actually, per
  the product's own description) drift apart.
- **Testability**: The in-memory fake for `TodaySessionRepository`-shaped
  logic becomes simpler under Option A (one entity, no N-session
  reconciliation layer to fake). New golden-scenario coverage
  (`docs/GOLDEN_SCENARIOS.md`) would need multi-Course, single-plan cases.
  The real-Postgres gap classes in `docs/INVARIANT_MATRIX.md` (rows 18, 20)
  get one new, structurally identical instance to eventually verify — not
  a new class of gap.
- **Future institutional compatibility**: A per-item `course_id` already
  scales cleanly to more concurrent Courses per learner; ADR-015's
  `CourseMembership.archivedAt`/`revokedAt` already governs candidate-pool
  eligibility at the application layer, independent of how the plan itself
  is shaped. No institutional-layer rework implied.

### Option B — Keep `today_sessions`, make `course_id` nullable

A "global" row would have `today_sessions.course_id = NULL`, coexisting with
(or replacing, for that day) per-Course rows, with items carrying whatever
Course they actually belong to.

**This is technically the weakest option, for a concrete reason the design
draft did not need to find**, because it never considered reusing the same
table: `today_session_items`' actual composite FK, as implemented
(`supabase/migrations/20260917203000_initial_schema.sql`), is `(today_session_id,
user_id, course_id) REFERENCES today_sessions (id, user_id, course_id)`.
Postgres composite foreign keys under the default `MATCH SIMPLE` semantics
require the **referenced** row to exist with the **exact** column values the
child asserts. If a "global" `today_sessions` row has `course_id = NULL` but
one of its items genuinely belongs to `course_id = 'A'`, there is no parent
row with `course_id = 'A'` to satisfy that composite FK — the insert would
be rejected outright, not silently accepted. Making this work requires
**dropping** the existing composite FK and rebuilding two independent ones
(item → session on `today_session_id` alone; item → Course consistency via
the existing `(question_id, course_id)` composite FK, unchanged) — which is
exactly the schema surgery Option A performs on a **fresh** table, except
Option B performs it on a **live** table whose `course_id NOT NULL` +
concrete FK was itself ADR-011's own explicit, tested, decided artifact
(`docs/DECISIONS/011-today-is-course-scoped-v1.md`'s Consequences section:
"`today_sessions.course_id` becomes `NOT NULL`... no longer marked
unresolved"). Reopening that specific column's nullability reads as directly
overturning ADR-011's concrete decided shape, not merely superseding its
policy conclusion with a new one (which Option A does more cleanly, via a
new table). Ranked lowest of the four schema options for this reason, not
merely on aesthetic grounds.

Every other dimension for B tracks close to Option A/C's answers (same
frozen-column reuse, same idempotency model, same `learningSessionId`
simplification once course_id is nullable and items carry their own Course)
— the FK-surgery-on-a-live-decided-column cost is what disqualifies it, not
a difference in the target end-state shape.

### Option C — Persist one Global `DailyPlan`, keep old tables running (additive)

Identical table shape to Option A, but `today_sessions`/`today_session_items`
keep being **actively used** for Course Today going forward — i.e. Course
Today continues to be its own independently-generated ADR-011-model session,
and the new Global tables are added **alongside** it, not in place of it.
This is the literal match for the design draft's Option A (see §0's mapping
table).

This inherits every con the design draft's own §9 already lists for its
Option A: a genuinely new subsystem, duplicated freeze/completion mechanics,
and — critically — it does **not** close the double-counting risk (design
draft §6) by construction, because two independent generation paths still
exist and must be reconciled after the fact (e.g. "whichever generation
runs second excludes Questions already claimed by the other" — a real,
non-trivial, cross-table synchronization rule that Option A never needs).
It also reopens the exact `learningSessionId` ambiguity Option A dissolves
(§2's Option A analysis above) — two independently-generated rows for the
same Question genuinely can carry two different session ids, so the
retrieval-qualification "same-session vs different-session" question design
draft §11 Q3 poses would need an actual product answer here, not just a
schema choice.

Its one advantage over Option A: it is more incrementally deployable — the
existing per-Course product surface keeps working, untouched, while Global
Today ships as a genuinely separate, additive feature, at the cost of
carrying the double-counting/session-identity problems indefinitely (or
until a later migration collapses it into Option A anyway).

### Option D — Persist the global plan; Course Today is always a pure read-time filter

As described in §0, this is not a fifth competing schema — it is the
**query/serving contract** that Option A already adopts (Course Today never
materializes its own row; it is always `WHERE course_id = X` over the one
persisted plan). It is listed separately here because the task frames it as
a distinct option, and because it is worth being explicit that this
contract is what actually delivers the product's §3 "same record, no
double-counting" requirement — Option C does **not** get this property just
by also having a Global table, because Course Today under C still writes
its own independent rows. **D's guarantees are only fully realized when
paired with A** (single source of truth); paired with C, a caller could
still reach the old, independently-written `today_session_items` path
during any transition window, silently reintroducing exactly the
double-counting risk D is meant to close.

### Option E — no materially better model found

The closest additional candidate this review considered is the design
draft's own Option B (pure read-time aggregation over existing per-Course
sessions, zero new schema at all). It is **disqualified outright**, not
merely ranked lower, by `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §5/§11's
frozen-persisted-plan requirement: a model with nothing persisted has
nothing to freeze, and "frozen by default... only a significant learning
event may cause a small change to future items" presupposes a durable row
whose fields can meaningfully NOT be recomputed. No option beyond A/C/D
(D being A's serving contract) was found in the current codebase or the
design draft that both satisfies this requirement and improves on A.

---

## 3. Summary comparison

| Dimension | A (recommended) | B | C | D |
|---|---|---|---|---|
| Double-counting | Closed by construction (`UNIQUE(daily_plan_id, question_id)`, one row) | Closed by construction once FK surgery is done | NOT closed by construction — needs a cross-table guard | Same as A (D is A's read contract) |
| `learningSessionId` ambiguity (ADR-012 §5) | Dissolved — only one possible id per item | Dissolved, same reason as A | Reopened — two independent rows can genuinely differ | Same as A |
| ADR-011 | Superseded | Superseded (via a riskier live-column change) | Left standing, alongside a new duplicate concept | N/A (query contract) |
| Migration risk | Low — additive, no seed data exists | Medium/high — composite FK surgery on a decided, live column | Low schema risk, but permanent product/behavioral duplication | N/A |
| Frozen-plan fit | Direct reuse of ADR-010's column list | Same | Same, duplicated across two tables | Same as A |
| Testability | Simpler — one entity | Similar to A once FK issue is resolved | More complex — two representations to reconcile in tests | N/A |

---

## 4. Recommendation — **PROPOSAL, NOT DECIDED**

**This section is a proposal only. It has not been approved by the product
owner and must not be implemented from this document alone.**

**Recommended: Option A** — replace `today_sessions`/`today_session_items`
with a single `DailyPlan`/`DailyPlanItem` entity, superseding ADR-011,
with Course Today implemented purely as Option D's read-time filter over
that one entity.

**The strongest reason**: the accepted product direction (§3 of
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`) states Global and Course Today are
views of the **same** plan, not two plans. Given that hard constraint, the
double-counting risk (design draft §6), the frozen-plan/finish-line
semantics (design draft §1, product spec §5/§6/§11), and the
`learningSessionId`/retrieval-qualification ambiguity (design draft §5,
ADR-012 §5) are all most cleanly resolved by making it structurally
**impossible** for two representations of the same day's plan to exist at
all — not by building a mechanism to reconcile two representations after
the fact. Options B/C/(the design draft's own Option A) all require some
form of that reconciliation machinery; Option A requires none, because
there is nothing to reconcile.

**Explicit cross-check against the design draft's own lean (its Option
C, the hybrid reference table): this document disagrees, with reasons.**
The design draft leaned toward its Option C because, at the time it was
written, it was solving a harder-seeming problem: reconciling two
**independently generated** things (a Global session and N Course sessions)
without duplicating content, given a product framing that had not yet
foreclosed independent per-Course generation continuing forever
(`docs/GLOBAL_TODAY_DESIGN_DRAFT.md`'s own §1 states this as a live
ambiguity: "Whether 'Home has a Global Today' means Global Today *replaces*
Course Today... is not stated by the product direction as given"). The
hybrid's whole value proposition — "closes §6's double-counting risk by
construction... while still giving Global Today its own frozen-plan
identity... without duplicating the entire freeze/completion state machine"
— is a genuinely good answer to *that* problem. But
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`, written and accepted after the design
draft in this same session, resolves the ambiguity the hybrid was designed
around: §3 states plainly that Course Today is a view of the same plan, not
an independent plan. Once independent per-Course generation is off the
table by product decision, the problem the hybrid solves (reconciling two
independent generations without duplicating content) no longer exists to be
solved — a single entity with item-level Course tagging satisfies every
constraint the hybrid was reaching for, with strictly less machinery (no
reference table, no "does the referenced `today_session_item_id`'s parent
session still agree with what the reference recorded" invariant, which the
design draft's own §9 flags as "a genuinely new invariant to maintain" for
its Option C). This document's disagreement is therefore not a rejection of
the hybrid's reasoning — it is an update to a premise the hybrid's reasoning
correctly depended on at the time, which the product spec has since
resolved differently than "keep independent per-Course generation."

**What is explicitly NOT decided by this recommendation**: whether Global
Today replaces Course Today as the Home entry point (design draft §11 Q1,
product spec §20, still open); the exact "significant learning event"
definition (§12); exact timezone/day-boundary mechanics beyond the
qualitative rule already stated (§15, `docs/TODAY_TIMEZONE_EDGE_CASES.md`);
and — as with every option compared here — **no claim of proven
race-freedom for any new unique-index-based creation path is made**; that
requires real multi-connection Postgres testing, per
`docs/INVARIANT_MATRIX.md` rows 18/20's already-documented honesty bar, not
extended by this document into a false confidence for a key that does not
exist yet.

---

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (primary product-language reference,
  accepted direction)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (prior impact analysis, cross-referenced
  throughout — see §0's lettering-mapping table)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011 — would be
  superseded, not amended, under the recommended option)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (ADR-010 —
  freeze model, advisory-lock/idempotency pattern reused unchanged)
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
  (ADR-012 §5 — `learningSessionId` ownership; this document's central
  finding)
- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  (ADR-015 — archive/revoke semantics feeding the candidate pool, unaffected
  by this document's schema choice)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items` —
  exact existing column/constraint ground truth)
- `docs/INVARIANT_MATRIX.md` (rows 18, 20 — the honesty bar for any new
  unique-index race-freedom claim)
- `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` (this review's companion document
  — the concrete proposed migration shape for the recommended option)
- `src/application/learning/submit-answer.ts`, `today-session.ts`, `ports.ts`
- `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`,
  `today-planner.ts`
- `supabase/migrations/20260917203000_initial_schema.sql`,
  `20260918000000_question_answer_model_v1.sql`

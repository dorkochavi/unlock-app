# Global Today — Persistence Plan (PROPOSAL ONLY, NO MIGRATION WRITTEN)

Status: **PERSISTENCE DESIGN PROPOSAL — NOT AN ADR, NOT DECIDED, NOT
IMPLEMENTED, NO MIGRATION FILE EXISTS FOR THIS.** This document designs a
future migration in prose/table form only. It does not create, edit, or
suggest editing any file under `supabase/migrations/`. It builds on the
architecture recommended (as a proposal, not a decision) in
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` — **Option A**: a single
`DailyPlan`/`DailyPlanItem` entity replacing `today_sessions`/
`today_session_items` for future Today generation, with Course Today served
as a pure read-time filter (that review's Option D) over the same rows.

If a different option from that review is ultimately chosen, this specific
plan does not apply as written — it is scoped to Option A only, per the
task that produced it.

**Reconciliation note (post-decision):** Option A is no longer merely the
companion review's recommendation — it is now the **ACCEPTED** architecture,
per `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016, Status: ACCEPTED) and `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`
§1. This document's proposed `daily_plans`/`daily_plan_items`/
`daily_plan_adaptation_events` shape is therefore the accepted direction for
a future migration, not a hedged proposal among competing options — though,
as stated throughout, **no migration file has been written**, and every
exact column/index/constraint choice below remains a concrete implementation
proposal, not itself separately ratified line-by-line.

---

## 1. Proposed tables

### `daily_plans`

One row per learner per local day — the single plan Global Today and every
Course Today view read from.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` (mirrors `today_sessions.user_id`) |
| `planned_for_date` | date | no | caller-supplied logical date, same contract as `today_sessions.planned_for_date` — see §3 |
| `status` | text | no | candidate values reused from `today_sessions.status` (`prepared`/`started`/`completed`/`expired`/`abandoned`) — exact state machine remains DEFERRED, same honesty as `docs/PERSISTENCE_SCHEMA_V1.md` already states for the existing table; not resolved by this document |
| `engine_version` | text | no | planner version, same as `today_sessions.engine_version` |
| `generated_at` | timestamptz | no | default `now()` |
| `started_at` | timestamptz | yes | first item interacted with, either view |
| `completed_at` | timestamptz | yes | see §7 for the distinction from item-level `resolved_at` |

**Uniqueness**: `UNIQUE (user_id, planned_for_date)` — this is the schema-level
enforcement of "one Daily Plan per user per local day" (see §11). Also
`UNIQUE (id, user_id)`, existing purely so `daily_plan_items` can
composite-FK against it, mirroring exactly why `today_sessions` currently
carries `UNIQUE (id, user_id, course_id)`.

### `daily_plan_items`

The frozen plan content, one row per planned Question — the direct successor
to `today_session_items`, with one structural difference: `course_id` is a
genuinely independent, per-item fact, not a value forced equal to a single
parent session's Course.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `daily_plan_id` | uuid | no | see composite FK below |
| `user_id` | uuid | no | denormalized from `daily_plans.user_id` at insert time — same reason `today_session_items.user_id` is denormalized today: supports the ownership-enforcing composite FK from `attempts` |
| `course_id` | uuid | no | **not** forced equal to a parent's single Course — this item's own Course, independently |
| `position` | int | no | `CHECK (position >= 0)`, 0-based — see §8 |
| `question_id` | uuid | no | see composite FK below |
| `question_version_id` | uuid | no | resolved by the application layer at plan-persistence time, exactly as ADR-010 already specifies for `today_session_items.question_version_id` |
| `action_type` | text | no | matches `NextBestActionType` exactly, unchanged |
| `tier` | text | no | matches `NextBestActionPriorityTier` exactly, unchanged |
| `other_applicable_types` | jsonb | no | array, default `[]`, unchanged shape |
| `reasons` | jsonb | no | array of `NextBestActionReason`, unchanged shape — this is the "reasons/explanation payload" the task asks about; no new payload shape is needed, the existing one already generalizes to Global Today without change |
| `status` | text | no | `pending`/`completed`/`skipped`, default `pending` — same three values `today_session_items.status` already declares |
| `resolved_at` | timestamptz | yes | **new** — see §7 |
| `completed_at` | timestamptz | yes | retained separately from `resolved_at` — see §7 |

**Uniqueness**:
- `UNIQUE (daily_plan_id, position)` — no duplicate position within a plan
  (same reasoning as `today_session_items`).
- `UNIQUE (daily_plan_id, question_id)` — a Question appears at most once per
  plan. **This is the exact constraint that closes plan-membership
  double-counting by construction** (`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`
  §2's central claim for Option A) — there is structurally no way for the
  same Question to be selected twice into the same day's plan, regardless of
  which view (Global or any Course filter) the learner used to reach it.
- `UNIQUE (id, user_id)` and `UNIQUE (id, daily_plan_id)` — exist purely so
  `attempts` can composite-FK against `(daily_plan_item_id, user_id)` and
  `(daily_plan_item_id, daily_plan_id)`, mirroring exactly why
  `today_session_items` carries the equivalent pair today
  (`docs/PERSISTENCE_SCHEMA_V1.md`'s own stated reason: "exists purely so
  `attempts` can composite-FK against...").

**Composite FKs**:
- `(daily_plan_id, user_id) REFERENCES daily_plans (id, user_id)` — keeps
  the denormalized `user_id` from ever disagreeing with the parent plan's
  actual owner, same mechanism as today's `today_session_items` →
  `today_sessions` FK, minus `course_id` (which is deliberately **not** part
  of this FK, since course now varies per item — see the Postgres `MATCH
  SIMPLE` finding in `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s Option B
  analysis for exactly why folding a per-item-varying column into a
  parent-matching composite FK does not work).
- `(question_id, course_id) REFERENCES questions (id, course_id)` — the
  SAME composite FK `today_session_items` already carries today, doing the
  SAME job (an item's Course must actually be the Question's real Course) —
  now the *only* mechanism enforcing Course consistency for this item, since
  there is no longer a parent-session Course to also cross-check against.
- `(question_id, question_version_id) REFERENCES question_versions
  (question_id, id)` — unchanged from `today_session_items`.

**Frozen (never recomputed after insert)**: `position`, `action_type`,
`tier`, `other_applicable_types`, `reasons`, `question_version_id`,
`course_id` — the exact `today_session_items` freeze list plus `course_id`
(which was implicitly frozen before via the parent session, and is now
frozen explicitly at the item level instead).

**Mutable**: `status`, `resolved_at`, `completed_at` only.

### `daily_plan_adaptation_events` (new — supports §12-style mutation, append-only)

An append-only log, not mutable columns on `daily_plan_items`, recording
each significant-event-triggered adaptation.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `daily_plan_id` | uuid | no | FK → `daily_plans.id` |
| `occurred_at` | timestamptz | no | when the adaptation was applied |
| `trigger_attempt_id` | uuid | yes | FK → `attempts.id`, the Attempt (if any) that constituted the "significant event"; nullable because not every conceivable trigger need be a single Attempt |
| `trigger_description` | jsonb | no | structured payload describing what triggered the adaptation (e.g. candidate trigger type, Question/topic involved) — exact shape deliberately not finalized here, mirrors how `reasons` on `daily_plan_items` is already a jsonb array rather than a fixed column set |
| `added_item_ids` | jsonb | no | array of `daily_plan_items.id` values inserted as a result, default `[]` |
| `affected_existing_item_ids` | jsonb | no | array of pre-existing, not-yet-resolved item ids the adaptation reordered/replaced, default `[]` |

**Why an append-only log, not mutable columns**: the task explicitly asks to
compare both. A mutable-columns approach (e.g. a `was_adapted boolean` and an
`adaptation_reason` column directly on `daily_plan_items`) would let a later
read know *that* an item was touched but would lose *why*, *when*, and
*what else changed as part of the same event* the moment a second adaptation
overwrote the first — exactly the kind of "single mutable copy of a signal
that needs history" pattern `docs/PERSISTENCE_SCHEMA_V1.md` already
deliberately avoids elsewhere (its stated reason for NOT adding a
`completed_by_attempt_id` pointer on `today_session_items`: "avoid multiple
independent writable copies of the same current learning signal"). An
append-only event log is also the same durability posture ADR-005 already
gives `attempts` (immutable historical evidence) and ADR-015 §8 extends to
membership history — treating adaptation history the same way is
consistent with the project's existing pattern, not a new one invented here.
**Rejected alternative**: mutable `daily_plan_items` columns — rejected for
the reason above; would satisfy "what does the item look like now" but not
§18's "what adaptations happened and why" requirement.

---

## 2. Proposed indexes

- `daily_plans (user_id, planned_for_date)` — already provided by the
  `UNIQUE` constraint's implicit index; the primary lookup path
  (`findByKey`-equivalent) uses it directly.
- `daily_plan_items (daily_plan_id, course_id)` — the Course Today filtering
  query's primary index (`WHERE daily_plan_id = X AND course_id = Y`); this
  is new relative to `today_session_items`, which never needed to filter by
  `course_id` within a session (a session only ever had one Course).
- `daily_plan_items (daily_plan_id, position)` — already covered by the
  `UNIQUE` constraint's implicit index; serves ordered reads for both Global
  and Course-filtered views.
- `attempts_daily_plan_item_id_idx` — a partial index on
  `attempts.daily_plan_item_id WHERE daily_plan_item_id IS NOT NULL`,
  mirroring `attempts_today_session_item_id_idx`'s existing partial-index
  rationale (`docs/PERSISTENCE_SCHEMA_V1.md`: "the large majority of rows
  are expected to be manual practice with this column null").
- `daily_plan_adaptation_events (daily_plan_id, occurred_at)` — supports the
  §18 history requirement ("what adaptations happened and why, when") as an
  ordered read per plan.

---

## 3. Plan date representation — comparing both timezone models, per the task's requirement

**Model 1 — snapshot-at-creation.** `planned_for_date` is a plain `DATE`,
resolved once by the application layer at first-open/generation time from
the learner's timezone at that exact moment, then never recomputed —
exactly ADR-010's existing contract for `today_sessions.planned_for_date`
("no day-boundary or timezone logic exists in the domain or persistence
layer... `planned_for_date` is a caller-supplied DATE value").

**Model 2 — current-timezone-at-read.** Instead of trusting the stored
date, recompute "what day is it" at every read, using the learner's
*current* timezone, and treat a persisted plan whose date no longer matches
that recomputed "today" as stale/needing regeneration.

**Comparison, not a casual pick:**

Model 2 actively conflicts with an already-accepted product rule.
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §15 states explicitly: "a session
started before local midnight is not interrupted at exactly 00:00 — an
actively continuing session may keep using the day it started on." A naive
Model 2 implementation — recompute "today" on every read and treat a
mismatch as staleness — would do exactly the thing §15 forbids: a learner
actively working through day D's plan past midnight would have their
in-progress session silently reinterpreted as belonging to the "wrong" day
the moment "current timezone at read" ticks over to D+1, precisely the
interruption §15 rules out. Model 2 also complicates §16 ("no automatic
carry-over... each day's plan built fresh") in the opposite direction: it
risks *involuntary* regeneration mid-session rather than the *voluntary*,
first-open-triggered generation the product spec actually describes.

**Recommendation: Model 1 (snapshot-at-creation), unchanged from ADR-010's
existing contract**, layered with a separate **application-level
continuation policy** (not a schema field): if an active session for
`planned_for_date = D` is not yet fully resolved and the learner's current
session demonstrably began before local midnight, the application continues
serving day D's plan rather than triggering generation for D+1, exactly per
§15. This is a read-time policy decision, not a persistence concern — the
schema does not need to encode "which session is active"; it only needs to
keep serving whichever `(user_id, planned_for_date)` row the application
asks for. **Exact continuation-boundary mechanics (how "began before local
midnight" is determined, DST handling, timezone-change mid-session) remain
governed by `docs/TODAY_TIMEZONE_EDGE_CASES.md` and are explicitly not
solved by this document** — this document only confirms Model 1 is the
schema-compatible choice and Model 2 is not, without inventing the
continuation mechanics themselves.

---

## 4. Plan status

`daily_plans.status` reuses `today_sessions.status`'s exact candidate values
(`prepared`/`started`/`completed`/`expired`/`abandoned`), with the exact
same "state machine DEFERRED" honesty `docs/PERSISTENCE_SCHEMA_V1.md`
already states for the existing table. This document does not resolve that
deferral for Global Today either — no new state values are invented, and no
stronger claim about the state machine's completeness is made than already
exists for the Course-scoped table.

## 5. Item status

`daily_plan_items.status` reuses the exact same three values
`today_session_items.status` already declares: `pending`, `completed`,
`skipped`. **`skipped` is a candidate value that already exists in the
current schema/type but, per this session's own review of `submit-answer.ts`
and `today-session.ts`, is never written by any code path today** — Skip
(§13 of the product spec) is the first feature that actually activates it.
This is not a new column or new domain value; it is an existing,
already-declared value gaining its first real writer. Flagged explicitly, as
instructed, since it changes a previously-dormant value into a live one —
worth a deliberate check at implementation time that nothing downstream
(e.g. any code that assumes only `pending`/`completed` ever appear) silently
mishandles it. This review did not find such an assumption in the files read
(`submit-answer.ts`, `today-session.ts`, `ports.ts`), but a full call-site
audit was out of scope here.

## 6. Item ordering

`position` — `int`, `CHECK (position >= 0)`, `UNIQUE (daily_plan_id,
position)`, 0-based — an unchanged copy of `today_session_items.position`'s
exact contract. Ordering itself comes from the same domain pipeline
(`rankNextBestActionCandidates` + `generateTodayPlan`) run once over a
merged, cross-Course candidate pool — no new ordering policy is introduced
by this persistence plan; it only stores whatever order the existing pure
domain functions already produce.

## 7. `created_at`/`started_at`/`resolved_at`/`completed_at` — a concrete gap this plan closes

`daily_plans` keeps `generated_at`/`started_at`/`completed_at` exactly as
`today_sessions` has them today.

`daily_plan_items` is where this plan makes one concrete addition beyond a
straight copy: **`resolved_at`, in addition to `completed_at`.** The
existing `today_session_items` schema has only `completed_at` — there is no
column recording *when* an item was skipped, because Skip (§13) has never
been implemented against this schema before. Under Global Today, Skip
becomes a first-class, product-defined resolution path with its own history
requirements (§18: "what was skipped... timestamps... completion/resolution
rate"), and reusing `completed_at` for a skip event would conflate two
different facts (when did the learner finish this vs. when did the learner
decide not to do it) under one column name. **Recommendation: add
`resolved_at` as "when this item left the outstanding/pending set,
regardless of how," and keep `completed_at` specifically for "when it was
completed."** For a `COMPLETED` item both are set to the same instant; for
a `SKIPPED` item only `resolved_at` is set. This directly supports §7's
"real finish line: all items COMPLETED or SKIPPED" and §18's completion-rate
history requirement without overloading either column's meaning.

## 8. Course association per item

`course_id`, `NOT NULL`, directly on `daily_plan_items`, enforced by the
`(question_id, course_id) → questions (id, course_id)` composite FK — see
§1. This is the one structural column-level difference from
`today_session_items`, where the equivalent column exists today but is
additionally cross-checked against a single parent session's `course_id`
(a check this design deliberately drops, since a plan's items may span many
Courses).

## 9. QuestionVersion association

`question_version_id`, `NOT NULL`, resolved by the application layer at
plan-persistence time — an unchanged copy of ADR-010's existing rule that
`today-planner.ts` itself stays version-agnostic and the application layer
resolves each item's current `QuestionVersion` before persisting. Composite
FK `(question_id, question_version_id) → question_versions (question_id,
id)` — unchanged shape.

## 10. Action type / reasons / explanation payload

`action_type` (`NextBestActionType`), `tier` (`NextBestActionPriorityTier`),
`other_applicable_types` (jsonb array), `reasons` (jsonb array of
`NextBestActionReason`) — all unchanged column shapes and unchanged domain
value sets, simply relocated onto `daily_plan_items`. No new
reasons/explanation payload format is needed: the existing `reasons` jsonb
array already generalizes to a cross-Course plan without modification,
since `NextBestActionReason` never carried Course information to begin with
(`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3's own finding, confirmed by reading
`next-best-action.ts`).

## 11. Enforcing "one Daily Plan per user per local day" at the schema level

`UNIQUE (user_id, planned_for_date)` on `daily_plans`, combined with the
same `INSERT ... ON CONFLICT DO NOTHING RETURNING` + fallback `SELECT`
pattern ADR-010 already establishes for `today_sessions`
(`getOrCreateTodaySession`'s existing `createIfNotExists` contract) —
mechanically identical protection, applied to a new key. **This document
makes no stronger race-freedom claim than already exists for the current
key.** `docs/INVARIANT_MATRIX.md` row 20 already documents that even
today's `UNIQUE (user_id, course_id, planned_for_date)` race-freedom is a
"confirmed real gap... requires a real multi-connection Postgres instance."
The identical gap class applies to this new key, unproven by the current
PGlite/in-memory-fake test suite for the same structural reason (a
single-threaded fake cannot interleave two real transactions) — this would
need its own scenario added to `docs/REAL_POSTGRES_VERIFICATION_PLAN.md` at
implementation time, not claimed proven here.

## 12. History durability

`daily_plan_items` rows are frozen decision records, never deleted in
normal operation (mirroring `today_session_items`'s own stated delete
posture: "not addressed; no code path deletes... in normal V1 operation").
`attempts` remains the actual source-of-truth evidence for what was
answered (ADR-005); `daily_plans`/`daily_plan_items` are the "what was
recommended, and what happened to it" record layered on top — the exact
same relationship `today_sessions`/`today_session_items` already has to
`attempts` today, just now spanning multiple Courses per row. The new
`daily_plan_adaptation_events` log (§1) extends this same durability
posture to §12-style mutations specifically, so "what adaptations happened
and why" (§18) is answerable without inferring it from side effects on the
mutable item columns.

## 13. What happens to the existing `today_sessions`/`today_session_items` tables

**Recommendation: keep them, unmodified, and simply stop writing new rows
into them once Global Today ships.** Do not drop them in the same migration,
and do not attempt to migrate their (currently nonexistent, per §14) data
into the new tables. Reasons:

- `attempts.today_session_id`/`attempts.today_session_item_id` are real
  columns with real composite FKs today (`docs/PERSISTENCE_SCHEMA_V1.md`'s
  `attempts` section). Dropping `today_sessions`/`today_session_items`
  would force an immediate decision about those columns/FKs that is not
  necessary just to ship Global Today — simply freezing (no new writes)
  the old code path avoids that decision entirely, for now.
- This keeps the migration purely additive, consistent with
  `CLAUDE.md`'s architecture discipline ("SQL enforces persistence
  integrity, never learning policy") and this project's general preference
  for reversible, non-destructive migrations demonstrated throughout
  `docs/PERSISTENCE_SCHEMA_V1.md`'s own design history.
- A later, separate cleanup migration can drop the old tables once it is
  confirmed nothing references them anymore — out of scope here, and
  premature before Global Today's application layer is even built.

This corrects a subtlety in the design draft's own §8: it noted that its
Option A (the additive, side-by-side version) was "additive at the schema
level" but explicitly **not** "a pure additive change to the product
behavior... since it introduces a second, independently meaningful session
concept." Under this plan's Option A (full replacement of the *generation*
path, old tables merely frozen-but-present), that caveat does not apply in
the same way: there is no permanently-maintained second product concept —
the old tables become inert legacy structure, not a competing live system.

## 14. Whether a data migration is needed for existing rows

**No.** Both existing migrations were checked directly for seed/backfill
data:

```
supabase/migrations/20260917203000_initial_schema.sql       — 0 `insert into` statements
supabase/migrations/20260918000000_question_answer_model_v1.sql — 0 `insert into` statements
```

Both are schema-only. There is no evidence of any `today_sessions`/
`today_session_items` production or seed data to migrate. This is
consistent with the product spec's own framing of Global Today as
prospective, not retroactive — no historical Daily Plan needs to be
reconstructed for a day that predates this feature.

## 15. Rollback strategy

Because this plan adds three new tables and touches zero columns or
constraints on any existing table, rollback is a plain `DROP TABLE` (in
FK-dependency order: `daily_plan_adaptation_events`, then `daily_plan_items`,
then `daily_plans`) with no data-loss risk to `today_sessions`,
`today_session_items`, `attempts`, or any other existing table. No existing
row, column, or constraint needs to be restored, because none was altered.

## 16. Manual Practice identity — explicit confirmation, as required

**Unaffected.** `submitAnswer`'s `todaySessionItemId === null` branch
(`src/application/learning/submit-answer.ts`) is, under this plan, a rename/
retarget only: the same `null`-vs-`non-null` distinction now reads
`dailyPlanItemId` instead of `todaySessionItemId`, pointing at
`daily_plan_items.id` instead of `today_session_items.id` when non-null.
Every rule ADR-010/ADR-012 already establish for this distinction is
unchanged in substance:

- the canonical command-identity field list still excludes
  `learningSessionId` for the non-null (Today-attached) case and includes it
  for the `null` (manual-practice) case, exactly as `findConflictingFields`
  in `submit-answer.ts` already implements;
- `resolveLearningSessionId` still derives the session id from the item's
  own session/plan reference for the non-null case, and still trusts the
  client's value for the `null` case;
- the idempotency model (`UNIQUE (user_id, submission_id)`, ADR-010's full
  canonical field list) is untouched.

No new Manual Practice session concept is introduced by Global Today, and
none is needed — this plan makes zero changes to how Manual Practice is
identified or how its Attempts are processed.

---

## Related Documents

- `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` (the architecture comparison
  this plan implements — Option A recommended there)
- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (§5, §6, §7, §11, §13, §15, §16, §18 —
  the product rules this plan is designed to satisfy)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (§8's additive-migration finding,
  refined in §13 above)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (ADR-010 —
  freeze model, advisory-lock/idempotency pattern reused unchanged)
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
  (ADR-012 §5 — `learningSessionId` ownership, unaffected by this plan per
  §16)
- `docs/DECISIONS/005-attempts-are-immutable.md` (durability posture reused
  for the adaptation-event log, §1/§12)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items` —
  exact existing ground truth this plan's tables mirror)
- `docs/INVARIANT_MATRIX.md` (row 20 — the race-freedom honesty bar cited
  in §11)
- `docs/TODAY_TIMEZONE_EDGE_CASES.md` (§3's deferred continuation-boundary
  mechanics)
- `src/application/learning/submit-answer.ts`, `today-session.ts`, `ports.ts`
- `supabase/migrations/20260917203000_initial_schema.sql`,
  `20260918000000_question_answer_model_v1.sql` (checked for seed data, §14)

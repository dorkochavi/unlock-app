# Global Today — Design Impact Analysis (DRAFT)

Status: **HISTORICAL DESIGN IMPACT ANALYSIS.**

This document was produced during the 2026-09-18 overnight hardening session
before Dor accepted ADR-016. Its body intentionally preserves that pre-decision
state. ADR-016 later accepted one DailyPlan per learner-local day, and that
architecture is now implemented locally. Do not treat statements below that
Global Today is unapproved, ADR-011 is still the current target, or DailyPlan is
unimplemented as current repository truth. The file remains useful as the
reasoning trail that preceded the accepted decision.

Every claim below is grounded in the actual committed code/schema as of this
session's baseline (`308` unit tests, `97` schema tests, all passing). File
paths and line-level behavior are cited so this document can be checked
against the repository, not taken on faith.

---

## 1. Product interpretation

Restating the direction precisely, as given:

- A learner may have more than one Course in an "active" state at once
  (`docs/OPEN_QUESTIONS.md` #33, "Multiple Active Courses," is explicitly
  OPEN — this document does not resolve it, but Global Today presupposes an
  answer of "yes").
- Home shows one **Global Today**: a single recommended plan spanning all of
  the learner's active Courses.
- The learner can *also* open a Course-specific Today (today's ADR-011
  behavior) independently of Global Today.
- Global Today is a recommendation, not an allocation quota — it may draw
  heavily or entirely from one Course if that Course's evidence genuinely
  warrants it. No artificial per-Course minimum/maximum is implied.
- Global Today is **count/finish-line-based**, not time-budget-based: it has
  a fixed set of items and a clear "done" state, not an estimated-minutes
  target.
- Global Today is **frozen by default** for the day, the same freeze
  principle ADR-010's "Today Session freeze model" already establishes for
  Course-scoped Today (`docs/PERSISTENCE_SCHEMA_V1.md`, `today_session_items`
  frozen columns: `position`, `action_type`, `tier`,
  `other_applicable_types`, `reasons`, `question_version_id`). Only
  "significant learning events" may cause a **minimal** adaptation of the
  *remaining* (not-yet-completed) part of the plan.
- Work done inside Global Today and work done inside a Course-specific Today
  must not be double-counted as two separate pieces of evidence or two
  separate "completed" credits for the same underlying learning action.
- Archived Courses are excluded from Global Today automatically, remain
  manually practiceable, and can be reactivated by the learner
  (`docs/OPEN_QUESTIONS.md` #33 territory, and matches the "Archived means
  excluded from Today but still manually accessible" language used
  elsewhere in this session's Course/access-model brief).
- Today (Global or Course) may include limited exposure to genuinely new
  material. This exposure is explicitly **not** mastery or retrieval
  evidence — it is calibration/sampling, closer to the "Starter/Calibration"
  concept `docs/LEARNING_ENGINE.md` §31 already describes and defers. If new
  material reveals a weakness, the system may *recommend* — never silently
  redirect into — focused/manual practice.
- Manual practice remains learner-initiated, chapter/topic-scoped practice,
  distinct from both Today variants.
- In every case, Today (Global or Course) recommends; the learner decides
  what to actually do. This principle is unchanged from
  `docs/PRODUCT.md` §5/§18 and `docs/DECISIONS/003-quiz-does-not-select-today-questions.md`'s
  spirit (the plan proposes; execution/choice is a separate step) — Global
  Today does not add a new autonomy exception, it inherits the existing one.

**Ambiguities flagged, not resolved:**

- "Significant learning event" (the trigger for minimal replanning) has no
  definition anywhere in `docs/`. This document does not invent one — see
  §5 and §11.
- Whether "Home has a Global Today" means Global Today *replaces* the
  Home-level entry point to Course-Today (i.e. Course-Today becomes a
  secondary/nested view) or the two are always presented as independent,
  parallel entry points, is not stated by the product direction as given.
  This affects UX more than architecture, but it affects which of §9's
  options is preferable.
- Whether "limited exposure to new material" inside Global Today draws from
  *all* active Courses' unseen material or is itself capped per Course is
  unspecified — this interacts directly with the "no artificial course
  quota" principle, which could be read as also forbidding a per-Course cap
  on new-material exposure, or not.

---

## 2. Existing ADR-011 assumptions that would need revision

ADR-011 currently states, and the codebase currently enforces, that:

- **`TodaySessionKey` is `{ userId, courseId, plannedForDate }`**
  (`src/application/learning/ports.ts`) — a plain object, not a
  discriminated union. ADR-011's own text records that an earlier draft had
  a `scope: "course" | "global"` union here and it was *removed* once
  Course-scoping was decided. Any Global Today implementation reopens
  exactly the ambiguity that removal closed, and must decide anew whether
  `TodaySessionKey` needs a scope discriminant, a wholly separate key type,
  or no key at all (see §9).
- **`today_sessions` uniqueness is `UNIQUE (user_id, course_id,
  planned_for_date)`**, with `course_id uuid not null references courses
  (id)` (`supabase/migrations/20260917203000_initial_schema.sql`). A
  Global Today session, by definition, is not scoped to one Course — it
  cannot be represented as a row in this table without either (a) making
  `course_id` nullable (weakening the composite-FK-based invariants that
  currently protect `today_session_items`' Course consistency — see §6 of
  `docs/PERSISTENCE_SCHEMA_V1.md`), or (b) not representing it in this table
  at all (see §9, Option B).
- **`UserQuestionProgressRepository.listForUser(userId, courseId)`** takes a
  required `courseId` (`src/application/learning/ports.ts`) — ADR-011's own
  "Consequences" section states this was changed from
  `courseId: string | null` specifically *because* there was no longer a
  "no Course scoping" case to represent. A cross-Course candidate pool
  requires either calling this once per active Course and concatenating
  (no port change needed — see §3), or a new port method that scopes by a
  *set* of Courses at once (a port change, but additive).
- **`getOrCreateTodaySession`'s session-scoped candidate generation**
  (`src/application/learning/today-session.ts`) generates NBA candidates
  from exactly one Course's progress rows, ranks them, and plans a single
  session. A Global Today needs the same pipeline run either per-Course and
  then merged, or over a merged candidate pool — both are viable (see §3),
  but neither is what the function currently does, and the function itself
  does not currently accept more than one Course.
- **`today_session_items` denormalizes and enforces a single `course_id`
  per item**, matching its parent session's `course_id`
  (`supabase/migrations/20260917203000_initial_schema.sql`'s composite FK
  `today_session_items (id, user_id, course_id) references today_sessions
  (id, user_id, course_id)`, plus the separate composite FK to `questions
  (id, course_id)`). A Global Today session's items, if stored the same way,
  would each need to carry *their own* Course identity (since different
  items can come from different Courses) — this is a real schema
  divergence from the current `today_session_items` design, not a
  parameter change.

None of the above is a "this proves Global Today is infeasible" finding —
it is a precise list of what a future ADR would have to explicitly revise or
extend, so that work is not discovered mid-implementation.

---

## 3. What existing code can be reused unchanged

The domain layer's Next Best Action / Today Planner pipeline is already
Course-agnostic at the type level, which is the single most reuse-friendly
fact this analysis found:

- **`generateNextBestActionCandidates`** (`src/domain/learning/next-best-action.ts`)
  takes a `UserQuestionProgress | null` and a `NextBestActionContext { now,
  memoryScheduler }`. `UserQuestionProgress` itself (`src/domain/learning/types.ts`)
  has no `courseId` field at all — it is keyed by `(userId, questionId)`
  only, with Course determined transitively via
  `questionId -> questions.course_id` (`docs/DATABASE.md` §13, restated in
  `docs/PERSISTENCE_SCHEMA_V1.md`'s `user_question_progress` section). This
  function has no Course concept to remove — it is already exactly as
  reusable across Courses as within one.
- **`rankNextBestActionCandidates`** (`src/domain/learning/next-best-action-ranking.ts`)
  takes `NextBestActionCandidate[]` and a `NextBestActionRankingContext {
  now }`. `NextBestActionCandidate` (`next-best-action.ts`) carries `type`,
  `questionId`, `reasons`, `dueAt`, `retrievability` — again, no `courseId`.
  The function's own "primary-action-per-question" collapse and tier/
  overdue/retrievability/questionId tie-break chain operate purely on these
  fields; nothing about the ranking algorithm assumes a single Course's
  candidates were passed in. **Concretely: calling this function once with
  the concatenated candidates from every active Course already produces a
  single, cross-Course ranked list, with zero code changes.** This is the
  clearest "reuse unchanged" finding in this analysis.
- **`generateTodayPlan`** (`src/domain/learning/today-planner.ts`) takes
  `TodayPlanInput { rankedCandidates, plannedForDate }` and a
  `TodayPlannerPolicy { maxItems }`. It performs a pure truncation of an
  already-ranked list — `rankedCandidates.slice(0, maxItems)` — and again
  has no Course field anywhere in `TodayPlanItem`. Given a cross-Course
  ranked list from the reuse above, this function already produces a
  cross-Course plan with a hard item-count finish line, which is exactly
  the "count-based, not time-budget-based, clear finish line" requirement
  in §1 — **no new domain logic is needed for the finish-line semantics
  themselves**, only for tracking which Course each finished item belonged
  to (see §4).

In short: **the ranking and planning algorithms do not need to know about
Courses at all**, because they already don't. The entire "Global" nature of
Global Today can be implemented purely in how the *candidate pool* is
assembled before it reaches `rankNextBestActionCandidates`, not by changing
either ranking or planning.

---

## 4. What domain concepts may need extension

- **`NextBestActionCandidate` currently has no `courseId`.** This is fine
  for ranking (§3), but the *result* — which item belongs to which Course —
  is needed downstream for: resolving each item's `QuestionVersion` (today's
  `getOrCreateTodaySession` already does this per-item via
  `repos.questionVersions.getCurrentVersion(planItem.questionId)`, which
  only needs `questionId`, not `courseId`, so this specific step is
  actually already Course-agnostic too); persisting each item with its own
  Course reference if a schema like today's `today_session_items` denormalized
  `course_id` is kept (§2); and reporting/analytics that need "which
  Course did this Global Today item come from" (§5). The cheapest place to
  recover `courseId` is via `questionId -> questions.course_id` at
  persistence time (the same lookup `submitAnswer`'s
  `QuestionVersionRepository.resolveVersionContext` already performs, per
  `docs/PERSISTENCE_SCHEMA_V1.md`) rather than threading a new field through
  the pure domain pipeline. This keeps §3's "reuse unchanged" claim intact:
  Course identity is recovered at the boundary, not inside ranking/planning.
- **`TodayPlan`/`TodayPlanItem` have no session-identity or Course
  concept**, by design (`today-planner.ts`'s own doc comment: "no DB id is
  generated here... a future persistence layer is free to renumber, add its
  own id, and copy this shape into TodaySessionItems... without this file
  knowing about that layer at all"). This design already anticipates being
  wrapped by a persistence layer that adds identity — Global Today fits the
  same seam. No change to `TodayPlan`/`TodayPlanItem` themselves is implied.
- **No domain concept currently represents "this Question was already
  completed today, in a different session."** This is the double-counting
  problem (§6) and is not something `next-best-action.ts`/`today-planner.ts`
  can solve on their own, since neither is aware of session state at all —
  it must be solved at the application/persistence boundary, most likely
  by having `getOrCreateTodaySession`-equivalent code exclude
  already-completed-today Questions from the candidate pool before ranking,
  regardless of which session (Global or Course) completed them.

---

## 5. Implications for specific concepts

- **TodaySession.** As designed today (`today_sessions` table), one row
  always belongs to exactly one Course. A Global Today plan is not
  representable as a single such row without changing that table's shape
  (§2, §9). Whether Global Today gets its own new table, is a pure
  composition with no new table, or something else is the central open
  question this document raises (§9) — it is not resolved here.
- **TodaySessionItem.** If Global Today items are persisted at all (as
  opposed to computed on read — §9, Option B), each item needs its own
  Course reference, unlike today's items which inherit their Course from
  their parent session via the composite FK. This is a genuine schema
  difference from the current design, not a reinterpretation of it.
- **Next Best Action ranking.** No change needed (§3) — ranking a
  concatenated candidate pool from multiple Courses is already what
  `rankNextBestActionCandidates` does when given such a pool, because it
  never inspected Course identity to begin with.
- **Idempotency.** `submitAnswer`'s idempotency model
  (`docs/DECISIONS/010-answer-submission-transaction-model.md`) is keyed on
  `UNIQUE (user_id, submission_id)` and is entirely independent of which
  Today session (if any) the Attempt is attached to — `todaySessionId`/
  `todaySessionItemId` are just two more command-identity fields compared
  on conflict. **Global Today introduces no new idempotency risk by
  itself** — an Attempt submitted "from" a Global Today item is still one
  Attempt, still validated the same way. The real risk is not duplicate
  Attempts; it is duplicate *credit* for the same Attempt across two
  different session views (see §6, which is a Today-planning/read-model
  problem, not a `submitAnswer` problem).
- **`learningSessionId`.** Per ADR-012 §5, a Today-attached Attempt's
  `learningSessionId` is application-derived from
  `TodaySessionItem.todaySessionId` — the client's claim is ignored. If a
  Global Today item is persisted as its own `TodaySessionItem`-shaped row
  with its own `todaySessionId` (whether that id belongs to a new "global
  session" entity or is reused from the constituent Course session — see
  §9), this derivation rule continues to apply unchanged: whichever id is
  chosen as "the session this item belongs to" becomes the
  `learningSessionId`, exactly as today. This has a real but narrow
  consequence for retrieval-qualification (`docs/DECISIONS/012...md`,
  `src/domain/learning/retrieval-qualification.ts`): **if the same Question
  can be reached via both a Global Today item and a Course Today item that
  carry *different* session ids, two attempts on the same day from the two
  different entry points would be scored as different-session (not
  same-session) evidence** — which may or may not be the intended learning
  semantics, and is exactly the kind of question that needs a real decision
  before implementation (see §6, §11), not an assumption baked in by
  whichever persistence shape is chosen first.
- **Session completion.** Today's completion model
  (`today_sessions.status`, explicitly documented as "exact state machine
  DEFERRED" in `docs/PERSISTENCE_SCHEMA_V1.md`) is already unresolved even
  for the single-Course case. Global Today adds a second axis: does
  completing all Global Today items also mark the constituent Course
  session(s) as complete, or are they tracked independently? This is
  unresolved in both directions today, so Global Today does not "break" an
  existing decision here — but it does add a dimension to a decision that
  still needs to be made regardless.
- **Analytics.** `docs/PRODUCT.md` §15/§37's core events
  (`today_opened`, `today_started`, `session_completed`,
  `session_abandoned`) do not currently distinguish Global vs. Course
  Today, because only Course Today exists. `docs/OPEN_QUESTIONS.md` #20/#21
  (Active User KPI Denominator, Week Boundary) are already open for the
  single-Today case; Global Today would need its own explicit decision on
  whether a Global Today completion counts toward the primary KPI
  independently of, or instead of, per-Course Today completions — flagged
  as unresolved, not decided here.

---

## 6. Double-counting risks

The concrete risk, stated precisely: **the same `(user_id, question_id)`
Attempt evidence must not be presented to the learner as "credit" in two
different Today views, and the same not-yet-answered Question must not
independently occupy a slot in both a Global Today plan and that Question's
Course's own Today plan on the same day**, since completing it in one would
otherwise leave it looking outstanding in the other.

Two sub-risks, distinguished because they require different fixes:

1. **Evidence double-counting.** This cannot actually happen at the
   `UserQuestionProgress`/Attempt level — `applyAttemptToProgress`
   (`src/domain/learning/progress-update.ts`) only ever processes one real
   Attempt per submission (idempotency, §5), and `UserQuestionProgress` has
   no concept of "which Today view" produced an Attempt. There is exactly
   one derived progress row per `(user_id, question_id)` regardless of
   entry point. **This risk is already structurally prevented by the
   existing architecture**, not something Global Today needs to newly
   guard against.
2. **Plan-membership double-counting (the real risk).** If Global Today and
   Course Today are generated by two independent calls into
   `getOrCreateTodaySession`-equivalent logic, each call's candidate
   generation (`generateNextBestActionCandidates` over
   `listForUser(userId, courseId)`) has no visibility into what the *other*
   call already planned. Nothing in the current code prevents the same
   `questionId` from being selected into both a Global Today plan and a
   Course-scoped Today plan for the same day, because today's
   `getOrCreateTodaySession` was never designed to be aware of a sibling
   session. **This is a genuine gap a Global Today implementation must
   close explicitly** — most likely by having whichever generation runs
   second exclude Questions already claimed by the other, but "which one
   runs first," "does completing one un-claim it from the other," and
   "what happens if the learner opens Course Today before Global Today
   exists yet that day" are all product/sequencing decisions this document
   does not make.

---

## 7. Concurrency risks

- **Session creation race, generalized.** Today's race-freedom for a single
  Course's Today
  (`INSERT ... ON CONFLICT DO NOTHING RETURNING` + fallback `SELECT`, per
  ADR-010, on `UNIQUE (user_id, course_id, planned_for_date)`) works because
  the uniqueness key is a single, well-defined tuple. A Global Today
  session has no equally natural single-row uniqueness key unless it is
  given its own table with its own `UNIQUE (user_id, planned_for_date)`
  key (§9, Option A) — if instead it is computed as a live composition over
  existing Course sessions (§9, Option B), there is no "session creation
  race" for Global Today itself at all, only the existing per-Course races,
  which remain exactly as race-free as today.
- **Concurrent generation of Global Today and a Course Today for the same
  day.** If a learner opens Global Today and a Course Today in two tabs at
  nearly the same moment, and both trigger generation, there is a real risk
  of the "plan-membership double-counting" race from §6 being resolved
  inconsistently depending on which generation call's transaction commits
  first — this is a genuine new concurrency surface, not present in the
  single-Course-Today world today, because today there is only ever one
  planning call per `(user_id, course_id, planned_for_date)` key and its
  race-freedom is already proven. Whatever mechanism §6 chooses to prevent
  double-counting also has to be race-safe under this scenario, which is
  a real design requirement to carry into any future ADR, not an
  afterthought.
- **Mid-day "significant event" replanning.** §1 (frozen by default, only
  significant events cause minimal adaptation of the remaining plan) implies
  a second write path into an already-persisted plan, distinct from initial
  generation. Today's ADR-010 freeze model has no precedent for *partial*
  replanning of an already-frozen session — today's model is "generate
  once, never regenerate, only mark items/sessions as completed." A
  same-day partial-replan write path is new concurrency surface (a
  generation-time write racing a completion-time write on the same session)
  that does not exist anywhere in the current codebase and would need its
  own transaction design, analogous to but distinct from `submitAnswer`'s
  advisory-lock pattern (ADR-010) — not assumed to be safe by analogy
  alone.

---

## 8. Backward-compatible migration strategies

Two honest answers, depending on which option in §9 is chosen:

- **If Global Today is implemented as Option B (pure composition/aggregation
  over existing per-Course `TodaySession` rows, no new table)**: this is
  **fully additive**. `today_sessions`/`today_session_items` and ADR-011's
  key are untouched; no migration is needed for the Today schema itself
  (though §6's double-counting guard may still need new state — see below).
  This is the strategy least likely to require ever revisiting ADR-011's
  accepted schema.
- **If Global Today is implemented as Option A (its own new persisted
  entity)**: this is **additive at the schema level** (new tables, no
  change to `today_sessions`'/`today_session_items`' existing columns or
  constraints), but is **not** a pure additive change to the *product
  behavior* ADR-011 describes, since it introduces a second, independently
  meaningful session concept that ADR-011's "Consequences" section
  explicitly said would be "new work on top of this... not a reason to
  revisit this key" — i.e. ADR-011 already anticipated this exact shape and
  pre-approved it as additive, without designing it.
- **Either way, §6's double-counting guard likely needs new persisted
  state** (e.g. a marker of "this Question was already planned for this
  learner today, by session X"), which is new schema regardless of which
  option is chosen for the session-identity question itself. This is not
  optional plumbing — without it, §6's risk is real, not hypothetical.
- **No migration path considered here requires altering or dropping any
  existing `today_sessions`/`today_session_items` column, constraint, or
  the ADR-011 uniqueness key itself.** This document found no scenario that
  requires a breaking schema change to ship Global Today — only additive
  schema, plus (unavoidably) new product decisions.

---

## 9. Persistence model options

### Option A — Global Today as its own persisted entity

A new `global_today_sessions` (+ `global_today_session_items`) pair,
structurally similar to today's `today_sessions`/`today_session_items` but
keyed by `UNIQUE (user_id, planned_for_date)` (no `course_id`), whose items
each carry their own `course_id` + `question_id` (+ resolved
`question_version_id`), populated by running §3's reuse-as-is
ranking/planning pipeline over a candidate pool merged across every active
Course.

**Pros:**
- Own race-free creation semantics (`INSERT ... ON CONFLICT DO NOTHING`,
  same pattern as today), independent of how many Course sessions exist.
- Own frozen-plan/session-status lifecycle, symmetric with today's Course
  Today model — easiest to reason about and to give its own completion/
  analytics events.
- Clean home for whatever "significant event" replanning logic (§7) is
  eventually decided, without touching Course-Today's existing freeze model.

**Cons:**
- A genuinely new subsystem — new tables, new composite-FK invariants (would
  need its own version of the "item's Course actually matches the
  Question's Course" guarantee that `today_session_items` currently gets
  from its parent-session composite FK, since a Global item's Course is
  no longer inherited from a single parent session's `course_id`).
  Duplicates the freeze/completion mechanics for a second time.
- Requires an explicit answer to §6's double-counting problem — a Global
  item and a Course item both existing, independently, for the same
  Question, needs a real cross-table guard (e.g. a `UNIQUE` or exclusion
  constraint spanning both tables, or an application-level check), which is
  new, non-trivial schema/transaction design, not free from Option A's
  structural symmetry with today's model.

### Option B — Global Today as a pure composition over existing per-Course sessions

No new persisted Today entity at all. "Global Today" is a read-time
aggregation: for each active Course, call (or reuse the result of) the
existing `getOrCreateTodaySession` for that Course + today's date, then
merge/re-rank the resulting items across Courses purely at the
application/UI layer for display purposes, without ever materializing a
separate Global session row.

**Pros:**
- Zero new schema. `today_sessions`/`today_session_items` and ADR-011's key
  are completely untouched — the most backward-compatible option (§8).
- §6's double-counting risk is structurally smaller: since a Global item
  literally *is* a Course item (same row, same id), "completing it" in the
  Global view and the Course view are the same write to the same row —
  there is no second copy that could disagree.
- Reuses 100% of ADR-010's existing freeze/idempotency/completion machinery
  with no new transaction design needed for the happy path.

**Cons:**
- "Frozen by default for the day" (§1) is harder to guarantee across
  Courses: each Course's Today session is generated independently, on its
  own first-access trigger, so a learner opening Global Today before any
  per-Course session exists yet would need Global Today to *trigger*
  generation for every active Course at once — a new orchestration
  responsibility not needed by any existing code path today (today, only
  one Course's session is ever created per call).
- The "clear finish line" for Global Today (§1) becomes a computed property
  (sum of remaining items across N independently-managed sessions) rather
  than a single owned plan — recomputing "how many items are left in my
  Global plan today" correctly, especially after §7's mid-day replanning,
  is entirely aggregation logic that does not exist yet and has no natural
  home in the current per-Course-scoped application layer.
- Session-level analytics/events (§5) that want to talk about "the Global
  Today session" as a single thing have no single row to attach to.

### Option C — Hybrid: a lightweight Global Today "view" record over existing Course sessions

A new, small `global_today_plans` table keyed by `UNIQUE (user_id,
planned_for_date)` that does **not** duplicate item content, but instead
records *which* `(course_id, today_session_item_id)` pairs — drawn from the
already-generated/ranked per-Course sessions — were selected into today's
Global plan, plus whatever ordering/finish-line metadata Global Today needs
that a pure aggregation (Option B) would otherwise have to recompute on
every read.

**Pros:**
- Keeps a single source of truth for "is this Question part of Global Today
  today" per item (closes §6 by construction: an item's inclusion is
  recorded once, referencing the real Course item, never duplicated) while
  still giving Global Today its own frozen plan/finish-line/analytics
  identity (Option A's strengths).
- Additive: existing `today_sessions`/`today_session_items` are untouched;
  the new table only *references* them.

**Cons:**
- Still requires the same "generate every active Course's session first"
  orchestration problem Option B has, before a Global selection can even be
  computed.
- Introduces a genuinely new invariant to maintain: a `global_today_plans`
  row referencing a `today_session_item_id` whose parent session later
  changes (e.g. via §7's mid-day replanning, once that exists) needs its
  own consistency rule that does not exist anywhere in today's schema.

---

## 10. Recommended architecture — **PROPOSAL, NOT DECIDED**

**This section is a proposal only. It has not been approved by the product
owner and must not be treated as a decision or implemented.**

Of the three options in §9, **Option C (hybrid)** is the direction this
analysis leans toward recommending for a future ADR to evaluate, because it
is the only option that closes §6's double-counting risk *by construction*
(a Global item is always a reference to a real, single Course item — never
an independent copy) while still giving Global Today the frozen-plan/
finish-line/analytics identity §1 asks for (which Option B cannot cleanly
provide) without duplicating the entire freeze/completion state machine a
second time (which Option A would require).

This preference is explicitly **not** a recommendation to build anything
now. It is offered so that if/when this becomes a real ADR, the option
comparison does not have to be redone from scratch — and it should be
revisited, not assumed, once the unresolved questions in §11 (especially
the "significant event" definition and the Global/Course entry-point
relationship) are actually answered, since either could change which
option is preferable.

---

## 11. Unresolved questions requiring user/product-owner approval

These must be decided — not guessed — before any Global Today ADR could be
written:

1. Does "Home has a Global Today" mean Global Today *replaces* Course
   Today as the default Home entry point, with Course Today becoming a
   secondary/nested view, or are the two always independent, parallel
   entry points? (§1, §9)
2. What exactly counts as a "significant learning event" that may trigger
   minimal replanning of the remaining, not-yet-completed part of a frozen
   Global Today plan? No definition exists anywhere in `docs/` today; this
   document does not propose one. (§1, §7)
3. When the same Question is reachable via both a Global Today item and
   that Question's own Course's Today item, and they end up carrying
   different session identities, should retrieval-qualification treat two
   same-day attempts from the two entry points as same-session or
   different-session evidence? (§5)
4. Does completing all items in a Global Today plan also mark the
   constituent Course Today session(s) as complete, or are Global and
   Course completion tracked entirely independently? (§5)
5. Is "limited exposure to new material" inside Global Today capped
   per-Course, or drawn freely across all active Courses' unseen material,
   given the "no artificial course quota" principle? (§1)
6. Does a Global Today completion count toward the existing primary KPI
   (`docs/PRODUCT.md` §15, "Today completed on 3+ separate days/week")
   independently of, identically to, or instead of a Course Today
   completion — and does this interact with `docs/OPEN_QUESTIONS.md` #20/#21
   (Active User KPI Denominator, Week Boundary), which are already open for
   the single-Today case? (§5)
7. Does `docs/OPEN_QUESTIONS.md` #33 (Multiple Active Courses) need to be
   resolved first, as a prerequisite, or can Global Today's design proceed
   in parallel with that decision? This document assumes multiple active
   Courses are possible, per the product direction given, but that
   assumption itself is not yet a committed product decision.
8. Which of §9's options (or another not considered here) should be
   pursued, once questions 1–7 are answered — this document deliberately
   does not treat §10's lean as a final answer.

---

## Related documents

- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011 — unmodified by
  this document)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (ADR-010 —
  Today Session freeze model, advisory-lock/idempotency pattern referenced
  throughout)
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
  (ADR-012 — `learningSessionId` ownership, §5)
- `docs/OPEN_QUESTIONS.md` #33, #34, #20, #21
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items`)
- `src/domain/learning/next-best-action.ts`,
  `next-best-action-ranking.ts`, `today-planner.ts`
- `src/application/learning/today-session.ts`, `ports.ts`

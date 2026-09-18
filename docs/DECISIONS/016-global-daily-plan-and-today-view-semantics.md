# ADR-016: Global Daily Plan and Today View Semantics

Status: ACCEPTED

## Context

`docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, now **PARTIALLY
SUPERSEDED** — see that document's own updated status) established that
UNLOCK V1 Today is generated separately per Course, keyed by `(user_id,
course_id, planned_for_date)`, with cross-Course ("Global") Today explicitly
deferred beyond V1.

In a live product discussion on 2026-09-18, Dor accepted a new product
direction, "Global Today," reversing that deferral at the product-direction
level. `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` formalized the accepted rules in
product language; `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` classified
every ADR-011 clause against those rules; `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`
and `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` analyzed the persistence-architecture
question this ADR had left open in its PROPOSED form; and
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` collected the specific decisions
only Dor could make.

On 2026-09-19, Dor completed a product-owner review of that decision
checklist and accepted all nine items (recorded in full in the session that
produced this revision, and reflected clause-by-clause below and in
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`, now updated to RESOLVED). **This
ADR is accordingly promoted from PROPOSED to ACCEPTED.** It remains a
**product-and-architecture decision record, not an implementation.** No
migration exists for `DailyPlan`/`DailyPlanItem` as of this revision; the
currently-implemented persistence substrate is still `today_sessions`/
`today_session_items` per `docs/PERSISTENCE_SCHEMA_V1.md` and
`supabase/migrations/20260917203000_initial_schema.sql`. This ADR fixes the
**target** architecture and product semantics that future implementation
work must build toward — it does not itself change any schema, route, or
runtime behavior.

**This ADR partially, not fully, supersedes ADR-011.** See ADR-011's own
updated status section for the precise clause-by-clause breakdown of what
survives and what is superseded. In summary: ADR-011's per-Course
`TodaySession` **identity/key model** — one persisted session per `(user_id,
course_id, planned_for_date)`, multiple independent sessions per learner per
day — is superseded as the target architecture by §1 below. ADR-011's
underlying domain grounding (a Question belongs to exactly one Course; Today
composition/ranking logic is itself Course-agnostic; a day's plan is
generated once and resumed, not regenerated) is not superseded and carries
forward into the `DailyPlan`/`DailyPlanItem` model unchanged.

## Decision

### 1. One DailyPlan per user per local day — accepted target architecture (Option A)

A learner has exactly one **DailyPlan** per local calendar day, identified
by `(user_id, planned_for_date)`. Each **DailyPlanItem** belongs to exactly
one DailyPlan and carries its own `courseId` (recoverable per-item, the way
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s Option A already assumed).
**Global Today** and **Course Today** are *views* over this one persisted
DailyPlan — Global Today shows all of a day's DailyPlanItems, Course Today
filters to one `courseId`. They are not two independently generated plans
that must be kept in sync, and there is no separate "Course session"
persistence identity to reconcile against the Global one.

This decides, in favor of Option A, the persistence-architecture question
`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` and
`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` analyzed and
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §1 posed to Dor. Option A is
accepted specifically **because** it makes §1's "exactly one write, visible
from both views" property structural rather than something a separate
dedup/reconciliation mechanism must maintain (see ADR-011's Consequences,
now updated, and `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §16). This
supersedes ADR-011's per-Course `TodaySession` key as the *target*
architecture; it does not retroactively change the schema already
implemented today (see Context above and "Migration path," below).

**Migration path (explicitly not decided here, flagged so it is not lost):**
how the existing `today_sessions`/`today_session_items` tables and data get
from the current schema to the `DailyPlan`/`DailyPlanItem` schema is
implementation work, not a product decision — see
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` (updated alongside this ADR)
for the slice ordering. No migration is authorized by this ADR.

### 2. First-open generation

The DailyPlan is created the first time the learner opens **any** Today
view — Global or a specific Course — on a given local day, whichever comes
first. It is not pre-generated at midnight. Generation uses the learner's
latest available learning state at the moment of that first open. A second
Today view opened later the same day resumes the already-generated plan; it
does not trigger a second generation.

### 3. Frozen by default

Once generated, the DailyPlan is frozen by default: item order, action
type, and content do not silently change as the day progresses. This
mirrors, and does not weaken, the per-Course freeze model already accepted
for V1 Today (ADR-010's "Today Session freeze model").

### 4. Significant-event adaptation — Today-sourced Attempts only

A significant learning event MAY justify a small change to future,
not-yet-resolved DailyPlanItems only — never to already-completed or
already-skipped items. **Only Attempts sourced from a Today view (Global or
Course) may trigger significant-event adaptation in V1.** A Manual Practice
Attempt updates learning state exactly as any other Attempt (§8), but it
does **not** itself trigger mid-day adaptation of the DailyPlan, even if the
same significant-event condition (confident wrong answer, misconception
threshold crossed, etc.) would have triggered it had it occurred through
Today. This resolves `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §4 and the
adversarial-review finding it was written to close
(`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md`'s "runner-up finding" on trigger
origin).

Accepted candidate triggers (unchanged): a confident wrong answer; a
misconception crossing a meaningful threshold; unexpected failure on
previously strong material; a short cluster of failures around the same
topic; very low familiarity revealed during new-material exposure. Allowed
adaptation: replacing or inserting a small number of future items,
preserving total scope. Not allowed: full reranking; changing completed
items; endless growth; turning one error into a full chapter drill;
reranking after every normal answer. Exact detection thresholds remain
undecided calibration work — see `docs/TODAY_ADAPTATION_MODEL.md`.

### 5. Dynamic size

There is no fixed daily item count and no time-budget input. Plan size is
driven by learning need. Exact minimum/maximum bounds and sizing formula
remain undecided calibration work — see `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`.

### 6. Real finish line

Once every planned DailyPlanItem is COMPLETED or SKIPPED, the DailyPlan
shows "Done for today." No further items are auto-generated. Any additional
learning afterward is opt-in (Manual Practice) and is not part of the
completed plan.

### 7. Skip semantics

Skip is a real learner decision for that day:

- the item becomes RESOLVED for the DailyPlan (removed from the outstanding
  set);
- it is neither completed learning nor scored as incorrect — mastery is not
  updated as a failure;
- it does not reappear in the same DailyPlan;
- it is persisted in Today history;
- skip does not trigger replenishment — the plan does not grow back to its
  original size because items were skipped.

### 8. Manual Practice is separate and does not satisfy the DailyPlan

If a learner manually answers a Question that the DailyPlan already
planned, learning state (mastery, progress, evidence) updates exactly as
any other Attempt would, but the corresponding DailyPlanItem does NOT
become completed, does NOT disappear, and may still be presented again.
Manual Practice does not resolve DailyPlanItems and does not trigger
mid-day Today adaptation (§4). The updated learning state from Manual
Practice may still influence the **next** day's DailyPlan generation (§2) —
only same-day adaptation of the current plan is restricted.

### 9. No automatic carry-over

Incomplete items from a prior day do not automatically move into the next
day's plan. Each day's plan is built fresh from current learning state at
that day's first open. If yesterday's unresolved need is still genuinely
high, it may naturally rank high again through ordinary ranking — there is
no explicit backlog/carry-over mechanism.

### 10. Global ranking across active Courses — no floor, but Memory Need may cross tiers

Global Today ranks learning need across every active Course with:

- no artificial per-Course quota,
- no fairness balancing,
- no minimum Course representation,
- no maintenance floor.

Concentrating the majority of a day's plan in one Course is acceptable when
genuine need warrants it. A Course silent for days does not automatically
regain representation through a floor — it re-enters ranking because its
own signals rise.

**This is not a guarantee without teeth.** Increasing forgetting risk,
overdue duration, or Memory Need must be able to increase a candidate's real
priority enough to outrank higher *nominal* candidate tiers — the ranking
function must not permanently tier-cap a `REVIEW_DUE` (or similarly
lower-tier) candidate regardless of how overdue or memory-critical it
becomes, purely because a sibling Course keeps generating higher-tier
candidate types every day. This resolves the most serious finding in
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` and
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5: "no floor, ever" is accepted
as the product rule, but "silently forgotten forever regardless of memory
risk" is **not** accepted — the ranking function itself must have the
property that sufficient memory risk can cross tier boundaries. This is a
property the ranking function must satisfy, not a per-Course floor,
quota, or exception list. Exact formula/weights/thresholds for how memory
risk translates into tier-crossing priority remain **explicitly undecided**
calibration work — see `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`. Nothing in
this clause authorizes inventing those numbers now.

### 11. Exam proximity is an urgency amplifier, not a gate

A Course does not need an exam to participate in Today. Exam proximity
amplifies urgency; it is never an eligibility requirement. A Course with no
exam may outrank a Course with a distant exam on memory risk, weakness,
misconception, coverage, or new-material-exposure need alone.

### 12. Strong material may resurface

Material the learner is strong in is not permanently excluded; it may
naturally resurface as retrieval need rises over time through ordinary
ranking (reinforced, not superseded, by §10's tier-crossing requirement).

### 13. New-material exposure is an extension of Starter Experience

New Material Exposure and Starter Experience are **one broader mechanism
family**, not two unrelated mechanisms — New Material Exposure is an
**extension** of Starter Experience to any low-evidence/unseen-material
situation, not a separate concept and not a full retirement of "Starter" as
a distinct term. The same mechanism family may handle: the beginning of a
new Course, a new chapter added later to an existing Course, or a topic
with insufficient learner evidence generally. This resolves
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §3 and
`docs/NEW_MATERIAL_EXPOSURE_MODEL.md`'s open framing question in favor of
"extension," among the three options that document posed. Exact
eligibility/sampling policy for either the Course-level Starter case or the
topic-level Exposure case remains undecided calibration work, and this
clause does **not** resolve `docs/OPEN_QUESTIONS.md` #4/#5 (Starter
Experience eligibility/sampling), which remain open on their own terms —
only the "are these one family or two" framing question is resolved.

### 14. Novelty preference

When multiple new topics exist across Courses, Today prefers introducing
fewer new topics per day with a few representative questions each, over
touching many new topics superficially. Exact numeric topic limits remain
undecided — see `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`.

### 15. Today recommends, the learner decides

This is unchanged from `docs/PRODUCT.md` §5/§18 and
`docs/DECISIONS/003-quiz-does-not-select-today-questions.md`'s spirit.
Global Today does not add a new autonomy exception.

### 16. Archived Courses excluded automatically

Per `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
(ADR-015), a Course a learner has archived (`CourseMembership.archivedAt !=
null`) does not participate automatically in the DailyPlan, remains
manually practiceable, and may be reactivated. Only non-archived,
non-revoked `CourseMembership` rows participate in normal DailyPlan
generation.

### 17. Timezone/day basis

"Today" is based on the learner's local timezone. A session actively
continuing across local midnight is not interrupted at exactly 00:00; a
session started fresh after midnight uses the new local day's plan. Exact
lifecycle mechanics remain undecided — see `docs/TODAY_TIMEZONE_EDGE_CASES.md`
and `docs/OPEN_QUESTIONS.md` #35.

### 18. History persisted from day one

History is persisted from day one; a History UI is not required for V1.
Persisted state must support later answering: what was recommended,
completed, skipped, or left incomplete; which Courses were represented and
in what order; what adaptations occurred and why; start/completion times;
and the daily completion/resolution rate. Not every one of these facts
needs to be its own database column.

### 19. Today item resolution is single-use

A DailyPlanItem may be resolved (COMPLETED or SKIPPED) exactly once. If a
learner submits a new Today answer attempt against a DailyPlanItem that is
already COMPLETED or already SKIPPED, that submission must **not** be
treated as a normal Today action that creates a new learning Attempt — it
is a conflict / already-resolved case, and the caller must receive a
distinct, typed outcome, not a silent success and not a silently-created
duplicate Attempt. This resolves `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`
§6 and the corresponding `docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` finding.

This is a **product/semantics** rule; it does not by itself decide the
transaction-level mechanics of detecting and rejecting the conflict — that
remains implementation work (see `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`).
Technical retry behavior is unaffected and unchanged: the same
`submissionId` combined with the same canonical command remains idempotent
per ADR-010, and idempotent retries of an already-successful completion are
not "already-resolved conflicts" under this clause. If a learner wants to
intentionally answer the same Question again after its DailyPlanItem is
already resolved, the supported path is Manual Practice (§8), not a second
Today submission against the same item.

### 20. Ruppin demo scope: architecture vs. feature scope

Before the Ruppin demo, the required foundation is: the DailyPlan/
DailyPlanItem architecture (§1); a single-Course Today vertical slice built
on that architecture; Course Today; the Manual Practice separation (§8);
Skip (§7); completion; Attempts/Progress; Auth; CourseMembership; QR join;
persistence; and real usable UI.

**Multi-Course Global Today itself is not a hard demo requirement.** Per
`docs/RUPPIN_GLOBAL_TODAY_DEMO_SCOPE.md`'s recommendation (confirmed here):
ADR-015 already frames the Ruppin pilot as one lecturer, one Course, so a
worked multi-Course Global Today scenario would not even be observable in
that demo. If schedule allows, multi-Course Global Today may be added as a
bonus before the demo; otherwise it follows immediately after, because the
architecture (§1) is already multi-Course-ready by construction — a
Course-only architecture that would need to be thrown away after the demo
is explicitly **not** an acceptable path, even though the multi-Course
*feature* itself is optional for the demo. This resolves
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7.

### 21. Home entry point

Once multi-Course Global Today exists, Home defaults to Global Today ("my
recommended plan for today"). Course Today is reached from within a Course
and filters the same DailyPlan. Manual Practice remains an intentional
Course/topic-scoped action, not a Home default. This resolves
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §8 and
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20's open Home-entry-point question.
Until multi-Course Global Today ships, this clause has no effect on the
current single-Course-at-a-time product.

### 22. KPI semantics: one DailyPlan, one Today completion

One DailyPlan equals one Today for KPI purposes. If a learner resolves the
DailyPlan using Global Today, Course Today, or a mixture of both, it counts
**once** as a Today completion. There are no separate
Global-Today-completion and Course-Today-completion KPIs for the primary
Today-completion metric. This resolves
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §9. The already-open questions
about the active-user KPI denominator (`docs/OPEN_QUESTIONS.md` #20) and
week boundary (`docs/OPEN_QUESTIONS.md` #21) remain open — this clause
resolves only the Global-vs-Course double-counting question, not those.

## Consequences

**Relationship to ADR-011** — see ADR-011's own updated status section for
the full clause-by-clause breakdown. Summary: ADR-011's `TodaySession`
identity key `(user_id, course_id, planned_for_date)` and its "multiple
independent sessions per learner per day" consequence are superseded as the
target architecture by §1. ADR-011's domain grounding (Questions belong to
one Course; ranking/planning logic is Course-agnostic; a day's plan
generates once and resumes) is not superseded.

**Relationship to `docs/OPEN_QUESTIONS.md` #34** — #34's V1 answer
("generated separately per Course") is now superseded by §1's target
architecture, and #34's UI-treatment/KPI-interpretation sub-questions are
resolved by §21/§22 respectively. `docs/OPEN_QUESTIONS.md` is updated
alongside this ADR to reflect this.

**Relationship to `docs/OPEN_QUESTIONS.md` #33** — **not resolved by this
ADR.** #33 (Multiple Active Courses) remains OPEN. This ADR's rules
presuppose that multiple active Courses are possible, but do not themselves
resolve whether/how that is formally decided.

**Session-completion state machine is now resolved, not deferred.** Because
§1 makes DailyPlanItem the one persisted resolution record, there is no
independent per-Course "session completion" state to keep in lockstep with
an overall DailyPlan completion state (see §22, and
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §2, now moot under the accepted
Option A).

**Migration and orchestration work remain entirely undesigned here.** How
the current `today_sessions`/`today_session_items` schema and the
application code that reads/writes it (`getOrCreateTodaySession`,
`submitAnswer`'s Today-completion branch) get replaced by
`DailyPlan`/`DailyPlanItem` equivalents is implementation work — see
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`, updated alongside this ADR to
reflect the now-accepted architecture and Ruppin sequencing (§20).

**Ranking/planning domain code requires no change to adopt this ADR's
architecture.** `src/domain/learning/next-best-action.ts`,
`next-best-action-ranking.ts`, and `today-planner.ts` already carry no
`courseId` concept and already produce a correct cross-Course ranked/
truncated plan when given a merged candidate pool. §10's tier-crossing
requirement, however, **is** a real, currently-unmet requirement on
`next-best-action-ranking.ts`'s tiering model (per
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md`'s finding) — adopting this ADR
does not itself close that gap; it commits the project to closing it,
timing and formula left to `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` and
implementation work.

## Explicitly deferred

The following remain intentionally NOT decided by this ADR and must not be
inferred or invented downstream:

- Exact scoring weights/coefficients for the cross-Course priority model,
  including how §10's tier-crossing property is computed numerically — see
  `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`.
- Exact significant-event detection thresholds (§4) — see
  `docs/TODAY_ADAPTATION_MODEL.md`.
- Exact dynamic-size minimum/maximum bounds and sizing formula (§5) — see
  `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`.
- Exact novelty-budget numeric limits (§14) and exact Starter/Exposure
  eligibility/sampling thresholds (§13, `docs/OPEN_QUESTIONS.md` #4/#5) —
  see `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`.
- Final timezone/day-boundary implementation mechanics beyond the
  qualitative rule in §17 — see `docs/TODAY_TIMEZONE_EDGE_CASES.md`.
- History UI (§18 explicitly defers this beyond V1; only persisted-state
  requirements are decided here).
- The exact migration path from `today_sessions`/`today_session_items` to
  `DailyPlan`/`DailyPlanItem`, and the exact transaction-level mechanics of
  §19's conflict detection — implementation work, see
  `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`.
- Whether `docs/OPEN_QUESTIONS.md` #33 (Multiple Active Courses) must be
  formally resolved before Global Today is built, or may proceed in
  parallel.
- Repeated-skip behavioral policy.
- The production composition root / conservative-default policy values
  needed to run `submitAnswer`/`getOrCreateTodaySession` (or their
  DailyPlan-based successors) end-to-end — see
  `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`. Not resolved by
  this ADR; tracked as a prerequisite in
  `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`.

## Addendum (2026-09-21): persistence foundation implemented

`supabase/migrations/20260921000000_daily_plan_v1.sql` adds `daily_plans`/
`daily_plan_items` — purely additive, alongside the still-intact
`today_sessions`/`today_session_items` (`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`
§13's recommendation, followed exactly: no drop, no data migration, no
column altered on any existing table). `src/domain/dailyPlan/types.ts`,
`src/application/dailyPlan/ports.ts`, and
`src/infrastructure/postgres/daily-plan-{repository,mapper}.ts` implement
§19's single-use resolution rule at the repository layer (a conditional
`UPDATE ... WHERE status = 'pending'`, returning a distinct
`RESOLVED`/`ALREADY_RESOLVED`/`NOT_FOUND` outcome — never a silent
overwrite).

This is a **persistence foundation only**, not a change to this ADR's
Context/Decision text above, which remains accurate as the historical
record of what was decided and, separately, what was implemented as of
2026-09-19. Still not implemented: any candidate-pool assembly, first-open
generation orchestration, wiring to `submitAnswer`/`getOrCreateTodaySession`,
Skip as a callable application use case, or Global/Course Today read views
— see `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` step 5/6 for what
remains before this foundation is used end-to-end.

## Alternatives Considered

### Leave ADR-011 as the sole, unamended model; decline Global Today

Rejected. Dor explicitly accepted the Global Today product direction on
2026-09-18 and, on 2026-09-19, explicitly accepted the architecture and
remaining product-semantics decisions (§1, §4, §5, §13, §19–§22) needed to
formalize it. Declining to record that acceptance would leave the
codebase's committed decisions out of sync with the product owner's actual
direction.

### Keep ADR-011's per-Course `TodaySession` as the target architecture (Option B/C instead of A)

Rejected. `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` recommended Option A;
Dor accepted that recommendation on 2026-09-19
(`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §1). A hybrid or
pure-composition approach (Options B/C) would require an explicit
cross-table dedup/reconciliation mechanism to guarantee §1's "exactly one
write, visible from both views" property; Option A makes that property
structural instead.

### Fully replace ADR-011 rather than partially supersede it

Rejected. ADR-011's domain grounding (Questions belong to one Course,
ranking/planning logic is Course-agnostic, plans generate once and resume)
remains valid and is exactly what the `DailyPlan`/`DailyPlanItem` model is
built on. Marking ADR-011 as fully superseded would misrepresent work this
ADR does not actually replace — see ADR-011's own updated status for the
precise breakdown.

### Decide the persistence architecture now, inside this ADR

Partially superseded by events: at PROPOSED stage this ADR deliberately did
not decide the architecture question, deferring it to the companion
architecture/persistence documents. Those documents have since produced a
firm, Dor-accepted recommendation (Option A), which this ACCEPTED revision
now incorporates directly into §1 rather than continuing to defer it.

### Treat this ADR as fully resolving `docs/OPEN_QUESTIONS.md` #34

Accepted, with qualification. §21/§22 resolve the UI-treatment and
KPI-interpretation halves of #34 that the PROPOSED revision had left open.
`docs/OPEN_QUESTIONS.md` is updated accordingly.

## Related Documents

- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (partially superseded — see that document's updated status)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (source of every product rule above; update pending alongside this ADR)
- `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` (clause-by-clause basis for the partial-supersession conclusion)
- `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` (basis for the accepted Option A architecture decision, §1)
- `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` (persistence architecture analysis)
- `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` (the accepted decision checklist this revision formalizes — now RESOLVED)
- `docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` (source of the §10 and §19 findings this ADR resolves)
- `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` (updated implementation sequencing)
- `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` (independent implementation blocker, not resolved here)
- `docs/OPEN_QUESTIONS.md` (#33 — not resolved; #34 — resolved by §21/§22; #4/#5 — not resolved, only reframed by §13)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items` — still the currently-implemented schema; not yet migrated)

# Today History & Analytics Plan (DRAFT)

Status: **ANALYSIS ONLY — NOT IMPLEMENTED, NOT AN ADR.** This document
designs the persisted-state-vs-analytics-event split for Today history, as
referenced by `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §18. It invents no new
product rule; it only proposes where already-accepted rules should be
recorded. Event names below are explicitly **NOT final** — see §3.

It does not modify `supabase/migrations/`, `docs/PERSISTENCE_SCHEMA_V1.md`,
or any other committed doc. Any column/table/event named here is a
**candidate**, not a decision.

---

## 1. Why this document exists

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §18 requires that Today history be
persisted "from day one," without a History UI, sufficient to later answer:

- what was recommended that day;
- what was completed;
- what was skipped;
- what remained incomplete;
- which Courses were represented, in what order;
- what plan adaptations happened and why;
- when Today was started/completed;
- daily completion/resolution rate.

`docs/PRODUCT.md` §15 already establishes the governing analytics
discipline for this whole codebase: minimal named events
(`today_opened`, `today_started`, `session_completed`, `session_abandoned`),
and the explicit rule "do not collect speculative data simply because it
may be useful later." Every candidate field/event below is justified
against that rule, not assumed useful by default.

This is genuinely new schema/infrastructure territory. Per
`docs/PERSISTENCE_SCHEMA_V1.md`'s `today_sessions`/`today_session_items`
sections, the current schema has: session-level `status`, `engine_version`,
`generated_at`, `started_at`, `completed_at`; item-level `position`,
`action_type`, `tier`, `other_applicable_types`, `reasons` (a fixed
`NextBestActionReason` enum array, per `src/domain/learning/next-best-action.ts`
— not free text), `status`, `completed_at`. There is currently **no**
adaptation-event table, **no** free-text/explanation payload, and **no**
analytics-event table of any kind. Nothing below extends a partially-built
system; it proposes new structure.

---

## 2. Three-way split: core persistence / analytics events / reconstructable

The governing question for every candidate fact is not "would this be
useful?" (`docs/PRODUCT.md` §15 already rejects that test) but: **does a
product-correctness answer (§1's list) or a stated KPI/learning-model/
diagnostic/audit/experiment need depend on this specific fact surviving,
and can it survive some other way already?**

### 2.a Must be core persistence (durable, queryable state)

These are facts §1 requires an answer to, that cannot be safely
reconstructed from anything else, and that other durable state
(`docs/DATABASE.md` §2's "Session / Decision State" category) already
exists to hold:

| Fact | Where it already lives / should live | Why not an event |
|---|---|---|
| Whether an item was completed or skipped | `today_session_items.status` (existing) | This is exactly the kind of fact `docs/DATABASE.md` §2 calls "Session / Decision State" — an event stream is an audit trail of what happened, not the current-truth record a query needs to answer "is this item done." An event-only design would require replaying the whole event log to answer a one-row question that must also back UI/query paths every day. |
| Which Attempt (if any) completed an item | `attempts.today_session_item_id` (existing; deliberately no reverse pointer, per `PERSISTENCE_SCHEMA_V1.md`'s "avoid multiple independent writable copies of the same current learning signal") | Already solved; nothing new needed. |
| The plan's frozen shape (order, action type, tier, reasons) at generation time | `today_session_items` frozen columns (existing) | Already solved; this is precisely ADR-010's freeze model. |
| Session start/completion timestamps | `today_sessions.started_at`/`completed_at` (existing) | Already solved. |
| **NEW: that an adaptation happened, to which item(s), and why (as a typed reason)** | proposed append-only `today_plan_adaptations` table (see §4) | An adaptation is a state-changing decision about the frozen plan (inserting/replacing a future item) — §12 of the product spec requires this to be recoverable later ("what adaptations happened and why"), and once an item is overwritten in place the ORIGINAL pre-adaptation content is gone forever unless captured before the overwrite. This is a correctness-and-history requirement, not a nice-to-have analytics signal. |
| **NEW: which Course each item belongs to, and the plan's overall Course composition** | Already fully reconstructable — see §2.b. Not a new column. | Listed here only to head off the mistake of adding a redundant "courses_represented" column; `today_session_items` already has enough for `question -> course` joins (per `PERSISTENCE_SCHEMA_V1.md`, `today_session_items` composite-FKs to `question_versions`/`questions`). |

### 2.b Reconstructable later from existing durable data (no new column needed)

Per `docs/PRODUCT.md` §15's discipline, these should explicitly NOT get
their own column, because they are cheap, correct derivations from data
that will already be captured for other reasons:

- **How many items were in today's plan** — `COUNT(*) FROM today_session_items WHERE today_session_id = ?`.
- **How many were completed/skipped/incomplete** — `GROUP BY status` on the same table. "Incomplete" = neither `completed` nor `skipped` at query time (i.e., still `pending` when queried after the day has effectively ended) — this requires no new state, only a query-time definition, which is exactly the kind of thing `docs/OPEN_QUESTIONS.md` #19 (Session Abandonment Definition) already flags as still open; this document does not resolve what timestamp/boundary makes a day "over" for this purpose.
- **Which Courses were represented, and to what proportion** — derivable by joining `today_session_items -> questions.course_id`, grouped and counted. No `courses_represented` array/column needed.
- **Order Courses appeared in** — `today_session_items.position` combined with each item's `question_id -> course_id` join already gives a full order; no separate ordering column needed.
- **Daily completion/resolution rate** — `(completed + skipped) / total` per session, computed at query time from the same `today_session_items` rows above.
- **Whether Global Today and a given Course Today were "the same session that day"** — reconstructable IF the persisted architecture is "Global Today is a view/aggregation over the existing per-Course `today_sessions` rows for that date" rather than a new competing entity. This document assumes, but does not decide, that architecture question — it is explicitly listed as undecided in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20 ("the persisted architecture ... for Global Today"). If instead a genuinely separate Global-Today entity is chosen, this reconstructability claim would need re-checking against whichever schema is actually decided — flagged here as a dependency, not resolved.

### 2.c Analytics-events-only (never a durable persistence column)

Per `docs/PRODUCT.md` §15, exact click-by-click UI interaction detail and
timing-of-interest signals that serve analytics/product-learning questions
but do not gate any product-correctness answer belong only in an event
stream, not in `today_sessions`/`today_session_items`:

- Exact wall-clock moments a specific item was *presented* to the learner (as opposed to *resolved*) — useful for engagement/drop-off analysis, not required by any of §1's questions, which only ask about recommended/completed/skipped/incomplete, not "was it rendered."
- Which view (Global vs. a specific Course Today) the learner was looking at at the moment they resolved a given item — a UI/analytics dimension. The persisted fact ("item X is completed") is view-independent by design (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3/§14 — exactly one write, visible from both views); which surface the learner happened to be using is a secondary observability signal about behavior, not a fact "the plan" needs to remember about itself.
- Whether the learner opened Today at all without generating/resuming a plan (e.g., abandoned the view before any action) — this is exactly `today_opened` in `docs/PRODUCT.md` §15's existing minimal event list; it does not need a session/item row at all if no plan action occurred.
- Manual Practice interactions on a Question that also happens to be in today's plan — the resulting Attempt/learning-state update is already captured via the existing Attempt-persistence path (`docs/DECISIONS/005`, `docs/DECISIONS/009`); the *fact that this Manual Practice happened while that Question was also a pending Today item* is a diagnostic/analytics correlation, not something Today's own persisted state needs to store (per §14 of the product spec, the Today item must NOT change as a result — so this correlation belongs in an event with both IDs attached, not a persistence-layer link).

### 2.d Cannot safely be reconstructed later if not captured now — the design-constraint flag

This is the sharpest risk in this plan, and it drives a concrete
persistence-shape recommendation, not just an event-naming choice:

> **If a significant-event adaptation (product spec §12) is implemented by
> mutating a `today_session_items` row in place** (e.g., overwriting its
> `action_type`/`question_id`/`reasons` to "replace" a future item), **the
> original pre-adaptation item's content is permanently lost** the moment
> that write commits. No later query, replay, or analytics job can recover
> what the plan *used to* recommend at that position, because
> `docs/PERSISTENCE_SCHEMA_V1.md` already establishes those columns as
> "frozen (never recomputed after insert)" for the *initial* freeze — an
> adaptation that overwrites them silently breaks that same freeze
> guarantee a second time, and destroys exactly the "what adaptations
> happened and why" fact §18 of the product spec requires.

**Recommendation this document makes for the persistence design (not
decided by this document, but stated because §12's implementation must
respect it or the data is unrecoverable):** significant-event adaptation
should be represented as an **append-only adaptation record**
(`today_plan_adaptations`, one row per adaptation event, referencing the
`today_session_id`, the triggering signal, the affected item position(s),
and a before/after snapshot of the affected item's plan-shape fields) with
new/replacement items inserted as **new** `today_session_items` rows (e.g.
superseding a prior pending row rather than overwriting it), rather than
destructive in-place mutation of existing frozen rows. This mirrors the
project's existing pattern for Attempts (ADR-005: attempts are immutable
historical evidence, never updated) and QuestionVersion (ADR-009:
immutable, new versions superseding old, never overwritten) — the same
"append, never destroy" discipline this codebase already applies
elsewhere, applied here to adaptation instead of invented fresh.

This is a structural constraint on *how* §12 gets built, stated so it is
not rediscovered as data loss after the fact. It does not itself decide
the exact schema, thresholds, or table shape of adaptation (those remain
open — `docs/TODAY_ADAPTATION_MODEL.md`, `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§20).

---

## 3. Candidate analytics events (names NOT final)

The following event names are candidates only, to establish the *shape* of
the eventual analytics contract — none of these names, payloads, or even
their existence, are decided. Each is checked against `docs/PRODUCT.md`
§15's justification test (a defined KPI, learning-model input,
diagnostic/quality signal, security/audit requirement, planned experiment,
or clearly stated future capability) before inclusion, per the same
document's explicit instruction not to collect data "simply because it may
be useful later."

| Candidate event (NOT final) | Candidate justification | Notes |
|---|---|---|
| `today_opened` | Already named in `docs/PRODUCT.md` §15 | Existing; Global Today adds a `scope: "global" \| "course"` dimension — see §5 below, not decided here. |
| `today_created` | KPI input: distinguishes "plan already existed, learner resumed" from "this open caused generation" (product spec §5's first-open-generation rule) — needed to verify that rule is actually behaving as designed, a diagnostic/quality signal. | New. |
| `today_started` | Already implied by `docs/PRODUCT.md` §15's `today_started` | Existing name reused. |
| `today_item_presented` | Diagnostic signal for drop-off analysis (which items are seen vs. never reached) — explicitly analytics-only per §2.c, never a persistence column. | New; the least justified of this list — flagged as a candidate to CUT if no concrete analysis need materializes, per §15's "do not collect speculatively" discipline. |
| `today_item_completed` | Redundant with `today_session_items.status` transition to `completed` for product-correctness purposes (§2.a/§2.b already cover this durably) — this event would exist ONLY to timestamp the moment for funnel/timing analytics, not to establish the fact of completion. | New; needs its own justification check before being built — "we already have the persisted fact, do we also need the timed event" is a real question, not decided here. |
| `today_item_skipped` | Same reasoning as `today_item_completed` — the durable fact (`status = 'skipped'`) already exists; an event adds funnel timing only. | New; same caveat. |
| `today_plan_adapted` | Learning-model/diagnostic input: needed to evaluate whether significant-event adaptation (§12) is calibrated correctly (not triggering too often/rarely) — this is a genuine "planned experiment/calibration" justification per §15's test, on TOP of the durable `today_plan_adaptations` record from §2.d (the event is about analyzing adaptation behavior in aggregate; the durable record is about knowing what happened to one specific plan). | New. |
| `today_completed` | KPI input: the literal event the primary KPI (`docs/PRODUCT.md` §15) counts occurrences of, per day, per user. | New; existing `session_completed` in §15's list may already cover this — naming overlap flagged, not resolved. |
| `today_abandoned` | Directly relevant to `docs/OPEN_QUESTIONS.md` #19 (Session Abandonment Definition), which is still OPEN — this event's trigger condition cannot be finalized until #19 is resolved. Included as a placeholder shape only. | New; blocked on #19. |
| `course_today_opened` | Same justification as `today_opened`, scoped to the Course view — needed to distinguish Global vs. Course entry for the KPI-dimension question in §5. | New. |
| `manual_practice_started` | Diagnostic signal to correlate Manual Practice activity with concurrently-pending Today items (§2.c) — supports evaluating whether Manual Practice is being used as a workaround for Today's frozen-plan behavior (§11/§14). | New. |

None of these names are final. Some (especially `today_item_presented`,
and the overlap between `today_completed` and the existing
`session_completed`) are flagged above as candidates that may not survive
the actual justification review this document explicitly declines to
perform on their behalf.

---

## 4. Candidate `today_plan_adaptations` persistence shape (illustrative only)

Not a migration, not a decision — illustrative only, to make §2.d's
"append-only" recommendation concrete enough to review:

```text
today_plan_adaptations
  id                    uuid, PK
  today_session_id      uuid  -- which plan this adaptation touched
  triggered_at          timestamptz
  trigger_reason        text  -- a fixed enum, matching the existing
                                 NextBestActionReason pattern in
                                 src/domain/learning/next-best-action.ts
                                 ("reasons are a typed enum, not free
                                 text") — exact enum values NOT decided
                                 here; see docs/TODAY_ADAPTATION_MODEL.md
  affected_position(s)  jsonb  -- which today_session_items positions were
                                  touched
  prior_item_snapshot   jsonb  -- the pre-adaptation frozen fields of any
                                  item that was replaced, so this fact is
                                  not lost (§2.d)
```

This shape is offered only to demonstrate that an append-only design is
concretely achievable without inventing free-text explanation fields —
exact columns, enum values, and whether this becomes its own table versus
some other representation are explicitly not decided by this document.

---

## 5. KPI implications: Global Today's new dimension on open questions

The primary KPI (`docs/PRODUCT.md` §15): *"Percentage of active users
completing Today on at least 3 separate days within a week."* Two existing
OPEN questions in `docs/OPEN_QUESTIONS.md` already govern this KPI before
Global Today is even considered:

- **#20 (Active User KPI Denominator)** — what counts as "active."
- **#21 (Week Boundary for KPI)** — how a "week" is defined.

Global Today does not resolve either question — per
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20, whether a Global Today completion
counts toward this KPI "independently of, identically to, or instead of"
per-Course completions is explicitly listed as NOT decided, matching
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §11 item 6, which raises the same
question and explicitly ties it back to #20/#21.

What Global Today concretely ADDS, without answering it, is a **new
counting-unit ambiguity inside #20's existing scope**: today, "did the
user complete Today" is unambiguous because there is one Today per active
Course (ADR-011). Once Global Today and Course Today are views over one
shared plan (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3), a single day's
single underlying plan-completion event could, in principle, be counted:

1. **once**, regardless of which view(s) the learner touched it through (a "one plan, one completion" reading — arguably the most consistent with §3's "exactly one write, visible from both views" framing);
2. **once per view opened that day** (a "per-surface engagement" reading — e.g. if a learner completes items through both a Course Today view and later confirms via Global Today, whether that is one countable day or double-counts two surfaces);
3. **differently weighted** depending on whether the completing view was Global vs. Course-scoped (e.g., only Global Today completions count toward a "holistic" KPI variant, with Course-level completion tracked as a secondary metric).

This is exactly the shape of ambiguity #20 already has for "active user" —
Global Today does not create a new open question so much as it forces #20
(and, by the same logic, #21's week-boundary question, since a
week-boundary edge case now also has to decide which VIEW's local-day
attribution applies if Global and a Course view disagree near a day
boundary) to be resolved with one more dimension in scope before either
question can be closed. **This document does not propose an answer to
either #20, #21, or the new Global/Course counting-unit question above —
it is recorded here specifically so the KPI-measurement work is not
designed against a false assumption that Global Today is KPI-neutral.**

The product-level rule that DOES already hold, and that any future KPI
implementation must respect regardless of how #20/#21 resolve: per
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3, Global Today and Course Today are
views of the *same* plan, so **there must be no double-counting of the
same underlying plan-completion in history views or events** — whatever
counting rule is eventually chosen for the KPI, the underlying event
stream/persistence must not fabricate two independent "Today completed"
facts for what is structurally one plan.

---

## 6. Summary of what this document decides vs. does not decide

**Decided (design guidance, not product policy):**
- The core-persistence / reconstructable / analytics-event three-way split in §2.
- The append-only (never destructive-overwrite) recommendation for
  adaptation records, as a structural constraint that follows from the
  product spec's own §18 requirement plus this codebase's existing
  immutable-evidence pattern (ADR-005/ADR-009).

**Not decided (explicitly deferred):**
- Final event names/payloads (§3).
- Whether `today_completed` and the existing `session_completed` are the
  same event or different ones.
- The exact `today_plan_adaptations` schema/enum values (§4) —
  `docs/TODAY_ADAPTATION_MODEL.md`'s territory.
- `docs/OPEN_QUESTIONS.md` #19, #20, #21, #22 — untouched, not resolved here.
- The Global-vs-Course KPI counting-unit question raised in §5.
- The persisted architecture for Global Today itself
  (`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s territory) — this document
  assumes, without deciding, that Global Today composes over existing
  per-Course `today_sessions` rows rather than introducing a wholly
  separate entity; if that assumption turns out wrong, §2.b's
  reconstructability claims should be re-checked against whatever schema
  is actually chosen.

## Related documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (§18, §19, §20 — primary product reference)
- `docs/PRODUCT.md` §15 (Primary Product KPI, existing analytics discipline)
- `docs/OPEN_QUESTIONS.md` #19, #20, #21, #22
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items`)
- `docs/DATABASE.md` §2 (V1 Data Categories)
- `docs/GOLDEN_SCENARIOS.md`, `docs/TESTING.md`
- `src/domain/learning/next-best-action.ts` (`NextBestActionReason` enum pattern)
- `docs/DECISIONS/005` (Attempt immutability), `docs/DECISIONS/009` (QuestionVersion immutability)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §11 item 6
- `docs/TODAY_ADAPTATION_MODEL.md`

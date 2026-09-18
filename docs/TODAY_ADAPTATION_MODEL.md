# Today Adaptation Model (Design Analysis)

Status: **DESIGN ANALYSIS ONLY — NOT AN ADR, NOT IMPLEMENTED, NOT A
DECISION.** Formalizes `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12
(significant-event adaptation) toward implementation-readiness. Does not
invent numeric thresholds (confidence cutoffs, misconception-crossing
scores, max-mutation counts) — every number below is explicitly flagged as
undecided. Does not modify `src/domain/learning/` or
`docs/DECISIONS/010-answer-submission-transaction-model.md`.

## 1. Why this is a new mechanism, not an extension of an existing one

This has to be stated up front because it changes the design posture:

- `docs/PERSISTENCE_SCHEMA_V1.md`'s `today_session_items` section lists
  `position`, `action_type`, `tier`, `other_applicable_types`, `reasons`,
  `question_version_id` as **"Frozen (never recomputed after insert) ...
  this is the entire point of the table (ADR-010)."**
- ADR-010's "Today Session freeze model" section is explicit: "A later
  change in ranking, mastery, or misconception state must not silently
  reorder or relabel an already-persisted item."
- There is currently **zero code path anywhere in this repository** that
  mutates an already-persisted `today_session_items` row's frozen columns.
  The only mutable columns today are `status` and `completed_at` —
  execution progress, not plan content.

Adaptation therefore is not "loosen an existing partial mutation
mechanism" — it is introducing a **new, narrow, audited exception** to a
rule that today has no exceptions at all. Every design choice below treats
that exception as needing to be as small, explicit, and rare as possible,
precisely because the freeze guarantee it partially relaxes is a
deliberate, hard-won product/architecture invariant (§7 makes this
explicit: replace-not-append preserves the finish line; §12 explains why
mutation must stay narrow; §9 explains why the transaction boundary must
be at least as rigorous as ADR-010's, not more permissive).

## 2. Trigger taxonomy

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12 accepts five candidate triggers.
For each: what signal fires it, and what is structurally available today.
No trigger's exact numeric threshold is decided here — see §12
("undecided calibration") at the end of this document.

### 2.1 Confident wrong answer

**Signal:** an Attempt with `isCorrect === false` AND
`confidenceLevel` at or above some "confident" cutoff on the same Attempt.

**Structural availability:** `confidence_level` is captured per-Attempt
(`docs/DOMAIN_GLOSSARY.md` §25: "Confidence is recorded per-Attempt, not
as a UserQuestionProgress field"), and `src/domain/learning/types.ts`
defines `ConfidenceLevel` as `"low" | "medium" | "high"`. So the two facts
this trigger needs — correctness and confidence — already coexist on a
single immutable Attempt record. What is NOT decided: which
`ConfidenceLevel` value(s) count as "confident" for this purpose (this
document does not assume `"high"` alone vs. `"medium"`+`"high"` — that is
exactly the "confident wrong answer" threshold `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§20 lists as undecided).

Note this is a *different* consumer of the same two fields that
`docs/DOMAIN_GLOSSARY.md`'s `CONFIDENT_ERROR` reason already feeds into
misconception detection (`src/domain/learning/types.ts` line ~64) — the
adaptation trigger and the existing `CONFIDENT_ERROR` misconception signal
are conceptually related (both react to the same underlying event) but
serve different purposes: one updates `misconceptionState`, the other
would decide whether to touch the Today plan. They should reuse the same
underlying detection ("is this Attempt a confident error"), not define it
twice with potentially different thresholds.

### 2.2 Misconception crosses a meaningful threshold

**Signal:** `UserQuestionProgress.misconceptionState` transitions into (or
newly enters) `"active"` — or, more conservatively, transitions from
`"suspected"` to `"active"` specifically, rather than firing on every
Attempt that merely keeps a Question at `"active"`.

**Structural availability:** `misconceptionState` is already a persisted,
first-class field (`"suspected" | "active"`, `src/domain/learning/types.ts`),
already consumed by `next-best-action.ts`'s `REPAIR_MISCONCEPTION`
candidate with reasons `MISCONCEPTION_SUSPECTED`/`MISCONCEPTION_ACTIVE`.
What is NOT decided: whether "crosses a meaningful threshold" means the
transition edge (state change on this Attempt) or an absolute state
check — this document recommends reasoning about it as a **transition
edge** (see §4, deduplication), since an absolute check would re-fire on
every subsequent Attempt to an already-`"active"` Question.

### 2.3 Unexpected failure on previously strong material

**Signal:** an incorrect Attempt on a Question whose prior
`UserQuestionProgress` reflected a strong state (e.g. previously
`masteryCategory: "mastered"`, or a long successful spaced-retrieval
streak) — a surprising regression, not a routine forgetting curve
failure.

**Structural availability:** `masteryCategory` and prior progress are
already persisted and read on every Attempt (`applyAttemptToProgress`
receives `previousProgress`). What is NOT decided: the precise "previously
strong" bar (which `masteryCategory` values qualify, whether a minimum
number of prior successes is required) — undecided calibration, not a
structural gap.

### 2.4 Short cluster of failures around the same topic

**Signal:** multiple failed Attempts across different Questions that
share a topic, within a bounded recent window (same session, or a short
recent time span).

**Structural availability:** this is the **weakest-grounded** of the five
triggers relative to current code. Attempts and Questions exist, but — as
`next-best-action.ts`'s own doc comment already notes for a related
reason — there is no topic/course-coverage aggregation layer in the
domain today. Detecting "a cluster around the same topic" requires
knowing which Questions share a topic, which is content-model context
this document's cited files do not currently expose at the domain layer.
This trigger is therefore conceptually accepted (per the product spec)
but its detection mechanism has a real, currently-unaddressed
dependency: some notion of topic grouping must exist for "cluster" to be
computable at all. This is a gap to flag for whoever implements this, not
a decision this document can make.

### 2.5 Very low familiarity revealed during new-material exposure

**Signal:** poor performance on early exposure questions for a newly
introduced topic — see `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` §8 for the
full analysis of exposure semantics. This document only adds: exposure
performance is one of two possible responses to the same underlying
signal (a Manual Practice *recommendation*, or a Today *adaptation*, or
conceivably both) — `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` does not commit
to which; this document's mutation machinery (§5–§7) would apply if and
only if the product decision is "also adapt Today," not merely
"recommend."

## 3. Detection layer: conceptual placement

Consistent with every other threshold-bearing module in
`src/domain/learning/` (`RetrievalQualificationPolicy`,
`EvidenceStrengthPolicy`, `MasteryPolicy`, `MisconceptionPolicy`,
`TodayPlannerPolicy`), trigger detection should most likely be a **pure
domain function** — given an Attempt, its `previousProgress`/
`newProgress` (already computed by `applyAttemptToProgress`), and an
injected `AdaptationTriggerPolicy` carrying whatever numeric thresholds
are eventually decided (confidence cutoff, "previously strong" bar,
cluster window size), returning zero or more detected trigger events. No
threshold would be hard-coded, matching this codebase's existing
discipline of injecting policy rather than embedding product numbers in
domain logic.

This keeps detection deterministic and testable in isolation, and keeps
the (still-undecided) numeric calibration swappable without touching
detection logic — the same pattern `retrieval-qualification.ts` already
uses for `minGapMsForSpacedRetrieval`.

**This document does not write that function.** It only asserts where it
would conceptually belong and what pattern it should follow.

## 4. Deduplication and repeated-trigger suppression

Two related but distinct problems:

- **Deduplication within a session:** the same underlying misconception
  (or the same "previously strong material" regression, on the same
  Question) should not fire the adaptation mechanism repeatedly if the
  learner keeps missing the same Question, or if multiple detection
  passes see the same underlying state.
- **Repeated-trigger suppression across a session:** even for genuinely
  different Questions, firing an adaptation on every qualifying trigger
  without any ceiling would violate §12's "not allowed: ... constant
  reranking after every normal answer" (an adjacent but not identical
  concern — see §6's bound, which addresses volume; this section
  addresses *identity*).

**Recommended shape (conceptual, not a numeric decision):** each detected
trigger should carry a stable identity — e.g. `(triggerType, questionId or
topicId, misconceptionState-transition-edge)` — and the adaptation
mechanism should consult the **append-only adaptation-event log itself**
(§8) to check "has this exact trigger identity already produced an
adaptation this session?" before acting again. This avoids introducing a
second, separately-maintained "already adapted" flag (the same
duplicate-source-of-truth risk `docs/PERSISTENCE_SCHEMA_V1.md` already
warns against elsewhere) — the event log doubles as both the audit trail
and the deduplication check's read source.

Concretely: misconception-threshold detection (§2.2) should fire on the
**transition edge** (state newly becoming `"active"`), not on every
subsequent Attempt where it remains `"active"` — the event log naturally
suppresses re-firing because a prior event already exists for that
Question's `"active"` transition.

## 5. Maximum plan-mutation strategy (bound the blast radius)

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12 explicitly disallows "full
reranking" and "endless growth." A bound is required; the exact numbers
are explicitly NOT decided here (per §20 of that document: "exact
significant-event detection thresholds"). What CAN be stated conceptually:

- **Per-trigger bound:** one trigger event produces at most a small,
  fixed number of item mutations (illustratively "one replacement, or one
  insert+one removal") — never a batch reshuffle of multiple future
  items from a single trigger.
- **Per-day bound:** some maximum total number of adaptation mutations
  per Daily Plan should exist, so that even several distinct legitimate
  triggers across a long session cannot cumulatively erode the frozen
  guarantee into something unrecognizable. The exact count (`N`) is
  undecided; this document only asserts that *some* finite `N` must
  exist, tracked via the same event log (§8), and that "one trigger → at
  most a small number of mutations" and "the whole day → at most `N`
  mutations" are two independent caps, not the same cap applied twice.
- **Never touch completed items:** both bounds apply only to items whose
  `status` is still `pending` — `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12
  is explicit that completed items are immutable regardless of any
  trigger, matching ADR-010's Attempt-immutability precedent (ADR-005) at
  the plan-item level.

## 6. Replace vs. insert — and resolving the finish-line tension

The task's own framing states the tension precisely: an insert without a
matching removal grows the plan, which contradicts §16/§13's "real finish
line" and "no endless growth" rules. Analysis:

**Insert-only:**
- *For*: simplest to reason about; never discards a previously-selected
  item's information.
- *Against*: directly grows total plan size every time it fires, which is
  exactly the failure mode §12 rules out ("endless Today growth"). Given
  that Today has no fixed size (§6 of the product spec — "no fixed daily
  item count"), an insert-only strategy has no natural backstop; multiple
  small legitimate triggers across one session could still visibly grow
  the perceived workload late in the day, which is a real learner-
  experience risk even if each individual insert is "small."

**Replace-only:**
- *For*: preserves total scope by construction — a replacement swaps one
  future, not-yet-resolved item for another, so the plan's size and
  "finish line" position never move. This is the most literal reading of
  §12's own example: "e.g. a focused follow-up question on the same
  misconception **inserted**" — but note the product spec's own §19
  worked example immediately clarifies this is presented "without a full
  replan and without touching already-completed items," i.e. it is
  describing an insertion *conceptually*, while §12's prose separately
  lists "replacing/inserting a small number of future items" as the
  allowed action — both are named as acceptable, but only replace keeps
  the size invariant automatically.
- *Against*: requires choosing which pending item to remove to make room,
  which is itself a small ranking decision (least urgent among currently-
  pending items? the item furthest in the future? both defensible, both
  currently undecided).

**Recommended default (PROPOSAL, not decided): replace, not append.**
Treat "insert a focused follow-up" as sugar for "replace the
lowest-priority still-pending item with the new focused follow-up item,"
so total scope is preserved by construction rather than by a separate
enforcement rule. This directly resolves the stated tension: the plan's
size is invariant across any number of adaptations, because every
adaptation is a 1-for-1 swap among not-yet-resolved items. A pure
insert-only strategy would need a *separate* mechanism to periodically
shrink the plan back down, which does not exist and would itself risk
looking like "the plan changed for no visible reason" to the learner —
worse for `docs/PRODUCT.md`'s "explain without overwhelming" principle
than a same-count replacement is.

This does not decide which pending item gets removed on a replace — that
selection rule (lowest tier? furthest position? least time-sensitive
type?) is left open, flagged as needing its own follow-up design pass,
since answering it requires product input on relative priority among
otherwise-equal pending items.

## 7. Avoiding oscillation

§12 disallows "constant reranking after every normal answer." Beyond the
per-trigger/per-day bounds (§5) and deduplication (§4), oscillation has a
specific temporal failure mode worth naming: a learner gets a confident
wrong answer (trigger fires, item replaced), then immediately answers a
different, unrelated item correctly — that correct answer must NOT be
interpreted as "undoing" the adaptation and reverting the swap. Concretely:

- A normal (non-triggering) correct or incorrect answer should never
  itself cause the adaptation mechanism to re-evaluate or reverse a prior
  adaptation. Reversal is not a designed operation in this model at all —
  once a replacement has happened, it stands for the rest of the day
  (subject only to the normal completion/skip lifecycle every item has).
- This falls directly out of §5's "one trigger → one small mutation"
  design: there is no "undo" input in this model, only "new trigger →
  possible new mutation, bounded by the daily cap." Not designing an undo
  path is itself the anti-oscillation guarantee — there is nothing for a
  later normal answer to trigger.

## 8. Persisting mutation history

An append-only **adaptation-event log** should record, for every applied
adaptation: which trigger fired (type + identity, per §4), which item(s)
were affected (removed/inserted, with their frozen identifying fields),
and a human-readable-ready reason. This log is the audit trail, the
deduplication read-source (§4), and the daily-cap counter's read-source
(§5) — one structure serving three purposes rather than three
independently-maintained ones.

This document does **not** design that log's schema or its relationship
to Today History/Analytics more broadly — that is explicitly
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md`'s responsibility, written by a
parallel workstream in this same session. This document only asserts the
log must exist, must be append-only (adaptations are historical facts,
matching ADR-005's "Attempts are immutable historical evidence" spirit
applied to plan-mutation events), and must be sufficiently structured to
answer "why did Today change?" (§9) and to support this document's own
deduplication/cap mechanisms (§4/§5). See
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md` for the actual persisted-shape
design.

## 9. Explaining "why did Today change?" to the learner

`docs/PRODUCT.md`'s "Explain without overwhelming" principle ("Adaptive
recommendations should not feel arbitrary... the product may explain why
an activity is recommended") applies directly here, arguably more than to
ordinary ranking, because an adaptation is a *visible change* to a plan
the learner may have already glanced at — silence risks feeling
arbitrary or buggy.

Conceptual requirement: each adapted item should be able to surface a
short, single-sentence, non-overwhelming reason (in the style of the
product doc's own Hebrew example, "מומלץ לחזור על הנושא הזה"), sourced
from the adaptation-event log's trigger type — not the raw internal
signal names (`NextBestActionReason` values, `misconceptionState`
strings) which are appropriate for `docs/TODAY_HISTORY_ANALYTICS_PLAN.md`/
debugging but not for learner-facing copy. This document does not draft
that copy; it only asserts the event log (§8) must carry enough
structured information (trigger type at minimum) for a later UI layer to
generate it.

## 10. Concurrency: a genuinely new transaction design

The task is explicit that this needs "the same rigor as `submitAnswer`'s
existing advisory-lock pattern (ADR-010), but ... a genuinely NEW
transaction design, not a reuse of the existing one." Analysis:

**Why ADR-010's existing lock is insufficient by itself.** ADR-010's
advisory lock is keyed by `(user_id, question_id)` and protects exactly
one learner-question pair's `UserQuestionProgress` row. Adaptation, by
contrast, needs to safely mutate **other, not-yet-resolved rows within
the same `today_session_items` set** — a different table, keyed by
`today_session_id`, that ADR-010's lock says nothing about. Two races
become possible that ADR-010 does not address:

1. **Adaptation-write vs. completion-write on a different item of the
   SAME session.** The triggering Attempt (on Question X) is being
   processed inside its own `submitAnswer` transaction, locked on
   `(user_id, questionX_id)`. If, in a separate concurrent request, the
   learner is simultaneously completing a *different* pending item
   (Question Y) in the same session, that second transaction is locked on
   `(user_id, questionY_id)` — a different lock key. Nothing today
   prevents both transactions from racing to read/write the same
   `today_session_items` row set (e.g. both deciding independently
   whether/how to touch item Y) unless a session-scoped lock is
   introduced.
2. **Two adaptation-triggering Attempts in the same session racing each
   other.** Two different Questions in the same session could each
   independently produce a qualifying trigger at nearly the same moment,
   each wanting to consume from the same "remaining daily mutation
   budget" (§5) and possibly wanting to replace the same target pending
   item.

**Proposal (flagged for engineering review, not decided):** introduce a
second, additional transaction-scoped advisory lock, keyed by
`(user_id, today_session_id)`, acquired specifically when — and only when
— a trigger is detected and an adaptation write is about to happen (not
on every ordinary `submitAnswer` call, to avoid serializing all normal
answer submissions within a session against each other unnecessarily).
Because this is a *second* lock potentially held alongside ADR-010's
existing `(user_id, question_id)` lock within the same transaction, a
**fixed acquisition order must be defined to avoid deadlock** — e.g.
always acquire the session-scoped lock before the question-scoped lock
(or vice versa, consistently) across every code path that could hold
both. This exact ordering choice is an engineering decision this document
flags but does not make.

**Where should adaptation detection+write live?** Given §11 (retry
interaction) below, the strongest argument is for adaptation detection
and its resulting mutation to happen **inside the same `submitAnswer`
transaction** that processes the triggering Attempt (as a new, conditional
step after ADR-010's existing step 6, gated on "was a new Attempt actually
inserted" — see §11), rather than as a separate async/eventual job. This
keeps the "one Attempt, one atomic outcome" property ADR-010 already
established, extended rather than replaced.

## 11. Retry/idempotency interaction

ADR-010's idempotency model guarantees that a retried `submissionId` for
an already-processed Attempt short-circuits at step 3 ("If nothing was
returned ... return the already-committed Attempt/progress result —
`applyAttemptToProgress` is **not** re-invoked") — it never reaches step
4 onward, where a new Attempt would actually be inserted and progress
recomputed.

**Consequence for adaptation, if detection lives inside the same
transaction (per §10's recommendation):** an adaptation-triggering retry
naturally cannot double-adapt, for the same reason it cannot double-apply
`applyAttemptToProgress` — the idempotent-replay path returns early,
before adaptation detection would even run. This is a strong argument
*for* co-locating adaptation inside `submitAnswer`'s existing transaction
rather than a separate async consumer of "an Attempt was recorded" events,
which would need to reinvent its own idempotency guard from scratch (e.g.
checking "has an adaptation-event already been logged for this
`submissionId`") — a second idempotency mechanism duplicating one that
already exists and is already proven correct.

If a future implementation instead chooses an async/decoupled design
(e.g. for load-shedding reasons), it would need its own explicit
idempotency key tied to `submissionId`, checked before writing any
adaptation-event — this document flags that requirement but does not
design that alternative path, since §10 recommends against needing it in
the first place.

## 12. Interaction with Manual Practice — RESOLVED by accepted decision

**RESOLVED by `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §4 / ADR-016
(ACCEPTED):** Dor's product-owner review has explicitly accepted the
"conservative-by-default" assessment this section reached: **only
Today-sourced Attempts may trigger significant-event adaptation in V1.**
Manual Practice continues to update learning state exactly as before, does
not resolve or remove Today items, and now explicitly also does **not**
trigger mid-day Today adaptation. This directly resolves this section's
"Argument for yes / no" analysis in favor of the "no" side and resolves
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` Finding 2 (see that document's
own reconciliation note). The reasoning below is left as originally written
because it is the reasoning the accepted decision agreed with, not
superseded history — a future implementer should read §5–§7's mutation
machinery as gated on "trigger originated from a Today-attached
Attempt (`todaySessionItemId`/`dailyPlanItemId` non-null)," not on learner
state alone.

The product spec's accepted examples for significant-event adaptation
(§12, §19) are all anchored to failures occurring *during Today
interaction*. The question of whether a significant event detected from a
**Manual Practice** attempt on a Question **not currently in Today**
should also be able to adapt Today was not directly answered by the spec
at the time this section was written (now resolved, see above). Reasoning
both directions, without assuming an answer:

**Argument for "yes, it can adapt Today":** The underlying learning-state
update (`applyAttemptToProgress`, `misconceptionState` transitions,
evidence classification) is identical regardless of whether the Attempt
originated from Today or Manual Practice — `evidence.ts` and
`retrieval-qualification.ts` have no concept of "origin surface" at all.
A confident wrong answer is a confident wrong answer; the learner's actual
state changed. If the *purpose* of adaptation is "Today should reflect
genuinely new information about the learner," restricting the trigger
source to only Today-originated Attempts would mean Today ignores
equally-strong evidence that happens to arrive through a different door —
an arbitrary distinction from a pure learning-signal standpoint.

**Argument for "no, only in-Today events should adapt Today":** §14 of
the product spec draws a deliberately sharp line: "Manual Practice does
not satisfy the Daily Plan," and manual activity on *other* Questions
explicitly leaves Today "frozen by default... only significant-event
adaptation may alter future items" — worded as if adaptation is the
narrow, Today-scoped exception to an otherwise strict "Manual Practice
never touches Today" rule, not a general learning-state watcher that
happens to also cover Today. Additionally, `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`
§2.5's "very low familiarity during exposure" trigger is specifically
framed as something revealed *by Today's own exposure candidates* — a
Manual-Practice-sourced version of that trigger doesn't cleanly exist,
since exposure candidates are (per that document) a Today-selection
concept, not something Manual Practice currently produces at all.

**Assessment (ACCEPTED — see resolution note above):** this document leaned
toward treating this as **conservative-by-default and out of scope for an
initial implementation**, specifically because §14's own framing already
positions adaptation as the exception to a Manual-Practice/Today
firewall, and because extending trigger *sources* to include Manual
Practice would broaden this design's blast radius beyond what the
accepted product examples (all Today-sourced) actually cover. Dor's
product-owner review has since accepted exactly this conclusion: only
Today-sourced Attempts may trigger adaptation in V1.

## 13. Interaction with Skip

**Can a skip trigger an adaptation?** No, by design: §13's skip semantics
are explicit that skip is "neither COMPLETED learning nor scored as
INCORRECT — mastery is not updated as if the learner failed." Since every
trigger in §2 is grounded in an actual graded Attempt (confidence,
correctness, misconception state, mastery regression, exposure
performance), and a skip produces none of these signals by design, a skip
structurally cannot satisfy any of the five accepted triggers. §13 also
separately notes "repeated skipping may become a future behavioral
signal (policy not decided)" — that is a distinct, still-hypothetical,
not-yet-accepted future trigger category, not part of this document's
five accepted triggers.

**Can an adaptation cause a skip?** No: adaptation (§5–§7) only ever
replaces or inserts **pending** items — it never resolves an item's
`status` to `completed` or `skipped` on the learner's behalf. Skip is
described in §13 as "a real learner decision for that day"; nothing in
this model introduces a system-initiated resolution path for any item.
**Conclusion: skip and adaptation are non-interacting in both directions**
— skip is a distinct, learner-initiated action; adaptation only ever acts
on the set of still-pending items, and only in response to graded
evidence, of which skip produces none.

## 14. Explicitly deferred / not decided by this document

- Exact confidence-level cutoff for "confident wrong answer" (§2.1).
- Exact misconception-severity/"crossing" definition beyond "transition to
  active" (§2.2).
- Exact "previously strong" bar for unexpected-failure detection (§2.3).
- The topic-grouping mechanism "cluster of failures" needs (§2.4) — not
  just its threshold, but its underlying data dependency.
- Per-trigger and per-day mutation caps' exact numbers (§5).
- Which pending item gets removed on a replace (§6).
- Lock acquisition order between the new session-scoped lock and ADR-010's
  existing question-scoped lock (§10) — flagged for engineering review.
- ~~Whether Manual-Practice-sourced significant events may adapt Today
  (§12)~~ — **RESOLVED, see §12: no, only Today-sourced Attempts may
  trigger adaptation in V1.**
- The adaptation-event log's actual persisted schema —
  `docs/TODAY_HISTORY_ANALYTICS_PLAN.md`'s responsibility (§8).

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (§12, §13, §14, §19, §20)
- `docs/DECISIONS/010-answer-submission-transaction-model.md` (freeze
  model, advisory-lock pattern, idempotency model this document extends)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_session_items` frozen columns)
- `src/domain/learning/types.ts` (`ConfidenceLevel`, `MisconceptionState`)
- `docs/DOMAIN_GLOSSARY.md` (§25 — confidence)
- `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` (§2.5's cross-reference, exposure
  trigger)
- `docs/TODAY_HISTORY_ANALYTICS_PLAN.md` (event-log schema — parallel
  workstream, not redesigned here)
- `docs/PRODUCT.md` (§"Explain without overwhelming")

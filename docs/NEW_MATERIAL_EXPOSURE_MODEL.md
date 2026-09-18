# New-Material Exposure Model (Design Analysis)

Status: **DESIGN ANALYSIS ONLY — NOT AN ADR, NOT IMPLEMENTED, NOT A DECISION.**
Written against `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9 (exposure), §10
(novelty), and §19's worked examples, which are the accepted product
language this document formalizes toward implementation-readiness. This
document does not change any engine behavior, does not add a schema column
or enum, and does not resolve `docs/OPEN_QUESTIONS.md` #4 or #5. Anything
below labeled **PROPOSAL** requires product + engineering review before it
becomes a decision.

## 1. Purpose

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9 says Today may expose new material
through a small initial sample (illustrative: 2–3 representative
questions) — exposure, not proof of mastery. This document works out what
"exposure" means precisely enough to eventually implement, and — critically
— makes explicit how it relates to two things that already exist:

1. `src/domain/learning/retrieval-qualification.ts`'s existing "first clean
   correct retrieval never qualifies as spaced" rule, which already
   encodes part of this distinction at the domain level.
2. `docs/OPEN_QUESTIONS.md` #4 (Starter Experience Eligibility) and #5
   (Starter Sampling Strategy), which describe an adjacent, still-OPEN
   concept that a naive reading could easily confuse with this one.

## 2. Current implementation status: genuinely unimplemented

This is stated plainly because it changes the nature of this document from
"refine an existing mechanism" to "specify a new one":

- `src/domain/learning/next-best-action.ts` implements exactly 4 candidate
  types (`REVIEW_DUE`, `RELEARN_LAPSE`, `REPAIR_MISCONCEPTION`,
  `STRENGTHEN_MEMORY`). Its own doc comment explicitly excludes
  `EXPAND_COVERAGE`/`NEW_LEARNING` as requiring "course/topic coverage
  context that does not exist on `UserQuestionProgress`" — a Question with
  zero Attempts has no progress row to generate a candidate from at all.
- `src/domain/learning/today-planner.ts`'s own doc comment states this
  directly: if `rankedCandidates` is empty (e.g. a brand-new learner), the
  plan legitimately has zero items — "this file does NOT fabricate
  NEW_LEARNING/EXPAND_COVERAGE filler," calling starter/calibration
  planning "a deliberately separate, still-deferred future input path, not
  something this planner invents."

So: new-material exposure as a Today input path does not exist today, at
any layer. This document analyzes what it would need to look like, not how
to finish a partially-built feature.

## 3. Core distinction to preserve everywhere downstream

The single fact this entire document exists to protect:

> **Exposure is not evidence of durable memory.** A learner answering 2–3
> new-topic questions correctly on first sight has demonstrated
> *first-encounter performance*, not *spaced retrieval strength*. These are
> different claims and must never be silently conflated by a UI label, a
> mastery update, or a ranking signal.

This is not a new invention — it is already partially encoded in the
domain layer today (see §5). The exposure model's job is to make that
existing distinction *product-visible and product-driven*, not to invent a
second, parallel notion of "not real evidence yet."

## 4. Conceptual states (informal — not a proposed schema)

For discussion purposes only, three informal labels are useful. These are
**concepts for reasoning about learner-question status, not a proposed
persisted enum**:

- **UNSEEN** — the learner has never been presented this Question/topic.
  No Attempt exists.
- **EXPOSURE** (informally "introduced-exposed") — the learner has a small
  number of Attempts on this Question/topic, too few for any qualifying
  spaced retrieval to exist yet (see §5's exact tie-in). Performance here
  is diagnostic/calibrating, not masteryproving.
- **IN_REVIEW** — the topic has graduated into ordinary
  `UserQuestionProgress`-driven behavior: `REVIEW_DUE` / `RELEARN_LAPSE` /
  `REPAIR_MISCONCEPTION` / `STRENGTHEN_MEMORY` candidates apply normally,
  the FSRS-family scheduler (ADR-008) owns timing, and evidence
  accumulates the ordinary way.

**PROPOSAL, flagged for review, not decided:** if an explicit signal is
ever needed to distinguish EXPOSURE from IN_REVIEW at the topic level
(rather than derived per-Question, see §5), it would most likely take the
shape of a small, topic-scoped counter or flag — not a Question-level
state machine, since `UserQuestionProgress` is already Question-scoped and
sufficient for the Question-level part of this distinction. No column,
table, or enum name is proposed here; that is an engineering-design
question for whoever implements this, informed by whichever of the four
options in §6 the product picks.

## 5. Relationship to `qualifyRetrieval` (do not invent a parallel mechanism)

`retrieval-qualification.ts` already states the relevant invariant in its
own doc comment:

> "the very first clean correct retrieval for a Question never qualifies —
> there is no prior qualifying retrieval to be spaced from. It may still be
> meaningful evidence elsewhere ... just not a *spaced* retrieval."

This is exactly the mechanism that already separates "first-exposure
success" from "proven spaced mastery" at the domain level, for any
Question — not only ones introduced through a deliberate exposure flow. A
learner's very first correct answer to *any* Question, exposure-flagged or
not, already cannot produce `QUALIFYING_SPACED_RETRIEVAL`.

**Implication for this model:** the new-material exposure model should be
understood as a *product-level framing and selection policy* built on top
of this existing domain fact, not a second, competing "is this exposure"
gate implemented elsewhere. Concretely:

- Whether a Question is currently being used for "exposure" purposes is a
  **Today-selection-time / product-framing concept** — which candidate
  gets shown, in what quantity, with what UI language ("let's see how this
  goes" vs. "review time").
- Whether a specific retrieval **counts as spaced evidence** remains
  exactly `qualifyRetrieval`'s job, unchanged. This model must not add a
  second, independently-thresholded "is this exposure evidence" check that
  could disagree with `qualifyRetrieval`'s existing gates (session
  identity, gap, evidence quality, correctness).

This relationship should be read as roughly:

```text
qualifyRetrieval → answers "did THIS retrieval strengthen the spaced-
                    retrieval record?" (already exists, per-Attempt)

exposure model  → answers "should Today be selecting FROM never-seen
                    material right now, and how should the learner-facing
                    framing/recommendation differ while it does?"
                    (does not exist yet, product-level)
```

## 6. Where should "exposure state" live? Four options analyzed

The task names four candidate approaches. None is decided here.

### (a) Explicit persisted state (new column/table)

A new field (e.g. on a topic/course-membership row, or a new small table)
tracking "this topic is currently in its exposure phase" explicitly.

- *For*: cheap to query at plan-generation time; makes the novelty budget
  (§7) trivial to enforce ("how many topics are currently EXPOSURE this
  week"); survives independent of Attempt-history shape changes.
- *Against*: introduces new persisted state that must be kept correct
  (transition logic, who writes it, when it flips), and risks becoming a
  second source of truth that can drift from what Attempt history actually
  shows — the exact anti-pattern `docs/DATABASE.md` §34 (cited in
  `docs/PERSISTENCE_SCHEMA_V1.md`) already warns against elsewhere in this
  codebase ("avoid multiple independent writable copies of the same
  current learning signal").

### (b) Derived from Attempt history (e.g. "fewer than N attempts ever")

No persisted flag; at candidate-generation time, count existing Attempts
for the Question/topic and compare to a threshold.

- *For*: no new mutable state, no drift risk, matches this codebase's
  general bias toward pure/derived computation (`next-best-action.ts`,
  `mastery.ts`, etc. are all derivations over persisted Attempts/progress,
  not independently maintained flags).
- *Against*: requires topic-level aggregation that does not currently
  exist in the domain layer (Questions know their own Attempts; nothing
  currently aggregates "how new is this topic as a whole" — this is the
  same course/topic-coverage-context gap `next-best-action.ts`'s doc
  comment already names as the reason `EXPAND_COVERAGE`/`NEW_LEARNING`
  aren't implemented). "N attempts" is also exactly the kind of numeric
  threshold this document is told not to invent.

### (c) Derived from evidence-quality / retrieval-qualification metadata

Instead of a raw attempt count, derive exposure status from whether a
qualifying spaced retrieval has ever occurred (`qualifyRetrieval`'s own
`NO_PRIOR_RETRIEVAL` reason, or its absence across all Attempts for a
Question/topic).

- *For*: reuses the exact mechanism already described in §5 instead of a
  parallel one; conceptually clean — "this topic has produced zero
  qualifying spaced retrievals yet" is a very close operationalization of
  "still in exposure."
- *Against*: `qualifyRetrieval` is Question-scoped and stateless/pure per
  call (no persisted "has this Question ever qualified" flag exists); this
  option still needs *some* aggregation layer to turn per-Attempt
  qualification outcomes into a topic-level "still new" judgment, plus
  topic/coverage context this file doesn't have today, same as (b).

### (d) Hybrid

Use derivation (b or c) as the underlying truth, but allow a persisted,
explicitly-cheap **denormalized cache** (not a second independent source
of truth) for read-time performance at plan-generation — e.g. the same
category as `QuestionStats` (`docs/OPEN_QUESTIONS.md` #32, deliberately
described as an aggregate layer that "becomes more useful as real usage
grows" and explicitly is NOT `UserQuestionProgress`).

- *For*: keeps a single derivable truth (Attempt history +
  `qualifyRetrieval` outcomes) while allowing performant reads; matches
  the shape of an aggregate/stats layer this codebase has already reasoned
  about in principle (`docs/OPEN_QUESTIONS.md` #32).
- *Against*: still needs the underlying derivation logic designed first;
  a cache is only worth adding once real load justifies it, per that same
  Open Question's own guidance ("do not make V1 depend on having large
  cross-user samples" — the same conservatism applies to not
  over-engineering a cache before it's needed).

**Assessment, not a decision:** options (b)/(c) are most consistent with
this codebase's existing bias toward pure derivation over independently
maintained flags (see ADR-010's explicit rejection of a placeholder
`UserQuestionProgress` row for exactly this reason — "row existence ≠
domain meaning" drift). Option (a) is the most implementation-convenient
but carries the highest long-term drift risk. Option (d) is a reasonable
eventual destination but is premature before (b)/(c)'s underlying
derivation is itself designed. **This is an observation for whoever
designs the implementation, not a decision made by this document.**

## 7. Novelty budget — a different kind of budget than the priority model's "no quota"

`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §7 states Global Today's ranking has
**no per-Course quota, no fairness balancing, no minimum representation,
no maintenance floor** — that rule exists to stop Today from artificially
propping up a quiet Course.

§10's novelty budget is a **different, topic-level concept** and must not
be conflated with §7's Course-fairness rule:

| | §7 "no Course quota" | §10 "novelty budget" |
|---|---|---|
| Scope | Course-level | Topic-level |
| Problem it solves | Don't force weak-signal Courses into the plan | Don't scatter shallow exposure across many unrelated new topics in one day |
| Direction | Removes an artificial floor | Introduces a soft ceiling on *breadth of novelty*, not on genuine need |
| Applies to | All ranked candidates | Only newly-introduced-topic exposure candidates |

Concretely: if Course A has three genuinely new topics ready for
introduction on the same day, §7 does not force Today to spread exposure
evenly across unrelated Courses, but §10 *does* suggest Today should
prefer introducing fewer of those three new topics with a few
representative questions each, rather than touching all three
superficially. Exact numeric topic limits are explicitly not decided
(`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §10, §20) and this document does not
propose one.

## 8. Poor exposure performance → recommendation, never redirect

Per §9's accepted language: "Today may RECOMMEND (never silently redirect
into) focused/deliberate Manual Practice." Design implications:

- The recommendation is a **learner-facing suggestion the learner can
  ignore** — consistent with `docs/PRODUCT.md`'s "Today recommends, the
  learner decides" principle already cited in
  `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3.
- It must not silently convert into an automatic in-Today drill of that
  topic — that would be exactly the "endless growth" / "turning one error
  into a chapter drill" failure mode `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
  §12 rules out for significant-event adaptation generally, and exposure
  performance is one of §12's five accepted candidate triggers ("very low
  familiarity revealed during new-material exposure").
- Because it is a *recommendation* rather than a Today mutation, it likely
  does not need `docs/TODAY_ADAPTATION_MODEL.md`'s mutation-budget
  machinery at all — surfacing a recommendation is not the same category
  of action as replacing a future Today item. Whether "very low
  familiarity" should ALSO be capable of triggering an in-Today adaptation
  (inserting a focused follow-up, per §12's example) is `docs/
  TODAY_ADAPTATION_MODEL.md`'s concern, not this document's; this document
  only asserts that a *recommendation* and an *adaptation* are two
  different, not mutually exclusive, possible responses to the same poor-
  exposure signal.

## 9. Relationship to Starter Experience (`docs/OPEN_QUESTIONS.md` #4/#5) — RESOLVED by accepted decision

**RESOLVED by `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §3 / ADR-016
(ACCEPTED):** Dor's product-owner review has accepted **Framing 2** below —
new-material exposure is an EXTENSION of Starter Experience, one mechanism
family, not two unrelated mechanisms, and not a full retirement of Starter
either (Framing 1 is also rejected). Examples given: beginning of a new
Course, a new chapter added later, and a topic with insufficient learner
evidence may all use the same mechanism family. This does **not** resolve
`docs/OPEN_QUESTIONS.md` #4/#5 themselves (exact eligibility/sampling
policy remains open calibration work, per that same accepted decision) —
it resolves only which of the three framings below governs how #4/#5
should eventually be answered. The analysis below is left as originally
written since Framing 2's own reasoning (textual consistency with
`docs/LEARNING_ENGINE.md` §31 vs. `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9/§10)
is exactly why it was accepted — it remains the load-bearing justification,
not superseded history.

This was the central ambiguity the task originally asked to be surfaced
rather than silently resolved. Three possible framings existed, and the
repo did not then commit to any of them:

**Framing 1 — Global Today's new-material exposure IS the resolution of
Starter Experience.** Under this framing, "Starter" was simply an earlier
name for "how Today introduces new material," and Global Today §9/§10
supersede OQ#4/#5 outright once implemented.

**Framing 2 — new-material exposure is an EXTENSION of Starter.** Starter
solves a narrower bootstrapping problem — `docs/LEARNING_ENGINE.md` §31
frames it explicitly as replacing "attempts < N → newest Questions" with
"insufficient evidence → calibration session," objective: *"reduce
uncertainty across the [whole] Course with the smallest useful sample."*
That is a **whole-Course, likely one-time-per-Course**, entry-point
problem for a learner with (per OQ#4) unreliable or absent
`UserQuestionProgress` altogether. Global Today §9/§10's new-material
exposure, by contrast, reads as an **ongoing, per-topic** input that keeps
firing throughout a learner's life in a Course, every time a new
chapter/topic is introduced — for a learner whose Today is otherwise
already functioning normally on established material. Under this framing,
Starter is the "cold start" special case, and this document's model is the
general-purpose mechanism Starter's *later* steady-state behavior would
eventually converge into once the Course has some established material
alongside the new.

**Framing 3 — the two are genuinely separate mechanisms that happen to
look similar.** Starter (OQ#4/#5) is scoped as a distinct feature with its
own eligibility/exit/re-entry questions and its own "Starter Feature
Contract" target phase (`docs/OPEN_QUESTIONS.md` #4/#5 both say so
explicitly), including KPI treatment questions unique to it
(`docs/OPEN_QUESTIONS.md` #22: "Do Starter completions count toward the
... KPI? Starter is calibration, not mature Today behavior."). Global
Today's new-material exposure has no such separate feature contract, no
distinct KPI carve-out, and is described in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
as one ranking input among several (§9/§10 sit alongside §7's ranking
principles and §8's exam behavior), not as a standalone flow a learner
enters and exits.

**Assessment (accepted, see resolution note above):** Framing 2 is the most textually
consistent with both documents as currently written — `docs/LEARNING_ENGINE.md`
§31's framing is explicitly Course-wide/uncertainty-reduction/one-time-
feeling ("reduce uncertainty across the Course with the smallest useful
sample"), while `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9/§10 is explicitly
topic-scoped and recurring ("when multiple new topics exist," "a new
chapter"). Framing 1 (full retirement of Starter) has since been explicitly rejected by
the accepted decision — Starter and exposure are one mechanism family, but
Starter's own eligibility/sampling/exit questions (#4/#5) are not thereby
answered, only unified in direction. Whoever resolves
`docs/OPEN_QUESTIONS.md` #4/#5 should do so consistently with Framing 2,
referencing this section, rather than resolving them as if a separate,
unrelated mechanism were still on the table.

## 10. What this document does NOT decide

- No schema/enum for exposure state (§4, §6 — analysis only).
- No numeric attempt-count threshold, sample size, or novelty-budget limit
  (§6, §7 — `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §20 already lists these as
  undecided).
- No resolution of `docs/OPEN_QUESTIONS.md` #4 or #5 (§9).
- No change to `qualifyRetrieval`, `evidence.ts`, `next-best-action.ts`, or
  `today-planner.ts` — all four are read-only inputs to this analysis.
- No decision on whether "very low familiarity during exposure" should
  trigger a Today-plan adaptation vs. only a recommendation vs. both — see
  `docs/TODAY_ADAPTATION_MODEL.md`.

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (§9, §10, §19, §20)
- `docs/OPEN_QUESTIONS.md` (#4, #5, #22, #31, #32)
- `docs/LEARNING_ENGINE.md` (§31)
- `src/domain/learning/retrieval-qualification.ts`
- `src/domain/learning/evidence.ts`
- `src/domain/learning/next-best-action.ts`
- `src/domain/learning/today-planner.ts`
- `docs/TODAY_ADAPTATION_MODEL.md` (poor-exposure-performance trigger)
- `docs/PRODUCT.md` (§"Today recommends, the learner decides")

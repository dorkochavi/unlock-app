# Global Today — Plan Size Model (ANALYSIS, NOT DECIDED)

Status: **ANALYSIS ONLY. No numeric bound, threshold, or coefficient in
this document is decided or final.** This document analyzes candidate
SIZING architectures for how many items a Global Today plan should contain,
per `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §6 (dynamic size) and the accepted
rules: no fixed daily question count, no time-budget input, size depends on
learning need, a real finish line is required, Skip does not trigger
replenishment, exact numeric bounds are explicitly not decided
(`docs/OPEN_QUESTIONS.md` #16, still OPEN). It does not modify
`src/domain/learning/today-planner.ts` or any committed code, and it does
not redesign significant-event adaptation — that mechanism is being
documented separately as `docs/TODAY_ADAPTATION_MODEL.md`, referenced here,
not reproduced.

## 0. What the current code already does, and what changes

`generateTodayPlan` (`src/domain/learning/today-planner.ts`) is currently a
**pure truncation**: `rankedCandidates.slice(0, policy.maxItems)`, where
`maxItems` is an externally injected, unspecified constant
(`TodayPlannerPolicy.maxItems`, "no default" per the file's own doc
comment). This is the simplest possible instance of sizing model (b) below
(top-N with an externally supplied N) — today N is a fixed policy constant,
not yet dynamic. The file's doc comment is explicit that it does NOT
fabricate filler for short/empty plans and does NOT interleave by topic
(no topic field exists on candidates yet, `docs/OPEN_QUESTIONS.md` #31 is
open) — both of these existing properties are compatible with everything
recommended below; this document proposes changing what determines
`maxItems` (or replacing that field's role with a different stopping rule),
not the truncation mechanism itself, which remains a reasonable
"snapshot in, plan out" implementation shape regardless of which sizing
model determines the cutoff.

## 0a. Reconciliation note (post-decision): interaction with tier-crossing

Dor's product-owner review accepted that Memory Need/overdue duration must
be able to cross priority tier boundaries, not merely break ties within one
(`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5; see
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a for the ranking-side
consequence). This document's recommended model (§2, tiered buckets with a
whole-plan guardrail) is not itself contradicted by that rule — bucket
inclusion still operates over whatever ranked/tier-escalated list the
priority model eventually produces — but "include ALL REMEDIATION-tier
items, uncapped" (§1(d)'s failure mode, §7's pile-up scenario) becomes a
sharper risk once a `DUE_REVIEW` candidate can also legitimately escalate
into contention: the guardrail (§2, §7) must be sized generously enough that
a genuinely escalated `DUE_REVIEW` candidate is not systematically the first
casualty of truncation merely for having escalated late. This document does
not resolve how; the exact bucket/ceiling numbers remain open calibration
work exactly as already stated throughout (§1's status line,
`docs/OPEN_QUESTIONS.md` #16).

## 0b. Reconciliation note (post-decision): accepted default direction, not final numbers

Dor's product-owner review has since accepted a **default direction** for
this document's §2 recommendation (tiered buckets with a whole-plan
guardrail), without deciding the exact final calibration this document
always said was out of scope: minimum useful plan **5 items**; typical
range **8–12 items**; hard maximum **15 items** (see
`docs/OPEN_QUESTIONS.md` #16). This maps directly onto §2's own shape — the
"5" and "8–12" describe how large the tiered buckets typically resolve to
on a normal day, and the "15" is exactly the kind of whole-plan guardrail
§2/§7 already recommend as a circuit breaker for pathological pile-ups, not
a new mechanism.

**Status of these numbers: CONSERVATIVE PRODUCTION DEFAULT CANDIDATES, not
locked product invariants.** They may be used as the initial engineering
values when a composition root is built (see
`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md` and
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`), but this document's
existing position — that exact numeric caps are explicitly NOT decided and
remain calibration work — is unchanged by their existence. Do not read "5 /
8–12 / 15" as resolving this document's own "Exact numeric caps... are
explicitly NOT decided" statement (§2); it resolves only the *direction* of
that decision (a small floor, a modest typical range, a firm-but-not-tiny
ceiling), not its final value.

## 1. The candidate sizing models

### (a) Absolute score threshold — include every candidate above a priority cutoff

Include every candidate whose priority (however scored — see
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`) exceeds some fixed cutoff value.

- **Pros**: conceptually simple; size is a pure emergent property of how
  much genuine need exists above the bar, which matches "size depends on
  learning need" directly.
- **Failure modes**: requires a genuinely comparable numeric score to
  threshold against — but `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §7/§14
  recommends AGAINST a unified numeric score, for explainability and
  cross-Course-comparability reasons. Retrofitting a threshold onto a
  tiered model is awkward: "include everything in tier REMEDIATION and
  DUE_REVIEW" is really model (d) in disguise, not a true continuous
  threshold. A literal numeric threshold is also brittle to miscalibration
  in exactly the way the size model must avoid — too low a cutoff produces
  a pathologically huge day (§12.3-13 of the priority model's saturation
  discussion; a candidate-pool of 10,000 above a slightly-too-generous
  threshold could all qualify at once); too high a cutoff produces a
  suspiciously tiny or empty day even when real (lower-severity) need
  exists that the learner would reasonably want addressed.
- **Explainability**: poor on its own — "6 items today" is explained by
  "these 6 cleared an internal number," which is exactly the "opaque
  score" the priority model recommends against exposing.
- **Calibration difficulty**: high — a single global cutoff must work
  correctly across every learner, every Course-content difficulty
  distribution, and every candidate-pool size, which is a lot of variance
  for one constant to absorb.

### (b) Top-N with dynamically-computed N

Keep the "top N of the ranked list" shape from the current code, but make
N itself a function of learning-need indicators (e.g. count of
REMEDIATION-tier candidates, or overall pool "heat") rather than a fixed
constant.

- **Pros**: minimal change from existing code (`today-planner.ts` already
  does top-N truncation) — only the source of `maxItems` changes, not the
  truncation mechanism. Straightforward to explain incrementally ("today N
  is larger because more items needed remediation").
- **Failure modes**: still requires *some* formula mapping need-indicators
  to a single integer N, which reintroduces a calibration problem one
  level up (now "how much does N grow per additional REMEDIATION item" is
  the hard-to-calibrate constant, instead of a score threshold). Also risks
  a discontinuous jump if N's formula has any threshold-like component
  (e.g. "N = 10 if pool heat < X, else 20").
  Nonetheless, top-N remains
  attractive as the SHAPE the runtime cutoff takes even if the "how is N
  chosen" question is answered by another model (see the recommendation).

### (c) Need-mass / cumulative-priority budget (knapsack-like)

Walk down the ranked list, accumulating a "need mass" for each included
item (e.g. weighted by tier, or by an amplified priority value), and stop
once cumulative need mass crosses a budget — rather than stopping at a
fixed count or a per-item threshold.

- **Pros**: naturally adaptive to the *shape* of need, not just its top
  value — a day with 15 moderately-urgent items and a day with 3
  extremely-urgent items could produce similarly-sized plans if their
  cumulative need is comparable, which arguably matches "size depends on
  learning need" more faithfully than a raw count ever could.
- **Failure modes**: requires assigning each candidate a numeric "mass,"
  which has the same tension with the priority model's tiered
  (non-numeric) design as model (a) — some numeric proxy would have to be
  invented purely for sizing purposes even if it isn't used for ranking
  order, risking two divergent numeric representations of the same
  candidates (one for order, one for size) that could disagree with each
  other in confusing ways. Budget mis-set produces the same
  too-huge/too-tiny failure modes as (a), one level removed.
- **Explainability**: moderate — "your day's total need crossed the
  budget after item 8" is more defensible than a raw score threshold, but
  still requires exposing a "need mass" concept to be fully legible, which
  risks the same opacity concern.
- **Calibration difficulty**: high, and arguably higher than (a) — a mass
  function AND a budget both need calibrating, with more combined degrees
  of freedom than a single threshold.

### (d) Tiered need buckets — bucket sizes drive inclusion directly

Use the priority model's own tier structure directly: e.g. "include ALL
REMEDIATION-tier items" (bounded only by how many genuinely exist),
"include DUE_REVIEW items up to some cap," "include a small,
possibly-zero number of LOWER_SEVERITY_REPAIR/STRENGTHEN items only if
room remains," with each tier's inclusion rule stated qualitatively rather
than as one global N.

- **Pros**: this is the most faithful extension of the EXISTING model
  (`next-best-action-ranking.ts`'s tiers) into sizing — it reuses a concept
  that is already proven, already explainable ("today has 6 items because
  6 things are genuinely broken or due"), and already Course-blind at the
  type level (§0 of `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`). It also
  directly explains exam-heavy weeks: more REMEDIATION/DUE_REVIEW
  candidates naturally exist when many reviews come due or lapse near an
  exam, so the bucket sizes grow without any explicit "exam mode" branch
  being needed.
- **Failure modes**: "include ALL REMEDIATION items, uncapped" is exactly
  the pathological-huge-day risk during a multi-Course exam pile-up (§7
  below) if left completely unbounded — some soft ceiling is still needed
  even under this model, just expressed as a per-tier (or whole-plan) cap
  rather than a single global score threshold.
- **Explainability**: strong — a bucket-based explanation ("all your
  currently-broken items, plus your due reviews, plus a couple of
  strengthening items since nothing was more urgent") maps naturally onto
  the tier names already used by the ranking model and is compatible with
  `docs/OPEN_QUESTIONS.md` #18's concern about not exposing confusing
  internal scores.
- **Calibration difficulty**: lower than (a)/(c) — each tier's cap (if any)
  is a smaller, more interpretable constant ("how many DUE_REVIEW items
  is reasonable in one day") than a single score threshold that has to
  absorb every signal's combined scale at once.

### (e) Hybrid

Combine (d) as the primary mechanism (tier buckets determine most of the
plan) with a whole-plan soft ceiling/floor as a guardrail (borrowed from
(b)'s "dynamically computed N" framing, but computed as a cap on the sum
of tier buckets rather than as the primary sizing driver). This is the
recommended model — detailed in §2.

## 2. Recommended model: tiered buckets with a whole-plan guardrail (hybrid of d + b)

**Primary mechanism**: for each priority tier (REMEDIATION, DUE_REVIEW,
LOWER_SEVERITY_REPAIR, STRENGTHEN — reusing
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`'s recommended tier structure,
extended across Courses), include candidates from that tier following
ranked order, with the *count taken from each tier* driven primarily by how
many genuinely qualify, not by a fixed per-tier target. REMEDIATION in
particular should default toward "include what's genuinely there" since
under-including broken/actively-misconceived material is the worse failure
mode of the two.

**Guardrail mechanism**: apply a soft whole-plan ceiling (an upper bound on
total item count) that acts only as a circuit breaker for pathological
cases (§7), not as the everyday sizing driver — on a normal day, the tier
buckets should resolve to a size well under the ceiling, and the ceiling
should rarely bind. Similarly, a soft minimum-attention rule (not a
fixed floor, and never overriding §7 of the priority model's "no minimum
Course representation" rule) can ensure that a day with only faint but
real signal (e.g. a single LOWER_SEVERITY_REPAIR candidate and nothing
else) still produces a visible, non-zero plan rather than being rounded to
empty by an overly strict per-tier rule — this directly serves the
`docs/PRODUCT.md` §13 principle discussed in §8 below.

Exact numeric caps (ceiling value, per-tier target counts, minimum-visible
count) are explicitly NOT decided by this document — see
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`/`docs/OPEN_QUESTIONS.md` #16.

### Why this over the alternatives

- It requires the least new machinery: tiers already exist and are already
  proven explainable; this model only adds a counting/capping layer on top
  of a ranked, already-tiered list — closer to `today-planner.ts`'s
  existing truncation shape than a wholesale scoring redesign.
- It avoids inventing a parallel numeric "mass" or "score" purely for
  sizing purposes (the risk called out in (a) and (c)), which would risk
  disagreeing with the ranking order's own (deliberately non-numeric)
  semantics.
- It naturally produces the exam-heavy-week growth behavior described in
  §7 without any explicit "exam mode": more REMEDIATION/DUE_REVIEW
  candidates exist when exam pressure raises lapses/misconceptions/overdue
  reviews across active Courses, so the buckets simply have more genuine
  members to include — same mechanism as the priority model's own §4 (no
  separate staleness signal needed; scheduler decay + tier membership does
  the work).

## 3. Explainability

Each model's ability to answer "why 6 items, not 20?" for a learner:

- (a) threshold: weak — requires exposing or gesturing at a numeric cutoff.
- (b) dynamic top-N: moderate — "today needed more attention than usual"
  is plausible but the exact N is still an opaque formula output.
- (c) need-mass budget: moderate-weak — similar issue to (a), one level
  removed; "your cumulative need reached today's limit after item 6" is
  technically explainable but unfamiliar and score-flavored.
- (d) tiered buckets: strong — "6 items are currently overdue or broken;
  nothing else needed attention today" is a sentence, not a number.
- (e) hybrid (recommended): strong on the common path (inherits (d)'s
  explainability), with the guardrail only needing an explanation on the
  rare day it actually binds ("you have unusually high need today across
  several courses, so today's plan is capped at a larger-than-usual size to
  keep it completable") — an honest, rare-event explanation is much less
  damaging to trust than a routinely-invoked opaque cutoff.

## 4. Calibration difficulty

Ranked hardest-to-calibrate to easiest, per the analysis above:
(c) need-mass budget (two coupled unknowns: mass function + budget) >
(a) absolute threshold (one unknown, but must absorb all cross-signal
scale at once) > (b) dynamic top-N formula (one unknown, but at least
maps onto a familiar integer count) > (d)/(e) tiered buckets with
guardrail (multiple small, individually interpretable constants — easier
to reason about and adjust independently, e.g. loosening the DUE_REVIEW
cap without touching REMEDIATION's behavior at all).

## 5. Exam-pressure behavior

The recommended model (§2) grows correctly during exam-heavy weeks without
being explicitly told an exam is near, because:

1. Approaching an exam increases the volume of genuinely due/lapsed/
   at-risk material for that Course (more reviews scheduled close
   together as desired retention assumptions tighten near an exam per
   `docs/OPEN_QUESTIONS.md` #12's still-open "whether desired retention
   changes near an exam date" — even without resolving that question, more
   candidates naturally cross into REMEDIATION/DUE_REVIEW simply because
   more material is being actively studied/reviewed in the exam's lead-up).
2. More genuine REMEDIATION/DUE_REVIEW candidates directly means larger
   tier buckets under model (d)/(e) — no exam-specific branch is needed in
   the sizing logic itself; the sizing model just counts what the
   (separately, correctly) exam-amplified ranking already surfaced (see
   `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §3/§7's exam-urgency-as-amplifier
   design for where the actual exam signal lives).
3. The guardrail (§2, §7) exists precisely so this natural growth cannot
   run away when multiple Courses hit exam pressure simultaneously —
   growing correctly and growing *without limit* are different concerns,
   and the hybrid model addresses both explicitly rather than conflating
   them into one mechanism.

## 6. Low-need days: shrinking correctly vs. looking broken

`docs/PRODUCT.md` §13 ("New Learner Experience") establishes a directly
relevant, pre-existing principle: the system must never present an empty
adaptive state as "Nothing to review" when the real situation is "We do not
know enough yet" — i.e., **insufficient evidence and genuinely low need are
different states and must not be visually or textually conflated.** This
document's sizing model inherits that distinction directly rather than
reinventing it:

- **Genuinely low need** (an established learner, strong mastery, nothing
  due, no misconceptions): the tiered-bucket model correctly produces a
  small plan — 0 REMEDIATION, 0 DUE_REVIEW, maybe 1-2 STRENGTHEN items —
  and this should be presented as "you're in good shape today," a
  positive, confident empty/near-empty state, not an apologetic or
  suspicious-looking one.
- **Insufficient evidence** (a brand-new learner or newly-joined Course
  with zero `UserQuestionProgress`): `generateNextBestActionCandidates`
  returns `[]` for every such Question (§0/§9 of the priority model), so
  the tiered-bucket sizing model would also naturally produce zero items
  from THIS mechanism — but per `docs/PRODUCT.md` §13 and
  `today-planner.ts`'s own documented gap ("a brand-new learner with zero
  progress legitimately gets a zero-item plan under V1's current logic...
  worth flagging"), this must not be presented as "nothing to review."
  This is exactly the case new-material exposure sampling
  (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §9, `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`)
  exists to fill — the sizing model's job for this case is to make room
  for a small number of exposure items (§9's illustrative 2-3 per new
  topic) alongside (or instead of, when the ranked-review bucket is
  legitimately empty) the tiered review buckets, so the plan is non-empty
  for a *different, correctly-labeled* reason ("let's get to know what you
  know") rather than silently producing the same-looking empty state as
  the "you're in good shape" case above.
- **Practical rule for this model**: before finalizing a day's size as
  zero (or near-zero) purely from the tiered-review buckets, the sizing
  logic must check whether the zero/near-zero result is due to
  insufficient evidence (sparse `UserQuestionProgress` across active
  Courses) or genuinely low need (evidence exists and indicates no
  elevated priority) — the two must route to different presented states
  even though the underlying tiered-bucket count may look identical. This
  is a presentation/composition rule the sizing model must respect, not a
  new number to calibrate.

## 7. Pathological huge days: what caps runaway growth

The primary risk scenario is a multi-Course exam pile-up: several active
Courses each independently produce a large REMEDIATION/DUE_REVIEW bucket
at once (e.g. three Courses all have exams in the same week, each with
many overdue reviews). Under model (d) alone ("include ALL REMEDIATION
items, uncapped"), this could sum to an unreasonably large single day.

The recommended hybrid model's guardrail (§2) is the intended cap: a soft
whole-plan ceiling that, on the rare day total genuine need would exceed
it, truncates the ranked (already tier + exam-urgency-ordered, per
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`) list at the ceiling rather than
including every qualifying candidate. Because the input list is already
correctly prioritized before this truncation happens, a capped day still
contains the MOST urgent items across all Courses first — the ceiling
discards low-priority-tail candidates, never high-priority ones. This
mirrors `today-planner.ts`'s existing truncation shape (`slice(0,
maxItems)` over an already-ranked list) almost exactly; the only change
this model proposes is that the ceiling is a backstop over tier-driven
inclusion rather than the everyday primary sizing mechanism.

This truncation is explicitly a same-day generation-time decision, not an
ongoing cap that reopens later — the items that don't make the cut on a
capped day are not lost forever; per `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§16 (no automatic carry-over), if their underlying need is still elevated
tomorrow, they will naturally reappear in tomorrow's fresh plan through
ordinary ranking, exactly as any other unresolved need would.

## 8. Preserving a genuine finish line

The product spec (§6, §13) requires: once a day's plan is generated, it has
a real finish line — items resolve to COMPLETED or SKIPPED, Skip does not
trigger replenishment, and the plan does not silently regrow. The
recommended sizing model preserves this directly, because sizing happens
**once, at generation time**, exactly like the current `today-planner.ts`
architecture:

- The tiered-bucket-plus-guardrail computation runs once, when the plan is
  first generated for the day (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §5,
  "first-open generation") — it is not re-run as items resolve during the
  day. Skipping 3 of 10 items does not re-invoke the sizing model to "find
  3 more" — there is no mechanism in this model that re-evaluates size
  after generation, matching §13's explicit rule.
- The ONLY sanctioned post-generation change to the item set is
  significant-event adaptation (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §12),
  which is scoped to replacing/inserting a small number of FUTURE,
  not-yet-resolved items in response to a specific triggering event — this
  is a narrow, separately-designed exception
  (`docs/TODAY_ADAPTATION_MODEL.md`, a companion document this one does
  not redesign or duplicate), never a general "size recalculation." This
  document's sizing model determines the plan's size and membership at
  generation time only; any change after that point is entirely
  adaptation's concern, gated by adaptation's own triggers, not by
  anything in this sizing model reacting to Skip/Complete events.
- Because the guardrail (§7) and bucket inclusion (§2) are both evaluated
  from the ranked candidate snapshot taken at generation time (matching
  `today-planner.ts`'s existing "snapshot in, plan out" purity property),
  there is no path by which ordinary session progress (completing or
  skipping items) could cause the sizing logic to run again and grow the
  plan — the finish line is structural, not merely a policy promise.

---

**Summary recommendation:** Use tiered need buckets (model d) as the
primary sizing mechanism — reusing the priority model's own tier structure
so bucket sizes emerge from genuine per-tier candidate counts rather than a
synthetic score — combined with a soft whole-plan ceiling (model b's
"dynamically computed N," repurposed as a rare-case guardrail rather than
the everyday driver) to prevent pathological multi-Course exam pile-ups
from producing an uncompletable day. Reject pure absolute-threshold (a) and
need-mass-budget (c) models as requiring a numeric proxy that conflicts
with the priority model's deliberately non-numeric, tiered design. Preserve
the finish line by computing size only once, at generation time, leaving
all post-generation change strictly to the separately-designed
significant-event adaptation mechanism (`docs/TODAY_ADAPTATION_MODEL.md`).
Distinguish, in presentation, a genuinely low-need day (small plan, "you're
in good shape") from an insufficient-evidence day (small plan from this
mechanism alone, but filled out by new-material exposure sampling instead)
per the pre-existing `docs/PRODUCT.md` §13 principle that "no history" must
never be presented as "nothing to review."

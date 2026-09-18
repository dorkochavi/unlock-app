# Global Today — Priority / Scoring Model (ANALYSIS, NOT DECIDED)

Status: **ANALYSIS ONLY. No weight, coefficient, threshold, or numeric bound
in this document is decided or final.** This document analyzes candidate
scoring ARCHITECTURES for ranking learning need across multiple Courses at
once, per the product direction accepted in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
(§7 ranking principles, §8 exam behavior, §9 new-material exposure, §10
novelty). It does not modify `src/domain/learning/next-best-action-ranking.ts`
or any other committed code, and it does not resolve
`docs/OPEN_QUESTIONS.md` #2 (exam-date hierarchy), #16 (Today Session Size —
see the companion `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` instead), or #17
(Today Composition).

## 0. What already exists and why it matters here

The current V1 single-Course ranking, `rankNextBestActionCandidates`
(`src/domain/learning/next-best-action-ranking.ts`), deliberately does NOT
use a numeric weighted score. It uses four discrete priority tiers
(`REMEDIATION` > `DUE_REVIEW` > `LOWER_SEVERITY_REPAIR` > `STRENGTHEN`) plus
a documented, deterministic tie-break chain (same-question type order, then
`now - dueAt` descending, then `retrievability` ascending, then `questionId`
ascending). The file's own doc comment states the rationale explicitly: "Do
not begin with one opaque score... the user sees a reason, not the number"
— quoting `docs/LEARNING_ENGINE.md` §28. `EXAM_PRIORITY` is explicitly
deferred in that same file, and `NextBestActionRankingContext` is
deliberately left as a plain `{ now }` interface specifically so an
exam-urgency input can be added additively later without redesigning the
function's contract.

`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3 establishes a second load-bearing
fact: `rankNextBestActionCandidates` and `generateTodayPlan` are ALREADY
Course-agnostic at the type level — neither `NextBestActionCandidate` nor
`TodayPlan`/`TodayPlanItem` carries a `courseId` field anywhere. This means
a cross-Course candidate pool can already be ranked with **zero changes to
the ranking algorithm itself**, simply by generating candidates per active
Course (`generateNextBestActionCandidates` over each Course's
`UserQuestionProgress` rows) and concatenating the lists before calling
`rankNextBestActionCandidates` once. Any priority model recommended below
should be evaluated against how much it disturbs this "reuse unchanged"
property, since it is the cheapest, most proven path available.

## 1. The core tension this document exists to resolve

The existing tiered model works well for a single Course because all
candidates share one implicit context: same content difficulty
distribution, same Course-relative baseline, same (currently absent) exam
context. Global Today removes that shared context. Two new problems appear
that the single-Course model never had to solve:

1. **Cross-Course comparability.** Is Course A's "overdue by 3 days" the
   same urgency as Course B's "overdue by 3 days"? Is a `retrievability` of
   0.6 in a hard graduate Course as fragile as 0.6 in an easy intro Course?
2. **A new candidate dimension that didn't exist before: exam urgency**,
   which is inherently Course-scoped (each Course has its own, possibly
   absent, exam date) and must not structurally punish Courses that have no
   exam at all (§8 of the product spec: "a Course does not require an exam
   to participate in Today").

Everything below is organized around these two problems plus the six
candidate components named in this session's product discussion: Memory
Need, Learning Gap, Exam Urgency, Misconception, Coverage Need,
Recency/Novelty.

## 2. Normalization and cross-Course comparability

### 2.1 Signals that are already comparable across Courses without normalization

Some of the current candidate signals are defined in units that are
inherently Course-independent, because they are properties of the
scheduler or the evidence itself, not of Course content difficulty:

- **`retrievability`** (from the `MemoryScheduler`, ADR-008/FSRS-family) is
  a probability of successful recall at `now`, in `[0, 1]`, by construction
  — it does not need renormalization to be compared across Courses. A 0.4
  in Course A and a 0.4 in Course B both mean "roughly 40% chance of
  successful recall right now" under the same scheduler model. This is a
  genuine cross-Course-comparable signal today.
- **`now - dueAt`** (overdue duration) is a wall-clock quantity and is
  already comparable in an absolute sense — 5 days overdue is 5 days
  overdue regardless of Course. What is NOT comparable is whether "5 days
  overdue" carries the same *practical* risk in a Course with a
  fast-decaying scheduler profile vs. a slow one; the current model
  sidesteps this by using overdue duration only as a tie-break, never a
  primary driver, specifically to avoid double-counting what
  `retrievability` (or the applicability gate itself) already captures.
- **Misconception state** (`suspected` / `active`) is a categorical state,
  not a magnitude — "active" in Course A and "active" in Course B are the
  same qualitative claim ("a confidently-held wrong belief exists"),
  independent of Course content.

### 2.2 Signals that are NOT inherently comparable and need explicit design

- **"Learning Gap"** (however operationalized — e.g. distance from
  mastery, or fraction of a Course's material below some mastery bar) is
  the clearest case where naive comparison fails. A Course with harder
  material, or with a learner who joined recently, will structurally show
  a larger raw "gap" than a Course the learner has studied for months —
  without that necessarily meaning the learner *needs* more attention on
  the harder Course today. Comparing raw gap magnitudes across Courses
  bakes in whichever Course's content happens to be harder or less
  covered, which is a content-authoring artifact, not a genuine
  need signal.
- **"Coverage Need"** has the same problem in a different shape: a Course
  with 500 Questions and 20 covered has a very different absolute coverage
  number than a Course with 30 Questions and 20 covered, even though the
  second learner may be closer to comprehensive coverage of that Course.
- **Exam Urgency** is Course-scoped by definition (§8, §"K. Exam urgency"
  of `docs/LEARNING_ENGINE.md`: "Exam proximity changes ranking, not memory
  state") and a Course with no exam has, structurally, no urgency signal
  to contribute at all — see §3 below for why this must never mean "zero
  score."

**Recommendation for this class of signal:** wherever a signal is a
Course-relative magnitude (Learning Gap, Coverage Need), it should be
computed and compared as a Course-relative measure (e.g. a percentile or
z-score *within that Course's own candidate pool*, or relative to that
learner's own history in that Course), never as a cross-Course raw number.
This document does not prescribe the exact normalization function — that
is a coefficient-level decision explicitly out of scope — but it does
recommend the *architectural rule*: any signal whose raw scale depends on
Course content size/difficulty must be Course-relative before it competes
against another Course's candidates. Signals that are already
scheduler-derived probabilities or durations (retrievability, overdue time)
do not need this treatment.

## 3. Exam-free Courses must not be structurally disadvantaged

If Exam Urgency were implemented as an additive term in a single unified
score (e.g. "+20% weight if you have an exam"), a Course with no exam date
at all has only one sane way to be scored on that term: zero. Under a naive
weighted-sum model, this silently converts "no exam" into "permanently
missing 20% of the possible ceiling on this Course's candidates" — the
exact structural disadvantage §8 explicitly forbids ("a Course with no exam
may outrank a Course with a distant exam because of memory risk, weakness,
misconception... exam-free Courses must not be penalized").

Two architectural options avoid this:

1. **Exam Urgency as a multiplicative amplifier on top of a base need
   score, not an additive term.** A Course with no exam gets an amplifier
   of exactly 1.0 (neutral — "no change"), never a term that goes missing
   or defaults to a punishing zero inside a sum. This matches the product
   spec's own word choice: exam proximity is described as an "urgency
   amplifier," not a component to be summed in. It also matches
   `docs/LEARNING_ENGINE.md` §29 ("An exam does not magically increase
   mastery... it changes the cost of forgetting") — an amplifier on
   existing need is the correct shape for "changes the cost," whereas an
   additive term would let exam proximity manufacture urgency out of
   nothing (e.g. a fully mastered, zero-need Question should not become
   "urgent" purely because an exam is close).
2. **Exam Urgency as a tie-break/ordering dimension within an otherwise
   tier-based model** (see §7), applied only to candidates that already
   cleared a tier on other grounds. This has the same neutrality property
   by construction — a candidate with no exam simply sorts as if the
   dimension were absent, never as "worst."

Either option satisfies the constraint. This document recommends option 1
be used only as a modifier on an already-computed base need value (never as
a raw addend), and recommends against ever computing "exam score - no exam
score" as a subtraction that could go negative or otherwise penalize.

## 4. How strong material naturally resurfaces without a maintenance quota

The product spec (§7) explicitly forbids a maintenance floor: strong
material must return to Today only because the ranking function's own
signals say so, never via a separate "make sure old material gets touched"
quota. This is actually a property the *existing* scheduler-driven design
already provides for free, and Global Today should inherit it rather than
invent a parallel mechanism:

- `retrievability` is recomputed at `context.now` from the `MemoryScheduler`
  (never persisted, never stale — see `next-best-action.ts`'s own design
  rule: "retrievability is recomputed here via the injected MemoryScheduler,
  never persisted or read from a stale field"). As elapsed time since last
  review grows, retrievability decays according to the FSRS-family model
  (ADR-008), which is precisely "previously-strong material's retrieval
  need rises again with elapsed time" — this is the scheduler's job, not a
  scoring-layer job.
- Once `scheduledReviewAt <= now`, `REVIEW_DUE` becomes applicable again
  (candidate generation, `next-best-action.ts`), which re-enters the
  candidate pool and therefore Global Today's ranking, purely from elapsed
  time and the scheduler's own math — no maintenance-quota code needed.

**Architectural implication:** Global Today's priority model does not need
its own "time since last touched" term distinct from what the scheduler
already encodes in `retrievability`/`dueAt`. Introducing a second,
independently-tuned "staleness" signal risks double-counting the same
underlying phenomenon the scheduler already models (the same
double-counting concern the existing tie-break comment raises about
`retrievability` vs. the REVIEW_DUE/RELEARN_LAPSE applicability gate).
Recommendation: let strong material's resurfacing be entirely a
consequence of scheduler decay + due-date crossing, exactly as V1 already
does per-Course; Global Today's only job is to rank that resurfaced
candidate fairly against candidates from other Courses (§2), not to invent
a second resurfacing mechanism.

## 5. Where new-material exposure fits

Per §9 of the product spec and `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`
(companion document — not owned by this one), new-material exposure
questions are explicitly NOT mastery/retrieval evidence — they are
calibration/sampling. `next-best-action.ts` itself documents that
`NEW_LEARNING`/`EXPAND_COVERAGE` are deliberately unimplemented in V1
because "a Question with zero Attempts has no progress row to reason from
at all" — there is no `UserQuestionProgress` to generate a candidate from.

This means new-material exposure candidates are **not** naturally
commensurable with the four existing candidate types inside one score:
REVIEW_DUE/RELEARN_LAPSE/REPAIR_MISCONCEPTION/STRENGTHEN_MEMORY all
describe *how urgently existing evidence demands attention*; a new-material
exposure item describes *whether unstudied material should be sampled at
all* — a fundamentally different kind of decision (closer to "coverage
policy" than "urgency"). Recommendation: treat new-material exposure as a
**separate allocation decision made alongside, not inside, the unified
priority score** — e.g. "reserve a small number of today's slots for
exposure sampling per the novelty budget (§10, `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`),
then rank the remaining slots by the unified priority model below." This
keeps the priority score's semantics clean (it always answers "how
urgently does existing evidence demand attention") and avoids inventing a
synthetic "urgency" number for material that has, by definition, no
evidence yet to be urgent about.

## 5a. Reconciliation note (post-decision): Memory Need must be able to cross tier boundaries

Dor's product-owner review has accepted a rule this document did not
anticipate and does not yet satisfy: **there is no per-Course floor, but
increasing Memory Need/overdue duration MUST be able to cross priority
TIERS**, so that a `DUE_REVIEW`-tier candidate cannot be permanently capped
below a `REMEDIATION`-tier candidate forever regardless of how overdue it
becomes (`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5, resolving
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md` Finding 5 — see that document's
reconciliation note). This is a **requirement on the ranking function
itself**, not merely an analysis finding to weigh — it is now binding,
though the exact formula/mechanism by which overdue duration escalates a
candidate across tier boundaries remains open calibration work, explicitly
not decided by the accepted rule.

This directly qualifies §7/§14's recommendation below: "tier as the primary
ordering axis, exam urgency only within-tier" is **no longer sufficient as
stated** — the ranking architecture must also allow sufficiently severe
Memory Need/overdue duration to eventually promote a candidate across what
was previously an absolute tier boundary (e.g. `tierOf()` in
`next-best-action-ranking.ts` currently has zero dependency on `dueAt`/
`retrievability`, per the adversarial review's Finding 5 — this is exactly
the gap the new rule requires closing). This does not mean tiers are
abolished, and it does not reopen §7 (the "no unified numeric score"
critique of Option A remains valid) — it means the tier-assignment/ordering
function needs a bounded escalation path that today's `tierOf()` does not
have. Exact escalation thresholds, curve shape, and whether this is
implemented as a soft tier-promotion rule or a different mechanism entirely
are NOT decided here or by the accepted rule — this is flagged as new,
required scope for whoever designs the eventual `tierOf()`/ranking
replacement, not solved by this document.

## 5b. Reconciliation note (post-decision): misconception state model

Dor's product-owner review has since accepted a 4-state misconception
model, `NONE → SUSPECTED → ACTIVE → RESOLVED`
(`docs/LEARNING_ENGINE.md` §20a, `docs/OPEN_QUESTIONS.md` #13), refining
the `suspected`/`active` shorthand used throughout this document (§2.1,
§7, §10). This is compatible with, not a change to, this document's tier
reasoning: `ACTIVE` → REMEDIATION and `SUSPECTED` → LOWER_SEVERITY_REPAIR
as already stated; `NONE` and `RESOLVED` both mean "no misconception-driven
tier contribution," exactly as the absence of `suspected`/`active` already
implied wherever this document used the two-state shorthand. No tier logic
described here changes as a result.

## 6. Implication of "no quota / no fairness floor" for the scoring architecture

§7 forbids: artificial per-Course quotas, fairness balancing, minimum
Course representation, and a maintenance floor. This has a direct and
important architectural consequence: **the scoring model must not contain
any Course-level aggregate term at all** — no "average need across this
Course's candidates," no "boost the Nth-ranked item from an
under-represented Course," no per-Course normalization that compares one
Course's overall need to another's and redistributes slots to equalize
them. Any such term would be a disguised quota. The only legitimate
Course-relative computation is the WITHIN-Course normalization already
described in §2 (e.g. "is this candidate strong or weak *relative to this
Course's own distribution*"), which exists purely to make one candidate's
raw signal honest, not to compare or balance Courses against each other
after the fact. Concretely: normalize within a Course, then rank candidates
globally with no further Course-aware adjustment — the ranking step itself
must be Course-blind once each candidate's own signals are honest, exactly
as `rankNextBestActionCandidates` is already Course-blind at the type
level today (§0).

## 7. Discrete tiers vs. numeric score vs. hybrid — recommendation

Three options, evaluated against: explainability (`docs/OPEN_QUESTIONS.md`
#18), the existing tiered model's proven rationale, and the new
cross-Course/exam-urgency requirements above.

**Option A — Pure numeric weighted score (e.g. the illustrative
30/25/20/10/10/5 split).** Pros: naturally handles cross-Course ranking
(everything is one comparable number), easy to explain "why this ranks
above that" mechanically. Cons: this is exactly the "one opaque score"
`next-best-action-ranking.ts`'s own doc comment and `docs/LEARNING_ENGINE.md`
§28 explicitly reject for V1 ("Do not begin with one opaque score... the
user sees a reason, not the number") — reversing that decision for Global
Today, with no new evidence that the underlying explainability concern has
gone away, would be a regression, not an extension. It also reintroduces
the normalization problem from §2 for every component at once, with no
tier structure to fall back on when components disagree qualitatively
(e.g. how does a weighted sum meaningfully compare "high Memory Need, zero
Misconception" against "zero Memory Need, active Misconception" without an
arbitrary tradeoff rate between qualitatively different failure modes —
the same arbitrariness the current tie-break comment calls out between
RELEARN_LAPSE and REPAIR_MISCONCEPTION(active), and deliberately resolves
with a documented, arbitrary-but-stable order rather than a numeric ratio).

**Option B — Pure Course-relative percentile score, no tiers.** Pros:
solves cross-Course comparability directly (a percentile is comparable by
construction). Cons: percentile rank alone loses the qualitative
distinction the current model treats as primary — "broken" (REMEDIATION)
vs. "routine maintenance" (DUE_REVIEW) vs. "positive progress"
(STRENGTHEN) — collapsing them into one axis reintroduces exactly the kind
of same-score-different-meaning ambiguity the tiered model was built to
avoid. It would also make misconception urgency's qualitative severity
compete on the same axis as ordinary due-review overdue-ness, which
`next-best-action-ranking.ts` currently keeps in different tiers precisely
because they are "qualitatively different problems... of comparable
severity" that should not be silently traded off against each other by a
formula.

**Option C — Hybrid: extend the existing discrete-tier model globally,
adding Exam Urgency and cross-Course normalization only inside the
tie-break/amplifier layer, not as new tiers competing with tier order.**
Recommended. Concretely:

- Keep the four existing tiers (`REMEDIATION` > `DUE_REVIEW` >
  `LOWER_SEVERITY_REPAIR` > `STRENGTHEN`) as the GLOBAL primary ordering
  axis, computed exactly as today, over the concatenated cross-Course
  candidate pool (§0 — this requires no change to `tierOf`).
- Within a tier, extend the tie-break chain with an
  **exam-urgency-modified overdue/retrievability comparison** rather than
  a raw new numeric field: e.g. treat exam urgency as a multiplier applied
  to the existing `now - dueAt` / `retrievability` tie-break values (per
  §3's amplifier design), so a Course with no exam simply uses the
  tie-break values unmodified (amplifier = neutral), and a Course with an
  imminent exam has its same-tier candidates sort earlier without ever
  needing a separate additive "exam score" term.
- Misconception state continues to determine tier membership exactly as
  today (`active` → REMEDIATION, `suspected` → LOWER_SEVERITY_REPAIR) —
  Global Today does not change what makes a candidate belong to a tier,
  only how same-tier candidates from different Courses are ordered against
  each other.
- New-material exposure and coverage-need candidates are handled outside
  this tiered ranking entirely, per §5/§6 above (a separate allocation
  step, not a competing tier).

This keeps the "user sees a reason, not the number" property Global Today
inherits from V1, requires the least change to proven code (§0), and gives
exam urgency a role that is additive to explainability ("this is due, and
your exam is in 3 days" is still a sentence a learner can read) rather than
an opaque coefficient.

**See §5a for a since-accepted requirement this recommendation does not yet
satisfy**: Memory Need must also be able to cross tier boundaries, not only
break ties within one — Option C as described here needs that extension
before it fully satisfies the accepted rules.

## 8. Tie-breaking at Global Today scale

The existing tie-break chain (same-question type order → overdue
descending → retrievability ascending → questionId ascending) remains
structurally sound at Global Today scale because none of its four
dimensions are Course-scoped by definition (§2.1) — they compare honestly
across Courses without modification. The one addition recommended is the
exam-urgency amplifier from §7, inserted as an early tie-break dimension
(after tier, before or blended into the overdue comparison — the exact
position is a coefficient-level decision, not resolved here) specifically
because exam urgency is described in the product spec as changing
*ranking*, never tier membership (§8, `docs/LEARNING_ENGINE.md` §29/"K").
`questionId` ascending remains the final, stable, arbitrary tie-break
exactly as today — Global Today does not need a new "which Course wins
ties" rule, because by this point every genuinely meaningful signal has
already been consulted.

## 9. Stale evidence, sparse evidence, and uncovered topics

- **Stale evidence** (a Course untouched for weeks) is handled entirely by
  scheduler decay per §4 — no separate staleness signal needed. A Course
  that has been quiet simply has candidates whose `retrievability` has
  decayed and whose `dueAt` has passed, which is sufficient for it to
  re-enter the pool competitively without any special-casing.
- **Sparse evidence** (a Course the learner just joined) is the harder
  case: `generateNextBestActionCandidates` produces nothing at all for a
  Question with no `UserQuestionProgress` (returns `[]`), so a brand-new
  Course legitimately contributes zero REVIEW_DUE/RELEARN_LAPSE/
  REPAIR_MISCONCEPTION/STRENGTHEN_MEMORY candidates on day one. This is
  correct, not a bug — a Course with no evidence has no urgency to report
  on those axes. It is the new-material exposure mechanism (§5,
  `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`), not the priority score, whose
  job is to make sure a sparse-evidence Course still gets *some*
  representation (via exposure sampling, capped by the novelty budget of
  §10) rather than the priority model inventing fake urgency to compensate
  for missing evidence — inventing such urgency would itself be a
  disguised fairness floor, forbidden by §6.
- **Uncovered topics** within an otherwise-active Course are a Coverage
  Need signal (§2.2) and should be normalized Course-relatively, same as
  Learning Gap — an uncovered topic in a 500-Question Course is not
  automatically "more urgent" than one in a 30-Question Course merely
  because the raw uncovered count is bigger.

## 10. Misconception urgency across Courses

Misconception state (`suspected`/`active`) is categorical and Course-blind
by construction (§2.1) — an active misconception in Course B correctly
outranks a routine due-review in Course A with no exam, exactly as
worked-example 2 in `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §19 describes
("Y's item outranks X's routine review, because misconception severity
does not depend on exam proximity"). No special cross-Course treatment is
needed for misconception urgency beyond what tier membership already
provides (§7) — this is one of the cleanest signals precisely because it
was never Course-relative to begin with.

## 11. Saturation: healthy concentration vs. scoring bug

§7 and worked example 3 ("80% of Today from one Course") explicitly accept
heavy concentration as correct behavior when genuinely warranted. The
distinction between healthy concentration and a scoring bug is not about
the *proportion* itself but about **why** it occurred:

- **Healthy concentration**: one Course's candidates occupy the higher
  tiers (REMEDIATION/DUE_REVIEW) in large numbers because that Course
  genuinely has more broken/overdue material right now (e.g. midterm week,
  many reviews came due simultaneously) — every one of those candidates
  earned its tier/tie-break position on its own qualitative merits, and
  other Courses' candidates are simply lower-tier or absent because they
  have less genuine need today.
  Should be a symptom flag, not silent truncation:
  a well-behaved model concentrating correctly should still leave room, in
  the STRENGTHEN/LOWER_SEVERITY_REPAIR tiers or via the size model's own
  logic, for other Courses' genuine (lower) need to surface — see the
  companion `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` for how plan size
  itself avoids one Course silently consuming the entire day's item budget
  through cumulative-need mechanics.
- **A scoring bug** would look like: one Course dominating because a
  normalization step failed (e.g. Course-relative percentiles not actually
  applied, so a Course with harder content structurally always "wins" on
  raw Learning Gap regardless of actual learner state — see §2.2), or
  because an exam-urgency amplifier was implemented additively rather than
  multiplicatively and is inflating scores independent of underlying need
  (§3), or because a signal is double-counted (§4's warning about
  staleness vs. retrievability). The test for "is this a bug" is:
  **does every dominant candidate independently justify its own tier and
  tie-break position using only that candidate's own Course-relative
  signals?** If yes, 80%-from-one-Course is the intended behavior. If a
  Course dominates only because of a shared normalization defect that
  would equally mis-rank a hypothetical swapped scenario, it is a bug.

This is a diagnostic principle for future testing/review
(`docs/GLOBAL_TODAY_TEST_PLAN.md`, a separate companion document), not a
new mechanism to build — no code change is implied by this section.

## 12. Exam urgency curve — critique of the illustrative calibration

The product spec's illustrative, explicitly non-final calibration
direction ("urgency begins rising meaningfully ~14 days before an exam,
more strongly ~3-4 days before") is a reasonable qualitative shape to
critique but not to adopt as a formula:

- **Reasonable as a starting shape**: a monotonically increasing curve
  with an inflection point closer to the exam date matches the intuitive
  "cost of forgetting" framing of `docs/LEARNING_ENGINE.md` §29 — far from
  an exam, forgetting is cheap (there is time to re-learn); close to an
  exam, forgetting is expensive (no time left to recover). A two-stage
  (14-day / 3-4-day) shape is a reasonable piecewise approximation of that
  intuition.
- **Risks if adopted literally without further design**:
  - **Multiple exams per Course or per learner** are not addressed — if a
    learner has a personal exam date that differs from a Course exam date
    (`docs/OPEN_QUESTIONS.md` #2, still OPEN), the curve needs a resolved
    exam-date hierarchy before it can even be evaluated per-candidate; this
    document does not resolve #2 and the curve should not be implemented
    until it is.
  - **Interaction with tier membership** (§7): if implemented carelessly,
    a sharply rising curve close to an exam could be tempted to *promote*
    a candidate across tiers (e.g. make a STRENGTHEN item outrank another
    Course's REMEDIATION item purely because of proximity) — the
    architecture recommended in §7 deliberately prevents this by confining
    exam urgency to the tie-break/amplifier layer, never tier membership,
    specifically so this failure mode cannot occur regardless of how
    aggressive the curve's final shape turns out to be.
  - **Discontinuities at the 14-day and 3-4-day boundaries** in a
    piecewise curve could cause a candidate's relative order to jump
    sharply on a single day's passing, which would look arbitrary to a
    learner reading "why did this suddenly rank higher" — a smooth
    (e.g. continuously increasing) curve avoids this at the cost of being
    less simple to reason about; this tradeoff is a coefficient-level
    decision, correctly out of scope here.
  - **No exam vs. very distant exam** must resolve to the same neutral
    amplifier (§3) — the curve's calibration must not treat "no exam
    date set" as different from "exam so far away urgency is
    negligible" in any way that could be mistaken for penalizing missing
    data versus genuinely low urgency.

## 13. Candidate-pool size behavior (10 vs. 10,000)

- **Small pools (~10 candidates, e.g. a light day or a new learner across
  a couple of Courses)**: the tiered model degrades gracefully — with few
  candidates, tier separation still holds, and the tie-break chain remains
  fully deterministic even with very few ties to break. No special
  handling needed.
- **Large pools (~10,000 candidates, e.g. many active Courses, all with
  overdue material simultaneously)**: the tiered ranking itself remains
  correct (sorting cost is unaffected by which comparator is used), but
  this is precisely where §6's warning matters most — at large scale, a
  normalization defect (§11) or an unbounded exam-urgency amplifier (§3)
  has the most room to produce a pathological concentration, because there
  are enough same-Course candidates available to fill an entire day's plan
  many times over. The priority model's job at this scale is only to
  produce a correctly ordered list; it is the size model
  (`docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`) that is responsible for
  preventing a 10,000-candidate pool from producing a pathologically large
  or single-Course day, not the priority model itself. This is a
  deliberate separation of concerns matching the existing
  ranking/planning split already in the codebase (`next-best-action-ranking.ts`
  ranks; `today-planner.ts` truncates — see both files' doc comments) and
  should not be blurred for Global Today.

## 14. Staged filtering + scoring vs. one unified score — final recommendation

Recommendation: **staged, tier-first-then-modified-tie-break**, i.e. Option
C from §7, extended additively from the existing single-Course model:

```
1. Generate candidates per active Course (unchanged — next-best-action.ts,
   called once per Course's UserQuestionProgress rows).
2. Concatenate into one cross-Course candidate pool (new — no code change
   to candidate generation itself).
3. Rank with rankNextBestActionCandidates-equivalent logic:
   a. tier (unchanged: REMEDIATION > DUE_REVIEW > LOWER_SEVERITY_REPAIR >
      STRENGTHEN — computed exactly as today, Course-blind);
   b. within tier: exam-urgency-amplified overdue/retrievability tie-break
      (new dimension, amplifier-shaped per §3, neutral for exam-free
      Courses);
   c. existing tie-break chain unchanged below that (retrievability
      ascending, questionId ascending).
4. New-material exposure candidates are allocated separately (§5), not
   scored inside this chain.
5. Coverage-need / uncovered-topic signals feed exposure allocation (step
   4) and/or Course-relative Learning Gap normalization (§2), not a raw
   cross-Course number.
```

This is explicitly NOT a unified numeric score. It is staged filtering
(tier) followed by staged, still-qualitative tie-breaking — the same shape
the current model already uses, extended by exactly one new dimension
(exam urgency, as an amplifier) and one new precondition (candidates now
come from many Courses, which the type system already supports per §0).

## 15. Critique of the illustrative 30/25/20/10/10/5 weighting

This weighting (30% Memory Need, 25% Learning Gap, 20% Exam Urgency, 10%
Misconception, 10% Coverage Need, 5% Recency/Novelty) is a reasonable
**illustration of which factors matter and their rough relative
importance** for product discussion purposes, but should not be adopted as
an implementation formula, for reasons specific to this analysis:

1. **It is a single unified weighted sum**, which §7's analysis above
   rejects as a regression from the existing, deliberately-non-numeric V1
   model, for the same explainability reasons documented in
   `next-best-action-ranking.ts` and `docs/LEARNING_ENGINE.md` §28.
2. **"Learning Gap" at 25% is not cross-Course comparable** without a
   normalization step this weighting does not specify (§2.2) — as written,
   it would let raw content-difficulty differences between Courses drive a
   quarter of the total score, independent of genuine learner need.
3. **"Exam Urgency" at a flat 20% additive weight is exactly the additive
   pattern §3 identifies as structurally disadvantaging exam-free
   Courses** — an exam-free Course's candidates permanently forfeit 20% of
   the achievable score under this formula, which directly contradicts §8
   of the product spec ("a Course does not require an exam to participate
   in Today... must not be penalized").
4. **Static weights cannot adapt to sparse-evidence Courses** (§9): a
   newly-joined Course has near-zero Memory Need, Learning Gap, and
   Misconception signal simply because there is no evidence yet, not
   because the Course lacks urgency — under a fixed-weight sum, "no
   evidence" and "confirmed low urgency" are indistinguishable, which
   again risks either inventing false urgency to compensate (a disguised
   floor, forbidden by §6) or silently starving new Courses of any
   representation (contradicting the exposure mechanism's intent, §5/§9 of
   the product spec).
5. **Misconception at only 10% risks under-weighting a qualitatively
   severe, low-frequency signal** — the existing model treats an active
   misconception as REMEDIATION-tier (top priority) regardless of how it
   compares numerically to other signals, precisely because severity here
   is not naturally expressible as "10% of a sum"; a rare-but-severe signal
   diluted into a weighted average can be outvoted by several
   simultaneously-elevated-but-individually-minor signals, which the
   discrete-tier model structurally prevents.
6. **5% for Recency/Novelty conflates two different mechanisms** (§4's
   scheduler-driven resurfacing vs. §5's exposure-allocation) that this
   document argues should not even live inside the same scoring pass.

The illustrative weighting remains useful as a **prioritized reading list
of which signals matter**, in roughly the order Memory Need > Learning Gap
≈ Exam Urgency > Misconception ≈ Coverage Need > Recency/Novelty — but the
architecture recommended in §14 expresses that priority through tiers and
staged tie-breaks rather than through fixed percentage weights.

## 16. Worked examples (ILLUSTRATIVE ONLY — no numbers here are calibrated)

### Example 1: Three Courses, tier-driven ranking (matches product spec §19's first example)

Learner state (made up for illustration):

| Candidate | Course | Signal | Tier (current rule) |
|---|---|---|---|
| Q101 | A (exam in 3 days) | REVIEW_DUE, retrievability 0.35 | DUE_REVIEW |
| Q102 | A (exam in 3 days) | RELEARN_LAPSE | REMEDIATION |
| Q210 | B (no exam) | REPAIR_MISCONCEPTION(active) | REMEDIATION |
| Q211 | B (no exam) | STRENGTHEN_MEMORY | STRENGTHEN |
| Q305 | C (quiet 2 weeks, nothing overdue/lapsed/misconceived) | — no candidate generated | (absent) |

Ranking under the recommended architecture (§14):

1. **Tier 1 (REMEDIATION):** Q102 (A) and Q210 (B) — both broken-state
   candidates. Tie-break: same-question type order doesn't apply (different
   questions); exam-urgency-amplified overdue/retrievability decides
   ordering between them. Q102's Course A has an imminent exam (amplifier
   > 1.0), Q210's Course B has none (amplifier = neutral) — so, all else
   comparable, Q102 could rank first, but only because it is ALSO
   independently REMEDIATION-tier on its own memory signal, not because
   the exam manufactured urgency from nothing (§3). If Q210's underlying
   retrievability/overdue values are far more extreme than Q102's, the
   unamplified tie-break dimensions can still put Q210 first — the
   amplifier nudges within-tier order, it does not override the candidate's
   own honest signal.
2. **Tier 2 (DUE_REVIEW):** Q101 (A).
3. **Tier 4 (STRENGTHEN):** Q211 (B).
4. **Course C contributes nothing today** — not because of a floor being
   denied, but because it genuinely has no elevated-need candidate right
   now (matching product spec §19's own framing of this exact scenario).

Result ordering: Q102, Q210, Q101, Q211 (Course C absent). This matches the
product spec's qualitative expectation ("mostly Course A... one or two
Course B items... likely zero Course C items") while showing the mechanism
that produces it — tier membership plus an amplifier, not a weighted sum.

### Example 2: No-exam Course outranking a distant-exam Course (matches product spec §19's second example)

| Candidate | Course | Signal | Tier |
|---|---|---|---|
| Q501 | X (exam in 40 days) | REVIEW_DUE, mildly overdue | DUE_REVIEW |
| Q612 | Y (no exam at all) | REPAIR_MISCONCEPTION(active) | REMEDIATION |

Q612 is REMEDIATION-tier; Q501 is DUE_REVIEW-tier. Tier ordering alone
places Q612 first, with no need to even consult the exam-urgency amplifier
— and even if it were consulted, X's 40-day-distant exam should map to a
near-neutral amplifier under any reasonable curve (§12), and Y's amplifier
is neutral by definition (no exam, §3). The outcome (Q612 first) is
therefore robust to exam-urgency calibration details, which is a desirable
property: the qualitative claim in product spec §19 ("misconception
severity does not depend on exam proximity") should hold regardless of
exactly how the illustrative 14-day/3-4-day curve is eventually calibrated
— a sign that tier membership, not the amplifier, is correctly doing the
heavy lifting for this case.

---

**Summary recommendation:** Extend the existing discrete-tier + tie-break
model (`next-best-action-ranking.ts`) additively across a concatenated
cross-Course candidate pool, adding exactly one new tie-break dimension
(an exam-urgency amplifier, neutral for exam-free Courses, applied within
tier — never across tiers, never as an additive score). Normalize
Course-relative signals (Learning Gap, Coverage Need) within each Course
before they enter ranking; keep scheduler-derived signals
(retrievability, dueAt) as-is since they are already comparable. Handle
new-material exposure as a separate allocation step outside the ranking
score entirely. Do not adopt a unified numeric weighted score (including
the illustrative 30/25/20/10/10/5 split) as an implementation formula.

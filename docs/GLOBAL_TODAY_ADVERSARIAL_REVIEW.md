# Global Today — Adversarial Review

Status: **HOSTILE REVIEW — ANALYSIS ONLY. No finding here resolves a
product question. Where Dor must decide something, this document says so
plainly and does not propose an answer on his behalf.**

This document tries to break `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` /
`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016, Status: PROPOSED), grounded in the actual committed code in
`src/domain/learning/` and `src/application/learning/` rather than in the
product spec's own self-description. Every claim below either cites a real
file/line or is explicitly marked as a scenario that cannot yet be checked
against real code because the relevant mechanism does not exist yet.

At the time of writing, `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` and
`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md` (a parallel workstream this
session) were not present in `docs/`. Findings below that depend on which
of `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §9's Option A/B/C is eventually
chosen say so explicitly rather than assuming the design draft's
non-binding Option C lean is final.

---

## 1. Double-counting: is "structurally already prevented" actually airtight?

`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §6 splits this into two sub-risks and
claims sub-risk 1 (evidence double-counting) is "already structurally
prevented," while sub-risk 2 (plan-membership double-counting) is "a
genuine gap." Re-examined with fresh skepticism:

**Sub-risk 1 (evidence double-counting) — the "airtight" claim mostly
holds, but for a narrower reason than stated, and with one real gap.** The
design draft's argument is: `applyAttemptToProgress`
(`src/domain/learning/progress-update.ts`) only ever folds one real Attempt
per submission, and `UserQuestionProgress` has no "which Today view"
concept. Verified by reading `submit-answer.ts`: idempotency is keyed on
`(user_id, submission_id)` (ADR-010), and a genuine retry short-circuits
before any progress mutation. **This part is true regardless of which of
Option A/B/C is chosen** — it is a property of `submitAnswer`'s own
transaction model, not of the Today persistence shape, so the design
draft's claim is correctly scoped here.

**The real gap in this claim**: it proves "one `submissionId` → one
Attempt → one progress fold," which is not the same as "a learner cannot
generate two independent, individually-legitimate Attempts for the same
`TodaySessionItem` on the same day." Nothing in `submit-answer.ts` checks
whether `todaySessionItemId`'s current `status` is already `"completed"`
before accepting a new Attempt against it — `submitAnswerInTransaction`
validates ownership (`todaySessionItem.userId`/`questionId`/`questionVersionId`
match) but never checks `todaySessionItem.status`. If a UI surface (or a
retry with a freshly-generated `submissionId`, which is fully within the
client's control) submits a second Attempt against an already-completed
item, `submitAnswer` will accept it as a second, genuine Attempt and fold
it into progress via the normal incremental or rebuild path — this is not
new to Global Today (it is already possible in the shipped Course-scoped
Today), but Global Today's two-entry-points-to-one-item design (ADR-016
§1) makes it *more likely to be triggered accidentally* (e.g. a learner
answers Q17 via Global Today, then later the same day opens Course Today
and — not realizing Q17 already shows completed there too — answers it
again through a UI path that still lets them). This is a genuine,
code-verified, pre-existing gap that Global Today's design makes more
reachable, not a new defect Global Today introduces from nothing.

- **Severity:** Low-to-moderate (it produces genuine extra evidence, not
  corrupted data — `retrieval-qualification.ts`'s session/gap gates still
  apply to whether it counts as *spaced* evidence).
- **Likelihood:** Low today (Course-scoped Today has one entry point per
  item); rises under Global Today (two entry points to the same item).
- **Current mitigation:** None. No status check exists on this path.
- **Classification:** IMPLEMENTATION.
- **Dor decision needed?** No — this is a fixable gap (add a status check
  in `submitAnswer`'s Today-attached branch), not a product ambiguity.

**RESOLVED by `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §6 / ADR-016
(ACCEPTED):** this finding predicted correctly, and Dor's product-owner
review has now made the fix a stated product rule, not just an engineering
default: a `DailyPlanItem` resolves once (COMPLETED or SKIPPED). A new
Today answer attempt against an already-resolved item must be treated as a
conflict/already-resolved case, not accepted as a normal new Attempt —
technical retry idempotency (same `submissionId`) is unaffected; an
intentional re-answer must go through Manual Practice instead. This
confirms the exact status-check fix this finding recommended, now as a
decided product requirement rather than merely a proposed implementation
detail.

**Sub-risk 2 (plan-membership double-counting) — the design draft's own
"genuine gap" framing is correct, and the fix is architecture-dependent in
exactly the way that framing implies, confirmed by re-reading §9 directly:**
- Under **Option B** (pure composition, no new table): a Global item
  literally *is* the same `today_session_items` row a Course session
  already owns — there is no second copy to disagree with, so this risk
  is closed by construction.
- Under **Option C** (hybrid reference table): closed by construction in
  the same way, since the new table only *references* `(course_id,
  today_session_item_id)` pairs rather than duplicating content.
- Under **Option A** (independent Global entity with its own items): **not
  closed by construction at all** — `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
  §9's own "Cons" list for Option A says this outright ("requires an
  explicit answer to §6's double-counting problem... new, non-trivial
  schema/transaction design, not free from Option A's structural
  symmetry"). `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md` §16 goes
  further: ADR-016 §1's own product rule ("exactly one write, visible from
  both views") **forecloses Option A outright unless it also builds an
  equivalent dedup mechanism** — meaning Option A doesn't merely "have a
  gap," it is arguably non-compliant with an already-accepted product rule
  unless extended.

**Conclusion:** the design draft's "structurally already prevented" framing
is correct for sub-risk 1 (with the one implementation gap noted above,
which needs a fix, not a decision) but is dangerously easy to
over-generalize into believing the *whole* double-counting problem is
already solved. It is not — sub-risk 2 is real, unsolved today, and its
solution is not universal across the three architecture options; it is a
property Option B/C get for free and Option A must build separately. Any
reader who takes "already structurally prevented" as covering both
sub-risks is wrong, and this document flags that as a real risk in how the
design draft could be mis-read going forward, not a flaw in the design
draft's own careful wording (which does distinguish the two sub-risks
correctly on close reading).

- **Severity (sub-risk 2):** High if Option A is chosen without an
  additional guard; the interim guard in
  `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` Slice 2 mitigates it
  regardless of option, but is not yet built.
- **Likelihood:** Certain, absent a guard, under any architecture where two
  independent generation calls exist.
- **Current mitigation:** None shipped today (no Global Today code exists
  yet at all).
- **Classification:** ARCHITECTURE.
- **Dor decision needed?** Yes — indirectly, via the architecture choice
  (Option A/B/C) itself, which is already flagged as pending in ADR-016's
  "Explicitly deferred" section.

---

## 2. Can Manual Practice mutate Today indirectly, via triggering significant-event adaptation from outside Today?

This is a genuinely open direction question, not resolved here, and the
product spec's own wording does not close it — it should be read carefully,
not assumed away.

Product spec §12 / ADR-016 §4 list candidate significant-event triggers:
"a confident wrong answer; a misconception crossing a meaningful threshold;
unexpected failure on previously strong material; a short cluster of
failures around the same topic; very low familiarity revealed during
new-material exposure." **Every one of these is a description of learner
STATE, not of WHERE the triggering Attempt came from.** Nothing in §12,
§4, or the surrounding text restricts the trigger to Attempts submitted
*through* a Today view. Separately, §14 / ADR-016 §8 state "Manual Practice
does not satisfy the Daily Plan" — but that rule is specifically about
*completion*: a manually-answered Question that is also a Today item does
not become completed. **§14 says nothing about adaptation.** These are two
different rules, and nothing in the accepted text says the second
(adaptation-triggering) inherits the first's (completion) restriction to
Today-sourced evidence.

Concretely: if a learner opens Manual Practice for Course A on a Question
that is *not* part of today's plan at all, and answers it with a confident
wrong answer that crosses the misconception threshold, `applyAttemptToProgress`
updates that Question's `misconceptionState` exactly as any other Attempt
would (`src/domain/learning/progress-update.ts` has no special-casing for
`todaySessionItemId === null` — misconception derivation is purely a
function of the Attempt's correctness/confidence, not its origin). If a
future adaptation mechanism (Slice 8, not yet built) scans for "a
misconception crossing a meaningful threshold" to decide whether to insert
a follow-up item into today's remaining plan, it would have no principled
reason to exclude a misconception that arose from Manual Practice — the
underlying learner-state signal is identical either way. This means Manual
Practice, though explicitly stated as "a distinct learning path... not a
view of the Daily Plan at all" (product spec §3), could still legitimately
*reach into* and mutate the Daily Plan's remaining items via the
adaptation mechanism, in a way that contradicts the everyday reading of
"Manual Practice is separate" even though it does not contradict the
literal text of §14.

- **Severity:** Significant — this cuts against the core mental model
  ("Today recommends... Manual Practice is a separate thing entirely,"
  §2) in a way a learner would experience as surprising ("I did Manual
  Practice and it changed my Today plan?").
- **Likelihood:** High, if adaptation is ever built using learner-state
  triggers as literally described, since nothing filters by origin.
- **Current mitigation:** None — adaptation itself doesn't exist yet
  (confirmed: no code path modifies an already-created `TodaySessionItem`'s
  content after creation anywhere in `src/`), so this is not yet a live
  bug, only a designed-in ambiguity waiting to be resolved one way or the
  other before Slice 8 is built.
- **Classification:** PRODUCT.
- **Dor decision needed? Yes, plainly.** Should adaptation triggers be
  scoped to Today-sourced evidence only, or to all evidence regardless of
  origin? This document does not propose an answer — inventing one here
  would be exactly the kind of scope violation `CLAUDE.md` §7 warns
  against.

**RESOLVED by `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §4 / ADR-016
(ACCEPTED):** Dor has decided this exact question — only Today-sourced
Attempts may trigger significant-event adaptation in V1; Manual Practice
never triggers mid-day Today adaptation, regardless of how strong the
underlying learner-state signal is. See
`docs/TODAY_ADAPTATION_MODEL.md` §12 for the full resolution and its
implementation implication (gate adaptation detection on
`todaySessionItemId`/`dailyPlanItemId` being non-null, not on learner
state alone).

---

## 3. Duplicate same-day new-material exposure via two entry points

Per product spec §9, new-material exposure is a small (illustrative 2–3
question) sample, explicitly not mastery evidence. `next-best-action.ts`'s
own doc comment confirms `NEW_LEARNING`/`EXPAND_COVERAGE` are "deliberately
NOT implemented" in the current candidate-generation code — **there is no
exposure mechanism in `src/` at all today**, so this specific failure mode
cannot yet be checked against real code; it can only be reasoned about
structurally, and flagged for whoever eventually builds it.

The structural risk: if exposure sampling is (as `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`
§5 recommends) "a separate allocation decision made alongside... the
unified priority score" rather than integrated into the same candidate-pool
generation `next-best-action.ts` already does, there is a real risk that
Global Today's exposure allocator and a Course Today's *own* exposure
allocator (if Course Today independently continues to expose new material
too, which nothing in ADR-016 forbids) could each independently sample the
same new topic's 2–3 representative questions on the same day, through two
different entry points, before either set of answers resolves. Since
exposure candidates have no `UserQuestionProgress` row to anchor a
"already selected today" check against (by definition — a Question with
zero Attempts has no progress row, per `next-best-action.ts`'s own stated
reason for not implementing `NEW_LEARNING` yet), the double-counting guard
proposed in `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` Slice 2 (which
guards against a Question already appearing as a *planned* `today_session_items`
row) would actually work here too, IF exposure items are persisted as real
`today_session_items` rows the same way ordinary candidates are — but this
is not guaranteed by anything decided today, since exposure allocation's
persistence shape is itself unspecified.

- **Severity:** Moderate — a learner seeing the same brand-new topic
  "introduced" twice on the same day undermines the "prefers fewer new
  topics per day" novelty principle (§10) even if it doesn't corrupt data.
- **Likelihood:** Medium — depends entirely on whether exposure allocation
  is built to persist through the same `today_session_items` mechanism
  Slice 2's guard already covers, or through some separate, not-yet-designed
  path.
- **Current mitigation:** None — the mechanism does not exist yet.
- **Classification:** ARCHITECTURE (contingent on how exposure is
  eventually persisted) / PRODUCT (the novelty-budget interaction).
- **Dor decision needed?** Not yet actionable — this is a "watch this when
  `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` and the exposure mechanism are
  actually designed" flag, not a decision Dor can usefully make in the
  abstract today.

---

## 4. Can Skip be abused to destroy signal quality?

Product spec §13 states "repeated skipping may become a future behavioral
signal (policy not decided)." Checked directly: **no such policy or
mechanism exists anywhere in `src/` today** (confirmed — Skip itself is not
implemented at all yet, per
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` Slice 0's grounding). So the
honest answer is: **"repeated skipping may become a signal" is currently
100% aspirational, with zero mechanism** — not a weak protection, no
protection at all, by construction, because there is nothing to check
against yet.

Stress-test the scenario once Slice 0 ships as specified (skip never
updates `UserQuestionProgress`, never scores as incorrect): a learner who
skips every REMEDIATION/DUE_REVIEW item every day satisfies the daily
finish line ("Done for today") every day, without ever resolving genuine
evidence. Is this actually as bad as it sounds? Two mitigating facts,
verified by reading the code: (a) since skip never touches
`UserQuestionProgress`, the underlying `scheduledReviewAt`/misconception
state is **untouched** — the skipped item's urgency does not decay, and it
will very likely reappear in tomorrow's freshly-generated plan (its
`retrievability` continues decaying per FSRS, and its `dueAt` grows more
overdue, which — within its own tier — pushes it toward the front of
tomorrow's ranked list per the `overdueRankValue` tie-break in
`next-best-action-ranking.ts`). So skip-spamming does not make evidence
silently vanish or falsely inflate mastery. (b) it does, however, mean the
learner can indefinitely defer ever doing hard work while still showing
"Today completed" — a real signal-quality/product-outcome problem, just not
a *data*-corruption one.

- **Severity:** Moderate — degrades the credibility of "Today completed" as
  a proxy for genuine learning, without corrupting underlying evidence.
- **Likelihood:** High — skip-spamming is the path of least resistance for
  a disengaged learner, and nothing currently disincentivizes it.
- **Current mitigation:** None, honestly — the spec's own "may become a
  future behavioral signal" is explicitly unbuilt, not a weak safeguard.
- **Classification:** PRODUCT / CALIBRATION.
- **Dor decision needed?** Yes — already flagged as open in ADR-016's
  "Explicitly deferred" list ("repeated-skip behavioral policy"); this
  document adds the specific, code-verified detail that today there is
  *no* fallback mitigation at all beyond "the item will probably reappear
  tomorrow," which is not itself a behavioral deterrent.

---

## 5. Can a Course disappear indefinitely because no floor exists? (stress test of "it naturally re-ranks")

This is, on inspection, **the sharpest and most concrete finding in this
review**, because it can be checked directly against the ranking code
rather than argued abstractly.

Construct the scenario: Course Q ("Quiet") has stable, well-mastered, rarely
forgotten content, no exam ever scheduled. Its FSRS-scheduled review
intervals are long (this is what "well-mastered" means under ADR-008), but
FSRS intervals are always finite — a `scheduledReviewAt` will eventually
arrive, at which point `generateNextBestActionCandidates`
(`src/domain/learning/next-best-action.ts`) will produce a `REVIEW_DUE`
candidate for it (line 156–167: gated purely on `scheduledReviewAt <= now`).
So far, product spec §7's "it re-enters ranking because its own signals
rise" claim holds — the signal genuinely does rise, eventually, exactly as
claimed.

**Here is where the claim breaks down.** Read `tierOf()` in
`src/domain/learning/next-best-action-ranking.ts` (lines 137–151): tier
membership depends **only** on candidate `type` and, for
`REPAIR_MISCONCEPTION`, whether it is `active` vs. `suspected`. It has no
dependency on `dueAt`, overdue duration, or `retrievability` at all. A
`REVIEW_DUE` candidate is **always** `DUE_REVIEW` tier, no matter how many
days, weeks, or months overdue it becomes — overdue duration only ever
affects the tie-break *within* a tier (`overdueRankValue`, used only after
tier comparison, per the ranking function's own sort comparator at lines
268–291). Meanwhile, `generateTodayPlan`
(`src/domain/learning/today-planner.ts`) truncates the ranked list to a
flat `maxItems` cutoff (`rankedCandidates.slice(0, policy.maxItems)`) with
**no per-tier reservation and no cross-day memory of what was truncated
out** — truncation is silent and total; a candidate that doesn't make the
cut simply isn't in the plan, and nothing records that it was "close."

Now construct Course B ("Busy"): a Course under continuous exam pressure or
genuine ongoing struggle, which — every single day — generates a fresh
supply of `RELEARN_LAPSE`/`REPAIR_MISCONCEPTION(active)` candidates (both
`REMEDIATION` tier) simply because real, ongoing learning activity keeps
producing new lapses/misconceptions in that Course. If Course B's daily
`REMEDIATION`-tier candidate count alone meets or exceeds whatever
`maxItems` is set to, **Course Q's `DUE_REVIEW`-tier item is truncated out
of every single day's plan, indefinitely** — not because a floor was
denied, but because it is structurally impossible for a `DUE_REVIEW`-tier
candidate to ever outrank a `REMEDIATION`-tier one, regardless of how
overdue it becomes, and Course B's `REMEDIATION` supply, by construction of
this scenario, never runs dry. Course Q's item's overdue duration keeps
growing (helping it win ties *within* `DUE_REVIEW`), but that is worthless
if it never survives long enough to even compete against `REMEDIATION`-tier
truncation in the first place.

This directly falsifies the informal reading of product spec §7 ("a Course
silent for several days does not automatically regain representation — it
re-enters ranking because its own signals rise") as a *guarantee* — the
signal does rise, but rising within a tier that is structurally
subordinate to another Course's perpetually-replenished higher tier does
not guarantee eventual inclusion in a size-bounded plan. "No floor, but it
naturally re-ranks" and "no floor, and it can be crowded out forever by a
busier sibling Course" are both consistent with the literal accepted text —
the spec does not actually resolve which one is true, because it never
addresses the interaction between tier-capping and size-truncation across
multiple simultaneously-active Courses.

- **Severity: High.** This is not a UX rough edge — it is a scenario where
  a Course could receive literally zero review attention for an unbounded
  period despite the product's own stated principle that "no floor" was
  meant to be safe because signals "naturally rise."
- **Likelihood: Medium.** Requires a specific but entirely plausible
  pattern (one perpetually-busy Course, one quiet-but-not-permanently-safe
  Course, competing for a size-bounded plan) — multi-Course learners
  during exam season are exactly the population most likely to produce it.
- **Current mitigation: None.** Verified by reading `tierOf()` and
  `generateTodayPlan()` directly — there is no cross-tier promotion based
  on overdue duration, and no per-Course reservation in truncation.
- **Classification:** ARCHITECTURE / CALIBRATION (this sits exactly at the
  undecided intersection of the priority-tier model and
  `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`'s sizing model, neither of which
  currently addresses cross-tier starvation).
- **Dor decision needed? Yes.** This is a real, previously-unstated tension
  between §7 ("no floor") and the implicit promise that "naturally
  re-ranks" means "will eventually be included" — Dor needs to decide
  whether some cross-tier consideration (e.g., overdue duration eventually
  escalating a `DUE_REVIEW` candidate's effective priority) is acceptable,
  without that becoming a disguised maintenance floor (§7's own prohibition).
  This document does not propose which resolution is correct.

**RESOLVED (in direction, not in mechanism) by
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5 / ADR-016 (ACCEPTED):** Dor
has decided this exact tension in favor of requiring cross-tier
consideration: there is still no per-Course floor/quota, but increasing
Memory Need/overdue duration MUST be able to cross priority tiers, so a
`DUE_REVIEW`-tier candidate cannot be permanently capped below a
perpetually-replenished `REMEDIATION`-tier sibling forever. This is
explicitly framed as a property of the ranking function itself, not a
Course floor. **The mechanism remains unbuilt and the exact
escalation formula/thresholds remain open calibration work** — see
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a for the ranking-architecture
consequence this finding's evidence now requires satisfying.

---

## 6. Can dynamic size explode? (multi-Course exam pile-up)

Checked directly: `generateTodayPlan` (`src/domain/learning/today-planner.ts`)
has exactly one sizing mechanism today — `TodayPlannerPolicy.maxItems`, a
single, caller-supplied positive integer, truncating a ranked list. There
is **no dynamic, need-driven sizing logic in the codebase at all** — the
"dynamic size" product spec §6 describes ("no fixed daily item count... a
calm day may produce a small plan, an exam-heavy day a larger one") is
implemented today, structurally, by a fixed ceiling that a caller
configures once, not by any per-day adaptive formula. `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`
(referenced by the product spec as where sizing is analyzed) was not
present in `docs/` at the time of writing this document, so no sizing
model exists to inspect at all yet.

This means the honest answer to "what actually bounds size today" is:
**nothing bounds it dynamically; only a single, static `maxItems` value
bounds it, and that value is explicitly not decided** (product spec §6,
§20). Two failure modes follow directly from this, and they are in tension
with each other:
1. If `maxItems` is set generously (to accommodate legitimate multi-Course
   exam pile-ups), an ordinary, non-exam day with enough due items produces
   an equally large plan — "dynamic size" would then be an illusion; size
   is always `maxItems` whenever ≥ `maxItems` candidates exist, exam or not.
2. If `maxItems` is set conservatively, a genuine multi-Course exam
   pile-up is silently truncated — this is exactly the mechanism behind
   Finding 5's Course-starvation scenario, just viewed from the "size"
   angle rather than the "tier" angle.

- **Severity: High** — this is not a hypothetical; it is a direct reading
  of the only sizing code that exists.
- **Likelihood: Certain**, in the sense that *some* choice of `maxItems`
  will always produce one of the two failure modes above, because no
  code exists to make size genuinely need-responsive.
- **Current mitigation: None.**
- **Classification:** IMPLEMENTATION (no sizing model exists to critique
  beyond "there isn't one yet") / PRODUCT (the exact bounds are explicitly
  undecided, product spec §20).
- **Dor decision needed?** Yes — the "reasonable preferred range... eventually
  a calibration guardrail" language in product spec §6 needs to become an
  actual decision (or an actual formula) before Global Today can ship
  without one of the two failure modes above.

---

## 7. Can adaptation destroy the finish line? (is "insert not append" enforced anywhere?)

Checked directly: **there is no adaptation mechanism in `src/` at all.**
No code path modifies an already-created `TodaySessionItem`'s content after
`createIfNotExists` — `markItemCompleted`
(`src/infrastructure/postgres/today-session-repository.ts`) only ever
updates `status`/`completed_at` on an existing item; nothing inserts a new
item into an existing session or replaces an unresolved item's content.

So, narrowly: "insert not append, preserving total scope" is not currently
*violated*, but only because it is not yet *implemented* at all — this is
not evidence the eventual mechanism will honor it, it is simply evidence
there is nothing yet to check. The product spec's "Not allowed" list
(§12: "full reranking... endless growth... reranking after every normal
answer") is, today, trivially true by the absence of any adaptation code —
which is a very different, weaker claim than "the system has a mechanism
that prevents this," and should not be mistaken for one.

A real, forward-looking risk this review does find: the current schema has
**no mechanism to preserve pre-adaptation state.** `today_session_items`'
only mutable columns are `status` and `completed_at`
(`docs/PERSISTENCE_SCHEMA_V1.md`'s own comment on the table: "Frozen (never
recomputed after insert): position, action_type, tier,
other_applicable_types, reasons, question_version_id. Mutable: status,
completed_at only"). If a future adaptation mechanism is built as an
in-place `UPDATE` to an unresolved item's frozen columns (the most obvious
naive implementation), the current schema provides **zero** way to recover
what the item looked like before adaptation — directly undermining product
spec §18's requirement to later answer "what adaptations happened and why."

- **Severity: Significant, but entirely forward-looking** (nothing is
  broken today because nothing exists today).
- **Likelihood: High**, if adaptation is built naively as an in-place
  update without an accompanying append-only event/audit record.
- **Current mitigation: None** — not because a mechanism failed, but
  because no mechanism has been attempted yet.
- **Classification:** IMPLEMENTATION.
- **Dor decision needed?** No new decision — `docs/TODAY_HISTORY_ANALYTICS_PLAN.md`
  (referenced, not yet present in `docs/`) is presumably where this is meant
  to be addressed; this finding is a flag for whoever builds Slice 8 of
  `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`, not a product ambiguity.

---

## 8. Can timezone semantics produce two plans for one local day? (sharpest concrete scenario)

`docs/OPEN_QUESTIONS.md` #35 (Learner Time Zone) is OPEN — the source of
"the learner's local timezone" (account setting, browser-derived, stored
IANA zone) is not decided. `docs/TODAY_TIMEZONE_EDGE_CASES.md` (referenced
by the product spec as the place DST/session-continuation mechanics are
analyzed) was not present in `docs/` at the time of writing.

**Concrete scenario, sharper than a plain DST fall-back:** a learner in
Israel (UTC+2/+3) opens Today at 23:00 local time on calendar day D
(Israel), generating and freezing day D's plan. They then board an
overnight flight to New York (UTC-4/-5, a 7-hour difference). If "local
timezone" is browser/device-derived and the device's timezone
auto-updates mid-flight or on landing (common default phone behavior),
two failure shapes are both plausible under the accepted rules as
literally stated, because §15/§17 only ever discuss the **midnight**
boundary within a single, stable timezone — neither text ever considers a
*changing reference timezone* mid-session:

1. **Spurious interruption without crossing midnight in either frame.** If
   the app re-evaluates "what local day is it" using the NEW (New York)
   timezone at some point while the learner is still actively working
   through day D's plan, and New York's clock reads a time that resolves
   to a *different* calendar date than Israel's day D did at generation
   time (entirely possible depending on exact takeoff/landing times and the
   7-hour offset), the active session could be treated as spanning a day
   boundary it never actually crossed in real, continuous wall-clock
   experience — violating §15's promise that "an actively continuing
   session may keep using the day it started on," because the *trigger*
   here is a timezone change, not a midnight crossing, and nothing in §15
   addresses that trigger at all.
2. **Two plans, two labels, overlapping in real time.** If instead the
   learner opens a *fresh* Today view after landing, under the new (New
   York) timezone, and New York's calendar date has not yet advanced to
   what Israel already considers day D+1 (a real possibility for an
   eastward-time-loss / westward-time-gain scenario depending on flight
   direction and duration), the app could generate a *second* plan for a
   "local day" label that is, in absolute UTC-time terms, still squarely
   within the window day D's Israel-timezone plan already covered —
   producing exactly the "two plans for one local day" failure mode this
   section is asked to construct, except the ambiguity here isn't about
   which side of midnight a moment falls on, but about which of two
   *different, both-momentarily-true* local-day labels should govern a
   plan that was never actually abandoned.

- **Severity: Significant** — either shape directly contradicts an already-
  accepted product rule (§15/§16's "one plan per local day," "not
  interrupted mid-session").
- **Likelihood: Low-to-medium** in absolute terms (requires cross-timezone
  travel during an active session) but not exotic for a real user
  population, and certain to eventually occur at any meaningful scale.
- **Current mitigation: None** — #35 is OPEN, and the referenced edge-case
  document does not yet exist to have addressed it.
- **Classification:** PRODUCT.
- **Dor decision needed? Yes**, on two independent axes: (a) what the
  actual timezone source is (#35), and (b) whether a session's "local day"
  is fixed at the timezone active when the session *started*, re-evaluated
  continuously, or something else — none of which the current text
  resolves.

---

## 9. Can Global Today accidentally become a backlog despite "no carry-over"?

Product spec §16 / ADR-016 §9 state there is no explicit backlog/carry-over
mechanism — each day's plan is built fresh from current learning state, and
unresolved need "may naturally rank high again." A cynical, but entirely
literal, reading of this: **"naturally ranks high again" and "carries
over" are experientially indistinguishable to the learner** whenever the
underlying need genuinely persists — which, for anything the learner didn't
resolve, it definitionally does, since nothing decayed it. The only actual
difference between the two framings is a data-modeling one (no persisted
backlog table/row identity is reused) — not a difference in what the
learner sees or does. A learner who routinely completes only 3 of 10 items
will, under the ranking rules as stated (no promotion mechanism needed —
unresolved need simply doesn't go away), see largely the same unresolved
items again tomorrow, *plus* whatever newly became due — meaning, absent
Finding 6's sizing bound doing real work, such a learner's daily plan size
could grow monotonically day over day, which is a backlog by any
experiential definition, dressed in "fresh generation" framing.

- **Severity: Significant** — this directly undermines the "real finish
  line, no debt list" promise (§16's own words: "Today must not become a
  debt list") for exactly the learner population (chronic under-completers)
  most likely to need the product to work well for them.
- **Likelihood: High** for any learner who routinely under-completes,
  which is a normal, expected usage pattern, not an edge case.
- **Current mitigation: None** — the spec disclaims the outcome
  ("must not become a debt list") without any structural mechanism that
  actually prevents it; nothing decays unresolved need faster because it
  went unresolved, and nothing caps cumulative day-over-day growth beyond
  whatever Finding 6's undecided `maxItems` happens to do.
- **Classification:** PRODUCT.
- **Dor decision needed? Yes.** Is monotonic growth toward `maxItems`
  (with everything past that silently truncated per Finding 5/6) an
  acceptable resolution of the tension between "no carry-over" and "no
  debt list," or does chronic under-completion need its own explicit
  product answer (e.g. some form of triage)? This document does not
  propose one.

---

## 10. Can exposure accidentally become mastery? (checked directly against `evidence-strength.ts` and `mastery.ts`)

The instruction for this finding was explicit: check the actual files,
don't assume `qualifyRetrieval`'s protection is sufficient. Done.

**`qualifyRetrieval` itself (`src/domain/learning/retrieval-qualification.ts`)
is genuinely airtight for what it claims to protect**: verified directly —
`input.previousRetrievalBaselineAt === null` returns `{ qualifies: false,
reason: "NO_PRIOR_RETRIEVAL" }` unconditionally (line 177–179), before any
session/gap check runs. The very first clean correct retrieval for a
Question can never qualify as spaced, regardless of policy configuration —
this gate has no injectable threshold that could weaken it. This part of
the claim holds completely.

**But `qualifyRetrieval` only controls `successfulSpacedRetrievals` —
whether that quantity being low is *sufficient* to keep evidence from
looking like mastery depends on `evidence-strength.ts` and `mastery.ts`,
which is where the real, previously-unchecked risk lives:**

- `deriveMasteryCategory` (`src/domain/learning/mastery.ts`) gates
  `"mastered"` on `meetsMasteredSpacing` (`successfulSpacedRetrievals >=
  policy.minSpacedRetrievalsForMastered`) — **this is genuinely protected**,
  since a 2–3 question exposure sample, by `qualifyRetrieval`'s own rule,
  contributes zero spaced retrievals no matter how well the learner
  performs on all of them, so `meetsMasteredSpacing` cannot be satisfied
  by exposure alone as long as `minSpacedRetrievalsForMastered >= 1` (any
  sane policy value). **Mastered is safe.**
- `deriveEvidenceStrength`'s `"strong"` tier
  (`src/domain/learning/evidence-strength.ts`, `meetsStrong`) additionally
  hard-requires `confirmedMultipleSessions === false` — an EXPLICIT
  confirmation of multi-session evidence, never satisfied by `null`
  (unknown) or by same-session repetition. **Strong is safe, by an
  independent, non-numeric gate** (a policy value cannot accidentally weaken
  this one — it's a boolean identity check, not a threshold).
- **The `"moderate"` evidence-strength tier and the `"strengthening"`
  mastery category are NOT protected by any equivalent structural gate.**
  `deriveEvidenceStrength`'s moderate path only requires
  `meaningfulAttemptCount >= policy.minMeaningfulAttemptsForModerate` AND
  `successfulSpacedRetrievals >= policy.minSpacedRetrievalsForModerate` —
  and `validateEvidenceStrengthPolicy` places **no lower bound above zero**
  on `minSpacedRetrievalsForModerate` (only that it be `>= 0` and `<=` the
  strong threshold, per lines 150–157/188–194). **A policy that sets
  `minSpacedRetrievalsForModerate: 0` and `minMeaningfulAttemptsForModerate: 2`
  or `3` — which is not an exotic or contrived choice, it matches the
  product spec's own illustrative exposure sample size exactly — would let
  a 2–3-question exposure sample, all answered correctly, reach `"moderate"`
  evidence strength with zero spaced retrievals.** Symmetrically,
  `deriveMasteryCategory`'s `"strengthening"` category only requires
  `successfulSpacedRetrievals >= policy.minSpacedRetrievalsForStrengthening`
  — again no enforced lower bound above zero on that threshold.

This means the true state of affairs is: **the domain code protects the
two highest tiers (`strong` evidence, `mastered` category) with hard,
policy-independent-in-spirit gates, but leaves the middle tiers
(`moderate` evidence, `strengthening` mastery) entirely dependent on
future policy calibration choices that no committed default exists for
yet** (`evidence-strength.ts`'s own doc comment: "no default production
policy is exported here"). This is not a bug in the domain layer — it is
explicitly designed to defer thresholds — but it is a real, concrete risk
that exposure could be miscounted as more than exposure, contingent
entirely on values nobody has chosen yet, not on a structural impossibility.
Product spec §9's own claim ("new-material exposure... explicitly NOT
mastery or retrieval evidence") is fully true for the top tier and only
conditionally true for the middle one.

- **Severity: Moderate** — cannot silently produce false "mastered" status
  (that tier is genuinely protected), but can plausibly produce a
  misleadingly confident "moderate evidence" / "strengthening" read from a
  handful of exposure answers, depending entirely on undecided calibration.
- **Likelihood: Medium** — requires a specific-but-plausible policy choice
  (low `minSpacedRetrievalsForModerate`), which nobody has committed to
  yet, so this is a live risk for whoever eventually picks production
  values, not a current bug.
- **Current mitigation:** Partial and tier-specific — real and structural
  for `strong`/`mastered`; nonexistent for `moderate`/`strengthening`.
- **Classification:** CALIBRATION.
- **Dor decision needed?** Not urgently — this is a flag for whoever sets
  production `EvidenceStrengthPolicy`/`MasteryPolicy` values (an
  engineering/calibration task, not a fresh product question), but it
  should not be assumed pre-solved by `qualifyRetrieval` alone, which is
  the specific mistake this finding was asked to check for.

---

## 11. Can Course filtering create impossible item order? (Course Today showing items 2, 5, 9 of a Global 1–10)

Checked against the actual position semantics. `TodayPlanItem.position`
(`src/domain/learning/today-planner.ts`) is explicitly documented as "a
plain 0-based array position... not a database sequence number" — each
`TodaySession`'s own items are numbered independently, 0-based, within that
session. Under the currently-shipped Course-scoped model, this is entirely
self-consistent because there is only ever one numbering scheme per
session.

**Under Global Today (any of Option A/B/C), two independent numbering
schemes necessarily coexist**, and nothing in the accepted product rules
reconciles them:
- The Global plan has its own position sequence (0..N-1 across all active
  Courses' items, in Global rank order).
- Each constituent Course's own `TodaySession` (ADR-011's still-valid,
  unmodified persistence substrate, per `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md`
  §2/§6) retains its OWN independent 0-based position sequence, scoped only
  to that Course's own items — unaffected by which Global position (if
  any) those same items also occupy.

So the literal scenario in this finding's prompt — Course Today showing
items "2, 5, 9" out of a Global plan's "1–10" — does not actually occur as
stated, because Course Today was never going to inherit or display the
Global numbering to begin with; it shows its own 0-based sequence (e.g.
"item 1 of 3" for that Course's own items), independent of Global position.
**The real risk is subtler and is a genuine gap**: the product's own
mental model (§2: "There is one Today... looked at three ways") strongly
implies a *single* coherent position/identity for an item, yet the two
views would, under the currently-anticipated architecture, show that same
item at two different, unrelated position numbers with no stated
reconciliation rule. Product spec §19's own example ("Q17 is item 4 of
today's Global Today plan") only ever states an item's identity in Global
terms — no worked example in the spec shows the same item's Course-Today
position, so this inconsistency is not visibly flagged by the spec's own
examples, even though it is a direct consequence of the architecture those
same examples assume.

- **Severity: Moderate** — a UX/mental-model inconsistency, not a data
  integrity issue (both numbers are independently correct within their own
  scope; they just don't agree with each other, and nothing said they
  would).
- **Likelihood: High** — structurally guaranteed under Option A/B/C alike,
  since none of them proposes a shared numbering scheme, only a shared
  underlying item identity/resolution state.
- **Current mitigation: None** — no document proposes per-view renumbering
  reconciliation, and this document does not either.
- **Classification:** PRODUCT / ARCHITECTURE boundary.
- **Dor decision needed? Yes** — should an item's position be presented
  consistently across views (which would require either a shared canonical
  numbering the UI translates for both views, or abandoning literal
  position numbers as a user-facing concept in favor of something
  order-implied-only), or is "each view has its own independent ordering,
  no reconciliation" an accepted UX tradeoff? Not decided anywhere today.

---

## 12. Can archive cause historical corruption? (ADR-015 §8 immutability-extension check)

Checked directly, and this is the one finding in this review that comes
back clean: **archiving cannot corrupt or hide already-completed Today
history under the current schema, and this holds structurally, not just by
policy.** `AttemptRepository.listForReplay` (`src/application/learning/ports.ts`,
backing `rebuildUserQuestionProgress`) is scoped by `(userId, questionId)`
only — it has no `courseId` or membership parameter anywhere in its
signature, so it is **structurally impossible** for a future
`CourseMembership.archivedAt` value to affect replay/rebuild, regardless of
how archive filtering is eventually implemented elsewhere. Likewise,
`TodaySessionRepository.findByKey`/`loadItems`
(`src/infrastructure/postgres/today-session-repository.ts`) query
`today_sessions`/`today_session_items` directly by `(user_id, course_id,
planned_for_date)` or `today_session_id`, with no join to any membership
table. ADR-015 §8 ("Attempts, UserQuestionProgress, and other learner
history are never deleted merely because... the Course is archived") is
therefore not just a stated policy — it is currently unfalsifiable by
construction, because no query path that reads history conditions on
archive status at all.

The one caveat worth stating plainly: this guarantee holds *only as long
as* a future Global Today history/read model preserves the same discipline
— i.e., archive status must only ever gate which Courses contribute NEW
candidates going forward (Slice 1/7 of `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`),
never gate which PAST, already-resolved items a history view is allowed to
show. Nothing forces a future implementer to preserve this distinction; it
is a design discipline to carry forward, not a database constraint that
would catch a violation.

- **Severity: Low** (today) — genuinely safe, verified structurally, not
  merely asserted.
- **Likelihood: Low**, contingent on future code continuing not to join
  history reads against membership state — a discipline, not a guarantee.
- **Current mitigation: Real and structural** — the relevant ports simply
  have no membership-scoped parameter to misuse.
- **Classification:** ARCHITECTURE.
- **Dor decision needed? No** — ADR-015 §8 already settled the product
  rule; this finding confirms it holds today and flags the one discipline
  future work must preserve, without asking for a new decision.

---

## 13. Can plan history become non-auditable after adaptation?

This restates and sharpens Finding 7 from the "is adaptation enforced"
angle to the "is it auditable afterward" angle, per the prompt's explicit
request to check this separately: **yes, under the current schema, an
in-place-mutation adaptation model would lose all pre-adaptation state**,
because `today_session_items`' only mutable columns are `status` and
`completed_at` (confirmed via `docs/PERSISTENCE_SCHEMA_V1.md`'s own
comment on the table, and via `today-session-repository.ts`'s
`markItemCompleted`, the only existing mutation, which touches exactly
those two columns). If a future adaptation write path instead performs an
`UPDATE` against the currently-frozen columns (`question_id`,
`action_type`, `tier`, `reasons`, etc.) to "replace" an unresolved item,
the prior values are gone the moment that UPDATE commits — there is no
history table, no versioning column, and no event log anywhere in the
current schema that would let a later query answer "what did this item
look like before it was adapted, and why did it change" — which product
spec §18 explicitly requires the system to be able to answer.

This is the same underlying gap as Finding 7, viewed from the audit-trail
angle rather than the "insert not append" angle; both point to the same
fix (an append-only adaptation-event record, separate from the
in-place-mutable plan-item columns), and both are squarely IMPLEMENTATION
work for whoever builds Slice 8, not a product ambiguity requiring a new
Dor decision beyond what §18 already asks for.

- **Severity:** Significant, forward-looking only (nothing is broken today).
- **Likelihood:** High, absent a deliberate append-only design choice when Slice 8 is built.
- **Current mitigation:** None; not yet attempted.
- **Classification:** IMPLEMENTATION.
- **Dor decision needed?** No new decision beyond what §18 already commits to requiring.

---

## Summary table

| # | Risk | Severity | Likelihood | Mitigation today | Class | Dor decision needed? |
|---|---|---|---|---|---|---|
| 1a | Evidence double-count via re-answering a completed Today item | Low-Mod | Low→rises under Global | **RESOLVED — see §1, decision #6: single-use item resolution, re-answer = conflict** | IMPLEMENTATION | No (was already "no," now also decided as product rule) |
| 1b | Plan-membership double-count (Option A specifically) | High if Option A | Certain absent guard | **RESOLVED — Option A accepted (ADR-016); see `GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` reconciliation note — closed by construction (`UNIQUE(daily_plan_id, question_id)`)** | ARCHITECTURE | Resolved (via architecture choice) |
| 2 | Manual Practice triggering Today adaptation | Significant | High if built naively | **RESOLVED — see §2, decision #4: only Today-sourced Attempts may trigger adaptation** | PRODUCT | Resolved |
| 3 | Duplicate new-material exposure via two entry points | Moderate | Medium | None (exposure unbuilt) | ARCH/PRODUCT | Not yet actionable |
| 4 | Skip-spamming degrades signal quality | Moderate | High | None (aspirational only) | PRODUCT/CALIBRATION | Yes (already flagged, sharpened here) |
| 5 | Course crowded out forever by tier-capping + truncation | **High** | Medium | **RESOLVED in direction — see §5, decision #5: tier-crossing required; mechanism/thresholds still open** | ARCH/CALIBRATION | Resolved in direction, mechanism open |
| 6 | Dynamic size has no real mechanism, only a static cap | High | Certain | None | IMPL/PRODUCT | Yes |
| 7 | "Insert not append" unenforced (nothing exists yet) | Significant (forward) | High | None (unbuilt) | IMPLEMENTATION | No |
| 8 | Cross-timezone travel produces overlapping/duplicate plans | Significant | Low-Med | None | PRODUCT | Yes |
| 9 | "No carry-over" experientially indistinguishable from backlog | Significant | High | None | PRODUCT | Yes |
| 10 | Exposure reaching "moderate"/"strengthening" via low policy thresholds | Moderate | Medium | Partial (strong/mastered safe; moderate/strengthening not) | CALIBRATION | Not urgently |
| 11 | Course Today / Global Today show inconsistent position numbers | Moderate | High | None | PRODUCT/ARCH | Yes |
| 12 | Archive corrupting historical Today records | Low | Low | Real, structural | ARCHITECTURE | No |
| 13 | Adaptation destroys pre-change audit trail | Significant (forward) | High | None (unbuilt) | IMPLEMENTATION | No |

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`, `docs/DECISIONS/016-...md`
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`, `docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md`, `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`
- `docs/DECISIONS/011-today-is-course-scoped-v1.md`, `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
- `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` (companion document, this session)
- `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`, `today-planner.ts`, `evidence-strength.ts`, `mastery.ts`, `retrieval-qualification.ts`, `progress-update.ts`
- `src/application/learning/submit-answer.ts`, `today-session.ts`, `ports.ts`
- `src/infrastructure/postgres/today-session-repository.ts`
- `docs/OPEN_QUESTIONS.md` (#33, #34, #35)

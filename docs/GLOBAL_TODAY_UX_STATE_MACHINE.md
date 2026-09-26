# Global Today — UX State Machine (DRAFT)

Status: **UX STATE DESCRIPTION ONLY — NOT AN ADR, NOT IMPLEMENTED, NO UI BUILT.**

This document describes the states a Today screen (Global or Course-filtered)
can be in, the actions that move between them, and illustrative Hebrew
microcopy for each. It is written in product language, not implementation
language: it does not name components, routes, API endpoints, or state-
management libraries, and it does not build any UI. It is downstream of, and
must not contradict, `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (the canonical
product-language reference — see especially its §19 worked examples, which
this document's states and transitions are built from) and
`docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, the current
accepted V1 behavior, unmodified here).

Language register follows `docs/PRODUCT.md` §18 ("Reduce decisions," "Explain
without overwhelming," "Avoid false precision") and reuses the tone of its
existing examples ("מומלץ לחזור על הנושא הזה", "המבחן מתקרב", "זוהתה טעות
שחזרה מספר פעמים"). **All Hebrew strings below are illustrative copy
examples only, not final approved strings.** Per `docs/PRODUCT.md` §19,
technical identifiers stay English; user-facing text would flow through the
project's messages layer (`docs/ARCHITECTURE.md` §23, `src/messages/`) once
actually implemented.

Throughout, no state or transition implies Today is mandatory, and no state
frames skipping or declining as a failure on the learner's part — per the
product spec's "Today recommends, learner decides" (§2, §3).

---

## 0a. Reconciliation note (post-decision)

Dor's product-owner review accepted the `DailyPlan`/`DailyPlanItem`
architecture and several product rules after this document was written.
This state machine is **largely unaffected**: it was already written on the
premise of "one machine, not two" (§1 below) and S4 (Course-filtered) was
already modeled as a pure lens over the same underlying resolution state,
which is exactly what the accepted architecture (Option A, Course Today as
a read-time filter) delivers — no state or transition needs to change on
that account. Two small consequences worth noting, not requiring a
rewrite: (1) S9 "Done for today" is confirmed to be a single fact per
`DailyPlan`, not something that could ever be independently true for
Global vs. one Course (`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §2,
§9 — moot under the accepted architecture, exactly as this document already
assumed); (2) a resolved item (S5/S6/S8) attempting to be re-answered
through Today should be understood as a rejected/conflict action, not a new
S5/S6 transition — this document does not model error/conflict actions at
the per-item level and is not required to for this reconciliation, but a
future implementer building the actual UI should not silently allow a
resolved item to re-fire S5 (`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`
§6).

## 1. Scope of "Today UI state" here

A single underlying Daily Plan (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3–§5)
can be viewed as **Global Today** (all active Courses) or a **Course-filtered
view** (one Course's items from that same plan). The state machine below is
one machine, not two — Global and Course-filtered views differ only in which
subset of the same plan's items is currently visible, never in the
underlying resolution state of any item. Manual Practice is out of scope
here: it is a separate path that never satisfies the Daily Plan (§3, §14 of
the product spec) and has no bearing on these states.

---

## 2. States

### S0 — Not created today

No Daily Plan exists yet for the learner's current local day. This is the
state before the learner's first Today-open of the day (product spec §5).

- Applies identically whether the learner opens Global Today or a specific
  Course Today first — whichever view is opened first is what triggers
  generation (§5).
- Not an error, not empty-in-a-worrying-sense — simply "hasn't been asked
  for yet today."

Illustrative copy: *"בואו נראה מה כדאי ללמוד היום"* ("Let's see what's worth
studying today") — an invitation, not a demand.

### S1 — Generating

Transient state while the plan is being produced from the learner's current
learning state (§5). Expected to be brief; this is not a long-running job in
the product's mental model.

Illustrative copy: *"בונים את התוכנית שלך להיום…"* ("Building your plan for
today…")

### S2 — Ready (plan generated, nothing started)

The Daily Plan exists, is persisted and frozen (§11), and no item has been
resolved yet. The learner sees the plan's items but has not acted on any of
them.

Illustrative copy: *"התוכנית שלך מוכנה"* ("Your plan is ready") — followed by
however many items exist that day (no fixed count is implied, per §6).

### S3 — In progress

At least one item is resolved (COMPLETED or SKIPPED) and at least one item
remains unresolved. This is the state the learner spends most active session
time in.

No distinct copy state is needed beyond ordinary per-item progress
indication (e.g. "3 מתוך 8" — "3 of 8") — avoiding false precision means not
dressing this up as a percentage-mastery claim; it is a plain count of plan
items, per §6's rejection of a fixed/time-budget framing beyond the count
itself.

### S4 — Course-filtered view

Not a separate resolution state, but a *display* state layered on S0–S8: the
learner is looking at only one Course's items from the same plan. Completing
or skipping an item here updates the same underlying record Global Today
sees (§3, product spec's worked example "Course Today completion reflected
in Global Today," §19). No item can be "completed in Course Today but still
outstanding in Global Today" — that inconsistency must never be observable.

Illustrative copy (Course-filtered header): *"היום שלך בקורס [שם הקורס]"*
("Your Today in [Course name]") with a plain, low-emphasis way back to the
Global view — a filter, not a separate destination.

### S5 — Item completed

A single item transitions from unresolved to COMPLETED (an Attempt was
recorded, per the product spec's completion semantics §14). Momentary,
per-item feedback, not a full-screen state — consistent with "explain
without overwhelming" (`docs/PRODUCT.md` §18).

Illustrative copy: no special string required beyond ordinary answer
feedback already covered by Quiz-level UX (out of scope here); at most a
light per-item checkmark treatment.

### S6 — Item skipped

A single item transitions from unresolved to RESOLVED via skip (§13). Framed
neutrally — skip is a legitimate learner decision for that day, not a
mistake or a shortfall.

Illustrative copy: *"דילגת על הפריט הזה להיום"* ("You skipped this item for
today") — descriptive, not corrective. Never "פספסת" ("you missed it") or
similar failure-coded language.

### S7 — Plan adapted

A significant learning event (product spec §12) has caused a small change to
future, not-yet-resolved items. Surfaced as a **brief inline note near the
affected item(s)**, not a modal interrupt and not a banner that blocks
continued study — per "explain without overwhelming."

Illustrative copy: *"עדכנו פריט אחד בתוכנית בעקבות תשובה שקיבלה ציון נמוך
בביטחון גבוה"* ("We updated one item in the plan following an answer given
with high confidence but scored incorrect") — names *that* something changed
and roughly *why*, without exposing internal thresholds or engine
mechanics (no false precision, no exposing undecided numeric thresholds per
product spec §20). Never shown for every ordinary answer — only when an
actual adaptation occurred (§12's "not after every normal answer").

### S8 — Resolved (item-level terminal state)

An item is either COMPLETED or SKIPPED; both are "resolved" for the purpose
of the daily finish line (§13). This is not a separate learner-visible
screen state — it is the per-item condition that, once true for every item,
produces S9.

### S9 — Completed for today ("Done for today")

Every item in the Daily Plan is resolved (COMPLETED or SKIPPED). The real
finish line (product spec §7 lifecycle, worked example "3 skipped items and
real Daily completion," §19). No automatic replenishment occurs merely
because this state was reached.

Illustrative copy: *"סיימת את היום"* ("You're done for today") — a genuine
finish line, not "you could always do more." Any further practice offered
from this state must be visibly optional and separate from the completed
plan.

Illustrative secondary copy (optional extra learning, opt-in, per §7's
lifecycle diagram): *"רוצה להמשיך לתרגל? זה כבר מעבר לתוכנית של היום"*
("Want to keep practicing? This goes beyond today's plan") — explicitly
marks it as beyond the finish line already reached, never implying the
finish line wasn't real.

### S10 — Prior-day incomplete (arriving at a NEW day)

The learner opens Today on a new local day; yesterday's plan had unresolved
items that were neither completed nor skipped (product spec §16, worked
example "Unfinished prior day," §19). A fresh plan is generated from current
learning state; there is no explicit carry-over/backlog mechanic.

This must be communicated so it does not feel like silent data loss:
yesterday's items are not "lost" in the sense of being deleted or forgotten
by the system (history is persisted, §18) — they simply do not mechanically
reappear as a debt list. The messaging should acknowledge that a new plan
was built fresh, without dwelling on what didn't get finished as a scoreboard
of failure.

Illustrative copy: *"היום יש תוכנית חדשה, מותאמת למה שחשוב עכשיו"* ("Today
there's a new plan, matched to what matters now") — forward-looking,
deliberately does not surface a count of "8 items left over from yesterday"
as an accusatory tally. If yesterday's unresolved material is still
genuinely needed, it will naturally reappear through ordinary ranking (§16)
and will simply look like today's plan, not a "catch-up" list.

### S11 — Error

The plan could not be generated, loaded, or updated due to a technical
failure (not a product state — a system fault). Must not be confused with S12
(genuinely empty) or S13 (not enough evidence yet).

Illustrative copy: *"אירעה תקלה בטעינת התוכנית"* ("There was a problem
loading the plan") with a retry action (S11→S1/S0, see transitions below).

### S12 — Retry (transient, from error)

The learner (or an automatic mechanism) re-attempts generation/load after
S11. Transitions back to S1 (generating) or directly to S2 (ready) if cached
state can be recovered without regenerating.

### S13 — Empty: genuinely no learning need (mature learner)

A learner with substantial history and evidence has a day where nothing
currently rises to meaningful need across any active Course — no overdue
review, no active misconception, no exam-proximity urgency, no pending new
material. This is a legitimate, occasionally-expected state (product spec's
"Three active Courses" example, §19: "likely zero Course C items... this is
expected, not a bug").

This is **not** the same state as S14, and must not share its copy or
visual treatment — conflating them would violate `docs/PRODUCT.md` §13's "new
learner ≠ nothing to review" principle in the wrong direction (a confident
message here is correct precisely because there **is** enough evidence to
support it).

Illustrative copy: *"אין היום פריטים שדורשים תשומת לב מיוחדת — הידע שלך
יציב כרגע"* ("There's nothing today that needs special attention — your
knowledge is holding steady right now") — confident, evidence-backed
reassurance, not a shrug.

### S14 — Empty: not enough evidence yet (new/thin-history learner)

A learner with little or no attempt history has not yet generated enough
evidence for normal adaptive ranking to produce a plan (`docs/PRODUCT.md`
§13). This must be visibly different from S13: the honest message is
uncertainty, not confidence.

Illustrative copy: *"עוד אין לנו מספיק מידע כדי להמליץ בביטחון — בואו נתחיל
לאסוף קצת"* ("We don't have enough information yet to recommend with
confidence — let's start gathering some") — paired with a starter-style path
into initial content (the Starter Experience is `docs/archive/ROADMAP.md` Phase 5
territory, not designed by this document). Never phrased as "nothing to
review" (the exact anti-pattern `docs/PRODUCT.md` §13 names).

---

## 3. State-transition list

Format: `STATE --[action/event]--> STATE`.

```text
S0  (not created)         --[learner opens any Today view, first time today]--> S1
S1  (generating)          --[generation completes, plan non-empty, mature learner]--> S2
S1  (generating)          --[generation completes, plan empty, mature learner, genuine no-need]--> S13
S1  (generating)          --[generation completes, plan empty/thin, new learner, insufficient evidence]--> S14
S1  (generating)          --[generation fails]--> S11
S2  (ready)                --[learner completes an item]--> S5 --[auto]--> S3 (or S9 if that was the last item)
S2  (ready)                --[learner skips an item]--> S6 --[auto]--> S3 (or S9 if that was the last item)
S2  (ready)                --[learner switches to a Course filter]--> S4 (overlay; underlying state unchanged)
S3  (in progress)          --[learner completes another item]--> S5 --[auto]--> S3 or S9
S3  (in progress)          --[learner skips another item]--> S6 --[auto]--> S3 or S9
S3  (in progress)          --[significant learning event detected]--> S7 --[auto, brief]--> S3 (plan continues, inline note shown)
S3  (in progress)          --[learner switches to/from Course filter]--> S4 (display-only, no resolution change)
S3  (in progress)          --[last remaining item resolves]--> S9
S4  (Course-filtered)      --[learner completes/skips within filtered view]--> same S5/S6 effects as S2/S3, reflected in both views
S4  (Course-filtered)      --[learner returns to Global view]--> S2 or S3, whichever the underlying plan state is
S9  (done for today)       --[learner opts into extra learning]--> (Manual Practice — out of scope, no Today state change)
S9  (done for today)       --[next local day, learner opens any Today view]--> S0 for the new day --> S1 --> ...
S2/S3/S9 (any day D)       --[local day rolls over to D+1, learner opens Today]--> S0(D+1) --[if D had unresolved items]--> may pass through S10 framing on first open of D+1
S11 (error)                --[learner retries]--> S12 --[retry succeeds]--> S1 or S2
S11 (error)                --[retry fails again]--> S11
S13 (genuinely empty)      --[new significant evidence arrives later same day, e.g. via Manual Practice]--> may transition to S3/S2 only via significant-event adaptation rules (§12 of product spec) — not a full replan
S14 (not enough evidence)  --[learner completes Starter-style initial items]--> eventually S2/S3 on a later day once evidence accrues (exact transition owned by Starter Experience design, `docs/archive/ROADMAP.md` Phase 5 — not decided here)
```

Notes on the diagram:

- S5 and S6 are momentary per-item states that always resolve back into S3
  (more remaining) or S9 (nothing remaining) — they are not screens the
  learner lingers on.
- S7 (plan adapted) is an overlay notification on top of S2/S3, not a
  distinct screen — the learner remains in S3 while the inline note is shown.
- S4 (Course-filtered) is a lens over S2/S3/S5/S6/S9, never an independent
  resolution state — this is the direct UI consequence of product spec §3's
  "same underlying Daily Plan, not separate plans."
- There is no transition from S9 back into the *same day's* plan growing
  again — no-replenishment is structural (§13 of product spec), not just a
  copy choice.
- S13 and S14 are both terminal-for-the-day empty states but are reached via
  different upstream conditions (evidence maturity) and must never share
  copy, iconography, or tone.

---

## 4. Explicitly out of scope for this document

- Any actual component, screen route, or state-management implementation.
- Exact Course-filter UI mechanism (tab, dropdown, chip list, etc.).
- Final, approved Hebrew copy — everything above is illustrative only and
  would need product/localization review before use (per this session's
  instruction; also consistent with `docs/PRODUCT.md` §19's messages-layer
  requirement).
- Starter Experience internal states (S14's downstream path) — owned by
  `docs/archive/ROADMAP.md` Phase 5, not designed here.
- Manual Practice UI states — a separate, non-Today path (product spec §3,
  §14).
- Numeric thresholds for what counts as a "significant learning event"
  (§12/§20 of the product spec — explicitly not decided).

## Related Documents

- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` (canonical product-language reference;
  this document is UX-state detail on top of it, not a replacement)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, unmodified)
- `docs/PRODUCT.md` §13, §18, §19
- `docs/ARCHITECTURE.md` §23 (messages layer)
- `docs/RUPPIN_GLOBAL_TODAY_DEMO_SCOPE.md` (companion document — which of
  these states are realistic to actually build for the Ruppin demo)

# Global Today — Product Specification

Status: **ACCEPTED AND FORMALIZED — see
`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016,
ACCEPTED).** This document remains the product-language source of every
rule ADR-016 formalizes; where the two might read differently, ADR-016 is
authoritative. **Not yet implemented** — no migration exists for the
`DailyPlan`/`DailyPlanItem` model this document and ADR-016 describe;
`today_sessions`/`today_session_items` (ADR-011) remain the actually
implemented schema.

This document formalizes product rules Dor explicitly accepted in product
discussion on 2026-09-18, and the remaining architecture/decision checklist
Dor accepted on 2026-09-19 (`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`,
RESOLVED). It is written in product language first, implementation language
second. It does not implement anything, does not modify
`docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, now partially
superseded by ADR-016 — see ADR-011's updated status), and does not invent
any behavior beyond what is stated here, in ADR-016, or already accepted
elsewhere in `docs/`.

**Core accepted model:** one `DailyPlan` per learner per local day,
composed of `DailyPlanItem`s. Global Today and Course Today are *views*
over that one persisted plan — Course Today filters by `courseId`. This
replaces the earlier framing of Global Today as a composition over
independent per-Course sessions (ADR-016 §1).

Companion documents produced in this same session (see each for detail):
`docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md`, the proposed ADR under
`docs/DECISIONS/`, `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`,
`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`, `docs/GLOBAL_TODAY_APPLICATION_FLOW.md`,
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`, `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`,
`docs/NEW_MATERIAL_EXPOSURE_MODEL.md`, `docs/TODAY_ADAPTATION_MODEL.md`,
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md`, `docs/TODAY_TIMEZONE_EDGE_CASES.md`,
`docs/GLOBAL_TODAY_CONCURRENCY_REVIEW.md`, `docs/GLOBAL_TODAY_TEST_PLAN.md`,
`docs/GLOBAL_TODAY_UX_STATE_MACHINE.md`, `docs/RUPPIN_GLOBAL_TODAY_DEMO_SCOPE.md`,
`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`,
`docs/GLOBAL_TODAY_DOC_CONSISTENCY_AUDIT.md`,
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`,
`docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md`,
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`.

---

## 1. Purpose

Today answers "what should I study now?" (`docs/PRODUCT.md` §5). As of
ADR-011, that answer is generated separately per Course — a learner with
three active Courses has three independent Today plans, three independent
finish lines, and no single place that ranks learning need *across* their
whole academic life.

Global Today's purpose is to make the ranking learner-need-driven rather
than Course-driven: one recommended daily plan, ranked by how urgently the
learner needs to touch each piece of evidence, wherever it happens to live.
Course Today remains available as a filtered view of the same plan, not a
competing plan.

## 2. User mental model

> There is one Today. It can be looked at three ways: everything (Global),
> just this Course (Course Today), or nothing at all — because Manual
> Practice is a separate thing entirely.

The learner should never experience "I finished my Course A items in Course
Today, but Global Today still shows them as outstanding" or vice versa —
because there is only one underlying fact about whether an item is done.

## 3. Global Today vs. Course Today vs. Manual Practice

```text
                    ONE Daily Plan (per user, per local day)
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   Global Today          Course Today A         Course Today B
   (all items,      (only Course A's items  (only Course B's items
    every active      from the same plan)     from the same plan)
    Course)
```

- **Global Today** and **Course Today** are views over the same underlying
  Daily Plan, not separate plans. Completing, skipping, or otherwise
  resolving an item through either view resolves the same item everywhere.
- **Manual Practice** is a distinct learning path. It is not a view of the
  Daily Plan at all. A learner may manually answer a Question that also
  happens to be planned inside today's Daily Plan; see §13.
- Today (Global or Course) recommends; the learner decides. This is
  unchanged from `docs/PRODUCT.md` §5/§18 and
  `docs/DECISIONS/003-quiz-does-not-select-today-questions.md`'s spirit —
  Global Today does not add a new autonomy exception.

## 4. Daily Plan lifecycle

```text
No plan exists for local day D
        │
        │  learner opens Today (Global OR Course — whichever is first) for day D
        ▼
Plan generated from current learning state, persisted, frozen
        │
        │  learner studies; items resolve to COMPLETED or SKIPPED
        │  (significant-event adaptation may touch remaining unresolved items — §12)
        ▼
All items COMPLETED or SKIPPED
        │
        ▼
"Done for today" — real finish line (§7)
        │
        │  optional, opt-in extra learning (not part of the completed plan)
        ▼
(next local day D+1: a NEW plan is generated on first open — no carry-over, §16)
```

## 5. First-open generation

The Daily Plan is created the first time the learner opens **any** Today
view (Global or a specific Course) on a given local day — whichever comes
first. It is not pre-generated at midnight for inactive users, and a second
Today view opened later the same day must not trigger a second plan for
that day; it resumes the one already generated.

Generation uses the learner's latest available learning state at the moment
of that first open, not state from whenever the plan is later resumed.

Once created, the plan is persisted and frozen by default (§11).

## 6. Dynamic size

There is no fixed daily item count and no time-budget input ("how many
minutes do you have today?"). Plan size is driven by learning need: a calm
day may produce a small plan, an exam-heavy or high-risk day may produce a
larger one. A reasonable preferred range may eventually exist as a
calibration guardrail, but exact minimum/maximum values are explicitly NOT
decided here — see `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` and
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md`.

## 7. Ranking principles

Global Today ranks learning need across every ACTIVE Course (§17) with:

- **no artificial per-Course quota**,
- **no fairness balancing**,
- **no minimum Course representation**,
- **no maintenance floor**.

If genuine need concentrates 80% of today's plan in one Course, that is
acceptable. A Course silent for several days does not automatically regain
representation — it re-enters ranking because its own signals (memory need,
etc.) rise, not because of a floor.

**"No floor" is not "silently forgotten forever."** Increasing forgetting
risk / overdue duration / Memory Need must be able to increase a
candidate's real priority enough to outrank higher *nominal* candidate
tiers — the ranking function must not permanently tier-cap a lower-tier
candidate (e.g. `REVIEW_DUE`) regardless of memory risk, purely because
sibling Courses keep generating higher-tier candidates. This is a required
property of the ranking function itself, not a per-Course floor, quota, or
exception (ADR-016 §10, resolving
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5). Exact weights/formula for
this remain not finalized. See `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` for
the candidate scoring architecture.

## 8. Exam behavior

A Course does not require an exam to participate in Today. Exam proximity
is an **urgency amplifier**, not an eligibility requirement — a Course with
no exam may outrank a Course with a distant exam because of memory risk,
weakness, misconception, coverage need, or new-material exposure need.
Illustrative, non-final calibration direction: urgency begins rising
meaningfully around ~14 days before an exam, more strongly around ~3–4
days before. Exact weights are not decided — see
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`.

## 9. New-material exposure

**New Material Exposure is an extension of Starter Experience** — one
broader low-evidence/unseen-material mechanism family (beginning of a new
Course, a new chapter added later, or a topic with insufficient learner
evidence generally), not two unrelated mechanisms (ADR-016 §13, resolving
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §3). Today may expose new
material through a small initial sample (illustrative: 2–3 representative
questions) — exposure, not proof of mastery. Good initial performance
continues gradual exposure toward normal review/retrieval; poor performance
may lead Today to *recommend* (never silently redirect to) focused Manual
Practice. Exact eligibility/sampling policy remains open — see
`docs/NEW_MATERIAL_EXPOSURE_MODEL.md` and `docs/OPEN_QUESTIONS.md` #4/#5
(not resolved by the extension framing).

## 10. Novelty behavior

When multiple new topics exist across Courses, Today should prefer
introducing fewer new topics in one day with a few representative exposure
questions each, rather than superficially touching many unrelated new
topics. Exact numeric topic limits are not decided — see
`docs/NEW_MATERIAL_EXPOSURE_MODEL.md` §"Novelty budget."

## 11. Frozen-plan semantics

The Daily Plan is frozen by default once generated: item order, action
type, and content do not silently change as the day progresses. This
mirrors the existing per-Course freeze model already accepted for V1
Today (`docs/DECISIONS/010-answer-submission-transaction-model.md`'s
"Today Session freeze model") and does not weaken it — see
`docs/ADR_011_GLOBAL_TODAY_IMPACT_REVIEW.md`.

## 12. Significant-event adaptation

A significant learning event MAY justify a small change to future
(not-yet-resolved) items only. **Only Today-sourced Attempts (Global or
Course Today) may trigger significant-event adaptation in V1** — a Manual
Practice Attempt never triggers mid-day adaptation of the DailyPlan, even
if it would meet the same significant-event condition (ADR-016 §4,
resolving `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §4; see §14 below).
Accepted candidate triggers: confident wrong answer; a misconception
crossing a meaningful threshold; unexpected failure on previously strong
material; a short cluster of failures around the same topic; very low
familiarity revealed during new-material exposure. Allowed:
replacing/inserting a small number of future items, preserving total scope
as much as possible. Not allowed: full reranking, changing completed items,
endless growth, turning one error into a full chapter drill, or reranking
after every normal answer. Exact thresholds are not decided — see
`docs/TODAY_ADAPTATION_MODEL.md`.

## 13. Skip semantics

Skip is a real learner decision for that day:

- the item becomes RESOLVED for Today (removed from the outstanding set);
- it is neither COMPLETED learning nor scored as INCORRECT — mastery is not
  updated as if the learner failed;
- it does not reappear in the same Daily Plan;
- it is persisted in Today history;
- repeated skipping may become a future behavioral signal (policy not
  decided);
- **skip does not trigger replenishment** — the plan does not grow back to
  its original size merely because items were skipped.

Daily finish condition: every planned item is either COMPLETED or SKIPPED.

## 14. Completion semantics

**Manual Practice does not satisfy the Daily Plan.** If a learner manually
answers the same Question that Today already planned:

- learning state (mastery, progress, evidence) DOES update, exactly as any
  other Attempt would;
- the Today item does NOT become completed, does NOT disappear, and may
  still be presented again inside Today;
- if manual activity on *other* questions changes learning state, Today
  remains frozen by default (§11) — Manual Practice never triggers
  significant-event adaptation (§12); only Today-sourced Attempts may.

Completing an item through Course Today updates the same underlying item as
Global Today — there is exactly one write, visible from both views (§3).

**A resolved item cannot be re-answered through Today.** A `DailyPlanItem`
resolves (COMPLETED or SKIPPED) exactly once. A new Today answer attempt
against an already-resolved item is a conflict / already-resolved case, not
a normal Today action — it must not silently create a new learning Attempt
(ADR-016 §19, resolving `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §6).
Idempotent technical retries (same `submissionId`, same command, per
ADR-010) are unaffected. To intentionally answer the same Question again,
the learner uses Manual Practice.

## 15. Midnight/timezone semantics

"Today" is based on the learner's local timezone. A session started before
local midnight is not interrupted at exactly 00:00 — an actively continuing
session may keep using the day it started on. A session started fresh
after midnight uses the new local day's plan (generated on that day's first
open, per §5). Exact lifecycle mechanics (session-continuation boundary,
timezone-change handling, DST) are analyzed, not decided, in
`docs/TODAY_TIMEZONE_EDGE_CASES.md`.

## 16. Incomplete-day semantics

Incomplete items from a prior day do NOT automatically carry over into the
next day's plan. Each day's plan is built fresh from current learning
state. If yesterday's unfinished items are still important, they may
naturally rank high again through the ordinary ranking signals (§7) — but
there is no explicit backlog/carry-over mechanism. Today must not become a
debt list.

## 17. Course archive behavior

Per `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
(ADR-015), a learner-archived Course (`CourseMembership.archivedAt !=
null`) does not participate automatically in Global Today, remains
manually accessible/practiceable, and may be reactivated. Only
non-archived, non-revoked `CourseMembership` rows participate in normal
Daily Plan generation.

## 18. Today history

History is persisted from day one; a History UI is not required for V1.
Enough must be captured to later answer: what was recommended, what was
completed, what was skipped, what remained incomplete, which Courses were
represented, in what order, what adaptations happened and why, when the
session started/completed, and the daily completion/resolution rate. Not
every field needs to be a database column — see
`docs/TODAY_HISTORY_ANALYTICS_PLAN.md` for the persisted-state-vs-event
split.

## 19. Examples

**Three active Courses with different needs.** Learner has Course A (exam
in 3 days, several overdue reviews), Course B (no exam scheduled, one
active misconception), Course C (quiet for two weeks, nothing overdue).
Global Today plan: mostly Course A (exam urgency + overdue reviews),
one or two Course B items (misconception outranks "no exam"), likely zero
Course C items today — not because of a floor being denied, but because
nothing in C currently has elevated need. This is expected, not a bug (§7).

**Course with no exam outranking a distant-exam Course.** Course X exam is
40 days out (urgency not yet meaningfully elevated, §8). Course Y has no
exam at all but a Question with `MISCONCEPTION_ACTIVE`. Y's item outranks
X's routine review, because misconception severity does not depend on exam
proximity.

**80% of Today from one Course.** Midterm week for Course A: 8 of 10 items
are Course A, 2 are Course B maintenance-level review. This is acceptable
and expected under §7 — no rebalancing occurs to make it "fairer."

**New topic exposure.** Course A begins a new chapter. Today includes 2
representative exposure questions for the new topic (§9) alongside review
items from elsewhere. If the learner does poorly on both, tomorrow's plan
(or a same-day recommendation, not an automatic redirect) may surface
"practice this topic manually" rather than immediately drilling it inside
Today.

**Manual practice of a Question that remains in Today.** Question Q17 is
item 4 of today's Global Today plan (not yet resolved). The learner opens
Manual Practice for Course A and answers Q17 there. Learning state updates
from that Attempt. Today item 4 still shows as pending afterward and may
still be presented when the learner returns to Today.

**Course Today completion reflected in Global Today.** Learner opens
Course Today for Course B, answers item 2 (completing it). Later the same
day, opening Global Today shows that same item as completed — same
underlying record, viewed differently.

**3 skipped items and real Daily completion.** Today has 10 items. The
learner completes 7 and skips 3. All 10 are now resolved (COMPLETED or
SKIPPED) — the learner sees "Done for today." No replacement items are
inserted for the 3 skipped ones (§13).

**Pre-midnight active session.** Learner starts Today at 23:50 on day D.
At 00:05 they are still actively in that session. They may continue
working through day D's plan without it being interrupted or replaced by
day D+1's plan mid-session (§15). Exact continuation-boundary mechanics:
`docs/TODAY_TIMEZONE_EDGE_CASES.md`.

**Unfinished prior day.** Yesterday: 14 planned, 6 completed, 8 incomplete
(neither completed nor skipped — the learner simply stopped). Today: a
fresh plan is generated from current learning state. Some of yesterday's
unresolved items may reappear if their underlying need is still high; there
is no automatic carry-over of the literal 8 items (§16).

**Significant confident-wrong adaptation.** Mid-session, the learner
answers a not-yet-attempted Question incorrectly while indicating high
confidence (a candidate significant event, §12). A small number of
remaining, not-yet-resolved items may be adjusted — e.g. a focused
follow-up question on the same misconception inserted — without a full
replan and without touching already-completed items.

## 20a. Ruppin demo scope: architecture vs. feature scope

Before the Ruppin demo, the required foundation is the DailyPlan/
DailyPlanItem architecture, a single-Course Today vertical slice built on
it, Course Today, Manual Practice separation, Skip, completion,
Attempts/Progress, Auth, CourseMembership, QR join, persistence, and real
usable UI. **Multi-Course Global Today itself is not a hard demo
requirement** — ADR-015 frames Ruppin as one lecturer, one Course, so a
multi-Course scenario would not be observable there anyway. It may be
added as a bonus if schedule allows, or follows immediately after the demo,
because the architecture built beforehand is already multi-Course-ready by
construction. What is **not** acceptable is building a throwaway
Course-only architecture that would need to be discarded after the demo
(ADR-016 §20, resolving `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §7).

## 20b. Home entry point

Once multi-Course Global Today exists, Home defaults to Global Today ("my
recommended plan for today"). Course Today is reached from within a Course
and filters the same DailyPlan. Manual Practice remains an intentional
Course/topic-scoped action, not a Home default (ADR-016 §21, resolving
`docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §8). This has no effect on the
current single-Course-at-a-time product until multi-Course Global Today
ships.

## 20c. KPI unit

One `DailyPlan` equals one Today completion for KPI purposes, regardless of
whether it was resolved via Global Today, Course Today, or a mixture of
both — there are no separate Global-Today-completion and
Course-Today-completion KPIs for the primary Today-completion metric
(ADR-016 §22, resolving `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §9).
`docs/OPEN_QUESTIONS.md` #20 (Active User KPI Denominator) and #21 (Week
Boundary) are untouched by this and remain open.

## 20d. Explicitly NOT decided

The following are intentionally left open by this document and must not be
inferred or invented downstream:

- Exact scoring weights/coefficients for the priority model (§7, §8),
  including the exact mechanism by which §7's tier-crossing requirement is
  computed numerically.
- Exact significant-event detection thresholds (§12).
- Exact dynamic-size minimum/maximum bounds and the sizing model's precise
  formula (§6).
- Exact novelty-budget numeric limits (§10) and exact Starter/Exposure
  eligibility/sampling thresholds (§9, `docs/OPEN_QUESTIONS.md` #4/#5).
- Final timezone/day-boundary implementation mechanics beyond the
  qualitative rule in §15.
- The exact migration path from the currently-implemented
  `today_sessions`/`today_session_items` schema to `DailyPlan`/
  `DailyPlanItem` — implementation work, not decided here.
- Whether `docs/OPEN_QUESTIONS.md` #33 (Multiple Active Courses) must be
  formally resolved before Global Today can be built, versus proceeding in
  parallel.
- Repeated-skip behavioral policy.
- History UI (deferred beyond V1 by design, §18).
- The production composition root / conservative default policy values
  needed to run the learning engine end-to-end — see
  `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`.

## Related Documents

- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
  (ADR-016, ACCEPTED — the authoritative decision record this document
  formalizes in product language)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011 — partially
  superseded by ADR-016; `today_sessions`/`today_session_items` remain the
  actually implemented schema)
- `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` (the 9-item decision checklist,
  now RESOLVED)
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` (prior impact analysis this session
  builds on)
- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  (ADR-015 — archive/revoke semantics referenced in §17)
- `docs/OPEN_QUESTIONS.md` (#33, #34 resolved, #4, #5, #16, #17, #20, #21)
- `docs/PRODUCT.md`, `docs/DOMAIN_GLOSSARY.md`, `docs/LEARNING_ENGINE.md`

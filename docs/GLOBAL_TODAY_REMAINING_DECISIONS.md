# Global Today — Remaining Decisions for Dor

Status: **RESOLVED — all 9 items accepted by Dor on 2026-09-19.** Formalized
in `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016, ACCEPTED). This document is kept as the historical record of each
question, its options, and the accepted answer — it is no longer a decision
queue.

This list was deliberately short. It excluded field naming, obvious
engineering choices, anything already accepted in
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`, and anything this session's agents
could safely derive on their own. Each item below was something only Dor
could actually resolve — a product call, a risk-acceptance call, or an
architecture commitment with real migration cost. Each is now resolved;
where a genuine sub-question remains (calibration values, migration
mechanics), it is called out explicitly rather than folded into "resolved."

---

## 1. Persistence architecture: replace or extend ADR-011's schema?

**Accepted answer: Option A.** Replace `today_sessions`/`today_session_items`
as the *target* architecture with a single `DailyPlan`/`DailyPlanItem`
entity — one `DailyPlan` per `(user_id, planned_for_date)`, `DailyPlanItem`
carrying its own `courseId`, Course Today served as a filtered view. See
ADR-016 §1.

**What remains open:** the exact migration path from the currently
*implemented* `today_sessions`/`today_session_items` schema to
`DailyPlan`/`DailyPlanItem` is implementation work, not decided here — see
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`. No migration has been written
or authorized. `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`'s reasoning for
recommending Option A remains the reference analysis; it is not
superseded, only promoted from recommendation to accepted decision.

**Why it mattered:** this was a genuine architectural change to ADR-011's
accepted, committed schema, not an additive extension — now formally
recorded as such in ADR-011's updated status.

---

## 2. Does completing Global Today also complete the constituent Course session(s)?

**Accepted answer: moot, resolved by §1.** Because there is exactly one
`DailyPlan`/`DailyPlanItem` entity under the accepted Option A, there is no
independent "Course session completion" concept to keep in sync with Global
completion — completing an item through either view resolves the same
underlying `DailyPlanItem`. See ADR-016 §1, §8, §22.

---

## 3. Is new-material exposure the same mechanism as Starter Experience, an extension, or separate?

**Accepted answer: extension.** New Material Exposure is an extension of
Starter Experience — one broader low-evidence/unseen-material mechanism
family, not two unrelated mechanisms, and not a full retirement of the
"Starter" concept. See ADR-016 §13.

**What remains open:** exact eligibility/sampling policy for either the
Course-level Starter case or the topic-level Exposure case is calibration
work, not decided here. `docs/OPEN_QUESTIONS.md` #4/#5 (Starter Experience
eligibility/sampling) remain OPEN on their own terms — only the "one family
or two" framing question is resolved. Do not treat #4/#5 as closed.

---

## 4. Can a "significant event" detected via Manual Practice adapt Today?

**Accepted answer: no.** Only Today-sourced Attempts (Global or Course
Today) may trigger significant-event adaptation in V1. A Manual Practice
Attempt updates learning state normally but never triggers mid-day
adaptation of the DailyPlan, even if the same significant-event condition
would have triggered it through Today. See ADR-016 §4, §8.

---

## 5. Does a quiet, well-mastered Course's item ever actually get crowded out permanently?

**Accepted answer: no floor, but the ranking function must let Memory Need
cross tier boundaries.** "No floor, ever" is accepted as the product rule —
a Course can in principle go quiet if nothing in it currently has elevated
need. But the ranking function must not permanently tier-cap a candidate
(e.g. `REVIEW_DUE`) regardless of how overdue or memory-critical it becomes,
purely because sibling Courses keep generating higher-tier candidate types.
This is a required property of the ranking function itself, not a
per-Course floor, quota, or exception list. See ADR-016 §10.

**What remains open:** exact formula/weights for how memory risk
translates into tier-crossing priority is calibration work — see
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md`. `src/domain/learning/next-best-action-ranking.ts`
does not yet implement this property; ADR-016 commits the project to
closing that gap, it does not itself close it.

---

## 6. Should a second Attempt against an already-completed TodaySessionItem/DailyPlanItem be rejected?

**Accepted answer: yes, reject as a conflict.** A DailyPlanItem resolves
exactly once. A new Today answer attempt against an already-COMPLETED or
already-SKIPPED item is treated as a conflict / already-resolved case, not
a normal Today action — it must not silently create a new learning Attempt.
Technical retry idempotency (same `submissionId` + same canonical command,
per ADR-010) is unaffected. Intentional re-answering uses Manual Practice.
See ADR-016 §19.

---

## 7. Ruppin demo scope: confirm deferring Global (multi-Course) Today

**Accepted answer: confirmed, with a constraint.** Multi-Course Global
Today is not a hard demo requirement — `docs/RUPPIN_GLOBAL_TODAY_DEMO_SCOPE.md`'s
reasoning (ADR-015 frames Ruppin as one lecturer, one Course; a worked
multi-Course example needs at least two Courses to be observable at all) is
confirmed. **The added constraint:** the architecture built before the demo
must still be the correct DailyPlan/DailyPlanItem foundation (§1) — not a
throwaway Course-only architecture. Multi-Course Global Today may be added
as a bonus before the demo if schedule allows, or follows immediately after
since the architecture is already multi-Course-ready by construction. See
ADR-016 §20.

---

## 8. Home entry-point relationship: does Global Today replace Course Today as the default, or are both always parallel?

**Accepted answer: Global Today becomes the Home default once multi-Course
Global Today exists.** Course Today is reached from within a Course and
filters the same DailyPlan. Manual Practice remains an intentional
Course/topic-scoped action, not a Home default. Until multi-Course Global
Today ships, this has no effect on the current single-Course-at-a-time
product. See ADR-016 §21.

---

## 9. Does a Global Today completion count toward the primary KPI, and how?

**Accepted answer: one DailyPlan equals one Today completion.** Resolving
the DailyPlan via Global Today, Course Today, or a mixture counts once — no
separate Global-Today-completion and Course-Today-completion KPIs for the
primary Today-completion metric. See ADR-016 §22.

**What remains open:** `docs/OPEN_QUESTIONS.md` #20 (Active User KPI
Denominator) and #21 (Week Boundary) are untouched by this decision and
remain OPEN.

---

## Not included here (already settled or safely deferrable without a decision)

Exact numeric calibration values (significant-event thresholds, dynamic
plan-size bounds, novelty-budget topic limits, exam-urgency weights,
tier-crossing weights for §5) remain real gaps but are *calibration* work,
not decisions requiring a product meeting first — they can be picked
conservatively by engineering and revised, per
`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` and
`docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`'s own recommendations, now that the
architecture (§1) is decided.

Separately, the production composition root / conservative default policy
values needed to actually run the learning engine end-to-end
(`docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`) remain unresolved
and are not one of the 9 items above — they are a distinct implementation
prerequisite, tracked in `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`.

## Related Documents

- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016, ACCEPTED — formalizes every answer above)
- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (partially superseded — see its updated status)
- `docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md`, `docs/GLOBAL_TODAY_ADVERSARIAL_REVIEW.md`
- `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md` (implementation sequencing)
- `docs/OPEN_QUESTIONS.md` (#4, #5, #20, #21, #33 remain open; #34 resolved)

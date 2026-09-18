# ADR-011 Impact Review — Global Today

Status: **ANALYSIS ONLY — NOT AN ADR, NOT A DECISION, NOT IMPLEMENTED.**

This document classifies every assumption/decision made by
`docs/DECISIONS/011-today-is-course-scoped-v1.md` (ADR-011, Status:
ACCEPTED, unmodified by this document) against the Global Today product
direction Dor accepted in the 2026-09-18 product discussion
(`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`), grounded in the prior impact
analysis (`docs/GLOBAL_TODAY_DESIGN_DRAFT.md`). Its purpose is to give the
proposed `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
an explicit, checkable basis for stating whether it supersedes ADR-011
fully or partially, rather than asserting that conclusion unsupported.

Each ADR-011 clause is classified as one of: **STILL VALID**, **NEEDS
AMENDMENT**, **SUPERSEDED BY GLOBAL TODAY**, **IMPLEMENTATION DETAIL NOT
PRODUCT RULE**, or **UNCLEAR — REQUIRES DOR**.

---

## Summary table

| ADR-011 clause | Classification |
|---|---|
| "Today is course-scoped" as the top-level product framing (Decision, 1st bullet) | NEEDS AMENDMENT |
| `TodaySession` keyed by `(user_id, course_id, planned_for_date)`, `UNIQUE` constraint | STILL VALID (as persistence substrate for the Course Today *view*) |
| "A learner ... may have two separate `TodaySession` rows ... one per Course" | NEEDS AMENDMENT (rows may still exist; "separate" no longer means independently-completable) |
| "Global, cross-course Today ... is explicitly deferred beyond V1" | SUPERSEDED BY GLOBAL TODAY |
| `TodaySessionKey` as a plain object (no `scope` discriminant) | STILL VALID (unchanged; a Global concept, if any, is a new sibling type, not a change to this one) |
| `today_sessions.course_id` `NOT NULL` + FK + `UNIQUE` (Consequences) | STILL VALID |
| `UserQuestionProgressRepository.listForUser(userId, courseId)` required `courseId` | STILL VALID for its existing caller; NEEDS AMENDMENT (additive extension) for a Global candidate pool |
| `getOrCreateTodaySession` no longer branches on `key.scope` | STILL VALID |
| Today composition/interleaving (ranking/planning) "entirely unaffected" | STILL VALID |
| "A learner's Today picture across multiple Courses is not addressed... new work on top... not a reason to revisit this key" | STILL VALID (ADR-011 already anticipated this) |
| First-open generation trigger (implicit in `today-session.ts`, not stated in ADR-011 itself) | NEEDS AMENDMENT |
| Freeze model (frozen columns: `position`, `action_type`, `tier`, `other_applicable_types`, `reasons`, `question_version_id`) | STILL VALID |
| Question selection / NBA ranking pipeline | STILL VALID |
| Session completion (`TodaySession.status` state machine) | UNCLEAR — REQUIRES DOR |
| Course relationship (`courses` FK, ADR-006 optional-Institution) | STILL VALID |
| `learningSessionId` derivation (ADR-012 §5) | STILL VALID, contingent on architecture choice (see below) |
| Retry / idempotency identity (`todaySessionId`/`todaySessionItemId` command-identity fields, ADR-010) | STILL VALID, same contingency |
| Resume semantics (`getTodaySession` as a pure read) | STILL VALID |
| Alternatives Considered: "Global (cross-Course) Today for V1 — Rejected for V1" | SUPERSEDED BY GLOBAL TODAY (rejection was explicitly scoped "for V1"; product direction has since changed, pending ADR-016's formal acceptance) |

---

## Detailed classification

### 1. "UNLOCK V1 Today is course-scoped" (ADR-011 Decision, line 30)

**NEEDS AMENDMENT.** ADR-011's own words: "One `TodaySession` belongs to
exactly one `(user_id, course_id, planned_for_date)` tuple" and Today is
"generated separately per Course" (`docs/OPEN_QUESTIONS.md` #34's
resolution text). `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §2–§3 states the
opposite framing at the product level: there is **one** Daily Plan per
user per local day; Global Today and Course Today are two *views* of that
same plan, not two independently generated plans. The literal claim "Today
is course-scoped" (singular, unqualified) is no longer true as a
description of the product's Today concept — it remains true only as a
description of one view (Course Today) over a broader concept ADR-011 did
not have. This is why the proposed ADR-016 treats this as a partial, not
full, supersession — see §4 below for what is NOT changed.

### 2. `TodaySessionKey`/`UNIQUE (user_id, course_id, planned_for_date)` (lines 32–34, 40–43)

**STILL VALID**, specifically as the identity of the Course Today *view's*
persisted representation. `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §8 finds no
migration scenario that requires altering or dropping this key, and §9's
non-binding Option C lean keeps existing `today_sessions`/
`today_session_items` completely untouched, adding only a new table that
*references* them. Nothing in the accepted product rules requires changing
this key's shape. It is downgraded from "the sole identity of Today" to
"the identity of the Course-scoped view," which is why the top-level
framing in §1 needs amendment even though this specific type/constraint
does not.

### 3. "A learner with two active Courses may have two separate `TodaySession` rows for the same date, one per Course" (lines 35–36)

**NEEDS AMENDMENT.** The rows themselves may continue to exist structurally
as described. What needs amendment is "separate" in the sense ADR-011
meant it: independently generated, independently completable plans with no
shared fate. Under `docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §3/§14, completing
an item via one Course's session must be visible as completed via Global
Today (same underlying record), and item inclusion must not double-count
across a Course session and a Global session for the same Question
(`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §6, "plan-membership
double-counting" — the real, not-yet-closed risk). ADR-011's plain
"separate... one per Course" description undersells the new cross-session
consistency requirement.

### 4. "Global, cross-course Today ... is explicitly deferred beyond V1 — not implemented, not designed further here" (lines 37–39)

**SUPERSEDED BY GLOBAL TODAY.** This is the exact clause the accepted
product direction reverses. ADR-011 explicitly left the door open ("not a
closed door," line 47) — this is a scoped deferral being lifted, not a
reversal of a permanent decision. The deferral is superseded at the
*product-direction* level now (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md`); it
remains superseded only pending ADR-016 (currently `PROPOSED`) receiving
Dor's review, per this session's instruction not to mark anything as more
decided than it is.

### 5. `TodaySessionKey`'s removed `scope: "course" | "global"` discriminant (lines 40–43)

**STILL VALID, unchanged.** ADR-011's own text records this union was
removed because the ambiguity it represented was resolved. Nothing in the
accepted product rules requires reintroducing a scope discriminant onto
this specific type: if Option C (the design draft's non-binding lean,
§9–§10) is the eventual persistence choice, a Global Daily Plan is a
*separate, new* small entity that references Course-scoped
`TodaySessionItem`s — it does not need `TodaySessionKey` itself to grow a
scope field. This is a case where a sibling type may be added elsewhere,
not where this type needs to change.

### 6. Consequences — `today_sessions.course_id NOT NULL` + FK + `UNIQUE` (lines 51–53)

**STILL VALID.** `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §8 confirms no
scenario it considered requires altering this column or constraint.

### 7. Consequences — `UserQuestionProgressRepository.listForUser(userId, courseId)` required `courseId` (lines 54–57)

**STILL VALID** for its existing caller (`getOrCreateTodaySession` building
one Course's candidate pool). **NEEDS AMENDMENT** in the sense of a
required *additive* extension for Global Today: assembling a cross-Course
candidate pool needs either repeated calls to this same method (one per
active Course, concatenated — no port change) or a new port method scoped
by a set of Courses (design draft §2/§3). Nothing here removes or narrows
the existing signature.

### 8. Consequences — `getOrCreateTodaySession` no longer branches on `key.scope` (line 58–59)

**STILL VALID.** This function continues to serve Course Today unchanged.
A Global Daily Plan's generation is new orchestration logic that would call
this function (or its per-Course pipeline) once per active Course and then
aggregate — not a change to this function's own branching.

### 9. Consequences — Today composition/interleaving decisions "remain entirely unaffected" (lines 60–62)

**STILL VALID**, and confirmed independently by `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
§3: `generateNextBestActionCandidates`, `rankNextBestActionCandidates`, and
`generateTodayPlan` carry no `courseId` concept anywhere in their types and
require zero code changes to rank/plan a cross-Course candidate pool. This
is the strongest "reuse unchanged" finding in the whole impact analysis.

### 10. Consequences — "A learner's Today picture across multiple Courses is not addressed by this decision... new work on top of this... not a reason to revisit this key" (lines 63–66)

**STILL VALID.** ADR-011 explicitly pre-scoped itself to allow exactly the
kind of additive work Global Today now represents. This clause is not
contradicted by Global Today — it is confirmed by it.

### 11. First-open generation trigger (implicit in `src/application/learning/today-session.ts`, not stated as such in ADR-011's own text)

**NEEDS AMENDMENT.** ADR-011/ADR-010 never state a cross-Course generation
trigger because none was needed: today, opening Course A's Today only ever
generates Course A's session (`getOrCreateTodaySession` takes one
`TodaySessionKey`, i.e., one Course). `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§5 requires that the Daily Plan is created "the first time the learner
opens **any** Today view (Global or a specific Course) on a given local
day — whichever comes first," using state as of that moment. If a learner
opens Course A's Today first, this rule implies the *whole* cross-Course
Daily Plan's generation is anchored to that moment — a materially new
orchestration responsibility beyond what `getOrCreateTodaySession` does
today, flagged as unresolved orchestration work in
`docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §7/§9 (Option B/C both require
"generate every active Course's session first"). This is a real amendment
to the trigger semantics, not merely an extension.

### 12. Freeze model — frozen columns `position`, `action_type`, `tier`, `other_applicable_types`, `reasons`, `question_version_id` (ADR-010's "Today Session freeze model," referenced by ADR-011)

**STILL VALID**, and explicitly reaffirmed rather than weakened:
`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §11 states the Daily Plan's frozen-plan
semantics "mirrors the existing per-Course freeze model already accepted
for V1 Today... and does not weaken it." Significant-event adaptation
(§12 of the product spec) only ever touches *future, not-yet-resolved*
items and is additive scope on top of the existing freeze model, not a
change to what "frozen" means for an already-generated item.

### 13. Question selection / NBA ranking pipeline

**STILL VALID**, per §9 above — `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3's
finding that the ranking/planning pipeline is already Course-agnostic
applies here directly.

### 14. Session completion (`TodaySession.status`, "exact state machine DEFERRED" per `docs/PERSISTENCE_SCHEMA_V1.md`)

**UNCLEAR — REQUIRES DOR.** This was already unresolved for the
single-Course case before Global Today. Global Today adds a genuine second
axis that the accepted product rules do not resolve: does a per-Course
`TodaySession.status` flip to "completed" only when that Course's own
items are all resolved, or only when the entire cross-Course Daily Plan is
"Done for today" (`docs/GLOBAL_TODAY_PRODUCT_SPEC.md` §4/§7's finish
line)? Neither the product spec nor the design draft answers this
(design draft §5, "Session completion," explicitly leaves it open; §11 Q4
restates it as unresolved). This is not something this review can resolve
by inference — it needs an explicit Dor decision or an explicit "left open"
note in ADR-016.

### 15. Course relationship (`today_sessions.course_id` FK to `courses`, ADR-006's Course-does-not-require-Institution)

**STILL VALID**, entirely unaffected. Global Today changes *which*
Courses' items are aggregated into a view, not the Course entity's own
schema or its Institution-optionality.

### 16. `learningSessionId` derivation (ADR-012 §5)

**STILL VALID**, with one important, non-obvious contingency worth flagging
explicitly (this review's most notable finding): `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
§14 states "Completing an item through Course Today updates the same
underlying item as Global Today — there is exactly one write, visible from
both views." Read literally, that product rule requires that a Global
Today item and its corresponding Course Today item be **the same
persisted row**, not two independently-generated copies. If honored, that
rule *by itself* forecloses `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`'s Option A
(a fully independent Global entity with its own items) unless Option A
also builds an explicit cross-table dedup guard equivalent to referencing
the original row — and it automatically preserves ADR-012 §5's existing
derivation rule (`learningSessionId` = the owning `TodaySessionItem`'s
`todaySessionId`) with zero special-casing, because there is only ever one
`todaySessionId` per item regardless of which view displays it. This also
resolves `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §11 Q3 (same-session vs.
different-session evidence from two entry points) **only if** the
persistence architecture is built as a reference layer (design draft's
Option B or C), not as Option A's independent copy. The persistence
architecture itself remains formally undecided (`docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`,
being written separately) — this review only notes that the *product* rule
already constrains that future architectural choice more than the design
draft's non-binding Option C lean alone did.

### 17. Retry / idempotency command-identity fields (`todaySessionId`, `todaySessionItemId`, ADR-010's canonical field list)

**STILL VALID**, same contingency as §16: as long as a Global Today item is
a reference to a real, singular `TodaySessionItem`/`TodaySession` pair
rather than an independently-identified copy, `submitAnswer`'s existing
idempotency model needs no change at all for Attempts reached via a Global
Today entry point.

### 18. Resume semantics (`getTodaySession` as a pure read, no ranking recomputation)

**STILL VALID**, unaffected. A Global Today read-time aggregation/view
layer sits above this function; it does not need this function itself to
change.

### 19. Alternatives Considered — "Global (cross-Course) Today for V1 — Rejected for V1" (lines 77–84)

**SUPERSEDED BY GLOBAL TODAY**, with the same "pending ADR-016 acceptance"
caveat as §4. ADR-011's own rejection reasoning ("materially harder design
problem... not required for the first vertical slice") is a *scope*
argument, not a claim that cross-Course Today is architecturally
infeasible — and `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §3's findings
directly address that reasoning by showing the ranking/planning core does
not, in fact, need new interleaving logic to support a cross-Course pool.

---

## Net conclusion

Global Today **partially, not fully, supersedes ADR-011.** It supersedes:

- the product-level claim that Today is generated separately per Course
  with no combined view (§1, §4, §19 above);
- the "deferred beyond V1, not designed further" status of cross-Course
  Today itself (§4).

It does **not** supersede, and in fact continues to rely on:

- `TodaySession` keyed by `(user_id, course_id, planned_for_date)` as the
  persisted substrate for the Course Today *view* (§2, §6);
- `TodaySessionKey`'s current shape (§5);
- the freeze model (§12);
- the NBA/ranking/planning pipeline (§9, §13);
- `learningSessionId` derivation and idempotency identity (§16, §17),
  contingent on the (still undecided) persistence architecture preserving
  single-item identity across views.

Genuinely new work, not present in ADR-011 in any form: the first-open
cross-Course generation trigger (§11) and the unresolved
per-Course-vs.-Global session-completion question (§14) — both flagged
UNCLEAR/NEEDS AMENDMENT above and left open for `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
to either decide or explicitly defer, not silently assume.

## Related Documents

- `docs/DECISIONS/011-today-is-course-scoped-v1.md` (unmodified by this review)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
- `docs/GLOBAL_TODAY_DESIGN_DRAFT.md`
- `docs/GLOBAL_TODAY_PRODUCT_SPEC.md`
- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (this review's direct consumer)
- `docs/OPEN_QUESTIONS.md` (#33, #34)
- `docs/PERSISTENCE_SCHEMA_V1.md` (`today_sessions`, `today_session_items`)
- `docs/INVARIANT_MATRIX.md` (rows 18, 20 — TodaySession creation race /
  advisory-lock races; any new Global entity would face analogous open
  concurrency questions, per `docs/GLOBAL_TODAY_DESIGN_DRAFT.md` §7)
- `src/application/learning/ports.ts`, `today-session.ts`
- `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`, `today-planner.ts`

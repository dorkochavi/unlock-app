# UNLOCK — Open Questions

Status: Active decision queue

Purpose: track unresolved product, architecture, domain, data, analytics, security,
and calibration questions that are important enough that implementation should
not silently invent an answer.

This file contains ONLY unresolved questions.

Resolved durable decisions belong in:

* `docs/DECISIONS/`
* committed code and tests where they implement the accepted decision

Current-state summaries belong in:

* `docs/DEV_STATUS.md`

Optional feature-specific behavior contracts may document an accepted feature where useful, but they are not the canonical decision queue.

Historical investigation belongs in:

* Git history
* `docs/RUNS/`

Question IDs are stable.

Gaps in numbering are intentional because resolved questions are removed rather
than kept here as historical records.

---

## Status Meanings

### OPEN

A real decision is still required.

If implementation depends on it, do not invent the answer.

### DEFERRED

The question is real, but current V1 work does not require resolving it yet.

Do not pull it into scope unless the current Plan explicitly does so.

### CALIBRATION

A safe V1/default behavior exists, but real evidence is still required before
locking thresholds, weights, or numerical values.

Calibration questions should not block unrelated feature work.

---

# Learning Engine / Adaptive Learning

## OQ-002 — Effective Exam-Date Hierarchy

Status: OPEN

Decision needed:

What shared exam-date hierarchy should V1 support?

Minimum candidate:

personal exam date
→ course exam date
→ none

Possible future extension:

personal exam date
→ group exam date
→ course exam date
→ none

Current constraints:

- personal override must take precedence
- Groups are currently deferred
- the system must never invent an exam date
- exam urgency should amplify priority rather than replace the rest of the
  Learning Engine

Resolve before:

building a durable exam-date model or learner-facing exam scheduling behavior.

Current state (implementation history: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`): `courses.exam_date` is the only exam-date
source and already feeds the within-tier ranking amplifier (never eligibility/tier). No personal/group
override exists, so only the source hierarchy above remains open.

Date interpretation of the date-only `exam_date` is decided (former OQ-046, resolved 2026-10-03: learner-local calendar
date; recorded in `src/domain/learning/exam-urgency.ts` and `docs/DEV_STATUS.md`). This question stays focused on the
exam-date SOURCE hierarchy.

---

## OQ-008 — Learner-State Persistence Boundary

Status: OPEN

Decision needed:

Which derived learner-state values should be persisted versus recomputed?

Relevant categories include:

- per-question derived state
- aggregate learner state
- mastery summaries
- misconception summaries
- memory/scheduling state
- cached selection/ranking outputs

Current constraints:

- Attempts are immutable source evidence
- persisted derived state must remain reproducible from evidence where intended
- avoid multiple independent sources of truth
- avoid unnecessary recomputation at runtime
- avoid stale duplicated derived state

Resolve when:

introducing a new persisted learner-state aggregate or cache beyond the current
per-question / DailyPlan model.

---

## OQ-009 — Next Best Action Persistence

Status: DEFERRED

Decision needed:

Should Next Best Action remain purely a calculated ranking process, with only
selected DailyPlan outputs persisted, or should additional ranking decisions /
candidate evaluations also be persisted?

Potential reasons to persist more:

- auditability
- explainability
- engine evaluation
- offline analysis
- debugging ranking behavior

Potential reasons not to:

- data volume
- stale outputs
- complexity
- duplication of reproducible computation

Current V1 direction:

the selected DailyPlan is persisted; ordinary candidate/ranking computation does
not need to become a permanent event log merely for completeness.

Resolve before:

building detailed Learning Engine audit / experimentation infrastructure.

---

## OQ-010 — Engine Versioning Granularity

Status: OPEN

Decision needed:

What constitutes a new Learning Engine version?

Potential triggers:

- mastery formula change
- scheduler/rating mapping change
- misconception logic change
- ranking weights
- ranking tie-break behavior
- Today planner behavior
- evidence interpretation changes

Need to define whether one engine version covers:

- learner-state derivation
- scheduling
- Next Best Action
- Today planning

or whether these need separate version identities.

Current constraint:

historical behavior and rebuild semantics must remain interpretable.

Resolve before:

meaningful production changes to learning formulas after real learner data exists.

---

## OQ-011 — Mastery Internal Representation and Calibration

Status: CALIBRATION

Accepted learner-facing progression:

UNKNOWN
→ EMERGING
→ DEVELOPING
→ STRONG
→ MASTERED

Accepted principles:

- mastery is evidence-based
- mastery is cumulative
- one correct answer does not create mastery
- mastery is reversible
- MASTERED is not terminal
- later retrieval failure may reduce mastery
- unresolved lapse prevents strong mastery interpretation
- high-confidence wrong is stronger negative evidence than ordinary wrong

Current conservative starting defaults exist in the Learning Engine.

Still unresolved:

- whether the internal representation should remain purely categorical or become
  score-based / hybrid
- final production thresholds after real pilot evidence
- whether the initial conservative numeric defaults need recalibration

Do not treat current calibration values as immutable product invariants.

---

## OQ-012 — FSRS Evidence-to-Rating Mapping and Retention

Status: CALIBRATION

Scheduler family is already decided:

FSRS-family scheduler behind `MemoryScheduler`.

Still unresolved:

- exact mapping from UNLOCK evidence to FSRS rating
- desired retention configuration
- whether desired retention changes near an exam
- how confidence should influence scheduler rating
- how assistance should influence scheduler rating
- whether response time should influence scheduler rating at all

Constraint:

confidence and response time must not automatically become FSRS Hard/Easy
without an explicit, documented, tested policy.

Resolve through:

Learning Engine prototype/pilot calibration.

---

## OQ-044 — FSRS Short-Term Learning Steps Make a Once-Answered Question "Due" Within Minutes

Status: CALIBRATION

Status qualifier (moved from the Status line, verbatim): open, non-blocking; recorded 2026-09-26, Run UX-02 P0.7.

Observed with the real engine and production policies
(`docs/FEATURES/COURSE_TOPIC_PRACTICE_DESIGN.md` §3, finding F-B): with the current ts-fsrs adapter
(defaults, fuzz off), a Question's first clean correct answer schedules its next review minutes later
(short-term learning steps). It is then `REVIEW_DUE` in Next Best Action from that point on — e.g. a
Question answered once yesterday ranks as a due review with retrievability ≈ 1.0. This affects Today and
Practice equally.

Still unresolved:

- whether short-term learning steps should be enabled for UNLOCK's question-based evidence, and with
  which steps;
- whether a same-day learning-step review should count as `REVIEW_DUE` for NBA ranking, or only
  reviews whose retrievability has actually dropped;
- the interaction with OQ-012 (rating mapping, desired retention).

Characterized, not a defect (RUN010-C; details in `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`): the 1m/10m short-term
learning-step behavior is stock ts-fsrs default behavior (`enable_short_term: true`, `learning_steps: ["1m", "10m"]`, not
overridden by `ADAPTER_FSRS_PARAMETERS`), not a UNLOCK misconfiguration or bug; no scheduler-adapter change was made. Still
open: whether it is the right learner experience for UNLOCK's question-based evidence (unresolved items above).

Related residual (from archived FUB-039, RUN010-C audit; the freeze itself is an accepted, intentional invariant — at most
one scheduler-moving event per Question per day): a brand-new card touched only via same-day Practice reinforcement does not
leave the FSRS Learning state that day (bounded to one day). Re-check whether that interaction still applies, and is still
acceptable, when this question is calibrated.

Constraint:

Not solved in Run UX-02 unless implementation shows a correctness bug rather than a tuning issue.
Any change is a scheduler-adapter/policy change with an engine-version increment.

Resolve through:

Learning Engine calibration with pilot evidence.

---

## OQ-013 — Misconception Threshold Calibration

Status: CALIBRATION

Accepted state model:

NONE
→ SUSPECTED
→ ACTIVE
→ RESOLVED

Accepted principles:

- ordinary wrong contributes weakly
- high-confidence wrong contributes more strongly
- one ordinary wrong does not automatically create ACTIVE
- repeated evidence matters
- repeated misconception evidence across different questions is especially meaningful
- high-confidence wrong alone still does not automatically imply ACTIVE
- resolution requires repeated relevant success, not one correct answer

Still unresolved:

- exact scoring model
- threshold for SUSPECTED
- threshold for ACTIVE
- recovery/resolution thresholds
- weighting of repeated/cross-question evidence

Do not turn illustrative candidate numbers into permanent product rules without
pilot evidence.

---

## OQ-014 — Confidence Input Model

Status: OPEN

Current state (implementation history: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`): a basic production confidence capture
exists on Today and Practice: "sure" / "not sure" maps to `high` / `low`, and confidence stays `null` when the
learner does not touch it. The misconception high-confidence gate consumes it. This question does not expand
that influence.

Decision still needed:

- should confidence be requested on every answer, or only selectively (and when)?
- is the binary sure / not-sure interaction final, or should a richer scale exist?
- how should confidence affect evidence, misconception interpretation, and scheduling beyond the currently
  approved behavior?
- should collection or interpretation differ by future question type?

Constraint:

avoid introducing a precise-looking confidence scale whose meaning is not clear
to learners or the engine.

---

## OQ-015 — Response-Time Interpretation

Status: OPEN

Decision needed:

How should response time affect learning-state interpretation or priority?

Constraints:

- response time is a supporting signal
- it must not independently determine mastery
- network/UI delay must not be mistaken for cognitive response time
- different question types may have structurally different expected times

Need to define:

- when timing begins
- when timing stops
- treatment of background/tab inactivity
- normalization by question type/difficulty if any
- whether time influences evidence, ranking, analytics, or only diagnostics

---

## OQ-016 — DailyPlan Size Calibration

Status: CALIBRATION

Accepted direction:

- DailyPlan size is dynamic
- learning need drives size
- no fixed mandatory number every day
- no force-filling with weak items
- no automatic replacement after Skip
- the learner receives a real finish line

Current conservative working range has been discussed around:

- minimum useful plan near 5
- typical range near 8–12
- hard maximum near 15

Architecture is implemented (`computeTodayPlanBudget`, initial policy 5 / 8-12 / 15; history in
`docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`). Still open (CALIBRATION): the correct launch numeric values and exam-urgency
amplifier constants, after real learner/pilot evidence.

The architecture must not depend on these exact numbers being permanent.

---

## OQ-017 — Today Composition Calibration

Status: DEFERRED

Current V1 direction already favors ranked learning need rather than per-category
quotas.

New Material V1 is separately defined by ADR-017 as fallback-only when ordinary
candidates do not exist.

Still potentially unresolved for future iterations:

- whether category caps are ever needed
- whether misconception/repair work should have a maximum daily share
- how exam urgency should affect cross-category balance
- whether diagnostic sampling becomes an explicit category
- whether course diversity should ever affect composition
- how Topic diversity should interact with cross-Course pooling in the New Material fallback (added from archived FUB-040
  item 1): `discoverNewMaterialItems` (`src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`) pools each
  eligible Course's Topic-diversified candidates and re-sorts globally by `createdAt` only before taking the final top-3, so
  a Course's Topic-diversified order can be partially overridden when several Courses are simultaneously eligible; bounded
  edge case, and ADR-017 still forbids a per-Course fairness quota. The post-Run010 cold-start SQL audit (2026-10-03)
  confirmed this behavior is consistent with ADR-017 §4's literal order and no-quota rule; it remains an open balance question
- Topic-related New Material edge behaviors preserved as open policy (post-Run010 audit, 2026-10-03; no behavior change):
  questions in archived Topics remain eligible as New Material (and in the ordinary review path); questions with no Topic
  form their own bucket ordered last within the per-Course Topic round-robin; ADR-017 §4 does not record the Topic
  round-robin
- the escalation mechanism/thresholds by which severe Memory Need/overdue duration crosses a priority tier boundary
  (ADR-016 §10 accepts the requirement; numbers undecided; `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a; the unimplemented
  requirement itself is tracked in `docs/FOLLOW_UP_BACKLOG.md` FUB-034)

Do not introduce quota/fairness machinery without an explicit future decision.

---

## OQ-036 — Canonical Sources of Truth for Derived Values

Status: OPEN

Decision needed:

For every derived learning signal, what is canonical and what is reconstructable?

Current working model includes:

Attempts
→ immutable evidence

UserQuestionProgress
→ current per-question derived state

DailyPlan
→ persisted daily planning output

Need to define future treatment of:

- aggregate learner state
- course-level summaries
- analytics aggregates
- readiness metrics
- cached ranking results

Constraint:

the same current value should not gain multiple independent writable sources of
truth.

---

## OQ-037 — Recalculation Strategy After Engine Changes

Status: OPEN

Decision needed:

When Learning Engine formulas change, what happens to existing learner state?

Possible strategies:

- leave old state under old engine version until new evidence arrives
- rebuild fully from Attempts
- migrate selectively
- rebuild lazily/on demand
- scheduled background rebuild

Decision depends on:

- Attempt completeness
- engine versioning
- scale
- production traffic
- migration cost
- audit requirements

Resolve before:

changing important Learning Engine formulas after meaningful real learner data exists.

---

## OQ-048 — Answer-Submission Idempotency Identity vs. Server-Generated `answeredAt`

Status: OPEN

Moved from archived FUB-025 (found by the hosted Pre-Pilot S3 smoke test, 2026-09-24, and reproduced by the local burst
harness). Low urgency (originally Priority LOW); no data is at risk.

Current behavior: `answeredAt` is part of the canonical command identity compared for idempotent retries
(`CANONICAL_COMMAND_IDENTITY_FIELDS` in `src/application/learning/submit-answer.ts`; `docs/DECISIONS/010-answer-submission-transaction-model.md` "Idempotency"
states it is client-captured and that a retry must preserve it). The HTTP route `POST /api/daily-plan/items/:itemId/answer`
instead sets it to the server's own `new Date()` per request. For two requests carrying the SAME `submissionId`:

- a later, sequential retry finds the existing Attempt with a different `answeredAt` and returns
  `409 SUBMISSION_ID_REUSED` instead of the idempotent `200`;
- a truly concurrent duplicate loses the race, sees the already-resolved item (the pending check runs before the insert),
  and returns `409 ITEM_ALREADY_RESOLVED`.

Exactly one Attempt and one completed DailyPlanItem result either way. The current UI is unaffected (fresh
`submissionId` per click; 409 treated as "already resolved": `src/app/(learner)/today/page.tsx`). Practice inherits this
(`docs/FOLLOW_UP_BACKLOG.md` FUB-032; the Practice UI never reuses a submission id). The S3 burst harness accepts `200+200`
or `200+409` for a same-`submissionId` duplicate pair.

Decision needed:

- Should a server-generated `answeredAt` participate in the canonical idempotency identity at all (versus a client-captured
  `answeredAt` bound to the `submissionId`, as ADR-010 states)?
- Should a same-`submissionId` retry, sequential or concurrent, return the original result rather than a conflict?

Constraints:

- one logical submission -> at most one Attempt -> at most one DailyPlanItem resolution (strongest invariant)
- Attempts are immutable evidence; do not rewrite history
- any change touches the Attempt/idempotency contract (ADR-010 amendment if accepted) and needs DB and general review
- implementation candidates, not decisions: exclude a server-derived `answeredAt` from the identity comparison, and/or
  re-check the submission id after acquiring the per-learner lock so a concurrent duplicate returns the existing result

Resolve before:

a real client needs same-`submissionId` retry (flaky-network resubmit, mobile offline queue), pilot evidence shows
duplicate-submit 409s confusing learners, or any change to answer-submission semantics.

---

# Today UX / Product Analytics

## OQ-018 — Learner-Facing Selection Explainability

Status: DEFERRED

Current state (history: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`): partially implemented. Honest labels exist for
`REVIEW_DUE`, `RELEARN_LAPSE`, `REPAIR_MISCONCEPTION`, and `NEW_LEARNING`. Still the human product
owner's call; narrowed to what is not yet decided (source: archived FUB-040 items 2-3, RUN010-E):

- `STRENGTHEN_MEMORY` learner-facing wording: it is a positive-progress, not-yet-mastered state that honestly fits none of
  the six candidate strings below (reusing "weak area" would conflate it with a genuinely weak state); its pre-existing
  shipped label ("חיזוק זיכרון") was left unchanged (`src/messages/he.ts`);
- whether and how "exam approaching" becomes a learner-facing reason: there is no per-item persisted signal today (the
  exam-urgency amplifier is a continuous within-tier multiplier, not a fact recorded on a `DailyPlanItem`), so labeling an
  item would need a threshold decision on when urgency is "high enough" to say so;
- whether internal reason/action codes belong at the API boundary: `GET /api/daily-plan/today` still serializes raw
  `tier`/`reasons`/`otherApplicableTypes`/`actionType` strings (`src/app/api/daily-plan/today/daily-plan-dto.ts`), a
  pre-existing deliberate "real domain fields only" design, although the UI renders only mapped honest labels. Whether that is
  acceptable depends on reading "avoid exposing internal scores" narrowly (UI only) or broadly (visible in DevTools);
  tightening the DTO would be an API-contract change;
- how much explanation to show, and when.

Decision needed:

What reason, if any, should the learner see for why a Today item was selected?

Possible learner-facing reasons:

- review due
- repeated mistake
- weak area
- exam approaching
- not enough evidence
- new material

Constraints:

- avoid exposing internal scores
- avoid pretending certainty
- avoid cluttering every question
- explanations should correspond to real persisted/planning reasons

Resolve during:

Today UX refinement after the core flow is validated.

---

## OQ-019 — Session Abandonment Definition

Status: OPEN

Decision needed:

What exactly counts as an abandoned Today session for analytics?

Possible definitions:

- explicit exit
- DailyPlan remains incomplete after local-day boundary
- learner starts but answers nothing
- inactivity threshold
- some minimum interaction followed by no completion

This is an analytics definition.

It must not silently change DailyPlan product semantics.

Resolve before:

shipping abandonment analytics or using abandonment as a KPI.

---

## OQ-020 — Active User KPI Denominator

Status: OPEN

Candidate primary KPI:

percentage of active users completing Today on at least 3 separate days within a week.

Decision needed:

What counts as an active user for the denominator?

Candidates:

- signed in during the week
- opened the app
- opened Today
- had an active LEARNER membership
- had eligible learning content
- started at least one DailyPlan

Constraint:

avoid selecting a denominator that artificially improves or worsens product
performance.

Resolve before:

formal pilot KPI reporting.

---

## OQ-021 — KPI Week Boundary

Status: OPEN

Decision needed:

How is a KPI week defined?

Candidate approaches:

- Monday–Sunday in learner-local time
- rolling 7-day window

Need consistency across:

- Today completion analytics
- retention reporting
- cohort comparisons

Resolve before:

formal weekly KPI dashboards/reporting.

---

## OQ-022 — New-Material / Starter Days in Today KPI

Status: OPEN

Decision needed:

Does a DailyPlan consisting primarily or entirely of New Material count the same
as an ordinary review-driven Today completion for the recurring-learning KPI?

Possible rationale for inclusion:

it is still deliberate learning through the same DailyPlan loop.

Possible rationale for separate analysis:

early calibration/new-material behavior may not represent mature adaptive
learning behavior.

Resolve before:

formal KPI interpretation.

---

## OQ-029 — Minimal Learner Progress Experience

Status: DEFERRED

Simple read-only Topic-state Progress (qualitative states, coverage context, path back to Today) is already delivered
(current capability: `docs/DEV_STATUS.md`; ADR-018; history: `docs/RUNS/2026-09-25-009.md`) and is not reopened here.

Decision needed:

Beyond the delivered simple Topic-state Progress, what further learner-facing
progress elements, if any, are useful once real pilot behavior is observed?

Potential elements:

- Today completion history
- recent learning days
- due-review outlook
- improving areas
- weak areas
- simple Course progress

Constraint:

do not build a complex dashboard before validating the adaptive learning loop.

---

## OQ-030 — Exam Readiness

Status: DEFERRED

Decision needed:

Should learner-facing exam readiness exist in early V1?

If yes:

- what evidence threshold is required
- how uncertainty is represented
- what is learner-facing
- what stays internal
- whether readiness is per Course/topic/question set

Constraint:

no precise readiness percentage without sufficient evidence.

---

# Content / Course Model / Pilot

## OQ-023 — Minimal Material Model

Status: OPEN

Decision needed:

What is the minimum durable Material model required for V1?

Potential fields:

- Course
- title
- type
- source/origin
- text/file reference
- created by
- timestamps

Constraint:

Material must not imply that PDF parsing, RAG, embeddings, or AI ingestion are
required for the first usable learning loop.

Resolve before:

building a durable content-ingestion/material-management feature.

---

## OQ-024 — Content Entry for the First Real Pilot

Status: OPEN

Already available (`docs/DEV_STATUS.md` Current Product Capabilities; not a candidate any more): instructor-authored
Questions (draft save, explicit publish) and Structured Import V1 (JSON/CSV preview/confirm into DRAFT_ONLY Questions; no
XLSX/PDF). `docs/UNLOCK_CAPABILITY_MAP.md` still lists the exact entry route for real Ruppin material as open under this
question.

Decision needed:

What route should real source material take into UNLOCK for the first real class/pilot, given the instructor-authoring
and Structured Import paths that already exist?

Candidate directions (none is required or ruled out):

- use the existing instructor authoring and Structured Import paths only
- introduce a future Material / file-PDF ingestion path (related: OQ-023 Material model)
- AI-assisted generation with review (related: OQ-038; assessment questions and AI-resolved correct answers already require
  human approval per `docs/MASTER_SPEC.md` §47)

Decision should optimize for:

- pilot speed
- content quality
- repeatability
- minimal engineering distraction
- realistic product validation

Do not build a broad CMS merely to seed the pilot.

---

## OQ-031 — Course Structure Depth

Status: DEFERRED

Flat, Course-scoped Topics are implemented and their V1 semantics (including current, non-versioned Topic assignment) are
owned by `docs/DECISIONS/018-topic-model-v1.md` (ADR-018). What remains deferred here is only hierarchy/Unit structure and
immutable historical Topic attribution.

Decision still needed (not required by current V1 work):

Does UNLOCK need Topic hierarchy / Unit structure beyond flat Topics, or
immutable historical Topic attribution?

Tradeoffs include:

- schema complexity
- coverage measurement
- New Material ordering
- analytics and trend history
- exam relevance
- instructor organization
- future readiness reporting

Resolve before:

features requiring hierarchical topic/unit reasoning or historical/trend
analytics that need immutable Topic attribution.

---

## OQ-038 — Human Approval for AI-Generated Content

Status: DEFERRED

Decision needed:

Which AI-generated content requires human approval before learner use?

Accepted constraint (`docs/MASTER_SPEC.md` §47, decided 2026-09-26): AI-generated assessment questions and AI-resolved
correct answers always require instructor/human approval before publish. Active decision: only the remaining content
kinds below, whose approval rules are unresolved.

Potential distinctions:

- low-stakes practice
- instructor-controlled Course content
- exam preparation
- weak-source-confidence generation
- automatic distractor generation
- explanation generation

Constraint:

AI is not the real-time Learning Engine.

This question concerns content production/governance, not deterministic learner
state.

## OQ-050 — Learning Objectives and Assessment Blueprint: Candidate Human Decisions

Status: OPEN (grouped entry; each row is an independent unresolved sub-question)

Source: `docs/ASSESSMENT_BLUEPRINT_V0_1.md` Parts 1.7 and 2.8 (design only; nothing persisted; ledger AE-045, AE-011, AE-028 in `docs/ASSESSMENT_ENGINE.md`). Implementation must not invent these answers (`.claude/rules/auth.md`, Section 4 of `CLAUDE.md`).

| # | Sub-question | Notes |
|---|---|---|
| a | Cognitive taxonomy (revised Bloom vs SOLO vs Webb DOK; closed vocabulary or free label) | AE-007; blueprint dimension stays OUT until chosen |
| b | Intended-difficulty vocabulary (enum vs numeric band; on LO, Question or both) | Intended, never observed; independent of FSRS |
| c | Question->LO association: mutable authoring link vs snapshotted per immutable QuestionVersion | Historical-coverage reporting depends on it |
| d | Cross-topic LOs: strict one Topic per LO vs multi-Topic later | v0.1 design decides one required Topic |
| e | Persistence shape: table vs embedded metadata, join table, FK/archive semantics, backfill (existing questions have zero LOs); blueprint table vs JSON, cardinality per Course, archived LO referenced by a cell | Relates to OQ-023, AE-006 |
| f | Authoring roles and reuse: who authors LOs and blueprints (default `canAuthorCourse`); per-Course only or reusable across Courses | Fail closed until decided |
| g | Structured Import support: may import reference/create LOs; unresolved-name behavior | Mirror Topic name resolution or not |
| h | Mandatory for publish: whether LO becomes required (v0.1: optional, `OBJECTIVE_MISSING` is a warning) | |
| i | Blueprint mutability: mutable plan vs snapshot when a set is checked against it | |
| j | Default quick blueprint for short quizzes, and whether code may generate any default | AE 13.3 |
| k | Multi-objective questions: discount in planning or assume one objective per question | Prototype counts once toward each objective |
| l | Precedence of blueprint `max` vs lint default `TOPIC_CONCENTRATION` (> 40%) and handling of archived LOs in cells | Wiring decision |
| m | Comparison set scope: which questions are compared (course, topic, draft batch); whether archived/unpublished count | |

Resolve before:

any persistence, authoring UI, import, or lint wiring for Learning Objectives or Blueprints.

---

# Platform / Data Lifecycle

## OQ-025 — RLS and Storage Strategy for V1

Status: OPEN

PostgreSQL via Supabase is already decided.

Supabase Auth is already implemented.

The remaining platform questions are narrower:

### RLS

- which direct-client table access, if any, should exist
- which tables should remain server-only
- what real production RLS policies are required
- whether API-server authorization remains the primary access layer for V1

### Storage

- whether Supabase Storage is needed at all in the first pilot
- which future Material types require object/file storage
- ownership/access model for uploaded files

Do not create permissive placeholder policies.

Resolve RLS before enabling direct client access to protected application tables.

Resolve Storage when file-based Material becomes real scope.

---

## OQ-026 — Analytics Provider / Event Store

Status: OPEN

Decision needed:

How should core product events be captured?

Candidates:

- application-owned analytics/event table
- lightweight external analytics provider
- Vercel-compatible analytics
- hybrid

Need to support important product questions without adding an oversized
analytics stack.

Resolve before:

formal pilot analytics implementation.

---

## OQ-027 — Data Deletion Semantics

Status: OPEN

Decision needed:

What happens to historical data when:

- a User deletes an account
- a Course is deleted
- Material is removed
- a Question is retired
- a CourseMembership is removed/revoked

Need to balance:

- privacy
- regulatory obligations
- historical integrity
- auditability
- learning-evidence consistency
- referential integrity

Resolve before:

building destructive account/content deletion flows.

---

## OQ-028 — Question Retirement vs Deletion

Status: OPEN

Decision needed:

Should Questions that have learner evidence ever be physically deleted?

Likely requirement:

historical Attempts must remain interpretable.

Potential direction:

retire/archive learner-used Questions while reserving hard deletion for unused
or legally-required cases.

This is not yet locked as a product/data-lifecycle decision.

Resolve before:

building question deletion/retirement UI or APIs.

---

# Course Membership Edge Cases

## OQ-043 — Course Membership Revocation / Rejoin Semantics

Status: OPEN

ADR-015 defines the main membership/authorization model. This question owns learner `course_memberships` lifecycle only:
after Run 010 H.3, `course_memberships` is LEARNER-only and management capability lives in `course_authors` (OWNER /
INSTRUCTOR; `docs/DEV_STATUS.md` Current Product Capabilities). CourseAuthor grant lifecycle is a separate question (OQ-047).

Two edge cases remain intentionally unresolved here (B moved, see below).

### A. Rejoin after revoke

Current behavior fails closed.

A previously revoked membership is not silently reactivated when the learner
tries to self-join an OPEN Course again.

Decision needed:

- can revoked learners ever self-rejoin an OPEN Course?
- management-only reactivation?
- new membership lifecycle vs reactivating the existing row?
- what response/outcome should the UI receive?

### B. Last management member — moved to OQ-047

The core question (may the last active author revoke themselves and leave zero?) was answered by the product owner in
Run 010 (2026-09-29: `revokeCourseAuthor` fails closed with `LAST_AUTHOR`; Run 010 report §4) and concerns `course_authors`,
not learner memberships. The unresolved residue (what counts as an active manager, OWNER/INSTRUCTOR equivalence,
ownership-transfer expectations) is carried in OQ-047. Letters are kept stable for existing references.

### C. Repeated revoke/archive timestamps

Current behavior does not establish a permanent audit guarantee that the first
timestamp always wins.

Decision needed:

Should repeated revoke/archive operations:

- preserve the original timestamp
- update to the latest timestamp
- become explicit lifecycle/audit events

Current code should continue failing closed and must not invent new access-
granting behavior until this question is resolved.

---

## OQ-047 — CourseAuthor Grant Lifecycle (Re-grant / Reactivation)

Status: OPEN

Distinct from OQ-043 (learner `course_memberships` revoke/rejoin): `course_authors` is the management-capability table
added in Run 010 H.1 (`docs/DEV_STATUS.md`), with its own revoke semantics. Source: post-Run010 review finding, formerly
`docs/FOLLOW_UP_BACKLOG.md` FUB-042 item 4 (that item number is kept as a pointer).

Current behavior: `course_authors` has `unique(user_id, course_id, capability)`, and the grant path is
`INSERT ... ON CONFLICT DO NOTHING` (`src/infrastructure/postgres/course-author-repository.ts`), so re-granting a previously
revoked author may return or keep the revoked row rather than reactivating it. No co-author-management UI or grant endpoint
exists, so nothing is exposed today.

Decision needed:

- Should re-granting a revoked author reactivate the existing grant (clearing its revocation), create a new lifecycle
  record, or be rejected?
- How is revoke history preserved under the chosen model?
- What should `grant()` return when a revoked tuple exists (the existing revoked row, a new active grant, or an explicit
  outcome)?

Also carried from OQ-043 B (not decided here): what counts as an active manager for last-author protection (the current
implementation treats every active OWNER or INSTRUCTOR `course_authors` row on the Course as an active author grant for
last-author protection), whether OWNER and
INSTRUCTOR are equivalent for that rule, and ownership-transfer expectations. The technical check-then-write race in that
protection was hardened 2026-10-03 (`docs/FOLLOW_UP_BACKLOG.md` FUB-042 item 1, closed; residuals in item 7).

Constraints:

- unresolved authorization semantics fail closed and must not be invented by implementation (`.claude/rules/auth.md`)

Resolve before:

any co-author-management UI or grant endpoint (FUB-042 item 3; `docs/DEV_STATUS.md` "Release State / Open Items", author re-grant bullet).

---

# Decision Queue Discipline

A question belongs in this file only if it materially affects:

- product behavior
- Learning Engine behavior
- architecture
- security/authorization
- data integrity
- analytics interpretation
- durable V1 scope
- calibration that requires explicit evidence

Do NOT use this file for:

- ordinary bugs
- refactoring opportunities
- technical debt lists
- implementation TODOs
- reviewer suggestions
- historical investigation
- already-decided behavior
- current development status

When Claude encounters an unresolved decision during implementation:

1. inspect the current Plan
2. inspect the relevant accepted ADR
3. inspect the narrowest relevant canonical product/domain document
4. inspect this file
5. if behavior is still unresolved, report `DECISION_REQUIRED`
6. do not silently invent the product decision

Claude should not automatically add every discovery to this file.

Adding or materially rewriting an Open Question should be explicitly authorized
by the current Plan or user.
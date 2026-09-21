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

Decision needed:

What confidence interaction should the learner experience in V1?

Need to define:

- scale
- labels
- whether confidence is requested on every answer
- whether it is optional
- when it is collected
- whether collection differs by question type
- how it affects evidence
- how it affects misconception interpretation
- whether it affects scheduling

Possible representations include:

- low / medium / high
- sure / unsure
- numeric scale

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

Still unresolved:

whether those are the correct launch values after real learner/pilot evidence.

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

# Today UX / Product Analytics

## OQ-018 — Learner-Facing Selection Explainability

Status: DEFERRED

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

Decision needed:

What is the smallest useful learner-facing progress experience after the core
Today loop is validated?

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

Decision needed:

How should Questions and Materials enter UNLOCK for the first real class/pilot?

Candidate approaches:

- manually seeded content
- CSV/JSON import
- minimal admin form
- instructor-authored content
- AI-assisted generation with review

Decision should optimize for:

- pilot speed
- content quality
- repeatability
- minimal engineering distraction
- realistic product validation

Do not build a broad CMS merely to seed the pilot.

---

## OQ-031 — Course Structure Depth

Status: OPEN

Decision needed:

Does V1 need formal Topic / Unit entities?

Alternative:

Questions initially attach directly to Course/Material and deeper structure is
added later.

Tradeoffs include:

- schema simplicity
- coverage measurement
- New Material ordering
- analytics
- exam relevance
- instructor organization
- future readiness reporting

Resolve before:

features requiring reliable topic/unit-level reasoning.

---

## OQ-038 — Human Approval for AI-Generated Content

Status: DEFERRED

Decision needed:

Which AI-generated content requires human approval before learner use?

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

---

## OQ-039 — Pilot Content / Data Ownership

Status: OPEN

Decision needed:

For instructor/class pilots, who owns or controls:

- uploaded Materials
- authored/generated Questions
- edits
- learner Attempts
- aggregate class insights
- exports
- deletion requests

This should be resolved before institutional/instructor workflows become
meaningful product commitments.

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

ADR-015 defines the main membership/authorization model.

Three edge cases remain intentionally unresolved.

### A. Rejoin after revoke

Current behavior fails closed.

A previously revoked membership is not silently reactivated when the learner
tries to self-join an OPEN Course again.

Decision needed:

- can revoked learners ever self-rejoin an OPEN Course?
- management-only reactivation?
- new membership lifecycle vs reactivating the existing row?
- what response/outcome should the UI receive?

### B. Last management member

Decision needed:

Should the last active OWNER/INSTRUCTOR be allowed to revoke their own management
membership and leave a Course with zero management members?

If prevented, define:

- what counts as an active manager
- whether OWNER and INSTRUCTOR are equivalent for this rule
- ownership-transfer expectations

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
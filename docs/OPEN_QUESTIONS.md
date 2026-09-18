# UNLOCK Open Questions

Status: Active decision queue

Purpose: track unresolved product, domain, data, and implementation questions that are important enough to affect behavior, architecture, data integrity, analytics, or scope.

This file exists to prevent the project from silently inventing answers during implementation.

An open question should remain here until it is:

- resolved;
- intentionally deferred;
- converted into an ADR;
- absorbed into a feature contract;
- rendered irrelevant by a later decision.

---

## 1. User ↔ Course Relationship in V1

Question:

How should a learner be related to a Course in V1?

Possible directions (historical — see Status below):

- direct ownership;
- direct membership/access record;
- lightweight Enrollment;
- fuller Enrollment model.

Current constraint:

Do not build institutional complexity merely to support this relationship.

Decision should support:

- learner access;
- future multi-user Course scenarios;
- clear authorization;
- simple V1 implementation.

Status: **DECIDED — see `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`.**
V1 uses an explicit `CourseMembership` relationship (`userId`, `courseId`,
`role`, `joinedAt`, `revokedAt`, `archivedAt`) with three roles (`OWNER`,
`INSTRUCTOR`, `LEARNER`) and a per-Course join policy (`AUTHORIZED_ONLY`
default, `OPEN` settable only by a management role). QR/link is never
authorization by itself. Institution/enrollment-provisioning remains
architecture-ready, not built now (ADR-006 unaffected). The exact
authorization source for `AUTHORIZED_ONLY` Courses, lecturer-vs-institution
content ownership, and the real persistence/RLS implementation remain
separately open — see ADR-015's own "Explicitly deferred" section.

Target phase: Domain Contracts / Database Design

---

## 2. Effective V1 Exam-Date Hierarchy

Question:

What shared exam-date concept should V1 actually support?

Possible options:

```text
personal_exam_date
>
course_exam_date
>
null
```

or later:

```text
personal_exam_date
>
group_exam_date
>
course_exam_date
>
null
```

Current concern:

Groups are deferred, so a group-level date may unnecessarily complicate V1.

Constraint:

A personal override must take precedence.

The system must never invent an exam date.

Status: OPEN

Target phase: Domain Contracts

---

## 3. Today Session Boundary

Question:

What exactly defines the validity period of a Today Session?

Examples that require a decision:

- local calendar day;
- rolling 24-hour period;
- learner-defined study day;
- special behavior after midnight;
- unfinished session from the previous day.

Required behavior:

A learner returning later during the valid period should resume the same session.

Do not silently regenerate an active Today Session.

Status: OPEN

Target phase: Today Feature Contract

---

## 4. Starter Experience Eligibility

Question:

How does UNLOCK decide that a learner needs Starter instead of normal Today?

Potential evidence thresholds may involve:

- number of Attempts;
- number of Questions sampled;
- Course coverage;
- existence of reliable UserQuestionProgress.

Need to define:

- entry condition;
- exit condition;
- re-entry behavior if needed;
- insufficient-content behavior.

Status: OPEN. Note: `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016 §13, ACCEPTED) resolved the *framing* question of whether New
Material Exposure and Starter Experience are one mechanism family or two —
they are one family, Exposure is an extension of Starter. That does **not**
decide this question's actual eligibility thresholds; this remains OPEN.

Target phase: Starter Feature Contract

---

## 5. Starter Sampling Strategy

Question:

How should initial Questions be selected for a new learner?

Potential considerations:

- broad Course coverage;
- random or deterministic sampling;
- difficulty spread;
- topic balance;
- known source quality;
- exam relevance.

Constraint:

Do not pretend adaptive personalization exists before evidence is collected.

Status: OPEN. Note: ADR-016 §13 (ACCEPTED) frames this sampling question as
applying to the broader Starter/New-Material-Exposure mechanism family, not
only Course-level Starter — the sampling strategy itself remains
undecided.

Target phase: Starter Feature Contract

---

## 6. Question Editing and Historical Attempts

Question:

What happens when a Question changes after learners have already answered it?

Possible strategies:

- immutable Question versions;
- Question snapshot stored on Attempt;
- revision records;
- restrict certain edits after usage.

Need to preserve the meaning of historical Attempts.

Example risk:

An old Attempt should not suddenly appear to reference different wording or a different correct answer because the shared Question was edited later.

Status: OPEN

Target phase: Database Design

---

## 7. Question Version Reference

Question:

If Question versioning is used, what exactly should Attempt reference?

Possible directions:

- `question_id` + `question_version_id`;
- immutable version entity;
- embedded snapshot fields;
- hybrid approach.

Decision should balance:

- historical integrity;
- schema simplicity;
- auditability;
- future content correction.

Status: OPEN

Target phase: Database Design

---

## 8. Learner State Persistence

Question:

Which learner-state values should be persisted versus calculated on demand?

Possible categories:

- UserQuestionProgress persisted;
- aggregate Learner State persisted;
- Next Best Action calculated on demand;
- selected summary values cached.

Need to consider:

- reproducibility;
- performance;
- stale derived state;
- implementation simplicity.

Status: OPEN

Target phase: Database Design / Learning Engine

---

## 9. Next Best Action Persistence

Question:

Should Next Best Action exist only as a calculated ranking result, or should selected outputs be persisted?

Potential reasons to persist:

- auditability;
- explainability;
- Today generation history;
- engine evaluation.

Potential reasons not to persist every ranking:

- unnecessary data volume;
- stale results;
- increased complexity.

Status: OPEN

Target phase: Learning Engine / Today Design

---

## 10. Engine Versioning Granularity

Question:

What requires a new Learning Engine version?

Possible triggers:

- mastery formula change;
- review scheduling change;
- misconception logic change;
- ranking weights change;
- tie-break change.

Need to define whether versioning applies to:

- Learner State;
- Next Best Action;
- Today planner;
- all of the above.

Status: OPEN

Target phase: Learning Engine V1

---

## 11. Mastery Scale

Question:

What is the canonical V1 representation of `mastery_level`?

Possible representations:

- discrete enum;
- integer band;
- decimal score;
- hybrid internal score + learner-facing category.

Constraint:

Avoid false precision.

Status: OPEN pending prototype audit

Target phase: Prototype Learning Audit / Learning Engine

---

## 12. Review Scheduling Rule

Decided:

UNLOCK V1 uses an FSRS-family scheduler as the memory-scheduling implementation for `next_review_date`, behind the internal `MemoryScheduler` interface. See `docs/DECISIONS/008-fsrs-memory-scheduler.md` and `docs/LEARNING_ENGINE.md` §12–§15. The scheduler-family choice itself is no longer open.

Still open:

- the exact mapping from UNLOCK evidence (correctness, confidence, response time, assistance) to FSRS ratings;
- desired retention configuration;
- whether/how desired retention changes near an exam date.

Response time and confidence must not be automatically mapped to FSRS Hard/Easy ratings without a separate, explicitly documented and tested decision.

Status: OPEN — scheduler family DECIDED (ADR-008); evidence→rating mapping and retention configuration remain open

Target phase: Learning Engine V1 (MemoryScheduler adapter)

---

## 13. Misconception Rule

Question:

What exact behavior increments, reduces, resets, or otherwise changes `misconception_hits`?

Potentially relevant evidence:

- repeated incorrect answers;
- high-confidence incorrect answers;
- recurrence after prior correction.

Status: OPEN pending prototype audit

Target phase: Prototype Learning Audit / Learning Engine

---

## 14. Confidence Scale and Role

Question:

What confidence scale should V1 use?

Possible examples:

- low / medium / high;
- numeric range;
- binary sure/unsure.

Need to define:

- how learner supplies confidence;
- how it affects progress;
- when confidence is optional;
- whether confidence is stored on every Attempt.

Status: OPEN

Target phase: Prototype Audit / Quiz Contract

---

## 15. Response-Time Interpretation

Question:

How should `average_time_seconds` influence learner state or priority?

Constraints:

- response time is a supporting signal;
- it must not independently determine mastery;
- device/network/UI delays should not be confused with cognitive response time.

Status: OPEN

Target phase: Prototype Audit / Learning Engine

---

## 16. Today Session Size

Question:

How many learning items should a normal Today Session contain?

Possible strategies:

- fixed number;
- target duration;
- adaptive size;
- learner-selected duration.

Need to balance:

- completion likelihood;
- useful learning volume;
- product habit;
- pilot constraints.

Status: OPEN

Target phase: Today Feature Contract

---

## 17. Today Composition

Question:

How should Today balance categories such as:

- due review;
- weak Questions;
- misconceptions;
- exam-priority content;
- new/unseen content;
- diagnostic sampling.

Need to define whether composition is:

- purely rank-based;
- quota-based;
- hybrid.

Status: OPEN

Target phase: Next Best Action / Today Feature Contract

---

## 18. Explainability of Selection

Question:

What explanation should the learner see for why an item was selected?

Possible examples:

- review due;
- repeated mistake;
- exam approaching;
- weak area;
- not enough evidence yet.

Need to avoid:

- exposing confusing internal scores;
- overexplaining every item;
- implying certainty that does not exist.

Status: OPEN

Target phase: Today UX

---

## 19. Session Abandonment Definition

Question:

What exactly counts as `session_abandoned`?

Possibilities:

- user explicitly exits;
- session remains incomplete past boundary;
- user starts but never answers;
- inactivity timeout.

This affects analytics interpretation.

Status: OPEN

Target phase: Today Analytics Contract

---

## 20. Active User KPI Denominator

Primary KPI:

> Percentage of active users completing Today on at least 3 separate days within a week.

Question:

What exactly counts as an active user?

Possible definitions:

- opened app during week;
- opened Today;
- had eligible content;
- started at least one session;
- signed in and had an active Course.

Need to avoid a denominator that distorts product performance.

Status: OPEN

Target phase: Analytics Review, before formal KPI reporting

---

## 21. Week Boundary for KPI

Question:

How should a week be defined?

Possible directions:

- Monday–Sunday in learner local time;
- rolling 7-day window.

Need consistency across analytics.

Status: OPEN

Target phase: Analytics Review

---

## 22. Starter Sessions in KPI

Question:

Do Starter completions count toward the "Today completed on 3 separate days/week" KPI?

Possible rationale for exclusion:

Starter is calibration, not mature Today behavior.

Possible rationale for inclusion:

It is still intentional repeated learning.

Status: OPEN

Target phase: Analytics Review

---

## 23. Minimal Material Model

Question:

What is the minimum Material model required for V1?

Potential fields:

- Course;
- title;
- type;
- source/origin;
- text/file reference;
- created by;
- timestamps.

Constraint:

V1 Material must not imply that PDF parsing, RAG, embeddings, or AI ingestion are required for the first loop.

Status: OPEN

Target phase: Database Design

---

## 24. Content Entry for First Pilot

Question:

How will Questions and Materials enter the system during the first usable pilot?

Possible options:

- manually seeded;
- CSV/JSON import;
- simple admin form;
- learner-created;
- AI-assisted generation.

Need to choose the simplest path that does not distort the product validation.

Status: OPEN

Target phase: Pilot Planning / Content Setup

---

## 25. Supabase Final Confirmation

Question:

Should the project proceed with Supabase for:

- PostgreSQL;
- Auth;
- RLS;
- storage where needed?

**Database/PostgreSQL: DECIDED — see `docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`.**
UNLOCK V1 uses PostgreSQL via Supabase; the first migration is
`supabase/migrations/20260917203000_initial_schema.sql`.

**Auth / RLS / storage: still OPEN**, not overstated by ADR-013. RLS is
enabled on every V1 table with zero policies (safe deny-by-default), but
real policies, Supabase Auth wiring, and storage remain undecided pending
`docs/OPEN_QUESTIONS.md` #1 (User↔Course authorization model).

Status: PARTIALLY RESOLVED (database/provider decided; Auth/RLS/storage open)

Target phase: Before Database/Auth Foundation

---

## 26. Analytics Provider

Question:

What implementation should capture core product events?

Possibilities:

- application-owned event table;
- lightweight analytics provider;
- Vercel-compatible analytics tool;
- hybrid.

Constraint:

Core events should be capturable when Today ships, but the project should not add an oversized analytics stack.

Status: OPEN

Target phase: Today implementation

---

## 27. Data Deletion Semantics

Question:

What should happen to learner data if:

- a Course is deleted;
- a User deletes an account;
- Material is removed;
- a Question is retired.

Need to protect:

- privacy;
- historical integrity;
- referential consistency.

Status: OPEN

Target phase: Database Design

---

## 28. Question Retirement vs Deletion

Question:

Should learner-used Questions be deleted or retired/archived?

Likely need:

Historical Attempts must remain interpretable.

Status: OPEN

Target phase: Database Design

---

## 29. Basic Progress Definition

Question:

What is the smallest useful V1 progress experience?

Potential elements:

- Today completion;
- number of recent learning days;
- upcoming review;
- improving/weak areas;
- simple Course progress.

Constraint:

Do not create a complex dashboard before the core loop is proven.

Status: OPEN

Target phase: Basic Progress Feature Contract

---

## 30. Exam Readiness

Question:

Should exam readiness exist in initial V1 at all?

If yes:

- what evidence threshold is required?
- how is uncertainty represented?
- what is learner-facing?
- what is internal only?

Constraint:

No precise readiness percentage without sufficient evidence.

Status: OPEN

Target phase: After core adaptive loop

---

## 31. Course Structure Depth

Question:

Does V1 require formal Topic / Unit entities, or can Questions initially attach directly to Course/Material with structure added later?

Need to balance:

- simple schema;
- useful coverage;
- future analytics;
- Starter sampling;
- exam relevance.

Status: OPEN

Target phase: Domain Contracts / Database Design

---

## 32. Manual Practice Outside Today

Question:

Should V1 support learner-initiated manual practice outside Today?

Potential benefit:

Learner control.

Potential risk:

Distracts from validating Today as the primary recurring experience.

If supported, manual practice must still create valid Attempts and update learner state consistently.

Status: OPEN

Target phase: Product Contract after core loop

---

## 33. Multiple Active Courses

Question:

Can a learner have multiple active Courses in V1?

If yes:

- does Today combine them?
- is Today Course-specific?
- how does priority work across Courses?
- how do exam dates compete?

Simpler V1 may initially focus on one selected Course at a time.

Status: OPEN

Target phase: Domain Contracts

---

## 34. Today Scope Across Courses

Question:

Is Today:

- global across the learner's active Courses;
- tied to one selected Course;
- generated separately per Course?

This decision affects:

- UI;
- ranking;
- session model;
- KPI interpretation.

Status: RESOLVED — see
`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
(ADR-016, ACCEPTED), superseding the ADR-011 answer below at the target-
architecture level.

**Current accepted answer (ADR-016):** Today is global at the persistence
level — one `DailyPlan` per learner per local day, composed of
`DailyPlanItem`s. Course Today and Global Today are *views* over that one
plan (Course Today filters by `courseId`); they are not independently
generated. This also resolves the UI-treatment and KPI-interpretation
questions this entry previously left open: completing an item through
either view resolves the same underlying item (no per-view state to
reconcile), and one `DailyPlan` counts once toward the primary
Today-completion KPI regardless of which view(s) resolved it (ADR-016 §21,
§22).

**Not yet implemented.** No migration exists for `DailyPlan`/
`DailyPlanItem`. `today_sessions`/`today_session_items`, keyed by
`(user_id, course_id, planned_for_date)` per ADR-011, remain the actually
implemented V1 schema today.

**Historical V1 answer (ADR-011, now superseded as target architecture,
still describes the implemented schema):** generated separately per
Course. `TodaySession` is keyed by `(user_id, course_id, planned_for_date)`;
a learner with multiple active Courses may have multiple Today sessions on
the same date.

Target phase: Today Feature Contract (implementation, per
`docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`)

---

## 35. Learner Time Zone

Question:

How should learner timezone be determined for:

- Today session boundaries;
- review dates;
- weekly KPI;
- exam urgency.

Possibilities:

- account setting;
- browser-derived timezone;
- fixed pilot timezone;
- stored IANA timezone.

Status: OPEN

Target phase: Today / Database Design

---

## 36. Source of Truth for Derived Values

Question:

For each derived signal, what is the source of truth?

Examples:

```text
Attempts → source evidence
UserQuestionProgress → current per-question derived state
Learner State → current aggregate interpretation
Today Session → persisted decision/output
```

Need to avoid multiple independent copies of the same current value.

Status: OPEN

Target phase: Database Design

---

## 37. Recalculation Strategy

Question:

When Learning Engine formulas change, should existing learner state be:

- left under old version until new evidence arrives;
- fully recalculated from Attempts;
- migrated selectively;
- recalculated on demand.

This decision depends on:

- Attempt completeness;
- scale;
- engine versioning;
- pilot requirements.

Status: OPEN

Target phase: Learning Engine Versioning

---

## 38. Human Approval Threshold for AI Content

Question:

Which AI-generated content requires human approval before learner use?

Potential distinctions:

- low-stakes practice;
- professor-approved Course content;
- formal exam preparation;
- content with weak source confidence.

Status: OPEN

Target phase: AI Content Intelligence

---

## 39. Pilot Content Ownership

Question:

For professor/class pilots, who owns and controls:

- uploaded Materials;
- generated Questions;
- edits;
- learner Attempts;
- aggregate class insights.

This is especially important before institutional/instructor features are built.

Status: OPEN

Target phase: Pilot Planning

---

## 40. Answer Option Storage Model

Question:

What is the V1 storage model for Question answer options?

Possible directions:

- normalized records (e.g. a dedicated options table);
- structured JSON on the Question record.

Decision criteria should include:

- simplicity;
- validation;
- ordering;
- edit/version behavior;
- future question formats;
- query needs.

Status: DECIDED — see `docs/DECISIONS/014-question-answer-model-v1.md`.
Structured JSON on `question_versions` (`answer_options`/`correct_answer`,
validated at the application/infrastructure boundary, not normalized into
a table). V1 supports `SINGLE_CHOICE`/`MULTIPLE_CHOICE` only; free
text/essay/numeric/ordering/matching question types, and any free-text/LLM
grading, remain undecided and are NOT addressed by ADR-014.

Target phase: Database Design

---

## 41. Duplicate Attempt / Idempotency Protection

Question:

How should repeated submissions be prevented from creating duplicate learning evidence?

Potential causes:

- double-click;
- refresh;
- retry after slow response;
- network replay.

Possible protections may include:

- idempotency token;
- session-item completion constraint;
- transaction-level guard;
- application-level duplicate protection.

Status: OPEN. Note: the specific sub-case of a new Today answer attempt
against an already-resolved (COMPLETED/SKIPPED) `DailyPlanItem`/
`TodaySessionItem` is now decided — it must be rejected as a conflict, not
silently accepted as a duplicate or a new Attempt (ADR-016 §19,
`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`). The
general idempotency question (double-click, refresh, network replay
against a still-pending item) remains OPEN; ADR-010's submissionId-based
idempotency addresses technical retries of the *same* submission, not this
broader question.

Target phase: Quiz / Today / Database Design

---

## 42. Open Question Discipline

When implementation encounters missing behavior:

Do not silently invent the answer.

Use this process:

```text
1. Check Master Spec
2. Check PRODUCT / DOMAIN_GLOSSARY / relevant feature contract
3. Check ADRs
4. Check prototype learning evidence if relevant
5. If still unresolved, add/update an Open Question
6. Resolve before implementation if it affects correctness
```

Not every uncertainty belongs here.

Use this file for questions that materially affect:

- product behavior;
- learning logic;
- data integrity;
- architecture;
- security;
- analytics;
- V1 scope.

Minor implementation details can be resolved locally in code review.

# UNLOCK Database Design

Status: Active conceptual data-model guide

Purpose: define V1 data responsibilities, integrity rules, ownership boundaries, and unresolved data-model decisions alongside the implemented migration history.

This document is a conceptual design contract.

It is not the authoritative physical SQL schema. Implemented physical details belong in committed migrations and `docs/PERSISTENCE_SCHEMA_V1.md`.

Do not create or change database tables merely because a concept appears here.

---

## 1. Database Principles

The V1 database should support the smallest trustworthy adaptive learning loop.

Core principle:

```text
Preserve raw evidence.
Derive current state.
Persist only what has a clear purpose.
```

The schema should favor:

* data integrity;
* auditability;
* clear ownership;
* simple authorization;
* deterministic learning behavior;
* future-safe extension points;
* low operational complexity.

Avoid speculative tables for deferred features.

---

## 2. V1 Data Categories

UNLOCK data should be separated conceptually into four categories.

### Shared Content

Examples:

* Course;
* Material;
* Question.

### Historical Evidence

Example:

* Attempt.

### Derived Learner State

Examples:

* UserQuestionProgress;
* aggregate Learner State where justified.

### Session / Decision State

Examples:

* DailyPlan;
* DailyPlanItem;
* selected Next Best Action outputs where persistence is justified.

Do not collapse these categories into one table for convenience.

---

## 3. User

Authentication identity should map to the application's User concept.

At minimum, V1 must support:

* stable user identity;
* created timestamp;
* authorized access to private learning data.

Do not add profile complexity unless required by product behavior.

Potential future fields such as avatar, social profile, preferences, or institution membership are not V1 requirements.

---

## 4. Course

Course is a core V1 entity.

A Course must be valid without an Institution.

Possible V1 responsibilities:

* title;
* description or short metadata where useful;
* owner/access context;
* optional exam context;
* created/updated timestamps.

Do not require:

```text
institution_id
```

for Course creation in V1.

Institution support may be added later.

---

## 5. User ↔ Course Relationship

Status: **DECIDED AND IMPLEMENTED — see `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`.**

V1 uses an explicit `CourseMembership` relationship (conceptual fields:
`userId`, `courseId`, `role`, `joinedAt`, `revokedAt`, `archivedAt`) with
three roles (`OWNER`, `INSTRUCTOR`, `LEARNER`) and a per-Course join policy
(`AUTHORIZED_ONLY` default, `OPEN` settable only by a management role).
`courses.owner_user_id` is unaffected by ADR-015 and remains creator/legacy
metadata only — `CourseMembership.role = OWNER` (non-revoked) is the
authorization source of truth for Course management; `owner_user_id` must
not independently grant management authorization. This does not introduce
full institutional enrollment complexity — Institution/enrollment
provisioning remains architecture-ready, not built now (ADR-006
unaffected).

Implemented by `supabase/migrations/20260919000000_course_membership_v1.sql`
(`courses.join_policy`, `course_memberships` table),
`src/domain/course/`, `src/application/course/`, and
`src/infrastructure/postgres/course-repository.ts` /
`course-membership-repository.ts`.

Auth wiring is implemented through the current server-side authorization model.

RLS policies remain intentionally absent unless and until an explicit security/database decision introduces them (§29).

A small set of edge cases ADR-015 does not decide
(revoked-membership rejoin outcome semantics, last-management-member
self-revocation, repeated revoke/archive timestamp overwrite) are tracked,
not guessed at, in `docs/OPEN_QUESTIONS.md` #43.

See `docs/OPEN_QUESTIONS.md` #1 and #43, and ADR-015.

---

## 6. Material

Material is a source of learning content associated with a Course.

Potential V1 fields may include:

* id;
* course_id;
* title;
* material type;
* source/origin;
* optional text or file reference;
* created_by;
* timestamps.

Material should not imply that V1 requires:

* PDF parsing;
* embeddings;
* RAG;
* AI extraction;
* vector search.

Those capabilities may be layered on later.

---

## 7. Question

Question is shared learning content.

Potential V1 responsibilities:

* Course relationship;
* optional Material relationship;
* prompt/text;
* answer structure;
* correct answer;
* explanation;
* source/provenance;
* lifecycle/verification state where relevant;
* timestamps.

Learner-specific data must not live on Question.

Do not store fields such as:

* learner mastery;
* learner next review date;
* learner misconception count;

on the shared Question record.

---

## 8. Question Versioning

Question editing after learner use creates a historical-integrity problem.

Example:

```text
Learner answered Question A yesterday.
Today the Question wording or correct answer changes.
```

The historical Attempt must still remain interpretable.

Possible strategies:

* immutable Question versions;
* Attempt snapshot;
* Question revision table;
* restricted edits after first usage.

This decision must be resolved before production schema implementation.

Status: DECIDED for V1 — see `docs/DECISIONS/009-question-versioning.md`.

Question is the stable logical identity (`course_id`, `current_version_id` pointer, lifecycle metadata). QuestionVersion is a fully immutable content snapshot (prompt, options, correct answer, explanation). Editing content means inserting a new QuestionVersion and repointing `current_version_id` — an existing QuestionVersion any Attempt references is never mutated. `Attempt.question_version_id` always points at the exact version the learner saw.

The exact answer-content shape a QuestionVersion holds (question type, options, correct answer) is decided separately — see §9 below and `docs/DECISIONS/014-question-answer-model-v1.md`.

---

## 9. Answer Options

Status: DECIDED for V1 — see `docs/DECISIONS/014-question-answer-model-v1.md`.

`question_versions` carries a `question_type` column (`SINGLE_CHOICE` /
`MULTIPLE_CHOICE`; `TRUE_FALSE` is represented as a 2-option
`SINGLE_CHOICE`, not a distinct type) plus two structured-JSON columns:
`answer_options` (`{id, content}[]`, display order meaningful and frozen at
version-creation time) and `correct_answer` (`correctOptionIds: string[]`,
one shared shape for both question types — `SINGLE_CHOICE` requires exactly
one entry, `MULTIPLE_CHOICE` requires at least one; `MULTIPLE_CHOICE`
correctness is set equality). No normalized `question_options` table was
introduced — structured JSON on `question_versions` was chosen; deep
JSON-shape validation happens in application/infrastructure code, not as a
DB `CHECK`. Changing any of `question_type`/`answer_options`/`correct_answer`
requires a new QuestionVersion (§8) — there is no in-place edit.

Free text, essay, numeric-tolerance, ordering, matching, fill-in-the-blank
question types, and any free-text/LLM grading remain explicitly OUT OF
SCOPE for V1 and are not addressed by this decision.

Do not normalize into relational tables without a real query need structured
JSON cannot serve (see ADR-014's "Alternatives Considered").

---

## 10. Attempt

Attempt is one of the most important records in UNLOCK.

Attempt is historical evidence.

Potential fields may include:

* id;
* user_id;
* question reference;
* selected answer;
* correctness;
* confidence value;
* response time;
* attempted_at;
* session context;
* engine/version context where relevant;
* Question version/snapshot reference.

Attempt should be immutable after creation except for narrowly defined technical correction cases, if explicitly designed.

Do not use Attempt as mutable progress state.

---

## 11. Attempt Integrity

An Attempt should answer:

> What happened at that moment?

It should not answer:

> What does UNLOCK believe now?

Therefore, do not update an old Attempt when:

* mastery changes;
* a later answer is submitted;
* review scheduling changes;
* a new engine version is released;
* Today priority changes.

Derived state should change.

Historical evidence should remain preserved.

---

## 12. Duplicate Attempt Protection

V1 must define how repeated form submissions are handled.

Potential causes:

* double-click;
* refresh;
* retry after slow response;
* network replay.

Possible protections may include:

* idempotency token;
* session-item completion constraint;
* transaction-level guard;
* application-level duplicate protection.

Exact implementation should be chosen with the Quiz/Today flow.

V1 mechanism (see `docs/DECISIONS/010-answer-submission-transaction-model.md`): a database-level `UNIQUE (user_id, submission_id)` constraint — scoped per user, not global — is the canonical idempotency boundary, not an application-only check.

The `submitAnswer` transaction inserts with:

```text
ON CONFLICT (user_id, submission_id) DO NOTHING
```

When nothing is inserted, it validates the existing Attempt against the full canonical command-identity field list — every client-supplied immutable Attempt fact, not only the fields that affect Learning Engine output:

* `courseId`
* `questionId`
* `questionVersionId`
* `selectedAnswer`
* `confidenceLevel`
* `responseTimeSeconds`
* `todaySessionId`
* `todaySessionItemId` (legacy linkage when present)
* `assistanceUsed`
* `attemptNumberForPresentedItem`
* `answerWasRevealedBeforeResponse`
* `answeredAt` (exact null-aware equality)

Excluded:

* server-generated metadata (`id`, `engineVersion`, and `suspiciousTiming` — verified server/application-derived from an anomaly rule, not client-supplied);
* derived fields (`isCorrect`, recomputed from already-compared fields).

Any mismatch is rejected as an idempotency-key conflict, not silently returned.

`submitAnswer` also acquires a transaction-scoped advisory lock keyed by `(user_id, question_id)` before this insert, to correctly serialize the very first concurrent Attempts on a pair.

See ADR-010 for the full field-by-field rationale.

---

## 13. UserQuestionProgress

UserQuestionProgress stores current learner-specific derived state for a Question.

Known V1 signals include:

* `mastery_level`;
* `next_review_date`;
* `misconception_hits`;
* `confidence_level`;
* `average_time_seconds`.

Identifying key (decided for V1):

```text
user_id + question_id
```

Not `user_id + course_id + question_id`: a Question belongs to exactly one Course (§7), so `course_id` is already transitively determined via `question_id`.

Not keyed by question version: progress is about the learner's relationship to the Question's logical identity, not to one immutable content snapshot of it.

This record is derived state.

It may be updated as new Attempts arrive.

---

## 14. UserQuestionProgress Integrity

UserQuestionProgress should:

* remain specific to one learner;
* remain specific to the relevant Question identity/version strategy;
* never overwrite shared Question data;
* be recalculable from historical evidence where practical;
* store only approved learning signals.

Do not add speculative metrics simply because they may be useful later.

---

## 15. Learner State

The system may need aggregate Learner State beyond per-question progress.

The persistence strategy is not yet finalized.

Possible approaches:

* calculate aggregate state on demand;
* persist selected aggregate state;
* cache summary values;
* hybrid.

Decision criteria:

* reproducibility;
* query cost;
* stale-state risk;
* debugging;
* Today generation needs.

Status: OPEN

---

## 16. Next Best Action

Next Best Action is primarily a derived decision.

It is not automatically a permanent database entity.

Possible reasons to persist selected NBA output:

* Today reproducibility;
* auditability;
* explainability;
* engine evaluation;
* experiment analysis.

Possible reasons not to persist every ranking result:

* unnecessary data volume;
* stale rankings;
* complexity.

V1 direction:

Persist only the selected decision that becomes part of the learner's frozen plan rather than storing every possible ranking candidate.

Current Today persistence uses `DailyPlanItem`.

No separate table stores all NBA candidates or full ranking results; candidate ranking remains ephemeral computation (`src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`).

---

## 17. DailyPlan

`DailyPlan` represents one persisted Today plan for one learner and one learner-local calendar day.

Current V1 responsibilities include:

* id;
* user_id;
* learner-local planned_for_date;
* generated_at;
* status/completion state;
* planner/engine version where required;
* timestamps.

ADR-016 defines the current primary Today persistence model:

* one DailyPlan per learner per learner-local day;
* DailyPlanItems carry their own Course identity;
* Global Today and Course Today are views over the same persisted plan;
* the plan is frozen by default after creation;
* same-day reload returns the same persisted plan/state;
* unresolved items do not automatically carry into the next learner-local day.

The superseded Course-scoped `TodaySession` model (ADR-011, `UNIQUE (user_id, course_id, planned_for_date)`) was retired before Run 009: its runtime code, and its schema (`today_sessions`/`today_session_items`) in the repository's committed migration chain, no longer exist. `DailyPlan` is the sole current Today application/runtime model. That schema removal is a committed, locally/PGlite-verified migration not yet applied to the hosted Supabase project — the hosted physical schema still retains the legacy tables until then (see `docs/DEV_STATUS.md`).

---

## 18. DailyPlanItem

`DailyPlanItem` represents one prepared learning item inside a DailyPlan.

Current responsibilities may include:

* id;
* daily_plan_id;
* course_id;
* question reference;
* order/position;
* selection reason;
* action/tier metadata;
* status/resolution state;
* completed/resolved timestamp;
* related Attempt linkage where applicable.

This record preserves:

> What did UNLOCK decide the learner should study?

so the learner can resume the same frozen plan even if ranking logic later changes.

The exact persisted DailyPlan/DailyPlanItem schema is authoritative in committed migrations and `docs/PERSISTENCE_SCHEMA_V1.md`.

Product semantics are defined by ADR-016 and ADR-017.

---

## 19. Today Persistence Rule

Today generation and Today execution are separate operations.

The database should allow:

```text
Generate plan
→ persist DailyPlan
→ return later
→ resume same DailyPlan
```

Do not regenerate the plan simply because the page reloads.

For current Today behavior, the persisted learner IANA timezone defines the learner-local calendar day.

Reopening within that same local day returns the persisted DailyPlan.

---

## 20. Starter Experience Data

Starter should use the same core evidence model where possible.

Preferred direction:

* Starter presents real Questions;
* responses create real Attempts;
* progress updates use the same Learning Engine;
* transition into normal Today occurs from real evidence.

Avoid creating a disconnected "diagnostic-only" evidence system unless clearly justified.

---

## 21. Exam Dates

Exam dates may influence priority.

The exact V1 data model remains open.

Possible minimal options:

### Option A

Store personal exam date on user-course relationship.

### Option B

Store Course-level shared exam date plus personal override.

### Option C

Introduce dedicated exam entity only if needed.

V1 should not create a complex Exam hierarchy without product need.

Current conceptual precedence:

```text
personal override
>
shared course/group context
>
null
```

The exact shared layer must be resolved.

---

## 22. Course Structure

The V1 need for Topic / Unit entities is not yet finalized.

Possible minimal model:

```text
Course
→ Material
→ Question
```

Possible structured model:

```text
Course
→ Topic / Unit
→ Material / Question
```

Decision should be driven by:

* Starter sampling;
* coverage;
* analytics;
* exam relevance;
* pilot content structure.

Avoid deep hierarchy if direct relationships are sufficient.

Status: OPEN

---

## 23. Provenance

Content provenance should be stored when it serves a clear purpose.

Potential values may include:

* learner-created;
* manually seeded;
* instructor-created;
* imported;
* AI-generated;
* institution-provided.

Potential provenance data:

* source Material;
* creator;
* source location/reference;
* generation process;
* verification state.

Do not collect provenance metadata with no planned use.

---

## 24. Verification State

AI-generated content may require a verification lifecycle.

Known conceptual states:

* UNVERIFIED;
* SOURCE_LINKED;
* RULE_VALIDATED;
* AI_VERIFIED;
* HUMAN_APPROVED;
* REJECTED.

The exact database representation should be simple.

Possible implementation:

* enum/status field;
* separate verification records only if audit history becomes necessary.

Do not build a complex workflow engine for V1.

---

## 25. Timestamps

Use consistent timestamps.

Most entities should include:

```text
created_at
updated_at
```

where updates are meaningful.

Historical events such as Attempt should use domain-specific event time such as:

```text
attempted_at
```

Today may use:

```text
generated_at
started_at
completed_at
```

Prefer UTC storage.

Convert to learner-local time at application boundaries where appropriate.

---

## 26. Learner Time Zone

Time zone matters for:

* Today boundaries;
* review dates;
* weekly analytics;
* exam urgency.

**V1 strategy — DECIDED AND USED BY CURRENT DAILYPLAN FLOW**:

store an IANA timezone identifier on the user profile and treat the persisted value as the server-side source of truth.

DailyPlan local-day calculation uses the stored timezone rather than a value recomputed from the current request/device on every request.

`users.timezone` (nullable text, no implied default) is added by:

```text
supabase/migrations/20260920000000_user_timezone_v1.sql
```

Validity and canonical-form normalization are enforced at the application boundary:

```text
src/domain/user/timezone.ts
```

using the platform's `Intl` IANA tzdata.

`deriveLocalDateString`:

```text
src/domain/user/local-date.ts
```

deterministically derives `YYYY-MM-DD` from an instant + stored timezone.

Current DailyPlan/Today orchestration uses persisted timezone to determine the local day.

Automatic first-session detection and future travel/manual-timezone-edit UX are separate client/product concerns.

They do not change the server-side authority rule.

Status: DECIDED; persistence/domain/application DailyPlan usage IMPLEMENTED.

---

## 27. Date vs Timestamp

Use a date when the domain concept is date-based.

Use a timestamp when exact time matters.

Examples:

Potential date:

* exam date;
* logical Today date.

Potential timestamp:

* Attempt time;
* Today generated time;
* session started/completed time.

Do not store every time concept as a timestamp by default if time-of-day has no domain meaning.

---

## 28. Ownership

Every private learner-facing record must have a clear authorization path.

Examples:

```text
User
→ Course access / CourseMembership
→ Material/Question visibility
→ Attempts
→ UserQuestionProgress
→ DailyPlan / DailyPlanItems
```

Ownership and authorization must be enforceable at trusted server/application/database boundaries.

Where an accepted surface uses RLS, preserve and test that policy.

Do not assume that RLS is the only authorization layer, and do not add new RLS policy merely because a table contains user data.

Do not rely on hidden UI controls.

---

## 29. Row Level Security

Supabase PostgreSQL is the V1 persistence provider (ADR-013).

The current V1 authorization baseline is explicit trusted server-side authentication and authorization, including the accepted User↔Course membership model from ADR-015.

Current schema state:

* RLS is enabled on the existing V1 application tables by the initial migration;
* there are no application RLS policies granting `anon` or `authenticated` direct table access;
* therefore those PostgREST roles remain deny-by-default for those tables;
* trusted server-side database access uses privileged server credentials and application authorization checks.

This state must not be interpreted as permission to invent or broaden RLS policies during unrelated work.

If a future explicit security/database decision introduces RLS policies for a surface, those policies must be:

* derived from accepted authorization semantics;
* least-privilege;
* tested against the real intended access paths;
* kept consistent with server-side authorization rather than treated as an automatic replacement for it.

PostgreSQL roles with superuser/`BYPASSRLS` attributes, and table owners unless `FORCE ROW LEVEL SECURITY` applies, may bypass RLS independently of policy definitions.

Do not describe `service_role` as uniquely special by name; its elevated behavior comes from its privileged role attributes.

Institutional access rules must not be invented before Institution support is explicitly implemented.

---

## 30. Service Role

Supabase service-role credentials, if used, must remain server-side.

Never expose privileged keys to:

* browser bundles;
* client components;
* public environment variables.

Use elevated access only for explicitly trusted operations.

---

## 31. Transactions

Operations that represent one logical learning action should be consistent.

Example:

```text
Submit answer
→ create Attempt
→ update UserQuestionProgress
→ update DailyPlanItem when applicable
→ update session completion if required
```

This should not leave partial corrupted state if one step fails.

Exact transaction mechanics may use:

* database transaction;
* stored procedure/RPC;
* server-side transaction-capable path;
* carefully designed idempotent sequence.

Choose the simplest reliable approach supported by the final stack.

V1 answer submission runs through one database transaction covering immutable Attempt creation/idempotency, learner-progress update, and planned-item resolution when applicable.

The current DailyPlan answer flow extends the same transactional learning path (`submitAnswer`) with authoritative server-derived `daily_plan_id` / `daily_plan_item_id` linkage.

A DailyPlan-backed Attempt resolves the corresponding DailyPlanItem through the current single-use resolution rules.

Manual Practice remains separate and does not resolve Today.

The transaction-scoped advisory lock keyed by `(user_id, question_id)` remains the concurrency strategy for serializing learner-question progress updates, including the first concurrent Attempts before a UserQuestionProgress row exists.

---

## 32. Constraints

Use database constraints for important invariants where appropriate.

Potential examples:

* valid foreign keys;
* unique user-question progress relationship;
* valid status values;
* non-negative response time;
* valid ordering;
* no duplicate DailyPlanItem position within a DailyPlan.

Do not rely on TypeScript alone for critical data integrity.

---

## 33. Indexes

Indexes should serve real query patterns.

Likely future candidates:

* Attempts by user/question/time;
* UserQuestionProgress by user and review date;
* DailyPlans by user/date/status;
* DailyPlanItems by plan/order;
* Questions by Course/Material.

Do not create large speculative index sets before query patterns exist.

---

## 34. Derived Data and Source of Truth

Preferred hierarchy:

```text
Attempts
→ immutable historical evidence

UserQuestionProgress
→ current per-question derived state

Aggregate Learner State
→ broader current interpretation, if persisted

DailyPlan / DailyPlanItems
→ current persisted output of the Today learning decision
```

Avoid multiple independent writable copies of the same current learning signal.

---

## 35. Recalculation

Because Attempts are preserved, some derived state may be recalculable.

Potential future uses:

* engine migration;
* bug correction;
* experimentation;
* analytics;
* recovery.

The project should avoid schema choices that make recalculation impossible without good reason.

The exact recalculation strategy remains open.

---

## 36. Engine Version Metadata

When the Learning Engine becomes versioned, relevant records may need version metadata.

Potential places include:

* derived progress updates;
* DailyPlan / DailyPlanItem persistence where reproducibility requires it;
* audit/decision records.

Do not add version columns everywhere preemptively.

Add them only where they support reproducibility, debugging, evaluation, or migration safety.

---

## 37. Deletion Semantics

Deletion rules must be explicit.

Open questions include:

* Course deletion;
* Material deletion;
* Question deletion;
* account deletion;
* historical Attempt retention;
* anonymization.

Likely principle:

Learner-used Questions should often be retired rather than hard-deleted if deletion would make historical Attempts uninterpretable.

Final behavior must account for privacy requirements and product needs.

Status: OPEN

---

## 38. Soft Delete / Archiving

Do not add `deleted_at` to every table automatically.

Use archiving/retirement where domain history requires it.

Potential candidates:

* Questions;
* Materials;
* Courses.

Whether an entity needs soft deletion should be decided explicitly.

---

## 39. Migrations

Database changes should be migration-driven.

Migration requirements:

* reviewable;
* reproducible;
* non-destructive by default;
* compatible with existing data unless a planned migration says otherwise.

Do not edit production schema manually outside the migration process.

Never run destructive migrations without explicit approval and backup/recovery consideration.

---

## 40. Seed Data

Seed data may be useful for:

* local development;
* testing;
* pilot setup.

Seeds should be:

* deterministic;
* minimal;
* non-sensitive;
* clearly separate from production learner data.

Do not use real personal learner information in development seeds.

---

## 41. Pilot Data

For a pilot, define:

* which Course is created;
* who owns/administers content;
* how learners gain access;
* how Questions enter the system;
* whether Materials are private/shared;
* how pilot data will be retained or removed.

Pilot shortcuts must be documented if they differ from long-term behavior.

---

## 42. Analytics Data

Product events should only be stored when they answer a defined question.

Core events currently include:

* `today_opened`;
* `today_started`;
* `session_completed`;
* `session_abandoned`.

Whether these live in:

* first-party event table;
* analytics provider;
* hybrid setup;

remains open.

Do not overload learning tables with analytics events unless the event is itself domain evidence.

---

## 43. Learning Evidence vs Product Analytics

Do not confuse:

### Learning Evidence

Examples:

* Attempt correctness;
* confidence;
* response time;
* misconception evidence.

with:

### Product Analytics

Examples:

* screen opened;
* Today started;
* session abandoned.

They may interact analytically, but they serve different purposes and should not be modeled as the same data category.

---

## 44. Sensitive Data

Store only data needed for the product.

Avoid unnecessary personal data.

Potential sensitive areas include:

* learner performance;
* uploaded academic materials;
* institution/class membership;
* behavioral analytics.

Access should follow least-privilege principles.

---

## 45. Data Export

Data export is not required for the first learning loop unless pilot/legal/product needs demand it.

However, schema design should avoid opaque storage that makes future export unnecessarily difficult.

Attempts and progress should remain understandable from structured data.

---

## 46. Multi-Tenancy

Do not introduce full institutional multi-tenancy in V1.

Institution support is architecture-ready.

Current V1 should prioritize simple user ownership/access.

Future institutional isolation rules should be designed when Institution becomes active scope.

---

## 47. Background Jobs

The V1 data model should not assume a job queue exists.

If later workloads require background processing, examples may include:

* AI generation;
* large content ingestion;
* bulk recalculation;
* notifications.

Do not introduce queue-specific schema prematurely.

---

## 48. Vector Data

Vector embeddings are not part of the current required database foundation.

If semantic retrieval becomes necessary later:

* justify the use case;
* define source data;
* define lifecycle;
* define cost;
* define quality requirements.

Do not add vector columns merely because AI features may exist later.

---

## 49. Database Documentation Rule

When the schema is finalized:

* keep this document aligned with high-level data responsibilities;
* place exact schema/migration details in migrations and/or dedicated schema documentation;
* avoid duplicating SQL definitions in multiple documents.

This file should explain why data exists and how responsibilities are separated.

---

## 50. Current V1 Database Scope

Current intended V1 persistence scope:

```text
User / Auth Linkage
Course
CourseMembership / User ↔ Course Access
Topic
Material
Question
QuestionVersion
Attempt
UserQuestionProgress
Exam Date Context where accepted
DailyPlan
DailyPlanItem
minimal version/provenance fields where justified
```

Architecture-ready but not current required schema:

```text
Institution
Institution Admin
Groups
Assignments
Knowledge Graph
Intervention models
Advanced analytics warehouse
Agent infrastructure
```

Do not add deferred schema merely to make future expansion feel easier.

---

## 51. Current Database Decision Status

The physical V1 schema already exists and evolves through forward-only migrations.

Important current decision status:

```text
1. User ↔ Course relationship — DECIDED AND IMPLEMENTED (ADR-015)
2. V1 exam-date hierarchy — OPEN
3. Question editing/version strategy — DECIDED AND IMPLEMENTED (ADR-009 / ADR-014)
4. Course structure depth — current flat Topic model IMPLEMENTED for V1; deeper hierarchy remains out of current scope unless explicitly reopened
5. Today scope — DECIDED AND IMPLEMENTED through DailyPlan/DailyPlanItem (ADR-016); the superseded TodaySession tables were retired before Run 009
6. Today local-day/timezone authority — DECIDED AND IMPLEMENTED for current DailyPlan flow
7. aggregate Learner State persistence — OPEN
8. selected Next Best Action persistence — DECIDED: persist selected frozen plan output, not all candidates
9. data deletion / Question retirement semantics — OPEN
10. persistence provider — DECIDED: Supabase PostgreSQL (ADR-013)
11. Supabase Auth provisioning — IMPLEMENTED
12. RLS application-policy design — NOT PART OF THE CURRENT BASELINE; introduce only through explicit security/database scope
13. Course lifecycle — IMPLEMENTED by committed migration #10
14. Topic persistence — IMPLEMENTED by committed migration #11
15. Question authoring/publishing persistence — IMPLEMENTED by committed migration #12
```

Do not let migration implementation accidentally decide still-open product questions.

---

## 52. Current Database Goal

The database is successful when it can reliably support this loop:

```text
Learner answers
↓
Attempt is preserved
↓
current learner progress updates
↓
DailyPlanItem / DailyPlan state updates when applicable
↓
future priority can be recalculated
↓
historical evidence remains intact
```

The database should make correct behavior easy and corrupt behavior difficult.

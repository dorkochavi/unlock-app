# UNLOCK Database Design

Status: Active data-model design guide

Purpose: define the intended V1 data responsibilities, integrity rules, ownership model, and unresolved schema decisions before concrete database migrations are written.

This document is a design contract.

It is not yet the final SQL schema.

Do not create database tables merely because a concept appears here.

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

- data integrity;
- auditability;
- clear ownership;
- simple authorization;
- deterministic learning behavior;
- future-safe extension points;
- low operational complexity.

Avoid speculative tables for deferred features.

---

## 2. V1 Data Categories

UNLOCK data should be separated conceptually into four categories.

### Shared Content

Examples:

- Course;
- Material;
- Question.

### Historical Evidence

Example:

- Attempt.

### Derived Learner State

Examples:

- UserQuestionProgress;
- aggregate Learner State where justified.

### Session / Decision State

Examples:

- Today Session;
- Today Session Item;
- selected Next Best Action outputs where persistence is justified.

Do not collapse these categories into one table for convenience.

---

## 3. User

Authentication identity should map to the application's User concept.

At minimum, V1 must support:

- stable user identity;
- created timestamp;
- authorized access to private learning data.

Do not add profile complexity unless required by product behavior.

Potential future fields such as avatar, social profile, preferences, or institution membership are not V1 requirements.

---

## 4. Course

Course is a core V1 entity.

A Course must be valid without an Institution.

Possible V1 responsibilities:

- title;
- description or short metadata where useful;
- owner/access context;
- optional exam context;
- created/updated timestamps.

Do not require:

```text
institution_id
```

for Course creation in V1.

Institution support may be added later.

---

## 5. User ↔ Course Relationship

This relationship is not yet finalized.

Possible implementations include:

- direct owner field on Course;
- lightweight access/membership table;
- lightweight Enrollment table.

The chosen model must support:

- authorization;
- learner access;
- future multi-user Course scenarios;
- simple V1 implementation.

Do not introduce full institutional enrollment complexity before it is needed.

Status: OPEN

See `docs/OPEN_QUESTIONS.md`.

---

## 6. Material

Material is a source of learning content associated with a Course.

Potential V1 fields may include:

- id;
- course_id;
- title;
- material type;
- source/origin;
- optional text or file reference;
- created_by;
- timestamps.

Material should not imply that V1 requires:

- PDF parsing;
- embeddings;
- RAG;
- AI extraction;
- vector search.

Those capabilities may be layered on later.

---

## 7. Question

Question is shared learning content.

Potential V1 responsibilities:

- Course relationship;
- optional Material relationship;
- prompt/text;
- answer structure;
- correct answer;
- explanation;
- source/provenance;
- lifecycle/verification state where relevant;
- timestamps.

Learner-specific data must not live on Question.

Do not store fields such as:

- learner mastery;
- learner next review date;
- learner misconception count;

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

- immutable Question versions;
- Attempt snapshot;
- Question revision table;
- restricted edits after first usage.

This decision must be resolved before production schema implementation.

Status: OPEN

See `docs/OPEN_QUESTIONS.md`.

---

## 9. Answer Options

The exact V1 storage model is not yet decided.

Possible implementations:

- normalized `question_options` table;
- structured JSON on Question/QuestionVersion.

Decision criteria should include:

- simplicity;
- validation;
- ordering;
- edit/version behavior;
- future question formats;
- query needs.

Do not normalize automatically without a real need.

---

## 10. Attempt

Attempt is one of the most important records in UNLOCK.

Attempt is historical evidence.

Potential fields may include:

- id;
- user_id;
- question reference;
- selected answer;
- correctness;
- confidence value;
- response time;
- attempted_at;
- session context;
- engine/version context where relevant;
- Question version/snapshot reference.

Attempt should be immutable after creation except for narrowly defined technical correction cases, if explicitly designed.

Do not use Attempt as mutable progress state.

---

## 11. Attempt Integrity

An Attempt should answer:

> What happened at that moment?

It should not answer:

> What does UNLOCK believe now?

Therefore, do not update an old Attempt when:

- mastery changes;
- a later answer is submitted;
- review scheduling changes;
- a new engine version is released;
- Today priority changes.

Derived state should change.

Historical evidence should remain preserved.

---

## 12. Duplicate Attempt Protection

V1 must define how repeated form submissions are handled.

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

Exact implementation should be chosen with the Quiz/Today flow.

---

## 13. UserQuestionProgress

UserQuestionProgress stores current learner-specific derived state for a Question.

Known V1 signals include:

- `mastery_level`;
- `next_review_date`;
- `misconception_hits`;
- `confidence_level`;
- `average_time_seconds`.

Potential identifying key:

```text
user_id + question_id
```

or:

```text
user_id + current question version context
```

depending on Question versioning decisions.

This record is derived state.

It may be updated as new Attempts arrive.

---

## 14. UserQuestionProgress Integrity

UserQuestionProgress should:

- remain specific to one learner;
- remain specific to the relevant Question identity/version strategy;
- never overwrite shared Question data;
- be recalculable from historical evidence where practical;
- store only approved learning signals.

Do not add speculative metrics simply because they may be useful later.

---

## 15. Learner State

The system may need aggregate Learner State beyond per-question progress.

The persistence strategy is not yet finalized.

Possible approaches:

- calculate aggregate state on demand;
- persist selected aggregate state;
- cache summary values;
- hybrid.

Decision criteria:

- reproducibility;
- query cost;
- stale-state risk;
- debugging;
- Today generation needs.

Status: OPEN

---

## 16. Next Best Action

Next Best Action is primarily a derived decision.

It is not automatically a permanent database entity.

Possible reasons to persist selected NBA output:

- Today reproducibility;
- auditability;
- explainability;
- engine evaluation;
- experiment analysis.

Possible reasons not to persist every ranking result:

- unnecessary data volume;
- stale rankings;
- complexity.

Likely V1 direction:

Persist the selected decision inside Today Session Items rather than storing every possible ranking candidate.

Final decision remains open.

---

## 17. Today Session

Today Session represents one persisted Today plan.

Potential fields may include:

- id;
- user_id;
- Course context if Today is Course-specific;
- generated_at;
- session date / effective period;
- status;
- started_at;
- completed_at;
- engine/planner version;
- timestamps.

Potential statuses may include:

- prepared;
- started;
- completed;
- expired/closed;
- abandoned if product logic requires explicit persistence.

Exact status model belongs in the Today feature contract.

---

## 18. Today Session Item

Today Session Item represents a prepared item in a Today Session.

Potential fields may include:

- id;
- today_session_id;
- question reference;
- order/position;
- selection reason;
- priority/rank at generation time;
- status;
- completed_at;
- related Attempt id where useful.

This record helps preserve:

> What did UNLOCK decide the learner should study?

even if ranking logic changes later.

---

## 19. Today Persistence Rule

Today generation and Today execution are separate operations.

The database should allow:

```text
Generate plan
→ persist plan
→ return later
→ resume same plan
```

Do not regenerate the session simply because the page reloads.

Exact daily/session-boundary semantics remain open.

---

## 20. Starter Experience Data

Starter should use the same core evidence model where possible.

Preferred direction:

- Starter presents real Questions;
- responses create real Attempts;
- progress updates use the same Learning Engine;
- transition into normal Today occurs from real evidence.

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

- Starter sampling;
- coverage;
- analytics;
- exam relevance;
- pilot content structure.

Avoid deep hierarchy if direct relationships are sufficient.

Status: OPEN

---

## 23. Provenance

Content provenance should be stored when it serves a clear purpose.

Potential values may include:

- learner-created;
- manually seeded;
- instructor-created;
- imported;
- AI-generated;
- institution-provided.

Potential provenance data:

- source Material;
- creator;
- source location/reference;
- generation process;
- verification state.

Do not collect provenance metadata with no planned use.

---

## 24. Verification State

AI-generated content may require a verification lifecycle.

Known conceptual states:

- UNVERIFIED;
- SOURCE_LINKED;
- RULE_VALIDATED;
- AI_VERIFIED;
- HUMAN_APPROVED;
- REJECTED.

The exact database representation should be simple.

Possible implementation:

- enum/status field;
- separate verification records only if audit history becomes necessary.

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

- Today boundaries;
- review dates;
- weekly analytics;
- exam urgency.

The V1 time-zone strategy is not yet finalized.

Possible direction:

- store IANA timezone per user;
- initialize from browser;
- allow future override.

For a controlled pilot, a fixed timezone may be acceptable temporarily if explicitly documented.

Status: OPEN

---

## 27. Date vs Timestamp

Use a date when the domain concept is date-based.

Use a timestamp when exact time matters.

Examples:

Potential date:

- exam date;
- logical Today date.

Potential timestamp:

- Attempt time;
- Today generated time;
- session started/completed time.

Do not store every time concept as a timestamp by default if time-of-day has no domain meaning.

---

## 28. Ownership

Every private learner-facing record must have a clear authorization path.

Examples:

```text
User
→ Course access
→ Material/Question visibility
→ Attempts
→ UserQuestionProgress
→ Today Sessions
```

Ownership should be enforceable in database/RLS policy where appropriate.

Do not rely on hidden UI controls.

---

## 29. Row Level Security

If Supabase is confirmed, RLS is required for user data.

At minimum, policies should protect:

- Attempts;
- UserQuestionProgress;
- Today Sessions;
- private Courses/Materials where applicable.

RLS policy behavior must be tested.

Institutional access rules should not be invented before institution support is implemented.

---

## 30. Service Role

Supabase service-role credentials, if used, must remain server-side.

Never expose privileged keys to:

- browser bundles;
- client components;
- public environment variables.

Use elevated access only for explicitly trusted operations.

---

## 31. Transactions

Operations that represent one logical learning action should be consistent.

Example:

```text
Submit answer
→ create Attempt
→ update UserQuestionProgress
→ update Today Session Item
→ update session completion if required
```

This should not leave partial corrupted state if one step fails.

Exact transaction mechanics may use:

- database transaction;
- stored procedure/RPC;
- server-side transaction-capable path;
- carefully designed idempotent sequence.

Choose the simplest reliable approach supported by the final stack.

---

## 32. Constraints

Use database constraints for important invariants where appropriate.

Potential examples:

- valid foreign keys;
- unique user-question progress relationship;
- valid status values;
- non-negative response time;
- valid ordering;
- no duplicate Today Session Item position within a session.

Do not rely on TypeScript alone for critical data integrity.

---

## 33. Indexes

Indexes should serve real query patterns.

Likely future candidates:

- Attempts by user/question/time;
- UserQuestionProgress by user and review date;
- Today Sessions by user/date/status;
- Today Session Items by session/order;
- Questions by Course/Material.

Do not create large speculative index sets before query patterns exist.

---

## 34. Derived Data and Source of Truth

Preferred hierarchy:

```text
Attempts
→ historical source evidence

UserQuestionProgress
→ current per-question derived state

Aggregate Learner State
→ current broader interpretation, if persisted

Today Session / Items
→ persisted output of a learning decision
```

Avoid multiple independent writable copies of the same current learning signal.

---

## 35. Recalculation

Because Attempts are preserved, some derived state may be recalculable.

Potential future uses:

- engine migration;
- bug correction;
- experimentation;
- analytics;
- recovery.

The project should avoid schema choices that make recalculation impossible without good reason.

The exact recalculation strategy remains open.

---

## 36. Engine Version Metadata

When the Learning Engine becomes versioned, relevant records may need version metadata.

Potential places:

- derived progress update;
- Today Session;
- Today Session Item;
- audit/decision record.

Do not add version columns everywhere preemptively.

Add them where they support reproducibility or debugging.

---

## 37. Deletion Semantics

Deletion rules must be explicit.

Open questions include:

- Course deletion;
- Material deletion;
- Question deletion;
- account deletion;
- historical Attempt retention;
- anonymization.

Likely principle:

Learner-used Questions should often be retired rather than hard-deleted if deletion would make historical Attempts uninterpretable.

Final behavior must account for privacy requirements and product needs.

Status: OPEN

---

## 38. Soft Delete / Archiving

Do not add `deleted_at` to every table automatically.

Use archiving/retirement where domain history requires it.

Potential candidates:

- Questions;
- Materials;
- Courses.

Whether an entity needs soft deletion should be decided explicitly.

---

## 39. Migrations

Database changes should be migration-driven.

Migration requirements:

- reviewable;
- reproducible;
- non-destructive by default;
- compatible with existing data unless a planned migration says otherwise.

Do not edit production schema manually outside the migration process.

Never run destructive migrations without explicit approval and backup/recovery consideration.

---

## 40. Seed Data

Seed data may be useful for:

- local development;
- testing;
- pilot setup.

Seeds should be:

- deterministic;
- minimal;
- non-sensitive;
- clearly separate from production learner data.

Do not use real personal learner information in development seeds.

---

## 41. Pilot Data

For a pilot, define:

- which Course is created;
- who owns/administers content;
- how learners gain access;
- how Questions enter the system;
- whether Materials are private/shared;
- how pilot data will be retained or removed.

Pilot shortcuts must be documented if they differ from long-term behavior.

---

## 42. Analytics Data

Product events should only be stored when they answer a defined question.

Core events currently include:

- `today_opened`;
- `today_started`;
- `session_completed`;
- `session_abandoned`.

Whether these live in:

- first-party event table;
- analytics provider;
- hybrid setup;

remains open.

Do not overload learning tables with analytics events unless the event is itself domain evidence.

---

## 43. Learning Evidence vs Product Analytics

Do not confuse:

### Learning Evidence

Examples:

- Attempt correctness;
- confidence;
- response time;
- misconception evidence.

with:

### Product Analytics

Examples:

- screen opened;
- Today started;
- session abandoned.

They may interact analytically, but they serve different purposes and should not be modeled as the same data category.

---

## 44. Sensitive Data

Store only data needed for the product.

Avoid unnecessary personal data.

Potential sensitive areas include:

- learner performance;
- uploaded academic materials;
- institution/class membership;
- behavioral analytics.

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

- AI generation;
- large content ingestion;
- bulk recalculation;
- notifications.

Do not introduce queue-specific schema prematurely.

---

## 48. Vector Data

Vector embeddings are not part of the current required database foundation.

If semantic retrieval becomes necessary later:

- justify the use case;
- define source data;
- define lifecycle;
- define cost;
- define quality requirements.

Do not add vector columns merely because AI features may exist later.

---

## 49. Database Documentation Rule

When the schema is finalized:

- keep this document aligned with high-level data responsibilities;
- place exact schema/migration details in migrations and/or dedicated schema documentation;
- avoid duplicating SQL definitions in multiple documents.

This file should explain why data exists and how responsibilities are separated.

---

## 50. Current V1 Database Scope

Current intended V1 persistence scope:

```text
User / Auth Linkage
Course
User ↔ Course Access
Material
Question
Attempt
UserQuestionProgress
Exam Date Context
Today Session
Today Session Item
minimal version/provenance fields where justified
```

Architecture-ready but not current required schema:

```text
Institution
Instructor
Institution Admin
Groups
Assignments
Knowledge Graph
Intervention models
Advanced analytics warehouse
Agent infrastructure
```

---

## 51. Decisions Required Before Concrete Schema

Before writing the real V1 schema, resolve at minimum:

```text
1. User ↔ Course relationship
2. V1 exam-date hierarchy
3. Question editing/version strategy
4. Course structure depth
5. Today scope: one Course or multiple Courses
6. Today session boundary/timezone behavior
7. aggregate Learner State persistence
8. selected Next Best Action persistence strategy
9. data deletion / Question retirement semantics
10. final Supabase confirmation
```

Do not let the migration code become the place where these product decisions are accidentally made.

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
Today/session state updates
↓
future priority can be recalculated
↓
historical evidence remains intact
```

The database should make the correct behavior easy and the corrupt behavior difficult.

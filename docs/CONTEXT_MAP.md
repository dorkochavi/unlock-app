# UNLOCK — Context Map

Status: Active navigation guide

Purpose: help developers and coding agents locate the minimum trustworthy context
needed for a specific task.

This file is a GPS.

It is NOT:
- a source of product truth
- a development plan
- a status report
- an ADR
- a historical record
- a replacement for reading the relevant code

Use it to locate context, then leave it.

---

## 1. Core Development Documents

### How Claude works

`CLAUDE.md`

Contains:
- development workflow
- context policy
- scope discipline
- testing/review expectations
- Git/remote safety
- Run lifecycle

Read automatically at the start of a substantial Claude run.

---

### What Claude should execute now

`docs/CHATGPT_PLAN.md`

Contains:
- current Run ID
- BASE_HEAD
- current run goal
- ordered slices
- acceptance criteria
- required tests/reviewers
- explicit stop point

This is the execution queue.

Do not infer current work from old planning documents or historical Runs.

---

### What is true now

`docs/DEV_STATUS.md`

Contains the concise current-state snapshot:

- implemented capabilities
- current database/migration state
- verification state
- current test baseline
- known gaps
- blockers
- required manual actions

Use this instead of reconstructing current state from historical notes.

---

### What UNLOCK is intended to become

`docs/MASTER_SPEC.md`

Use for:
- product vision
- North Star
- overall product/system intent
- long-term boundaries

Read only when the current slice needs product-level context.

---

### Strategic sequencing and V1 boundary

`docs/UNLOCK_ROADMAP.md`

Contains:
- strategic Product Run sequencing toward V1 (current sequence: Run 004–009)
- strategic milestones

`docs/UNLOCK_V1_SCOPE.md`

Contains:
- the V1 product boundary
- V1 Definition of Done

Neither is an execution plan or a substitute for `docs/CHATGPT_PLAN.md`.

`docs/ROADMAP.md` (no `UNLOCK_` prefix) is an older historical/phase-based sequencing
reference. It is NOT the active product roadmap — use `docs/UNLOCK_ROADMAP.md` instead.

---

### What is still undecided

`docs/OPEN_QUESTIONS.md`

Use when implementation reaches an unresolved product or architecture question.

Do not invent answers to unresolved questions.

---

### Accepted durable decisions

`docs/DECISIONS/`

Read the specific relevant ADR only.

Do not load every ADR by default.

---

### Historical development runs

`docs/RUNS/`

RESTRICTED CONTEXT.

Historical Run Reports are archive material, not normal working memory.

Do not read or search prior Run Reports unless:
- the current `CHATGPT_PLAN.md` explicitly names a specific Run, or
- the user explicitly authorizes it.

---

## 2. Product / Domain Context

For broad product behavior:

- `docs/MASTER_SPEC.md`
- `docs/PRODUCT.md`
- `docs/DOMAIN_GLOSSARY.md`

For unresolved behavior:

- `docs/OPEN_QUESTIONS.md`

For accepted behavior:

- relevant ADR under `docs/DECISIONS/`

For feature-specific supporting material:

- `docs/FEATURES/`

Prefer the narrowest relevant source.

---

## 3. Architecture

For module boundaries, dependency direction, runtime structure, or composition:

- `docs/ARCHITECTURE.md`
- relevant ADR under `docs/DECISIONS/`
- relevant scoped rule under `.claude/rules/`

Primary source-code layers:

- `src/domain/`
  - pure domain / learning logic

- `src/application/`
  - use cases, ports, orchestration, transactions

- `src/infrastructure/`
  - PostgreSQL, Supabase, schedulers, external adapters

- `src/app/`
  - Next.js UI / runtime / API routes

Dependency direction:

domain
→ application
→ infrastructure
→ runtime/API

Do not use this map as a substitute for inspecting the actual code.

---

## 4. Learning Engine

Use this section for work involving:

- evidence
- mastery
- misconception
- memory scheduling
- retrieval qualification
- replay / rebuild
- Next Best Action
- ranking
- learning-state updates

Primary docs:

- `docs/LEARNING_ENGINE.md`
- `docs/DOMAIN_GLOSSARY.md`

Key ADRs:

- `docs/DECISIONS/004-ai-is-not-the-learning-engine.md`
- `docs/DECISIONS/005-attempts-are-immutable.md`
- `docs/DECISIONS/008-fsrs-memory-scheduler.md`
- `docs/DECISIONS/009-question-versioning.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`

Claude rule:

- `.claude/rules/learning-engine.md`

Primary code area:

- `src/domain/learning/`
- `src/application/learning/`

Relevant tests live near those modules and under:

- `supabase/tests/postgres/`

Read only the ADRs relevant to the exact behavior being changed.

---

## 5. DailyPlan / Today

Use this section for:

- DailyPlan generation
- DailyPlan persistence
- Today semantics
- item selection
- plan freezing
- Skip
- answer resolution
- learner Today UI
- course/global Today behavior

Primary accepted decision:

- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`

Current state:

- `docs/DEV_STATUS.md`

Primary application code:

- `src/application/dailyPlan/`

Primary persistence/runtime areas:

- `src/infrastructure/postgres/daily-plan-repository.ts`
- `src/infrastructure/postgres/postgres-daily-plan-unit-of-work.ts`

Primary UI/API areas:

- `src/app/today/`
- `src/app/api/daily-plan/`

Supporting design docs exist for specialized Today questions, including:

- `docs/GLOBAL_TODAY_APPLICATION_FLOW.md`
- `docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md`
- `docs/GLOBAL_TODAY_PRIORITY_MODEL.md`
- `docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md`
- `docs/TODAY_ADAPTATION_MODEL.md`
- `docs/TODAY_TIMEZONE_EDGE_CASES.md`

Do not read these all by default.

Open only the document needed for the current problem.

---

## 6. Starter / New Material

Primary accepted decision:

- `docs/DECISIONS/017-starter-new-material-v1.md`

Primary application path:

- `src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`

Primary Postgres discovery path:

- `src/infrastructure/postgres/unseen-question-repository.ts`

Relevant supporting analysis:

- `docs/NEW_MATERIAL_EXPOSURE_MODEL.md`

The supporting analysis is not authoritative over ADR-017.

Use ADR-017 for accepted V1 behavior.

---

## 7. Courses / Membership / Join

Use this section for:

- CourseMembership
- OWNER / INSTRUCTOR / LEARNER roles
- OPEN courses
- AUTHORIZED_ONLY courses
- learner join
- archive/revoke behavior
- management authorization
- automatic learning eligibility

Primary accepted decision:

- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`

Unresolved behavior:

- `docs/OPEN_QUESTIONS.md`

Primary application area:

- `src/application/course/`

Primary Postgres areas:

- course repository
- course-membership repository under `src/infrastructure/postgres/`

Learner onboarding UI:

- `src/app/join/[courseId]/`

Course APIs:

- `src/app/api/courses/`

Relevant Claude rule:

- `.claude/rules/auth.md`

Do not invent revoke/rejoin or ownership-transfer semantics if they remain unresolved.

---

## 8. Authentication / Authorization / Redirects

Use this section for:

- Supabase Auth
- login/session behavior
- trusted user identity
- authenticated APIs
- authorization
- safe redirects
- auth-before-database ordering

Primary docs:

- `docs/API_V1_DRAFT.md`
- relevant ADR
- `docs/DEV_STATUS.md` for current verification state

Claude rules:

- `.claude/rules/auth.md`
- `.claude/rules/api.md`

Primary infrastructure:

- `src/infrastructure/supabase/`

Login UI:

- `src/app/login/`

Safe redirect helper:

- `src/lib/safe-redirect.ts`

Authenticated API routes:

- `src/app/api/`

For route changes, inspect the nearest existing auth-before-DB regression test
before inventing a new pattern.

---

## 9. Answer Submission / Attempts

Use this section for:

- answer submission
- correctness
- Attempt persistence
- idempotency
- learning-state mutation
- replay/rebuild
- DailyPlan item completion

Key ADRs:

- `docs/DECISIONS/005-attempts-are-immutable.md`
- `docs/DECISIONS/009-question-versioning.md`
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
- `docs/DECISIONS/014-question-answer-model-v1.md`

Primary application path:

- `src/application/learning/submit-answer.ts`

DailyPlan orchestration:

- `src/application/dailyPlan/submit-daily-plan-item-answer.ts`

Primary API:

- `src/app/api/daily-plan/items/[itemId]/answer/`

Primary Postgres integration test:

- `supabase/tests/postgres/submit-answer.test.ts`

Database reference:

- `docs/DATABASE.md`

---

## 10. Skip

Use this section for DailyPlan Skip behavior.

Primary application path:

- `src/application/dailyPlan/skip-daily-plan-item.ts`

Primary API:

- `src/app/api/daily-plan/items/[itemId]/skip/`

Primary persistence behavior:

- DailyPlan repository resolution methods under `src/infrastructure/postgres/`

Relevant product semantics:

- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`

Relevant tests:

- application tests near `skip-daily-plan-item.ts`
- route tests near the API
- `supabase/tests/postgres/skip-daily-plan-item.test.ts`

---

## 11. Learner-Facing Question Content

Use this section for safe question reads shown to learners.

Application port:

- learner question-content interfaces under `src/application/learning/`

Postgres repository:

- `src/infrastructure/postgres/learner-question-content-repository.ts`

Mapper:

- learner question-content mapper under `src/infrastructure/postgres/`

DailyPlan DTO / Today response:

- DailyPlan DTO code under `src/application/dailyPlan/`
- `src/app/api/daily-plan/today/`

Important boundary:

learner-facing reads must not expose grading-only fields.

For correctness/grading, use the dedicated grading path instead of expanding the
learner-facing projection.

---

## 12. User Timezone / Local Day

Use this section for:

- persisted timezone
- learner-local date
- Today day boundaries
- timezone setup

Primary domain code:

- `src/domain/user/timezone.ts`
- `src/domain/user/local-date.ts`

Application code:

- `src/application/user/`

API:

- `src/app/api/user/timezone/`

Supporting design doc:

- `docs/TODAY_TIMEZONE_EDGE_CASES.md`

Database/date parsing helpers:

- `src/infrastructure/postgres/row-validation.ts`

Do not assume PGlite DATE behavior perfectly matches real `node-postgres`.

---

## 13. Database / PostgreSQL / Migrations

Use this section for:

- schema
- migrations
- SQL
- repositories
- constraints
- transactions
- UnitOfWork
- PostgreSQL runtime
- concurrency assumptions

Primary docs:

- `docs/DATABASE.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`

Migrations:

- `supabase/migrations/`

Postgres infrastructure:

- `src/infrastructure/postgres/`

Integration tests:

- `supabase/tests/postgres/`

Claude rule:

- `.claude/rules/postgres.md`

Testing rule:

- `.claude/rules/testing.md`

Check `docs/DEV_STATUS.md` for which migrations are:
- applied remotely
- committed but still local-only

---

## 14. Testing / Verification

Primary testing docs:

- `docs/TESTING.md`
- `docs/DEFINITION_OF_DONE.md`

Claude testing rule:

- `.claude/rules/testing.md`

Workflow skills:

- `.claude/skills/implement-slice/`
- `.claude/skills/checkpoint/`
- `.claude/skills/review-commit/`

Reviewer agents:

- `.claude/agents/unlock-reviewer.md`
- `.claude/agents/unlock-db-reviewer.md`
- `.claude/agents/unlock-security-reviewer.md`

Use the reviewer that matches actual risk.

Do not invoke all reviewers automatically.

---

## 15. UI / Hebrew / RTL

Use this section for:

- learner-facing UI
- copy
- localization
- RTL behavior

Product context:

- `docs/PRODUCT.md`

Definition of Done:

- `docs/DEFINITION_OF_DONE.md`

Messages:

- `src/messages/`

Locale helpers:

- `src/lib/locale.ts`

Cursor rule:

- `.cursor/rules/rtl-i18n.mdc`

Primary defaults:

- Hebrew
- RTL
- `he-IL`

Do not move domain or learning policy into UI components.

---

## 16. AI Features

Use this section when adding AI-assisted product behavior.

Primary decision:

- `docs/DECISIONS/004-ai-is-not-the-learning-engine.md`

Supporting context:

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`

Cursor rule:

- `.cursor/rules/ai.mdc`

AI may assist workflows.

It must not become the deterministic real-time Learning Engine.

---

## 17. Durable New Decisions

When a task introduces a durable, cross-cutting decision involving:

- architecture
- persistence
- domain boundaries
- security model
- provider strategy
- data ownership
- Learning Engine strategy
- major product semantics

inspect:

- `docs/DECISIONS/`
- `docs/OPEN_QUESTIONS.md`

Create a new ADR only when the decision genuinely deserves a durable record.

Do not create ADRs for ordinary implementation details.

---

## 18. Source-Code Quick Map

### Domain

`src/domain/`

Key areas:
- learning
- user
- core domain rules

### Application

`src/application/`

Key areas:
- `learning/`
- `dailyPlan/`
- `course/`
- `user/`

### Infrastructure

`src/infrastructure/`

Key areas:
- `postgres/`
- `supabase/`
- runtime adapters

### Next.js runtime / UI / API

`src/app/`

Key areas:
- `login/`
- `today/`
- `join/`
- `api/`

### Database

- `supabase/migrations/`
- `supabase/tests/postgres/`

### User-facing messages

- `src/messages/`

### Shared frontend/runtime helpers

- `src/lib/`

---

## 19. Historical / Legacy Planning Material

Some older design and implementation-planning documents remain useful as supporting
context.

They must not automatically be treated as current execution plans.

Examples include:

- `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`
- older feature design analyses
- superseded investigation documents

Current execution always comes from:

`docs/CHATGPT_PLAN.md`

Current state always comes from:

`docs/DEV_STATUS.md`

Accepted decisions come from:

`docs/DECISIONS/`

Use older planning material only when the current task specifically needs its
analysis or history.

---

## 20. Scratch / Temporary Context

`scratch/` is temporary and non-canonical.

A current autonomous run may use:

`scratch/development_checkpoint.md`

when authorized by the Plan.

Do not browse old scratch files for project history.

Do not treat scratch as a source of product truth.

---

## 21. Navigation Rule

When starting work on an unfamiliar area:

1. identify the domain of the task
2. use this map to locate the smallest relevant documentation/code area
3. read the relevant accepted ADR if one exists
4. inspect the actual implementation
5. inspect the nearest relevant tests
6. expand context only when evidence requires it

Do not load broad documentation trees preemptively.

The goal is not maximum context.

The goal is the minimum trustworthy context required for the current slice.
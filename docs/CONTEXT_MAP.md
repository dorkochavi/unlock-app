# UNLOCK Context Map

Status: Active navigation guide

Purpose: route developers and coding agents to the minimum relevant context for a task.

This file is intentionally short.

It is a navigation map, not a source of truth.

---

## 1. Session Start

For substantial work, start with:

CLAUDE.md
docs/DEV_STATUS.md
git status
git status -sb
git log --oneline -5

Then use this map to read only the additional context relevant to the current task.

Do not load the entire documentation tree by default.

---

## 2. Source Hierarchy

When determining behavior or architecture, use:

1. committed code
2. accepted ADRs under `docs/DECISIONS/`
3. `docs/OPEN_QUESTIONS.md`
4. committed migrations under `supabase/migrations/`
5. relevant canonical product/API/design documentation

`docs/DEV_STATUS.md` describes the current development checkpoint.

`docs/MASTER_SPEC.md` provides high-level product/system context.

Neither overrides committed code or accepted ADRs.

Content under `scratch/` is temporary and non-canonical.

---

## 3. Product Behavior

If the task changes product behavior, read only what is relevant from:

docs/PRODUCT.md
docs/MASTER_SPEC.md
docs/DOMAIN_GLOSSARY.md
docs/OPEN_QUESTIONS.md
docs/FEATURES/
docs/DECISIONS/

Use the relevant ADR when one exists.

Do not invent unresolved behavior.

---

## 4. Architecture

If the task changes module boundaries, dependency direction, runtime structure, or composition:

docs/ARCHITECTURE.md
docs/DECISIONS/

For Claude Code also use relevant rules under:

.claude/rules/

For Cursor, use relevant rules under:

.cursor/rules/

Do not read every rule file automatically.

---

## 5. Learning Engine

If the task changes:

- mastery
- evidence
- misconception
- scheduling
- retrieval qualification
- Next Best Action
- replay/rebuild
- Today ranking/planning

read:

docs/DECISIONS/004-ai-is-not-the-learning-engine.md
docs/DECISIONS/005-attempts-are-immutable.md
docs/DECISIONS/008-fsrs-memory-scheduler.md
docs/DECISIONS/009-question-versioning.md
docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md
docs/LEARNING_ENGINE.md
docs/DOMAIN_GLOSSARY.md
docs/TESTING.md

For Claude Code:

.claude/rules/learning-engine.md

Critical invariants:

Attempts are immutable historical evidence.
QuestionVersion preserves historical question state.
Learning Engine behavior is deterministic for explicit state, policy, and time.
AI is not the real-time Learning Engine.

Do not silently reconcile current implementation enums with future target models during unrelated work.

---

## 6. DailyPlan / Today

If the task changes Today or DailyPlan, start with:

docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md
docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md
docs/DEV_STATUS.md

Read additional Global Today documents only when the specific task requires them.

Relevant supporting documents may include:

docs/GLOBAL_TODAY_APPLICATION_FLOW.md
docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md
docs/GLOBAL_TODAY_PRIORITY_MODEL.md
docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md
docs/NEW_MATERIAL_EXPOSURE_MODEL.md
docs/TODAY_ADAPTATION_MODEL.md
docs/TODAY_TIMEZONE_EDGE_CASES.md

Critical current invariants:

One DailyPlan per user per local day.
Global Today and Course Today are views of the same DailyPlan.
Only active LEARNER memberships participate automatically.
Manual Practice is separate from Today.
Today planning selects learning items; Quiz executes prepared work.

Do not load every Global Today document by default.

---

## 7. Course Membership / Authorization

If the task changes:

- course membership
- join behavior
- roles
- archive/revoke behavior
- management authorization
- automatic learning eligibility

read:

docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md
docs/OPEN_QUESTIONS.md

For Claude Code, also use:

.claude/rules/auth.md

Important current rule:

CourseMembership.role is the authorization source.
Only active LEARNER memberships participate automatically in personal DailyPlan generation.

Do not invent unresolved revoke/rejoin/ownership-transfer behavior.

---

## 8. Authentication / API

If the task changes:

- Supabase Auth
- login/session handling
- authenticated API routes
- user identity propagation
- API error contracts
- API runtime wiring

read:

docs/API_V1_DRAFT.md
docs/DEV_STATUS.md

For Claude Code:

.claude/rules/auth.md
.claude/rules/api.md

Critical rules:

userId comes only from verified server-side authentication.
Use auth.getUser() for trusted identity.
Authenticate before constructing database runtime.
Do not expose raw infrastructure errors or secrets.

Current real route:

GET /api/daily-plan/today

Check `docs/DEV_STATUS.md` for known active issues before modifying it.

---

## 9. Database / PostgreSQL

If the task changes:

- schema
- migrations
- repositories
- transactions
- UnitOfWork
- Postgres runtime
- concurrency assumptions
- constraints
- triggers

read:

docs/DATABASE.md
docs/ARCHITECTURE.md
docs/DECISIONS/013-supabase-postgresql-as-v1-persistence.md
supabase/migrations/

For Claude Code:

.claude/rules/postgres.md

Also inspect relevant tests under:

supabase/tests/

Critical rules:

Migrations are forward-only.
Do not edit accepted historical migrations for new behavior.
PGlite does not prove real multi-connection concurrency.
Supabase-managed auth schema is not recreated in production migrations.

---

## 10. Attempts / submitAnswer

If the task changes answer submission, Attempt persistence, idempotency, correctness, or replay:

docs/DECISIONS/005-attempts-are-immutable.md
docs/DECISIONS/009-question-versioning.md
docs/DECISIONS/010-answer-submission-transaction-model.md
docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md
docs/DECISIONS/014-question-answer-model-v1.md
docs/DATABASE.md

Also inspect:

src/application/learning/submit-answer.ts
supabase/tests/postgres/submit-answer.test.ts

Do not mutate historical Attempts.

---

## 11. User Timezone / Local Day

If the task changes timezone persistence, local date, or Today day boundaries, inspect:

src/domain/user/timezone.ts
src/domain/user/local-date.ts
src/application/user/
docs/TODAY_TIMEZONE_EDGE_CASES.md

Relevant product rule:

Persisted user timezone is authoritative for DailyPlan local-day calculation.

Do not silently fall back to UTC when timezone is required.

---

## 12. Testing

If the task adds or changes tests:

docs/TESTING.md
docs/DEFINITION_OF_DONE.md

For Claude Code:

.claude/rules/testing.md

Prefer tests that protect behavior and invariants, not implementation details.

Distinguish:

unit-tested
PGlite integration-tested
reasoned under PostgreSQL semantics
real Supabase tested
browser E2E tested

Do not describe these as equivalent.

---

## 13. UI / Copy / Localization

If the task changes user-facing UI or copy:

docs/PRODUCT.md
docs/DEFINITION_OF_DONE.md
src/messages/
src/lib/locale.ts

For Cursor:

.cursor/rules/rtl-i18n.mdc

Critical defaults:

language: Hebrew
direction: RTL
locale: he-IL

Do not move domain or learning policy into UI components.

---

## 14. AI Features

If the task introduces AI behavior:

docs/DECISIONS/004-ai-is-not-the-learning-engine.md
docs/PRODUCT.md
docs/ARCHITECTURE.md

For Cursor:

.cursor/rules/ai.mdc

Critical principle:

AI may assist product workflows.
AI is not the deterministic real-time Learning Engine.

Prefer deterministic logic before AI where practical.

---

## 15. Durable Decisions

If a task materially changes:

- architecture
- persistence strategy
- domain boundaries
- security model
- provider strategy
- data ownership
- Learning Engine strategy

inspect:

docs/DECISIONS/

Create a new ADR when the decision is durable and cross-cutting.

Do not create ADRs for minor implementation details.

Do not rewrite accepted ADR history casually.

---

## 16. Planning the Next Slice

For deciding what to build next, start with:

docs/DEV_STATUS.md
docs/ROADMAP.md
docs/OPEN_QUESTIONS.md

The current core loop remains:

Course
→ Content
→ Starter / Today
→ Quiz
→ Attempt
→ Learner State
→ Next Best Action
→ Future Today

Prefer work that builds, validates, or protects this loop.

---

## 17. Review / Verification Workflows

For Claude Code:

/implement-slice
/checkpoint
/review-commit

Reviewer agents:

unlock-reviewer
unlock-db-reviewer
unlock-security-reviewer

Use only the reviewer relevant to the actual change.

Do not invoke every specialist automatically.

---

## 18. Conflict Rule

If sources appear to conflict:

1. do not silently choose
2. inspect committed code
3. inspect the relevant accepted ADR
4. inspect `docs/OPEN_QUESTIONS.md`
5. determine whether a document is historical, draft, operational, or canonical
6. surface unresolved conflict before implementation

Do not let a broad planning document silently override a specific accepted ADR.

---

## 19. Context Discipline

The purpose of this file is to reduce context usage.

Rules:

- read only what the task requires
- do not load all docs by default
- do not read `scratch/` by default
- do not carry old chat assumptions into a fresh session
- prefer current repository state over conversation history
- use `/clear` after major approved checkpoints or pushes

The goal is not maximum context.

The goal is the minimum trustworthy context needed for the current slice.
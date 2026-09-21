# UNLOCK — Context Map

Status: ACTIVE NAVIGATION GUIDE

Load level: WARM

Purpose: help developers and coding agents locate the **minimum trustworthy context** required for a specific task.

This file is a GPS.

It is not:

* a product specification;
* a development plan;
* a status report;
* an ADR;
* a testing policy;
* a telemetry policy;
* a historical record;
* a replacement for inspecting actual code.

Use it to locate context, then leave it.

---

# 1. Default Startup

For normal current development work, start with:

| Need                      | Source                          |
| ------------------------- | ------------------------------- |
| Repository-wide baseline  | `AGENTS.md`                     |
| Claude operating rules    | `CLAUDE.md`                     |
| What to execute now       | `docs/CHATGPT_PLAN.md`          |
| What is true now          | `docs/DEV_STATUS.md`            |
| Actual repository reality | Git + code + tests + migrations |

Load this Context Map only when you need help locating additional context.

Do not reconstruct current state from historical Runs.

---

# 2. Authority Quick Map

| Question                                   | Owner                                     |
| ------------------------------------------ | ----------------------------------------- |
| What is UNLOCK?                            | `docs/MASTER_SPEC.md` / `docs/PRODUCT.md` |
| What belongs in V1?                        | `docs/UNLOCK_V1_SCOPE.md`                 |
| What is the product sequence?              | `docs/UNLOCK_ROADMAP.md`                  |
| What should we do now?                     | `docs/CHATGPT_PLAN.md`                    |
| What is true now?                          | `docs/DEV_STATUS.md`                      |
| What has been durably decided?             | `docs/DECISIONS/**`                       |
| What is unresolved?                        | `docs/OPEN_QUESTIONS.md`                  |
| What terminology should we use?            | `docs/DOMAIN_GLOSSARY.md`                 |
| How is the system structured?              | `docs/ARCHITECTURE.md`                    |
| What does good testing mean?               | `docs/TESTING.md`                         |
| What verification should run now?          | `.claude/rules/testing.md`                |
| What quality bar must be met?              | `docs/DEFINITION_OF_DONE.md`              |
| How do we measure Run/context efficiency?  | `docs/RUN_TELEMETRY.md`                   |
| What useful work is deliberately deferred? | `docs/FOLLOW_UP_BACKLOG.md`               |
| What happened in past Runs?                | `docs/RUNS/**`                            |
| What temporary resume state exists?        | `scratch/development_checkpoint.md`       |

---

# 3. Architecture / Module Boundaries

Use for:

* dependency direction;
* placement of new code;
* cross-layer behavior;
* composition;
* runtime boundaries.

### Decision / design

* `docs/ARCHITECTURE.md`
* relevant ADR under `docs/DECISIONS/**`

### Rule

* `CLAUDE.md`
* relevant scoped `.claude/rules/**`

### Implementation

```text
src/app/              presentation / Next.js runtime / API
src/application/      use cases / ports / orchestration
src/domain/           domain + learning rules
src/infrastructure/   PostgreSQL / Supabase / provider adapters
```

### Tests

Inspect tests nearest the affected module first.

Do not use this map as a substitute for actual dependency inspection.

---

# 4. Learning Engine

Use for:

* Attempts;
* evidence;
* mastery;
* misconceptions;
* spaced retrieval;
* memory scheduling;
* learner-state updates;
* replay/rebuild;
* Next Best Action;
* ranking.

### Decision sources

* `docs/LEARNING_ENGINE.md`
* `docs/DOMAIN_GLOSSARY.md`
* relevant ADRs, especially:

  * ADR-004 — AI is not the Learning Engine
  * ADR-005 — Attempts are immutable
  * ADR-008 — FSRS memory scheduler
  * ADR-009 — Question versioning
  * ADR-012 — Attempt replay/rebuild

### Rule

`.claude/rules/learning-engine.md`

### Implementation

* `src/domain/learning/`
* `src/application/learning/`

### Tests

* nearby `__tests__/`
* relevant PostgreSQL tests under `supabase/tests/postgres/`
* `docs/GOLDEN_SCENARIOS.md` when scenario evidence mapping is useful

Do not load all Learning Engine design history by default.

---

# 5. Today / DailyPlan

Use for:

* Today generation;
* DailyPlan persistence;
* DailyPlanItems;
* same-day reuse;
* plan freezing;
* completion;
* Global Today;
* Course context;
* DailyPlan item answer/Skip.

### Decision sources

* ADR-016 — Global DailyPlan / Today semantics
* ADR-017 — New Material V1
* `docs/PRODUCT.md`
* `docs/DOMAIN_GLOSSARY.md`

### Rules

* `.claude/rules/learning-engine.md`
* `.claude/rules/postgres.md` when persistence is affected
* `.claude/rules/api.md` when routes are affected

### Implementation

* `src/application/dailyPlan/`
* `src/infrastructure/postgres/daily-plan-repository.ts`
* relevant DailyPlan Unit-of-Work code
* `src/app/api/daily-plan/`
* `src/app/(learner)/today/`

### Tests

* DailyPlan application tests
* DailyPlan repository/schema tests
* DailyPlan API/route tests
* Playwright Today flow when browser integration is the risk

Legacy `TodaySession` paths are compatibility/history unless the task explicitly targets them.

---

# 6. New Material / Fresh Learner

Use for:

* unseen Question discovery;
* fresh learner fallback;
* ordinary candidates vs New Material;
* no-evidence planning behavior.

### Decision source

ADR-017

### Supporting context

`docs/NEW_MATERIAL_EXPOSURE_MODEL.md`

Supporting analysis does not override ADR-017.

### Implementation

* `src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`
* `src/infrastructure/postgres/unseen-question-repository.ts`

### Tests

Search DailyPlan generation tests for New Material scenarios.

---

# 7. Courses / Membership / Join

Use for:

* OWNER / INSTRUCTOR / LEARNER;
* OPEN / AUTHORIZED_ONLY;
* CourseMembership;
* joining;
* management authorization;
* revoked/archived membership;
* automatic learner eligibility.

### Decision source

ADR-015

### Unresolved behavior

`docs/OPEN_QUESTIONS.md`

### Rules

* `.claude/rules/auth.md`
* `.claude/rules/api.md` when route behavior changes

### Implementation

* `src/domain/course/`
* `src/application/course/`
* Course and CourseMembership repositories under `src/infrastructure/postgres/`
* `src/app/join/[courseId]/`
* `src/app/(learner)/courses/`
* `src/app/api/courses/`

### Tests

Use nearest course/application/repository/route tests.

Do not invent unresolved revoke/rejoin or ownership-transfer behavior.

---

# 8. Instructor Authoring

Use for:

* Course lifecycle;
* Topics;
* Question drafts;
* Question editing;
* QuestionVersion publishing;
* instructor authorization.

### Decision / scope

* `docs/UNLOCK_V1_SCOPE.md`
* relevant Course/Question ADRs
* current implementation reality

### Rules

* `.claude/rules/auth.md`
* `.claude/rules/api.md`
* `.claude/rules/postgres.md` when persistence changes

### Implementation

* `src/application/course/`
* `src/application/topic/`
* `src/application/question/`
* corresponding `src/domain/**`
* corresponding PostgreSQL repositories
* instructor routes/UI under `src/app/`

### Tests

Use nearest application/repository/API tests.

Structured Import is separate future product scope.

---

# 9. Answer Submission / Attempts

Use for:

* correctness;
* Attempt persistence;
* idempotency;
* learning-state mutation;
* replay/rebuild;
* planned-item resolution.

### Decision sources

* ADR-005
* ADR-009
* ADR-010
* ADR-012
* ADR-014

### Rules

* `.claude/rules/learning-engine.md`
* `.claude/rules/postgres.md`
* `.claude/rules/api.md` for HTTP boundary

### Implementation

* `src/application/learning/submit-answer.ts`
* `src/application/dailyPlan/submit-daily-plan-item-answer.ts`
* relevant PostgreSQL repositories/UoW
* `src/app/api/daily-plan/items/[itemId]/answer/`

### Tests

* application answer-submission tests
* PostgreSQL answer-submission tests
* route/API tests

---

# 10. Skip

Use for DailyPlan Skip behavior.

### Decision source

ADR-016

### Implementation

* `src/application/dailyPlan/skip-daily-plan-item.ts`
* DailyPlan repository resolution methods
* `src/app/api/daily-plan/items/[itemId]/skip/`

### Tests

* application Skip tests
* route Skip tests
* `supabase/tests/postgres/skip-daily-plan-item.test.ts`

Skip is resolution, not an incorrect Attempt.

---

# 11. Question / QuestionVersion

Use for:

* authoring;
* immutable versioning;
* answer options;
* learner-safe reads;
* grading content.

### Decision sources

* ADR-009
* ADR-014
* `docs/DOMAIN_GLOSSARY.md`

### Implementation

* `src/domain/question/`
* `src/application/question/`
* Question repositories
* learner question-content repository
* grading/correctness path

### Key boundary

Learner-facing read models must not expose grading-only information before submission.

Historical Attempts remain linked to the exact QuestionVersion shown.

---

# 12. User Timezone / Local Day

Use for:

* persisted timezone;
* learner-local Today date;
* midnight boundaries;
* timezone setup.

### Decision / design

* accepted DailyPlan semantics
* `docs/TODAY_TIMEZONE_EDGE_CASES.md` when edge-case detail is needed

### Implementation

* `src/domain/user/timezone.ts`
* `src/domain/user/local-date.ts`
* `src/application/user/`
* `src/app/api/user/timezone/`
* PostgreSQL user/date mapping helpers

### Tests

Use timezone/local-date domain tests and relevant DailyPlan application tests.

Do not assume UTC date is the learner's Today date.

---

# 13. Authentication / Trusted Identity

Use for:

* Supabase Auth;
* server-side identity;
* login/session behavior;
* auth-before-DB ordering;
* secrets;
* authentication redirects.

### Rule

`.claude/rules/auth.md`

### Supporting docs

* relevant ADR
* `docs/API_V1_DRAFT.md` where API contract detail matters

### Implementation

* `src/infrastructure/supabase/`
* `src/app/login/`
* authenticated API routes
* `src/lib/safe-redirect.ts`

### Tests

Use nearest auth/route tests.

Do not use client-supplied `userId` as authority.

---

# 14. API / Route Work

Use for:

* request validation;
* route composition;
* DTOs;
* error mapping;
* trusted identity propagation;
* Node runtime.

### Rule

`.claude/rules/api.md`

### Implementation

`src/app/api/`

### Tests

Use nearest route/handler tests.

For security-sensitive routes, inspect auth/authorization ordering explicitly.

Do not implement domain policy inside route files.

---

# 15. Database / PostgreSQL / Migrations

Use for:

* migrations;
* SQL;
* repositories;
* constraints;
* Unit of Work;
* transactions;
* pooling;
* PostgreSQL semantics;
* concurrency assumptions.

### Decision / design

* `docs/DATABASE.md`
* `docs/PERSISTENCE_SCHEMA_V1.md`
* ADR-013 and relevant schema ADRs

### Rule

`.claude/rules/postgres.md`

### Implementation

* `supabase/migrations/`
* `src/infrastructure/postgres/`

### Tests

* `supabase/tests/postgres/`
* schema integration suite

### Current remote state

Use `docs/DEV_STATUS.md`.

Do not infer hosted migration state from committed files alone.

---

# 16. Testing / Verification

Use for:

* deciding what tests are meaningful;
* selecting current verification;
* determining stale vs fresh evidence;
* final relevant verification.

### Philosophy

`docs/TESTING.md`

### Operational rule

`.claude/rules/testing.md`

### Workflow

* `/implement-slice`
* `/review-commit`
* `/checkpoint`

### Golden scenario evidence

`docs/GOLDEN_SCENARIOS.md`

Do not use this Context Map as a test matrix.

---

# 17. Review

Use when implementation is ready for risk review.

### Owner

`.claude/skills/review-commit/`

### Reviewers

* `.claude/agents/unlock-reviewer.md`
* `.claude/agents/unlock-db-reviewer.md`
* `.claude/agents/unlock-security-reviewer.md`

Select reviewers by actual risk.

Do not invoke all specialists automatically.

---

# 18. Run Telemetry / Context Efficiency

Use for:

* Run duration;
* session metrics;
* token/context usage;
* prompt-cache behavior;
* file-access counts;
* re-reads;
* instruction loading;
* search/navigation activity;
* tool activity;
* compaction;
* subagent offload;
* Context Misses;
* unnecessary rechecks;
* Development OS efficiency analysis.

### Canonical policy

`docs/RUN_TELEMETRY.md`

This is the sole owner of telemetry definitions and measurement semantics.

### Runtime implementation

* `.claude/telemetry/collect.mjs`
* `.claude/telemetry/statusline.mjs`
* `.claude/telemetry/summarize.mjs`
* `.claude/settings.json`

### Raw local data

`scratch/telemetry/<RUN_ID>/`

Raw telemetry is temporary and non-canonical.

Do not load raw telemetry during normal implementation.

### Durable Run summary

`docs/RUNS/RUN_TEMPLATE.md`

Completed Run Reports under:

`docs/RUNS/**`

should retain only compact aggregate evidence and meaningful observations.

### Normal closeout flow

```text
Claude Code telemetry
→ scratch/telemetry/<RUN_ID>/
→ node .claude/telemetry/summarize.mjs
→ read summary.md
→ copy useful aggregate evidence into Run Report
```

### Important boundaries

Telemetry observes the development workflow.

It does not determine:

* required verification;
* reviewer selection;
* product behavior;
* architecture;
* correctness.

Do not:

* maintain a manual telemetry diary;
* load raw JSONL routinely;
* invent missing runtime metrics;
* optimize implementation merely to improve telemetry numbers;
* treat file reads, cache hit ratio, subagent count, or context usage as standalone quality scores.

For broad disposable investigation, subagents may be useful for protecting primary-session context when appropriate.

Run 007 is intended to be the first full baseline Run measured from the beginning under this telemetry model.

---

# 19. UI / Hebrew / RTL

Use for:

* learner-facing UI;
* instructor UI;
* Hebrew copy;
* RTL;
* mobile behavior;
* localization.

### Product source

`docs/PRODUCT.md`

### Quality bar

`docs/DEFINITION_OF_DONE.md`

### Implementation

* `src/app/`
* `src/components/`
* `src/messages/`
* `src/lib/locale.ts`

### Cursor rule

`.cursor/rules/rtl-i18n.mdc`

Do not move domain/learning policy into UI components.

---

# 20. AI-Assisted Features

Use for:

* AI content generation;
* AI verification;
* future content intelligence.

### Decision source

ADR-004

### Supporting sources

* `docs/PRODUCT.md`
* `docs/ARCHITECTURE.md`

### Tool rule

`.cursor/rules/ai.mdc`

AI may assist content workflows.

It must not become the deterministic real-time Learning Engine.

---

# 21. New Durable Decisions

When implementation exposes a durable cross-cutting choice involving:

* architecture;
* persistence;
* data ownership;
* security;
* Learning Engine strategy;
* major product semantics;

inspect:

* relevant existing ADR;
* `docs/OPEN_QUESTIONS.md`.

Create a new ADR only when the decision genuinely deserves durable recording.

Do not create ADRs for ordinary implementation details.

---

# 22. Current Execution vs Future Work

For current work:

`docs/CHATGPT_PLAN.md`

For strategic future sequencing:

`docs/UNLOCK_ROADMAP.md`

For deferred technical opportunities:

`docs/FOLLOW_UP_BACKLOG.md`

For unresolved decisions:

`docs/OPEN_QUESTIONS.md`

Do not move items between these categories casually.

---

# 23. Historical Context

Historical material includes:

* `docs/RUNS/**`;
* `docs/INVARIANT_MATRIX.md`;
* old implementation plans;
* superseded investigations.

Load historical context only when the current task specifically requires history.

Historical material does not override current accepted decisions or repository reality.

---

# 24. Scratch

`scratch/**` is temporary and non-canonical.

Current temporary resume state may live in:

`scratch/development_checkpoint.md`

Run telemetry may live temporarily in:

`scratch/telemetry/<RUN_ID>/`

Do not use scratch as:

* product truth;
* current durable status;
* canonical telemetry policy;
* historical archive.

Overwrite or discard temporary context when no longer needed.

---

# 25. Navigation Rule

When starting unfamiliar work:

```text
Task
→ identify decision source
→ load relevant scoped rule
→ inspect implementation
→ inspect nearest tests
→ expand context only if evidence requires it
```

For telemetry-specific work:

```text
Telemetry question
→ docs/RUN_TELEMETRY.md
→ inspect .claude/telemetry/** only if implementation detail is needed
→ inspect raw scratch telemetry only when diagnosing telemetry itself
```

Prefer the narrowest trustworthy context.

Do not load broad documentation trees preemptively.

Do not load telemetry raw data preemptively.

The goal is not maximum context.

The goal is:

> minimum context required to make a correct change.

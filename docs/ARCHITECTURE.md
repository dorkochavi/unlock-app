# UNLOCK Architecture

Status: Active architecture guide

Purpose: define the technical structure, module boundaries, data flow, and architectural constraints for UNLOCK.

This document does not replace `docs/MASTER_SPEC.md`.

The Master Spec defines the high-level product constitution.

This document explains how the product should be structured technically.

---

## 1. Architectural Principle

UNLOCK is built as a **modular monolith**.

This means:

* one primary application;
* one deployment unit;
* clear internal domain boundaries;
* shared infrastructure where appropriate;
* no premature microservices.

Modules should be separated by responsibility in code, not by independent infrastructure unless a future requirement clearly justifies it.

A modular monolith allows UNLOCK to remain:

* simple to develop;
* simple to test;
* simple to deploy;
* easy to refactor;
* low-cost;
* structurally ready to evolve.

---

## 2. Current Technology Direction

Current stack:

* Next.js
* TypeScript
* App Router
* Tailwind CSS
* PostgreSQL
* Supabase Auth
* Supabase-hosted PostgreSQL
* Vercel
* GitHub

Testing foundation:

* Vitest
* PGlite-backed schema/integration tests
* Playwright for browser-level E2E coverage

Development tools such as Claude Code and Cursor support implementation, but they are not part of the runtime architecture.

Future tools should only be added when a real requirement justifies them.

Do not add infrastructure because it may be useful later.

---

## 3. High-Level System Shape

UNLOCK is currently structured as a layered modular monolith.

Primary application layers:

```text
src/app/
    ↓
src/application/
    ↓
src/domain/

src/infrastructure/
    implements application/domain-facing persistence and provider boundaries
```

Conceptually:

```text
Presentation / HTTP Boundary
        ↓
Application Use Cases
        ↓
Domain Logic
        ↑
Infrastructure Adapters
        ↓
Database / External Providers
```

Primary repository locations:

```text
src/app/              Next.js UI, routes, API composition
src/application/      use cases and application ports
src/domain/           business and learning rules
src/infrastructure/   PostgreSQL, Supabase, repositories, Units of Work
```

Additional supporting folders may include:

```text
src/components/
src/features/
src/lib/
src/messages/
src/services/
src/types/
```

These supporting folders do not replace the primary dependency boundaries above.

Cross-cutting concerns include:

* localization;
* security;
* analytics;
* testing;
* AI provider abstraction;
* configuration.

The boundaries are conceptual responsibilities.

They do not require separate processes or deployments.

---

## 4. Presentation Layer

Primary locations:

```text
src/app/
src/components/
src/features/   where presentation-oriented feature code actually exists
```

Responsibilities:

* render UI;
* handle routing;
* collect user input;
* map HTTP/UI inputs into application calls;
* display application/domain results.

The presentation layer should not contain core learning decisions.

React components and route handlers should not calculate:

* mastery;
* review dates;
* Next Best Action;
* DailyPlan ranking;
* exam urgency formulas.

Presentation code should consume behavior provided by the application/domain layers rather than reimplementing it.

---

## 5. Application Layer

Primary location:

```text
src/application/
```

The application layer coordinates use cases and defines the ports required to execute them.

Current areas include:

```text
course/
dailyPlan/
learning/
question/
topic/
user/
```

Responsibilities may include:

* orchestrating domain operations;
* enforcing use-case sequencing;
* defining repository/Unit-of-Work interfaces;
* coordinating transactional application behavior;
* translating trusted inputs into domain operations;
* returning application-level results to routes/UI.

The application layer should not depend on Next.js presentation details.

It should also avoid embedding PostgreSQL-specific implementation details that belong in infrastructure.

Feature-oriented folders elsewhere in the repository may organize UI or supporting code, but they do not replace the application layer as the home of use-case orchestration.

---

## 6. Domain Logic

Primary location:

```text
src/domain/
```

Core business and learning behavior must remain independent from the presentation and infrastructure layers.

Current domain areas include:

```text
course/
dailyPlan/
learning/
question/
topic/
user/
```

Examples of domain behavior:

* learner state calculations;
* review scheduling;
* misconception tracking;
* Next Best Action ranking;
* DailyPlan planning;
* exam urgency calculations;
* question/content invariants.

Domain logic should be:

* deterministic where specified;
* testable without rendering React;
* independent from Next.js, Supabase SDK, and PostgreSQL implementation details;
* explicit about inputs and outputs;
* reproducible;
* versionable when behavior affects learning outcomes.

Where possible, domain functions should be pure.

---

## 7. Learning Intelligence Boundaries

UNLOCK uses conceptual intelligence boundaries called **Brains**.

Examples:

* Learner State Brain
* Next Best Action Brain
* Content Intelligence
* System Auditor
* Intervention Effectiveness

A Brain represents responsibility.

A Brain does NOT automatically imply:

* microservice;
* autonomous agent;
* LLM;
* separate database;
* separate process;
* separate deployment.

For V1:

* Learner State Brain is active;
* Next Best Action Brain is active;
* both are deterministic;
* advanced Brains remain inactive or architecture-ready unless specifically required.

---

## 8. Learning Engine

The Learning Engine is responsible for core adaptive learning behavior.

Its responsibilities include:

* updating learner signals;
* determining review needs;
* interpreting learning evidence;
* supporting Next Best Action ranking;
* contributing to Today planning.

Known learner signals include:

* `mastery_level`
* `next_review_date`
* `misconception_hits`
* `confidence_level`
* `average_time_seconds`

The exact V1 formulas should be based on validated prototype behavior where applicable.

Do not invent new learning formulas without explicit documentation and tests.

---

## 9. Today Planning

Today is represented by a persisted `DailyPlan` for the learner's current learner-local calendar day.

Expected conceptual flow:

```text
Learner State
+
Academic Context
+
Eligible Learning Content
↓
Next Best Action / DailyPlan Planning
↓
DailyPlan
↓
DailyPlanItems
↓
Quiz
```

Today planning determines what should be studied.

Quiz executes the prepared DailyPlan.

Quiz must not independently select replacement learning content in Today mode.

The accepted Global Today semantics are defined by ADR-016.

New Material fallback behavior is defined by ADR-017.

---

## 10. Quiz Boundary

Quiz is an execution layer.

Quiz responsibilities:

* display the current Question;
* collect a learner response;
* collect relevant response metadata;
* record an Attempt;
* move through the prepared DailyPlan.

Quiz must not own adaptive prioritization.

This separation protects learning logic from UI changes.

---

## 11. Data Model Principles

The database model should distinguish between:

### Shared content

Examples:

* Course
* Topic
* Material
* Question
* QuestionVersion

### Historical evidence

Example:

* Attempt

### Derived learner state

Examples:

* UserQuestionProgress
* Learner State

### Persisted daily-plan state

Examples:

* DailyPlan
* DailyPlanItem

Legacy `TodaySession` / `TodaySessionItem` structures may still exist in historical code, tests, or migrations, but they are not the primary current product/domain model for Today.

Do not collapse these categories into the same records merely for convenience.

---

## 12. Attempts Are Historical Evidence

Attempt represents what happened at a specific moment.

Attempts should be immutable after creation except for narrowly defined technical correction cases, if ever explicitly designed.

Do not update old Attempts to reflect:

* current mastery;
* new algorithms;
* revised progress;
* new review dates.

Derived state may be recalculated.

Historical evidence must remain preserved.

---

## 13. Derived State

Derived state represents the system's current interpretation of historical evidence.

Examples:

* UserQuestionProgress;
* Learner State;
* Next Best Action results.

Derived state may change as:

* new Attempts arrive;
* algorithms evolve;
* academic context changes.

Where learning behavior changes materially, engine versioning should allow results to be understood and reproduced.

---

## 14. DailyPlan Persistence

`DailyPlan` is persisted application/domain state for one learner and one learner-local calendar day.

The system must be able to:

* create the plan when needed;
* retrieve the same valid same-day plan;
* resume unresolved work;
* update DailyPlanItem resolution state;
* detect completion.

Accepted V1 semantics include:

* one DailyPlan per learner per learner-local day;
* Global Today and course-context Today use the same underlying DailyPlan;
* the plan is frozen by default after generation;
* same-day reload does not silently regenerate the plan;
* unresolved items do not automatically carry into the next learner-local day;
* the next learner-local day recalculates from current learner state.

Plan generation and plan execution remain separate responsibilities.

Detailed product semantics are owned by ADR-016 and ADR-017.

Legacy `TodaySession` persistence may remain where still technically required, but new architecture should not treat it as the primary Today model.

---

## 15. Course and Institution Boundary

Course is a core domain entity.

Institution is optional.

Architecture must support:

```text
Course
```

without requiring:

```text
Institution → Course
```

Institutional relationships may be added later.

Do not introduce mandatory multi-tenant institutional complexity into V1.

---

## 16. Exam Date Resolution

Academic urgency may depend on an effective exam date.

Status: OPEN — see `docs/OPEN_QUESTIONS.md` #2. The exact V1 hierarchy is not yet decided.

Illustrative candidate resolution order, not a settled rule:

```text
personal_exam_date
↓ if absent
group_exam_date
↓ if absent
null
```

Whatever hierarchy is finally decided should be implemented in one reusable domain location.

Do not duplicate exam-precedence logic across UI components or database queries.

The system must not fabricate a date when none exists.

---

## 17. AI Architecture

AI must be accessed through a provider-independent application boundary.

Product/domain code should not depend directly on a specific LLM vendor wherever practical.

Conceptually:

```text
Feature
↓
AI capability interface
↓
Provider adapter
↓
External AI provider
```

This allows:

* provider replacement;
* testing with mocks;
* cost tracking;
* feature flags;
* graceful failure.

Do not call an LLM for deterministic learning decisions.

---

## 18. AI Question Generation

AI-generated Question creation is separate from learner runtime.

Expected conceptual flow:

```text
Source Material
↓
Generation Pass
↓
Structured Candidate
↓
Rule Validation
↓
Independent AI Verification
↓
Verification State
↓
Eligible for learner use
```

Generated content may exist internally before it is learner-facing.

Verification must not happen on every learner interaction.

---

## 19. Provider Boundaries

External providers should be wrapped behind project-owned interfaces when their behavior is important to the application.

Examples may eventually include:

* AI;
* authentication;
* storage;
* analytics;
* email/notifications.

Do not create abstract provider systems before the provider is actually introduced.

One real implementation does not automatically justify a complex abstraction hierarchy.

---

## 20. Database Access

Primary persistence implementation lives under:

```text
src/infrastructure/
src/infrastructure/postgres/
src/infrastructure/supabase/
```

Database access should not be scattered randomly throughout UI components or route handlers.

Prefer clear application/infrastructure boundaries for:

* reads;
* writes;
* authorization-sensitive operations;
* transactional domain state updates.

Current infrastructure uses PostgreSQL with Supabase for hosted database/auth capabilities.

Current security baseline:

* trusted identity is resolved server-side;
* authorization is enforced at trusted server/application/database boundaries;
* service-role and database credentials remain server-only;
* existing accepted RLS behavior must be preserved where present;
* do not introduce or broaden RLS policies automatically unless an explicit security/database task or accepted decision requires it.

The repository/application boundary should remain simple and explicit.

Do not bypass application/domain rules by issuing ad hoc persistence mutations from presentation code.

---

## 21. Transactions and Learning Updates

Operations that must remain atomic should preserve data consistency through the existing Unit-of-Work / transaction boundaries.

Example:

```text
Learner submits answer
↓
Attempt is recorded
↓
Relevant learner progress is updated
↓
DailyPlanItem / DailyPlan state is updated when applicable
```

The system should avoid states where one required step succeeds and another silently fails in a way that corrupts learning data.

Current PostgreSQL infrastructure contains scoped Unit-of-Work implementations for different transactional boundaries.

Do not replace those scoped contracts with one broad global transaction abstraction merely to reduce duplication.

Shared transaction mechanics may be considered later only when they preserve the existing bounded responsibilities.

---

## 22. Validation

Inputs crossing important boundaries should be validated.

Examples:

* forms;
* API/server inputs;
* AI structured outputs;
* external-provider responses;
* uploaded/imported content.

Validation should happen at boundaries rather than relying on TypeScript types alone.

Zod is the intended direction when runtime schema validation becomes necessary.

Do not add validation libraries or schemas before they have an actual use.

---

## 23. Localization Architecture

User-facing copy should flow through:

```text
src/messages/
```

Application locale configuration may live under:

```text
src/lib/
```

Default:

* language: Hebrew;
* direction: RTL;
* locale: `he-IL`.

Technical identifiers remain English.

Avoid scattering hardcoded user-facing strings throughout components.

---

## 24. Error Handling

Failures should be explicit.

Do not silently hide failures involving:

* learning-state updates;
* Attempt creation;
* DailyPlan persistence;
* authorization;
* data integrity;
* AI verification.

User-facing error messages should remain understandable and should not expose sensitive implementation details.

Logging/observability infrastructure should be introduced when there is a concrete operational need.

---

## 25. Testing Architecture

Testing should mirror system risk and use the narrowest layer that proves the required behavior.

The canonical testing strategy is defined in `docs/TESTING.md`.

Operational verification selection, freshness, reuse, and escalation are owned by `.claude/rules/testing.md` for Claude Code.

### Domain tests

Highest priority for deterministic learning and business rules.

Use for:

* Learning Engine;
* Next Best Action;
* DailyPlan planning;
* accepted exam-date behavior once decided;
* deterministic calculations.

### Application / integration tests

Use when multiple boundaries must work together.

Examples:

* Attempt → progress update;
* DailyPlan persistence;
* transactional use cases;
* route/application wiring;
* database authorization behavior where applicable.

PGlite-backed schema/integration tests provide valuable local evidence but do not prove every real PostgreSQL, pooling, hosted Supabase, or concurrency behavior.

### UI tests

Focus on important interaction behavior.

Avoid testing framework implementation details.

### End-to-end tests

Playwright is part of the current repository testing stack.

Browser-level E2E should remain focused on critical product flows rather than attempting exhaustive coverage.

Current or expected examples include:

* authentication/join behavior;
* learner golden path;
* Today / DailyPlan execution;
* important instructor flows as they become pilot-critical.

Do not rerun expensive test layers merely because a lifecycle boundary was reached if valid relevant evidence already exists.

---

## 26. Project Folder Structure

Current high-level structure:

```text
src/
├── app/
├── application/
├── domain/
├── infrastructure/
├── components/
├── features/
├── lib/
├── messages/
├── services/
└── types/
```

The primary architectural dependency boundaries are:

```text
app / presentation
        ↓
application
        ↓
domain

infrastructure
        → implements persistence/provider boundaries used by application/domain
```

Existing folders should be evolved deliberately rather than replaced with a parallel speculative structure.

Do not create deep folder hierarchies before they are needed.

Prefer discoverability and current repository conventions over theoretical purity.

---

## 27. Shared Components

`src/components/` should contain genuinely reusable presentation components.

Do not move a component into shared components merely because it might someday be reused.

Feature-specific components should stay near their feature until reuse is real.

---

## 28. Shared Utilities

`src/lib/` is intended for small reusable application utilities and shared technical primitives.

Avoid turning `lib/` into a miscellaneous dumping ground.

Domain-specific logic should remain associated with its domain.

---

## 29. Services

`src/services/` may contain boundaries to infrastructure or external capabilities when they actually exist.

Possible future examples:

* AI provider service;
* storage service;
* analytics service.

Do not create empty service abstractions for future ideas.

---

## 30. Domain Types

Domain types should be explicit.

Avoid representing meaningful domain concepts as anonymous object shapes repeated across the codebase.

Current domain concepts such as:

* Attempt;
* UserQuestionProgress;
* DailyPlan;
* DailyPlanItem;
* Question;
* QuestionVersion;
* Next Best Action;

should have clear TypeScript contracts in the appropriate existing layer.

Do not define large speculative models before the relevant product/data decision is accepted.

---

## 31. Security Architecture

Authorization must be enforced on trusted server/database boundaries.

The UI is not a security boundary.

Never assume that hiding a button prevents unauthorized actions.

Security includes:

* authentication;
* authorization;
* data ownership;
* accepted data-access controls, including RLS where explicitly applicable;
* secret management;
* validation;
* safe external-provider access.

---

## 32. Data Ownership

Learner data belongs to its authorized context.

Do not allow unrelated users to access:

* Attempts;
* progress;
* uploaded private Materials;
* personal academic data.

Institutional sharing rules will be defined when institutional capabilities are introduced.

Do not prebuild those sharing models now.

---

## 33. Cost-Efficient Architecture

Preferred solution order:

```text
Existing capability
↓
Deterministic application logic
↓
Database / SQL / statistics
↓
Cache / precomputation
↓
External provider
↓
AI
```

Recurring infrastructure cost should have a concrete reason.

Cost efficiency must not compromise:

* data integrity;
* security;
* correctness;
* essential reliability.

---

## 34. No Premature Distributed Architecture

Do not introduce without demonstrated need:

* microservices;
* message brokers;
* queues;
* background-worker platforms;
* event buses;
* vector databases;
* multiple databases;
* generalized plugin frameworks.

Future requirements may justify them.

The current architecture should not assume they are required.

---

## 35. Architecture-Ready Means Avoiding Dead Ends

Architecture-ready does not mean building future functionality.

It means avoiding decisions that make likely future extensions unnecessarily difficult.

Example:

Good:

```text
Course may optionally reference Institution later.
```

Bad:

```text
Build Institution Admin, tenancy, roles, dashboards,
and organization billing now because institutions may exist later.
```

Favor cheap extension points over speculative implementation.

---

## 36. Documentation and Contracts

Significant implementation work should be grounded in the relevant accepted sources.

Depending on the task, these may include:

* `docs/MASTER_SPEC.md`;
* `docs/PRODUCT.md`;
* `docs/UNLOCK_V1_SCOPE.md`;
* `docs/UNLOCK_ROADMAP.md`;
* `docs/ARCHITECTURE.md`;
* `docs/DOMAIN_GLOSSARY.md`;
* `docs/DECISIONS/*.md`;
* `docs/OPEN_QUESTIONS.md`.

Feature contracts under `docs/FEATURES/` are optional and proportional.

Use one when a complex feature benefits from a durable feature-specific behavior contract.

Do not require or create a large Feature Contract for every meaningful code change.

Code should implement accepted behavior.

Code should not silently redefine product concepts.

---

## 37. Architecture Change Rule

A change should be treated as architectural if it materially affects:

* module boundaries;
* data ownership;
* persistence strategy;
* core domain contracts;
* external providers;
* security model;
* learning-engine behavior;
* deployment topology.

Before making such a change:

1. inspect current architecture;
2. identify affected contracts;
3. produce a plan;
4. document the durable decision if necessary;
5. obtain approval before implementation.

---

## 38. Current Architecture Priority

The current goal is not to build every architectural capability.

The goal is to keep this loop structurally clean:

```text
Course / Content
↓
DailyPlan Planning
↓
DailyPlan
↓
Quiz
↓
Attempt
↓
Learner State Update
↓
Next Best Action
↓
Future DailyPlan / Today
```

If an architectural choice does not help this loop, protect it, or avoid a clear future dead end, it is probably not a current priority.

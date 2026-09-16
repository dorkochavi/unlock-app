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

- one primary application;
- one deployment unit;
- clear internal domain boundaries;
- shared infrastructure where appropriate;
- no premature microservices.

Modules should be separated by responsibility in code, not by independent infrastructure unless a future requirement clearly justifies it.

A modular monolith allows UNLOCK to remain:

- simple to develop;
- simple to test;
- simple to deploy;
- easy to refactor;
- low-cost;
- structurally ready to evolve.

---

## 2. Current Technology Direction

Current stack:

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- PostgreSQL
- Supabase direction for database/auth when introduced
- Vercel
- GitHub
- Cursor

Testing foundation:

- Vitest

Future tools should only be added when a real requirement justifies them.

Do not add infrastructure because it may be useful later.

---

## 3. High-Level System Shape

Conceptually, UNLOCK is divided into the following layers:

```text
UI / Routes
↓
Application / Feature Logic
↓
Domain Logic
↓
Data Access / Services
↓
Database / External Providers
```

Cross-cutting concerns include:

- localization;
- security;
- analytics;
- testing;
- AI provider abstraction;
- configuration.

The boundaries are conceptual responsibilities.

They do not require separate processes or deployments.

---

## 4. Presentation Layer

Primary location:

```text
src/app/
src/components/
```

Responsibilities:

- render UI;
- handle routing;
- collect user input;
- display state;
- call application/domain operations.

The presentation layer should not contain core learning decisions.

React components should not calculate:

- mastery;
- review dates;
- Next Best Action;
- Today ranking;
- exam urgency formulas.

UI should consume already-calculated domain results.

---

## 5. Feature Layer

Primary location:

```text
src/features/
```

Feature modules organize product behavior around meaningful product capabilities.

Possible feature areas include:

```text
course/
materials/
questions/
today/
quiz/
progress/
exams/
```

A feature may contain:

- UI components specific to that feature;
- application logic;
- feature-specific types;
- feature-specific validation;
- feature-specific tests.

Feature folders should not become independent mini-applications.

Shared domain behavior belongs in the appropriate domain/service layer rather than being duplicated.

---

## 6. Domain Logic

Core business and learning behavior must remain independent from the presentation layer.

Examples:

- learner state calculations;
- review scheduling;
- misconception tracking;
- Next Best Action ranking;
- Today planning;
- exam urgency calculations;
- verification-state transitions.

Domain logic should be:

- deterministic where specified;
- testable without rendering React;
- explicit about inputs and outputs;
- reproducible;
- versionable when behavior affects learning outcomes.

Where possible, domain functions should be pure.

---

## 7. Learning Intelligence Boundaries

UNLOCK uses conceptual intelligence boundaries called **Brains**.

Examples:

- Learner State Brain
- Next Best Action Brain
- Content Intelligence
- System Auditor
- Intervention Effectiveness

A Brain represents responsibility.

A Brain does NOT automatically imply:

- microservice;
- autonomous agent;
- LLM;
- separate database;
- separate process;
- separate deployment.

For V1:

- Learner State Brain is active;
- Next Best Action Brain is active;
- both are deterministic;
- advanced Brains remain inactive or architecture-ready unless specifically required.

---

## 8. Learning Engine

The Learning Engine is responsible for core adaptive learning behavior.

Its responsibilities include:

- updating learner signals;
- determining review needs;
- interpreting learning evidence;
- supporting Next Best Action ranking;
- contributing to Today planning.

Known learner signals include:

- `mastery_level`
- `next_review_date`
- `misconception_hits`
- `confidence_level`
- `average_time_seconds`

The exact V1 formulas should be based on validated prototype behavior where applicable.

Do not invent new learning formulas without explicit documentation and tests.

---

## 9. Today Planning

Today is generated before Quiz execution.

Expected conceptual flow:

```text
Learner State
+
Academic Context
+
Eligible Learning Content
↓
Next Best Action / Today Planning
↓
Today Session
↓
Today Session Items
↓
Quiz
```

Today planning determines what should be studied.

Quiz executes the prepared plan.

Quiz must not independently select learning content in Today mode.

---

## 10. Quiz Boundary

Quiz is an execution layer.

Quiz responsibilities:

- display the current Question;
- collect a learner response;
- collect relevant response metadata;
- record an Attempt;
- move through the prepared session.

Quiz must not own adaptive prioritization.

This separation protects learning logic from UI changes.

---

## 11. Data Model Principles

The database model should distinguish between:

### Shared content

Examples:

- Course
- Material
- Question

### Historical evidence

Example:

- Attempt

### Derived learner state

Examples:

- UserQuestionProgress
- Learner State

### Session state

Examples:

- Today Session
- Today Session Item

Do not collapse these categories into the same records merely for convenience.

---

## 12. Attempts Are Historical Evidence

Attempt represents what happened at a specific moment.

Attempts should be immutable after creation except for narrowly defined technical correction cases, if ever explicitly designed.

Do not update old Attempts to reflect:

- current mastery;
- new algorithms;
- revised progress;
- new review dates.

Derived state may be recalculated.

Historical evidence must remain preserved.

---

## 13. Derived State

Derived state represents the system's current interpretation of historical evidence.

Examples:

- UserQuestionProgress;
- Learner State;
- Next Best Action results.

Derived state may change as:

- new Attempts arrive;
- algorithms evolve;
- academic context changes.

Where learning behavior changes materially, engine versioning should allow results to be understood and reproduced.

---

## 14. Today Session Persistence

Today Session is persistent application state.

Once generated, a session should not be recreated unnecessarily.

The system should be able to:

- create a session;
- retrieve it;
- resume it;
- update item/session progress;
- mark it completed.

Session generation and session execution must remain separate operations.

Exact persistence rules belong in the Today feature contract.

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

Resolution order:

```text
personal_exam_date
↓ if absent
group_exam_date
↓ if absent
null
```

The resolution should be implemented in one reusable domain location.

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

- provider replacement;
- testing with mocks;
- cost tracking;
- feature flags;
- graceful failure.

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

- AI;
- authentication;
- storage;
- analytics;
- email/notifications.

Do not create abstract provider systems before the provider is actually introduced.

One real implementation does not automatically justify a complex abstraction hierarchy.

---

## 20. Database Access

Database access should not be scattered randomly throughout UI components.

Prefer clear server/application boundaries for:

- reads;
- writes;
- authorization-sensitive operations;
- domain state updates.

When Supabase is introduced:

- service-role credentials remain server-side;
- RLS is required;
- policies are tested;
- users only access authorized data.

The exact repository/data-access pattern should remain simple unless complexity requires more abstraction.

---

## 21. Transactions and Learning Updates

Operations that logically belong together should preserve data consistency.

Example:

```text
Learner submits answer
↓
Attempt is recorded
↓
Relevant learner progress is updated
↓
Session item/session state is updated
```

The system should avoid states where one step succeeds and another silently fails in a way that corrupts learning data.

The exact transaction strategy will be defined with the database implementation.

---

## 22. Validation

Inputs crossing important boundaries should be validated.

Examples:

- forms;
- API/server inputs;
- AI structured outputs;
- external-provider responses;
- uploaded/imported content.

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

- language: Hebrew;
- direction: RTL;
- locale: `he-IL`.

Technical identifiers remain English.

Avoid scattering hardcoded user-facing strings throughout components.

---

## 24. Error Handling

Failures should be explicit.

Do not silently hide failures involving:

- learning-state updates;
- Attempt creation;
- Today persistence;
- authorization;
- data integrity;
- AI verification.

User-facing error messages should remain understandable and should not expose sensitive implementation details.

Logging/observability infrastructure should be introduced when there is a concrete operational need.

---

## 25. Testing Architecture

Testing should mirror system risk.

### Domain tests

Highest priority.

Use for:

- Learning Engine;
- Next Best Action;
- exam precedence;
- verification transitions;
- deterministic calculations.

### Integration tests

Use when multiple system boundaries must work together.

Examples:

- Attempt → progress update;
- Today session persistence;
- database authorization.

### UI tests

Focus on important interaction behavior.

Avoid testing framework implementation details.

### End-to-end tests

Introduce when core flows are stable enough to justify browser automation.

Likely future examples:

- onboarding → Today;
- Today → Quiz → completion;
- resume Today session.

Do not introduce heavy E2E tooling before these flows exist.

---

## 26. Project Folder Direction

Expected high-level structure:

```text
src/
├── app/
├── components/
├── features/
├── lib/
├── messages/
├── services/
└── types/
```

The exact structure may evolve as real code appears.

Do not create deep folder hierarchies before they are needed.

Prefer discoverability over theoretical purity.

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

- AI provider service;
- storage service;
- analytics service.

Do not create empty service abstractions for future ideas.

---

## 30. Domain Types

Domain types should be explicit.

Avoid representing meaningful domain concepts as anonymous object shapes repeated across the codebase.

As implementation begins, concepts such as:

- Attempt;
- LearnerState;
- QuestionProgress;
- TodayPlan;
- NextBestAction;

should have clear TypeScript contracts.

Do not define large speculative models before the data/domain design is approved.

---

## 31. Security Architecture

Authorization must be enforced on trusted server/database boundaries.

The UI is not a security boundary.

Never assume that hiding a button prevents unauthorized actions.

Security includes:

- authentication;
- authorization;
- data ownership;
- RLS where applicable;
- secret management;
- validation;
- safe external-provider access.

---

## 32. Data Ownership

Learner data belongs to its authorized context.

Do not allow unrelated users to access:

- Attempts;
- progress;
- uploaded private Materials;
- personal academic data.

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

- data integrity;
- security;
- correctness;
- essential reliability.

---

## 34. No Premature Distributed Architecture

Do not introduce without demonstrated need:

- microservices;
- message brokers;
- queues;
- background-worker platforms;
- event buses;
- vector databases;
- multiple databases;
- generalized plugin frameworks.

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

Before a significant feature is implemented, the relevant architecture and product contracts should be clear.

Relevant sources may include:

- `docs/MASTER_SPEC.md`
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_GLOSSARY.md`
- `docs/FEATURES/*.md`
- `docs/DECISIONS/*.md`

Code should implement documented behavior.

Code should not silently redefine product concepts.

---

## 37. Architecture Change Rule

A change should be treated as architectural if it materially affects:

- module boundaries;
- data ownership;
- persistence strategy;
- core domain contracts;
- external providers;
- security model;
- learning-engine behavior;
- deployment topology.

Before making such a change:

1. inspect current architecture;
2. identify affected contracts;
3. produce a plan;
4. document the durable decision if necessary;
5. obtain approval before implementation.

---

## 38. Current Architecture Priority

The current goal is not to build every architectural capability.

The goal is to make this loop structurally clean:

```text
Course / Content
↓
Today Planning
↓
Today Session
↓
Quiz
↓
Attempt
↓
Learner State Update
↓
Next Best Action
↓
Future Today
```

If an architectural choice does not help this loop, protect it, or avoid a clear future dead end, it is probably not a current priority.

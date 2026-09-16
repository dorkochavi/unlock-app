# UNLOCK Feature Contract Template

Status: Active feature-specification template

Purpose: define the minimum product, domain, data, analytics, and delivery contract required before implementing a meaningful UNLOCK feature.

Create one file per significant feature under:

```text
docs/FEATURES/
```

Recommended naming:

```text
TODAY.md
QUIZ.md
STARTER.md
COURSE.md
PROGRESS.md
```

Do not create a feature contract for trivial implementation details.

---

# Feature: <FEATURE NAME>

Status: DRAFT

Owner: <optional>

Last updated: <YYYY-MM-DD>

---

## 1. Purpose

What problem does this feature solve?

Explain the feature in one concise paragraph.

Avoid implementation detail here.

---

## 2. User Goal

What is the user trying to achieve?

Example:

> As a learner, I want to resume today's learning session so I do not lose progress when I leave and return later.

---

## 3. Primary Users

Who uses this feature?

Examples:

- Learner
- Instructor
- Institution Admin
- Platform Admin

For V1, prefer the minimum required roles.

Do not introduce future roles into the feature unless the feature truly requires them.

---

## 4. Entry Points

How does the user reach this feature?

Examples:

- home / Today screen;
- Course page;
- post-onboarding flow;
- direct deep link;
- session resume.

List only real entry points.

---

## 5. Preconditions

What must already be true before this feature can work?

Examples:

- learner is authenticated;
- Course exists;
- learner has access to Course;
- Questions exist;
- Today Session has been generated.

Do not hide prerequisites inside implementation code.

---

## 6. Core Flow

Describe the expected happy-path behavior step by step.

Example:

```text
1. Learner opens Today
2. Existing active Today Session is checked
3. Existing session is resumed if valid
4. Otherwise a new plan is generated
5. Learner starts
6. Quiz executes prepared Today Session Items
7. Session completes
```

Keep the flow product-focused.

---

## 7. Business Rules

List the rules that must always hold.

Examples:

```text
- Quiz does not choose Today Questions
- A valid active Today Session must be resumed
- Attempts are immutable
- A Course does not require an Institution
```

Each important rule should be testable.

---

## 8. Feature States

List meaningful states.

Example:

```text
EMPTY
READY
STARTED
IN_PROGRESS
COMPLETED
EXPIRED
ERROR
```

For each state, define:

- what it means;
- how the feature enters it;
- how it leaves it.

Do not add states simply because they sound useful.

---

## 9. Required Data

What data does the feature need?

Examples:

- user_id;
- course_id;
- Today Session;
- Today Session Items;
- UserQuestionProgress;
- effective exam date.

Separate:

```text
source data
derived data
session state
```

where useful.

---

## 10. Outputs and Side Effects

What changes when the feature runs?

Examples:

- Attempt created;
- Today Session status updated;
- UserQuestionProgress updated;
- analytics event emitted.

Do not omit side effects that matter for data integrity.

---

## 11. Permissions and Ownership

Who may:

- view;
- create;
- update;
- delete;
- complete;

the feature's data?

Define the authorization boundary.

Do not rely on UI visibility for security.

---

## 12. Edge Cases

Document relevant edge cases.

Examples:

- missing data;
- no Questions available;
- duplicate submission;
- refresh;
- returning after long inactivity;
- session expired;
- invalid Course access;
- insufficient learner evidence;
- network failure;
- concurrent requests.

If behavior is unresolved, reference `docs/OPEN_QUESTIONS.md`.

---

## 13. Validation

What must be validated?

Examples:

- request payloads;
- identifiers;
- ownership;
- Question response shape;
- structured AI output;
- dates;
- status transitions.

Distinguish TypeScript compile-time types from runtime validation.

---

## 14. Analytics

What product question are we trying to answer?

Then define only the events required to answer it.

Example:

Product question:

> Do learners start and complete Today?

Events:

```text
today_opened
today_started
session_completed
session_abandoned
```

For each event, define useful properties only.

Do not add analytics fields without a reason.

---

## 15. Background Processing

Does the feature require background work?

Choose one:

```text
NO
YES
TBD
```

If YES, explain why synchronous execution is insufficient.

Do not introduce queues/workers merely because they may be useful later.

---

## 16. AI Usage

Does the feature use AI?

Choose one:

```text
NO
YES
TBD
```

If YES, define:

- exact purpose;
- input;
- output schema;
- provider boundary;
- fallback behavior;
- verification requirements;
- whether output can directly affect learner state.

Critical rule:

AI must not silently replace deterministic Learning Engine behavior.

---

## 17. Learning Engine Interaction

Does the feature read from or write to learning state?

Define:

- inputs into the engine;
- outputs from the engine;
- version dependencies;
- when recalculation occurs;
- whether a controlled clock is required.

If the feature does not interact with learning logic, write:

```text
NONE
```

---

## 18. RTL / Localization

Define user-facing requirements.

Default assumptions:

```text
language: Hebrew
direction: RTL
locale: he-IL
```

All learner-facing copy should use the messages layer where practical.

Check:

- directional icons;
- navigation;
- mixed Hebrew/English text;
- numbers;
- dates;
- forms;
- progress UI.

---

## 19. Accessibility

Consider:

- semantic HTML;
- keyboard access;
- focus order;
- labels;
- error communication;
- disabled states;
- touch target size;
- screen-reader meaning.

List any feature-specific accessibility risks.

---

## 20. Error Behavior

Define how the feature should behave when key operations fail.

Examples:

- data load fails;
- Attempt creation fails;
- progress update fails;
- authorization fails;
- AI provider fails;
- session persistence fails.

Avoid silent failure for learning-critical operations.

---

## 21. Loading Behavior

Define what the user sees while required data is loading.

Avoid UI that accidentally suggests:

```text
nothing to study
```

when the real state is:

```text
still loading
```

---

## 22. Empty State

Define the true empty state.

Examples:

- no Course exists;
- no Questions exist;
- insufficient learner evidence;
- nothing currently due.

These states may require different user experiences.

Do not collapse all of them into one generic empty screen.

---

## 23. Data Integrity Invariants

List invariants that must remain true.

Examples:

```text
- One Attempt represents one submitted answer event
- Shared Question content is not learner progress
- Today Session Items preserve the generated plan
- Progress updates do not rewrite Attempt history
```

These should influence database constraints and tests.

---

## 24. Performance Expectations

Only define meaningful expectations.

Examples:

- Today should open without requiring an LLM call;
- Question navigation should feel immediate;
- current session retrieval should use indexed queries.

Do not create arbitrary performance targets without evidence.

---

## 25. Cost Expectations

State any meaningful cost constraints.

Examples:

- no AI call per Question answer;
- reuse persisted Today Session;
- avoid repeated expensive content processing.

If no special cost issue exists, write:

```text
No feature-specific cost requirement beyond project defaults.
```

---

## 26. Out of Scope

Explicitly state what this feature does not include.

This is important for preventing scope creep.

Example:

```text
Out of scope for Today V1:
- leaderboards
- social sharing
- instructor dashboard
- AI Coach
- manual session builder
```

---

## 27. Open Questions

List unresolved decisions.

Each meaningful unresolved question should either:

- link to `docs/OPEN_QUESTIONS.md`;
- be added there;
- be resolved before implementation if it affects correctness.

Do not bury unresolved behavior in TODO comments.

---

## 28. Dependencies

List required product/technical dependencies.

Examples:

- Course access;
- Question model;
- Learning Engine;
- authentication;
- database;
- messages layer.

Do not list speculative future integrations.

---

## 29. Related Documents

Examples:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
docs/ARCHITECTURE.md
docs/DOMAIN_GLOSSARY.md
docs/DATABASE.md
docs/TESTING.md
docs/OPEN_QUESTIONS.md
docs/DECISIONS/<relevant-adr>.md
```

Include only documents relevant to the feature.

---

## 30. Required Tests

List tests before implementation.

Organize where useful into:

### Unit

Example:

```text
- deterministic ranking rule
- status transition
```

### Integration

Example:

```text
- submission creates Attempt and updates progress
```

### UI

Example:

```text
- resume action is visible for active session
```

### E2E

Example:

```text
- start → leave → return → resume same session
```

Do not require every test type for every feature.

---

## 31. Definition of Done

Feature-specific completion requirements.

At minimum, the feature should satisfy:

- approved behavior implemented;
- important edge cases handled;
- tests pass;
- lint/typecheck pass;
- build passes when relevant;
- RTL reviewed;
- accessibility reviewed;
- analytics implemented if required;
- docs updated;
- no unresolved correctness question remains hidden.

Also follow:

```text
docs/DEFINITION_OF_DONE.md
```

---

## 32. Rollout / Feature Flag

Choose:

```text
NOT NEEDED
REQUIRED
TBD
```

If REQUIRED, define:

- who gets access;
- default state;
- rollback behavior.

Do not add a generalized feature-flag platform unless justified.

---

## 33. Migration / Existing Data Impact

Does the feature affect existing persisted data?

Choose:

```text
NO
YES
TBD
```

If YES, define:

- migration;
- backfill;
- version compatibility;
- rollback considerations.

---

## 34. Security Review

List any feature-specific security concerns.

Examples:

- access to private Course data;
- cross-user progress leakage;
- privileged server action;
- uploaded content;
- AI prompt injection from source content.

If none beyond project defaults, say so explicitly.

---

## 35. Change Log

Use a lightweight record.

Example:

```text
2026-09-16 — Initial contract created
```

Add entries only for meaningful contract changes.

Do not mirror Git history line by line.

---

# Feature Contract Rule

A feature contract should remove ambiguity before code makes ambiguity expensive.

The goal is not exhaustive paperwork.

The goal is to make sure everyone can answer:

```text
What is this feature?
Who is it for?
What rules must hold?
What data changes?
What can fail?
How do we test it?
What is explicitly not included?
```

If those answers are clear, the contract has done its job.

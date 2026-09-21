# UNLOCK Feature Contract Template

Status: OPTIONAL / ON-DEMAND feature-specification template

Load level: COLD

Purpose: provide a structured product/domain contract when a feature is complex enough to benefit from durable feature-specific documentation.

A Feature Contract is **not required for every meaningful code change**.

Use this template when a feature has enough behavioral complexity, cross-layer impact, or durable product rules that a dedicated contract will materially improve implementation and future understanding.

Do not create a Feature Contract merely because:

* a code change is non-trivial;
* multiple files are affected;
* a workflow says documentation should exist;
* the feature could theoretically be documented in more detail.

Prefer existing canonical sources when they already define the behavior sufficiently:

* `docs/MASTER_SPEC.md`
* `docs/PRODUCT.md`
* `docs/UNLOCK_V1_SCOPE.md`
* `docs/ARCHITECTURE.md`
* `docs/DOMAIN_GLOSSARY.md`
* `docs/DECISIONS/**`
* `docs/OPEN_QUESTIONS.md`

When a dedicated Feature Contract is genuinely useful, create one file under:

```text
docs/FEATURES/
```

Recommended naming examples:

```text
TODAY.md
QUIZ.md
STARTER.md
COURSE.md
PROGRESS.md
```

Feature Contracts are supporting product/domain documentation.

They do not own:

* current Run sequencing;
* generic testing policy;
* reviewer selection;
* Development OS workflow;
* repository current state.

Do not create a Feature Contract for trivial implementation details.

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

> As a learner, I want to resume today's learning plan so I do not lose progress when I leave and return later.

---

## 3. Primary Users

Who uses this feature?

Examples:

* Learner
* Instructor
* Platform Admin

For V1, prefer the minimum required roles.

Do not introduce future roles into the feature unless the feature truly requires them.

---

## 4. Entry Points

How does the user reach this feature?

Examples:

* home / Today screen;
* Course page;
* post-onboarding flow;
* direct deep link;
* resume of an existing persisted flow.

List only real entry points.

---

## 5. Preconditions

What must already be true before this feature can work?

Examples:

* learner is authenticated;
* Course exists;
* learner has access to Course;
* Questions exist;
* DailyPlan has been generated for the learner-local day, when the feature depends on Today.

Do not hide prerequisites inside implementation code.

---

## 6. Core Flow

Describe the expected happy-path behavior step by step.

Example:

```text
1. Learner opens Today
2. Existing DailyPlan for the learner-local day is checked
3. Existing persisted plan is reused when present
4. Otherwise a new DailyPlan is generated
5. Learner starts or resumes
6. Learner executes persisted DailyPlanItems
7. DailyPlan reaches completion when all relevant items are resolved
```

Keep the flow product-focused.

Do not use legacy `TodaySession` semantics as the default model for current Today behavior.

---

## 7. Business Rules

List the rules that must always hold.

Examples:

```text
- Quiz does not independently choose Today Questions
- A valid persisted DailyPlan is reused for the same learner-local day
- Attempts are immutable historical evidence
- DailyPlan placement alone does not create learner evidence
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
IN_PROGRESS
COMPLETED
ERROR
```

For each state, define:

* what it means;
* how the feature enters it;
* how it leaves it.

Do not add states simply because they sound useful.

Use existing domain/application state where it already exists rather than inventing a second feature-level state machine.

---

## 9. Required Data

What data does the feature need?

Examples:

* user identity;
* Course identity;
* DailyPlan;
* DailyPlanItems;
* QuestionVersion;
* UserQuestionProgress;
* learner timezone;
* valid exam context where relevant.

Separate where useful:

```text
source data
derived data
persisted plan state
learner evidence
```

Do not require data that the feature does not actually use.

---

## 10. Outputs and Side Effects

What changes when the feature runs?

Examples:

* Attempt created;
* DailyPlanItem resolved;
* UserQuestionProgress updated;
* analytics event emitted.

Separate:

* durable writes;
* derived-state updates;
* user-visible output;
* analytics/observability.

Do not omit side effects that matter for data integrity.

---

## 11. Permissions and Ownership

Who may:

* view;
* create;
* update;
* resolve;
* manage;

the feature's data?

Define the authorization boundary.

Authentication does not automatically grant authorization.

Do not rely on UI visibility for security.

Prefer trusted server-derived identity and ownership.

---

## 12. Edge Cases

Document relevant edge cases.

Examples:

* missing data;
* no Questions available;
* duplicate submission;
* retry;
* refresh;
* returning after inactivity;
* already-resolved item;
* invalid Course access;
* missing learner timezone;
* insufficient learner evidence;
* network failure;
* concurrent requests;
* stale or legacy persisted state.

If behavior is unresolved, reference `docs/OPEN_QUESTIONS.md`.

Do not invent product policy merely to make an edge case easy to implement.

---

## 13. Validation

What must be validated?

Examples:

* request payloads;
* identifiers;
* ownership;
* Question response shape;
* status transitions;
* dates/timezone input;
* structured AI output.

Distinguish TypeScript compile-time types from runtime validation.

Untrusted network/user/AI input must not be trusted merely because it has a TypeScript type.

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
today_completed
```

For each event, define useful properties only.

Do not add analytics fields without a reason.

Do not turn analytics terminology into product/domain state unless explicitly intended.

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

* exact purpose;
* input;
* output schema;
* provider boundary;
* fallback behavior;
* validation/review requirements;
* source/provenance requirements where relevant;
* whether output can directly affect trusted application state.

Critical rule:

AI must not silently replace deterministic Learning Engine behavior.

Model output should be treated as untrusted external input until appropriately validated.

---

## 17. Learning Engine Interaction

Does the feature read from or write to learning state?

Define:

* evidence consumed;
* learner-state inputs;
* learner-state outputs;
* version dependencies;
* when recalculation occurs;
* whether replay/rebuild behavior is affected;
* whether a controlled clock is required.

If the feature does not interact with learning logic, write:

```text
NONE
```

Do not invent new mastery, misconception, scheduling, or ranking rules inside a Feature Contract.

Reference the relevant accepted Learning Engine sources instead.

---

## 18. Today / DailyPlan Interaction

If the feature interacts with Today, define:

* whether it reads or creates the DailyPlan;
* whether it resolves a DailyPlanItem;
* whether it creates an Attempt;
* whether it affects future learner state;
* whether it can change an already-persisted plan;
* how learner-local day boundaries apply.

Current assumptions unless explicitly superseded:

```text
DailyPlan / DailyPlanItem = primary Today model
same learner-local day = same persisted plan
plan is frozen by default after generation
Skip = resolution, not incorrect evidence
Manual Practice is separate from Today resolution
```

If the feature does not interact with Today, write:

```text
NONE
```

---

## 19. RTL / Localization

Define user-facing requirements.

Default assumptions:

```text
language: Hebrew
direction: RTL
locale: he-IL
```

All learner-facing copy should use the messages/localization layer where practical.

Check:

* directional icons;
* navigation;
* mixed Hebrew/English text;
* numbers;
* dates;
* forms;
* progress UI.

Do not treat RTL as later visual polish.

---

## 20. Accessibility

Consider:

* semantic HTML;
* keyboard access;
* focus order;
* labels;
* error communication;
* disabled states;
* touch target size;
* screen-reader meaning.

List any feature-specific accessibility risks.

---

## 21. Error Behavior

Define how the feature should behave when key operations fail.

Examples:

* data load fails;
* Attempt creation fails;
* progress update fails;
* authorization fails;
* AI/provider fails;
* persistence fails;
* plan generation fails;
* required trusted state is missing.

Avoid silent failure for learning-critical operations.

Do not expose raw internal errors, SQL, credentials, or private implementation details to the client.

---

## 22. Loading Behavior

Define what the user sees while required data is loading.

Avoid UI that accidentally suggests:

```text
nothing to study
```

when the real state is:

```text
still loading
```

Loading, empty, unauthorized, error, and completed are different states.

---

## 23. Empty State

Define the true empty state.

Examples:

* no Course exists;
* no Questions exist;
* insufficient learner evidence;
* nothing currently due;
* Today is genuinely complete.

These states may require different user experiences.

Do not collapse all of them into one generic empty screen.

---

## 24. Data Integrity Invariants

List invariants that must remain true.

Examples:

```text
- One Attempt represents one submitted answer event
- Attempts remain immutable historical evidence
- Shared Question content is not learner progress
- QuestionVersions remain immutable
- DailyPlanItems preserve the generated plan and frozen QuestionVersion identity
- Planning alone does not create learner evidence
- Progress updates do not rewrite Attempt history
- Client-provided IDs do not override trusted ownership
```

These should influence database constraints, application behavior, and tests.

---

## 25. Performance Expectations

Only define meaningful expectations.

Examples:

* Today should open without requiring an LLM call;
* Question navigation should feel immediate;
* persisted DailyPlan retrieval should use appropriate indexed queries;
* repeated reopening should not regenerate the same learner-day plan.

Do not create arbitrary performance targets without evidence.

---

## 26. Cost Expectations

State any meaningful cost constraints.

Examples:

* no AI call per Question answer;
* reuse persisted DailyPlan;
* avoid repeated expensive content processing;
* avoid unnecessary provider calls on high-frequency learner paths.

If no special cost issue exists, write:

```text
No feature-specific cost requirement beyond project defaults.
```

---

## 27. Out of Scope

Explicitly state what this feature does not include.

This is important for preventing scope creep.

Example:

```text
Out of scope for Today V1:

- leaderboards
- social sharing
- instructor dashboard expansion
- autonomous AI Coach
- manual DailyPlan builder
```

Do not implement architecture-ready or deferred functionality merely because this feature touches an adjacent area.

---

## 28. Open Questions

List unresolved decisions.

Each meaningful unresolved question should either:

* link to `docs/OPEN_QUESTIONS.md`;
* be added there;
* be resolved before implementation if it affects correctness.

Do not bury unresolved behavior in TODO comments or silently encode an answer in implementation.

---

## 29. Dependencies

List required product/technical dependencies.

Examples:

* Course access;
* Question model;
* Learning Engine;
* authentication;
* PostgreSQL;
* DailyPlan;
* messages/localization layer.

Do not list speculative future integrations.

---

## 30. Related Documents

Examples:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
docs/UNLOCK_V1_SCOPE.md
docs/ARCHITECTURE.md
docs/DOMAIN_GLOSSARY.md
docs/DATABASE.md
docs/TESTING.md
docs/OPEN_QUESTIONS.md
docs/DECISIONS/<relevant-adr>.md
```

Include only documents relevant to the feature.

Do not copy large sections of canonical documentation into the Feature Contract.

Reference the owner instead.

---

## 31. Evidence / Required Tests

Define the behavior that requires evidence.

Organize by layer only when useful.

### Domain / Unit

Example:

```text
- deterministic ranking rule
- state transition
- pure validation rule
```

### Application

Example:

```text
- submission creates Attempt and updates progress atomically
- persisted DailyPlan is reused
```

### Persistence / Integration

Example:

```text
- migration preserves existing data
- unique/foreign-key constraint protects invariant
- transaction behaves atomically
```

### API

Example:

```text
- unauthenticated request fails before protected work
- client cannot override trusted ownership
```

### UI / E2E

Example:

```text
- open → leave → return → same DailyPlan is resumed
```

Do not require every evidence layer for every feature.

Operational verification selection and evidence freshness belong to the project's testing workflow, not to this template.

---

## 32. Feature-Specific Definition of Done

List only feature-specific completion requirements.

Examples:

* approved behavior implemented;
* important feature-specific edge cases handled;
* required authorization behavior enforced;
* learner-facing RTL/accessibility requirements addressed;
* feature-specific analytics implemented where required;
* durable documentation updated where behavior changed;
* no unresolved correctness question is hidden.

Project-wide quality requirements live in:

```text
docs/DEFINITION_OF_DONE.md
```

Do not duplicate the global Definition of Done here.

---

## 33. Rollout / Feature Flag

Choose:

```text
NOT NEEDED
REQUIRED
TBD
```

If REQUIRED, define:

* who gets access;
* default state;
* rollback behavior.

Do not add a generalized feature-flag platform unless justified.

---

## 34. Migration / Existing Data Impact

Does the feature affect existing persisted data?

Choose:

```text
NO
YES
TBD
```

If YES, define:

* migration;
* backfill;
* version compatibility;
* rollback/recovery considerations;
* local vs hosted application state.

Do not edit accepted historical migrations to implement new behavior.

---

## 35. Security Review

List any feature-specific security concerns.

Examples:

* access to private Course data;
* cross-user learner-state leakage;
* privileged server action;
* uploaded content;
* ownership enforcement;
* AI prompt injection from source content;
* service-role usage;
* redirect safety.

If none beyond project defaults, say so explicitly.

Do not create new RLS or authorization policy merely because this section exists.

---

## 36. Change Log

Use a lightweight record.

Example:

```text
2026-09-16 — Initial contract created
```

Add entries only for meaningful contract changes.

Do not mirror Git history line by line.

---

# Feature Contract Rule

A Feature Contract should remove ambiguity before code makes ambiguity expensive.

The goal is not exhaustive paperwork.

The goal is to make sure everyone can answer:

```text
What is this feature?

Who is it for?

What rules must hold?

What data changes?

What can fail?

How do we prove it works?

What is explicitly not included?
```

If those answers are clear, the contract has done its job.

A Feature Contract is a supporting document.

It must not become a second owner of:

* product-wide policy;
* Development OS workflow;
* verification policy;
* reviewer selection;
* current repository state;
* current Run sequencing.

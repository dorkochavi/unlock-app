# UNLOCK Domain Glossary

Status: Active shared terminology guide

Purpose: define the canonical meaning of important UNLOCK product and technical terms so product documents, code, tests, and AI coding agents use the same language consistently.

This document defines terminology.

It does not define complete implementation details or database schemas.

Accepted ADRs and committed implementation may provide more specific behavior. If this glossary conflicts with a newer accepted ADR, the ADR controls and this glossary should be reconciled.

---

## 1. User

A person with access to UNLOCK.

In V1, the primary User is an individual learner.

Future roles may include:

* Instructor
* Institution Admin
* Platform Admin

Do not assume every User belongs to an Institution.

---

## 2. Learner

A User who is actively studying through UNLOCK.

In V1, User and Learner may often refer to the same person, but the term Learner is used when discussing learning state, Attempts, progress, Today, and adaptive behavior.

---

## 3. Course

The main academic or structured learning container.

A Course may include:

* Materials;
* Questions;
* Topics or Units;
* Exam dates;
* learner progress.

A Course must be valid without an Institution.

Institution is optional and must not be a V1 requirement.

---

## 4. Institution

An academic institution or organization associated with Courses, instructors, or learners.

Institution is architecture-ready but is not required for V1.

A Course must not require `institution_id` in V1.

---

## 5. Material

A source of learning content associated with a Course.

Examples:

* PDF;
* lecture notes;
* presentation;
* pasted text;
* chapter;
* instructor-provided content.

Material is a content source.

Material is not automatically a Question set, Quiz, or learner state.

---

## 6. Topic / Unit

A logical content area inside a Course.

Examples:

* chapter;
* subject;
* concept group;
* syllabus unit.

Topic / Unit may be useful for organization, analytics, and future knowledge relationships.

The exact hierarchy remains subject to later data-model decisions.

---

## 7. Question

A reusable assessable learning item.

A Question represents shared learning content.

Examples may include:

* multiple-choice question;
* future supported question formats.

Question-specific content may include:

* question text;
* answer options;
* correct answer;
* explanation;
* difficulty;
* source/provenance.

Learner-specific mastery or progress must not be stored directly on the shared Question.

---

## 8. QuestionVersion

An immutable content snapshot of a Question at one point in time (prompt, answer options, correct answer, explanation).

Question is the stable logical identity; QuestionVersion is the frozen content the learner actually saw. Editing a Question's content (prompt, options, correct answer) always creates a new QuestionVersion — an existing QuestionVersion is never edited in place.

An Attempt always references the exact QuestionVersion presented, not just the Question, so a historical Attempt remains interpretable even after the Question's content later changes.

See ADR-009 (versioning decision) and ADR-014 (answer-content contract).

---

## 9. Answer Option

One possible response to a Question.

Status: DECIDED for V1 — see ADR-014. Stored as structured JSON on
QuestionVersion (`{id, content}`, display order meaningful and frozen), not
a normalized table. V1 supports `SINGLE_CHOICE` (exactly one correct
option) and `MULTIPLE_CHOICE` (one or more correct options, set equality);
`TRUE_FALSE` is represented as a 2-option `SINGLE_CHOICE`, not a distinct
type. Free text, essay, and other question formats remain out of scope for
V1.

---

## 10. Attempt

An immutable historical record of a learner answering a Question at a specific moment.

Attempt answers:

> What happened?

Potential evidence includes:

* learner/user;
* Question;
* selected answer;
* correctness;
* response time;
* confidence;
* timestamp;
* Today/session context;
* engine version.

Attempts are historical evidence.

They must not be rewritten to represent current mastery or progress.

---

## 11. UserQuestionProgress

The evolving learner-specific state associated with a Question.

UserQuestionProgress answers:

> What does UNLOCK currently believe about this learner's relationship with this Question?

Known signals include:

* `mastery_category`
* `scheduled_review_at` (memory/scheduler state)
* `misconception_state` / `misconception_score`
* `average_response_time_seconds`

`confidence_level` is recorded per-Attempt, not as a UserQuestionProgress
field — there is no single "current confidence" value for a Question.

Potential additional derived fields may be introduced only when justified.

UserQuestionProgress is not a replacement for Attempt history.

---

## 12. Learner State

UNLOCK's current estimate of the learner's learning condition.

Learner State may combine evidence across multiple Questions, Topics, Courses, or academic contexts.

It may reflect:

* mastery;
* weaknesses;
* review needs;
* misconceptions;
* confidence;
* response speed;
* exam urgency;
* other validated learning signals.

Learner State is derived state.

It is not raw historical evidence.

---

## 13. Learner State Brain

The conceptual intelligence boundary responsible for maintaining UNLOCK's best current estimate of what the learner knows.

In V1:

* it is active;
* it is deterministic;
* it does not require an LLM;
* it is implemented inside the modular monolith.

A Brain is a capability boundary, not necessarily a separate service.

---

## 14. Next Best Action

The learning action UNLOCK currently believes should have the highest priority for the learner.

Examples may include:

* review a Question;
* practice a weak concept;
* address a misconception;
* study exam-priority content;
* complete a diagnostic item.

Next Best Action should be derived from approved deterministic learning logic in V1.

---

## 15. Next Best Action Brain

The conceptual intelligence boundary responsible for deciding what the learner should do next.

This Brain powers Today.

In V1:

* it is deterministic;
* it does not require an LLM;
* it should be testable and reproducible.

---

## 16. Learning Engine

The deterministic domain logic responsible for transforming learning evidence and academic context into learner-state updates and learning priorities.

The Learning Engine may include:

* mastery updates;
* review scheduling;
* misconception logic;
* confidence interpretation;
* response-time interpretation;
* exam urgency;
* Next Best Action prioritization.

The Learning Engine is not an LLM.

The exact V1 formulas must be based on validated prototype behavior where applicable.

---

## 17. Today

The primary recurring learner-facing product experience of UNLOCK.

Today answers:

> What should I study now?

Today presents the learner's persisted `DailyPlan` for the current learner-local calendar day.

The plan is created from:

* Learner State;
* eligible learning content;
* academic context;
* Next Best Action logic;
* accepted DailyPlan policy.

Today is not merely a random Quiz.

The accepted global Today semantics are defined by ADR-016.

---

## 18. DailyPlan

The persisted adaptive learning plan for one learner and one learner-local calendar day.

`DailyPlan` is the primary current persistence/domain term behind Today.

A DailyPlan supports:

* creation;
* persistence;
* resume;
* progress;
* completion.

Core V1 semantics include:

* one DailyPlan per learner per learner-local calendar day;
* Global Today and course-context Today refer to the same underlying DailyPlan;
* the plan is frozen by default after creation;
* same-day reload returns the same persisted plan/state;
* unresolved items do not automatically carry into the next day;
* the next learner-local day recalculates from current learner state.

Do not silently regenerate a valid same-day DailyPlan.

---

## 19. DailyPlanItem

A prepared learning item inside a `DailyPlan`.

A DailyPlanItem may reference a Question and preserve information such as:

* ordering;
* status;
* selection reason;
* priority at generation time;
* resolution/completion state.

A DailyPlanItem may be resolved by supported Today actions such as answering or Skip according to accepted product semantics.

Quiz executes DailyPlanItems in Today mode.

Quiz does not independently replace them with newly selected Questions.

---

## 20. TodaySession / TodaySessionItem — Retired

`TodaySession` and `TodaySessionItem` were the Course-scoped Today terms defined by ADR-011. That model, and the runtime code/schema implementing it, were fully retired before Run 009 (see ADR-011's current status note) — the terms no longer name anything in the active repository.

The current and sole product/domain terms for Today are:

* `DailyPlan`;
* `DailyPlanItem`.

---

## 21. Quiz

The execution interface for presenting Questions and collecting learner responses.

Quiz responsibilities include:

* display Question;
* collect response;
* show approved feedback;
* record Attempt;
* progress through the prepared DailyPlan.

Quiz is not responsible for deciding the adaptive Today plan.

---

## 22. Review

A later learner interaction with previously encountered content because the system believes another retrieval attempt is useful.

Review timing may be influenced by:

* mastery;
* recency;
* previous outcomes;
* misconceptions;
* exam urgency;
* other validated signals.

Review is broader than simply "repeat every X days."

---

## 23. Spaced Repetition

The principle of scheduling review across time instead of repeatedly studying the same material in one block.

In UNLOCK, spaced repetition contributes to learning priority but is not the whole Learning Engine.

Known related field:

* `scheduled_review_at` (UserQuestionProgress memory/scheduler state)

---

## 24. Mastery

An estimate of how strongly the learner currently controls a Question or concept.

Known field:

* `mastery_category`

Mastery must not mean:

> one correct answer = mastered

It should reflect evidence accumulated over time according to the approved Learning Engine rules.

---

## 25. Misconception

Evidence that a learner may hold an incorrect mental model rather than simply making an isolated mistake.

Known related field:

* `misconception_state` / `misconception_score`

A high-confidence incorrect answer may be particularly relevant to misconception detection.

The exact V1 logic must come from validated prototype behavior.

---

## 26. Confidence

The learner's expressed certainty about an answer or learning judgment.

Known related field:

* `confidence_level`

Confidence helps distinguish cases such as:

* correct + high confidence;
* correct + low confidence;
* incorrect + low confidence;
* incorrect + high confidence.

Confidence should not be interpreted in isolation.

---

## 27. Response Time

The time required for a learner to answer a Question.

Known related field:

* `average_response_time_seconds`

Response time is a supporting signal.

It must not be used alone to determine mastery.

---

## 28. Exam Date

A date representing an upcoming exam that may influence learning priority.

Status: OPEN — see `docs/OPEN_QUESTIONS.md` #2. Illustrative candidate
precedence, not a settled rule:

```text
personal_exam_date
>
shared/group/course exam date
>
null
```

A personal override, if this hierarchy is adopted, would take precedence.

If no valid exam date exists, UNLOCK must not fabricate exam urgency.

The exact V1 shared-date model remains open and must be finalized during database/domain design.

---

## 29. Exam Urgency

A deterministic priority signal that may increase the importance of relevant learning content as an exam approaches.

Exam urgency should interact with other signals.

It should not override all learning logic automatically.

The exact V1 urgency formula remains TBD until approved.

---

## 30. Exam Readiness

An estimate of how prepared a learner may be for an exam.

Readiness must avoid false precision.

Possible states may include:

* insufficient data;
* early estimate;
* moderate-confidence estimate;
* high-confidence estimate.

A precise-looking percentage must not be shown when evidence does not justify it.

---

## 31. Starter Experience

The experience used when UNLOCK does not yet have enough learner evidence to create a meaningful adaptive plan.

Possible purposes:

* establish initial baseline;
* sample relevant content;
* generate first Attempts;
* reduce uncertainty.

The starter experience may include diagnostic sampling.

Exact behavior must be defined before implementation.

---

## 32. Diagnostic

A structured learning interaction intended primarily to generate useful evidence about the learner's current knowledge.

Diagnostic does not necessarily mean a formal exam.

It may be lightweight and integrated into onboarding.

---

## 33. Basic Progress

The minimum learner-facing progress experience required in V1.

Its purpose is to help the learner understand that their activity is changing UNLOCK's understanding of them.

Possible examples:

* Today completion;
* recent activity;
* simple Question/topic progress;
* upcoming review;
* Course progress.

It is not an advanced analytics dashboard.

---

## 34. Material Provenance

Information describing where learning content came from.

Potential sources include:

* learner-created;
* instructor-created;
* imported from Material;
* AI-generated;
* institution-provided.

Provenance should only be stored when it has a defined product, quality, ownership, audit, or research purpose.

---

## 35. Verification State

A traceable trust state for generated or reviewed content.

Known conceptual states:

* UNVERIFIED
* SOURCE_LINKED
* RULE_VALIDATED
* AI_VERIFIED
* HUMAN_APPROVED
* REJECTED

Verification state must not be inferred merely because AI produced the content.

---

## 36. AI Verification

A separate verification step that evaluates AI-generated content against source evidence.

It may check:

* whether the source supports the answer;
* whether exactly one answer is clearly correct;
* whether the explanation is supported;
* whether distractors are ambiguous;
* whether citations are relevant.

AI verification happens at content generation/approval time, not on every learner interaction.

---

## 37. Brain

A conceptual intelligence capability boundary.

A Brain does **not** automatically imply:

* separate service;
* separate agent;
* separate model;
* separate process;
* separate database;
* separate deployment.

A Brain may be implemented as:

* deterministic TypeScript logic;
* SQL/statistics;
* analytics;
* configuration;
* optional AI-assisted behavior.

---

## 38. Architecture-Ready

A capability is architecture-ready when the current design avoids blocking its reasonable future addition.

Architecture-ready does **not** mean:

* build it now;
* create database tables now;
* add UI now;
* add infrastructure now.

Example:

A Course can later reference an Institution without requiring Institution functionality in V1.

---

## 39. Deferred

A feature or capability intentionally excluded from the current V1 implementation.

Deferred means:

* known;
* intentionally postponed;
* not a current blocker.

Deferred does not mean forgotten.

---

## 40. V1

The smallest production-quality version of UNLOCK that validates the core adaptive learning loop.

V1 is not:

* a disposable demo;
* permission to ignore security;
* permission to skip testing;
* permission to create poor architecture.

V1 prioritizes:

```text
User
→ Course
→ Material / Questions
→ Today
→ Quiz
→ Attempt
→ Learner State
→ Next Best Action
→ Future Today
```

---

## 41. Architecture-Ready vs V1 Required vs Deferred

Every significant capability should be classified where useful.

### V1 REQUIRED

Needed to make the first validated adaptive learning loop work.

### ARCHITECTURE-READY

Not implemented now, but likely enough that current decisions should avoid unnecessary dead ends.

### DEFERRED

Explicitly not part of the current build.

Do not silently move a capability between these categories during implementation.

---

## 42. Canonical Naming Principle

Use one canonical term for each domain concept.

Preferred terms include:

* Today
* DailyPlan
* DailyPlanItem
* Attempt
* UserQuestionProgress
* Learner State
* Next Best Action
* Course
* Material
* Question
* QuestionVersion

Retired terms (no longer present in the active repository — see §20) include:

* TodaySession
* TodaySessionItem

Do not create alternate names for the same concept without a documented reason.

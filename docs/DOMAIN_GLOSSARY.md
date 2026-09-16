# UNLOCK Domain Glossary

Status: Active shared terminology guide

Purpose: define the canonical meaning of important UNLOCK product and technical terms so product documents, code, tests, and AI coding agents use the same language consistently.

This document defines terminology.

It does not define complete implementation details or database schemas.

---

## 1. User

A person with access to UNLOCK.

In V1, the primary User is an individual learner.

Future roles may include:

- Instructor
- Institution Admin
- Platform Admin

Do not assume every User belongs to an Institution.

---

## 2. Learner

A User who is actively studying through UNLOCK.

In V1, User and Learner may often refer to the same person, but the term Learner is used when discussing learning state, Attempts, progress, Today, and adaptive behavior.

---

## 3. Course

The main academic or structured learning container.

A Course may include:

- Materials;
- Questions;
- Topics or Units;
- Exam dates;
- learner progress.

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

- PDF;
- lecture notes;
- presentation;
- pasted text;
- chapter;
- instructor-provided content.

Material is a content source.

Material is not automatically a Question set, Quiz, or learner state.

---

## 6. Topic / Unit

A logical content area inside a Course.

Examples:

- chapter;
- subject;
- concept group;
- syllabus unit.

Topic / Unit may be useful for organization, analytics, and future knowledge relationships.

The exact hierarchy remains subject to later data-model decisions.

---

## 7. Question

A reusable assessable learning item.

A Question represents shared learning content.

Examples may include:

- multiple-choice question;
- future supported question formats.

Question-specific content may include:

- question text;
- answer options;
- correct answer;
- explanation;
- difficulty;
- source/provenance.

Learner-specific mastery or progress must not be stored directly on the shared Question.

---

## 8. Answer Option

One possible response to a Question.

The exact storage model for answer options remains TBD.

Possible implementations include:

- normalized records;
- structured JSON.

Do not treat the storage choice as decided until the database design is approved.

---

## 9. Attempt

An immutable historical record of a learner answering a Question at a specific moment.

Attempt answers:

> What happened?

Potential evidence includes:

- learner/user;
- Question;
- selected answer;
- correctness;
- response time;
- confidence;
- timestamp;
- Today/session context;
- engine version.

Attempts are historical evidence.

They must not be rewritten to represent current mastery or progress.

---

## 10. UserQuestionProgress

The evolving learner-specific state associated with a Question.

UserQuestionProgress answers:

> What does UNLOCK currently believe about this learner's relationship with this Question?

Known signals include:

- `mastery_level`
- `next_review_date`
- `misconception_hits`
- `confidence_level`
- `average_time_seconds`

Potential additional derived fields may be introduced only when justified.

UserQuestionProgress is not a replacement for Attempt history.

---

## 11. Learner State

UNLOCK's current estimate of the learner's learning condition.

Learner State may combine evidence across multiple Questions, Topics, Courses, or academic contexts.

It may reflect:

- mastery;
- weaknesses;
- review needs;
- misconceptions;
- confidence;
- response speed;
- exam urgency;
- other validated learning signals.

Learner State is derived state.

It is not raw historical evidence.

---

## 12. Learner State Brain

The conceptual intelligence boundary responsible for maintaining UNLOCK's best current estimate of what the learner knows.

In V1:

- it is active;
- it is deterministic;
- it does not require an LLM;
- it is implemented inside the modular monolith.

A Brain is a capability boundary, not necessarily a separate service.

---

## 13. Next Best Action

The learning action UNLOCK currently believes should have the highest priority for the learner.

Examples may include:

- review a Question;
- practice a weak concept;
- address a misconception;
- study exam-priority content;
- complete a diagnostic item.

Next Best Action should be derived from approved deterministic learning logic in V1.

---

## 14. Next Best Action Brain

The conceptual intelligence boundary responsible for deciding what the learner should do next.

This Brain powers Today.

In V1:

- it is deterministic;
- it does not require an LLM;
- it should be testable and reproducible.

---

## 15. Learning Engine

The deterministic domain logic responsible for transforming learning evidence and academic context into learner-state updates and learning priorities.

The Learning Engine may include:

- mastery updates;
- review scheduling;
- misconception logic;
- confidence interpretation;
- response-time interpretation;
- exam urgency;
- Next Best Action prioritization.

The Learning Engine is not an LLM.

The exact V1 formulas must be based on validated prototype behavior where applicable.

---

## 16. Today

The primary recurring product experience of UNLOCK.

Today answers:

> What should I study now?

Today is the learner-facing adaptive daily plan.

It is generated from:

- Learner State;
- eligible learning content;
- academic context;
- Next Best Action logic.

Today is not merely a random Quiz.

---

## 17. Today Session

A persisted instance of a learner's Today plan for the applicable learning period.

A Today Session should support:

- creation;
- start;
- resume;
- progress;
- completion.

If a learner leaves and returns later during the same applicable session period, the same active Today Session should resume.

Do not silently regenerate the plan when persistence rules say the current session is still valid.

---

## 18. Today Session Item

A prepared learning item inside a Today Session.

A Today Session Item may reference a Question and preserve information such as:

- ordering;
- status;
- why the item was selected;
- priority at generation time;
- completion state.

Quiz executes Today Session Items.

Quiz does not independently replace them with newly selected Questions in Today mode.

---

## 19. Quiz

The execution interface for presenting Questions and collecting learner responses.

Quiz responsibilities include:

- display Question;
- collect response;
- show approved feedback;
- record Attempt;
- progress through the prepared session.

Quiz is not responsible for deciding the adaptive Today plan.

---

## 20. Review

A later learner interaction with previously encountered content because the system believes another retrieval attempt is useful.

Review timing may be influenced by:

- mastery;
- recency;
- previous outcomes;
- misconceptions;
- exam urgency;
- other validated signals.

Review is broader than simply "repeat every X days."

---

## 21. Spaced Repetition

The principle of scheduling review across time instead of repeatedly studying the same material in one block.

In UNLOCK, spaced repetition contributes to learning priority but is not the whole Learning Engine.

Known related field:

- `next_review_date`

---

## 22. Mastery

An estimate of how strongly the learner currently controls a Question or concept.

Known field:

- `mastery_level`

Mastery must not mean:

> one correct answer = mastered

It should reflect evidence accumulated over time according to the approved Learning Engine rules.

---

## 23. Misconception

Evidence that a learner may hold an incorrect mental model rather than simply making an isolated mistake.

Known related field:

- `misconception_hits`

A high-confidence incorrect answer may be particularly relevant to misconception detection.

The exact V1 logic must come from validated prototype behavior.

---

## 24. Confidence

The learner's expressed certainty about an answer or learning judgment.

Known related field:

- `confidence_level`

Confidence helps distinguish cases such as:

- correct + high confidence;
- correct + low confidence;
- incorrect + low confidence;
- incorrect + high confidence.

Confidence should not be interpreted in isolation.

---

## 25. Response Time

The time required for a learner to answer a Question.

Known related field:

- `average_time_seconds`

Response time is a supporting signal.

It must not be used alone to determine mastery.

---

## 26. Exam Date

A date representing an upcoming exam that may influence learning priority.

Current precedence concept:

```text
personal_exam_date
>
shared/group/course exam date
>
null
```

A personal override takes precedence.

If no valid exam date exists, UNLOCK must not fabricate exam urgency.

The exact V1 shared-date model must be finalized during database/domain design.

---

## 27. Exam Urgency

A deterministic priority signal that may increase the importance of relevant learning content as an exam approaches.

Exam urgency should interact with other signals.

It should not override all learning logic automatically.

The exact V1 urgency formula remains TBD until approved.

---

## 28. Exam Readiness

An estimate of how prepared a learner may be for an exam.

Readiness must avoid false precision.

Possible states may include:

- insufficient data;
- early estimate;
- moderate-confidence estimate;
- high-confidence estimate.

A precise-looking percentage must not be shown when evidence does not justify it.

---

## 29. Starter Experience

The experience used when UNLOCK does not yet have enough learner evidence to create a meaningful adaptive plan.

Possible purposes:

- establish initial baseline;
- sample relevant content;
- generate first Attempts;
- reduce uncertainty.

The starter experience may include diagnostic sampling.

Exact behavior must be defined before implementation.

---

## 30. Diagnostic

A structured learning interaction intended primarily to generate useful evidence about the learner's current knowledge.

Diagnostic does not necessarily mean a formal exam.

It may be lightweight and integrated into onboarding.

---

## 31. Basic Progress

The minimum learner-facing progress experience required in V1.

Its purpose is to help the learner understand that their activity is changing UNLOCK's understanding of them.

Possible examples:

- Today completion;
- recent activity;
- simple Question/topic progress;
- upcoming review;
- Course progress.

It is not an advanced analytics dashboard.

---

## 32. Material Provenance

Information describing where learning content came from.

Potential sources include:

- learner-created;
- instructor-created;
- imported from Material;
- AI-generated;
- institution-provided.

Provenance should only be stored when it has a defined product, quality, ownership, audit, or research purpose.

---

## 33. Verification State

A traceable trust state for generated or reviewed content.

Known conceptual states:

- UNVERIFIED
- SOURCE_LINKED
- RULE_VALIDATED
- AI_VERIFIED
- HUMAN_APPROVED
- REJECTED

Verification state must not be inferred merely because AI produced the content.

---

## 34. AI Verification

A separate verification step that evaluates AI-generated content against source evidence.

It may check:

- whether the source supports the answer;
- whether exactly one answer is clearly correct;
- whether the explanation is supported;
- whether distractors are ambiguous;
- whether citations are relevant.

AI verification happens at content generation/approval time, not on every learner interaction.

---

## 35. Brain

A conceptual intelligence capability boundary.

A Brain does **not** automatically imply:

- separate service;
- separate agent;
- separate model;
- separate process;
- separate database;
- separate deployment.

A Brain may be implemented as:

- deterministic TypeScript logic;
- SQL/statistics;
- analytics;
- configuration;
- optional AI-assisted behavior.

---

## 36. Architecture-Ready

A capability is architecture-ready when the current design avoids blocking its reasonable future addition.

Architecture-ready does **not** mean:

- build it now;
- create database tables now;
- add UI now;
- add infrastructure now.

Example:

A Course can later reference an Institution without requiring Institution functionality in V1.

---

## 37. Deferred

A feature or capability intentionally excluded from the current V1 implementation.

Deferred means:

- known;
- intentionally postponed;
- not a current blocker.

Deferred does not mean forgotten.

---

## 38. V1

The smallest production-quality version of UNLOCK that validates the core adaptive learning loop.

V1 is not:

- a disposable demo;
- permission to ignore security;
- permission to skip testing;
- permission to create poor architecture.

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

## 39. Architecture-Ready vs V1 Required vs Deferred

Every significant capability should be classified where useful.

### V1 REQUIRED

Needed to make the first validated adaptive learning loop work.

### ARCHITECTURE-READY

Not implemented now, but likely enough that current decisions should avoid unnecessary dead ends.

### DEFERRED

Explicitly not part of the current build.

Do not silently move a capability between these categories during implementation.

---

## 40. Canonical Naming Principle

Use one canonical term for each domain concept.

Preferred terms include:

- Today
- Today Session
- Today Session Item
- Attempt
- UserQuestionProgress
- Learner State
- Next Best Action
- Course
- Material
- Question

Do not create alternate names for the same concept without a documented reason.

If an older document uses a different historical name, new implementation should prefer the canonical terminology in this glossary.

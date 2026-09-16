# UNLOCK Product

Status: Active product guide

Purpose: provide a concise, implementation-oriented view of UNLOCK so developers and AI coding agents can quickly understand the product, V1 scope, core behavior, and product boundaries.

This document does not replace `docs/MASTER_SPEC.md`.

The Master Spec remains the high-level product constitution.

This document is the practical product map for day-to-day implementation.

---

## 1. What UNLOCK Is

UNLOCK is a Hebrew-first, RTL-first adaptive learning platform.

Its core purpose is not to present questions.

Its core purpose is to:

1. collect learning evidence;
2. estimate the learner's current knowledge state;
3. determine what the learner should work on next;
4. turn that decision into a simple daily learning experience.

Core thesis:

```text
CONTENT
+
USER BEHAVIOR
+
LEARNING DATA
+
ADAPTIVE ENGINE
=
UNLOCK
```

The long-term value of UNLOCK comes from the learner model, longitudinal learning data, adaptive prioritization, and feedback loop.

AI may enhance the system, but AI is not the core learning decision-maker.

---

## 2. Primary User

The primary V1 user is an individual learner.

Initial use cases may include:

- university students;
- college students;
- learners preparing for exams;
- learners studying structured academic material.

V1 must work without requiring:

- an Institution;
- an Instructor;
- a classroom;
- an organization account.

Institutional capabilities are architecture-ready but are not V1 blockers.

---

## 3. The Core User Problem

Learners may already have:

- notes;
- PDFs;
- questions;
- summaries;
- course materials;
- exam dates.

But they still often need to decide:

> "What should I study right now?"

Many learning tools help users create or consume content.

UNLOCK focuses on deciding what learning action is most useful next.

---

## 4. Core Product Promise

UNLOCK should answer:

> "What should I study now?"

As the learner generates more evidence, the quality of that answer should improve.

The product should become more useful over time because it understands the learner better.

---

## 5. The Primary Experience: Today

Today is the central recurring experience of UNLOCK.

Today is the learner's adaptive daily study plan.

Expected loop:

```text
Open UNLOCK
↓
See today's plan
↓
Start
↓
Complete learning activities
↓
Record learning evidence
↓
Update learner state
↓
Recalculate future priorities
↓
Return later / tomorrow
```

Today should reduce unnecessary learner decision-making.

The learner should not need to manually build a daily quiz from all available content.

---

## 6. Persistent Today Sessions

A Today Session is persistent.

If a learner starts a session, leaves, refreshes, or returns later within the applicable session period, the existing session should continue.

Example:

```text
08:00 — Today started
12:30 — Learner stops after question 3
20:00 — Learner returns

Result:
Resume the same Today Session.
```

Do not silently generate a different plan while an active Today Session should still exist.

Exact session-boundary behavior belongs in the Today feature contract.

---

## 7. Core V1 Learning Loop

The V1 product must support this complete loop:

```text
User
↓
Course
↓
Material / Questions
↓
Today
↓
Quiz
↓
Attempt
↓
Learner State Update
↓
Next Best Action
↓
Next Today
```

The quality of this loop matters more than feature breadth.

A small product with a correct adaptive loop is preferable to a large product with disconnected features.

---

## 8. V1 Required Product Concepts

V1 requires:

- User
- Course
- Material
- Question
- Attempt
- UserQuestionProgress
- Exam Date
- Learner State
- Next Best Action
- Today Session
- Today Session Item
- Quiz
- Basic Progress

These concepts do not imply large management interfaces.

Only the functionality required to support the core learning loop should be implemented.

---

## 9. Core Learning Data Model

### Course

The main academic learning container.

A Course must be valid without an Institution.

### Material

A learning source associated with a Course.

Examples may include:

- PDF;
- lecture notes;
- presentation;
- chapter;
- instructor material.

### Question

A reusable learning item.

Question represents shared content.

Learner-specific progress must not be stored directly on the Question.

### Attempt

An immutable historical record of a learner answering a Question.

Attempts preserve what happened.

They may include evidence such as:

- correctness;
- selected answer;
- response time;
- confidence;
- timestamp;
- relevant engine version.

Attempts must not be rewritten to represent current progress.

### UserQuestionProgress

The learner-specific evolving state for a Question.

Known signals include:

- `mastery_level`
- `next_review_date`
- `misconception_hits`
- `confidence_level`
- `average_time_seconds`

Attempt history and UserQuestionProgress are different concepts.

---

## 10. Learner State and Next Best Action

### Learner State

Learner State is UNLOCK's current estimate of the learner's learning condition.

It may reflect:

- mastery;
- weaknesses;
- review needs;
- misconceptions;
- confidence;
- response speed;
- relevant academic urgency.

Learner State is derived state, not raw history.

### Next Best Action

Next Best Action represents what UNLOCK believes should happen next.

Possible factors include:

- mastery;
- review timing;
- misconceptions;
- learner history;
- exam urgency.

In V1, Learner State and Next Best Action must be deterministic, testable, and reproducible.

They must not depend on an LLM making the learning decision.

---

## 11. Quiz Contract

Quiz is responsible for presenting Questions and recording learner responses.

In Today mode:

```text
Learning Engine / Today planning
selects the learning items
↓
Quiz presents them
↓
Learner answers
↓
Attempt is recorded
```

Quiz must not independently decide which Questions belong in the Today plan.

Learning strategy and question presentation are separate responsibilities.

---

## 12. Exam Dates and Academic Urgency

Exam dates may influence learning priority.

Effective precedence:

```text
personal_exam_date
>
group_exam_date
>
no exam date
```

A personal exam date overrides a shared/group exam date.

UNLOCK must never invent an exam date.

Exam readiness or similar metrics must avoid false precision when there is insufficient learner evidence.

Where relevant, uncertainty or estimate confidence should be communicated.

Assignments are architecture-ready and are not a V1 blocker unless a specific documented requirement later makes them necessary.

---

## 13. New Learner Experience

A new learner may not yet have enough historical evidence for normal adaptive review.

The system must not present an empty adaptive state as:

> "Nothing to review"

when the real situation is:

> "We do not know enough yet."

V1 requires a starter experience that allows a new learner to generate useful learning evidence.

The exact onboarding and starter logic must be defined before implementation.

---

## 14. Basic Progress

V1 should show enough progress information for the learner to understand that UNLOCK is learning from their activity.

Potential signals may include:

- Today completion;
- recent learning activity;
- Question or topic progress;
- upcoming review;
- simple Course progress.

V1 does not require a complex analytics dashboard.

Advanced analytics are deferred unless required by a specific pilot.

---

## 15. Primary Product KPI

The primary V1 behavioral KPI is:

> Percentage of active users who complete Today on at least 3 separate days within a week.

This KPI tests the central product hypothesis:

> Will learners repeatedly return to an adaptive daily learning experience?

At minimum, the product should support events such as:

- `today_opened`
- `today_started`
- `session_completed`
- `session_abandoned`

Additional telemetry should only be collected when there is a defined product, learning, operational, or research reason.

Do not collect speculative data simply because it may be useful later.

---

## 16. AI Product Role

AI is an enabling layer, not the Learning Engine.

Potential uses include:

- question generation;
- explanations;
- content extraction;
- content verification;
- future tutoring;
- future content intelligence.

AI must not decide by default:

- mastery;
- review timing;
- Today prioritization;
- Next Best Action ranking.

AI should be used only where it adds meaningful value beyond deterministic logic.

---

## 17. AI-Generated Content Verification

AI-generated Questions require a verification process before becoming learner-facing.

Expected lifecycle may include:

- UNVERIFIED
- SOURCE_LINKED
- RULE_VALIDATED
- AI_VERIFIED
- HUMAN_APPROVED
- REJECTED

The process includes:

### Pass 1 — Generation

Create a structured candidate Question with source provenance.

### Pass 2 — Independent Verification

Check:

- whether the cited source supports the correct answer;
- whether one answer is clearly correct;
- whether the explanation is supported;
- whether distractors are ambiguous;
- whether citations are relevant.

Verification happens during creation/approval time, not every time the learner answers the Question.

High-impact changes should retain appropriate human control.

---

## 18. Core Product Principles

### Reduce decisions

UNLOCK should reduce the number of learning decisions the learner needs to make.

Where sufficient evidence exists, the system should help decide:

- what to study;
- what to review;
- what matters most;
- where to resume.

### Evidence over assumptions

Personalization should be based on actual learner evidence.

Do not create elaborate personalization based on data the learner has not generated.

### Persistent state

Meaningful learning state should survive refreshes, navigation, and returning later.

### Explain without overwhelming

Adaptive recommendations should not feel arbitrary.

Where useful, the product may explain why an activity is recommended.

Examples:

- "מומלץ לחזור על הנושא הזה"
- "המבחן מתקרב"
- "זוהתה טעות שחזרה מספר פעמים"

### Avoid false precision

Do not display precise-looking learning metrics when the evidence does not justify that precision.

Prefer:

- insufficient data;
- early estimate;
- confidence indication;
- qualitative progress;

over misleading exact numbers.

---

## 19. Product Experience Requirements

UNLOCK is:

- Hebrew-first;
- RTL-first;
- `he-IL` by default;
- Web/PWA-first;
- mobile-first.

Technical identifiers remain in English.

User-facing text should use the project's messages layer.

Accessibility is part of product quality from the beginning.

New interfaces should consider:

- keyboard access;
- semantic HTML;
- focus behavior;
- readable contrast;
- screen-reader meaning;
- mobile touch targets;
- RTL behavior.

Native mobile applications may be considered later after the core product behavior has been validated.

---

## 20. Scope Boundaries

### Architecture-ready, not V1 blockers

The architecture should not prevent future support for:

- Institution;
- Instructor;
- Institution Admin;
- enrollment groups;
- Assignments;
- Knowledge Graph;
- advanced analytics;
- advanced Content Intelligence;
- System Auditor;
- intervention personalization.

Architecture-ready does not mean implement-now.

### Explicitly deferred

Do not allow the following to distract from the V1 learning loop:

- social/community features;
- challenges;
- leaderboards;
- advanced profiles;
- Parent experience;
- heavy LMS functionality;
- advanced institution management;
- autonomous learning agents;
- Personal AI Coach;
- Web Resource Curator;
- Class Digest;
- advanced semantic Content QA;
- advanced Knowledge Graph automation;
- complex gamification;
- native mobile apps.

---

## 21. V1 Success and Failure Signals

V1 is intended to test whether learners:

- understand Today;
- start Today;
- complete meaningful sessions;
- return on multiple separate days;
- experience increasingly relevant recommendations;
- trust the system enough to continue using it.

Potential warning signals include:

- learners repeatedly ignore Today;
- users consistently prefer manually selecting Questions;
- Today feels repetitive or irrelevant;
- sessions are frequently abandoned;
- learners do not understand why content is being selected;
- adaptive prioritization does not improve as evidence grows;
- users create/import content but do not return to learn.

These are product-learning signals, not automatically technical failures.

---

## 22. Feature Development Rule

Before implementing a significant product feature, create or update a feature contract under:

```text
docs/FEATURES/
```

A feature contract should define:

- purpose;
- user goal;
- entry points;
- core flow;
- business rules;
- states;
- required data;
- outputs / side effects;
- permissions;
- edge cases;
- analytics;
- out-of-scope items;
- open questions;
- Definition of Done.

Do not invent missing product behavior during implementation.

If an ambiguity affects product behavior, learning logic, data integrity, security, or architecture, surface it before implementing.

---

## 23. Product Documentation Hierarchy

Use the following hierarchy:

### Product constitution

`docs/MASTER_SPEC.md`

### Practical product map

`docs/PRODUCT.md`

### Shared domain terminology

`docs/DOMAIN_GLOSSARY.md`

### Feature-specific behavior

`docs/FEATURES/*.md`

### Durable decisions

`docs/DECISIONS/*.md`

### Implementation discipline

`.cursor/rules/*.mdc`

If documents conflict, do not silently choose an interpretation.

Surface the conflict.

For current V1 activation, the V1 Core Activation Plan and Immediate Next Steps in the Master Spec take precedence over broader earlier checklists where explicitly specified.

---

## 24. Current Product Priority

The current priority is not feature breadth.

The current priority is to build a trustworthy foundation for the core adaptive learning loop:

```text
Course
→ Learning Content
→ Today
→ Quiz
→ Attempt
→ Learner State
→ Next Best Action
→ Next Today
```

Every new feature should be evaluated against a simple question:

> Does this help us build, validate, or improve the core UNLOCK learning loop?

If not, it probably should not be a current priority.

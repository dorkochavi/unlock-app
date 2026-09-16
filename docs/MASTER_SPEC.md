# UNLOCK — Master Product & Technical Specification

**Version:** 1.3  
**Status:** Pre-development source of truth  
**Repository:** `unlock-app`  
**Primary development environment:** Cursor + GitHub  
**Product stage:** Independent production build following an early prototype validation phase  
**Primary target:** Academic students, initially web/PWA-first

---

## 0. Purpose of this document

This document is the current master specification for UNLOCK.

Its purpose is to ensure that product decisions, learning logic, architecture principles, data requirements, migration rules, AI behavior, security expectations, and development constraints are documented before meaningful implementation begins.

This document should be treated as the high-level source of truth until it is split into more focused project documents such as:

- `PRODUCT.md`
- `ARCHITECTURE.md`
- `DATABASE.md`
- `LEARNING_ENGINE.md`
- `TODAY.md`
- `PROTOTYPE_LEARNINGS.md`
- `AI_OPERATIONS.md`
- `SECURITY.md`
- `TESTING_AND_DEPLOYMENT.md`
- `ROADMAP.md`

Cursor must not infer product architecture or business rules that are not defined in the documentation.

When a decision is not yet final, it should remain marked as **TBD** rather than being invented during implementation.


## Prototype history

UNLOCK was first validated through an early low-code prototype.

That prototype is **not part of the production architecture** and creates no runtime, infrastructure, integration, database, deployment, or vendor dependency for the product being built now.

Its only purpose going forward is historical:

- preserve validated product learnings;
- recover useful learning-engine behavior;
- identify proven UX assumptions;
- avoid repeating already-tested mistakes.

The production version of UNLOCK is a standalone coded application with its own frontend, backend/application layer, database, learning engine, AI services, security model, and deployment stack.

Once relevant learnings are documented, the prototype should no longer influence architecture decisions unless a specific validated behavior is intentionally carried forward.

---

# 1. Product identity

UNLOCK is an adaptive learning platform designed to help learners study more efficiently by understanding what they know, what they do not know, what they are likely to forget, what they repeatedly misunderstand, and what they should study next.

UNLOCK is **not** primarily:

- a quiz app;
- a generic LMS;
- a PDF chat interface;
- an AI question generator;
- a flashcard clone.

Those may exist as features or interfaces, but they are not the product's core value.

The core product promise is:

> UNLOCK continuously estimates the learner's current knowledge state and decides what the learner should study next.

The product combines:

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

The defensible product layer is the learning system itself: the accumulated learner state, the adaptive engine, the daily learning experience, and the system's ability to prioritize the right learning activity at the right time.

---

# 2. Core problem

Most students still manage learning manually.

They read notes, reread PDFs, summarize material, practice questions randomly, or choose topics based on intuition.

This creates several problems:

- students do not always know what they actually know;
- they may repeatedly review content they already master;
- they may ignore knowledge gaps because those gaps are not obvious;
- they may be confidently wrong about a concept;
- they may forget material because review timing is poor;
- they may not know how to prioritize learning before an exam;
- assignments and upcoming deadlines compete with exam preparation;
- they often have no reliable indication of how ready they are.

UNLOCK should replace much of that decision-making with an adaptive learning plan.

Instead of asking:

> "What do I feel like studying?"

the learner should increasingly be able to ask:

> "What should I study right now?"

and allow UNLOCK to answer.

---

# 3. Primary product experience

The primary experience of UNLOCK is **Today**.

UNLOCK should not require the learner to repeatedly decide what to study.

The default loop should be:

```text
Open UNLOCK
    ↓
See today's learning plan
    ↓
START
    ↓
Complete today's session
    ↓
Learning state updates
    ↓
Tomorrow's plan is recalculated
```

This is the Autopilot experience of the product.

Topic browsing, manual practice, course navigation, analytics, AI Tutor, question creation, and content management are secondary experiences around that loop.

---

# 4. Product principles

UNLOCK should follow these principles:

### 4.1 Learning over content consumption

The application should optimize for active retrieval, practice, feedback, spaced repetition, and measurable progress rather than passive reading.

### 4.2 Adaptive by default

The learner should not need to manually configure a study algorithm.

### 4.3 Mobile-first

The core experience should work extremely well on a phone.

### 4.4 Low friction

The shortest path should ideally be:

```text
Open → Today → Start
```

### 4.5 Immediate feedback

Answers should generate clear, fast feedback.

### 4.6 Data-driven learning decisions

Question selection should be based on learner state rather than random order.

### 4.7 Transparent enough to trust

The user does not need to see the internal algorithm, but the product should be able to explain useful outcomes such as:

- why a topic is weak;
- why a question is being reviewed;
- how exam readiness is calculated;
- why today's plan contains certain material.

### 4.8 Gamification supports learning

Points, streaks, badges, and competition should reinforce real learning behavior rather than reward meaningless clicking.

### 4.9 AI supports the product

AI is an enabling layer, not the product's decision-maker.

The Learning Engine remains deterministic/business-logic-driven and must not depend on an LLM call for each interaction.

---

# 5. Primary target market

The current product direction is **UNLOCK for academic students**.

The architecture should therefore be designed around academic concepts such as:

- institutions;
- courses;
- enrollments;
- topics / units;
- course materials;
- assignments;
- exams;
- learner progress.

UNLOCK may later support schools and other learning environments, but the current architecture should not be distorted by school-specific roles such as Parent.

---

# 6. Primary roles

The main first-class roles are:

### Student

The primary learner.

A Student can:

- enroll in or access courses;
- upload or use learning materials;
- answer questions;
- complete Today sessions;
- see personal progress;
- interact with the AI Tutor;
- receive adaptive study recommendations.

### Instructor

An educator associated with one or more courses.

Potential capabilities:

- manage course content;
- upload materials;
- create or approve questions;
- manage assignments and exam dates;
- see aggregated student progress;
- review weaknesses and misconceptions.

Exact permissions remain to be finalized.

### Institution Admin

Manages institution-level access, courses, instructors, and potentially reporting.

### Platform Admin

Internal UNLOCK administration.

Can manage platform-level configuration, moderation, support, system operations, and feature access.

### Future role: Parent

Parent is **not** a first-class role in the current academic architecture.

It may be introduced later as part of a Schools Edition.

---

# 7. Academic domain model

The product should not be built around a flat Topic model alone.

The long-term academic hierarchy may be:

```text
Institution (optional)
    ↓
Course
    ↓
Topic / Unit
    ↓
Material
    ↓
Question
```

**Institution is not a mandatory parent for Course.** A Course must be able to exist independently for an individual learner, private cohort, pilot, or direct-to-consumer use case.

In the future, a Course may optionally be associated with an Institution. The production database must therefore avoid making `institution_id` a required foreign key on `Course` in V1.

The learner-side relationship is:

```text
Student
    ↓
Enrollment
    ↓
Course
    ↓
Exam / Assignments
    ↓
Progress
```

This structure is important because exam readiness, assignment urgency, analytics, Today planning, instructor access, and learner progress depend on course context.

### 7.1 Institution

Represents an academic institution or organization.

This entity is architecture-ready but not required for V1. Courses must remain valid without an Institution relationship.

### 7.2 Course

Represents a course or learning program.

A course may contain:

- topics / units;
- materials;
- questions;
- exams;
- assignments;
- enrolled students;
- instructors.

### 7.3 Topic / Unit

Represents a logical content area within a course.

The exact naming convention may vary by course, but the database should support a stable course hierarchy.

### 7.4 Material

Represents source learning content.

Possible material types include:

- PDF
- DOC / DOCX
- TXT
- pasted text
- future supported formats

### 7.5 Question

Represents an assessable learning item associated with course content.

### 7.6 Enrollment

Represents the student's participation in a course.

### 7.7 Exam

Represents an exam associated with a course or group.

### 7.8 Assignment

Represents an assignment or deadline that may affect learning priority.

---

# 8. Question model

The initial core question type is multiple choice.

A question may contain:

```text
question_text
answer_options
correct_answer
explanation
difficulty
topic_id
material_id
created_by
created_at
```

The final storage model for answer options — normalized table vs structured JSON — remains **TBD** pending database design.

Questions should be traceable to source material whenever possible.

---

# 9. Question creation

Questions can be created in two ways.

## 9.1 Manual creation

A user with appropriate permissions can create a question manually.

Basic workflow:

```text
Question
Answer A
Answer B
Answer C
Answer D
Correct answer
Explanation
Save
```

Future question types may be supported, but the first implementation should prioritize high-quality multiple-choice learning.

## 9.2 AI-assisted creation

Users may upload or provide learning material.

The system processes the material and generates draft questions.

The workflow should be:

```text
Upload material
    ↓
Extract content
    ↓
Chunk / analyze content
    ↓
Identify learning concepts
    ↓
Generate structured question candidates
    ↓
Validate output
    ↓
Preview
    ↓
Edit / delete / approve
    ↓
Save approved questions
```

Generated questions should **not** automatically become trusted production questions without a review path unless a future product decision explicitly allows that.

---

# 10. Structured AI output

AI-generated content must use structured, schema-validated responses.

The system should not rely on free-form AI text that is later parsed heuristically.

For example, a generated question should have a predictable schema containing fields such as:

```text
question
answers[]
correct_answer_index
explanation
source_reference
difficulty
```

Exact schemas should be documented in the AI specification.

Invalid responses should fail safely and be retryable.

---

# 11. Question Verification Pipeline

AI-generated questions require an explicit **dual-pass verification workflow** before they are promoted from draft content into the active learning bank or shown to learners as trusted learning content.

A generated question may be persisted internally as a **draft** before verification so work is not lost, but it must not become learner-visible, enter Today, or be treated as an approved question until the verification gate has passed.

The purpose is to reduce hallucinated answers, unsupported citations, ambiguous answer keys, and questions whose evidence does not actually support the defined correct answer.

The two AI passes must have different responsibilities.

## Pass 1 — Generation

The generation model creates a structured draft question from source material.

Required output should include provenance such as:

```text
question_text
answer_options
correct_answer
explanation
source_material_id
source_chunk_id
source_reference / evidence span
generation_model
generation_status
```

The generation pass must not be treated as proof that the question is correct.

## Pass 2 — Independent Verification

A second, explicit AI verification call reviews the generated draft against the cited source context before learner-facing activation.

The verifier should receive, at minimum:

```text
generated question
answer options
defined correct answer
explanation
cited source excerpt / source chunk
```

The verifier must answer structured questions such as:

```text
Does the cited source support the defined correct answer?
Is exactly one answer clearly correct?
Is the explanation supported by the source?
Is the question answerable from the available evidence?
Are any distractors also defensibly correct?
Is the source citation relevant to the claim being tested?
```

The verification call should return a structured result such as:

```text
verification_result
verification_confidence
issues[]
recommended_action
```

The verifier should be treated as independent from the generation step where practical. This may mean a separate prompt, model configuration, model, or provider.

## Verification states

Questions should expose a traceable verification state such as:

```text
UNVERIFIED
SOURCE_LINKED
RULE_VALIDATED
AI_VERIFIED
HUMAN_APPROVED
REJECTED
```

A generated draft may exist in `UNVERIFIED` or `SOURCE_LINKED` state, but it should not silently become trusted active content.

For AI-generated questions, learner-facing activation should require at least the verification level defined by the current product policy. In the initial production policy, the intended default is:

```text
Generation pass
→ SOURCE_LINKED
→ deterministic validation
→ independent AI verification pass
→ AI_VERIFIED
→ eligible for learner-facing use
```

`HUMAN_APPROVED` may be required for institutional, disputed, shared, or otherwise high-stakes content.

## V1 cost discipline

Dual-pass verification applies at **content creation / approval time**, not on every learner interaction.

To keep cost low:

- verification calls should be batched where possible;
- cached results should be reused;
- a question should not be re-verified unless the question, answer key, explanation, or source evidence changes;
- manual questions do not require an AI verification call by default;
- development and automated tests should use fixtures/mocks rather than paid AI calls;
- AI generation itself may remain feature-flagged during early development.

This preserves the product differentiation of verified AI-generated content without creating runtime AI cost on every quiz answer or Today session.

## Human approval

Human review remains the strongest trust level for high-stakes, institutional, widely shared, or disputed content.

A human reviewer should be able to see:

- the generated question;
- the source evidence;
- the verification result;
- the verifier's issues/reasoning summary;
- previous edits and verification status.

Verification must be traceable and must never be inferred solely from the fact that an LLM generated the question.

# 12. Source materials and traceability

Source material should remain connected to generated questions.

The system should preserve relationships such as:

```text
Material
    ↓
Chunk
    ↓
Generated question
```

This allows future capabilities such as:

- source citation;
- question regeneration;
- material-specific Tutor answers;
- validation against source content;
- identifying the section from which a question originated.

---

# 13. RAG and retrieval layer

For source-aware AI Tutor functionality, UNLOCK should support a retrieval architecture.

Likely flow:

```text
Material
    ↓
Text extraction
    ↓
Chunking
    ↓
Embeddings
    ↓
Vector retrieval
    ↓
Relevant source context
    ↓
AI Tutor response
```

The exact embedding provider and vector implementation remain **TBD**.

The architecture must allow the Tutor to answer from course material rather than from general model knowledge alone.

---

# 14. AI provider abstraction

Business logic should not directly depend on one model provider.

UNLOCK should introduce an AI provider/service layer so that model calls can be switched, compared, or routed across providers such as:

- OpenAI
- Gemini
- Anthropic
- future providers

Product logic should call UNLOCK's AI service interface rather than provider-specific SDK code throughout the application.

This should support:

- provider switching;
- model experimentation;
- fallback behavior;
- cost control;
- testing;
- future routing strategies.

---

# 15. Async AI processing

Long-running AI operations must not block a normal request.

Examples:

- processing a large PDF;
- extracting large documents;
- generating many questions;
- embedding a large course;
- bulk regeneration.

These should use asynchronous job processing.

A typical flow may be:

```text
Upload
    ↓
Create processing job
    ↓
Return status to user
    ↓
Worker processes content
    ↓
Job status updates
    ↓
User sees completed result
```

Exact queue/job technology remains **TBD**.

---

# 16. Quiz experience

The Quiz experience is one of the main learning interfaces.

A typical question flow:

```text
Question
    ↓
Student chooses answer
    ↓
Immediate feedback
    ↓
Explanation / Learn More
    ↓
Learning state is updated
    ↓
Next question
```

Feedback should clearly indicate:

- correct / incorrect;
- correct answer where appropriate;
- explanation;
- optional Learn More.

Every learner answer must create a persistent Attempt record.

---

# 17. Attempts are immutable learning evidence

Raw Attempts must be preserved.

An Attempt may contain:

```text
user_id
question_id
session_id
selected_answer
is_correct
answered_at
response_time_seconds
confidence_level
engine_version
```

Potential additional metadata may be added during database design.

The system must not replace attempt history with a single current mastery value.

The current mastery/progress state is derived from history.

---

# 18. Confidence

UNLOCK tracks learner confidence.

The exact UX for capturing confidence remains to be finalized, but `confidence_level` is an important learning signal.

Confidence makes it possible to distinguish between:

```text
Correct + high confidence
```

Likely strong knowledge.

```text
Correct + low confidence
```

Potential guess or uncertain knowledge.

```text
Incorrect + low confidence
```

Known uncertainty.

```text
Incorrect + high confidence
```

Potential misconception.

This signal may affect review priority and misconception detection.

---

# 19. Misconceptions

The system tracks repeated confident errors or other patterns indicating incorrect mental models.

A known field from the existing system is:

```text
misconception_hits
```

A misconception is more important than a simple isolated error because the learner may believe incorrect information is correct.

Misconceptions should receive significant priority in the Learning Engine.

---

# 20. Mastery

A known state field is:

```text
mastery_level
```

Mastery represents estimated learner control over a question or concept.

Mastery should not be equivalent to:

```text
one correct answer = mastered
```

Instead it should reflect evidence across time and attempts.

Possible inputs include:

- accuracy;
- recency;
- repeated successful retrieval;
- review intervals;
- confidence;
- response time;
- incorrect answers;
- misconception signals.

Exact formulas and thresholds belong in `LEARNING_ENGINE.md`.

---

# 21. Spaced repetition

A known field is:

```text
next_review_date
```

The system should determine when a learner should see a question again.

General behavior:

- weak item → reviewed sooner;
- improving item → wider interval;
- mastered item → reviewed less frequently;
- failed item → review interval may shrink;
- misconception → potentially urgent review.

The implementation should preserve or migrate the existing prototype logic rather than inventing a replacement without documenting the current behavior.

---

# 22. Response time

A known field is:

```text
average_time_seconds
```

Response time is a supporting signal.

For example, repeated fast correct answers may indicate stronger fluency than repeated very slow correct answers.

However, response time must not be used alone.

It should be interpreted together with other evidence such as:

- accuracy;
- confidence;
- mastery;
- attempt count;
- misconception state;
- question difficulty.

---

# 23. Learning Engine — product role

The Learning Engine is one of the core assets of UNLOCK.

Its job is not simply to schedule spaced repetition.

Its broader question is:

> How important is it for this learner to interact with this learning item right now?

The engine should produce a priority ranking.

Conceptually:

```text
priority_score =
    review_urgency
  + weakness
  + misconception
  + exam_urgency
  + assignment_urgency
  + mastery-related factors
  + other validated signals
```

The exact formula must be documented from the current prototype behavior before it is rebuilt.

No developer or AI coding agent should invent a new engine while migrating.

---

# 24. Known learning state fields

The existing system already includes at least:

```text
next_review_date
mastery_level
misconception_hits
confidence_level
average_time_seconds
```

These are not speculative concepts.

They must be part of the prototype audit and migration mapping.

Additional existing fields must be discovered and documented before final schema implementation.

---

# 25. Engine versioning

Every Learning Engine calculation that affects a session or learner state should be traceable to an engine version.

Examples:

```text
engine_version = "1.0"
engine_version = "1.1"
```

At minimum, engine version should be recorded on relevant session/calculation records.

Purpose:

- compare algorithm versions;
- debug unexpected behavior;
- reproduce historical decisions;
- run experiments;
- validate whether a new engine improves outcomes.

The engine must not become an opaque algorithm that changes without traceability.

---

# 26. Today — primary product experience

**Today is the primary experience of UNLOCK.**

The user should not need to select a topic every time they open the product.

UNLOCK generates today's learning plan.

The plan should use signals such as:

```text
Review urgency
+
Weakness
+
Misconception
+
Exam urgency
+
Assignment urgency
+
Mastery
```

The exact weighting belongs in the Learning Engine specification.

---

# 27. Today Session persistence

A Today session must be persistent.

If a learner opens Today at 08:00, completes 4 of 12 items, closes the app, and returns at 20:00:

**the same session must continue.**

The system must not silently regenerate a different Today session during the same daily learning period.

This requires persistent session entities.

Likely model:

```text
today_sessions
today_session_items
```

A Today Session should likely include:

```text
id
user_id
course/context
session_date
status
engine_version
created_at
started_at
completed_at
progress
```

A Today Session Item should likely include:

```text
today_session_id
question_id
position
status
source_reason
priority_score_at_generation
completed_at
```

Exact schema is **TBD**, but persistence is a product requirement.

---

# 28. Today → Quiz contract

The Quiz should support a session-driven mode.

In this mode, Quiz does **not** independently choose the next questions.

Instead:

```text
Learning Engine
    ↓
Today Session
    ↓
Prepared question IDs
    ↓
Quiz
```

The Today layer decides the planned session.

Quiz executes that plan and records attempts/results.

This separation is important for predictable behavior, testing, reproducibility, and analytics.

---

# 29. Session composition

A Today session should not simply consist of the highest priority negative signals if that creates a punishing experience.

The session may eventually balance:

- overdue review;
- weak items;
- misconceptions;
- exam-driven priorities;
- assignments;
- previously successful material;
- new learning;
- variety across topics.

The exact composition algorithm is **TBD**.

The product should balance learning efficiency with motivation and completion.

---

# 30. New user / empty-state logic

Today must work for a learner with no history.

A new user may have:

- no attempts;
- no mastery;
- no due questions;
- no misconception data.

The product therefore requires a Starter Session / Diagnostic Sampling strategy.

Possible goals:

- establish an initial knowledge baseline;
- sample material across important topics;
- avoid fake confidence in the system;
- create enough data for the Learning Engine to personalize future sessions.

Exact diagnostic logic is **TBD**, but the empty state cannot simply show:

> "Nothing to review."

---

# 31. Exam date hierarchy

UNLOCK should support exam urgency.

The currently defined precedence rule is:

```text
personal_exam_date
    >
group_exam_date
    >
null
```

Meaning:

1. if the learner has a personal exam date override, use it;
2. otherwise use the shared/group/course exam date;
3. if no exam date exists, exam urgency should not be fabricated.

This hierarchy must be represented in the data model.

---

# 32. Exam urgency

The Learning Engine should be able to increase priority as an exam approaches.

Exam urgency should not operate alone.

It should interact with:

- remaining course material;
- mastery;
- weakness;
- review due dates;
- misconceptions;
- available time;
- assignments.

The exact urgency curve is **TBD**.

---

# 33. Exam Readiness

UNLOCK should calculate an estimate of exam readiness.

This must **not** display a confident percentage when insufficient data exists.

The system requires a minimum-data threshold.

Possible states may be:

```text
Not enough data
Early estimate
Moderate confidence estimate
High confidence estimate
```

A future readiness display may include both:

```text
Readiness estimate
+
Estimate confidence
```

For example:

```text
Readiness: 72%
Estimate confidence: Medium
```

The exact readiness model is **TBD**, but the product principle is fixed:

> Do not show false precision to a new or sparsely observed learner.

---

# 34. Assignments and Assignment Urgency

Assignments must be modeled as learning priorities, not just calendar metadata.

Assignment urgency may affect Today priority.

Potential factors include:

- due date;
- relevant topics;
- learner mastery of required topics;
- assignment importance;
- assignment status.

Exact Assignment Urgency logic remains **TBD**.

---

# 35. Learning Session types

The product may support multiple session types.

At minimum:

### Today / Daily Session

System-generated adaptive session.

### Manual Practice

Learner chooses course/topic and practices manually.

### Assignment-driven Session

Potential future session focused on an assignment.

### Exam Preparation Session

Potential future mode optimized around exam preparation.

Today remains the primary default flow.

---

# 36. Home screen

The Home experience should prioritize Today.

Instead of primarily presenting:

```text
Choose a topic
```

the Home should present the user's current plan.

Examples:

```text
Today's plan: 12 questions
```

```text
You completed 7 / 12
```

```text
Continue Today
```

```text
Today's session complete
```

Secondary navigation can expose courses, progress, Tutor, manual practice, and content tools.

---

# 37. Product analytics

UNLOCK must track product events required to evaluate whether the core learning loop works.

At minimum, events should include:

```text
today_opened
today_started
session_completed
session_abandoned
```

Likely future events include:

```text
question_answered
learn_more_opened
tutor_opened
material_uploaded
question_generated
question_approved
course_opened
manual_practice_started
```

Analytics event naming and payload schemas should be documented separately.

---

## 37.1 Data collection discipline

UNLOCK should collect future-facing data only when there is a clear hypothesized product, learning, operational, or research use.

Do not create speculative telemetry solely because it may be useful one day.

Before adding a new event or field, document at least one intended use such as:

- a defined product KPI;
- a learning-model input;
- a diagnostic or quality signal;
- a security/audit requirement;
- a planned experiment;
- a clearly stated future capability.

Avoid collecting sensitive or high-volume data without a concrete purpose.

# 38. Primary KPI

A core product KPI is:

> **% of active users completing Today on 3+ separate days per week**

This metric captures whether UNLOCK is becoming a repeat learning habit rather than merely attracting one-time quiz usage.

Secondary metrics may include:

- Today completion rate;
- weekly active learners;
- session abandonment;
- retention;
- average study days/week;
- questions answered;
- mastery improvement;
- exam readiness improvement;
- AI generation usage;
- Tutor usage.

---

# 39. User progress analytics

The learner should eventually be able to see meaningful progress.

Potential metrics include:

- accuracy;
- attempts;
- mastery;
- mastered topics;
- weak topics;
- misconceptions;
- average response time;
- questions due;
- course progress;
- Today streak;
- exam readiness.

The interface should avoid vanity metrics that do not help learning decisions.

---

# 40. Instructor analytics

Instructors may eventually see:

- student activity;
- course progress;
- mastery by topic;
- common misconceptions;
- weak course areas;
- completion trends;
- exam readiness distribution;
- assignment-related performance.

Privacy and permission boundaries must be defined before implementation.

---

# 41. AI Tutor

UNLOCK includes an AI Tutor direction.

The Tutor should not be a generic chatbot.

It should operate in learning context.

Possible learner actions:

```text
Why is my answer wrong?
```

```text
Explain this more simply.
```

```text
Give me another example.
```

```text
Show me where this appears in the course material.
```

The Tutor may use:

- current question;
- selected answer;
- correct answer;
- explanation;
- source material;
- retrieved chunks;
- course context;
- learner knowledge state.

Tutor behavior must respect permissions and material ownership.

---

# 42. AI is not the Learning Engine

The Learning Engine must not depend on an LLM call for every click or every question decision.

The engine should be implemented as application/domain logic that is:

- deterministic enough to test;
- versioned;
- observable;
- reproducible;
- cost-efficient.

LLMs may assist with:

- question generation;
- explanations;
- tutoring;
- summarization;
- source interpretation.

They should not be the hidden controller of the adaptive ranking algorithm.

---

# 43. AI cost controls

AI usage must have operational controls.

The system should eventually support:

- per-user usage tracking;
- per-feature usage tracking;
- token/cost logging;
- model selection;
- quotas;
- caching;
- rate limits;
- fallback models;
- retry rules;
- failure behavior;
- administrative monitoring.

The exact limits and pricing model are **TBD**.

---

# 44. Challenges and competition

UNLOCK may support group Challenges / Competitions.

Potential features:

- group challenge;
- leaderboard;
- points;
- time-limited challenge;
- topic competition;
- streak competition.

This is not part of the adaptive core and should not delay core Today + Learning Engine implementation.

---

# 45. Gamification

Possible gamification systems include:

```text
XP
streaks
mastery progress
badges
leaderboards
challenges
```

Rules:

- gamification should support learning;
- do not reward meaningless repeated clicking;
- rewards should ideally correlate with real engagement or learning progress;
- avoid mechanisms that incentivize gaming the system.

---

# 46. Notifications

Notifications are a natural extension of Today and `next_review_date`.

Possible notifications:

```text
Your Today session is ready.
```

```text
8 questions are ready for review.
```

```text
Your exam is approaching — today's plan has been updated.
```

Notifications are a candidate feature, but their MVP scope remains **TBD**.

---

# 47. Web / PWA first

The current roadmap direction is:

```text
Web application
    ↓
PWA-quality mobile experience
    ↓
Product validation
    ↓
Native app if justified
```

A native application should not be the first implementation priority.

If native becomes justified later, Expo / React Native is a likely candidate, but that decision should be revisited based on validated product needs.

---

# 48. Accessibility and RTL

UNLOCK should be designed with accessibility from the beginning.

Requirements should include:

- RTL support;
- Hebrew-first compatibility;
- keyboard navigation;
- clear focus states;
- sufficient contrast;
- screen reader compatibility;
- semantic HTML;
- accessible labels;
- touch targets suitable for mobile;
- avoiding interactions that require precise mouse control.

RTL should be treated as a first-class layout requirement rather than a late translation patch.


## 48.1 Language, localization, and internationalization

UNLOCK is **Hebrew-first and RTL-first**.

All user-facing interfaces should default to:

```text
Language: Hebrew
Direction: RTL
Locale: he-IL
```

Internal technical implementation should remain in English.

This includes:

- code identifiers;
- variable and function names;
- database table and field names;
- API names;
- technical documentation;
- Cursor rules;
- logs and internal system events.

User-facing content should be separated from implementation logic.

Do not hard-code Hebrew interface strings directly throughout components where avoidable.

Prefer a translation/message structure such as:

```ts
{
  today: {
    start: "התחל ללמוד",
    continue: "המשך ללמוד",
    completed: "סיימת להיום"
  }
}
```

This should allow future languages to be added without rewriting application components.

The first release may support Hebrew only, but the architecture should be **i18n-ready from day one**.

RTL behavior must be tested across:

- navigation;
- forms;
- cards;
- quiz answer layouts;
- icons and directional controls;
- modals;
- tables;
- charts;
- progress indicators;
- mixed Hebrew/English text;
- numbers, dates, percentages, and academic terminology.

Dates, numbers, and formatting should use appropriate locale-aware formatting rather than manually formatted strings.

Important distinction:

> Product language is Hebrew-first. Technical language is English-first.

---

# 49. Current technical direction

The current proposed stack is:

```text
Cursor
GitHub
Next.js
TypeScript
Tailwind CSS
Supabase / PostgreSQL
Vercel
```

This is the current direction, not a license to automatically add every technology immediately.

Technical decisions should be introduced only when required by the implementation plan.

Next.js may initially support both frontend and server-side application logic.

A separate backend service should not be introduced unless there is a clear technical need.

---

# 50. GitHub as source control

GitHub is the canonical source repository for application code.

A clean local environment should be reproducible with a workflow similar to:

```text
git clone
npm install
npm run dev
```

Environment-specific configuration must not require copying undocumented local files between developers.

---

# 51. Environment configuration and secrets

Secrets must never be committed to Git.

Examples:

- AI API keys;
- database service keys;
- storage secrets;
- admin tokens;
- provider credentials.

All sensitive API usage must occur server-side.

The client must never receive privileged provider secrets.

Use environment variables and documented `.env.example` files.

---

# 52. Database security and Row Level Security

If Supabase is used, Row Level Security (RLS) should be considered a required architecture principle rather than an optional cleanup step.

Permissions must reflect product roles and ownership.

Examples:

- a student can access permitted course data;
- a student can access their own attempts/progress;
- an instructor can access authorized course data;
- institution admins are restricted to their institution;
- platform admins have explicit platform-level access.

RLS policies must be tested.

Service-role keys must never be exposed to the browser.

---

# 53. Data ownership

The system must define ownership of:

- uploaded course materials;
- generated questions;
- instructor-created questions;
- student-generated content;
- AI-generated derived content;
- learner progress data.

Exact legal/product policy remains **TBD**, but database relationships should preserve ownership and provenance.

---

# 54. Privacy and deletion

Before public launch, UNLOCK must define:

- account deletion;
- user data export;
- uploaded material deletion;
- retention policy;
- deleted-course behavior;
- anonymization requirements;
- AI provider data handling;
- institutional data responsibilities.

Deletion should be designed intentionally rather than added as an emergency feature later.

---

# 55. Prototype learnings principle

UNLOCK is a new standalone production build, but it is informed by validated prototype learnings.

Important product logic already exists in the early prototype.

The reuse principle is:

> Preserve validated behavior intentionally; do not recreate prototype implementation constraints.

For each existing component:

```text
What exists?
What behavior does it implement?
What data does it store?
What depends on it?
Should it be kept?
Should it be rebuilt?
Should it be improved?
Should it be removed?
Should it be postponed?
```

When reviewing prototype behavior, each relevant capability should receive one of:

```text
KEEP
REBUILD
IMPROVE
REMOVE
POSTPONE
```

---

# 56. Prototype audit

Before carrying prototype behavior into production, inspect only the relevant evidence for:

### Features

What user-facing features currently exist?

### Database

What entities and fields exist?

### Learning logic

What formulas, thresholds, rules, and state transitions exist?

### Automation

What background actions or prototype automations exist?

### AI

What prompts, providers, generation behavior, and stored outputs exist?

### UX

What flows should be preserved, improved, or removed?

### Analytics

What data is already being collected?

The focused audit should produce `PROTOTYPE_LEARNINGS.md`.

---

# 57. Do not rebuild the Learning Engine blindly

The current engine already uses learning signals.

Known examples:

```text
next_review_date
mastery_level
misconception_hits
confidence_level
average_time_seconds
```

The exact current formula must be extracted from the existing system.

Cursor must not generate a new formula simply because the current one is not immediately documented.

---

# 58. Conceptual database entities

The final schema remains to be designed, but the product will likely need entities in the following areas:

```text
users
profiles

institutions
courses
enrollments
course_instructors

topics
materials
material_chunks

questions
answer_options

attempts
user_question_progress

exams
assignments

today_sessions
today_session_items

learning_sessions

ai_jobs
ai_generations
ai_conversations

challenges
challenge_participants

analytics_events
```

This list is conceptual and should not be directly turned into migrations without database design review.

---

# 59. UserQuestionProgress

A dedicated user-question progress model is likely central.

Conceptually it may include:

```text
user_id
question_id

mastery_level
next_review_date
misconception_hits
confidence_level
average_time_seconds

correct_count
incorrect_count
attempt_count

last_answered_at
last_result

updated_at
```

Exact fields must be reconciled with the early prototype before implementation.

The same question can be mastered by one student and weak for another.

Therefore Question and UserQuestionProgress must remain separate concerns.

---

# 60. Today Session entities

The system requires a persistent Today model.

Conceptually:

```text
today_sessions
today_session_items
```

This is not optional if Today is the main product experience.

Session persistence enables:

- resume;
- progress;
- analytics;
- versioning;
- experimentation;
- consistent user experience;
- debugging.

---

# 61. Exam and assignment entities

The data model must support:

- course exam dates;
- personal exam-date override;
- assignment due dates;
- assignment-topic relationships where relevant.

These entities feed the Learning Engine.

They should not be added later as arbitrary metadata.

---

# 62. Database migrations

Schema changes must use a documented migration process.

The project should define:

- migration tool;
- migration file ownership;
- migration review process;
- naming/version rules;
- destructive migration rules;
- rollback strategy;
- production migration procedure.

No coding agent may perform destructive database changes without explicit approval.

---

# 63. Environments

At minimum, architecture should plan for:

```text
Development
Staging / Preview
Production
```

Production data should not be casually copied into local development.

Environment variables and databases should be separated.

---

# 64. Backups and recovery

Production data requires a backup and recovery strategy.

Before production launch, define:

- database backup schedule;
- restore procedure;
- file/storage backup requirements;
- recovery responsibilities;
- recovery testing.

---

# 65. Observability

UNLOCK should be observable.

The team should be able to detect and investigate:

- application errors;
- API errors;
- failed AI calls;
- failed background jobs;
- high latency;
- database errors;
- auth failures;
- cost anomalies.

Likely observability areas:

```text
error tracking
application logs
job logs
AI usage logs
performance metrics
cost metrics
```

Exact tools are **TBD**.

---

# 66. Product and system analytics separation

Product analytics and technical observability are different.

### Product analytics answers:

- Are users starting Today?
- Are they completing it?
- Are they returning 3+ days/week?
- Which flows are abandoned?

### Technical observability answers:

- Is the app failing?
- Are jobs timing out?
- Are AI calls failing?
- Is latency increasing?

Both are required.

---

# 67. Feature flags

Feature flags should be available for important experimental or risky functionality.

Examples:

- Today V2;
- Learning Engine 1.1;
- new readiness model;
- new AI provider;
- new question-generation flow.

Feature flags support:

- gradual rollout;
- A/B testing;
- rollback;
- controlled beta access.

The exact implementation is **TBD**.

---

# 68. Testing strategy

Testing is especially important because the Learning Engine is part of the product's core value.

## 68.1 Unit tests

Required for:

- priority calculations;
- mastery updates;
- exam urgency;
- assignment urgency;
- Today generation rules;
- readiness thresholds;
- misconception logic.

## 68.2 Integration tests

Required for:

- database behavior;
- RLS;
- session persistence;
- attempt → progress updates;
- AI job persistence;
- course access rules.

## 68.3 End-to-end tests

Required for critical user flows, including:

```text
Sign in
→ Open Today
→ Start session
→ Answer questions
→ Leave
→ Return
→ Resume same session
→ Complete
```

Other critical E2E flows should include:

```text
Upload material
→ Process
→ Generate questions
→ Review
→ Approve
```

## 68.4 Regression tests

Learning Engine changes should include regression coverage so that a refactor does not silently change learning behavior.

---

# 69. CI/CD

The preferred development flow should become:

```text
GitHub branch / PR
    ↓
lint
    ↓
typecheck
    ↓
tests
    ↓
build
    ↓
preview deployment
    ↓
review
    ↓
production
```

Production deployment should not depend on manually copying code from a local machine.

Exact GitHub/Vercel configuration will be implemented later.

---

# 70. Performance principles

UNLOCK should remain responsive on mobile networks.

Areas to design for:

- efficient database queries;
- correct indexes;
- pagination;
- caching where appropriate;
- avoiding unnecessary AI calls;
- background processing for slow work;
- minimizing client bundle size;
- avoiding loading large course datasets at once.

Today should load quickly because it is the product's main entry point.

---

# 71. Scalability principle

Do not prematurely over-engineer the product.

However, avoid architecture choices that make obvious future scale impossible.

Prioritize:

- simple services;
- normalized responsibilities;
- testable domain logic;
- asynchronous heavy processing;
- provider abstraction where vendor lock-in is meaningful;
- database indexes and access policies;
- observable failures.

---

# 72. Cursor's role

Cursor is a development tool.

It is not the product owner or architecture authority.

Before significant implementation, Cursor should read project documentation.

Cursor should not be prompted with:

```text
Build UNLOCK
```

Instead, work should be broken into scoped, reviewable tasks.

---

# 73. Cursor project rules

The repository should include rules such as:

```text
.cursor/
└── rules/
    ├── product.mdc
    ├── architecture.mdc
    ├── database.mdc
    ├── learning-engine.mdc
    ├── ai.mdc
    ├── security.mdc
    └── coding-standards.mdc
```

These files should encode important constraints in a form the agent can repeatedly consume.

---

# 74. Cursor anti-patterns

Cursor must not independently:

- replace the chosen database;
- introduce a second auth system;
- delete existing data fields;
- redesign the Learning Engine;
- create destructive migrations;
- duplicate domain logic;
- add large dependencies without justification;
- change existing behavior during refactoring;
- expose secrets client-side;
- bypass RLS for convenience;
- call an LLM from every learner interaction;
- rewrite project architecture because another pattern is easier for the agent.

For high-impact changes, Cursor should first explain:

1. what it wants to change;
2. why;
3. affected files;
4. data impact;
5. risks;
6. rollback path.

---

# 75. Documentation structure

The repository should evolve toward:

```text
docs/
├── PRODUCT.md
├── TODAY.md
├── ARCHITECTURE.md
├── DATABASE.md
├── LEARNING_ENGINE.md
├── AI_OPERATIONS.md
├── SECURITY.md
├── TESTING_AND_DEPLOYMENT.md
├── PROTOTYPE_LEARNINGS.md
└── ROADMAP.md
```

This Master Spec should eventually be split so that each document stays focused and maintainable.

---

# 76. MVP framing

The original historical demo MVP included concepts such as:

- Home;
- Quiz / Practice;
- Create Question;
- Topics;
- upload material;
- AI generation;
- dashboard;
- basic challenges / leaderboard;
- AI Tutor.

The new implementation should not simply rebuild that old demo checklist.

The production V1 should instead be defined as:

> The smallest production-quality version that preserves the existing valuable learning logic and delivers the new Today-first academic experience.

---

# 77. Recommended production V1

A likely first real product scope should prioritize:

### Foundation

- project setup;
- authentication;
- core roles;
- institution/course/enrollment model;
- secure database;
- environments.

### Learning data

- questions;
- attempts;
- user question progress;
- migrated learning state.

### Learning Engine

- existing V1 logic documented;
- V1 logic implemented and tested;
- engine versioning.

### Today

- daily session generation;
- persistent session;
- Today → Quiz contract;
- resume behavior;
- completion.

### Academic urgency

- exam dates;
- personal exam override;
- assignment due dates;
- engine inputs.

### Analytics

- Today funnel events;
- primary KPI tracking.

### AI

AI-assisted generation and Tutor may be phased depending on migration priority, but their architecture should follow the principles in this document.

---

# 78. What should not block the core

The following features should not delay the learning core unless explicitly reprioritized:

- social feeds;
- advanced profiles;
- native app;
- complex leaderboards;
- challenge ecosystems;
- school Parent role;
- broad community features;
- heavy LMS functionality.

---

# 79. Business model

The final business model and pricing are not yet locked.

Do not hard-code product architecture around a speculative pricing model.

Potential future segmentation may include individual users, institutions, or premium AI usage, but this remains **TBD**.

---

# 80. Data required before implementation is considered safe

Before rebuilding core learning behavior, the project must document:

- existing prototype data model;
- existing Learning Engine formula;
- mastery update rules;
- review scheduling rules;
- misconception logic;
- confidence collection behavior;
- question selection behavior;
- all current user roles;
- current course/topic/material structure;
- current AI flows;
- existing analytics events, if any.

Unknown behavior must be documented as unknown.

---

# 81. Open decisions

The following remain open and should be explicitly decided later:

- final authentication provider/configuration;
- final Supabase decision;
- exact role permissions;
- exact course/topic hierarchy constraints;
- exact answer option storage model;
- final Learning Engine formula;
- mastery thresholds;
- review interval algorithm;
- Today session size;
- Today composition mix;
- starter diagnostic algorithm;
- exam urgency curve;
- readiness formula;
- readiness minimum-data threshold;
- assignment urgency formula;
- AI providers;
- model routing;
- queue/job technology;
- embedding model;
- vector store;
- AI quotas;
- notification scope;
- pricing;
- retention policy;
- native roadmap trigger;
- analytics provider;
- observability provider;
- feature flag provider;
- migration tooling;
- backup strategy.

These are intentionally open.

---

# 82. Definition of product success

UNLOCK succeeds if it becomes a trusted daily learning system.

The learner should increasingly feel:

> "I do not need to figure out what to study. UNLOCK knows what deserves my attention."

The system should earn that trust by being:

- personalized;
- consistent;
- explainable;
- fast;
- accurate enough to be useful;
- progressively better as more learning evidence is collected.

---

# 83. Final product principle

The most important architectural and product distinction is:

> UNLOCK is not a system that generates questions with AI.

Question generation is useful.

The deeper product is:

> A system that builds a learner model over time and uses that model to decide the next best learning action.

Everything else should support that.

---



# 84. UNLOCK Intelligence Architecture

UNLOCK should be designed as an intelligent learning system with multiple specialized "brains", but the architecture must allow the product to launch and operate with little to no AI infrastructure cost.

A **Brain is a conceptual capability boundary. It does not imply a separate service, process, agent, model, database, or deployment unit.**

In V1, multiple Brains may be implemented inside the same modular monolith as ordinary TypeScript domain logic, analytics functions, SQL queries, or feature-flagged modules.

The guiding principle is:

> Build the interfaces, data model, events, and decision boundaries now. Activate expensive intelligence only when product usage justifies it.

The presence of a Brain in the architecture does **not** mean it must run as an AI agent in V1.

A Brain may initially be:

- deterministic application logic;
- a SQL query;
- a scheduled local rule;
- an analytics calculation;
- a disabled module behind a feature flag;
- a future interface with no active external AI calls.

This allows UNLOCK to preserve a strong long-term architecture without paying for unnecessary infrastructure before product validation.

---

## 84.1 Three intelligence layers

UNLOCK should distinguish between three types of intelligence.

### Layer A — Real-Time Deterministic Engines

These run during the learning experience and should be fast, cheap, testable, and reproducible.

Examples:

```text
Learner State
Mastery
Review scheduling
Priority
Exam urgency
Assignment urgency
Response-time anomalies
Gamification / XP
Exam readiness
```

These should not require an LLM.

### Layer B — Analytical Intelligence

These calculate patterns from stored product data.

Examples:

```text
Question discrimination
Distractor performance
Difficulty
Failure heatmaps
Explanation effectiveness
Class weakness patterns
Topic mastery distributions
```

These should primarily use SQL, statistics, and deterministic calculations.

### Layer C — Autonomous / Background Intelligence

These are background processes that can detect issues, investigate them, create findings, and optionally recommend actions.

Examples:

```text
Content QA
Personal Coach
Class Digest
Resource Curator
System Auditor
```

These may use AI selectively, but should not default to constant LLM activity.

---

# 85. Cost-Efficient-by-Default Intelligence Strategy

The first production version should be designed to minimize recurring and variable cost by default, especially AI cost, while allowing justified spending when it materially improves reliability, security, speed of development, or validated user value.

The architecture should therefore follow this order:

```text
1. Deterministic rule
2. SQL/statistical calculation
3. Cached/precomputed result
4. Optional AI analysis
```

AI should be the last step, not the first.

If a useful feature can be implemented reliably without an LLM, it should initially be implemented without one.

---

# 86. Intelligence Capability Levels

Each Brain should support capability levels.

```text
Level 0 — Disabled
Level 1 — Deterministic
Level 2 — Analytical
Level 3 — AI-assisted
Level 4 — Semi-autonomous
```

A production environment may run different brains at different levels.

Example:

```text
Learner State Brain        Level 1
Next Best Action Brain     Level 1
Content Intelligence       Level 1
Knowledge Graph Brain      Level 0
System Auditor             Level 1
Intervention Brain         Level 0
```

This model allows functionality to evolve without changing the whole architecture.

---

# 87. Brain 1 — Learner State Brain

Purpose:

> Maintain UNLOCK's best current estimate of what the learner knows.

Inputs may include:

```text
accuracy
confidence
response time
mastery
misconceptions
recency
question difficulty
review history
exam context
assignment context
```

V1 implementation should be deterministic.

No LLM calls are required.

The Brain may initially use:

- validated prototype learning logic;
- review scheduling;
- mastery updates;
- rule-based misconception handling;
- aggregated learner-question state.

This Brain is core and should be active from early versions.

---

# 88. Brain 2 — Next Best Action Brain

Purpose:

> Decide what the learner should do next.

This Brain powers Today.

Possible actions include:

```text
review a question
practice a weak concept
practice a prerequisite
start a diagnostic item
study exam-priority content
study assignment-priority content
```

V1 should be deterministic and based on the Learning Engine priority model.

No LLM is required.

This Brain should be one of the first active intelligence components.

---

# 89. Brain 3 — Knowledge Graph Brain

Purpose:

> Understand relationships between concepts and prerequisites.

Long-term capabilities:

```text
Concept A
    ↓ prerequisite for
Concept B
    ↓ prerequisite for
Concept C
```

This may allow UNLOCK to identify root causes rather than only surface-level errors.

V1 approach:

- architecture/data model should allow concept relationships;
- implementation may remain disabled or minimal;
- relationships may initially be manually defined or absent;
- no recurring AI generation is required.

Future AI may suggest relationships, but automated changes should require review.

---

# 90. Brain 4 — Content Intelligence Brain

Purpose:

> Continuously measure and improve the quality of learning content.

This should combine multiple quality functions rather than creating many independent agents.

Possible detectors:

```text
Question quality
Distractor quality
Difficulty calibration
Discrimination
Duplicate questions
Explanation effectiveness
Potential incorrect answer key
```

V1 should prioritize cheap deterministic/statistical checks.

Examples:

- answer distribution;
- distractor selection rate;
- question difficulty;
- discrimination index;
- answer-length imbalance;
- duplicate text similarity;
- edit/delete rates.

AI semantic review should be optional and triggered only for suspicious items.

No automatic content-changing action should occur in V1.

Findings should be reviewable by a human.

---

# 91. System Auditor Brain

Purpose:

> Monitor whether UNLOCK's own learning system behaves as intended.

Examples:

```text
Are high-mastery questions being shown too often?
Did Today completion drop after an engine update?
Are some users trapped in repeated review loops?
Is exam readiness systematically overestimated?
Did a change create unusual abandonment?
```

V1 can operate primarily using analytics and anomaly thresholds.

AI is not required.

This Brain should initially create findings rather than automatically modify the engine.

---

# 92. Brain 6 — Intervention Effectiveness Brain

Purpose:

> Learn which teaching intervention works best for each learner.

Possible intervention types:

```text
explanation
worked example
prerequisite review
extra question
visual explanation
simplified explanation
```

The key long-term question is:

> What type of help produces the best subsequent learning outcome for this learner?

V1 should **not** implement an expensive adaptive AI system.

Instead, V1 should only collect the data needed for future analysis.

Suggested events/data:

```text
problem_detected
intervention_type
intervention_shown
subsequent_attempt
subsequent_performance
```

This makes the capability possible later without requiring cost today.

---

# 93. Background Agent Candidates

The following capabilities should exist in the roadmap but do not need to run as autonomous AI agents in V1.

## 93.1 Content QA Agent

Detects suspicious questions.

Possible signals:

```text
low discrimination
abnormal answer distribution
high edit/delete rate
possible incorrect answer key
high report rate
```

V1:
- deterministic flagging only.

Future:
- optional AI review against source material.

## 93.2 Distractor QA

Should be implemented inside Content Intelligence.

Cheap structural checks first:

```text
answer length imbalance
absolute wording
grammar mismatch
unused distractors
unusual position patterns
```

AI semantic review is optional and only triggered when needed.

## 93.3 Personal Coach

Future layer on top of:

```text
Learner State
+
Knowledge Graph
+
Today
```

V1 does not require autonomous coaching.

A future version may create weekly recommendations or generate targeted practice.

## 93.4 Web Resource Curator

Not required for V1.

If activated later:

- use real web search;
- never invent URLs from model memory;
- validate that links work;
- validate relevance;
- consider source quality;
- avoid suspicious copyright-infringing sources.

## 93.5 Class Digest

Future lightweight scheduled output for instructors.

Example:

```text
This week:
- 3 concepts caused the most difficulty
- 2 questions may have quality issues
- Topic X improved
```

This may eventually be generated from deterministic analytics with optional AI summarization.

## 93.6 Semantic Duplicate Detection

Should initially use cheap normalized text / similarity methods.

Embeddings may be introduced later if scale justifies them.

## 93.7 Explanation Quality Detection

V1 should collect behavior that can later reveal poor explanations.

Example:

```text
wrong answer
→ explanation viewed
→ similar item answered
→ still wrong
```

Do not require an AI Agent at launch.

## 93.8 Difficulty Drift

Initially handled by System Auditor.

Detect major changes in question/topic performance over time.

## 93.9 Bias / Sensitive Content Review

Future moderation capability.

Not part of the core V1 intelligence architecture unless open content sharing becomes active.

## 93.10 Cross-User Content Reuse

Potential future cost-saving capability:

```text
same course/material detected
→ reuse approved high-quality content
```

This requires careful privacy, ownership, and permission rules before activation.

---

# 94. Human-in-the-Loop Principle

High-impact intelligence actions require human approval unless a deterministic safe rule explicitly permits automation.

Examples of actions that should not automatically occur in early versions:

- change the correct answer;
- delete a question;
- rewrite course content;
- modify Learning Engine weights;
- change exam readiness formulas;
- change concept dependencies;
- share one user's uploaded material with another user.

Agents should initially:

```text
Detect
↓
Explain
↓
Recommend
↓
Create finding
↓
Human reviews
```

---

# 95. Intelligence Findings Model

The architecture may later support a generic intelligence finding model so new capabilities can be added without redesigning the database. These entities are conceptual only and should not be created in V1 unless a concrete use requires them.

Conceptual entities:

```text
intelligence_runs
intelligence_findings
intelligence_actions
intelligence_configs
```

These may remain unimplemented until needed, but the conceptual model should be preserved.

Possible `intelligence_findings` fields:

```text
id
brain_type
finding_type
entity_type
entity_id
severity
confidence
reason
recommended_action
status
created_at
reviewed_by
reviewed_at
```

---

# 96. Scheduled Intelligence

Do not create frequent background schedules by default.

The recommended approach is:

```text
Real-time only when necessary
Daily/weekly only when useful
On-demand recalculation where possible
```

Examples:

```text
Learner State       real-time
Next Best Action    session generation / event-driven
Content QA          weekly or threshold-triggered
System Auditor      daily/weekly
Class Digest        weekly
Personal Coach      future weekly / milestone-triggered
```

This keeps operational cost and complexity low.

---

# 97. Feature Flags for Brains

Every optional Brain or AI-assisted capability should be controllable through configuration / feature flags.

Example:

```text
content_ai_review = false
personal_coach = false
web_curator = false
knowledge_graph_ai = false
class_digest = false
```

This allows the architecture to exist without creating runtime cost.

---

# 98. AI Cost Rules

The intelligence architecture must follow these rules:

1. No LLM call for every answer.
2. No LLM call for every Today decision.
3. No AI call when deterministic logic is sufficient.
4. Batch work when possible.
5. Cache reusable results.
6. Store structured outputs when reuse is likely.
7. Use AI only on suspicious / high-value cases.
8. Make AI-powered Brains optional through feature flags.
9. Track AI usage and estimated cost when AI is enabled.
10. Fail gracefully when an AI provider is unavailable.

---

# 99. IP Strategy

UNLOCK's defensibility should not depend on the existence of individual agents.

Features such as:

```text
FSRS
RAG
LLM tutoring
question generation
analytics
```

can be replicated by competitors.

UNLOCK's durable product advantage should come from the combination of:

```text
Learner Model
+
Knowledge Relationships
+
Next Best Action
+
Content Quality Intelligence
+
Intervention Outcomes
+
Historical Learning Data
+
Continuous Feedback Loop
```

The system should become increasingly difficult to replicate as it accumulates longitudinal learning data and calibrates its models against real outcomes.

The IP is therefore the **orchestration + data + learning feedback loop**, not a single AI model.

---

# 100. V1 Intelligence Activation Plan

To minimize cost and complexity, intelligence capabilities are prioritized as follows:

## MUST HAVE

```text
Learner State Brain
    → deterministic

Next Best Action Brain
    → deterministic
```

These are part of the core product.

## NICE TO HAVE EARLY

```text
Basic Content Intelligence
    → only cheap deterministic/statistical checks
```

This should be included only if it does not delay Today or the core learning loop.

## ONLY IF TRIVIAL

```text
Basic System Auditor signals
    → simple analytics or thresholds
```

System Auditor is **not** a V1 requirement. If it costs meaningful implementation time, it is deferred.

## Architecture-ready but inactive

```text
Knowledge Graph Brain
Intervention Effectiveness Brain
```

The product may collect only the minimal justified data required for future activation.

## Deferred

```text
Personal Coach
Web Resource Curator
Class Digest
AI semantic Content QA
advanced duplicate detection
autonomous remediation
```

These should be activated only when product validation, usage, or clear user value justifies their complexity and cost.

# 101. Cost-Efficient-by-Default Development Principle

During the earliest stage, the target should be:

> Do not introduce recurring cost before there is a clear product, reliability, security, operational, or development justification.

Whenever possible:

- use local development;
- use free-tier services;
- avoid paid model calls during routine development;
- mock AI provider responses in tests;
- use deterministic fixtures;
- disable optional background jobs;
- avoid premature vector infrastructure;
- avoid paid observability/analytics until necessary.

Zero cost is not a hard constraint. The goal is cost efficiency and disciplined spending. A paid service is justified when it clearly saves meaningful development time, reduces operational risk, prevents data loss, or enables validated product value.

The architecture should still allow a near-zero-cost prototype and early pilot where practical.

---

# 102. Intelligence Architecture Summary

The initial intelligence architecture should look conceptually like:

```text
                    DATA LAYER
                        │
        ┌───────────────┼────────────────┐
        │               │                │
        ▼               ▼                ▼
 Learner State     Analytics       Optional Jobs
        │               │                │
        ▼               ▼                ▼
 Next Best Action  Content Intel    Future Agents
        │               │
        ▼               ▼
      Today         QA Findings

Future:
Knowledge Graph
Intervention Effectiveness
Personal Coach
Class Digest
Web Curator
```

Most of V1 should operate without paid AI calls.

The architecture should make intelligence expandable without making intelligence expensive by default.


# V1 Core Activation Plan

The same scope discipline applied to intelligence must also be applied to the product core.

The goal of V1 is to validate whether learners repeatedly return to and complete **Today**.

## MUST HAVE V1

```text
User
Course
Material
Question
Attempt
UserQuestionProgress

Exam Date

Learner State
Next Best Action

Today Session
Today Session Items

Quiz

Basic Progress
```

The minimal learning loop is:

```text
User
→ Course
→ Material / Questions
→ Today
→ Quiz
→ Attempt
→ Learner State update
→ Next Today
```

## Architecture-ready, not feature-complete

The architecture should allow later addition of:

```text
Institution
Instructor
Enrollment groups
Institution Admin
Assignments
Knowledge Graph
Advanced analytics
```

These should not become V1 blockers unless required by a real pilot.

## Deferred from V1

```text
Advanced instructor dashboard
Institution administration suite
Challenges / leaderboards
Social/community features
Native app
Autonomous agents
Web resource curation
Advanced Knowledge Graph automation
Advanced intervention personalization
```

A feature that delays the core Today loop without being necessary to validate it should be postponed.

# 103. Immediate next steps

The project should **not** require a full-system prototype audit before development begins.

The immediate goal is to create enough verified understanding to safely build the V1 learning loop.

The required pre-build audit is therefore intentionally narrow.

## Step 1 — Freeze this Master Spec

Treat this document as the product constitution.

Do not continue expanding it with implementation detail unless a foundational product principle changes.

## Step 2 — Build the project foundation

Set up:

```text
Next.js / TypeScript
project structure
Cursor rules
documentation structure
environment handling
lint / typecheck / tests
Git workflow
```

No product feature work should begin before the basic engineering foundation is healthy.

## Step 3 — Perform a focused prototype V1 audit

Audit only the existing behavior required for the first learning loop.

At minimum, document how the early prototype currently calculates or updates:

```text
mastery_level
next_review_date
misconception_hits
```

Also capture only the directly related inputs required to reproduce those behaviors, such as attempts, correctness, confidence, time, or other fields if the current logic actually uses them.

Do **not** block development on documenting every early prototype entity, page, automation, role, or historical feature.

## Step 4 — Capture the minimum Learning Engine V1 behavior

The goal is not to perfectly reconstruct the entire historical engine before coding.

The goal is to answer:

```text
What changes mastery_level?
How is next_review_date determined?
What increments / clears misconception_hits?
Which raw answer data is required?
What behavior must V1 preserve?
```

Unknown or non-essential behavior should be documented as:

```text
UNKNOWN
NOT REQUIRED FOR V1
DEFERRED FOR LATER AUDIT
```

## Step 5 — Design the minimum V1 data model

Design only the schema required for:

```text
User
Course
Material
Question
Attempt
UserQuestionProgress
Exam Date
Today Session
Today Session Items
```

The schema should remain extensible for future institutions, instructors, assignments, knowledge graphs, and intelligence modules without requiring those features now.

## Step 6 — Split implementation documents

Create focused working documents from this Master Spec:

```text
PRODUCT.md
ROADMAP.md
TODAY.md
LEARNING_ENGINE.md
DATABASE.md
ARCHITECTURE.md
PROTOTYPE_LEARNINGS.md
```

Each document should distinguish:

```text
V1 REQUIRED
ARCHITECTURE-READY
DEFERRED
```

## Step 7 — Implement the smallest end-to-end learning loop

The first meaningful product milestone is:

```text
User
→ Course
→ Questions
→ Today
→ Quiz
→ Attempt
→ learner-state update
→ resume / complete Today
```

This should work before advanced AI, institution administration, dashboards, challenges, autonomous agents, or other future capabilities are built.

## Step 8 — Expand the prototype audit only when needed

When a future feature is about to be implemented, inspect any relevant prototype behavior at that time.

This creates a just-in-time learning-recovery process rather than a long discovery phase that blocks product development.

Guiding principle:

> Audit enough to preserve the V1 behavior we are about to build. Do not require complete historical understanding before the first useful product loop exists.

# 104. Change management

Any important product or architecture decision made after this document should be reflected in project documentation.

Do not allow important decisions to exist only inside:

- a Cursor chat;
- a Slack thread;
- a developer's memory;
- an isolated code comment.

The documentation should evolve together with the product.

---

**End of Master Specification v1.3**

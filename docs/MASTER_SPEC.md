# UNLOCK — Master Product Specification

**Version:** 2.0
**Status:** Active Product Constitution
**Repository:** `unlock-app`
**Primary product:** Adaptive learning platform
**Initial audience:** Academic learners
**Initial delivery:** Web / PWA, mobile-first
**Primary language:** Hebrew
**Primary direction:** RTL

---

# 0. Purpose of This Document

This document defines the durable product direction of UNLOCK.

It answers:

- What is UNLOCK?
- What problem does it solve?
- What is the core learner experience?
- What makes the product different?
- What product and learning principles must remain true?
- What major capabilities should the architecture support?
- What belongs in V1 versus later product evolution?

This document is intentionally high-level.

It is NOT:

- the current development status
- the current implementation plan
- a changelog
- a Run Report
- a database schema reference
- an API reference
- a detailed Learning Engine specification
- a list of unresolved decisions
- a Claude/Cursor workflow manual

Use the project documentation system as follows:

- `docs/MASTER_SPEC.md`
  - long-term product constitution

- `docs/DEV_STATUS.md`
  - what is currently implemented and verified

- `docs/CHATGPT_PLAN.md`
  - what should be executed in the current development run

- `docs/OPEN_QUESTIONS.md`
  - unresolved product/architecture decisions

- `docs/DECISIONS/*`
  - accepted durable decisions and their rationale

- `docs/LEARNING_ENGINE.md`
  - detailed Learning Engine behavior

- `docs/ARCHITECTURE.md`
  - technical architecture

- `docs/DATABASE.md`
  - persistence/data design

- `docs/CONTEXT_MAP.md`
  - navigation to the minimum relevant project context

Accepted ADRs override older or conflicting descriptions in this document.

Current implementation state belongs in DEV_STATUS, not here.

---

# 1. Product North Star

UNLOCK exists to remove a major burden from learning:

> The learner should not have to continuously decide what deserves attention.

The long-term product promise is:

> UNLOCK maintains an evolving understanding of the learner and uses it to decide the most useful learning action now.

The desired learner feeling is:

> "I don't need to figure out what to study. UNLOCK knows what deserves my attention."

This is the North Star.

UNLOCK should earn that trust through:

- longitudinal learner evidence
- consistent adaptive decisions
- appropriate review timing
- identification of weakness
- identification of misconceptions
- awareness of forgetting risk
- prioritization of learning need
- transparency where useful
- increasingly accurate personalization over time

---

# 2. Product Identity

UNLOCK is an adaptive learning system.

Its core value is not the existence of questions, content, AI, or a dashboard.

UNLOCK continuously builds and updates a learner model and uses that model to determine what learning activity should happen next.

Conceptually:

```text
Content
+
Learner Evidence
+
Memory State
+
Knowledge State
+
Context
+
Adaptive Decision Engine
=
Next Best Learning Action
```

The defensible product layer is the accumulated learning system:

```text
Longitudinal Learner Model
+
Learning Engine
+
Next Best Action
+
Daily Learning Experience
+
Historical Learning Outcomes
+
Continuous Feedback Loop
```

---

# 3. What UNLOCK Is Not

UNLOCK is not primarily:

- a quiz app
- a flashcard application
- a generic LMS
- a PDF chatbot
- an AI question generator
- a content repository
- a study timer
- a generic AI Tutor

These capabilities may exist inside the product.

They are supporting capabilities, not the central product identity.

The deeper product is:

> A system that models learning over time and continuously chooses the next best learning action.

---

# 4. Core Problem

Learners usually manage learning manually.

They choose:

- what to study
- what to review
- what to ignore
- when to return to material
- what they believe they already know
- how to prioritize before an exam

This decision-making is often unreliable.

Learners may:

- repeatedly review material they already know
- overlook weak areas
- misunderstand concepts without realizing it
- mistake familiarity for mastery
- become confidently wrong
- review at inefficient intervals
- forget previously learned material
- spend time on low-value content
- struggle to prioritize competing needs

UNLOCK should increasingly replace this manual prioritization with evidence-based learning decisions.

Instead of:

> "What do I feel like studying?"

the default product question becomes:

> "What deserves my attention now?"

---

# 5. Primary Product Experience — Today

The primary recurring learner experience is **Today**.

The normal interaction should be:

```text
Open UNLOCK
    ↓
See today's learning plan
    ↓
Start
    ↓
Complete prepared learning items
    ↓
Evidence is recorded
    ↓
Learner state changes
    ↓
Future learning decisions improve
```

Today is the learner-facing expression of the adaptive system.

The learner should not need to manually assemble a study session every day.

Other experiences may exist:

- Courses
- Manual Practice
- Progress
- AI Tutor
- Content creation
- Instructor tools
- Analytics

But Today remains the default recurring learning loop.

---

# 6. Core Product Loop

The central system loop is:

```text
Course / Learning Content
    ↓
Questions / Learning Items
    ↓
Today
    ↓
Learner Interaction
    ↓
Attempt
    ↓
Learner State
    ↓
Next Best Action
    ↓
Future Today
```

Every major V1 feature should either:

- enable this loop
- improve this loop
- measure this loop
- protect this loop

Features that do none of these should not delay the core product.

---

# 7. Product Principles

## 7.1 Learning Over Content Consumption

UNLOCK should optimize for:

- active retrieval
- meaningful practice
- feedback
- spaced review
- evidence collection
- durable learning

Passive content consumption is secondary.

---

## 7.2 Adaptive by Default

The learner should not need to configure the learning algorithm.

The system should make useful default decisions automatically.

---

## 7.3 Longitudinal Evidence

One interaction must not define the learner.

UNLOCK should reason from evidence accumulated across time.

---

## 7.4 Retrieval Matters

Knowing something after just seeing it is not equivalent to retrieving it independently later.

Spaced successful retrieval is stronger evidence than immediate repetition.

---

## 7.5 Forgetting Is Normal

Strong knowledge should not disappear from the system forever.

As forgetting risk increases, previously strong knowledge may become relevant again.

---

## 7.6 Misconceptions Matter More Than Ordinary Errors

An incorrect answer accompanied by strong confidence may represent a deeper problem than uncertainty.

The system should distinguish ordinary failure from evidence of an incorrect mental model.

---

## 7.7 Deterministic Learning Decisions

Real-time learner-state updates and Next Best Action decisions should be:

- testable
- explainable
- reproducible
- versionable
- inexpensive

They must not require an LLM call.

---

## 7.8 Low Friction

The ideal default path should remain close to:

```text
Open
→ Today
→ Start
```

---

## 7.9 Mobile First

The primary learning loop must work extremely well on a phone.

---

## 7.10 Trust Through Appropriate Transparency

The learner does not need to see internal scores.

The product should nevertheless be capable of providing useful explanations such as:

- this needs review
- this has been difficult
- this misconception returned
- this material has not yet been learned
- an exam is approaching

Do not expose internal complexity merely because it exists.

---

## 7.11 No False Precision

UNLOCK must not present confidence that the underlying evidence does not support.

Examples include:

- mastery
- readiness
- knowledge estimates
- predicted performance

When evidence is insufficient, the product should say so.

---

## 7.12 Gamification Serves Learning

Streaks, XP, badges, challenges, or competition may exist.

They should reward meaningful learning behavior rather than meaningless interaction.

---

# 8. Initial Market

The initial product direction is academic learning.

The first meaningful real-world validation context is a learner/course environment such as an academic class or pilot.

The architecture should support academic concepts without requiring institutional complexity from day one.

UNLOCK may later serve:

- universities
- colleges
- schools
- professional education
- certification programs
- independent learners
- organizational learning

The core learning model should remain portable across those contexts.

---

# 9. Product Roles

The current Course relationship model is based on `CourseMembership`.

The accepted Course roles are:

```text
OWNER
INSTRUCTOR
LEARNER
```

## 9.1 Learner

The primary product user.

A learner may:

- participate in Courses
- receive Today plans
- answer questions
- create Attempts
- practice manually
- view progress
- receive explanations
- interact with future tutoring features

Only an active `LEARNER` CourseMembership automatically contributes a Course to personal DailyPlan generation.

---

## 9.2 Instructor

An instructional / course-management role.

Potential capabilities include:

- manage learning content
- create questions
- approve content
- manage course dates
- inspect aggregate learning signals
- identify common weaknesses
- identify misconceptions

Exact instructor permissions evolve separately from the learner core.

An INSTRUCTOR membership must not automatically make that user's Course participate in their own learner Today.

---

## 9.3 Owner

A Course management/authorization role.

OWNER is distinct from LEARNER behavior.

Owning a Course does not automatically enroll the owner into adaptive learning for that Course.

---

## 9.4 Future Organizational Roles

Future product editions may support concepts such as:

- Institution Admin
- Platform Admin
- group/cohort management
- school-specific roles

These should not distort the learner-first V1 architecture before a real requirement exists.

---

# 10. Course Model

Course is the primary learning container.

A Course must be able to exist independently.

An Institution must not be required merely for a Course to exist.

Potential long-term hierarchy:

```text
Institution (optional)
    ↓
Course
    ↓
Topic / Unit (optional structure)
    ↓
Material
    ↓
Question
```

Not every layer must exist in V1.

The product should not prematurely create institutional or hierarchical complexity merely because it may be useful later.

CourseMembership defines the user-to-Course relationship.

Accepted membership and join behavior is defined by ADR-015.

---

# 11. Course Access and Join

Courses may use different join policies.

Current accepted V1 concepts include:

```text
OPEN
AUTHORIZED_ONLY
```

A link or QR code identifies the Course.

A link or QR code is not authorization by itself.

OPEN Courses may allow an authenticated learner to create an active LEARNER membership.

AUTHORIZED_ONLY Courses require an authorization mechanism defined separately from the public join path.

Existing OWNER or INSTRUCTOR roles must not be silently downgraded by learner self-join.

Revoked membership behavior must fail closed until explicit rejoin semantics are decided.

See:

`docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`

---

# 12. Content Model

UNLOCK needs learning content sufficient to support the adaptive loop.

Potential concepts include:

- Course
- Material
- Topic / Unit
- Question
- source/provenance information

The minimum durable Material model and the required Course hierarchy are still intentionally open.

The product must not assume that the first usable learning loop requires:

- PDF parsing
- RAG
- embeddings
- complex CMS tooling
- automated ingestion

The first real pilot should use the simplest content-entry method that produces realistic, high-quality learning evidence.

---

# 13. Question Model

Question is an assessable learning item.

V1 supports:

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
```

TRUE/FALSE can be represented as a two-option SINGLE_CHOICE question.

Future types may include:

- free text
- numeric
- ordering
- matching
- essay

They are not required for the current V1 core.

Accepted V1 answer representation is defined by ADR-014.

---

# 14. Question Versioning

Question content that has participated in learning history must remain historically interpretable.

QuestionVersion exists to preserve the exact question state associated with learning evidence.

Historical Attempts must never appear to reference:

- different wording
- different options
- a different correct answer

merely because content was later edited.

QuestionVersion is immutable historical evidence.

When learner-facing content or grading is required, the exact persisted QuestionVersion associated with the item must be used.

Do not substitute "the Question's current version" for historical evidence.

---

# 15. Attempts

Attempt is the primary immutable record of learner interaction.

An Attempt represents what happened at a specific learning moment.

It may include signals such as:

```text
user
course
question
question version
selected answer
correctness
confidence
response time
assistance
time
learning context
engine version
```

Attempts are immutable learning evidence.

The system must not replace attempt history with only a current mastery value.

Learner state is derived from evidence.

---

# 16. Manual Practice

Manual Practice is distinct from Today.

A learner may intentionally practice material outside the prepared DailyPlan.

Manual Practice:

- can create valid Attempts
- can update learner state
- can influence future learning decisions

But it does not resolve a Today DailyPlanItem merely because it involves the same Question.

Today and Manual Practice are separate interaction contexts.

---

# 17. Learner State

UNLOCK maintains an evolving model of the learner.

Learner state may include:

- memory state
- mastery
- retrieval history
- misconception state
- confidence evidence
- response-time evidence
- attempt statistics
- review timing
- lapse state

This model should answer:

> What is UNLOCK's best current evidence-based interpretation of this learner's relationship with this learning item?

The learner model should improve as evidence accumulates.

---

# 18. Mastery

Mastery represents accumulated evidence of durable learner control.

The target learner-facing progression is:

```text
UNKNOWN
→ EMERGING
→ DEVELOPING
→ STRONG
→ MASTERED
```

This is a product model.

It is not an instruction to silently migrate current implementation enums during unrelated work.

Principles:

- one correct answer does not imply mastery
- a short success streak does not automatically imply mastery
- spaced retrieval is stronger evidence
- mastery is cumulative
- mastery is reversible
- MASTERED is not terminal
- a later lapse may reduce mastery
- high-confidence incorrect evidence is significant
- unseen/new exposure alone must not create strong mastery

Exact implementation/calibration belongs in the Learning Engine specification and Open Questions.

---

# 19. Memory / Spaced Review

UNLOCK uses memory scheduling to estimate when retrieval should happen again.

The V1 scheduler family is FSRS-based behind an internal scheduling abstraction.

The system should maintain memory-related state such as when an item deserves another retrieval opportunity.

General principle:

```text
successful durable retrieval
→ spacing can widen

failure / lapse
→ review may become more urgent

time passes
→ forgetting risk changes
```

Strong knowledge may return to Today as forgetting risk increases.

Memory need may cross ordinary priority boundaries when evidence supports it.

Exact FSRS rating mapping and retention calibration remain separate decisions.

---

# 20. Misconceptions

Misconception represents evidence that the learner may hold an incorrect mental model.

Target product progression:

```text
NONE
→ SUSPECTED
→ ACTIVE
→ RESOLVED
```

Principles:

- one ordinary wrong answer does not automatically create ACTIVE
- high-confidence wrong is stronger evidence
- repeated related wrong evidence matters
- recurring misconception evidence across Questions may be especially important
- one later correct answer should not automatically erase a misconception
- resolution requires convincing successful evidence

Exact scoring and thresholds remain calibration work.

---

# 21. Confidence

Confidence is a useful learner signal.

It helps distinguish cases such as:

```text
Correct + confident
Correct + uncertain
Incorrect + uncertain
Incorrect + confident
```

Incorrect + confident may represent stronger misconception evidence than ordinary failure.

Confidence must not become an unexplained proxy for mastery or FSRS rating.

The exact learner-facing confidence interaction remains a product decision.

---

# 22. Response Time

Response time may provide useful supporting evidence.

It should never determine mastery by itself.

Response-time interpretation must account for issues such as:

- question type
- interface delay
- network delay
- learner interruption
- tab inactivity
- different cognitive demands

Response time should remain a supporting signal unless validated evidence justifies a stronger role.

---

# 23. Learning Engine

The Learning Engine is a core product asset.

Its broad question is:

> What learning action deserves the learner's attention now?

It is more than a spaced-repetition scheduler.

Conceptually it integrates evidence such as:

```text
memory need
weakness
mastery
misconception
retrieval qualification
exam urgency
future contextual signals
```

The Learning Engine must remain:

- deterministic for the same persisted state, policy, and explicit time
- testable
- versionable
- observable
- reproducible
- independent of real-time LLM calls

Detailed behavior belongs in:

`docs/LEARNING_ENGINE.md`

---

# 24. Next Best Action

Next Best Action converts learner state into candidate learning actions.

It represents questions such as:

- what is due?
- what is weak?
- what needs repair?
- what deserves reinforcement?
- what may have been forgotten?
- what new material should be introduced when there is no ordinary evidence-driven work?

The system should rank learning need.

The exact current action types, ranking tiers, reasons, and engine mechanics belong in the Learning Engine documentation and code.

---

# 25. Today / DailyPlan

Today is backed by a persisted DailyPlan.

The accepted model is:

```text
one learner
+
one learner-local calendar day
=
one DailyPlan
```

The DailyPlan contains ordered DailyPlanItems.

The learner may access the same plan through different views.

Global Today and Course Today are views over the same persisted plan.

Course Today does not generate an independent competing plan.

See ADR-016.

---

# 26. Learner-Local Day

The learner's persisted IANA timezone is authoritative for DailyPlan day calculation.

Examples:

```text
Asia/Jerusalem
Europe/London
America/New_York
```

The current device timezone must not silently redefine an already-persisted learner day on every request.

A future settings/travel experience may allow explicit timezone changes.

Detailed timezone edge cases belong in their dedicated design material.

---

# 27. DailyPlan Persistence

DailyPlan must persist.

A learner who leaves and returns during the same local day should resume the same underlying plan.

The system should not silently regenerate a different plan during the same day merely because the page was reopened.

DailyPlan persistence enables:

- resume
- deterministic completion
- reproducibility
- analytics
- debugging
- stable user experience
- plan history

---

# 28. Frozen Today Semantics

Today is frozen by default after generation.

Later interactions resolve existing items rather than continuously rebuilding the plan after every answer.

This provides:

- a real finish line
- predictable UX
- reproducibility
- stable analytics
- meaningful completion

Future limited mid-day adaptation may be introduced only through an explicit product decision.

---

# 29. Today Completion

A DailyPlan item may be resolved through the relevant allowed interaction.

Answering a Today question resolves the underlying item as completed.

Skipping resolves it as skipped.

Completing an item from Global Today or a Course-filtered Today view resolves the same persisted item.

There is no duplicate per-view learning state.

---

# 30. Skip

Skip is not an incorrect answer.

Skip:

- resolves the item
- creates no correctness evidence
- creates no Attempt solely for the Skip action
- does not create mastery failure
- does not create misconception evidence
- does not create a replacement item

The learner's DailyPlan retains a real finish line.

---

# 31. DailyPlan Size

Plan size should be driven by meaningful learning need.

UNLOCK should not force a fixed number merely to make every day look identical.

Principles:

- dynamic size
- useful minimum
- practical upper bound
- do not fill with weak/no-value items
- no replacement solely because an item was skipped
- the learner should be able to finish Today

Exact launch bounds remain calibration rather than immutable product rules.

---

# 32. New Learners / New Material

UNLOCK must work when no meaningful learner history exists.

A new learner may have:

- no Attempts
- no UserQuestionProgress
- no scheduled review
- no misconceptions

The product must not respond with an empty learning experience merely because adaptation evidence does not yet exist.

Accepted New Material V1 behavior is defined by ADR-017.

---

# 33. New Material V1

For V1:

**Unseen** means there has been no prior real Attempt for the Question.

Missing UserQuestionProgress alone does not prove that material is unseen.

New Material is a fallback.

It activates only when the learner has zero ordinary evidence-driven Next Best Action candidates for that DailyPlan.

Therefore:

```text
ordinary learning need exists
→ use ordinary candidates

zero ordinary candidates
→ New Material fallback may activate
```

V1 does not mix unseen filler into a plan that already contains ordinary learning need.

The fallback selects up to 3 unseen Questions deterministically.

Placement in a DailyPlan is not evidence.

The system must not fabricate UserQuestionProgress merely because New Material was planned.

The first real learner interaction creates evidence normally.

---

# 34. Exam Context

UNLOCK should eventually support exam-aware learning priority.

Exam urgency should be an amplifier, not an independent replacement for the Learning Engine.

The system should never invent an exam date.

Potential inputs include:

- personal exam date
- shared Course exam date
- remaining material
- current mastery
- memory need
- misconceptions

The exact exam-date hierarchy and urgency model remain explicit Open Questions.

---

# 35. Exam Readiness

Exam readiness is a meaningful future product direction.

However:

> UNLOCK must not show false precision.

A readiness estimate should require sufficient evidence.

Possible learner-facing states may eventually distinguish:

- insufficient evidence
- early estimate
- stronger estimate

The exact readiness model is deferred until the core adaptive loop has meaningful data.

---

# 36. Assignments

Assignments may eventually influence learning priority.

Potential signals include:

- deadline
- relevant content
- learner weakness
- importance/status

Assignment urgency must not be introduced as arbitrary ranking weight without an explicit product model.

Assignments are architecture-ready but are not required to validate the initial Today loop.

---

# 37. Home Experience

Home should prioritize Today.

The primary call to action should resemble:

```text
Today's learning
Continue Today
Start Today
Today's plan is complete
```

rather than:

```text
Choose what you want to study
```

Secondary navigation may expose:

- Courses
- Progress
- Manual Practice
- Tutor
- Content tools

---

# 38. Quiz / Learning Interaction

Quiz is an execution surface for prepared learning work.

When Quiz is operating from Today:

```text
Learning Engine
    ↓
DailyPlan
    ↓
DailyPlanItem
    ↓
Question interaction
```

Quiz must not independently select a different learning sequence behind the DailyPlan.

A typical answered item may involve:

```text
Question
    ↓
Learner answer
    ↓
Server-side correctness evaluation
    ↓
Feedback
    ↓
Attempt
    ↓
Learner-state update
```

---

# 39. Feedback

Learners should receive clear and timely feedback.

Potential feedback includes:

- correct / incorrect
- explanation
- correct answer where appropriate
- Learn More
- future Tutor support

Feedback should help learning without leaking internal security-sensitive or grading data before the learner has answered.

---

# 40. Learner-Facing Progress

UNLOCK should eventually provide useful progress, not vanity metrics.

Potential progress signals include:

- learning days
- Today completion history
- mastery
- weak areas
- misconceptions
- review need
- Course-level progress
- readiness where evidence supports it

The first progress experience should remain simpler than the adaptive learning core.

---

# 41. Product Analytics

UNLOCK must measure whether the central learning loop creates recurring behavior.

Important conceptual events include:

```text
Today opened
Today started
Today completed
Today abandoned
Question answered
Manual Practice started
```

Analytics should answer real product questions.

Do not create telemetry merely because it may become useful someday.

Before collecting new data, there should be an intended use such as:

- KPI
- learning input
- product experiment
- diagnostic signal
- security/audit need
- operational requirement

---

# 42. Primary Product KPI Direction

A central habit KPI direction is:

> Percentage of active users completing Today on 3+ separate days within a week.

This attempts to measure whether UNLOCK becomes a recurring learning habit.

Important details remain open, including:

- active-user denominator
- week boundary
- treatment of New Material / early learner days

Until those are decided, the KPI should be treated as a product direction rather than a finalized analytics contract.

---

# 43. Instructor Intelligence

Instructors may eventually receive aggregate insights such as:

- Course activity
- difficult concepts
- common misconceptions
- weak areas
- content-quality issues
- learning trends

Instructor analytics must respect:

- authorization
- privacy
- learner data boundaries
- Course ownership/access

Instructor tooling should not delay the learner Today loop unless required by a real pilot.

---

# 44. AI Product Role

AI supports UNLOCK.

AI is not the real-time Learning Engine.

Useful AI capabilities may include:

- question generation
- explanation generation
- tutoring
- summarization
- source interpretation
- semantic content-quality review
- future instructor summaries

Deterministic learner-state and Next Best Action logic should not depend on an LLM response during every learner interaction.

---

# 45. AI Tutor

AI Tutor is a future learning layer, not a generic chatbot.

Useful Tutor interactions may include:

```text
Why was my answer wrong?
Explain this more simply.
Give me another example.
Show me the relevant source.
Help me understand this misconception.
```

Tutor context may include:

- current Question
- learner answer
- correct answer after submission
- explanation
- source Material
- Course context
- permitted learner-state context

Tutor access must respect Course permissions and content ownership.

---

# 46. AI-Assisted Content Creation

Questions may eventually be generated from source Material.

Conceptual flow:

```text
Source Material
    ↓
Extract / identify relevant content
    ↓
Generate structured draft
    ↓
Validate
    ↓
Verify
    ↓
Review where required
    ↓
Activate
```

Generated output must be structured and schema validated.

Free-form text should not be heuristically parsed into trusted learning content when structured output can be required.

---

# 47. AI Content Verification

AI-generated content should not become trusted simply because an LLM produced it.

The long-term content-quality direction includes:

- source linkage
- deterministic validation
- independent verification
- optional human approval
- traceable verification state

Potential trust states may include concepts such as:

```text
UNVERIFIED
SOURCE_LINKED
RULE_VALIDATED
AI_VERIFIED
HUMAN_APPROVED
REJECTED
```

The exact workflow should be introduced only when AI-generated content becomes real implementation scope.

Human approval requirements remain policy-dependent.

---

# 48. Source Traceability

Where Questions are generated or authored from source Material, provenance should be preserved where practical.

Conceptually:

```text
Material
    ↓
Source segment / reference
    ↓
Question
```

This supports:

- source citations
- verification
- regeneration
- Tutor grounding
- dispute resolution
- content-quality review

The first learning loop does not require a complete RAG system merely to preserve the concept of provenance.

---

# 49. Retrieval / RAG Direction

Future source-aware AI experiences may use retrieval.

Conceptually:

```text
Material
    ↓
Extraction
    ↓
Chunking
    ↓
Retrieval representation
    ↓
Relevant source context
    ↓
AI response
```

The exact:

- embedding model
- vector infrastructure
- provider
- chunking strategy

remain future implementation decisions.

Do not introduce vector infrastructure before a concrete feature requires it.

---

# 50. AI Provider Independence

Business logic should not be spread across provider-specific SDK calls.

When AI becomes implementation scope, UNLOCK should provide an internal AI service boundary that can support:

- provider changes
- model experimentation
- testing
- cost management
- structured outputs
- graceful failure

Do not over-engineer provider abstraction before more than one provider is genuinely useful.

---

# 51. AI Cost Discipline

AI should be used where it creates real value.

Default order:

```text
1. Deterministic logic
2. SQL / statistical calculation
3. Cached or precomputed result
4. AI analysis
```

Rules:

- no LLM call for every learner answer
- no LLM call for every Today decision
- cache reusable AI outputs
- batch expensive work where useful
- use mocks/fixtures during routine tests
- make optional AI capabilities disableable
- track AI cost when AI becomes active
- fail gracefully when providers are unavailable

---

# 52. Intelligence Architecture

UNLOCK may be understood as several conceptual intelligence capabilities.

A "Brain" is a capability boundary.

It does NOT imply:

- separate microservice
- separate AI agent
- separate process
- separate model
- separate database

Multiple Brains may exist inside the same modular application.

---

# 53. Intelligence Layers

UNLOCK should distinguish three broad intelligence layers.

## Layer A — Real-Time Deterministic Intelligence

Examples:

- Learner State
- mastery
- memory scheduling
- misconception interpretation
- Next Best Action
- Today selection
- future exam urgency

These should remain cheap, testable, and deterministic.

---

## Layer B — Analytical Intelligence

Examples:

- question difficulty
- distractor performance
- discrimination
- failure patterns
- explanation effectiveness
- Course weakness patterns
- learning trends

These should primarily use:

- persisted data
- SQL
- statistics
- deterministic analysis

AI may supplement them when useful.

---

## Layer C — Background / Assisted Intelligence

Potential future capabilities:

- Content QA
- Course digest
- Personal Coach
- resource curation
- system auditing
- semantic content review

These may selectively use AI.

They should not imply constant background LLM activity.

---

# 54. Learner State Brain

Purpose:

> Maintain UNLOCK's best current evidence-based interpretation of the learner.

This is core.

It should initially remain deterministic.

Inputs may include:

- correctness
- retrieval history
- confidence
- memory state
- misconception evidence
- lapse state
- response-time evidence
- explicit learning context

This Brain is active from the early product.

---

# 55. Next Best Action Brain

Purpose:

> Decide what learning action deserves attention next.

This powers Today.

Potential actions include:

- due review
- repair weak knowledge
- address misconception
- strengthen knowledge
- relearn lapsed knowledge
- introduce New Material when appropriate

This Brain is core and deterministic.

---

# 56. Knowledge Relationship Intelligence

Long-term, UNLOCK may understand relationships such as:

```text
Concept A
    ↓ prerequisite
Concept B
    ↓ prerequisite
Concept C
```

This could help distinguish root causes from surface failures.

Knowledge Graph capability is architecture-ready but not required for the initial learning loop.

Relationships should not be invented automatically without reliable evidence or review.

---

# 57. Content Intelligence

Long-term content-quality intelligence may measure:

- question difficulty
- discrimination
- distractor quality
- duplicate content
- answer-key suspicion
- explanation effectiveness
- abnormal performance patterns

Cheap deterministic/statistical checks should come before AI semantic review.

Early systems should create findings rather than silently modifying trusted content.

---

# 58. System Auditor

A future System Auditor may evaluate whether UNLOCK itself behaves as intended.

Examples:

- are strong Questions resurfacing too often?
- are some learners trapped in repeated loops?
- did Today completion decline after an engine change?
- are certain item types producing abnormal failure?
- is a readiness model systematically miscalibrated?

The early version should prefer analytics and findings over autonomous engine modification.

---

# 59. Intervention Effectiveness

A long-term differentiator may be learning which intervention works best for a learner.

Potential interventions:

- explanation
- worked example
- prerequisite review
- another retrieval attempt
- simpler explanation
- visual explanation

The future question is:

> Which intervention produces the best subsequent learning outcome for this learner?

V1 should not require an expensive autonomous intervention system.

Collect data only when there is a justified future use.

---

# 60. Human-in-the-Loop

High-impact intelligence actions should require human approval unless a deterministic safe rule explicitly permits automation.

Early intelligent systems should generally follow:

```text
Detect
    ↓
Explain
    ↓
Recommend
    ↓
Human reviews
```

Examples that should not be autonomously changed without explicit policy:

- correct answer
- trusted Course content
- Learning Engine weights
- readiness formulas
- concept dependencies
- cross-user content sharing

---

# 61. Intelligence Capability Growth

Optional intelligence may evolve through capability levels such as:

```text
Disabled
→ Deterministic
→ Analytical
→ AI-assisted
→ Semi-autonomous
```

Different product capabilities may operate at different levels.

Architecture should support growth without requiring all capabilities to become AI agents.

---

# 62. Product Defensibility

UNLOCK's defensibility should not depend on individual commodity technologies.

Capabilities such as:

- FSRS
- LLM tutoring
- RAG
- question generation
- standard analytics

can be reproduced.

Long-term differentiation should emerge from:

```text
Longitudinal Learner Model
+
Learning Decisions
+
Content Quality Data
+
Knowledge Relationships
+
Intervention Outcomes
+
Historical Evidence
+
Continuous Calibration
```

The advantage is the orchestration and accumulated feedback loop.

---

# 63. Hebrew / RTL

UNLOCK is Hebrew-first and RTL-first.

Initial learner-facing defaults:

```text
Language: Hebrew
Direction: RTL
Locale: he-IL
```

Technical implementation remains English-first:

- code
- database identifiers
- APIs
- internal logs
- technical docs
- tests

User-facing strings should remain separate from component/business logic.

The product should remain internationalization-ready without requiring additional languages in V1.

---

# 64. Accessibility

Accessibility is a product requirement.

Important principles include:

- semantic HTML
- keyboard usability
- visible focus states
- adequate contrast
- screen-reader compatibility
- accessible labels
- usable mobile touch targets
- no dependence on precision mouse interactions
- correct RTL behavior
- appropriate mixed Hebrew/English rendering

Accessibility should not be postponed until the end of product development.

---

# 65. Web / PWA First

Initial delivery strategy:

```text
Web
    ↓
PWA-quality mobile experience
    ↓
Product validation
    ↓
Native application only if justified
```

Native mobile development should not delay validation of the adaptive learning system.

---

# 66. Technical Product Direction

The current product stack direction is:

```text
Next.js
TypeScript
PostgreSQL / Supabase
Web / PWA
GitHub
```

The architecture should remain a modular monolith unless a concrete need justifies a separate service.

Do not introduce distributed infrastructure merely for architectural elegance.

Technical implementation details belong in `docs/ARCHITECTURE.md`.

---

# 67. Persistence Principles

PostgreSQL via Supabase is the accepted V1 persistence platform.

Persistence should protect:

- learner evidence
- QuestionVersion history
- Course authorization
- DailyPlan identity
- learning-state integrity
- reproducibility

Database constraints should enforce data integrity.

Learning policy should remain in domain/application logic rather than being hidden inside database constraints.

---

# 68. Security Principles

Security must follow product ownership and authorization.

Core principles:

- client input is untrusted
- authoritative user identity comes from verified authentication
- privileged credentials stay server-side
- authorization must be explicit
- external links/redirects must not become trust boundaries
- learner-facing APIs must not leak grading-only data
- service credentials must not be used as a substitute for authorization
- hosted data mutations require deliberate operational control

Security details belong in architecture/rules rather than expanding this Master Spec.

---

# 69. RLS Direction

Row Level Security remains an important defense layer where direct Supabase table access is used.

Do not create permissive placeholder policies merely to make development easier.

The V1 architecture may continue to use server-side API authorization where appropriate.

The eventual RLS model must reflect real Course/user permissions.

Exact policy design is tracked separately.

---

# 70. Data Ownership and Privacy

UNLOCK must eventually define ownership and lifecycle for:

- uploaded Material
- instructor-created content
- AI-generated content
- Questions
- learner Attempts
- learner progress
- Course analytics
- institutional aggregates

Before public/institutional launch, the product must define:

- account deletion
- data export
- content deletion
- retention
- anonymization where required
- provider data handling
- institutional responsibilities

Historical learning evidence must not be destroyed accidentally merely because a mutable content object changes.

---

# 71. Observability

UNLOCK should be observable.

Technical observability should answer questions such as:

- is the application failing?
- are API routes failing?
- is database latency abnormal?
- are Auth operations failing?
- are future AI jobs failing?
- is external-service cost abnormal?

Product analytics and technical observability are different systems of questions.

Do not confuse them.

---

# 72. Testing Principle

The Learning Engine is core product logic and must have strong automated protection.

Important testing layers include:

- domain/unit tests
- use-case tests
- Postgres integration tests
- route/auth tests
- critical browser/E2E flows where justified

Testing must distinguish simulated behavior from real hosted verification.

Do not claim PGlite proves all real PostgreSQL behavior.

Detailed policy belongs in the project testing documentation and Claude rules.

---

# 73. Performance

Today is the main entry point and should feel fast.

Important performance principles:

- efficient database access
- avoid N+1 behavior
- appropriate indexes
- avoid unnecessary client payloads
- avoid loading entire Courses
- keep real-time Learning Engine work deterministic and cheap
- use asynchronous processing for genuinely expensive future operations

---

# 74. Scalability

Do not prematurely over-engineer.

Prioritize:

- clear module boundaries
- deterministic domain logic
- explicit interfaces
- reliable persistence
- efficient queries
- asynchronous heavy work only when needed
- provider abstraction only where vendor lock-in matters
- observable failures

The architecture should be able to grow without pretending today's pilot is already a large distributed platform.

---

# 75. Prototype Heritage

UNLOCK was informed by an earlier low-code prototype.

The prototype is historical evidence, not production architecture.

Its value is to preserve validated learning/product insight.

The rule is:

> Preserve validated behavior intentionally; do not preserve prototype implementation constraints.

Prototype investigation should be just-in-time.

Do not block product development on reconstructing every historical prototype detail.

---

# 76. Current Product Scope Philosophy

The first production-quality product should validate the smallest complete adaptive loop:

```text
Learner
→ Course
→ Questions
→ Today
→ Answer / Skip
→ Attempt / Evidence
→ Learner State
→ Next Best Action
→ Future Today
```

This loop matters more than feature breadth.

---

# 77. Core V1 Capabilities

The core product requires, conceptually:

```text
User
Course
CourseMembership
Question / QuestionVersion
Attempt
UserQuestionProgress

Learner State
Memory Scheduling
Next Best Action

DailyPlan
DailyPlanItem

Today interaction
Manual Practice separation
```

Supporting V1 capabilities may include:

- learner timezone
- OPEN Course onboarding
- basic learner progress
- pilot content entry

Exact current implementation status belongs in DEV_STATUS.

---

# 78. Architecture-Ready, Not Core-V1 Blocking

The architecture should allow future addition of:

- Institution
- richer instructor tooling
- Topics / Units
- Materials / file ingestion
- Exams
- Assignments
- richer analytics
- AI-generated content
- AI Tutor
- Knowledge Graph
- progress dashboards
- content intelligence

These capabilities should not become blockers unless a real product/pilot requirement makes them necessary.

---

# 79. Explicitly Deferred Product Areas

The following should not delay validation of the core adaptive loop unless deliberately reprioritized:

- native application
- social feed/community
- advanced profiles
- complex leaderboards
- broad challenge ecosystem
- parent/school-specific product roles
- complete LMS functionality
- autonomous AI agents
- broad web resource curation
- advanced institutional administration
- advanced Knowledge Graph automation
- advanced personalized intervention AI

---

# 80. Business Model

The final pricing/business model is not locked.

Potential future customers may include:

- individual learners
- instructors
- institutions
- premium AI users

Product architecture should not be hard-coded around an unvalidated pricing model.

---

# 81. Product Success

UNLOCK succeeds when learners trust it enough to repeatedly hand over study-prioritization decisions.

The product should become increasingly useful as evidence accumulates.

Success means the system becomes:

- personalized
- reliable
- efficient
- habit-forming
- appropriately explainable
- increasingly calibrated
- useful without requiring the learner to understand the algorithm

The desired learner experience remains:

> "I don't need to decide what to study now. UNLOCK knows what deserves my attention."

---

# 82. Decision Discipline

This Master Spec defines product direction.

It should not silently settle questions that remain unresolved.

When a meaningful uncertainty appears:

1. inspect relevant accepted ADRs
2. inspect `docs/OPEN_QUESTIONS.md`
3. determine whether the decision is already accepted
4. if not, keep it unresolved
5. do not let implementation invent the answer

Accepted durable decisions should live in ADRs.

Unresolved decisions should live in OPEN_QUESTIONS.

Implementation state belongs in DEV_STATUS.

---

# 83. Change Management

This document should change only when the product constitution changes.

Examples of legitimate Master Spec changes:

- major product-positioning change
- change to the North Star
- change to primary product experience
- change to fundamental learning philosophy
- new durable product boundary
- major long-term capability entering/leaving product direction

Ordinary implementation changes should NOT cause this document to grow.

Do not add:

- Slice history
- commit history
- test counts
- bug investigations
- temporary implementation notes
- reviewer findings
- immediate next steps
- Claude workflow instructions

Those have other homes in the Development OS.

---

# 84. Final Product Principle

The defining distinction remains:

> UNLOCK is not a system that happens to generate learning content.

UNLOCK is:

> A system that builds a longitudinal learner model and uses that model to decide the next best learning action.

Today is the primary learner experience through which that intelligence becomes useful.

Everything else should support that loop.

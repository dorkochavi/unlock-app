# UNLOCK — Product Roadmap to V1

STATUS: ACTIVE PRODUCT ROADMAP
OWNER: Dor + ChatGPT
PURPOSE: Strategic sequencing from the current product foundation to UNLOCK V1
NOT AN EXECUTION PLAN: Concrete implementation work must still come from `docs/CHATGPT_PLAN.md`

---

## 1. Purpose of This Document

This Roadmap defines the sequence of product capabilities required to reach UNLOCK V1.

It exists to answer:

- what major product areas remain;
- in what order they should be built;
- why that order matters;
- what each Product Run is intended to accomplish;
- what is deliberately deferred beyond V1.

This is not a task backlog and is not a substitute for:

- `docs/MASTER_SPEC.md` — product North Star and intended system;
- `docs/UNLOCK_V1_SCOPE.md` — precise V1 boundary;
- `docs/CHATGPT_PLAN.md` — current executable Run;
- `docs/DEV_STATUS.md` — current repository/product truth;
- ADRs — accepted architectural/product decisions.

---

## 2. Product North Star

UNLOCK is not primarily a quiz app, LMS, flashcard tool, PDF chat product, or AI question generator.

Its core product promise is:

> UNLOCK maintains a longitudinal model of each learner and decides what that learner should do next.

The system should continuously combine evidence about:

- knowledge/mastery;
- memory/forgetting risk;
- misconceptions;
- confidence;
- unseen material;
- exam urgency;
- past learning behavior.

The learner should not need to manually choose what to study next.

---

## 3. Pilot Context — Ruppin Academic Center

The first real deployment target for UNLOCK is a college class at Ruppin Academic Center.

Dor is working directly with the course lecturer, who will decide whether to introduce UNLOCK to the class.

This defines UNLOCK's first real validation context:

- a real academic course;
- real course material;
- real questions tied to that material;
- students using UNLOCK primarily from their mobile phones.

The pilot does not require every V1 capability described in this Roadmap. It requires the smallest complete loop that proves real learner and instructor value — see Product Runs 004–006.

---

## 4. Learner-Facing Value Proposition

Internally, UNLOCK's differentiation comes from its longitudinal learner model (Section 2). Externally, the learner-facing promise must stay simple:

> UNLOCK helps me learn the course material better, quickly and easily from my phone.

Learner-facing product surfaces (onboarding, messaging, Progress, empty states) should be written around this promise.

Do not describe FSRS, mastery, misconceptions, learner models, or ranking algorithms to learners. Those are internal mechanisms, not learner-facing language.

---

## 5. V1 Product Loop

UNLOCK V1 must support the complete loop:

Instructor creates course
→ adds, imports, or generates learning content
→ publishes course
→ shares join link / QR
→ learner joins
→ UNLOCK creates Today
→ learner answers / skips / completes
→ attempts and evidence update learner state
→ learner sees progress/readiness
→ instructor sees meaningful course-level learning signals
→ next day UNLOCK recalculates what matters next

The product is not complete until this loop works without SQL, seed data, or developer intervention.

---

## 6. Current Foundation

The current system already contains a substantial learning-engine and persistence foundation:

- Supabase authentication and user provisioning;
- Course and CourseMembership model;
- OPEN / AUTHORIZED_ONLY join behavior;
- learner-local timezone;
- persisted DailyPlan / Today;
- immutable Attempts;
- immutable QuestionVersion history;
- Today answer and Skip flows;
- Manual Practice / Today separation;
- FSRS-backed memory scheduling;
- mastery/evidence processing;
- misconception tracking;
- Next Best Action foundation;
- New Material fallback;
- learner-safe question read path;
- hosted Supabase migration chain;
- Development OS V1.1.

The next phase is to turn this foundation into a self-sufficient product.

---

# 7. Product Run Sequence

## Product Run 004 — Complete Learner Product Loop V1

### Goal

A learner who did not build UNLOCK can enter the product, understand what to do, study, complete Today, and understand basic progress without developer assistance.

### Primary outcomes

- close remaining hosted QA gaps;
- handle learner-facing empty/error lifecycle states;
- establish minimal learner navigation;
- add My Courses;
- add learner Course context;
- add Learning Profile / Progress V1;
- add minimal browser-level golden-path E2E coverage.

### Expected slices

1. Hosted QA closure
   - Today Skip
   - New Material fallback
   - same-day reload
   - duplicate submission/idempotency
   - unauthenticated join return flow

2. Learner lifecycle / edge states
   - no courses
   - empty Today
   - Today completed
   - invalid course ID
   - course not found
   - AUTHORIZED_ONLY
   - revoked membership
   - expired auth/session
   - network/server failure

3. Learner navigation shell
   - Today
   - Progress
   - Courses

4. My Courses V1

5. Learner Course View V1

6. Learning Profile / Progress V1

7. Browser golden-path E2E
   - login
   - join
   - Today
   - answer
   - completion

### Exit condition

The learner side feels like a coherent product, not a collection of working routes.

---

## Product Run 005 — Course & Question Authoring + Structured Import V1

### Goal

An instructor can create and manage a real course and its questions without using Supabase SQL, seed scripts, Cursor, or Claude — using manual authoring or an externally prepared question set.

### Primary outcomes

- Instructor role-aware product surface;
- Create Course;
- Edit Course;
- Archive Course;
- join policy;
- exam date;
- basic course publishing;
- shareable join link / QR;
- manual question authoring;
- lightweight structured question import (e.g. CSV / JSON / spreadsheet-style) for externally prepared question sets;
- question editing through immutable QuestionVersion;
- minimal Topic structure;
- learner-safe question preview.

### Accepted question sources for V1

Questions may come from any combination of:

- the course lecturer directly;
- manual authoring in the product;
- external AI tools, brought in via structured import;
- structured import generally.

Native PDF ingestion and in-product AI question generation are not required here — see Product Run 008.

### Content model target

Course
→ Topic
→ Question
→ QuestionVersion

Material/Source support may begin here if useful, but must not block manual authoring or structured import.

The exact structured import file format is an implementation detail to settle when this Run is planned, not a decision to lock prematurely here.

### Exit condition

Dor or another instructor can create a usable demo/real course entirely through the product UI, using manual authoring and/or structured import.

---

## Product Run 006 — Learner Progress + Instructor Insights V1

### Goal

Give learners a trustworthy view of their own progress, and test whether UNLOCK can give an instructor a useful picture of class understanding.

### Product hypothesis (instructor insights)

> Can UNLOCK help an instructor understand what the class understands, what it does not understand, and what should be emphasized in the next lesson?

This is an important V1 hypothesis to test during the pilot. It is not yet a validated product capability, and must not be described as one.

### Primary outcomes — Learner Progress

- topic-level strong/weak breakdown;
- material needing reinforcement;
- unseen material;
- misconceptions where reliable;
- recent learning activity;
- an exam-readiness indicator may exist alongside these, but topic-level strength/weakness remains the primary signal.

### Primary outcomes — Instructor Insights (minimum useful set)

- active vs inactive learners;
- weak topics;
- high-error questions;
- recurring misconceptions where supported;
- basic class progress/readiness trends.

### Product principle

Topic-level strength/weakness is the primary product direction for Progress. Avoid false precision in any percentage shown.

Do not present instructor insights as an already-validated need — the pilot is how this hypothesis gets tested.

### Exit condition

A learner can understand their own strong/weak topics from Progress, and an instructor can open a course and get a first real signal of what the class does and does not understand.

---

## Product Run 007 — Learning Intelligence Expansion

### Goal

Deepen UNLOCK's differentiated prioritization beyond the basic signals already proven in Runs 004–006.

### Primary outcomes

- Exam Urgency signal;
- confidence capture;
- Confidence Gap signal;
- stronger visibility into mastery decay / forgetting risk;
- richer misconception lifecycle where justified;
- integration of these signals into the learning-policy / Next Best Action layer.

### Product principle

Exam urgency is an amplifier, not a gate.

Confidence is evidence, not truth.

AI is not the Learning Engine.

### Exit condition

The learner's next action and Progress view are meaningfully informed by memory, mastery, misconceptions, confidence, and exam urgency — not only correctness and recency.

---

## Product Run 008 — PDF / AI Content Pipeline V1

### Goal

Allow instructors to turn source material into reviewed learning content without letting AI silently become the source of truth.

PDF/content ingestion and AI question generation remain strategically important, but are not required for the Ruppin pilot or the earliest usable V1 (Runs 004–006). This Run builds that capability once the core learner and instructor loops are validated.

### Target flow

Upload source
→ extract text
→ identify sections/topics
→ generate proposed questions
→ instructor review queue
→ edit / approve / reject
→ publish approved questions
→ Learning Engine can use them

### Initial source target

Prefer a narrow, reliable format set for V1, likely beginning with PDF and expanding only if stable.

### Required principles

- AI-generated questions are proposals;
- instructor approval is required before publication;
- published edits preserve QuestionVersion immutability;
- generation must not fabricate learner evidence;
- the Learning Engine remains deterministic and separate from content generation.

### Exit condition

A real instructor can upload teaching material and produce a reviewed, publishable question set from within UNLOCK.

---

## Product Run 009 — Production / Scale Hardening

### Goal

Make UNLOCK safe and reliable enough to place in front of real external users — and to grow beyond a single pilot cohort — without developer supervision.

### Primary outcomes

- production deployment;
- browser E2E for critical flows;
- basic observability/error monitoring;
- analytics events for core product funnel;
- input validation and malformed-ID hardening;
- loading/error-state polish;
- authentication/session edge-case pass;
- security boundary review;
- rate limiting where justified;
- basic privacy/legal pages;
- backup/recovery understanding;
- performance pass on core learner/instructor flows at increased scale.

### Exit condition

The product can be used by a real pilot cohort — and by additional cohorts beyond it — with acceptable operational confidence.

---

# 8. Cross-Run Product Principles

These principles apply to every Product Run.

## 8.1 Today remains the learner's center

Do not let Courses, content libraries, or dashboards displace Today as the primary learner experience.

The learner should primarily answer:

> What should I do now?

## 8.2 Learner and Instructor UX are different products

Learner top-level model:

- Today
- Progress
- Courses

Instructor top-level model:

- Courses
- Students
- Insights

They share domain data, not necessarily the same navigation or mental model.

## 8.3 Learning evidence must remain trustworthy

Do not fabricate learner state for convenience.

Examples:

- placing unseen material into Today is not evidence;
- Skip is not an incorrect answer;
- Manual Practice does not silently resolve Today;
- historical QuestionVersion must remain traceable;
- AI generation does not create mastery.

## 8.4 Prefer complete vertical loops over isolated feature breadth

Every Product Run should leave the product in a usable state.

Avoid partially building multiple major product areas at once.

## 8.5 Do not optimize sophistication before self-sufficiency

Before expanding deep algorithmic complexity, ensure the product can:

- create courses;
- create content;
- onboard learners;
- run learning sessions;
- show progress;
- operate without direct database intervention.

---

# 9. V1 Non-Goals / Deferred Areas

The following are explicitly outside the critical path to UNLOCK V1 unless later evidence changes the decision:

- native iOS / Android apps;
- social learning feed;
- complex gamification;
- leaderboards;
- live classes;
- learner chat/community;
- general-purpose AI tutor chat;
- deep knowledge graph;
- adaptive video;
- automatic mid-day Today mutation;
- automatic unresolved-item carry-over;
- per-course fairness quotas;
- complex instructor permission hierarchies;
- institution SSO;
- billing/subscriptions;
- advanced ML recommender systems;
- real-time collaborative authoring.

Deferred does not mean rejected.

It means these features must not delay proof of the core learning loop.

---

# 10. Strategic Milestones

## Milestone A — Coherent Learner Product

Reached after Run 004.

A learner can independently use the product end to end.

## Milestone B — Self-Sufficient Course Creation

Reached after Run 005.

An instructor can create and publish a course — using manual authoring and/or structured import — without developer/database intervention.

## Milestone C — Learner Progress & Instructor Insight Hypothesis Tested

Reached after Run 006.

Learners can see topic-level strong/weak progress, and the instructor-insights hypothesis (Run 006) has real pilot evidence for or against it.

## Milestone D — Differentiated Learning Intelligence

Reached after Run 007.

UNLOCK's prioritization visibly reflects memory, mastery, misconceptions, confidence, and exam urgency.

## Milestone E — AI-Assisted Content Creation

Reached after Run 008.

Course material can become reviewed questions through an instructor-controlled AI pipeline.

## Milestone F — Pilot-Ready, Scale-Ready V1

Reached after Run 009.

The system is deployable and operable for real pilot users, and for additional cohorts beyond the first pilot.

---

# 11. Roadmap Governance

This Roadmap is strategic.

It may change when:

- real learner/instructor feedback contradicts assumptions;
- a Product Run reveals a critical prerequisite;
- architecture reality materially changes sequencing;
- pilot evidence shows a V1 capability is unnecessary or missing.

Changes to the Roadmap should not be made merely because an implementation task is inconvenient.

Execution remains governed by `docs/CHATGPT_PLAN.md`.

At the beginning of each Product Run:

1. confirm the current Roadmap milestone;
2. inspect `docs/DEV_STATUS.md`;
3. identify only the slices required for the next coherent product outcome;
4. write a dedicated `CHATGPT_PLAN`;
5. execute and verify;
6. update current-state truth;
7. replan.

---

# 12. Current Next Step

The next planned Product Run is:

> **Product Run 004 — Complete Learner Product Loop V1**

Its implementation Plan should be authored separately against the current clean committed repository baseline.

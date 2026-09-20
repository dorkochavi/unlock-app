# UNLOCK — V1 Scope

STATUS: ACTIVE V1 BOUNDARY
PURPOSE: Define what must be true for UNLOCK V1 to be considered complete
RELATIONSHIP: This document defines scope; `docs/UNLOCK_ROADMAP.md` defines sequencing

---

## 1. V1 Product Definition

UNLOCK V1 is a learning product in which:

- an instructor can create a course;
- add reviewed learning content — manually authored, structured-imported, or (later) AI-generated;
- publish and share that course;
- learners can join;
- UNLOCK creates a personalized daily learning plan;
- learner actions update a persistent learner model;
- UNLOCK uses that model to choose what matters next;
- learners can understand their progress/readiness;
- instructors can understand meaningful cohort learning signals.

The product must operate end to end without requiring direct SQL, seed manipulation, or developer intervention for normal use.

The earliest usable/pilot-ready V1 is defined narrowly as: real learning material + real questions + an adaptive learner model / personalized Today + learner progress + basic instructor insights. Native PDF ingestion and in-product AI question generation are not required to reach this point — see Section 9.

---

## 2. V1 Core Promise

> UNLOCK knows what each learner should do next — and can explain their progress over time.

V1 must prove this promise.

It does not need to prove every future product idea.

---

# 3. Required V1 User Roles

## Learner

A Learner can:

- authenticate;
- join an eligible course;
- view active courses;
- study through Today;
- answer;
- Skip;
- receive feedback;
- complete Today;
- reload without losing state;
- view basic course context;
- view Progress / Learning Profile;
- understand basic exam readiness when applicable.

## Instructor / Owner

An Instructor or Owner can:

- create a course;
- edit course metadata;
- set join policy;
- set exam date;
- archive a course;
- add and edit questions manually;
- import a structured set of externally prepared questions (e.g. CSV / JSON / spreadsheet-style);
- organize questions into basic topics;
- publish course content;
- generate/share a join link or QR;
- upload supported course material where AI content generation is available;
- review AI-proposed questions where AI content generation is available;
- approve/edit/reject proposed questions;
- view enrolled learners;
- view basic course learning insights.

---

# 4. Required Learner Journey

V1 must support this journey without developer intervention:

1. learner opens UNLOCK;
2. signs up or logs in;
3. opens a valid course join link / QR;
4. joins if policy allows;
5. lands in the learner product;
6. Today is generated or reused for the current learner-local day;
7. learner sees one actionable item at a time;
8. learner answers or skips;
9. answer creates trusted evidence;
10. Skip resolves the item without false evidence;
11. learner progresses through Today;
12. Today reaches a real completion state;
13. reload preserves resolved state;
14. Progress reflects accumulated learning evidence;
15. future Today plans adapt to learner state.

The product must also handle:

- no courses;
- empty Today;
- already completed Today;
- invalid course link;
- course not found;
- AUTHORIZED_ONLY join;
- revoked membership;
- unauthenticated join;
- expired session/auth;
- generic server/network failure.

---

# 5. Required Instructor Journey

V1 must support this journey without developer intervention:

1. instructor authenticates;
2. creates a course;
3. defines:
   - title;
   - optional description;
   - exam date when relevant;
   - join policy;
4. creates initial topic structure;
5. creates questions manually, imports a structured question set, or (where available) imports source material for AI-assisted generation;
6. reviews/edit questions;
7. publishes usable course content;
8. shares a join link / QR;
9. learners join and study;
10. instructor sees:
   - enrollment;
   - activity;
   - weak topics;
   - high-error questions;
   - recurring misconceptions where supported;
   - basic readiness/mastery signals.

---

# 6. Required Learning Model Capabilities

V1 must maintain trustworthy learner state based on real learning evidence.

Required major signal families. Memory Need, Mastery Need, Misconception Need, and New Material are required for the earliest pilot-ready V1 (Section 1). Exam Urgency and Confidence Gap deepen the model in Learning Intelligence Expansion (Run 007) and are not required to reach the pilot-ready point.

## Memory Need

The system can identify when previously known material is at risk of being forgotten.

FSRS-backed scheduling remains a core mechanism.

## Mastery Need

The system distinguishes weaker vs stronger demonstrated knowledge and can prioritize reinforcement.

## Misconception Need

The system can track meaningful recurring incorrect conceptual patterns where supported by question/evidence design.

## New Material

The system can introduce unseen material when ordinary review/repair candidates do not exist, according to accepted V1 policy.

## Exam Urgency

An upcoming exam increases the priority of relevant weak/unseen/at-risk material.

Exam urgency is an amplifier, not a gate.

## Confidence Gap

V1 should capture confidence with answers and derive at least a basic signal from mismatches such as:

- high confidence + incorrect;
- low confidence + correct.

Confidence is evidence, not truth.

---

# 7. Required Today Semantics

V1 must preserve the accepted Today model:

- one persisted DailyPlan per user per learner-local calendar day;
- Global Today and course context refer to the same underlying DailyPlan;
- Today is frozen by default after creation;
- same-day reload returns the same persisted plan/state;
- no automatic carry-over;
- next day recalculates from current learner state;
- plan size may be dynamic;
- Today has a real finish line;
- extra practice remains separate;
- Manual Practice never silently resolves a Today item;
- Skip resolves without incorrect-answer evidence;
- archived/inactive memberships do not auto-participate;
- only active LEARNER memberships auto-participate.

---

# 8. Required Course & Content Model

V1 must support at least:

Course
→ Topic
→ Question
→ QuestionVersion

Question requirements:

- SINGLE_CHOICE;
- MULTIPLE_CHOICE;
- prompt;
- answer options;
- correct answer definition;
- explanation or feedback content where applicable;
- topic association;
- immutable version history after publication/use.

A lightweight structured question import capability (e.g. CSV / JSON / spreadsheet-style) is required before native PDF/AI generation, so instructors can bring in externally prepared question sets without developer intervention. The exact file format is an implementation detail, not a premature lock-in.

Content/source ingestion sufficient for AI-assisted generation is a later capability — see Section 9 — and is not required for the earliest usable V1.

A deep Knowledge Graph is not required for V1.

---

# 9. AI Content Behavior (Post-Pilot Capability)

PDF/content ingestion and AI question generation remain strategically important, but are not required for the Ruppin pilot or the earliest usable V1 (Section 1). Questions may instead come from the lecturer, manual authoring, external AI tools, or structured import (Section 8).

When native AI content generation is built, it must remain reviewable and non-authoritative. Required behavior:

1. instructor uploads supported source;
2. source text is extracted;
3. system proposes sections/topics/questions;
4. questions enter a review state;
5. instructor can edit;
6. instructor can approve;
7. instructor can reject;
8. only approved content becomes publishable learning content.

AI must not:

- directly create learner mastery;
- silently publish questions;
- overwrite historical QuestionVersion evidence;
- replace the deterministic Learning Engine.

---

# 10. Required Learner Product Surface

Learner V1 top-level navigation should remain minimal:

## Today

Primary action surface.

Answers:

> What should I do now?

## Progress

Answers:

> What does UNLOCK currently know about my learning?

Should surface a useful subset of:

- overall learning progress;
- topic-level strength;
- material needing reinforcement;
- misconceptions where reliable;
- questions/material seen vs unseen;
- recent activity;
- Today completion history;
- exam readiness when applicable.

Avoid false precision.

## Courses

Answers:

> What am I learning?

Should provide:

- active courses;
- course title;
- exam date when applicable;
- basic progress/context;
- access to course-specific context and Manual Practice.

The learner UI should not expose internal engine implementation concepts unnecessarily.

---

# 11. Required Instructor Product Surface

V1 instructor UX may use a different mental model from the learner UX.

Target top-level concepts:

## Courses

Create/manage/publish course content.

## Students

Understand enrollment and activity.

## Insights

Understand learning patterns that matter.

This is an explicit V1 hypothesis to test, not a validated capability:

> Can UNLOCK help an instructor understand what the class understands, what it does not understand, and what should be emphasized in the next lesson?

Minimum useful insight set to test that hypothesis:

- active learner count;
- inactivity;
- weak topics;
- high-error questions;
- recurring misconceptions where reliable;
- readiness/mastery distribution.

Do not build a generic BI dashboard. Do not describe instructor insights as already validated — the pilot is how this hypothesis gets tested.

---

# 12. Required Progress / Readiness Behavior

V1 must expose meaningful learner progress.

Topic-level strength/weakness is the primary product direction for Progress. It must not imply precision that the evidence does not justify.

A V1 Progress view should surface, at minimum:

- strong topics;
- weak topics;
- material needing reinforcement;
- unseen material;
- misconceptions where reliable;
- recent learning activity.

An exam-readiness percentage may exist alongside these, derived from actual learner state and relevant course/exam context, but it is secondary to topic-level strength/weakness and must not replace it.

If a percentage is shown, its derivation must be documented and defensible. Avoid false precision.

---

# 13. Required Production Baseline

Before V1 is considered pilot-ready:

- production deployment exists;
- critical learner golden path has browser-level E2E coverage;
- core instructor authoring path has appropriate test coverage;
- basic error monitoring exists;
- core product analytics events exist;
- malformed input receives controlled responses;
- authentication/session edge cases are handled;
- server trust boundaries remain enforced;
- secrets remain server-only;
- destructive/privileged database operations are controlled;
- basic rate limiting is added where abuse risk justifies it;
- privacy/basic legal pages exist;
- backup/recovery assumptions are known;
- key flows perform acceptably for pilot-scale usage.

V1 does not require enterprise compliance certification.

---

# 14. V1 Definition of Done

The earliest usable, pilot-ready V1 is complete when the following scenario can be performed without opening SQL, Cursor, or Claude, and without native PDF ingestion or in-product AI question generation:

An instructor logs in.

Creates:

> Introduction to Economics — Exam 12.11.2026

Adds topics.

Adds questions — manually authored and/or imported through structured import from the lecturer, an external AI tool, or another prepared source.

UNLOCK provides a join link / QR.

Learners join.

A learner opens UNLOCK and sees a real Today plan.

The learner answers questions and can Skip.

A wrong answer becomes meaningful evidence.

The learner completes Today.

Future Today plans reflect the learner's evolving state — at minimum memory risk, mastery, misconceptions, and unseen material. Confidence gap and exam urgency deepen this further as Learning Intelligence Expansion (Run 007) lands, but are not required to reach this pilot-ready point.

The learner opens Progress and can understand:

- what is strong;
- what is weak;
- what needs reinforcement;
- what remains unseen;
- misconceptions where reliable;
- recent learning activity.

The instructor can open the course and get a first real signal — tested as a pilot hypothesis, not assumed proven — of:

- who is active;
- what topics are weak;
- which questions generate difficulty;
- meaningful shared misconceptions where supported;
- the cohort's broad learning/readiness state.

The system is deployed, monitored at a basic level, and usable by a real pilot cohort.

---

# 15. Explicit V1 Non-Goals

The following are not required for V1:

- native iOS app;
- native Android app;
- social feed;
- learner-to-learner chat;
- community features;
- complex gamification;
- leaderboards;
- live classrooms;
- general-purpose AI tutor chat;
- deep Knowledge Graph;
- adaptive video;
- mid-day automatic Today re-planning;
- carry-over of unresolved Today items;
- per-course fairness quotas;
- complex instructor permission matrices;
- institutional SSO;
- billing/subscription system;
- advanced ML recommender;
- real-time collaborative content editing.

These may become future roadmap items after V1 evidence.

---

# 16. V1 Scope Control Rules

A proposed feature belongs in V1 only if it materially supports at least one of:

1. course/content creation;
2. learner onboarding;
3. personalized learning;
4. trustworthy learner evidence;
5. learner progress/readiness;
6. instructor learning insight;
7. production-safe pilot operation.

If it does not support one of these, defer it unless a real pilot dependency emerges.

When scope pressure appears, prefer:

- completing a vertical loop;
- preserving learning-state trust;
- reducing developer intervention;
- improving learner/instructor comprehension.

Do not trade these for feature breadth.

---

# 17. Relationship to Product Runs

The current planned V1 sequence is:

- Run 004 — Complete Learner Product Loop V1
- Run 005 — Course & Question Authoring + Structured Import V1
- Run 006 — Learner Progress + Instructor Insights V1
- Run 007 — Learning Intelligence Expansion
- Run 008 — PDF / AI Content Pipeline V1
- Run 009 — Production / Scale Hardening

The earliest usable, pilot-ready V1 (Section 1, Section 14) is reached after Run 006. Runs 007–009 deepen and harden it but are not required to validate the Ruppin pilot.

The Run sequence may change if implementation reality or pilot evidence justifies it.

The V1 Definition of Done should remain stable unless Dor explicitly changes product scope.

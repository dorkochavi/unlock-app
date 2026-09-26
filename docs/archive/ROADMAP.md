# UNLOCK Roadmap

Status: **STRATEGIC / HISTORICAL SEQUENCING REFERENCE — NOT THE ACTIVE EXECUTION QUEUE**

Purpose: define the recommended order for building UNLOCK V1 so the product reaches a trustworthy end-to-end adaptive learning loop without overbuilding.

This roadmap preserves the broad sequencing logic that guided early V1 development.

It does not replace `docs/MASTER_SPEC.md`, `docs/DEV_STATUS.md`, or
`docs/CHATGPT_PLAN.md`.

**Current work comes only from `docs/CHATGPT_PLAN.md`.** Do not infer the next
implementation task from phase statuses or the historical immediate sequence
below. Git history and `docs/RUNS/` preserve how the roadmap was traversed.

---

## 1. Roadmap Principle

UNLOCK should be built from foundations toward the smallest complete learning loop.

The target is not:

> many features.

The target is:

> a reliable adaptive loop that learns from the user and improves what it recommends next.

Preferred sequence:

```text
Foundation
→ Prototype Learning Audit
→ Domain Contracts
→ Data Model
→ Database/Auth
→ Starter Experience
→ Learning Engine
→ Next Best Action
→ Today
→ Quiz
→ End-to-End Adaptive Loop
→ Basic Progress
→ Analytics Review
→ Hardening
→ AI Expansion
```

---

## 2. Phase 0 — Project Foundation

Status: largely complete.

Goals:

- establish repository;
- establish Next.js/TypeScript foundation;
- establish Hebrew/RTL baseline;
- establish lint/typecheck/test/build scripts;
- establish Git workflow;
- establish Cursor rules;
- establish core documentation.

Key outputs include:

- project shell;
- locale/messages foundation;
- Vitest;
- foundational rules;
- product/architecture/testing documentation.

Exit condition:

> The project is safe and clear enough to begin domain implementation without inventing the product as we code.

---

## 3. Phase 1 — Prototype Learning Audit

Goal:

Recover only the prototype behavior that is valuable for V1 learning logic.

This is not a full prototype migration.

Audit priority:

1. `mastery_level`
2. `next_review_date`
3. `misconception_hits`
4. direct inputs to those calculations
5. confidence behavior where relevant
6. response-time behavior where relevant

For each recovered behavior, document:

- current rule;
- inputs;
- outputs;
- defaults;
- thresholds;
- edge cases;
- examples;
- known bugs;
- confidence in understanding;
- preserve/fix/redesign classification.

Use:

```text
docs/PROTOTYPE_LEARNINGS_TEMPLATE.md
```

Do not audit unrelated prototype features simply because they exist.

Exit condition:

> We understand enough of the learning-critical prototype behavior to define V1 domain rules without guessing.

---

## 4. Phase 2 — Domain Contracts

Goal:

Turn product concepts into explicit implementation contracts before schema and code become expensive to change.

Define the minimum V1 behavior for:

- Course;
- Material;
- Question;
- Attempt;
- UserQuestionProgress;
- exam-date resolution;
- Learner State;
- Starter Experience;
- Next Best Action;
- Today Session;
- Today Session Item;
- Quiz.

Important decisions to settle here include:

- how a User is related to a Course in V1;
- whether V1 needs simple ownership/access or a fuller Enrollment concept;
- canonical Today terminology;
- effective V1 exam-date hierarchy;
- Question edit/version behavior relative to immutable Attempts;
- what counts as "insufficient evidence";
- how Starter transitions into normal Today behavior;
- Today session boundary semantics.

Do not implement full Institution, groups, or Assignments merely to resolve these contracts.

Exit condition:

> Core V1 concepts have clear meanings, relationships, and behavioral boundaries.

---

## 5. Phase 3 — Database Design

Goal:

Design the smallest database model that can preserve learning history and support the adaptive loop.

Design before migration.

Expected V1 data areas:

- users/auth linkage;
- Courses;
- user↔Course access/ownership;
- Materials;
- Questions;
- Attempts;
- UserQuestionProgress;
- exam dates;
- Today Sessions;
- Today Session Items;
- minimal derived-state/version metadata where necessary.

Explicitly address:

- ownership;
- constraints;
- timestamps;
- indexes;
- data integrity;
- deletion behavior;
- provenance where needed;
- Question version/snapshot strategy;
- derived state versus source-of-truth history.

Use:

```text
docs/DATABASE.md
```

Exit condition:

> The V1 schema can support the complete learning loop without requiring speculative future tables.

---

## 6. Phase 4 — Database and Authentication Foundation

Goal:

Introduce persistence and trusted user identity.

Likely direction:

- Supabase PostgreSQL;
- Supabase Auth;
- RLS.

Before implementation, confirm the final provider choice.

Implement only the authorization model needed for V1.

Required principles:

- Course must work without Institution;
- private learner data must remain private;
- service-role credentials remain server-side;
- RLS policies are explicit and tested;
- migrations are safe and reviewable.

Exit condition:

> A signed-in learner can safely persist and retrieve the minimum V1 data model.

---

## 7. Phase 5 — Starter Experience Design and Implementation

Goal:

Give a new learner a meaningful first experience before UNLOCK has enough evidence for normal adaptive learning.

This phase intentionally occurs before or alongside Today implementation.

The product must distinguish:

```text
No evidence yet
```

from:

```text
Nothing currently needs review
```

Define:

- when Starter is required;
- what content it samples;
- how many items it uses;
- what evidence it collects;
- how it creates initial Attempts/progress;
- when the learner exits Starter mode;
- what happens when there is insufficient available content.

Do not pretend personalization already exists for a brand-new learner.

Exit condition:

> A new learner can generate enough initial evidence for UNLOCK to begin making real learning decisions.

---

## 8. Phase 6 — Learning Engine V1

Goal:

Implement the first deterministic learner-state update logic.

Priority signals:

- `mastery_level`;
- `next_review_date`;
- `misconception_hits`;
- `confidence_level` where defined;
- `average_time_seconds` where defined.

Requirements:

- deterministic;
- unit-tested;
- reproducible;
- explicit inputs/outputs;
- based on audited behavior where appropriate;
- versionable when material behavior changes.

Do not use an LLM.

Create Golden Learning Scenarios before treating the engine as trustworthy.

Exit condition:

> Given the same learner history and context, the engine reliably produces the same approved learner-state result.

---

## 9. Phase 7 — Next Best Action V1

Goal:

Rank eligible learning actions using deterministic evidence.

Potential inputs:

- mastery;
- review due status;
- misconception evidence;
- confidence;
- response-time support;
- exam urgency;
- learner history.

Define:

- eligibility;
- score/ranking logic;
- tie-breaking;
- insufficient-data behavior;
- explainable selection reasons.

Avoid fake sophistication.

A simple well-tested ranking is preferable to an opaque complex formula.

Exit condition:

> UNLOCK can deterministically explain which learning items should have priority next.

---

## 10. Phase 8 — Today V1

Goal:

Turn Next Best Action into a simple persistent daily plan.

Implement:

- Today generation;
- Today Session persistence;
- Today Session Items;
- open/start/resume/complete states;
- selection reason metadata where useful;
- no silent regeneration while the active session remains valid.

Today should consume pre-ranked/preselected learning items.

It should not duplicate Learning Engine logic.

Core product events should be implemented with this feature:

- `today_opened`;
- `today_started`;
- `session_completed`;
- `session_abandoned`.

The exact "active user" denominator for the KPI may remain an analytics open question until enough usage exists, but raw product events should not be postponed.

Exit condition:

> An eligible learner opens UNLOCK and receives a persistent plan that can be started and resumed.

---

## 11. Phase 9 — Quiz V1

Goal:

Execute a prepared Today or Starter learning sequence.

Quiz responsibilities:

- display Question;
- collect answer;
- collect approved evidence such as confidence;
- record Attempt;
- provide approved feedback;
- progress through prepared items.

Quiz must not independently choose Today Questions.

Important integrity path:

```text
Response
→ Attempt
→ learner progress update
→ session item update
```

This flow should be consistent and protected from duplicate submission.

Exit condition:

> The learner can complete prepared learning items and every answer becomes reliable learning evidence.

---

## 12. Phase 10 — Complete Adaptive Loop

Goal:

Prove the first full UNLOCK feedback loop works.

Target:

```text
Learner enters Starter or Today
↓
answers Questions
↓
Attempts are preserved
↓
UserQuestionProgress changes
↓
Learner State changes
↓
Next Best Action changes
↓
future Today reflects the new evidence
```

Test this with synthetic learner histories and real end-to-end scenarios.

This is the most important V1 milestone.

Exit condition:

> A learner's behavior today changes what UNLOCK recommends later in a deterministic and understandable way.

---

## 13. Phase 11 — Basic Progress

Goal:

Show enough feedback that the learner can see UNLOCK is learning from them.

Possible V1 outputs:

- Today completion;
- recent activity;
- upcoming review;
- simple Course progress;
- weak/recovering areas;
- evidence-based explanatory messages.

Avoid complex dashboards.

Avoid precise readiness percentages without sufficient evidence.

Exit condition:

> The learner can understand that their activity is affecting future recommendations.

---

## 14. Phase 12 — Analytics Review

Goal:

Use the already-collected core events to evaluate V1 behavior.

Primary behavioral KPI:

> Percentage of active users completing Today on at least 3 separate days within a week.

Before reporting the KPI, finalize:

- the definition of "active user";
- week boundaries;
- eligibility requirements;
- treatment of Starter sessions;
- incomplete sessions.

Analyze:

- Today opens;
- Today starts;
- completion;
- abandonment;
- return frequency;
- Starter conversion into normal Today usage.

Do not build a large analytics platform unless usage volume justifies it.

Exit condition:

> The team can evaluate whether users repeatedly engage with the core adaptive loop.

---

## 15. Phase 13 — Hardening

Goal:

Prepare the core loop for reliable pilot/production use.

Review:

- loading states;
- empty states;
- error states;
- duplicate actions;
- persistence failures;
- mobile layout;
- RTL;
- accessibility;
- RLS/security;
- database constraints;
- observability;
- performance;
- recovery from partial failures.

Add E2E tests for stable critical flows when justified.

Exit condition:

> The core product can be used repeatedly without relying on developer intervention for normal behavior.

---

## 16. Phase 14 — AI Content Intelligence

Goal:

Introduce AI only where it creates meaningful additional value.

Potential initial capability:

- structured Question generation from source Material;
- source provenance;
- rule validation;
- independent verification;
- learner-facing eligibility gate.

Required architecture:

```text
Source
→ Generate
→ Validate
→ Verify
→ Approve/Reject
→ Learner eligibility
```

Do not let AI replace the deterministic Learning Engine.

Exit condition:

> AI-generated content can enter the product through a controlled, testable, auditable quality gate.

---

## 17. Later Capabilities

Possible later areas include:

- richer Content Intelligence;
- System Auditor;
- Knowledge Graph;
- intervention effectiveness;
- instructor analytics;
- Institution support;
- groups;
- Assignments;
- advanced exam readiness;
- notifications;
- Personal AI Coach;
- Web Resource Curator;
- Class Digest;
- native mobile applications.

These are not automatically the next phase.

They should be prioritized only after V1 evidence justifies them.

---

## 18. Explicit Non-Goals During Core V1

Do not interrupt the roadmap to build:

- social feeds;
- leaderboards;
- complex gamification;
- institution dashboards;
- parent accounts;
- organization billing;
- generalized agent infrastructure;
- vector databases without a concrete retrieval need;
- queue/worker infrastructure without an actual async workload;
- native mobile applications;
- advanced LMS functionality.

---

## 19. Pilot Readiness

A pilot does not require every future feature.

A useful V1 pilot should be able to demonstrate:

```text
real learners
+
real course content
+
real repeated study sessions
+
real learning history
+
adaptive Today decisions
```

For an academic pilot, define separately:

- participant onboarding;
- consent where applicable;
- content scope;
- pilot length;
- expected usage cadence;
- support process;
- measurement plan.

If the pilot becomes formal human-subject research or affects grades, institutional ethics/approval requirements should be checked before proceeding.

---

## 20. Roadmap Change Rule

The roadmap may change when new evidence appears.

However, do not silently reorder major phases.

A meaningful roadmap change should state:

- what changed;
- why;
- what evidence caused the change;
- what downstream work is affected.

The roadmap is a decision aid, not a rigid promise.

---

## 21. Historical Immediate Sequence

The sequence below was the early roadmap that led to the current repository
state. It is preserved as history, not as an active queue:

```text
1. Complete the project documentation foundation
2. Perform focused Prototype Learning Audit
3. Resolve core domain open questions
4. Define minimal V1 database design
5. Confirm and introduce persistence/auth
6. Design Starter Experience
7. Implement Learning Engine V1
8. Implement Next Best Action V1
9. Implement Today V1 with core analytics events
10. Implement Quiz V1
11. Prove the adaptive feedback loop
```

Much of this sequence is now implemented or superseded by later ADRs, especially
ADR-015 through ADR-017 and the DailyPlan vertical slice.

For the next authorized work, read:

- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

Do not use this section to start implementation.

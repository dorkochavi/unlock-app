
### `.claude/rules/learning-engine.md`

```text
---
paths:
  - "src/domain/**"
  - "src/application/learning/**"
  - "src/application/dailyPlan/**"
  - "src/infrastructure/learning/**"
  - "src/infrastructure/dailyPlan/**"
---

# UNLOCK — Learning Engine and DailyPlan Rules

These rules apply whenever working on:

- learning-state logic
- Next Best Action
- mastery
- misconception handling
- memory scheduling
- Today planning
- DailyPlan generation
- answer processing
- New Material fallback

This file contains accepted invariants and implementation constraints.

It does NOT define the current Slice or unresolved calibration.

Current execution comes from `docs/CHATGPT_PLAN.md`.

Unresolved calibration belongs in `docs/OPEN_QUESTIONS.md`.

---

## Architectural Boundary

- The Learning Engine must remain deterministic for the same persisted state, policy, and explicit time inputs.
- Do not introduce LLM calls into real-time answer evaluation or Today ranking.
- AI may assist content generation or analysis elsewhere, but it is not the source of truth for learner-state transitions.
- Keep domain/application learning logic independent from Next.js, Supabase Auth, HTTP, and UI concerns.
- Do not hide learning policy inside routes or persistence infrastructure.

---

## Immutable Evidence

- Attempts are immutable historical evidence.
- Never mutate or overwrite an Attempt to "correct" downstream state.
- Derived learning state should remain rebuildable from persisted evidence.
- QuestionVersion preserves the exact content state associated with the learning event.
- Do not reinterpret a historical Attempt using a newer QuestionVersion.

---

## Explicit Time

- Prefer explicit `Date` / `now` inputs at application boundaries.
- Do not use hidden wall-clock calls inside deterministic learning logic when explicit time is available.
- Timezone-sensitive learner-day decisions belong at the application boundary rather than low-level ranking primitives.

---

## Mastery

Accepted target learner-facing progression:

`UNKNOWN → EMERGING → DEVELOPING → STRONG → MASTERED`

Product semantics:

- mastery is evidence-based
- mastery is cumulative
- mastery is reversible
- `MASTERED` is not terminal
- spaced successful retrieval matters more than immediate same-session repetition
- confident wrong evidence is materially negative
- New Material exposure must not create strong mastery

Current implementation enums may differ.

Do not silently migrate or rename mastery states during unrelated work.

Exact internal representation and threshold calibration remain explicit calibration work.

---

## Misconception

Accepted target conceptual progression:

`NONE → SUSPECTED → ACTIVE → RESOLVED`

Current implementation may contain additional internal states until explicitly reconciled.

Rules:

- one ordinary wrong answer does not automatically create ACTIVE misconception
- high-confidence wrong is stronger evidence
- repeated relevant error patterns matter
- misconception resolution requires convincing successful evidence
- elapsed time alone does not resolve misconception
- do not silently rewrite the current implemented state machine during unrelated work

Exact thresholds remain calibration work.

---

## Memory and Scheduling

- FSRS-backed scheduling is the current memory scheduling foundation.
- Previously strong knowledge must be able to become relevant again as forgetting risk rises.
- Do not permanently suppress strong knowledge merely because weaker material exists.
- Memory Need may rise enough to cross nominal ranking boundaries.
- Do not introduce maintenance quotas solely to force strong material into Today.
- Exact Evidence → FSRS rating mapping and retention calibration remain explicitly unresolved/calibrated behavior.

---

## Next Best Action

DailyPlan candidate ranking is based on learning need.

It is not a fairness scheduler between Courses.

Candidate reasoning may include accepted/available signals such as:

- memory/forgetting risk
- learning gap
- misconception evidence
- mastery/weakness evidence
- exam urgency when available
- other explicitly accepted contextual signals

Rules:

- do not add per-Course quotas
- do not add fairness balancing
- do not guarantee every eligible Course representation
- exam proximity amplifies need rather than acting as an eligibility gate
- Courses without exams must still participate through ordinary learning need
- ranking occurs globally across eligible learner Courses

Do not invent exact weights or calibration.

---

## New Material V1

New Material behavior is governed by ADR-017.

For V1:

- unseen means no prior real Attempt exists for the Question
- missing UserQuestionProgress alone does not prove unseen
- ordinary evidence-driven NBA candidates always take precedence
- New Material activates only when there are zero ordinary candidates
- do not mix unseen filler into an already non-empty ordinary DailyPlan
- select at most 3 unseen Questions
- selection must be deterministic
- do not introduce per-Course fairness during New Material fallback
- placing a Question into DailyPlan is not learning evidence
- do not fabricate UserQuestionProgress merely because unseen material was planned
- the first real learner interaction creates evidence through the normal answer path
- New Material exposure is not mastery

Do not broaden ADR-017 semantics during unrelated work.

---

## DailyPlan Identity

- One DailyPlan exists per learner per learner-local calendar day.
- Global Today and Course Today are views over the same DailyPlan.
- Course Today must not create a second independent plan.
- A plan may contain items from multiple eligible Courses.
- Persist the plan once created.
- Reopening Today during the same learner-local day should return the persisted plan.

The persisted IANA learner timezone is authoritative for learner-local day calculation.

---

## Eligible Courses

For automatic DailyPlan generation:

- only active `LEARNER` CourseMemberships participate
- `OWNER` does not automatically participate
- `INSTRUCTOR` does not automatically participate
- archived memberships do not participate
- revoked memberships do not participate

Do not infer learner participation from Course ownership.

Manual access and automatic Today participation are separate concerns.

---

## DailyPlan Size

DailyPlan size is dynamic and driven by meaningful learning need.

Accepted invariants:

- do not force-fill merely to reach a cosmetic target
- preserve a real finish line
- do not add replacement items when an item is skipped
- New Material V1 may contribute up to 3 fallback items only under ADR-017 conditions
- plan size may vary between learners/days

Exact:

- minimum
- typical range
- maximum
- launch tuning

remain calibration unless explicitly frozen by a future decision.

Do not encode provisional values as permanent invariants.

---

## Frozen Plan Semantics

Today is frozen by default after generation for that learner-local day.

Rules:

- completed items remain resolved
- skipped items remain resolved
- ordinary answers do not trigger full same-day reranking
- Manual Practice does not trigger same-day DailyPlan regeneration
- limited future mid-day adaptation requires an explicit product decision
- adaptation must not create endless plan growth

Do not silently introduce same-day dynamic replenishment.

---

## Item Resolution

A DailyPlanItem resolves once.

Current resolution states include:

- `COMPLETED`
- `SKIPPED`

Rules:

- resolved items must not silently reopen
- deliberate re-answering belongs to Manual Practice
- technical retries should be idempotent where the path supports idempotency
- Skip is not incorrect evidence
- Skip does not create mastery failure
- Skip does not create misconception evidence
- Skip does not create a replacement item
- Skip resolves the Today item for that day without implying learning success

---

## Finish Line

Today must have a real finish line.

When all DailyPlan items are resolved:

- Today is complete for that learner-local day
- additional practice is optional
- additional practice exists outside that DailyPlan
- completed/skipped items are not automatically replenished

Do not design Today as an endless question feed.

---

## Manual Practice

Manual Practice is separate from Today.

Manual Practice may:

- create valid Attempts
- update learning state
- affect future DailyPlan generation
- allow intentional re-answering

Manual Practice must not automatically:

- complete a matching DailyPlanItem
- skip/remove a DailyPlanItem
- resolve Today because the same Question was answered elsewhere
- trigger same-day DailyPlan regeneration

unless a future accepted decision explicitly changes this contract.

---

## Exam Urgency

Accepted product direction:

- an exam date may amplify learning urgency
- an exam is not required for a Course/question to be eligible
- the system must not fabricate an exam date
- exam urgency should interact with actual learning need
- urgency does not replace the broader Learning Engine

Exact:

- date hierarchy
- urgency curve
- thresholds
- weights
- time windows

remain calibration/open decisions unless explicitly resolved.

Do not encode illustrative timing such as "14 days" as an invariant without an accepted decision.

---

## Engine Versioning

- Retain engine-version information where current architecture expects it.
- Material changes to learner-state derivation or Today planning may require a new engine version.
- Do not change engine version for UI, formatting, route wiring, or unrelated infrastructure work.
- If replay/rebuild semantics materially change, review engine-version implications explicitly.
- Exact versioning granularity remains an Open Question.

---

## Testing

For Learning Engine / DailyPlan changes:

- prefer deterministic unit tests
- inject explicit time
- test positive and negative evidence
- test reversible transitions where relevant
- test replay/rebuild consistency where relevant
- test Manual Practice / Today separation where relevant
- test New Material fallback conditions where relevant
- test deterministic selection/order when relevant
- avoid wall-clock-dependent tests
- distinguish product invariants from calibration tests

Do not rewrite accepted-invariant tests merely to accommodate an accidental implementation change.

---

## Scope Discipline

Do not combine unrelated learning-model work with infrastructure/UI changes.

Examples:

- API work must not rename mastery states
- Auth work must not change ranking behavior
- UI work must not redefine misconception transitions
- PostgreSQL runtime work must not change Today semantics
- New Material work must not silently redefine DailyPlan size calibration
- onboarding work must not alter learner-state rules

If repository reality conflicts with the current Plan:

1. determine whether the accepted intent can be preserved with a narrow adaptation
2. if yes, adapt minimally
3. if a new product/architecture decision is required, report `PLAN_CONFLICT`
4. do not silently invent the decision

---

## Source of Truth Discipline

When product/learning semantics are unclear:

1. inspect the current relevant Slice
2. inspect accepted ADRs
3. inspect the narrow relevant canonical learning document
4. inspect `docs/OPEN_QUESTIONS.md`
5. do not use historical Run Reports as a decision source

Accepted ADRs override older conflicting prose.

---

## Git Safety

Follow repository-wide Git safety rules in `CLAUDE.md`.

Do not rewrite accepted historical Learning Engine migrations/commits casually.

New behavioral changes should preserve accepted history and use forward evolution.
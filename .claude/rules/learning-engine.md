---
paths:
  - "src/domain/**"
  - "src/application/learning/**"
  - "src/application/dailyPlan/**"
  - "src/infrastructure/learning/**"
  - "src/infrastructure/dailyPlan/**"
---

# UNLOCK — Learning Engine and DailyPlan Rules

These rules apply whenever working on learning-state logic, Next Best Action, mastery, misconception handling, Today planning, DailyPlan generation, or answer processing.

## Architectural boundary

- The Learning Engine must remain deterministic for the same persisted state, policy, and explicit time inputs.
- Do not introduce LLM calls into real-time answer evaluation or Today ranking.
- AI may assist content generation or analysis elsewhere, but it is not the source of truth for learning-state transitions.
- Keep domain/application learning logic independent from Next.js, Supabase Auth, HTTP, and UI concerns.

## Immutable evidence

- Attempts are immutable historical evidence.
- Never mutate or overwrite an Attempt to "correct" downstream state.
- Derived learning state must be rebuildable from persisted historical evidence.
- Question/QuestionVersion snapshots preserve what the learner actually answered against.
- Do not silently reinterpret a historical Attempt using a newer QuestionVersion.

## Explicit time

- Prefer explicit `Date` / `now` inputs at application boundaries.
- Do not introduce hidden `Date.now()` or `new Date()` calls inside deterministic learning logic when an explicit clock value is available.
- Timezone-sensitive local-day decisions belong at the appropriate application boundary, not inside low-level ranking primitives.

## Mastery

Accepted target progression:

`UNKNOWN → EMERGING → DEVELOPING → STRONG → MASTERED`

Product semantics:

- mastery is cumulative and evidence-based
- mastery is reversible
- `MASTERED` is not terminal
- spaced successful retrieval matters more than same-session repetition
- a confident wrong answer is stronger negative evidence than an ordinary wrong answer
- exposure to new material is weak evidence and must not be treated as mastery

Current implementation enums may differ from the target progression.

Do not silently migrate or rename mastery states as part of unrelated work.
Any reconciliation between current implementation and target model requires an explicit slice.

## Misconception

Accepted conceptual progression:

`NONE → SUSPECTED → ACTIVE → RESOLVED`

Current implementation may contain additional internal states.

Rules:

- one ordinary wrong answer does not automatically mean ACTIVE misconception
- high-confidence wrong evidence is stronger, but does not by itself necessarily imply ACTIVE
- repeated pattern evidence across relevant questions is meaningful
- resolving misconception requires successful retrieval evidence, not merely elapsed time
- do not silently simplify the implemented state machine during unrelated work

## Memory and scheduling

- FSRS-backed scheduling is the current memory scheduling foundation.
- Strong knowledge must eventually return as forgetting risk rises.
- Do not permanently suppress strong knowledge simply because weaker material exists.
- Memory Need may eventually rise enough to cross nominal ranking tier boundaries.
- Do not add artificial maintenance quotas merely to force strong material into Today.

## Next Best Action

DailyPlan ranking is based on learning need, not fairness between courses.

Candidate reasoning may include:

- memory/forgetting risk
- learning gap
- exam urgency
- misconception evidence
- coverage need
- recency / novelty

Rules:

- do not add per-course quotas
- do not add fairness balancing
- do not guarantee every active course representation
- exam proximity amplifies urgency but is not required for eligibility
- courses without exams must still participate through learning need
- ranking happens globally across eligible learner courses

Exact long-term weights/calibration remain product calibration work unless explicitly assigned.

## New material exposure

New-material exposure is an extension of the same starter/unseen-material mechanism family.

Rules:

- exposure is not mastery
- Today may expose new material using representative questions
- poor exposure performance can later motivate focused Manual Practice
- do not claim Today itself fully teaches unseen material
- exposure should consume DailyPlan budget
- avoid flooding Today with too many unrelated new topics

Exact novelty-budget calibration remains adjustable unless explicitly frozen.

## DailyPlan identity

- One DailyPlan exists per user per local calendar day.
- Global Today and Course Today are views of the same DailyPlan.
- Course Today must not create a second independent plan.
- Plan generation may include items from multiple eligible courses.
- Persist the plan once created.
- Reopening Today on the same local day should return the persisted plan rather than fully regenerate it.

## Eligible courses

For automatic personal DailyPlan generation:

- only active `LEARNER` memberships are eligible
- `OWNER` and `INSTRUCTOR` memberships are management roles and do not automatically participate as the user's own learning courses
- archived memberships do not participate automatically
- revoked memberships do not participate automatically

Do not infer learner participation from course ownership.

## DailyPlan size

Current product direction:

- minimum useful size around 5
- typical range around 8–12
- hard cap 15
- do not force-fill merely to hit a number

Current runtime implementation may only enforce part of this policy.

Do not silently add floor/fill behavior during unrelated changes.

## Frozen plan semantics

Today is frozen by default after first generation for that local day.

Rules:

- completed items never change
- skipped items do not reappear in the same plan
- do not fully rerank the remaining plan after ordinary answers
- limited future adaptation may be introduced only through an explicit slice
- adaptation must not create endless plan growth

Current V1 decision:

- Manual Practice updates learning state
- Manual Practice does NOT trigger same-day DailyPlan adaptation
- Manual Practice does NOT resolve a matching DailyPlanItem

## Item resolution

A DailyPlanItem resolves once.

Valid resolution paths currently include:

- COMPLETED
- SKIPPED

Rules:

- completed/skipped items must not be silently reopened
- an intentional re-answer belongs to Manual Practice
- technical retry of the same submission should remain idempotent where supported
- do not treat skip as incorrect learning evidence
- skip resolves the Today item for that day but does not imply successful learning

## Finish line

Today must have a real finish line.

When all plan items are resolved:

- Today is done for that day
- extra practice is optional
- extra practice is outside the DailyPlan
- do not automatically replenish skipped/completed items merely to keep the session going

## Manual Practice

Manual Practice is separate from Today.

It may:

- update learning state
- affect future DailyPlan generation
- allow intentional re-answering

It must not, in V1:

- automatically mark a matching Today item completed
- remove a Today item
- trigger same-day plan adaptation

unless an explicit product decision changes this.

## Exam urgency

- Exam date is an urgency amplifier, not an eligibility gate.
- Meaningful urgency ramp begins roughly around 14 days before the exam.
- Urgency becomes especially strong in the final few days.
- Exact formula is calibration work unless explicitly assigned.
- Do not hardcode arbitrary urgency weights inside route/UI code.

## Engine versioning

- Persist/retain engine version information where the existing architecture expects it.
- Changes that materially alter learning-state derivation or Today planning may require a new engine version.
- Do not change engine version casually for formatting, route, UI, or infrastructure work.
- If replay/rebuild semantics change, review versioning implications explicitly.

## Testing

For learning-engine changes:

- prefer deterministic unit tests
- inject explicit time
- test positive and negative evidence
- test reversible state transitions where relevant
- test replay/rebuild consistency where relevant
- avoid tests that rely on wall-clock timing
- distinguish policy calibration tests from invariant tests

Do not rewrite tests merely to match a changed implementation if the previous tests captured an accepted product invariant.

## Scope discipline

Do not combine unrelated learning-model migrations into infrastructure/UI work.

Examples:

- API route work should not rename mastery states
- Auth work should not change ranking weights
- UI work should not alter misconception transitions
- Postgres runtime work should not change Today semantics

If you discover a mismatch between implementation and accepted product semantics:

1. report it
2. identify the affected files
3. explain whether it blocks the current task
4. do not silently fix it unless explicitly instructed

## Git safety

Follow the repository-wide Git safety rules in `CLAUDE.md`.

Do not rewrite accepted historical learning-engine migrations or commits casually. Preserve accepted history unless an explicit migration/history-rewrite task requires otherwise.
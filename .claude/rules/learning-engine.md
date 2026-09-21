# UNLOCK — Learning Engine / DailyPlan Guardrails

Status: ACTIVE
Owner: compact implementation guardrails over accepted ADRs

Canonical product semantics live in the relevant ADRs and learning/product docs. This rule lists only do-not-break invariants for implementation.

## Determinism
Real-time learning behavior should be deterministic for the same persisted state, policy/version, and explicit time where the accepted model requires determinism.
Do not make an LLM the source of truth for grading, mastery, misconception, scheduling, NBA, or Today ranking.

## Historical Evidence
- Attempts are immutable historical evidence.
- QuestionVersions are immutable.
- Historical Attempts remain tied to the exact QuestionVersion answered.
- Never rewrite history to make current derived state look correct.

## Learner State
Evidence-driven state is cumulative and reversible.
Do not equate weak/missing evidence with mastery.
Confident wrong answers can be materially negative evidence.
Strong knowledge may return as forgetting risk grows.

Do not silently migrate current mastery/misconception enums during unrelated work.

## Time / Scheduling
Use explicit time inputs in deterministic learning flows.
Learner timezone defines DailyPlan local day.
FSRS-family scheduling remains behind the memory-scheduler boundary.

## DailyPlan / Today (ADR-016)
Critical guardrails:
- one persisted DailyPlan per learner per local calendar day;
- Global Today and Course Today are views over the same plan;
- plan normally freezes for the day once generated;
- no automatic yesterday carry-over;
- Manual Practice does not resolve Today items;
- Skip resolves the item without Attempt/mastery/misconception/scheduler evidence and without replacement work;
- only active LEARNER memberships auto-participate;
- no per-Course fairness quota.

## New Material (ADR-017)
- ordinary ranked review candidates are preferred;
- New Material is fallback-only in V1;
- unseen requires no prior real Attempt (missing progress row alone is insufficient);
- deterministic selection;
- up to the accepted V1 limit;
- planning/exposure does not fabricate learner progress or strong mastery.

## NBA
NBA is learning-need ranking, not Course fairness scheduling.
Any ranking-policy change should be explicit, testable, and versioned where outcomes depend on it.

## Verification
Follow `.claude/rules/testing.md`.
Load ADR-016/017 or other specific decisions when changing their governed behavior rather than duplicating them here.

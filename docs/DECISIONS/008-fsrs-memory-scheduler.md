# ADR-008: FSRS-Family Memory Scheduler Behind MemoryScheduler Interface

Status: ACCEPTED

## Context

UNLOCK needs a review-scheduling mechanism to determine `next_review_date` / retrievability for UserQuestionProgress. `docs/OPEN_QUESTIONS.md` #12 has tracked this as open pending prototype audit.

`docs/LEARNING_ENGINE.md` (§12–§15, §51, §53–§54) already evaluated this design space and recommended an FSRS-family scheduler accessed through an internal `MemoryScheduler` adapter, rather than reimplementing spaced-repetition scheduling from scratch or carrying forward the Base44 prototype's fixed streak/threshold rules. FSRS is a validated, actively maintained memory model, and `ts-fsrs` is its reference TypeScript implementation.

This decision concerns memory scheduling only. It is not a decision about the Learning Engine as a whole.

## Decision

UNLOCK V1 will use an FSRS-family scheduler as the memory-scheduling implementation behind the internal `MemoryScheduler` domain interface defined in `docs/LEARNING_ENGINE.md` §12.

- `ts-fsrs` 5.4.2 is the initial implementation dependency.
- The implementation must remain fully behind `MemoryScheduler`. Domain code must not depend directly on `ts-fsrs`.
- FSRS owns memory scheduling / retrievability-related behavior only.

This decision does **not** make FSRS the Learning Engine. Next Best Action, misconception detection, Course coverage, exam urgency, Today planning, and evidence-quality classification remain UNLOCK domain logic outside FSRS, as already described in `docs/LEARNING_ENGINE.md` §13.

This decision does not resolve:

- the exact mapping from UNLOCK evidence (correctness, confidence, response time, assistance) to FSRS ratings;
- desired retention configuration;
- whether/how desired retention changes near an exam date.

Response time and confidence must not be automatically mapped to FSRS `Hard` / `Easy` ratings without a separate, explicitly documented and tested mapping decision.

## Consequences

Positive:

- review scheduling is based on a validated, maintained memory model rather than a reimplemented or ad hoc formula;
- the adapter boundary allows the FSRS library version, its parameters, or even the underlying scheduler family to change later without rewriting Next Best Action, Today, or misconception logic;
- scheduler behavior stays independently testable through the `MemoryScheduler` interface (`initialize`, `review`, `estimateRetrievability`).

Required discipline:

- no domain module may import `ts-fsrs` directly;
- the evidence → rating mapping and desired-retention configuration must be documented and tested before the adapter is relied upon for real scheduling decisions;
- `.cursor/rules/learning-engine.mdc` still applies: changing the mapping, retention configuration, or scheduler version later requires documenting the change, versioning the engine, and adding tests.

## Alternatives Considered

### Reimplement or hand-tune a custom spaced-repetition formula

Rejected for V1. `docs/LEARNING_ENGINE.md` §51 already identifies the Base44 prototype's fixed streak/threshold scheduling as behavior to replace. Reimplementing a competitive memory model from scratch is unnecessary risk when a validated, maintained library exists.

### Depend on `ts-fsrs` directly from domain code

Rejected. This would couple UserQuestionProgress updates, Next Best Action, and Today planning to one library's types and versioning, blocking future scheduler upgrades or replacement without a domain-wide rewrite.

### Treat FSRS as the entire Learning Engine

Rejected. `docs/LEARNING_ENGINE.md` §13 is explicit that FSRS does not decide misconception remediation, coverage, Today composition, exam urgency, or content quality. Those remain UNLOCK domain logic.

## Related Documents

- `docs/LEARNING_ENGINE.md`
- `docs/OPEN_QUESTIONS.md` (#12)
- `.cursor/rules/learning-engine.mdc`
- `docs/DECISIONS/004-ai-is-not-the-learning-engine.md`
- `docs/DECISIONS/005-attempts-are-immutable.md`

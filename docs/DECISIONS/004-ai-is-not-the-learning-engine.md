# ADR-004: AI Is Not the Learning Engine

Status: ACCEPTED

## Context

UNLOCK may use AI for content generation, explanations, verification, tutoring, and future content intelligence.

However, V1 learning decisions such as mastery, review timing, Today priority, and Next Best Action need to be:

- deterministic;
- testable;
- reproducible;
- cost-efficient;
- explainable enough to debug.

An LLM call on each learning decision would weaken these properties.

## Decision

AI will not be the core Learning Engine.

In V1, Learner State and Next Best Action are deterministic.

AI may support content-related capabilities through explicit provider boundaries, but it must not silently determine:

- mastery;
- review scheduling;
- Today ranking;
- Next Best Action ranking.

## Consequences

- core learning decisions can be tested with stable inputs/outputs;
- product behavior is not dependent on model variability;
- runtime AI cost stays controlled;
- AI provider outages do not prevent deterministic learning decisions.

## Alternatives Considered

### LLM-driven learning decisions

Rejected for V1 because of variability, cost, reproducibility, and auditability concerns.

## Related Documents

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `.cursor/rules/ai.mdc`
- `.cursor/rules/learning-engine.mdc`

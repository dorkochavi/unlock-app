# ADR-003: Quiz Does Not Select Today Questions

Status: ACCEPTED

## Context

UNLOCK's core value comes from deciding what the learner should study next.

If Quiz independently selects Questions, adaptive decision logic becomes mixed with presentation/execution behavior.

This would make Today difficult to reproduce, test, audit, and improve.

## Decision

Today planning / Next Best Action logic selects the learning items.

Today Session Items persist the prepared plan.

Quiz receives and executes those prepared items.

In Today mode, Quiz must not independently replace or re-rank Questions.

## Consequences

- adaptive selection logic remains testable outside React/UI;
- Today Sessions can be resumed consistently;
- Quiz remains reusable as an execution interface;
- changes to question presentation do not silently change learning strategy.

## Alternatives Considered

### Quiz dynamically chooses each next Question

Rejected for V1 because it mixes strategy with execution and makes the prepared Today plan less reproducible.

A future adaptive-within-session model would require an explicit new decision and contract.

## Related Documents

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DOMAIN_GLOSSARY.md`
- `.cursor/rules/learning-engine.mdc`

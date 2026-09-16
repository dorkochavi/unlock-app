# ADR-005: Attempts Are Immutable Historical Evidence

Status: ACCEPTED

## Context

UNLOCK needs both:

1. a reliable record of what the learner actually did;
2. an evolving interpretation of what that history means now.

If historical Attempts are overwritten as mastery or algorithms change, the system loses its evidence trail and makes recalculation/auditing unreliable.

## Decision

Attempt records represent historical answer events and are immutable after creation, except for narrowly defined technical correction cases if explicitly designed later.

Current learner state belongs in derived structures such as UserQuestionProgress, not in rewritten Attempt history.

## Consequences

- historical evidence remains auditable;
- engine changes can recalculate derived state without rewriting history;
- analytics can distinguish past behavior from current interpretation;
- Question editing/versioning must preserve the meaning of old Attempts.

## Alternatives Considered

### Store current progress directly on Attempts

Rejected because one historical event cannot also represent evolving current state.

### Rewrite Attempts when algorithms change

Rejected because it destroys the original evidence.

## Related Documents

- `docs/DATABASE.md`
- `docs/PRODUCT.md`
- `docs/DOMAIN_GLOSSARY.md`
- `.cursor/rules/database.mdc`

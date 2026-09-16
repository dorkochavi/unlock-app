# ADR-007: Cost-Efficient by Default

Status: ACCEPTED

## Context

UNLOCK may eventually use AI, analytics, background processing, semantic search, and other external services.

Premature use of paid or operationally heavy infrastructure can create recurring cost before product value has been validated.

At the same time, cost savings must not weaken security, correctness, or essential reliability.

## Decision

UNLOCK will prefer the simplest reliable solution in this order:

```text
existing capability
→ deterministic application logic
→ database / SQL / statistics
→ cache / precomputation
→ external provider
→ AI
```

Recurring infrastructure or AI cost requires a concrete product or operational reason.

This is not a zero-cost rule.

## Consequences

- no LLM call per ordinary learning click by default;
- no queue/vector database/microservice without demonstrated need;
- existing platform capabilities should be used before adding new infrastructure;
- cost optimization must not compromise security, data integrity, or essential reliability.

## Alternatives Considered

### AI-first / infrastructure-first design

Rejected because it increases cost and complexity without necessarily improving V1 learning outcomes.

### Zero-cost-at-all-costs design

Rejected because reliability and correctness are more important than avoiding every paid dependency.

## Related Documents

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT.md`
- `.cursor/rules/ai.mdc`
- `.cursor/rules/architecture.mdc`

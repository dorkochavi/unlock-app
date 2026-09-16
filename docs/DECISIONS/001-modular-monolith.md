# ADR-001: Modular Monolith

Status: ACCEPTED

## Context

UNLOCK needs clear domain boundaries across learning logic, Today, Quiz, content, data, and future AI capabilities.

The product is still in early V1 development.

Introducing multiple deployable services now would increase:

- operational complexity;
- deployment complexity;
- debugging cost;
- infrastructure cost;
- coordination overhead.

At the same time, a completely unstructured monolith would make future change difficult.

## Decision

UNLOCK will begin as a modular monolith.

The application will use one primary deployment unit with clear internal module/domain boundaries.

Conceptual capability boundaries such as Learner State Brain and Next Best Action Brain do not imply separate services.

Microservices may be introduced later only when demonstrated scale, ownership, reliability, or operational requirements justify them.

## Consequences

Positive:

- simpler deployment;
- easier local development;
- lower infrastructure cost;
- easier end-to-end refactoring;
- fewer distributed-system failure modes.

Required discipline:

- domain responsibilities must remain explicit;
- learning logic should not leak into UI code;
- feature modules should not become tightly coupled through hidden behavior.

## Alternatives Considered

### Microservices from the start

Rejected because current product scale and team needs do not justify the operational complexity.

### Unstructured single application

Rejected because UNLOCK has meaningful domain boundaries that should remain explicit.

## Related Documents

- `docs/ARCHITECTURE.md`
- `docs/PRODUCT.md`
- `.cursor/rules/architecture.mdc`

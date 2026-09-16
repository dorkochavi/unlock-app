# ADR-006: Course Does Not Require Institution

Status: ACCEPTED

## Context

UNLOCK may later support institutions, instructors, classes, and organizational administration.

V1 must also work for an individual learner using UNLOCK independently.

Making Institution mandatory would force multi-tenant and organizational complexity into the first product loop.

## Decision

Course is a first-class V1 entity that can exist without an Institution.

Institution is architecture-ready but optional.

No V1 Course flow may require institution membership merely to function.

## Consequences

- individual learners can use UNLOCK directly;
- V1 data model remains simpler;
- future Institution support must attach to Course without redefining Course as institution-dependent;
- institutional roles and tenancy are deferred until they have a real product requirement.

## Alternatives Considered

### Institution → Course as mandatory hierarchy

Rejected because it blocks the individual-learner V1 use case and adds unnecessary complexity.

## Related Documents

- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `.cursor/rules/architecture.mdc`

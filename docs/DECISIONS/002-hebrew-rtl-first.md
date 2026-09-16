# ADR-002: Hebrew and RTL First

Status: ACCEPTED

## Context

UNLOCK's initial product experience is intended for Hebrew-speaking learners.

Adding RTL and localization after UI implementation commonly creates avoidable layout, navigation, copy, and component debt.

## Decision

UNLOCK will be Hebrew-first and RTL-first from the project foundation.

Defaults:

```text
language: he
direction: rtl
locale: he-IL
```

Technical identifiers remain in English.

User-facing copy should flow through the project messages layer where practical.

## Consequences

- UI components should be reviewed in RTL from the beginning.
- Direction-sensitive icons and navigation require explicit attention.
- Mixed Hebrew/English content must remain readable.
- Future localization should extend the existing messages structure rather than replace hardcoded copy across the app.

## Alternatives Considered

### Build LTR/English first and translate later

Rejected because it creates unnecessary rework and risks making RTL a secondary-quality experience.

## Related Documents

- `docs/PRODUCT.md`
- `docs/DEFINITION_OF_DONE.md`
- `.cursor/rules/rtl-i18n.mdc`
- `src/lib/locale.ts`
- `src/messages/`

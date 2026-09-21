# UNLOCK — Testing Strategy

Status: ACTIVE

This document defines **what confidence means** in UNLOCK. It is tool-agnostic.
Operational selection, freshness, invalidation, and escalation live in `.claude/rules/testing.md`.

## 1. Principles

Tests should prove behavior and invariants, not mirror implementation detail.

Prefer:
- deterministic tests;
- explicit time inputs;
- controlled randomness;
- boundary-focused integration evidence;
- regression tests for real defects;
- immutable historical evidence checks;
- the smallest environment capable of proving the claim.

Do not chase an arbitrary coverage percentage.

## 2. Evidence Layers

### Domain / pure unit
Use for deterministic business rules:
- validation;
- mastery/evidence transitions;
- ranking/scoring functions;
- misconception logic;
- time calculations with explicit inputs.

### Application/use-case
Use for orchestration and port contracts:
- authorization outcomes;
- repository interactions;
- multi-step application behavior;
- expected domain/application errors.

### API boundary
Use for:
- authentication before privileged dependency construction;
- input parsing/validation;
- stable HTTP mapping;
- leakage prevention;
- route wiring.

### PostgreSQL / schema / PGlite
Use for:
- migrations;
- constraints;
- mapping/types;
- transactions and rollback;
- SQL behavior supported by the test environment;
- persistence invariants.

PGlite is strong local evidence but does not prove every real PostgreSQL/Supabase behavior, especially true multi-connection concurrency and managed-service behavior.

### Browser E2E
Use for high-value user journeys that cross presentation/API/auth boundaries and cannot be proven adequately below the browser layer.

Do not use browser E2E as a default replacement for focused lower-layer tests.

### Hosted/manual evidence
Use only when a claim genuinely depends on deployed/managed behavior. State clearly what was and was not proven.

## 3. Learning-System Confidence

Learning behavior must be deterministic for the same persisted state, policy, and explicit time where the product requires determinism.

Important regression areas include:
- immutable Attempts;
- immutable QuestionVersions;
- historical Attempts tied to exact versions;
- learner-state changes from real evidence only;
- scheduler/review-date behavior;
- DailyPlan freeze/reload semantics;
- Skip creating no learning evidence;
- Manual Practice not resolving Today items;
- New Material not fabricating mastery/progress evidence.

Exact product semantics are owned by ADRs/canonical learning docs, not by this testing document.

## 4. Security / Authorization Confidence

Protected behavior should prove the relevant trust boundary:
- authenticated identity is server-derived;
- authorization is explicit and fails closed;
- unauthenticated requests do not reach privileged DB/runtime construction where that ordering matters;
- unexpected errors do not expose internal detail;
- adopted server-side controls are enforced.

RLS is not an automatic universal requirement. If RLS is introduced for a surface, test the adopted policy explicitly.

## 5. Database Confidence

For persistence changes, verify as relevant:
- migration forward-compatibility;
- constraints/FKs/nullability;
- repository mapping;
- transaction atomicity;
- rollback behavior;
- historical-data preservation;
- concurrency behavior at the strongest practical environment.

Be precise about environment limits.

## 6. Regression Tests

When a real defect is fixed, prefer a focused regression test that fails for the old behavior and protects the corrected invariant.

Do not add broad tests that only duplicate existing evidence without protecting a distinct failure mode.

## 7. Fakes and Test Utilities

Use fakes/builders when they preserve the contract being tested and keep tests understandable.

Do not merge domain-specific fakes merely because filenames look similar. Cross-domain test abstractions should reduce real maintenance cost without weakening boundaries.

Deferred maintainability ideas belong in `docs/FOLLOW_UP_BACKLOG.md`.

## 8. Environment Honesty

Every verification claim should identify the evidence level when ambiguity matters:
- pure/unit;
- application/in-memory;
- PGlite/local Postgres-compatible;
- browser fixture;
- hosted/manual.

Never claim that local evidence proves hosted Supabase behavior unless it actually does.

## 9. Evidence Reuse

A test result is evidence, not ceremony.

If later changes cannot materially affect what an existing result proves, that result may remain valid. Operational freshness rules live in `.claude/rules/testing.md`.

## 10. Completion

Testing is sufficient when the relevant risks are covered by fresh evidence at the appropriate layers.

More tests are not automatically more confidence. Prefer distinct evidence over repetition.

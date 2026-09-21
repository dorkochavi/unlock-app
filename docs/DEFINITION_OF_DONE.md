# UNLOCK — Definition of Done

Status: ACTIVE QUALITY STANDARD

This document defines **what must be true** before meaningful work is considered complete. It does not schedule commands or select reviewers.

## Scope

Work is done when:
- it delivers the approved Slice/Run intent;
- no unrelated scope was silently added;
- unresolved decisions were not invented;
- accepted ADRs/invariants remain respected.

## Behavior

- intended user/system behavior works at the relevant boundaries;
- important failure/edge paths are handled deliberately;
- no known material regression is left hidden;
- user-visible behavior remains coherent for Hebrew/RTL/mobile requirements when relevant.

## Architecture

- presentation, application, domain, and infrastructure responsibilities remain appropriately separated;
- domain/product policy is not buried in routes/UI/SQL accidentally;
- abstractions are introduced only when they reduce real complexity;
- existing architecture is reused rather than duplicated without cause.

## Data / Learning Integrity

When relevant:
- migrations are forward-only;
- transactional multi-write behavior is atomic;
- immutable Attempts remain immutable;
- immutable QuestionVersions remain immutable;
- historical evidence remains tied to the correct version/state;
- derived learner state is changed only by legitimate evidence/policy.

## Security

When relevant:
- trusted identity comes from the trusted server boundary;
- authorization is explicit and fails closed;
- secrets remain server-only and are never exposed in output/docs;
- unexpected errors do not leak sensitive internals;
- adopted data-access controls are enforced.

Do not treat RLS as automatically required unless it is part of the accepted design for the changed surface.

## Verification

Relevant verification required by `.claude/rules/testing.md` is fresh and green.

Evidence claims accurately describe their environment and limitations.

Do not rerun broad checks solely to satisfy a ritualized completion boundary.

## Review

Risk-appropriate review selected by `review-commit` has no unresolved blocking/material findings.

A low-risk change may legitimately require no specialist reviewer.

## Code / Repository Quality

When code is changed:
- types/build/lint/test quality is appropriate to the changed surface;
- dead or misleading code introduced by the change is not left behind;
- diff is focused and understandable;
- generated/local artifacts are not promoted to canonical knowledge accidentally.

## Documentation

Update durable documentation only when durable truth changed.

- Plan owns current execution;
- DEV_STATUS owns current snapshot;
- ADRs own durable decisions;
- Run Reports own history;
- Follow-Up Backlog owns useful deferred work;
- scratch owns temporary continuity.

Do not duplicate the same fact across all of them.

## Completion Evidence

A completed Slice/Run should be explainable with a compact evidence summary:
- what changed;
- relevant fresh verification;
- relevant review result;
- known accepted limitation, if any;
- Git state/manual gate if relevant.

## Final Principle

Done means **the intended change is correct, appropriately evidenced, and safely integrated** — not that every available test/reviewer/document was invoked.

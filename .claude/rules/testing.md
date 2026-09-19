---
paths:
  - "src/**/*.test.ts"
  - "src/**/*.test.tsx"
  - "supabase/tests/**"
  - "vitest.config.*"
  - "supabase/vitest.config.*"
  - "package.json"
---

# UNLOCK — Testing and Verification Rules

These rules apply whenever writing, reviewing, or running tests and verification commands.

## General philosophy

Tests should protect accepted behavior and architecture, not merely mirror the current implementation.

Prefer tests that prove:

- externally meaningful behavior
- domain/application invariants
- trust boundaries
- transaction boundaries
- deterministic learning behavior
- persistence constraints
- important failure paths

Avoid tests whose only purpose is increasing test count.

## Test pyramid for this repository

Use the narrowest useful test layer.

Prefer:

1. pure unit tests for deterministic domain/application logic
2. fake/injected-dependency tests for API/control-flow wiring
3. PGlite/Postgres-compatible integration tests for repositories, transactions, and migrations
4. real Supabase/browser E2E only when behavior genuinely depends on the real environment

Do not use real network calls in ordinary unit tests.

## Development loop

During implementation:

- run targeted tests first
- run typecheck when signatures/types change
- run lint after code stabilizes

Do not run the entire repository suite after every tiny edit unless there is a specific reason.

Before a local commit:

- run targeted tests for changed behavior
- run `npm run typecheck`
- run `npm run lint`
- run `git diff --check`

Before a push/checkpoint:

- run full unit suite
- run full schema/Postgres suite only when relevant (see "When to run `npm run test:schema`" below)
- run typecheck
- run lint
- run `git diff --check`
- inspect `git status`

## Current commands

Use the repository's existing scripts unless package.json changes.

Typical verification commands:

`npm run typecheck`

`npm run lint`

`npm test`

`npm run test:schema`

`git diff --check`

`git status`

Do not invent new scripts merely to avoid using an existing one.

## When to run `npm run test:schema`

`npm run test:schema` is not a default checkpoint step. It is a targeted suite, run only when relevant.

Run it when the current slice changes or directly depends on:

- Supabase/PostgreSQL migrations
- database schema
- SQL queries
- PostgreSQL repositories
- database row mappers / serialization
- persistence constraints
- transaction behavior
- database-specific integration behavior

Do not run it when the only changes since the last successful `test:schema` run in this slice are:

- documentation
- UI-only code
- styling
- unrelated client-side changes
- workflow/config documentation
- other changes that do not affect persistence/database behavior

If `test:schema` already passed earlier in the same slice and no DB-relevant code changed afterward, do not run it again just to close the checkpoint — report the earlier result instead.

This does not weaken migration/Postgres safety elsewhere in this file or in `.claude/rules/postgres.md` — it only avoids redundant reruns when nothing DB-relevant changed.

## Determinism

Tests must avoid dependence on:

- wall-clock timing
- machine timezone
- random execution order
- network availability
- external services

When time matters:

- inject an explicit `Date`
- use a fake clock where useful
- assert the exact time value passed across boundaries

When randomness matters:

- inject deterministic values
- use fixed IDs when appropriate
- do not depend on UUID lexical ordering unless that ordering is part of the behavior under test

## Known schema test caveat

A pre-existing schema test has historically been timing-sensitive when multiple rows receive the same `created_at` timestamp and ordering falls back to random UUID `id`.

If a schema test fails around canonical Attempt replay ordering:

- inspect whether `answered_at` and `created_at` tied
- do not immediately attribute the failure to unrelated changes
- do not "fix" production ordering semantics casually
- identify whether the test itself is relying on an unstable timestamp distinction

Treat this as a known diagnostic clue, not as permission to ignore failures.

## PGlite limitations

PGlite is valuable but must not be overstated.

PGlite can meaningfully test:

- SQL syntax
- migrations
- constraints
- repository behavior
- transactions in one in-process PostgreSQL-compatible engine
- trigger behavior against test-prepared schemas

PGlite does NOT prove:

- genuine multi-backend PostgreSQL concurrency
- hosted Supabase Auth behavior
- real GoTrue signup behavior
- real browser cookie behavior
- real network failures
- real connection-pool behavior under deployment load

State these distinctions honestly in tests/docs.

## Supabase-managed auth schema tests

A minimal test-only `auth.users` stand-in may exist so application migrations can run under PGlite.

Rules:

- keep the stand-in minimal
- label it explicitly as test-only
- do not expand it to imitate the entire Supabase Auth schema without a real need
- do not claim a passing stand-in test proves hosted Supabase behavior
- real Auth trigger behavior must later be exercised against a real Supabase project

## Route tests

For Next.js Route Handlers:

- keep route files thin
- extract testable control flow when appropriate
- prefer fake-only wiring tests over real network/database tests
- explicitly test security-relevant ordering when ordering matters

Examples of ordering worth testing:

- authentication before database construction
- authorization before mutation
- validation before persistence
- transaction start before atomic writes

If real route wiring itself contains important behavior, do not assume handler tests automatically cover it.

## Auth tests

Auth tests should prove:

- `auth.getUser()` is used for trusted identity
- `getSession()` is not used as the authorization source
- unauthenticated paths short-circuit correctly
- database/application work does not run when auth fails
- client-provided identity cannot override authenticated identity
- raw auth/runtime errors do not leak into client responses

Do not use real Supabase network calls in unit tests.

## Database tests

For repository/transaction/schema changes:

- apply real committed migration files when possible
- test constraints at the database layer
- test rollback behavior for atomic operations
- test persisted canonical state after failures
- avoid mocking SQL when the actual repository can be exercised under PGlite

If a concurrency property depends on multiple real connections, document the limitation instead of pretending a single-engine test proves it.

## Learning-engine tests

For learning behavior:

- inject explicit time
- test both positive and negative evidence
- test replay/rebuild consistency where relevant
- test state reversibility where relevant
- separate invariant tests from policy-calibration tests
- do not encode arbitrary calibration numbers as permanent invariants unless the product decision is actually frozen

## Regression tests

When a real bug is discovered:

- prefer adding a narrow regression test that would have failed before the fix
- make the test explain the behavioral contract
- avoid overly broad snapshots
- do not add redundant tests simply because a bug existed

The auth-before-DB DailyPlan route bug is an example:
a small wiring-order test is more valuable than another handler outcome test.

## Test counts

Test counts are useful only as local regression checkpoints.

Do not treat exact counts as product requirements.

When reporting counts:

- state total passing tests
- state how many were added when useful
- do not rewrite behavior merely to preserve a historical count

## Failure handling

Never ignore a failing test without understanding it.

When a test fails:

1. identify whether the failure is deterministic
2. identify the first failing assertion/setup point
3. determine whether the change caused it
4. distinguish:
   - production bug
   - test bug
   - environment issue
   - known flaky behavior
5. report uncertainty honestly

Do not automatically weaken assertions to make the suite green.

## Documentation claims

Only claim something is verified if the relevant test/environment actually verifies it.

Use wording such as:

- "unit-tested"
- "PGlite integration-tested"
- "reviewed by inspection"
- "not yet tested against real Supabase"
- "reasoned under PostgreSQL READ COMMITTED semantics"

Do not collapse these into a vague claim like "fully tested."

## Commit and push verification

A commit may be created after the requested verification passes.

A push is a stronger checkpoint.

Before push, normally verify:

- worktree state understood
- relevant local commits understood
- full required test suites pass
- no accidental/untracked artifact is being included
- `git diff --check` is clean
- branch/ahead status is understood

Do not push unless explicitly instructed.

## Git safety

Follow the repository-wide Git safety rules in `CLAUDE.md`.

If an unexpected file appears during testing, report it rather than assuming it is disposable or deleting it.
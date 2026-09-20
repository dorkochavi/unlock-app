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

This file defines testing policy.

It does NOT define:
- the current development task
- the current Run
- the current Slice
- product behavior
- the execution queue

Current work comes from `docs/CHATGPT_PLAN.md`.

---

## General Philosophy

Tests should protect accepted behavior and architecture, not merely mirror the current implementation.

Prefer tests that prove:

- externally meaningful behavior
- domain/application invariants
- trust boundaries
- transaction boundaries
- deterministic learning behavior
- persistence constraints
- important failure paths
- regressions discovered during real development

Avoid tests whose only purpose is increasing test count.

---

## Test Pyramid for This Repository

Use the narrowest useful test layer.

Prefer:

1. pure unit tests for deterministic domain/application logic
2. fake/injected-dependency tests for API/control-flow wiring
3. PGlite/Postgres-compatible integration tests for repositories, transactions, and migrations
4. real Supabase/browser verification only when behavior genuinely depends on the real environment

Do not use real network calls in ordinary unit tests.

Do not escalate to a more expensive test layer when a narrower layer proves the required contract.

---

## Development Loop

During implementation:

- run targeted tests first
- run typecheck when signatures/types change
- run lint after code stabilizes
- use the nearest meaningful regression/integration test for the area being changed

Do not run the entire repository suite after every tiny edit unless there is a specific reason.

Before a Slice is considered complete:

- targeted tests for changed behavior must pass
- `npm run typecheck` must pass when applicable
- `npm run lint` must pass
- `git diff --check` must pass
- the full unit suite should pass
- `npm run test:schema` must pass when the Slice is DB-relevant under the policy below

The current `CHATGPT_PLAN.md` may require additional verification for a specific Slice.

---

## Current Commands

Use the repository's existing scripts unless `package.json` changes.

Typical verification commands:

`npm run typecheck`

`npm run lint`

`npm test`

`npm run test:schema`

`git diff --check`

`git status`

Do not invent new scripts merely to avoid using an existing one.

---

## When to Run `npm run test:schema`

`npm run test:schema` is NOT a default checkpoint step.

Run it only when the current Slice changes or directly depends on:

- Supabase/PostgreSQL migrations
- database schema
- SQL queries
- PostgreSQL repositories
- database row mappers / serialization
- persistence constraints
- transaction behavior
- UnitOfWork behavior
- database-specific integration behavior

Do not run it when the only changes since the last successful relevant run are:

- documentation
- UI-only code
- styling
- unrelated client-side code
- workflow/config documentation
- other work that does not affect database behavior

If `test:schema` already passed earlier in the same Slice and no DB-relevant code changed afterward, do not run it again merely to close the Slice.

Report the existing result instead.

If a later edit changes DB-relevant behavior, the earlier result is no longer sufficient.

This policy avoids redundant six-minute schema runs without weakening database safety.

---

## Test Selection by Risk

### Domain / Learning Logic

Prefer:

- focused unit tests
- explicit time
- deterministic fixtures
- positive and negative evidence
- state-transition tests
- replay/rebuild tests where relevant

### Application Use Cases

Prefer:

- injected fake repositories
- ownership/authorization edge cases
- explicit failure outcomes
- idempotency behavior
- orchestration order where meaningful

### API Routes

Prefer:

- handler/use-case tests
- real route-wiring tests when wiring itself is security-relevant
- auth-before-database tests
- validation-before-persistence tests

### PostgreSQL / Persistence

Prefer:

- committed migrations
- real repository code
- PGlite integration
- constraint tests
- rollback tests
- canonical persisted-state checks

### Browser / Hosted Environment

Use only when the behavior cannot be meaningfully proven locally, or when the Plan explicitly requires real-environment verification.

---

## Determinism

Tests must avoid unnecessary dependence on:

- wall-clock timing
- machine timezone
- random execution order
- network availability
- external services

When time matters:

- inject an explicit `Date`
- use a fake clock where useful
- assert exact time propagation across boundaries

When randomness matters:

- inject deterministic values
- use fixed IDs when appropriate
- do not depend on UUID lexical ordering unless that ordering is part of the behavior under test

---

## Known Schema-Test Caveat

Canonical Attempt replay ordering has historically been sensitive when multiple rows receive identical ordering timestamps and ordering falls back to random UUID `id`.

If a test fails around canonical Attempt replay ordering:

- inspect whether `answered_at` and `created_at` tied
- do not immediately attribute the failure to unrelated work
- do not casually change production ordering semantics
- determine whether the test itself relies on an unstable timestamp distinction

This is a diagnostic clue, not permission to ignore the failure.

---

## PGlite Limitations

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
- production connection-pool behavior
- all `node-postgres` type-decoding behavior on every host timezone

State these distinctions honestly.

---

## Supabase-Managed Auth Schema Tests

A minimal test-only `auth.users` stand-in may exist so application migrations can run under PGlite.

Rules:

- keep the stand-in minimal
- label it explicitly as test-only
- do not imitate the entire Supabase Auth schema without a concrete need
- do not claim passing PGlite auth-schema tests prove hosted Supabase behavior
- real Auth behavior should be separately verified when the feature requires it

---

## Route Tests

For Next.js Route Handlers:

- keep route files thin
- extract testable control flow when useful
- prefer fake-only wiring tests over unnecessary real network/database tests
- explicitly test security-relevant ordering when ordering matters

Ordering worth protecting may include:

- authentication before database construction
- authorization before mutation
- validation before persistence
- transaction start before atomic writes

If real route wiring contains important behavior, handler tests alone are not sufficient.

---

## Auth Tests

Auth tests should protect relevant boundaries such as:

- `auth.getUser()` as trusted identity
- `getSession()` not being treated as authoritative authorization identity
- unauthenticated short-circuit behavior
- no database/application work when authentication fails
- client identity cannot override authenticated identity
- raw auth/runtime errors do not leak to clients

Do not use real Supabase network calls in ordinary unit tests.

---

## Database Tests

For repository/transaction/schema changes:

- apply real committed migration files when possible
- test constraints at the database layer
- test rollback behavior for atomic operations
- test persisted canonical state after failures
- avoid mocking SQL when the real repository can reasonably run under PGlite
- verify transaction-bound repositories share the intended connection when that is part of the contract

If a concurrency property depends on multiple real connections, document the limitation rather than pretending a single-engine test proves it.

---

## Learning Engine Tests

For learning behavior:

- inject explicit time
- test positive and negative evidence
- test replay/rebuild consistency where relevant
- test state reversibility where relevant
- separate invariants from calibration
- do not encode provisional calibration numbers as permanent invariants unless the product decision is actually frozen
- verify Manual Practice / Today separation where relevant
- preserve immutable Attempt semantics

---

## Regression Tests

When a real bug is discovered:

- prefer a narrow regression test that would have failed before the fix
- make the test express the behavioral contract
- avoid overly broad snapshots
- do not add redundant tests merely because a bug once existed

A regression test should make the failure hard to accidentally reintroduce.

---

## Test Counts

Test counts are local regression checkpoints.

They are not product requirements.

When reporting counts:

- state total passing tests
- state newly-added cases when useful
- do not alter behavior merely to preserve an old count

Canonical current counts belong in `docs/DEV_STATUS.md`, not in this rule file.

---

## Failure Handling

Never ignore a failing test without understanding it.

When a test fails:

1. identify whether the failure is deterministic
2. identify the first failing assertion/setup point
3. determine whether the current change caused it
4. distinguish:
   - production bug
   - test bug
   - environment/configuration issue
   - known flaky behavior
   - unclear failure requiring investigation
5. report uncertainty honestly

Do not weaken assertions merely to make the suite green.

If the failure is unrelated and non-blocking, report it rather than opportunistically expanding the Slice unless repository safety requires otherwise.

---

## Verification Claims

Only claim what the executed verification actually proves.

Use precise language such as:

- unit-tested
- route-wiring tested
- PGlite integration-tested
- reviewed by inspection
- reasoned under PostgreSQL semantics
- real PostgreSQL tested
- real Supabase tested
- browser E2E tested

Do not collapse these into vague phrases such as:

- fully tested
- production verified
- end-to-end verified

unless they are literally accurate.

---

## Checkpoint and Commit Verification

A focused Slice commit may be created only after the required verification and review for that Slice are complete.

Before committing, understand:

- intended changed files
- staged files
- unstaged files
- untracked files
- verification results
- reviewer findings
- whether any blocker remains

A push is a separate manual action.

Before the user pushes, the repository should normally have:

- understood worktree state
- understood local commits
- required suites passing
- no accidental generated/secrets/scratch artifacts staged
- clean `git diff --check`
- understood branch/ahead status

Claude must not push unless the repository rules explicitly change and the user explicitly instructs it.

---

## Git Safety

Follow repository-wide Git safety rules in `CLAUDE.md`.

If an unexpected file appears during testing:

- do not delete it
- do not stage it
- report it
- determine whether it belongs to the current Slice

Do not use destructive Git commands.
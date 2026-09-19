---
paths:
  - "src/infrastructure/postgres/**"
  - "supabase/migrations/**"
  - "supabase/tests/postgres/**"
  - "supabase/tests/schema.integration.test.ts"
---

# UNLOCK — PostgreSQL and Migration Rules

These rules apply whenever working on PostgreSQL runtime code, repositories, transactions, migrations, or schema integration tests.

## Repository boundaries

- Keep SQL persistence behind the existing repository interfaces.
- Do not move application logic into repository classes.
- Do not bypass repositories from API routes or UI code.
- Do not rewrite the persistence layer to Supabase JS unless explicitly requested.
- Prefer the existing `SqlExecutor` abstraction and transaction-bound repository construction.

## Transactions

- Multi-write application operations that must be atomic belong inside an explicit transaction.
- Transaction ownership belongs in the UnitOfWork / infrastructure boundary, not inside domain logic.
- Use one transaction-bound connection for all repositories participating in the same atomic operation.
- Do not silently mix transactional and non-transactional executors within the same atomic flow.
- On failure, rollback and rethrow the original error.
- A rollback failure must not replace or mask the original application error.

## PostgreSQL runtime

- Use the existing `pg.Pool` runtime foundation.
- Do not create a new Pool per request.
- `getPool()` is the runtime source for the shared lazy pool.
- `DATABASE_URL` is server-only.
- Do not hardcode insecure SSL behavior such as `rejectUnauthorized: false`.
- Environment-specific connection options belong in the connection string or explicitly approved configuration.
- Construct database runtime only after authentication when handling authenticated routes.

## Concurrency

- Do not claim concurrency behavior has been empirically proven unless it was actually tested with multiple real PostgreSQL connections.
- PGlite is useful for PostgreSQL-compatible integration tests but does not prove genuine multi-backend concurrency behavior.
- When correctness depends on PostgreSQL isolation semantics, document the assumed isolation level.
- Existing DailyPlan first-open race handling assumes normal PostgreSQL `READ COMMITTED` behavior.
- Do not silently change transaction isolation without reviewing concurrency implications.

## Migrations

- Migrations are forward-only.
- Never edit an already-accepted historical migration to implement a new change.
- Add a new timestamped migration.
- Preserve chronological migration ordering.
- Do not add destructive schema changes unless explicitly required and reviewed.
- Prefer additive migrations during V1 development.
- Do not silently backfill production data without evidence that a backfill is required.

## Supabase-managed schemas

- `auth` is managed by Supabase in a real Supabase project.
- Do not create the real `auth.users` table in production migrations.
- Test-only stand-ins for Supabase-managed schemas must remain clearly labeled as test infrastructure only.
- Do not treat the PGlite `auth.users` stand-in as a faithful Supabase Auth schema.
- Any behavior depending on real Supabase Auth must be verified later against a real Supabase project.

## SECURITY DEFINER functions

When creating a `SECURITY DEFINER` function:

- review search-path safety explicitly
- prefer an empty or tightly controlled `search_path`
- fully schema-qualify database object references
- avoid unnecessary dynamic SQL
- keep the function narrowly scoped
- document why elevated privileges are required
- verify trigger/function behavior separately from assumptions about the calling role

## Data integrity

- Prefer database constraints for invariants that must hold regardless of application code.
- Use composite foreign keys where cross-entity consistency matters.
- Preserve immutable historical evidence where the architecture requires it.
- Do not mutate Attempts as a shortcut.
- Do not silently weaken existing constraints to make a new feature easier.

## DailyPlan persistence

- One DailyPlan exists per `(user_id, planned_for_date)`.
- DailyPlanItem belongs to exactly one DailyPlan.
- Each persisted DailyPlanItem must retain its course/question/version identity.
- Resolved items must follow the existing state/timestamp consistency constraints.
- A DailyPlanItem resolves once.
- Do not re-open or overwrite completed/skipped items unless a future product decision explicitly changes this invariant.

## Test harness

- Schema tests should apply the real committed migration files in filename order.
- Do not test a paraphrased copy of migration SQL when the real migration file can be applied.
- Test-only schema setup may prepare external/Supabase-managed prerequisites before applying application migrations.
- Clearly distinguish:
  - what PGlite proves
  - what only real PostgreSQL proves
  - what only real Supabase proves
- Do not overstate test coverage.

## Verification

For PostgreSQL or migration changes, normally verify:

- TypeScript typecheck when TypeScript infrastructure changed
- lint
- targeted tests while developing
- full schema/Postgres suite before push/checkpoint
- `git diff --check`

Do not rely on a passing unit suite alone for schema changes.

## Git safety

Follow the repository-wide Git safety rules in `CLAUDE.md`.

Do not rewrite accepted or pushed migration history. New schema changes must use forward-only migrations.
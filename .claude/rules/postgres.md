---
paths:
  - "src/infrastructure/postgres/**"
  - "supabase/migrations/**"
  - "supabase/tests/postgres/**"
  - "supabase/tests/schema.integration.test.ts"
---

# UNLOCK — PostgreSQL and Migration Rules

These rules apply whenever working on:

- PostgreSQL runtime code
- SQL repositories
- UnitOfWork
- transactions
- migrations
- schema constraints
- PostgreSQL/PGlite integration tests

Current work comes from `docs/CHATGPT_PLAN.md`.

---

## Repository Boundaries

- Keep SQL persistence behind existing repository interfaces.
- Do not move application/product logic into repository classes.
- Do not bypass repositories from API routes or UI code.
- Do not rewrite the persistence layer to Supabase JS unless explicitly required by the current Plan.
- Prefer the existing `SqlExecutor` abstraction.
- Preserve transaction-bound repository construction where atomic behavior requires it.

---

## Transactions

- Multi-write operations that must be atomic belong inside an explicit transaction.
- Transaction ownership belongs in UnitOfWork / infrastructure, not domain logic.
- Use one transaction-bound connection for all repositories in the same atomic operation.
- Do not mix transactional and pool-level executors inside the same logical transaction.
- Commit only after successful callback completion.
- On failure, rollback and rethrow the original error.
- A rollback failure must not replace/mask the original application error.
- Always release acquired connections.

---

## PostgreSQL Runtime

- Use the existing `pg.Pool` runtime foundation.
- Do not create a new Pool per request.
- `getPool()` remains the shared lazy/memoized runtime source.
- `DATABASE_URL` is server-only.
- Do not hardcode insecure SSL behavior such as `rejectUnauthorized: false`.
- Environment-specific connection configuration requires explicit justification.
- For authenticated API routes, authentication should be resolved before constructing DB runtime when the route contract allows early rejection.

Do not conflate Pool object construction with an actual network connection.

---

## PostgreSQL Type Behavior

Be careful with PostgreSQL/driver representations such as:

- `DATE`
- timestamp types
- UUID
- JSON/JSONB
- numeric types
- nullable columns

PGlite and real `node-postgres` behavior may not be identical in every serialization/decoding edge case.

Do not rely on accidental machine-timezone behavior.

---

## Concurrency

- Do not claim concurrency behavior is empirically proven unless it was tested with appropriate real PostgreSQL connections.
- PGlite does not prove genuine multi-backend concurrency.
- Document assumed PostgreSQL isolation level when correctness depends on it.
- Existing DailyPlan first-open race reasoning assumes normal PostgreSQL `READ COMMITTED` behavior unless explicitly changed.
- Do not silently change transaction isolation.
- Distinguish constraint-backed race safety from timing-based assumptions.

---

## Migrations

- Migrations are forward-only.
- Never edit an accepted historical migration to implement a new change.
- Add a new timestamped migration.
- Preserve chronological ordering.
- Prefer additive V1 migrations.
- Do not introduce destructive schema changes unless the current Slice explicitly requires and reviews them.
- Do not silently backfill hosted/production data.
- Do not invent defaults merely to make a migration pass.

When changing populated tables, consider:

- existing-row validity
- lock implications
- backfill requirements
- nullability transitions
- foreign-key compatibility
- cascade/delete behavior

---

## Supabase-Managed Schemas

- `auth` is managed by Supabase in hosted projects.
- Do not recreate real `auth.users` in production application migrations.
- Test-only managed-schema stand-ins must remain clearly test infrastructure.
- Do not treat the PGlite `auth.users` stand-in as full Supabase Auth.
- Behavior depending on real Auth must be separately verified when required.

---

## SECURITY DEFINER Functions

When creating/reviewing SECURITY DEFINER:

- inspect search-path safety
- prefer empty/tightly controlled `search_path`
- schema-qualify object references
- avoid unnecessary dynamic SQL
- keep responsibility narrow
- understand privilege/RLS implications
- verify function/trigger behavior separately from role assumptions

---

## Data Integrity

- Prefer database constraints for invariants that must hold regardless of application path.
- Use composite foreign keys where cross-entity identity consistency matters.
- Preserve immutable historical evidence.
- Never mutate Attempts as a shortcut.
- Do not weaken constraints merely to simplify a feature.
- Keep ranking/calibration policy outside schema constraints.

---

## DailyPlan Persistence

Accepted persistence invariants include:

- one DailyPlan per `(user_id, planned_for_date)`
- each DailyPlanItem belongs to one DailyPlan
- each item retains Course / Question / QuestionVersion identity
- item state and timestamps remain consistent
- resolved items do not silently reopen
- DailyPlanItem resolves once
- Skip remains distinct from completion
- DailyPlan answer linkage must not conflict with mutually exclusive legacy TodaySession linkage where the schema enforces that distinction
- immutable Attempt evidence survives mutable planning lifecycle according to current accepted constraints

Do not redefine DailyPlan product semantics in a migration.

---

## New Material Persistence

When ADR-017/New Material persistence is involved:

- allow only accepted reason/action vocabulary
- unseen planning must not fabricate learner progress
- persistence must not imply mastery/evidence merely because an item was planned
- ordinary persisted constraints must still apply to Course/Question/QuestionVersion identity

---

## Test Harness

Schema/Postgres tests should:

- apply real committed migration files in filename order
- exercise real repository SQL where practical
- exercise actual constraints
- test rollback when atomic behavior matters

Do not test paraphrased migration SQL when the real migration can be applied.

Test-only setup may prepare external/Supabase-managed prerequisites before application migrations.

Always distinguish:

- what unit tests prove
- what PGlite proves
- what real PostgreSQL proves
- what real Supabase proves

Do not overstate verification.

---

## Verification

During a DB-relevant Slice:

- run focused persistence/schema tests while developing
- run TypeScript typecheck when relevant TypeScript changed
- run lint
- run `git diff --check`

Run the full:

`npm run test:schema`

when the Slice changes or directly depends on DB/schema/SQL/repository/transaction behavior.

If `npm run test:schema` already passed earlier in the same Slice and no DB-relevant code changed afterward:

- do not rerun it merely for ceremony
- report the existing result

Documentation-only, UI-only, or unrelated client changes do not require `test:schema`.

Full testing policy lives in:

`.claude/rules/testing.md`

A unit suite alone is not sufficient verification for a DB-relevant Slice.

---

## Scope Discipline

Database work must not silently change:

- mastery policy
- misconception policy
- NBA ranking/calibration
- CourseMembership semantics
- Today composition
- New Material product rules

If persistence requirements expose an unresolved product/architecture decision:

report `PLAN_CONFLICT`.

Do not invent the answer in SQL.

---

## Git Safety

Follow repository-wide Git safety rules in `CLAUDE.md`.

Do not rewrite accepted or pushed migration history.

New schema behavior must evolve through new forward-only migrations.
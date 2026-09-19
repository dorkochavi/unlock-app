# UNLOCK — Supabase local project

Status: database-foundation + Postgres infrastructure phase (see ADR-013,
ADR-014). Postgres repository adapters, `PostgresUnitOfWork`, the
advisory-lock transaction, and `submitAnswer`/answer-correctness are all
implemented and integration-tested against a real Postgres engine
(`src/infrastructure/postgres/`, `supabase/tests/postgres/`), including a
real `pg.Pool`-backed `ConnectionProvider`
(`src/infrastructure/postgres/pg-{connection-provider,pool}.ts`).

Supabase Auth CLIENT construction (`src/infrastructure/supabase/`) and the
`auth.users -> public.users` provisioning trigger
(`migrations/20260923000000_auth_user_provisioning.sql`) now exist too —
**this is client/migration code only, not a working Auth flow**: no real
Supabase project has been configured against any environment, no
login/signup UI exists, and no API route calls any of it yet. See
`docs/API_V1_DRAFT.md` for the prepared (not implemented) route shape.

## What's here

- `config.toml` — **hand-authored**, not `supabase init`-generated. The
  Supabase CLI and Docker are not available in the environment this was
  written in (re-checked as of this writing — still true), so it could not
  be produced or verified by the CLI itself. It follows the CLI's
  documented `config.toml` shape as of this writing. `db.major_version = 15`
  is load-bearing, not arbitrary — see the file's own header comment.
- `migrations/` — applied in filename (timestamp) order (updated here to
  match what is actually committed; this list previously went stale after
  new migrations were added without updating this file):
  - `20260917203000_initial_schema.sql` — the first real migration,
    translating `docs/PERSISTENCE_SCHEMA_V1.md` into plain PostgreSQL DDL.
    `users`, `courses`, `materials`, `questions`, `question_versions`,
    `attempts`, `user_question_progress`, `today_sessions`,
    `today_session_items`, their composite foreign keys, check
    constraints, indexes, and RLS-enabled-with-zero-policies on every
    table.
  - `20260918000000_question_answer_model_v1.sql` — ADR-014's
    `question_versions.question_type` column (forward-only; does not edit
    the first migration, which is already committed/pushed).
  - `20260919000000_course_membership_v1.sql` — ADR-015's `courses
    .join_policy` column and the `course_memberships` table (the single
    User<->Course relationship: `role`, `joined_at`, `revoked_at`,
    `archived_at`), RLS-enabled with zero policies.
  - `20260920000000_user_timezone_v1.sql` — `users.timezone`, nullable,
    no default (`docs/OPEN_QUESTIONS.md` #35).
  - `20260921000000_daily_plan_v1.sql` — DailyPlan/DailyPlanItem
    persistence (ADR-016).
  - `20260922000000_daily_plan_item_state_consistency.sql` — DailyPlanItem
    state/timestamp consistency constraints (ADR-016 §19).
  - `20260923000000_auth_user_provisioning.sql` — the `auth.users ->
    public.users` `SECURITY DEFINER` provisioning trigger.

  Both test harnesses (`tests/schema.integration.test.ts` and
  `tests/postgres/db-harness.ts`) apply every `.sql` file in this directory
  dynamically, by filename order — they were not hardcoded to only the
  first two migrations, so this staleness was in this README's prose only,
  not in what was actually tested.
- `tests/schema.integration.test.ts` — runs BOTH migrations above, in
  order, against a real (WASM, in-process) PostgreSQL engine via
  `@electric-sql/pglite` and proves the database itself rejects the
  invalid rows/operations the schema is supposed to make impossible, and
  accepts a representative valid row chain.
- `tests/postgres/` — integration tests for the real Postgres
  infrastructure layer (`src/infrastructure/postgres/`): every repository,
  `PostgresUnitOfWork`/the advisory lock, and `submitAnswer` wired
  end-to-end, including real SINGLE_CHOICE/MULTIPLE_CHOICE answer
  correctness (ADR-014).
- Both test directories run via `npm run test:schema` — deliberately NOT
  part of the main `npm test` suite (see `vitest.config.mts` in this
  directory: real per-test PGlite engines are materially heavier than the
  unit suite, and `fileParallelism: false` is load-bearing there too — see
  that file's own comment).

## What was verified, and how

- Both migrations, applied in order, succeed with zero errors against a
  real PostgreSQL engine (`pglite`) — proving the full migration chain
  applies cleanly from an empty database, not just each file in isolation
  (a real gap found and fixed during this session: the test harnesses
  originally hardcoded only the first migration's filename).
- The full real-Postgres integration suite (schema + infrastructure)
  passes — see `npm run test:schema`'s own output for exact counts; the
  test files themselves (`supabase/tests/schema.integration.test.ts`,
  `supabase/tests/postgres/*.test.ts`) are the per-area detail.
- RLS is confirmed ENABLED (via `pg_class.relrowsecurity`) on every table —
  actual allow/deny behavior under a simulated `anon`/`authenticated` role
  was NOT tested, since that requires Supabase's own Auth/role-switching
  machinery, which stock `pglite` does not provide.
- Advisory-lock SQL (`pg_advisory_xact_lock`/`hashtextextended`) is proven
  valid and executable — actual concurrent-blocking behavior is NOT
  provable under PGlite (single in-process engine, no second concurrent
  backend) — see `src/infrastructure/postgres/postgres-unit-of-work.ts`'s
  own doc comment.
- The `auth.users -> public.users` provisioning trigger's own SQL/logic is
  proven correct — against a MINIMAL, explicitly-labeled stand-in
  `auth.users` table (one column, `id uuid primary key`), NOT Supabase's
  real `auth` schema, which stock `pglite` has no representation of at all
  (verified directly: `pg_namespace` has zero rows for `nspname = 'auth'`
  on a fresh PGlite instance). The stand-in is created by
  `tests/postgres/db-harness.ts`'s own `createTestDb()`, before every real
  migration file (including this one) is applied — every test using
  `createTestDb()` needed this, not only the trigger's own test, since the
  migration chain itself would otherwise fail to apply at all once this
  migration existed. See `tests/auth-user-provisioning
  .integration.test.ts`'s own doc comment for the exact scope of what this
  does and does not prove.

## What was NOT verified, and remains for the next checkpoint

- The Supabase CLI itself was never run (`supabase init`, `supabase start`,
  `supabase db push`, `supabase migration up`) — re-checked this session,
  neither the CLI nor Docker is available in this environment.
  `config.toml` should be diffed against a real `supabase init` output once
  the CLI is installed, and `supabase start` (requires Docker) should be
  run to confirm the CLI actually applies both migrations the same way
  `pglite` did.
- No connection to any real Supabase project (local or remote) has been
  made. No credentials were requested or used.
- RLS policy behavior (as opposed to "RLS is enabled") — requires the real
  authorization model (`docs/OPEN_QUESTIONS.md` #1) to be decided first.
- Real multi-connection advisory-lock concurrency (see above).
- The provisioning trigger against Supabase's REAL `auth.users` table —
  only a minimal stand-in was testable (see above); this requires a real
  Supabase project.
- Any existing `auth.users` row backfill — not written; no evidence of
  pre-existing production data exists in this repo (see the migration's
  own header comment).
- API routes, login/signup UI, and `middleware.ts` session refresh — none
  exist yet; see `docs/API_V1_DRAFT.md` for the prepared route shape.

## Running this locally once the CLI is available

1. Install the Supabase CLI (platform-native installer per Supabase's own
   docs — not as an npm dependency of this project).
2. From the repo root: `supabase start` (requires Docker) to spin up local
   Postgres/Studio/Auth and apply `migrations/` automatically.
3. `supabase db diff` / `supabase migration list` to confirm the local DB
   matches what's committed here.
4. `npm run test:schema` continues to work independently of the CLI (it
   never talks to the CLI or Docker) and is a fast way to re-verify the
   migration's constraint behavior without either.

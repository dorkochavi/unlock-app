# UNLOCK — Supabase local project

Status: database-foundation phase only (see ADR-013,
`docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`). No
Postgres adapters, UnitOfWork, API routes, or Auth wiring exist yet — those
are the next checkpoint.

## What's here

- `config.toml` — **hand-authored**, not `supabase init`-generated. The
  Supabase CLI, Docker, and `psql` are not available in the environment this
  was written in, so it could not be produced or verified by the CLI
  itself. It follows the CLI's documented `config.toml` shape as of this
  writing. `db.major_version = 15` is load-bearing, not arbitrary — see the
  file's own header comment.
- `migrations/20260917203000_initial_schema.sql` — the first real
  migration, translating `docs/PERSISTENCE_SCHEMA_V1.md` into plain
  PostgreSQL DDL. Implements `users`, `courses`, `materials`, `questions`,
  `question_versions`, `attempts`, `user_question_progress`,
  `today_sessions`, `today_session_items`, their composite foreign keys,
  check constraints, indexes, and RLS-enabled-with-zero-policies on every
  table. Read its own header comment for the style choices made throughout.
- `tests/schema.integration.test.ts` — runs the migration above against a
  real (WASM, in-process) PostgreSQL engine via `@electric-sql/pglite` and
  proves the database itself rejects the invalid rows/operations the
  migration is supposed to make impossible (duplicate idempotency keys,
  cross-entity consistency violations, ownership violations, the
  evidence-counter-sum check, destructive parent deletion) and accepts a
  representative valid row chain. Run via `npm run test:schema` — this is
  deliberately NOT part of the main `npm test` suite (see
  `vitest.config.mts` in this directory).

## What was verified, and how

- The migration was applied to a real PostgreSQL engine (`pglite`, PG18
  build) and succeeded with zero errors.
- 14 schema-verification tests pass against that same real engine —
  including a test that specifically proves the composite
  `ON DELETE SET NULL (today_session_item_id)` fix (see the migration's own
  comment on the `attempts` table) actually works: deleting a
  `today_session_items` row an Attempt references nulls only the pointer,
  never the Attempt's `user_id` or the Attempt itself.
- RLS is confirmed ENABLED (via `pg_class.relrowsecurity`) on every table —
  actual allow/deny behavior under a simulated `anon`/`authenticated` role
  was NOT tested, since that requires Supabase's own Auth/role-switching
  machinery, which stock `pglite` does not provide.

## What was NOT verified, and remains for the next checkpoint

- The Supabase CLI itself was never run (`supabase init`, `supabase start`,
  `supabase db push`, `supabase migration up`) — `config.toml` should be
  diffed against a real `supabase init` output once the CLI is installed,
  and `supabase start` (requires Docker) should be run to confirm the CLI
  actually applies this migration the same way `pglite` did.
- No connection to any real Supabase project (local or remote) has been
  made. No credentials were requested or used.
- RLS policy behavior (as opposed to "RLS is enabled") — requires the real
  authorization model (`docs/OPEN_QUESTIONS.md` #1) to be decided first.
- Postgres repository adapters, `UnitOfWork`, the advisory-lock transaction
  implementation, `submitAnswer` infrastructure, API routes, and Supabase
  Auth wiring — explicitly out of scope for this checkpoint (see ADR-013 and
  the migration file's own header).

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

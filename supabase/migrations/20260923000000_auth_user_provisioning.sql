-- UNLOCK Auth User Provisioning — links Supabase Auth to public.users.
--
-- Forward-only migration. Does NOT edit any earlier migration.
--
-- Implements ONLY automatic row provisioning: a SECURITY DEFINER trigger
-- function on auth.users that inserts a matching public.users row (same
-- id) whenever a new Supabase Auth user is created.
--
-- Why this is needed (see this repo's own
-- 20260917203000_initial_schema.sql, `users` table comment): `users.id`
-- has no default and no FK to `auth.users` was added, deliberately,
-- because "Auth is explicitly deferred, and this migration must not
-- silently lock in an authorization model that hasn't been decided." Auth
-- is now being wired (this migration) — this closes the one concrete gap
-- that was blocking every authenticated request: nothing previously
-- created a public.users row for a real Supabase Auth sign-up, so every
-- FK-dependent table (course_memberships, daily_plans, ...) and every
-- repository assuming a users row already exists (e.g.
-- PostgresUserRepository.setTimezone, a plain UPDATE, not an upsert)
-- would have found none.
--
-- Explicitly OUT OF SCOPE for this migration:
--   - A `public.users` -> `auth.users` foreign key. Not added: not
--     strictly required for provisioning to work (the trigger alone is
--     sufficient), and a cross-schema FK into Supabase-managed `auth.*`
--     is a bigger, more permanent commitment than this slice's stated
--     goal ("automatic row provisioning") calls for. Revisit once Auth is
--     actually exercised against a real project.
--   - A backfill for any PRE-EXISTING `auth.users` row. This project has
--     never connected to a real Supabase project (local or remote) — see
--     supabase/README.md's own "What was NOT verified" section — so
--     there is no evidence of existing production `auth.users` data to
--     backfill. If a real project is later provisioned and it already
--     has users before this migration is applied, an explicit forward
--     backfill migration (e.g. `insert into public.users (id) select id
--     from auth.users where id not in (select id from public.users)`)
--     would be needed separately — not invented here.
--   - Extra profile fields (name, avatar, etc.) — `public.users` stays
--     identity-only, exactly as the initial migration's own comment
--     describes it.
--   - A `timezone` default — `users.timezone` stays NULL for a
--     newly-provisioned row, exactly matching
--     20260920000000_user_timezone_v1.sql's own "NULL means not yet
--     detected/persisted" contract; this migration must not quietly
--     invent a default the application layer already treats as
--     meaningful.
--   - RLS policies — out of scope, docs/OPEN_QUESTIONS.md #1 remains
--     unresolved.
--
-- SECURITY DEFINER pattern, current Supabase-recommended shape:
--   - the function lives in `public` (not `auth`) — this migration never
--     creates or modifies anything under Supabase's own managed `auth`
--     schema, only reads from `auth.users` via the trigger it attaches;
--   - `set search_path = ''` (empty) — the current hardened
--     recommendation against search_path-based privilege escalation in a
--     SECURITY DEFINER function; every reference inside the function body
--     is therefore fully schema-qualified (`public.users`), never bare;
--   - `on conflict (id) do nothing` makes the insert idempotent/safe
--     against the (normally unreachable) case of a public.users row
--     already existing for this id.
--
-- Testability, stated honestly: PGlite (this repo's real-Postgres test
-- engine) starts completely bare — it has no `auth` schema and no
-- `auth.users` table at all, since Supabase's real `auth` schema is
-- provisioned by Supabase's own infrastructure, not by anything in this
-- `migrations/` directory. This migration therefore cannot be
-- schema-tested against a genuine `auth.users` table in this repo's
-- current harness — see `supabase/tests/auth-user-provisioning
-- .integration.test.ts`'s own doc comment for the strongest test
-- available given that constraint, and exactly what it does and does not
-- prove.

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_auth_user() is
  'SECURITY DEFINER trigger function: provisions a matching public.users '
  'row (same id, identity-only) whenever a new row is inserted into '
  'auth.users. search_path is deliberately empty; every reference is '
  'fully schema-qualified. Handles FUTURE Supabase Auth sign-ups only — '
  'see this migration file''s own header comment for why no backfill of '
  'pre-existing auth.users rows is included.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

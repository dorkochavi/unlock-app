-- UNLOCK — Pilot Clean Slate Reset: READ-ONLY dry-run inventory.
-- Run 2026-10-10-PILOT-CLEAN-SLATE-RESET-001. Runbook: docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md.
-- SELECT-ONLY. Mutates nothing. Run by a HUMAN (Supabase SQL editor, or psql with a read-only session):
--   begin read only;  <paste ONE query at a time>;  rollback;
-- The preserved account id is NEVER stored in the repo. Replace PASTE-PRESERVED-AUTH-USER-UUID below,
-- in the queries that use it, with the id you identified via `-- @query auth_candidates`.
-- Output is counts only (plus, for auth_candidates, masked email) — no answer text, no full emails.
-- Sections are separated by "-- @query <name>" markers (the schema test splits on them).
-- `auth_*` / `storage_inventory` need the real Supabase schemas and are NOT exercised by the PGlite test.

-- @query public_inventory
-- Rows per application table (the complete public schema as of migration 20260929020000).
select t.entity, t.row_count::int as row_count
from (
  select 'users' as entity, count(*) as row_count from users
  union all select 'courses', count(*) from courses
  union all select 'materials', count(*) from materials
  union all select 'topics', count(*) from topics
  union all select 'questions', count(*) from questions
  union all select 'question_versions', count(*) from question_versions
  union all select 'course_authors', count(*) from course_authors
  union all select 'course_memberships', count(*) from course_memberships
  union all select 'daily_plans', count(*) from daily_plans
  union all select 'daily_plan_items', count(*) from daily_plan_items
  union all select 'attempts', count(*) from attempts
  union all select 'user_question_progress', count(*) from user_question_progress
) t
order by t.entity;

-- @query public_unknown_tables
-- Schema-drift guard: any public base table NOT covered by public_inventory. Expect ZERO rows.
-- Any row returned means the reset plan is stale => reset BLOCKED until the runbook is updated.
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name not in (
    'users', 'courses', 'materials', 'topics', 'questions', 'question_versions', 'course_authors',
    'course_memberships', 'daily_plans', 'daily_plan_items', 'attempts', 'user_question_progress'
  )
order by table_name;

-- @query preserved_account_footprint
-- What the preserved account owns/holds. ALL of it is still DELETED by the reset except the public.users row.
-- Replace the placeholder uuid. A placeholder or unknown id yields preserved_in_public_users = 0 => STOP.
with p as (select 'PASTE-PRESERVED-AUTH-USER-UUID'::uuid as id)
select
  (select count(*) from users u, p where u.id = p.id)::int as preserved_in_public_users,
  (select count(*) from courses c, p where c.owner_user_id = p.id)::int as courses_owned,
  (select count(*) from course_authors a, p where a.user_id = p.id)::int as course_author_grants,
  (select count(*) from course_authors a, p where a.user_id = p.id and a.revoked_at is null)::int as active_course_author_grants,
  (select count(*) from course_memberships m, p where m.user_id = p.id)::int as memberships,
  (select count(*) from materials m, p where m.created_by = p.id)::int as materials_created,
  (select count(*) from daily_plans d, p where d.user_id = p.id)::int as daily_plans,
  (select count(*) from attempts a, p where a.user_id = p.id)::int as attempts,
  (select count(*) from user_question_progress g, p where g.user_id = p.id)::int as progress_rows;

-- @query reset_expectation
-- Before/after expectation: after the reset every table except users is 0 and users = 1.
-- delete_candidates_users = public.users rows that are NOT the preserved account.
with p as (select 'PASTE-PRESERVED-AUTH-USER-UUID'::uuid as id)
select
  (select count(*) from users)::int as users_now,
  (select count(*) from users u, p where u.id <> p.id)::int as delete_candidates_users,
  (select count(*) from users u, p where u.id = p.id)::int as users_remaining_expected,
  ((select count(*) from courses) + (select count(*) from materials) + (select count(*) from topics)
   + (select count(*) from questions) + (select count(*) from question_versions)
   + (select count(*) from course_authors) + (select count(*) from course_memberships)
   + (select count(*) from daily_plans) + (select count(*) from daily_plan_items)
   + (select count(*) from attempts) + (select count(*) from user_question_progress))::int as non_user_rows_to_delete;

-- @query orphan_checks
-- Application-side leftovers/inconsistencies. Expect all 0. (Auth/profile divergence: see auth_divergence.)
select
  (select count(*) from questions q where q.current_version_id is not null
     and not exists (select 1 from question_versions v where v.id = q.current_version_id and v.question_id = q.id))::int as questions_bad_current_version,
  (select count(*) from questions q where not exists (select 1 from courses c where c.id = q.course_id))::int as questions_without_course,
  (select count(*) from attempts a where not exists (select 1 from users u where u.id = a.user_id))::int as attempts_without_user;

-- @query auth_candidates
-- HUMAN identification aid (needs real auth schema). Lists Auth users with MASKED email so the human can pick
-- the ONE to preserve. Compare id / last sign-in with what you know about your own account.
select
  id,
  regexp_replace(coalesce(email, ''), '^(.).*(@.*)$', '\1***\2') as masked_email,
  created_at::date as created_on,
  last_sign_in_at::date as last_sign_in_on,
  exists (select 1 from public.course_authors a where a.user_id = auth.users.id and a.revoked_at is null) as has_active_author_grant
from auth.users
order by last_sign_in_at desc nulls last;

-- @query preserved_auth_identity
-- REQUIRED before reset (needs real auth schema). Must return exactly 1 row for the preserved id; 0 rows => STOP
-- (wrong id, or a public-only orphan). Shows the masked email so the human can confirm identity.
select id, regexp_replace(coalesce(email, ''), '^(.).*(@.*)$', '\1***\2') as masked_email,
  last_sign_in_at::date as last_sign_in_on
from auth.users
where id = 'PASTE-PRESERVED-AUTH-USER-UUID'::uuid;

-- @query auth_inventory
-- Auth-side counts (needs real auth schema). auth.users deletion cascades to identities/sessions/refresh_tokens/mfa
-- inside GoTrue; public.users has NO FK to auth.users, so it does NOT cascade (see auth_divergence).
select
  (select count(*) from auth.users)::int as auth_users,
  (select count(*) from auth.identities)::int as auth_identities,
  (select count(*) from auth.sessions)::int as auth_sessions,
  (select count(*) from public.users)::int as public_users;

-- @query auth_divergence
-- Auth/profile divergence (needs real auth schema). Understand both numbers BEFORE reset.
select
  (select count(*) from public.users u where not exists (select 1 from auth.users a where a.id = u.id))::int as public_users_without_auth,
  (select count(*) from auth.users a where not exists (select 1 from public.users u where u.id = a.id))::int as auth_users_without_public;

-- @query storage_inventory
-- Storage leftovers (needs real storage schema). The app has no Storage usage in src/ (audit 2026-10-10);
-- this confirms hosted state. Expect no rows; any objects => decide separately (not covered by SQL cleanup).
select bucket_id, count(*)::int as objects from storage.objects group by bucket_id order by bucket_id;

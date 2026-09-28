-- UNLOCK Course Author Model V1 — RUN010-H.1 (FUB-036, Option 4 architecture).
--
-- Forward-only migration. Phase A of the approved 3-phase migration toward
-- `course_memberships` eventually becoming learner-participation-only
-- (`scratch/development_checkpoint.md`'s RUN010-H.1/H.2/H.3 plan, human
-- decisions approved 2026-09-29):
--   - H.1 (this migration): create `course_authors`, backfill-copy existing
--     OWNER/INSTRUCTOR `course_memberships` rows into it. Zero application
--     code reads or writes this table yet.
--   - H.2 (a later Slice): repoint every `canAuthorCourse`/`isManagementRole`
--     application call site (and `createCourse`) at `course_authors` instead
--     of `course_memberships`, plus the required DTO/API surface changes.
--   - H.3 (a later Slice, gated on an explicit human go-ahead after H.2 is
--     fully verified and reviewed): DELETE the now-legacy OWNER/INSTRUCTOR
--     `course_memberships` rows this migration's backfill copies below —
--     NOT done here. Every existing `course_memberships` row and column is
--     untouched by this migration; `course_memberships` still has its own
--     OWNER/INSTRUCTOR rows, unchanged, after this migration runs.
--
-- Explicitly OUT OF SCOPE (H.2/H.3's job, not this migration's):
--   - Any application authorization call site
--     (`canAuthorCourse`/`isManagementRole` and their ~18 callers).
--   - `create-course.ts`, `join-course.ts`, any DTO/API route.
--   - Deleting/modifying any `course_memberships` row or column.
--   - The approved author self-enrollment bypass and `revokeCourseAuthor`
--     last-author-protection product decisions (both H.3's job).

-- ============================================================================
-- course_authors
--
-- A management-capability grant, deliberately modeled separately from
-- `course_memberships` (which this Run's approved architecture will
-- eventually narrow to learner participation only — see the phased plan
-- above). One row per (user, course, capability) grant, not one row per
-- (user, course) pair.
-- ============================================================================

create table course_authors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  course_id uuid not null references courses (id) on delete restrict,
  capability text not null check (capability in ('OWNER', 'INSTRUCTOR')),
  granted_at timestamptz not null default now(),
  -- null = currently holds this capability. non-null = this specific
  -- capability grant was revoked. Never deletes the row (the same
  -- never-delete discipline course_membership_v1.sql's own revoked_at
  -- comment already documents for course_memberships, applied here too).
  -- The approved last-author-protection rule (revokeCourseAuthor must fail
  -- closed rather than leave a non-deleted Course with zero active
  -- course_authors rows) is an application-layer concern for a later Slice
  -- (H.3) — no constraint here enforces it, matching this schema's existing
  -- division between physical integrity (DB) and authorization/product
  -- policy (application).
  revoked_at timestamptz,
  created_at timestamptz not null default now(),

  -- Deliberately `unique (user_id, course_id, capability)`, NOT
  -- `unique (user_id, course_id)`: forward-compatible with a user someday
  -- holding BOTH OWNER and INSTRUCTOR capability on the same Course as two
  -- separate rows, even though no V1 code path ever creates that
  -- combination today (this migration's own backfill below copies at most
  -- one row per (user, course) pair, since course_memberships.role was
  -- itself a single scalar value). A 2-column unique constraint could not
  -- distinguish "revoke this one capability" from "revoke every capability
  -- this user holds on this Course" once a user ever holds more than one.
  unique (user_id, course_id, capability)
);

comment on table course_authors is
  'RUN010-H.1 (FUB-036, Option 4 architecture, human decisions approved '
  '2026-09-29). A management-capability grant, kept separate from '
  'course_memberships (learner participation). Phase A of a 3-phase '
  'migration (see this file''s header comment) toward course_memberships '
  'eventually becoming learner-participation-only. This migration backfills '
  'existing OWNER/INSTRUCTOR course_memberships rows into this table but '
  'does NOT remove them from course_memberships — a later Slice (H.3) does '
  'that, only after H.2''s application-layer cutover is implemented, '
  'verified, reviewed, AND an explicit human go-ahead is given for that '
  'specific destructive step.';

comment on column course_authors.capability is
  'OWNER or INSTRUCTOR — the same two management-capability values '
  'course_memberships.role already distinguishes (see '
  'course_membership_v1.sql''s own role comment). LEARNER has no equivalent '
  'here: this table only ever models management capability, never learning '
  'participation.';

comment on column course_authors.revoked_at is
  'null = currently holds this capability; non-null = revoked (row is kept, '
  'never deleted). Unlike course_memberships, there is deliberately no '
  'archived_at column on this table: archival is a per-learner "excluded '
  'from automatic Today" concept (see course_membership_v1.sql''s own '
  'archived_at comment) that has no equivalent meaning for a management '
  'capability grant — an author''s capability is either currently held or '
  'revoked, with no third "archived but still accessible" state.';

-- Same two-index convention course_membership_v1.sql already established:
-- one for "find this user's own grants," one for "list authors for a
-- Course" (a future co-author-management UI; explicitly out of this Run's
-- scope per FUB-036's own recorded deferral).
create index course_authors_user_id_idx on course_authors (user_id);
create index course_authors_course_id_idx on course_authors (course_id);

alter table course_authors enable row level security;

-- ============================================================================
-- Backfill: copy existing OWNER/INSTRUCTOR course_memberships rows into
-- course_authors as part of this same additive migration. LEARNER rows are
-- never copied — only rows whose role is a management role become a
-- course_authors grant. A revoked OWNER/INSTRUCTOR course_memberships row
-- backfills with its revoked_at preserved (not silently reactivated).
-- course_memberships itself is NOT modified by this statement (no UPDATE or
-- DELETE against it anywhere in this migration) — H.3 removes the now-legacy
-- rows later, not this migration.
-- ============================================================================

insert into course_authors (user_id, course_id, capability, granted_at, revoked_at)
select user_id, course_id, role, joined_at, revoked_at
from course_memberships
where role in ('OWNER', 'INSTRUCTOR');

-- UNLOCK Course Membership / Join Authorization Model V1 — ADR-015.
--
-- Forward-only migration. Does NOT edit 20260917203000_initial_schema.sql or
-- 20260918000000_question_answer_model_v1.sql (already committed) — see
-- ADR-015 and docs/PERSISTENCE_SCHEMA_V1.md for the product/architecture
-- decision this migration implements.
--
-- Implements ONLY what ADR-015 already decided:
--   - `courses.join_policy`: AUTHORIZED_ONLY (default) | OPEN.
--   - `course_memberships`: the single explicit User<->Course relationship
--     (userId, courseId, role, joinedAt, revokedAt, archivedAt).
--
-- Explicitly OUT OF SCOPE (not decided by ADR-015, not added here):
--   - The exact AUTHORIZED_ONLY authorization source (ADR-015 §5).
--   - Institution/InstitutionMembership/enrollment tables (ADR-006/§10).
--   - Whether `courses.owner_user_id` is retired in favor of a `role =
--     OWNER` membership row — kept as-is, unaffected, per ADR-015 §1.
--   - Real RLS policy text — RLS is enabled with zero policies, matching
--     every other V1 table (see initial migration's own RLS section).
--   - Supabase Auth wiring, API routes.

-- ============================================================================
-- courses.join_policy
-- ============================================================================

-- Added directly as NOT NULL DEFAULT 'AUTHORIZED_ONLY' (unlike
-- question_versions.question_type in the prior migration, which was added
-- nullable-then-backfilled-then-locked): there is no pre-existing data this
-- column could silently need a placeholder value for care about — every
-- existing `courses` row correctly becomes AUTHORIZED_ONLY (ADR-015 §3's
-- deny-by-default posture), and every future row also gets that same safe
-- default unless a management action explicitly opens the Course. Unlike
-- `question_type`, leaving a real, permanent default here is the intended
-- behavior, not an artifact to clean up afterward.
alter table courses
  add column join_policy text not null default 'AUTHORIZED_ONLY'
    check (join_policy in ('AUTHORIZED_ONLY', 'OPEN'));

comment on column courses.join_policy is
  'ADR-015 §3. AUTHORIZED_ONLY (default, deny-by-default per ADR-013''s '
  'posture) or OPEN. Only a management CourseMembership (role OWNER or '
  'INSTRUCTOR, non-revoked) on this specific Course may change it — '
  'enforced at the application layer (src/application/course/), not by a '
  'DB constraint, matching this schema''s existing division between '
  'physical integrity (DB) and authorization policy (application).';

-- ============================================================================
-- course_memberships
--
-- The single explicit User<->Course relationship — ADR-015 §1. There is no
-- other path to Course access. UNIQUE (user_id, course_id) is both the
-- physical "at most one membership per user per Course" invariant AND what
-- makes join idempotent by construction (INSERT ... ON CONFLICT DO NOTHING,
-- matching today_sessions' own established race-free pattern) rather than a
-- check-then-insert race.
-- ============================================================================

create table course_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  course_id uuid not null references courses (id) on delete restrict,
  role text not null check (role in ('OWNER', 'INSTRUCTOR', 'LEARNER')),
  joined_at timestamptz not null default now(),
  -- null = currently has access. non-null = access revoked (ADR-015 §7).
  -- Revoking never deletes the row or any learner history elsewhere
  -- (attempts/user_question_progress are untouched by this migration and by
  -- every application code path this migration introduces) — ADR-015 §8.
  revoked_at timestamptz,
  -- null = participates in this learner's active learning set. non-null =
  -- excluded from automatic Today for this learner only; remains
  -- accessible/manually-practiceable and may be reactivated (ADR-015 §7,
  -- §9). Independent of revoked_at — an archived-but-not-revoked membership
  -- still has access; a revoked membership's archive state is irrelevant
  -- (access is already gone either way).
  archived_at timestamptz,
  created_at timestamptz not null default now(),

  unique (user_id, course_id)
);

comment on table course_memberships is
  'ADR-015. The single explicit User<->Course relationship — there is no '
  'other path to Course access. role determines management capability '
  '(OWNER/INSTRUCTOR) vs. learning-only (LEARNER); no MANAGER or '
  'institution-level role exists in V1. revoked_at and archived_at are '
  'independent facts (see their own column comments) — never conflated.';

comment on column course_memberships.role is
  'ADR-015 §2. Exactly three V1 roles. OWNER and INSTRUCTOR are '
  'course-management roles (may manage Course content and membership, '
  'including join_policy); LEARNER is learning-only. OWNER remains '
  'conceptually distinct from courses.owner_user_id (that column is '
  'unaffected by this migration — ADR-015 §1) — whether it is later '
  'retired in favor of a role=OWNER membership row is explicitly left '
  'open by ADR-015, not decided or implemented here.';

-- Serves "find this user's membership on this Course" (the primary lookup
-- every application service below performs) beyond what the UNIQUE
-- constraint's own implicit index already provides for the exact-pair case
-- — kept for symmetry/clarity with course_memberships_course_id_idx below,
-- though the UNIQUE (user_id, course_id) index alone already serves this
-- exact query shape efficiently.
create index course_memberships_user_id_idx on course_memberships (user_id);

-- Serves "list memberships for a Course" (e.g. a future management UI) and
-- "does this actor have a management membership on this Course" (the
-- authorization check in src/application/course/set-course-join-policy.ts
-- and revoke-course-membership.ts).
create index course_memberships_course_id_idx on course_memberships (course_id);

alter table course_memberships enable row level security;

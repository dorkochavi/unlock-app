-- UNLOCK Course Membership Learner-Only Narrowing — RUN010-H.3
-- (FUB-036, Option 4 architecture, human decisions approved 2026-09-29).
--
-- Forward-only migration. Final phase of the 3-phase migration described in
-- `20260929010000_course_authors_v1.sql`'s own header:
--   - H.1 (that migration): created `course_authors`, backfill-copied every
--     existing OWNER/INSTRUCTOR `course_memberships` row into it
--     (`revoked_at` preserved). `course_memberships` itself untouched.
--   - H.2 (a separate, already-committed Slice): every authorization call
--     site now reads `course_authors` instead of `course_memberships`
--     (`hasActiveAuthorGrant`); `create-course.ts` no longer writes an
--     OWNER `course_memberships` row for a new Course's creator. Since that
--     Slice, no application code path writes a non-LEARNER
--     `course_memberships` row.
--   - H.3 (this migration): the legacy OWNER/INSTRUCTOR `course_memberships`
--     rows H.1's backfill copied are now redundant (an equivalent, possibly
--     revoked, row already exists in `course_authors`) — delete them, then
--     narrow `course_memberships.role` to LEARNER-only going forward. This
--     narrowing was already the Option 4 architecture's own stated
--     end-state (`course_authors_v1.sql`'s header), not a new decision made
--     here.
--
-- Explicitly OUT OF SCOPE / untouched by this migration:
--   - `course_authors` itself (H.1's table) — not read, written, or altered
--     here in any way.
--   - Any application authorization call site (already repointed in H.2).
--   - The TypeScript `CourseRole`/`CourseMembership.role` domain type
--     (`src/domain/course/types.ts`), which stays permissive
--     (OWNER/INSTRUCTOR/LEARNER) — narrowing it is out of this Slice's
--     approved scope; defensive/permissive typing over a table that will now
--     only ever contain LEARNER rows is intentional, not an oversight.
--
-- Safety: the DELETE below is destructive but provably redundant — every row
-- it removes has an equivalent (possibly revoked) row already sitting in
-- `course_authors`, written by the H.1 migration's own backfill, and no
-- application code has read an OWNER/INSTRUCTOR `course_memberships` row as
-- an authorization source since H.2's cutover (verified by repository-level
-- grep before this migration was written). This migration is committed but,
-- per `CLAUDE.md` / `.claude/rules/postgres.md`, hosted application
-- (`supabase link` / `supabase db push`) remains a separate, later
-- human-controlled action — not performed by this Slice.

-- ============================================================================
-- Delete legacy OWNER/INSTRUCTOR course_memberships rows.
--
-- Never touches course_authors, never touches any LEARNER row, never touches
-- any other table (attempts/user_question_progress and every other
-- learner-history table are untouched — ADR-015 §8's never-delete-history
-- discipline is about learner evidence, not about this now-legacy
-- authorization row shape).
-- ============================================================================

delete from course_memberships where role in ('OWNER', 'INSTRUCTOR');

-- ============================================================================
-- Narrow course_memberships.role to LEARNER-only going forward.
--
-- The table's original CHECK constraint (course_membership_v1.sql) was
-- declared inline with no explicit name, so Postgres assigned it the
-- standard default name (`<table>_<column>_check`) — dropped by that name
-- below before the new, narrower one is added.
-- ============================================================================

alter table course_memberships drop constraint course_memberships_role_check;
alter table course_memberships
  add constraint course_memberships_role_check check (role in ('LEARNER'));

comment on column course_memberships.role is
  'RUN010-H.3 (FUB-036, Option 4 architecture): narrowed to LEARNER-only. '
  'Management capability (formerly OWNER/INSTRUCTOR here) now lives '
  'exclusively in course_authors (20260929010000_course_authors_v1.sql). '
  'Kept as a text column (not dropped/replaced by a boolean) for backward '
  'compatibility with existing row shape/tooling — every row''s role value '
  'is now always LEARNER, enforced by this column''s own CHECK constraint.';

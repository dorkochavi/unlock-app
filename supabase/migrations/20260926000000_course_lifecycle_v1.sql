-- UNLOCK Course Lifecycle V1 — Run 005 S2.
--
-- Forward-only migration. Does NOT edit any prior migration.
--
-- Adds the two new physical columns Run 005's instructor authoring surface
-- needs on `courses`:
--
--   - `status`: DRAFT | PUBLISHED | ARCHIVED (Run 005 CHATGPT_PLAN.md
--     "Accepted Product Decisions" §Course lifecycle). Distinct from
--     `join_policy` (AUTHORIZED_ONLY | OPEN, added in
--     20260919000000_course_membership_v1.sql) — status governs whether a
--     Course participates in normal learner flow at all; join_policy only
--     governs HOW a learner may join a Course that is already eligible.
--   - `exam_date`: optional instructor-set date, no learning-policy meaning
--     yet (Exam Urgency ranking is explicitly out of Run 005's scope per the
--     Plan's Run 005 Boundary section) — metadata only in this migration.
--
-- Same style precedent as `question_versions.question_type`
-- (20260918000000_question_answer_model_v1.sql): `status` is added
-- nullable, backfilled, then set NOT NULL with no column DEFAULT left
-- behind — every future insert (via the application's createCourse use
-- case) must supply status explicitly (new Courses start DRAFT; Plan S3
-- "Do not auto-publish a Course merely because it was created"). This is
-- deliberately NOT the same pattern as `courses.join_policy`, which DOES
-- keep a permanent default — the two columns differ because every future
-- Course row needs a real, deliberate status value chosen by application
-- code, whereas join_policy's safe default (AUTHORIZED_ONLY) is correct
-- for every row regardless of who created it.
--
-- Existing Courses backfill to PUBLISHED, not DRAFT: they are already used
-- by the real learner join/Today flow (DEV_STATUS.md), so defaulting them
-- to DRAFT would silently break existing learner access — Run 005 Plan
-- explicitly anticipates this ("likely treating existing real Courses as
-- PUBLISHED unless repository evidence requires another mapping").

-- ============================================================================
-- courses.status
-- ============================================================================

alter table courses
  add column status text
    check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));

update courses
   set status = 'PUBLISHED'
 where status is null;

alter table courses
  alter column status set not null;

comment on column courses.status is
  'Run 005 S2. DRAFT: instructor setup/editing, not intended for learner '
  'onboarding/participation. PUBLISHED: available according to join_policy '
  'and normal learner flows. ARCHIVED: no longer active for normal learner '
  'participation; historical data (Attempts, QuestionVersions, progress) '
  'remains preserved and untouched by any status transition. Enforced at '
  'the application layer (src/application/course/), not by a DB transition '
  'constraint, matching this schema''s existing division between physical '
  'integrity (DB) and authorization/lifecycle policy (application).';

-- ============================================================================
-- courses.exam_date
-- ============================================================================

alter table courses
  add column exam_date date;

comment on column courses.exam_date is
  'Run 005 S2. Optional instructor-set date, metadata only in this '
  'migration — Exam Urgency ranking logic is explicitly out of Run 005''s '
  'scope (Run 005 CHATGPT_PLAN.md "Run 005 Boundary"). No CHECK: any valid '
  'date (past or future) is accepted; the application layer does not '
  'reject a past exam_date, since editing/removing it remains the '
  'instructor''s own responsibility.';

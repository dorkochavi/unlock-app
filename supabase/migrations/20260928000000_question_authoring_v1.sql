-- UNLOCK Question Authoring & Publishing V1 — Run 006 S2.
--
-- Forward-only migration. Does NOT edit any prior migration.
--
-- Adds the minimum additive persistence needed for manual Question
-- draft authoring on top of the existing immutable Question/QuestionVersion
-- model (ADR-009/ADR-014) and the existing flat Topic model (Run 005 S4).
-- No separate QuestionDraft table (Run 005 handoff decision, reconfirmed by
-- this Run's S1 audit): draft content lives on nullable `draft_*` columns
-- directly on `questions`, exactly like `current_version_id` itself already
-- does for published content.
--
-- All new `questions` columns are nullable with no default and need no
-- backfill: they are never read by any existing query (Today/New Material/
-- grading all read `question_versions`/`current_version_id` only), so every
-- existing published Question remains fully compatible untouched.

-- ============================================================================
-- topics — add the composite unique this migration's Question<->Topic FK
-- needs. `topics` only had a plain PK + a non-unique course_id index until
-- now (Run 005 S4 had no cross-entity FK to satisfy).
-- ============================================================================

alter table topics
  add constraint topics_id_course_id_key unique (id, course_id);

-- ============================================================================
-- questions.topic_id — CURRENT (not versioned) organizational metadata.
--
-- Lives on `questions`, not `question_versions`: Topic association is an
-- authoring/organizational concern, not part of what a QuestionVersion's
-- immutable content means for grading (`evaluateAnswerCorrectness` never
-- reads Topic). Reassigning a Question to a different Topic later must not
-- retroactively reinterpret any historical Attempt, so it is intentionally
-- NOT snapshotted into question_versions on publish.
--
-- Nullable indefinitely: a draft need not have a Topic chosen yet (S2 "save
-- draft" is more permissive than S3's publish-ready validation, which does
-- require one).
--
-- Composite FK against topics' new UNIQUE (id, course_id) — not a plain
-- single-column FK to topics(id) — so the DATABASE itself guarantees a
-- Question's Topic actually belongs to THAT Question's own Course, matching
-- this schema's established pattern for every other same-Course integrity
-- guarantee (questions_current_version_id_fkey, the Attempt/DailyPlanItem
-- Course-consistency FKs). MATCH SIMPLE (default) correctly skips the check
-- while topic_id is null.
-- ============================================================================

alter table questions
  add column topic_id uuid;

alter table questions
  add constraint questions_topic_id_course_id_fkey
  foreign key (topic_id, course_id) references topics (id, course_id)
  on delete restrict;

comment on column questions.topic_id is
  'Run 006 S2. Current (not versioned) Topic association — organizational '
  'metadata only, never part of QuestionVersion''s immutable graded content. '
  'Nullable: a draft may have no Topic chosen yet. Composite FK '
  '(topic_id, course_id) -> topics (id, course_id) DB-enforces same-Course '
  'association.';

-- No new index needed for "list Questions by Course": the initial schema
-- already created `questions_course_id_idx` (`20260917203000_initial_
-- schema.sql`) — verified against the actual applied migration chain
-- (PGlite rejected this migration's own initial attempt to redeclare it as
-- a duplicate relation).

-- ============================================================================
-- questions.draft_* — Run 006 draft content, additive and nullable.
--
-- Mirrors question_versions' own answer-content shape exactly
-- (draft_question_type/draft_answer_options/draft_correct_answer), so
-- publish (Run 006 S5) can copy draft_* directly into a new
-- question_versions row with no shape translation. No CHECK constraint on
-- the JSONB internals here, deliberately — matching question_versions'
-- own established discipline: deep shape/cardinality validation
-- (assertValidQuestionAnswerDefinition and this Run's S3 publish-ready
-- wrapper) belongs in application code, not SQL.
--
-- All five columns stay nullable indefinitely (never backfilled, never
-- forced NOT NULL): unlike question_versions.question_type — which every
-- piece of grading code already reads and therefore needed backfill+NOT
-- NULL when it was added — nothing reads draft_* today, and a draft is
-- allowed to be incomplete by product design (S2 "save-draft validation"
-- is deliberately more permissive than S3's strict "publish-ready
-- validation").
-- ============================================================================

alter table questions
  add column draft_question_type text
    check (draft_question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE')),
  add column draft_prompt text,
  add column draft_answer_options jsonb,
  add column draft_correct_answer jsonb,
  add column draft_explanation text;

comment on column questions.draft_question_type is
  'Run 006 S2. Work-in-progress draft content — mirrors question_versions.'
  'question_type''s shape/CHECK exactly. Null = no draft type chosen yet. '
  'Cleared back to null by a successful publish (Run 006 S5): draft_* '
  'represents ONLY unpublished pending edits, never a copy of the current '
  'published version, so "published, no pending changes" is exactly '
  '"current_version_id is not null AND every draft_* column is null" with '
  'no separate flag needed.';

comment on column questions.draft_answer_options is
  'Run 006 S2. Mirrors question_versions.answer_options'' shape ([{"id", '
  '"content"}, ...]) but is explicitly NOT graded/published content — see '
  'draft_question_type''s comment for the publish-clears-draft contract.';

comment on column questions.draft_correct_answer is
  'Run 006 S2. Mirrors question_versions.correct_answer''s shape (an array '
  'of option ids, always an array for both question types) — see '
  'draft_question_type''s comment for the publish-clears-draft contract.';

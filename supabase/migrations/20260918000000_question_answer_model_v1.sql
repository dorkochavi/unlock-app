-- UNLOCK Question/Answer Model V1 — ADR-014.
--
-- Forward-only migration. Does NOT edit
-- 20260917203000_initial_schema.sql (already committed and pushed) — see
-- that file's own header comment and ADR-014 for why this is a new file
-- rather than an edit to history.
--
-- Adds the one genuinely NEW physical column (`question_type`).
-- `answer_options`/`correct_answer` are already generic `jsonb NOT NULL`
-- on `question_versions` and need no DDL change — only their now-decided
-- CONTENTS are new (ADR-014's `QuestionAnswerDefinition`/`AnswerOption`/
-- `SelectedAnswer` contracts). Their COMMENT ON COLUMN text is reissued
-- below to supersede the initial migration's "UNRESOLVED shape" comment,
-- without editing that file.
--
-- No CHECK constraint validates the JSONB internals of `answer_options`/
-- `correct_answer` here, deliberately: deep JSON-shape validation
-- (unique option ids, correctOptionIds referencing real options,
-- per-type cardinality) belongs in application/infrastructure code
-- (`src/domain/learning/answer.ts`'s `assertValidQuestionAnswerDefinition`,
-- called from `src/infrastructure/postgres/answer-correctness-checker.ts`),
-- matching this schema's own already-established style: CHECK is used for
-- closed, simple value sets (like `question_type` below), never for
-- JSON-internal business rules.

-- ============================================================================
-- question_versions.question_type
-- ============================================================================

-- Added nullable, backfilled, then set NOT NULL — not a single
-- `ADD COLUMN ... NOT NULL DEFAULT ...` — specifically so no column
-- default is left behind afterward. This matches `users.id`'s own
-- established precedent in the initial migration: no default that could
-- misleadingly imply an unrequested value survives past this migration,
-- so every future insert must supply `question_type` explicitly. The
-- backfill value ('SINGLE_CHOICE') only matters for any row that existed
-- before this migration ran; in this project's own local/test databases
-- at the time of writing, that means the schema-integration-test seed
-- rows only, never real product data.
alter table question_versions
  add column question_type text
    check (question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE'));

update question_versions
   set question_type = 'SINGLE_CHOICE'
 where question_type is null;

alter table question_versions
  alter column question_type set not null;

comment on column question_versions.question_type is
  'ADR-014. Immutable per version (a QuestionVersion is never updated — '
  'ADR-009): changing a Question''s type always creates a NEW '
  'QuestionVersion. SINGLE_CHOICE: exactly one correct option. '
  'MULTIPLE_CHOICE: at least one correct option, learner selects a set. '
  'TRUE_FALSE is deliberately not a value here — represent it as '
  'SINGLE_CHOICE with two options (ADR-014 Decision §1).';

comment on column question_versions.answer_options is
  'ADR-014 (supersedes the initial migration''s "UNRESOLVED shape" '
  'comment — shape now DECIDED, no DDL change needed, this column was '
  'already generic jsonb). A JSON array of AnswerOption objects: '
  '[{"id": string, "content": string}, ...]. Order is the frozen, '
  'meaningful display order (never re-shuffled after this version is '
  'created). Option ids are stable within THIS version only — a new '
  'version may reuse, change, or drop any id. Validated at the '
  'application/infrastructure boundary '
  '(assertValidQuestionAnswerDefinition), not by a DB CHECK: non-empty, '
  'every id unique.';

comment on column question_versions.correct_answer is
  'ADR-014 (supersedes the initial migration''s "UNRESOLVED shape" '
  'comment). A JSON array of option ids from answer_options that are '
  'correct: ["optionId", ...] — ALWAYS an array, for both '
  'SINGLE_CHOICE (exactly one entry) and MULTIPLE_CHOICE (at least one '
  'entry, order-irrelevant/set semantics); never a bare scalar. Validated '
  'at the application/infrastructure boundary '
  '(assertValidQuestionAnswerDefinition), not by a DB CHECK: every entry '
  'must reference a real answer_options id, no duplicate entries, and '
  'the count must satisfy question_type''s cardinality rule.';

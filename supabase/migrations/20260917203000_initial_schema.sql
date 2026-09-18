-- UNLOCK V1 initial schema.
--
-- Translates docs/PERSISTENCE_SCHEMA_V1.md (the design contract) into a real
-- PostgreSQL migration, cross-checked against src/domain/learning/types.ts,
-- src/application/learning/ports.ts, and ADR-005/008/009/010/011/012 as of
-- commit f656201. Implements ONLY decisions already approved there — see
-- that document for the full rationale behind every choice below; this file
-- states the "what," not the "why," except where a genuine schema-level bug
-- was found and fixed during this migration's own adversarial review (noted
-- inline where that happened).
--
-- Explicitly OUT OF SCOPE for this migration (next checkpoint):
--   - Postgres repository adapters, UnitOfWork, advisory-lock transaction
--     code, submitAnswer infrastructure, API routes, Supabase Auth wiring.
--   - RLS policies beyond "RLS enabled, no policies yet" (see bottom) — the
--     User<->Course authorization model is not yet decided
--     (docs/OPEN_QUESTIONS.md #1).
--
-- Style choices made explicitly in this file (documented once here, not
-- repeated per table):
--   - Closed, already-decided value sets (confidence_level, assistance_used,
--     misconception_state, evidence_strength, mastery_category, action_type,
--     tier, today_session_items.status) use `text` + `CHECK (col IN (...))`,
--     not a native Postgres ENUM type. Both were compatible with
--     PERSISTENCE_SCHEMA_V1.md's own "deliberately non-committal" note on
--     this exact choice; CHECK was chosen for simpler future alteration
--     (ALTER TABLE ... DROP/ADD CONSTRAINT vs. ALTER TYPE's append-only,
--     hard-to-shrink semantics) and consistency with this schema's existing
--     CHECK constraints elsewhere (e.g. response_time_seconds >= 0).
--   - Still-OPEN value sets (verification_state, material_type,
--     today_sessions.status) are plain nullable/free text with NO CHECK —
--     freezing them now would silently make a product decision this
--     migration is not authorized to make.
--   - `gen_random_uuid()` is core PostgreSQL (built in since PG13, no
--     extension required) — used as a convenience default for id columns
--     the application already always supplies explicitly
--     (context.generateId() in src/application/learning/submit-answer.ts);
--     the default only matters for direct SQL/manual rows.
--   - `users.id` deliberately has NO default: it is conceptually
--     `= auth.users.id` once Supabase Auth is wired (not yet — see
--     PERSISTENCE_SCHEMA_V1.md's `users` section and ADR-013 below), so a
--     locally-generated default would misleadingly imply an independent
--     identity. No FK to `auth.users` is added yet either, for the same
--     reason: Auth is explicitly deferred, and this migration must not
--     silently lock in an authorization model that hasn't been decided.

-- ============================================================================
-- users
-- ============================================================================

create table users (
  id uuid primary key,
  created_at timestamptz not null default now()
);

comment on table users is
  'Identity only (docs/DATABASE.md §3). id is conceptually = auth.users.id '
  'once Supabase Auth is wired (deferred — see ADR-013); no FK to auth.users '
  'exists yet, and no default is given to id, so every row must be inserted '
  'with an explicit id rather than implying an independently-generated one.';

-- ============================================================================
-- courses
-- ============================================================================

create table courses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references users (id) on delete restrict,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column courses.owner_user_id is
  'Minimal V1 ownership field only (docs/PERSISTENCE_SCHEMA_V1.md''s '
  '"courses" section) — NOT a closure of docs/OPEN_QUESTIONS.md #1. A '
  'future Enrollment/multi-access model can be added additively as a '
  'separate course_access table without changing this column.';

-- No institution_id column — ADR-006 (Course does not require Institution).

-- ============================================================================
-- materials
-- ============================================================================

create table materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete restrict,
  title text not null,
  -- UNRESOLVED (docs/DATABASE.md §... no candidate list finalized yet) —
  -- free text, no CHECK, deliberately not enumerated here.
  material_type text,
  source_reference text,
  created_by uuid not null references users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- questions
--
-- Stable logical identity only — ADR-009. current_version_id's FK is added
-- further below (after question_versions exists), since questions and
-- question_versions reference each other. UNIQUE (id, course_id) exists
-- purely so attempts/today_session_items can composite-FK against
-- (question_id, course_id), making "Attempt's course_id cannot diverge from
-- its Question's actual Course" a database guarantee, not an
-- application-only promise.
-- ============================================================================

create table questions (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses (id) on delete restrict,
  material_id uuid references materials (id) on delete set null,
  -- FK added below, after question_versions exists (circular reference).
  current_version_id uuid,
  -- UNRESOLVED (docs/DATABASE.md §24 lists candidates, not final values) —
  -- free text, no CHECK.
  verification_state text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, course_id)
);

comment on column questions.current_version_id is
  '"Must be set before the Question is servable" (in the same transaction '
  'as creating the Question''s first QuestionVersion) remains an '
  'application-level invariant, not DB-enforced — nullable at the column '
  'level only to resolve the questions<->question_versions circular '
  'reference without a DEFERRABLE constraint. "Points at a QuestionVersion '
  'that actually belongs to THIS Question," however, IS DB-enforced, by '
  'the composite FK below (Phase-2-red-team finding: the original single- '
  'column FK to question_versions(id) let current_version_id point at a '
  'version of an unrelated Question).';

-- ============================================================================
-- question_versions
--
-- Immutable content snapshot — ADR-009. Never updated after creation, never
-- deleted (no application code path does either — see the "Immutability
-- enforcement" note at the bottom of this file for why no DB-level trigger
-- enforces this in V1). UNIQUE (question_id, id) exists purely so
-- attempts/today_session_items can composite-FK against
-- (question_id, question_version_id), making "a referenced QuestionVersion
-- actually belongs to the referenced Question" a database guarantee.
-- ============================================================================

create table question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete restrict,
  version_number int not null check (version_number >= 1),
  prompt text not null,
  -- UNRESOLVED shape (docs/DATABASE.md §9: normalized table vs. JSON is
  -- still open) — jsonb used as the simplest V1 placeholder, not a closure.
  answer_options jsonb not null,
  correct_answer jsonb not null,
  explanation text,
  -- No updated_at: a version is never updated. This is the entire point of
  -- the table.
  created_at timestamptz not null default now(),

  unique (question_id, version_number),
  unique (question_id, id)
);

-- Resolves the questions<->question_versions circular reference now that
-- question_versions exists. Composite (id, current_version_id) against
-- question_versions' UNIQUE (question_id, id) — NOT a plain single-column
-- FK to question_versions(id) — so the DB itself guarantees
-- current_version_id actually belongs to THIS Question, not merely that it
-- names some QuestionVersion row that exists somewhere. Column order/types
-- match positionally: id -> question_id (uuid), current_version_id -> id
-- (uuid). MATCH SIMPLE (default) correctly skips this check only while
-- current_version_id is null (the transient pre-first-version state noted
-- above) — id itself is never null, so the check always fires once
-- current_version_id is set.
alter table questions
  add constraint questions_current_version_id_fkey
  foreign key (id, current_version_id) references question_versions (question_id, id)
  on delete restrict;

-- ============================================================================
-- today_sessions
--
-- Persisted decision output, course-scoped in V1 — ADR-011. UNIQUE (id,
-- user_id, course_id) exists purely so today_session_items can
-- composite-FK against (today_session_id, user_id, course_id), making "an
-- item's denormalized user_id/course_id can never disagree with its
-- parent session's actual owner/Course" a database guarantee. (Originally
-- UNIQUE (id, user_id) only, covering ownership but not Course — widened
-- during Phase-2 red-teaming to also close the Course-mismatch gap noted
-- on today_session_items below.)
-- ============================================================================

create table today_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  course_id uuid not null references courses (id) on delete restrict,
  -- Caller-supplied logical date; no timezone/day-boundary logic exists
  -- here or anywhere in the domain/persistence layer
  -- (docs/OPEN_QUESTIONS.md #3, still open).
  planned_for_date date not null,
  -- Exact state machine DEFERRED (docs/DATABASE.md §17) — free text, no
  -- CHECK. Application code currently only ever writes 'prepared' at
  -- creation (src/application/learning/today-session.ts).
  status text not null,
  engine_version text not null,
  generated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  unique (user_id, course_id, planned_for_date),
  unique (id, user_id, course_id)
);

-- ============================================================================
-- today_session_items
--
-- The frozen plan, one row per planned Question within a session — ADR-010's
-- "Today Session freeze model." user_id and course_id are both denormalized
-- from today_sessions at insert time, purely to support enforcing composite
-- FKs (ownership from attempts, below; Course consistency, right here) —
-- kept consistent with their parent by the single composite FK to
-- today_sessions below (not separate plain FKs on today_session_id/user_id/
-- course_id individually, which would be redundant with the composite one).
--
-- course_id specifically closes a Phase-2-red-team finding: nothing
-- previously stopped an item from planning a Question belonging to a
-- DIFFERENT Course than its own TodaySession's course_id (today_sessions is
-- course-scoped per ADR-011, but that scoping was only ever enforced on the
-- session row itself, never transitively down to the Questions its items
-- plan). Closed below by two composite FKs together: this column must match
-- both the parent session's actual course_id AND the referenced Question's
-- actual course_id, which transitively forces the Question's Course to
-- equal the session's Course.
-- ============================================================================

create table today_session_items (
  id uuid primary key default gen_random_uuid(),
  today_session_id uuid not null,
  user_id uuid not null,
  course_id uuid not null,
  position int not null check (position >= 0),
  question_id uuid not null,
  -- Resolved by the APPLICATION layer at plan-persistence time (ADR-010) —
  -- today-planner.ts itself has no version concept.
  question_version_id uuid not null,
  action_type text not null check (
    action_type in (
      'REVIEW_DUE', 'RELEARN_LAPSE', 'REPAIR_MISCONCEPTION', 'STRENGTHEN_MEMORY'
    )
  ),
  tier text not null check (
    tier in ('REMEDIATION', 'DUE_REVIEW', 'LOWER_SEVERITY_REPAIR', 'STRENGTHEN')
  ),
  other_applicable_types jsonb not null default '[]'::jsonb,
  reasons jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (
    status in ('pending', 'completed', 'skipped')
  ),
  completed_at timestamptz,

  unique (today_session_id, position),
  unique (today_session_id, question_id),
  -- Exists purely so attempts can composite-FK against
  -- (today_session_item_id, user_id) below.
  unique (id, user_id),
  -- Exists purely so attempts can composite-FK against
  -- (today_session_item_id, today_session_id) below — cross-checking that
  -- an Attempt's own claimed today_session_id actually matches the session
  -- its claimed today_session_item_id belongs to.
  unique (id, today_session_id),

  -- Single composite FK (not also a plain FK on today_session_id alone —
  -- that would be redundant with this one, which already validates
  -- today_session_id's existence as part of the tuple): requires
  -- today_sessions' UNIQUE (id, user_id, course_id) above. Column
  -- order/types match positionally: today_session_id -> id (uuid), user_id
  -- -> user_id (uuid), course_id -> course_id (uuid). All three columns are
  -- NOT NULL on both sides, so MATCH SIMPLE (default) already always
  -- checks the full tuple — no partial-null loophole is possible here.
  foreign key (today_session_id, user_id, course_id)
    references today_sessions (id, user_id, course_id) on delete cascade,

  -- Same consistency enforcement as attempts below: a referenced
  -- QuestionVersion must actually belong to the referenced Question.
  -- Column order/types match positionally: question_id -> question_id
  -- (uuid), question_version_id -> id (uuid).
  foreign key (question_id, question_version_id)
    references question_versions (question_id, id) on delete restrict,

  -- Phase-2-red-team finding (item H): closes the Course-mismatch gap
  -- described in this table's own comment above — a referenced Question
  -- must actually belong to THIS item's claimed course_id. Requires
  -- questions' UNIQUE (id, course_id). Column order/types match
  -- positionally: question_id -> id (uuid), course_id -> course_id (uuid).
  -- Together with the composite FK to today_sessions above (which requires
  -- this same course_id to match the parent session's actual course_id),
  -- this transitively forces "the planned Question's Course" and "the
  -- session's Course" to always agree — neither FK alone would close the
  -- gap, since each only compares course_id against one side.
  foreign key (question_id, course_id)
    references questions (id, course_id) on delete restrict
);

comment on column today_session_items.user_id is
  'Denormalized from today_sessions.user_id at insert time. Kept '
  'consistent with its parent by the composite FK to today_sessions (id, '
  'user_id, course_id) above — there is no independent way for this '
  'column to disagree with the parent session''s real owner.';

comment on column today_session_items.course_id is
  'Denormalized from today_sessions.course_id at insert time. Kept '
  'consistent with its parent by the same composite FK to today_sessions '
  '(id, user_id, course_id) above, AND cross-checked against the '
  'referenced Question''s actual Course by the separate composite FK to '
  'questions (id, course_id) below — together these make "this item''s '
  'Question belongs to this item''s (and its session''s) Course" a '
  'database guarantee, not an application-only promise.';

comment on table today_session_items is
  'Frozen (never recomputed after insert): position, action_type, tier, '
  'other_applicable_types, reasons, question_version_id. Mutable: status, '
  'completed_at only — execution progress, not the plan itself (ADR-010). '
  'Deliberately NOT given a reverse completed_by_attempt_id pointer — '
  'attempts.today_session_item_id already points Attempt -> Item; a second, '
  'independently-writable Item -> Attempt pointer could disagree with it '
  '(docs/DATABASE.md §34).';

-- ============================================================================
-- attempts
--
-- Immutable historical evidence — ADR-005. Never updated after creation (no
-- application code path does either — see the "Immutability enforcement"
-- note at the bottom of this file).
-- ============================================================================

create table attempts (
  id uuid primary key default gen_random_uuid(),
  -- Idempotency key, scoped per-user (not globally) — ADR-010.
  submission_id text not null,
  user_id uuid not null references users (id) on delete restrict,
  course_id uuid not null,
  question_id uuid not null,
  question_version_id uuid not null,
  -- null = manual practice / no Today context. Independently tracked from
  -- today_session_item_id (found during this migration's adversarial
  -- review: docs/PERSISTENCE_SCHEMA_V1.md's original attempts table
  -- omitted this column entirely, but src/domain/learning/types.ts's
  -- Attempt.todaySessionId and ADR-010's canonical command-identity field
  -- list both already treat it as its own client-supplied, independently
  -- compared field, distinct from today_session_item_id) — see the
  -- composite FK to today_session_items below for how the two are kept
  -- consistent with each other whenever both are present.
  today_session_id uuid references today_sessions (id) on delete set null,
  today_session_item_id uuid,
  -- ADR-012 §5: for a Today-attached Attempt (today_session_item_id not
  -- null) this is APPLICATION-derived from that item's today_session_id,
  -- never the client's claim; for manual practice (today_session_item_id
  -- null) the client supplies and owns a stable token. See
  -- src/application/learning/submit-answer.ts's resolveLearningSessionId.
  learning_session_id text,
  -- Client-captured event time — distinct from created_at (DB persistence
  -- time) below.
  answered_at timestamptz not null,
  -- Server-computed from selected_answer vs. the referenced
  -- QuestionVersion's correct answer — not independently client-supplied.
  is_correct boolean not null,
  selected_answer jsonb,
  confidence_level text check (confidence_level in ('low', 'medium', 'high')),
  response_time_seconds numeric check (
    response_time_seconds is null or response_time_seconds >= 0
  ),
  assistance_used text not null default 'NONE' check (
    assistance_used in (
      'NONE', 'FIFTY_FIFTY', 'HINT', 'SECOND_ATTEMPT', 'ANSWER_REVEALED', 'OTHER'
    )
  ),
  attempt_number_for_presented_item int not null check (
    attempt_number_for_presented_item >= 1
  ),
  -- Server/application-derived (verified, ADR-010) — not independently
  -- client-supplied.
  suspicious_timing boolean not null default false,
  -- Client-supplied (verified, ADR-010).
  answer_was_revealed_before_response boolean not null default false,
  engine_version text not null,
  -- DB persistence time — distinct from answered_at above.
  created_at timestamptz not null default now(),

  unique (user_id, submission_id),

  -- Closes Phase-2-audit finding #19: an Attempt's course_id can never
  -- diverge from its Question's actual Course. Requires questions' UNIQUE
  -- (id, course_id) above. Column order/types match positionally:
  -- question_id -> id (uuid), course_id -> course_id (uuid).
  foreign key (question_id, course_id)
    references questions (id, course_id) on delete restrict,

  -- Closes Phase-2-audit findings #3/#20: a referenced QuestionVersion must
  -- actually belong to the referenced Question. Requires question_versions'
  -- UNIQUE (question_id, id) above. Column order/types match positionally:
  -- question_id -> question_id (uuid), question_version_id -> id (uuid).
  foreign key (question_id, question_version_id)
    references question_versions (question_id, id) on delete restrict,

  -- Closes Phase-2-audit findings #17/#18 (the two originally-BLOCKING
  -- gaps): an Attempt can never reference a TodaySessionItem owned by a
  -- different user. Requires today_session_items' UNIQUE (id, user_id)
  -- above. Column order/types match positionally: today_session_item_id ->
  -- id (uuid), user_id -> user_id (uuid). MATCH SIMPLE (Postgres default)
  -- means this composite FK is only checked when BOTH columns are
  -- non-null, so a manual-practice Attempt (today_session_item_id = null)
  -- is correctly never subject to it, while user_id itself stays governed
  -- by the separate plain FK to users above regardless.
  --
  -- ON DELETE SET NULL (today_session_item_id) — column-scoped SET NULL
  -- (PostgreSQL 15+), NOT a plain `ON DELETE SET NULL` on the whole
  -- constraint. This is a fix, found during this migration's own
  -- adversarial review, for a real bug in the original design note in
  -- PERSISTENCE_SCHEMA_V1.md: an unqualified `ON DELETE SET NULL` on a
  -- COMPOSITE FK sets EVERY referencing column to null, which here would
  -- also null out attempts.user_id — violating its NOT NULL constraint
  -- (attempts.user_id is independently required and separately FK'd to
  -- users), and in practice would make deleting a referenced
  -- today_session_items row fail outright with a constraint violation
  -- instead of the intended "Attempt keeps its raw evidence, only loses
  -- the 'which planned item' pointer" behavior. Scoping SET NULL to just
  -- today_session_item_id is the correct, minimal fix.
  foreign key (today_session_item_id, user_id)
    references today_session_items (id, user_id)
    on delete set null (today_session_item_id),

  -- Second, SEPARATE composite FK (not merged into a single 3-column FK
  -- with user_id — see below for why): requires today_session_items'
  -- UNIQUE (id, today_session_id) above. Column order/types match
  -- positionally: today_session_item_id -> id (uuid), today_session_id ->
  -- today_session_id (uuid). Closes a real gap found during this
  -- migration's adversarial review: nothing previously stopped an Attempt
  -- from claiming a today_session_item_id belonging to session X while
  -- independently claiming a DIFFERENT today_session_id. MATCH SIMPLE
  -- (Postgres default) means this is only checked when BOTH columns are
  -- non-null — a manual-practice Attempt (both null) or a hypothetical
  -- Attempt with only one of the two set are correctly not subject to it,
  -- same reasoning as the ownership FK above.
  --
  -- Deliberately kept as a SEPARATE 2-column FK rather than folded into
  -- one 3-column (today_session_item_id, today_session_id, user_id) FK:
  -- attempts.user_id is NOT NULL (always present), so a single 3-column
  -- FK would need MATCH FULL to correctly express "all three or none of
  -- the Today-context columns," and MATCH FULL's "all or nothing among
  -- these columns" would then force today_session_item_id/today_session_id
  -- to ALSO always be non-null (since user_id never is) — silently
  -- breaking manual practice, where both must be nullable. Two independent
  -- FKs avoid that trap — but unlike the ownership FK above (MATCH SIMPLE
  -- is already correct there, since user_id is never null), THIS FK's own
  -- two columns are BOTH independently nullable, so MATCH SIMPLE alone
  -- leaves a real gap: a row with today_session_item_id set but
  -- today_session_id left null would skip this check entirely (MATCH
  -- SIMPLE only enforces the FK when every referencing column is
  -- non-null), silently accepting a Today-attached Attempt with no record
  -- of which session it belongs to — exactly the inconsistency this FK
  -- exists to prevent. Phase-2-red-team finding (item N): fixed with
  -- MATCH FULL, which requires these two columns to be BOTH null or BOTH
  -- non-null-and-matching — consistent with the ON DELETE SET NULL clause
  -- below, which already (and correctly) nulls both columns together.
  foreign key (today_session_item_id, today_session_id)
    references today_session_items (id, today_session_id)
    match full
    on delete set null (today_session_item_id, today_session_id)
);

comment on column attempts.learning_session_id is
  'ADR-012 §5. Ownership is split by origin: application-derived from the '
  'TodaySessionItem''s own today_session_id for a Today-attached Attempt '
  '(the client''s claim is never authoritative there); client-supplied and '
  '-owned only for manual practice.';

-- Replay index: rebuildUserQuestionProgress's canonical order is
-- answeredAt ASC, createdAt ASC, id ASC (ADR-012 §4, rebuild.ts). This
-- 5-column index is a strict superset of PERSISTENCE_SCHEMA_V1.md's
-- originally-suggested (user_id, question_id, answered_at) — chosen
-- because it serves BOTH the plain per-question Attempt-history lookup and
-- lets Postgres satisfy the exact replay ORDER BY via an index scan,
-- without a separate sort step, for the O(n) rebuild path ADR-012
-- introduces. AttemptRepository.listForReplay does not rely on this index
-- for correctness (rebuildUserQuestionProgress always sorts defensively
-- regardless of what order rows arrive in) — this is a performance index
-- only.
create index attempts_replay_idx
  on attempts (user_id, question_id, answered_at, created_at, id);

-- Partial index: serves "which Attempt completed this TodaySessionItem"
-- lookups (today_session_items' own comment above) and the child-side of
-- the composite FK to today_session_items. Partial (WHERE ... IS NOT NULL)
-- since the large majority of rows are expected to be manual practice with
-- this column null, per PERSISTENCE_SCHEMA_V1.md's own recommendation.
create index attempts_today_session_item_id_idx
  on attempts (today_session_item_id)
  where today_session_item_id is not null;

-- ============================================================================
-- user_question_progress
--
-- Fully derived, rebuildable state (docs/ARCHITECTURE.md §13) — no column
-- here is independently authoritative; every value is reconstructable from
-- attempts via rebuildUserQuestionProgress (src/domain/learning/rebuild.ts,
-- ADR-012). Defaults below exist for constraint-completeness only — the
-- application never inserts a placeholder/zero-state row (ADR-010
-- explicitly rejected that approach); every real row is inserted already
-- fully derived from at least one real Attempt.
-- ============================================================================

create table user_question_progress (
  user_id uuid not null references users (id) on delete restrict,
  question_id uuid not null references questions (id) on delete restrict,

  attempt_count int not null default 0 check (attempt_count >= 0),
  correct_count int not null default 0 check (
    correct_count >= 0 and correct_count <= attempt_count
  ),

  last_attempt_at timestamptz,
  last_correct_at timestamptz,
  last_incorrect_at timestamptz,

  -- Scheduler state: typed columns for the cross-adapter fields UNLOCK
  -- actually needs to query/index, plus one opaque JSONB bag for
  -- adapter-internal state — matches SchedulerMemoryState's own existing
  -- split (src/domain/learning/scheduler.ts). No ts-fsrs-specific column
  -- names appear outside scheduler_state itself (ADR-008: no domain module
  -- may import ts-fsrs directly, extended here to "no ts-fsrs-specific
  -- schema columns"). All nullable together (no ratable evidence yet) —
  -- deliberately NOT given a cross-column "all-or-nothing" CHECK: FSRS's
  -- own SchedulerMemoryState.lastReviewAt is independently nullable even
  -- within an otherwise-established memory state, so such a CHECK would
  -- assert an invariant the domain type itself does not actually guarantee.
  memory_stability numeric,
  memory_difficulty numeric,
  scheduled_review_at timestamptz,
  last_review_at timestamptz,
  scheduler_review_count int check (
    scheduler_review_count is null or scheduler_review_count >= 0
  ),
  -- FSRS's own internal lapse counter — deliberately distinct from
  -- lapse_count below (UNLOCK's own StateUpdateReason-driven count); they
  -- can legitimately diverge and must never be merged into one column.
  scheduler_lapse_count int check (
    scheduler_lapse_count is null or scheduler_lapse_count >= 0
  ),
  scheduler_implementation text,
  scheduler_schema_version int,
  scheduler_state jsonb,

  retrieval_baseline_at timestamptz,
  -- ADR-012: learning_session_id of whichever Attempt currently
  -- set/last-moved retrieval_baseline_at, tracked in exact lockstep with
  -- it. Together with an Attempt's own learning_session_id, this is what
  -- deriveIsSameLearningSession compares to derive isSameLearningSession
  -- fresh every time — never a stored relational snapshot.
  retrieval_baseline_learning_session_id text,
  successful_spaced_retrievals int not null default 0 check (
    successful_spaced_retrievals >= 0
  ),
  lapse_count int not null default 0 check (lapse_count >= 0),
  last_lapse_at timestamptz,

  misconception_state text not null default 'none' check (
    misconception_state in ('none', 'suspected', 'active', 'recovering', 'resolved')
  ),
  misconception_score numeric not null default 0,
  misconception_last_seen_at timestamptz,

  timed_attempt_count int not null default 0 check (timed_attempt_count >= 0),
  average_response_time_seconds numeric check (
    average_response_time_seconds is null or average_response_time_seconds >= 0
  ),

  -- Phase-2-red-team finding (item M/V): the four counters below originally
  -- had NO individual non-negativity check — only their SUM was constrained
  -- (against attempt_count, below). That left a real impossible-state
  -- loophole: e.g. meaningful_attempt_count = -1, assisted_attempt_count =
  -- 4, low_quality/invalid = 0 sums to 3, which could equal a perfectly
  -- valid attempt_count of 3 and pass the sum-equality CHECK, while still
  -- representing a nonsensical negative evidence count. Each is now
  -- independently bounded, closing that gap without weakening the existing
  -- sum-equality invariant below.
  meaningful_attempt_count int not null default 0 check (meaningful_attempt_count >= 0),
  assisted_attempt_count int not null default 0 check (assisted_attempt_count >= 0),
  low_quality_attempt_count int not null default 0 check (low_quality_attempt_count >= 0),
  invalid_for_mastery_attempt_count int not null default 0 check (
    invalid_for_mastery_attempt_count >= 0
  ),

  first_meaningful_evidence_at timestamptz,
  last_meaningful_evidence_at timestamptz,

  evidence_strength text not null default 'insufficient' check (
    evidence_strength in ('insufficient', 'early', 'moderate', 'strong')
  ),
  mastery_category text not null default 'not_started' check (
    mastery_category in ('not_started', 'learning', 'strengthening', 'mastered')
  ),

  engine_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (user_id, question_id),

  -- Real DB-level enforcement of an invariant src/domain/learning/types.ts
  -- already documents in a comment (EvidenceQuality is mutually exclusive
  -- and exhaustive by construction).
  check (
    attempt_count = meaningful_attempt_count + assisted_attempt_count
      + low_quality_attempt_count + invalid_for_mastery_attempt_count
  )
);

comment on table user_question_progress is
  'No column here is independently authoritative — every value is '
  'reconstructable from attempts (ADR-012). Not (user_id, course_id, '
  'question_id): a Question belongs to exactly one Course, so course_id is '
  'already transitively determined via question_id -> questions.course_id.';

-- Serves "progress list for user + Course" (repos.progress.listForUser,
-- src/application/learning/ports.ts) — joins user_question_progress to
-- questions on question_id, filtered by questions.course_id. A plain index
-- on questions.course_id (below) is what makes that join efficient; this
-- table's own PK already serves the user_id-only half of the lookup.
--
-- Deliberately NOT adding a (user_id, scheduled_review_at) "find due
-- reviews" index here, despite PERSISTENCE_SCHEMA_V1.md's earlier
-- suggestion: the currently-IMPLEMENTED application flow
-- (getOrCreateTodaySession, src/application/learning/today-session.ts)
-- loads ALL progress rows for a user+Course via listForUser and filters/
-- ranks them in pure domain code, never a due-date-filtered SQL query — so
-- this specific index has no real query to serve yet. Revisit if/when a
-- direct due-date query is actually implemented; adding it speculatively
-- now would be exactly the kind of unjustified index this phase's review
-- explicitly warns against.
create index questions_course_id_idx on questions (course_id);

-- ============================================================================
-- Immutability enforcement — application discipline, not DB triggers/privileges.
--
-- `attempts` (ADR-005) and `question_versions` (ADR-009) are contractually
-- immutable after creation. Evaluated whether V1 should enforce this NOW at
-- the DB level (REVOKE UPDATE, a BEFORE UPDATE trigger, etc.) or rely on
-- application discipline alone. Decision: application discipline only, no
-- trigger, matching this architecture's preference for simple declarative
-- schema and no unnecessary DB logic (docs/ARCHITECTURE.md §34).
--
-- This is not merely a stylistic preference — verified, not assumed:
-- `src/application/learning/ports.ts`'s `AttemptRepository` exposes only
-- `insertIfNotExists`, `findByUserAndSubmissionId`, and `listForReplay`; its
-- `QuestionVersionRepository` exposes only `getCurrentVersion` and
-- `resolveVersionContext`. Neither port has an `update` method at all, so
-- there is currently no code path — buggy or otherwise — through which the
-- application COULD mutate either table even by accident. A trigger/REVOKE
-- would defend against a mutation path that does not exist yet, which is
-- exactly the "no unnecessary DB logic" case this architecture avoids. If a
-- future content-authoring or admin-correction flow ever adds an `update`
-- capability to either port, this decision should be revisited then, not
-- preemptively now.
-- ============================================================================

-- ============================================================================
-- Row Level Security — enabled now, policies deliberately deferred.
--
-- The User<->Course enrollment/authorization model is not yet decided
-- (docs/OPEN_QUESTIONS.md #1), and Supabase Auth is not yet wired (ADR-013).
-- Writing permissive "allow all authenticated users" policies now would
-- silently lock in an authorization model nobody has actually decided.
--
-- Enabling RLS with ZERO policies is not a policy decision — it is the safe
-- default: PostgREST (Supabase's auto-generated REST API) would otherwise
-- expose every public-schema table to any anon/authenticated caller by
-- default, which this migration must not allow while the real model is
-- still open. With RLS enabled and no policies, ordinary roles subject to
-- RLS (anon, authenticated — any role without BYPASSRLS) are correctly
-- deny-by-default for every command on every V1 table: PostgreSQL's actual
-- rule is "no applicable policy => no rows visible/writable for that
-- role," not specifically "only service_role can see anything." Several
-- distinct role/attribute categories bypass RLS entirely, independent of
-- policies — this is not overstated as a single service_role special case:
--   - PostgreSQL superusers always bypass RLS;
--   - any role with the BYPASSRLS attribute bypasses RLS (in Supabase,
--     service_role is configured this way — it is an elevated BYPASSRLS
--     role, not a role RLS treats specially by name; it must remain
--     server-side-only for exactly that reason);
--   - a table's owner bypasses RLS on that table by default too, unless the
--     table has `FORCE ROW LEVEL SECURITY` set (not set here, and not being
--     added now — see immediately below).
-- None of this changes the actual security posture for V1's real callers
-- (PostgREST's anon/authenticated roles, which have none of the above and
-- are therefore genuinely deny-by-default on every V1 table right now) —
-- it only corrects which roles/attributes the "deny-by-default" claim
-- covers, so this comment does not overstate PostgreSQL's actual RLS
-- semantics. Real policies are a follow-up migration once
-- docs/OPEN_QUESTIONS.md #1 is resolved. FORCE ROW LEVEL SECURITY is
-- deliberately NOT added now — it would additionally restrict the table
-- owner (e.g. migration/admin tooling connecting as owner rather than
-- service_role), which is not an independently justified requirement yet;
-- revisit only if a concrete need for it materializes.
-- ============================================================================

alter table users enable row level security;
alter table courses enable row level security;
alter table materials enable row level security;
alter table questions enable row level security;
alter table question_versions enable row level security;
alter table today_sessions enable row level security;
alter table today_session_items enable row level security;
alter table attempts enable row level security;
alter table user_question_progress enable row level security;

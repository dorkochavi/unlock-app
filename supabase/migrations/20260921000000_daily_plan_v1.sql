-- UNLOCK DailyPlan / DailyPlanItem Persistence Foundation — ADR-016 §1/§19.
--
-- Forward-only, purely ADDITIVE migration. Does NOT edit, drop, or migrate
-- data out of any earlier migration or table — `today_sessions`/
-- `today_session_items` remain fully intact and unmodified, per
-- docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md §13 ("keep them, unmodified, and
-- simply stop writing new rows into them once Global Today ships").
--
-- Implements ONLY the persistence foundation for what ADR-016 already
-- decided:
--   - `daily_plans`: one row per (user_id, planned_for_date) — ADR-016 §1.
--   - `daily_plan_items`: the frozen plan content, one row per planned
--     Question, each carrying its OWN course_id independently (unlike
--     today_session_items, which inherits Course from a single parent
--     session) — ADR-016 §1's "Global Today and Course Today are views over
--     the same plan" requires this.
--   - `resolved_at`/`completed_at` together implement ADR-016 §19's
--     single-use resolution rule at the data-model level: `resolved_at` is
--     set once, the first time an item leaves `pending` (COMPLETED or
--     SKIPPED); `completed_at` is set only for the COMPLETED case (equal to
--     `resolved_at` in that case). Enforcing "exactly once" itself is an
--     application-layer/repository responsibility (a conditional
--     `UPDATE ... WHERE status = 'pending'`, mirroring how
--     `courses.join_policy`'s authorization is application-enforced, not a
--     DB CHECK) — see src/infrastructure/postgres/daily-plan-repository.ts.
--
-- Explicitly OUT OF SCOPE (not implemented by this migration):
--   - `daily_plan_adaptation_events` (significant-event adaptation,
--     ADR-016 §4) — a separate, later, heavily-blocked slice
--     (docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md Slice 8). No adaptation
--     write path exists yet, so no event log is needed yet either.
--   - Any `attempts` FK to `daily_plan_items` — submitAnswer is not wired to
--     DailyPlan in this slice (deliberately: "do not rewrite submitAnswer
--     unless needed for a narrow compatibility seam"). `attempts` keeps its
--     existing `today_session_id`/`today_session_item_id` columns,
--     untouched.
--   - Multi-Course candidate pooling, first-open orchestration, any
--     application use case that generates a real plan. This migration adds
--     tables and their constraints only.
--   - Real RLS policy text — RLS is enabled with zero policies, matching
--     every other V1 table.

-- ============================================================================
-- daily_plans
--
-- One row per learner per local day (ADR-016 §1). UNIQUE (user_id,
-- planned_for_date) is both the physical "exactly one DailyPlan per user
-- per local day" invariant AND what makes plan creation idempotent by
-- construction (INSERT ... ON CONFLICT DO NOTHING, mirroring
-- today_sessions' own established race-free pattern) rather than a
-- check-then-insert race. UNIQUE (id, user_id) exists purely so
-- daily_plan_items can composite-FK against (daily_plan_id, user_id),
-- mirroring exactly why today_sessions carries UNIQUE (id, user_id,
-- course_id) today — the only difference is there is no single course_id
-- here to also include, since a DailyPlan's items may span many Courses.
-- ============================================================================

create table daily_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  -- Caller-supplied logical date; no timezone/day-boundary logic exists
  -- here or anywhere in the domain/persistence layer (docs/OPEN_QUESTIONS.md
  -- #3, still open) — mirrors today_sessions.planned_for_date exactly.
  planned_for_date date not null,
  -- Exact state machine DEFERRED (docs/DATABASE.md §17, same deferral
  -- today_sessions.status already carries) — free text, no CHECK.
  status text not null,
  engine_version text not null,
  generated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,

  unique (user_id, planned_for_date),
  unique (id, user_id)
);

comment on table daily_plans is
  'ADR-016 §1. One row per (user_id, planned_for_date) — the single '
  'persisted plan Global Today and every Course Today view read from as a '
  'filtered view. Supersedes today_sessions as the TARGET architecture; '
  'today_sessions remains intact and unmodified (this migration does not '
  'touch it) per docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md §13.';

comment on column daily_plans.status is
  'Exact state machine deferred, same honesty as today_sessions.status '
  '(docs/DATABASE.md §17) — free text, no CHECK. Not resolved by this '
  'migration.';

-- ============================================================================
-- daily_plan_items
--
-- The frozen plan content, one row per planned Question — the direct
-- successor to today_session_items, with one structural difference:
-- course_id is a genuinely independent, per-item fact, not a value forced
-- equal to a single parent session's Course (ADR-016 §1).
-- ============================================================================

create table daily_plan_items (
  id uuid primary key default gen_random_uuid(),
  daily_plan_id uuid not null,
  -- Denormalized from daily_plans.user_id at insert time, purely to support
  -- the ownership-consistency composite FK below — same reason
  -- today_session_items.user_id is denormalized today.
  user_id uuid not null,
  -- NOT forced equal to a parent's single Course (unlike
  -- today_session_items.course_id) — this item's own Course, independently,
  -- per ADR-016 §1.
  course_id uuid not null,
  position int not null check (position >= 0),
  question_id uuid not null,
  -- Resolved by the APPLICATION layer at plan-persistence time (ADR-010's
  -- existing rule, unchanged) — today-planner.ts itself has no version
  -- concept.
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
  -- Set once, the first time this item leaves 'pending' (COMPLETED or
  -- SKIPPED) — ADR-016 §19's single-use resolution rule. NOT enforced by a
  -- trigger/constraint here (Postgres has no clean "write-once" column
  -- primitive); enforced by the repository's conditional
  -- `UPDATE ... WHERE status = 'pending'` — see
  -- src/infrastructure/postgres/daily-plan-repository.ts.
  resolved_at timestamptz,
  -- Set only for a COMPLETED item (equal to resolved_at in that case) — for
  -- a SKIPPED item only resolved_at is set. Kept separate from resolved_at
  -- so "when did the learner finish this" and "when did the learner decide
  -- not to do it" are never conflated under one column name
  -- (docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md §7).
  completed_at timestamptz,

  unique (daily_plan_id, position),
  -- A Question appears at most once per plan — the exact constraint that
  -- closes plan-membership double-counting by construction
  -- (docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md §2's central claim for
  -- Option A, docs/GLOBAL_TODAY_PERSISTENCE_PLAN.md §1).
  unique (daily_plan_id, question_id),

  -- Single composite FK: keeps the denormalized user_id from ever
  -- disagreeing with the parent plan's actual owner. Deliberately does NOT
  -- also include course_id (unlike today_session_items' equivalent FK to
  -- today_sessions) — there is no single parent course_id to cross-check
  -- against, per ADR-016 §1.
  foreign key (daily_plan_id, user_id)
    references daily_plans (id, user_id) on delete cascade,

  -- Same consistency enforcement as today_session_items: a referenced
  -- QuestionVersion must actually belong to the referenced Question.
  foreign key (question_id, question_version_id)
    references question_versions (question_id, id) on delete restrict,

  -- A referenced Question must actually belong to THIS item's claimed
  -- course_id. This is now the ONLY mechanism enforcing Course consistency
  -- for this item (there is no parent-session course_id to also
  -- cross-check, unlike today_session_items).
  foreign key (question_id, course_id)
    references questions (id, course_id) on delete restrict
);

comment on table daily_plan_items is
  'ADR-016 §1/§19. Frozen (never recomputed after insert): position, '
  'action_type, tier, other_applicable_types, reasons, question_version_id, '
  'course_id. Mutable: status, resolved_at, completed_at only. A Question '
  'appears at most once per plan (UNIQUE (daily_plan_id, question_id)). '
  'Resolution (COMPLETED or SKIPPED) is single-use, enforced at the '
  'repository layer, not by a DB constraint.';

comment on column daily_plan_items.user_id is
  'Denormalized from daily_plans.user_id at insert time. Kept consistent '
  'with its parent by the composite FK to daily_plans (id, user_id) above.';

comment on column daily_plan_items.course_id is
  'This item''s own Course, independently of any parent (ADR-016 §1) — '
  'cross-checked against the referenced Question''s actual Course by the '
  'composite FK to questions (id, course_id) below.';

comment on column daily_plan_items.resolved_at is
  'ADR-016 §19. Set once, the first time this item leaves pending '
  '(COMPLETED or SKIPPED). "Exactly once" is enforced by the repository''s '
  'conditional UPDATE ... WHERE status = ''pending'', not by a DB '
  'constraint — matching this schema''s existing division between physical '
  'integrity (DB) and authorization/state-transition policy (application).';

create index daily_plan_items_plan_course_idx on daily_plan_items (daily_plan_id, course_id);

alter table daily_plans enable row level security;
alter table daily_plan_items enable row level security;

-- UNLOCK DailyPlanItem Answer Submission — Slice 1 (Night Run).
--
-- Forward-only, purely ADDITIVE migration on top of
-- 20260921000000_daily_plan_v1.sql / 20260922000000_daily_plan_item_state_
-- consistency.sql. Does NOT edit either migration, does not touch
-- today_sessions/today_session_items/attempts' existing columns, and does
-- not remove the "no attempts FK to daily_plan_items" note those files
-- carried — this migration is exactly the deliberately-deferred follow-up
-- 20260921000000_daily_plan_v1.sql named: "submitAnswer is not wired to
-- DailyPlan in this slice."
--
-- Mirrors attempts' existing today_session_id/today_session_item_id design
-- exactly (see 20260917203000_initial_schema.sql), applied to
-- daily_plan_id/daily_plan_item_id:
--   - both columns independently nullable (null = no DailyPlan context —
--     manual practice, or a legacy TodaySession-attached Attempt);
--   - a MATCH SIMPLE composite FK (daily_plan_item_id, user_id) closes
--     cross-user ownership the same way (daily_plan_item_id, user_id) does
--     for today_session_item_id;
--   - a MATCH FULL composite FK (daily_plan_item_id, daily_plan_id) closes
--     "claims an item from one plan while independently claiming a
--     different plan id" the same way the today_session_item_id/
--     today_session_id MATCH FULL FK does;
--   - ON DELETE SET NULL scoped to daily_plan_item_id only (PostgreSQL 15+
--     column-scoped SET NULL), for the identical reason documented on
--     today_session_item_id's own FK: an unqualified SET NULL on a
--     composite FK would also null attempts.user_id, which is NOT NULL.
--
-- New addition beyond the today_session_item_id precedent: a CHECK ensuring
-- an Attempt is never simultaneously claimed by both the legacy
-- TodaySession path and the new DailyPlan path, so a given Attempt's
-- "which planned-item system does this belong to" is never ambiguous.
--
-- daily_plan_items gains the two UNIQUE constraints its own migration
-- deliberately did not need until now (it had no attempts FK yet) —
-- UNIQUE (id, user_id) / UNIQUE (id, daily_plan_id) — purely so the new
-- composite FKs above have a target, exactly mirroring why
-- today_session_items already carries the equivalent pair.

alter table daily_plan_items
  add constraint daily_plan_items_id_user_id_key unique (id, user_id);

alter table daily_plan_items
  add constraint daily_plan_items_id_daily_plan_id_key unique (id, daily_plan_id);

alter table attempts
  add column daily_plan_id uuid references daily_plans (id) on delete set null,
  add column daily_plan_item_id uuid;

comment on column attempts.daily_plan_id is
  'ADR-016. APPLICATION-derived from the referenced DailyPlanItem''s own '
  'daily_plan_id whenever daily_plan_item_id is set (never independently '
  'client-supplied for that case) — mirrors today_session_id''s existing '
  'derivation discipline for today_session_item_id. Null for manual '
  'practice or a legacy TodaySession-attached Attempt.';

comment on column attempts.daily_plan_item_id is
  'ADR-016. Null = manual practice / no DailyPlan context. Independently '
  'tracked from today_session_item_id (mutually exclusive — see the CHECK '
  'constraint below); a given Attempt belongs to at most one of the two '
  'planned-item systems.';

alter table attempts
  add constraint attempts_today_or_daily_plan_item_exclusive
  check (today_session_item_id is null or daily_plan_item_id is null);

-- Ownership: an Attempt can never reference a DailyPlanItem owned by a
-- different user. MATCH SIMPLE (default) — only enforced when both
-- referencing columns are non-null, so manual practice / TodaySession-only
-- Attempts are correctly exempt.
alter table attempts
  add constraint attempts_daily_plan_item_user_fkey
  foreign key (daily_plan_item_id, user_id)
    references daily_plan_items (id, user_id)
    on delete set null (daily_plan_item_id);

-- Consistency: an Attempt can never claim a daily_plan_item_id from one
-- plan while independently claiming a different daily_plan_id. MATCH FULL
-- — requires both columns to be BOTH null or BOTH non-null-and-matching,
-- the same reasoning as today_session_item_id/today_session_id's own
-- MATCH FULL FK (a MATCH SIMPLE pair here would silently skip validation
-- whenever exactly one of the two columns was null).
--
-- ON DELETE SET NULL on BOTH columns — matches the today_session_item_id/
-- today_session_id precedent literally (not just in effect). Deleting a
-- DailyPlan cascades to its DailyPlanItems (daily_plan_items' own FK to
-- daily_plans is ON DELETE CASCADE); without this explicit clause the
-- default ON DELETE NO ACTION would still happen to succeed here (NO
-- ACTION defers its check to statement end, by which point the sibling
-- attempts_daily_plan_item_user_fkey's own ON DELETE SET NULL has already
-- nulled daily_plan_item_id) — but that would silently depend on constraint
-- evaluation order rather than being the constraint's own stated behavior.
-- Declaring it here removes that hidden coupling entirely (db-reviewer
-- finding, Night-Run Slice 1).
alter table attempts
  add constraint attempts_daily_plan_item_plan_fkey
  foreign key (daily_plan_item_id, daily_plan_id)
    references daily_plan_items (id, daily_plan_id)
    match full
    on delete set null (daily_plan_item_id, daily_plan_id);

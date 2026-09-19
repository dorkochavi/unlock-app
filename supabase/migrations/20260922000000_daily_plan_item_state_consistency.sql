-- UNLOCK DailyPlanItem State Consistency — ADR-016 §19 follow-up.
--
-- Forward-only, purely ADDITIVE migration on top of
-- 20260921000000_daily_plan_v1.sql. Does NOT edit that migration or any
-- other earlier migration, does not touch daily_plans.status, does not
-- change application/repository/domain code — this is a schema-only
-- hardening of an invariant the repository's write path (
-- src/infrastructure/postgres/daily-plan-repository.ts) already always
-- produces, but that nothing at the DB level previously enforced.
--
-- Confirmed gap this closes (found by adversarial review of
-- 20260921000000_daily_plan_v1.sql): before this constraint, Postgres
-- accepted structurally impossible daily_plan_items rows via any write
-- path other than the repository's own conditional UPDATE — e.g.
-- status = 'completed' with completed_at NULL, status = 'pending' with
-- resolved_at set, or status = 'skipped' with completed_at set.
--
-- Invariant enforced (exhaustive across the three values
-- daily_plan_items.status's existing CHECK already allows):
--   pending   -> resolved_at IS NULL  AND completed_at IS NULL
--   completed -> resolved_at IS NOT NULL AND completed_at IS NOT NULL
--   skipped   -> resolved_at IS NOT NULL AND completed_at IS NULL

alter table daily_plan_items
  add constraint daily_plan_items_status_timestamps_check
  check (
    (status = 'pending' and resolved_at is null and completed_at is null)
    or (status = 'completed' and resolved_at is not null and completed_at is not null)
    or (status = 'skipped' and resolved_at is not null and completed_at is null)
  );

comment on constraint daily_plan_items_status_timestamps_check on daily_plan_items is
  'ADR-016 §19. Ties status to resolved_at/completed_at so a structurally '
  'impossible row (e.g. completed with completed_at NULL, or pending with '
  'resolved_at set) can never be persisted by any write path — not only '
  'the repository''s own conditional UPDATE. Exhaustive across the three '
  'values daily_plan_items.status''s own CHECK already allows.';

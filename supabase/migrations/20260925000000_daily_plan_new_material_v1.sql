-- ADR-017: Starter / New-Material Exposure V1 — Night-Run Slice 5.
--
-- Forward-only, purely ADDITIVE-in-effect migration on top of
-- 20260921000000_daily_plan_v1.sql. Does NOT edit that migration — a CHECK
-- constraint's allowed-value list cannot be widened in place in Postgres,
-- so this drops and recreates the two affected constraints BY THEIR
-- STANDARD AUTO-GENERATED NAMES (`<table>_<column>_check`, Postgres's own
-- naming convention for an unnamed inline column CHECK — verified against
-- the real applied migration chain, not assumed) rather than touching the
-- original migration file's text.
--
-- Adds exactly the two enum values ADR-017 §7 decided:
--   - daily_plan_items.action_type gains 'NEW_LEARNING'
--   - daily_plan_items.tier gains 'NEW_MATERIAL'
--
-- `reasons` needs no migration: it is `jsonb` with no CHECK constraint on
-- its contents (application-layer validated only, via
-- daily-plan-mapper.ts's readEnumArray) — ADR-017's new `UNSEEN_MATERIAL`
-- reason value is an application-layer change only.
--
-- Deliberately OUT OF SCOPE: today_session_items carries the identical
-- action_type/tier CHECK constraints, left untouched. That table backs the
-- superseded TodaySession model, which no real route uses (see
-- docs/DEV_STATUS.md) — ADR-017 governs DailyPlan generation only.

alter table daily_plan_items drop constraint daily_plan_items_action_type_check;
alter table daily_plan_items
  add constraint daily_plan_items_action_type_check
  check (
    action_type in (
      'REVIEW_DUE', 'RELEARN_LAPSE', 'REPAIR_MISCONCEPTION', 'STRENGTHEN_MEMORY',
      'NEW_LEARNING'
    )
  );

alter table daily_plan_items drop constraint daily_plan_items_tier_check;
alter table daily_plan_items
  add constraint daily_plan_items_tier_check
  check (
    tier in (
      'REMEDIATION', 'DUE_REVIEW', 'LOWER_SEVERITY_REPAIR', 'STRENGTHEN',
      'NEW_MATERIAL'
    )
  );

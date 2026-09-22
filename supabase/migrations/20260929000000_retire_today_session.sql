-- Retire the legacy TodaySession architecture (ADR-011), superseded by
-- ADR-016's global DailyPlan/DailyPlanItem model.
--
-- Forward-only, purely SUBTRACTIVE migration. Pre-migration verification
-- (human-supplied, read-only query against the current hosted Supabase
-- project, immediately before this migration was written):
--   - today_sessions: 0 rows
--   - today_session_items: 0 rows
--   - attempts.today_session_item_id IS NOT NULL: 0 rows
-- No live `src/app` route creates or retrieves a TodaySession as of this
-- migration (verified by runtime/reachability audit, not merely assumed) —
-- `getOrCreateTodaySession`/`getTodaySession`
-- (`src/application/learning/today-session.ts`) were reachable only from
-- `src/infrastructure/learning/composition-root.ts`'s own wiring and from
-- tests, never from any `src/app/api/**/route.ts`. The current DailyPlan
-- answer route (`src/app/api/daily-plan/items/[itemId]/answer`) never
-- supplies `todaySessionItemId`.
--
-- This migration is committed but deliberately NOT applied to the hosted
-- Supabase project yet — Gate 3 backup readiness (docs/FOLLOW_UP_BACKLOG.md
-- FUB-009) has not been confirmed closed. Hosted destructive schema
-- mutation remains a human-controlled action (`CLAUDE.md` §6).
--
-- Order: drop the two `attempts` columns first (this also drops, as a
-- documented consequence of PostgreSQL's own DROP COLUMN behavior, every
-- constraint/index on `attempts` that involves them — the two composite FKs
-- to `today_session_items`, the `attempts_today_or_daily_plan_item_exclusive`
-- CHECK, and the partial index `attempts_today_session_item_id_idx` — none
-- of that needs to be named/dropped separately, and none of it is an
-- external dependency requiring CASCADE, since every one of those objects
-- belongs to `attempts` itself). Then drop `today_session_items` (the FK
-- child), then `today_sessions` (the FK parent) — explicit table order,
-- no CASCADE, so an unexpected surviving dependency fails loudly instead of
-- silently taking something else down with it.

alter table attempts drop column today_session_item_id;
alter table attempts drop column today_session_id;

drop table today_session_items;
drop table today_sessions;

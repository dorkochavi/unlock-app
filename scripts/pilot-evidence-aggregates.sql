-- UNLOCK — Pilot-minimum product-event evidence (PILOT_READINESS §3 item 13a).
-- READ-ONLY, AGGREGATE-ONLY. Derived from authoritative records (FUB-023); no event table, no new data.
-- Every statement returns counts / buckets only: no user_id, email, name, answer or question text column.
-- Run by a human operator, read-only, e.g. in the Supabase SQL editor or via psql against a restored copy.
-- Day buckets are UTC (a reporting convenience; learner-local day is a DailyPlan concept, not used here).
-- Sections are separated by "-- @query <name>" markers (the schema test splits on them).

-- @query joins_per_day
-- Invite -> join: learners joined per course per day (LEARNER role only).
select date_trunc('day', joined_at at time zone 'UTC')::date as day_utc,
       course_id,
       count(*)::int as learners_joined
from course_memberships
where role = 'LEARNER' and revoked_at is null
group by 1, 2
order by 1, 2;

-- @query plans_generated_per_day
-- First Today of the learner-local day (daily_plans.generated_at marks first request only; NOT every Today open).
select date_trunc('day', generated_at at time zone 'UTC')::date as day_utc,
       count(*)::int as plans_generated,
       count(distinct user_id)::int as distinct_learners
from daily_plans
group by 1
order by 1;

-- @query accepted_answers_per_day
-- Accepted answers (attempts are only written on acceptance), split Today-plan vs Manual Practice.
select date_trunc('day', answered_at at time zone 'UTC')::date as day_utc,
       (daily_plan_item_id is not null) as via_daily_plan,
       count(*)::int as attempts,
       count(distinct user_id)::int as distinct_responders
from attempts
group by 1, 2
order by 1, 2;

-- @query plan_items_resolution_per_day
-- Today completion: plan-item outcomes (use item status, NOT the unmaintained daily_plans.status/completed_at).
select date_trunc('day', coalesce(resolved_at, completed_at) at time zone 'UTC')::date as day_utc,
       status,
       count(*)::int as items
from daily_plan_items
where resolved_at is not null or completed_at is not null
group by 1, 2
order by 1, 2;

-- @query repeat_behavior_last_7_days
-- Pilot signal "completes Today on >= 3 distinct days in a week": a single count, no learner rows.
select count(*)::int as learners_with_3_plus_active_days
from (
  select user_id
  from daily_plan_items
  where completed_at >= now() - interval '7 days'
  group by user_id
  having count(distinct date_trunc('day', completed_at at time zone 'UTC')) >= 3
) as repeat_learners;

-- UNLOCK User Timezone Persistence V1 — docs/OPEN_QUESTIONS.md #35
-- (RESOLVED at the product level), docs/DATABASE.md §26.
--
-- Forward-only migration. Does NOT edit any earlier migration.
--
-- Implements ONLY what is decided so far:
--   - `users.timezone`: a nullable IANA timezone identifier text column.
--
-- Explicitly OUT OF SCOPE (not decided, not added here):
--   - Manual timezone editing (Settings) — deferred by the product decision
--     itself.
--   - Full travel/DST UX (see docs/TODAY_TIMEZONE_EDGE_CASES.md).
--   - DailyPlan / local-day calculation itself (ADR-016) — this migration
--     only adds the source-of-truth column that future calculation will
--     read; it does not implement DailyPlan.

alter table users
  add column timezone text;

comment on column users.timezone is
  'docs/OPEN_QUESTIONS.md #35 (RESOLVED), docs/DATABASE.md §26. An IANA '
  'timezone identifier (e.g. Asia/Jerusalem), detected client-side on the '
  'first relevant session and persisted as the server-side source of truth '
  'for future local-day calculation. Nullable: no existing user has ever '
  'had a timezone value, so NULL means "not yet detected/persisted" — the '
  'application must never treat NULL as an implied default (e.g. UTC). No '
  'CHECK constraint against the actual IANA tzdata: validity/canonical '
  'form is enforced at the application boundary '
  '(src/domain/user/timezone.ts, via Intl.DateTimeFormat''s own platform '
  'tzdata) — unlike courses.join_policy''s small fixed enum, the full IANA '
  'identifier set is large and platform/version-dependent, not a good fit '
  'for a hardcoded CHECK list.';

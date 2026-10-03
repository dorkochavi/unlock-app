# PILOT-HARDENING-EVIDENCE-001 / Slice B - Backup Restore Drill (FUB-009 evidence)

Run: 2026-10-04-PILOT-HARDENING-EVIDENCE-001. START_HEAD ae43c07. Date: 2026-10-04.

## Provenance labels
- LOCAL-VERIFIED: restore into a disposable local Docker PostgreSQL, run by this Slice.
- NOT-HOSTED: no hosted Supabase contact of any kind occurred.
- NOT-PROVEN: items in Limitations below.

## Subject
Logical backup `C:\Users\dorko\UNLOCK-backups\pre-QACLEANUP-20261003-210229\` (outside the repo, not committed):
`01-schema.sql` (public schema, 12 tables, 1074 lines), `02-data-public.sql` (COPY data), `03-data-auth-migrations.sql` (auth.* + supabase_migrations COPY data).
Dump headers: `Dumped from database version 17.6 / pg_dump 17.6` (data files; schema file has no header). No connection strings/hosted URLs in any file (grep for supabase.co / postgres:// / postgresql:// found none). The auth data file contains credential-class columns (e.g. password hashes, tokens); values were never printed.

## Engine
`public.ecr.aws/supabase/postgres:17.6.1.166` (already present locally; PostgreSQL 17.6, same major/minor as the hosted dump source). Preinstalled roles anon/authenticated/service_role/supabase_auth_admin and extensions pgcrypto, uuid-ossp, pg_stat_statements, supabase_vault, so the schema file's `CREATE EXTENSION` and role references applied with no stubs.

## Isolation (named negative scenario: no hosted contact)
- Resources: network `unlock-restore-drill-net`, volume `unlock-restore-drill-vol`, container `unlock-restore-drill-pg`.
- Port published only as `127.0.0.1:<random>` (inspect: HostIp 127.0.0.1); throwaway password; backup dir mounted read-only at /backup.
- Every psql ran inside the container with `-h 127.0.0.1`; server_addr 127.0.0.1. No repo env file was read or sourced; no DATABASE_URL used.
- Hosted-pattern grep (supabase.co | pooler | DATABASE_URL) over my command log: 0 hits. Same grep over container `env`: 0 hits.
- Caveat: the command log was assembled by the worker (key commands plus a summary line for psql calls), not captured by a shell hook; the guarantee rests on all psql calls being `docker exec ... -h 127.0.0.1`.

## Restore procedure and honest results
1. `01-schema.sql`: applied with zero errors. 12 public tables, 33 indexes, 82 constraints, 25 FKs, all validated.
2. `02-data-public.sql`: applied with zero errors (loads with session_replication_role=replica, so FKs not checked at load; verified separately below).
3. `03-data-auth-migrations.sql`: PARTIAL AS-IS. The image's `auth` schema is a bare stub (5 tables, older shape, no GoTrue migrations run); the dump contains data only, not auth DDL (the schema file excludes auth). The COPYs failed (missing columns/tables, e.g. `audit_log_entries.ip_address`, `custom_oauth_providers`). Remediation, disposable DB only: (a) created `supabase_migrations.schema_migrations (version text pk, statements text[], name text)` and loaded its 15 rows with the dump's own COPY; (b) loaded every non-empty auth.* COPY block into all-text stub tables in a separate schema `auth_dump_stub` purely to prove file integrity and row counts. This is NOT a faithful auth restore (no GoTrue schema, no types/constraints).

## Counts: dump COPY rows vs restored DB
| Table | Dump | Restored |
|---|---|---|
| public.users | 76 | 76 |
| public.courses | 11 | 11 |
| public.course_authors | 11 | 11 |
| public.course_memberships | 79 | 79 |
| public.topics | 16 | 16 |
| public.materials | 0 | 0 |
| public.questions | 74 | 74 |
| public.question_versions | 69 | 69 |
| public.attempts | 190 | 190 |
| public.user_question_progress | 131 | 131 |
| public.daily_plans | 91 | 91 |
| public.daily_plan_items | 280 | 280 |
| supabase_migrations.schema_migrations | 15 | 15 |
| auth.users / identities (stub) | 73 / 73 | 73 / 73 |
| auth.sessions / mfa_amr_claims / refresh_tokens (stub) | 68 / 68 / 73 | 68 / 68 / 73 |
| auth.flow_state / one_time_tokens (stub) | 8 / 1 | 8 / 1 |
All 12 public tables and every non-empty auth/migration table match exactly. (Dump counts derived by counting rows between each COPY header and `\.`.)

## Invariants and queries
- Migration history: the 15 `schema_migrations` versions are identical (diff-empty) to the 15 version prefixes of `supabase/migrations/*` in the repo (20260917203000 .. 20260929020000).
- Every course (11/11) has at least one course_authors row, and 11/11 have an active (revoked_at IS NULL) author row; 0 courses without.
- FKs: 25/25 public FKs flagged validated in the schema; additionally, data-level check: single-column FKs have 0 orphans, and all 25 FKs (including 9 composite ones) were dropped and re-added inside a transaction (rolled back), which revalidates existing rows: no violations.
- App-style join courses -> questions -> question_versions -> attempts: 9 courses with questions, 74 questions, 69 versions, 190 attempts (attempts count matches dump). 68 questions resolve their current_version_id to an existing version.
- Observation (not a defect claim): public.users 76 vs auth.users 73 in the dump, so 3 public identity rows have no auth row in this backup; consistent with the auth-user provisioning trigger covering only future signups, per its migration header. Not investigated further.

## Limitations (NOT-PROVEN)
- Auth schema/GoTrue restore is not proven: auth data went into text stubs, and the auth.users trigger `handle_new_auth_user` binding is not in the schema dump (auth DDL is not backed up), so it would need re-creation from repo migration `20260923000000_auth_user_provisioning.sql` after any real restore.
- Roles/grants beyond those in the image, storage objects, vault secrets, realtime/publication config, Edge functions, and project settings are not covered by this backup.
- Restore into hosted Supabase (what a real disaster restore needs), restore timing/RTO, and a repeatable script were not exercised. The restore ran as superuser in an image of the same Postgres major; behaviour on a different major is untested.
- Backup is a point-in-time pre-QA-cleanup snapshot, not proof of a recurring backup.

## FUB-009 recommendation: NARROW (do not close)
The technical question "can this logical backup be restored and does it contain all application data?" is answered yes for the public schema and migration history (LOCAL-VERIFIED, counts exact, FKs and author invariants hold). Remaining, human-owned: backup owner, frequency, RPO/RTO targets, Supabase plan check (PITR/managed backups availability), where and how long dumps are retained/encrypted (the dump holds PII and auth credential material), plus an auth-schema restore procedure and a repeatable restore script/runbook. Suggested narrowed FUB-009 text: "Define backup ownership/frequency/RPO/RTO, verify Supabase plan backup/PITR, and document an auth-aware restore runbook; public-schema logical restore proven 2026-10-04."

## Teardown
Container, volume and network all removed (`docker rm -f`, `docker volume rm`, `docker network rm`); a follow-up listing found 0 `unlock-restore-drill*` containers, volumes, networks. The pulled image `supabase/postgres:17.6.1.166` was pre-existing and left in place. No backup data copied into the repo.

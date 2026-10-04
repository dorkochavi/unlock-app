# UNLOCK — Local Backup Restore Runbook

Status: ACTIVE (Run 2026-10-04-AUTH-RESTORE-HARDENING-001, Slice C). Local, disposable, counts-only.
Design basis: `docs/RUNS/2026-10-04-AUTH-RESTORE-HARDENING-001-B-restore-model.md`.

## Tool
`scripts/restore-local-backup.mjs` (+ `scripts/lib/restore-local.mjs`). Node >= 22.18, no dependencies, Docker Desktop only for `restore`.
Backups live outside the repo (`C:\Users\dorko\UNLOCK-backups\<name>\`), 3 files:
`01-schema.sql`, `02-data-public.sql`, `03-data-auth-migrations.sql`. They are mounted read-only and never modified or copied.

## Modes
1. `validate` — read-only file checks (files exist/non-empty, markers, COPY block counts, 26 auth blocks, migration rows, notes on absent trigger/auth DDL). No Docker.
   `node scripts/restore-local-backup.mjs validate <backup-dir>`
2. `restore` — creates one container `unlock-restore-<id>` from the local image `public.ecr.aws/supabase/postgres:17.6.1.166` (never pulled), `--network none`, backup `:ro`, random throwaway password (never printed), removed on exit/Ctrl-C unless `--keep`.
   `npm run restore:local -- restore <backup-dir>` (same as `node scripts/restore-local-backup.mjs restore <backup-dir>`)
   Options: `--keep`, `--image <supabase/postgres tag already local>`, `--publish 127.0.0.1:<port>:5432`.

## Sequence (restore)
public schema -> public data -> `supabase_migrations` table + rows -> auth data into all-text `auth_dump_stage` (COPY target rewritten in-stream) -> trigger `on_auth_user_created` (statement read from `supabase/migrations/20260923000000_*`) AFTER auth load -> checks: per-table counts vs file, FK orphan counts, public.users vs staged auth.users counts (info only), trigger/function presence, migration versions vs repo.

## Results (exit codes)
- FULL (0): complete backup, all checks pass, zero populated auth tables omitted from the real `auth` schema.
- PARTIAL (2): public + history verified; prints `AUTH NOT RECOVERED (staged for integrity only)` and the omitted populated auth tables. Expected today: the backup has no auth DDL, so auth can only be staged. Never treat as success.
- FAIL (1): missing/truncated file, any count mismatch, FK orphan, version diff, missing trigger, load error, or a refused option.

## Safety (enforced in code, tested)
- Ignores `DATABASE_URL`/`SUPABASE_*`/`PG*` for child processes; refuses non-local `PGHOST`, `PGHOSTADDR`, `PGSERVICE*`, non-local `DOCKER_HOST`.
- Image must be a `supabase/postgres:<tag>`; name `unlock-restore-*`; publish only `127.0.0.1:<port>:5432`.
- The CLI accepts only `--keep/--image/--publish`; any other option (including `--url`) exits 1 before Docker is touched. Library-level `--url` validation (`assertLocalPgUrl`) still refuses hosted/query-string URLs, and even a valid local URL is refused: only the script's own container is a target.
- FULL is never reported while `public.users` is populated and staged `auth.users` is empty (auth cannot be silently dropped).
- Drill evidence: `docs/RUNS/2026-10-04-AUTH-RESTORE-HARDENING-001-D-local-drill.md`.
- Output: names and integer counts only; psql stderr is never forwarded (it can quote row values).

## Limits
Does not prove hosted Supabase/GoTrue behavior, real multi-connection concurrency, or faithful Auth restore (needs auth DDL + GoTrue version in the backup; see model doc section 7). Container cleanup uses `docker rm -f -v` of its own name only; never `docker system prune`.

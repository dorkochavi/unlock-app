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
   WARNING: `--publish` replaces `--network none` (Docker cannot combine them), so the container then sits on the default bridge with outbound network access. The restore itself does not use the network; use `--publish` only if you truly need host access, and prefer the default (no network).

## Sequence (restore)
public schema -> public data -> `supabase_migrations` table + rows -> auth data into all-text `auth_dump_stage` (COPY target rewritten in-stream) -> trigger `on_auth_user_created` (statement read from `supabase/migrations/20260923000000_*`) AFTER auth load -> checks: per-table counts vs file, FK orphan counts, public.users vs staged auth.users counts (info only), trigger/function presence, migration versions vs repo.

## Results (exit codes)
- FULL (0): complete backup, all checks pass, zero populated auth tables omitted from the real `auth` schema.
- PARTIAL (2): public + history verified; prints `AUTH NOT RECOVERED (staged for integrity only)` and the omitted populated auth tables. Expected today: the backup has no auth DDL, so auth can only be staged. Never treat as success.
- FAIL (1): missing/truncated file, any count mismatch, FK orphan, version diff, missing trigger, load error, or a refused option.

## Safety (enforced in code, tested)
- Ignores `DATABASE_URL`/`SUPABASE_*`/`PG*` for child processes; refuses non-local `PGHOST`, `PGHOSTADDR`, `PGSERVICE*`, non-local `DOCKER_HOST`, any non-`default` `DOCKER_CONTEXT`, and an active docker context whose endpoint is not a local pipe/socket. `DOCKER_CONTEXT` is stripped from child env. The docker env check runs first, before any other action (including `validate`).
- Backup dir path containing `,` `"` or newlines is refused (would inject `--mount` options). Option forms like `--keep=x` / `--image=x` are refused (exact flags only).
- Failed psql never counts as 0: counts become NaN and every check/classification treats NaN as FAIL. Cleanup always runs `docker rm -f -v` on the script's own random container name, even if `docker run` failed.
- Image must be a `supabase/postgres:<tag>`; name `unlock-restore-*`; publish only `127.0.0.1:<port>:5432`.
- The CLI accepts only `--keep/--image/--publish`; any other option (including `--url`) exits 1 before Docker is touched. Library-level `--url` validation (`assertLocalPgUrl`) still refuses hosted/query-string URLs, and even a valid local URL is refused: only the script's own container is a target.
- FULL is never reported while `public.users` is populated and staged `auth.users` is empty (auth cannot be silently dropped).
- Drill evidence: `docs/RUNS/2026-10-04-AUTH-RESTORE-HARDENING-001-D-local-drill.md`.
- Output: names and integer counts only; psql stderr is never forwarded (it can quote row values).

## Limits
Does not prove hosted Supabase/GoTrue behavior, real multi-connection concurrency, or faithful Auth restore (needs auth DDL + GoTrue version in the backup; see model doc section 7). Container cleanup uses `docker rm -f -v` of its own name only; never `docker system prune`.

## Procedure V1 commands (Backup Procedure V1, Run BACKUP-DR-V1-IMPLEMENTATION-001 Slice C)
Policy: `docs/BACKUP_DR_POLICY.md`. Capability research / design basis: `docs/RUNS/2026-10-04-BACKUP-DR-V1-IMPLEMENTATION-001-B-capability-research.md`. Tools: `scripts/backup-create.mjs`, `scripts/backup-validate.mjs`, `scripts/lib/backup-package.mjs`, `scripts/lib/backup-docker.mjs`. Docker (local daemon, images never pulled) is required for create/validate TOC/restore.

Package layout (one dir per backup, always OUTSIDE the repo; `<label>-<YYYYMMDD-HHMMSS>` UTC): `10-full.dump` (one `pg_dump -Fc` of `public`+`auth`+`supabase_migrations`), `20-roles.sql` (`pg_dumpall --roles-only --no-role-passwords`), `30-server-info.txt`, `MANIFEST.json` (schema_version 1: tool, UTC time, label, retention class as metadata only, host fingerprint = sha256(host), server version, extensions, migration counts/latest for supabase_migrations + auth + repo, row counts before/after the dump, per-artifact sha256+bytes, TOC summary, `encryption: NONE_UNENCRYPTED_LOCAL` until encrypted, completeness). Completeness is `FULL_CANDIDATE` or `PARTIAL` + reason codes; never FULL (only a restore drill proves FULL). Dumps/manifests are plaintext PII/hashes: encrypt before any off-device copy (steps 5-7; format/custody/access/retention model in `docs/BACKUP_DR_POLICY.md` "Operating model").

1. Create (read-only; HUMAN supplies the value in the env var, never in the repo/logs/argv):
   `npm run backup:create -- --label daily --out <dir outside repo> --confirm-read-only-source [--source-env SUPA_DB_URL] [--environment <name>] [--dry-run] [--no-pgoptions]`
   Labels: daily (30d), pre-migration|pre-auth-change|pre-release|pre-destructive (event 90d), monthly (12 months). The URL is read only from the named env var (default `SUPA_DB_URL`, never `DATABASE_URL` implicitly), passed to a throwaway `supabase/postgres` container via env, with `PGOPTIONS=-c default_transaction_read_only=on` (`--no-pgoptions` if a pooler rejects startup options; pg_dump stays read-only). Refused: output inside the repo (symlinks/junctions resolved), query-string params other than `sslmode`, multi-host/ambiguous userinfo/no credentials, loopback/private/single-label hosts, remote docker. `--dry-run` prints the redacted plan. Exit 0 FULL_CANDIDATE, 2 PARTIAL, 1 refused/failed (stable `code=` on stderr, e.g. OUTPUT_INSIDE_REPO, SOURCE_ENV_MISSING, SOURCE_URL_FORBIDDEN_PARAM, CONFIRM_FLAG_REQUIRED, DUMP_FAILED). Row counts are SELECT counts taken before and after the dump (not one snapshot): a restored count must lie within [min,max]; a failed count is null, never 0, and makes the package PARTIAL.
2. Validate: `npm run backup:validate -- <backup-dir>` (exit 0 FULL_CANDIDATE, 2 PARTIAL, 1 INVALID). Codes: `missing`, `truncated`, `corrupt`, `hash-mismatch`, `wrong-manifest-version`, `manifest-claim-mismatch`, `unlisted-artifact` (INVALID); `missing-auth-artifact`, `incomplete-migration-metadata`, `roles-missing`, `server-info-missing`, `toc-unverified`, `trigger-missing`, `row-counts-unavailable` (PARTIAL). Completeness is re-derived from the artifacts and a real `pg_restore -l` (network-less container, `--no-toc` skips it and caps at PARTIAL); a manifest claiming more than the artifacts support is INVALID.
3. Restore drill: `npm run restore:local -- restore <backup-dir>` auto-detects the layout. Package layout: all isolation guards above apply; the image's pristine 5-table auth stub (and its `public`, when the dump carries `CREATE SCHEMA public`) is dropped in the disposable container only, missing roles from `20-roles.sql` are created NOLOGIN, then `pg_restore --exit-on-error` runs as `supabase_admin` with `session_replication_role=replica` (data load must not fire `on_auth_user_created`; "postgres" is not a superuser in this image). Checks: row counts within the manifest range, `supabase_migrations`/`auth.schema_migrations` count+latest == manifest, versions == repo (or a strict prefix of it), FK integrity, real `auth` schema restored, trigger present+enabled, function present. FULL (0) only if the package is FULL_CANDIDATE and all of that holds; otherwise PARTIAL (2) or FAIL (1); a failed query is NaN, never 0.
4. Legacy 3-file layout (`01-schema.sql`, `02-data-public.sql`, `03-data-auth-migrations.sql`) stays restorable but is CAPPED at PARTIAL (no Auth DDL / GoTrue version).

5. Encrypt (Slice D). Once: `npm run backup:keygen -- --key-file <path outside repo and outside the backups dir>` (prints key_id only; copy the key to separate offline custody). Per backup: `npm run backup:encrypt -- <backup-dir> --key-file <key> [--out <dir>] [--remove-plaintext]` (default out `<backup-dir>-enc`). It verifies the plaintext against its manifest, writes `*.enc` + MANIFEST.json (readable, MAC-bound), re-decrypts every chunk to verify, and removes the plaintext source ONLY if `--remove-plaintext` was given. Refused (code= on stderr, nothing created): key inside the repo/backup/output dir, output inside the repo, non-empty output, already-encrypted source, plaintext not matching its manifest.
6. Off-device copy: copy the already-encrypted directory (only `*.enc` + MANIFEST.json, never the key, never plaintext) to the owner-chosen destination. Destination/provider = HUMAN_CONFIGURATION_REQUIRED; no provider is configured by this repo. Verify there with `npm run backup:validate -- <copied dir>` (key-less ciphertext hash check, result PARTIAL by design).
7. Decrypt for a drill: `npm run backup:decrypt -- <enc-dir> --key-file <key> --out <NEW dir outside repo>` then `npm run backup:validate -- <out>` / `npm run restore:local -- restore <out>` work unchanged. Fails closed on wrong key, tampered/truncated/reordered/missing ciphertext, wrong format version or manifest MAC. `restore:local` refuses an encrypted dir directly. Afterwards delete the decrypted dir (`Remove-Item -Recurse -Force <out>`): it is plaintext PII.
8. Retention report (read-only, never deletes): `npm run backup:retention -- <backups-root> [--now <ISO>]`; cleanup checklist in the policy doc.

Tests: `npx vitest run src/infrastructure/postgres/backup-encryption.test.ts` (synthetic data, no Docker: round trip, wrong key, tamper, truncation, reorder/drop, key/output placement, secrecy, validate-never-FULL, plaintext removal flag, retention read-only). Not proven: secure erasure, OS/provider access controls, any off-device provider.

Tests: `npx vitest run src/infrastructure/postgres/backup-package.test.ts` (pure, no Docker). Opt-in end-to-end against a SYNTHETIC non-PII local source: `UNLOCK_BACKUP_E2E=1 npx vitest run src/infrastructure/postgres/backup-e2e.test.ts` (needs local images `postgres:17` and the supabase image; removes its containers/network). That test uses a TEST-ONLY create path: `UNLOCK_BACKUP_TEST_MODE=1` + `--test-local-source <unlock-bkptest-* network>` + a source host named `unlock-bkptest-*`; hosted mode refuses all of those hosts, so the hosted guard is not weakened. Backup files are git-ignored (`/backups/`, `*.dump`, `MANIFEST.json`, the package filenames) and a test fails if any tracked file looks like one. Not proven here: any real hosted dump (privileges of the `postgres` role over `auth`/`supabase_migrations`, pooler vs direct, GoTrue version) — that is the owner-run Slice E / drill Slice F.

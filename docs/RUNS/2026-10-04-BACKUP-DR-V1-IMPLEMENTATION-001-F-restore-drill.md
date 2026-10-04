# BACKUP-DR-V1-IMPLEMENTATION-001 / Slice F - Disposable FULL restore drill (SYNTHETIC_LOCAL)

Run 2026-10-04-BACKUP-DR-V1-IMPLEMENTATION-001. START_HEAD 392eb03. Policy: `docs/BACKUP_DR_POLICY.md`; commands: `docs/RESTORE_RUNBOOK.md` (Procedure V1).

## Source label (honest)
SOURCE = SYNTHETIC_LOCAL, "GoTrue replay, not hosted". NOT hosted-derived: Slice E (real hosted backup) is blocked on a human (`SUPA_DB_URL` unset, agents may not touch hosted). No hosted contact, no `.env.local` read, no push.
Source build (isolated docker network `unlock-bkptest-*`, no published ports): `public.ecr.aws/supabase/postgres:17.6.1.166`; image auth stub dropped; `auth` created by `public.ecr.aws/supabase/gotrue:v2.197.0 auth migrate` (75 migrations, 27 tables); `public` from all 15 `supabase/migrations/*.sql` in order (as role `postgres`, granted on `auth.*` like hosted); `supabase_migrations.schema_migrations` = repo's 15 versions; trigger `on_auth_user_created` from migration 20260923000000. Rows: 6 `auth.users` (`*@example.invalid`, fake hash) via inserts, so the trigger created 6 `public.users`; identities 6, sessions 4, refresh_tokens 4, mfa_amr_claims 4; 2 courses, 2 materials, 10 memberships, 6 questions/versions, 12 attempts, 12 user_question_progress. Test-only create path (`UNLOCK_BACKUP_TEST_MODE=1`, `--test-local-source`). Backups, key, decrypted dirs lived outside the repo and were deleted.

## Chain executed (real CLIs)
create (exit 0 FULL_CANDIDATE) -> validate (0) -> keygen -> encrypt (ciphertext re-verified) -> validate enc (2 PARTIAL by design, key-less) -> decrypt (hashes + MAC verified) -> validate (0 FULL_CANDIDATE) -> `restore:local restore` (`--network none`, verified via `docker inspect`: NetworkMode none, no ports) -> **RESULT: FULL (exit 0)**, 0 `unlock-restore-*` left.

## Layer verdicts (counts only)
| Layer | Result |
|---|---|
| Package validation / isolation before start | FULL_CANDIDATE; network none, local socket only |
| pg_restore --exit-on-error 10-full.dump (replica role) | ok |
| public rows, 12 tables | all equal manifest [min,max] (e.g. users 6, attempts 12, questions 6) |
| public FKs | 25 FKs, 0 orphan rows |
| supabase_migrations | 15 / latest 20260929020000 == manifest == repo |
| auth restored into real `auth` schema | 27 tables, 4 functions (uid/role/email/jwt), 9 enums |
| auth rows (31 tables incl. empty) | all equal manifest: users 6, identities 6, sessions 4, refresh_tokens 4, mfa_amr_claims 4, schema_migrations 75 |
| auth.schema_migrations | 75/75 == manifest |
| trigger / function | `on_auth_user_created` enabled on auth.users; `public.handle_new_auth_user` present |
| public.users <-> auth.users | join 6; public-without-auth 0; auth-without-public 0 |
| auth integrity (extra psql, `--keep` container, removed) | identities/sessions->users orphans 0; refresh_tokens->sessions 0; generated `users.confirmed_at` populated 6/6 |
| core invariants (extra psql) | attempts->question_version orphans 0; attempt version belongs to its question: 0 violations; `attempt_count` = sum of components: 0 violations; attempts without membership: 0 |

## Named negatives (real CLI unless noted)
| Scenario | Observed exit / code | Proof |
|---|---|---|
| hosted-looking URL, create (test mode) | 1 `SOURCE_HOST_NOT_ALLOWED` | CLI |
| hosted-looking `--url`, restore | 1 "unsupported option --url; external targets are not supported" | CLI |
| loopback host in hosted mode, create | 1 `SOURCE_HOST_NOT_ALLOWED` | CLI |
| `?host=` bypass, create | 1 `SOURCE_URL_FORBIDDEN_PARAM` | CLI |
| `?hostaddr=` bypass, create | 1 `SOURCE_URL_FORBIDDEN_PARAM` | CLI |
| `?host=` / `?hostaddr=` on restore `--url` | 1 (`--url` refused wholesale) | CLI |
| remote `DOCKER_HOST=tcp://...`, create (non-dry-run) | 1 `DOCKER_UNSAFE` | CLI |
| remote `DOCKER_HOST`, restore | 1 "DOCKER_HOST is not a local socket/pipe" | CLI |
| non-default `DOCKER_CONTEXT`, create / restore | 1 `DOCKER_UNSAFE` / 1 refused | CLI |
| `PGHOST` remote / `PGHOSTADDR` set, restore | 1 FAIL refused | CLI |
| restore of an encrypted dir directly | 1 refused ("run backup:decrypt first") | CLI |
| truncated dump | validate 1 INVALID `truncated`; restore 1 FAIL | CLI |
| invalid hash (roles file byte flipped) | validate 1 `hash-mismatch`; restore 1 FAIL | CLI |
| wrong manifest version (99) | validate 1 `wrong-manifest-version`; restore 1 FAIL | CLI |
| missing artifact (`10-full.dump` removed) | validate 1 `missing`; restore 1 FAIL | CLI |
| missing Auth artifact (source `auth` schema dropped) | create 2 PARTIAL `missing-auth-artifact`; validate 2; restore 1 FAIL (not FULL) | CLI |
| incomplete migration metadata (`auth.schema_migrations` emptied) | create 2 PARTIAL `incomplete-migration-metadata`; validate 2; restore 2 PARTIAL | CLI |
| failed SQL query is not numeric zero | in the missing-auth source, auth count queries error -> create 2 PARTIAL `row-counts-unavailable` (null, not 0); restore never FULL. Unit: `backup-package.test.ts` "count output with errors/garbage/missing lines yields null, never 0", "a failing psql seam yields NaN..."; `restore-local.test.ts` "parseCount: psql failure / non-integer => NaN, never 0", "makeCounter with a failing psql seam yields NaN..." | CLI + unit |
| wrong key on decrypt | 1 `WRONG_KEY`; no output dir | CLI |
| tampered ciphertext | decrypt 1 `DECRYPT_AUTH_FAILED`; keyless validate 1 `hash-mismatch` | CLI |
Note: a `revoke select` on one table did not make `postgres` unable to count it in the supabase image (role has broad read), so a pure per-table count-error CLI case was not constructed; the auth-dropped case supplies the real count-error path.
Note: `create --dry-run` with a remote `DOCKER_HOST` exits 0 (dry-run never touches docker); the non-dry-run is refused.

## Tests
`npx vitest run backup-package.test.ts restore-local.test.ts backup-encryption.test.ts`: 3 files, 135 tests pass. No tooling bug found; no code change. Opt-in `backup-e2e.test.ts` not re-run (this drill supersedes it with a richer source).

## Proven vs NOT proven
Proven (local): the whole V1 chain (create, validate, encrypt, decrypt, restore) on a GoTrue-v2.197.0-shaped Auth + repo-migrated public schema; FULL classification gates; refusal paths above; auth data/DDL/`schema_migrations`/trigger/functions restore with counts equal to the manifest; `postgres` role (not superuser) can `pg_dump` `public`+`auth`+`supabase_migrations` when granted as hosted does (grants were applied by the drill setup, so this is an assumption about hosted).
NOT proven: real hosted privileges of the `postgres` role for `pg_dump` over `auth`/`supabase_migrations` and `pg_dumpall --roles-only`; hosted GoTrue version/DDL equality (v2.197.0 is a replay); sign-in usability of restored Auth; Supavisor/pooler vs direct behavior; hosted extension versions; Storage/Vault/settings/PITR (out of scope); off-device provider; real multi-connection concurrency.

## Gate statement
The Pilot DR gate is NOT proven by this drill. It still needs the owner-run real hosted V1 backup (Slice E, human supplies `SUPA_DB_URL`), then the same chain and a restore drill on that artifact (result must be FULL with hosted `auth.schema_migrations`).

## Cleanup
Removed: source container, network `unlock-bkptest-*`, all `unlock-restore-*` containers, backups/keys/decrypted/tampered copies. Pre-existing `ecstatic_mayer`, cached images and the hello-world volume left. Nothing backup-like tracked (`git ls-files` check).

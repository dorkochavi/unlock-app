# AUTH-RESTORE-HARDENING-001 / Slice B - Restore Model (docs-only)

Run: 2026-10-04-AUTH-RESTORE-HARDENING-001. START_HEAD b05f988. Date: 2026-10-04.
Labels: LOCAL-VERIFIED = observed in a disposable local container this Slice; RECOMMENDATION = not implemented; NOT-HOSTED = no hosted contact occurred.
Subject backup (outside repo, never committed): `C:\Users\dorko\UNLOCK-backups\pre-QACLEANUP-20261003-210229\`. Engine probed: `public.ecr.aws/supabase/postgres:17.6.1.166` (PostgreSQL 17.6). Probe container `unlock-restore-probe-b` bound `127.0.0.1:<random>`, backup mounted `:ro`, removed afterward (0 containers/volumes/networks with prefix `unlock-restore-` remain). Counts only; no row values printed.

## 1. What each backup file contains (Slice A matrix, re-confirmed)
| File | Contains | Does NOT contain |
|---|---|---|
| 01-schema.sql | public DDL: 12 tables, indexes/constraints/25 FKs, `public.handle_new_auth_user()`, 4 extensions, grants | any auth DDL, trigger `on_auth_user_created`, supabase_migrations DDL, role DDL, FK from public to auth (none exist) |
| 02-data-public.sql | COPY data for 12 public tables; starts with `session_replication_role = replica` | - |
| 03-data-auth-migrations.sql | data-only COPY: 26 `auth.*` blocks + `supabase_migrations.schema_migrations` (15 rows); also replica role | all auth DDL (tables, enums, indexes), `auth.schema_migrations` (GoTrue version unknown), any CREATE |
Dump files are CRLF; line-oriented tooling must `trim()` the `\.` terminator (my first count tool miscounted until it did). 02/03 contain psql `\restrict`/`\unrestrict` meta-commands: load them only with psql, never as plain SQL.

## 2. Minimum correct local restore sequence
1. Start a throwaway engine (section 5). Image ships roles anon/authenticated/service_role/supabase_auth_admin and the extensions 01 needs; a bare `postgres:17` would need role/extension stubs.
2. `01-schema.sql` -> 12 public tables, 0 errors (LOCAL-VERIFIED, `ON_ERROR_STOP=1`). public has no FK to auth, so auth need not exist yet.
3. `02-data-public.sql` (replica role, so FKs are not checked at load). Then validate FKs (drop/re-add in a rolled-back txn, or `ALTER TABLE ... VALIDATE`), and compare per-table counts to COPY row counts.
4. Auth data: see section 3. Auth data must exist before step 6.
5. Migration history: `supabase_migrations` schema/table DDL is NOT in any backup. Create `supabase_migrations.schema_migrations (version text primary key, statements text[], name text)` (shape inferred from the COPY column list, same as the prior drill; the image has no such schema), then load the dump's own COPY block (15 rows). Check versions equal the repo `supabase/migrations/*` version prefixes (prior drill: identical, 20260917203000..20260929020000).
6. Trigger: recreate from `supabase/migrations/20260923000000_auth_user_provisioning.sql` lines 94-96 (`create trigger on_auth_user_created after insert on auth.users ... execute function public.handle_new_auth_user()`) ONLY AFTER auth.users data is loaded. LOCAL-VERIFIED ordering hazard: with the trigger present, an insert into auth.users under the normal role fired it and inserted into public.users (76 -> 77); under `session_replication_role=replica` it did not fire. Creating it before a non-replica auth load would conflict with/duplicate existing public.users rows.
7. Checks (counts only): per-table dump-vs-restored counts; migration versions diff; 25/25 FKs valid; every course has an active author row; `pg_trigger` has `on_auth_user_created`; relationship check below.
Relationship check (LOCAL-VERIFIED against a text staging copy): public.users 76, staged auth.users 73; 3 public.users ids have no auth row; 0 auth ids lack a public row; 0 orphan identities. public.users.id is conceptually auth.users.id with no FK, so a restore that drops auth.users cannot be detected by FK validation; this check must be explicit and its outcome reported as a count, not a pass/fail on 76==73.

## 3. Per-auth-table fidelity vs the image (LOCAL-VERIFIED column-by-column)
The image's `auth` schema is a legacy stub: only 5 tables (audit_log_entries, instances, refresh_tokens, schema_migrations[7 rows], users), no auth enums, no GoTrue migrations run, 0 users, no triggers. Dump COPY row counts in brackets.
| Auth table [rows] | Result vs image | Exact difference |
|---|---|---|
| instances [0] | compatible | none (empty) |
| audit_log_entries [0] | MISMATCH | dump-only column `ip_address` |
| users [73] | MISMATCH | dump-only: email_confirmed_at, email_change_token_new, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous; image-only: confirmed_at, email_change_token |
| refresh_tokens [73] | MISMATCH | dump-only `parent`, `session_id` |
| identities [73], sessions [68], mfa_amr_claims [68], flow_state [8], one_time_tokens [1] | TABLE MISSING | table absent from image |
| custom_oauth_providers, oauth_clients, mfa_factors, mfa_challenges, mfa_recovery_code_sets, mfa_recovery_codes, oauth_authorizations, oauth_client_states, oauth_consents, sso_providers, saml_providers, saml_relay_states, scim_tokens, scim_users, sso_domains, webauthn_challenges, webauthn_credentials [all 0] | TABLE MISSING | absent from image (empty in dump) |
Net: 1 of 26 auth tables is column-compatible and it is empty. Zero populated auth tables (users, identities, sessions, refresh_tokens, mfa_amr_claims, flow_state, one_time_tokens = 7 populated) can be restored faithfully into the image. Root cause is two-sided: the dump has no DDL, and the image's stub predates the hosted GoTrue shape (hosted is newer: oauth/webauthn/scim/custom provider tables, `auth.sessions.aal` needs enum `aal_level`, etc.).

Best truthful strategy (original files never modified; adaptation is done on a stream/copy inside the disposable DB):
- A. Staging copy (what is provable today): for each COPY block, derive an all-`text` table in schema `auth_dump_stage` from the block's own column list and load it with the block rewritten on the fly (`auth` -> `auth_dump_stage` in the COPY target). Proves file integrity, counts and the users relationship check. It is NOT an Auth restore (no types, constraints, or GoTrue ownership). Harness caveat: stop at the `supabase_migrations` block by cutting the stream, not by deleting its COPY header line (deleting only the header leaves its data rows to be parsed as SQL; observed).
- B. Column-list adaptation into the image's `auth.users`/`refresh_tokens` (insert the intersection only) would drop 15 users columns including email_confirmed_at, banned_until, is_sso_user: lossy; permitted only as an explicitly labelled lossy step, never as a recovery result.
- C. Faithful Auth (recommended future): install the GoTrue schema at the exact hosted GoTrue version first (run GoTrue migrations, or load a future auth-DDL dump), then load 03 unchanged. Until a backup carries the DDL/version, C cannot be done truthfully.

Result levels (a script prints exactly one; Auth omission can never print as full):
- FULL: public restored + counts equal + FKs valid + migration versions equal repo + trigger present + ALL non-empty auth tables loaded into real `auth` tables with identical column lists (0 omitted) and counts equal.
- PARTIAL(public=OK, auth_omitted=[list of every populated auth table not restored in real auth], migrations=OK|FAIL): public and history verified, auth only staged or lossy. Always print the omitted list and the line `AUTH NOT RECOVERED`. With this backup and this image the best achievable level is PARTIAL(auth_omitted=[users, identities, sessions, refresh_tokens, mfa_amr_claims, flow_state, one_time_tokens]).
- FAIL: any public count mismatch, invalid FK, load error in 01/02, migration-version diff, missing trigger, or a guard rejection.
Exit code: FULL=0, PARTIAL=2, FAIL=1; PARTIAL must not be consumable as success by CI/humans.

## 4. Secrets and privacy
auth data holds password hashes, tokens, session material and PII. Dumps stay in `C:\Users\dorko\UNLOCK-backups\` (outside the repo, so nothing to ignore or commit). Mount `:ro` only; never copy into the repo or image layers. The harness logs table names, column NAMES and integer counts only; psql runs with `-q`, stdout/stderr of COPY/INSERT redirected and filtered (error text may quote values: grep for the error class and count, do not echo raw lines). No `SELECT *` on auth tables; no printing of `.env*`; probe password is generated per run and throwaway. Reports contain no ids, emails or hashes.

## 5. Destructive-resource isolation, cleanup, no-hosted-reach proof
- Reuse the existing guard `supabase/tests/real-pg/local-pg-url.ts` (`assertLocalPgUrl`, commit 3dda311, tested by `src/infrastructure/postgres/real-pg-url-guard.test.ts`): allows hosts localhost/127.0.0.1/[::1] only; rejects any query string (so `?host=remote`, hostaddr, service), fragments, multi-host lists (comma), non-postgres protocols, ambiguous userinfo (`@` twice), and env `PGHOSTADDR/PGSERVICE/PGSERVICEFILE`; returns discrete {host, port, user, password, database} so the caller never passes the raw URL on. A shell/Node restore harness must call this (or a line-for-line port with the same tests) before any connection.
- The harness itself `docker run`s the engine with a unique name `unlock-restore-<runid>`, publishes `-p 127.0.0.1:<random high>:5432` (never `0.0.0.0`), and connects only to that port via the discrete pieces. Pure `docker exec ... psql -h 127.0.0.1` inside the container is the simplest form (proven this Slice and the prior drill: no psql on host).
- It never reads `DATABASE_URL`/`.env*`/supabase CLI config; any target not equal to the container it created is refused (compare `docker inspect` HostIp 127.0.0.1 and container name prefix) before restore. Destructive SQL (DROP/TRUNCATE/replica role) runs only after that proof.
- Cleanup in a `trap`/finally: `docker rm -f` container, remove its volume/network, then assert `docker ps -a --filter name=unlock-restore-` is empty and print the count (this Slice: 0). Never `docker system prune`; remove only resources the run created by name.
- No-reach proof: static grep of the harness for `supabase.co|pooler|DATABASE_URL|supabase (link|db push)` = 0 hits, plus guard tests above. Note that caveat from the prior drill remains: the guarantee rests on construction (only container-local connections), not an OS-level network sandbox; running the container with `--network none` is feasible for restore-only runs (no port needed when using `docker exec`) and is the strongest option.

## 6. Gap classification (with evidence)
| Class | Verdict | Evidence |
|---|---|---|
| backup-content | PRIMARY | 01 has no auth/supabase_migrations/role DDL or auth trigger; 03 has no `auth.schema_migrations`, so the GoTrue schema version cannot be reconstructed from the artifact |
| restore-order | SECONDARY, solvable | trigger-before-load duplicates public.users (76->77 observed); supabase_migrations DDL missing before COPY; `\restrict` psql-only |
| tooling | CONTRIBUTING | no psql/pg_dump/supabase CLI on host; docker-run-only; no repeatable script yet (prior drill FUB-009 note) |
| Supabase-managed | CONTRIBUTING, not ours to fix | the hosted auth schema is owned/migrated by GoTrue (supabase_auth_admin); the local image (17.6.1.166) ships an older stub, so even a perfect dump needs the matching GoTrue version applied. Not changeable from this repo |

## 7. Future backup command/artifact changes (RECOMMENDATION only; backup policy untouched)
For a faithful Auth DR the backup set should add, taken in the same snapshot/transaction as the data:
1. `00-auth-schema.sql`: schema-only dump of `auth` (`pg_dump --schema-only --schema=auth`, incl. enums/types, indexes, constraints, owner `supabase_auth_admin`) plus `auth.schema_migrations` DATA (so GoTrue version/state is known). Alternatively record the GoTrue version and replay its migrations.
2. `supabase_migrations` DDL (`--schema-only --schema=supabase_migrations`) next to its existing data.
3. Role/grant DDL: `pg_dumpall --roles-only` filtered to non-secret role definitions (names, memberships, attributes; no password hashes) or a documented list, plus `on_auth_user_created` captured by dumping the trigger via a `pg_dump --schema-only` of `auth` including triggers, or a restore step that replays the repo migration.
4. `MANIFEST.json`/`.txt` per backup dir: exact commands, pg_dump and server versions, GoTrue/Supabase platform version, UTC timestamp, per-file SHA-256, per-table row counts (public, auth, supabase_migrations), and the schema-mode of each file. The restore harness verifies manifest counts instead of re-deriving them and refuses a set whose manifest lacks auth DDL when claiming FULL.
5. Keep the one-directory-per-run layout outside the repo; encryption/retention remain human-owned (FUB-009).
Not covered by any of the above and still out of scope: storage objects, vault secrets, realtime/publications, edge functions, project settings.

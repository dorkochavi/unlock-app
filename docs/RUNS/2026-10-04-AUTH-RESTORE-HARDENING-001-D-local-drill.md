# AUTH-RESTORE-HARDENING-001 — Slice D: real LOCAL restore drill

Evidence label: **LOCAL-VERIFIED** (Docker Desktop, local image `public.ecr.aws/supabase/postgres:17.6.1.166`, `--network none`). No hosted access. Counts only; no row values recorded.
Backup: `pre-QACLEANUP-20261003-210229` (3 files, read-only mount, unmodified).

## Command
`node scripts/restore-local-backup.mjs restore <backup>` -> **RESULT: PARTIAL, exit 2** (stable across 4 runs). `AUTH NOT RECOVERED (staged for integrity only)`; omitted populated auth tables: flow_state, users, identities, sessions, mfa_amr_claims, one_time_tokens, refresh_tokens.
First real Docker run worked without modification (psql login, pg_hba, migrations DDL, readiness poll all fine).

## Positive checks
| Check | Result |
|---|---|
| public tables (12) rows vs dump COPY | all match: users 76, courses 11, daily_plans 91, materials 0, topics 16, questions 74, question_versions 69, daily_plan_items 280, attempts 190, course_authors 11, course_memberships 79, user_question_progress 131 |
| migration history | 15 rows = 15 repo versions, list identical |
| auth staged (26 tables) | all match; populated: users 73, identities 73, sessions 68, mfa_amr_claims 68, refresh_tokens 73, flow_state 8, one_time_tokens 1; 19 tables 0 |
| public FK integrity | 25 FKs, 0 orphan rows |
| public.users vs staged auth.users | 76 vs 73; 3 public without auth, 0 auth without public (73 of 76 public ids match staged ids) |
| the 3 public-without-auth users | 0 attempts, 1 membership, 0 course_authors rows between them (extra read-only query via --keep) |
| trigger / function | `on_auth_user_created` on auth.users (enabled) created after auth staging; `handle_new_auth_user()` present (from 01-schema) |
| real `auth.users` (image's own) | 0 rows: auth data is staged only, not restored |
| invariants from counts | attempts 190 > 0, question_versions 69 > 0; attempts without question_version 0; attempts without user 0; 6 questions have no question_version (informational: not an FK violation; not investigated) |
| queryability | count(*) on all 12 public tables succeeds |

## Negative scenarios
| Scenario | Observed |
|---|---|
| (a) `--url postgresql://postgres:x@db.abcdefgh.supabase.co:5432/postgres` | **Initial finding:** CLI had no `--url` handling (silently ignored). Fixed: exit 1 `restore refused: unsupported option --url`, no container created. Guard fn: `host is not local` |
| (b) `?host=evil.example.com`, `?hostaddr=1.2.3.4` | CLI exit 1 (unsupported option); guard fn: `query parameters are not allowed` (both) |
| (c) 03 truncated (100000 bytes) | validate exit 1, restore FAIL exit 1 (no dump-complete marker, unterminated block, 18/26 auth blocks, no migrations block); no container created |
| (c) 03 deleted / 02 deleted | validate exit 1; restore FAIL exit 1 (`missing file`) |
| (c) 02 truncated | validate exit 1; restore FAIL exit 1 (8/12 blocks, unterminated) |
| (c) 01 truncated | validate exit 1; restore FAIL exit 1 (9/12 CREATE TABLE) |
| (d) normal run | PARTIAL / `AUTH NOT RECOVERED`, exit 2, no "full recovery" wording |
| (d) all 26 auth COPY blocks removed from 03 | validate/restore FAIL exit 1 (0/26 blocks) |
| (d) auth blocks present but emptied (headers only) | **Initial finding:** restore returned `RESULT: FULL` exit 0 with public.users 76 and auth.users 0. Fixed: now PARTIAL exit 2 (`auth.users empty but public.users populated`) |

## Tooling bugs fixed (for Slice E review)
1. CLI silently ignored unknown options incl. `--url` -> now refused (exit 1) before Docker (`scripts/restore-local-backup.mjs`). Test: 3 CLI cases.
2. `classifyResult` could yield FULL when auth was emptied while learners exist -> new inputs `publicUsers`, `stagedAuthUsers` force PARTIAL (`scripts/lib/restore-local.mjs`). Test added. Runbook updated.

## Auth fidelity verdict
**Honest PARTIAL.** Public data and migration history are verified. Auth is NOT recovered: the backup carries no auth DDL and no GoTrue `auth.schema_migrations`, so the 73 users / 73 identities / 68 sessions / 73 refresh tokens are staged as all-text for integrity only. Users could not sign in from this restore. Real Auth recovery needs a backup that includes auth DDL + GoTrue version (see model doc section 7).

## Limitations
Local Docker only; does not prove hosted Supabase/GoTrue behaviour, multi-connection concurrency, or password-hash/session usability. Empty-auth FULL remains possible only for a backup with zero public users. The 6 questions without versions were not analysed. A pre-existing unrelated docker volume (hello-world era) was present and left alone.

## Cleanup
`docker ps -a --filter name=unlock-restore-` empty; no unlock-restore networks (default bridge/host/none only); scratch backup copies (PII) deleted. Kept container from the `--keep` probe removed with `docker rm -f -v`.

## Verification
vitest restore-local.test.ts 43/43; eslint touched files clean; tsc --noEmit clean.

## Post-review fixes (Slice E)
Security review findings fixed in `scripts/restore-local-backup.mjs` + `scripts/lib/restore-local.mjs`:
1. psql failure now yields NaN (not 0); count/FK/user checks and `classifyResult` treat non-finite as FAIL.
2. Cleanup always `docker rm -f -v` on own random name (covers failed/interrupted `docker run`).
3. `DOCKER_CONTEXT` non-default refused + stripped from child env; active context endpoint must be local; docker env checked first.
4. `--publish` drops `--network none`: documented in runbook (not otherwise preventable).
5. Backup dir with `,`/`"`/newline refused (mount-option injection). 6. `--keep=x`/`--image=x` forms refused.
Evidence: vitest restore-local 57/57, eslint + tsc clean; re-ran drill: PARTIAL exit 2, identical counts, 0 containers left.

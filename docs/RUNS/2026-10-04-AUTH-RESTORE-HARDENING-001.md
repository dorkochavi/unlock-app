# UNLOCK — Run Report: 2026-10-04-AUTH-RESTORE-HARDENING-001

Run: `2026-10-04-AUTH-RESTORE-HARDENING-001`
Status: COMPLETE
Result: PARTIAL by design (local tooling DONE; Auth restore PARTIAL; FUB-009 narrowed, not closed)
Baseline (START_HEAD): `d052bad` (Plan-only identity commit `b05f988` above it)
Branch: `feature/run-010-learning-intelligence` (local commits only, not pushed)
HOSTED_MUTATION: NONE. REMOTE_GIT_MUTATION: NONE. No product semantics changed.

## 1. Goal
Smallest durable, repeatable LOCAL restore procedure/tooling restoring as much of the real backup as safely possible, Auth included
where technically possible; truthful PARTIAL otherwise.

## 2. Slices
| Slice | Commit | Result |
|---|---|---|
| A | (Plan `b05f988`) | Grounding. |
| B | `a40ae91` | Restore model doc: ordering, guards, gap classification. |
| C | `38a48ca` | `scripts/restore-local-backup.mjs` + `scripts/lib/restore-local.mjs` + `docs/RESTORE_RUNBOOK.md`; 39 tests; local-only guards. |
| D | `d9c9bbe` | Real local drill: exit 2 PARTIAL. Public 12 tables match dump, 25 FKs 0 orphans, 15 migrations = repo. Auth only STAGED (all-text schema; users 73, identities 73, sessions 68, mfa_amr_claims 68, refresh_tokens 73, flow_state 8, one_time_tokens 1); `on_auth_user_created` recreated after load. public.users 76 vs staged auth.users 73 (3 without auth, 0 attempts). Negatives (a)-(d) proven. Two tooling bugs fixed (silent unknown option incl. `--url`; empty-auth reported FULL). |
| E | `b447b0b` | Independent security review: 1 correction (`num()` swallowed psql failure) + 5 hardenings; fixed; re-review no findings; 57 tests. |
| F | `518dcba` | FUB-009 narrowed; PILOT_READINESS 13c note; CONTEXT_MAP row. |
| G | `7f7d4fb` | Telemetry WATCH: practice issue, not a code defect (collector takes the FIRST `CURRENT_SLICE` line); keep one line; SKILL §6 +2 lines. |
| H | this commit | Run-close docs. |

## 3. Gap classification
- Backup-content (primary): dumps lack auth DDL, GoTrue version, trigger DDL, `supabase_migrations` DDL, roles; dump command undocumented.
- Restore-order (secondary): solved. Local tooling: solved. Supabase-managed auth DDL limitation: real.
- Faithful Auth DR needs future backup artifacts (auth schema-only DDL + `auth.schema_migrations` data, `supabase_migrations` DDL,
  roles/grants, trigger, MANIFEST with commands/versions/sha256/row counts): a human-gated backup-procedure change.

## 4. Evidence (provenance)
- `restore-local.test.ts` 57/57, eslint, `tsc --noEmit`: green at `b447b0b`; F and G are Markdown-only, so evidence is reused.
- Real drill PARTIAL exit 2 at `b447b0b` (no code change after). Final check this slice: targeted vitest of `restore-local.test.ts` + `real-pg-url-guard.test.ts`.
- Independent security review: see E. `--publish` removes `--network none` (documented).

## 5. Invariants
I1-I3 no hosted/Production mutation, no push/merge/tag; I4 no product semantics; I5 non-local hosts rejected (tested); I6 no secrets
in repo; I7 no false PASS (empty/omitted Auth never reports FULL); I8 human decisions not closed.

## 6. Human / deferred
- Human: backup owner/frequency/RPO/RTO/plan+PITR/retention + encryption of PII dumps; backup-procedure change above.
- Unproven: hosted restore, sign-in usability on restored Auth, concurrency.
- Informational, uninvestigated, untracked: 6 questions without `question_version` seen in the drill data; not added to the backlog.

## 7. Telemetry (mechanism)
Run attributed A..G with 0 unattributed events of 198 at Slice G; see `docs/DEVOS_OBSERVABILITY.md` §11 for semantics.

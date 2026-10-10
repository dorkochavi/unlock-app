# UNLOCK — Pilot Clean Slate Reset Runbook

Status: PROPOSED — audit + dry-run only (Run `2026-10-10-PILOT-CLEAN-SLATE-RESET-001`). **Nothing in this document has been executed against hosted data.**
Reset verdict today: **BLOCKED_PENDING_BACKUP** (§4). Execution requires a separate human-approved step: `HUMAN_APPROVAL_REQUIRED: PILOT CLEAN SLATE RESET`.
Companions: `docs/BACKUP_DR_POLICY.md`, `docs/RESTORE_RUNBOOK.md`, `.claude/rules/postgres.md` (hosted safety), `.claude/rules/auth.md` (secrets).
Inventory: `scripts/pilot-clean-slate-inventory.sql` (SELECT-only). Proof of the SQL in §6: `supabase/tests/postgres/pilot-clean-slate-inventory.test.ts` (PGlite).

## 1. Intent

Fresh Pilot/product-review starting point. Keep exactly ONE human-owned Auth user and its `public.users` identity row. Remove every other Auth user and all product data, **including every Course, Topic, Question and membership the preserved account owns**.

## 2. Schema audit (repository truth: migrations through `20260929020000`)

| Entity | Notes | FK behaviour |
|---|---|---|
| `auth.users` (Supabase) | Authentication. `public.users` has **no FK** to it (`20260923000000`). Trigger `on_auth_user_created` is INSERT-only. | GoTrue cascades identities/sessions/tokens/MFA |
| `public.users` | Identity only (`id`, `created_at`, `timezone`). Holds **no role**. | referenced by all below with `ON DELETE RESTRICT` |
| `courses` | `owner_user_id → users` | RESTRICT |
| `course_authors` | Management capability (OWNER/INSTRUCTOR) per Course. **This is the only "instructor" representation; there is no global Instructor/Admin flag.** | RESTRICT to users, courses |
| `course_memberships` | LEARNER-only participation | RESTRICT |
| `materials` | `course_id`, `created_by` | RESTRICT; `questions.material_id` SET NULL |
| `topics` | `course_id`; `questions (topic_id, course_id)` | RESTRICT |
| `questions` | `current_version_id` ↔ `question_versions` circular, nullable, **not deferrable** | RESTRICT |
| `question_versions` | prompt, `answer_options` jsonb, `correct_answer` jsonb (answers/options live here); drafts live as `draft_*` columns on `questions` | RESTRICT |
| `daily_plans` / `daily_plan_items` | Today/DailyPlan; items CASCADE from plans, RESTRICT to question_versions | mixed |
| `attempts` | answers/learning history; refs plan/item with SET NULL, RESTRICT to question_versions/questions/users | RESTRICT |
| `user_question_progress` | mastery/misconception/FSRS-family scheduling state per (user, question) | RESTRICT |

- No import-job or audit/event table exists (import creates DRAFT questions only). No `today_sessions` (retired `20260929000000`).
- No DB-level immutability trigger exists on attempts/question_versions, so history is deletable by plain `DELETE` (immutability is an application invariant). The reset is a deliberate, human-approved exception to "never rewrite history"; it deletes history wholesale rather than editing it.
- Storage: no Supabase Storage usage found in `src/`. Confirm hosted state with `storage_inventory`.
- Edge cases: (a) `RESTRICT` everywhere ⇒ delete order is mandatory; (b) `questions ↔ question_versions` cycle ⇒ null `current_version_id` before deleting versions; (c) deleting an Auth user does **not** delete its `public.users` row (and vice-versa) ⇒ two separate cleanups; (d) the preserved user loses all Course authority on reset (their `course_authors` rows are deleted) — they remain able to sign in and may create a new Course (`createCourse` needs only an authenticated user and grants an OWNER `course_authors` row); verify in §8.

## 3. Identifying the preserved account (safe human procedure)

The id is supplied by the human at execution time; it is never committed.
1. Run `auth_candidates` (masked email, created/last sign-in, active author grant). Pick the one that is yours.
2. Confirm by signing in to the app as that account and, if needed, matching the id in the Supabase dashboard (Authentication → Users).
3. Run `preserved_auth_identity` with that id (must return exactly 1 row: the Auth user, masked email), then `preserved_account_footprint`. Required before any destructive step, show: preserved auth user id; masked email; `preserved_in_public_users = 1`; the Courses/grants/memberships/attempts it holds (**these WILL be deleted**).
4. `preserved_in_public_users = 0`, OR `preserved_auth_identity` returns 0 rows ⇒ STOP (Auth/profile divergence or wrong id: the id must exist in BOTH `auth.users` and `public.users`; §6A alone only checks `public.users`, so §6B must never run on an id that failed this check).

The destructive SQL in §6 takes the id only via the placeholder `PASTE-PRESERVED-AUTH-USER-UUID`, which is an invalid uuid: an unreplaced paste fails closed.

## 4. Backup / recovery gate

Policy requires an extra `pre-destructive` FULL backup before a destructive/irreversible data operation (`BACKUP_DR_POLICY.md` Frequency). Repository-documented evidence: the only real Production backup is 2026-10-04 (FULL drill passed; encrypted local + Google Drive copy). It predates the Pilot content/test activity since, and no `pre-destructive` backup is recorded ⇒ **BLOCKED_PENDING_BACKUP**.

Required immediately before reset (all must be citable):
0. Order with no writes in between: backup → final inventory → §6A → §6B. Announce a write freeze (no learner/instructor activity) from backup start to §6B end; anything written after the backup timestamp is unrecoverable.
1. `npm run backup:create -- --label pre-destructive --out <dir outside repo> --confirm-read-only-source` → `backup:validate` = FULL_CANDIDATE.
2. `backup:encrypt`, off-device encrypted copy, key custody confirmed.
3. A disposable `restore:local` drill on that backup = FULL. **Mandatory**, unless the owner explicitly accepts FULL_CANDIDATE in writing in the Decision Packet (Auth deletion cannot be undone by anything else; hosted restore itself is unproven).
4. Timestamp (manifest `created_at`), restore location, and the preserved-account id recorded in the Decision Packet.
Agents do not create the hosted backup without explicit authorization (reads production via the human-supplied `SUPA_DB_URL`).

## 5. Read-only hosted inventory — human commands

No hosted access was used in this Run (agents hold no hosted credentials; `.claude/rules/postgres.md`). The human runs, in the Supabase SQL editor, each query from `scripts/pilot-clean-slate-inventory.sql` one at a time: `public_inventory`, `public_unknown_tables` (must be empty), `auth_candidates`, `auth_inventory`, `auth_divergence`, `storage_inventory`, then with the preserved id: `preserved_account_footprint`, `reset_expectation`, `orphan_checks`. Wrap in `begin read only; …; rollback;` if using psql.

## 6. Proposed reset — three separate boundaries

Order: **A (SQL) → B (Auth) → C (Storage if any)**. SQL is transactional and runs first; irreversible Auth deletion runs last, only after SQL success is verified. Re-runnable: deletes on empty tables are no-ops.

### A. Application database cleanup (single transaction)

Paste only after the Decision Packet is approved. Replace `PASTE-PRESERVED-AUTH-USER-UUID` in **both** places it occurs in the block (global find/replace).

```sql reset-sql
begin;
set local lock_timeout = '5s';
lock table attempts, user_question_progress, daily_plan_items, daily_plans, course_memberships,
  course_authors, question_versions, questions, topics, materials, courses, users
  in access exclusive mode;

do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name not in ('users','courses','materials','topics','questions','question_versions','course_authors',
        'course_memberships','daily_plans','daily_plan_items','attempts','user_question_progress')
  ) then
    raise exception 'unknown public table present; plan is stale; aborting';
  end if;
  if not exists (select 1 from users where id = 'PASTE-PRESERVED-AUTH-USER-UUID'::uuid) then
    raise exception 'preserved user not found in public.users; aborting';
  end if;
end $$;

delete from attempts;
delete from user_question_progress;
delete from daily_plan_items;
delete from daily_plans;
delete from course_memberships;
delete from course_authors;
update questions set current_version_id = null;
delete from question_versions;
delete from questions;
delete from topics;
delete from materials;
delete from courses;
delete from users where id <> 'PASTE-PRESERVED-AUTH-USER-UUID'::uuid;

do $$
begin
  if (select count(*) from users) <> 1
     or (select count(*) from courses) + (select count(*) from questions) + (select count(*) from question_versions)
      + (select count(*) from attempts) + (select count(*) from daily_plans) + (select count(*) from daily_plan_items)
      + (select count(*) from user_question_progress) + (select count(*) from course_memberships)
      + (select count(*) from course_authors) + (select count(*) from topics) + (select count(*) from materials) <> 0
  then
    raise exception 'post-reset assertion failed; rolling back';
  end if;
end $$;
commit;
```

Hosted must have applied migrations through `20260929020000` (confirm `supabase_migrations` first; a missing table makes `lock table` error and roll back). Run in a role that owns the tables (e.g. `postgres`); under RLS-subject roles deletes would affect 0 rows and the post-assertion rolls back. The drift guard aborts if any unknown public table exists. Properties: no `TRUNCATE`, no schema change, no `auth` schema touch, preserved row guarded before and asserted after, any error rolls the whole transaction back. Locks block concurrent learner writes for the duration.

### B. Supabase Auth cleanup (not SQL)

Run B immediately after A. A signup in the A→B window creates a `public.users` row via the trigger; it shows as `public_users_without_auth` or a new non-preserved user, and is removed by re-running §6A (idempotent; guard and preserved id unchanged). `lock table users` also stalls Auth signups while A runs. Supported boundary: Supabase Auth Admin API `auth.admin.deleteUser(id)` (service-role key, **server-side/human-side only**, never committed or pasted into chat) or Dashboard → Authentication → Users. Never `delete from auth.users` by SQL, and never "delete all users". Procedure: list users, delete each id **except** the preserved id; re-run `auth_inventory` ⇒ `auth_users = 1`, `auth_divergence` both 0. Server-side `auth.getUser()` fails closed for deleted users, so their lingering JWTs stop working. Account/Auth deletion is **irreversible** except via backup restore.

### C. Storage

None expected (`storage_inventory`). If objects exist they are outside this plan; decide separately.

## 7. After the reset

Remains: one `auth.users` row (+ its identities), one `public.users` row for the same id, schema/migrations/functions/trigger. Deleted: everything else listed in §2 (all Courses incl. the preserved user's, all content, memberships, attempts, plans, progress, all other Auth users). The preserved user keeps Auth sign-in but has no Course authority until they create a new Course.

## 8. Post-reset verification (human)

`public_inventory` = users 1, others 0; `orphan_checks` all 0; `auth_inventory`/`auth_divergence` per §6B; sign in as the preserved account; open `/instructor`; create a throwaway Course to prove authoring still works (then it is real fresh state — archive or keep as the Pilot Course per the human).

## 9. Decision Packet (to be completed immediately before execution)

1. Environment: hosted Production (project ref: human to state) — Free plan, no PITR/managed backups.
2. Preserved account: id + masked email (from `preserved_account_footprint`).
3. Backup evidence: §4 items 1–4 with timestamps and restore location.
4. Current row counts by entity: `public_inventory`, `auth_inventory`.
5. Rows expected to remain: users 1, auth.users 1.
6. Rows expected to be deleted: `reset_expectation` (`non_user_rows_to_delete`, `delete_candidates_users`) + Auth users − 1.
7. Exact actions: §6A SQL as pasted, §6B deletions by id list, §6C none.
8. Rollback/restore path: `backup:decrypt` → `restore:local` drill proven; hosted restore itself is **not** proven (BACKUP_DR_POLICY "NOT proven": no hosted restore/DR, no PITR).
9. Irreversible boundaries: Auth user deletion; no hosted restore rehearsal; Free plan (no PITR); sequences/storage/vault not in the backup.
10. `HUMAN_APPROVAL_REQUIRED: PILOT CLEAN SLATE RESET`

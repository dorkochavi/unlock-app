# Real-Postgres Concurrency Verification Plan

Status: **PLAN ONLY — NOT EXECUTED**. This document designs a future test
suite. No Postgres/Docker/Supabase CLI infrastructure was started or run to
produce it, and none of the scenarios below have been observed to pass or
fail against a real server. Docker/Supabase CLI are unavailable in this
session's environment; this plan exists so the work is scoped and ready to
run the moment that tooling is available, per this repo's own instruction
not to fake proof of concurrency behavior that PGlite cannot provide.

## Why this document exists

The current test suite proves two different things, neither of which is
"real Postgres concurrency":

- **`supabase/tests/schema.integration.test.ts` and `supabase/tests/postgres/*.test.ts`**
  run against PGlite (`@electric-sql/pglite`), an in-process WASM build of
  real PostgreSQL (`supabase/tests/postgres/db-harness.ts`). This proves the
  migrations apply cleanly, every constraint/CHECK/composite-FK actually
  fires as designed, and single-connection SQL (including
  `pg_advisory_xact_lock`, `INSERT ... ON CONFLICT`) executes and returns
  correct results. PGlite is **one process, one connection** — there is no
  second concurrent backend to contend with, so nothing in this suite can
  observe one transaction blocking on another.
- **`src/application/learning/__tests__/in-memory-fakes.ts`** proves
  application-layer orchestration (idempotency short-circuiting, ownership
  validation, rollback-on-error, "domain engine called only for genuine new
  Attempts"). Its own doc comment is explicit: `acquireLearnerQuestionLock`
  there is a no-op that only records it was called, and JavaScript's
  single-threaded execution model makes it structurally impossible for two
  `runInTransaction` calls to interleave the way two real concurrent
  Postgres transactions could.

ADR-010 (`docs/DECISIONS/010-answer-submission-transaction-model.md`) and
ADR-011 (`docs/DECISIONS/011-today-is-course-scoped-v1.md`) both make
specific, falsifiable claims about behavior under real concurrency
(`pg_advisory_xact_lock` closing the first-Attempt race; `INSERT ... ON
CONFLICT DO NOTHING RETURNING` + fallback `SELECT` being race-free for
`TodaySession` creation). Those claims are currently backed by careful
hand-tracing and single-connection tests, not by observing two real
connections actually race. This is stated as an open gap in
`PostgresUnitOfWork`'s own doc comment
(`src/infrastructure/postgres/postgres-unit-of-work.ts`).

## Scenarios

For each scenario: **Setup**, **Connection A**, **Connection B**, **Expected
blocking/order**, **Expected persisted rows**, **Failure signal** (what a
broken implementation would produce instead), **What PGlite already
proves**, **What only real Postgres proves**.

---

### 1. Advisory-lock blocking with two real connections

**Setup**: Real Postgres (or Supabase local dev via `supabase start`), full
migration chain applied. Seed one `users` row, one `courses` row, one
`questions` row, one `question_versions` row (`correctOptionIds: ["A"]`).
**No `user_question_progress` row exists yet** — this is the specific case
ADR-010 says row-level locking (`SELECT ... FOR UPDATE`) cannot protect,
because there is no row to lock.

**Connection A** (`pg` client #1):
```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('<user-1>' || ':' || '<question-1>', 0));
-- pause here (test harness controls timing, e.g. via a manual
-- continuation signal or a deliberate `pg_sleep(2)`), do NOT commit yet
```

**Connection B** (`pg` client #2), started while A is paused and holding the
lock:
```sql
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('<user-1>' || ':' || '<question-1>', 0));
-- this call must BLOCK (not return) until A commits or rolls back
```

**Expected blocking/order**: B's `pg_advisory_xact_lock` call does not
return while A's transaction is open. The test asserts this by racing a
timer against B's query promise — B's promise must not resolve before a
fixed delay (e.g. 500ms) that only elapses because A is still holding the
transaction open, and must resolve promptly (within a smaller tolerance)
once A commits.

```sql
-- A commits:
COMMIT;
-- B's blocked query now returns; B proceeds and commits.
```

A variant of this scenario runs the **full `submitAnswer` sequence** (not
bare `pg_advisory_xact_lock` calls) on both connections for the same
`(user_id, question_id)` pair with two different valid `submissionId`s, and
asserts that B's `SELECT ... progress WHERE (user_id, question_id) = ...`
(ADR-010 step 4) only executes, and only sees a `user_question_progress`
row, after A's transaction has committed — proving the lock, not luck of
scheduling, is what serializes the two.

**Expected persisted rows**: exactly one `user_question_progress` row for
`(user_id, question_id)`, whose `attempt_count` reflects **both** Attempts
having been folded in sequence (2, not 1, and not a value implying either
Attempt was silently dropped or double-counted). Two `attempts` rows, one
per `submission_id`.

**Failure signal**: if the lock did not actually serialize the two
transactions, B's `SELECT` in step 4 could return `NULL` (no progress row)
at the same moment A's insert-then-read is also computing from `NULL` —
both would then independently compute `attemptCount: 1` and one `UPSERT`
would silently overwrite the other's result, leaving `attempt_count = 1`
in the database despite two Attempts existing. This is exactly the race
ADR-010's "First-progress-row concurrency" section names as the reason a
bare `SELECT ... FOR UPDATE` was rejected.

**What PGlite already proves**: `pg_advisory_xact_lock`/`hashtextextended`
execute without error and the SQL is well-formed
(`src/infrastructure/postgres/postgres-unit-of-work.ts`'s own doc comment
already states this explicitly). It does **not** prove blocking.

**What only real Postgres proves**: that a second real backend actually
waits, and that this wait is what prevents the lost-update race described
above.

---

### 2. Concurrent first Attempt for the same user/question

**Setup**: Same as scenario 1 — no `user_question_progress` row yet for
`(user-1, question-1)`.

**Connection A**: full `submitAnswer(commandA, context, uow)` where
`commandA.submissionId = "sub-A"`, `selectedAnswer: "A"` (correct).

**Connection B**: full `submitAnswer(commandB, context, uow)`, started
concurrently (not sequentially awaited), where `commandB.submissionId =
"sub-B"`, `selectedAnswer: "B"` (incorrect), same `(user_id, question_id)`.

**Expected blocking/order**: whichever transaction acquires the advisory
lock first runs to completion (insert Attempt, read `previousProgress =
NULL`, fold via `applyAttemptToProgress`, upsert progress, commit) before
the other transaction's own `SELECT ... progress` (step 4) executes. There
is no fixed "A always wins" requirement — either interleaving order is
correct, as long as the two are never concurrent past the lock acquisition
point.

**Expected persisted rows**: two `attempts` rows (`sub-A` and `sub-B`).
Exactly one `user_question_progress` row for `(user-1, question-1)` with
`attempt_count = 2`, `correct_count = 1` (only the correct one of the two
counted), and every counter/timestamp field reflecting both Attempts having
been folded — never `attempt_count = 1` (one Attempt's fold clobbered by
the other) and never a thrown unique-constraint violation on
`user_question_progress`'s primary key (which would indicate two concurrent
`INSERT`s racing instead of being serialized).

**Failure signal**: `attempt_count = 1` after both transactions commit
(lost update), or a primary-key violation surfaced to the caller as an
unexpected error, or `correct_count` reflecting only one Attempt's
correctness rather than the fold of both.

**What PGlite already proves**: the full `submitAnswer` sequence executes
correctly end-to-end for a *single* first Attempt
(`supabase/tests/postgres/submit-answer.test.ts` — not read in this
session, but this is the class of case that file's single-connection
coverage already exercises). It does not prove the two-connection race is
actually excluded, only that the sequential/single-writer path is correct.

**What only real Postgres proves**: that launching both transactions
genuinely concurrently (not one-after-the-other in test code, which PGlite
would force anyway) still produces `attempt_count = 2`, not 1.

---

### 3. Concurrent identical `submissionId`

**Setup**: Same seed as scenario 1.

**Connection A** and **Connection B**: the exact same `SubmitAnswerCommand`
(same `submissionId = "sub-dup"`, same every field), submitted
concurrently, not sequentially.

**Expected blocking/order**: both transactions reach the fast-path
`findByUserAndSubmissionId` check (which may race and both see `null`, per
that method's own documented "does not itself close any race" contract —
`src/application/learning/ports.ts`). Both then proceed to
`insertIfNotExists`'s `INSERT ... ON CONFLICT (user_id, submission_id) DO
NOTHING`. Exactly one of the two inserts actually creates a row; the other
sees zero rows affected and takes the `handleExistingAttempt` path,
validating the loser's own command against the winner's now-committed
Attempt and returning it as a safe retry (per ADR-010's idempotency-conflict
validation — the two commands are identical here, so this must be a clean
`ACCEPTED` for both, never a thrown `IdempotencyKeyConflict`).

**Expected persisted rows**: exactly one row in `attempts` for
`(user_id="user-1", submission_id="sub-dup")` — the `UNIQUE (user_id,
submission_id)` constraint's entire purpose. Exactly one
`user_question_progress` row reflecting `attempt_count = 1` (the Attempt
folded exactly once, not twice).

**Failure signal**: two rows in `attempts` for the same `(user_id,
submission_id)` (constraint not actually enforced under real concurrent
`INSERT`s — would indicate the `UNIQUE` index itself is missing or broken,
not an application bug), or `attempt_count = 2` (the same logical Attempt
folded twice because both connections raced past `insertIfNotExists`
believing they were `wasNew: true`), or one of the two calls returning
`IDEMPOTENCY_KEY_CONFLICT` for what is actually the same command (a
`findConflictingFields` bug surfacing under real timing that a
single-connection test can't produce).

**What PGlite already proves**: the sequential case (`submitAnswer` called
twice, one after the other, same command) already returns
`wasIdempotentRetry: true` on the second call
(`src/application/learning/__tests__/submit-answer.test.ts`, test "2").
This proves the *logic* of conflict validation and the "genuine retry
returns the original result" path — it does not prove the `UNIQUE`
constraint itself wins a real simultaneous-insert race, since PGlite never
attempts two inserts at the same instant.

**What only real Postgres proves**: that the database's own unique index,
under a genuine simultaneous `INSERT`, is what guarantees exactly one row
survives — this is a property of PostgreSQL's MVCC/index implementation,
not of this codebase's code, and can only be observed by actually racing
two backends against it.

---

### 4. Concurrent Today `createIfNotExists`

**Setup**: Real Postgres, migrations applied. Seed one `users` row, one
`courses` row, and enough `user_question_progress`/`questions` data that
`getOrCreateTodaySession` would generate at least one `TodaySessionItem`
(so the multi-row item insert path — not just the empty-plan path — is
exercised under the race).

**Connection A**: `getOrCreateTodaySession({userId, courseId,
plannedForDate: "2026-03-01"}, context, uow)`.

**Connection B**: the same call, same key, started concurrently.

**Expected blocking/order**: both transactions independently compute a
candidate plan (both may call `generateNextBestActionCandidates`/
`rankNextBestActionCandidates`/`generateTodayPlan` and arrive at equivalent
`TodayPlanItem[]`, since both read the same `user_question_progress` rows —
there is no lock preventing this, by design, since `TodaySessionRepository
.createIfNotExists` is documented as race-free "by Postgres's own
unique-index insert semantics," not by an advisory lock). Both then race
`INSERT INTO today_sessions (...) ON CONFLICT (user_id, course_id,
planned_for_date) DO NOTHING RETURNING *`. Exactly one insert returns a row
and proceeds to insert its `today_session_items` rows in the same
transaction; the other returns zero rows and falls back to `SELECT ...
today_sessions WHERE (user_id, course_id, planned_for_date) = ...` (loading
the winner's session, per `PostgresTodaySessionRepository.createIfNotExists`
— `src/infrastructure/postgres/today-session-repository.ts`).

**Expected persisted rows**: exactly one `today_sessions` row for
`(user_id, course_id, planned_for_date)`. Exactly one set of
`today_session_items` rows (the winner's), matching the `UNIQUE
(today_session_id, position)` / `UNIQUE (today_session_id, question_id)`
constraints — never two independent sets of items for two different
`today_session_id`s under the same logical key (which the `UNIQUE
(user_id, course_id, planned_for_date)` constraint on `today_sessions`
itself already forbids at the session level, but the *items* insert from
the losing transaction must also never partially land). Both connections'
`getOrCreateTodaySession` calls must return **equivalent** `TodaySession`
objects (same `id`, same `items`) to their respective callers — the loser
must not return its own locally-computed (and now-discarded) plan.

**Failure signal**: two `today_sessions` rows for the same key (constraint
not enforced under real concurrent `INSERT`, same class of bug as scenario
3), or the losing transaction's `today_session_items` INSERTs partially
succeeding before its outer `today_sessions` INSERT is discovered to have
lost the race (a transaction-boundary bug — the loser's `INSERT ... DO
NOTHING RETURNING` returns zero rows immediately, so the current
implementation never reaches its own item-insert loop for the loser; a
regression here would mean that early-return check was removed or
short-circuited incorrectly), or the loser's returned `TodaySession` object
not matching the winner's persisted state (stale-read bug in the fallback
`SELECT`).

**What PGlite already proves**: `PostgresTodaySessionRepository
.createIfNotExists`'s SQL is syntactically correct, the `ON CONFLICT ...
DO NOTHING RETURNING` clause behaves correctly for a *sequential*
call-then-call-again pattern (`src/application/learning/__tests__
/today-session.test.ts`'s "Today create race" test title is aspirational
today — it currently only proves the sequential case via the in-memory
fake, not a real race), and the fallback `SELECT` correctly loads an
existing session.

**What only real Postgres proves**: that two genuinely simultaneous
`INSERT`s against the same unique key are actually serialized by
PostgreSQL's index machinery such that only one item-insert sequence ever
runs to completion, with the loser cleanly falling back rather than
partially writing conflicting item rows.

---

### 5. Transaction rollback under connection failure

**Setup**: Real Postgres. Seed a valid question chain as in scenario 1, no
prior `user_question_progress`.

**Connection A**: begin `submitAnswer`'s transaction manually (not via the
full `PostgresUnitOfWork.runInTransaction` helper, so the test can inject a
failure mid-sequence): acquire the advisory lock, insert the `Attempt`
successfully, then **force the connection to fail** before the
`user_question_progress` upsert — e.g. by having the test harness kill the
underlying socket (`pg` client's `.end()` mid-transaction, or a Postgres
`pg_terminate_backend(pid)` from a second admin connection) instead of
letting `applyAttemptToProgress`/`upsert` run.

**Connection B** (a fresh connection, after A's forced failure): query
`SELECT * FROM attempts WHERE user_id = ... AND question_id = ...` and
`SELECT * FROM user_question_progress WHERE user_id = ... AND question_id =
...`.

**Expected blocking/order**: not applicable (this scenario is about
failure atomicity, not lock contention) — but note that A's advisory lock
must be released as a side effect of the connection dying (Postgres
releases all session-held locks, including transaction-scoped advisory
locks, when the backend terminates), so B's own attempt to acquire the same
lock afterward must succeed promptly, not hang forever waiting on a lock
orphaned by a dead connection.

**Expected persisted rows**: **zero** rows in `attempts` and **zero** rows
in `user_question_progress` for this `(user_id, question_id)` — the
`Attempt` insert that succeeded before the forced failure must not survive,
because it was never committed. This is the same guarantee
`submit-answer.test.ts`'s test "12" already proves for an *application-level
thrown error* (`progress.upsert` throwing inside the same JS process); this
scenario proves the equivalent for a real *connection-level* failure, which
JavaScript-level `try/catch` in `PostgresUnitOfWork.runInTransaction` cannot
observe or roll back itself — Postgres's own transaction semantics (an
aborted/dropped connection never commits) are what must actually provide
this guarantee, not this codebase's code.

**Failure signal**: an `attempts` row exists for this pair with no
matching `user_question_progress` row — the exact "one step succeeds,
another silently fails" partial-write state `docs/ARCHITECTURE.md` §21
prohibits, and which would be reachable only if some part of the write path
was, contrary to ADR-010, executing outside the single enclosing
transaction (e.g. a connection-pool implementation that silently
auto-commits per statement).

**What PGlite already proves**: `PostgresUnitOfWork.runInTransaction`
correctly issues `ROLLBACK` and re-throws when `fn` throws a JS-level error
(the rollback-error-swallowing bug this file's own comment describes having
already avoided), and a rollback undoes an in-progress PGlite transaction's
writes. It does not prove behavior when the *connection itself* is lost
mid-transaction (PGlite has no separate connection to drop — the "backend"
and the JS process are the same thing), which is a materially different
failure mode from a caught JS exception.

**What only real Postgres proves**: that a real dropped/killed connection
mid-transaction — not a caught exception — still results in zero partial
writes, and that any advisory lock held by that connection is released
promptly rather than orphaned.

---

### 6. FK / RLS behavior against real Supabase/Postgres roles

This scenario has two parts: what can be verified **today**, and what a
future suite must verify **once Auth exists**.

**Part A — verifiable today, not yet executed**: `docs/DECISIONS
/013-supabase-postgresql-as-v1-persistence-provider.md` claims RLS is
enabled on every V1 table with zero policies, making `anon`/`authenticated`
genuinely deny-by-default via PostgREST, while `service_role`
(`BYPASSRLS`-attributed) retains full access. This is a claim about
Supabase-specific roles (`anon`, `authenticated`, `service_role`) that do
not exist in a bare PGlite instance or a vanilla `postgres` Docker image —
they are created by Supabase's own bootstrap SQL. Verifying Part A
therefore requires either a real Supabase local stack (`supabase start`,
which provisions these roles) or manually creating equivalent roles with
`NODEFAULTS`/no `BYPASSRLS` in a plain Postgres instance and granting them
`anon`/`authenticated`-equivalent privileges before testing.

**Setup**: `supabase start` (or equivalent), migrations applied.

**Connection A** (as `anon` or `authenticated`, e.g. `SET ROLE
authenticated;` after connecting as a superuser, or via `psql
"postgresql://...&options=..."` with the anon/authenticated JWT through
PostgREST directly): attempt `SELECT * FROM attempts;`, `SELECT * FROM
user_question_progress;`, `SELECT * FROM courses;`, and equivalent
`INSERT`/`UPDATE` statements against each V1 table.

**Expected persisted rows / result**: every query returns **zero rows**
(not an error — RLS with no policies filters rows to nothing for `SELECT`,
and rejects `INSERT`/`UPDATE`/`DELETE` for roles without `BYPASSRLS`) for
`anon`/`authenticated`, on every table listed in
`docs/PERSISTENCE_SCHEMA_V1.md`. `service_role` (or a superuser/table-owner
connection) sees and can modify all rows normally.

**Failure signal**: `anon`/`authenticated` successfully reading or writing
any row — would mean RLS is not actually enabled on some table, or a
permissive policy was accidentally introduced, silently reversing ADR-013's
deliberate deny-by-default posture.

**What PGlite already proves**: nothing about this — PGlite tests connect
with a single implicit superuser-equivalent role and have never asserted
anything about `anon`/`authenticated`/`service_role` behavior.

**What only real Postgres/Supabase proves**: that the actual
Supabase-provisioned roles, with their actual privilege attributes, are
denied as designed.

**Part B — deferred until `docs/OPEN_QUESTIONS.md` #1 is resolved**: once
the User↔Course authorization model is decided and real RLS policies are
written, a future suite must verify, per policy, per table, at minimum:

- a learner can `SELECT` their own `attempts`/`user_question_progress`/
  `today_sessions` rows and **cannot** `SELECT` another learner's;
- a learner can `INSERT` an `attempts` row only for their own `user_id`
  (never spoofing another learner's `user_id`, mirroring
  `docs/API_V1_DRAFT.md`'s "userId never travels from client as data"
  principle at the database layer as defense-in-depth);
- whatever Course-access model is chosen (owner-only, membership table,
  etc.) is what actually gates `SELECT`/`INSERT` on `courses`/`materials`/
  `questions`, not merely what the application layer happens to check;
- a revoked/removed Course access (however that is eventually modeled)
  actually removes visibility at the RLS layer, not only in application
  code;
- `service_role`-only operations (if any future server-side job needs
  elevated access, e.g. a rebuild/admin tool) are verified to require
  `service_role` specifically and are inaccessible via `anon`/
  `authenticated` even indirectly.

This part cannot be scoped further right now without inventing the
authorization model — doing so would violate this session's own scope
boundary against deciding open product/architecture questions.

---

## Tooling this would require

- A real PostgreSQL server reachable from the test runner — either:
  - `supabase start` (Supabase CLI, local Docker-based stack — provisions
    `anon`/`authenticated`/`service_role` automatically, needed for
    scenario 6), or
  - a plain `postgres` Docker container with the migrations applied
    manually (sufficient for scenarios 1–5, not scenario 6 without
    hand-rolling the Supabase roles).
- **Two or more independent `pg` client connections** in the same test
  (e.g. two `pg.Client` instances, or two checked-out connections from a
  `pg.Pool`) — not PGlite, which has no multi-connection concept
  (`supabase/tests/postgres/db-harness.ts`'s own
  `pgliteConnectionProvider` comment states this directly).
- A way to deliberately control interleaving/timing between the two
  connections (e.g. explicit `await`/signal points in test code between
  "connection A has acquired the lock" and "connection B attempts to
  acquire it"), since two real async connections racing with no
  coordination would make the tests flaky rather than deterministic.
- For scenario 5, a way to forcibly terminate a connection mid-transaction
  (`client.end()` without a prior `COMMIT`/`ROLLBACK`, or a second
  connection issuing `SELECT pg_terminate_backend(pid)` against the first).
- None of the above is available in this session's environment. This plan
  is the concrete, ready-to-execute scope for whenever it is.

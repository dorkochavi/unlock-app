# UNLOCK — Development Status

> Short-lived operational state for development sessions.
> This file is NOT an ADR, product specification, or historical changelog.
> Keep it short and update it only when the active development checkpoint changes.

## Branch

`feature/project-foundation`

## Last pushed commit

`e784dd5` — improve claude development workflow

The branch was pushed successfully to:

`origin/feature/project-foundation`

No known unpushed commits currently exist.

The last commit touching application code (`src/`, `supabase/`) is `450af9a` — fix daily plan route auth ordering. `e784dd5` is a workflow/documentation/configuration-only commit (`CLAUDE.md`, `AGENTS.md`, `docs/CONTEXT_MAP.md`, `docs/DEV_STATUS.md`, `.claude/**`, `.cursor/**`) and did not touch `src/` or `supabase/`.

## Current active checkpoint

The DailyPlan Today API route foundation is implemented, reviewed, fixed, verified, and pushed.

The previous auth-before-database ordering bug is CLOSED.

Current route order:

1. create request time once with `new Date()`
2. create the request-scoped Supabase server client
3. resolve trusted identity using `requireAuthenticatedUser()`
4. if unauthenticated → return `401`
5. only after successful authentication, construct PostgreSQL / DailyPlan runtime
6. invoke DailyPlan generation
7. map outcomes into stable HTTP responses

An unauthenticated request does NOT call `getPool()` and does NOT require `DATABASE_URL`.

Unexpected route-level infrastructure/configuration failures return:

    {
      "error": {
        "code": "INTERNAL_ERROR"
      }
    }

Raw infrastructure errors, SQL, connection strings, stack traces, credentials, and environment values are not exposed to the client.

A dedicated regression test imports and calls the real production `GET()` route wiring and fails if database construction is moved back before authentication.

## Real-environment verification milestone (uncommitted)

A real hosted Supabase project has been verified end-to-end for
`GET /api/daily-plan/today`. This is NOT yet committed/pushed — see
"Uncommitted work" below.

Verified against the real hosted project:

- hosted Supabase project connectivity
- all 7 committed migrations applied successfully against the real project
- real `auth.users -> public.users` provisioning for a real OWNER user
- real `auth.users -> public.users` provisioning for a real LEARNER user
  (persisted timezone `Asia/Jerusalem`)
- real browser login (Supabase Auth password grant) against the real
  LEARNER, followed by a real authenticated `GET /api/daily-plan/today`
  request through the real Next.js route
- real DailyPlan persistence: `outcome: "READY"`, 3 items, all
  `actionType: "REVIEW_DUE"` / `tier: "DUE_REVIEW"`
- same-day idempotency: repeating the authenticated request returned the
  identical persisted `plan.id` (`93fc85be-ffa7-4151-b10a-f79fc7d19bc1`) and
  the identical 3 `DailyPlanItem` ids on a second call, confirming the
  local-date plan key is stable across repeated requests on the same local
  day

### Real bug found and fixed during this verification: PostgreSQL DATE read-back

The first authenticated call returned `plannedForDate: "2026-09-18"` for a
request whose correct learner-local calendar date (`Asia/Jerusalem`) was
`2026-09-19`. Investigation confirmed this was a **read-back-only** bug,
not a persistence or timezone-derivation bug:

- `node-postgres`'s default type parser for `date` columns (OID 1082)
  constructs the returned `Date` from the column's LOCAL calendar
  components (server-process OS timezone), never UTC midnight.
- `readDateOnlyString` (`src/infrastructure/postgres/row-validation.ts`)
  converted that `Date` back to a string via `.toISOString().slice(0, 10)`
  — UTC — which is off by one calendar day whenever the server process's
  own OS timezone has a nonzero UTC offset (confirmed: this environment
  runs under `Asia/Jerusalem`, UTC+3).
- `deriveLocalDateString` (the write-side local-date derivation) and the
  `(user_id, planned_for_date)` DailyPlan lookup key were already correct
  throughout — the persisted `planned_for_date` value was always
  `2026-09-19`.
- Confirmed empirically after the fix: re-running the same authenticated
  request returned the SAME `plan.id` and the SAME 3 `DailyPlanItem` ids as
  the original (buggy-display) call, now correctly reported as
  `plannedForDate: "2026-09-19"`. If the persisted row had actually been
  `2026-09-18`, the corrected lookup for `2026-09-19` could not have
  returned the identical plan/item ids. No remote data was modified,
  deleted, or regenerated.

Fix: `readDateOnlyString`'s `Date`-instance branch now reads back via local
getters (`getFullYear`/`getMonth`/`getDate`) instead of `toISOString()` —
the exact inverse of how `pg` constructed the value, correct at any process
UTC offset. This is a shared helper also used by `today-session-mapper.ts`'s
`planned_for_date`, so the same latent bug there is fixed by the same
change.

### Uncommitted work

- `src/infrastructure/postgres/row-validation.ts` — the fix above
- `src/infrastructure/postgres/__tests__/row-validation.test.ts` — new
  regression tests, including the exact reported scenario
  (`now=2026-09-19T16:56:17.843Z`, `Asia/Jerusalem` ->
  `plannedForDate=2026-09-19`, surviving a simulated `pg` round-trip)

Not committed, staged, or pushed yet.

### Known gap surfaced by this verification

There is no PGlite/Postgres integration test for
`PostgresDailyPlanRepository` / `daily-plan-mapper.ts` — the existing
`daily_plan`/`DailyPlan` application-layer tests use in-memory fakes and
never exercise real `pg` type parsing. This is why the DATE read-back bug
was invisible to the existing suite and was only found via real-Supabase
verification. Reported as a gap, not silently fixed as part of this slice.

## Current implementation state

Implemented and approved:

- immutable Attempts model
- Question / QuestionVersion persistence model
- FSRS-backed memory scheduling
- learning-state rebuild/replay foundation
- Next Best Action candidate generation
- Today ranking/planning foundation
- CourseMembership model and join policy
- persisted user timezone
- production learning policy composition
- DailyPlan / DailyPlanItem persistence
- global multi-course DailyPlan generation core
- public `getOrCreateDailyPlanForToday({ userId, now })`
- LEARNER-only automatic DailyPlan eligibility
- PostgresDailyPlanUnitOfWork
- DailyPlan production composition
- pg runtime adapter / Pool foundation
- Supabase browser/server auth client factories
- trusted userId through `auth.getUser()`
- `auth.users -> public.users` provisioning migration
- `GET /api/daily-plan/today`
- auth-before-DB route ordering
- stable route-level `INTERNAL_ERROR` boundary
- real route-wiring regression coverage for auth-before-DB ordering

Real-environment-verified (see "Real-environment verification milestone"
above):

- hosted Supabase project
- real Supabase Auth login/session
- migration chain against a real Supabase project
- real `auth.users -> public.users` signup provisioning
- real `DATABASE_URL`
- real browser → API → PostgreSQL DailyPlan request
- same-day DailyPlan idempotency against real persisted state

Not yet end-to-end verified:

- login/signup UI
- Today UI

Not implemented yet:

- DailyPlanItem completion through `submitAnswer`
- Skip use case
- mid-day Today adaptation
- Global Today user-facing UI
- production deployment

## Recent development-workflow work

The Claude/Cursor development workflow was committed and pushed as `e784dd5` — improve claude development workflow.

It included:

- updated `CLAUDE.md`
- updated `AGENTS.md`
- updated `docs/CONTEXT_MAP.md`
- this `docs/DEV_STATUS.md`
- `.claude/settings.json`
- `.claude/rules/**`
- `.claude/agents/**`
- `.claude/skills/checkpoint/**`
- `.claude/skills/implement-slice/**`
- `.claude/skills/review-commit/**`
- targeted alignment updates under `.cursor/rules/**`

This work is workflow/configuration-only and separate from the DailyPlan route commits. No application/source changes (`src/`, `supabase/`) were included.

## Accepted product decisions relevant to current work

- One `DailyPlan` per user per local calendar day.
- Persisted user timezone is authoritative for determining the local day.
- Global Today and Course Today are views of the same DailyPlan.
- Only active `LEARNER` memberships participate automatically in DailyPlan generation.
- `OWNER` and `INSTRUCTOR` roles do not automatically participate as learners.
- Manual Practice is separate from Today.
- Today plans are frozen by default after generation.
- No per-course quota or fairness balancing.
- User identity must NEVER be supplied by the client.
- Server routes derive `userId` only from verified authentication.
- DailyPlan / DailyPlanItem supersede the older Today Session persistence naming.

## Current test baseline

At the current uncommitted working tree (last pushed commit still
`e784dd5`; changes are the DATE read-back fix described above plus its
regression tests — see "Uncommitted work"):

- Unit tests: `461 / 461`
- Schema/Postgres tests: `159 / 159`
- Typecheck: clean
- Lint: clean
- `git diff --check`: clean

These numbers are regression checkpoints for the current development state, not permanent requirements.

Verification level for the DailyPlan Today route:

- unit-tested
- real route wiring regression-tested with mocked infrastructure seams
- supporting persistence/schema behavior tested with the existing schema/Postgres-compatible suite
- reviewed by inspection
- real-Supabase tested (see "Real-environment verification milestone" above)
- real hosted-PostgreSQL verified through the route, including same-day idempotency
- real browser Auth login tested (via a temporary local test page, since removed)
- NOT yet tested through a permanent product login/Today UI (none exists yet)

## Next development actions

1. Commit the DATE read-back fix and its regression tests as a focused, reviewed slice (see recommended commit message).
2. Build the minimal login/signup + Today UI vertical slice.
3. Add PGlite/Postgres integration coverage for `PostgresDailyPlanRepository` / `daily-plan-mapper.ts` (gap surfaced by this verification — real `pg` type-parsing behavior is currently untested below the real-Supabase level).
4. Continue with DailyPlanItem completion through `submitAnswer` and Skip as separate slices.

Do not connect to, link, migrate, or modify a remote Supabase project without explicit user authorization.

## Session protocol

For a fresh Claude session:

1. Read `CLAUDE.md`.
2. Read this file.
3. Inspect the minimum repository state necessary for the task.
4. Use `docs/CONTEXT_MAP.md` to locate only task-relevant context.
5. Do not assume prior chat context.
6. Implement one focused development slice at a time.
7. Prefer targeted tests during implementation.
8. Use the `checkpoint` skill once at the end of a meaningful slice.
9. Use reviewer agents only when their specialization is actually relevant.
10. Do not push; pushes are performed manually outside Claude.

Context-efficiency rules:

- prefer repository state over long conversational context
- use `/clear` after major approved checkpoints, commits, pushes, or task-type changes
- start with `git diff --stat` rather than reading a full repository diff unnecessarily
- do not reload broad documentation trees by default
- do not reread files already available in the same short session unless they changed
- keep reports concise
- use subagents only for isolated review or genuinely independent work

## Important references

- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md` — Course Membership / authorization
- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` — Global DailyPlan / Today semantics
- `docs/GLOBAL_TODAY_IMPLEMENTATION_SLICES.md`
- `docs/API_V1_DRAFT.md`
- `docs/OPEN_QUESTIONS.md`
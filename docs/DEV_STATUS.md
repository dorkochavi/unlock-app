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

## Real-environment verification milestone

A real hosted Supabase project has been verified end-to-end for
`GET /api/daily-plan/today`.

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

The DATE read-back fix and its regression tests were committed as `b502ca9`
— `src/infrastructure/postgres/row-validation.ts` and
`src/infrastructure/postgres/__tests__/row-validation.test.ts` (the latter
covers the exact reported scenario, `now=2026-09-19T16:56:17.843Z`,
`Asia/Jerusalem` -> `plannedForDate=2026-09-19`, across positive/negative/
zero process UTC offsets via `process.env.TZ`).

### PGlite DailyPlan integration coverage gap — CLOSED

`supabase/tests/postgres/daily-plan-repository.test.ts` and
`supabase/tests/postgres/daily-plan-unit-of-work.test.ts` already provided
substantial PGlite integration coverage for `PostgresDailyPlanRepository`
and the full generation pipeline (create/persist, read-back, idempotency,
resolve-once semantics, LEARNER-only course pooling). This slice closed the
two remaining specific gaps:

- item ordering: added a test proving `findByKey` orders items by the
  `position` column itself (not insertion/id order), by inserting rows
  directly out of position order.
- `plannedForDate` round-trip at a year boundary (`2025-12-31`), in
  addition to the existing mid-month case.

**New finding, not fixed in this slice (test-double fidelity, not a
production risk):** PGlite's own `date`-column type parser constructs the
returned `Date` from UTC calendar components, while real `pg`'s default
OID-1082 parser constructs it from LOCAL calendar components (the
convention `readDateOnlyString`'s fix above is calibrated for). Verified
directly: under a negative-process-UTC-offset (e.g. `America/Los_Angeles`),
a PGlite-style UTC-midnight `Date` read back via `readDateOnlyString`'s
local-getter branch is off by one day, while a real-`pg`-style
local-midnight `Date` is not. This does not affect production (which only
ever talks to real `pg`, never PGlite), and does not manifest in this
repo's actual dev/CI environments (UTC or non-negative offsets), but it
means the PGlite-based repository tests cannot, by themselves, prove
`readDateOnlyString`'s `Date`-branch correctness on a negative-offset host
— `row-validation.test.ts`'s own `process.env.TZ`-parametrized tests
already carry that proof for the real-`pg` convention. Documented in
`daily-plan-repository.test.ts`'s file-level doc comment; no code changed.

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

- login/signup UI (implemented, unverified against a real signup — see
  "Minimal learner vertical slice" below for what WAS verified)
- Today UI (implemented; unauthenticated path verified against the real
  hosted project — see below)

Not implemented yet:

- DailyPlanItem completion through `submitAnswer`
- Skip use case
- mid-day Today adaptation
- Global Today user-facing UI
- learner-facing question content (prompt/options) in the Today API/UI —
  Today items currently render by `actionType`/`status` only; see
  "Minimal learner vertical slice" below
- production deployment

## Minimal learner vertical slice: auth + timezone + Today UI

Added in this slice (2026-09-19):

- `POST /api/user/timezone` (+ `handle-set-user-timezone.ts` testable core,
  mirroring `handle-get-daily-plan-today.ts`'s DI/auth-before-DB shape
  exactly): persists the caller's own IANA timezone via the existing
  `setUserTimezone` application use case + `PostgresUserRepository`. Auth
  resolved and body validated before any `getPool()`/DB construction,
  covered by a dedicated route-wiring ordering test (mirroring
  `daily-plan/today`'s own `route-auth-db-ordering.test.ts`).
- `/login` — client-side sign-in/sign-up (email+password) using
  `createSupabaseBrowserClient()` directly (`supabase.auth
  .signInWithPassword`/`.signUp`), redirecting to `/today` on a session, or
  showing a "check your email" message when Supabase Auth requires email
  confirmation (session not immediately returned).
- `/today` — client component: calls `GET /api/daily-plan/today`; on `401`
  shows a sign-in prompt; on `422 TIMEZONE_NOT_SET` detects the browser's
  IANA timezone (`Intl.DateTimeFormat().resolvedOptions().timeZone`), POSTs
  it to `/api/user/timezone` (ONLY reached because the server just said
  none is persisted — an already-set timezone is never overwritten), then
  retries once; on `200` renders plan items by `actionType`/tier
  reasons/status (Hebrew labels, no raw ids); loading/empty/error states
  included; a sign-out button calls `supabase.auth.signOut()`.
- `/` now links to `/today`.
- Hebrew/RTL throughout, using the existing `src/messages/he.ts` /
  `src/lib/locale.ts` convention (extended with `auth`/`today` keys).

**Explicitly deferred, not guessed at:** exposing question prompt/options
in the Today API/UI. The existing `question_versions` read paths
(`question-answer-definition-mapper.ts`) read `correct_answer` in the same
query used for grading — reusing that directly for a learner-facing
response would risk leaking it without a dedicated, narrowly-projected SQL
read path (never selecting `correct_answer` at all) and its own leak-proof
tests. Given this slice's explicit scope ("only implement if the
repository/domain already safely supports it"), that safe read path does
not yet exist, so Today items currently render by action type only — a
real but bounded UX gap, not a security compromise.

**Verification level, stated honestly:**

- unit-tested: `handle-set-user-timezone.ts` (7 cases) and the route
  auth-before-DB ordering test (5 cases) — all fake/mocked, no real
  network.
- typecheck/lint: clean.
- smoke-tested against the REAL hosted Supabase project
  (`.env.local`, already configured from an earlier session) via `npm run
  dev` + `curl` only — deliberately NOT interactive/form-submission
  testing, to avoid creating or modifying any real hosted data (this
  autonomous session was not authorized to modify hosted Supabase data).
  Confirmed: `/`, `/login`, `/today` all return `200` and render their
  expected Hebrew content; `html[dir="rtl"][lang="he"]` confirmed; a real
  unauthenticated `GET /api/daily-plan/today` returns real `401
  UNAUTHENTICATED` (no `DATABASE_URL`/DB touch); a real unauthenticated
  `POST /api/user/timezone` returns real `401 UNAUTHENTICATED` the same
  way.
- NOT verified: an actual real sign-up/sign-in round trip, real timezone
  persistence via the browser flow, or a real populated Today plan
  rendering in a browser — none of these were exercised because doing so
  would create/modify real hosted data, outside this session's
  authorization. This is the concrete next verification step for a human
  (or an explicitly-authorized session) to run by hand.
- NOT interactive-browser-tested (no click-through/visual QA) — verified
  via `curl` HTTP status/content checks only.

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

- Unit tests: `474 / 474`
- Schema/Postgres tests: `162 / 162` (unchanged this slice — no DB-relevant code changed)
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

## Auth session middleware — assessed, not implemented

Reviewed whether a `middleware.ts` is required now that a real UI exists
(`@supabase/ssr`'s own README, "Known patterns and limitations"). Finding:
the real limitation `middleware.ts` mitigates is a narrow one — two
*concurrent* requests sharing the same expired session cookie both attempt
a (single-use) refresh token, and the second fails until the browser syncs
the first response's updated cookie. This repo's current call pattern
(`/today` makes one `fetch` to `GET /api/daily-plan/today`, then
conditionally one more to `POST /api/user/timezone`, sequentially, not in
parallel) does not exercise this race in the common case; two browser tabs
opened simultaneously with the same stale session still could. Route
Handlers (the only place trusted auth happens today — no Server Component
needs auth yet) can already set refreshed cookies themselves via
`createSupabaseServerClient()`'s existing `setAll`, so middleware is not
needed for basic refresh persistence at the current scope. Not clearly
required yet — documented rather than guessed at; revisit if a Server
Component needs auth, or if multi-tab concurrent-refresh becomes a real
reported issue.

## Next development actions

1. By hand (or an explicitly-authorized session), exercise the real
   sign-up/sign-in + timezone + Today flow against the hosted Supabase
   project in a real browser — this slice deliberately stopped short of
   that (see "Minimal learner vertical slice" above).
2. Design a safe, narrowly-projected learner-facing question-content read
   path (prompt/options, never `correct_answer`) so Today items can render
   more than an action-type label.
3. Continue with DailyPlanItem completion through `submitAnswer` and Skip as separate slices.

## Blocked: unseen-question / new-material exposure eligibility

Investigated for an autonomous session's queued slice (2026-09-19). NOT
implemented — this is a genuinely unresolved product decision, not a
missing-parameter gap:

- `src/domain/learning/next-best-action.ts`'s own doc comment explicitly
  excludes `EXPAND_COVERAGE`/`NEW_LEARNING` candidates as requiring
  "course/topic coverage context that does not exist on
  `UserQuestionProgress`" — modeling them "would mean fabricating a
  course-aggregate contract that hasn't been designed."
- `src/domain/learning/today-planner.ts`'s own doc comment states it
  deliberately does NOT fabricate `NEW_LEARNING`/`EXPAND_COVERAGE` filler
  when ranked candidates are empty, calling Starter/calibration planning "a
  deliberately separate, still-deferred future input path."
- `docs/OPEN_QUESTIONS.md` #4 (Starter Experience Eligibility) and #5
  (Starter Sampling Strategy) are both explicitly **OPEN** — no entry
  condition, sampling strategy, or count is decided.
- `docs/NEW_MATERIAL_EXPOSURE_MODEL.md` is self-labeled "DESIGN ANALYSIS
  ONLY — NOT AN ADR, NOT IMPLEMENTED, NOT A DECISION," explicitly states no
  numeric threshold/sample size/novelty-budget is decided, and explicitly
  scopes itself as a **read-only** analysis of `next-best-action.ts` and
  `today-planner.ts` — "No change to ... all four are read-only inputs to
  this analysis."

Implementing any unseen-question candidate path now would mean inventing
the eligibility/sampling policy these documents explicitly defer to future
product review, contradicting CLAUDE.md §7/§4 ("do not invent an answer"
when a product decision is unresolved). Left undone; needs a product
decision on OPEN_QUESTIONS #4/#5 before implementation.

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
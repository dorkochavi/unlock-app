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

Not yet end-to-end verified:

- hosted Supabase project
- real Supabase Auth login/session
- migration chain against a real Supabase project
- real `auth.users -> public.users` signup provisioning
- real `DATABASE_URL`
- real browser → API → PostgreSQL DailyPlan request
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

At `450af9a` (last commit touching application code):

- Unit tests: `455 / 455`
- Schema/Postgres tests: `159 / 159`
- Typecheck: clean
- Lint: clean
- `git diff --check`: clean at the route-fix checkpoint

`e784dd5` (current pushed HEAD) only changed workflow/documentation/configuration files and did not touch `src/` or `supabase/`; these numbers have not been independently re-verified at `e784dd5`, but no application code changed since they were last measured.

These numbers are regression checkpoints for the current development state, not permanent requirements.

Verification level for the DailyPlan Today route:

- unit-tested
- real route wiring regression-tested with mocked infrastructure seams
- supporting persistence/schema behavior tested with the existing schema/Postgres-compatible suite
- reviewed by inspection
- NOT yet real-Supabase tested
- NOT yet real hosted-PostgreSQL verified through the route
- NOT yet browser E2E tested

## Next development actions

1. Start a fresh Claude context with `/clear`.
2. Configure a real hosted Supabase project.
3. Create local environment configuration from `.env.example`.
4. Apply the committed migration chain to the authorized Supabase project.
5. Verify real signup → `public.users` provisioning.
6. Verify persisted user timezone flow in the real environment.
7. Verify real `GET /api/daily-plan/today`.
8. Build the minimal login/signup + Today UI vertical slice.
9. Continue with DailyPlanItem completion through `submitAnswer` and Skip as separate slices.

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
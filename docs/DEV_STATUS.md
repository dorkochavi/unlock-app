# UNLOCK — Development Status

> Current-state snapshot for development sessions.
>
> This file describes what is true NOW.
> It is NOT a changelog, Run Report, ADR, product specification, or workflow manual.
>
> Historical execution detail belongs in Git and `docs/RUNS/`.
> Product decisions belong in `docs/DECISIONS/`.
> Current work belongs in `docs/CHATGPT_PLAN.md`.

---

## Repository State

Branch:

`feature/project-foundation`

Pushed HEAD:

`f10daaa` — `define unlock v1 scope and product roadmap` (confirmed against
`origin/feature/project-foundation`; this is also Run 004's `BASE_HEAD`)

Current local HEAD (not yet pushed):

`0e812a1` — `Run 004 handoff: update DEV_STATUS, CONTEXT_MAP, and add Run Report`

Local HEAD is 5 commits ahead of pushed HEAD — all of Run 004: `3568275`
(S2-S4: learner shell/nav, My Courses, Course View), `cb22a97` (S5:
malformed-courseId 500 fix), `0e8a597` (S6: mobile tap-target/truncation
pass), `60b6dea` (S7: Playwright E2E harness), `0e812a1` (S8: this Run's
own handoff). See `docs/RUNS/2026-09-20-004.md` for the full Run.

Last pushed application-feature baseline (product code, pre-Development-OS-V1 documentation work):

`66df9f9` — `add open-course learner onboarding`

Remote:

`origin/feature/project-foundation`

Development OS V1 is committed and pushed (`0135495`); the subsequent
active-documentation consistency pass (`d67371a`) and the Run
`2026-09-20-002` handoff (`fd9162e`) were pushed at the time, and `f10daaa`
(defining V1 scope/roadmap) was pushed after that — `f10daaa` is the actual
current pushed HEAD, not `fd9162e`. Run 004 (`3568275`..`0e812a1`) is
committed locally and not yet pushed.

---

## Current Product Capabilities

### Authentication / User

Implemented:

- Supabase browser/server authentication clients.
- Trusted server identity through `supabase.auth.getUser()`.
- `auth.users -> public.users` provisioning.
- Email/password login and signup UI at `/login`.
- Safe internal login return-path support through `next`.
- Persisted learner IANA timezone.
- Browser timezone detection only when the server reports that no timezone is persisted.
- Auth-before-database route ordering on authenticated API paths.
- Stable generic `INTERNAL_ERROR` boundary for unexpected server failures.
- Hebrew-first / RTL application shell.

Security baseline:

- authoritative `userId` is never accepted from the client
- database/service credentials remain server-only
- raw SQL/errors/stack traces are not returned to clients
- external/protocol-relative login redirects are rejected

---

### Learner Navigation / Shell (Run 004)

Implemented:

- shared mobile-first learner shell (`src/app/(learner)/layout.tsx` +
  `learner-nav.tsx`) via a Next.js route group — a bottom Today/Courses tab
  bar with active-state highlighting.
- the route group changes no existing URL: `/today` kept its exact path
  (pure file move, zero content diff).
- `/`, `/login`, `/join/[courseId]` deliberately remain outside the shell
  (pre-authentication/pre-product entry points).
- RTL/Hebrew-first behavior preserved via the existing global `dir="rtl"`,
  no hand-coded left/right logic in the nav.

---

### My Courses / Course View (Run 004)

Implemented:

- `GET /api/courses/mine` — authenticated learner's own active Courses
  (reuses `CourseMembershipRepository.listActiveForUser` unchanged; role is
  passed through, never downgraded/hidden for an OWNER/INSTRUCTOR's own
  membership).
- `/courses` (My Courses) — course list with a real, translated empty state
  for a zero-course learner; no fabricated exam/progress/analytics data.
- `GET /api/courses/:courseId/context` — authenticated, membership-gated
  Course View read: fails closed to `NOT_AUTHORIZED` (no membership) or
  `ACCESS_REVOKED` (revoked membership); never the same route as the
  public unauthenticated `GET /api/courses/:courseId` join-page lookup.
- `/courses/[courseId]` (Course View) — course title + the caller's own
  membership role, with a link back to `/today`. Does not create a second
  Today/plan system. No Manual Practice link (no such learner-facing flow
  exists anywhere in this repo yet).
- batched `CourseRepository.getCourseSummaries(courseIds)` (`= any($1::uuid[])`)
  to avoid N+1 course-title lookups; same learner-safe `{id, title}`
  projection as the existing single-course method.

---

### Courses / Membership

Implemented:

- Course persistence.
- `CourseMembership` model.
- roles:
  - `OWNER`
  - `INSTRUCTOR`
  - `LEARNER`
- OPEN vs AUTHORIZED_ONLY join policy.
- OWNER membership remains canonical authorization.
- only active LEARNER memberships automatically participate in DailyPlan generation.
- public-safe course summary lookup returning only learner-safe identifying information.
- authenticated OPEN-course join API.
- `/join/[courseId]` learner onboarding page.
- repeat OPEN join is idempotent.
- existing OWNER / INSTRUCTOR membership is preserved and never downgraded by self-join.
- revoked membership currently fails closed; automatic rejoin semantics remain intentionally undecided.

Ruppin demo onboarding path now exists conceptually as:

join link / QR
→ login if required
→ return to join page
→ join OPEN course
→ `/today`

---

### Learning Evidence / Engine

Implemented:

- immutable Attempt model.
- immutable Question / QuestionVersion history.
- persisted correctness.
- deterministic learning-state processing.
- learning-state rebuild / replay.
- FSRS-backed memory scheduling.
- retrieval qualification.
- misconception tracking.
- mastery/evidence processing.
- Next Best Action candidate generation.
- deterministic ranking/planning foundation.
- production learning-policy composition.
- Manual Practice path remains separate from Today.
- replay/rebuild uses persisted Attempt correctness rather than re-grading historical responses.

Real-time learning-state decisions do not depend on LLM calls.

---

### DailyPlan / Today

Implemented:

- one persisted DailyPlan per user per learner-local calendar day.
- persisted DailyPlanItem rows.
- global multi-course DailyPlan generation.
- active LEARNER membership filtering.
- deterministic item ordering.
- frozen same-day plan semantics.
- `getOrCreateDailyPlanForToday({ userId, now })`.
- PostgreSQL DailyPlan repository and UnitOfWork.
- `GET /api/daily-plan/today`.
- learner-facing question content:
  - question type
  - prompt
  - answer options
- learner-facing read path does NOT select or return grading-only data such as:
  - `correct_answer`
  - `correctOptionIds`
  - explanation/grading definition
- exact persisted QuestionVersion is used for learner content and grading.

Today answer submission:

- `POST /api/daily-plan/items/:itemId/answer`
- authenticated ownership enforcement
- authoritative question/course/version/plan identity derived server-side
- correctness evaluated server-side
- immutable Attempt persisted
- learning state updated through the existing learning-engine pipeline
- exact DailyPlanItem resolved as completed
- retry/idempotency protections prevent duplicate Attempts for the same submission
- Manual Practice does NOT resolve matching Today items

Today Skip:

- `POST /api/daily-plan/items/:itemId/skip`
- resolves exact DailyPlanItem as `skipped`
- creates no Attempt
- creates no incorrect-answer evidence
- does not update mastery/misconception/scheduler state
- creates no replacement item

Today learner UI:

- one active pending item at a time
- SINGLE_CHOICE interaction
- MULTIPLE_CHOICE interaction
- explicit submit
- correct / incorrect feedback
- explicit continue after answered items
- progress display
- Skip action
- resolved-state reconstruction after reload
- handling of stale/already-resolved items through server refetch
- loading/error/auth-expiry states
- completion state when no pending items remain

---

### Starter / New Material V1

Accepted decision:

`docs/DECISIONS/017-starter-new-material-v1.md`

Implemented:

- unseen = no prior real Attempt for the Question
- absence of UserQuestionProgress alone is NOT used as proof of unseen
- ordinary review/repair/relearning/strengthening candidates are generated first
- New Material activates only when there are ZERO ordinary candidates
- no review + new-material mixing in V1
- up to 3 unseen questions are selected
- selection is deterministic
- placement into Today is not learning evidence
- UserQuestionProgress is not fabricated when unseen material is planned
- first actual Attempt creates evidence normally

Persisted DailyPlan vocabulary now supports:

- action type: `NEW_LEARNING`
- tier: `NEW_MATERIAL`
- reason: `UNSEEN_MATERIAL`

The normal Next Best Action ranking model remains unchanged; New Material is a separate fallback path.

---

## Current API / Learner Entry Points

Implemented application-facing paths include:

- `/`
- `/login`
- `/today` (now under the `(learner)` route group; URL unchanged)
- `/join/[courseId]`
- `/courses` (My Courses)
- `/courses/[courseId]` (Course View)

Implemented relevant APIs include:

- `GET /api/daily-plan/today`
- `POST /api/daily-plan/items/:itemId/answer`
- `POST /api/daily-plan/items/:itemId/skip`
- `POST /api/user/timezone`
- `GET /api/courses/:courseId` (public, unauthenticated join-page title lookup)
- `POST /api/courses/:courseId/join`
- `GET /api/courses/mine` (authenticated, My Courses)
- `GET /api/courses/:courseId/context` (authenticated, membership-gated Course View)

This list is a current capability summary, not an exhaustive API specification.
Use the API docs / source for full contracts.

---

## Database / Migration State

### Applied to hosted Supabase

The full committed migration chain through:

`20260925000000_daily_plan_new_material_v1.sql`

is applied to the real hosted Supabase project. `npx supabase migration list`
confirmed local/remote parity through this migration.

1. `20260917203000_initial_schema.sql`
2. `20260918000000_question_answer_model_v1.sql`
3. `20260919000000_course_membership_v1.sql`
4. `20260920000000_user_timezone_v1.sql`
5. `20260921000000_daily_plan_v1.sql`
6. `20260922000000_daily_plan_item_state_consistency.sql`
7. `20260923000000_auth_user_provisioning.sql`
8. `20260924000000_daily_plan_answer_attempts.sql` — links Attempts to
   DailyPlan / DailyPlanItem; supports Today answer submission.
9. `20260925000000_daily_plan_new_material_v1.sql` — extends DailyPlanItem
   constraints for New Material V1.

Hosted Supabase now supports the answer/New Material flows.

Claude must not run `supabase db push` without explicit user authorization.

---

## Verification State

### Verified against real hosted Supabase / browser

Previously verified:

- hosted Supabase connectivity
- real `DATABASE_URL`
- full migration chain through New Material V1
- real Auth user provisioning
- real learner login
- persisted learner timezone
- authenticated browser → API → PostgreSQL Today request
- populated Today plan retrieval
- learner-facing question prompt/options rendering
- same-day DailyPlan idempotency
- correct learner-local planned date after the PostgreSQL DATE read-back fix
- unauthenticated auth-before-DB behavior on protected routes
- Hebrew / RTL rendering
- hosted Today answer submission
- hosted Today completion state
- `AUTHORIZED_ONLY` self-join failing closed with `403`
- a clean `OPEN` Course self-join succeeding and redirecting to `/today`

### Locally verified after Run 004 (Slices 2-7)

My Courses and Course View (membership listing/exclusion, role preservation,
cross-user isolation, not-found/non-member/revoked outcomes), the
`getCourseSummaries` batched query, auth-before-DB ordering on both new
routes, and the malformed/non-UUID `courseId` fix across all three affected
routes are each verified at unit / route-wiring / PGlite-integration layers
as applicable — see `docs/RUNS/2026-09-20-004.md` for the per-Slice test
inventory. Every pre-existing Slice 1-6 item below remains independently
re-confirmed unaffected by this Run's diff.

Previously verified (pre-Run-004), still current:

- Today answer submission, DailyPlanItem ownership, answer idempotency, Attempt → DailyPlan linkage
- Manual Practice / Today separation, Today Skip semantics, New Material discovery and fallback
- no fake progress for unseen material
- OPEN course join, OWNER / INSTRUCTOR role preservation, revoked membership fail-closed behavior
- safe login redirect allowlist, join route auth-before-DB ordering, public course-summary projection
- joinCourse against real Postgres repositories in PGlite

### Browser-verified (real hosted-configured `next dev`, read-only)

- malformed and well-formed-but-nonexistent join-link course ids each show
  the controlled not-found UI state, not a 5xx (`e2e/join-errors.spec.ts`,
  2/2 passed against this repo's own hosted-project `.env.local`, no
  mutation performed).

### Not yet executed: golden-path browser E2E

`e2e/golden-path.spec.ts` (login → join OPEN course → Today → answer →
feedback → continue → reload-safe state) is written and wired but was not
executed in Run 004: it requires a real pre-existing hosted learner account
and OPEN Course, and this repository's development environment has no local
Supabase/Docker stack to provide that safely — only the real hosted Ruppin
project is configured. Autonomously creating a hosted user/Course/membership
to manufacture that fixture is out of bounds (`CLAUDE.md` §20). See
`e2e/README.md` for the exact command to run it once a human decides how to
provide real fixtures. This is a documented Plan-level blocker, not a
silently skipped requirement.

### Not yet manually verified against current hosted schema

- real hosted Today Skip
- hosted New Material fallback

Neither is a demo blocker; both remain to be exercised manually against the
hosted project.

### Demo-journey coverage

Demo journey (join → Today → answer → Skip → completion, plus New Material
fallback) is verified at unit/application/PGlite layers with no defect found;
see `docs/RUNS/2026-09-20-002.md` for the underlying test-body audit. The
malformed/nonexistent join-link path is now also verified at the real
browser level (above). The full golden path (login through completion) has a
Playwright harness in place (`e2e/`) but has not yet been executed
end-to-end — see "Not yet executed" above.

---

## Current Test Baseline

At local HEAD `0e812a1` (pushed HEAD remains `f10daaa`):

- Unit tests: `638 / 638`
- Schema/Postgres (PGlite): `197 / 197`
- Typecheck: clean
- Lint: clean
- `git diff --check`: clean
- Browser E2E: `join-errors.spec.ts` 2/2 passed against a real hosted-configured `next dev`; `golden-path.spec.ts` written, not yet executed (see Verification State)

These values are development checkpoints, not permanent numeric requirements.

Future test counts may increase or decrease legitimately as the suite evolves.

---

## Known Gaps / Limitations

Current known items include:

- production deployment is not yet complete.
- final learner-facing visual/demo polish remains.
- hosted Today Skip and hosted New Material fallback still need manual browser QA (see Verification State).
- revoked CourseMembership rejoin policy remains intentionally unresolved.
- full golden-path browser E2E (login through Today completion) is written but not yet executed; needs a human decision on how to safely provide a real fixture learner/course (see Verification State).
- auth middleware is not currently implemented; existing Route Handler auth is sufficient for the current sequential request model, but middleware may need reassessment if authenticated Server Components or real multi-tab refresh races become relevant.
- real multi-connection PostgreSQL concurrency is not fully proven by PGlite; concurrency claims must remain scoped to what has actually been tested or reasoned under PostgreSQL semantics.
- PGlite DATE parsing is not identical to real `node-postgres` DATE parsing on all host timezones; dedicated row-validation tests cover the production `pg` convention.

Not currently implemented / not currently targeted:

- mid-day adaptive mutation of an already-frozen Today plan
- automatic carry-over of unresolved Today items
- per-course fairness quota
- mixing New Material with ordinary review candidates in V1

---

## Current Product Decisions Relevant to Active Development

Authoritative decisions live in ADRs.

Most relevant accepted ADRs:

- `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  - CourseMembership roles / authorization / join model

- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md`
  - one DailyPlan per local day
  - Global Today / Course Today semantics
  - frozen-plan behavior
  - Manual Practice separation
  - Skip semantics

- `docs/DECISIONS/017-starter-new-material-v1.md`
  - unseen definition
  - fallback-only New Material policy
  - deterministic up-to-3 selection
  - no fabricated evidence

Do not duplicate these ADRs here.
Read the specific ADR only when a task requires its details.

---

## Current Blockers

No known code blocker at local HEAD `0e812a1` (pushed HEAD remains `f10daaa`).

No remote migration gate remains: the full migration chain is applied to hosted Supabase. Run 004 added no new migration.

---

## Manual Actions Required

1. Manually exercise hosted Today Skip and hosted New Material fallback (the two Verification State items not yet confirmed against the hosted project).
2. Decide how to safely provide golden-path E2E fixtures (a dedicated non-production Supabase project, or a manually created hosted test learner + OPEN course), then run `npx playwright install chromium && npm run test:e2e` per `e2e/README.md`.
3. Push Run 004 (`3568275`..`0e812a1`) when ready — not yet pushed.
4. Production deployment remains outstanding.

Do not perform hosted mutations automatically.

---

## Immediate Development Checkpoint

Pushed product/application baseline:

`66df9f9`

Current pushed HEAD:

`f10daaa`

Current local HEAD (Run 004 complete, not yet pushed):

`0e812a1`

Next execution work must come from a new:

`docs/CHATGPT_PLAN.md`

Do not infer the next slice from historical run context. See
`docs/RUNS/2026-09-20-004.md` for Run 004's full handoff.

---

## Current Documentation Model

Use:

- `CLAUDE.md`
  - HOW Claude works

- `docs/CHATGPT_PLAN.md`
  - WHAT Claude should execute now

- `docs/DEV_STATUS.md`
  - WHAT is currently true

- `docs/MASTER_SPEC.md`
  - WHAT UNLOCK is intended to become

- `docs/OPEN_QUESTIONS.md`
  - WHAT is still undecided

- `docs/DECISIONS/*`
  - WHAT has been decided and WHY

- `docs/CONTEXT_MAP.md`
  - WHERE relevant code/docs/rules are located

- `docs/RUNS/*`
  - historical execution archive

- `scratch/development_checkpoint.md`
  - temporary in-run state only

Historical Run Reports are restricted context and must not be used as normal working memory.
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

`a03efa4` — `close Run 2026-09-20-005 as Course Authoring & Topics V1
(COMPLETE)` (confirmed equal to `origin/feature/project-foundation`; this is
also Run 006's `BASE_HEAD`).

Run 004 (`3568275`..`0e812a1`, learner shell/nav + My Courses + Course View
+ Playwright E2E harness — see `docs/RUNS/2026-09-20-004.md`) and Run 005
(`6090862`..`a03efa4`, Course Authoring & Topics V1, COMPLETE — see
`docs/RUNS/2026-09-20-005.md`) are both fully pushed.

Last pushed application-feature baseline (product code, pre-Development-OS-V1 documentation work):

`66df9f9` — `add open-course learner onboarding`

Remote:

`origin/feature/project-foundation`

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

### Course Authoring (Run 005 — Course Authoring & Topics V1, COMPLETE)

Implemented (Slice S2 — Course Lifecycle + Instructor Authorization Foundation):

- `courses.status`: `DRAFT` / `PUBLISHED` / `ARCHIVED` (migration
  `20260926000000_course_lifecycle_v1.sql`; existing rows backfilled to
  `PUBLISHED`, no column default left behind — new Courses must state
  status explicitly, matching `question_versions.question_type`'s
  established precedent).
- `courses.exam_date`: optional instructor-set date, metadata only — no
  Exam Urgency ranking behavior exists yet (out of Run 005 scope).
- authoring authorization: `canAuthorCourse` (OWNER/active INSTRUCTOR only;
  fails closed on revoked OR archived management membership — deliberately
  stricter than the pre-existing `isManagementRole` alone; a known,
  currently-dormant asymmetry with `setCourseJoinPolicy`, which only checks
  `revokedAt`, is tracked for reconciliation before that use case is ever
  wired to a live route).
- application use cases: `createCourse` (new Course starts DRAFT +
  AUTHORIZED_ONLY, grants creator OWNER membership, both writes atomic via
  a dedicated `CourseUnitOfWork`/`PostgresCourseUnitOfWork` transaction),
  `getCourseForAuthoring`, `updateCourseMetadata`, `publishCourse`
  (DRAFT -> PUBLISHED only), `archiveCourse` (DRAFT or PUBLISHED ->
  ARCHIVED; ARCHIVED is terminal in V1, no un-archive path).
- API: `POST /api/courses`, `GET`/`PATCH /api/courses/:courseId/manage`,
  `POST /api/courses/:courseId/publish`, `POST /api/courses/:courseId/archive`
  — all authenticated, auth-before-DB, authorization-before-existence
  (an unauthorized caller never learns whether a `courseId` exists).
- learner self-join (`joinCourse`) is now lifecycle-aware: a DRAFT or
  ARCHIVED Course is never joinable even when `join_policy = OPEN`
  (`canSelfJoinCourse`, replacing the plain `canSelfJoin` check inside
  `joinCourse` specifically).

Implemented (Slice S3 — Instructor Course Management UI V1):

- `src/app/instructor/` — a desktop-oriented instructor authoring surface,
  deliberately separate from the learner `(learner)` shell/bottom nav
  (reached via a small text link on My Courses, not a nav tab):
  `/instructor/courses` (list Courses the caller owns/instructs, filtered
  client-side from `GET /api/courses/mine`, with a create-first-course
  empty state), `/instructor/courses/new` (create form), and
  `/instructor/courses/[courseId]` (manage: edit title/exam date, edit
  join policy, explicit publish, explicit archive-with-confirm, and —
  once PUBLISHED — a copyable `/join/:courseId` link).
- `PATCH /api/courses/:courseId/join-policy` — the first live route wiring
  of `setCourseJoinPolicy` (previously application-layer-only). Its
  authorization is deliberately UNCHANGED (checks only `revokedAt`, not
  `archivedAt`) — ADR-015's Addendum explicitly pins this as intended
  ("archived-but-not-revoked management members retain management
  rights"), a different, narrower policy than `canAuthorCourse`'s
  Run-005-specific stricter gate; the two are not meant to converge.
- archived-Course metadata/join-policy controls are disabled in the UI
  (editing them has no product effect once a Course is terminal-ARCHIVED).

Implemented (Slice S4 — Flat Topic Model + Topic Authoring V1):

- `topics` table (migration `20260927000000_topics_v1.sql`): `id`,
  `course_id` (FK, `on delete restrict`), `name`, `archived_at`,
  timestamps. Flat only — no parent/nesting/prerequisite columns. No hard
  delete: archiving excludes a Topic from listing but never removes the
  row, preserving referential integrity ahead of a future Question<->Topic
  association (planned for Run 006, see `docs/UNLOCK_ROADMAP.md`).
- `src/domain/topic/`, `src/application/topic/` (createTopic /
  listTopicsForCourse / renameTopic / archiveTopic), 
  `src/infrastructure/postgres/topic-repository.ts` — authorization reuses
  `canAuthorCourse` unchanged, same policy as every other Run-005
  content-authoring action.
- `renameTopic`/`archiveTopic` take both `courseId` (checked first, before
  the Topic is ever loaded) and `topicId`, and collapse a Topic that
  exists but belongs to a different Course into the same `TOPIC_NOT_FOUND`
  outcome as a nonexistent one — closes "do not allow cross-Course Topic
  association" without leaking which Course a Topic actually belongs to.
- Three routes under `/api/courses/:courseId/topics/` (list/create,
  rename, archive) plus a Topics section (list, inline rename, add,
  archive-with-confirm, empty state) added to the instructor Course manage
  page from S3.

Run 005 closed intentionally after S4 — a coherent product boundary (Course
lifecycle + instructor authoring UI + flat Topic model) — rather than
continuing through its originally-planned S5-S10. See
`docs/RUNS/2026-09-20-005.md` for the full scope-closure rationale.

**Not yet implemented** (moved to future Runs per `docs/UNLOCK_ROADMAP.md`,
not abandoned):

- manual question authoring (SINGLE_CHOICE/MULTIPLE_CHOICE) — Run 006
- QuestionVersion publish/edit lifecycle — Run 006
- Structured Import (JSON/spreadsheet adapters) — Run 007
- end-to-end authoring workflow integration — Run 008

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

Run 005 instructor-authoring APIs (S2-S4 — see Course Authoring above for the
`/instructor/` UI that consumes these):

- `POST /api/courses` (create, DRAFT)
- `GET`/`PATCH /api/courses/:courseId/manage` (authoring read / metadata update)
- `POST /api/courses/:courseId/publish`
- `POST /api/courses/:courseId/archive`
- `PATCH /api/courses/:courseId/join-policy` (S3)
- `GET`/`POST /api/courses/:courseId/topics` (list active / create, S4)
- `PATCH /api/courses/:courseId/topics/:topicId` (rename, S4)
- `POST /api/courses/:courseId/topics/:topicId/archive` (S4)

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

### Committed locally, NOT yet applied to hosted Supabase

10. `20260926000000_course_lifecycle_v1.sql` (Run 005 S2) — adds
    `courses.status`/`courses.exam_date`. PGlite-verified only (full
    `npm run test:schema` suite green plus a dedicated atomicity/rollback
    suite for the new `PostgresCourseUnitOfWork`); not yet pushed to the
    real hosted project.
11. `20260927000000_topics_v1.sql` (Run 005 S4) — adds the `topics` table
    (flat, Course-scoped, archive-not-delete). PGlite-verified only (full
    `npm run test:schema` suite green, 224/224 including 10 new
    `topic-repository.test.ts` cases); not yet pushed to the real hosted
    project.

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

At pushed HEAD `a03efa4` (Run 005 close; see Repository State) — Run 006 S2 is in progress on top of this baseline, not yet committed at the time these counts were last confirmed:

- Unit tests: `778 / 778`
- Schema/Postgres (PGlite): `224 / 224`
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

No known code blocker.

No remote migration gate remains for previously-applied migrations. Run 005 S2/S4 add two new
migrations (`20260926000000_course_lifecycle_v1.sql`, `20260927000000_topics_v1.sql`) that are
committed locally and PGlite-verified only — not yet applied to hosted Supabase (see
Database / Migration State).

---

## Manual Actions Required

1. Manually exercise hosted Today Skip and hosted New Material fallback (the two Verification State items not yet confirmed against the hosted project).
2. Decide how to safely provide golden-path E2E fixtures (a dedicated non-production Supabase project, or a manually created hosted test learner + OPEN course), then run `npx playwright install chromium && npm run test:e2e` per `e2e/README.md`.
3. Apply `20260926000000_course_lifecycle_v1.sql` and `20260927000000_topics_v1.sql` to hosted Supabase when ready (requires explicit authorization — Claude must not run `supabase db push`).
4. Production deployment remains outstanding.

Do not perform hosted mutations automatically.

---

## Immediate Development Checkpoint

Pushed product/application baseline:

`66df9f9`

Current pushed HEAD:

`a03efa4`

Run 005 is closed and pushed (Slices S1-S4 — see `docs/RUNS/2026-09-20-005.md`
for the full Run Report and scope-closure rationale). Run 006 (Question
Authoring & Publishing V1, `docs/CHATGPT_PLAN.md`) is in progress on top of
`a03efa4`; see that Plan for current Slice status.

Do not infer next work from historical run context beyond what
`docs/UNLOCK_ROADMAP.md` and `docs/DEV_STATUS.md` currently state. See
`docs/RUNS/2026-09-20-004.md` for Run 004's full handoff and
`docs/RUNS/2026-09-20-005.md` for Run 005's completed Run Report.

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
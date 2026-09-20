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

`d67371a` — `align active docs with current implementation`

Last pushed application-feature baseline (product code, pre-Development-OS-V1 documentation work):

`66df9f9` — `add open-course learner onboarding`

Remote:

`origin/feature/project-foundation`

Development OS V1 is committed and pushed (`0135495`); the subsequent active-documentation consistency pass is committed and pushed (`d67371a`).

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
- `/today`
- `/join/[courseId]`

Implemented relevant APIs include:

- `GET /api/daily-plan/today`
- `POST /api/daily-plan/items/:itemId/answer`
- `POST /api/daily-plan/items/:itemId/skip`
- `POST /api/user/timezone`
- `GET /api/courses/:courseId`
- `POST /api/courses/:courseId/join`

This list is a current capability summary, not an exhaustive API specification.
Use the API docs / source for full contracts.

---

## Database / Migration State

### Applied to hosted Supabase

The original hosted migration chain through:

`20260923000000_auth_user_provisioning.sql`

has been applied and previously verified against the real hosted Supabase project.

This includes the original seven hosted migrations:

1. `20260917203000_initial_schema.sql`
2. `20260918000000_question_answer_model_v1.sql`
3. `20260919000000_course_membership_v1.sql`
4. `20260920000000_user_timezone_v1.sql`
5. `20260921000000_daily_plan_v1.sql`
6. `20260922000000_daily_plan_item_state_consistency.sql`
7. `20260923000000_auth_user_provisioning.sql`

### Committed but NOT yet applied remotely

The following later migrations are committed and locally tested but still require explicit user-authorized remote application:

- `20260924000000_daily_plan_answer_attempts.sql`
  - links Attempts to DailyPlan / DailyPlanItem safely
  - supports Today answer submission

- `20260925000000_daily_plan_new_material_v1.sql`
  - extends DailyPlanItem constraints for New Material V1

Migration readiness for both has been reviewed (Run `2026-09-20-002`, `unlock-db-reviewer`) and approved for hosted application as written — forward-only, additive, no unresolved DB blocker. See `docs/RUNS/2026-09-20-002.md` for the review detail. They are still NOT applied to hosted Supabase.

Do NOT assume hosted Supabase supports the newer answer/new-material flows until these migrations are explicitly applied remotely.

Claude must not run `supabase db push` without explicit user authorization.

---

## Verification State

### Verified against real hosted Supabase / browser

Previously verified:

- hosted Supabase connectivity
- real `DATABASE_URL`
- original migration chain through auth provisioning
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

### Locally verified after Slices 1–6

Verified through unit / route / PGlite integration coverage as applicable:

- Today answer submission
- DailyPlanItem ownership
- answer idempotency
- Attempt → DailyPlan linkage
- Manual Practice / Today separation
- Today Skip semantics
- New Material discovery and fallback
- no fake progress for unseen material
- OPEN course join
- OWNER / INSTRUCTOR role preservation
- revoked membership fail-closed behavior
- safe login redirect allowlist
- join route auth-before-DB ordering
- public course-summary projection
- joinCourse against real Postgres repositories in PGlite

### Not yet manually verified against current hosted schema

Because the two newer migrations have not been applied remotely, the following current capabilities have NOT yet been exercised end-to-end against the hosted project:

- real hosted Today answer submission
- real hosted Today Skip after the new answer-linkage migration
- hosted New Material fallback
- real OPEN-course join through the complete QR/link → login → join → Today browser flow
- full learner completion flow using the current post-Slice-6 product state

These require an explicitly authorized remote migration/application and manual QA step.

### Demo-journey coverage audit (Run 2026-09-20-002)

Every non-UI "Must verify" item for the join → Today → answer → Skip → completion learner journey was individually re-confirmed against actual existing test bodies (not inferred from names): repeated-join idempotency, AUTHORIZED_ONLY fail-closed, revoked-membership fail-closed, same-day DailyPlan reuse, grading-data non-leakage before submission, answer/Skip retry idempotency, resolved-item immutability, and New Material's deterministic-up-to-3/no-fake-evidence behavior are all directly proven at unit/application/PGlite layers. No demo-blocking defect was found; no code changed. The only unproven layer is pure browser-level UI wiring (redirect navigation, feedback rendering) — no automated browser harness exists in this repo, and the current Plan directs manual QA rather than adding one. See `docs/RUNS/2026-09-20-002.md` for the manual browser QA script.

---

## Current Test Baseline

At HEAD `d67371a` (confirmed unchanged as of Run `2026-09-20-002`; last pushed application baseline remains `66df9f9`):

- Unit tests: `592 / 592`
- Schema/Postgres (PGlite): `194 / 194`
- Typecheck: clean
- Lint: clean
- `git diff --check`: clean

These values are development checkpoints, not permanent numeric requirements.

Future test counts may increase or decrease legitimately as the suite evolves.

---

## Known Gaps / Limitations

Current known items include:

- production deployment is not yet complete.
- final learner-facing visual/demo polish remains.
- full current learner loop still needs manual browser QA after remote migrations are applied.
- revoked CourseMembership rejoin policy remains intentionally unresolved.
- malformed/non-UUID course path parameters currently follow a broader existing API pattern that can produce a generic `500` rather than a cleaner `404`/validation response; this is low-priority and not specific to the join feature.
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

No known code blocker at pushed HEAD `d67371a` (last pushed application-feature baseline: `66df9f9`).

Remote end-to-end verification is intentionally blocked until the user explicitly authorizes application of the committed-but-not-remote migrations.

---

## Manual Actions Required

Before hosted end-to-end QA of the newest learning flows:

1. ~~Review the committed migration state.~~ Complete — reviewed and approved, Run `2026-09-20-002`.
2. User explicitly authorizes and performs the remote Supabase migration push.
3. Verify hosted migration success.
4. Manually exercise the real learner flow:
   - login
   - OPEN course join
   - timezone handling
   - Today generation
   - answer
   - Skip
   - progress through Today
   - completion
   - New Material behavior where applicable

Do not perform these hosted mutations automatically.

---

## Immediate Development Checkpoint

Pushed product/application baseline:

`66df9f9`

Current HEAD (unchanged by Run `2026-09-20-002` — an investigation/verification Run with zero code changes):

`d67371a`

Run `2026-09-20-002` is complete through its explicit `MANUAL_REMOTE_GATE` stop point: migration readiness reviewed and approved, demo journey verified with no defects found. Full detail: `docs/RUNS/2026-09-20-002.md`.

Next execution work must come from a new:

`docs/CHATGPT_PLAN.md`

Do not infer the next slice from historical run context.

The Development OS V1 transition is complete.

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
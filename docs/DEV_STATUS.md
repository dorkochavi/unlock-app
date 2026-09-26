# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-26 (Run 009 close)

## Repository

- Release state (2026-09-26, ADR-019): `main` is Production truth (Vercel
  Production Branch = `main`). `v0.1.0` (`8e137e6`) is the first manually
  verified Production RUNTIME baseline and includes Run 009; the verification
  was performed against `8e137e6`. Docs-only commits may advance `main` (and so
  the deployed Git SHA) past it without a new tag while runtime behavior is
  unchanged — the currently deployed SHA is whatever `main` is; use Vercel/git,
  not this file, for it. Minimal CI (`.github/workflows/ci.yml`: typecheck,
  lint, unit tests) is active and passed on `8e137e6`. This baseline is NOT a pilot approval (see
  `docs/PILOT_READINESS.md`). Development happens on short-lived `feature/*` /
  `fix/*` branches; `feature/project-foundation` (last commit `e0f1473`) is
  retired as the working branch.
- Working tree: expected clean at every durable checkpoint (this document
  does not itself change that). Not pushed — remote push remains a
  manual/human action.
- Git (`git log`/`git status`) is the canonical source for the exact
  current local HEAD and ahead/behind count — never hardcoded here,
  since this document is itself committed and would go stale against its
  own claim immediately.
- Run 008 (Authoring Integration + Pilot Readiness) implementation work
  landed through `IMPLEMENTATION_HEAD` `b86d4e3` (see
  `docs/RUNS/2026-09-22-008.md` for that Run's exact Slice commits);
  this Run's own close-out/patch commits land after it. Run 008 added
  product code (safe review-bundle tooling, real calendar-date
  validation, Structured Import row-count limit, auth-before-body-parsing
  across 10 routes, a learner-eligibility fix, instructor workflow copy)
  and test-only integration evidence. No schema/migration change.
  Run 008 is COMPLETE — all pilot manual gates closed 2026-09-23 (see
  "Pilot Readiness").
- Run 007 (Structured Import V1) was pushed to origin between its own Run
  Report being written and Run 008 starting — Run 008's `BASE_HEAD` was
  the already-pushed `d509987`, not Run 007's own local HEAD at the time
  its Run Report was written.
- Hosted/remote mutation remains human-controlled.

## Product Direction

UNLOCK is a Hebrew-first, RTL-first, mobile-first adaptive learning application.
Its core differentiator is a longitudinal learner model that determines the next best learning action.

Pilot target: Ruppin Academic Center.

Primary learner navigation direction:
- Today
- Progress
- Courses

Primary instructor navigation direction:
- Courses
- Students
- Insights

## Current Product Capabilities

Current repository capabilities include:
- authentication and authenticated API boundaries (all authenticated JSON
  routes now authenticate before parsing the request body — Run 008 S1.E);
- Course + CourseMembership with `OWNER`, `INSTRUCTOR`, `LEARNER` roles;
- OPEN / AUTHORIZED_ONLY join behavior;
- Course lifecycle (`DRAFT`, `PUBLISHED`, `ARCHIVED`);
- flat Course-scoped Topics;
- SINGLE_CHOICE / MULTIPLE_CHOICE Question authoring;
- draft save/edit;
- explicit publish/re-publish;
- immutable QuestionVersion history;
- immutable historical Attempts;
- UserQuestionProgress / learner-state foundations;
- FSRS-backed memory scheduling;
- mastery/evidence/misconception handling;
- persisted DailyPlan / DailyPlanItems;
- Today answer + Skip behavior;
- New Material fallback V1;
- learner shell / My Courses / Course View;
- Structured Import V1 (JSON/CSV) — preview/confirm into DRAFT_ONLY
  Questions, with source-size AND row-count HTTP/application-layer limits
  (Run 008 S1.D);
- a coherent instructor authoring workflow: Course → Topics → author or
  import Questions → publish Questions → publish Course → share join
  link, with an explicit draft/published Question-count summary near the
  Course publish action (Run 008 S3);
- instructor Item Analysis (Pre-Pilot S1/S2): Course-scoped, aggregate-only,
  current-QuestionVersion-only view for OWNER/active INSTRUCTOR of a PUBLISHED
  Course (`GET /api/courses/:courseId/item-analysis`, page under the Course
  Questions section). Counts the first Attempt per distinct active LEARNER;
  disclosure gated by `src/domain/insights/aggregate-disclosure.ts` (minimum 5
  active learners and 5 distinct responders, else no numbers); shows responder
  count and an incorrect rate rounded to the nearest 10 points, never exact
  correct/incorrect counts; manual refresh only. It is NOT a per-answer live
  scoreboard — refresh after a group answering window. **Run 009 S3 (`aa9f858`;
  Production-verified at `v0.1.0`, 2026-09-26) replaced the responder count and rounded rate with coarse
  descriptive first-answer bands (MOSTLY_CORRECT / MIXED / MOSTLY_INCORRECT) or
  an explicit insufficient-data state — no counts, percentages, identity or
  per-option data (F-02 contract) — and added Topic-level Insights
  (`GET /api/courses/:courseId/topic-insights`) and a visible "ניתוח תשובות"
  entry on the Course page (PUBLISHED Courses only, intentionally).**;
- learner Progress (Run 009 S1/S2, Production-verified at `v0.1.0`): `GET
  /api/courses/:courseId/topic-progress` returns the caller's own qualitative
  Topic states (NOT_STARTED / IN_PROGRESS / NEEDS_REINFORCEMENT / SOLID) with
  attempted-of-total coverage; access = LEARNER role + `hasAccess` (ADR-015;
  archived-but-not-revoked allowed), Course must be PUBLISHED (temporary local
  rule; F-04b open). Global learner-nav destination `/progress` composes the
  active Course listing (`/api/courses/mine`) with this endpoint. No
  percentages or scores; Today remains the only next-action system. Topic
  semantics: ADR-018 (current-derived);
- Playwright E2E harness (the automated suite was not executed against a
  real environment; the pilot journey was instead proven by a manual
  browser flow against hosted Supabase — see "Pilot Readiness" below).

## DailyPlan / Today

Current accepted behavior is governed by ADR-016/017.

Key current truths:
- one persisted DailyPlan per learner-local calendar day;
- global Today and Course Today are views over the same plan;
- plan normally freezes after generation for the day;
- no automatic carry-over;
- Manual Practice does not resolve Today items;
- Skip resolves the plan item without creating Attempt/mastery/misconception evidence;
- New Material is deterministic fallback-only in V1;
- only active LEARNER memberships auto-participate;
- as of Run 008 S4, a Course whose own `status` is `ARCHIVED` is also
  excluded from automatic DailyPlan eligibility, even for a LEARNER
  membership that is itself neither revoked nor archived
  (`getOrCreateDailyPlanForToday`'s `filterToPublishedCourseIds`) — closes
  a gap where an instructor archiving a Course did not stop that Course's
  content from being pooled into a learner's Today. This is per-Course,
  distinct from `CourseMembership.archivedAt` (a per-learner fact, ADR-015
  §9, already excluded before this Run).

## Question Authoring / Publishing

Run 006 delivered:
- draft persistence and Topic association;
- authoritative publish-ready validation;
- manual authoring APIs/UI;
- transaction-backed first publish and re-publish;
- immutable QuestionVersions;
- historical Attempt preservation;
- draft-only learner exclusion;
- archived Course publish guard.

Accepted V1 limitation:
- concurrent publish to the same Question is not lock-serialized;
- unique `(question_id, version_number)` prevents corruption;
- one racing request may receive generic INTERNAL_ERROR.

Run 008 S5 added an integration-level proof
(`supabase/tests/postgres/run-008-authoring-integration-walkthrough.test.ts`)
that manual authoring, publish, and re-publish continue to preserve
immutable QuestionVersion history when exercised inside the SAME
end-to-end journey as Structured Import and Course publish/learner join —
not merely in isolation.

## Structured Import V1

Run 007 delivered one canonical, format-independent import pipeline on top
of Run 006's Question/QuestionVersion model:
- `src/domain/import/types.ts`: `CanonicalQuestionRow`, row-content
  validation reusing `assertValidQuestionAnswerDefinition`, Topic-name
  resolution (trimmed/case-insensitive, unique-match-only, never resolves
  ambiguity arbitrarily);
- JSON and CSV source adapters (`src/application/import/adapters/`), one
  shared key-based answer-option contract (`papaparse` for CSV);
- `previewImport` (stateless, read-only, no writes under any input) and
  `confirmImport` (two-phase: a non-transactional reparse/revalidate of the
  raw source — never trusts a prior preview call — followed by one
  transaction that re-checks only the mutable DB-dependent invariants a
  concurrent change could invalidate, then atomically creates every
  Question via the existing unchanged `createDraft`/`updateDraft`);
- `POST /api/courses/:courseId/import/preview` and `.../import/confirm`,
  authenticated (auth resolved before the request body is parsed as of Run
  008 S1.E — an unauthenticated request never pays for JSON-parsing a body
  it can never use, matching every other authenticated JSON route),
  Course-scoped, DTO-mapped, with an HTTP-boundary source-size limit
  (`MAX_IMPORT_SOURCE_LENGTH`, resolving FUB-005) and an application-layer
  row-count limit (`MAX_IMPORT_ROWS = 2,000`, Run 008 S1.D, the other half
  of FUB-005);
- a minimal instructor UI (`/instructor/courses/:courseId/import`): format
  choice, paste/upload, Preview action with a valid/invalid row table, and a
  Confirm action (disabled while any row is invalid) that links back into
  the existing, unmodified Course Question list/editor/publish flow, with
  the `SOURCE_TOO_LARGE`/`TOO_MANY_ROWS` 413 outcomes now shown with
  distinct copy (Run 008 S3).

Accepted V1 scope boundaries (unchanged from the Plan):
- import creates new Questions only, never updates/merges an existing one;
- imported Questions remain `DRAFT_ONLY` — import never creates a
  `QuestionVersion` and never auto-publishes;
- import never auto-creates Topics — an unresolved/ambiguous Topic name is a
  row-level error, never resolved arbitrarily;
- confirm is genuinely all-or-nothing: any invalid row, or any concurrent
  Course/Topic/authorization change detected inside the write transaction,
  rejects the whole batch with zero writes;
- XLSX, native PDF ingestion, and any "publish all imported" bulk action
  remain out of scope.

No schema/migration change was required — import reuses the `questions`,
`question_versions`, and `topics` tables exactly as Run 006 left them.

Accepted V1 concurrency limitation (Run 008 S1.F, re-inspected against the
real transaction, not merely asserted): `confirmImport`'s Phase 2 re-check
(`src/application/import/confirm-import.ts`) reads actor membership,
Course status, and each resolved Topic's Course/active status inside one
`BEGIN`ed transaction (default READ COMMITTED, `PostgresImportUnitOfWork`
takes no explicit isolation level and no repository issues `SELECT ... FOR
UPDATE`), then loops `createDraft`/`updateDraft` per row without
re-checking again. A concurrent membership revoke / Course archive / Topic
archive that commits after this re-check's `SELECT`s but before this
transaction commits is not caught — plain reads take no lock. Unlike Run
006's analogous publish race, there is no unique-constraint backstop here
(each imported Question gets a fresh id, so nothing collides) — the
practical exposure is a small number of `DRAFT_ONLY` Questions created
into a Course/Topic that became archived moments earlier, not corruption
or a learner-facing leak (draft-only content is never learner-eligible
regardless). Acceptable for the single-editor Ruppin V1 pilot; not
pessimistically locked. Tracked in `docs/FOLLOW_UP_BACKLOG.md` (FUB-014).

## Repository Tooling (Run 008 S1.A)

`npm run bundle:review` (`scripts/create-review-bundle.mjs`) produces a
deterministic, safe repository snapshot under `scratch/review-bundle/
<timestamp>/` for external review, built from `git ls-files` (tracked,
non-deleted paths) rather than a raw directory copy, with a
defense-in-depth unsafe-pattern filter (including tracked-symlink
detection) as a second layer. Replaces manually zipping the working
directory, which previously included local/sensitive artifacts a prior
audit found.

## Database / Supabase

Supabase project:
- name: UNLOCK
- ref: `luinowttujolknxsduug`
- region: Central EU / Frankfurt

Hosted migrations are confirmed aligned through
`20260929000000_retire_today_session.sql` — all 13 committed migrations
are applied hosted; `npx supabase migration list` showed local = remote
(human-confirmed, 2026-09-23).

No new migration was introduced by Run 008 itself; the pre-Run-009
TodaySession retirement migration (`20260929000000`) was the 13th and was
applied hosted after the backup gate closed.

Do not infer hosted application from local migration existence.
Claude must not run `supabase link` or `supabase db push`.

## Legacy TodaySession Retirement (pre-Run-009, 2026-09-23)

`DailyPlan`/`DailyPlanItem` (ADR-016) is now the sole active Today runtime
and persistence model. The superseded Course-scoped `TodaySession` model
(ADR-011) has been fully retired from the active repository:

- all `TodaySession`/`TodaySessionItem` application/domain/infrastructure
  code and dedicated tests removed (`src/application/learning/today-session.ts`,
  `src/infrastructure/postgres/today-session-{repository,mapper}.ts`, and
  their test suites);
- `Attempt.todaySessionId`/`Attempt.todaySessionItemId` and every
  `todaySessionItemId`-only compatibility branch in `submitAnswer` removed;
  `SubmitAnswerResult`'s `TODAY_SESSION_ITEM_NOT_FOUND_OR_NOT_OWNED` outcome
  removed;
- migration `20260929000000_retire_today_session.sql` drops
  `today_sessions`, `today_session_items`, and
  `attempts.today_session_id`/`attempts.today_session_item_id` (committed,
  locally/PGlite-verified and since applied hosted — see above);
- confirmed human evidence before deletion: hosted `today_sessions` = 0
  rows, `today_session_items` = 0 rows,
  `attempts.today_session_item_id IS NOT NULL` = 0 rows; a runtime
  reachability audit confirmed no live `src/app` route ever created or
  retrieved a TodaySession;
- shared domain utilities `today-planner.ts`/`next-best-action*.ts` (also
  used by live DailyPlan generation) were kept, unchanged;
- ADR-011 marked SUPERSEDED AND RETIRED; `docs/FOLLOW_UP_BACKLOG.md` FUB-012
  marked `RESOLVED`.

No remaining action: `20260929000000_retire_today_session.sql` is applied
hosted.

## Pilot Readiness (Run 008)

Assessed against the Ruppin pilot, not full production hardening (Run 012).
All Run 008 pilot manual gates are **CLOSED** (human-confirmed 2026-09-23);
no pilot-readiness blocker remains from Run 008. Detailed evidence lives in
`docs/RUNS/2026-09-22-008.md` ("Pilot Manual Gate Closure"), not here.

- **Product self-sufficiency**: CLOSED — the full instructor-to-learner loop
  is reachable through the product UI with no SQL/seed/developer
  intervention (APPLICATION INTEGRATION proof in S5, plus the hosted
  browser proof below).
- **Hosted migrations**: CLOSED — all 13 migrations applied; local = remote
  through `20260929000000` (see "Database / Supabase").
- **Postgres/Vercel connection strategy**: CLOSED — `DATABASE_URL` targets
  Supabase's Transaction Pooler (port `6543`); `pg.Pool` defaults to
  `max: 1` in `src/infrastructure/postgres/pg-pool.ts`, overridable via
  `DATABASE_POOL_MAX` (integer 1..10). **Hosted decision (Pre-Pilot S3,
  2026-09-24): set `DATABASE_POOL_MAX=5`.** A 30-learner hosted burst at
  `max=1` queued requests behind the single connection (Today p95 18.9 s,
  Answer p95 14.7 s); at `max=5` Today p95 was 4.85 s and Answer p95 3.18 s,
  30/30 succeeded in both. Evidence and limits: `docs/CHATGPT_PLAN.md` "S3
  Result"; Today/Answer round-trip reduction is deferred (FUB-026). Hosted browser
  verification from a local machine initially failed with
  `SELF_SIGNED_CERT_IN_CHAIN` (Node `pg` TLS chain verification against
  the pooler); supplying Supabase's server root CA as an explicit SSL root
  certificate resolved it. The CA is a public certificate, not a secret,
  but is a local/runtime dependency — it is git-ignored (repo-root `/supabase-ca.crt` only), not
  committed, and no credentials belong in the repository. A hosted Vercel
  deployment then failed with `ENOENT` because `DATABASE_URL`'s
  `sslrootcert=<local path>` was read on the server. TLS is now resolved by
  `src/infrastructure/postgres/pg-ssl-config.ts`: CA contents via
  `DATABASE_SSL_CA` (hosted), or a file via `DATABASE_SSL_CA_FILE` /
  `sslrootcert` (local); verification is never disabled. Hosted TLS with
  `DATABASE_SSL_CA` is covered by unit tests only — not yet proven against the
  deployed app.
- **Backup readiness**: CLOSED — a manual hosted logical backup
  (`schema.sql`, `roles.sql`, `data.sql`, each inspected as non-empty) was
  created outside the repository, with a second copy off the machine. The
  data dump warned about circular foreign keys between `questions` and
  `question_versions`; the dump itself completed. **No restore drill was
  performed**; no RPO/RTO guarantee is claimed (FUB-009 still tracks
  ongoing backup ownership/restore verification as post-pilot work).
- **Browser/hosted E2E**: CLOSED — manual browser flow against the local
  Next.js app connected to hosted Supabase. Learner `/today` answered
  3/3 items to completion; instructor flow Course → Topic → manual
  Question → Structured Import (Preview/Confirm → DRAFT-only) → Question
  publish → Course publish → share link → signup/auth → AUTHORIZED_ONLY
  join gate → OPEN join → learner `/today` showing the new Course's
  `NEW_LEARNING` item. Evidence label: BROWSER LOCAL app + HOSTED
  Supabase (manual); the automated Playwright suite was not run.
- **Dependency/security audit**: `npm audit` — 0 vulnerabilities across
  529 dependencies (Run 008). Not re-run merely because time passed.
- **Runtime troubleshooting posture**: `POST-PILOT BACKLOG` (FUB-008) —
  route handlers log unexpected errors server-side with route context;
  Vercel captures function logs by default.
- **Abuse/platform hardening**: `POST-PILOT BACKLOG` (FUB-011).

## Pre-Pilot Validation Run (RUN_ID `2026-09-23-PRE-PILOT`)

Status: formally OPEN on Content only. S1 (aggregate privacy contract) and S2 (Item Analysis) COMPLETE; S3 (synthetic classroom burst) PASS; S4 Technical Go/No-Go **PASS** (2026-09-25); Content Go/No-Go **WAITING FOR REAL PILOT MATERIAL** (NOT EXECUTED, NOT PASS); real pilot **NOT YET APPROVED**. The durable pilot gate — remaining checklist, environment/release model (one app, Local / Vercel Preview / Production, no Staging), and the reusable operational protocol — lives in `docs/PILOT_READINESS.md`. Evidence: `docs/RUNS/2026-09-23-PRE-PILOT.md` and `docs/RUNS/2026-09-24-OVERNIGHT-PREPILOT.md`.

Hosted configuration that must remain (hosted Vercel environment):
- `DATABASE_SSL_CA` = PEM contents of the Supabase root CA (public certificate);
  a local file path in `DATABASE_URL` is never read when it is set;
- `DATABASE_POOL_MAX=5` (code default stays 1; valid range 1..10). Hosted S3 at
  30 learners: `max=1` Today p95 18.9 s / Answer p95 14.7 s (requests queued
  behind the single connection); `max=5` Today p95 4.85 s / Answer p95 3.18 s;
  30/30 succeeded in both. Optional `DATABASE_POOL_LOG_STATS=true` for queue
  observability.
Deferred: Today/Answer round-trip reduction (FUB-026), answer idempotency vs
server-generated `answeredAt` (FUB-025), further analytics follow-ups
(FUB-023/024), post-pilot learning-visibility directions (FUB-018..022; FUB-018 partially promoted to and delivered by Run 009: simple Topic-state Progress only; the rest stays deferred).

## Verification Baseline

Run 006 final product verification recorded:
- unit: 911
- schema: 253
- typecheck: clean
- lint: clean
- production build: clean
- diff check: clean
- final review: no blockers

These are historical evidence for the Run 006 code baseline, not a claim that later product changes have been tested.

Run 007 (Structured Import V1) final per-Slice evidence — no full-suite
re-run was performed at Run close:
- typecheck: clean; lint: clean;
- unit (targeted, cumulative): 291 passed;
- schema/PGlite (S6): 10/10 passed;
- reviewers: DB, security, and general reviewers each returned NO
  BLOCKING FINDINGS across S3-S6 after fixing every CORRECTIONS-REQUIRED
  finding raised along the way;
- browser/E2E: not performed.

Pre-Pilot (2026-09-23/24): full unit 1227/1227 (126 files) after the last code
change (pool-size config); Item Analysis PGlite 7/7; typecheck/lint clean;
local synthetic burst (real Postgres, 30 and 40 learners, both pool shapes)
green; hosted 30-learner burst PASS at `DATABASE_POOL_MAX=5`. Hosted evidence
came from a Preview deployment with pre-confirmed accounts; real signup/email,
mobile/RTL and cellular were later proven manually on Production (2026-09-25, S4).

Run 008 (Authoring Integration + Pilot Readiness) final evidence:
- typecheck: clean (full repo, re-verified after every Slice);
- lint: clean (0 errors; one pre-existing, unrelated warning in
  `.claude/telemetry/statusline.mjs`, not touched by this Run);
- unit: full suite run repeatedly through the Run (cross-cutting changes
  in S1/S4 justified full-suite reruns per `.claude/rules/testing.md`
  §5) — final full run 1073/1073 passed, 120 files;
- schema/PGlite (`npm run test:schema`, real Postgres): final full run
  266/266 passed, 25 files — includes the new Run 008 S5 integrated
  walkthrough and the S4 archived-Course regression tests;
- reviewers: `unlock-security-reviewer` (mandatory, S1.E and S4),
  `unlock-db-reviewer` (mandatory, S4), and `unlock-reviewer` (S1
  non-security scope, S5) each returned NO BLOCKING FINDINGS, after
  fixing every non-blocking finding raised along the way (see
  `docs/RUNS/2026-09-22-008.md` for detail);
- `npm audit`: 0 vulnerabilities, 529 dependencies;
- browser/E2E: automated suite not run; manual hosted browser proof
  completed 2026-09-23 — see "Pilot Readiness" above.

## Development OS V1.2

V1.2 direction is established:
- one owner per operational responsibility;
- testing rule owns verification selection/freshness;
- `review-commit` owns reviewer selection;
- `checkpoint` validates evidence/state;
- review precedes final relevant verification;
- Run-end acceptance reuses fresh Slice evidence;
- historical Runs are restricted context;
- Follow-Up Backlog captures useful deferred work;
- Cursor rules are tool-specific projections;
- telemetry is a COLD observability layer.

The Development OS V1.2 Final Compression Patch is complete in this repository snapshot. It reduces remaining context duplication without changing those policies or product/runtime behavior.

## Development OS — Active Observations

Rolling state only — not a diary. An item leaves this list the moment it resolves (`DROP`/`ABSORB`/`REVERT`); see `docs/DEVOS_OBSERVABILITY.md` §8 for the promotion lifecycle. Evidence lives in `docs/RUNS/2026-09-22-008.md` and its own follow-up audits, not copied here.

- **`CHANGE CANDIDATE` (promoted this Run — crossed the cross-Run bar,
  `docs/DEVOS_OBSERVABILITY.md` §6): named negative/isolation scenarios
  proven only at review, not before it.** Observed cross-Run (Run 007
  S4/S6, then again Run 008 S4) — full evidence and the required
  evidence/change/owner/effect/guardrail fields are in
  `docs/RUNS/2026-09-22-008.md`'s telemetry section, not restated here.
  Proposed smallest change: one line added to `.claude/rules/testing.md`.
  Not yet experimented with or edited this Run — a human or a future Run
  decides whether to run the experiment before `ABSORB`/`REVERT`.
- **`src/domain/import/types.ts` bundles three concerns** (canonical row shape, row-content validation, Topic-name resolution) in one file. Not costly today — reconsider only if a fourth concern or new external fan-out appears.
- **`src/domain/learning/answer.ts`**: Run 007 needed a full read of this dense, multi-function file to extract confidence about one reused function's contract. Not recurred in Run 008 — no full read of this file was needed. Candidate for `DROP` if it does not recur in one more Run.
- **Test-fakes-as-template reads** (`in-memory-fakes.ts` style files read in full purely to copy an established fake-construction convention). Recurred in Run 008 (reading `application/course/__tests__/in-memory-fakes.ts` in full to extend it with `listStatuses`/`seedMembership`'s default-fill). Still not costly — the read was necessary to add a real new method correctly, not merely to copy convention. Remains `WATCH`.
- **Telemetry has no native per-Slice attribution** — a per-Slice breakdown currently requires manual reconstruction from commit timestamps. Remains `WATCH` unless it materially limits a future analysis.
- **Development OS audit, Pre-Pilot Run (2026-09-24)** — detail in `docs/RUNS/2026-09-23-PRE-PILOT.md` §8/§9; all `WATCH`, none promoted:
  (1) Edit/Write tool-result echoes were 48% of tool-response characters (494K of 1.03M) vs Read 14% — recurred after Run 008's quiet result; the large echoes coincide with "file changed on disk" reminders after shell-side patching;
  (2) shell-based file reads (`cat`/`sed`) are invisible to `FILE_READ` telemetry (main-context Read-tool reads: 4), so read/re-read statistics undercount real source consumption;
  (3) shell-embedded code patching (`node -e`/heredocs) caused repeated quoting failures and one corrupted regex (6 recorded tool failures vs 0-3 before);
  (4) local test harnesses that share one connection or one clock can mask production request-boundary behavior (duplicate-answer and pool findings).
- **Main-session `Edit`/`Write` tool-result echoes measured larger than file-read cost in Run 007** (~147k vs. ~93k main-context tokens). Run 008 ran as a single ~54%-peak-context session with 100% average cache hit ratio and 0 compactions across the whole multi-Slice Run (`docs/RUNS/2026-09-22-008.md` telemetry section) — no evidence this Run that Edit/Write echo cost became a binding constraint. Candidate for `DROP` if a future Run also shows no material impact.

## Development OS Safety

Current hard Claude denies include:
- `git push*`;
- destructive Git reset/clean/restore patterns;
- destructive filesystem deletion patterns;
- `supabase link*`;
- `supabase db push*`.

Remote Git push and hosted database mutation remain manual/user-controlled actions.

## Known Limitations / Gaps

Product roadmap:
- Run 008 — Authoring Integration + Pilot Readiness (**COMPLETE**)
- Pre-Pilot Validation Run — IN PROGRESS, formally open on Content Go/No-Go only (Technical S4 PASS 2026-09-25; waiting for real pilot material); not a renumbering of Run 009
- Run 009 — Learner Progress + Instructor Insights (**COMPLETE**; S1/S2/S3 committed and Preview-verified; `docs/RUNS/2026-09-25-009.md`). Not a Pre-Pilot release requirement and not a pilot approval.
- Run 010 — Learning Intelligence
- Run 011 — PDF/AI
- Run 012 — Production / Scale

Run 008 status: **COMPLETE**. All autonomous Slice work (S1-S5) was
committed and reviewed with NO BLOCKING FINDINGS, S6 found no code-level
`PILOT BLOCKER`, and every pilot manual gate has since been closed
(hosted migrations, pooler connection, backup readiness, browser/hosted
E2E — see "Pilot Readiness"). The Roadmap's Milestone C exit condition is
supported by APPLICATION INTEGRATION evidence and by manual BROWSER LOCAL +
HOSTED evidence.

Known deferred maintainability work lives in `docs/FOLLOW_UP_BACKLOG.md`
(FUB-005 RESOLVED this Run; FUB-006 through FUB-016 added this Run,
capturing audit findings intentionally not acted on; FUB-001-004 remain
from before this Run, unchanged).

## Current Manual Actions

- pushing `main`, promoting to Production, creating/pushing tags and changing
  Vercel/GitHub settings remain human actions (ADR-019; see `git status` for
  the ahead count);
- decide whether to experiment with the `CHANGE CANDIDATE` Development OS
  observation above (named-negative-case test isolation) before it is
  absorbed into `.claude/rules/testing.md`;
- no Run 008 hosted-migration, backup, connection, or E2E gate remains open.

For the Pre-Pilot Run:
- remaining before the REAL pilot (content gate, SMTP/Auth email capacity, QA data cleanup) is owned by `docs/PILOT_READINESS.md` §3; confirm the hosted config above stays set.

For Run 009:
- COMPLETE (RUN_ID `2026-09-25-009`; report `docs/RUNS/2026-09-25-009.md`; Plan v003). S1 `3a1d47b`, S3 `aa9f858`, S2 `5cdd2ae`, plus join-through-auth fix `04597b4`; Preview-verified at close and **Production-verified 2026-09-26 at `v0.1.0` (`8e137e6`)** — Learner Progress, join-through-auth, Today answer flow, the instructor analysis entry/page and the privacy check all passed manually in Production (post-closeout note in the Run report). Known limitation: an Attempt on an older QuestionVersion can keep contributing to the Question-level state used by Topic Progress after a new version becomes current (accepted V1 behavior; ADR-018 does not change it). Topic semantics are now owned by ADR-018.

## Blockers

No Run 008 blocker and no technical Pre-Pilot blocker remain. Open before the real pilot: see `docs/PILOT_READINESS.md`.

Finding status (details: Run reports; Content is not PASS):
- F-12 (Today feedback): MANUAL UI VERIFIED, RESOLVED for current Pre-Pilot scope (answered item stays visible with correctness state + Continue; Continue advances).
- F-13 (join link for non-self-join Courses): MANUAL UI VERIFIED, RESOLVED (OPEN → AUTHORIZED_ONLY hid the link).
- F-14 (original finding: Today INITIAL-LOAD network failure could leave the UI stuck): RESOLVED LOCALLY for the original initial-load bug via automated tests. MANUAL VERIFIED only for the answer-submit network failure/retry path. INITIAL-LOAD MANUAL VERIFICATION: NOT EXECUTED. Not "MANUAL UI VERIFIED" as a whole finding.
- FUB-027 (signup-confirmation join intent): HOSTED + MANUAL VERIFIED, RESOLVED for current Pre-Pilot scope.
- F-01 (empty DailyPlan frozen for the local day): MITIGATED; underlying design issue deferred, NOT resolved — learners must still join before opening Today.
- F-04a (revoked learner could answer/skip existing plan items): RESOLVED LOCALLY.
- F-04b (Course PUBLISHED -> ARCHIVED after the plan exists): DECISION PENDING; untouched by Run 009. Run 009 learner Progress is PUBLISHED-only as a conservative, temporary local rule, not the final lifecycle decision for learner history.
- F-02 (Item Analysis small-n differencing): IMPLEMENTED in Run 009 S3 (`aa9f858`) under the D1 contract (no exact or bucketed responder count, coarse descriptive bands, threshold stays 5; Item Analysis and Topic Insights) and PRODUCTION-VERIFIED (`v0.1.0`, 2026-09-26). Accepted residual: at n=5 a single new answer can flip a band/eligibility between manual refreshes.
- FUB-028 (Item Analysis discoverability): RESOLVED — PRODUCTION VERIFIED 2026-09-26 (entry is intentionally PUBLISHED-only). FUB-029 (Publish validates persisted draft): UX WATCH, unchanged.
- Join intent across sign-in (Run 009 S2 Preview regression): FIXED in `04597b4`; Preview- and Production-verified. The login page read `?next=` during render, which on a client-side navigation from /join/:id sees the previous URL; it is now read at submit time through the existing safe-redirect allowlist (see FUB-027).
- Operational (not an app defect): Supabase Auth email rate limiting / SMTP capacity for a class-sized cohort — decide before the real pilot.
- Offline content validator (`docs/PILOT_CONTENT_VALIDATOR.md`) is available for the content gate.

Current execution source:
- `docs/CHATGPT_PLAN.md`

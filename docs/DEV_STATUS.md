# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-22

## Repository

- Branch: `feature/project-foundation`.
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
- Playwright E2E harness (not executed against a real environment this
  Run — see "Pilot Readiness" below).

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
`20260928000000_question_authoring_v1.sql` (all committed migrations up
to and including this one are applied hosted, per the human who closed
the Postgres/Vercel readiness gate).

No new migration was introduced by Run 008.

Do not infer hosted application from local migration existence.
Claude must not run `supabase link` or `supabase db push`.

## Pilot Readiness (Run 008 S6)

Assessed against the Ruppin pilot, not full production hardening (Run 012):

- **Product self-sufficiency**: Course creation, Topic management, manual
  Question authoring, Structured Import, explicit Question/Course publish,
  and learner join are all reachable through the product UI with no
  SQL/seed/developer intervention — confirmed by direct route/page
  inspection (Run 008 S2) and by the real end-to-end
  APPLICATION INTEGRATION proof (Run 008 S5, real Postgres/PGlite, real
  application use cases, not mocks).
- **Browser/hosted proof**: NOT PERFORMED this Run —
  `MANUAL PILOT GATE`. `.env.local` in this environment points at a
  remote (hosted) `DATABASE_URL`/Supabase project, not an isolated local
  sandbox; starting the dev server or running the existing Playwright
  suite (`npm run test:e2e`) against it would create real rows (users,
  Courses) in what is almost certainly the shared pilot Supabase project
  — autonomous hosted-database mutation is out of bounds
  (`CLAUDE.md` §6). A human should either point a local/disposable
  Postgres+Supabase project at this repo and run `npm run dev` +
  `npm run test:e2e` themselves, or confirm the current `.env.local`
  target is safe to write pilot-shaped test data into before doing so.
- **Dependency/security audit**: `npm audit` run successfully (network
  available) — 0 vulnerabilities across 529 dependencies (45 prod, 446
  dev, 116 optional). Not re-run automatically in future Sessions merely
  because time has passed.
- **Hosted migration readiness**: `RESOLVED` — confirmed aligned through
  `20260928000000_question_authoring_v1.sql` (see "Database / Supabase"
  above).
- **Runtime troubleshooting posture**: `POST-PILOT BACKLOG` (FUB-008) —
  no application APM exists, but every route handler already logs
  unexpected errors server-side via `console.error` with route context
  before returning a safe generic response (verified across all 10 routes
  touched by Run 008 S1.E); Vercel captures this in function logs by
  default. Judged sufficient for pilot scale; a dedicated APM/structured
  logging pass is post-pilot work, not a narrow addition this Run found
  clearly warranted.
- **Backup/restore**: `MANUAL PILOT GATE` (FUB-009) — cannot be verified
  from the repository; a human must check the hosted Supabase project's
  actual backup/restore plan and settings before the pilot. No RPO/RTO
  guarantee is claimed here.
- **Postgres/Vercel connection strategy**: `RESOLVED`. Confirmed:
  `DATABASE_URL` now targets Supabase's **Transaction Pooler** endpoint
  (host ends `.pooler.supabase.com`, port `6543`, `sslmode=require`
  present in the connection string — not read/printed here, only
  confirmed by the human closing this gate). Hosted migrations are now
  aligned through `20260928000000`.
  `src/infrastructure/postgres/pg-pool.ts`'s application-side `pg.Pool`
  is explicitly capped at `max: 1` — `pg.Pool` defaults to `max: 10`
  regardless of `DATABASE_URL`, and Vercel's per-invocation serverless
  model would otherwise mean up to 10 upstream connections PER
  invocation, multiplied across concurrent invocations, working against
  (not with) the Transaction Pooler's own multiplexing. SSL remains
  un-hardcoded in code, deferred to the connection string's own
  `sslmode` parameter, unchanged from before this gate closed.
- **Abuse/platform hardening**: `POST-PILOT BACKLOG` (FUB-011) — no
  evidence found of an actual Run 008 pilot blocker.

None of the above is a `PILOT BLOCKER` in the sense of "demonstrably
unsafe or nonfunctional" — every item above is either already resolved,
or a human-verifiable/human-actionable gate, not a code defect.

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
- browser/E2E: not performed — see "Pilot Readiness" above for why and
  the exact manual gate.

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

Product roadmap remains:
- Run 008 — Authoring Integration + Pilot Readiness (IMPLEMENTATION
  COMPLETE — PILOT MANUAL GATE PENDING, see below)
- Run 009 — Learner Progress + Instructor Insights
- Run 010 — Learning Intelligence
- Run 011 — PDF/AI
- Run 012 — Production / Scale

Run 008 status: **IMPLEMENTATION COMPLETE — PILOT MANUAL GATE PENDING**.
All autonomous Slice work (S1-S5) is committed and reviewed with NO
BLOCKING FINDINGS. S6's pilot-readiness assessment found no code-level
`PILOT BLOCKER`. Two manual gates have since been resolved (hosted
migration application; Postgres/Vercel pooler-connection configuration —
see "Pilot Readiness" above). Remaining human-actionable
`MANUAL PILOT GATE`s: browser/hosted E2E proof, backup/restore
verification — or genuinely `POST-PILOT BACKLOG` work. The Roadmap's
Milestone C exit condition ("an instructor can create and publish a
course... entirely without developer/database intervention, and the full
instructor-to-learner loop is pilot-ready") is supported by
APPLICATION INTEGRATION evidence (real Postgres/PGlite, real application
use cases) but NOT by BROWSER LOCAL or HOSTED evidence — that distinction
is the one thing keeping this from being marked fully `COMPLETE`.

Known deferred maintainability work lives in `docs/FOLLOW_UP_BACKLOG.md`
(FUB-005 RESOLVED this Run; FUB-006 through FUB-016 added this Run,
capturing audit findings intentionally not acted on; FUB-001-004 remain
from before this Run, unchanged).

## Current Manual Actions

For Run 008:
- push local HEAD to `origin/feature/project-foundation` when ready
  (includes `IMPLEMENTATION_HEAD` `b86d4e3` plus subsequent close-out/
  patch commits — see `git log`/`git status` for the exact current HEAD);
- resolve the remaining pilot-readiness manual gates listed under "Pilot
  Readiness" above (browser/hosted E2E, backup/restore verification —
  hosted migration application and Postgres pooler-connection
  configuration are now resolved);
- decide whether to experiment with the `CHANGE CANDIDATE` Development OS
  observation above (named-negative-case test isolation) before it is
  absorbed into `.claude/rules/testing.md`.

For hosted Supabase:
- no new migration was introduced this Run;
- hosted migrations are now confirmed aligned through
  `20260928000000_question_authoring_v1.sql` — no pending
  migration-application action remains (see "Database / Supabase"
  above).

For Run 009:
- requires a new Plan; do not begin without one. Run 008's own remaining
  manual gates do not block starting Run 009's planning, but the Ruppin
  pilot itself cannot start until they are resolved.

## Blockers

No known product blocker is introduced by Run 008. No code-level
`PILOT BLOCKER` was found during S6's pilot-readiness assessment — every
remaining pilot-readiness item is a human-actionable manual gate (see
"Pilot Readiness" above).

Current execution source:
- `docs/CHATGPT_PLAN.md`

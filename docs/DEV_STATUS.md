# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-28 (Run UX-03-QA2 complete locally, not merged/deployed — second pre-merge Preview QA correction pass on the same branch, run as a Long Autonomous Run experiment (thin parent + fresh scoped workers); Run UX-03-QA1 complete locally; Run UX-02 merged/deployed; manual Preview QA gate + Production smoke verification both PASS; DevOS longitudinal review)

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
- mastery/evidence/misconception handling in the Learning Engine — misconception detection is currently inert
  end-to-end: it needs a high-confidence incorrect Attempt, and the production learner UI does not capture confidence
  (the Today client sends only `submissionId` + `selectedAnswer`; confidence model: OQ-014, open);
- persisted DailyPlan / DailyPlanItems;
- Today answer + Skip behavior;
- New Material fallback V1;
- learner shell / My Courses / Course View — redesigned in Run UX-01
  (merged to `main` at `d052e5c` and deployed through the Production branch,
  ADR-019; `docs/RUNS/2026-09-26-UX-01.md`): semantic tokens and shared primitives,
  Today landing + Today Complete success state, Learn Mode for the Today
  question flow (nav hidden, inline neutral feedback, focus management),
  learner sign-in `next=` for `/courses`, `/progress`, `/courses/:id`.
  UX authority: `docs/UX_SPEC.md` (temporary bridges in §9). Course/Topic
  Practice deferred (`FUB-030`, since promoted to Run UX-02). Evidence, kept
  distinct: mocked browser tests during the Run (UX states only, no real
  Supabase integration); a successful real-phone Preview verification by the
  product owner on 2026-09-26; and, separately, the deployed Production UX
  manually checked and accepted by the product owner on 2026-09-26;
- Course Practice and Topic Practice — Run UX-02 (merged to `main`
  (`c85d870`) and deployed via the Production branch, ADR-019;
  `docs/RUNS/2026-09-27-UX-02.md`): learner-initiated bounded Practice (batches
  of up to 10, explicit "עוד 10", honest no-more state, tertiary Practice Skip
  with no evidence) through the one Answer → Attempt → Progress → FSRS
  pipeline. Semantics: ADR-020 (one learner + one learning day = one
  server-controlled learning session = today's DailyPlan id; Practice never
  mutates/resolves Today; eligibility = PUBLISHED Course + active LEARNER
  membership) and `LEARNING_ENGINE.md` §39A (early correct Practice answer is
  evidence-only, never a scheduler review — `learning-engine-v2`). Routes:
  `GET /api/courses/:id/practice`, `POST /api/courses/:id/practice/answer`;
  server-computed `practiceAvailable` on the Course context; sign-in `next=`
  allowlist for the Practice screen. UI: `/courses/:id/practice` in Learn Mode;
  Course primary "תרגול בקורס" and Topic rows → Topic Practice. No migration.
  Evidence, kept distinct: PGlite/application tests with the real engine and
  the real API handlers; mocked browser matrix (UX states only); a manual
  Preview QA gate against the real Vercel Preview (hosted Supabase
  integration), PASSED by the product owner on 2026-09-27 — Course/Topic
  Practice entry, answer/feedback, Skip (not counted as incorrect), batch
  completion with an honest no-more state, Today unchanged, mobile sanity
  (`docs/RUNS/2026-09-27-UX-02.md` §5a); and a manual Production smoke
  verification, PASSED by the product owner on 2026-09-27 (Course page,
  "תרגול בקורס", Course Practice open, one answer submitted with feedback,
  Today still loads normally — §5b, not a repeat of the full Preview QA
  matrix). NOT proven: real multi-connection concurrency. The hosted Auth
  Redirect URL allow-list for Practice `next=` remains an open, non-blocking
  follow-up;
- Product experience / visual system — Run UX-03 (standalone UX Run, not a
  roadmap Product Run; **COMPLETE locally**, `feature/run-ux-03-product-experience`
  at `e6b91da`, NOT merged/deployed; `docs/RUNS/2026-09-27-UX-03.md`): the
  instructor surface and the login/join pre-product entry points converged
  onto the token-based design system the learner surface already had
  (button hierarchy, `Skeleton`/`Input`/`Select`/`Label`/`Textarea`
  primitives, a global `prefers-reduced-motion` convention, and two new
  `Button` variants — `dangerSecondary`/`dangerTertiary` — for a consistent
  destructive-action hierarchy). A durable whole-product Visual Contract was
  recorded at a required product-owner checkpoint (`docs/UX_SPEC.md`
  §11-§12: calm/mature/professional direction approved, purple/indigo
  accent retained, "one dominant primary per screen" extended to instructor
  surfaces, desktop composition named as an explicit ongoing requirement).
  Instructor and learner Browse-mode desktop layouts were widened/grouped
  into multi-column grids instead of a narrow mobile column centered in a
  wide viewport; two real client-side fetch waterfalls were measured and
  fixed (instructor Course-manage page, learner Course page — evidence:
  local mocked-latency timing, not hosted). No product/learning semantics,
  API, DB, or auth logic changed. Not yet merged/deployed — awaiting the
  product owner's decision on promotion. Followed by Run UX-03-QA1 (below),
  a pre-merge Preview QA correction pass on the SAME branch;
- Preview QA corrections — Run UX-03-QA1 (pre-merge correction pass on top of
  Run UX-03, same branch `feature/run-ux-03-product-experience`, final HEAD
  `8f45cc3`; **COMPLETE locally**, NOT merged/deployed;
  `docs/RUNS/2026-09-27-UX-03-QA1.md`): the product owner ran hands-on
  Preview QA against a real 30-question course and filed 15 findings. Every
  finding was verified against repository reality first; 11 were implemented
  and verified this Run (post-submit explanation + correct-answer reveal
  with a new POST-submit-only `AnswerFeedbackContentRepository`, deliberately
  the opposite trust boundary from the pre-answer-safe
  `LearnerQuestionContentRepository`; a stable per-presentation answer-option
  shuffle; Practice-only Topic-interleave tie-break for Tier 2/3 candidates,
  `select-practice-batch.ts`'s `interleaveByTopic`, with Tier 1/Today's own
  NBA ranking untouched; a real Practice batch-completion learning summary;
  instructor bulk review/publish reusing the existing single-Question
  `publishQuestion` transaction per selected id; Progress reduced to a
  Course-level evidence-only activity summary, Topic detail staying only on
  the Course page; a shared top-left sign-out shell control,
  `docs/UX_SPEC.md` §12 item 58; the remaining non-compliant `"היום שלי"`
  Hebrew copy instances fixed). 4 items (same-day Practice repetition
  evidence/scheduler semantics, the Today Daily Plan Budget policy, a
  possible PARTIAL grading outcome, and content-quality/position-bias
  detection signals) were investigated and explicitly recorded — never
  invented — as `docs/FOLLOW_UP_BACKLOG.md` FUB-034 (owned by Run 010) and
  FUB-035 (owned by Run 011). Evidence: typecheck/lint/full unit
  suite (1533/1533)/full schema-PGlite suite/production build all clean; a
  real mocked-browser Playwright pass (network-mocked, no real Supabase)
  covering every new UI state, 17/17 checks passed. NOT proven: real hosted
  Preview/Supabase integration, real hosted latency, true multi-connection
  concurrency — a fresh product-owner Preview QA pass against this same
  branch remains the next step before any merge/deploy decision;
- Preview QA2 corrections — Run UX-03-QA2 (second pre-merge correction pass
  on top of QA1, same branch `feature/run-ux-03-product-experience`, final
  HEAD `1c4ae33`; **COMPLETE locally**, NOT merged/deployed;
  `docs/RUNS/2026-09-28-UX-03-QA2.md`): executed as a Long Autonomous Run
  experiment — a thin parent orchestrator dispatching fresh, zero-context
  scoped workers (`Agent` tool, `subagent_type: general-purpose`) one Slice
  at a time, each running its own targeted verification and (where
  warranted) its own independent reviewer sub-dispatch, returning only a
  compact handoff to the parent. Four findings implemented and verified:
  Learn Mode post-submit feedback moved into normal document flow (Question
  → feedback/explanation → annotated options → sticky Continue, no overlay,
  color paired with text/icon, calm non-punitive incorrect tone); Progress
  and Courses cards converted to whole-card semantic navigation (single
  `<Link>` per card, hover/focus/pressed states, Progress confirmed still
  Course-level only); instructor Question Management row visual polish
  (`StatusPill` for Draft/Published) with bulk-select/publish verified
  byte-identical outside the changed hunk. One Slice — Author-can-learn-
  their-own-Course — was investigated and correctly STOPPED rather than
  implemented: `course_memberships` has `UNIQUE(user_id, course_id)` plus a
  scalar `role` column, so an Author's OWNER row cannot coexist with a
  LEARNER row on the same Course without a schema change; recorded as
  `docs/FOLLOW_UP_BACKLOG.md` FUB-036, owned by a pre-Run010/Run011 product
  decision, not invented ad hoc. `docs/FOLLOW_UP_BACKLOG.md` FUB-037 records
  the still-open future Question Management Workspace (Run011 scope).
  Evidence: typecheck/lint/full unit suite (158 files/1555 tests) /
  production build all clean across the combined diff. NOT proven: real
  hosted Preview/Supabase integration, real hosted latency, true
  multi-connection concurrency, and no new mocked-browser/Playwright
  evidence was added this Run (existing hosted E2E fixtures were not
  available in this environment; the four acceptance scenarios were instead
  confirmed by direct code reading — see the Run report) — a fresh
  product-owner Preview QA pass against this same branch remains the next
  step before any merge/deploy decision;
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

Independent audit baseline on `d3dfa9d` (clean tree, 2026-09-26): typecheck clean; lint 0 errors + 1 pre-existing unrelated warning (`.claude/telemetry/statusline.mjs`); unit 1453/1453 (143 files); schema/PGlite, production build and Playwright E2E NOT run for this baseline; static audit: 0 import cycles, 0 layer violations.

Run UX-03-QA1 (Preview QA corrections; `docs/RUNS/2026-09-27-UX-03-QA1.md`) final evidence, HEAD `0442c91`:
typecheck clean; lint 0 errors + the same 1 pre-existing unrelated warning; full unit suite 1533/1533 passed
(154 files); full schema/PGlite suite passed (includes 2 new dedicated integration test files proving the
POST-submit-only feedback content boundary and the Practice Topic-interleave tie-break against real seeded
data); production build clean; a real mocked-browser Playwright pass (network-mocked, no real Supabase;
`scratch/ux03qa1/verify-qa1.mjs`, untracked) covering every new UI state, 17/17 checks passed, run twice to
confirm genuine (non-deterministic across loads, stable within one presentation) answer-option shuffling. NOT
proven: real hosted Preview/Supabase integration, real hosted latency (Finding 14 was audited at the code
level only — no new/fixable client-side fetch waterfall found), true multi-connection concurrency.

Run UX-03-QA2 (Preview QA2 corrections, Long Autonomous Run experiment; `docs/RUNS/2026-09-28-UX-03-QA2.md`)
final evidence, HEAD `3272582`: typecheck clean; lint 0 errors + the same 1 pre-existing unrelated warning;
full unit suite 1555/1555 passed (158 files, includes 4 new targeted `.tsx` render tests via
`renderToStaticMarkup`, no jsdom/testing-library added); production build clean (`next build`, 14 routes).
Each of the 3 implementing Slices (QA2-A/B/C) also passed its own general-reviewer pass with no blocking
findings; the 4th Slice (QA2-D, Author-can-learn-own-Course) was correctly STOPPED before any implementation
on a hard `UNIQUE(user_id, course_id)` DB-constraint finding (`FUB-036`) — no reviewer needed for a docs-only
STOP. NOT proven this Run: real hosted Preview/Supabase integration, real hosted latency, true
multi-connection concurrency, and no new/extended mocked-browser evidence (hosted E2E fixtures were not
available in this environment; the 4 named acceptance scenarios were instead confirmed by direct code
reading during the integrated verification Slice, QA2-E — see the Run report for exactly what was and
was not proven this way).

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

- **`ABSORBED` (2026-09-27, DevOS longitudinal review):** named negative/isolation scenarios
  proven only at review, not before it. Cross-Run evidence reached three separate Runs (007 S4/S6,
  008 S4, UX-01's golden-path reload-assertion CORRECTION) — see
  `docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §2.2/§7. Absorbed as one line in
  `.claude/rules/testing.md` §1. Guardrail: if this exact pattern recurs a fourth time after the
  rule exists, the rule itself needs revisiting, not just its presence.
- **`src/domain/import/types.ts` bundles three concerns** (canonical row shape, row-content validation, Topic-name resolution) in one file. Not costly today — reconsider only if a fourth concern or new external fan-out appears.
- **Telemetry has no native per-Slice attribution** — a per-Slice breakdown currently requires manual reconstruction from commit timestamps / Run-report prose. Confirmed again by the 2026-09-27 longitudinal review, which needed the same manual reconstruction. Remains `WATCH`.
- **Edit/Write tool-result echoes as a large fraction of tool-response characters** — recurred cross-Run (007 yes; 008 no/non-binding; Pre-Pilot yes again at 48%, `docs/RUNS/2026-09-23-PRE-PILOT.md` §8.3/§10). Never once caused a compaction across any Run measured through UX-02 (peaks 41–59%, `docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §2.1). Remains `WATCH`, not `CHANGE` — no Run has shown actual harm, and the pattern has recurred rather than disappeared, so it is not a `DROP` candidate either.
- **RUN_ID attribution drift for post-close/meta sessions** — a Run's telemetry keeps accumulating under its `RUN_ID` until `docs/CHATGPT_PLAN.md`'s `RUN_ID:` field is changed, so docs-only or meta sessions after a Run closes (and a stray artifact, `2026-09-26-010`) get folded into that Run's cost/duration figures. Observed 2026-09-27 (`docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §5). Run UX-03 followed the recommendation and set its own fresh `RUN_ID` before starting — `WATCH`, one clean data point so far; needs a second Run to confirm this becomes habitual rather than one-off.
- **Telemetry-summary generation skipped at Run close for two consecutive Runs** (UX-01, UX-02) — unlike 007/008/Pre-Pilot/009, `summarize.mjs` was not run until backfilled by the 2026-09-27 longitudinal review (`docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §6). Run UX-03 generated its summary at close as required (`docs/RUNS/2026-09-27-UX-03.md` §13) — breaks the two-Run streak; `WATCH`, not yet `DROP` (one Run's recovery isn't 3+ Runs of non-recurrence).
- **`NEW` — Tailwind class-conflict pattern (no class-merge helper in this repo)**: a shared component's own base sizing/color classes (e.g. `Button`'s `min-h-11 px-5`, `Input`'s `py-2`) can silently lose to a conflicting `className` override, since Tailwind's compiled-CSS order — not JSX class-string order — decides which wins, and this repo has no `tailwind-merge`/`cn()` helper. Found and fixed three separate times within Run UX-03 alone (cross-Slice, not yet cross-Run) before the convention ("use a plain element instead of overriding") was written down in `docs/UX_SPEC.md` §12 item 56 partway through the Run — see `docs/RUNS/2026-09-27-UX-03.md` §13. `WATCH`; a second Run showing the same recurrence would be cross-Run evidence for a lint rule or a `cn()` helper, per `DEVOS_OBSERVABILITY.md` §8.
- **`NEW` — Long Autonomous Run architecture, first experiment (Run UX-03-QA2, one data point only — see `docs/RUNS/2026-09-28-UX-03-QA2.md` §"DevOS Experiment Review" for full evidence, not duplicated here):** thin parent + fresh scoped workers (`Agent` tool, `subagent_type: general-purpose`, sequential, zero inherited context) produced 4 Slices (3 KEEP + 1 correct STOP) at 15% peak parent context, 0 compactions, 97% cache hit ratio, 1 substantive file read in the main/parent context vs. 62 inside subagents, 0 historical-Run files read. `KEEP candidate` for continuing to use this mechanism on similarly-scoped multi-Slice work; `WATCH` for whether it holds on a second Run and at larger Slice counts before any promotion into `CLAUDE.md`/canonical DevOS policy (explicitly not promoted from this one Run, per the Run's own First-Run Experiment Rule).

Dropped this review (evidence no longer holds, 3+ Runs without recurrence — see
`docs/RUNS/2026-09-27-DEVOS-LONGITUDINAL-REVIEW.md` §3/§7): `src/domain/learning/answer.ts`'s
Run-007 full-read pattern; test-fakes-as-template full reads (hot in Runs 007/008 only).

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
- Run UX-01 — Learner UX Foundation (standalone learner-UX Run, not a roadmap Product Run; **COMPLETE**, merged to `main` (`d052e5c`), deployed via the Production branch; real-phone Preview verification PASS and, separately, manual Production verification/acceptance, both by the product owner on 2026-09-26; `docs/RUNS/2026-09-26-UX-01.md`). Open, non-blocking follow-up: hosted Supabase Auth Redirect URL allow-list for the new `next=` values — an observed login return did not preserve the intended `/courses` destination. Early Practice + FSRS semantics (`FUB-030`) decided and promoted to Run UX-02 (`docs/CHATGPT_PLAN.md`).
- Run UX-02 — Course & Topic Practice (standalone learner Run; **COMPLETE**, merged to `main` (`c85d870`) and deployed via the Production branch; manual Preview QA gate PASSED 2026-09-27 and manual Production smoke verification PASSED 2026-09-27, both by the product owner; `docs/RUNS/2026-09-27-UX-02.md`). Open, non-blocking: hosted Auth Redirect URL allow-list for Practice `next=` values; OQ-044 (FSRS learning-step calibration).
- Run UX-03 — Product Experience, Visual System & Usability (standalone UX Run; **COMPLETE locally**, `feature/run-ux-03-product-experience` at `e6b91da`, NOT merged/deployed; `docs/RUNS/2026-09-27-UX-03.md`). Required product-owner checkpoint after UX3-1 returned APPROVED WITH CALIBRATION CORRECTIONS; the resulting Visual Contract is recorded in `docs/UX_SPEC.md` §11-§12. Open, non-blocking: `FUB-033` (archive-action color consistency; possible dual-primary states on the instructor Course-manage page); a `WATCH` observation on a Tailwind class-conflict pattern that recurred three times within this Run (see the Run report §13). Followed by Run UX-03-QA1 (below), a pre-merge Preview QA correction pass on the same branch.
- Run UX-03-QA1 — Preview QA Corrections (pre-merge correction pass on top of Run UX-03, same branch, **COMPLETE locally** at `8f45cc3`, NOT merged/deployed; `docs/RUNS/2026-09-27-UX-03-QA1.md`). 15 product-owner-filed findings from real hosted Preview usage; 11 implemented and verified, 4 explicitly recorded (never invented) as `docs/FOLLOW_UP_BACKLOG.md` FUB-034 (owned by Run 010 — same-day Practice repetition semantics, Daily Plan Budget policy, PARTIAL grading) and FUB-035 (owned by Run 011 — content-quality/position-bias detection). Followed by Run UX-03-QA2 (below), a second pre-merge correction pass on the same branch.
- Run UX-03-QA2 — Preview QA2 Corrections, Long Autonomous Run experiment (pre-merge correction pass on top of QA1, same branch, **COMPLETE locally** at `1c4ae33`, NOT merged/deployed; `docs/RUNS/2026-09-28-UX-03-QA2.md`). 3 findings implemented and verified (Learn Mode post-submit feedback layout, Progress/Courses whole-card navigation, authoring row visual polish); 1 Slice (Author-can-learn-own-Course) correctly STOPPED on a hard DB constraint, recorded as `FUB-036`; `FUB-037` records the future Question Management Workspace (Run011). A fresh product-owner Preview QA pass against this branch is the required next step before any merge/deploy decision.
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
- decide whether/when to merge and deploy `feature/run-ux-03-product-experience`
  (Run UX-03 + Run UX-03-QA1 + Run UX-03-QA2, COMPLETE locally at `1c4ae33`,
  not pushed) — a human decision, not attempted by any of the three Runs. A
  fresh hosted Preview QA pass against this branch (see
  `docs/RUNS/2026-09-28-UX-03-QA2.md` §"Morning Human Review") is the
  recommended next step before that decision;
- decide the product/schema question blocking FUB-036 (Author-can-learn-
  their-own-Course): whether `course_memberships` should allow more than one
  role row per (user, Course) — needed before Run010/Run011 can implement
  this;
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

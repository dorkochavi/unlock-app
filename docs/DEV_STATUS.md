# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-21

## Repository

- Branch: `feature/project-foundation`
- Local HEAD: `0dd4c74` (Run 007 S6 close) — 8 commits ahead of
  `origin/feature/project-foundation` (`26678d8`): `db25076`, `bdaae1d`,
  `885df06`, `445a276`, `9109b12`, `413c4e4`, `0e91566`, `0dd4c74`.
- Working tree clean. Not pushed — remote push remains a manual/human action.
- Run 007 (Structured Import V1) added product code (`src/domain/import/**`,
  `src/application/import/**`, two new API routes, one new instructor page)
  and one new dependency (`papaparse`, S1). No schema/migration change.
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
- authentication and authenticated API boundaries;
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
- Structured Import V1 (JSON/CSV) — preview/confirm into DRAFT_ONLY Questions;
- Playwright E2E harness.

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
- only active LEARNER memberships auto-participate.

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
  authenticated, Course-scoped, DTO-mapped, with an HTTP-boundary source-size
  limit (`MAX_IMPORT_SOURCE_LENGTH`, resolving FUB-005);
- a minimal instructor UI (`/instructor/courses/:courseId/import`): format
  choice, paste/upload, Preview action with a valid/invalid row table, and a
  Confirm action (disabled while any row is invalid) that links back into
  the existing, unmodified Course Question list/editor/publish flow.

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

## Database / Supabase

Supabase project:
- name: UNLOCK
- ref: `luinowttujolknxsduug`
- region: Central EU / Frankfurt

Hosted migrations are confirmed through:
- `20260925000000_daily_plan_new_material_v1`

Committed/local-PGlite verified but not confirmed hosted at the last durable product baseline:
- `20260926000000_course_lifecycle_v1.sql`
- `20260927000000_topics_v1.sql`
- `20260928000000_question_authoring_v1.sql`

Do not infer hosted application from local migration existence.
Claude must not run `supabase link` or `supabase db push`.

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
re-run was performed at Run close (`.claude/rules/testing.md` §11: reuse
fresh Slice evidence rather than automatically replaying broad suites when
it already proves the required behavior):
- typecheck: clean (full repo, re-verified after every Slice);
- lint: clean (every changed file, every Slice);
- unit (targeted, cumulative across S3-S5's final runs): 291 passed across
  `src/app/api/courses`, `src/application/import`, `src/infrastructure/postgres`;
- schema/PGlite (S6, real Postgres via `npm run test:schema`): 10/10 passed
  across the new integrated walkthrough (8 scenarios) and the dedicated
  `PostgresImportUnitOfWork` commit/rollback proof (2 scenarios);
- reviewers: DB, security, and general reviewers each returned
  NO BLOCKING FINDINGS across S3-S6 after fixing every CORRECTIONS-REQUIRED
  finding raised along the way (see `docs/RUNS/2026-09-21-007.md` for detail);
- browser/E2E: not performed this Run (no running dev/auth/DB environment
  available in-session) — stated honestly, not claimed.

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

Rolling state only — not a diary. An item leaves this list the moment it resolves (`DROP`/`ABSORB`/`REVERT`); see `docs/DEVOS_OBSERVABILITY.md` §8 for the promotion lifecycle. Evidence lives in `docs/RUNS/2026-09-21-007.md` and its own follow-up audits, not copied here.

Currently active `WATCH` items (none has cleared the cross-Run bar in `docs/DEVOS_OBSERVABILITY.md` §6 required before becoming a `CHANGE`):

- **Adversarial acceptance criteria proven only at review, not before it.** Run 007 S4 (concurrent-membership-revocation re-check) and S6 (genuine mid-transaction rollback) each reached review with the correct behavior implemented but no test yet proving the specific named negative scenario the Plan called out. Re-check after Run 008 before considering any workflow change.
- **`src/domain/import/types.ts` bundles three concerns** (canonical row shape, row-content validation, Topic-name resolution) in one file. Not costly today — reconsider only if a fourth concern or new external fan-out appears.
- **`src/domain/learning/answer.ts`**: Run 007 needed a full read of this dense, multi-function file to extract confidence about one reused function's contract. Reconsider only if this narrow-extraction-from-a-dense-file pattern recurs in a later Run.
- **Test-fakes-as-template reads** (`in-memory-fakes.ts` style files read in full purely to copy an established fake-construction convention). Only becomes an action item if a third feature again requires a full read of an older fakes module for this reason.
- **Telemetry has no native per-Slice attribution** — a per-Slice breakdown currently requires manual reconstruction from commit timestamps. Remains `WATCH` unless it materially limits a future analysis.
- **Main-session `Edit`/`Write` tool-result echoes measured larger than file-read cost this Run** (Run 007's context-cost audit: ~147k vs. ~93k main-context tokens), concentrated on files receiving several sequential edits in one session. Genuinely new this Run — watch for recurrence in Run 008 before considering any edit-batching guidance; no change proposed yet.

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
- Run 007 — Structured Import (COMPLETE, local-only — see below)
- Run 008 — Authoring Integration + Pilot Readiness
- Run 009 — Learner Progress + Instructor Insights
- Run 010 — Learning Intelligence
- Run 011 — PDF/AI
- Run 012 — Production / Scale

Run 007 — Structured Import V1 is complete per `docs/CHATGPT_PLAN.md`
(6 Slices, S1-S6, all committed locally). No hosted/browser interactive
verification of the new import UI has been performed. Run 008 requires a
new Plan before starting.

Known deferred maintainability work lives in `docs/FOLLOW_UP_BACKLOG.md`.

## Current Manual Actions

For Run 007:
- push local HEAD (`0dd4c74`, 8 commits ahead of origin) to
  `origin/feature/project-foundation` when ready;
- manually exercise the instructor Preview/Confirm import journey against a
  real hosted/browser session when a real instructor account is available
  (no browser-level verification was performed this Run);
- decide, at some future point, whether the accepted V1 scope boundaries
  (no Topic auto-creation, no re-import merge, no bulk publish) still hold
  once real instructor usage patterns are observed.

For hosted Supabase:
- no new migration was introduced this Run — the existing pending
  migration-application action from prior Runs remains unchanged and
  separate from Run 007's own scope.

For Run 008:
- requires a new Plan; do not begin without one.

## Blockers

No known product blocker is introduced by the Development OS compression work.

Current execution source:
- `docs/CHATGPT_PLAN.md`

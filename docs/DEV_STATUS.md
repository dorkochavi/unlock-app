# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-10-10 (Run 2026-10-10-DEVOS-V1-3-ALIGNMENT-001: DevOS docs + telemetry tooling only; START_HEAD `1da8b51`; no product source, schema, dependency, API, UI, hosted or Pilot-content change; DEV_STATUS compressed to current truth; Pilot/Assessment Engine state unchanged.)

This file holds CURRENT state only. History lives in `docs/RUNS/**`; current execution in `docs/CHATGPT_PLAN.md`;
deferred work in `docs/FOLLOW_UP_BACKLOG.md`; unresolved decisions in `docs/OPEN_QUESTIONS.md`; navigation in
`docs/CONTEXT_MAP.md`.

## Pilot Focus (2026-10-10)

Clean Slate reset (Run 2026-10-10-PILOT-CLEAN-SLATE-RESET-001): audit + read-only inventory (`scripts/pilot-clean-slate-inventory.sql`) + proposed reset in `docs/PILOT_CLEAN_SLATE_RESET_RUNBOOK.md`; NOT executed, BLOCKED_PENDING_BACKUP (no `pre-destructive` backup; last Production backup 2026-10-04), hosted inventory counts not yet taken (human-run). Evidence: PGlite only.

Execution is governed by `docs/MASTER_PILOT_COUNTDOWN.md`; Ruppin content path: `docs/RUPPIN_PILOT_CONTENT_INTAKE.md` (OQ-024 resolved). Assessment Engine frozen for Pilot (FUB-076 DESIGNED_PRE_REGISTERED, not implemented). FUB-068 Option B implemented (unit evidence only; no browser run). Content gate: WAITING_FOR_RUPPIN.

## Repository / Release State

- Git (`git log` / `git status`) is authoritative for current HEAD, branch and ahead/behind; they are deliberately NOT hard-coded here (this file is committed and would go stale against its own claim).
- `main` is Production truth (Vercel Production Branch = `main`, ADR-019). Pushing, merging, promotion, tags, hosted migrations and Vercel/GitHub settings are human actions (`CLAUDE.md` §6). Being on `origin/main` is not deployment evidence.
- PRODUCTION_HEAD: last human-reported deployed commit `70b2282` (Vercel Production Ready, [HUMAN_REPORTED 2026-10-07], FUB-044). Nothing newer is asserted deployed.
- Release tags: `v0.3.0` -> `5e95240` (2026-10-06); `v0.2.0` -> `fff8c40`; `v0.1.0` -> `8e137e6`; `unlock-post-run010-governance-2026-10-02`. The `9fcafd2` release sync point (2026-10-07, [HUMAN_REPORTED]; Production smoke PASS; no migration) carries no tag.
- Released product baseline (through `70b2282`): Run 010 Learning Intelligence; Post-Run010 fix and PREVIEW-QA-FIX-001; PILOT-FRICTION-PERF (instructor course-page links; Topic create/rename rejects normalized-duplicate active names: 409 `TOPIC_NAME_DUPLICATE`, app-level only, race WATCH FUB-053); PERFORMANCE-RUN-001 (`Server-Timing` on 8 routes, Today repeat open 3 plain reads, Vercel Functions `fra1`; budgets unapproved, FUB-026; speed is a core product principle); VISUAL-SYSTEM / DESIGN-REFRESH / VISUAL-POLISH (token-based visual system, UX_SPEC §6; dark-mode toggle undecided, FUB-052); TODAY-LEARNING-RECAP-004 (deterministic evidence-only recap on Today Complete); FUB-044 learner/instructor 401 handling. Per-Run detail, evidence and reviewers: `docs/RUNS/**`.
- Product-code changes after `70b2282` with NO deploy evidence and no rendered/device verification: Q3-A11Y-NIGHT-001 (`html { scroll-padding-bottom }` `87c8309`; distinct accessible names for question-editor option controls `08364ca`) and DESIGN-AUDIT-FOLLOWUP-001 (aria-labels on the two Topic inputs; 7 instructor messages via `Notice`; `setsPadding` regex fix, which changed Courses list row padding p-5 -> p-4: source-reasoned, NOT visually verified). Other post-`70b2282` work is docs, DevOS tooling or unwired prototypes; verify with git. Human authenticated-browser/RTL accessibility check is outstanding (FUB-044 / Q3).
- Assessment Engine (owner `docs/ASSESSMENT_ENGINE.md`; evidence `docs/ASSESSMENT_CALIBRATION_V0_1.md`, `docs/ASSESSMENT_HELDOUT_V0_2.md` / `_V0_3.md` / `_V0_4.md`, design `docs/ASSESSMENT_STEM_NEGATION_DESIGN_V0_1.md`, `docs/ASSESSMENT_BLUEPRINT_V0_1.md`): pure deterministic question-linter PROTOTYPE (`src/domain/assessment/`), Golden/held-out harnesses, plain-text ingestion prototype (`src/domain/ingestion/`) and blueprint validation prototype. All are UNWIRED to any import/publish/API/UI flow; nothing is VERIFIED; integration verdict NOT_READY; DOCX/PDF/Google/AI not implemented. Corpora are model-authored and model-labeled unless marked HUMAN_ADJUDICATED (single reviewer, post-evaluation, synthetic data); this is not psychometric or real-course validation. FROZEN for Pilot: FUB-076 is DESIGNED_PRE_REGISTERED and NOT implemented (human gates H1-H3 pending; any implementation needs a NEW fresh held-out v0.5); FUB-075 partially resolved; FUB-074 residual semantic/human judgement. Human Content QA is authoritative.
- Browser isolation: rendered audits remain BLOCKED (the existing Playwright harness is unsafe: ambient `.env.local`, reused dev server, public `GET /api/courses/:id` reaches the hosted DB); design only, `docs/BROWSER_ISOLATION_DESIGN.md` (FUB-070/071/072).
- This is NOT a pilot approval (`docs/PILOT_READINESS.md`).

## Product Direction

UNLOCK is a Hebrew-first, RTL-first, mobile-first adaptive learning application. Its differentiator is a
longitudinal learner model that determines the next best learning action. Pilot target: Ruppin Academic Center.

Learner navigation: Today, Progress, Courses. Instructor navigation: Courses, Students, Insights.

## Current Product Capabilities

Current capabilities in Production (v0.2.0; Run 010 items marked):
- Authentication; all authenticated JSON routes authenticate before parsing the request body.
- Course management capability lives in `course_authors` (OWNER / INSTRUCTOR management capability, additive table
  from Run 010 H.1). `course_memberships` is LEARNER-only after Run 010 H.3 (applied hosted 2026-10-03). An active
  Course Author may self-enroll in their own Course as an ordinary LEARNER (see finding C below). Authorization call
  sites use "active Course Author", not the legacy membership roles (ADR-015).
- OPEN / AUTHORIZED_ONLY join; Course lifecycle DRAFT / PUBLISHED / ARCHIVED; flat Course-scoped Topics.
- SINGLE_CHOICE / MULTIPLE_CHOICE Question authoring, draft save, explicit publish/re-publish, immutable
  QuestionVersions, immutable historical Attempts; bulk review/publish of Questions (UX-03-QA1).
- UserQuestionProgress / learner-state, FSRS-backed scheduling, mastery/evidence/misconception handling.
- Confidence capture (Run 010): Today and Practice send sure / not-sure mapped to `high` / `low`; `null` is left
  untouched. This wires the misconception `confidenceLevel === "high"` escalation gate. The broader confidence
  model (scale, evidence weight, scheduling impact) remains open: OQ-014.
- Persisted DailyPlan / DailyPlanItems; Today answer + Skip; New Material fallback V1 (ADR-016/017); Today Plan
  Budget policy (`computeTodayPlanBudget`) and an exam-urgency NBA tie-break amplifier (Run 010; see finding A);
  honest per-item selection reasons (OQ-018 partial) and a Topic-diversifying cold-start selection.
- Course Practice and Topic Practice (Run UX-02, ADR-020, LEARNING_ENGINE §39A): bounded batches, Practice Skip with
  no evidence, Today never mutated by Practice; Run 010 added a Tier 4 same-day reinforcement fallback.
- Learner shell / My Courses / Course View, Learn Mode (UX-01); token-based design system across learner and
  instructor surfaces (UX-03; `docs/UX_SPEC.md` §11-§12); Progress = Course-level evidence-only summary with Topic
  detail on the Course page (Run 009 + QA1); whole-card navigation (QA2).
- Structured Import V1 (JSON/CSV): preview/confirm into DRAFT_ONLY Questions, source-size and 2,000-row limits;
  no XLSX/PDF, no auto-publish, no auto-created Topics.
- Instructor workflow: Course -> Topics -> author/import Questions -> publish -> publish Course -> share join link.
- Instructor Item Analysis and Topic Insights: Course-scoped, aggregate-only, coarse descriptive bands or an
  explicit insufficient-data state; disclosure gated by `src/domain/insights/aggregate-disclosure.ts` (min 5).
- Learner Topic Progress (Run 009): qualitative states, PUBLISHED Courses only (temporary rule; F-04b open); ADR-018.
- Playwright E2E harness exists; the automated suite has not been run against a real environment.
- Tooling: `npm run bundle:review` builds a safe review bundle from `git ls-files` (`scripts/create-review-bundle.mjs`).

Per-Run detail (what each Run added, its evidence, its reviewers) is in the corresponding Run report, not here.

## DailyPlan / Today

Governed by ADR-016/017 (summary in `.claude/rules/learning-engine.md`): one persisted DailyPlan per learner-local
day; Global/Course Today are views over it; freeze after generation; no carry-over; Manual Practice does not resolve
items; Skip carries no evidence; New Material is fallback-only; only active LEARNER memberships auto-participate. A
Course whose own status is ARCHIVED is excluded from automatic DailyPlan eligibility (`filterToPublishedCourseIds`).
Legacy `TodaySession` is fully retired (ADR-011 SUPERSEDED; migration `20260929000000` applied hosted).

## Known Accepted V1 Limitations

- Concurrent publish of the same Question is not lock-serialized; `UNIQUE(question_id, version_number)` prevents
  corruption; one racing request may receive a generic INTERNAL_ERROR.
- `confirmImport` Phase 2 re-check is READ COMMITTED with no row locks; a concurrent revoke/archive committing
  between the re-check and commit can leave a few DRAFT_ONLY Questions in a newly archived Course/Topic (no leak, no
  corruption). Tracked: FUB-014.
- Topic Progress can keep counting an Attempt on an older QuestionVersion toward Question-level state after a new
  version becomes current (accepted; ADR-018).
- Hosted TLS via `DATABASE_SSL_CA` is unit-tested only, not separately proven against the deployed app.

## Database / Supabase

- Supabase project `UNLOCK`, ref `luinowttujolknxsduug`, Central EU / Frankfurt.
- Hosted migrations: all 15 applied (no pending, no remote-only), human-confirmed 2026-10-03. H.1
  (`20260929010000_course_authors_v1`, additive) was applied from an isolated workdir after a pre-H.1 backup and
  backfilled 9 OWNER rows. H.3 (`20260929020000_course_membership_learner_only_v1`) was applied after a fresh pre-H.3
  backup and dry-run: it deleted the 9 legacy OWNER `course_memberships` rows and narrowed the `role` CHECK to
  LEARNER-only.
- Post-H.3 state: `course_memberships` LEARNER 79, OWNER 0, INSTRUCTOR 0; `course_authors` OWNER 11 (11 active, 0 revoked);
  Courses now 11 (8 PUBLISHED, 1 DRAFT, 2 ARCHIVED; QA-CLEANUP-001). Drift check going forward uses the canonical model only: every Course has
  an active `course_authors` row (H.1 check D4 = 0); no legacy OWNER/INSTRUCTOR memberships remain. The old D3 check
  (`course_authors` without legacy membership) is no longer a valid gate.
- ROLLBACK CAVEAT: `d39c882` is NOT a safe app-only rollback after H.3 (old code reads OWNER memberships; every author
  would be locked out). Restoring the old app first requires reconstructing the legacy OWNER rows (the pre-H.3 backup
  holds them). Preferred recovery is fix-forward.
- Claude must not run `supabase link` or `supabase db push` (`.claude/rules/postgres.md`); re-check
  `npx supabase migration list` rather than inferring alignment.

## Environment / Deployment Truth

- One app; environments are Local, Vercel Preview, Production (no Staging); `main` -> Production (ADR-019).
  Environment/release model and pilot checklist: `docs/PILOT_READINESS.md`.
- Hosted Vercel configuration that must remain set:
  - `DATABASE_URL` targets the Supabase Transaction Pooler (port 6543).
  - `DATABASE_SSL_CA` = PEM contents of the Supabase root CA (public certificate); local-file `sslrootcert` is never
    read server-side when it is set; verification is never disabled (`src/infrastructure/postgres/pg-ssl-config.ts`).
    A local CA file is git-ignored (repo-root `/supabase-ca.crt`), never committed.
  - `DATABASE_POOL_MAX=5` (code default 1; valid 1..10). Hosted 30-learner burst: `max=1` Today p95 18.9 s / Answer
    p95 14.7 s; `max=5` Today p95 4.85 s / Answer p95 3.18 s; 30/30 succeeded both. Optional
    `DATABASE_POOL_LOG_STATS=true`. Evidence: `docs/RUNS/2026-09-23-PRE-PILOT.md`. Round-trip reduction
    deferred (FUB-026).
- Backup: manual hosted logical backups exist outside the repo (pre-H.1 and pre-H.3, 2026-10-03; earlier pre-pilot copy).
  Backup/DR V1 tooling DONE locally 2026-10-04 (`backup:create|validate|keygen|encrypt|decrypt|retention`, `restore:local`; policy `docs/BACKUP_DR_POLICY.md`; runbook `docs/RESTORE_RUNBOOK.md`). A real Production V1 backup exists (2026-10-04, human-executed): validated, encrypted, off-device encrypted copy held, and a disposable local restore drill returned FULL (DB+Auth+migrations); plaintext deleted. Not proven: hosted GoTrue-version equality, sign-in usability on restored Auth, PITR/Supabase plan backups, hosted restore/DR, 24/7 response (FUB-009 narrowed; key custody FUB-048).
- Minimal CI (`.github/workflows/ci.yml`: typecheck, lint, unit) is active; the `main` ruleset has no required
  status checks (ADR-019 §3). What Vercel does on a failed build is undetermined (Slice B report, Q5).
- Pre-Pilot Validation: Technical Go/No-Go PASS (2026-09-25); Content Go/No-Go WAITING FOR REAL PILOT MATERIAL (not
  executed, not PASS); real pilot NOT approved. Owner: `docs/PILOT_READINESS.md`. Offline content validator:
  `docs/PILOT_CONTENT_VALIDATOR.md`.
- `npm audit` was clean in Run 008 (529 dependencies); not re-run merely because time passed.

## Verification Baseline (release v0.3.0 at `5e95240`; previous v0.2.0 at `fff8c40`) and Known Exceptions

- v0.3.0 (2026-10-06): pre-release evidence on the release code — full unit 2004 passed / 4 skipped, schema suite 37 files / 345 tests, typecheck clean, lint 0 errors (1 pre-existing warning), production build OK; security + behavior review: no HIGH/MEDIUM. Production smoke [HUMAN_REPORTED 2026-10-06]: login, learner Today, answering, Skip, Practice, instructor course-management screen, no abnormal Runtime Logs noise, deployed SHA `5e95240`. Password recovery PRODUCTION_E2E_PROVEN: the first Production link fell back to the Site URL because the Production recovery redirect was not in the Supabase Redirect URLs; after the operator added exactly `https://unlock-app-pied.vercel.app/login?mode=recovery`, a NEW email's link returned to Production `/login?mode=recovery`, a new password was set and login with it succeeded. No code change was needed (hosted config only). Not proven: different-browser / in-app mail browser / hosted expired-link UX. Content gate still open; overall Pilot NOT YET APPROVED; FUB-051 (heatmaps) DEFERRED.

- Code/evidence-relevant head `fff8c40`: CI GREEN (human-confirmed, GitHub Actions); Preview QA PASS on a Vercel Preview of
  `fff8c40` against the shared hosted Supabase (browser flows HUMAN_REPORTED; DB checks read-only; Practice/Skip/Today
  invariants re-run as automated PGlite/unit tests, 4 files / 67 tests); Production smoke PASS after cutover and after H.3
  (human-confirmed). Provenance table: Run report "Release close" section.
- Earlier baselines: Run 010 at `b82d194` (full unit 1665, build clean); Post-Run010 Product Fix at `eeeaaa5` (full unit
  1677 / 162 files, typecheck clean, lint 0 errors + 1 pre-existing warning in `.claude/telemetry/statusline.mjs`).
- NOT proven: true multi-connection concurrency (PGlite is single-connection; FUB-042 item 7), hosted latency,
  Hosted TLS beyond unit tests. Page-level wiring of the create-another action has no automated test (node env); it is
  covered by the human Preview retest only.
- Later Docs-only/DevOS changes do not invalidate this baseline (`.claude/rules/testing.md` §2).

## Development OS State

- Kernel: `CLAUDE.md` (Operating Kernel V1.2), rules in `.claude/rules/`, skills in `.claude/skills/`
  (`implement-slice`, `review-commit`, `checkpoint`, `autonomous-run`). V1.3 consolidation Run COMPLETE
  (`docs/RUNS/2026-09-29-DEVOS-V1.3-CONSOLIDATION.md`).
- Run identity model: START_HEAD / LAST_VERIFIED_HEAD / RUN_STATUS, checked by the deterministic zero-AI verifier
  `.claude/telemetry/verify-run-close.mjs`. Hooks attribute telemetry to whatever `RUN_ID:` `docs/CHATGPT_PLAN.md`
  declares (hooks re-read the Plan; the `UNLOCK_RUN_ID` environment variable is not what they use).
- Operational Discovery Index: `docs/CLAUDE_CODE_OPERATING_GUIDE.md` §0 (CLAUDE.md §1 pointer): consult it before searching for any DevOS command, verifier, telemetry utility or checkpoint path.
- Telemetry semantics (V1.3 alignment): `repository_access` reports native reads/searches and shell navigation (`nav:*`, lower bound, not file reads) separately; `response_sizes` gives response characters by tool / first command class / max / top-5 metadata. `CURRENT_SLICE` is honored only when the checkpoint's `RUN_ID:` matches the Plan; the verifier WARNs (never FAILs) on telemetry slice_ids the Plan's slice table does not declare. Owners: `docs/RUN_TELEMETRY.md`, `docs/DEVOS_OBSERVABILITY.md` §11.
- Telemetry interpretation: figures are runtime session/context measurements, NOT billed tokens or cost.
- Active observations (rolling; an item leaves when resolved; lifecycle: `docs/DEVOS_OBSERVABILITY.md` §8):
  - Edit/Write tool-result echoes dominated response characters in two recent Runs (Edit 569,632 of 801,714 and 388,346 of 448,823 chars), not Bash navigation; never caused a compaction. WATCH (two Runs of different scope; not a policy or budget).
  - Shell-navigation visibility starts with Runs collected after the V1.3 alignment; older Runs read 0 (not recorded). WATCH whether the lower-bound count is useful.
  - Context-shape practice (declare expected owners/broad reads/subagents/high-output ops; >300-line files default to targeted reads): guidance in `implement-slice` §3, not a numeric budget. WATCH over further Runs, paired with quality evidence.
  - Tailwind class-conflict pattern (no `cn()` / `tailwind-merge`); convention in `docs/UX_SPEC.md` §12 item 56.
    Cross-Run recurrence would justify a lint rule or helper. WATCH.
  - Long Autonomous Run architecture (thin parent + fresh scoped workers): positive data points (UX-03-QA2,
    DevOS Micro-Opt, Run 010); not promoted into canonical policy beyond the `autonomous-run` skill.
  - `src/domain/import/types.ts` bundles three concerns; reconsider only if a fourth appears.
- Hosted drift checks use the post-H.3 canonical model only (every Course has an active `course_authors` row; no legacy
  OWNER/INSTRUCTOR memberships). Tests of API mappings must use the real wire value (PREVIEW-QA-FIX-001 lesson).
- Hard Claude denies (`.claude/settings.json`): `git push*`, destructive Git reset/clean/restore, destructive
  filesystem deletion, `supabase link*`, `supabase db push*`.

## Current Limitations / Blockers

- Pilot items 13(a)/13(b) (2026-10-04, `2026-10-04-PILOT-MINIMUM-EVIDENCE-PREP-001`, local commits only): API unexpected-fault logging goes through `src/lib/ops-log.ts` (allow-listed, bounded; no answers, ids of learners, DB row detail); evidence SQL `scripts/pilot-evidence-aggregates.sql`. Not READY; human packet in `docs/PILOT_EVIDENCE_OPERATIONS.md`.

- No Run 008 blocker and no technical Pre-Pilot blocker remain. Open before a REAL pilot: `docs/PILOT_READINESS.md`
  (content gate, SMTP / Auth email capacity, earlier QA/test-data cleanup item 12, privacy notice delivery per ADR-021; OQ-039 decided).
- Finding status (details in Run reports):
  - F-01 (empty DailyPlan frozen for the local day): MITIGATED, design issue deferred; learners must join before Today.
  - F-04b (Course PUBLISHED -> ARCHIVED after the plan exists): DECISION PENDING; Progress is PUBLISHED-only as a
    conservative temporary rule.
  - F-02 (Item Analysis small-n differencing): IMPLEMENTED and Production-verified; residual: at n=5 one answer can
    flip a band between manual refreshes.
  - F-14: original initial-load failure resolved locally by automated tests only; initial-load MANUAL verification
    NOT executed.
  - F-12, F-13, F-04a, FUB-027, FUB-028: resolved.
- Auth email / SMTP capacity: CLOSED on [HUMAN_REPORTED] 2026-10-05 evidence (custom SMTP via Resend, verified `auth.kishurim.co`, real recovery email delivered, email limit 60/hour). WATCH: per-IP 30 requests / 5 min on a shared classroom IP.
- Pilot 13(a): SATISFIED by derivation (`docs/PILOT_EVIDENCE_OPERATIONS.md` §3.1); "Today opened with no persisted action" is not observable and not required. 13(b): READY / SATISFIED [HUMAN_REPORTED 2026-10-05] — watcher Dor, cadence start/middle/end of class + on issue, Vercel Runtime Logs "Last day" window observed (Hobby; longer windows not claimed). OQ-039 (13d) and the Content gate: unchanged, open.
- Password recovery: **PRODUCTION_E2E_PROVEN [HUMAN_REPORTED 2026-10-06]** (v0.3.0; see Verification Baseline); earlier HOSTED_PREVIEW_E2E_PROVEN 2026-10-05. Flow: `/login` forgot-password (`src/lib/password-recovery.ts`, `src/app/login/page.tsx`), PKCE, fixed same-origin `redirectTo=<origin>/login?mode=recovery`, neutral enumeration-safe UX, other sessions revoked after change; the PKCE link must be opened in the same browser that requested it. Hosted config required: Supabase Redirect URLs include the `/login**` wildcard (the Production recovery URL was added by the operator). NOT proven: different-browser, in-app mail browser, hosted expired-link UX, hostile/replay cases beyond local automated coverage. Security LOW: recovery UI is shown for any existing session (FUB-049); request-timing difference between existing/unknown accounts is an ACCEPTED RESIDUAL.
- Pilot status 2026-10-05: BLOCKER remaining: Content gate (waiting for real Ruppin material / sign-off). WATCH: shared-IP signup burst. 13(a), 13(b), 13(c) satisfied; 13(d) SATISFIED FOR PILOT via OQ-039 Option C (ADR-021; notice UI not implemented, long-term governance deferred to FUB-050); SMTP capacity closed. Overall Pilot: NOT YET APPROVED.
- Supabase Free plan: no managed scheduled backups, no PITR (HUMAN_REPORTED); FUB-009 narrowed; does not invalidate the satisfied Pilot DR gate.
- Product roadmap remaining: Run 011 (PDF/AI; also Question Management Workspace FUB-037, content-quality FUB-035),
  Run 012 (Production / Scale; privacy/legal pages, rate limiting). Deferred work: `docs/FOLLOW_UP_BACKLOG.md`.
- Open calibration/decisions live in `docs/OPEN_QUESTIONS.md` (e.g. OQ-002, OQ-014, OQ-016, OQ-018, OQ-044).

## Release State / Open Items (Run 010 + Post-Run010)

The Run 010 pre-push gates are resolved and the release shipped (above). Resolved items live in code, tests and the Run
reports; only still-open pointers remain:

- Resolved: exam_date = learner-local calendar date (OQ-046 Option A, `c8f3dc6`); `EXAM_URGENCY_DECAY_DAYS` rename
  (FUB-043); ARCHIVED hard-stops new author self-enrollment (OQ-045 Option B, `9a19b05`; residual asymmetry FUB-045);
  `revokeCourseAuthor` row locks (FUB-042 item 1, `eeeaaa5`; still unwired); rollout H.1 -> cutover -> H.3 done.
- `revokeCourseAuthor` real-PostgreSQL two-connection proof DONE 2026-10-04 (opt-in `npm run test:real-pg`, localhost only; last-author invariant proven; FUB-042 7(c) closed). Still open: 7(b) HUMAN DECISION (may a mid-flight-revoked author complete a revoke?) before the use case is wired to a route; 7(a) cosmetic (FUB-042).
- Backup/DR V1 Run DONE 2026-10-04, result PARTIAL (`docs/RUNS/2026-10-04-BACKUP-DR-V1-IMPLEMENTATION-001.md`): tooling (UBKENC01 AES-256-GCM encryption, package create/validate, `restore:local` package layout) security+DB reviewed twice, no blocking findings after fixes; disposable drill FULL on SYNTHETIC_LOCAL (GoTrue-replay) source. Post-close addendum (same day, human-executed): Slice E done: real Production V1 backup + encrypted/decrypted local restore drill FULL; Pilot DR gate SATISFIED. FUB-009 narrowed (open: Supabase plan/PITR check, cadence approval, hosted DR); FUB-047 non-blocking residuals; FUB-048 offline key custody (key copy currently in OneDrive, not with the backup). Unproven: hosted GoTrue-version equality, sign-in usability on restored Auth, hosted restore, concurrency.
- Author re-grant after revoke (`ON CONFLICT DO NOTHING` may silently no-op); decision owned by OQ-047 (distinct from learner OQ-043);
  FUB-042 item 4 is a pointer; must be resolved before any co-author-management UI.
- Unseen-question / Topic-diversifying cold-start SQL — AUDITED 2026-10-03 (read-only post-Run010 audit, verdict KEEP, no
  code change): per-Course selection conforms to ADR-017 (unseen = no real Attempt; fallback-only; cap 3; no per-Course
  quota; deterministic Topic round-robin; NULL-topic bucket last); cross-Course merge re-sorts by (createdAt, questionId)
  before top-3, consistent with ADR-017 §4. Real-Postgres behavior is still not proven (PGlite limits). Open policy items
  stay in OQ-017 (cross-Course Topic balance; archived-Topic eligibility; NULL-topic ordering; ADR-017 §4 not amended).
- QA-PREVIEW-A and QA-PREVIEW-B are ARCHIVED (non-joinable; A archived by the human QA author via the product UI,
  2026-10-03, QA-CLEANUP-001; terminal in V1, no un-archive path). QA data is RETAINED as evidence: 1 inert QA learner
  membership (OQ-043 untouched), 7 Attempts, 6 progress rows. No hard delete done or planned (separate human decision).
- Auth redirect audit (2026-10-04): no app-side open-redirect gap (allowlist-only `next`, fixed-shape `emailRedirectTo`, no server callback/Host use; tests added). Remaining human check: Supabase dashboard URL Configuration (Site URL; Redirect URLs accept `/login?next=...`; no broad wildcards); fails safe, non-blocking. UX note (non-security): `/instructor/courses/new` is not allowlisted for `next` and falls back to `/today`.
- Pilot-readiness matrix (45 rows: 7 PROVEN_READY, 14 HUMAN_CHECK, 5 EXTERNAL/HOSTED_CHECK, 8 OPEN_DECISION, 1 ENGINEERING_GAP, 10 DEFERRED_NON_BLOCKER): `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-E-pilot-readiness-matrix.md`. The matrix is a frozen historical snapshot (counts as of that Run); later evidence supersedes rows 5 (Auth restore gap: closed), 6 (owner/frequency/RPO/RTO: decided) and 32 (13c: Pilot DR gate SATISFIED) — see Backup/DR V1 above; row 7 (Supabase plan/PITR) remains open. Real pilot NOT approved; Content gate unchanged.

## Current Human / Manual Actions

- Pushing, merging to `main`, promoting to Production, tags, hosted migrations, and Vercel/GitHub settings are human actions
  (ADR-019). Done 2026-10-03: QA-PREVIEW-A archive (human, product UI); push/merge/promotion to `fff8c40`, tag `v0.2.0`, H.1 and H.3 applied, Production smoke.
- Remaining: decide OQ-047 and FUB-042 7(b) before any co-author-management UI / wiring `revokeCourseAuthor`; Supabase dashboard Auth URL check; Supabase plan/PITR check + drill-cadence approval (FUB-009), offline key custody (FUB-048); other pilot gates (the DR gate is satisfied).
- Human decisions still open from the archived Pilot Readiness verification (`docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`): Q2-B (valid-refresh-token behavior after natural session expiry unproven), Q3 (authenticated accessibility/RTL verification of login/join/Progress/instructor flows outstanding), Q4 (no authenticated Today timings), Q5 (Vercel failed-build behavior unknown), Q6a (`/login` is frameable; framing protection is a human DECISION).
- FUB-044 (expired-session recovery; DEFERRED, not closed; owner `docs/FOLLOW_UP_BACKLOG.md`): learner and instructor 401 handling IMPLEMENTED + TESTED + Production happy-path smoke [HUMAN_REPORTED 2026-10-07] (`59f718f`, `70b2282`). Accepted V1 semantics: a 401 during learner Answer means the answer was not accepted and no Attempt exists; it is never auto-replayed and the learner answers again after re-authentication (Practice returns to the same Course/Topic scope; exact question not guaranteed). An Instructor mutation 401 shows an inline notice, keeps the page and unsaved draft mounted, opens sign-in in a new tab, no auto-replay or draft persistence; cross-tab draft preservation HUMAN VERIFIED on Production. NOT verified: a real expired-session 401 was never induced in Production, so the live notice transition is covered by unit tests/review only (node-only test env, no DOM test).
- Isolated QA data (`QA-SliceB-*`) and other test data remain in the pre-pilot cleanup (`docs/PILOT_READINESS.md` item 12).
- FUB-068 Option B IMPLEMENTED (`c2fcb72`, 2026-10-10): Question Editor `beforeunload` while dirty; confirm on Back and Create Another when dirty; Publish blocked while dirty with a Hebrew save-first notice; no local persistence. Evidence: unit + source-wiring + reviewer only; NOT browser-tested. Not guarded: browser back/forward, other links/nav on the page, mobile browsers where `beforeunload` is unreliable.
- Pre-pilot: content gate, SMTP / Auth email capacity, earlier test-data cleanup (item 12) — `docs/PILOT_READINESS.md` §3.

Current execution source: `docs/CHATGPT_PLAN.md`. Run history: `docs/RUNS/**`.

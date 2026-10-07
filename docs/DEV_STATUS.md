# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-10-07 (release truth sync: `main` == `origin/main` == `9fcafd2` is deployed to Production [HUMAN_REPORTED 2026-10-07] and includes TODAY-LEARNING-RECAP-004, VISUAL-POLISH-RUN-003, DESIGN-REFRESH-OVERNIGHT-002, VISUAL-SYSTEM-RUN-001 and post-v0.3.0 commits `1f534c7` Author self-enroll action, `21d1f8e` duplicate active Topic guard; latest release TAG remains `v0.3.0` -> `5e95240` (no newer tag created); perf audit + FUB-052/053 recorded; v0.3.0 in Production at `5e95240`, verified; password recovery PRODUCTION_E2E_PROVEN; Pilot closure: 13(a)-(d) satisfied, Content gate open, Pilot NOT approved; prior: v0.2.0 in Production; Backup/DR V1 operationally proven on real Production data: encrypted backup + local FULL restore drill, Pilot DR gate SATISFIED; offline key custody FUB-048; real pilot NOT approved)

This file holds CURRENT state only. History lives in `docs/RUNS/**`; current execution in `docs/CHATGPT_PLAN.md`;
deferred work in `docs/FOLLOW_UP_BACKLOG.md`; unresolved decisions in `docs/OPEN_QUESTIONS.md`; navigation in
`docs/CONTEXT_MAP.md`.

## Repository / Release State

- Git (`git log` / `git status`) is authoritative for the current local HEAD, branch, and ahead/behind. Those
  values are deliberately NOT hard-coded here (this file is committed and would go stale against its own claim).
- Current Production (2026-10-07, [HUMAN_REPORTED]): `main` == `origin/main` == `9fcafd2`, Vercel Production Ready, Production Today smoke PASS, Today Learning Recap manually verified with real data; no migration was part of this release; final pre-push audit (read-only, 2026-10-07) found no blockers. No release tag was created for it: the latest tag is `v0.3.0` (below). The Run entries below that say "local, unpushed" describe their state at Run close and are now released as part of `9fcafd2`.
- `main` is Production truth (Vercel Production Branch = `main`, ADR-019). At release close 2026-10-06 `main` == `origin/main` == `5e95240`
  (Production deployed SHA confirmed, [HUMAN_REPORTED 2026-10-06]); release tag: annotated `v0.3.0` -> `5e95240`; no migration action was needed. Previous baseline: `fff8c40`
  (fast-forwarded from `d39c882`, 31 commits, linear), Vercel Production Ready, Production smoke PASS (human-confirmed,
  2026-10-03), annotated `v0.2.0` -> `fff8c40`. Earlier tags: `v0.1.0` (`8e137e6`, previous Production
  baseline) and `unlock-post-run010-governance-2026-10-02`.
- Shipped: Run 010 (Learning Intelligence), Post-Run010 Product Fix, PREVIEW-QA-FIX-001 (question editor "create another
  question" action + Hebrew Topic-required publish error). Reports: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`,
  `docs/RUNS/2026-10-03-POST-RUN010-PRODUCT-FIX-001.md` (including its "Release close" section: Preview QA, cutover, H.1,
  H.3, rollback caveat). Run 011 not started.
- Hosted / remote mutation and pushes are human-controlled actions (`CLAUDE.md` §6).
- Post-release local work (Run 2026-10-06-PILOT-FRICTION-PERF-OVERNIGHT-001; was unpushed at Run close, now released in `9fcafd2` [HUMAN_REPORTED 2026-10-07]): instructor course page shows "ללמוד את הקורס"/"לניהול הקורס" (reuses the join route); create/rename Topic rejects normalized-duplicate active names (409 TOPIC_NAME_DUPLICATE; app-level only, archived-name reuse + unarchive-block decided, race WATCH: FUB-053). Speed is a core product principle; static perf audit and proposed (unapproved) budgets live in FUB-026; visual refresh is PRE-PILOT FUB-052.
- PERFORMANCE-RUN-001 (deployed to Production at `155dff7`, Vercel Functions `fra1` aligned with Supabase Frankfurt, human smoke PASS [HUMAN_REPORTED 2026-10-06]; single-user Server-Timing samples in the Run report addendum; budgets unapproved): `Server-Timing` instrumentation on 8 routes (`c247288`); Today repeat open 8 stmts -> 3 plain reads (`82a9069`); Practice next-batch background fetch after last answer accepted (`370d62b`). Answer-path/Progress/refresh audited, no change. Vercel Function Region change (human-reported, not deployed): post-region latency NOT measured. Details + proposed (unapproved) budgets: FUB-026.
- VISUAL-SYSTEM-RUN-001 (released in `9fcafd2`; was local at Run close; `8d57ea2` is the last code commit; report `docs/RUNS/2026-10-06-VISUAL-SYSTEM-RUN-001.md`): visual-system foundation exists (tokens in `src/app/globals.css`, owner `docs/UX_SPEC.md` §6; primitives Notice, Field, LinkRow, ProgressBar, LearnHeader, icons); learner Courses/Today/Practice/Progress/Login/Join/Author→Learn refreshed, presentational only (no dependency, no new client component). Unit/typecheck/lint/build green. Dor's human visual walkthrough completed before the push [HUMAN_REPORTED 2026-10-07]; font (Heebo kept), sign-out (anchored in the header) and instructor surfaces were later addressed; the dark-mode toggle stays an undecided product decision (FUB-052).
- DESIGN-REFRESH-OVERNIGHT-002 (released in `9fcafd2`; was local at Run close; last code commit `34c74f0`; report `docs/RUNS/2026-10-07-DESIGN-REFRESH-OVERNIGHT-002.md`): visible art-direction refresh on the VISUAL-SYSTEM foundation ("Soft Premium Canvas": tinted canvas, indigo hero surfaces, raised cards, Heebo via next/font, floating bottom nav, Today hero, tactile question options, Practice/Progress/Login/Join/Instructor-manage surfaces). Visual-only; 0 new dependencies; unit/typecheck/lint/build green; browser evidence is mocked-API screenshots only. Human walkthrough completed [HUMAN_REPORTED 2026-10-07]; decisions in the Run report were resolved by the polish Run (Heebo kept, queue prompts removed).
- VISUAL-POLISH-RUN-003 (released in `9fcafd2`; was local at Run close; last code commit `3b90107`; report `docs/RUNS/2026-10-07-VISUAL-POLISH-RUN-003.md`): human-reviewed polish of the accepted direction (Today sticky/feedback hierarchy, Today queue without prompts, simpler Progress, shorter Course hero, instructor desktop two-column, hero/indigo restraint via `surface-tint`). Visual-only, 0 dependencies. Unit/typecheck/lint/build green; browser evidence mocked-API screenshots only. Final human walkthrough completed before the push [HUMAN_REPORTED 2026-10-07] (FUB-052).
- TODAY-LEARNING-RECAP-004 (released in `9fcafd2`; was local at Run close; last code commit `259426b`; report `docs/RUNS/2026-10-07-TODAY-LEARNING-RECAP-004.md`): Today home no longer exposes its question queue; before/during Today shows orientation + "so far" line; Today Complete shows a deterministic, evidence-only recap (optional `learningRecap` on Today GET from one extra plain attempts read once >=1 item is answered: repeat-open statements 4 -> 5 only then; no migration/schema change). Unit/schema/typecheck/lint/build green; general+DB+security reviewed. Human check with real learning activity completed in Production [HUMAN_REPORTED 2026-10-07].
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
- Telemetry interpretation: figures are runtime session/context measurements, NOT billed tokens or cost.
- Active observations (rolling; an item leaves when resolved; lifecycle: `docs/DEVOS_OBSERVABILITY.md` §8):
  - RUN_ID attribution drift (WATCH -> CHANGE CANDIDATE): a Run's telemetry accumulates under whatever Plan
    `RUN_ID` is current. Run 010 tracked orchestration only in the scratch checkpoint and never set the Plan
    identity, so its events landed under the prior `2026-09-28-DEVOS-MICRO-OPT-001` folder. This is attribution
    drift, mostly recoverable: about 3125 Run 010 events were reconstructed by session/timestamp. Fix (applied this
    Run, Phase 0): set Plan `RUN_ID` / `START_HEAD` / `RUN_STATUS` before the first worker. Hardening delivered by the
    V1.3 Run (Slices D/E; report in docs/RUNS).
  - No native per-Slice telemetry attribution (manual reconstruction from commits/Run report). WATCH.
  - Edit/Write tool-result echoes are a large fraction of tool-response characters; never caused a compaction. WATCH.
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
- Password recovery: **PRODUCTION_E2E_PROVEN [HUMAN_REPORTED 2026-10-06]** (v0.3.0; see Verification Baseline). Earlier: HOSTED_PREVIEW_E2E_PROVEN [HUMAN_REPORTED 2026-10-05] on a Vercel Preview deployment: recovery requested, real email via Supabase Custom SMTP/Resend, Preview `/login**` added to Supabase Redirect URLs, new link opened in the same browser, stayed on the Preview domain, landed on `/login?mode=recovery`, new password set, login with it succeeded. NOT proven: Production, different-browser, in-app mail browser, hosted expired-link UX, hostile/replay cases beyond local automated coverage. Security LOW findings: (1) recovery UI is shown for any existing session, deferred as FUB-049; (2) `code` removal from the URL RESOLVED for the tested same-browser Preview flow [HUMAN_REPORTED] (final URL `/login?mode=recovery`, no `code=`; not generalized to other browsers, in-app mail browsers or replay); (3) request-timing difference between existing/unknown accounts is an ACCEPTED RESIDUAL (Supabase does real send work; visible response is neutral). Earlier note (2026-10-05, local commit `2d9d3bc`): `/login` has a forgot-password flow (`src/lib/password-recovery.ts`, `src/app/login/page.tsx`); PKCE; fixed same-origin `redirectTo=<origin>/login?mode=recovery`; neutral enumeration-safe UX; other sessions revoked after change. Unit-tested locally; hosted Preview proof above. Security reviewed: no HIGH; MEDIUM (429 enumeration) fixed. HUMAN_CONFIGURATION_REQUIRED only if the hosted Redirect URLs lack the `/login**` wildcard. Caveat: PKCE link must be opened in the same browser that requested it.
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
- Human decisions still open from the archived Pilot Readiness verification
  (`docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`): Q2-B (valid-refresh-token behavior after natural
  session expiry unproven), Q3 (accessibility of login/join/Progress/instructor flows unexercised), Q4 (no
  authenticated Today timings), Q5 (Vercel failed-build behavior unknown), Q6a (`/login` is frameable; framing
  protection is a human DECISION). Expired-session recovery UX (FUB-044, low severity, non-blocking): learner side RESOLVED/LOCKED —
  learner 401 sign-in links carry the allowlisted `next`, and a 401 during Answer shows "answer not saved" (commit
  `5b1046a`). Accepted V1 decision (401 during learner Answer): a 401 means the answer was not accepted and no Attempt
  is created; the selection is never preserved or auto-replayed; the learner explicitly answers again after
  re-authentication. Today: returns through the existing Today flow, the unresolved item stays pending. Practice:
  returns to the same Course/Topic scope; exact same-question restoration is NOT guaranteed in V1 (no `question=`
  redirect parameter, allowlist and Practice API unchanged) — deferred, not a Pilot blocker. STILL OPEN under FUB-044:
  instructor mutation 401 recovery / re-login UX (no 401 branch; instructor sign-in links are plain `/login`),
  instructor safe-`next` decision, Q3 authenticated browser accessibility/RTL verification, other deferred FUB-044 items.
  Isolated QA data (`QA-SliceB-*`) and other test data remain in the pre-pilot cleanup (`docs/PILOT_READINESS.md` item 12).
- Pre-pilot: content gate, SMTP / Auth email capacity, earlier test-data cleanup (item 12) — `docs/PILOT_READINESS.md` §3.

Current execution source: `docs/CHATGPT_PLAN.md`. Run history: `docs/RUNS/**`.

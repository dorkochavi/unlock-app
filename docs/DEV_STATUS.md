# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-29 (DevOS V1.3 consolidation Run in progress; Run 010 COMPLETE locally)

This file holds CURRENT state only. History lives in `docs/RUNS/**`; current execution in `docs/CHATGPT_PLAN.md`;
deferred work in `docs/FOLLOW_UP_BACKLOG.md`; unresolved decisions in `docs/OPEN_QUESTIONS.md`; navigation in
`docs/CONTEXT_MAP.md`.

## Repository / Release State

- Git (`git log` / `git status`) is authoritative for the current local HEAD, branch, and ahead/behind. Those
  values are deliberately NOT hard-coded here (this file is committed and would go stale against its own claim).
- `main` is Production truth (Vercel Production Branch = `main`, ADR-019). `main` == `origin/main` == `d39c882`,
  which already contains Run UX-03 + UX-03-QA1 + UX-03-QA2 + the DevOS Micro-Optimization Pass. Nothing there is
  unmerged. Only tag: `v0.1.0` (`8e137e6`), the last manually verified Production RUNTIME baseline; no newer tag
  exists. Actual Vercel deployment / Production verification of `d39c882` is NOT confirmed by any Claude session.
- Run 010 (Learning Intelligence, `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`) is COMPLETE locally on
  `feature/run-010-learning-intelligence` (branched from `d39c882`; it is `main` + Run 010 only). NOT pushed, NOT
  merged, NOT deployed, and NOT yet approved for push (see "Pre-push / Release Requirements"). Last verified
  implementation head: `b82d194` (code + verification). Run-close docs commit: `2e2634c` (documentation only).
- Hosted / remote mutation and pushes are human-controlled actions (`CLAUDE.md` §6).
- This is NOT a pilot approval (`docs/PILOT_READINESS.md`).

## Product Direction

UNLOCK is a Hebrew-first, RTL-first, mobile-first adaptive learning application. Its differentiator is a
longitudinal learner model that determines the next best learning action. Pilot target: Ruppin Academic Center.

Learner navigation: Today, Progress, Courses. Instructor navigation: Courses, Students, Insights.

## Current Product Capabilities

Current capabilities on the Run 010 branch (Run 010 items marked, all local-only until pushed/deployed):
- Authentication; all authenticated JSON routes authenticate before parsing the request body.
- Course management capability lives in `course_authors` (OWNER / INSTRUCTOR management capability, additive table
  from Run 010 H.1). `course_memberships` is LEARNER-only after Run 010 H.3 (migration hosted-unapplied). An active
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
- Hosted migrations confirmed aligned through `20260929000000_retire_today_session.sql` (13th; human-confirmed
  local = remote 2026-09-23).
- Two Run 010 migrations are committed but NOT applied hosted (verified locally with schema/PGlite only):
  - `20260929010000_course_authors_v1.sql` (H.1) — additive: creates `course_authors`, backfills OWNER/INSTRUCTOR
    `course_memberships` rows into it.
  - `20260929020000_course_membership_learner_only_v1.sql` (H.3) — destructive-but-redundant: deletes the superseded
    OWNER/INSTRUCTOR membership rows and narrows the `role` CHECK to LEARNER-only.
- Do not infer hosted application from local migration existence; re-check `npx supabase migration list` before
  assuming local = remote. Claude must not run `supabase link` or `supabase db push` (`.claude/rules/postgres.md`).
  Required rollout order: see "Pre-push / Release Requirements" D.

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
- Backup: one manual hosted logical backup exists outside the repo (second copy off-machine). No restore drill was
  performed; no RPO/RTO claimed (FUB-009).
- Minimal CI (`.github/workflows/ci.yml`: typecheck, lint, unit) is active; the `main` ruleset has no required
  status checks (ADR-019 §3). What Vercel does on a failed build is undetermined (Slice B report, Q5).
- Pre-Pilot Validation: Technical Go/No-Go PASS (2026-09-25); Content Go/No-Go WAITING FOR REAL PILOT MATERIAL (not
  executed, not PASS); real pilot NOT approved. Owner: `docs/PILOT_READINESS.md`. Offline content validator:
  `docs/PILOT_CONTENT_VALIDATOR.md`.
- `npm audit` was clean in Run 008 (529 dependencies); not re-run merely because time passed.

## Verification Baseline (latest, Run 010 at `b82d194`) and Known Exceptions

- typecheck clean; lint 0 errors + 1 pre-existing unrelated warning (`.claude/telemetry/statusline.mjs`).
- Full unit suite 1665/1665 (162 files). Production build clean (39 routes: 14 static, 25 dynamic).
- Schema/PGlite 331/332 at that point; the single exception was `practice-vertical.test.ts` (`topicId`), classified
  as genuinely pre-Run010 (FUB-041, open residual). A stale reinforcement-order test caused by Run 010 itself was
  fixed separately (RUNS Run 010 report; FUB-041).
- Reviewer coverage: risk-based per `/review-commit`; every dispatched pass returned no blocking findings (Run 010
  report §7).
- NOT proven by any Run so far for this branch: hosted Preview/Supabase integration, hosted latency, true
  multi-connection concurrency, hosted application of the two new migrations, Vercel deployment of `d39c882`.
  PGlite does not prove real-Postgres concurrency (`.claude/rules/postgres.md`).
- Later Docs-only/DevOS changes do not invalidate this baseline (`.claude/rules/testing.md` §2).

## Development OS State

- Kernel: `CLAUDE.md` (Operating Kernel V1.2), rules in `.claude/rules/`, skills in `.claude/skills/`
  (`implement-slice`, `review-commit`, `checkpoint`, `autonomous-run`). V1.3 consolidation is IN PROGRESS
  (`docs/CHATGPT_PLAN.md`); nothing here is V1.3-final until that Run closes.
- Run identity model: START_HEAD / LAST_VERIFIED_HEAD / RUN_STATUS, checked by the deterministic zero-AI verifier
  `.claude/telemetry/verify-run-close.mjs`. Hooks attribute telemetry to whatever `RUN_ID:` `docs/CHATGPT_PLAN.md`
  declares (hooks re-read the Plan; the `UNLOCK_RUN_ID` environment variable is not what they use).
- Telemetry interpretation: figures are runtime session/context measurements, NOT billed tokens or cost.
- Active observations (rolling; an item leaves when resolved; lifecycle: `docs/DEVOS_OBSERVABILITY.md` §8):
  - RUN_ID attribution drift (WATCH -> CHANGE CANDIDATE): a Run's telemetry accumulates under whatever Plan
    `RUN_ID` is current. Run 010 tracked orchestration only in the scratch checkpoint and never set the Plan
    identity, so its events landed under the prior `2026-09-28-DEVOS-MICRO-OPT-001` folder. This is attribution
    drift, mostly recoverable: about 3125 Run 010 events were reconstructed by session/timestamp. Fix (applied this
    Run, Phase 0): set Plan `RUN_ID` / `START_HEAD` / `RUN_STATUS` before the first worker. Hardening tracked by the
    V1.3 Plan (Slices D/E).
  - No native per-Slice telemetry attribution (manual reconstruction from commits/Run report). WATCH.
  - Edit/Write tool-result echoes are a large fraction of tool-response characters; never caused a compaction. WATCH.
  - Tailwind class-conflict pattern (no `cn()` / `tailwind-merge`); convention in `docs/UX_SPEC.md` §12 item 56.
    Cross-Run recurrence would justify a lint rule or helper. WATCH.
  - Long Autonomous Run architecture (thin parent + fresh scoped workers): positive data points (UX-03-QA2,
    DevOS Micro-Opt, Run 010); not promoted into canonical policy beyond the `autonomous-run` skill.
  - `src/domain/import/types.ts` bundles three concerns; reconsider only if a fourth appears.
  - Telemetry-summary (`summarize.mjs`) generation must be run at Run close.
- Hard Claude denies (`.claude/settings.json`): `git push*`, destructive Git reset/clean/restore, destructive
  filesystem deletion, `supabase link*`, `supabase db push*`.

## Current Limitations / Blockers

- No Run 008 blocker and no technical Pre-Pilot blocker remain. Open before a REAL pilot: `docs/PILOT_READINESS.md`
  (content gate, SMTP / Auth email capacity, QA data cleanup, privacy/data ownership OQ-039).
- Finding status (details in Run reports):
  - F-01 (empty DailyPlan frozen for the local day): MITIGATED, design issue deferred; learners must join before Today.
  - F-04b (Course PUBLISHED -> ARCHIVED after the plan exists): DECISION PENDING; Progress is PUBLISHED-only as a
    conservative temporary rule.
  - F-02 (Item Analysis small-n differencing): IMPLEMENTED and Production-verified; residual: at n=5 one answer can
    flip a band between manual refreshes.
  - F-14: original initial-load failure resolved locally by automated tests only; initial-load MANUAL verification
    NOT executed.
  - F-12, F-13, F-04a, FUB-027, FUB-028: resolved.
- Operational: Supabase Auth email rate limiting / SMTP capacity for a class-sized cohort — decide before a real pilot.
- Product roadmap remaining: Run 011 (PDF/AI; also Question Management Workspace FUB-037, content-quality FUB-035),
  Run 012 (Production / Scale; privacy/legal pages, rate limiting). Deferred work: `docs/FOLLOW_UP_BACKLOG.md`.
- Open calibration/decisions live in `docs/OPEN_QUESTIONS.md` (e.g. OQ-002, OQ-014, OQ-016, OQ-018, OQ-044).

## Pre-push / Release Requirements (Run 010)

Pointers and one-liners only; nothing below is resolved by this file. These gate any push/merge/deploy of
`feature/run-010-learning-intelligence`, which is NOT yet approved for push.

- A. `exam_date` interpretation — FIX CANDIDATE BEFORE PUSH. It is parsed as a UTC-midnight instant, so exam-day
  urgency disappears; it should follow calendar-day / learner-day semantics. Product-interpretation sub-question of
  OQ-002 (never invent a date).
- B. HALF_LIFE naming (exam-urgency constants) — clarity issue, low severity; tracked in Backlog (FUB-043).
- C. Author self-enroll bypass, including for an ARCHIVED Course — human decision NOT yet made; fails closed until
  decided (`.claude/rules/auth.md`). Related: FUB-042, OQ-043 (revoke/rejoin).
- D. Migration rollout order (human actions, never before their prerequisite): apply H.1 (additive `course_authors`)
  -> deploy the app authorization cutover (reads `course_authors`) -> verify -> apply H.3 (destructive membership
  narrowing) -> verify. NEVER apply H.3 before the cutover is deployed. Re-check `npx supabase migration list` first.
- E. `revokeCourseAuthor` last-author race: must be hardened (SELECT ... FOR UPDATE) before ANY route wires it —
  FUB-042 item 1. Currently unwired.
- F. Author re-grant after revoke (`ON CONFLICT DO NOTHING` may silently no-op); tied to OQ-043 — tracked in Backlog (FUB-042 item 4)
  must be resolved before any co-author-management UI.
- G. Unseen-question repository / Topic-diversifying cold-start SQL (`unseen-question-repository.ts` round-robin) has
  NOT been human-reviewed — pre-push review item on real Postgres (PGlite limits apply). Related: FUB-040.
- Also before promotion: hosted Supabase Auth Redirect URL allow-list for `next=` values (open, non-blocking since
  UX-01/02/03).

## Current Human / Manual Actions

- Pushing, merging to `main`, promoting to Production, tags, and Vercel/GitHub settings are human actions (ADR-019).
- Decide whether/when to push, merge, and deploy `feature/run-010-learning-intelligence`, after the Pre-push /
  Release Requirements above. Applying the two Run 010 migrations hosted is a separate human action in the order in D.
- Confirm (human) whether `d39c882` was actually deployed to Production and verified there; this file does not know.
- Human decisions still open from the archived Pilot Readiness verification
  (`docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`): Q2-B (valid-refresh-token behavior after natural
  session expiry unproven), Q3 (accessibility of login/join/Progress/instructor flows unexercised), Q4 (no
  authenticated Today timings), Q5 (Vercel failed-build behavior unknown), Q6a (`/login` is frameable; framing
  protection is a human DECISION). Expired-session recovery UX gaps (401 links lack `next`; instructor mutations have
  no 401 branch; a 401 during Answer drops the selection silently) are confirmed, low severity, non-blocking.
  Isolated QA data (`QA-SliceB-*`) belongs in the pre-pilot cleanup (`docs/PILOT_READINESS.md` item 12).
- Pre-pilot: content gate, SMTP / Auth email capacity, QA data cleanup — `docs/PILOT_READINESS.md` §3.

Current execution source: `docs/CHATGPT_PLAN.md`. Run history: `docs/RUNS/**`.

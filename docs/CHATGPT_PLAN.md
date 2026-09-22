# UNLOCK — Current Execution Plan

PLAN_VERSION: RUN-008-AUTHORING-INTEGRATION-PILOT-READINESS
RUN_ID: 2026-09-22-008
BASE_HEAD: `d509987` (`feature/project-foundation`, matches `origin/feature/project-foundation` — Run 007's 8 commits were pushed after `docs/RUNS/2026-09-21-007.md` was written; repository reality overrides that report's "not pushed" note)
STATUS: IMPLEMENTATION COMPLETE — PILOT MANUAL GATE PENDING (see `docs/RUNS/2026-09-22-008.md` for the full Run Report; `docs/DEV_STATUS.md` for current pilot-readiness gates)

## 1. Goal

Make Course creation, Topic organization, manual Question authoring,
Structured Import, Question publishing, Course publishing, and learner
onboarding feel like one coherent instructor workflow, then prove as much
of the complete instructor-to-learner Ruppin pilot journey as can safely
be proven without hosted mutation or invented evidence, per
`docs/UNLOCK_ROADMAP.md` Run 008.

Roadmap exit condition (preserved, not weakened by environment limits):

> A non-developer can set up a real Course with usable published Questions
> through UNLOCK alone, and the instructor-to-learner loop from Runs
> 004-008 is demonstrably self-sufficient.

If final browser/hosted proof requires a human/manual gate, every
autonomous Slice completes first and the exact remaining gate is recorded
honestly (`IMPLEMENTATION COMPLETE — PILOT MANUAL GATE PENDING`) rather
than invented.

## 2. Scope

In scope:
1. small audit-derived hardening with a high value/cost ratio (S1);
2. coherent instructor workflow integration (S2-S3);
3. explicit learner-eligibility/draft-leakage invariant proof (S4);
4. integration-level authoring/import/publish proof (S5);
5. Ruppin pilot-readiness assessment + end-to-end acceptance where safely
   possible (S6);
6. durable Run close and telemetry analysis (S7).

Out of scope (belongs to Run 009+ or `docs/FOLLOW_UP_BACKLOG.md` unless
proven an actual Run 008 blocker): Run 009 learner progress/insights;
Run 010-012 work; CI/CD platform; broad observability/APM; backup
automation; broad rate limiting/CSP redesign; bulk import persistence
optimization; global Unit-of-Work/test-fakes abstractions; broad
source-comment cleanup; legacy TodaySession deletion; large-file
refactors by line count alone; AI/PDF ingestion; XLSX import;
import auto-publish; Topic auto-creation; re-import merge; bulk
publish-all; Learning Engine redesign; RLS introduction; hosted Supabase
mutation; Git push.

## 3. Fixed Product/Architecture Decisions

Kept fixed unless repository evidence during implementation materially
contradicts them — report `PLAN_CONFLICT` rather than improvise:

- Run 007's Structured Import contract (`docs/CHATGPT_PLAN.md` §3-4 as
  captured in `docs/RUNS/2026-09-21-007.md`) is not reopened or
  redesigned;
- import creates new Questions only; imports remain `DRAFT_ONLY`;
  publish/publish-Course remain the existing Run 006 paths, unmodified;
- draft-only content never becomes learner-eligible (the invariant S4
  proves, not redesigns);
- no RLS introduction; no hosted Supabase mutation; no Git push.

## 4. Security-Sensitive Autonomous Guardrail

S1.E (auth-before-body-parsing) and S4 (learner eligibility/draft
leakage) are trust-boundary-adjacent. For these two Slices only:

1. inspect relevant ADRs/rules/existing implementation/tests before
   changing behavior;
2. implement or verify already-accepted policy only — never invent new
   authorization/membership/publication/eligibility semantics;
3. if repository sources disagree or a new decision is required, raise
   `PLAN_CONFLICT` and stop that decision path;
4. security review is mandatory for any change touching authentication
   ordering, trusted identity, authorization, membership, learner
   eligibility, or draft/published exposure; DB review is additionally
   mandatory when persistence/transactional-eligibility/integrity
   behavior materially changes;
5. do not continue to a later Slice while a BLOCKER or unresolved
   CORRECTION remains in one of these two Slices.

## 5. Ownership Contract

Unchanged from Run 007's Plan (`AGENTS.md`/`CLAUDE.md`,
`.claude/rules/*`, `implement-slice`/`review-commit`/`checkpoint` own
their respective responsibilities; this Plan states only Run-specific
scope/acceptance, not command-level verification or reviewer selection).

## 6. Canonical Lifecycle

Slice: `INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX
MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT →
COMMIT`, then proceed to the next eligible Slice without stopping for
routine confirmation (green checkpoint, clean reviewer, or a completed
Slice are not stop conditions).

Run close: `INTEGRATION ACCEPTANCE (only for missing/unproven behavior)
→ DEV_STATUS → RUN REPORT → FINAL GIT STATE → STOP`.

Stop only for: true `PLAN_CONFLICT`; unsafe unexpected repository state;
an unresolved BLOCKER/CORRECTION in a security-sensitive Slice; a
required human/manual/hosted action blocking all further independent
work; or actual completion of all autonomous Run work.

## 7. S1 — Audit-Derived Hardening + Deferred Findings Capture

Goal: close proven, high-value issues before relying on these surfaces
for the pilot. Not a general refactor.

### S1.A — Safe Repository Review Bundle

`git ls-files` currently includes nothing sensitive (verified: no
`.env*` besides the tracked `.env.example`, no `supabase/.temp/**`,
`scratch/**`, `test-results/**`, or `*.tsbuildinfo` — all are
`.gitignore`d and were never committed). Deterministic direction: build
the review bundle from `git ls-files -z` (tracked, non-deleted paths)
rather than a recursive directory copy, plus an explicit unsafe-pattern
filter as a defense-in-depth safety net (warn + exclude, never silently
drop without reporting).

- `scripts/create-review-bundle.mjs` — pure `classifyPath`/`buildManifest`
  functions (exported, no side effects) + a `main()` that shells out to
  `git ls-files -z`, classifies each path, copies SAFE paths into
  `scratch/review-bundle/<timestamp>/` (already-gitignored, disposable
  output — consistent with `scratch/**` being local/generated), and
  writes a manifest (included count, excluded paths + reason, total
  bytes). Never prints file contents.
- `npm run bundle:review` → `node scripts/create-review-bundle.mjs`.
- Test: `src/tooling/__tests__/review-bundle.test.ts` imports the pure
  functions from the `.mjs` module directly (matches existing
  `vitest.config.mts` `include: ["src/**/*.test.ts"]` with no config
  change) and proves the unsafe-pattern classifier on `.env.local`,
  `supabase/.temp/x`, `scratch/telemetry/x`, `test-results/x`,
  `tsconfig.tsbuildinfo` (all UNSAFE) vs. `.env.example` and ordinary
  `src/**` paths (SAFE).

### S1.B — `.env.example`

Reconcile stale "not yet configured against any real project/database"
comments (verified present) against `docs/DEV_STATUS.md`'s real Supabase
project (`luinowttujolknxsduug`). Restructure into required
runtime / public browser-safe Supabase / server-only secret / optional
sections. No actual secret values; `.env.local` untouched/unread.

### S1.C — Real DATE Validation

Verified: `DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/` in both
`src/app/api/courses/handle-create-course.ts` and
`.../[courseId]/manage/handle-update-course-metadata.ts` accepts
shape-valid, calendar-impossible strings (`2026-99-99`), which then flow
unvalidated through `createCourse`/`updateCourseMetadata` straight into
a parameterized `exam_date` DATE column insert/update
(`src/infrastructure/postgres/course-repository.ts`) — an impossible
date becomes a raw Postgres error, not a clean `INVALID_REQUEST`. Add one
small shared date-only validator (parses calendar validity, not just
shape; stays a plain `YYYY-MM-DD` string end to end — never introduces
timestamp/timezone semantics) and use it at both route boundaries in
place of the regex-only check. Add focused tests for both boundaries
(impossible-but-shape-valid date rejected; valid date-only values
unaffected).

### S1.D — Structured Import Row-Count Limit

`MAX_IMPORT_SOURCE_LENGTH` (`src/app/api/courses/[courseId]/import/limits.ts`,
2,000,000 chars) already bounds payload size; no row-count bound exists,
so a small-but-wide payload (short rows, huge count) is unbounded. Add
`MAX_IMPORT_ROWS` at the same HTTP boundary (`limits.ts`), enforced in
`previewImport`/`confirmImport` (application layer, after parsing
produces `CanonicalQuestionRow[]`, per FUB-005's "enforce at the
boundary, not inside format-independent adapters" direction) rather than
inside the S1/S2 Run-007 adapters. Choose the limit from realistic
single-Course pilot question-bank size; document why in the constant's
doc comment. Update FUB-005 to `RESOLVED`, referencing this Slice.

### S1.E — Authentication Before Expensive Body Parsing

Verified: both `.../import/preview/route.ts` and `.../import/confirm/route.ts`
call `await request.json()` before `handlePreviewImport`/
`handleConfirmImport` runs `authenticate()` — the existing doc comments
correctly claim "auth before *database*" (lazy `getPool()`) but body
parsing itself is not auth-gated. `grep` across `src/app/api` found 10
routes calling `request.json()`; inspect each for the same shape before
deciding a single coherent fix, per the Security-Sensitive Autonomous
Guardrail (§4) — implement/verify already-accepted "auth before privilege"
policy (`.claude/rules/auth.md`), do not invent new route architecture.
Prefer moving `authenticate()` ahead of `request.json()` in the thin
route (not the testable `handle*` core, which already authenticates
first internally) where doing so is a coherent, mechanical, low-risk
reorder — not a rewrite. Be precise in doc comments about what is and
is not protected (this still does not add transport-level request-size
protection). Security review mandatory.

### S1.F — Structured Import Concurrency Note

Re-inspect `confirmImport`'s Phase-2 re-check
(`src/application/import/confirm-import.ts`) against real transaction
behavior. Document the accepted V1 concurrency limitation (or the
evidence that no gap exists) in `docs/DEV_STATUS.md`'s Structured Import
section — do not add pessimistic locking; do not overstate guarantees in
comments either direction.

### S1 Acceptance

- safe bundle mechanism excludes sensitive/local artifacts (proven by
  test, not just current tracked-file emptiness);
- `.env.example` reflects present architecture, no secrets;
- impossible date-only input rejected as input, not DB/internal failure,
  at both Course routes;
- Structured Import has source-size AND row-count protection;
- auth-ordering claims match implementation reality across the touched
  routes;
- concurrency guarantees described accurately in `DEV_STATUS.md`;
- mandatory security review completed for S1.E with no unresolved
  BLOCKER/CORRECTION;
- targeted verification green;
- FUB-005 resolved; new deferred findings (§8 below) captured.

Commit S1 separately from later Slices.

## 8. S1 Backlog Update

During S1, add concise `docs/FOLLOW_UP_BACKLOG.md` entries (next ID
`FUB-006` onward, one entry per topic, `DEFERRED`) for: source
context/comment debt audit; CI/CD release automation; runtime
observability/APM; backup/restore/DR; Postgres/Vercel connection
strategy; abuse/platform hardening (rate limiting, CSP, broader body
limits); legacy TodaySession retirement investigation; unwired
application code KEEP/CONNECT/REMOVE classification; structured import
bulk-persistence/concurrency optimization; UNLOCK starter-kit extraction;
future project inception template. Capture only — do not execute. Mark
FUB-005 `RESOLVED` (S1.D).

## 9. S2 — Instructor Workflow Reality Audit

Trace the actual current instructor journey (routes/pages/use
cases/tests, not docs alone): Course creation → configuration → Topics →
manual authoring OR Structured Import → draft validation/preview →
Question publish → Course publish → share/join → learner Course access →
learner Today eligibility. Identify missing links, dead ends, confusing
transitions, any point requiring developer/SQL knowledge, RTL/mobile
issues, authoring/import mismatches. Produce the smallest coherent
integration plan for S3. Commit only if S2 itself requires repository
changes; otherwise fold the gap map into S3's Slice description.

## 10. S3 — Coherent Instructor Authoring Workflow

Make the instructor workflow feel like one product using existing Run
005-007 capabilities (navigation/status/feedback integration, not new
architecture): obvious actions from Course view; clear draft/published
distinction for both Question and Course; visible Topic status; Import
hands off cleanly into the existing Question review/publish flow;
instructor can identify remaining unpublished Questions; publishing
Course does not imply Questions are published; share/join is
discoverable once ready; RTL/mobile/Hebrew-first correctness preserved;
no SQL/seed/developer intervention required. `PLAN_CONFLICT` rather than
invent if a gap requires a new product decision (e.g. bulk publish).

## 11. S4 — Learner Eligibility / Draft Leakage Invariant

Invariant-verification and regression-hardening, not a redesign. Prove:
draft/archived Course does not auto-participate in learner-facing
behavior; draft-only Question (`current_version_id == null`) is never
learner-eligible; publish/re-publish preserves immutable
QuestionVersion/Attempt history; imported `DRAFT_ONLY` Questions stay
invisible until explicitly published; Course publish never silently
publishes Questions. Minimum correct code change only if a real gap is
found. Explicit PGlite/Postgres integration/regression evidence for each
named negative case — do not rely on query-shape reasoning alone.
Security review mandatory; DB review mandatory if persistence/integrity
behavior changes. Do not continue past an unresolved BLOCKER/CORRECTION.

## 12. S5 — Integrated Instructor-to-Learner Authoring Proof

Integration-level proof of the full lifecycle through the real
application boundary: create Course → configure → active Topics →
manual Question → imported Question → both draft before publish →
publish Questions (Run 006 path) → publish Course → learner joins →
only intended published content is learner-eligible → draft/unpublished
content does not leak → historical versioning intact across re-publish.
Small number of focused integration scenarios over one unreadable
mega-test; value is cross-Run integration evidence.

## 13. S6 — Ruppin Pilot Readiness + End-to-End Acceptance

Pilot-readiness assessment, not a production-infrastructure Run. Verify
the full workflow is usable without SQL/developer intervention; attempt
the closest safe local/browser journey the environment supports, using
precise evidence labels (UNIT / APPLICATION INTEGRATION / PGLITE-POSTGRES
/ BROWSER LOCAL / HOSTED / MANUAL) — never overclaim one for another.
Classify each audit-identified infra concern (monitoring, backup/restore,
dependency audit, Postgres/Vercel connection, rate limiting/security
headers, hosted migration readiness) as `PILOT BLOCKER` /
`MANUAL PILOT GATE` / `POST-PILOT BACKLOG` — implement only a genuinely
proven pilot blocker. Attempt dependency/security audit; record
`NOT VERIFIED — network/tool unavailable` honestly if it cannot run. No
hosted migration application. Mark Run 008 `COMPLETE` only if the
Roadmap exit condition is genuinely supported by evidence; otherwise use
`IMPLEMENTATION COMPLETE — PILOT MANUAL GATE PENDING` with the exact
remaining gate recorded.

## 14. S7 — Run Close + Development OS Evaluation

`docs/DEV_STATUS.md` current-truth update; `docs/RUNS/2026-09-22-008.md`
Run Report (BASE_HEAD/END_HEAD, Slice commits, evidence, reviewer
findings, manual gates, telemetry summary vs. Run 007, Development OS
observations); Follow-Up Backlog dedup/update; final git state (no
push). Do not replay broad QA merely because the Run ends — reuse fresh
Slice evidence per `.claude/rules/testing.md` §11.

## 15. Stop Condition

Run 008 stops when S1-S6 are complete (or S6 honestly records a
remaining manual/hosted gate), S7's Run close is written, and no
unresolved BLOCKER/CORRECTION remains in any Slice.

Do not push.

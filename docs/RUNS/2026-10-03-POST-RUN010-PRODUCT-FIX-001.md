# UNLOCK — Run Report: 2026-10-03-POST-RUN010-PRODUCT-FIX-001

Run: `2026-10-03-POST-RUN010-PRODUCT-FIX-001`
Status: COMPLETE (local at Run close; later release actions: see section 11 "Release close")
Baseline (START_HEAD): `4f360a7`
Last verified code commit at local close: `eeeaaa5`; after release close: `fff8c40` (docs-close commits sit above; derive hashes from Git)
Branch: `feature/run-010-learning-intelligence`

## 1. Goal
Reconcile the known post-Run010 pre-push findings locally (exam-day urgency, ARCHIVED author join, Practice `topicId`
test, `revokeCourseAuthor` race, `HALF_LIFE` naming, cold-start SQL audit) while preserving all Run010 invariants. Not a
reopening of Run010; not Run 011.

## 2. Commits
| Commit | Result |
|---|---|
| `50ef846` | Run identity |
| `c8f3dc6` | Exam urgency on learner-local calendar days (OQ-046 Option A) + FUB-043 rename `EXAM_URGENCY_DECAY_HALF_LIFE_DAYS` -> `EXAM_URGENCY_DECAY_DAYS` |
| `a773f90` | FUB-041: stale Practice exact-key test fixed |
| `9a19b05` | OQ-045 Option B: ARCHIVED hard-stops new author self-enrollment |
| `eeeaaa5` | FUB-042 item 1: `revokeCourseAuthor` row locks inside `CourseUnitOfWork` |
| docs-close commit | Slice H documentation reconciliation; this report; Plan `RUN_STATUS: COMPLETE` |

## 3. Outcomes per finding
- **OQ-046 RESOLVED (human decision: Option A).** `exam_date` is the learner's local calendar date; `daysUntilExam` = whole
  local calendar days between `plannedForDate` and `exam_date`; exam day => 2.0 (max unchanged); passed => neutral. No schema
  change, no recalibration, no separate learning-day boundary. OQ-002 (exam-date SOURCE hierarchy) stays open.
- **FUB-043 CLOSED.** Naming/doc only (e-folding constant; true half-life about 4.85 days); behavior-neutral.
- **FUB-041 CLOSED.** Root cause was a stale exact-key test; `topicId` was added intentionally by UX-03-QA1 (`814eace`) for
  batch-completion topics-touched. The earlier Run 006 origin hypothesis was wrong. Test now asserts the exact keys including
  `topicId` plus values.
- **OQ-045 RESOLVED (human decision: Option B).** ARCHIVED is a lifecycle hard-stop for NEW learner enrollment including an
  active Course Author. An author with an existing ACTIVE LEARNER membership gets `ALREADY_MEMBER` (idempotent); a
  revoked/archived membership gets `NOT_AUTHORIZED` (OQ-043 untouched). DRAFT / AUTHORIZED_ONLY bypass unchanged. No new
  outcome code, no schema, Today/Practice eligibility unchanged. Residual asymmetry recorded as FUB-045.
- **FUB-042 item 1 CLOSED.** `revokeCourseAuthor` locks active `course_authors` rows `FOR UPDATE` (ordered by id), counts under
  the lock, then revokes; still unwired. Residuals recorded as FUB-042 item 7: (a) `revoke()` SQL lacks
  `and revoked_at is null` (unreachable today); (b) actor-authorization check precedes the lock (last-author invariant
  unaffected); (c) no two-connection real-PostgreSQL test.
- **Cold-start SQL audit (Slice G): KEEP, no code change.** Per-Course unseen selection conforms to ADR-017 (unseen = no real
  Attempt; fallback-only; cap 3; no per-Course quota; deterministic Topic round-robin; NULL-topic bucket last). The cross-Course
  merge re-sorts by (createdAt, questionId) before top-3, consistent with ADR-017 §4. Open policy items preserved in OQ-017
  (cross-Course Topic balance; archived-Topic questions eligible; NULL-topic ordering). ADR-017 not amended.
- **OQ-047 untouched** (still OPEN; grant path / `ON CONFLICT` unchanged).

## 4. Decisions by the human
OQ-046 Option A and OQ-045 Option B, each made at its Human Decision Gate (Slices B and E) in this Run, 2026-10-03. No other
product decision was made or inferred.

## 5. Verification
- Slice C: vitest `src/domain/learning` + `src/application/dailyPlan` 340 pass; tsc and eslint clean; general reviewer: no material findings.
- Slice D: practice-vertical PGlite pass; `src/application/practice` + API + page 55 pass; tsc clean; reviewer: none.
- Slice F: `src/application/course` 100 pass; `src/application` 438 pass; 6 PGlite files 31 pass including new
  `revoke-course-author.test.ts`; tsc and eslint clean; DB reviewer and security reviewer: no blocking findings.
- Slice G: read-only; 22/22 existing tests pass.
- Slice H: docs only (no `src/**`, tests, migrations, `.claude/**`).
- INTEGRATED (at `eeeaaa5`, before docs close): full unit `npm test` 162 files / 1677 tests pass; `npm run typecheck` clean; `npm run lint` 0 errors, 1 pre-existing warning in `.claude/telemetry/statusline.mjs` (untouched). Full schema/PGlite suite not replayed: DB-relevant evidence is the 6 Slice F PGlite files plus Slice D `practice-vertical` (fresh; no later SQL change). Build and browser E2E not run (no route composition/UI change).
- Limit: PGlite is single-connection. It proves the SQL, sequential last-author protection and rollback; true multi-connection
  serialization rests on PostgreSQL `FOR UPDATE` semantics and is NOT proven locally. No hosted behavior was exercised.

## 6. Residual items (all non-blocking, owned elsewhere)
FUB-042 item 7(a)-(c); FUB-045 (ARCHIVED author vs non-author active-membership asymmetry); OQ-017 sub-bullets (archived-Topic
eligibility, NULL-topic ordering, cross-Course Topic balance, ADR-017 §4 wording); OQ-002; OQ-047; OQ-043.

## 7. Invariants / exclusions
Run010 invariants untouched. No migrations, no hosted Supabase state, no push, no merge (as of local close; later release actions: section 11). Run 011 not started. Exclusions per
the Run prompt (refactors, UX polish, telemetry experiments) untouched. ADR files untouched.

## 8. Docs reconciliation
OQ-045 and OQ-046 removed from `docs/OPEN_QUESTIONS.md` (resolved questions are removed; the decisions live in code/tests and
`docs/DEV_STATUS.md` Pre-push A/C). FUB-041 and FUB-043 moved to `docs/archive/FOLLOW_UP_BACKLOG_CLOSED.md`; FUB-042 item 1
closed in place with residual item 7. `docs/DEV_STATUS.md` Pre-push A, B, C, E, G updated; items D and F unchanged.

## 9. DEVOS efficiency
TELEMETRY (one summary inspection): 1 session, 52m summed duration, highest context 16%, 0 compactions, cache hit 98%, est. cost $6.13 (runtime measurement, not billed tokens). Reads: 48 substantive, 26 unique, 22 re-reads (46%); 5 main-context vs 43 subagent reads; 1 historical Run file read. Reread signal: re-read rate is elevated and mostly subagent-side (workers re-reading files they edited/verified, and reviewers re-reading worker diffs; `docs/OPEN_QUESTIONS.md` 6x across Slice A/E/H workers). Worker dispatch packets were minimal; the signal does not show parent over-reading. Not enough evidence for a policy change; WATCH.

## 10. Open items handed on (not started)
Written at local close: Manual / Hosted QA; release planning (H.1 -> app cutover -> H.3); human push/merge decision; no push had been made then. These later happened; see section 11.

## 11. Release close (2026-10-03, later than sections 1-10)

Human-run release actions and post-close evidence; agents made no push or hosted mutation.

**PREVIEW-QA-FIX-001** (`8a8814f`, `fff8c40`): question editor "יצירת שאלה נוספת" action with a dirty guard (shown only after a
successful save/publish while the form is clean; not for ARCHIVED Courses; creates a new EMPTY Question in the same Course;
carries nothing forward) plus Hebrew mapping of the Topic-required publish error. Root cause of the second commit: the publish
API `reason` is the domain message prefixed "Question is not publish-ready: ", so the exact-match mapping missed; the prefix
is now stripped. Files: question editor `page.tsx`, `editor-logic.ts`, `create-another-action.tsx`,
`__tests__/create-another.test.tsx`, `src/messages/he.ts`. `assertQuestionPublishReady`/API/domain/schema unchanged. Topic
contract unchanged: draft Topic optional; published requires Topic; learner-visible = published only; `topicId: null` in
Practice is defensive support for legacy/seed published data (hosted Seed Course has 3), not new authoring behavior.
Page-level wiring has no automated test (node env); covered by the human Preview retest.

**Preview QA** (Vercel Preview of `fff8c40`, shared hosted Supabase, QA-PREVIEW-A / QA-PREVIEW-B data): overall PASS.

| Check | Provenance | Result |
|---|---|---|
| P1 login/hostname | HUMAN_REPORTED | PASS |
| P2 learner Today / Course Practice / Topic Practice | HUMAN_REPORTED | PASS |
| P3 author model | DB read-only | both QA Courses have `course_authors` OWNER rows and 0 OWNER memberships; author is not a learner participant |
| P4 ARCHIVED author join denied | HUMAN_REPORTED + DB read-only | denied; QA-PREVIEW-B ARCHIVED has 0 learner memberships; optional ALREADY_MEMBER case not run |
| P5 topicId string; Practice Skip presentation-only; Practice never resolves Today (409 PENDING_IN_TODAY) | automated / PGlite at `fff8c40` | 4 files / 67 tests pass (practice-vertical, practice, skip-daily-plan-item, submit-answer) |
| P6 H.1 integrity | DB read-only | D1=0, D2=0, D4=0; D3=2 explained by the 2 QA Courses; 6 QA-PREVIEW-A Practice Attempts all with null daily_plan_id / daily_plan_item_id |
| P7 create-another + Hebrew-only Topic-required message | HUMAN_REPORTED | PASS on `fff8c40` |

CI on `fff8c40`: GREEN (human-confirmed, GitHub Actions).

**H.1** (`20260929010000` course_authors): applied by the human via an isolated Supabase workdir (14 migrations, H.3 file
absent) after a pre-H.1 backup (outside repo); backfilled 9 OWNER rows (0 INSTRUCTOR); additive.

**Production cutover:** `main` fast-forwarded `d39c882` -> `fff8c40` (31 commits, linear); Vercel Production Ready; Production
smoke PASS (human-confirmed). Annotated tag `v0.2.0` -> `fff8c40` pushed (existing tags
`unlock-post-run010-governance-2026-10-02` and `v0.1.0` remain).

**H.3** (`20260929020000` course_membership_learner_only_v1): fresh pre-H.3 backup outside the repo (schema, public data,
auth + migration history; structurally validated, never restore-tested); dry-run proposed exactly H.3; applied successfully.
Deleted the 9 legacy OWNER `course_memberships` rows; role CHECK is now LEARNER-only; learner memberships unchanged (79, same
id set as backup); `course_authors` unchanged (OWNER 11 total / 11 active / 0 revoked); post-H.3 Production smoke PASS
(human-confirmed). All 15 migrations applied; none pending; none remote-only. Post-H.3: LEARNER 79, OWNER 0, INSTRUCTOR 0;
11 Courses (9 PUBLISHED, 1 DRAFT, 1 ARCHIVED); D4 = 0.

**Rollback caveat:** after H.3, `d39c882` is NOT a safe app-only rollback (old code reads OWNER memberships; every author
would be locked out). Restoring the old app requires first restoring/reconstructing the legacy OWNER rows (the pre-H.3 backup
holds them). Preferred recovery is fix-forward.

**Deferred (not done):** QA data cleanup (QA-PREVIEW-A open published Course, QA-PREVIEW-B, 1 QA learner membership, 6 QA
Attempts remain in the shared hosted DB) -> FUB-046; needs explicit human approval and a fresh backup; Attempts are immutable
evidence so the design needs care.

**Follow-ups preserved:** FUB-042 item 7, FUB-045, FUB-009 (two logical backups, still no restore drill), OQ-043, OQ-047,
OQ-017 items, OQ-002, pilot content/QA human items.

**DevOS insights:** (1) Preview QA reconciled HUMAN + DB + automated evidence. (2) No duplicate hosted fixture was created where
fresh automated evidence already sufficed. (3) D3 (`course_authors` without legacy membership) stopped being a valid drift gate
once new code writes only `course_authors`. (4) After H.3, drift checks use the new canonical model only (every Course has an
active `course_authors` row = D4; no legacy OWNER/INSTRUCTOR memberships). (5) A test must use the real wire value (the
exact-match mapping bug above).

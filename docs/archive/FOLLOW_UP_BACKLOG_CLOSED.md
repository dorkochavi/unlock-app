# UNLOCK — Follow-Up Backlog: Closed Items (archive)

**Status:** ARCHIVE — historical, not current authority

Closed items moved unchanged from `docs/FOLLOW_UP_BACKLOG.md` on 2026-09-26. Source of truth for history is Git. IDs are not reused.

---

# FUB-005 — Structured Import Source Size/Row Limits

**Status:** `RESOLVED` — Run 008 S1.D added `MAX_IMPORT_ROWS` (2,000,
`src/application/import/limits.ts`), enforced in `previewImport` right
after parsing, inherited by `confirmImport`'s Phase 1 reparse. Kept for
traceability; the original observation below is historical.
**Priority:** `LOW`
**Area:** Run 007 / Structured Import

## Observation

Run 007 S1's JSON/CSV import adapters (`src/application/import/adapters/`)
are pure parsing functions with no upper bound on payload size or row
count — a multi-megabyte JSON array or a CSV with hundreds of thousands of
rows is parsed synchronously in one call. Flagged during S1's
`/review-commit` general review.

## Important Constraint

Not a defect in S1 itself: S1 has no API/auth boundary yet (it is only
called by the S3 preview/confirm routes, not yet built), so there is
nowhere for a request-size limit to attach today.

## Follow-Up Investigation

When S3 (Preview API + Instructor Preview UI) is implemented, decide a
concrete request-body/row-count limit for the preview/confirm routes and
enforce it at that HTTP boundary — not inside the format-independent
adapters themselves.

## Do Not Do Yet

Do not add a size/row cap to the adapters in S1/S2 — no HTTP boundary
exists yet to make that limit meaningful, and guessing a number now would
be exactly the kind of premature constraint `.claude/rules/api.md` asks to
avoid inventing ahead of the real boundary.

---

# FUB-012 — Legacy TodaySession Retirement Investigation

**Status:** `RESOLVED` — retired pre-Run-009 (dedicated cleanup Slice,
2026-09-23). Confirmed human evidence before deletion: hosted
`today_sessions` = 0 rows, `today_session_items` = 0 rows,
`attempts.today_session_item_id IS NOT NULL` = 0 rows. A runtime
reachability audit confirmed no live `src/app` route created/retrieved a
TodaySession. All TodaySession application/domain/infrastructure code and
tests were removed; `DailyPlan`/`DailyPlanItem` (ADR-016) is now the sole
active Today model. A forward-only migration
(`supabase/migrations/20260929000000_retire_today_session.sql`) drops
`today_sessions`/`today_session_items` and
`attempts.today_session_id`/`attempts.today_session_item_id`. That migration
is committed and locally/PGlite-verified; it was deliberately not applied
hosted as part of this Slice, and was later applied hosted by a human
(2026-09-23) after the backup gate closed; see `docs/DEV_STATUS.md`. ADR-011 updated to
reflect retirement. Kept for traceability; the original observation below is
historical.
**Priority:** `LOW`
**Area:** Repository Maintainability

## Observation

Legacy `today_sessions`/`today_session_items` tables and associated code
may no longer be required now that persisted DailyPlan/DailyPlanItems
(ADR-016) own Today.

## Follow-Up Investigation

Investigate whether these can eventually be removed once no required
compatibility path remains.

## Do Not Do Yet

Do not delete now — no proof yet that nothing depends on them.

---

# FUB-027 — Signup Confirmation Redirect / Join-Intent Preservation

**Status:** `HOSTED + MANUAL VERIFIED` — `RESOLVED` for current Pre-Pilot scope (2026-09-25 real-phone rehearsal on Production: join → signup → email confirmation → login → Today, see `docs/PILOT_READINESS.md` (full evidence tables: `git show afcd750:docs/CHATGPT_PLAN.md`, "S4 Real-Device Evidence #1")). Earlier text below is historical.
**Priority:** was `HIGH` for the pilot (previously blocked a clean S4 re-test)
**Area:** Auth UX / `src/app/login/page.tsx`, `src/lib/auth-redirect.ts`

## Observation

`signUp({ email, password })` passed no `emailRedirectTo`; no tracked auth callback, middleware
or reader of `NEXT_PUBLIC_APP_URL` exists, so the confirmation link target was the hosted
Supabase Site URL (observed: `http://localhost:3000`). Join intent lives only in
`/login?next=/join/<id>`; sign-in and instant-session sign-up preserved it, but the
confirmation-email path dropped it, so a confirmed learner landed on `/login` with no `next`
and reached an empty Today.

## Current State

`buildSignUpEmailRedirectTo` builds `<origin>/login[?next=<safe path>]` from a normalized http(s)
origin plus `resolveSafeNextPath` output only; `login/page.tsx` passes it as `signUp`
`options.emailRedirectTo` (omitted if the origin is unusable, falling back to the Site URL).
`safe-redirect.ts` is unchanged. After confirmation the learner lands on
`/login?next=/join/<id>` and signs in (the account is already confirmed). Whether the link also
auto-establishes a session is NOT relied upon — verify in the real retest, including that
`/login` behaves cleanly for an already-signed-in user. Minor: `safe-redirect.ts` does not allow
`/instructor/courses/new`, so that `next` falls back to `/today`.

## Addendum (Run 009, 2026-09-26) — `next` is now read at submit time

The statement above that sign-in preserved the join intent was true only when `/login?next=…` was loaded
directly (typed URL, confirmation-email link). On the soft navigation from `/join/:id` (the join page's
`router.push`), the login page read `window.location.search` during render, before the App Router had
updated the URL, so `next` was lost and sign-in landed on `/today` (found in Run 009 S2 Preview). Fixed in
`04597b4` ("Fix join intent preservation across authentication"): `next` is read at submit time via
`resolveNextPathFromSearch` (still gated by the unchanged `resolveSafeNextPath` allowlist), including for the
sign-up `emailRedirectTo`. After sign-in the learner returns to `/join/:id` and taps Join (explicit consent; no
auto-join). Preview-verified. Everything else in this entry is unchanged.

## Human Dashboard Checks (not performed by the agent)

1. Supabase → Authentication → URL Configuration → **Site URL** = the deployed origin
   (the production origin is not tracked in the repo; the human must supply and verify it).
2. **Redirect URLs** allow-list: add BOTH `<production origin>/login` (the default-destination
   case emits a bare `/login`) and a pattern that matches `/login?next=...`, e.g.
   `<production origin>/login**`. A bare `/login` entry probably does NOT match the
   query-bearing form. Supabase validates `redirect_to` before appending any PKCE `code`, so the
   pattern only needs to match `/login?next=%2Fjoin%2F<id>`. Exact glob semantics are unverified
   offline — confirm in the dashboard/real test. Avoid a broad `/**` or preview-domain wildcard.
   If not allow-listed, Supabase silently falls back to the Site URL (join intent lost again).
3. Keep `http://localhost:3000/login` allow-listed only if local testing needs it.
4. Check the Confirm-signup email template still uses `{{ .ConfirmationURL }}` (not a hardcoded host).
5. Retest with a fresh phone/email: `/join/<id>` → sign up → confirm email → lands on
   `/login?next=…` → sign in → join → Today.

## Do Not Do Yet

No further auth change until the hosted retest shows whether this is sufficient.

---

# FUB-028 — Item Analysis Discoverability

**Status:** `RESOLVED` — PRODUCTION VERIFIED 2026-09-26 (`v0.1.0`, `8e137e6`). The instructor Course page shows a "ניתוח תשובות" entry point in the Questions section header, rendered only for a PUBLISHED Course by design (DRAFT/ARCHIVED Courses expose no dead link); the analysis page loads and passed the privacy check in Production. Code: Run 009 S3 (`aa9f858`). The original premise below ("reachable only by direct URL") was inaccurate: an unconditional small text link already existed since Pre-Pilot S2; S3 made it an intentional, Course-state-safe button. Kept for traceability; the observation below is historical.
**Area:** Instructor Course UI navigation

Observed 2026-09-25 (manual QA): Item Analysis works and is authorized correctly but is only
reachable by direct URL; there is no visible entry from the normal instructor Course UI. The
Plan does not require discoverability. The protocol names the path `Course → ניתוח תשובות לפי
שאלה`; a link would be a small deliberate UI change.

---

## Archived 2026-09-29 (DEVOS-V1.3-C): text moved unchanged

# FUB-030 — Course/Topic Practice (UX-3), Blocked by Early Practice + FSRS Semantics

**Status:** `DONE` locally in Run UX-02 (P1–P4 committed, not pushed; `docs/RUNS/2026-09-27-UX-02.md`). Semantics: ADR-020 and `docs/LEARNING_ENGINE.md` §39A
(both ACCEPTED 2026-09-26); UX: `docs/UX_SPEC.md` §10. The text below is the original deferral record.
**Priority:** `MEDIUM`
**Area:** Product / Learning semantics / Learner UX

## Observation

`docs/UX_SPEC.md` (Run UX-01 — Learner UX Foundation) reserves Course Practice and Topic Practice as learner-selected study beyond the finite Today plan: bounded sessions (assumption: 10 questions, then an explicit "another 10"), through the same Answer → Attempt → Progress → FSRS pipeline. ADR-016 §6/§19/§21 define Manual Practice as separate from Today (never resolves a DailyPlanItem). No document defines how early/extra repetitions affect FSRS scheduling; ADR-008 is silent.

## Important Constraint

The blocker is a semantics decision (how early practice interacts with FSRS scheduling and Today), not document ceremony. After Run UX-01 (UX-1 + UX-2), first decide whether it is an architectural invariant (→ ADR) or a narrower learning-policy decision (→ an existing canonical learning/design doc). A route exposing manual-practice `submitAnswer` (auth first, `learningSessionId`) would also be required; none exists today.

## Do Not Do Yet

No Practice route, session model, selector, or Practice-shaped CTA in Run UX-01. Temporary bridges that stand in for it are listed in `docs/UX_SPEC.md` §9.

## Promotion Trigger

Run UX-01 complete (UX-1 and UX-2 implemented and browser-verified), and the Early Practice + FSRS semantics decision is made.

---

# FUB-036 — Author-Can-Learn-Own-Course Blocked by Single-Role Membership Schema (QA2-D, STOPPED)

**Status:** `RESOLVED — Option 4 architecture, H.1 + H.2 + H.3 all KEEP. Author-can-learn-own-Course is fully
implemented and working. Optional H.4 (Insights CTE cleanup / polish) explicitly declined for now by the
human (2026-09-29) rather than expanding this item further; its remaining scope, plus
revokeCourseAuthor's concurrency-hardening requirement and new co-author-management UI, are carried forward
as FUB-042.`
**Area:** Course Membership / Authorization (ADR-015)

QA2-D ("Author can learn their own Course") was investigated and STOPPED per its own gate — see
`docs/RUNS/` entry for this Slice for full detail. One-line summary: `course_memberships` has a physical
`UNIQUE (user_id, course_id)` constraint with a single scalar `role` column
(`supabase/migrations/20260919000000_course_membership_v1.sql`), so one user can hold exactly one role on
one Course, ever. `createCourse` gives the creator an `OWNER` row
(`src/application/course/create-course.ts`); the existing self-join path
(`src/application/course/join-course.ts` -> `createMembership`'s `ON CONFLICT (user_id, course_id) DO
NOTHING`) would just return that same `OWNER` row unchanged (`ALREADY_MEMBER`), never add a concurrent
`LEARNER` row. Both eligibility checks that gate Today/Practice
(`src/application/dailyPlan/live-learner-membership.ts`, `src/application/practice/practice-eligibility.ts`)
require `membership.role === "LEARNER"` on that same single row. There is no existing, already-authorized
mechanism for one user to hold two roles on one Course — closing this requires an explicit product/schema
decision (e.g. multi-row membership per user/Course, or a role-set column), not an implementation-only fix.

## Promotion Trigger

Before Run 010 or inside Run 011 — product owner to decide the membership-plurality model; do not let an
implementation Slice invent it ad hoc.

**RUN010-H re-confirmation (2026-09-29, ESCALATE, no code change):** Re-verified against current repository
state — finding holds exactly as recorded. `course_memberships` (`supabase/migrations/20260919000000_course_
membership_v1.sql`) still has `UNIQUE(user_id, course_id)` + scalar `role`; `CourseMembershipRepository
.findMembership(userId, courseId): Promise<CourseMembership | null>` (`src/application/course/ports.ts`) —
the single-row assumption is baked into the port CONTRACT, not just the DB constraint, so every caller
(`join-course.ts`, `live-learner-membership.ts`, `practice-eligibility.ts`, and any future authoring-side
check) inherits it. No already-authorized plurality model exists: ADR-015 (`docs/DECISIONS/015-user-course-
membership-and-join-authorization-model.md`) documents `role` as a single conceptual field and its Addendum's
"genuinely undecided edge cases" (OQ-043) cover revoke/rejoin only, not plurality; `docs/OPEN_QUESTIONS.md`
has no open item on membership plurality; `docs/CHATGPT_PLAN.md` only records QA2-D's STOP. No "author preview
as learner" or self-enrollment side-mechanism exists anywhere in `src/` (checked). Decision packet delivered
(see `scratch/development_checkpoint.md` RUN010-H entry for full detail) — five things a real decision needs
to resolve (schema shape; the `findMembership`-family port/call-site ripple; what "revoke this user" means
when they hold multiple roles; whether an Author's own attempts on their own Course should count toward
instructor-facing aggregate Insights, given they already know the answers; and the self-enrollment UX/backfill
question), and three schema-shape options with tradeoffs (1: composite-key multi-row membership — most
general, most invasive to the port layer; 2: role-set/array column — keeps one row per user/Course pair,
smaller port-signature change, but forces an enum-to-array migration touched pervasively; 3: a separate,
additive self-enrollment concept that does not touch `course_memberships` at all — smallest migration, but
is a second access path that directly revises ADR-015 §1's "the single explicit User↔Course relationship"
claim and needs its own explicit product sign-off). No recommendation is made among the three; that choice
is the product owner's, not an implementation Slice's, per this item's own Promotion Trigger.

**Human decisions (APPROVED 2026-09-29) — Option 4 architecture selected.** The product owner chose a
fourth option beyond the three the RUN010-H decision packet offered: a separate, additive
`course_authors` table modeling management capability (OWNER/INSTRUCTOR) independently of
`course_memberships`, which will eventually narrow to learner-participation-only. Three specific
decisions were approved, refining/superseding the open questions above:

1. **Author self-enrollment exception.** An active Course Author may self-enroll as an ordinary LEARNER
   in their own Course even when it is DRAFT/AUTHORIZED_ONLY/otherwise not publicly self-joinable — a
   narrow bypass of `canSelfJoinCourse` scoped only to the Course's own author. The resulting
   `course_memberships` LEARNER row gets NO special treatment downstream (same Today/Practice/Attempts/
   Evidence/Progress/FSRS paths as any other learner). Authoring capability itself never grants learner
   eligibility — only this one narrow self-join bypass is authorized. (Answers this item's "self-enrollment
   UX/backfill" open question; implementation deferred to RUN010-H.3.)
2. **Last-author protection.** `revokeCourseAuthor` must fail closed (a new, explicit outcome) if the
   operation would leave a non-deleted Course with zero active `course_authors` rows. Future
   ownership-transfer/deletion workflows may refine this later. (Answers this item's "what does revoke mean"
   open question for the single-capability-per-row case; implementation deferred to RUN010-H.3.)
3. **Phased pacing with a hard human gate.** Implementation proceeds as H.1 (additive schema + backfill,
   zero application change) → H.2 (application-layer authorization cutover + required DTO/API surface
   changes) → **hard human-review gate** → H.3 (destructive legacy-row deletion + the two decisions above)
   → optional H.4 (Insights CTE cleanup / polish). Full detail in
   `scratch/development_checkpoint.md`'s "RUN010-H human decisions" section.

Still explicitly deferred (not part of this approved plan): the staff-vs-self-study cohort/analytics-
inclusion distinction — no exclusion of any kind is added to Insights by this work; a dual-role
Author-learner's Attempts count exactly like any other learner's (authoring capability carries zero
mastery/evidence signal). New co-author-management UI likely remains a future FUB item, not part of H.1-H.4.

**RUN010-H.1 outcome (2026-09-29, STATUS KEEP):** Implemented Phase A only — additive migration
`supabase/migrations/20260929010000_course_authors_v1.sql` creates `course_authors` (`unique(user_id,
course_id, capability)`, RLS enabled with zero policies, matching `course_membership_v1.sql`'s own
convention) and backfills existing OWNER/INSTRUCTOR `course_memberships` rows into it in the same
migration (LEARNER rows excluded; revoked rows keep their `revoked_at`; `course_memberships` itself
untouched). New domain type `CourseAuthorGrant` + `isActiveAuthorGrant` predicate
(`src/domain/course/types.ts`), new `CourseAuthorRepository` port (`src/application/course/ports.ts`,
mirroring `CourseMembershipRepository`'s shape) with `findActiveCapabilities`/`grant`/`revoke`, and its
`PostgresCourseAuthorRepository` implementation + row mapper
(`src/infrastructure/postgres/course-author-{repository,mapper}.ts`). Wired into
`PostgresCourseUnitOfWork` as an optional `CourseRepositories.authors` field (optional specifically so
none of the ~18 existing route/UnitOfWork call sites needed to change) — available for RUN010-H.2 to use,
not called by any application code yet. Zero authorization call sites, zero DTOs/routes, and zero
`course_memberships` rows/columns touched — confirmed via diff inspection (only 2 lines removed across all
modified files, both immediately expanded re-additions, not behavioral deletions). New tests: 8 PGlite
repository tests (`course-author-repository.test.ts`) + 5 migration-ordering-sensitive backfill-parity
tests (`course-authors-backfill.test.ts`, applying only prior migrations, seeding `course_memberships`,
then applying just the new migration to prove row-count parity, field-level parity, revoked-row
preservation, LEARNER exclusion, and `course_memberships` non-mutation). Full unit suite 1612/1612 PASS
(no regression from the pre-Slice count), typecheck/lint clean on all changed files. See this Slice's own
compact handoff for full verification detail and reviewer outcome.

**RUN010-H.2 outcome (2026-09-29, STATUS KEEP):** Application-layer authorization cutover. Part A: all 19
confirmed `canAuthorCourse`/`isManagementRole` call sites (`create-topic.ts`, `list-topics-for-course.ts`,
`archive-topic.ts`, `rename-topic.ts`, `validate-question-publish-readiness.ts`, `update-question-draft.ts`,
`publish-question.ts`, `list-questions-for-course.ts`, `get-question-for-authoring.ts`,
`create-question-draft.ts`, `analysis-access.ts`, `preview-import.ts`, `confirm-import.ts`,
`update-course-metadata.ts`, `set-course-join-policy.ts`, `revoke-course-membership.ts`'s actor check,
`publish-course.ts`, `get-course-for-authoring.ts`, `archive-course.ts`) now authorize via a new domain
predicate `hasActiveAuthorGrant(grants)` (`src/domain/course/types.ts`) over `course_authors`
(`repos.authors.findActiveCapabilities(actorUserId, courseId)`, H.1's repository), replacing
`canAuthorCourse`/`isManagementRole` over `course_memberships` — a source-of-truth swap, byte-identical
outcome shapes from the caller's perspective. `CourseRepositories.authors` (and the equivalent field on
`TopicRepositories`/`QuestionRepositories`/`PublishQuestionRepositories`/`PreviewImportRepositories`/
`ImportRepositories`/`ItemAnalysisRepositories`) is now REQUIRED, not optional — every route/UnitOfWork
construction site updated accordingly (~19 route files + 2 PostgreSQL UnitOfWork classes).
`CourseAuthorRepository` gained one new method, `listActiveForUser(userId)` (mirroring
`CourseMembershipRepository.listActiveForUser`), needed for Part C's "My Courses" union query.

Part B: `create-course.ts` now grants a `course_authors` OWNER capability (inside the same
`CourseUnitOfWork` transaction) INSTEAD OF a `course_memberships` OWNER row — a newly created Course's
creator has NO `course_memberships` row at all. `courses.owner_user_id` is unaffected (still
creator/legacy metadata only, ADR-015 §1).

Part C (the human's own explicit correction, required in H.2 not deferred to H.4):
`get-course-context-for-learner.ts` and `list-my-courses.ts` (and their route DTOs,
`handle-get-course-context.ts`/`handle-get-my-courses.ts`) now carry an independent `isAuthor: boolean`
signal sourced from `course_authors`, never derived from `membership.role`. `getCourseContextForLearner`
no longer short-circuits to `NOT_A_MEMBER` when there is no `course_memberships` row AND the actor holds
an active author grant — it now returns `READY` with `membership: null`, `isAuthor: true`,
`practiceAvailable: false`. `listMyCourses`/`MyCourseEntry` now unions membership-based and
author-grant-based Course ids (`role: CourseRole | null`, `isAuthor: boolean`), so a Part-B-created
Course still appears in "My Courses" and the instructor Courses list for its own creator. Frontend
consumers fixed: `(learner)/courses/course-row.tsx` (`isManaged` now reads `course.isAuthor`, not
`MANAGEMENT_ROLES.includes(role)`), `(learner)/courses/page.tsx` (`hasManagementRole` likewise),
`instructor/courses/page.tsx` (filter likewise), `(learner)/courses/[courseId]/page.tsx` (guards
`membership === null` before reading `.role`, uses the `isAuthor`-covering `!isLearner` else-branch).
`progress/load-progress.ts`'s `course.role === "LEARNER"` filter was investigated and found to need NO
change — `course_memberships` still legitimately returns `LEARNER` for real learners at this point in the
migration (H.3 hasn't touched it), and `role: null` (author-only) never equals `"LEARNER"`.

One documented, intentional divergence surfaced by the equivalence check: `course_authors` has no
`archivedAt` concept at all (H.1's own design), so an archived-but-not-revoked management
`course_memberships` row — which the OLD `canAuthorCourse` blocked — is authorized under the NEW check
(its backfilled `course_authors` grant is simply active). No known V1 code path archives an
OWNER/INSTRUCTOR row today; recorded as an accepted architectural narrowing, not a regression, with
dedicated equivalence-check test coverage (`src/domain/course/__tests__/types.test.ts`) proving this is
the *only* shape of divergence between the two checks.

Verified: full unit suite 1653/1653 PASS; full schema/PGlite suite 321/323 PASS (the same 2 FUB-041
pre-existing failures, reconfirmed unrelated); typecheck/lint clean; a dedicated
authorization-equivalence test suite (old `canAuthorCourse` vs. new `hasActiveAuthorGrant`, post-backfill,
10 scenarios including the one accepted divergence); every one of the 19 touched call sites got 2 new
cases each (active `course_authors` grant with no `course_memberships` row → authorized; LEARNER-only
membership with no grant → NOT_AUTHORIZED, already covered by pre-existing tests); a new PGlite
integration test proving a real Postgres-wired `createCourse` yields a real `course_authors` OWNER row,
zero `course_memberships` rows, and a full authoring round trip (create Topic, set join policy, publish)
succeeding for that creator. `join-course.ts`, `revoke-course-membership.ts`'s TARGET action, and all
Today/Practice/FSRS/Insights-counting code confirmed untouched. No new author-based Insights exclusion
added (per the Run's own corrected principle).

Review: `unlock-security-reviewer` and `unlock-reviewer` both independently returned **NO BLOCKING
FINDINGS**. Six non-blocking notes recorded, none actioned (documentation/cleanup only, no correctness or
scope impact): (1) `archive-course-membership.ts` has no role restriction and is not wired to any route
today, but would silently bypass `course_authors`' lack of an `archivedAt` concept if ever exposed —
flagged for a future explicit decision before that use case is ever wired to an endpoint, not solved here;
(2) `CourseAuthorRepository`'s module doc comment ("not called from any application code") is stale post-
cutover; (3)/(4) two doc comments (`domain/topic/types.ts`, `domain/insights/analysis-entry.ts`,
`handle-set-course-join-policy.ts`) still reference `canAuthorCourse` by name or describe an authorization
asymmetry that no longer exists post-cutover; (5) `checkAnalysisAccess`'s `memberships` parameter is now
unused dead-parameter surface; (6) `CourseUnitOfWork`'s port-level doc comment still describes
`createCourse`'s transaction as writing a `course_memberships` row (the function's own doc comment was
correctly updated; the port-level one was missed). None require action before RUN010-H.3.

**Process note:** the implementing worker for this Slice was terminated mid-verification by a session rate
limit before delivering its own compact handoff or committing. The parent session independently
re-confirmed the diff was complete and coherent, re-ran typecheck (clean)/lint (clean)/full unit suite
(1653/1653, matching the pre-interruption count) directly, and retrieved both reviewers' full findings
(each had also been cut off mid-response by the same rate limit, then resumed and asked to redeliver their
already-completed verdicts). The full schema/PGlite suite could not be independently re-run at commit time
(the background process was stopped by the harness for system memory pressure, not a test failure) — the
321/323 figure (matching H.1's own known 2 pre-existing FUB-041 failures) is corroborated by both
reviewers, who independently read the actual new/modified test files' content (not merely a reported
number) and confirmed they assert the right things. This Slice's evidence is treated as sufficient on that
basis; a fresh schema/PGlite run before RUN010-H.3 begins is reasonable due diligence, not a requirement
this Slice failed to meet.

**Pre-H.3 due-diligence review correction (2026-09-29):** the "321/323, 2 FUB-041 pre-existing failures"
framing above (and H.1's identical framing) is only half accurate. A fresh full schema/PGlite run plus
bisection against Run 010's own START_HEAD `d39c882` (see `FUB-041`, now `RESOLVED`) found that only the
`practice-vertical.test.ts` `topicId` failure is genuinely pre-existing; the `practice.test.ts` reinforcement-
ordering failure was introduced by RUN010-C's own intentional anti-immediate-repeat fix and its integration
test was never updated to match — not caught here because H.2's own schema/PGlite run never completed
independently (see the Process note above). A standalone corrective commit (before H.3, not folded into it)
fixed the stale test; the fresh full schema/PGlite suite now shows only the one genuine pre-Run010 failure.
This does not change H.2's own KEEP verdict or any of its authorization-cutover findings — it corrects only
the schema/PGlite evidence-attribution claim.

**RUN010-H.3 outcome (2026-09-29, STATUS KEEP) — GO received from human, gate cleared.** Implemented
Phase C (Migration B + the two approved human decisions): (a) migration
`supabase/migrations/20260929020000_course_membership_learner_only_v1.sql` DELETEs every legacy
OWNER/INSTRUCTOR `course_memberships` row (redundant — already backfilled into `course_authors` by H.1, and
no code path has written a non-LEARNER `course_memberships` row since H.2) and narrows the table's `role`
CHECK constraint (dropped by its Postgres-assigned default name, `course_memberships_role_check`, matching
this repo's own established convention — `20260925000000_daily_plan_new_material_v1.sql` drops an identical
inline-unnamed constraint the same way) to `LEARNER`-only going forward. `course_authors` itself (H.1's
table) is untouched by this migration in any way. The TypeScript `CourseRole`/`CourseMembership.role` domain
type (`src/domain/course/types.ts`) was deliberately NOT narrowed — stays permissive, per this Slice's
approved scope. (b) `src/application/course/join-course.ts`: the approved narrow author self-enrollment
bypass — when `canSelfJoinCourse` denies self-join (DRAFT/AUTHORIZED_ONLY/ARCHIVED/etc.), an active Course
Author (`repos.authors.findActiveCapabilities` on that exact `courseId`) may still self-join as an ordinary
LEARNER; a non-author still gets `NOT_AUTHORIZED`, and the bypass is proven Course-scoped (an author of
Course A cannot use it on Course B) and revocation-sensitive (a revoked grant does not authorize it). The
resulting `course_memberships` row is byte-identical to any other learner's — no new field, no flag,
confirmed at the DB level. (c) New use case `src/application/course/revoke-course-author.ts` (mirrors
`revoke-course-membership.ts`'s shape) revokes a `course_authors` grant, failing closed with a new explicit
`LAST_AUTHOR` outcome (not a generic error, nothing mutated) if the revoke would leave the Course with zero
active `course_authors` rows — required a new port method `CourseAuthorRepository.listActiveForCourse`
(`ports.ts` + Postgres impl + all 4 in-memory test fakes across
`src/application/{course,import,question,topic}/__tests__/in-memory-fakes.ts`). `revokeCourseAuthor` is not
yet wired to any API route (consistent with this Slice's approved scope — no new co-author-management UI).

Migration B's destructive DELETE made a pre-existing test-infrastructure assumption schema-impossible: several
PGlite test files seeded raw OWNER/INSTRUCTOR `course_memberships` rows (or, in one case,
`practice.test.ts`'s `it.each` table, a raw `UPDATE course_memberships SET role = 'INSTRUCTOR'`) purely to
authorize a test actor — a pattern already obsolete in production since H.2 but still live in test fixtures.
Fixed by updating `supabase/tests/postgres/db-harness.ts`'s `insertCourseMembership` helper: for role
OWNER/INSTRUCTOR it now creates ONLY the equivalent `course_authors` grant (no `course_memberships` row at
all, returning `null` instead of an id), matching real production reality — every existing caller that used
this purely for authorization keeps working unchanged. Six dependent test files were updated to match the new
schema reality, each with an inline comment explaining the substitution: `course-membership-repository.test.ts`
and `postgres-course-unit-of-work.test.ts` (OWNER fixture swapped for LEARNER — the round-trip/atomicity claim
being proven does not depend on which role), `supabase/tests/postgres/join-course.test.ts` (the old "never
downgrades a pre-existing real OWNER row" test, whose premise is now schema-impossible, replaced by 4 new
tests covering the self-enrollment bypass directly), `practice.test.ts` (the `it.each` "non-LEARNER role" case
removed — the DB itself now rejects that row shape, proven directly by the new narrowing test's own "rejects
a non-LEARNER insert attempt" case), `daily-plan-live-membership.test.ts` (the separate "non-LEARNER role"
test merged into "no membership row at all," since a management-role actor now produces that identical state
post-migration), and `supabase/tests/schema.integration.test.ts` (test 29's incidental `role: "OWNER"` setup
— the test's actual point is "no institution table/column exists" — changed to `LEARNER`; this file has its
own separate `insertCourseMembership` helper, not `db-harness.ts`'s, and was the one file this Slice initially
missed before a fresh full schema/PGlite run caught it).

New tests: `supabase/tests/postgres/course-membership-learner-only-narrowing.test.ts` (4 tests — migration-
ordering-sensitive, mirrors H.1's own `course-authors-backfill.test.ts` shape: legacy rows deleted,
`course_authors` completely unaffected, existing LEARNER rows byte-identical before/after, narrowed constraint
rejects a non-LEARNER insert); `src/application/course/__tests__/revoke-course-author.test.ts` (7 in-memory
tests: successful revoke of one of several authors, `LAST_AUTHOR` fail-closed with nothing mutated,
`NOT_AUTHORIZED` for a non-author, `NOT_A_GRANT_HOLDER` for a nonexistent target, dual-capability
same-user distinction, cross-Course isolation); new self-enrollment-bypass tests added to both
`src/application/course/__tests__/join-course.test.ts` (6 new in-memory cases) and
`supabase/tests/postgres/join-course.test.ts` (4 new PGlite cases: happy path, non-author denial,
Course-scoping, revoked-grant denial); `supabase/tests/postgres/author-self-enrollment.test.ts` (1 PGlite
integration test: a dual-role Author-Learner self-enrolls on their own DRAFT Course via the bypass, the
Course is later published by the same actor, they practice a real Question through the real
`selectPracticeBatch`/`submitPracticeAnswer` pipeline, and their resulting Attempt is counted normally by
`PostgresItemAnalysisRepository` — proving the corrected "authoring capability carries zero mastery/evidence
signal" principle holds with zero new exclusion logic added anywhere); 2 new `listActiveForCourse` PGlite
tests added to `course-author-repository.test.ts`.

Verified: full unit suite 1665/1665 PASS; full schema/PGlite suite — only the one already-classified genuine
pre-Run010 `practice-vertical.test.ts` `topicId` failure remains (FUB-041, RESOLVED); typecheck and lint
clean. `unlock-db-reviewer`, `unlock-security-reviewer`, and `unlock-reviewer` all independently returned
**NO BLOCKING FINDINGS**. Non-blocking notes recorded, none requiring action before commit: (1) a stale
doc comment in `src/app/api/courses/[courseId]/join/route.ts` claiming `join-course.ts` never reads `authors`
— fixed directly (trivial, no functional change); (2) `revokeCourseAuthor`'s last-author-protection check is a
genuine check-then-write race (two concurrent revokes against a Course with exactly 2 active grants could both
pass the pre-check and both write, leaving zero active rows) — the DB reviewer noted this is materially
weaker than the "accepted race" precedent the code comments cite (that precedent covers a stale-authorization
race on an otherwise DB-constraint-backed single UPDATE; this case has no DB constraint backing the
multi-row "≥1 active author" invariant at all) — not exploitable today since `revokeCourseAuthor` is not wired
to any route, but should be hardened (e.g. `SELECT ... FOR UPDATE` in a transaction) before it ever is; (3)
the migration's constraint-drop-by-default-name approach is this repo's own established convention (matches
`20260925000000_daily_plan_new_material_v1.sql`), not a new risk, per the DB reviewer's own independent check.
Invariants confirmed intact: Today/Practice/Progress/Attempts/Evidence/FSRS semantics and their existing
tests completely untouched; zero new Insights exclusion logic anywhere (confirmed by grep and by the new
integration test); no new co-author-management UI; `revokeCourseMembership`'s own behavior/tests untouched;
`course_authors`' shape (`unique(user_id, course_id, capability)`, no `archivedAt`) unchanged. No hosted DB
mutation of any kind — `supabase link`/`supabase db push` never invoked.

---

(Pre-prune original of FUB-034; active residual remains in `docs/FOLLOW_UP_BACKLOG.md`.)

# FUB-034 — Open-Ended Practice, Same-Day Repetition, Daily Plan Budget, PARTIAL Grading (Run UX-03-QA1 Findings 8/9, PARTIAL)

**Status:** `PROMOTED — owned by Run 010` (recorded here so it is never silently dropped; the actionable decision
belongs in `docs/CHATGPT_PLAN.md` once Run 010 starts, not in this file)
**Area:** Learning Engine — evidence/scheduler semantics, Today plan sizing, grading vocabulary

Product-owner QA (real 30-question course) surfaced four explicit product directions that this Run (UX-03-QA1) was
authorized to record but NOT implement, because each requires a new Learning Engine evidence/semantics decision this
Run has no authority to invent (`.claude/rules/learning-engine.md`).

1. **Practice must not dead-end — RESOLVED by RUN010-B.** Today is finite by design; Practice is learner-initiated
   and should feel open-ended (a batch of 10 is pacing/UI only, never a hard session limit). RUN010-B added a Tier 4
   "same-day reinforcement" fallback to `selectPracticeBatch` (activates only once Tiers 1-3 are genuinely exhausted
   for the requested scope), ranked weaker/incorrect-evidence-first then least-recently-answered-first, with an
   anti-immediate-repeat rule and controlled randomness only among exact ties — and extended the existing §39A
   "early correct = evidence-only, no scheduler review" carry-over rule (`progress-update.ts`'s `nextSchedulerMemory`)
   so a Question's 2nd+ real Attempt in the SAME learning-day session never re-invokes a real FSRS scheduler
   transition (regardless of correctness), closing the mastery-inflation risk this item flagged. See
   `src/application/practice/select-practice-batch.ts`, `src/domain/learning/progress-update.ts`,
   `src/domain/learning/learning-session.ts` (`deriveIsReinforcementAttempt`), and
   `supabase/tests/postgres/practice.test.ts`'s `RUN010-B` describe block for the accepted design/evidence.
   Sub-items 2-4 below remain open.
2. **Today Daily Plan Budget — RESOLVED (architecture) by RUN010-D; numeric calibration remains open.** The product
   owner's 30-50 figure was explicitly rejected as an untested hypothesis (not adopted). RUN010-D instead implemented
   the already-accepted-direction tiered-need-bucket + whole-plan-guardrail model
   (`docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` §2, `docs/OPEN_QUESTIONS.md` #16): `computeTodayPlanBudget`
   (`src/domain/learning/today-plan-budget.ts`) sizes the plan from genuine REMEDIATION/DUE_REVIEW-tier candidate
   counts (excluding same-day FSRS learning-step artifacts per OQ-044 — see `MemoryScheduler.estimateCardPhase`,
   recomputed at read time rather than stored, so it survives real persistence),
   bounded by minUsefulItems=5 / hardMaximumItems=15 (`PRODUCTION_TODAY_PLAN_BUDGET_POLICY`), with exam proximity
   feeding in only as an amplifier on ranking order (`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §3/§7,
   `src/domain/learning/exam-urgency.ts`), never a separate budget input. These three numbers (5/8-12/15) and the
   amplifier curve constants remain CONSERVATIVE CALIBRATION CANDIDATES, not locked — see OQ-016 and the module doc
   comments in `today-plan-budget.ts`/`exam-urgency.ts` for what future tuning would touch.
3. **PARTIAL grading outcome.** The product owner observed MULTIPLE_CHOICE attempts that "felt partially correct."
   Investigated in UX-03-QA1: confirmed the domain/application layer has NO canonical PARTIAL outcome — grading is
   `isCorrect: boolean` only (`src/domain/learning/answer.ts`'s `evaluateAnswerCorrectness`, `types.ts`'s `Attempt
   .isCorrect`). UX-03-QA1 did NOT invent PARTIAL semantics; instead it shipped correct-answer reveal + selected/
   missed-option feedback (Finding 3) so the learner still understands what happened, without a new grading category.
   Whether MULTIPLE_CHOICE should ever have a real PARTIAL/partial-credit outcome (and what it would mean for
   `isCorrect`, mastery, scheduler review) is an open Run-010 product/domain decision.
   **Human decision (2026-09-29, resolving RUN010-G Half B's ESCALATE):** Option A (status quo) — no PARTIAL
   grading in V1. `isCorrect: boolean` stays the sole grading outcome; no change to mastery, scheduler review,
   or misconception interaction. Item 3 stays explicitly **OPEN** (declined, not resolved) — the decision
   packet's Option B (learner-facing "almost" acknowledgment) and Option C (real partial-credit grading via a
   future dedicated ADR) remain available if the product owner revisits this post-V1; nothing here should be
   read as ruling them out permanently.
4. **Practice ranking diversification (partially resolved this Run).** UX-03-QA1 already fixed the reported
   symptom safely: Tier 2 (unseen)/Tier 3 (broader coverage) candidates within `selectPracticeBatch` are now
   Topic-interleaved (`interleaveByTopic`) instead of raw creation/import order, without touching the canonical NBA
   ranking Today also uses. If Run 010 revisits ranking/tie-break policy more broadly (e.g., for Today itself), start
   from this same "diversify ties, never priorities" principle rather than re-deciding it from scratch.
5. **ADR-016 §10 tier-crossing requirement — still not implemented (pre-existing gap, surfaced by RUN010-D review).**
   ADR-016 §10 / `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5 already ACCEPT, as a binding product rule, that
   sufficiently severe Memory Need/overdue duration must eventually be able to promote a candidate across a priority
   TIER boundary (e.g. a badly-overdue `DUE_REVIEW` candidate must not be permanently capped below every
   `REMEDIATION` candidate forever, purely because a sibling Course keeps generating REMEDIATION-tier candidates
   every day) — see also `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a, which states this makes §7/§14's "tier is the
   primary axis, exam urgency only within-tier" framing "no longer sufficient as stated." `tierOf()`
   (`src/domain/learning/next-best-action-ranking.ts`) still has zero dependency on `dueAt`/`retrievability` — this
   gap predates RUN010-D and RUN010-D's own delivered scope (an exam-urgency amplifier, confined to the within-tier
   tie-break per ADR-016 §11 "amplifier, not gate") does not violate this rule, but RUN010-D substantially rewrote
   this same file's doc comments without tracking the still-open tier-crossing requirement anywhere outside those two
   design docs. Exact escalation mechanism/thresholds remain explicitly undecided calibration work, not solved here.

## Promotion Trigger

Run 010 start — this item is the Run's own required early input, not backlog to rediscover later.

---

(Original FUB-041; open `topicId` residual remains active in `docs/FOLLOW_UP_BACKLOG.md`.)

# FUB-041 — Two Failing Schema/PGlite Tests Surfaced at RUN010-E; One Genuinely Pre-Run010, One a RUN010-C Stale-Test Miss (RESOLVED)

**Status:** `RESOLVED` (pre-H.3 due-diligence review + corrective commit, 2026-09-29)
**Area:** `supabase/tests/postgres/practice-vertical.test.ts`, `supabase/tests/postgres/practice.test.ts`

While gathering final verification evidence for RUN010-E, a full `npx vitest run --config supabase/vitest.config.mts`
pass surfaced 2 failing tests (out of 310) in files RUN010-E's diff does not touch. At the time both were
labeled "pre-existing/unrelated" and re-cited that way, unverified against the actual Run 010 baseline, through
RUN010-D/E/H.1/H.2. The RUN010-H pre-H.3 due-diligence review (2026-09-29) checked this claim properly by
bisecting both failures against Run 010's own START_HEAD (`d39c882`) and commit chain, and found the two
failures have **different, genuinely different causes** — only one was actually pre-existing:

1. **`practice-vertical.test.ts`** > "Practice selects around Today, answers through the normal pipeline, never
   resolves Today, and Today keeps working" — the Practice wire response includes an unexpected extra
   `topicId` field the test's exact-keys assertion does not allow for. **Confirmed genuinely pre-existing**:
   reproduced identically at Run 010's own START_HEAD `d39c882`, before any Run 010 Slice existed. Very likely a
   consequence of `questions.topic_id` (added by `20260928000000_question_authoring_v1.sql`, Run 006 S2) now
   being included somewhere in the Practice read path's row mapping, with this test never updated for it. Left
   unfixed — genuinely out of every Run 010 Slice's own scope; still open, still needs its own future triage.
2. **`practice.test.ts`** > "RUN010-B — same-day reinforcement (Tier 4, resolves FUB-034) > never returns the
   just-answered Question first when a genuine alternative exists, even if that alternative is lower ranked by
   evidence" — **NOT pre-existing.** Bisection: passed cleanly at RUN010-B (`4546593`, 29/29) and started failing
   exactly at RUN010-C (`1a68c96`). RUN010-C's own diff (`select-practice-batch.ts`'s `rankReinforcementCandidates`)
   *intentionally* reversed RUN010-B's original anti-immediate-repeat rule ("swap even against a lower-priority
   alternative") — the corrected rule only swaps on an exact tie (same correctness bucket AND same
   `lastAttemptAt`), so a materially stronger, uniquely-top candidate is now always returned first even as the
   immediate repeat. This exact scenario is already proven correct at the unit level by RUN010-C's own
   `rank-reinforcement-candidates.test.ts` ("RUN010-C Part 3: does NOT demote..."). This integration test's
   assertion was simply never updated to match — it kept asserting RUN010-B's old, now-intentionally-reversed
   order. RUN010-C's own commit never re-ran the schema/PGlite suite (its recorded evidence cites only the unit
   suite), so the miss was never caught there, and every subsequent Slice's "pre-existing/unrelated" citation
   compounded the mislabeling rather than checking it.

**Corrective commit** (2026-09-29, before RUN010-H.3): updated the stale test to assert the current canonical
RUN010-C rule (learning priority wins for non-tied candidates; anti-immediate-repeat/diversity may only reorder
materially equivalent candidates), renamed it to describe that rule, and added a comment pointing at the unit
test it now duplicates at the integration level. Fresh full schema/PGlite suite re-run after the fix: only the
genuinely pre-existing `practice-vertical.test.ts` `topicId` failure remains.

## Promotion Trigger

The remaining genuine pre-Run010 `practice-vertical.test.ts` `topicId` failure still needs its own triage —
bisect Run 006-era commits, confirm the `topics.topic_id`-in-row-mapping hypothesis, and fix the test (or the
row mapping) once picked up. Not urgent (does not reduce confidence in any Run 010 Slice's own evidence,
confirmed by this item's own bisection), but should not be left indefinitely.

---

# FUB-025 — Answer Submission Idempotency vs. Server-Generated `answeredAt`

**Status:** `RESOLVED` AS A BACKLOG ITEM / CANONICAL OWNERSHIP MOVED — closed 2026-09-29 (Run GOVERNANCE-RECONCILE-001). The underlying unresolved decision is NOT resolved: it moved unchanged in substance to `docs/OPEN_QUESTIONS.md` OQ-048; no separate implementation task remained. Original status was `DEFERRED`.
**Priority:** `LOW`
**Area:** Learning Engine / Answer Submission / API

## Observation

Found by the hosted Pre-Pilot S3 smoke test (2026-09-24) and reproduced by the
local burst harness. `answeredAt` is part of the canonical command identity
compared for idempotent retries (`CANONICAL_COMMAND_IDENTITY_FIELDS` in
`src/application/learning/submit-answer.ts`), but the HTTP route
(`POST /api/daily-plan/items/:itemId/answer`) sets it to the server's own
`new Date()` per request. Consequences for two requests carrying the SAME
`submissionId`:

- a later, sequential retry finds the existing Attempt and its `answeredAt`
  differs, so it returns `409 SUBMISSION_ID_REUSED` instead of the idempotent
  `200`;
- a truly concurrent duplicate loses the race, sees the already-resolved item
  (the pending check runs before the insert), and returns
  `409 ITEM_ALREADY_RESOLVED`.

No data is corrupted: exactly one Attempt and one completed DailyPlanItem
result either way. The current UI is unaffected — it generates a fresh
`submissionId` per click and treats 409 as "already resolved"
(`src/app/(learner)/today/page.tsx`).

## Important Constraint

The unresolved question is semantic, not a bug fix: should a server-generated
`answeredAt` participate in idempotency identity at all, and should a
concurrent same-key duplicate return the original result? Any change touches
the Attempt/idempotency contract (ADR-010) and needs DB and general review.
Attempts are immutable evidence; do not rewrite history.

## Follow-Up Investigation

Decide (ADR-010 amendment if accepted) whether to exclude a server-derived
`answeredAt` from the identity comparison, and/or re-check the submission id
after acquiring the per-learner lock so a concurrent duplicate returns the
existing result. Keep the strongest invariant: one Attempt and one resolved
item per logical submission.

## Do Not Do Yet

No change to answer-submission semantics during the Pre-Pilot Run. The
S3 harness accepts `200+200` or `200+409` (`ITEM_ALREADY_RESOLVED` /
`SUBMISSION_ID_REUSED`) for a same-submissionId duplicate pair.

## Promotion Trigger

A real client needs same-`submissionId` retry (flaky-network resubmit, mobile
offline queue), or pilot evidence shows duplicate-submit 409s confusing
learners.

---

# FUB-039 — Same-Day Reinforcement Freeze Can Delay a New Card's FSRS Graduation When Only Touched via Same-Day Practice (RUN010-C audit, NON-BLOCKING)

**Status:** `RESOLVED` — closed 2026-09-29 (Run GOVERNANCE-RECONCILE-001). The original audit question is resolved (the freeze is intentional and final). The residual same-day-graduation / FSRS-calibration interaction is NOT resolved: it remains open as a relation in `docs/OPEN_QUESTIONS.md` OQ-044 (no independent executable follow-up). Original status was `RECORDED`.
**Area:** Learning Engine — FSRS scheduler freeze x short-term learning steps
(`src/domain/learning/progress-update.ts`, `learning-session.ts`, OQ-044)

RUN010-C audited whether RUN010-B's unconditional same-day reinforcement scheduler-freeze
(`isReinforcementAttempt` in `nextSchedulerMemory`) incorrectly conflates (a) a learner voluntarily
re-practicing a Question before it is due again with (b) a Question that has genuinely become due again the
same calendar day (a real FSRS-scheduled event, distinct from an artificial repeat) — directly relevant given
OQ-044's confirmed finding (RUN010-C) that a brand-new card's first correct answer is due again in exactly 10
minutes under current ts-fsrs defaults.

**Verdict: the unconditional freeze is intentional and correct, not a bug** — see
`src/infrastructure/learning/__tests__/practice-early-correct-scheduling.test.ts`'s "RUN010-B — same-day
reinforcement" describe block (including its already-existing "not merely 'still early'" test, predating this
audit) and the new RUN010-C test proving the identical outcome for a genuinely-due-again NEW card. "At most
one real scheduler-moving event per Question per day, regardless of why" remains the accepted invariant;
distinguishing "before due" from "genuinely due again" would reopen exactly the risk RUN010-B closed (a
same-day repeat being able to retrigger a second real AGAIN/lapse for what is really one day's due event) and
would additionally require deciding, ahead of OQ-044's own still-open calibration, whether a same-day
learning-step event should count as a real review at all — a product decision, not a threshold fix.

**Residual, bounded, non-blocking consequence recorded here:** because Today can never re-present the same
Question twice in one plan, and Practice's Tier 4 (`selectPracticeBatch`) is the ONLY way an
already-answered-today Question is served again that day, a brand-new card that a learner ONLY ever touches
via same-day Practice reinforcement (never on a later calendar day) will never actually graduate out of
ts-fsrs's short-term "Learning" state that day — every same-day reinforcement repeat freezes the transition
`memoryScheduler.review()` would otherwise perform. This is bounded to a single calendar day (the very next
day it is touched — via Today or a fresh, non-reinforcement Practice pick — is not "same session," so a real
review fires and the card progresses normally, just a session later than the raw due timestamp suggests,
which is already OQ-044's known, accepted drift). Not fixed here because it is an interaction between two
already-open/deliberate policies (OQ-044 learning-step calibration + RUN010-B's per-day event cap), not an
independent bug.

## Promotion Trigger

If/when OQ-044 is calibrated (e.g. learning steps disabled, shortened, or a minimum first-interval floor is
adopted), re-check whether this residual same-day-graduation-delay interaction still applies under the new
configuration, and whether it is still acceptable.

---

# FUB-040 — RUN010-E Residual Gaps: Cross-Course Topic Diversity, and Unmapped OQ-018 Reason Categories (NON-BLOCKING)

**Status:** `RESOLVED` AS A BACKLOG ITEM / CANONICAL OWNERSHIP MOVED — closed 2026-09-29 (Run GOVERNANCE-RECONCILE-001). Items 1-3 are unresolved product/contract decisions that are NOT resolved; they now live in `docs/OPEN_QUESTIONS.md` OQ-017 (item 1) and OQ-018 (items 2 and 3); no independent implementation task remained. Original status was `RECORDED`.
**Area:** New Material fallback Topic diversity (`src/infrastructure/postgres/unseen-question-repository.ts`,
`src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`); OQ-018 learner-facing reason mapping
(`src/messages/he.ts`, `src/app/(learner)/today/question-card.tsx`)

RUN010-E investigated whether ADR-017's V1 New Material fallback samples representatively across Topics.
Evidence (see `supabase/tests/postgres/unseen-question-repository.test.ts`'s new "Topic-diversifying
round-robin" suite) showed a real, previously-unaddressed clustering bug: pure `created_at asc` ordering let
one Topic's older unseen Questions monopolize the entire (typically 3-item) fallback for as long as that Topic
still had unseen material, silently starving every other Topic of early calibration evidence. This was fixed
**within a single Course's own selection** via a deterministic `row_number() over (partition by topic_id ...)`
round-robin, still unseen-only, still capped at ADR-017's existing max-3, still deterministic — no ADR-017
envelope change.

**Three bounded items intentionally left open, not solved by that fix:**

1. **Cross-Course pooling still isn't Topic-aware.** `generate-daily-plan-for-resolved-inputs.ts`'s
   `discoverNewMaterialItems` pools each eligible Course's own (now Topic-diversified) candidate list and
   re-sorts the pooled result **globally by `createdAt` only** before taking the final top-3 — this pre-existing
   step was left untouched (it is a Course-count-correctness concern, documented in that file's own comment,
   not a Topic concern). Consequence: a learner with unseen material in MULTIPLE simultaneously-eligible
   Courses on the same day can still have one Course's Topic-diversified order partially overridden by the
   cross-Course recency re-sort. Bounded (affects only the multi-Course-simultaneous-fallback edge case, never
   the common single-dominant-Course case) and explicitly NOT a per-Course fairness quota (which ADR-017 still
   forbids) — a genuine fix would need a deliberate product decision about how Topic diversity and Course
   pooling should interact, which is out of this Slice's authority to invent.

2. **Not every real internal NBA/tier signal has a clean, honest 1:1 mapping to one of OQ-018's six candidate
   learner-facing reason strings** (review due / repeated mistake / weak area / exam approaching / not enough
   evidence / new material). RUN010-E mapped `REVIEW_DUE` → "review due", `RELEARN_LAPSE` → "weak area",
   `REPAIR_MISCONCEPTION` → "repeated mistake", and the ADR-017 fallback's `NEW_LEARNING` → "new material"
   (closing the concrete cold-start mislabeling bug: `NEW_LEARNING` previously had no mapped label at all and
   fell back to leaking the raw internal string). Two things were deliberately left UNMAPPED rather than
   guessed:
   - `STRENGTHEN_MEMORY` (a positive-progress, not-yet-mastered state) does not honestly fit any of OQ-018's six
     strings — they all read as either routine/negative signals or the cold-start case, and reusing "weak area"
     for it would conflate a positive, non-remediation state with a genuinely weak one. Its pre-existing shipped
     label ("חיזוק זיכרון" / "memory strengthening", predating OQ-018 and this Slice) was left unchanged, since
     it is already honest, just not literally one of OQ-018's six candidate strings.
   - "exam approaching" has no per-item persisted signal to hang an honest label on: RUN010-D's exam-urgency
     amplifier is a continuous within-tier tie-break multiplier applied uniformly across a Course's items, not a
     boolean/threshold fact recorded on any one `DailyPlanItem` — labeling a specific item "exam approaching"
     would require a genuine new product/threshold decision (when is urgency "high enough" to say so out loud?)
     that OQ-018 does not itself resolve.

3. **`GET /api/daily-plan/today` still serializes raw internal `tier`/`reasons`/`otherApplicableTypes`/
   `actionType` strings at the wire level** (`src/app/api/daily-plan/today/daily-plan-dto.ts`), even though the
   UI (`question-card.tsx`) now only ever renders a mapped, honest label and never the raw code. This DTO
   predates RUN010-E by a wide margin (introduced well before this Run, as an already-reviewed, deliberate "use
   only real domain fields, no invented score" design) and is unchanged by this Slice's diff — flagged here
   because RUN010-E's own review process (general-reviewer pass) surfaced it as a gap in this Slice's own
   "no other leak surface" verification, not as a new defect this Slice introduced. Whether this is actually a
   problem depends on a reading of OQ-018's "avoid exposing internal scores" constraint: narrowly (only the
   rendered UI matters) it is already satisfied; broadly (a technical learner opening DevTools/Network can see
   e.g. `MISCONCEPTION_ACTIVE` or an unmapped raw `actionType`) it is not. Resolving this would mean either
   tightening the DTO to only carry an already-mapped learner-facing reason (a real, if small, API-contract
   change) or an explicit product decision that wire-level internal codes are acceptable as long as the UI
   never renders them raw — not something to infer here.

## Promotion Trigger

Promote item 1 if/when a Run adds genuine multi-Course-simultaneous Today composition depth (beyond today's
pooled-and-capped fallback). Promote item 2 (either half) only alongside an actual product decision — resolving
OQ-018's `STRENGTHEN_MEMORY`/"exam approaching" gap, or literally reconciling the pre-existing
`RELEARN_LAPSE`/`REPAIR_MISCONCEPTION`/`STRENGTHEN_MEMORY` copy to OQ-018's exact six strings — is a copy/product
call for the human product owner, not something to infer here. Promote item 3 alongside a formal OQ-018
resolution (the DTO-tightening question is naturally part of "what does explainability mean at the API
boundary," not a standalone fix to invent mid-Slice).

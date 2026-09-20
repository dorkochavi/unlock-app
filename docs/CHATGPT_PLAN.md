# UNLOCK - ChatGPT Execution Plan

PLAN_VERSION: 006
RUN_ID: 2026-09-20-006
BASE_HEAD: a03efa4
RUN_GOAL: Deliver manual Question Authoring + immutable publish/re-publish V1 on top of the completed Course + Topic authoring foundation.
EXPECTED_STOP: COMPLETE

---

# 0. Why This Plan Replaces the Previous Draft

This Plan is grounded in:

- `docs/RUNS/2026-09-20-005.md`
- `docs/DEV_STATUS.md`
- the actual pushed Git baseline `a03efa4`

Run 005 is COMPLETE as **Course Authoring & Topics V1**.

Important current truths carried forward:

- `questions.current_version_id` is already nullable by design and can represent a pre-first-publish Question.
- Run 005 decided against a separate `QuestionDraft` table for V1; draft authoring should use nullable `draft_*` state on `questions`, unless repository reality reveals a direct integrity conflict.
- immutable `Question` / `QuestionVersion` history already exists in the learning model.
- `topics` now exists as a flat, Course-scoped, archive-not-delete model.
- Question↔Topic association is intentionally not implemented yet and belongs to Run 006.
- existing learner Today reads the exact persisted `QuestionVersion`; grading-only data is excluded from learner-safe projections.
- historical Attempts already point to exact QuestionVersions and replay uses persisted correctness.
- Run 005's new migrations are PGlite-verified but not yet applied to hosted Supabase.
- Run 005's instructor UI exists under `/instructor/**`.
- Structured Import remains Run 007 scope.

This Run must extend the existing model, not rebuild it.

---

# 1. Run-Start Contract

Plan authored against:

`a03efa4`

Expected preferred state:

- `HEAD == BASE_HEAD`
- `origin/feature/project-foundation == a03efa4`
- `docs/CHATGPT_PLAN.md` may be the only expected uncommitted modification
- no unexplained staged/unstaged/untracked work

`docs/CHATGPT_PLAN.md` is Dor/ChatGPT-owned:

- read it
- execute it
- do not rewrite it
- do not stage it
- do not discard it

Do not push.
Do not deploy.
Do not run `supabase db push`.
Do not mutate hosted Supabase.
Do not request or expose secrets.

---

# 2. Current-State Reconciliation Before Product Work

`docs/DEV_STATUS.md` was committed before Dor pushed Run 004 + Run 005, so its repository-state section is now stale even though its product-state sections are useful.

Before implementing Question work:

- verify actual Git state;
- update only the stale current-state repository facts in `docs/DEV_STATUS.md`:
  - pushed HEAD is now `a03efa4`;
  - Run 004 + Run 005 are pushed;
  - remove the obsolete manual action saying they still need to be pushed;
- preserve historical Run Report 005 as immutable history; do NOT edit it merely because the later push occurred.

This reconciliation may be folded into the first focused documentation/code commit or committed separately if cleaner.

Do not turn DEV_STATUS into a changelog.

---

# 3. Product Boundary

This Run is:

> **Question Authoring & Publishing V1**

The successful end state is:

> An authorized OWNER or active INSTRUCTOR can manually create a valid SINGLE_CHOICE or MULTIPLE_CHOICE Question in a Course, associate it with a valid Topic from that same Course, save/edit its draft, explicitly publish it as an immutable QuestionVersion, and later edit/re-publish without changing any historical version or Attempt reference.

This Run MAY include:

- additive Question draft persistence
- Question↔Topic association
- manual authoring API/UI
- server-side validation
- explicit publish
- atomic current-version update
- immutable re-publish
- minimal instructor preview if naturally supported
- migrations/tests required for the above

This Run MUST NOT include:

- Structured Import / JSON / CSV / XLSX
- PDF ingestion
- AI question generation
- learner Progress
- instructor Insights
- confidence capture
- Exam Urgency ranking
- generic LMS features
- production deployment
- hosted Supabase mutation

---

# 4. Carried-Forward Decisions vs. Things S1 Must Confirm

## Accepted from Run 005

- no separate `QuestionDraft` table for V1 unless the repository reveals a hard integrity conflict;
- one active editable draft per Question is sufficient for V1;
- draft state should live on nullable `draft_*` fields on `questions`;
- Topic remains flat and Course-scoped;
- archived Topics are preserved, not hard-deleted;
- authoring uses `canAuthorCourse` policy for Course-content authoring;
- cross-Course identifiers must fail closed without leaking which Course owns an entity.

## Target for Run 006, to be confirmed against current schema

- a Question should be associated with one Topic in the same Course for V1 authoring;
- the DB should enforce same-Course association where practical;
- learner eligibility should continue to be driven by an actual published/current QuestionVersion, not draft existence.

Do not silently place Topic semantics on `question_versions` vs `questions` until S1 determines which location preserves history and current learner behavior correctly.

---

# 5. Session / Context Rule

Run 005 proved that Product Run size and Claude session size are separate concerns.

Run 006 remains one Product Run, but may span more than one Claude session.

A session rollover is allowed only at a SAFE RESUME POINT:

- current Slice complete
- focused commit exists
- required tests complete
- required reviewers complete
- `scratch/development_checkpoint.md` current
- no background task/reviewer pending
- exact next Slice/action recorded

If context is roughly 450k+ and meaningful work remains, prefer a clean rollover.

If rollover is appropriate:

- do not mark Run COMPLETE
- stop with `SESSION_ROLLOVER_READY`
- report current HEAD + next Slice
- do not `/clear` autonomously

---

# S1 — Grounded Question / QuestionVersion Reality Audit

MODE: INVESTIGATE / DESIGN-CONSTRAIN

## Goal

Understand exactly what already exists so Run 006 extends rather than duplicates the learning model.

## Startup context

Read:

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`
- `docs/UNLOCK_ROADMAP.md`
- `scratch/development_checkpoint.md`

This Plan explicitly authorizes a targeted read of:

- `docs/RUNS/2026-09-20-005.md`

only if needed to verify the carried-forward Question-draft decisions above.

Do not read other historical Run Reports.

## Inspect

At minimum:

- initial/current `questions` schema
- `question_versions`
- all QuestionVersion immutability constraints/triggers/policies if any
- `answer_attempts` exact version linkage
- `questions.current_version_id`
- existing question type enum/vocabulary
- current answer option and correct-answer representation
- learner-safe QuestionVersion projection
- Today question loading
- answer grading
- any existing Question repository/application services
- existing transaction / UnitOfWork patterns
- Run-005 Topic schema and authoring guards
- instructor Course page patterns

## Determine explicitly

1. What is already implemented for Question creation/versioning?
2. Which exact `draft_*` columns are required?
3. Where should `topic_id` live:
   - Question,
   - QuestionVersion,
   - or both?
4. What must be historical vs current metadata?
5. How can DB constraints enforce Question/Topic same-Course integrity?
6. What makes a Question learner-eligible today?
7. What exact publish transaction is needed?
8. Which grading validation already exists?
9. Can existing published questions remain fully backward compatible after migration?
10. Does archived Topic behavior need any Question-authoring restriction?

## Compatibility requirement

Existing seeded/published Questions must continue to work after migration without being forced through the new draft UI.

## Exit

Write grounded findings to `scratch/development_checkpoint.md`.

If the existing repository directly conflicts with a carried-forward decision, stop only the dependent work and report `PLAN_CONFLICT`.

No commit required for investigation alone.

---

# S2 — Question Draft + Topic Persistence Foundation

MODE: IMPLEMENT

## Goal

Add the minimum durable persistence/domain layer needed for manual authoring without making draft content learner-visible.

## Expected direction

Unless S1 finds a direct conflict, add additive nullable draft state to `questions`.

Likely conceptual fields:

- `draft_question_type`
- `draft_prompt`
- `draft_answer_options`
- `draft_correct_answer`
- `draft_explanation`
- Topic reference as determined by S1

Exact names/types must follow existing schema conventions.

## Required capabilities

Application/repository support for authorized authoring:

- create draft Question in a Course
- read Question authoring state
- update draft
- list authorable Questions for the Course as required by UI
- distinguish:
  - never-published draft
  - published Question with current version
  - published Question with newer draft edits

## Topic integrity

A Question draft must not reference a Topic from another Course.

Follow Run 005's non-leaking pattern:

- authorize the Course first
- resolve related identifiers after authorization
- wrong-Course Topic must not reveal its true Course

Where practical, add a DB-level same-Course constraint in addition to application checks.

## Existing-content compatibility

Migration must preserve all existing published Question/QuestionVersion behavior.

Do not require draft columns to be populated for historical/published Questions.

## Draft validation

There are two useful levels:

### Save-draft validation

Allow work-in-progress where reasonable, but never accept structurally dangerous/invalid encodings.

### Publish-ready validation

Strict correctness rules belong in S4 publish validation.

Do not make the draft UI unusable by requiring a half-written Question to already be publishable unless the chosen UX explicitly saves only complete drafts.

S1/S2 should make this distinction deliberately rather than accidentally.

## Authorization

Use the existing Run-005 Course-content authoring policy:

- OWNER: allowed when active for authoring
- INSTRUCTOR: allowed when active for authoring
- LEARNER: denied
- revoked/archived authoring membership: fail closed per `canAuthorCourse`

Archived Course authoring should remain non-editable consistent with Run 005's terminal archive semantics.

## Tests

Cover:

- migration/backward compatibility
- draft create/read/update
- existing published Question compatibility
- auth roles
- archived/revoked behavior
- cross-Course Topic rejection
- malformed identifiers
- PGlite repository/constraint behavior

Because schema changes are expected:

`npm run test:schema`

## Review

Required:

- `unlock-db-reviewer`
- `unlock-security-reviewer`
- `unlock-reviewer`

## Exit

Draft persistence is safe, backward-compatible, Course/Topic-scoped, and not learner-eligible by itself.

Focused commit expected.

---

# S3 — Publish-Ready Validation Contract

MODE: IMPLEMENT

## Goal

Create one authoritative validation contract used by publish and reusable by the UI.

Do not duplicate grading rules across client/API/repository layers.

## Supported types

- SINGLE_CHOICE
- MULTIPLE_CHOICE

No free-text grading.

## Publish-ready invariants

Common:

- non-empty prompt
- supported type
- valid same-Course Topic
- meaningful option count
- no empty normalized options
- stable option identifiers/order
- no duplicate option identifiers
- correct-answer references only valid options

SINGLE_CHOICE:

- exactly one correct option

MULTIPLE_CHOICE:

- at least one correct option
- may contain multiple correct options

Preserve the existing answer representation if it is already canonical for learner grading.

Do not invent a second grading vocabulary merely for authoring.

## Tests

Pin all validation behavior at domain/application level.

Include edge cases around:

- duplicate options
- removed option still marked correct
- switching SINGLE ↔ MULTIPLE
- empty/whitespace content
- malformed correct-answer payload
- Topic archived between draft creation and publish, if relevant to the chosen policy

## Review

- `unlock-reviewer`
- `unlock-security-reviewer` if validation crosses trust boundaries

## Exit

There is exactly one server-authoritative publish-ready validation path.

Focused commit expected if implementation is substantial.

---

# S4 — Manual Question Authoring API + UI

MODE: IMPLEMENT

## Goal

Allow a non-developer instructor to create and edit Question drafts through UNLOCK.

## Product surface

Extend the existing:

`/instructor/courses/[courseId]`

Do not create a generic LMS admin product.

A separate Question edit route/page is allowed if it makes the Course page materially simpler.

## Required UX

Instructor can:

- see Questions for the Course
- see Topic association
- see state:
  - Draft
  - Published
  - Published with draft changes, if applicable
- create Question
- choose Topic
- choose SINGLE_CHOICE / MULTIPLE_CHOICE
- enter prompt
- add/edit/remove options
- select correct option(s)
- enter optional explanation if existing QuestionVersion supports it
- save draft
- reopen/edit draft

## Important UX rule

Do not tell the instructor that saved draft changes are live for learners.

Published content and draft edits must be visually distinguishable.

## Archived Course

Do not allow normal authoring controls for terminal ARCHIVED Course.

## Preview

Optional only if cheap and safe.

If added, preview must create:

- no Attempt
- no Today resolution
- no learning evidence
- no mastery/misconception/scheduler change

## API/security

- authenticated identity server-derived
- auth-before-DB
- Course authorization before entity existence leaks
- malformed UUID handling consistent with current routes
- client never supplies authoritative user id

## Tests

Use current route/application/UI conventions.

Full unit suite before commit.

## Review

Required:

- `unlock-reviewer`
- `unlock-security-reviewer`

## Exit

Instructor can manually create and edit Question drafts without SQL/seed scripts.

Focused commit expected.

---

# S5 — Atomic Immutable Publish + Re-publish

MODE: IMPLEMENT

## Goal

Publish a valid draft into the existing immutable QuestionVersion model.

## Core transaction

Publishing must be atomic.

At minimum:

1. authorize actor/Course
2. load authoritative Question draft
3. validate publish-ready state server-side
4. create new immutable QuestionVersion
5. set `questions.current_version_id` to that new version
6. commit

If additional draft-state bookkeeping is needed, keep it in the same transaction where integrity requires it.

A partial failure must not:

- create an orphan current pointer
- leave a current version half-published
- mutate an old QuestionVersion

## First publish

Never-published draft:

- current_version_id is null before publish
- new immutable QuestionVersion created
- current_version_id points to it

## Re-publish

Published Question with edited draft:

- insert a NEW QuestionVersion
- update current_version_id to new version
- old version remains byte-for-byte unchanged
- historical Attempt references remain valid

## Historical integrity

Explicitly prove:

- no update-in-place path exists for published QuestionVersion content
- old Attempt → QuestionVersion linkage survives
- replay remains based on persisted historical Attempt correctness
- learner retrieval resolves current published version
- draft-only Question does not enter learner content/Today merely because it exists

## Topic/history semantics

If S1 decides Topic is versioned historical metadata, publish must snapshot it appropriately.

If Topic is current Question metadata only, document why that does not invalidate historical interpretation.

Do not leave this ambiguous.

## UI

Add explicit Publish / Re-publish action.

Show:

- draft-only
- published
- unpublished changes pending, when applicable

A successful draft save is not a publish.

## Tests

Required:

- first publish
- re-publish
- prior version unchanged
- current pointer updated
- rollback on failure
- invalid draft cannot publish
- unauthorized publish denied
- draft-only learner exclusion
- current published learner retrieval
- historical Attempt reference preserved

Run:

`npm run test:schema`

## Review

Required:

- `unlock-db-reviewer`
- `unlock-security-reviewer`
- `unlock-reviewer`

## Exit

Question authoring reaches immutable learner-ready publication safely.

Focused commit expected.

---

# S6 — Integrated Verification + Run Handoff

MODE: VERIFY

## Goal

Prove Run 006 as one coherent vertical and stop before Structured Import.

## Required local/test walkthrough

authorized instructor
→ open Course
→ choose Topic
→ create SINGLE_CHOICE draft
→ save/edit
→ publish
→ edit again
→ re-publish
→ verify old version unchanged
→ create MULTIPLE_CHOICE
→ verify multi-correct validation
→ publish
→ verify draft-only Question is not learner-eligible
→ verify current published QuestionVersion remains compatible with learner read/grading architecture

Do not manufacture hosted fixtures.

## Final checks

Run as applicable:

- targeted tests
- full unit suite
- schema/Postgres suite
- typecheck
- lint
- `git diff --check`

## Final reviewers

Run:

- `unlock-reviewer`
- `unlock-security-reviewer`
- `unlock-db-reviewer`

Fix meaningful findings.

## DEV_STATUS

Update current truth only:

- manual Question authoring status
- Question↔Topic semantics
- draft/publish semantics
- immutable re-publish semantics
- latest tests
- new migrations and hosted/local status
- Structured Import remains not implemented
- next work requires a new Plan

Also ensure repository-state facts remain current.

## CONTEXT_MAP

Update only if new durable paths should be discoverable.

## Run Report

Create:

`docs/RUNS/2026-09-20-006.md`

Include:

- delivered scope
- grounded S1 findings
- schema/migrations
- draft model
- Topic association model
- validation model
- publish transaction
- immutability proof
- authorization behavior
- tests
- reviewer findings
- local vs hosted boundary
- manual actions
- deferred Run 007 scope
- final Git state
- any session rollover(s)

## Metrics

Record only reliable session/run telemetry.

Do not invent token totals/cost.

## Scope confirmation

Confirm no implementation of:

- Structured Import
- PDF/AI ingestion
- Progress
- Insights
- Exam Urgency ranking
- production deployment

## Completion

Final status:

`COMPLETE`

Do not push.

---

# Definition of Done

Run 006 is COMPLETE only when:

- current-state DEV_STATUS repository facts are reconciled to pushed HEAD `a03efa4` at Run start/current state
- existing published Questions remain backward compatible
- draft state exists without creating a separate QuestionDraft table unless a documented PLAN_CONFLICT required it
- Question↔Topic same-Course integrity is enforced
- authoring authorization reuses the intended Course-content policy
- SINGLE_CHOICE authoring works
- MULTIPLE_CHOICE authoring works
- server-authoritative publish-ready validation exists
- instructor can create/edit drafts through UI
- draft-only Question is not learner-eligible
- saving draft is distinct from publishing
- first publish creates a new immutable QuestionVersion
- re-publish creates another immutable QuestionVersion
- old versions are never rewritten
- historical Attempt→QuestionVersion references remain valid
- publish is atomic
- current learner retrieval uses the intended current published version
- relevant schema/Postgres tests are green
- unit/typecheck/lint/diff checks are green
- reviewers have no unresolved blocker
- `docs/DEV_STATUS.md` reflects current truth
- `docs/RUNS/2026-09-20-006.md` exists
- Structured Import remains deferred to Run 007
- final status is COMPLETE

# UNLOCK — Current Execution Plan

PLAN_VERSION: 001
RUN_ID: 2026-09-20-002
BASE_HEAD: d67371a
RUN_GOAL: Establish a trustworthy demo-ready local vertical slice, verify the two pending DailyPlan migrations are safe to apply remotely, and stop at an explicit hosted-migration/manual-action gate with a precise QA checklist.
EXPECTED_STOP: MANUAL_REMOTE_GATE

---

## Run Intent

This is the first real execution Run under Development OS V1.

The product baseline at `BASE_HEAD` already contains:

- Supabase Auth foundation
- CourseMembership and OPEN-course onboarding
- learner timezone persistence
- DailyPlan persistence and generation
- Today read API
- Today answer submission
- Today Skip
- ADR-017 New Material fallback
- interactive Hebrew/RTL Today UI
- OPEN Course join flow
- local unit and PostgreSQL/PGlite coverage

Two committed migrations are not yet applied to hosted Supabase:

- `20260924000000_daily_plan_answer_attempts.sql`
- `20260925000000_daily_plan_new_material_v1.sql`

This Run must NOT mutate hosted Supabase.

The purpose of this Run is to make the codebase and demo journey as trustworthy as possible locally, then hand Dor a precise manual remote action and hosted QA sequence.

---

## Run-Start Note

`docs/CHATGPT_PLAN.md` replaces the bootstrap Plan after `BASE_HEAD`.

It may therefore appear as an intentional working-tree modification at Run start.

Treat that modification as expected and owned by Dor/ChatGPT.

Do NOT:

- rewrite this Plan
- re-scope it
- stage it into Slice commits
- discard it
- treat it as unrelated dirt

All other unexpected working-tree changes must be diagnosed before implementation.

---

# Global Constraints

## Remote Safety

Do NOT:

- push
- run `supabase link`
- run `supabase db push`
- apply hosted migrations
- mutate hosted Supabase data/schema
- expose or request secrets
- deploy

Remote mutation is a manual Dor action after this Run stops.

Read-only inspection is allowed only when already supported by the repository/tooling and not dependent on new credentials or linking.

---

## Scope Containment

This Run is about:

1. migration readiness,
2. local demo-path verification,
3. narrow demo blockers,
4. handoff quality.

Do not perform opportunistic refactors.

Do not redesign:

- mastery taxonomy
- misconception taxonomy
- FSRS mapping
- ranking calibration
- DailyPlan sizing calibration
- CourseMembership semantics
- revoked-member rejoin behavior
- analytics architecture
- RLS architecture
- multi-Course UX beyond what is required to preserve the current single-Course demo path

If unrelated defects are found:

- record them in the Run Report if useful,
- do not fix them unless they block this Run's accepted demo path or create a security/data-integrity issue.

---

## Product Invariants

Preserve:

- one DailyPlan per learner per learner-local day
- active LEARNER memberships only for automatic DailyPlan participation
- Global Today and Course Today as views of one plan
- persisted learner timezone as local-day source of truth
- same-day plan reuse
- Manual Practice separate from Today
- Manual Practice does not resolve Today
- Skip resolves the item without creating learning evidence
- Skip does not replenish the plan
- Attempts remain immutable
- QuestionVersion remains historical content authority
- Today is frozen by default
- New Material fallback only when ordinary NBA candidate set is empty
- New Material fallback selects at most 3 unseen Questions deterministically
- planning unseen material does not create fake progress/evidence
- OWNER/INSTRUCTOR membership must never be silently downgraded to LEARNER
- AUTHORIZED_ONLY self-join fails closed
- revoked membership is not silently restored

---

# S1 — Pending Hosted Migration Readiness

MODE: INVESTIGATE

## Goal

Determine whether the two committed-but-not-hosted migrations are safe and internally complete for manual hosted application.

Relevant context:

- `docs/DEV_STATUS.md`
- `.claude/rules/postgres.md`
- `.claude/rules/testing.md`
- ADR-016
- ADR-017
- `docs/PERSISTENCE_SCHEMA_V1.md`
- the two pending migration files
- directly related schema/PostgreSQL tests only

## Must

Verify both migrations are:

- forward-only
- chronologically ordered
- additive or otherwise explicitly safe
- compatible with the already-applied hosted migration baseline documented in DEV_STATUS
- independent of uncommitted local schema assumptions
- covered by the real committed migration test harness
- consistent with DailyPlan/Attempt invariants
- free from accidental mutation of accepted historical migrations

For `20260924000000_daily_plan_answer_attempts.sql`, verify especially:

- DailyPlan linkage on Attempt is nullable where intended
- ownership/identity constraints are coherent
- DailyPlan linkage and legacy TodaySession linkage cannot conflict
- deleting a DailyPlan/DailyPlanItem does not destroy immutable Attempt evidence
- idempotency/Attempt immutability remains intact

For `20260925000000_daily_plan_new_material_v1.sql`, verify especially:

- accepted reason/action vocabulary is widened only as required
- existing rows remain valid
- no fake learner evidence/progress is introduced
- ADR-017 fallback semantics are not encoded incorrectly at the schema layer

## Tests

Because this Slice directly depends on migrations/schema:

- run the relevant targeted PostgreSQL/schema tests first
- run `npm run test:schema` once after DB-relevant inspection stabilizes
- if it passes and no DB-relevant file changes afterward, do not rerun it merely for ceremony
- run `git diff --check`

Do not change migrations merely to make tests aesthetically cleaner.

## Review

Required:

- `unlock-db-reviewer`

Use `unlock-security-reviewer` only if the migration review exposes a genuine authorization/trust-boundary issue.

## Exit

S1 is COMPLETE only when:

- migration readiness is explicitly assessed,
- no unresolved DB blocker remains,
- verification level is stated honestly,
- exact manual hosted action is identified for the final handoff,
- no hosted mutation occurred.

If a migration is unsafe:

- classify the problem,
- implement the narrow local forward-only correction if product semantics are already clear,
- add a new migration rather than rewriting accepted migration history,
- rerun DB verification,
- continue only when safe.

If a new product decision is required:

- emit `PLAN_CONFLICT`,
- do not invent it.

---

# S2 — Demo Journey Verification

MODE: IMPLEMENT

## Goal

Verify the current local learner journey as one coherent vertical slice:

`OPEN Course link → authentication/login return → join → Today → answer → feedback → continue → Skip → Done for today`

This Slice is about real product wiring, not isolated helpers.

Relevant context:

- `docs/CONTEXT_MAP.md`
- ADR-015
- ADR-016
- ADR-017
- `.claude/rules/api.md`
- `.claude/rules/auth.md`
- `.claude/rules/learning-engine.md`
- current join/Today routes and UI
- nearest existing tests

## First inspect

Determine whether the repository already has a browser/E2E harness.

If a usable existing harness exists:

- use it.

If no usable browser harness exists:

- do NOT add a heavyweight new E2E framework solely for this Run,
- instead add the smallest meaningful route/application integration coverage needed to protect the demo journey,
- produce a precise manual browser QA script in the Run Report.

## Must verify

### Join path

- public safe Course lookup works for an OPEN Course
- unauthenticated learner can be routed through login and safely returned
- redirect remains local/safe
- authenticated learner can join OPEN Course
- repeated join is idempotent
- OWNER/INSTRUCTOR is not downgraded
- AUTHORIZED_ONLY fails closed
- revoked membership is not silently restored

### Today path

- authenticated active LEARNER can open Today
- learner-local date is derived from persisted timezone
- same-day reopen returns persisted DailyPlan
- safe learner-facing QuestionVersion content is returned
- correct-answer/grading-only data is not leaked before submission
- SINGLE_CHOICE and MULTIPLE_CHOICE selection behavior remains valid where supported

### Answer path

- one submission creates one immutable Attempt
- retry with the same submission identity is idempotent
- answer resolves the intended DailyPlanItem
- feedback maps to the server outcome
- resolved items do not silently reopen

### Skip path

- Skip resolves only the intended DailyPlanItem
- Skip creates no Attempt
- Skip does not mutate mastery/progress
- Skip does not replenish Today

### Completion

- when all items are resolved, Today reaches a real completion state
- no endless auto-generation occurs
- extra/manual practice remains outside the DailyPlan

### New learner / New Material

Where the ordinary NBA candidate set is empty:

- unseen fallback can create a useful DailyPlan
- selection is deterministic
- at most 3 unseen Questions are used
- no fake UserQuestionProgress is created merely by planning

## Tests

Use the narrowest meaningful coverage.

Expected baseline:

- targeted tests during implementation
- full unit suite
- typecheck
- lint
- `git diff --check`

Do NOT rerun `test:schema` in this Slice unless DB-relevant code changes after S1.

## Review

Risk-based:

- `unlock-security-reviewer` if auth/join/redirect/ownership code changes
- `unlock-db-reviewer` if persistence/transaction/schema code changes
- `unlock-reviewer` for the completed vertical-slice change if implementation is non-trivial

## Exit

The local demo journey is either:

- verified and protected by appropriate tests, or
- blocked by a concrete defect that is carried into S3.

Do not claim browser E2E if no real browser E2E occurred.

Commit focused changes for this Slice.

---

# S3 — Narrow Demo Blocker Hardening

MODE: IMPLEMENT

## Goal

Fix only defects discovered during S2 that materially block or undermine the learner demo journey.

This is not a general cleanup Slice.

## Allowed examples

- broken join → login → return behavior
- learner-facing data leakage
- incorrect DailyPlan item progression
- retry/idempotency breakage
- Skip incorrectly creating evidence
- completion state not reachable
- Hebrew/RTL issue that makes the demo unusable
- loading/error state that traps the learner
- route error mapping that breaks the intended journey
- malformed state that causes the accepted demo path to crash

## Explicitly out of scope unless it blocks the journey

- broad UI redesign
- design-system work
- generalized error-framework refactor
- malformed/non-UUID route handling pattern-wide cleanup
- analytics
- rate limiting
- RLS redesign
- revoked-member rejoin semantics
- Learning Engine calibration
- multi-Course Global Today polish
- unrelated tech debt

## Tests

For every real bug fixed:

- add the narrowest regression test that would have failed before the fix.

Then run:

- affected targeted tests
- full unit suite
- typecheck
- lint
- `git diff --check`

Run `test:schema` only if this Slice actually changes DB-relevant behavior after S1.

## Review

Choose reviewers by actual diff risk.

A security/data-integrity defect requires the corresponding specialist reviewer.

A non-trivial completed Slice should receive `unlock-reviewer`.

## Exit

- all demo-blocking local defects discovered in S2 are resolved,
- no unrelated scope expansion occurred,
- focused commit exists,
- current DEV_STATUS reflects durable reality only.

---

# S4 — Release Gate and Handoff

MODE: IMPLEMENT

## Goal

Produce a precise, honest handoff for Dor to perform the remote step and then hosted QA.

No hosted mutation occurs in this Slice.

## Must

Update `docs/DEV_STATUS.md` with current reality only.

Create:

`docs/RUNS/2026-09-20-002.md`

The Run Report must include:

- PLAN_VERSION
- BASE_HEAD
- END_HEAD
- completed Slices
- commits
- tests
- reviewer outcomes
- discoveries
- blockers
- manual actions
- hosted verification still pending
- recommended next Run

## Manual Remote Action Section

Provide Dor with the exact safest sequence needed to:

1. confirm local branch is clean and pushed when Dor chooses,
2. apply the pending hosted Supabase migrations manually,
3. confirm migration application,
4. perform hosted browser QA.

Do not request secrets.

Do not perform the remote action.

## Hosted QA Checklist

Prepare a concise manual checklist covering at least:

- existing learner login
- OPEN Course join
- join retry
- redirect back to intended local path
- Today first open
- same-day reopen
- answer one item
- refresh/retry safety
- Skip one item
- completion
- New Material path for a learner with no ordinary NBA candidates
- confirmation that Attempts/progress appear only when real answers occur
- confirmation that Skip does not create learning evidence

Clearly separate:

- locally verified
- PGlite/PostgreSQL verified
- hosted verification still required

## Final Verification

Run the checkpoint skill.

Expected final checks:

- relevant targeted tests
- full unit suite
- typecheck
- lint
- `git diff --check`
- schema result from S1 may be reused if no DB-relevant code changed afterward

Use `unlock-reviewer` for final non-trivial Run review.

## Exit

The Run stops at:

`MANUAL_REMOTE_GATE`

The handoff must make it possible for Dor to perform the remote migration/application step without guessing.

Nothing is pushed by Claude.

---

# Definition of Done for This Run

The Run is complete only when:

- pending hosted migrations have been reviewed as safe or corrected safely,
- local demo journey has been verified coherently,
- demo-blocking local defects discovered during the Run are fixed,
- appropriate regression coverage exists,
- required reviewers have no unresolved BLOCKER,
- checkpoint is clean,
- DEV_STATUS is current,
- `docs/RUNS/2026-09-20-002.md` exists,
- working tree is clean except for the intentionally user-owned `docs/CHATGPT_PLAN.md` replacement if it remains uncommitted,
- no hosted mutation occurred,
- Dor has an explicit remote migration + hosted QA handoff.

---

# Expected Next Run

Do not execute this section during the current Run.

After Dor manually applies the hosted migrations, the next Run should focus on:

- real hosted Supabase verification,
- browser QA against hosted data/auth,
- fixing only real-environment defects,
- demo polish and final Ruppin readiness.

The next Run must receive a new `CHATGPT_PLAN.md` from Dor/ChatGPT.

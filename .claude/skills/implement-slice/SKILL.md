---
name: implement-slice
description: Implement one focused UNLOCK Slice from the current CHATGPT_PLAN. Reconstructs the minimum Run context, validates repository state and BASE_HEAD assumptions, loads only relevant context, implements the smallest correct change, verifies it, uses risk-based reviewers when required, updates durable status/reporting, creates a focused commit when the Slice Definition of Done requires it, and never pushes.
---

# /implement-slice

Use this skill to implement one focused development Slice from the current UNLOCK Run.

Do not assume prior chat context.

Do not infer work from historical Runs.

Do not push.

---

## Step 1 — Load HOT Context

Read:

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

Determine from the current Plan:

- PLAN_VERSION
- RUN_ID
- BASE_HEAD
- RUN_GOAL
- current Slice
- Slice MODE
- Slice goal
- relevant context
- Must
- Do not
- Tests
- Review
- Exit criteria
- expected Run stop

Current execution comes only from `docs/CHATGPT_PLAN.md`.

DEV_STATUS describes current reality.

It does not define the next task.

---

## Step 2 — Validate Repository State

Run the minimum necessary commands such as:

- `git status`
- `git status -sb`
- `git log --oneline -5`

Determine:

- current branch
- current HEAD
- ahead/behind state
- staged/unstaged/untracked files
- whether repository state matches one of the two valid Run-start states
  defined in `CLAUDE.md` Section 1 (BASE_HEAD Semantics)

`HEAD == BASE_HEAD` with only `docs/CHATGPT_PLAN.md` uncommitted (State A) is
the expected default. It is not unexplained dirty state.

If HEAD differs from BASE_HEAD because earlier Slices in the same Run created
expected focused commits, that is normal.

If HEAD differs for an unexplained reason, or matches neither valid Run-start
state:

- investigate before editing
- do not reset
- do not overwrite work
- report `PLAN_CONFLICT` if the Plan assumptions are no longer valid

Do not modify anything yet.

---

## Step 3 — Identify the Current Slice

Execute only the earliest incomplete Slice whose prerequisites are satisfied.

Do not:

- skip ahead because a later Slice looks easier
- repeat an already-completed Slice
- infer new work from DEV_STATUS
- automatically consume historical Run Reports

If the Plan marks the current Slice:

`MODE: INVESTIGATE`

perform investigation only.

Do not change production code unless the Plan explicitly allows it.

If the Slice is:

`MODE: IMPLEMENT`

continue with implementation.

---

## Step 4 — Load Minimum Relevant Context

Use `docs/CONTEXT_MAP.md` only as a GPS.

Load only what the current Slice requires.

Potential context includes:

- specific accepted ADR
- specific Open Question
- relevant `.claude/rules/*`
- relevant tests
- relevant application/domain/infrastructure code
- MASTER_SPEC only when product-level intent is actually needed

Do NOT read/search/summarize:

`docs/RUNS/**`

unless the Plan names an exact Run or the user explicitly authorizes it.

Do not reconstruct the whole project history.

---

## Step 5 — Confirm Slice Boundaries

Before editing, establish:

- exact goal
- acceptance criteria
- likely code areas
- invariants that must remain unchanged
- explicit non-goals
- whether DB/auth/security/Learning Engine boundaries are involved
- required reviewers
- required verification

Use Guided Search:

the Plan may point to likely areas/files, but verify repository reality rather than blindly assuming paths are still correct.

---

## Step 6 — Handle Plan Conflict Correctly

If repository reality contradicts the Plan:

### Adapt Minimally

If the same accepted intent can be achieved safely without a new product/architecture decision:

- adapt the implementation minimally
- document the discovery

### PLAN_CONFLICT

If the discrepancy requires:

- a new product decision
- a new architecture decision
- invalidation of later Slice assumptions
- unsafe expansion of scope

report:

`PLAN_CONFLICT`

Block the dependent work.

Continue independent Plan work only when doing so is clearly safe.

Do not invent the missing decision.

---

## Step 7 — Implement the Smallest Correct Change

Make only the changes required to satisfy the Slice.

Do not:

- perform Boy Scout refactors
- rename unrelated domain concepts
- migrate unrelated enums
- change calibration without authorization
- rewrite repositories for convenience
- add dependencies without concrete need
- fix unrelated cosmetic issues
- opportunistically redesign architecture

Preserve:

- domain/application boundaries
- trusted identity boundaries
- transaction semantics
- immutable evidence
- deterministic Learning Engine behavior
- accepted product decisions

If an unrelated issue is discovered:

- blocking correctness/security issue → fix the minimum required
- non-blocking issue → record it in the Run Report / handoff, not by expanding scope

Do not automatically add every discovery to OPEN_QUESTIONS.

---

## Step 8 — Add Meaningful Tests

Add the narrowest tests that protect the new or corrected behavior.

Prefer tests that would fail without the intended change.

When relevant, test:

- negative paths
- ordering
- ownership
- authorization
- trust boundaries
- transaction rollback
- persistence constraints
- explicit time propagation
- idempotency
- error leakage
- Manual Practice / Today separation
- deterministic Learning Engine behavior

Do not add tests merely to increase counts.

---

## Step 9 — Targeted Verification

Run the narrowest relevant checks during implementation.

Examples:

- focused Vitest file/directory
- focused PGlite test
- typecheck
- lint

Fix only:

- issues caused by the Slice
- issues that block Slice correctness/safety

Do not silently fix unrelated repository problems.

---

## Step 10 — Risk-Based Review

Use the Plan's `Review:` field and actual changed paths.

Reviewer selection:

- general application / architecture / major Slice:
  - `unlock-reviewer`

- migrations / SQL / repositories / transactions / UnitOfWork:
  - `unlock-db-reviewer`

- auth / authorization / API trust / secrets / sensitive ordering:
  - `unlock-security-reviewer`

Do not invoke every reviewer automatically.

Reviewer findings must be addressed before completion when they are BLOCKER or required CORRECTION.

After changes made in response to review:

- rerun affected targeted tests
- rerun broader verification when required

---

## Step 11 — Full Checkpoint

Invoke the `checkpoint` skill in the same session context.

Do not run it as an isolated subagent.

Checkpoint remains read-only.

If checkpoint reports:

`NOT READY`

do not commit.

Fix only current-Slice blockers, then re-check as needed.

---

## Step 12 — Update Durable Current State

After the Slice is actually complete:

update `docs/DEV_STATUS.md` only when durable current reality changed.

Examples:

- new capability became implemented
- migration state changed
- test baseline changed
- known gap was closed
- new durable limitation appeared

DEV_STATUS must remain a concise current snapshot.

Do not add Slice history or a mini Run Report there.

---

## Step 13 — Update Current Run Report

Maintain the current Run Report under:

`docs/RUNS/<RUN_ID>.md`

Only the current Run Report may be written during the Run.

Do not read historical Run Reports.

Record concise information such as:

- Slice status
- commit
- tests
- reviewer
- discoveries
- blockers
- manual actions

The Run Report should explain execution history without duplicating Git diffs.

---

## Step 14 — Commit the Completed Slice

UNLOCK's default Slice Definition of Done includes a focused commit.

After:

- implementation complete
- required tests pass
- checkpoint passes
- required reviewer findings are addressed
- DEV_STATUS is current where needed
- current Run Report is updated

create one focused commit for the Slice.

Before committing:

- stage only intended files
- inspect staged diff
- ensure no secrets / `.env` / scratch / unrelated artifacts are staged
- use a concise imperative commit message unless the Plan specifies one

Do not push.

If the Plan explicitly says a Slice must remain uncommitted, obey the Plan.

---

## Step 15 — Continue or Stop

After the focused commit:

- mark the Slice complete in the current Run Report
- inspect the next Slice in CHATGPT_PLAN

Continue autonomously when:

- the next Slice is independent or its prerequisites are now satisfied
- no user/manual action is required
- no PLAN_CONFLICT exists
- the Run has not reached EXPECTED_STOP

Stop when:

- EXPECTED_STOP is reached
- a manual remote action is required
- a product decision is required
- a blocking Plan conflict exists
- repository safety requires user involvement

Do not push at Run end.

---

## Step 16 — Final Run Handoff

At the end of the Run, report:

### Run

- RUN_ID
- PLAN_VERSION
- BASE_HEAD
- END_HEAD
- status

### Completed Slices

For each:

- status
- commit
- essential verification
- reviewer used if any

### Blocked / Deferred

State anything not completed and why.

### Discoveries

Only material findings.

### Decisions Needed

List unresolved decisions requiring user/ChatGPT input.

### Verification

State exact verification levels:

- unit
- schema/Postgres
- typecheck
- lint
- build if run
- hosted/manual verification if actually performed

### Pending Manual Actions

Examples:

- remote migrations
- hosted QA
- push

### Git State

Report:

- branch
- HEAD
- ahead/behind
- worktree state

### Push

Always state:

`Nothing pushed.`

unless repository policy has explicitly changed and the user directly authorized a push.

---

## Final Rules

- CHATGPT_PLAN defines current work.
- DEV_STATUS defines current reality.
- One Slice at a time.
- Commit completed Slices as focused commits.
- Do not push.
- Do not invent product decisions.
- Do not expand scope unnecessarily.
- Do not read historical Runs.
- Do not use destructive Git commands.
- Do not delete unknown files.
- Do not overstate verification.
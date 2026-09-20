---
name: checkpoint
description: Run UNLOCK's standard read-only verification for the current Slice or repository state. Checks git state, required tests, typecheck, lint, architectural boundaries, Plan alignment, diff cleanliness, and reports what is actually verified. Never stages, commits, pushes, modifies code, or auto-fixes failures.
---

# /checkpoint

Standard UNLOCK verification checkpoint.

This skill is strictly READ-ONLY.

It must never:

- modify code
- modify documentation
- auto-fix failures
- stage files
- commit
- push
- reset
- clean
- delete files

Its job is to verify the current repository state and report whether the work is ready for the next step.

---

## Step 1 — Establish Current Run Context

Normally the current session already has the HOT context:

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

Re-read only when:

- checkpoint is invoked standalone
- checkpoint is invoked after `/clear`
- one of those files changed
- the current Run/Slice context is uncertain

Determine:

- PLAN_VERSION
- RUN_ID
- BASE_HEAD
- current Slice
- current Slice acceptance criteria
- required verification
- required reviewers
- expected stop condition

Do not infer the active Slice from DEV_STATUS.

Current execution comes from `docs/CHATGPT_PLAN.md`.

---

## Step 2 — Establish Repository State

If repository state is already fresh and unchanged, do not rerun equivalent commands unnecessarily.

Otherwise use the minimum necessary from:

- `git status`
- `git status -sb`
- `git log --oneline -5`
- `git diff --stat`
- `git diff --check`

Determine:

- current branch
- current HEAD
- ahead/behind state
- staged files
- unstaged files
- untracked files
- whether current HEAD is compatible with the Run's expected state
- whether unexpected files exist

Do not touch unexpected files.

---

## Step 3 — Plan Alignment

Compare the current worktree / commits with the current Slice in `docs/CHATGPT_PLAN.md`.

Verify:

- work matches the Slice goal
- acceptance criteria appear satisfied
- explicit non-goals were respected
- unrelated refactors were not added
- no new product decision was silently invented
- no later Slice was pulled forward unnecessarily

If repository reality contradicts the Plan, report:

`PLAN_CONFLICT`

Do not modify the Plan.

---

## Step 4 — Architectural Boundary Check

Inspect changed paths first.

Verify relevant architecture boundaries.

At minimum, ensure no unexpected infrastructure/runtime imports crossed into:

- `src/domain/`
- `src/application/`

Potential suspicious dependencies include:

- `pg`
- PostgreSQL infrastructure
- `@electric-sql/pglite`
- `@supabase/`
- `next/`
- browser/UI-specific modules

Flag only genuine violations.

Do not flag documented exceptions or intentional type-only references without checking context.

---

## Step 5 — Temporary / Accidental File Check

Treat:

`scratch/**`

as temporary, non-canonical run state unless the current Plan explicitly says otherwise.

Flag if scratch content is staged unexpectedly.

Also report unexpected:

- `.env*` secrets/config files
- zip archives
- generated reports
- exported artifacts
- temporary Supabase state
- unrelated local files

Do not delete, ignore, stage, or modify them automatically.

---

## Step 6 — Verification Commands

Run:

`npm run typecheck`

`npm run lint`

`npm test`

`git diff --check`

Run:

`npm run test:schema`

only when the current Slice changes or directly depends on:

- migrations
- database schema
- SQL
- PostgreSQL repositories
- row mappers / serialization
- persistence constraints
- transactions
- UnitOfWork
- other database-specific integration behavior

Full policy:

`.claude/rules/testing.md`

If `test:schema` already passed earlier in the same Slice and no DB-relevant work changed afterward:

- do not rerun it
- report the earlier result

If the current Plan requires additional verification, run it.

If one command fails, continue only when doing so is safe and useful for diagnosis.

Do not auto-fix.

---

## Step 7 — Interpret Failures

For every failure, determine whether it appears to be:

- production defect
- test defect
- environment/configuration issue
- unrelated known flaky behavior
- unclear and requiring investigation

Known diagnostic clue:

Canonical Attempt replay ordering has historically been timing-sensitive when multiple rows receive identical ordering timestamps and ordering falls back to random UUID `id`.

If that failure appears:

- inspect it
- do not assume current work caused it
- do not ignore it
- report the uncertainty accurately

Never weaken tests merely to produce a green checkpoint.

---

## Step 8 — Verification Honesty

Distinguish clearly between:

- unit-tested
- route-wiring tested
- PGlite integration-tested
- reviewed by inspection
- reasoned under PostgreSQL semantics
- real PostgreSQL tested
- real Supabase tested
- browser E2E tested

PGlite does NOT prove:

- real multi-connection PostgreSQL concurrency
- real Supabase Auth behavior
- GoTrue signup behavior
- browser cookie/session behavior
- deployed network behavior

Do not overstate verification.

---

## Step 9 — DEV_STATUS Consistency

Compare durable repository reality against `docs/DEV_STATUS.md`.

DEV_STATUS should describe what is currently true, not the active task.

Check whether:

- newly completed durable capability should eventually be reflected there
- existing capability statements are now stale
- migration state changed
- verification baseline changed
- known gaps were closed or introduced

Do not edit DEV_STATUS inside this read-only skill.

Report required status updates to the implementation workflow.

---

## Step 10 — Report Format

Return exactly these sections:

### Plan / Slice

Report:

- PLAN_VERSION
- RUN_ID
- current Slice
- Slice goal
- Plan alignment: aligned / PLAN_CONFLICT

### Branch + HEAD

Report:

- branch
- short SHA
- ahead/behind origin
- relationship to BASE_HEAD where relevant

### Git State

Summarize:

- staged
- unstaged
- untracked
- unexpected files

### Tests

Report:

- targeted tests already run if relevant
- `npm test` pass/total
- `npm run test:schema` pass/total if run
- or why `test:schema` was legitimately not run

### Typecheck / Lint

Report:

- clean

or the first relevant errors.

### Diff Integrity

Report:

- `git diff --stat`
- `git diff --check`

### Architecture Boundary Check

State whether any relevant boundary violation was found.

### Verification Level

State exactly what has actually been verified.

### DEV_STATUS Consistency

State whether DEV_STATUS remains accurate and what will need updating outside this read-only checkpoint.

### Blockers Before Next Step

List blockers.

If none:

`None.`

### Checkpoint Verdict

Choose exactly one:

- `READY FOR REVIEW`
- `READY FOR COMMIT`
- `READY FOR HANDOFF`
- `NOT READY`

Use the strongest status justified by the actual Slice state.

Do not commit or push.

---

## Final Rules

- Read-only means read-only.
- Current work comes from `CHATGPT_PLAN`, not DEV_STATUS.
- Do not modify the Plan.
- Do not modify DEV_STATUS.
- Do not stage.
- Do not commit.
- Do not push.
- Do not auto-fix.
- Do not delete unknown files.
- Do not use destructive Git commands.
- Report facts, not assumptions.
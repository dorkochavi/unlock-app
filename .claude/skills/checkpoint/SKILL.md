---
name: checkpoint
description: Run UNLOCK's standard read-only verification before commit, push, or handoff. Checks git state, tests, typecheck, lint, architectural boundaries, diff cleanliness, and reports what is actually verified. Never stages, commits, pushes, modifies code, or auto-fixes failures.
---

# /checkpoint

Standard UNLOCK verification checkpoint.

This skill is strictly READ-ONLY.

It must never:
- modify code
- auto-fix failures
- stage files
- commit
- push
- reset
- clean
- delete files

Its job is to verify the current repository state and report whether the work is ready for the next step.

## Step 1 — Read current project state

`CLAUDE.md` and `docs/DEV_STATUS.md` are normally already in context from the current session.

Re-read them only when:

- checkpoint is invoked standalone
- checkpoint is invoked after `/clear`
- there is reason to believe either file changed during the current session
- their current contents are otherwise not available in context

Repository state may also already have been inspected immediately before this skill was invoked.

If the current git state is already known and the working tree has not changed since that inspection, do not repeat equivalent repository-state commands unnecessarily.

Otherwise, run only what is needed from:

- `git status`
- `git status -sb`
- `git log --oneline -5`
- `git diff --stat`
- `git diff --check`

Before continuing, ensure you can determine:

- current branch
- current HEAD
- ahead/behind state
- staged files
- unstaged files
- untracked files
- whether any files appear unrelated to the active task

If any of that information is missing or may be stale, run the minimum necessary command to establish it.

Do not touch unexpected files.

## Step 2 — Architectural boundary checks

Verify there are no unexpected infrastructure imports inside:

- `src/domain/`
- `src/application/`

Search for imports/references involving:

- `pg`
- `postgres`
- `@electric-sql/pglite`
- `@supabase/`
- `next/`
- browser/UI-specific modules

Flag only genuine dependency-boundary violations.

Do not flag intentional type-only references or documented exceptions without checking context.

## Step 3 — Temporary / accidental file check

Treat files under:

- `scratch/**`

as temporary, non-canonical development artifacts unless the active task explicitly involves them.

Flag if any `scratch/**` file is staged or about to be committed unexpectedly.

Also report any unexpected:

- zip files
- exported reports
- scratch files outside the intended location
- generated artifacts
- local environment files

Do not delete, ignore, stage, or modify them automatically.

## Step 4 — Verification commands

Run:

`npm run typecheck`

`npm run lint`

`npm test`

`npm run test:schema`

`git diff --check`

If one command fails, continue only when it is safe and useful to gather the remaining diagnostic information.

Do not auto-fix.

## Step 5 — Interpret failures carefully

For every failure, determine whether it appears to be:

- production defect
- test defect
- environment/configuration issue
- unrelated known flaky behavior
- unclear and requiring investigation

Known diagnostic clue:

Canonical Attempt replay ordering has historically been timing-sensitive when multiple rows receive the same `created_at` timestamp and ordering falls back to random UUID `id`.

If that specific failure appears:

- inspect it
- do not assume the current change caused it
- do not ignore it
- report it as a known diagnostic possibility

Never weaken tests merely to make the suite green.

## Step 6 — Verification honesty

Distinguish clearly between:

- unit-tested
- PGlite integration-tested
- reviewed by inspection
- reasoned under PostgreSQL semantics
- real PostgreSQL tested
- real Supabase tested
- browser E2E tested

Do not use vague phrases such as:

- "fully tested"
- "production verified"
- "end-to-end verified"

unless that is literally true.

PGlite does NOT prove:

- real multi-connection PostgreSQL concurrency
- real Supabase Auth behavior
- GoTrue signup behavior
- browser cookie/session behavior
- deployed network behavior

## Step 7 — Active-task consistency

Compare the current git diff/state against `docs/DEV_STATUS.md`.

Check:

- does the current work match the stated active issue?
- are unrelated product/domain changes mixed into the slice?
- does the current test baseline still make sense?
- has an already-resolved issue remained incorrectly marked as active?

Do not modify `DEV_STATUS.md`.
Only report inconsistencies.

## Step 8 — Report format

Return exactly these sections:

### Branch + HEAD

Report:
- branch name
- short SHA
- ahead/behind origin

### Git state

Summarize:
- staged
- unstaged
- untracked
- unexpected files

### Tests

Report:
- `npm test` pass/total
- `npm run test:schema` pass/total

### Typecheck / Lint

Report:
- clean
or
- first relevant errors

### Diff integrity

Report:
- `git diff --stat`
- `git diff --check`

### Architecture boundary check

State whether any unexpected infrastructure dependency crossed into domain/application code.

### Verification level

Explicitly state what has actually been verified, for example:

- unit-tested
- PGlite integration-tested
- not yet real-Supabase tested
- not yet browser E2E tested

### DEV_STATUS consistency

State whether the repository state matches the active development status document.

### Blockers before next step

List blockers, or:

`None.`

### Checkpoint verdict

Choose exactly one:

- `READY FOR COMMIT`
- `READY FOR REVIEW`
- `READY FOR PUSH`
- `NOT READY`

Choose the strongest status actually justified by the current state.

Do not commit or push.

## Final rules

- Read-only means read-only.
- Do not stage.
- Do not commit.
- Do not push.
- Do not modify files.
- Do not auto-fix.
- Do not delete unknown files.
- Do not use destructive git commands.
- Report facts, not assumptions.
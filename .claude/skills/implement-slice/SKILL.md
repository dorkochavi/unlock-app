---
name: implement-slice
description: Start and implement one focused UNLOCK development slice from the current repository state. Reads DEV_STATUS, inspects git state and relevant code, plans the smallest correct change, implements it, runs targeted verification, and stops before push.
---

# /implement-slice

Use this skill to implement one focused development slice in UNLOCK.

Do not assume prior chat context.

Do not push.

## Step 1 — Reconstruct current state

Read:

- `CLAUDE.md`
- `docs/DEV_STATUS.md`

Then run:

- `git status`
- `git status -sb`
- `git log --oneline -5`

Determine:

- current branch
- current HEAD
- ahead/behind state
- staged/unstaged/untracked files
- current active issue
- next intended development action

Do not modify anything yet.

## Step 2 — Read only relevant context

Inspect only the code/docs/rules needed for the current slice.

Use:

- relevant `.claude/rules/*`
- relevant ADRs
- relevant tests
- relevant application/infrastructure code

Do not read unrelated historical reports.

Do not reconstruct the entire project history.

## Step 3 — Confirm slice boundaries

Before editing, state briefly:

- exact goal
- files likely to change
- invariants that must remain unchanged
- known non-goals
- whether schema/database/auth/security boundaries are involved

If the requested task conflicts with accepted product decisions or current repository state, stop and report the conflict.

Do not invent missing product decisions.

## Step 4 — Plan the smallest correct change

Prefer the smallest implementation that fully satisfies the slice.

Do not:

- refactor unrelated code
- rename unrelated domain concepts
- migrate unrelated enums
- change learning calibration
- add abstraction layers without concrete need
- rewrite repositories merely for convenience
- add dependencies unless required

If a smaller safe change exists, prefer it.

## Step 5 — Implement

Make the required edits.

While implementing:

- preserve architecture boundaries
- preserve trusted identity boundaries
- preserve transaction semantics
- preserve deterministic learning behavior
- preserve existing product decisions

If a new issue is discovered:

1. determine whether it blocks the slice
2. if blocking, fix only the minimum necessary
3. if non-blocking, report it instead of expanding scope

## Step 6 — Add meaningful tests

Add the narrowest tests that protect the behavior introduced or fixed.

Prefer regression tests that would fail before the change.

Do not add tests merely to increase coverage/count.

When relevant, test:

- negative paths
- ordering
- trust boundaries
- transaction rollback
- persistence constraints
- explicit time propagation
- error leakage

## Step 7 — Targeted verification

Before full verification, run targeted checks for the changed area.

Examples:

- specific Vitest directory/file
- specific schema/Postgres test
- typecheck
- lint

Fix only issues caused by or blocking the current slice.

Do not auto-fix unrelated repository problems silently.

## Step 8 — Full checkpoint

When implementation is ready, run:

`Invoke the checkpoint skill via the Skill tool in the same session context, not as an isolated subagent.`

If checkpoint reports a blocker:

- do not commit
- report the blocker
- stop unless the user explicitly asks to continue fixing

## Step 9 — Commit behavior

Only commit if the current task explicitly asks for a commit.

If committing:

- stage only intended files
- inspect staged diff
- use the requested commit message if provided
- otherwise use a concise imperative commit message
- do not push

If commit was not explicitly requested:

- leave changes uncommitted
- report readiness

## Step 10 — Final report

Return:

### Slice completed

Briefly state what changed.

### Files changed

List the relevant files.

### Tests added/changed

State what behavior they protect.

### Verification

State:
- targeted tests
- checkpoint result
- unit/schema totals if run

### Architecture / security impact

State whether:
- auth boundary changed
- database/schema changed
- learning semantics changed

If none, say so.

### Git state

Report:
- branch
- HEAD
- ahead/behind
- staged/unstaged/untracked
- commit hash if one was created

### Push

State:

`Nothing pushed.`

unless explicitly instructed otherwise.

## Final rules

- One slice at a time.
- Do not expand scope unnecessarily.
- Do not invent product decisions.
- Do not push.
- Do not use destructive git commands.
- Do not delete unknown files.
- Do not claim verification beyond the environment actually used.
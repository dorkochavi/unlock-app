---
name: review-commit
description: Run a read-only adversarial review of an UNLOCK commit or current diff using the appropriate reviewer agent. Finds blockers, corrections, architecture/security issues, test gaps, and produces a safe-to-push verdict. Never modifies, stages, commits, or pushes.
---

# /review-commit

Read-only review workflow for UNLOCK.

Use this skill after an implementation commit exists and before deciding whether it is safe to push.

This skill must never:

- modify code
- edit documentation
- stage files
- commit
- push
- reset
- clean
- delete files
- auto-fix findings

Its job is to review the actual code and return a decision.

## Step 1 — Establish repository state

Read:

- `CLAUDE.md`
- `docs/DEV_STATUS.md`

Then run:

- `git status`
- `git status -sb`
- `git log --oneline -5`

Identify:

- current branch
- current HEAD
- ahead/behind status
- staged changes
- unstaged changes
- untracked files
- whether the requested commit exists locally

Do not touch unexpected files.

## Step 2 — Determine review target

If the user supplied a commit SHA or ref:

- review that exact commit

Prefer:

`git show --stat <commit>`

`git show --format=fuller <commit>`

`git diff <commit>^ <commit> --`

If no commit was supplied:

- review the current uncommitted diff
- state clearly that the review target is the worktree rather than a commit

Never guess which commit the user intended when multiple local commits could reasonably be the target.

## Step 3 — Inspect changed paths

Identify the files changed by the target.

Use the changed paths to determine which reviewer is appropriate.

### General reviewer

Use:

`Invoke via the Agent tool with subagent_type: unlock-reviewer`

for:

- general application logic
- architecture
- cross-layer changes
- DailyPlan/application behavior
- testing/documentation review
- mixed commits

### Database reviewer

Also use:

`Invoke via the Agent tool with subagent_type: unlock-db-reviewer`

when the change touches or materially depends on:

- `supabase/migrations/**`
- PostgreSQL repositories
- UnitOfWork
- transaction logic
- `pg.Pool`
- `ConnectionProvider`
- constraints
- triggers
- SECURITY DEFINER functions
- database concurrency
- Supabase-managed database schemas

### Security reviewer

Also use:

`Invoke via the Agent tool with subagent_type: unlock-security-reviewer`

when the change touches or materially depends on:

- Supabase Auth
- API authentication
- authorization
- cookies/session handling
- user identity
- server/client boundaries
- environment secrets
- service-role credentials
- API error leakage
- security-sensitive execution ordering

Do not invoke every specialist automatically.

Use only the reviewer agents relevant to the actual change.

## Step 4 — Reviewer independence

Reviewer agents must inspect the real code themselves.

Do not give them a conclusion such as:

- "this is probably safe"
- "the implementation is correct"
- "tests already prove it"

Give them:

- the commit/ref
- the intended slice
- the relevant known invariant or bug being addressed

Then let the reviewer determine the result independently.

Do not ask the implementation author to merely justify their own code.

## Step 5 — Mandatory review questions

Regardless of reviewer type, determine:

- Does the implementation actually satisfy the task?
- Does runtime control flow match the documented behavior?
- Are trust boundaries preserved?
- Are application/domain boundaries preserved?
- Are there hidden environment assumptions?
- Are failure paths controlled?
- Are tests meaningful?
- Would the tests fail if the discovered bug/regression existed?
- Are docs accurate?
- Did the change introduce unrelated scope?
- Is anything claimed as verified that is only mocked/reasoned?

## Step 6 — Test evidence

Review the tests associated with the change.

Do not stop at test counts.

Check:

- what behavior each important test proves
- whether important runtime wiring is tested
- whether ordering matters
- whether negative paths exist
- whether mocks hide the production problem
- whether PGlite is being overstated
- whether real Supabase/Postgres/browser validation remains pending

Use existing test results where available.

Running a focused read-only test command is allowed if it materially improves the review.

Do not modify tests.

## Step 7 — Security-sensitive ordering

Whenever a route or protected operation is reviewed, trace the real execution order.

Examples:

- authentication before database construction
- authorization before mutation
- validation before persistence
- transaction start before atomic writes

Do not assume helper correctness guarantees correct orchestration.

## Step 8 — Database-sensitive review

When database code is involved, verify:

- migration history remains forward-only
- constraints preserve invariants
- all atomic repositories use the same transaction-bound connection
- rollback preserves the original error
- connection acquisition/release is correct
- race/concurrency claims match the environment that actually tested them
- Supabase-managed schemas are not recreated in production migrations

Distinguish real PostgreSQL behavior from PGlite approximations.

## Step 9 — Security-sensitive review

When Auth/API security is involved, verify:

- trusted `userId` comes only from server-verified auth
- `auth.getUser()` is the authorization identity source
- client input cannot override identity
- secrets remain server-only
- service-role credentials are not exposed or unnecessarily used
- unexpected errors do not leak sensitive details
- unauthenticated callers do not reach privileged/database work unnecessarily

## Step 10 — Documentation accuracy

Review changed docs against actual code.

Flag documentation that:

- points to the wrong section
- claims behavior that runtime ordering does not guarantee
- says "implemented" when only drafted
- says "verified" when only unit-tested
- says "end-to-end" when no real environment was used

## Step 11 — Combine reviewer findings

If multiple reviewer agents were used:

- merge duplicate findings
- preserve the strongest justified severity
- do not inflate severity merely because two reviewers mentioned the same issue
- resolve contradictions by checking the code directly

Final severity categories:

### BLOCKER

Must be fixed before push.

Examples:

- trust-boundary violation
- data-integrity risk
- incorrect runtime behavior
- migration failure
- secret leakage
- transaction breakage
- accepted product invariant regression

### CORRECTION

Worth fixing before push but not necessarily catastrophic.

Examples:

- important missing regression test
- misleading documentation
- fragile wiring
- uncontrolled but non-sensitive error behavior
- preventable architectural drift

### NON-BLOCKING OBSERVATION

Useful future/optional work.

Do not turn style preferences into blockers.

## Step 12 — Final report

Return exactly these sections:

### Review target

Report:

- commit/ref
- commit message
- branch
- HEAD
- ahead/behind state

### Reviewers used

List:

- general reviewer
- database reviewer
- security reviewer

only if actually used.

### A. Blockers before push

List real blockers.

If none:

`None.`

### B. Corrections worth making now

List corrections worth addressing before push.

### C. Non-blocking observations

Keep brief.

### D. Test and verification assessment

State:

- what is unit-tested
- what is PGlite integration-tested
- what was inspected only
- what remains real-environment-only

### E. Architecture assessment

State whether the change preserves relevant UNLOCK boundaries.

### F. Security assessment

If relevant, state:

- trusted identity source
- auth ordering
- authorization behavior
- secret/error handling

If security is not materially involved:

`No material security-boundary change in this slice.`

### G. Database assessment

If relevant, state:

- migration/schema status
- transaction behavior
- concurrency assumptions
- PGlite vs real PostgreSQL/Supabase limitations

If database behavior is not materially involved:

`No material database-boundary change in this slice.`

### H. Safe-to-push verdict

Choose exactly one:

- `SAFE TO PUSH UNCHANGED`
- `SAFE TO PUSH AFTER MINOR CORRECTIONS`
- `NOT SAFE TO PUSH YET`

### I. Recommended next action

Give exactly one next development action.

Do not implement it.

## Final rules

- Review actual code, not the author's summary.
- Be adversarial but evidence-based.
- Do not create unrelated work.
- Do not modify anything.
- Do not stage.
- Do not commit.
- Do not push.
- Do not auto-fix.
- Do not delete unknown files.
- Do not use destructive git commands.
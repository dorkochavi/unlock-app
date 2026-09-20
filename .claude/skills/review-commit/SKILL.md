---
name: review-commit
description: Run a read-only adversarial review of an UNLOCK Slice commit or current diff using the appropriate risk-based reviewer agents. Checks Plan intent, actual runtime behavior, architecture, security, database integrity, tests, and verification claims. Never modifies, stages, commits, or pushes.
---

# /review-commit

Read-only review workflow for UNLOCK.

Use this skill to independently assess a completed Slice commit or current diff.

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

Its job is to inspect actual repository behavior and return findings.

---

## Step 1 — Load Current Context

Normally the current session already contains:

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

Re-read only if needed.

Determine:

- PLAN_VERSION
- RUN_ID
- current/relevant Slice
- intended Slice goal
- accepted invariants
- required reviewer types
- expected verification

Do not use historical Run Reports as default review context.

---

## Step 2 — Establish Repository State

Run the minimum necessary commands such as:

- `git status`
- `git status -sb`
- `git log --oneline -5`

Identify:

- current branch
- current HEAD
- ahead/behind state
- staged changes
- unstaged changes
- untracked files
- whether the requested commit exists

Do not touch unexpected files.

---

## Step 3 — Determine Review Target

If an exact commit/ref is supplied:

review that exact commit.

Useful commands may include:

`git show --stat <commit>`

`git show --format=fuller <commit>`

`git diff <commit>^ <commit> --`

If no commit is supplied:

- review the current relevant diff
- state clearly that the target is the worktree

If multiple commits could reasonably be the target:

- do not guess
- derive the correct target from the current Slice only when unambiguous
- otherwise report ambiguity

---

## Step 4 — Compare Against the Slice Contract

Review against the relevant Slice in `docs/CHATGPT_PLAN.md`.

Determine:

- does the implementation satisfy the actual Slice goal?
- are Must requirements met?
- are Do-not constraints respected?
- were non-goals kept out?
- were acceptance/Exit criteria actually achieved?
- did repository reality require a justified minimal adaptation?
- was a product decision silently invented?

If the commit solves a different problem than the Plan requested, report it even if the code is technically sound.

---

## Step 5 — Select Reviewers by Risk

### General Reviewer

Use:

`unlock-reviewer`

for:

- general application logic
- architecture
- cross-layer changes
- DailyPlan/application behavior
- major Slice changes
- mixed commits
- important test/documentation review

### Database Reviewer

Also use:

`unlock-db-reviewer`

when the change touches or materially depends on:

- `supabase/migrations/**`
- PostgreSQL repositories
- SQL
- UnitOfWork
- transactions
- `pg.Pool`
- connection providers
- constraints
- triggers
- SECURITY DEFINER functions
- database concurrency
- Supabase-managed database schemas

### Security Reviewer

Also use:

`unlock-security-reviewer`

when the change touches or materially depends on:

- Supabase Auth
- API authentication
- authorization
- cookies/session handling
- user identity
- safe redirects
- server/client trust boundaries
- environment secrets
- service-role credentials
- API error leakage
- security-sensitive execution ordering

Do not invoke every reviewer automatically.

Use only the reviewers justified by actual risk.

---

## Step 6 — Preserve Reviewer Independence

Reviewer agents must inspect real code.

Do not prime them with conclusions such as:

- this is probably safe
- implementation is correct
- tests already prove it
- previous reviewer approved it

Provide:

- exact commit/ref or diff
- intended Slice
- relevant accepted invariant
- known bug/behavior being addressed

Let the reviewer determine findings independently.

---

## Step 7 — Mandatory Review Questions

Regardless of reviewer type, determine:

- Does the implementation actually satisfy the Slice?
- Does runtime control flow match documented behavior?
- Are accepted product decisions preserved?
- Are trust boundaries preserved?
- Are application/domain boundaries preserved?
- Are there hidden environment assumptions?
- Are failure paths controlled?
- Are tests meaningful?
- Would key tests fail if the regression existed?
- Are verification claims accurate?
- Did the change introduce unrelated scope?
- Did the change create a new product/architecture decision without authorization?

---

## Step 8 — Test Evidence Review

Do not stop at test counts.

Inspect what meaningful tests actually prove.

Check:

- runtime wiring
- negative paths
- ordering
- ownership
- authorization
- transaction semantics
- failure behavior
- persistence constraints
- idempotency
- whether mocks hide production behavior
- whether PGlite is overstated
- whether real hosted/browser verification remains pending

Using already-produced verification results is preferred.

A focused read-only test command may be run if it materially improves confidence.

Do not modify tests.

---

## Step 9 — Security-Sensitive Ordering

When routes/protected operations are involved, trace actual execution order.

Examples:

- authentication before database construction
- authorization before mutation
- validation before persistence
- safe redirect validation before navigation
- transaction start before atomic writes

Do not assume helper correctness guarantees correct orchestration.

---

## Step 10 — Database-Sensitive Review

When database behavior is involved, inspect:

- forward-only migration history
- constraint correctness
- migration compatibility with existing data
- transaction-bound connection usage
- rollback behavior
- connection acquisition/release
- repository atomicity
- concurrency claims
- PGlite limitations
- Supabase-managed schema boundaries

Distinguish:

- proven under PGlite
- reasoned under PostgreSQL semantics
- actually tested on real PostgreSQL/Supabase

---

## Step 11 — Security-Sensitive Review

When Auth/API security is involved, inspect:

- trusted user identity source
- `auth.getUser()` usage where relevant
- client inability to override identity
- Course/record ownership enforcement
- authorization ordering
- server-only secrets
- service-role usage
- error leakage
- unauthenticated short-circuit behavior
- safe redirect handling when relevant

Fail closed where product policy requires it.

---

## Step 12 — Documentation Accuracy

Review changed durable documentation against actual repository behavior.

Flag documentation that:

- claims functionality not implemented
- claims verification not performed
- says hosted/E2E when only mocked
- duplicates history into DEV_STATUS
- changes an accepted decision without ADR/authorization
- places unresolved decisions outside OPEN_QUESTIONS
- contradicts current Plan or code

Do not use old historical Run Reports as a source of truth.

---

## Step 13 — Severity

### BLOCKER

Must be fixed before the Slice may be considered complete.

Examples:

- trust-boundary violation
- data-integrity risk
- incorrect core runtime behavior
- migration failure
- secret leakage
- broken transaction semantics
- accepted product invariant regression
- implementation materially fails Slice acceptance criteria

### CORRECTION

Should be fixed before Slice completion when practical.

Examples:

- important missing regression test
- misleading documentation
- fragile wiring
- meaningful but non-catastrophic error behavior
- preventable architecture drift

### NON-BLOCKING OBSERVATION

Useful future work that does not belong in the current Slice.

Do not turn preferences or unrelated cleanup into blockers.

---

## Step 14 — Combine Reviewer Findings

When multiple reviewers are used:

- merge duplicates
- preserve the strongest evidence-based severity
- do not inflate severity because multiple reviewers noticed the same issue
- resolve contradictions by inspecting actual code
- keep unrelated observations out of current scope

The implementation agent, not the reviewer skill, performs fixes later.

This skill remains read-only.

---

## Step 15 — Final Report

Return exactly these sections:

### Review Target

Report:

- Slice
- commit/ref or worktree diff
- commit message if applicable
- branch
- HEAD
- ahead/behind state

### Plan Alignment

State:

- aligned

or:

- `PLAN_CONFLICT`

with concise evidence.

### Reviewers Used

List only reviewers actually used.

### A. Blockers Before Completion

List blockers.

If none:

`None.`

### B. Corrections Worth Making Now

List required/recommended corrections.

If none:

`None.`

### C. Non-Blocking Observations

Keep brief.

### D. Test and Verification Assessment

State:

- what is unit-tested
- what is route-wiring tested
- what is PGlite integration-tested
- what was inspection only
- what remains real-environment-only

### E. Architecture Assessment

State whether relevant UNLOCK boundaries are preserved.

### F. Security Assessment

If relevant, state:

- trusted identity source
- auth/authorization ordering
- ownership behavior
- safe redirect behavior
- secret/error handling

If not relevant:

`No material security-boundary change in this Slice.`

### G. Database Assessment

If relevant, state:

- migration/schema status
- transaction behavior
- constraints
- concurrency assumptions
- PGlite vs real PostgreSQL/Supabase limitations

If not relevant:

`No material database-boundary change in this Slice.`

### H. Slice Verdict

Choose exactly one:

- `APPROVED FOR CHECKPOINT`
- `APPROVED AFTER CORRECTIONS`
- `BLOCKED`

### I. Recommended Next Action

Give exactly one next action within the current Slice lifecycle.

Examples:

- run checkpoint
- address listed blocker
- rerun affected tests

Do not propose unrelated future product work.

---

## Final Rules

- Review actual code, not the implementation summary.
- Review against CHATGPT_PLAN.
- Be adversarial but evidence-based.
- Preserve strict Slice scope.
- Do not modify anything.
- Do not stage.
- Do not commit.
- Do not push.
- Do not auto-fix.
- Do not delete unknown files.
- Do not read historical Runs unless explicitly authorized.
- Do not use destructive Git commands.
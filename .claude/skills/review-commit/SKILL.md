---

name: review-commit
description: Run a read-only risk-based review of the current UNLOCK Slice commit or worktree diff. Selects the appropriate reviewer agents, gives them a bounded review packet, merges findings, and returns a concise verdict without modifying repository state.
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# /review-commit

Use this skill to review a completed Slice implementation before final relevant verification.

This skill owns:

* review-target selection;
* reviewer selection;
* reviewer orchestration;
* review packet construction;
* findings consolidation;
* review verdict.

This skill does **not** own:

* implementation;
* test selection;
* evidence freshness;
* checkpoint readiness;
* product decisions;
* Git mutation.

It is read-only.

Never:

* modify files;
* stage;
* commit;
* push;
* reset;
* clean;
* delete;
* auto-fix findings.

---

## 1. Establish Review Context

Use the current session context when already available.

Load only what is needed to identify:

* active `RUN_ID`;
* relevant Slice;
* Slice goal;
* accepted behavior;
* explicit non-goals;
* review target.

Primary current sources:

* `docs/CHATGPT_PLAN.md`;
* `docs/DEV_STATUS.md`;
* repository/Git reality.

Do not read historical Run Reports by default.

---

## 2. Establish Repository State

Inspect the minimum required Git state.

Typical commands:

```text
git status --short
git status -sb
git log --oneline --decorate -5
```

Determine:

* branch;
* HEAD;
* ahead/behind;
* staged changes;
* unstaged changes;
* untracked files.

Do not mutate repository state.

---

## 3. Determine Review Target

If the active workflow supplies a specific commit/ref:

* review exactly that commit/ref.

If the Slice is not yet committed:

* review the relevant current worktree diff.

If target selection is ambiguous:

* resolve it from the active Slice when possible;
* otherwise report the ambiguity rather than guessing.

The review target must be explicit in the final report.

---

## 4. Compare Against the Slice Contract

The implementation must be reviewed against the actual active Slice.

Check:

* required behavior;
* Must requirements;
* Do-not constraints;
* explicit non-goals;
* acceptance criteria;
* relevant accepted invariants.

A technically sound implementation that solves the wrong problem is still a review failure.

Do not silently reinterpret the Plan.

---

## 5. Select Reviewers by Risk

Choose only reviewers justified by the actual change.

### General reviewer

Use `unlock-reviewer` when the change involves:

* general application behavior;
* architecture;
* domain/application boundaries;
* cross-layer implementation;
* DailyPlan/application behavior;
* mixed or substantial Slice changes;
* changed tests/documentation that materially affect runtime meaning.

### Database reviewer

Also use `unlock-db-reviewer` when the change materially touches or depends on:

* migrations;
* SQL;
* PostgreSQL repositories;
* constraints;
* triggers;
* transactions;
* Unit of Work;
* connection handling;
* persistence concurrency;
* Supabase-managed database boundaries.

### Security reviewer

Also use `unlock-security-reviewer` when the change materially touches or depends on:

* authentication;
* authorization;
* user identity;
* protected API routes;
* ownership;
* session/cookie behavior;
* safe redirects;
* secrets;
* service-role credentials;
* trust-boundary ordering;
* security-sensitive errors.

Do not invoke all reviewers by default.

Use risk, not ceremony.

---

## 6. Build a Compact Review Packet

Each reviewer should receive only the context required to review the target.

Include:

* exact target commit/ref or diff;
* Slice goal;
* relevant acceptance criteria;
* relevant accepted invariant/ADR when needed;
* known risk surface;
* existing verification summary if useful.

Do not send:

* full repository history;
* entire `DEV_STATUS`;
* every ADR;
* all Run Reports;
* implementation conclusions;
* "this looks correct" framing.

Reviewers should inspect actual code independently.

---

## 7. Preserve Reviewer Independence

Do not prime reviewers with approval-oriented language.

Avoid statements such as:

* implementation is correct;
* tests already prove it;
* previous reviewer approved;
* this should be safe.

Provide facts and boundaries.

Let reviewers determine findings.

---

## 8. General Review Focus

The general reviewer should assess cross-cutting correctness such as:

* Slice alignment;
* runtime behavior;
* architecture boundaries;
* domain/application separation;
* failure handling;
* hidden assumptions;
* scope discipline;
* meaningful regression protection;
* documentation accuracy where changed.

It should not duplicate specialist review in unnecessary detail.

---

## 9. Database Review Focus

The database reviewer should focus on persistence-specific risks such as:

* migration compatibility;
* constraints;
* SQL correctness;
* transaction semantics;
* connection use;
* rollback;
* repository atomicity;
* concurrency assumptions;
* PostgreSQL vs PGlite evidence boundaries.

It should not independently re-review unrelated product/UI concerns.

---

## 10. Security Review Focus

The security reviewer should focus on trust-boundary risks such as:

* trusted identity source;
* authentication ordering;
* authorization;
* ownership;
* client-controlled identifiers;
* fail-closed behavior;
* secrets;
* privileged credentials;
* error leakage;
* redirect/session safety where relevant.

It should not duplicate unrelated DB/application review.

---

## 11. Review Is Not Verification Selection

Reviewers may identify missing or weak evidence.

They may say:

* a regression test is missing;
* an integration boundary is unproven;
* a security path lacks evidence.

But reviewers do not own the operational decision of exactly which commands to run next.

That belongs to:

`.claude/rules/testing.md`

Review identifies the risk.

Testing policy chooses the verification response.

---

## 12. Review Existing Evidence Honestly

Reviewers may inspect already-produced evidence.

They should distinguish:

* focused unit/application evidence;
* route/API evidence;
* PGlite/database integration evidence;
* browser E2E;
* hosted/real-environment evidence;
* inspection/reasoning only.

Do not infer stronger verification than was actually performed.

---

## 13. Severity Model

Use only these finding severities.

### BLOCKER

Must be fixed before the Slice can proceed.

Examples:

* trust-boundary violation;
* data-integrity risk;
* incorrect core behavior;
* broken transaction semantics;
* migration incompatibility;
* secret leakage;
* accepted invariant regression;
* material failure of Slice acceptance criteria.

### CORRECTION

Should be fixed before Slice completion.

Examples:

* meaningful regression gap;
* fragile but important wiring;
* misleading durable documentation;
* material architecture drift;
* preventable error-handling weakness.

### NON-BLOCKING

Useful observation that does not belong in the current Slice.

Examples:

* maintainability improvement;
* unrelated cleanup;
* future abstraction opportunity.

Do not inflate preferences into blockers.

---

## 14. Merge Findings Across Reviewers

When multiple reviewers are used:

* merge duplicates;
* preserve the strongest evidence-based severity;
* resolve apparent contradictions from actual code;
* keep specialist evidence attached to the relevant finding;
* keep unrelated observations out of current execution.

The number of reviewers noticing the same issue does not increase severity.

---

## 15. Do Not Auto-Fix

This skill remains read-only.

It must not:

* edit the implementation;
* modify tests;
* update docs;
* stage corrections;
* create commits.

Findings return to the implementation workflow.

`/implement-slice` owns correction execution.

---

## 16. Review Verdict

After consolidating findings, choose exactly one verdict:

### `NO BLOCKING FINDINGS`

Use when:

* no BLOCKER exists;
* no required CORRECTION remains before final verification.

### `CORRECTIONS REQUIRED`

Use when:

* one or more CORRECTION findings should be fixed before proceeding;
* no unresolved BLOCKER exists.

### `BLOCKED`

Use when:

* at least one BLOCKER exists;
* or a genuine Plan/decision conflict prevents safe completion.

Do not use approval language that implies commit/checkpoint readiness.

Review is only one stage of the lifecycle.

---

## 17. Plan Conflict

If review finds that implementation required or introduced an unapproved product/architecture/security decision, report:

```text
PLAN_CONFLICT
- Plan assumption
- Repository reality
- Why the implementation conflicts
- Decision required
- Affected Slice
```

A Plan conflict is not merely a code-quality suggestion.

Do not resolve it inside the review.

---

## 18. Final Review Report

Return only the following sections.

### Review Target

* Slice;
* commit/ref or worktree;
* branch;
* HEAD.

### Reviewers Used

List only reviewers actually invoked.

### Findings

For each finding:

```text
[BLOCKER | CORRECTION | NON-BLOCKING]
Title
Evidence
Why it matters
```

If none:

`None.`

### Evidence Assessment

Briefly state:

* what existing evidence materially supports the implementation;
* what evidence limitation remains, if any.

Do not prescribe a full test plan here.

### Verdict

Exactly one:

* `NO BLOCKING FINDINGS`
* `CORRECTIONS REQUIRED`
* `BLOCKED`

### Next Lifecycle Action

Give exactly one next action:

* return to implementation for corrections;
* perform final relevant verification;
* resolve Plan conflict.

Do not suggest unrelated future work.

---

## 19. Findings Quality Standard

Every BLOCKER or CORRECTION should be:

* specific;
* actionable;
* tied to actual code/behavior;
* supported by evidence;
* relevant to current Slice scope.

Avoid vague findings such as:

* "consider improving architecture";
* "maybe add more tests";
* "could be cleaner".

Explain the concrete risk.

---

## 20. Documentation Review

When durable documentation changed, review only the facts materially affected.

Flag when documentation:

* claims unimplemented behavior;
* claims verification not performed;
* conflicts with accepted ADRs;
* places unresolved decisions outside `OPEN_QUESTIONS`;
* turns historical state into current authority;
* duplicates facts into the wrong owner.

Do not review every documentation file merely because one doc changed.

---

## 21. Legacy and Historical Artifacts

Do not use:

* old Run Reports;
* historical invariant snapshots;
* obsolete scratch notes;

as current authority.

They may be consulted only when the change explicitly depends on historical behavior.

Current repository reality and accepted current sources control.

---

## 22. Review Stop Condition

Review is complete when:

1. the target is understood;
2. appropriate reviewers have completed their bounded review;
3. findings are deduplicated and classified;
4. evidence limitations are stated honestly;
5. one verdict is returned.

Do not continue into:

* corrections;
* final verification;
* checkpoint;
* commit.

Those belong to later lifecycle stages.

---

## 23. Core Rules

* Read-only.
* Review actual code, not summaries.
* Review against the active Slice.
* Select reviewers by risk.
* Send compact review packets.
* Preserve reviewer independence.
* Merge duplicate findings.
* Do not inflate severity.
* Do not auto-fix.
* Do not stage.
* Do not commit.
* Do not push.
* Do not run destructive Git commands.
* Do not use historical Runs as default authority.
* Return one clear verdict and one next lifecycle action.

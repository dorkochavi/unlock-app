---
name: checkpoint
description: Validate UNLOCK repository state and freshness/completeness of required evidence for a bounded Slice; reuse fresh evidence and run only missing or stale required checks.
---

# /checkpoint

Purpose: evidence and repository-state gate.

Checkpoint is not a second broad test runner and not a reviewer selector.

## 1. Inputs

Use:
- current Slice acceptance/risk from `docs/CHATGPT_PLAN.md`;
- current diff/repository state;
- `.claude/rules/testing.md` for required evidence;
- review result from `review-commit` when review was required;
- existing verification results/evidence records.

## 2. Repository State

Check:
- intended files changed;
- no unexpected destructive/unrelated change;
- no unresolved merge/conflict state;
- diff hygiene is acceptable;
- no prohibited remote action is required.

Do not discard user work.

## 3. Evidence Inventory

List only evidence required for the actual Slice risk.
For each item record:
- required/not required;
- existing result;
- freshness basis;
- missing/stale status.

## 4. Freshness

Reuse evidence when no later relevant change materially affects what it proves.

If a reviewer fix changed the relevant surface, mark only affected evidence stale.
If relevance cannot be determined safely, mark it stale.

Do not rerun fresh evidence simply because checkpoint was invoked.

## 5. Fill Missing Evidence

Only when required evidence is missing/stale:
- run the smallest appropriate check under `.claude/rules/testing.md`;
- update the evidence inventory;
- stop on relevant failure.

Do not select reviewers here.
Do not automatically run full unit/schema/typecheck/lint/build.

## 6. Review State

If risk required review:
- ensure the selected review is complete;
- ensure no unresolved BLOCKER/CORRECTION remains;
- ensure review-driven fixes have the required refreshed evidence.

A low-risk Slice may validly have no specialist review.

## 7. Verdict

Return:

### `READY FOR COMMIT`
when:
- repository state is coherent;
- required evidence is present/fresh/green;
- required review has no unresolved material finding;
- Slice acceptance is satisfied.

### `NOT READY`
when something concrete remains missing/failing.
List only the blocking gap(s).

### `READY FOR HANDOFF`
may be used only for an intentional interruption where the current state is safe but the Slice is not being committed/completed now.

## 8. Continuation

A green checkpoint does not mean stop if the Plan contains more approved eligible work.

Do not update `DEV_STATUS` or Run Report merely because checkpoint is green.

## 9. Output Example

```text
Repository: clean/focused
Review: NO BLOCKING FINDINGS
Evidence:
- focused unit: PASS, fresh
- schema: PASS from earlier, reused; no DB-relevant change afterward
- typecheck: not required for docs-only change
Verdict: READY FOR COMMIT
```

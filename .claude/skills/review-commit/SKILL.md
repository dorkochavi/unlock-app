---
name: review-commit
description: Sole UNLOCK owner for risk-based reviewer selection and reviewer orchestration for a bounded change.
---

# /review-commit

Purpose: decide what independent review the current change actually needs and return one actionable verdict.

Read-only. Never edit, stage, commit, push, reset, clean, or auto-fix.

## 1. Establish Review Target

Identify:
- exact diff/commit range;
- Slice goal/acceptance;
- changed paths;
- relevant fresh verification already available.

Do not reconstruct the entire project history.

## 2. Classify Risk

Use the changed surface, not Slice importance alone.

### LOW
Examples:
- narrowly scoped copy/presentation/documentation change;
- mechanical low-risk change with strong evidence;
- no domain/data/trust-boundary impact.

Result may be: `NO SPECIALIST REVIEW REQUIRED`.

### GENERAL
Use the general reviewer for meaningful application/domain/cross-layer correctness or architecture risk.

### DATABASE
Use DB reviewer when schema, migration, SQL mapping, transaction, locking, persistence integrity, or concurrency risk is material.

### SECURITY
Use security reviewer when authentication, authorization, trusted identity, privilege, secret handling, redirect/session, or leakage risk is material.

Use combinations only when the diff genuinely spans multiple material risk classes.
“All three” is never a default.

## 3. Dispatch Compact Review Packets

Provide each selected reviewer only:
- exact target/diff;
- Slice goal;
- changed paths;
- relevant canonical rule/decision pointers;
- relevant verification evidence.

Do not preload all HOT/WARM docs unless the reviewer actually needs them.

## 4. Reviewer Independence

Reviewers inspect actual repository evidence and return findings only.
They should not justify the implementation, rewrite the Slice, or modify files.

Specialist policy lives in:
- general reviewer → `.claude/agents/unlock-reviewer.md`;
- DB → `.claude/agents/unlock-db-reviewer.md` + `postgres.md`;
- security → `.claude/agents/unlock-security-reviewer.md` + `auth.md`/`api.md`.

## 5. Normalize Findings

Use:
- **BLOCKER** — unsafe/incorrect result prevents acceptance;
- **CORRECTION** — material defect should be fixed before acceptance;
- **NON-BLOCKING** — useful follow-up not required for current Slice.

Deduplicate the same underlying issue across reviewers.
Do not inflate severity because multiple reviewers noticed it.

Route meaningful future work to `docs/FOLLOW_UP_BACKLOG.md` when appropriate.

## 6. Evidence Assessment

Reviewers may identify missing/weak evidence, but this skill does not become a second test scheduler.
Verification selection/freshness belongs to `.claude/rules/testing.md`.

Distinguish local/PGlite evidence from real hosted PostgreSQL/Supabase claims.

## 7. Output

Return compactly:

```text
Reviewers used
Findings
- BLOCKER ...
- CORRECTION ...
- NON-BLOCKING ...

Evidence assessment

Verdict
- NO BLOCKING FINDINGS
- CORRECTIONS REQUIRED
- BLOCKED
```

If no reviewer is warranted, state the risk rationale and return `NO BLOCKING FINDINGS` unless the diff itself exposes an obvious issue.

## 8. Boundary

This skill owns reviewer **selection/orchestration only**.
It does not own:
- implementation;
- testing command selection;
- checkpoint;
- commit sequencing;
- Run completion.

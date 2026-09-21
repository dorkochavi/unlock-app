---
name: implement-slice
description: Implement one focused UNLOCK Slice from the active CHATGPT_PLAN using the canonical lifecycle without duplicating testing, review, or checkpoint policy.
---

# /implement-slice

Purpose: orchestrate one approved Slice.

## 1. Resolve the Slice

Read:
- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

Select the earliest incomplete eligible Slice unless the user/Plan explicitly selects another.
Capture:
- Slice goal;
- mode (`INVESTIGATE` / `IMPLEMENT` if defined);
- deliverables;
- acceptance;
- risk/affected surfaces;
- dependencies/manual gates.

## 2. Validate Repository State

Inspect current Git state when relevant.
Respect BASE_HEAD semantics from `CLAUDE.md`.
Do not discard unknown/user work.
Do not push.

## 3. Load Minimum Context

Use `docs/CONTEXT_MAP.md` only as a GPS when needed.
Load the smallest relevant ADR/rule/code/tests.
Do not read historical Runs by default.

## 4. Confirm Scope

Before editing, ensure the Slice can be implemented without inventing a missing product/architecture decision.

Return `PLAN_CONFLICT` for a material unresolved contradiction or unsafe scope expansion.

## 5. Implement

Make the smallest coherent change that satisfies Slice acceptance.

Rules:
- reuse existing architecture;
- do not perform opportunistic refactors;
- preserve accepted invariants;
- keep unrelated findings out of scope.

Routing for discoveries:
- current blocker → solve minimally;
- unresolved decision → `OPEN_QUESTIONS` / `PLAN_CONFLICT`;
- useful future work → `FOLLOW_UP_BACKLOG`;
- trivial cleanup → leave it.

## 6. Targeted Verification

Follow `.claude/rules/testing.md`.
Run focused evidence during implementation for fast feedback.
Do not pre-emptively run every broad suite.

## 7. Risk Review

Invoke `/review-commit` after implementation reaches a coherent reviewable state.

`review-commit` alone owns reviewer selection.
Do not select specialist reviewers independently here.

## 8. Fix Material Findings

Fix BLOCKER/CORRECTION findings that belong to the Slice.
Do not turn non-blocking observations into scope expansion.

If a finding requires a new product/architecture decision, stop with `PLAN_CONFLICT` rather than inventing it.

## 9. Final Relevant Verification

After review-driven fixes, follow `.claude/rules/testing.md` to refresh only evidence invalidated or still missing.

This is the final verification stage for the Slice.

## 10. Evidence Checkpoint

Invoke `/checkpoint`.

Checkpoint validates:
- repository state;
- required evidence inventory;
- freshness;
- diff hygiene/readiness.

It should reuse fresh evidence and run only missing/stale required checks.

Expected result:
- `READY FOR COMMIT`, or
- `NOT READY` with concrete missing evidence/problem.

## 11. Commit Boundary

When the Plan permits and checkpoint is ready:
- inspect focused diff;
- create one coherent local commit for the Slice.

Never push.

Git is the technical Slice history. Do not update Run Report/DEV_STATUS after every small commit unless an intentional durable handoff/manual gate requires it.

## 12. Temporary Continuity

If another session must resume mid-Run, keep `scratch/development_checkpoint.md` small (roughly one screen):
- Run/Slice;
- HEAD;
- just completed;
- blockers;
- fresh evidence;
- next action.

Overwrite rather than append a diary.

## 13. Continue / Stop

Continue autonomously only while:
- another approved Slice is eligible;
- no manual gate/PLAN_CONFLICT exists;
- context remains suitable.

At a clean boundary with materially large context, prefer a fresh session before a substantial next Slice.

Run completion follows `CLAUDE.md`; this skill does not duplicate the Run-close protocol.

Telemetry details live in `docs/RUN_TELEMETRY.md` and are not part of normal implementation narration.

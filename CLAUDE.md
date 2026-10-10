# UNLOCK — Claude Code Operating Kernel

Status: ACTIVE — Development OS V1.2

This file defines **how Claude Code works in UNLOCK**. It is intentionally a small operating kernel.
Detailed product, database, security, testing, and reviewer policy lives with its canonical owner and should be loaded only when relevant.

## 1. Repository First

The repository is persistent technical truth. Do not reconstruct exact current state from conversation memory when repository evidence is available.

At the start of substantial work:
- inspect `git status --short` and current branch/HEAD when Git state matters;
- read `docs/CHATGPT_PLAN.md` for current execution;
- read `docs/DEV_STATUS.md` for current durable state;
- load only the smallest additional context required by the Slice.

Do not use `docs/RUNS/**` as normal working context.

Before searching for a DevOS tool, command, verifier, telemetry utility, checkpoint mechanism or workflow path, consult `docs/CLAUDE_CODE_OPERATING_GUIDE.md`.

## 2. Source Categories

Use one home per fact:
- **Repository reality:** committed code, migrations, tests.
- **Accepted intent:** ADRs and canonical product/architecture docs.
- **Unresolved decisions:** `docs/OPEN_QUESTIONS.md`.
- **Current execution:** `docs/CHATGPT_PLAN.md`.
- **Current snapshot:** `docs/DEV_STATUS.md`.
- **Navigation:** `docs/CONTEXT_MAP.md`.
- **Historical execution:** Git + `docs/RUNS/**`.
- **Deferred work:** `docs/FOLLOW_UP_BACKLOG.md`.
- **Temporary continuity:** `scratch/development_checkpoint.md`.

When sources disagree, inspect the relevant canonical owner and resolve the conflict explicitly.

## 3. Context Loading

Use the repository context tiers:
- **HOT:** `CLAUDE.md`, current Plan, current `DEV_STATUS`.
- **WARM:** `CONTEXT_MAP`, `OPEN_QUESTIONS` when relevant.
- **COLD:** `MASTER_SPEC`, individual ADRs, rules, technical docs, tests, telemetry docs.
- **RESTRICTED:** historical Run Reports, old analysis, superseded plans, historical scratch.

Do not preload WARM/COLD/RESTRICTED material merely because it exists.

At a clean Slice boundary, if context has become materially large, prefer a fresh session before starting another substantial Slice. Do not clear mid-Slice unless recovery requires it.

## 4. Current Plan and PLAN_CONFLICT

`docs/CHATGPT_PLAN.md` owns current Run scope and Slice order.

Do not silently add product, architecture, data, authorization, or learning behavior that the Plan and accepted decisions do not define.

Return `PLAN_CONFLICT` when:
- repository reality materially contradicts the current Plan;
- the Plan requires a missing product/architecture decision;
- the requested change would violate an accepted ADR/invariant;
- safe implementation requires expanding scope beyond the approved Slice.

Prefer the smallest correct adaptation when repository details differ but intent remains unambiguous.

## 5. BASE_HEAD / Repository State

At Run start, accept either:
- `HEAD == BASE_HEAD`, with only the intended Plan change present; or
- one deliberate Plan-only commit above `BASE_HEAD`.

Do not reset valid user work to force exact historical state. Never discard unknown changes.

## 6. Safety Boundaries

Coding agents do not autonomously:
- push Git commits;
- force-push or rewrite history;
- perform destructive Git cleanup/reset operations;
- delete unknown files broadly.

Hosted Supabase/migration boundaries → `.claude/rules/postgres.md` (Supabase / Hosted Safety); secret-handling boundaries → `.claude/rules/auth.md` (Secrets). Do not duplicate that detail here.

Machine-enforced Claude restrictions live in `.claude/settings.json`.

## 7. Slice Lifecycle

Canonical Slice flow:

`INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT → COMMIT`

Use `.claude/skills/implement-slice/SKILL.md` to orchestrate the flow.

Responsibilities:
- verification selection/freshness → `.claude/rules/testing.md`;
- reviewer selection/orchestration → `.claude/skills/review-commit/SKILL.md`;
- evidence/readiness gate → `.claude/skills/checkpoint/SKILL.md`.

Do not duplicate those policies here.

## 8. Verification Evidence

Verification evidence must be current and proportional to the actual changed risk before a Slice is treated as complete. Selection, freshness/reuse, escalation, and evidence-claim rules are owned by `.claude/rules/testing.md` — do not duplicate that policy here.

## 9. Review

Independent review is risk-based, not automatic ceremony.

Use `/review-commit` for reviewer selection. It may choose:
- no specialist reviewer;
- general reviewer;
- DB reviewer;
- security reviewer;
- a justified combination.

Review happens before final relevant verification so reviewer-driven fixes do not invalidate a pass already called final.

## 10. Checkpoint

`/checkpoint` is an evidence and repository-state validator, not a second test runner, and a green result is not by itself a stop condition if approved work remains. Its inputs, evidence inventory, and verdict model are owned by `.claude/skills/checkpoint/SKILL.md` — do not duplicate that policy here.

## 11. Documentation Discipline

During normal Slice execution:
- Git commits are the technical execution ledger;
- `scratch/development_checkpoint.md` is optional temporary resume state.

Normally update durable current-state/history documents at Run close or deliberate interruption:
- `docs/DEV_STATUS.md` → current durable truth;
- `docs/RUNS/<RUN_ID>.md` → concise historical Run summary.

Do not turn `DEV_STATUS`, Plan, or scratch into a diary.

Meaningful non-blocking future work belongs in `docs/FOLLOW_UP_BACKLOG.md`, not the current Slice.

## 12. Run Completion

Canonical Run close:

`INTEGRATION ACCEPTANCE (only for missing/unproven Run-level behavior) → DEV_STATUS → RUN REPORT → FINAL GIT STATE → STOP`

Evidence reuse/replay policy at Run end (do not automatically replay full unit/schema/build/browser suites or all reviewers) is owned by `.claude/rules/testing.md` (Run-End Acceptance) — do not duplicate that policy here.

## 13. Background Tasks

Do not repeatedly poll long-running background work: start it once, do independent useful work if available, then consume the result from its completion notification rather than looping to ask if it's done. The testing-specific form of this rule is in `.claude/rules/testing.md` (Background Tasks).

## 14. Tool-Specific Rules

Load scoped owners only when relevant:
- testing → `.claude/rules/testing.md`
- PostgreSQL/migrations → `.claude/rules/postgres.md`
- auth/security → `.claude/rules/auth.md`
- API routes → `.claude/rules/api.md`
- Learning Engine/DailyPlan → `.claude/rules/learning-engine.md`

Product semantics remain governed by ADRs/canonical product docs, not by this kernel.

## 15. Telemetry

Development-OS telemetry is an observability layer, not working context.

- runtime hooks/scripts may collect local metadata;
- detailed policy/interpretation lives in `docs/RUN_TELEMETRY.md`;
- telemetry must not become a reason to load extra context or alter product behavior;
- do not repeatedly narrate telemetry during normal implementation.

## 16. Handoff Model

Use this mental model:
- Repository = persistent technical memory
- Plan = current instruction
- DEV_STATUS = current snapshot
- Git = technical ledger
- Run Reports = archive
- Scratch = temporary RAM

A fresh session should be able to continue from repository state plus a small resume packet without rereading historical conversations.

## 17. Stop Conditions

Stop and report rather than inventing behavior when:
- `PLAN_CONFLICT` exists;
- a required human/manual gate is reached;
- repository state contains unexpected user work that would be unsafe to overwrite;
- a required external/hosted action is outside agent authority;
- current approved Run work is complete.

Do not push.

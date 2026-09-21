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
- delete unknown files broadly;
- link or push hosted Supabase state;
- apply hosted migrations;
- expose/request secret values;
- mutate hosted production/database state unless repository policy explicitly changes.

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

Use targeted verification during implementation.

Evidence may be reused while fresh. A later relevant change invalidates only the evidence it can materially affect. When relevance cannot be determined safely, treat the evidence as stale.

Do not rerun broad suites merely because a Slice or Run boundary was reached.
Follow `.claude/rules/testing.md` for exact selection, escalation, environment honesty, and evidence claims.

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

`/checkpoint` is an **evidence and repository-state validator**, not a second test runner.

It should:
- inspect changed state;
- inventory required evidence;
- validate freshness;
- run only missing/stale required evidence;
- return readiness.

A green checkpoint is not a stop condition if approved work remains.

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

Do not automatically replay full unit/schema/build/browser suites or all reviewers at Run end. Reuse valid Slice-level evidence unless later changes invalidated it.

## 13. Background Tasks

Do not repeatedly poll long-running background work.

Preferred behavior:
1. start the task once;
2. do independent useful work if available;
3. otherwise wait for completion notification;
4. consume the result once.

Do not use loops solely to ask whether a test is still running.

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

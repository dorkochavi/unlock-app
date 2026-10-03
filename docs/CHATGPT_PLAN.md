# UNLOCK — QA-CLEANUP-001 — QA-PREVIEW-* Cleanup

PLAN_VERSION: 012
RUN_ID: 2026-10-03-QA-CLEANUP-001
START_HEAD: `30e7f4f`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `29889b0`
STATUS: **COMPLETE** — QA-PREVIEW-A / QA-PREVIEW-B are ARCHIVED (non-joinable, inert); FUB-046 closed; QA data retained. Not a product Run; not Run 011.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

---

## 1. Goal

Make QA-PREVIEW-A and QA-PREVIEW-B non-joinable and inert, preserving all Attempts, the QA learner membership and canonical
author integrity, with the smallest safe hosted change.

## 2. Authority / Canonical References (pointers only)

- Kernel and rules: `CLAUDE.md`, `.claude/rules/*.md`. Skill: `.claude/skills/autonomous-run` (§1 Run prompt checklist, §4 dispatch, §7 gates).
- Current state: `docs/DEV_STATUS.md`. Deferred work: `docs/FOLLOW_UP_BACKLOG.md` (FUB-046).
- Baseline (verified): branch `feature/run-010-learning-intelligence`; remote feature `21ee5df`; `main` / tag `v0.2.0` / Production `fff8c40`;
  HEAD `30e7f4f` = `21ee5df` + one docs/skill commit (Run prompt checklist).
- Run-close verifier / telemetry: `.claude/telemetry/verify-run-close.mjs`, `docs/DEVOS_OBSERVABILITY.md`.

## 3. Gate Policy

Every Slice declares one gate: AUTO, REVIEW_GATE, HUMAN_DECISION_GATE, or FINAL_GATE. Canonical semantics live in
`.claude/skills/autonomous-run/SKILL.md` (not duplicated here).

## 4. Slice Queue

| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Phase 0 identity + read-only inventory of QA-PREVIEW-A/B by canonical id | AUTO | DONE |
| B | Decision record (read-only): smallest cleanup; verify the hypothesis (archive QA-PREVIEW-A via the product archive path) | AUTO | DONE (hypothesis confirmed: single `courses.status` transition on A; B already ARCHIVED) |
| C | Fresh backup (outside repo) + exact bounded action + rollback; stop at `HUMAN_APPROVAL_REQUIRED: EXECUTE_QA_CLEANUP` | AUTO | DONE (backup `pre-QACLEANUP-20261003-210229`, outside repo) |
| D | Execute the approved action (preferred: human, as the QA author in the product UI) | HUMAN_DECISION_GATE | DONE (human archived QA-PREVIEW-A via product UI, 2026-10-03) |
| E | Post-verify invariants I1-I5 (read-only) | AUTO | DONE (I1-I5 PASS; I1 amended: exclude post-start Today plan rows, see report) |
| F | Docs close (FUB-046, DEV_STATUS, Run report), verifier PASS, local commit; push is human | FINAL_GATE | DONE (docs; commit by parent) |

## 5. Run Invariants (each proven, not asserted)

- I1 no non-QA row changes (pre/post md5 of non-QA courses, memberships, authors, attempts).
- I2 Attempts preserved (QA-PREVIEW-A: 7 before == 7 after; none deleted; total attempts 190 unchanged).
- I3 QA Courses end non-joinable (status ARCHIVED; join denied by `canSelfJoinCourse` and the existing ARCHIVED join tests).
- I4 canonical author integrity (every Course has an active `course_authors` row; authors 11/11 active).
- I5 no schema/migration/app change (15 applied, 0 pending); `main` and `v0.2.0` unchanged.
- Agents do not push, merge, deploy, run `db push`, link, force/rewrite, or touch non-QA data / Vercel / migrations.

## 6. STOP Conditions

`BASELINE_CONFLICT`, `PLAN_CONFLICT`, `TOOLING_BLOCKER`, `HUMAN_APPROVAL_REQUIRED: <X>`; unexpected non-QA change; any need to delete
evidence-bearing Attempts; ambiguous product/data semantics. A harness denial is not worked around.

## 7. Current Status

- Run COMPLETE. Branch `feature/run-010-learning-intelligence`; pushing it is a human action (no push by the agent). No active Run.

## History

Reports are the archive:

- QA-CLEANUP-001: `docs/RUNS/2026-10-03-QA-CLEANUP-001.md`
- POST-RUN010-PRODUCT-FIX-001 (incl. "Release close", v0.2.0): `docs/RUNS/2026-10-03-POST-RUN010-PRODUCT-FIX-001.md`
- GOVERNANCE-RECONCILE-001: `docs/RUNS/2026-09-29-GOVERNANCE-RECONCILE-001.md`
- DEVOS-V1.3 Consolidation: `docs/RUNS/2026-09-29-DEVOS-V1.3-CONSOLIDATION.md`
- Run010 Learning Intelligence: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`
- DevOS Micro-Optimization: `docs/RUNS/2026-09-28-DEVOS-MICRO-OPT-001.md`
- UX-03-QA2: `docs/RUNS/2026-09-28-UX-03-QA2.md`; UX-03-QA1: `docs/RUNS/2026-09-27-UX-03-QA1.md`; UX-03: `docs/RUNS/2026-09-27-UX-03.md`; UX-02: `docs/RUNS/2026-09-27-UX-02.md`
- Slice B Pilot Readiness Verification: `docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`

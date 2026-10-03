# UNLOCK — PILOT-HARDENING-EVIDENCE-001 — Local Pilot-Confidence Evidence

PLAN_VERSION: 013
RUN_ID: 2026-10-04-PILOT-HARDENING-EVIDENCE-001
START_HEAD: `be97aba`
RUN_STATUS: IN_PROGRESS
STATUS: **IN_PROGRESS** — overnight autonomous Run; local/read-only/reversible work only. Not a product Run; not Run 011.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

---

## 1. Goal

Increase pilot confidence using only local, read-only, reversible work: (1) backup restore evidence (FUB-009), (2) real-PostgreSQL
evidence for the remaining `revokeCourseAuthor` follow-up (FUB-042 item 7), (3) Auth redirect allow-list status, (4) pilot-readiness
reconciliation (GO/NO-GO input matrix; no launch decision), (5) compact durable closure.

## 2. Authority / Canonical References (pointers only)

- Kernel and rules: `CLAUDE.md`, `.claude/rules/*.md`. Skill: `.claude/skills/autonomous-run` (§4 dispatch, §7 gates).
- Current state: `docs/DEV_STATUS.md`. Deferred work: `docs/FOLLOW_UP_BACKLOG.md` (FUB-009, FUB-042). Readiness: `docs/PILOT_READINESS.md`.
- Baseline (verified): branch `feature/run-010-learning-intelligence`; local HEAD = remote feature = remote `main` = `be97aba`; `v0.2.0` -> `fff8c40`; tree clean.
- Run-close verifier / telemetry: `.claude/telemetry/verify-run-close.mjs`, `docs/DEVOS_OBSERVABILITY.md`.

## 3. Gate Policy

Canonical semantics: `.claude/skills/autonomous-run/SKILL.md` §7 (not duplicated here).

## 4. Slice Queue

| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Phase 0 identity + grounding (FUB-009, FUB-042 item 7, Auth redirect allow-list, pilot gates) | AUTO | DONE (identity set; telemetry attributes to new RUN_ID; grounding recorded in checkpoint) |
| B | Backup restore drill into disposable LOCAL PostgreSQL; hosted-isolation proof | REVIEW_GATE | PENDING |
| C | FUB-042 item 7: real two-connection PostgreSQL concurrency evidence (prove before edit) | REVIEW_GATE | PENDING |
| D | Auth redirect allow-list audit (no hosted Auth mutation) | REVIEW_GATE | PENDING |
| E | Pilot readiness reconciliation; GO/NO-GO INPUT MATRIX | AUTO / REVIEW_GATE | PENDING |
| F | Integrated evidence + adversarial review + telemetry read | FINAL_GATE | PENDING |
| G | Run close (docs, verifier, local commits; no push) | FINAL_GATE | PENDING |

## 5. Run Invariants (each proven, not asserted)

- I1 no hosted database mutation. I2 no Production/Vercel mutation. I3 no push/merge/tag change (`main`, `v0.2.0` unchanged).
- I4 no product semantics invented or widened. I5 restore/concurrency environments are disposable, local, and cannot reach hosted data.
- I6 evidence labeled by provenance and freshness. I7 OQs/FUBs close only when actually proven. I8 changes focused and independently reviewable.

## 6. STOP Conditions

`BASELINE_CONFLICT`, `PLAN_CONFLICT`, `TOOLING_BLOCKER`, `HUMAN_APPROVAL_REQUIRED: <X>`; hosted mutation/push/tag/Production needed;
new product/security/data semantic decision; restore not provably isolated from hosted; evidence conflict. A harness denial is not
worked around. A non-global blocker stops only the affected path.

## 7. Current Status

- Run IN_PROGRESS (Phase 0 identity set). Pushing is a human action.

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

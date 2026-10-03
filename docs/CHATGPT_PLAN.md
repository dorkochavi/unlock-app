# UNLOCK — POST-RUN010-PRODUCT-FIX-001 — Post-Run010 Product Fix / Reconciliation

PLAN_VERSION: 008
RUN_ID: 2026-10-03-POST-RUN010-PRODUCT-FIX-001
START_HEAD: `4f360a7`
RUN_STATUS: IN_PROGRESS
STATUS: **IN_PROGRESS** — bounded local correctness/reconciliation of known post-Run010 pre-push findings before Manual / Hosted QA. Not a reopening of Run010; not Run 011.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

---

## 1. Goal

Reconcile the known post-Run010 product correctness / pre-push findings locally, preserving all accepted Run010
invariants, so UNLOCK can proceed safely to Manual / Hosted QA.

## 2. Authority / Canonical References (pointers only)

- Kernel and rules: `CLAUDE.md`, `.claude/rules/*.md`. Skills: `.claude/skills/autonomous-run`, `review-commit`.
- Navigation: `docs/CONTEXT_MAP.md`. Current state: `docs/DEV_STATUS.md`.
- Deferred work: `docs/FOLLOW_UP_BACKLOG.md`. Unresolved decisions: `docs/OPEN_QUESTIONS.md`. Accepted decisions: `docs/DECISIONS/**`.
- Findings in scope: OQ-045, OQ-046 (human gates); OQ-047 (boundary, do not resolve); FUB-041; FUB-042 item 1; FUB-043.
- Run010 invariants (26) are supplied by the Run prompt and must not be weakened; accepted ADRs (ADR-016/017) own Today/New Material semantics.
- Run-close verifier / telemetry: `.claude/telemetry/verify-run-close.mjs`, `docs/DEVOS_OBSERVABILITY.md`.

## 3. Gate Policy

Every Slice declares one gate: AUTO, REVIEW_GATE, HUMAN_DECISION_GATE, or FINAL_GATE. Canonical semantics live in
`.claude/skills/autonomous-run/SKILL.md` (not duplicated here).

## 4. Slice Queue

| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Grounding + exact reproduction of known findings | AUTO | PENDING |
| B | OQ-046 — exam-date calendar semantics (decision) | HUMAN_DECISION_GATE | PENDING |
| C | Implement accepted exam-date semantics + FUB-043 naming cleanup if behavior-neutral | REVIEW_GATE | PENDING |
| D | FUB-041 — Practice `topicId` triage and fix | REVIEW_GATE | PENDING |
| E | OQ-045 — ARCHIVED Author self-enrollment (decision) | HUMAN_DECISION_GATE | PENDING |
| F | Apply OQ-045 if required + FUB-042 item 1 last-author concurrency hardening | REVIEW_GATE | PENDING |
| G | Cold-start unseen-question SQL audit | REVIEW_GATE | PENDING |
| H | Integrated local verification + Run close | FINAL_GATE | PENDING |

Do not begin a dependent Slice while its Human Decision Gate is unresolved.

## 5. Run Invariants

- No push, merge, deploy, hosted Supabase mutation, or hosted migration. No Run 011, no unrelated features/refactors.
- No product/architecture/authorization decision made or inferred; OQ-045/046 need explicit human decisions; OQ-047 is not resolved here.
- Exclusions per Run prompt §20 (maintainability refactors, UX polish, telemetry experiments, etc.) stay untouched.

## 6. STOP Conditions

Stop and report on: failed Git preflight; unexpected dirty tree; `PLAN_CONFLICT`; an unresolved OQ required for
implementation; unexpected migration/hosted requirement; product semantics requiring invention; push/merge/deploy need.

## 7. Current Status

- Run identity established; Slice A next. Branch `feature/run-010-learning-intelligence`; no push.

## History

Reports are the archive:

- GOVERNANCE-RECONCILE-001: `docs/RUNS/2026-09-29-GOVERNANCE-RECONCILE-001.md`
- DEVOS-V1.3 Consolidation: `docs/RUNS/2026-09-29-DEVOS-V1.3-CONSOLIDATION.md`
- Run010 Learning Intelligence: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`
- DevOS Micro-Optimization: `docs/RUNS/2026-09-28-DEVOS-MICRO-OPT-001.md`
- UX-03-QA2: `docs/RUNS/2026-09-28-UX-03-QA2.md`; UX-03-QA1: `docs/RUNS/2026-09-27-UX-03-QA1.md`; UX-03: `docs/RUNS/2026-09-27-UX-03.md`; UX-02: `docs/RUNS/2026-09-27-UX-02.md`
- Slice B Pilot Readiness Verification: `docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`

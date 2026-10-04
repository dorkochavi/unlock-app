# UNLOCK — AUTH-RESTORE-HARDENING-001 — Auth-Aware Local Restore

PLAN_VERSION: 014
RUN_ID: 2026-10-04-AUTH-RESTORE-HARDENING-001
START_HEAD: `d052bad`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `d052bad`
STATUS: **IN PROGRESS** — unattended autonomous Run; local/disposable only. Not a product Run.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

---

## 1. Goal

Close or materially narrow the auth-aware backup/restore engineering gap (FUB-009) with the smallest durable, repeatable LOCAL restore
procedure/tooling that restores as much of the real backup as safely possible, including Auth-related state where technically possible.
Evidence before implementation; truthful PARTIAL if Auth cannot be faithfully reconstructed. Optional: telemetry per-Slice attribution WATCH.

## 2. Authority / Canonical References (pointers only)

- Kernel/rules: `CLAUDE.md`, `.claude/rules/*.md` (postgres.md Supabase/Hosted Safety, auth.md Secrets). Skill: `.claude/skills/autonomous-run`.
- State: `docs/DEV_STATUS.md`; FUB-009 in `docs/FOLLOW_UP_BACKLOG.md`; `docs/PILOT_READINESS.md`; prior drill `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-B-restore-drill.md`.
- Baseline (verified): branch `feature/run-010-learning-intelligence`; local HEAD = remote feature = `d052bad`; remote `main` = `be97aba`; `v0.2.0` -> `fff8c40`; tree clean.

## 3. Gate Policy

Canonical semantics: `.claude/skills/autonomous-run/SKILL.md` §7.

## 4. Slice Queue

| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Phase 0 identity + grounding (backup inventory, auth migrations/triggers, FUB-009 + readiness wording) | AUTO | IN PROGRESS |
| B | Restore model: ordering, guards, exact backup-content gap classification | AUTO | PENDING |
| C | Implementation: local-only restore/validate tooling + safety-guard tests | REVIEW_GATE | PENDING |
| D | Real local drill + named negatives | REVIEW_GATE | PENDING |
| E | Fresh independent review; fix + re-review | REVIEW_GATE | PENDING |
| F | FUB-009 / PILOT_READINESS reconciliation | AUTO | PENDING |
| G | Optional: telemetry CURRENT_SLICE attribution WATCH | AUTO | PENDING |
| H | Run close (docs, verifier, local commits; no push) | FINAL_GATE | PENDING |

## 5. Run Invariants (each proven, not asserted)

- I1 no hosted DB/Auth mutation. I2 no Production/Vercel mutation. I3 no push/merge/tag. I4 no product semantics changed.
- I5 restore targets are disposable, local, and tooling rejects non-local hosts (incl. query-string/userinfo bypass). I6 no secrets in repo.
- I7 no false PASS: incomplete backup/omitted Auth never reports full recovery. I8 human decisions (owner/frequency/RPO/RTO/plan/PITR) not closed.

## 6. STOP Conditions

`BASELINE_CONFLICT`, `PLAN_CONFLICT`, `TOOLING_BLOCKER`, `HUMAN_APPROVAL_REQUIRED: <X>`; harness denials are not worked around; a non-global blocker stops only the affected path.

## 7. Current Status

- Slice A in progress.

## History

Reports are the archive:

- PILOT-HARDENING-EVIDENCE-001: `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001.md`
- PILOT-HARDENING-EVIDENCE-001: `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001.md` (+ slice evidence B-E in the same folder)
- QA-CLEANUP-001: `docs/RUNS/2026-10-03-QA-CLEANUP-001.md`
- POST-RUN010-PRODUCT-FIX-001 (incl. "Release close", v0.2.0): `docs/RUNS/2026-10-03-POST-RUN010-PRODUCT-FIX-001.md`
- GOVERNANCE-RECONCILE-001: `docs/RUNS/2026-09-29-GOVERNANCE-RECONCILE-001.md`
- DEVOS-V1.3 Consolidation: `docs/RUNS/2026-09-29-DEVOS-V1.3-CONSOLIDATION.md`
- Run010 Learning Intelligence: `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`
- DevOS Micro-Optimization: `docs/RUNS/2026-09-28-DEVOS-MICRO-OPT-001.md`
- UX-03-QA2: `docs/RUNS/2026-09-28-UX-03-QA2.md`; UX-03-QA1: `docs/RUNS/2026-09-27-UX-03-QA1.md`; UX-03: `docs/RUNS/2026-09-27-UX-03.md`; UX-02: `docs/RUNS/2026-09-27-UX-02.md`
- Slice B Pilot Readiness Verification: `docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`

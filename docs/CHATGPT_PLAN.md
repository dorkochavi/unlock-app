# UNLOCK — Pilot Clean Slate Reset (Audit + Dry-Run)

PLAN_VERSION: 049
RUN_ID: 2026-10-10-PILOT-CLEAN-SLATE-RESET-001
START_HEAD: `0f18123`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `0f18123`
STATUS: **COMPLETE — STOP.** AUDIT + DRY-RUN ONLY. No hosted mutation, no delete/truncate, no Auth user deletion, no push.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**`.

## 1. Goal

Produce an exact, reversible, human-approved Clean Slate reset plan and read-only dry-run inventory for the current hosted Pilot/Production data, while preserving one human-owned Instructor/Admin account.

## 2. Hard invariants

- audit + dry-run only; destructive execution is a separate human-approved step after this Run
- preserved account identifier is supplied by the human at execution time, never committed
- no schema change, migration, seed redesign, or product code change (product change needed => PLAN_CONFLICT)
- dry-run is the default; destructive mode must never be default
- Auth cleanup, SQL cleanup, and storage cleanup are separate boundaries
- no push

## 3. Slices

| Slice | Scope | Status |
|---|---|---|
| A1 | Schema / ownership / backup audit | DONE |
| A2 | Dry-run inventory artifact + runbook | DONE |
| Z | Review, verify, docs, close, commit | DONE |

## History

- PILOT-CLEAN-SLATE-RESET-001: `docs/RUNS/2026-10-10-PILOT-CLEAN-SLATE-RESET-001.md` (COMPLETE)
- PILOT-FUB-068-EDITOR-SAFETY-001: `docs/RUNS/2026-10-10-PILOT-FUB-068-EDITOR-SAFETY-001.md` (COMPLETE)

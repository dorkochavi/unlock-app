# UNLOCK — Pilot FUB-068 Editor Safety

PLAN_VERSION: 048
RUN_ID: 2026-10-10-PILOT-FUB-068-EDITOR-SAFETY-001
START_HEAD: `588ec1e`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `c2fcb72`
STATUS: **COMPLETE — STOP.** Small Pilot-safety product Run: Instructor Question Editor only.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**`.

## 1. Goal

Implement the human-approved FUB-068 Option B so instructors cannot silently lose dirty Question Editor work through editor-controlled exits, and cannot silently publish a stale saved version while unsaved edits are visible.

## 2. Hard invariants

- bounded to the Question Editor surface (`src/app/instructor/courses/[courseId]/questions/[questionId]/**`)
- no localStorage / sessionStorage / autosave / draft recovery
- no change to QuestionVersion model, Save/Publish semantics, learner behavior, import, Course lifecycle, schema, API contracts, dependencies
- Publish while dirty: block + explicit Hebrew "Save first" feedback (no save-then-publish)
- no real-browser claims without a real-browser test; no push

## 3. Slices

| Slice | Scope | Status |
|---|---|---|
| S1 | Dirty guard (beforeunload, Back, Create Another) + dirty-Publish block + tests | DONE |
| Z | Review, verify, reconcile docs, close, commit | DONE |

## History

- PILOT-FUB-068-EDITOR-SAFETY-001: `docs/RUNS/2026-10-10-PILOT-FUB-068-EDITOR-SAFETY-001.md` (COMPLETE)
- DEVOS-V1-3-ALIGNMENT-001: `docs/RUNS/2026-10-10-DEVOS-V1-3-ALIGNMENT-001.md` (COMPLETE)

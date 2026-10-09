# UNLOCK — ASSESSMENT-ENGINE-009 — Fresh Held-Out v0.4 Validation

PLAN_VERSION: 043
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-009
START_HEAD: `73d8767`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `73d8767`
STATUS: **IN PROGRESS.** VALIDATION Run (not implementation). Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI call/UI or API change.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
AUTHOR → LABEL (independent) → LABEL REVIEW → CONTAMINATION AUDIT → FREEZE (V04_FREEZE_HEAD) → EVALUATE CURRENT LINTER UNCHANGED → CLASSIFY → REPORT → INDEPENDENT REVIEW → CLOSE. Evidence class: FRESH_HELD_OUT_V0_4 (never FIRST_BLIND; never pooled with v0.1/v0.2/v0.3/HUMAN_ADJUDICATED_V0_3).

## 2. Hard invariants
- NO change to question-lint.ts, text-normalize.ts, thresholds, phrase lists, rule ownership, normalization. No post-hoc tuning. After V04_FREEZE_HEAD no corpus/label/author-intent/label-review edits.
- Immutable: heldout-v0-3 (corpus/labels/human overlay/hashes), heldout-v0-2, v0.1 labels, FIRST_BLIND records. No schema/dependency/API/UI change.
- Role separation: distinct fresh workers for author, label, label review, evaluation/classification, independent review. Author never sees linter output, old FP/FN case IDs, or question-lint.ts. Labels frozen before any linter run.
- Integration readiness is not set READY merely on synthetic validation.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Author corpus + author-intent | AUTO | TODO |
| B | Independent labels | AUTO | TODO |
| C | Label review + change log | AUTO | TODO |
| D | Contamination audit + replacements | AUTO | TODO |
| E | Freeze (V04_FREEZE_HEAD), manifest, v0.4 tests | AUTO | TODO |
| F | Evaluate, classify, v0.4 report | AUTO | TODO |
| Z | Independent review (review-commit) + fixes | REVIEW_GATE | TODO |
| Z2 | Docs reconcile, verification, Run close | FINAL_GATE | TODO |

## History

- ASSESSMENT-ENGINE-009 (this Run; Run report written at close)
- ASSESSMENT-ENGINE-008: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-008.md` (Run report; COMPLETE)
- ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001.md`
- ASSESSMENT-ENGINE-007: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-007.md`
- ASSESSMENT-ENGINE-006: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-006.md`
- ASSESSMENT-ENGINE-005: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-005.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001.md`
- BROWSER-ISOLATION-STUDY-001: `docs/RUNS/2026-10-09-BROWSER-ISOLATION-STUDY-001.md`
- DESIGN-AUDIT-FOLLOWUP-001: `docs/RUNS/2026-10-09-DESIGN-AUDIT-FOLLOWUP-001.md`
- ASSESSMENT-ENGINE-004: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-004.md`
- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`

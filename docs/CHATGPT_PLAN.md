# UNLOCK — ASSESSMENT-ENGINE-007 — Fresh Held-Out v0.3 Validation

PLAN_VERSION: 039
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-007
START_HEAD: `928f314`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `9ba123c`
STATUS: **COMPLETE - STOP.** Run report: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-007.md`; evidence `docs/ASSESSMENT_HELDOUT_V0_3.md`. Evaluation Run. Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/UI or import wiring.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
DESIGN FRESH CORPUS → INDEPENDENT LABEL → LABEL REVIEW → FREEZE (V03_FREEZE_HEAD) → EVALUATE FROZEN CURRENT LINTER → FAILURE CLASSIFICATION → HUMAN REVIEW QUEUE → VALIDATION VERDICT → CLOSE. Core question: do the Run 006 decisions (OPTION_ABSOLUTE_TERM split, KEY_STEM_LEXICAL_OVERLAP no-emit, STEM_TOO_SHORT narrowing) generalize to fresh unseen cases? Evidence identity: FRESH_HELD_OUT_V0_3 (model-authored, model-labeled; not human ground truth; never pooled with v0.1/v0.2/FIRST_BLIND).

## 2. Hard invariants
- Linter FROZEN: `question-lint.ts`, `text-normalize.ts`, thresholds, term lists, severity, rule ownership, implemented rule list unchanged for the whole Run. No tuning from v0.3; defects are classified and routed to a future Run.
- Labels written before the linter sees v0.3; corpus + labels + manifest/hashes committed (V03_FREEZE_HEAD) before evaluation; immutable afterwards; no retroactive relabeling (disagreement is classified, LABEL_QUESTION).
- Fresh means fresh: no v0.1/v0.2 items copied or cosmetically reworded.
- v0.2 corpus, human overlay, Run 004 FIRST_BLIND record untouched. Integration stays NOT_READY unless canonical criteria are met.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Corpus design + AUTHOR worker (blind to linter and v0.1/v0.2 text) | AUTO | DONE |
| B | LABEL worker (blind to linter/outputs/results tables) | AUTO | DONE |
| C | Independent LABEL REVIEW worker; resolve before freeze | AUTO | DONE |
| C2 | Freshness remediation (mechanical overlap check; pre-freeze replacement) | AUTO | DONE |
| D | Freeze: heldout-v0-3 files + manifest/hashes, commit (V03_FREEZE_HEAD) | AUTO | DONE |
| E (E1 harness+run, E2 classification/report) | Evaluate frozen linter via existing harness (generic extension only if needed); failure classification; human review queue; verdicts | AUTO | DONE |
| Z / Z2 | Independent general review (KEEP), verification, docs, Run close | FINAL_GATE | DONE |

## 4. Docs targets
`docs/ASSESSMENT_HELDOUT_V0_3.md` (new), `docs/ASSESSMENT_ENGINE.md`, `docs/FOLLOW_UP_BACKLOG.md`, `docs/DEV_STATUS.md`, this Plan, `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-007.md`.

## History

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

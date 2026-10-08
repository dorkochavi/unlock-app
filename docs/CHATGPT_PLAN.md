# UNLOCK — ASSESSMENT-ENGINE-004 — Blind Held-Out Evaluation (FUB-063)

PLAN_VERSION: 029
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-004
START_HEAD: `170ed8c`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `170ed8c`
STATUS: **IN PROGRESS** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Create and evaluate a genuinely NEW assessment-quality corpus (Golden Dataset v0.2 held-out) without tuning the linter to it. Method: AUTHOR → INDEPENDENT LABEL → FREEZE → EVALUATE → REPORT. This is an EVALUATION Run; the held-out corpus is `MODEL_AUTHORED_HELD_OUT` / `MODEL_LABELED_NOT_HUMAN_APPROVED` (not human ground truth, no psychometric or real-course validity).

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI API/Google; linter and UI/import NOT wired. **No edit to `question-lint.ts`, `text-normalize.ts`, thresholds, cue lists or normalization in this Run.** Author never sees linter code, thresholds, v0.1 cases, misses/false positives or calibration details; labeler never sees linter code/output or v0.1 labels. After `HELD_OUT_FREEZE_HEAD` no edit to held-out cases or labels based on linter results (a later defect is recorded as evaluation-invalidating evidence, not patched). v0.1 (DEV/CALIBRATION) and v0.2 (HELD-OUT) are reported separately, never pooled. No Ruppin/proprietary/copyrighted/student content.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A1 | Blind HELD_OUT_AUTHOR worker: author corpus (scratchpad, outside repo) | AUTO | PENDING |
| A2 | Independent HELD_OUT_LABELER worker: labels (scratchpad) | AUTO | PENDING |
| A3 | Freeze: mechanical conversion into repo fixture + freeze commit (`HELD_OUT_FREEZE_HEAD`) | REVIEW_GATE | PENDING |
| A4 | First blind evaluation with the unchanged linter; held-out harness/test; per-check TP/FN/FP | REVIEW_GATE | PENDING |
| A5 | FUB-064 verdict, position-rule verdict, human-review queue, readiness reassessment, docs routing | REVIEW_GATE | PENDING |
| Z | Review, verification, Run close | FINAL_GATE | PENDING |

## History

- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`

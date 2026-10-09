# UNLOCK — ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003 — Final Forbidden Decisions (3 emissions)

PLAN_VERSION: 034
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003
START_HEAD: `e742b49`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `e742b49` + Run-close commit (see Git)
STATUS: **COMPLETE + STOP** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Apply Dor's final precision decisions: mark exactly three post-human emissions FORBIDDEN (HO-015 OPTION_ABSOLUTE_TERM, HO-063 OPTION_ABSOLUTE_TERM, HO-076 item 1 KEY_STEM_LEXICAL_OVERLAP) in the post-evaluation overlay so they count as FP in POST_HUMAN. Accounting only; no linter tuning.

## 2. Invariants
No edit to `question-lint.ts`, `text-normalize.ts`, thresholds, cue lists, normalization, the v0.1 dataset, or the frozen held-out files. FIRST_BLIND and the first GENERATED block stay byte-identical. Only 9 of 78 rows are human-reviewed.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| G1 | Overlay forbidden additions (+ per-item forbidden support), three-state generated block, tests, prose | REVIEW_GATE | DONE |
| Z | Independent review, verification, Run close | FINAL_GATE | DONE |

## History

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

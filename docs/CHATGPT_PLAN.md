# UNLOCK — ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002 — Post-Human-Review Consistency Fix (Decision Taxonomy)

PLAN_VERSION: 033
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002
START_HEAD: `131cb28`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `4084291`
STATUS: **COMPLETE + STOP** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Verify that all 9 of Dor's held-out decisions (HUMAN_APPROVED, Dor, 2026-10-09) are represented exactly, and remove the incorrect "ambiguity remaining" language: Dor's decisions are definitive; the only open state is a harness accounting convention (a linter emission neither expected nor forbidden is an UNLABELED_EMISSION). Replace the per-case `cause` vocabulary with HUMAN_DECIDED_LABEL_CHANGE / HUMAN_DECIDED_NO_LABEL_CHANGE / HUMAN_DECIDED_BUT_NO_METRIC_EFFECT / TRUE_REMAINING_AMBIGUITY (expected: none). Metrics are expected to be unchanged; recompute only to prove it.

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI/Google. No edit to `question-lint.ts`, `text-normalize.ts`, thresholds, cue lists, normalization, set heuristics, the v0.1 dataset, the frozen held-out files (`corpus.json`, `labels.json`, `author-intent.json`, `freeze-hashes.json`), or UI/import wiring. FIRST_BLIND numbers and the first GENERATED block stay byte-identical. The overlay changes only if a decision is mis-represented. If a change is NOT a direct fix of a mis-stated decision (e.g. treating a human-declined expectation as a forbidden code, which would change POST_HUMAN FP/UNLABELED counts), it is not applied: it is surfaced as a human choice.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| F1 | Verify the 9 decisions vs overlay/labels; fix taxonomy in harness + test + generated block; prose fixes in held-out doc, Run 001 report, backlog as needed | REVIEW_GATE | DONE |
| Z | Independent review, verification, Run close | FINAL_GATE | DONE |

## History

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

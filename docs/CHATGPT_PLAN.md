# UNLOCK — ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001 — Apply Dor's 9 Held-Out Human Decisions (Post-Evaluation Adjudication)

PLAN_VERSION: 032
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001
START_HEAD: `0f32fec`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `0f32fec`
STATUS: **IN PROGRESS** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/Google contact.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Apply Dor's 9 human review decisions (HUMAN_APPROVED, Dor, 2026-10-09) to the Golden Dataset v0.2 held-out labels as a POST-EVALUATION adjudication; recompute held-out metrics with the UNCHANGED linter; keep the original FIRST-BLIND evidence preserved; update provenance, readiness, FUB-064 verdict and FUB-065 truthfully. NOT a linter-tuning Run.

## 2. Invariants
No push/merge/rebase/tag/deploy/force; no hosted mutation; no migration/schema; no dependency change; no AI/Google. **No edit to `question-lint.ts`, `text-normalize.ts`, thresholds, cue lists, normalization, set-level heuristics, the v0.1 dataset, or UI/import wiring.** The frozen held-out files (`corpus.json`, `labels.json`, `author-intent.json`, `freeze-hashes.json`) stay byte-identical; the corpus is not rewritten. Human decisions are recorded as an overlay (`human-adjudication.json`) applied on top of the frozen labels; FIRST_BLIND numbers stay historical and are never replaced; POST_HUMAN numbers are labeled HUMAN-ADJUDICATED / POST-EVALUATION (blindness no longer fully preserved for the 9 reviewed rows). Only the 9 reviewed rows get `HUMAN_APPROVED`; all others remain `MODEL_LABELED_NOT_HUMAN_APPROVED`. FUB-064 stays recommendation only.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| H1 | Overlay data + harness support for FIRST_BLIND vs POST_HUMAN + tests + regenerated report block | REVIEW_GATE | PENDING |
| H2 | Docs: provenance, metrics delta, readiness, FUB-064 verdict, FUB-065 resolution, human-derived principles | REVIEW_GATE | PENDING |
| Z | Independent review, verification, Run close | FINAL_GATE | PENDING |

## History

- BROWSER-ISOLATION-STUDY-001: `docs/RUNS/2026-10-09-BROWSER-ISOLATION-STUDY-001.md`
- DESIGN-AUDIT-FOLLOWUP-001: `docs/RUNS/2026-10-09-DESIGN-AUDIT-FOLLOWUP-001.md`
- ASSESSMENT-ENGINE-004: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-004.md`
- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`

# UNLOCK — ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001 — Human Adjudication of Queued v0.3 Cases

PLAN_VERSION: 040
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001
START_HEAD: `32ca933`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `32ca933`
STATUS: **IN PROGRESS.** Evidence/adjudication Run, NOT implementation. Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/UI or import wiring.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
VERIFY FROZEN V0.3 → RECORD DOR'S 13 DECISIONS (POST-EVALUATION, NOT BLIND) → SEPARATE HUMAN OVERLAY → RECOMPUTE HUMAN_ADJUDICATED_V0_3 → REASSESS RULE VERDICTS → ROUTE FUBs → CLOSE. Evidence identities stay separate: FRESH_HELD_OUT_V0_3 (frozen model-labeled, unchanged) vs HUMAN_ADJUDICATED_V0_3 (current linter through Dor's decisions; not a fresh blind evaluation). Never pooled.

## 2. Hard invariants
- Immutable: heldout-v0-3 corpus/labels/author-intent/label-review/freeze-hashes, heldout-v0-2, existing human overlays, FIRST_BLIND record, `question-lint.ts`, `text-normalize.ts`, thresholds, rule lists, lint behavior. Dor's decisions live in a SEPARATE overlay only.
- Freeze hashes recomputed and matched before the overlay is written; drift = STOP.
- Packet factual mismatch = HUMAN_DECISION_PACKET_CONFLICT (STOP); Dor's decisions are never reinterpreted.
- Only the 13 queued cases are HUMAN_APPROVED. Semantic cases are not converted to deterministic expectations without Dor's approval.
- Detailed decisions live in the machine-readable overlay (one fact, one home); docs summarize and point.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| H1 | Verify freeze + packet consistency; overlay file; generic POST_HUMAN v0.3 evaluation + tests; commit | AUTO | PENDING |
| H2 | Report section, rule reassessment, FUB routing, docs content | AUTO | PENDING |
| Z | Independent general review | REVIEW_GATE | PENDING |
| Z2 | Reconcile docs, verification, Run close | FINAL_GATE | PENDING |

## History

- ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001.md` (in progress)
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

# UNLOCK — HUMAN_ADJUDICATED_V0_4

PLAN_VERSION: 044
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-4-HUMAN-REVIEW-001
START_HEAD: `a8e9877`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `fcc0ec3`
STATUS: **COMPLETE — STOP.** Human adjudication of all v0.4 review-queue decisions. Post-evaluation overlay only; frozen FRESH_HELD_OUT_V0_4 unchanged. No linter, normalizer, threshold, schema, dependency, API, UI, hosted or deploy change.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**`.

## 1. Goal

Record Dor's decisions for all 14 v0.4 human-review queue rows / 18 case-or-subcase packets as `HUMAN_ADJUDICATED_V0_4`, using a separate post-evaluation overlay. Extend the generic held-out adjudication harness only as needed for SET-level expected/forbidden decisions. Recompute post-human metrics, route evidence to existing FUB owners, close, then STOP.

## 2. Hard invariants

- Frozen v0.4 corpus, labels, author-intent, label-review and freeze hashes unchanged.
- `FRESH_HELD_OUT_V0_4` metrics remain historical and immutable.
- Human evidence is `HUMAN_APPROVED_POST_EVALUATION`, NOT BLIND.
- No change to `question-lint.ts`, `text-normalize.ts`, thresholds or phrase lists.
- No schema/dependency/API/UI/hosted/deploy change.
- Integration remains NOT_READY.

## 3. Slices

| Slice | Scope | Status |
|---|---|---|
| H1 | Encode 17 top-level decisions covering all 18 packets | DONE |
| H2 | Extend generic overlay harness for SET-level human decisions | DONE |
| H3 | HUMAN_ADJUDICATED_V0_4 tests + metrics | DONE |
| H4 | Canonical docs/FUB reconciliation | DONE |
| Z | Verification + Run close | DONE |

## History

- ASSESSMENT-ENGINE-HELDOUT-V0-4-HUMAN-REVIEW-001: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-4-HUMAN-REVIEW-001.md` (Run report; COMPLETE)

- ASSESSMENT-ENGINE-009: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-009.md` (Run report; COMPLETE)
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


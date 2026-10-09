# UNLOCK — ASSESSMENT-ENGINE-008 — Human-Confirmed Deterministic Hardening

PLAN_VERSION: 042
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-008
START_HEAD: `b0bbbc0`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `ab784dc`
STATUS: **COMPLETE — STOP.** Deterministic hardening of `question-lint.ts` justified by HUMAN_ADJUDICATED_V0_3 (post-evaluation, not blind). Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI call/UI or API change. No semantic critic. No KEY_STEM_LEXICAL_OVERLAP; weak-tier absolute terms stay semantic.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
EVIDENCE RECHECK → DESIGN GATES → PRE-REGISTER TESTS (commit) → IMPLEMENT LOWEST-RISK FIXES (one pass) → REGRESSION CHECK → REVIEW → CLOSE. Targets: FUB-077 (OPTION_ALL_OF_ABOVE phrase), FUB-075 safe interrogative family (מהם/מהן), FUB-076 (STEM_NEGATIVE_WORDING narrowing). FUB-075 whole-utterance short-stem classification: Gate A chooses IMPLEMENT_NARROW_STRUCTURAL_RULE or DEFER; defer unless confidence is high.

## 2. Hard invariants
- Immutable: heldout-v0-3 corpus/labels/human overlay/freeze hashes, heldout-v0-2, v0.1 labels, FIRST_BLIND records, previous human overlays. No schema/dependency/API/UI change. No metric-chasing; one implementation pass; no corpus or label edits.
- Reruns on frozen sets are REGRESSION evidence only (never FIRST_BLIND or fresh validation).
- Integration readiness is not set READY by this Run.

## 3. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Design gate: exact contracts for FUB-077/075-safe/076; decision on 075 risky part | AUTO | DONE |
| B | Pre-register contract tests; commit (PRE_REGISTERED_TEST_HEAD) | AUTO | DONE |
| C | Implement in question-lint.ts (one pass) | AUTO | DONE |
| D | Regression metrics before→after | AUTO | DONE |
| Z | Independent review (review-commit) + fixes | REVIEW_GATE | DONE |
| Z2 | Docs reconcile, verification, Run close | FINAL_GATE | DONE |

## History

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

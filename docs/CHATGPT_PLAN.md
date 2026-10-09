# UNLOCK — ASSESSMENT-ENGINE-006 — FUB-066 Context-Sensitive Warning Hardening

PLAN_VERSION: 036
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-006
START_HEAD: `477df82`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `477df82`
STATUS: **IN PROGRESS** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/UI or import wiring.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Resolve FUB-066: EVIDENCE AUDIT → FAILURE TAXONOMY → PER-RULE CONTRACT → PRE-REGISTERED TESTS → MINIMAL HARDENING IF JUSTIFIED → EVALUATION → HUMAN/SEMANTIC ROUTING → CLOSE. Targets: OPTION_ABSOLUTE_TERM, KEY_STEM_LEXICAL_OVERLAP, STEM_TOO_SHORT. Non-implementation outcomes (KEEP/NARROW/SPLIT/SEMANTIC_ONLY/DROP) are valid. Precision over recall. No threshold tuning against v0.2; no change to the frozen corpus, the human overlay, or the historical FIRST_BLIND record.

## 2. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Read-only evidence audit + failure taxonomy + Decision Gate A | AUTO | PENDING |
| B | Per-rule contract + pre-registered tests (separate commit, PRE_REGISTERED_TEST_HEAD) for rules kept deterministic | AUTO | PENDING |
| C | Minimal implementation per Gate A (only if justified) | REVIEW_GATE | PENDING |
| D | Evaluation (contract, v0.1, CURRENT_LINTER_ON_FROZEN_V0_2, POST_HUMAN), human-consistency check, Decision Gate B | AUTO | PENDING |
| Z | Review, verification, docs, Run close | FINAL_GATE | PENDING |

## 3. Accepted human principles (hard constraints)
Token != flaw; symmetry across options is not a cue (HO-017); content-essential quantifiers are not cues (HO-063); natural Hebrew "שום" is not an absolute cue (HO-015); lexical overlap != leakage (HO-076 item 1); short completion stems ending ":" are valid (HO-032).

## History

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

# UNLOCK — FUB-076 STEM_NEGATIVE_WORDING structural design + pre-registration

PLAN_VERSION: 045
RUN_ID: 2026-10-10-ASSESSMENT-ENGINE-010
START_HEAD: `a779ba4`
RUN_STATUS: IN_PROGRESS
LAST_VERIFIED_HEAD: `a779ba4`
STATUS: **IN PROGRESS.** DESIGN + PRE-REGISTRATION ONLY. No linter, normalizer, threshold or phrase-list change. No implementation.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**`.

## 1. Goal

Design and pre-register a structural / question-frame contract for `STEM_NEGATIVE_WORDING` (FUB-076) using existing human-approved evidence, without implementing the rule. Deliver a decision record (including an honest deterministic-vs-semantic ownership verdict), an adversarial CONTRACT_TEST matrix, and an implementation handoff. Then STOP.

Human scope decisions (Dor, 2026-10-10):
1. Direction is STRUCTURAL / QUESTION-FRAME. Do NOT solve FUB-076 by growing a closed Hebrew negation-token list, cue whitelist, exception list or phrase patch.
2. FUB-075 (STEM_TOO_SHORT) is OUT OF SCOPE.

## 2. Hard invariants

- NO change to `question-lint.ts` or `text-normalize.ts`; no threshold or phrase-list change.
- NO corpus / label / human-overlay / freeze-hash mutation. `FRESH_HELD_OUT_V0_4` stays immutable; `HUMAN_ADJUDICATED_V0_4` stays post-evaluation evidence.
- Observed v0.1-v0.4 cases may define regression contracts but are NEVER presented as fresh validation. Any later implementation needs a NEW fresh held-out batch (v0.5) after implementation.
- No schema / dependency / API / UI change; no hosted mutation; no push / merge / deploy / tag.
- No new FUB for a FUB-076 matter; no invented human rulings for unreviewed cases.

## 3. Slices

| Slice | Scope | Status |
|---|---|---|
| D1 | Evidence reconstruction (evidence table) | PENDING |
| D2 | Current-mechanism analysis (fact vs inference) | PENDING |
| D3 | Candidate structural designs (>= 3) | PENDING |
| D4 | Adversarial contract matrix / pre-registration | PENDING |
| D5 | Decision record + implementation handoff | PENDING |
| Z | Independent review, docs reconciliation, verification, Run close | PENDING |

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

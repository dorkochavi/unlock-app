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
| A | Read-only evidence audit + failure taxonomy + Decision Gate A | AUTO | DONE |
| B | Per-rule contract + pre-registered tests (separate commit, PRE_REGISTERED_TEST_HEAD) for rules kept deterministic | AUTO | PENDING |
| C | Minimal implementation per Gate A (only if justified) | REVIEW_GATE | PENDING |
| D | Evaluation (contract, v0.1, CURRENT_LINTER_ON_FROZEN_V0_2, POST_HUMAN), human-consistency check, Decision Gate B | AUTO | PENDING |
| Z | Review, verification, docs, Run close | FINAL_GATE | PENDING |

## 3. Accepted human principles (hard constraints)
Token != flaw; symmetry across options is not a cue (HO-017); content-essential quantifiers are not cues (HO-063); natural Hebrew "שום" is not an absolute cue (HO-015); lexical overlap != leakage (HO-076 item 1); short completion stems ending ":" are valid (HO-032).


## 4. Decision Gate A (Slice A audit; decided by parent from audit evidence + accepted human principles)
Audit basis: per-rule metrics (not pooled), CURRENT_LINTER_ON_FROZEN_V0_2 / POST_HUMAN / v0.1: OPTION_ABSOLUTE_TERM 9/0/1/6 and 7/0/4/5 (v0.1 3/0/0); KEY_STEM_LEXICAL_OVERLAP 0/1/0/3 and 0/1/1/2 (v0.1 4/1/0); STEM_TOO_SHORT 2/0/1/7 and 2/0/1/7 (v0.1 1/0/0). Guards are justified by the human principles (symmetry, content-essential, natural form, overlap != leakage), not by v0.2 scores; no number is tuned on v0.2; any claim is CONTRACT_TEST + regression only, never fresh validation.
- **OPTION_ABSOLUTE_TERM → SPLIT.** Deterministic: strong frequency/totality adverbs only (always, never, תמיד, לעולם, אף פעם, completely, entirely, בהכרח) in a DISTRACTOR option, only when not every option carries a strong term and the key carries none. Weak quantifier/exclusive tier (כל, שום, רק, בלבד, all, only, every, none, אף אחד) leaves deterministic ownership → HUMAN_REVIEW / AI_OPTIONAL (content-essential vs cue-like).
- **KEY_STEM_LEXICAL_OVERLAP → MOVE_TO_SEMANTIC/HUMAN (stop deterministic emission).** No natural held-out true positive exists (0 TP; HO-076 item1 human-FORBIDDEN, item9/HO-051 contested); the only surviving guard is a share threshold tuned from peeked evidence. Route: AI_REQUIRED / HUMAN_REVIEW. Cost accepted: v0.1 authored positives (3) become misses.
- **STEM_TOO_SHORT → NARROW_DETERMINISTICALLY.** Do not fire for a short stem that begins with a closed-class interrogative (or imperative) word, or ends with ":" (HO-032 form). Still fires for bare nouns/fragments. General brevity concern → HUMAN_REVIEW. The 4-word constant is not changed.

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

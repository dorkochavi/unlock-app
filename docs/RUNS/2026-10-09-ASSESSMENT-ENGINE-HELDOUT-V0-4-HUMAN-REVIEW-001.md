# Run Report — 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-4-HUMAN-REVIEW-001

Status: `COMPLETE`. Human-adjudication / evidence-reconciliation Run. No push at report creation; no deploy, hosted mutation, migration, schema, dependency, API or UI change.
START_HEAD `a8e9877`. LAST_VERIFIED_HEAD `fcc0ec3` = evidence/harness/test commit verified by assessment suite, typecheck and eslint before documentation close. END_HEAD is derived from Git after the closing commit and is intentionally not self-cited here.

## Goal

Record Dor's final decisions for the complete v0.4 human-review queue as `HUMAN_ADJUDICATED_V0_4`, post-evaluation and not blind, without changing frozen FRESH_HELD_OUT_V0_4 evidence or tuning the linter.

## Decisions

All 14 queue rows / 18 case-or-subcase packets were adjudicated. They are encoded as 17 top-level decisions because HO4-075/item7 is nested inside the HO4-075 SET decision.

Key human principles:
- Negation token != negative-stem flaw; relative/content/contrast negation is acceptable unless negation controls answer selection.
- Clear imperative instruction is a valid stem without a question mark.
- Bare noun-phrase fragments remain flawed even when their intended task is guessable.
- Weak absolute terms are contextual; distinctive asymmetric stem-key echo can be a real semantic defect without restoring a broad deterministic overlap rule.
- Exactly 5/10 longest keys is insufficient evidence for SET_KEY_LENGTH_BIAS.
- QUESTION_TYPE_MONO is informational, not a scored flaw.
- Hebrew normalization must not collapse distinct words such as כתב / מכתב into an overlap defect.

## HUMAN_ADJUDICATED_V0_4

75 cases: 29 CLEAN / 46 FLAWED.
Expected deterministic detections: 88.
TP 46.
FN 42 = 1 HEURISTIC_GAP + 41 NOT_IMPLEMENTED.
FP 8.
UNLABELED 0.
CLEAN warned: 6/29.

Rule highlights:
- STEM_NEGATIVE_WORDING: expected 6 / TP 5 / FN 1 / FP 5 / UNL 0. FUB-076 REOPENED.
- STEM_TOO_SHORT: expected 4 / TP 4 / FN 0 / FP 1. HO4-042 human-confirmed FP.
- SET_KEY_LENGTH_BIAS: expected 0 / FP 1. HO4-075 human-confirmed FP.
- OPTION_OVERLAP_HIGH: HO4-075/item7 human-confirmed FP.
- FRESH_HELD_OUT_V0_4 historical numbers are unchanged and never pooled with this overlay.

## Code / evidence changes

- Added `src/domain/assessment/golden/heldout-v0-4/human-adjudication.json`.
- Added `src/domain/assessment/__tests__/heldout-v0-4-human-adjudication.test.ts`.
- Extended generic `heldout-eval.ts` human-overlay plumbing to support SET-level remove/add expected codes, SET-level forbidden codes and explicit forbidden emissions on previously-unlabelled SET items.
- No linter behavior, normalization, threshold, phrase list, corpus, frozen label or freeze-hash change.

## FUB routing

- FUB-074: semantic ownership unchanged; v0.4 human fixtures added.
- FUB-075: remains PARTIALLY_RESOLVED_IMPLEMENTATION; HO4-042 confirms the whole-utterance/imperative classification problem.
- FUB-076: REOPENED. Fresh Hebrew evidence plus human rulings confirm the Run 008 token subtraction did not generalize.
- FUB-077: remains RESOLVED_IMPLEMENTED; no new evidence for the specific Run 008 phrase variants.
- FUB-059: HO4-075/item7 routed to the existing Hebrew overlap/normalization residual.
- FUB-067: HO4-075 independently repeats the human judgement that 5/10 longest keys is insufficient.

## Verification

Evidence commit `fcc0ec3`:
- HUMAN_ADJUDICATED_V0_4 test: 12/12 passed.
- Full assessment suite: 13 files / 415 tests passed.
- TypeScript `tsc --noEmit`: clean.
- ESLint on changed TypeScript: clean.
- Frozen v0.4 files unchanged.
- `question-lint.ts`: unchanged.
- `text-normalize.ts`: unchanged.

## Integration readiness

`NOT_READY`. The human overlay strengthens precision/design evidence but does not provide real instructor data, semantic-critic implementation, psychometric validation or wiring evidence.

## Next

STOP after repository synchronization. A future Run may design and pre-register the structural/question-frame contract for FUB-076. Do not implement or tune it in this Run.

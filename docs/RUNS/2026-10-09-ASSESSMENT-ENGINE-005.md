# Run Report — 2026-10-09-ASSESSMENT-ENGINE-005

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted mutation, migration, schema or dependency change; no AI API; no UI/import wiring).
START_HEAD `db5bfc7`; PRE_REGISTERED_TEST_HEAD `b66c59e`; LAST_VERIFIED_HEAD `eccfd75`. Commits unpushed and not deployed.

## Decision
Gate A: IMPLEMENT. Gate B: KEEP (advisory WARNING, unwired). FUB-064: RESOLVED_IMPLEMENTED.

## Evidence
HO-026 (HE) option d "תשובות א ו-ג נכונות"; HO-027 "Both a and c"; HO-064 (MULTIPLE_CHOICE) "Both a and b"; v0.1 WEAK-COMBINATION-EN-01 "Both A and B". Structural, deterministic, position-dependent.

## Contract (Plan section 4)
Option wholly of the form [filler] cue [filler] >= 2 distinct references to other options of the same item. Cues: both/option(s)/answer(s)/choice(s), תשובה/תשובות/אפשרות/אפשרויות (+ definite forms). References: Latin letter (id match first, else ordinal a-h) or Hebrew letter א-ח with optional vav prefix. Both question types; WARNING; `tokenize` reused, `text-normalize.ts` untouched. Non-covered: cue-less "A and B", ordinal phrases, numeric refs.

## Pre-registration
17 contract tests (6 positive-group, 11 negative/non-target) committed at `b66c59e` with the positives red. Tests changed after implementation: NO (`git diff b66c59e` on the file is empty). One Plan-text correction after implementation: the bare Hebrew filler "ה" was listed in the contract but never implemented or tested; removed from the Plan text (no test affected).

## Implementation
`question-lint.ts` (isCombinationReference, resolveOptionRef, constants; one pass over tokens per option, O(options x tokens), anchored single-token regexes) and `calibration.ts` (IMPLEMENTED_ITEM_CODES). Regression-guard updates (not contract tests): v0.1 knownMiss for WEAK-COMBINATION-EN-01 removed; golden-calibration and heldout-eval expected counts; regenerated generated blocks in the two docs; FN rows for the 3 cases removed from the held-out FN table.

## Evaluation
- Contract tests 17/17; `src/domain/assessment` 252/252.
- v0.1 (CALIBRATION/REGRESSION): TP 67 to 68, FN 6 to 5; 16 negative labels, 0 FP.
- v0.2 (HISTORICAL_HELD_OUT, observed; not fresh validation): HO-026/027/064 now TP; TP 80 to 83, FN 44 to 41 (NOT_IMPLEMENTED 36 to 33); FP and UNLABELED unchanged. Probe over 143 v0.2 items and 89 v0.1 items: exactly 4 emissions, all intended.
- 9 Dor-reviewed (HUMAN_ADJUDICATED regression): no emission, no change; overlay and frozen files unchanged. POST_HUMAN TP 78 to 81, FN 44 to 41, FP 8 and UNLABELED 20 unchanged.
- Failure classification: no unexpected emission or miss.

## Review
Independent general review (`unlock-reviewer`): no blocker or correction; adversarial probes (60+ inputs, perf, hostile input) found no false positive. Non-blocking items addressed: stale "UNCHANGED"/"36 of 44" doc lines annotated; Plan filler corrected; remaining conservative non-fires ("Both a and b are wrong") are consistent with the contract.

## Verification
Focused + assessment tests pass; `npm run typecheck` clean; eslint clean on changed TS files. Full unit suite not run (change confined to the assessment domain, with no shared primitives).

## Routing
FUB-066 untouched. No new FUB (uncovered forms noted in FUB-064 closure).

## Correction (evidence naming, post-close)
The close commit left the held-out harness/doc labelling the frozen-corpus evaluation under the Run-005 linter as "FIRST_BLIND". That was wrong: FIRST_BLIND is the historical Run 004 event (TP 80 / FN 44 / FP 4 / UNLABELED 22) and cannot be recomputed after the linter changed. Renamed to `CURRENT_LINTER_ON_FROZEN_V0_2` (harness field `currentLinterOnFrozen`, `compareFrozenAndPostHuman`, generated column headers, doc headings) with the historical record pinned in the held-out doc header and a test. Current numbers (TP 83 / FN 41 / FP 4 / UNLABELED 22) are regression evidence. No linter, threshold, corpus, label, overlay or metric change.

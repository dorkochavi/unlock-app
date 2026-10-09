# Run Report — 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `e742b49`. Commits unpushed and not deployed; `origin/main` is not Production.

## Goal
Apply Dor's final precision decisions (HUMAN_APPROVED: Dor, 2026-10-09): HO-015 OPTION_ABSOLUTE_TERM, HO-063 OPTION_ABSOLUTE_TERM and HO-076 item-1 KEY_STEM_LEXICAL_OVERLAP are FORBIDDEN (real false positives).

## Result
Overlay-only: `addForbiddenCodes` (ITEM) and `addForbiddenItemCodes` (SET item, new `forbiddenItemCodes` label field, overlay-only) added; frozen labels untouched. Forbidden-only additions are not label changes (HO-015/HO-076 stay NO_LABEL_CHANGE with METRIC_EFFECT). The generated block now shows three states.

| Measure | FIRST_BLIND | POST_HUMAN_BEFORE_FINAL_FORBIDDEN | POST_HUMAN_FINAL |
|---|---|---|---|
| Expected / TP / FN | 124 / 80 / 44 | 122 / 78 / 44 | 122 / 78 / 44 |
| FP | 4 | 5 | 8 |
| CLEAN warned | 3 of 20 | 4 of 20 | 4 of 20 |
| UNLABELED_EMISSION | 22 | 23 | 20 |
| ITEM-in-SET FP | 0 | 0 | 1 |

Delta FINAL vs BEFORE_FINAL: FP +3, UNLABELED -3; nothing else moved. Linter output unchanged.

## Provenance / FUB-065
Only the 9 reviewed rows are HUMAN_APPROVED (9/78); 69 remain model-labeled. FUB-065 stays RESOLVED for those 9 rows only.

## Review
Independent general review (`unlock-reviewer`): no blocker or correction; one cosmetic duplicate phrase fixed.

## Verification (unit / static, local)
`npx vitest run src/domain/assessment`: 5 files, 235 tests passed. `npm run typecheck`: clean. Frozen files, `question-lint.ts`, `text-normalize.ts`: no diff. Full unit suite not rerun: changes are confined to the held-out harness/test/overlay/docs, with no shared primitives touched.

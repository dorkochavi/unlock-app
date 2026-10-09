# Assessment Linter Held-Out Evaluation - Golden Dataset v0.2

Status: DRAFT evidence artifact. Created in Run `2026-10-09-ASSESSMENT-ENGINE-004`, Slice A4 (FUB-063).
Subject: the UNWIRED deterministic question linter `src/domain/assessment/question-lint.ts` (plus `text-normalize.ts`), UNCHANGED in Run 004 (question-lint.ts was changed later, in Run 005: OPTION_COMBINATION_REFERENCE).
Provenance: corpus `MODEL_AUTHORED_HELD_OUT`; labels `MODEL_LABELED_NOT_HUMAN_APPROVED` for 69 of 78 rows. **Post-evaluation update (Run `2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001`):** 9 rows (HO-049, 070, 076, 017, 015, 063, 032, 069, 073) are `HUMAN_APPROVED` (Dor, 2026-10-09) as a POST-EVALUATION adjudication, applied as an overlay on the unchanged frozen labels (section 14). The FIRST_BLIND evidence in sections 3-13 is preserved as originally written; the POST_HUMAN metrics (section 14) are HUMAN-ADJUDICATED / POST-EVALUATION, never first-blind, never pooled with v0.1.

> **Run 005 note (`2026-10-09-ASSESSMENT-ENGINE-005`, FUB-064):** OPTION_COMBINATION_REFERENCE was implemented after this evaluation was observed. The GENERATED blocks and the FN table below are regenerated against the current linter, so they show HO-026, HO-027 and HO-064 as TP (TP 80 to 83, FN 44 to 41, NOT_IMPLEMENTED FN 36 to 33; no new FP or UNLABELED_EMISSION). The ORIGINAL blind result (TP 80 / FN 44 / FP 4 / UNLABELED 22) is the Run 004 state at `b9aaca4` and its Run report; hand-written prose in sections 3-18 predates Run 005 and cites those original numbers. Run 005 results on these cases are HISTORICAL_HELD_OUT regression evidence, not fresh validation.

## 1. Non-claims

- NOT human ground truth for the corpus. Originally no human reviewed anything (the state of every FIRST_BLIND number below). Since 2026-10-09 exactly 9 of 78 rows are `HUMAN_APPROVED` by one reviewer (Dor) as a post-evaluation adjudication; the other 69 remain `MODEL_LABELED_NOT_HUMAN_APPROVED`. Held-out blindness no longer fully holds for those 9 rows. The corpus text was not edited. Single reviewer, no inter-annotator agreement.
- NO psychometric validity and NO real-course validity: synthetic general-knowledge content only (no Ruppin or other real course content, no student data).
- ONE model author and ONE model labeler: no inter-annotator agreement exists; the annotator pool and agreement protocol remain an open question (ASSESSMENT_ENGINE section 19.5).
- 78 cases cannot support statistics. Every ratio below is INDICATIVE ONLY. A ratio such as `5/5` means "no counter-example in this corpus", not "reliable".
- "Held-out" means held out from the linter work (no tuning against it), not independent of the model family that wrote both the linter and the corpus.
- Sections 1-8 (Slice A4) report measurements and failure classifications only. Sections 9-13 (Slice A5) add RECOMMENDATIONS and verdicts (FUB-064, position rules, clusters, human review queue, readiness). They are advisory: no code, threshold, label or test expectation was changed, and nothing in sections 9-13 is human-approved (annotations marked "Post-human" and sections 14-17 record the later 2026-10-09 adjudication of 9 rows).

## 2. Method

> Residual contamination note (Run 004 review): the labeler vocabulary quoted documented product-default thresholds that the linter also uses (for example OPTION_COUNT_UNUSUAL "fewer than 3 or more than 6", SET_TOO_SMALL "fewer than 8"), so labels for those few codes are not independent of the linter design. The author-intent notes were withheld from the labeler and were read only after the freeze, for author-vs-labeler disagreement counting; no label was changed.

AUTHOR -> LABEL -> FREEZE -> EVALUATE -> REPORT, with NO TUNING.

1. AUTHOR: a blind author worker wrote the corpus (`corpus.json`, 70 ITEM + 8 SET cases) and a candid per-case intent file (`author-intent.json`). Per the Run plan the author never saw linter code, thresholds, v0.1 cases, misses/false positives or calibration details.
2. LABEL: an independent labeler worker labeled every case (`labels.json`: CLEAN|FLAWED, expected/forbidden codes, SET item codes, semantic expectation, rationale, confidence). Per the Run plan the labeler never saw linter code or output, v0.1 labels, or `author-intent.json`.
3. FREEZE: corpus, labels and intent were committed at `FREEZE_HEAD 23fbc1c`; the LF-normalized sha256 of the three files was recorded in `freeze-hashes.json` at `536b94f` (hash record only, no case or label change). The test re-hashes the files and compares.
4. EVALUATE: `runHeldOutEvaluation` (`src/domain/assessment/golden/heldout-eval.ts`) runs the unchanged linter once over the frozen data. The numbers in the test are the FIRST-RUN observed results, recorded as a regression guard, not targets.
5. REPORT: this document. The author/labeler statements above are Run-plan facts; they cannot be verified from the repository alone.

Untouched-linter proof (as of Run 004; no longer empty for question-lint.ts after Run 005): `git diff 536b94f -- src/domain/assessment/question-lint.ts src/domain/assessment/text-normalize.ts src/domain/assessment/golden/heldout-v0-2 src/domain/assessment/golden/golden-dataset-v0-1.ts` is empty.

### Conventions (mirror v0.1 `calibration.ts`; differences marked)

| Term | Definition |
|---|---|
| Expected detection | A label code that must fire (ITEM: `expectedCodes`; SET: `expectedSetCodes` plus every `itemCodes` entry). |
| TP / FN | Expected and emitted / expected and not emitted. FN kind `NOT_IMPLEMENTED` when the linter has no such check (reported separately, not as a heuristic gap), else `HEURISTIC_GAP`. |
| FP | Emitted code listed in `forbiddenCodes`/`forbiddenSetCodes`, OR any emitted code (every linter issue is a WARNING/ERROR) on a CLEAN case. |
| UNLABELED_EMISSION (**new in v0.2**) | Emitted code on a FLAWED case that is neither expected nor forbidden. A label-question / over-flag candidate; NOT counted as FP. v0.1 labels were exhaustive negatives; v0.2 labels list `forbiddenCodes` only for tempting-but-not-applicable cases, so this separate bucket is needed. |
| Semantic-only | FLAWED case with no expected deterministic code and a non-null `semanticExpectation`. Never asserted against the linter. |
| SET mapping | `lintQuestionSet` returns SET-scope issues only, compared with `expectedSetCodes`/`forbiddenSetCodes`. Each item is also run through `lintQuestionItem` and compared with `itemCodes`, keyed by 1-BASED item number (HO-074 labels item "10" of 10). Items not listed in `itemCodes` may emit codes: those are UNLABELED_EMISSION (FP on a CLEAN set). There is no forbidden-item-code list for sets. |
| Precision | v0.1 measured FP only over explicit negatives (NEG). v0.2 has no NEG column; PRECISION-LIKE is TP/(TP+FP) with the FP definition above and ignores UNLABELED_EMISSION. |

## 3. Generated results

<!-- GENERATED:BEGIN formatHeldOutMarkdown (src/domain/assessment/golden/heldout-eval.ts) -->
## Headline (generated)

- RECALL-LIKE (all labelled detections): 83/124 caught.
- FN count: 41 (8 HEURISTIC_GAP on implemented checks, 33 NOT_IMPLEMENTED checks).
- PRECISION-LIKE (labelled detections vs false alarms): 83/87.
- FP count: 4 (forbidden code emitted, or any WARNING/ERROR on a CLEAN case).
- CLEAN cases with a WARNING/ERROR: 3 of 20.
- UNLABELED_EMISSIONS: 22 (emitted on a FLAWED case, neither expected nor forbidden; not counted as FP).
- SEMANTIC-ONLY cases: 12 (FLAWED with no deterministic expectation; not assertable against the linter).
- Model-authored, model-labeled held-out corpus (NOT human ground truth): all ratios are INDICATIVE ONLY and are never pooled with v0.1.

## Case counts (generated)

| Measure | Count |
|---|---|
| Total cases | 78 |
| ITEM cases | 70 |
| SET cases | 8 |
| CLEAN cases | 20 |
| FLAWED cases | 58 |
| Cases with a semanticExpectation | 29 |
| SEMANTIC-ONLY cases | 12 |
| languageReviewRequired | 1 |
| Expected deterministic detections | 124 |
| TP | 83 |
| FN (HEURISTIC_GAP / NOT_IMPLEMENTED) | 41 (8 / 33) |
| FP | 4 |
| CLEAN cases with a WARNING/ERROR | 3 of 20 |
| UNLABELED_EMISSION | 22 |

## Set-level behaviour (generated)

| Level | Expected | TP | FN | FP |
|---|---|---|---|---|
| SET-scope codes (lintQuestionSet) | 17 | 15 | 2 | 1 |
| ITEM codes inside SET cases (lintQuestionItem per item) | 46 | 27 | 19 | 0 |

| SET case | Label | Expected set codes | Emitted set codes | Set TP/FN/FP | Item TP/FN/FP | Unlabeled |
|---|---|---|---|---|---|---|
| HO-071 | FLAWED | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | 2/0/0 | 0/1/0 | 0 |
| HO-072 | FLAWED | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | 2/0/0 | 0/8/0 | 1 |
| HO-073 | FLAWED | - | SET_KEY_LENGTH_BIAS | 0/0/1 | 1/1/0 | 1 |
| HO-074 | FLAWED | DUPLICATE_STEM_EXACT, DUPLICATE_STEM_NORMALIZED, NEAR_DUPLICATE_STEM, KEY_POSITION_IMBALANCE | DUPLICATE_STEM_EXACT, DUPLICATE_STEM_NORMALIZED, KEY_POSITION_IMBALANCE, NEAR_DUPLICATE_STEM | 4/0/0 | 0/5/0 | 0 |
| HO-075 | FLAWED | STEM_TEMPLATE_REPEATED, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN, NEAR_DUPLICATE_STEM, STEM_TEMPLATE_REPEATED | 3/0/0 | 0/0/0 | 1 |
| HO-076 | FLAWED | SET_KEY_LENGTH_BIAS, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | KEY_POSITION_IMBALANCE, KEY_POSITION_RUN, SET_KEY_LENGTH_BIAS | 3/0/0 | 18/0/0 | 4 |
| HO-077 | FLAWED | SET_KEY_LENGTH_BIAS, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN | KEY_POSITION_RUN | 1/2/0 | 3/1/0 | 2 |
| HO-078 | FLAWED | - | - | 0/0/0 | 5/3/0 | 1 |

## Per-check results (generated)

TP = caught, FN = missed, FP = false alarm (forbidden, or any code on a CLEAN case), UNLAB = unlabeled emission on a FLAWED case (not an FP).

| Check code | Implemented | Expected | TP | FN | FP | UNLAB | PRECISION-LIKE | RECALL-LIKE |
|---|---|---|---|---|---|---|---|---|
| CORRECT_COUNT_INVALID | yes | 2 | 2 | 0 | 0 | 0 | 2/2 | 2/2 |
| CORRECT_ID_UNKNOWN | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| DUPLICATE_STEM_EXACT | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| DUPLICATE_STEM_NORMALIZED | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| EXPLANATION_MISSING | yes | 5 | 5 | 0 | 0 | 0 | 5/5 | 5/5 |
| EXPLANATION_NAMES_ONLY_KEY | NO | 9 | 0 | 9 | 0 | 0 | n/a | 0/9 |
| KEY_LONGEST_OPTION | yes | 22 | 18 | 4 | 0 | 0 | 18/18 | 18/22 |
| KEY_POSITION_IMBALANCE | yes | 6 | 5 | 1 | 0 | 0 | 5/5 | 5/6 |
| KEY_POSITION_RUN | yes | 5 | 5 | 0 | 0 | 0 | 5/5 | 5/5 |
| KEY_STEM_LEXICAL_OVERLAP | yes | 1 | 0 | 1 | 0 | 3 | n/a | 0/1 |
| NEAR_DUPLICATE_STEM | yes | 1 | 1 | 0 | 0 | 1 | 1/1 | 1/1 |
| OPTIONS_TOO_FEW | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| OPTION_ABSOLUTE_TERM | yes | 9 | 9 | 0 | 1 | 6 | 9/10 | 9/9 |
| OPTION_ALL_OF_ABOVE | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| OPTION_COMBINATION_REFERENCE | yes | 3 | 3 | 0 | 0 | 0 | 3/3 | 3/3 |
| OPTION_COUNT_UNUSUAL | NO | 1 | 0 | 1 | 0 | 0 | n/a | 0/1 |
| OPTION_DUPLICATE_EXACT | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| OPTION_LENGTH_IMBALANCE | yes | 15 | 15 | 0 | 0 | 3 | 15/15 | 15/15 |
| OPTION_NONE_OF_ABOVE | yes | 3 | 3 | 0 | 0 | 0 | 3/3 | 3/3 |
| OPTION_NUMERIC_UNORDERED | NO | 9 | 0 | 9 | 0 | 0 | n/a | 0/9 |
| OPTION_OVERLAP_HIGH | yes | 0 | 0 | 0 | 1 | 1 | 0/1 | n/a |
| OPTION_PREFIX_STEM_REPEAT | NO | 1 | 0 | 1 | 0 | 0 | n/a | 0/1 |
| OPTION_PUNCTUATION_INCONSISTENT | NO | 3 | 0 | 3 | 0 | 0 | n/a | 0/3 |
| OPTION_STYLE_OUTLIER | NO | 5 | 0 | 5 | 0 | 0 | n/a | 0/5 |
| OPTION_WHITESPACE_ANOMALY | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| SET_KEY_LENGTH_BIAS | yes | 2 | 1 | 1 | 1 | 0 | 1/2 | 1/2 |
| STEM_DOUBLE_NEGATIVE | NO | 2 | 0 | 2 | 0 | 0 | n/a | 0/2 |
| STEM_NEGATIVE_WORDING | yes | 7 | 6 | 1 | 0 | 1 | 6/6 | 6/7 |
| STEM_NO_QUESTION_FORM | NO | 3 | 0 | 3 | 0 | 0 | n/a | 0/3 |
| STEM_TEMPLATE_REPEATED | yes | 1 | 1 | 0 | 0 | 0 | 1/1 | 1/1 |
| STEM_TOO_SHORT | yes | 2 | 2 | 0 | 1 | 7 | 2/3 | 2/2 |

## False negatives (generated)

| Ref | Level | Code | Kind |
|---|---|---|---|
| HO-017 | ITEM | OPTION_PREFIX_STEM_REPEAT | NOT_IMPLEMENTED |
| HO-022 | ITEM | STEM_DOUBLE_NEGATIVE | NOT_IMPLEMENTED |
| HO-022 | ITEM | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-029 | ITEM | OPTION_PUNCTUATION_INCONSISTENT | NOT_IMPLEMENTED |
| HO-029 | ITEM | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED |
| HO-029 | ITEM | KEY_LONGEST_OPTION | HEURISTIC_GAP |
| HO-030 | ITEM | STEM_NO_QUESTION_FORM | NOT_IMPLEMENTED |
| HO-031 | ITEM | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-034 | ITEM | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-035 | ITEM | OPTION_PUNCTUATION_INCONSISTENT | NOT_IMPLEMENTED |
| HO-039 | ITEM | OPTION_COUNT_UNUSUAL | NOT_IMPLEMENTED |
| HO-049 | ITEM | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED |
| HO-049 | ITEM | KEY_LONGEST_OPTION | HEURISTIC_GAP |
| HO-055 | ITEM | KEY_STEM_LEXICAL_OVERLAP | HEURISTIC_GAP |
| HO-057 | ITEM | STEM_NO_QUESTION_FORM | NOT_IMPLEMENTED |
| HO-057 | ITEM | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-063 | ITEM | STEM_NEGATIVE_WORDING | HEURISTIC_GAP |
| HO-067 | ITEM | OPTION_PUNCTUATION_INCONSISTENT | NOT_IMPLEMENTED |
| HO-068 | ITEM | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED |
| HO-070 | ITEM | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED |
| HO-071/item3 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-072/item1 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item2 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item3 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item5 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item6 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item7 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item8 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-072/item9 | ITEM_IN_SET | OPTION_NUMERIC_UNORDERED | NOT_IMPLEMENTED |
| HO-073/item8 | ITEM_IN_SET | KEY_LONGEST_OPTION | HEURISTIC_GAP |
| HO-074/item3 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-074/item4 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-074/item6 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-074/item7 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-074/item10 | ITEM_IN_SET | EXPLANATION_NAMES_ONLY_KEY | NOT_IMPLEMENTED |
| HO-077 | SET | SET_KEY_LENGTH_BIAS | HEURISTIC_GAP |
| HO-077 | SET | KEY_POSITION_IMBALANCE | HEURISTIC_GAP |
| HO-077/item2 | ITEM_IN_SET | KEY_LONGEST_OPTION | HEURISTIC_GAP |
| HO-078/item2 | ITEM_IN_SET | STEM_DOUBLE_NEGATIVE | NOT_IMPLEMENTED |
| HO-078/item3 | ITEM_IN_SET | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED |
| HO-078/item5 | ITEM_IN_SET | STEM_NO_QUESTION_FORM | NOT_IMPLEMENTED |

## False positives (generated)

| Ref | Level | Code | Basis |
|---|---|---|---|
| HO-001 | ITEM | STEM_TOO_SHORT | CLEAN_CASE |
| HO-011 | ITEM | OPTION_ABSOLUTE_TERM | FORBIDDEN |
| HO-012 | ITEM | OPTION_OVERLAP_HIGH | CLEAN_CASE |
| HO-073 | SET | SET_KEY_LENGTH_BIAS | FORBIDDEN |

## Unlabeled emissions (generated)

| Ref | Level | Code |
|---|---|---|
| HO-015 | ITEM | OPTION_ABSOLUTE_TERM |
| HO-020 | ITEM | STEM_TOO_SHORT |
| HO-023 | ITEM | OPTION_LENGTH_IMBALANCE |
| HO-027 | ITEM | OPTION_ABSOLUTE_TERM |
| HO-027 | ITEM | OPTION_LENGTH_IMBALANCE |
| HO-031 | ITEM | OPTION_OVERLAP_HIGH |
| HO-041 | ITEM | STEM_TOO_SHORT |
| HO-042 | ITEM | STEM_TOO_SHORT |
| HO-051 | ITEM | KEY_STEM_LEXICAL_OVERLAP |
| HO-051 | ITEM | OPTION_ABSOLUTE_TERM |
| HO-052 | ITEM | OPTION_ABSOLUTE_TERM |
| HO-055 | ITEM | OPTION_ABSOLUTE_TERM |
| HO-072/item3 | ITEM_IN_SET | STEM_TOO_SHORT |
| HO-073/item8 | ITEM_IN_SET | STEM_NEGATIVE_WORDING |
| HO-075 | SET | NEAR_DUPLICATE_STEM |
| HO-076/item1 | ITEM_IN_SET | KEY_STEM_LEXICAL_OVERLAP |
| HO-076/item4 | ITEM_IN_SET | STEM_TOO_SHORT |
| HO-076/item6 | ITEM_IN_SET | STEM_TOO_SHORT |
| HO-076/item9 | ITEM_IN_SET | KEY_STEM_LEXICAL_OVERLAP |
| HO-077/item1 | ITEM_IN_SET | OPTION_ABSOLUTE_TERM |
| HO-077/item4 | ITEM_IN_SET | OPTION_LENGTH_IMBALANCE |
| HO-078/item8 | ITEM_IN_SET | STEM_TOO_SHORT |

## Semantic-only cases (generated)

| Case | semanticExpectation |
|---|---|
| HO-028 | Options a and b (kind and well-meaning; generous and caring) are near-synonyms; two arguably correct. |
| HO-033 | Distractors Pizza, Gold, Tuesday are absurd and trivialize the item. |
| HO-042 | Key (Istanbul) is factually wrong; explanation says Ankara. Key contradicts explanation. |
| HO-044 | The Sun is the closest star to Earth and is listed; key Proxima Centauri is wrong/ambiguous for this stem. |
| HO-045 | Multiple defensible causes (demand-pull, cost-push, money supply); ambiguous contested key. |
| HO-046 | Trick question: every month has at least 28 days, answer 12 is a riddle rather than assessing knowledge. |
| HO-047 | Stem combines an essay-style analyze critically directive with a simple recall question; cognitive-level/stem mismatch. Distractor "hadil hogen" is awkward Hebrew. |
| HO-056 | Key (Ribosome) is wrong and contradicts the explanation naming mitochondrion. |
| HO-058 | Trick riddle (feathers vs iron); tests wording not knowledge. |
| HO-061 | Options a and b both correct (rule by the people vs through elected representatives); explanation admits the representative form. |
| HO-062 | Explanation wrongly attributes 1/12 to wrong addition (adding gives 1/3). |
| HO-065 | Option d "cannot be determined" does not grammatically complete "the price will"; mismatch with stem. |
<!-- GENERATED:END -->

## 4. DEV (v0.1) vs HELD-OUT (v0.2), side by side, NOT pooled

The v0.1 corpus is DEV/CALIBRATION data: the linter was iterated against it (Run 003 rule fixes), and 17 rows had a single human reviewer. v0.2 is the first measurement on data the linter was never adjusted to. The two columns use different label sources and slightly different FP definitions; do not add them up and do not read the difference as a quality delta.

| Measure | DEV v0.1 (`ASSESSMENT_CALIBRATION_V0_1.md`) | HELD-OUT v0.2 (this report) |
|---|---|---|
| Cases (ITEM / SET) | 89 (72 / 17) | 78 (70 / 8) |
| CLEAN cases | 18 | 20 |
| Expected detections | 73 | 124 |
| TP | 67 | 80 |
| FN total | 6 | 44 |
| FN NOT_IMPLEMENTED | 3 | 36 |
| FN heuristic gap (implemented checks) | 3 | 8 |
| FP | 0 | 4 |
| CLEAN cases with WARNING/ERROR | 0 of 18 | 3 of 20 |
| UNLABELED_EMISSION | n/a (exhaustive negatives) | 22 |
| Semantic-only / unsupported semantic | 6 | 12 |
| RECALL-LIKE | 67/73 | 80/124 |
| PRECISION-LIKE | 67/67 | 80/84 |

Reading notes (no verdict): most of the v0.2 FN (36 of 44 (originally; 33 of 41 after Run 005)) are NOT_IMPLEMENTED codes, i.e. checks the linter documents as absent; the 8 heuristic-gap FN sit at threshold gates (section 6). The 4 FP and 22 UNLABELED_EMISSION show an over-flag side that the calibrated v0.1 corpus did not show (v0.1 FP = 0 after the Run 003 fixes).

## 5. Raw numbers for the position and combination checks (no verdict)

| Check | Held-out cases carrying the code in labels | Expected | TP | FN | FP | Unlabeled | v0.1 for reference (expected/TP/FN/FP) |
|---|---|---|---|---|---|---|---|
| OPTION_COMBINATION_REFERENCE (implemented in Run 005; originally NOT_IMPLEMENTED) | 3 (HO-026, HO-027, HO-064) | 3 | 3 | 0 | 0 | 0 | 1/1/0/0 |
| KEY_POSITION_IMBALANCE | 6 (HO-071, 072, 074, 075, 076, 077) | 6 | 5 | 1 (HO-077) | 0 | 0 | 1/1/0/0 |
| KEY_POSITION_RUN | 5 (HO-071, 072, 075, 076, 077) | 5 | 5 | 0 | 0 | 0 | 1/1/0/0 |

Forbidden-code coverage: HO-073 forbids both position codes and HO-078 forbids KEY_POSITION_RUN; the linter emitted neither (0 FP on those negatives).

## 6. Failure classification

One category per finding. Evidence is the actual case text and linter metrics. `author-intent.json` was used ONLY to spot author-vs-labeler disagreements as label-question evidence; no label was changed. Recommendations only, for Slice A5 and human review.

Categories: LIKELY_LINTER_BUG | LIKELY_HEURISTIC_LIMIT | LIKELY_LABEL_QUESTION | SEMANTIC_ONLY | NEEDS_HUMAN_HEBREW_REVIEW | NEEDS_MORE_DATA.

Tally (67 findings = 41 FN + 4 FP + 22 UNLABELED_EMISSION; Run 005 removed the 3 OPTION_COMBINATION_REFERENCE NOT_IMPLEMENTED FN rows):

| Category | FN | FP | UNL | Total |
|---|---|---|---|---|
| LIKELY_LINTER_BUG | 0 | 0 | 0 | 0 |
| LIKELY_HEURISTIC_LIMIT | 35 (27 NOT_IMPLEMENTED + 8 threshold/cue gaps) | 3 | 14 | 52 |
| LIKELY_LABEL_QUESTION | 4 | 1 | 7 | 12 |
| SEMANTIC_ONLY | 0 | 0 | 0 | 0 |
| NEEDS_HUMAN_HEBREW_REVIEW | 2 | 0 | 0 | 2 |
| NEEDS_MORE_DATA | 0 | 0 | 1 | 1 |

No crash, wrong-index or mis-implemented-rule defect was found; most emissions trace to a documented threshold or cue list. Two tokenization behaviours are arguable as tokenizer defects rather than heuristic limits (HO-012: identical token sets for O(log n) and O(n log n); HO-031: 3,000 and 3,000,000 collapse to the same token set), so LIKELY_LINTER_BUG = 0 is defensible but borderline. NOT_IMPLEMENTED codes are filed under HEURISTIC_LIMIT because no other category fits "no rule exists"; each such reason says so. SEMANTIC_ONLY has 0 rows because the 12 semantic-only cases produce no deterministic FN; they are listed in the generated block above.

One-line recommendations: (a) recurring clusters are the 4-word minimum in STEM_TOO_SHORT (8 findings on concise Hebrew stems), context-blind absolute-term matching (6 findings: kol, only, bilvad), and the 15-char gate in KEY_LONGEST_OPTION (4 near-miss FN) - candidates for a human-reviewed threshold discussion, not tuned here; (b) the 12 label-question rows should go to a human reviewer before any threshold discussion; (c) the 8-item set eligibility gates interact with MULTIPLE_CHOICE items (HO-077).

<!-- CLASSIFICATION:BEGIN -->
| Type | Ref | Code | Category | Reason |
|---|---|---|---|---|
| FN | HO-017 | OPTION_PREFIX_STEM_REPEAT | LIKELY_LABEL_QUESTION | Author intent says suspicious-but-fine (a shared absolute word in ALL options gives no cue); also NOT_IMPLEMENTED check (documented gap, no linter rule exists) **Post-human (Dor, 2026-10-09):** HO-017 relabeled CLEAN (symmetric 'תמיד'); this FN no longer exists post-human, and its OPTION_ABSOLUTE_TERM TP became a CLEAN-case FP. |
| FN | HO-022 | STEM_DOUBLE_NEGATIVE | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-022 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-029 | OPTION_PUNCTUATION_INCONSISTENT | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-029 | OPTION_STYLE_OUTLIER | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-029 | KEY_LONGEST_OPTION | LIKELY_HEURISTIC_LIMIT | Key 38 vs next 27 chars: ratio 1.41 passes 1.2 but char difference 11 is below the 15 minimum |
| FN | HO-030 | STEM_NO_QUESTION_FORM | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-031 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_LABEL_QUESTION | Explanation is the content-free word 'correct'; it does not name the key, so the label code does not match the defect; NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-034 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-035 | OPTION_PUNCTUATION_INCONSISTENT | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-039 | OPTION_COUNT_UNUSUAL | LIKELY_LABEL_QUESTION | Single-option item is already caught by OPTIONS_TOO_FEW (TP); COUNT_UNUSUAL is a soft duplicate label; NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-049 | OPTION_STYLE_OUTLIER | NEEDS_HUMAN_HEBREW_REVIEW | Niqqud on one option only; style flaw vs cue is a Hebrew-convention judgment; NOT_IMPLEMENTED check (documented gap, no linter rule exists) **Post-human:** label approved unchanged; a style outlier is a real defect, distinct from key leakage. |
| FN | HO-049 | KEY_LONGEST_OPTION | LIKELY_HEURISTIC_LIMIT | Key 53 vs next 42 chars (niqqud stripped for length): ratio 1.26 passes but char difference 11 is below 15 **Post-human:** label approved unchanged. |
| FN | HO-055 | KEY_STEM_LEXICAL_OVERLAP | LIKELY_HEURISTIC_LIMIT | Key shares only 1 content token (stack) with the stem; the rule needs at least 2 |
| FN | HO-057 | STEM_NO_QUESTION_FORM | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-057 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_LABEL_QUESTION | Explanation repeats the stem term, not the key text; label code is a loose fit; NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-063 | STEM_NEGATIVE_WORDING | LIKELY_HEURISTIC_LIMIT | Hebrew negation cue list has no form of 'איננה' (only אינה/אינו/...); author intent also calls the item suspicious-but-fine **Post-human:** Dor decided definitively (HUMAN_DECIDED_LABEL_CHANGE): the item's OPTION_ABSOLUTE_TERM expectation was removed ('כל' is integral to the proposition) and STEM_NEGATIVE_WORDING is kept. The linter's OPTION_ABSOLUTE_TERM emission is a context-blind heuristic limit ruled FORBIDDEN in Run 003, so it counts as FP in POST_HUMAN_FINAL (evidence for FUB-066). |
| FN | HO-067 | OPTION_PUNCTUATION_INCONSISTENT | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-068 | OPTION_STYLE_OUTLIER | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-070 | OPTION_STYLE_OUTLIER | NEEDS_HUMAN_HEBREW_REVIEW | Niqqud on one option only; Hebrew-convention judgment, author intent calls it 'subtle'; NOT_IMPLEMENTED check (documented gap, no linter rule exists) **Post-human:** label approved unchanged; a style outlier on a non-key option is still a defect. |
| FN | HO-071/item3 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item1 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item2 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item3 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item5 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item6 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item7 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item8 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-072/item9 | OPTION_NUMERIC_UNORDERED | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-073/item8 | KEY_LONGEST_OPTION | LIKELY_HEURISTIC_LIMIT | Key 39 vs next 25 chars: ratio 1.56 passes but char difference 14 misses the 15 minimum by one |
| FN | HO-074/item3 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-074/item4 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-074/item6 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-074/item7 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-074/item10 | EXPLANATION_NAMES_ONLY_KEY | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-077 | SET_KEY_LENGTH_BIAS | LIKELY_HEURISTIC_LIMIT | Only 7 SINGLE_CHOICE items are eligible (item 3 is MULTIPLE_CHOICE); the rule needs 8 eligible items |
| FN | HO-077 | KEY_POSITION_IMBALANCE | LIKELY_HEURISTIC_LIMIT | Only 7 SINGLE_CHOICE keyed 4-option items; the rule needs a group of 8; the labeler counted all 8 items |
| FN | HO-077/item2 | KEY_LONGEST_OPTION | LIKELY_HEURISTIC_LIMIT | Key 54 vs next 42 chars: ratio 1.29 passes but char difference 12 is below 15 |
| FN | HO-078/item2 | STEM_DOUBLE_NEGATIVE | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-078/item3 | OPTION_STYLE_OUTLIER | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FN | HO-078/item5 | STEM_NO_QUESTION_FORM | LIKELY_HEURISTIC_LIMIT | NOT_IMPLEMENTED check (documented gap, no linter rule exists) |
| FP | HO-001 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | Complete Hebrew question 'מהי בירת אוסטרליה?' has 3 words (< 4); word count over-flags terse Hebrew stems |
| FP | HO-011 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'כל' in 'כל הכוח' is a quantifier inside a descriptive key, not an absolute claim; term list is context-blind |
| FP | HO-012 | OPTION_OVERLAP_HIGH | LIKELY_HEURISTIC_LIMIT | O(log n) vs O(n log n) have identical token sets (similarity 1.0); set-based Jaccard ignores order and symbols |
| FP | HO-073 | SET_KEY_LENGTH_BIAS | LIKELY_LABEL_QUESTION | Keys are strictly longest in 5 of 10 items, exactly at the 0.5 threshold; the labeler forbade the code, the observed data arguably supports it **Post-human:** forbidden-code label approved; this stays a human-approved FP (5 of 10 at exactly 0.5 is not enough evidence; sample-size caveat). |
| UNL | HO-015 | OPTION_ABSOLUTE_TERM | LIKELY_LABEL_QUESTION | Distractor d contains 'שום' (no significance at all), a real absolute cue the labeler did not list; author intent says clean **Post-human:** Dor decided definitively (HUMAN_DECIDED_NO_LABEL_CHANGE): 'שום' is natural Hebrew here and no absolute-term expectation is added. The first-blind LIKELY_LABEL_QUESTION is resolved in favor of the existing label. The emission is a context-blind heuristic limit (evidence for FUB-066), ruled FORBIDDEN in Run 003, so it counts as FP in POST_HUMAN_FINAL. |
| UNL | HO-020 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 2-word complete stem; concise-stem over-flag (same pattern as HO-001) |
| UNL | HO-023 | OPTION_LENGTH_IMBALANCE | LIKELY_LABEL_QUESTION | Options 38 vs 13 chars (ratio 3.08) is a true length imbalance the labeler did not list |
| UNL | HO-027 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'only' in 'only in trace amounts' qualifies a quantity, not an absolute claim; context-blind term list |
| UNL | HO-027 | OPTION_LENGTH_IMBALANCE | LIKELY_LABEL_QUESTION | Options 28 vs 6 chars is a true imbalance the labeler did not list |
| UNL | HO-031 | OPTION_OVERLAP_HIGH | LIKELY_HEURISTIC_LIMIT | '3,000 ק"מ' vs '3,000,000 ק"מ' tokenize to the same set (digit groups collapse); magnitude difference is invisible |
| UNL | HO-041 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
| UNL | HO-042 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
| UNL | HO-051 | KEY_STEM_LEXICAL_OVERLAP | LIKELY_LABEL_QUESTION | Key repeats 2 stem tokens vs 1 in distractors; author intent explicitly notes this leakage, labeler omitted it |
| UNL | HO-051 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'כל אזרח' is a quantifier in a descriptive key, not an absolute cue |
| UNL | HO-052 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'בלבד' (only) inside a descriptive key sentence; context-blind term list |
| UNL | HO-055 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'only' in 'added and removed only from the top' is part of a correct definition |
| UNL | HO-072/item3 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
| UNL | HO-073/item8 | STEM_NEGATIVE_WORDING | LIKELY_HEURISTIC_LIMIT | 'ולא' in 'ולא לתרכובת' is a contrastive 'and not', not a negated question; the cue matcher cannot tell |
| UNL | HO-075 | NEAR_DUPLICATE_STEM | NEEDS_MORE_DATA | Items 7 and 8 score exactly 0.80 (= threshold) because of the shared template; a single borderline instance |
| UNL | HO-076/item1 | KEY_STEM_LEXICAL_OVERLAP | LIKELY_LABEL_QUESTION | Key (93 chars) restates 2 stem tokens, distractors 0; real leakage the labeler did not list (set flagged languageReviewRequired) **Post-human:** Dor decided definitively (HUMAN_DECIDED_NO_LABEL_CHANGE): item-1 lexical/key leakage based only on natural stem overlap is rejected, so the existing label stands. The first-blind LIKELY_LABEL_QUESTION is resolved in favor of the existing label. The emission is a context-blind heuristic limit (evidence for FUB-066), ruled FORBIDDEN in Run 003 (per-item forbidden code added by the overlay), so it counts as FP in POST_HUMAN_FINAL. |
| UNL | HO-076/item4 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
| UNL | HO-076/item6 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
| UNL | HO-076/item9 | KEY_STEM_LEXICAL_OVERLAP | LIKELY_LABEL_QUESTION | Key restates 3 stem tokens vs 1 in a distractor; real leakage the labeler did not list |
| UNL | HO-077/item1 | OPTION_ABSOLUTE_TERM | LIKELY_HEURISTIC_LIMIT | 'all' in 'encrypts all web traffic' is a content quantifier in a plausible distractor; context-blind term list |
| UNL | HO-077/item4 | OPTION_LENGTH_IMBALANCE | LIKELY_LABEL_QUESTION | Options 69 vs 16 chars (ratio 4.3) is a true imbalance; the labeler listed only KEY_LONGEST_OPTION |
| UNL | HO-078/item8 | STEM_TOO_SHORT | LIKELY_HEURISTIC_LIMIT | 3-word complete stem; concise-stem over-flag |
<!-- CLASSIFICATION:END -->

## 7. Author-vs-labeler agreement

Using the author intent (read after the freeze, only for this note), 6 of 78 cases show a clear directional disagreement with the label:

- Author says clean or "suspicious but fine", labeler FLAWED: HO-015, HO-017, HO-018, HO-063 (4; HO-070 is described as a "subtle style flaw" and is counted as agreement).
- Author describes a flaw, labeler CLEAN: HO-032 (stem is a cloze, not a question), HO-069 (numeric ranges not in order) (2).

All six sit in families the two weigh differently (negative stems, absolute-word contexts, stylistic codes). Several UNLABELED_EMISSION rows in section 6 are additional label-question evidence (for example HO-051, where the author named the leakage the labeler omitted). The only case with `languageReviewRequired` is HO-076. The labels are model-made and unreviewed; this note is not an agreement statistic. **Post-human (2026-10-09):** Dor reviewed five of the six disagreement rows (HO-015, 017, 063, 032, 069; HO-018 was not queued). He relabeled HO-017 (CLEAN), HO-063 (absolute-term expectation removed) and HO-069 (FLAWED), i.e. toward the author on those three, and kept HO-032 CLEAN (completion stems are acceptable, against the author). HO-015 and HO-070 labels were approved unchanged. Still one reviewer and not an agreement statistic.

## 8. Regenerating

There is no script. The generated block is produced by `formatHeldOutMarkdown(runHeldOutEvaluation(corpus, labels))`; `src/domain/assessment/__tests__/heldout-eval.test.ts` asserts that this document contains exactly that text, that the frozen files still hash to `freeze-hashes.json`, and that every FN/FP/UNLABELED_EMISSION has exactly one classification row.

## 9. FUB-064 verdict: OPTION_COMBINATION_REFERENCE

**Post-human (2026-10-09): verdict reaffirmed, see section 18.**

**Verdict: IMPLEMENT_NEXT** (recommendation only; nothing implemented; scheduling stays under AE-029). Confidence: low-to-medium, because the evidence is 3 held-out cases plus 1 v0.1 case.

**Did combination-reference flaws appear naturally? Insufficient evidence.** HO-026 (Hebrew, "תשובות א ו-ג נכונות"), HO-027 ("Both a and c") and HO-064 ("Both a and b") are each one deliberately authored flaw in a corpus built as a flaw-injection set (the author intent lists each as a targeted flaw). Three cases written ON PURPOSE show that the pattern is easy to write and easy to label, not that instructors produce it unprompted. What can be said: the blind author wrote it in both languages and in both SINGLE_CHOICE and MULTIPLE_CHOICE items, and none of the other 75 held-out cases contains a combination-style option (read check below), so it did not leak into unrelated items.

**Would a deterministic rule have clear semantics? Yes, if narrow.** Observed surface forms: `Both a and c`, `Both a and b` (English, lower-case ids matching option ids), `תשובות א ו-ג נכונות` (Hebrew letters א/ג standing for ids a/c), and the v0.1 case `Both A and B`. A conservative rule would require (1) a cue word (`both`, `option(s)`, `answer(s)`, `תשובות`, `שתי התשובות`, `שניהם`) AND (2) one or more reference tokens that resolve to an existing option id or its ordinal letter (Latin a-d, Hebrew א-ד) of the same item, appearing in an option other than the referenced ones. Position-dependence is real: such an option only means something relative to option order and breaks under shuffling. That is itself the pedagogical defect, and detecting the reference needs no semantics. Not covered by the narrow form (and not claimed): `שתי התשובות הראשונות` / "the first two answers" (ordinal phrase without ids; needs a Hebrew ordinal list) and `A, B and C` without a cue word.

**False-positive risk (by reading, no new code run).** I read all 568 held-out options for would-be triggers, plus the v0.1 fixture strings:

- Options that legitimately contain `and`/`ו`: HO-028 ("Kind and well-meaning" etc.), HO-023 ("המים מורכבים ממימן וחמצן"), HO-052 ("RAM ... ו-ROM ..."), HO-077/2, HO-078/6, and v0.1 ("Erosion of rock by wind and rain"). None has a cue word plus an id token, so the narrow rule stays silent. A bare `and`/`ו` rule would fire on all of them, so cue word plus resolvable id is mandatory.
- Single letters that look like ids: HO-013 ("ויטמין A/C/D/K"), HO-073/5 and HO-074/4 (unit names). The letter must resolve to an id of the SAME item and sit behind a cue word; `ויטמין A` has no cue word. Residual risk: an item that really says "option A and B of the protocol" (not seen in either corpus).
- Neighbouring constructs: `שניהם שווים במשקלם` (HO-058, refers to the two things in the stem, not to options), and `אף אחת מהתשובות` / `כל התשובות נכונות` (already covered by OPTION_NONE_OF_ABOVE / OPTION_ALL_OF_ABOVE; a rule must not double-report them).
- Result: no would-be false trigger found in the 78 held-out and 89 v0.1 cases under the narrow rule. This is a reading check on small, synthetic, single-author data, not a measured FP rate.

**Pedagogical usefulness:** high in principle (combination options are position-dependent, reward elimination test-wiseness, break when options are shuffled). Each held-out case also shows a second defect the reference exposes (HO-064 marks `a`, `b` and the `d` "Both a and b" all correct; in HO-026 option d says a and c are correct while c is wrong). **Requires semantics?** No to detect the reference; yes to judge whether the combination is logically valid (not claimed).

**Conditions for the implementing Slice:** WARNING-level advisory; explicit cue-word list and id resolution in the spec; a purpose-built negative set (options with `and`/`ו`, `Vitamin A`, `שניהם`); no overlap with ALL/NONE_OF_ABOVE; and evaluation on a fresh held-out batch, not on HO-026/027/064 alone.

## 10. Position rules verdict: KEY_POSITION_IMBALANCE and KEY_POSITION_RUN

Sample: 8 SET cases only (HO-071 to HO-078). All numbers are indicative; no statistic is possible.

| Rule | Held-out evidence | Verdict |
|---|---|---|
| KEY_POSITION_IMBALANCE | 5/6 TP, 1 FN (HO-077), 0 FP. Every TP is an extreme set (constant key, 9 of 10 on one position). Only ONE set (HO-073, 10 items) is a labelled balanced negative that forbids it. | **WATCH** (unchanged from v0.1 WATCH, high priority) |
| KEY_POSITION_RUN | 5/5 TP, 0 FP. HO-073 and HO-078 forbid it; neither fired. | **KEEP** (provisional) |

- **Why the held-out set cannot move IMBALANCE off WATCH:** the v0.1 concern is analytic (fair random placement trips the 1.5/k share in roughly 45% of 8-item sets, calibration section 3). The held-out sets contain no random-fair small set built to probe that, so this result neither confirms nor refutes the fragility. 5/6 on constant or near-constant keys is what almost any rule would score.
- **HO-077 FN (7 eligible items):** the set has 8 items but item 3 is MULTIPLE_CHOICE, so only 7 SINGLE_CHOICE keyed 4-option items form the group. The rule needs 8, so IMBALANCE stayed silent (and SET_KEY_LENGTH_BIAS for the same eligibility reason) while RUN fired. The labeler counted all 8 items. This is an eligibility-gate design question (should MULTIPLE_CHOICE items count, or should 7 of 8 eligible be analysed?), not a threshold bug. One case: candidate for future evidence only.
- **Forbidden-code behaviour:** HO-073 forbids both position codes and HO-078 forbids RUN; the linter emitted none (0 FP on these negatives). HO-073 did emit SET_KEY_LENGTH_BIAS, a different code (queue row HO-073 in section 12).
- **RUN KEEP caveat:** v0.1 flagged analytic growth in RUN noise on long sets (about 37% of random 40-item sets). Not tested here (sets have 8 to 10 items). KEEP means "no evidence against", not "validated".
- No threshold or rule change is proposed. A significance-aware rule and the treatment of MULTIPLE_CHOICE items in eligibility are candidates for future evidence (FUB-059 residual).

## 11. Cross-cutting findings (recommendations only)

| Cluster | Held-out evidence | Recommendation | Candidate FUB | Evidence strength | Human decision needed? |
|---|---|---|---|---|---|
| STEM_TOO_SHORT on concise complete Hebrew stems | 8 findings: 1 FP on CLEAN HO-001 ("מהי בירת אוסטרליה?") and 7 unlabeled (HO-020, 041, 042; items in HO-072, 076 x2, 078). 2 TP on truly fragmentary stems. Every flagged stem is a complete 2-3 word Hebrew question. | Candidate rule revision (word count over-flags terse Hebrew) | FUB-066 | Moderate (many stems, but one author and one corpus) | Yes: what "too short" means for Hebrew, and whether the signal should exist |
| Context-blind absolute-term matching (`כל`, `only`, `בלבד`, `all`) | 1 FP (HO-011) plus 5 unlabeled over-flags in correct descriptive keys or plausible distractors (HO-027, 051, 052, 055, 077/1). 9/9 labelled absolute cues were caught; 1 genuine cue was unlabeled (HO-015 `שום`). | Candidate rule revision (precision, with a recall trade-off) | FUB-066 (same entry) | Moderate-to-low (6 over-flags, and Run 003 already traded recall for precision here; a fix could trade it back) | Yes: acceptable false-positive rate for an advisory warning (group E) |
| KEY_LONGEST_OPTION 15-char gate near-misses | 4 FN (HO-029 and HO-049 key +11 chars, HO-073/8 +14, HO-077/2 +12; ratios 1.26 to 1.56) against 18/22 TP and 0 FP. v0.1 already marked this exact threshold WATCH. | Threshold discussion only (no change proposed) | FUB-067 | Low-to-moderate (4 near-misses; no negative sits just under 15, so lowering has no FP evidence either way) | Yes: acceptable FP rate and whether a ratio-only fallback is wanted |

Other held-out findings that are not clusters: the 36 NOT_IMPLEMENTED FN (OPTION_NUMERIC_UNORDERED 9, 8 of them in the single set HO-072; EXPLANATION_NAMES_ONLY_KEY 9, with 2 label questions; OPTION_STYLE_OUTLIER 5; others fewer) remain AE-029 prioritisation inputs; OPTION_OVERLAP_HIGH tokenization (HO-012 `O(log n)` vs `O(n log n)`, HO-031 digit groups) has 2 findings, insufficient for a cluster; the borderline NEAR_DUPLICATE_STEM in HO-075 is NEEDS_MORE_DATA.

## 12. HUMAN REVIEW QUEUE (for Dor)

Status (original, FIRST_BLIND, kept as written): MODEL_LABELED_NOT_HUMAN_APPROVED. These rows were questions, not decisions; nothing was changed or approved at that time. **Update 2026-10-09: all 9 rows below were decided by Dor; their Status is now HUMAN_APPROVED (Dor, 2026-10-09). The decisions are in section 12.1, directly after the queue.** The remaining text in this section describes the pre-decision state. Not every case needs review. Only the 9 rows below would change a finding if the answer differs from the current model label. The other label questions (HO-023, 027, 077/4 length imbalance; HO-051, 076/1, 076/9 key leakage; HO-031, 039, 057 code fit) are numerically or mechanically checkable. They are NOT to be relabeled by the model: the model has now seen linter output, so any such relabel would be a post-observation edit, would require a deliberate new freeze, and would end blind status for those rows (see FUB-065).

| caseId | Question for Dor | Why it matters | Current model label |
|---|---|---|---|
| HO-049 | האם ניקוד רק על אפשרות אחת (המפתח) נחשב פגם סגנוני או רמז למפתח, או שזה מקובל? | NEEDS_HUMAN_HEBREW_REVIEW: decides whether OPTION_STYLE_OUTLIER is a real Hebrew-convention flaw | FLAWED: OPTION_STYLE_OUTLIER, KEY_LONGEST_OPTION |
| HO-070 | אותה שאלה: ניקוד על אפשרות b בלבד, והמפתח הוא a. פגם סגנוני או לא? | NEEDS_HUMAN_HEBREW_REVIEW: here the niqqud does not point to the key | FLAWED: OPTION_STYLE_OUTLIER |
| HO-076 | Set marked languageReviewRequired: is the Hebrew natural, and does the key restating stem words (item 1) count as real leakage? | Only languageReviewRequired case; 18 item detections and 4 unlabeled leakage emissions depend on it | FLAWED set: SET_KEY_LENGTH_BIAS, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN |
| HO-017 | האם ארבע אפשרויות שכולן פותחות ב"תמיד" הן פגם בפני עצמו, או תוכן לגיטימי בשאלה על משולש? | Author says "suspicious but fine", labeler says FLAWED; decides whether this FN is a label error | FLAWED: OPTION_ABSOLUTE_TERM, OPTION_PREFIX_STEM_REPEAT |
| HO-015 | האם "שום משמעות" באפשרות d הוא רמז מוחלט או ניסוח רגיל? | Real unlabeled `שום` emission; the `שום` homograph was already a Hebrew-judgment topic in FUB-060 | FLAWED: KEY_LONGEST_OPTION (no absolute-term label) |
| HO-063 | בשאלה "איזו מהטענות איננה נכונה?" שבה המפתח הוא "כל הציפורים עפות": האם `כל` במפתח הוא פגם? | Decides whether the STEM_NEGATIVE_WORDING FN (`איננה`) and the absolute-term expectation are valid | FLAWED: STEM_NEGATIVE_WORDING, OPTION_ABSOLUTE_TERM |
| HO-032 | Is a colon-ended cloze stem ("...נקרא:") an acceptable Hebrew question form or a flaw? | Author says flaw, labeler says CLEAN; decides whether STEM_NO_QUESTION_FORM should ever flag cloze stems | CLEAN |
| HO-069 | Are numeric ranges in non-ascending order ("7 עד 9", "3 עד 4", "12 עד 14", "5 עד 6") a flaw? | Author says flaw, labeler says CLEAN; sizes the OPTION_NUMERIC_UNORDERED family (9 FN) | CLEAN |
| HO-073 | Keys are strictly longest in 5 of 10 items, exactly at the 0.5 SET_KEY_LENGTH_BIAS threshold: should the set forbid that code, or is there a length bias? | Would flip the only SET_KEY_LENGTH_BIAS FP into a TP (a policy/threshold question, not a Hebrew-judgment question; the weakest human-judgment row) | FLAWED set; forbids KEY_POSITION_IMBALANCE, KEY_POSITION_RUN, SET_KEY_LENGTH_BIAS |

Queue size: 9 rows (2 NEEDS_HUMAN_HEBREW_REVIEW, 1 languageReviewRequired, 6 label questions). No FUB is closed by this section.


### 12.1 Dor decisions (2026-10-09), Status: HUMAN_APPROVED (Dor, 2026-10-09)

Applied as a post-evaluation overlay (`human-adjudication.json`); frozen labels unchanged. "BEFORE to AFTER" is the label effect; the metric effect is in section 14 (generated) with its prose companion in section 15.

| caseId | Dor decision (2026-10-09) | BEFORE to AFTER label | Status |
|---|---|---|---|
| HO-049 | APPROVED: niqqud on one option is a real style inconsistency; stays distinct from key leakage | FLAWED (OPTION_STYLE_OUTLIER, KEY_LONGEST_OPTION) to unchanged | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-070 | APPROVED: niqqud on non-key option b is a style defect, not a key cue | FLAWED (OPTION_STYLE_OUTLIER) to unchanged | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-076 | APPROVED_PARTIAL (definitive): set stays FLAWED with its set-level codes and languageReviewRequired; item-1 lexical/key leakage based only on natural stem overlap is rejected (item 1 expected only KEY_LONGEST_OPTION, OPTION_LENGTH_IMBALANCE, so no label change); Hebrew issues recorded, corpus not edited. No remaining human ambiguity | FLAWED set to unchanged | HUMAN_APPROVED (Dor, 2026-10-09), partial |
| HO-017 | CHANGED: symmetric 'תמיד' in all options is not a cue | FLAWED (OPTION_ABSOLUTE_TERM, OPTION_PREFIX_STEM_REPEAT) to CLEAN | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-015 | APPROVED (definitive): 'שום משמעות' is natural Hebrew; OPTION_ABSOLUTE_TERM not added; no remaining human ambiguity | FLAWED (KEY_LONGEST_OPTION) to unchanged | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-063 | CHANGED: negative stem confirmed; 'כל' is integral to the proposition; OPTION_ABSOLUTE_TERM expectation REMOVED (definitive; no remaining human ambiguity) | FLAWED (STEM_NEGATIVE_WORDING, OPTION_ABSOLUTE_TERM) to FLAWED (STEM_NEGATIVE_WORDING) | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-032 | APPROVED: colon-ended completion stem is an acceptable question form | CLEAN to unchanged | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-069 | CHANGED: comparable numeric ranges should be consistently ordered | CLEAN to FLAWED (OPTION_NUMERIC_UNORDERED, a NOT_IMPLEMENTED check) | HUMAN_APPROVED (Dor, 2026-10-09) |
| HO-073 | APPROVED: 5 of 10 at exactly the 0.5 threshold is not enough evidence for a length-bias warning | FLAWED set (forbids SET_KEY_LENGTH_BIAS) to unchanged | HUMAN_APPROVED (Dor, 2026-10-09) |

Only 3 of 9 decisions changed a label (HO-017, HO-063, HO-069); 5 approved the existing label; HO-076 was partial with no label change. All 9 decisions are definitive (TRUE_REMAINING_AMBIGUITY = 0). The mechanical label questions deliberately left out of the queue (HO-023, 027, 077/4 length imbalance; HO-051, 076/9 key leakage; HO-031, 039, 057 code fit) were NOT reviewed and stay model-only labels.

## 13. INTEGRATION READINESS reassessment (advisory-only integration design)

**Verdict: NOT_READY.** Recommendation only; nothing is wired and AE-031 stays gated. The held-out evidence changes the status of some criteria and moves none to MET.

Deciding reasons:

1. **Precision on fresh data is not as clean as the fixture-fit result.** v0.1 reported 0 FP and 0 of 18 CLEAN warn after rules were tuned on those cases. On never-tuned data: 4 FP, 3 of 20 CLEAN cases warn, 22 unlabeled emissions, in recurring clusters (section 11). The v0.1 "PASS but fixture-fit" is not confirmed; the criterion becomes WATCH.
2. **Provenance is still model-only.** v0.2 exists and was evaluated blind, but it is `MODEL_AUTHORED_HELD_OUT` with `MODEL_LABELED_NOT_HUMAN_APPROVED` labels: one author, one labeler, 78 cases, no real course content, no inter-annotator agreement. The held-out SPLIT half of exit criterion 2 now exists; the real or cleared items half does not.
3. **Design and engineering gates are untouched by data:** position-rule significance (exit 3; IMBALANCE WATCH), import-validator naming reconciliation (exit 5, AE-031) and the non-blocking advisory surface (exit 4) cannot be satisfied by held-out results, and nothing is wired. In addition, 36 NOT_IMPLEMENTED FN and 29 cases with a semanticExpectation mean a clean result says little.

| Criterion (calibration section 4) | v0.1 status | Held-out v0.2 effect | Status now |
|---|---|---|---|
| Contract clarity, bounded runtime, stable codes, determinism | PASS | Unchanged linter ran once over 78 new cases; no linter defect found (0 LIKELY_LINTER_BUG) | PASS (no new claim) |
| False-positive behaviour | PASS, fixture-fit | CHANGED: 4 FP, 3/20 CLEAN warn, 22 unlabeled on untuned data | WATCH |
| Hebrew label validity | PASS with caveat | v0.2 labels are model-only; 2 NEEDS_HUMAN_HEBREW_REVIEW plus HO-076 queued (section 12) | PASS for v0.1 only; v0.2 PENDING |
| Fixture size and provenance (exit 2) | FAIL | PARTLY CHANGED: a held-out split exists, but model-authored; no real or cleared items | FAIL / OPEN (narrowed; FUB-063 stays open) |
| Remaining misses | WATCH | 44 FN (36 NOT_IMPLEMENTED, 8 gaps), recall-like 80/124; the 8 gaps sit at known WATCH thresholds | WATCH (larger, same character) |
| Warning stability | WATCH | Recurring over-flag clusters on fresh data; the Run 003 precision/recall trade-off is visible | WATCH (stronger risk evidence) |
| Thresholds (exit 6) | WATCH | KEY_LONGEST 15-char gate and position WATCH shown live; no threshold changed | WATCH (unchanged; v0.2 must not be tuned on) |
| Blocking semantic false confidence | WATCH | 29 cases carry a semanticExpectation (12 semantic-only); the linter is silent on them | WATCH (reinforced) |
| Exit 1: Hebrew review | MET (caveat) | Covers v0.1 only | MET (v0.1 only) |
| Exit 3: significance-aware position rule | OPEN | No new probe; HO-077 eligibility question added | OPEN |
| Exit 4: non-blocking advisory design | OPEN | Not testable by data | OPEN |
| Exit 5: import-validator naming (DUPLICATE_PROMPT) | OPEN | No effect | OPEN |

The two corpora are never pooled (section 4); this table compares verdict status, not metrics.

**Post-human note:** this section is the FIRST_BLIND reassessment, preserved as written. The post-human reassessment is section 17 (verdict unchanged: NOT_READY).

## 14. Post-evaluation human adjudication (generated)

On 2026-10-09 Dor (human) reviewed 9 of the 78 held-out cases; the decisions are applied in code as an overlay (`heldout-v0-2/human-adjudication.json`) on top of the frozen labels, which stay byte-identical.
The FIRST_BLIND results above remain the original blind evaluation; the block below is a separate POST_HUMAN set, not pooled with them or with v0.1.
Blindness caveat: these 9 rows were adjudicated after the evaluation, so held-out blindness no longer fully holds for them; the other 69 labels remain MODEL_LABELED_NOT_HUMAN_APPROVED.

<!-- GENERATED:BEGIN formatPostHumanMarkdown (src/domain/assessment/golden/heldout-eval.ts) -->
## POST-HUMAN-ADJUDICATION / POST-EVALUATION metrics (generated)

These are HUMAN-ADJUDICATED / POST-EVALUATION metrics (9 labels reviewed by Dor on 2026-10-09 and applied as an overlay on the frozen labels), not FIRST-BLIND metrics, and they are not pooled with v0.1. The FIRST_BLIND column is the original blind result. Only the 9 reviewed rows are HUMAN_APPROVED; the other 69 remain MODEL_LABELED_NOT_HUMAN_APPROVED.

| Measure | FIRST_BLIND | POST_HUMAN_BEFORE_FINAL_FORBIDDEN | POST_HUMAN_FINAL | DELTA (FINAL - FIRST_BLIND) |
|---|---|---|---|---|
| CLEAN cases | 20 | 20 | 20 | 0 |
| FLAWED cases | 58 | 58 | 58 | 0 |
| SEMANTIC-ONLY cases | 12 | 12 | 12 | 0 |
| Expected deterministic detections | 124 | 122 | 122 | -2 |
| TP | 83 | 81 | 81 | -2 |
| FN (total) | 41 | 41 | 41 | 0 |
| FN HEURISTIC_GAP | 8 | 8 | 8 | 0 |
| FN NOT_IMPLEMENTED | 33 | 33 | 33 | 0 |
| FP | 4 | 5 | 8 | +4 |
| CLEAN cases with a WARNING/ERROR | 3 of 20 | 4 of 20 | 4 of 20 | +1 |
| UNLABELED_EMISSION | 22 | 23 | 20 | -2 |
| SET-scope codes (expected / TP / FN / FP) | 17 / 15 / 2 / 1 | 17 / 15 / 2 / 1 | 17 / 15 / 2 / 1 | 0 / 0 / 0 / 0 |
| ITEM codes inside SET cases (expected / TP / FN / FP) | 46 / 27 / 19 / 0 | 46 / 27 / 19 / 0 | 46 / 27 / 19 / 1 | 0 / 0 / 0 / +1 |

### The 9 reviewed cases (generated)

Counts are TP/FN/FP/UNLABELED per case. All 9 human decisions are definitive: TRUE_REMAINING_AMBIGUITY = 0. Label effect: HUMAN_DECIDED_LABEL_CHANGE (the applied decision changed the label) or HUMAN_DECIDED_NO_LABEL_CHANGE. Metric effect: METRIC_EFFECT (a finding or a TP/FN/FP/UNL count differs from FIRST_BLIND) or HUMAN_DECIDED_BUT_NO_METRIC_EFFECT. "Declined emissions left UNLABELED by convention" lists a linter emission whose expectation the human declined or removed without ruling it forbidden: the harness counts that as UNLABELED_EMISSION. This is a harness accounting convention (a declined expectation was not a forbid), not human uncertainty.

| Case | Decision | FIRST_BLIND TP/FN/FP/UNL | POST_HUMAN TP/FN/FP/UNL | Findings removed | Findings added | Label effect | Metric effect | Declined emissions left UNLABELED by convention |
|---|---|---|---|---|---|---|---|---|
| HO-049 | APPROVED | 0/2/0/0 | 0/2/0/0 | - | - | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | - |
| HO-070 | APPROVED | 0/1/0/0 | 0/1/0/0 | - | - | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | - |
| HO-076 | APPROVED_PARTIAL | 21/0/0/4 | 21/0/1/3 | UNL HO-076/item1 KEY_STEM_LEXICAL_OVERLAP | FP HO-076/item1 KEY_STEM_LEXICAL_OVERLAP | HUMAN_DECIDED_NO_LABEL_CHANGE | METRIC_EFFECT | - |
| HO-017 | CHANGED | 1/1/0/0 | 0/0/1/0 | FN HO-017 OPTION_PREFIX_STEM_REPEAT | FP HO-017 OPTION_ABSOLUTE_TERM | HUMAN_DECIDED_LABEL_CHANGE | METRIC_EFFECT | - |
| HO-015 | APPROVED | 1/0/0/1 | 1/0/1/0 | UNL HO-015 OPTION_ABSOLUTE_TERM | FP HO-015 OPTION_ABSOLUTE_TERM | HUMAN_DECIDED_NO_LABEL_CHANGE | METRIC_EFFECT | - |
| HO-063 | CHANGED | 1/1/0/0 | 0/1/1/0 | - | FP HO-063 OPTION_ABSOLUTE_TERM | HUMAN_DECIDED_LABEL_CHANGE | METRIC_EFFECT | - |
| HO-032 | APPROVED | 0/0/0/0 | 0/0/0/0 | - | - | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | - |
| HO-069 | CHANGED | 0/0/0/0 | 0/1/0/0 | - | FN HO-069 OPTION_NUMERIC_UNORDERED | HUMAN_DECIDED_LABEL_CHANGE | METRIC_EFFECT | - |
| HO-073 | APPROVED | 1/1/1/1 | 1/1/1/1 | - | - | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | - |
<!-- GENERATED:END -->

## 15. Why the metrics moved (prose companion to the generated delta)

The generated POST_HUMAN block above is authoritative for numbers; this section explains causes only. Of the 9 reviewed rows:

- **HUMAN_DECIDED_LABEL_CHANGE with metric effect (HO-017, HO-063, HO-069):** HO-017 became CLEAN, so the OPTION_ABSOLUTE_TERM detection that was a TP is now a CLEAN-case FP (+1 FP, +1 CLEAN-case-with-warning, TP -1) and the NOT_IMPLEMENTED OPTION_PREFIX_STEM_REPEAT FN disappeared with its expectation. HO-063 lost its OPTION_ABSOLUTE_TERM expectation (TP -1); the still-emitted code was an UNLABELED_EMISSION in POST_HUMAN_BEFORE_FINAL_FORBIDDEN and became an FP only with the final forbidden decision (Run 003, below). HO-069 became FLAWED with OPTION_NUMERIC_UNORDERED, which adds one NOT_IMPLEMENTED FN. The two NOT_IMPLEMENTED changes cancel, so total FN stays 44 (8 heuristic + 36 NOT_IMPLEMENTED) while expected detections fall 124 to 122 and TP 80 to 78.
- **HUMAN_DECIDED_NO_LABEL_CHANGE with HUMAN_DECIDED_BUT_NO_METRIC_EFFECT (HO-049, HO-070, HO-032, HO-073):** Dor's decisions confirmed the existing labels, so no finding or count moved. HO-073's SET_KEY_LENGTH_BIAS stays a forbidden-code FP, now human-approved. 
- **TRUE_REMAINING_AMBIGUITY: none (0).** All 9 decisions are definitive.

**Final forbidden decisions (Run `2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003`).** Dor's final precision decisions rule exactly three linter emissions FORBIDDEN (real false positives, not flaws): HO-015 OPTION_ABSOLUTE_TERM ('שום' is natural Hebrew), HO-063 OPTION_ABSOLUTE_TERM ('כל' is integral to the assessed proposition; STEM_NEGATIVE_WORDING stays expected) and HO-076 item-1 KEY_STEM_LEXICAL_OVERLAP (natural stem repetition is not leakage without asymmetry or a cue). The overlay adds them as forbidden codes (`addForbiddenCodes`; for the SET case a per-item `addForbiddenItemCodes`, overlay-only; the frozen labels are untouched), so they move from UNLABELED_EMISSION to FP. Three states are reported: FIRST_BLIND (FP 4, UNLABELED 22), POST_HUMAN_BEFORE_FINAL_FORBIDDEN (FP 5, UNLABELED 23) and POST_HUMAN_FINAL (FP 8, UNLABELED 20; ITEM-in-SET FP 0 to 1). No linter, threshold, cue list, corpus or earlier human decision changed; the linter output is identical. HO-015 and HO-076 keep NO_LABEL_CHANGE (expectations unchanged; forbidden additions are precision flags shown as METRIC_EFFECT). Still only 9 of 78 rows are human-reviewed.
- SET-scope counts (17 / 15 / 2 / 1) did not change.

Reading the movement honestly: FP went up (4 to 5) because a human judged a model-flagged item CLEAN. That is a precision signal about the linter against a better label, not noise. The linter output for that case is byte-identical before and after; only the label changed, so this is not a linter regression. Expected detections fell only because expectations were removed. Neither movement is a tuning result and neither is first-blind.

## 16. Human-derived principles (Dor, 2026-10-09)

These are human judgments about what counts as a quality defect. They are NOT linter changes: no rule, threshold or test expectation was changed to implement them (only the post-evaluation overlay records the label effects). They are evidence and design input for FUB-066 (context-blind clusters), FUB-067 (set eligibility and significance) and AE-029 check design. Single reviewer; not inter-annotator agreed.

1. **Lexical overlap with the stem is not leakage by itself.** Leakage needs an asymmetry or a wording cue that helps identify the answer without mastering the content (HO-076). Caution for KEY_STEM_LEXICAL_OVERLAP; the item-1 emission is a context-blind heuristic limit (evidence for FUB-066), ruled FORBIDDEN in Run 003 (FP in POST_HUMAN_FINAL).
2. **An absolute term is not a flaw merely because it exists.** Symmetric use across all options is not an answer cue (HO-017). Evidence for FUB-066.
3. **Hebrew 'שום' and 'כל' need syntactic and semantic context.** 'כל' integral to the proposition under assessment is not an absolute-term flaw (HO-063); 'שום' in natural phrasing is not automatically a flaw (HO-015). Evidence for FUB-066.
4. **A completion/cloze stem ending in ':' is an acceptable question form** (HO-032); a future STEM_NO_QUESTION_FORM check must not require '?'.
5. **A style outlier (for example niqqud on one option) is a real defect, distinct from key leakage** (HO-049, HO-070). Do not introduce a generic "formatting implies key leakage" rule.
6. **Set-level statistical warnings must weigh sample size and strength of evidence.** 5 of 10 at exactly the 0.5 threshold is not enough (HO-073). Evidence for FUB-067 and for a significance-aware set rule (exit 3).

Numeric-ordering concept (approves the concept, not every existing OPTION_NUMERIC_UNORDERED finding): comparable numeric-range options should appear in a consistent ascending or descending order (HO-069). OPTION_NUMERIC_UNORDERED stays a NOT_IMPLEMENTED check; the 9 existing FN under it were not individually reviewed.

## 17. INTEGRATION READINESS, post-human reassessment

**Verdict: NOT_READY.** Recommendation only; nothing is wired, AE-031 stays gated. The human review improved label quality for 9 rows and clarified context-sensitivity rules; it moved no readiness criterion to MET.

Deciding reasons:

1. **Provenance is still essentially model-only.** 9 of 78 labels are human-approved (11.5 percent), by one reviewer. The corpus is model-authored synthetic content; there are no real or instructor-cleared items and no inter-annotator agreement. Exit criterion 2 stays FAIL / OPEN.
2. **Precision on never-tuned data is still not clean, and the better labels made it slightly worse.** POST_HUMAN_FINAL: 8 FP and 4 of 20 CLEAN cases warned (FIRST_BLIND: 4 FP, 3 of 20; before the final forbidden decisions: 5 FP); 20 unlabeled emissions. Dor's rules 1-4 confirm that absolute-term and short-stem behaviour is context-blind, which is a design gap, not yet a fix.
3. **Large blind spots and open design gates are untouched.** 36 NOT_IMPLEMENTED FN remain (plus 8 heuristic gaps); 12 cases are semantic-only and 29 carry a semantic expectation, so a clean lint says little; position-rule significance (exit 3) has a human principle (HO-073, sample size) but no rule, evidence set or threshold; the import-validator naming reconciliation (DUPLICATE_PROMPT, exit 5) and the advisory-only surface design (exit 4) are not addressed by data.

| Criterion | Status after human review |
|---|---|
| False-positive behaviour | WATCH (8 FP, 4/20 CLEAN warned post-human final; 4 FP and 3/20 first-blind) |
| FN behaviour | WATCH (44 FN: 36 NOT_IMPLEMENTED, 8 heuristic; total unchanged) |
| Label provenance (exit 2) | FAIL / OPEN (9/78 human, one reviewer; narrowed slightly, not met) |
| Hebrew label validity | v0.2 PARTLY (9 rows human-reviewed; HO-076 Hebrew corpus defects recorded, not corrected) |
| Threshold stability (exit 6) | WATCH (no threshold changed; v0.2 must not be tuned on; blindness for 9 rows is gone) |
| Semantic blind spots | WATCH (12 semantic-only, 29 with semantic expectations) |
| Position-rule significance (exit 3) | OPEN (human principle recorded; HO-073 FP human-approved; no rule) |
| Import-validator naming (exit 5) | OPEN |
| Advisory-only design (exit 4) | OPEN |

**What human review improved:** label quality of 9 rows (3 relabeled, 5 confirmed, 1 partial), three context-sensitivity rules (absolute terms, lexical overlap, completion stems), the style-outlier-vs-leakage distinction, the set-level sample-size principle and the numeric-ordering concept.
**What it did NOT solve:** model-authored corpus provenance (69 rows still model-labeled), absence of real or cleared items, unimplemented checks, semantic-only cases, position-rule significance, advisory integration design, import-validator reconciliation, the HO-076 Hebrew text defects (corpus not corrected), and the context-blind HO-015, HO-063 and HO-076 item-1 emissions (Dor's decisions are definitive; they are now human-ruled FP in POST_HUMAN_FINAL and evidence for FUB-066).

## 18. FUB-064 verdict, reassessed post-human: OPTION_COMBINATION_REFERENCE

**Verdict: IMPLEMENT_NEXT** (reaffirmed from the Run 004 verdict; low-to-medium confidence; recommendation only; scheduling stays under AE-029; no code change in this Run).

- **Relevant cases:** HO-026, HO-027, HO-064 (plus one v0.1 case). None is among the 9 human-reviewed rows, so their labels remain model-only and the human review gave no direct evidence about them. Evidence class: 3 deliberately authored flaw-injection cases, so natural frequency is still unproven.
- **False-positive risk:** Dor's context principles (1-3) argue against rules that fire on surface tokens. They favor the narrow form proposed in section 9 (a cue word such as both, option(s), answer(s), תשובות, שניהם AND a reference token that resolves to an option id of the same item) over a bare 'and'/'ו' pattern, which would fire on legitimate conjunctions. The reading check (no would-be false trigger in 78 + 89 cases) still stands; it is a reading check, not a measured rate.
- **Deterministic feasibility and semantics:** detecting the reference is deterministic and needs no semantics; judging whether the combination is logically valid does need semantics and is not claimed.
- **Why the verdict did not change:** the human review changed no fact about this check; it only reinforced the need to stay narrow and context-aware. WATCH would be defensible given the evidence class, which is why confidence stays low-to-medium. Conditions are unchanged from section 9 (WARNING-level advisory, explicit cue list, purpose-built negative set, a fresh held-out batch rather than HO-026/027/064).

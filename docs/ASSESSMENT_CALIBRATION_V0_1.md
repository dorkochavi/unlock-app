# Assessment Linter Calibration Report - Golden Dataset v0.1

Status: DRAFT evidence artifact. Created in Run `2026-10-08-ASSESSMENT-ENGINE-002` (B5 + B6; AE-004, AE-033, AE-034, AE-046); regenerated in Run `2026-10-08-ASSESSMENT-ENGINE-003`, Slice B3.
Subject: the UNWIRED deterministic question linter `src/domain/assessment/question-lint.ts` (plus `text-normalize.ts`). Run 002 numbers were measured at `c2941d6` with no linter change. The linter WAS changed in Run 003 (Slices B2/B4): historical commits `2e379e2` (rule-level fixes for the 4 golden false positives) and `ee4494e` (bounded Latin/Cyrillic/Greek homoglyph fold in the duplicate key). The generated sections below, and sections 2-3, reflect the Run 003 linter; sections 4-5 are the Run 002 snapshot, annotated where Run 003 superseded them. No integration verdict is made here (Run 003 Slice B5).

## 1. What this is (and is not)

- An **evaluation fixture**, not training data. Synthetic general-knowledge content only (no Ruppin or other real course content, no student data), Hebrew-first with an English and a mixed-script slice.
- Fixtures: `src/domain/assessment/golden/golden-dataset-v0-1.ts` (typed TS). Harness: `src/domain/assessment/golden/calibration.ts` (`runCalibration`, `formatCalibrationMarkdown`). Tests: `src/domain/assessment/__tests__/golden-calibration.test.ts`.
- **No single opaque score.** The report is a per-check table plus plain counts: PRECISION-LIKE, RECALL-LIKE, FP count, FN count, UNSUPPORTED SEMANTIC CASES.
- **Tiny fixture, indicative ratios only.** 89 cases cannot support statistics. A ratio such as `3/3` means "no counter-example in this fixture", not "reliable".
- Ground truth is the author's reading of what a careful reviewer would say. It has **not** been reviewed by a Hebrew-fluent human annotator (OPEN QUESTION, ASSESSMENT_ENGINE section 19.5). Treat Hebrew labels as provisional until that review.
- Expectations were set from ground truth first, then the linter was run. Disagreements were NOT bent away: each is a `KNOWN_MISS` (false negative) or `KNOWN_FALSE_POSITIVE` below, and the test fails if any disagreement is undocumented or any documentation goes stale.

### Label vocabulary

| Term | Meaning |
|---|---|
| expectedCodes | Ground-truth codes that must fire. Missing one = FN (false negative). |
| forbiddenCodes | Ground-truth codes that must not fire. Emitting one = FP (false alarm). |
| CLEAN case | No WARNING/ERROR at all is correct; any WARNING/ERROR is an FP. Used for the false-positive measurement. |
| KNOWN_MISS | Documented FN. `HEURISTIC_GAP` = the check exists but does not catch it; `NOT_IMPLEMENTED` = no implemented check covers the flaw (AE-029). |
| KNOWN_FALSE_POSITIVE | Documented FP with a reason. |
| SEMANTIC_EXPECTATION | A quality judgment the deterministic linter cannot prove. Never asserted against the linter; counted as an intentionally unsupported semantic case. |
| NEG | Number of cases labelled as a negative for that code (forbidden, or a CLEAN case of matching scope). FP is only measured over these, so a code with a small NEG has weak FP evidence. |

### Regenerating

There is no script. The generated sections (between the `GENERATED` markers) are produced by `formatCalibrationMarkdown(runCalibration(GOLDEN_DATASET_V0_1))`. A test asserts this document contains exactly that text; when a heuristic, threshold or fixture changes, the test diff shows the change, and the block (and the `EXPECTED_*` constants in the test) must be updated deliberately in review.

<!-- GENERATED:BEGIN formatCalibrationMarkdown (src/domain/assessment/golden/calibration.ts) -->
## Headline (generated)

- RECALL-LIKE (all labelled detections): 67/73 caught.
- FN count: 6 (3 HEURISTIC_GAP on implemented checks, 3 NOT_IMPLEMENTED checks).
- PRECISION-LIKE (labelled detections vs false alarms): 67/67.
- FP count: 0 (all documented as KNOWN_FALSE_POSITIVE: yes).
- CLEAN cases with a WARNING/ERROR: 0 of 18.
- UNSUPPORTED SEMANTIC CASES: 6 (intentionally not asserted against the linter).
- Tiny synthetic fixture: all ratios are INDICATIVE ONLY, not statistics. Thresholds remain product-design defaults.

## Case counts (generated)

| Measure | Count |
|---|---|
| Total cases | 89 |
| ITEM cases | 72 |
| SET cases | 17 |
| CLEAN cases (no WARNING/ERROR is correct) | 18 |
| UNSUPPORTED SEMANTIC CASES | 6 |
| Cases with a KNOWN_MISS | 6 |
| Cases with a KNOWN_FALSE_POSITIVE | 0 |

## Per-check results (generated)

TP = caught, FN = missed, FP = false alarm. NEG = cases labelled as a negative for the code (forbidden, or a CLEAN case of that scope): FP is only measured over those.

| Check code | Implemented | Expected | TP | FN | FP | NEG | PRECISION-LIKE | RECALL-LIKE |
|---|---|---|---|---|---|---|---|---|
| ARTICLE_MISMATCH | NO | 1 | 0 | 1 | 0 | 0 | n/a | 0/1 |
| CORRECT_COUNT_INVALID | yes | 2 | 2 | 0 | 0 | 18 | 2/2 | 2/2 |
| CORRECT_IDS_TOO_MANY | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| CORRECT_ID_UNKNOWN | yes | 1 | 1 | 0 | 0 | 17 | 1/1 | 1/1 |
| DUPLICATE_STEM_EXACT | yes | 1 | 1 | 0 | 0 | 8 | 1/1 | 1/1 |
| DUPLICATE_STEM_NORMALIZED | yes | 2 | 2 | 0 | 0 | 7 | 2/2 | 2/2 |
| EXPLANATION_MISSING | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| INPUT_UNREADABLE | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| KEY_LONGEST_OPTION | yes | 3 | 3 | 0 | 0 | 19 | 3/3 | 3/3 |
| KEY_POSITION_IMBALANCE | yes | 1 | 1 | 0 | 0 | 4 | 1/1 | 1/1 |
| KEY_POSITION_RUN | yes | 1 | 1 | 0 | 0 | 4 | 1/1 | 1/1 |
| KEY_STEM_LEXICAL_OVERLAP | yes | 5 | 4 | 1 | 0 | 16 | 4/4 | 4/5 |
| NEAR_DUPLICATE_STEM | yes | 3 | 2 | 1 | 0 | 5 | 2/2 | 2/3 |
| OPTIONS_TOO_FEW | yes | 2 | 2 | 0 | 0 | 16 | 2/2 | 2/2 |
| OPTIONS_TOO_MANY | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| OPTION_ABSOLUTE_TERM | yes | 3 | 3 | 0 | 0 | 16 | 3/3 | 3/3 |
| OPTION_ALL_OF_ABOVE | yes | 3 | 3 | 0 | 0 | 18 | 3/3 | 3/3 |
| OPTION_COMBINATION_REFERENCE | NO | 1 | 0 | 1 | 0 | 0 | n/a | 0/1 |
| OPTION_DUPLICATE_EXACT | yes | 1 | 1 | 0 | 0 | 26 | 1/1 | 1/1 |
| OPTION_DUPLICATE_NORMALIZED | yes | 10 | 10 | 0 | 0 | 18 | 10/10 | 10/10 |
| OPTION_EMPTY | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| OPTION_ID_DUPLICATE | yes | 1 | 1 | 0 | 0 | 16 | 1/1 | 1/1 |
| OPTION_LENGTH_IMBALANCE | yes | 2 | 2 | 0 | 0 | 19 | 2/2 | 2/2 |
| OPTION_NONE_OF_ABOVE | yes | 2 | 2 | 0 | 0 | 19 | 2/2 | 2/2 |
| OPTION_OVERLAP_HIGH | yes | 2 | 1 | 1 | 0 | 16 | 1/1 | 1/2 |
| OPTION_STYLE_OUTLIER | NO | 1 | 0 | 1 | 0 | 0 | n/a | 0/1 |
| OPTION_WHITESPACE_ANOMALY | yes | 4 | 4 | 0 | 0 | 16 | 4/4 | 4/4 |
| QUESTION_TYPE_UNSUPPORTED | yes | 3 | 3 | 0 | 0 | 16 | 3/3 | 3/3 |
| SET_ANALYSIS_TRUNCATED | yes | 1 | 1 | 0 | 0 | 2 | 1/1 | 1/1 |
| SET_ITEMS_TRUNCATED | yes | 1 | 1 | 0 | 0 | 2 | 1/1 | 1/1 |
| SET_KEY_LENGTH_BIAS | yes | 1 | 1 | 0 | 0 | 3 | 1/1 | 1/1 |
| SET_TOO_SMALL | yes | 1 | 1 | 0 | 0 | 2 | 1/1 | 1/1 |
| STEM_EMPTY | yes | 2 | 2 | 0 | 0 | 16 | 2/2 | 2/2 |
| STEM_NEGATIVE_WORDING | yes | 3 | 3 | 0 | 0 | 16 | 3/3 | 3/3 |
| STEM_TEMPLATE_REPEATED | yes | 1 | 1 | 0 | 0 | 3 | 1/1 | 1/1 |
| STEM_TOO_SHORT | yes | 1 | 1 | 0 | 0 | 17 | 1/1 | 1/1 |
| TEXT_TRUNCATED | yes | 2 | 2 | 0 | 0 | 16 | 2/2 | 2/2 |

## KNOWN_MISS list (generated)

| Case | Codes | Kind | Reason |
|---|---|---|---|
| WEAK-LEAKAGE-HE-INFLECTION-01 | KEY_STEM_LEXICAL_OVERLAP | HEURISTIC_GAP | Only exact prefix-stripped tokens match; inflection/morphology (מחיר/המחירים, עלייה/עליית) is not unified, so overlap counts 1 < 2. |
| WEAK-GRAMMAR-CUE-EN-01 | ARTICLE_MISMATCH | NOT_IMPLEMENTED | ARTICLE_MISMATCH is a documented but unimplemented code (AE-029). |
| WEAK-STYLE-CUE-HE-01 | OPTION_STYLE_OUTLIER | NOT_IMPLEMENTED | OPTION_STYLE_OUTLIER is a documented but unimplemented code (AE-029); the length and leakage checks fire only as incidental partial signals. |
| WEAK-COMBINATION-EN-01 | OPTION_COMBINATION_REFERENCE | NOT_IMPLEMENTED | OPTION_COMBINATION_REFERENCE is a documented but unimplemented code (AE-029). |
| OVERLAP-OPTIONS-HE-BOUNDARY-01 | OPTION_OVERLAP_HIGH | HEURISTIC_GAP | Boundary: Jaccard 0.833 < OPTION_OVERLAP_JACCARD 0.85 for short options; a single extra word on a 5-word option is a large relative change. |
| SET-NEAR-DUP-INFLECTION-01 | NEAR_DUPLICATE_STEM | HEURISTIC_GAP | Gender/number inflections change the tokens, so Jaccard falls below the threshold (documented expected miss, ASSESSMENT_ENGINE section 19.4). |

## KNOWN_FALSE_POSITIVE list (generated)

| Case | Codes | Reason |
|---|---|---|

## Intentionally unsupported semantic cases (generated)

| Case | SEMANTIC_EXPECTATION |
|---|---|
| SEM-AMBIGUOUS-01 | SEMANTIC_EXPECTATION: 'largest' is ambiguous (by mass, length, or on land): the linter passes it; a human or critic must flag the two defensible keys. |
| SEM-DISTRACTORS-PLAUSIBLE-01 | SEMANTIC_EXPECTATION: distractors are other capitals, so they are plausible to a learner; plausibility is not computable by the linter. |
| SEM-DISTRACTORS-IMPLAUSIBLE-01 | SEMANTIC_EXPECTATION: distractors are not alternatives a learner would consider; the item gives away the key. Linter sees balanced short options and stays silent. |
| SEM-EQUIVALENT-STEMS-NOTE-01 | SEMANTIC_EXPECTATION: item 0 and item 11 assess the same fact (assessment-equivalent paraphrase); token similarity is far below NEAR_DUPLICATE_STEM, so detection needs a semantic critic. |
| SET-TOPIC-UNDERCOVERAGE-01 | SEMANTIC_EXPECTATION: topic under-coverage / TOPIC_CONCENTRATION needs topic or objective metadata, which does not exist today; the linter cannot see topics. |
| SET-RECALL-OVERUSE-01 | SEMANTIC_EXPECTATION: overuse of recall-level questions (RECALL_EXCESS) needs cognitive-level metadata; unsupported by the linter. |
<!-- GENERATED:END -->

## 2. Reading the results

- **Strong area: structural diagnostics and normalization.** Every ERROR-class structural case, every Hebrew normalization variant (niqqud, final letters, geresh/gershayim, maqaf, NFC/NFD, Eastern Arabic digits, zero-width, bidi) and every bounded-work case (60 options, 60 correct ids, ~6000-char strings, throwing input, 2001-item set) behaved as ground truth says. Confusable homoglyphs (Cyrillic `a`), missed in Run 002, are now caught by the bounded fold (ADV-HOMOGLYPH-01).
- **Weak area: Hebrew word-level heuristics.** Run 002 had 4 false positives from word lists on attached-prefix Hebrew tokens or ambiguous words (`מרק`/`ברק`, `חוץ`, English `at least`); Run 003 rule-level fixes removed all 4 at a recall cost and with residuals (section 7). The remaining Hebrew misses are morphological (inflection) or boundary cases (overlap 0.833 vs 0.85).
- **Clean-case behaviour.** All 18 CLEAN cases are silent (Run 002: 14 of 18; the 4 that warned were the former KNOWN_FALSE_POSITIVE cases, now fixed). This is a fixture-fit result: the rules were adjusted against these very cases, so 0 FP is not evidence of 0 FP on real content.
- **Unimplemented checks** (`ARTICLE_MISMATCH`, `OPTION_STYLE_OUTLIER`, `OPTION_COMBINATION_REFERENCE`) appear in the table with Implemented = NO so they are never mistaken for coverage.
- **Semantic cases are silent by design.** The linter passes an ambiguous item, implausible distractors, a paraphrase-equivalent pair, topic under-coverage and recall overuse. This is the documented limit of code (ASSESSMENT_ENGINE section 19.3), and the reason a clean result must never be shown as "good question".

## 3. Threshold verdicts

All thresholds are product-design defaults, not research-backed. Verdict rules: `KEEP` = no evidence against and plausible default; `WATCH` = evidence of risk or too little evidence to judge; `CHANGE` = only with concrete fixture evidence. **No threshold is changed in this Slice**, and a verdict of KEEP is "KEEP-provisional" (one tiny fixture cannot validate a number).

| Threshold (current value) | Fixture evidence | Verdict | Reason |
|---|---|---|---|
| KEY_LONGEST_RATIO (1.2) | 3 TP (key ~2x the next-longest); 0 FP over 19 negatives; near-threshold silent cases exist (ratio 1.25 with +8 chars; +6 chars in the set-bias fixture) | KEEP-provisional | No counter-evidence; no fixture sits close enough above 1.2 to tell whether 1.2 is too sensitive. |
| KEY_LONGEST_MIN_CHAR_DIFF (15) | Same cases; the absolute floor is what keeps 1.25x short answers silent | WATCH | 15 code points is large relative to short Hebrew keys (4-8 letters); a key 2x longer but under 15 characters never fires. No fixture proves a miss, so not CHANGE. Needs Hebrew short-answer data. |
| OPTION_LENGTH_IMBALANCE ratio 3.0 / min diff 20 | 2 TP; 0 FP over 19 negatives | KEEP-provisional | Plausible and quiet on clean cases. Numeric/one-word option sets can never fire (floor 20), likely intended. |
| NEAR_DUPLICATE_STEM Jaccard (0.80) | 2 TP (12-token stem with one word changed; reordered stem); 1 miss (inflection, a normalization problem rather than a threshold problem); 0 FP over 5 negatives | WATCH | A one-word change in a stem of fewer than ~9 tokens scores below 0.8 and would be missed, but no fixture shows it, and only 5 negatives exist. Lowering the threshold is unjustified until short-stem negatives exist. |
| OPTION_OVERLAP_JACCARD (0.85) | 1 TP (8-word option + 1 word = 0.889); 1 boundary miss (5-word option + 1 word = 0.833); 0 FP over 16 negatives | WATCH | One concrete boundary case, but a single case plus 16 negatives (none deliberately similar-but-distinct options) does not justify CHANGE. Candidate to test later: 0.80 against a purpose-built set of legitimately similar options. |
| KEY_STEM_OVERLAP_MIN_TOKENS (2) / MIN_TOKEN_LENGTH (3) | 4 TP; 0 FP over 16 negatives; the 1 miss is inflection (overlap counted 1), not the threshold | KEEP-provisional | The miss is fixed by morphology handling, not by lowering the minimum to 1 (which would flag any single shared word). |
| MIN_SET_SIZE / SET_TOO_SMALL (8) | Both sides of the boundary exercised (5 items warns, 8 items does not) | KEEP-provisional | Behaves as designed. 8 is also the floor below which per-position statistics are suppressed; whether 8 suits a real quiz is a product decision, not a calibration result. |
| KEY_POSITION_SHARE_FACTOR (1.5 / k) | 1 TP (5 of 12); balanced 12-item and boundary 8-item sets silent | WATCH (high priority) | Fixture is consistent, but an analytic check shows the rule is statistically fragile: with perfectly random fair key placement over 4 options, an imbalance warning fires for about 45% of 8-item sets, 59% of 12-item sets, 40% of 20-item sets and 11% of 40-item sets (analytic binomial estimate for uniform random key placement; NOT reproduced by code in this repo). Expect many false alarms on small real quizzes. Not CHANGE here because the evidence is analytic, not a fixture case; recommended follow-up is a significance-aware rule (section 5). |
| KEY_POSITION_RUN_LENGTH (4) | 1 TP (run of four); shorter runs silent | WATCH | For random fair 4-option keys a run of 4 or more occurs in about 6% of 8-item, 11% of 12-item, 19% of 20-item and 37% of 40-item sets (analytic estimate, not reproduced in the repo), so the rule grows noisy on long sets. A run of 4 is still a visible pattern to a human reader; keep as an informational note. |
| SET_KEY_LENGTH_BIAS_SHARE (0.5, min 8 eligible) | 1 TP (7 of 12 strictly longest by a few characters); balanced set silent | KEEP-provisional | Strictly-longest is a strict, low-noise criterion; no counter-evidence. |
| STEM_TEMPLATE_SHARE (0.4) / TOKEN_COUNT (3) | 1 TP (6 of 12); 0 FP | KEEP-provisional | No counter-evidence; single case only. |

## 4. INTEGRATION READINESS (Run 002 snapshot, superseded by Run 003 Slice B5)

> Historical: figures below (4 of 18 CLEAN warn, 2 HEURISTIC_GAP) describe the Run 002 linter. Current numbers are in the generated headline. A fresh integration verdict is deferred to Run 003 Slice B5 and is NOT made here.

**Verdict (Run 002): NOT_READY** for wiring into any instructor-facing flow. This is a recommendation; nothing is integrated in this Slice (AE-031 stays gated).

| Criterion | Status | Evidence |
|---|---|---|
| Contract clarity | PASS | Header states: secondary quality linter, defensive structural diagnostics only, ERROR is not authoritative validation, unsupported questionType handling, no silent truncation. Codes are content-blind. |
| Bounded runtime | PASS | Hostile cases pass: 60 options, 60 correct ids, ~6000-char prompt and option, throwing input, a 2001-item set (explicit `SET_ITEMS_TRUNCATED` + `SET_ANALYSIS_TRUNCATED`). The whole dataset runs in well under a second. |
| Stable codes | PASS | Code names, scopes and severities are unchanged by calibration and pinned by the regression test. |
| Determinism | PASS | Identical report on repeated runs (asserted); no clock, randomness or IO in the linter or harness. |
| False-positive behaviour | FAIL (for default-on use) | 4 of 18 CLEAN cases warn. `OPTION_ABSOLUTE_TERM` flags common words (`מרק`, `ברק`; by the same mechanism `שכל`, `שום`). `STEM_NEGATIVE_WORDING` flags `חוץ` and `at least`. Set-level `KEY_POSITION_IMBALANCE` is analytically noisy on small fair sets. |
| Hebrew behaviour | WATCH | Normalization is strong. Word-list checks suffer prefix collisions; inflection is not handled (2 HEURISTIC_GAP misses on stem/key leakage and near-duplicate stems). Labels lack Hebrew-fluent annotator review. |
| Blocking semantic false confidence | WATCH | A clean lint result is silent on ambiguity, implausible distractors, paraphrase duplicates, topic and cognitive balance (6 unsupported semantic cases). Safe only if the surface never presents "no warnings" as "good question" and never blocks or auto-approves on lint. |

### Conditions to reach READY_FOR_INTEGRATION (advisory-only)

1. Fix or constrain the known false-positive families (section 5, items 1-2) and re-run this calibration with the KNOWN_FALSE_POSITIVE entries removed.
2. Replace or suppress the set-level `KEY_POSITION_IMBALANCE` rule with a significance-aware rule (section 5, item 4) or gate it behind a larger minimum set size.
3. Surface lint only as non-blocking advisory text with explicit wording that automated checks cannot judge correctness, ambiguity or distractor quality; no pass/fail badge, no publish gating, no score.
4. Have a Hebrew-fluent reviewer confirm or correct the Hebrew labels, and grow the dataset from real linter false positives/negatives (synthetic or properly cleared).
5. Reconcile code names with the existing import validator (AE-031) before any wiring.

## 5. Suggested linter fixes (Run 002 list; status after Run 003)

Status: items 1 and 2 applied in Run 003 B2 (`2e379e2`, with recall/residual costs in section 7); item 5 applied in Run 003 B4 (`ee4494e`). Items 3, 4, 6, 7 remain open (see section 9 dispositions).

1. **Absolute-term prefix collisions** (`מרק`, `ברק`, `שכל`, `שום`): do not accept attached prefix letters for `רק`, `כל`, `שום`; or accept only unambiguous prefixes and add an exact-token stoplist for known collisions. Re-run: FP-ABSOLUTE-SOUP-01 / FP-ABSOLUTE-LIGHTNING-01 should become silent while the three absolute-term cases keep firing.
2. **Negation noun uses**: drop `חוץ` as a standalone negation (keep the phrase `חוץ מ`) and match English `least` only when not preceded by `at`. Re-run: FP-NEGATION-HE-HUTZ-01 and FP-NEGATION-EN-LEAST-01.
3. **Inflection-tolerant overlap** for `KEY_STEM_LEXICAL_OVERLAP` and `NEAR_DUPLICATE_STEM`: a conservative Hebrew suffix fold (plural `ים`/`ות`, feminine `ה`/`ת`, construct) evaluated against the fixtures to avoid new FPs. Re-run: WEAK-LEAKAGE-HE-INFLECTION-01, SET-NEAR-DUP-INFLECTION-01.
4. **Significance-aware position rule**: replace the fixed `1.5 / k` share with a binomial tail (flag a position only when its count is improbable under uniform placement, about 5% after accounting for k positions), or raise the minimum group size. Add fixtures: random-fair sets of 8, 12 and 20 items that must stay silent.
5. **Homoglyph/confusable folding** for the duplicate key (UTS #39-style skeleton limited to Latin/Cyrillic/Greek look-alikes), if mixed-script option sets occur in real imports. Low priority; hardening rather than a quality heuristic.
6. **Option overlap on short options**: consider a size-aware rule (for example also flag two options differing by a single token when each has at most 6 tokens). Needs a purpose-built negative set first; do not lower 0.85 blindly.
7. **Unimplemented codes** exercised as honest misses (`ARTICLE_MISMATCH`, `OPTION_STYLE_OUTLIER`, `OPTION_COMBINATION_REFERENCE`): prioritise via AE-029 only after the false-positive work above, per ledger guidance.

## 6. Limits of this evidence (unchanged by Run 003 except where noted)

- 89 hand-made synthetic cases, single author, no inter-annotator agreement.
- Thresholds are checked at a handful of points, not swept; do not read a KEEP as validation.
- The position-rule noise figures come from an analytic binomial estimate of uniform random key placement (no script committed) over 4 options, not from real quizzes.
- Local pure-function evidence only; says nothing about import/publish flow, UI wording, or instructor behaviour.

## 7. Known limits of the Run 003 rule fixes

Accepted costs and residuals, deliberately documented rather than hidden. All are WARNING-only heuristic limits.

- **2-letter-term prefix recall loss.** `רק`/`כל` accept only the conjunction `ו` as an attached prefix, so `בכל` / `לכל` / `מכל` / `ככל` (e.g. "לכל התאים") no longer trigger `OPTION_ABSOLUTE_TERM`, while `ורק` / `וכל` do. Pinned by a unit test in `question-lint.test.ts`; no Golden case.
- **`שום` homograph.** `שום` is both "garlic" and the absolute "no/any"; it remains ambiguous, so a garlic option is a possible false positive and a prefixed absolute use is a possible miss.
- **`חוץ מ…` next-token residual.** `חוץ` counts as negation only in the exception phrase before a `מ`-initial next token; a noun phrase whose next word happens to start with `מ` can still warn, and an exception phrase with a different continuation is missed.
- **`at least` idiom ignored.** `least` is not negation after `at`; a rare genuinely negative use is missed.
- **Duplicate-key lookalike fold.** `duplicateKey` folds a table of 14 Cyrillic/Greek lookalikes to Latin (bounded, not a full UTS #39 skeleton). Other scripts and unlisted confusables are not folded.

## 8. Run 002 vs Run 003

Per-check deltas only; there is no single score. Same 89-case fixture; Run 003 numbers are the generated headline above. Fixture-fit caveat applies: Run 003 rules were tuned against these cases.

| Check | Run 002 | Run 003 | Delta |
|---|---|---|---|
| Labelled detections caught (recall-like) | 66/73 | 67/73 | +1 (homoglyph) |
| FN total (HEURISTIC_GAP + NOT_IMPLEMENTED) | 7 (4 + 3) | 6 (3 + 3) | -1 HEURISTIC_GAP |
| FP total | 4 | 0 | -4 |
| CLEAN cases with WARNING/ERROR | 4 of 18 | 0 of 18 | -4 |
| Unsupported semantic cases | 6 | 6 | 0 |
| OPTION_ABSOLUTE_TERM | 3/3 recall, 2 FP | 3/3 recall, 0 FP | FP -2 (recall loss on `בכל/לכל/מכל/ככל` is not in the fixture) |
| STEM_NEGATIVE_WORDING | 3/3 recall, 2 FP | 3/3 recall, 0 FP | FP -2 (residuals in section 7) |
| OPTION_DUPLICATE_NORMALIZED | 9/10 recall | 10/10 recall | +1 |
| KEY_STEM_LEXICAL_OVERLAP, NEAR_DUPLICATE_STEM, OPTION_OVERLAP_HIGH | 4/5, 2/3, 1/2 | 4/5, 2/3, 1/2 | none |
| Unimplemented codes (ARTICLE_MISMATCH, OPTION_STYLE_OUTLIER, OPTION_COMBINATION_REFERENCE) | 0/1 each | 0/1 each | none |

### Heuristic family verdicts

| Family | Verdict | Basis |
|---|---|---|
| Structural diagnostics and normalization | KEEP | No miss or FP in either run. |
| Absolute terms (`OPTION_ABSOLUTE_TERM`) | WATCH | FPs removed; known recall loss on 2-letter-term prefixes and `שום` ambiguity; needs real Hebrew options to size the loss. |
| Negation (`STEM_NEGATIVE_WORDING`) | WATCH | FPs removed; `חוץ מ…` and `at least` residuals (section 7). |
| Duplicate normalized (`OPTION_DUPLICATE_NORMALIZED`) | KEEP | 10/10 with bounded fold; fold is deliberately limited. |
| Lexical overlap / key leakage (`KEY_STEM_LEXICAL_OVERLAP`) | WATCH | 1 miss from Hebrew inflection; stemming risks new FPs. |
| Near-duplicate stems (`NEAR_DUPLICATE_STEM`) | WATCH | 1 inflection miss; only 5 negatives. |
| Option overlap (`OPTION_OVERLAP_HIGH`) | WATCH | 0.833 vs 0.85 boundary miss; one case does not justify tuning. |
| Length/position/template set checks | WATCH | Position rules analytically noisy on small sets (section 3); other set checks KEEP-provisional. |
| Unimplemented codes | CHANGE (only via AE-029) | Honest misses; no behaviour to keep. |

## 9. False-negative disposition

Each remaining or newly fixed false negative has an explicit disposition (B4 result). Pointers only; see `docs/ASSESSMENT_ENGINE.md` for the ledger.

| Case | Check | Disposition | Rationale |
|---|---|---|---|
| ADV-HOMOGLYPH-01 | OPTION_DUPLICATE_NORMALIZED | FIX_NOW_DETERMINISTIC (fixed, `ee4494e`) | Bounded Cyrillic/Greek to Latin fold in `duplicateKey`. |
| WEAK-LEAKAGE-HE-INFLECTION-01 | KEY_STEM_LEXICAL_OVERLAP | KEEP_AS_KNOWN_LIMIT | Hebrew morphology; stemming would raise false positives. |
| SET-NEAR-DUP-INFLECTION-01 | NEAR_DUPLICATE_STEM | KEEP_AS_KNOWN_LIMIT | Same morphology reason. |
| OVERLAP-OPTIONS-HE-BOUNDARY-01 | OPTION_OVERLAP_HIGH | KEEP_AS_KNOWN_LIMIT | Jaccard 0.833 vs 0.85; tuning to one case is overfitting; revisit with more labelled data. |
| WEAK-GRAMMAR-CUE-EN-01 | ARTICLE_MISMATCH | TOO_NOISY / FUTURE_RESEARCH | Phonetic a/an exceptions; English-only. |
| WEAK-STYLE-CUE-HE-01 | OPTION_STYLE_OUTLIER | FUTURE_RESEARCH | No calibrated thresholds; the length part is covered by existing checks. |
| WEAK-COMBINATION-EN-01 | OPTION_COMBINATION_REFERENCE | KEEP_AS_KNOWN_LIMIT (deferred) | Best next candidate (AE-029). |

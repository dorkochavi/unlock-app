# Assessment Linter Held-Out Evaluation - Golden Dataset v0.4

Status: DRAFT evidence artifact. Created in Run `2026-10-09-ASSESSMENT-ENGINE-009`, Slice F2 (classification and report; fresh held-out validation of the Run 008 hardening).
Subject: the UNWIRED deterministic question linter `src/domain/assessment/question-lint.ts` (plus `text-normalize.ts`), unchanged since Run 008 implementation commit `ab784dc` and unchanged throughout Run 009. This is a VALIDATION report: no linter, normalizer, corpus, label, test or threshold was modified.
Evidence identity: `FRESH_HELD_OUT_V0_4`. Corpus `MODEL_AUTHORED_HELD_OUT`; labels `MODEL_LABELED_NOT_HUMAN_APPROVED`. It is NOT `FIRST_BLIND`. No human adjudication of v0.4 exists at this point.

Evidence classes are never pooled: `FRESH_HELD_OUT_V0_4` (this report), `FRESH_HELD_OUT_V0_3`, `HUMAN_ADJUDICATED_V0_3` (post-evaluation, not blind), `CURRENT_LINTER_ON_FROZEN_V0_2` (regression), `FIRST_BLIND` (v0.2, Run 004, historical), v0.1 fixture. Every comparison in section 6 is side by side, with its own denominator.

Source of every number: `scratch/v04/eval-report.json` (gitignored; produced by the harness guard committed at `7d3f517`). Per-case emitted-versus-labeled codes were read from that file; mechanism statements come from read-only inspection of the linter source.

## 1. Identity, provenance and method honesty

| Item | Value |
|---|---|
| RUN_ID | `2026-10-09-ASSESSMENT-ENGINE-009` |
| V04_FREEZE_HEAD | `5a99fdf` (corpus, labels, author-intent, label-review, contamination audit and hashes frozen; linter NOT run on the corpus before this commit) |
| Evaluation guard | `7d3f517` (first-observed regression guard; current linter unchanged) |
| Linter under test | `ab784dc` code (Run 008 hardening), no later code change |
| Corpus | 75 cases = 72 ITEM + 3 SET; items: 44 Hebrew / 28 English; 58 single-choice + 14 multiple-choice items; sets: HO4-073 (Hebrew, 9 items), HO4-074 (English, 9), HO4-075 (Hebrew, 10) |
| Labels | 25 CLEAN / 50 FLAWED; 45 deterministic-labelled; 5 semantic-only (HO4-066, 067, 068, 071, 072); 9 cases carry a `semanticExpectation`; 26 `languageReviewRequired` |
| Expected deterministic detections | 93 (47 on implemented rules, 46 on NOT_IMPLEMENTED rules) |

SHA-256 of corpus, labels, author-intent and label-review are recorded in `golden/heldout-v0-4/freeze-hashes.json` (not repeated here).

### 1.1 Separation was by instruction, not tool-enforced

AUTHOR (fresh worker, brief restricted: no linter, src, docs or fixtures), LABEL (fresh worker; saw corpus plus catalog doc sections, not author-intent, not the linter) and LABEL REVIEW (fresh worker; saw corpus, labels and author-intent; edited pre-freeze, 53 logged change entries, 15 logged unchanged disagreements) were separated only by instruction. The repository cannot verify it. Same model family for every worker. The review worker flipped HO4-062 and HO4-063 from FLAWED to CLEAN and made a minimal corpus edit to HO4-013 and HO4-009, so corpus and labels are not the raw output of independent author and labeler.

### 1.2 Contamination audit and replacements

Three mechanical-plus-manual audit rounds against v0.1/v0.2/v0.3 corpora, human overlays and test fixtures, plus a fourth parent-run mechanical check:

| Round | exact | near | same-concept | Replaced after the round |
|---|---|---|---|---|
| 1 | 5 | 12 | 9 | 26 items |
| 2 | 1 | 4 | 7 | 12 items (+ HO4-013 minimal edit) |
| 3 | 0 | 2 | 12 | 9 items |
| 4 (parent check) | - | 1 near (HO4-018 vs HO3-011) | - | HO4-018 re-replaced |

Total 48 item replacements (26 + 12 + 9 + 1 re-replacement), each by a fresh author not shown the prior material, independently relabelled and label-reviewed. Accepted generic residual (policy: generic educational overlap is not replaced): HO4-010, 012, 043, 061, 062, 063 (same concept as v0.2 HO-004, HO-008, HO-072#2, v0.3 HO3-065, v0.2 HO-037/HO-006, v0.2 HO-073#0). Three of these (061, 062, 063) are cases analysed below, so their freshness is topic-level only. Limitation recorded in the audit: round-3 and round-4 replacements were checked only by a parent-run token-Jaccard pass (max 0.67), not by a further worker re-audit. Freshness is lexical and topic-level, not proof of independence from earlier corpora or from the linter author's habits.

### 1.3 Composition versus targets (deviations stated plainly)

- CLEAN share is 25/75 = 33 percent, BELOW the 40-50 percent target. Only 4 of the 25 CLEAN cases are English; 21 are Hebrew. English CLEAN precision (0 of 4 warned) is therefore nearly unmeasured.
- Language is skewed to Hebrew: 44 Hebrew versus 28 English items (46 versus 29 cases including sets).
- Multiple-choice is 14 of 72 items (19 percent).
- Strata (A, B, C, D, E as carried in the harness) are by design; their semantics are not defined in the inputs read here. By reading the cases they appear to be: A mostly CLEAN controls (20 of 28 CLEAN), B deterministic flaws, C edge shapes (short stems, negation frame, vignettes), D semantic/contested, E sets. That reading is an inference, not a documented definition.
- Several rules were exercised only thinly: STEM_TOO_SHORT has 4 expected, OPTION_ABSOLUTE_TERM 3, OPTION_ALL_OF_ABOVE 4, STEM_NEGATIVE_WORDING 6. Ratios such as `4/4` mean "no counter-example", not "reliable".

### 1.4 Label regime inflates expected counts and FN

The independent labeler applied the catalog doc literally, including rules the linter does not implement:

- OPTION_STYLE_OUTLIER, using its own literal threshold (one option deviating more than 0.6 x median length, or a terminal-punctuation/capitalisation outlier): 26 expected detections, all FN_NOT_IMPLEMENTED. 21 of 26 are length-only; 11 of those co-occur with an emitted length rule, and 10 are natural-content outliers (for example HO4-001, 037, 059).
- STEM_NO_QUESTION_FORM (8 expected) applied to imperative stems without `?` (HO4-004, 031, 040, 042) although doc 19.7 item 4 only exempts `:` cloze stems; QUESTION_TYPE_MONO (3 expected) applied literally to any single-type set of 8 or more items, including HO4-073 whose author intent was a healthy CLEAN set.
- 14 items the author intended CLEAN were labelled FLAWED on literal thresholds (HO4-001, 003, 004, 006, 009, 017, 019, 023, 031, 037, 040, 042, 049; plus set HO4-073); 2 author-FLAWED items were labelled CLEAN (HO4-008, 064). 19 of the 93 expected detections sit in author-intended-CLEAN cases (18 item-level, 1 set-level), of which 7 were caught.

Consequence: "all codes" recall is dominated by unsupported rules and label policy. Both views are reported below, labelled, and no label was changed.

## 2. Metrics (FRESH_HELD_OUT_V0_4; source `scratch/v04/eval-report.json`)

### 2.1 Headline

| View | Expected | TP | FN | of which HEURISTIC_GAP | of which NOT_IMPLEMENTED | FP | UNLABELED | CLEAN warned |
|---|---|---|---|---|---|---|---|---|
| ALL labelled codes | 93 | 46 | 47 | 1 | 46 | 6 | 2 | 5 of 25 (20.0%) |
| Restricted to IMPLEMENTED rules | 47 | 46 | 1 | 1 | - | 6 | 2 | 5 of 25 |

- ALL codes: RECALL-LIKE 46/93 = 49.5 percent; PRECISION-LIKE 46/52 = 88.5 percent (46 TP versus 6 FP, harness convention; unlabeled emissions not counted). Counting the 2 unlabeled emissions as non-TP gives 46/54 = 85.2 percent.
- IMPLEMENTED rules only: RECALL-LIKE 46/47 = 97.9 percent; precision as above. The restricted view removes only unsupported-rule expectations; it does not remove label-policy effects inside implemented rules.
- The 5 CLEAN cases warned are HO4-007, 008, 015, 062, 063, all STEM_NEGATIVE_WORDING on Hebrew. The 6th FP is STEM_TOO_SHORT on HO4-042 (a FLAWED case where the code is forbidden).
- Set level: SET-scope expected 7, TP 4, FN 3 (QUESTION_TYPE_MONO x3); item-in-set expected 7, TP 0, FN 7 (OPTION_STYLE_OUTLIER x4, OPTION_NUMERIC_UNORDERED x3), all NOT_IMPLEMENTED. Integrity findings: none; out-of-vocabulary codes: none.

### 2.2 By language, type, stratum (ALL codes / IMPLEMENTED only)

| Slice | Cases (CLEAN) | Exp | TP | FN (heur / NI) | FP | UNL | CLEAN warned | Impl-only exp / TP / FN |
|---|---|---|---|---|---|---|---|---|
| Hebrew | 46 (21) | 43 | 23 | 20 (1 / 19) | 6 | 2 | 5 of 21 | 24 / 23 / 1 |
| English | 29 (4) | 50 | 23 | 27 (0 / 27) | 0 | 0 | 0 of 4 | 23 / 23 / 0 |
| SINGLE_CHOICE | 58 (20) | 70 | 37 | 33 (1 / 32) | 6 | 0 | 5 of 20 | 38 / 37 / 1 |
| MULTIPLE_CHOICE | 14 (5) | 9 | 5 | 4 (0 / 4) | 0 | 0 | 0 of 5 | 5 / 5 / 0 |
| SET | 3 (0) | 14 | 4 | 10 (0 / 10) | 0 | 2 | n/a | 4 / 4 / 0 |
| Stratum A | 28 (20) | 10 | 4 | 6 (0 / 6) | 2 | 0 | 2 of 20 | 4 / 4 / 0 |
| Stratum B | 22 (0) | 46 | 27 | 19 (1 / 18) | 0 | 0 | - | 28 / 27 / 1 |
| Stratum C | 14 (5) | 16 | 7 | 9 (0 / 9) | 4 | 0 | 3 of 5 | 7 / 7 / 0 |
| Stratum D | 8 (0) | 7 | 4 | 3 (0 / 3) | 0 | 0 | - | 4 / 4 / 0 |
| Stratum E (sets) | 3 (0) | 14 | 4 | 10 (0 / 10) | 0 | 2 | - | 4 / 4 / 0 |

Hebrew carries every FP, the only heuristic FN and both unlabeled emissions; English is clean on implemented rules but with only 4 CLEAN cases. Stratum C (edge shapes) is where precision breaks (3 of 5 CLEAN warned).

### 2.3 By implemented rule (counts straight from the report)

| Rule | Expected | TP | FN | FP | Unlabeled |
|---|---|---|---|---|---|
| EXPLANATION_MISSING | 2 | 2 | 0 | 0 | 0 |
| KEY_LONGEST_OPTION | 11 | 11 | 0 | 0 | 0 |
| KEY_POSITION_IMBALANCE (set) | 2 | 2 | 0 | 0 | 0 |
| KEY_POSITION_RUN (set) | 2 | 2 | 0 | 0 | 0 |
| OPTION_ABSOLUTE_TERM | 3 | 3 | 0 | 0 | 0 |
| OPTION_ALL_OF_ABOVE | 4 | 4 | 0 | 0 | 0 |
| OPTION_NONE_OF_ABOVE | 2 | 2 | 0 | 0 | 0 |
| OPTION_DUPLICATE_EXACT | 1 | 1 | 0 | 0 | 0 |
| OPTION_DUPLICATE_NORMALIZED | 1 | 1 | 0 | 0 | 0 |
| OPTION_LENGTH_IMBALANCE | 9 | 9 | 0 | 0 | 0 |
| OPTION_OVERLAP_HIGH | 0 | 0 | 0 | 0 | 1 (HO4-075/item7) |
| SET_KEY_LENGTH_BIAS | 0 | 0 | 0 | 0 | 1 (HO4-075) |
| STEM_NEGATIVE_WORDING | 6 | 5 | 1 (HO4-052) | 5 | 0 |
| STEM_TOO_SHORT | 4 | 4 | 0 | 1 (HO4-042) | 0 |

NOT_IMPLEMENTED (all FN): OPTION_STYLE_OUTLIER 26, STEM_NO_QUESTION_FORM 8, OPTION_NUMERIC_UNORDERED 5, OPTION_PUNCTUATION_INCONSISTENT 4, QUESTION_TYPE_MONO 3 = 46.

### 2.4 By coverage area (case-to-area assignment)

Method: each case was assigned ONE primary area by reading its stem, options, label rationale and author intent, choosing the area the case was designed to probe (not every code it emits). Sets form their own area. The assignment is a reading, not a harness field; item-level counts only except the set row (taken from the report's stratum E). Cases not tied to a probed Run 008 area are in "other".

| Area | Cases | n (CLEAN) | Item-level expected | TP | FN impl | FN NI | FP | UNL |
|---|---|---|---|---|---|---|---|---|
| Short stems / stem form | 003, 004, 031, 035, 039, 040, 041, 042, 061, 065 | 10 (1) | 15 | 6 | 0 | 9 | 1 | 0 |
| Hebrew negation | 005, 007, 008, 009, 015, 052, 062, 063, 064 | 9 (6) | 7 | 4 | 1 | 2 | 5 | 0 |
| English negation | 006, 051 | 2 (0) | 3 | 2 | 0 | 1 | 0 | 0 |
| All / none of the above | 010, 011, 012, 014, 053, 054 | 6 (0) | 12 | 7 | 0 | 5 | 0 | 0 |
| Stem-key overlap / leakage | 016, 034, 057 | 3 (1) | 6 | 4 | 0 | 2 | 0 | 0 |
| Absolute terms | 013, 018, 020, 021, 055 | 5 (2) | 5 | 4 | 0 | 1 | 0 | 0 |
| Key length and imbalance | 017, 019, 022, 023, 049, 056, 069, 070 | 8 (0) | 18 | 11 | 0 | 7 | 0 | 0 |
| Semantic-only | 066, 067, 068, 071, 072 | 5 (0) | 0 | 0 | 0 | 0 | 0 | 0 |
| Sets | 073, 074, 075 | 3 (0) | 14 (set + item-in-set) | 4 | 0 | 10 | 0 | 2 |
| Other mechanical / controls | 001, 002, 024, 025, 026, 027, 028, 029, 030, 032, 033, 036, 037, 038, 043, 044, 045, 046, 047, 048, 050, 058, 059, 060 | 24 (15) | 13 | 4 | 0 | 9 | 0 | 0 |

Check: expected 93, TP 46, FN impl 1, FN NI 46, FP 6, UNL 2 all reconcile with section 2.1. The three Run 008 targets (short stems, Hebrew negation, all-of-the-above) are each exercised, but the Run 008-specific additions barely are (section 4).

## 3. Per-rule results and generalization verdicts

Allowed verdict vocabulary: `VALIDATED_PROVISIONALLY`, `KEEP_WITH_WATCH`, `WEAKENED`, `SEMANTIC_OWNERSHIP_CONFIRMED`, `UNMEASURED`. n is small throughout; labels are model-made.

### 3.1 STEM_TOO_SHORT: 4 expected, 4 TP, 0 FN, 1 FP (HO4-042), 0 unlabeled. Verdict `KEEP_WITH_WATCH`.

- TPs: HO4-003 `בירת מונגוליה`, 035 `Bank`, 039 `הרפובליקה הרומית`, 061 `כליות?`. All are non-lead-word fragments caught structurally. 4 valid short stems stayed correctly exempt: 017 `מהי שרשרת מזון?`, 034 `מהי אנרגיה קינטית?`, 065 `מהי אירוניה?`, and HO4-075/item1 `מהי בירת גרמניה?`; 004 `Define allele.` correctly exempt (flawed for other reasons).
- FP HO4-042 `הגדר/י: דמוקרטיה.`: two words; the first word is the gender-inclusive spelling `הגדר/י`. `isExemptShortStem` compares the slash-trimmed word to a closed list containing `הגדר` but not `הגדר/י`, and the prefix path does not apply; the stem ends with `.`, not `:`. Mechanism read from source, not re-run.
- What this corpus did NOT test: none of the v0.3 lost-TP lookalikes (`List of birds`, `Name tags`, `שמי הלילה`, `במה`) occur, no stem starts with `מהם`/`מהן`, no prefixed lead word (`ומהו`, `למה`). The Run 007 WATCH (lost TPs from lookalike exemptions) is therefore neither confirmed nor cleared here. Coverage is weak: 4 expected cases, and the author intended one of them (003) as a terse CLEAN stem.
- The 4-word floor itself caused no FN and no FP here.

### 3.2 STEM_NEGATIVE_WORDING: 6 expected, 5 TP, 1 FN (HO4-052), 5 FP, 0 unlabeled. Verdict `WEAKENED` for Hebrew generalization of the Run 008 narrowing; English TPs stable.

- TPs: HO4-005 `אינה`, 009 `אינם`, 006 `NOT`, 012 `not`, 051 `not`. English 3/3, no English FP, and no English negative-looking CLEAN control exists (only 4 English CLEAN cases overall).
- Precision on this rule: 5 TP versus 5 FP = 50 percent; recall 5/6.
- Hebrew stems containing a negation token: 9 (005, 007, 008, 009, 015, 052, 062, 063, 064). Of the 6 labelled CLEAN, 5 fired and only 064 stayed silent. The FPs are the shapes the Run 008 backlog entry itself listed as untouched: `שאינו` (007), bare `אינה` in a non-selecting clause (008), `ו`+`ולא` followed by a non-`ל`-initial word (015 `ולא שפת`, 063 `ולא של`), `ו`+`אינו` (062 `ואינו דג`). Run 008 subtracted only `שלא` after no cue and `ולא` + `ל`-word.
- Details in section 4 (FUB-076).

### 3.3 OPTION_ALL_OF_ABOVE and OPTION_NONE_OF_ABOVE: 4/4 and 2/2 TP, 0 FN, 0 FP. Verdict `VALIDATED_PROVISIONALLY` (narrow).

- ALL: HO4-010 `All of the above`, 011 `כל התשובות נכונות`, 014 `All of these.`, 053 `כל הנ״ל` (gershayim spelling). NONE: 012 `None of the above`, 054 `None of these.` (trailing period). No Hebrew none-of-above case exists.
- Caveat: every phrase was already in the phrase list before Run 008. The Run 008 additions (`כל האפשרויות הנ"ל`, `הנל`) are not exercised. See FUB-077.

### 3.4 OPTION_ABSOLUTE_TERM: 3 expected, 3 TP, 0 FN, 0 FP. Verdict `VALIDATED_PROVISIONALLY` (very thin; strong tier only).

- TPs: HO4-018 `תמיד` in distractor b, 020 `never` in distractor a, 055 `לעולם`/`תמיד` in distractors a/c. 3 strong-tier positives only, 2 Hebrew and 1 English.
- Silent controls that were correct: 019 (`always` in the key only), 021 (`תמיד` in the key only), 013 (weak-tier `כל`, `שום` in distractors c and d, labelled CLEAN, silent by design), 023 (`only` in the key). Symmetric-use control: none in this corpus.
- Weak tier: no weak-tier-only flaw was authored with flawed intent (HO4-013 intent CLEAN), so weak-tier recall is unmeasured, as in v0.3. HO4-018 distractor d contains `לחלוטין` ("completely"), a Hebrew counterpart of the English strong-tier `completely`/`entirely` that is not in the strong list; the case was already a TP via `תמיד`, so the gap is visible but not scored. Observation only.

### 3.5 KEY_LONGEST_OPTION: 11 expected, 11 TP, 0 FN, 0 FP, 0 unlabeled. Verdict `VALIDATED_PROVISIONALLY`.

TPs: HO4-016, 017, 018, 019, 022, 023, 052, 056, 057, 061, 069 (Hebrew 6, English 5). Boundary TPs: 017 (78 vs 63, ratio 1.24, difference exactly 15), 018 (1.45), 019 (1.52). Ratios elsewhere are 1.9 to 5.9. No near-miss FN: the closest silent keys by the 15-character gate are HO4-012 (`None of the above`, 17 versus 3, difference 14) and HO4-054 (difference 12); both are none-of-the-above options flagged by another rule and were not labelled, so they are character-gate near-misses of the FUB-067 kind but not FN. No CLEAN key crossed the gate. Caveat: labels follow the literal 1.2 / 15 gate, and 3 of the 11 sit in author-intended-CLEAN cases (017, 019, 023), so some TPs reflect threshold literalism, not a human judgement that the key length is a defect.

### 3.6 OPTION_LENGTH_IMBALANCE: 9 expected, 9 TP, 0 FN, 0 FP. Verdict `VALIDATED_PROVISIONALLY`.

TPs: HO4-016, 022, 049, 052, 056, 057, 061, 069, 070 (070 is a distractor-long case, key shortest). No CLEAN case crossed the 3.0 / 20 gate (closest: HO4-001 2.75 / 7, HO4-005 3.67 / 8 is under the 20-character floor). Same label-literalism caveat (HO4-049 intent CLEAN).

### 3.7 KEY_STEM_LEXICAL_OVERLAP (semantic-only; not emitted by design). Verdict `SEMANTIC_OWNERSHIP_CONFIRMED` (weakly).

- Zero emissions, as designed; silence on natural-overlap controls is therefore not evidence of precision.
- Fresh semantic leakage cases: HO4-016 (key restates "ultraviolet radiation", labelled `STEM_ANSWER_LEXICAL_LEAKAGE`), HO4-057 (key repeats "על ידי מים זורמים"). Both are also the longest key and a length-imbalance case, so both are caught today by KEY_LONGEST_OPTION and OPTION_LENGTH_IMBALANCE, not as leakage.
- Natural-overlap controls: HO4-034 (shared word `אנרגיה` across all options), 064 (vignette; `סוכר`/`סוכרת`), 017 (definitional overlap; flagged only by KEY_LONGEST_OPTION).
- No blatant-but-not-longest leakage case exists in v0.4 either, and no subtle case was authored. A descriptive, read-only scratch pass ("key shares a contiguous 2-token run with the stem that no distractor shares", function-word pairs ignored) matched HO4-016 and 057 and no CLEAN item (it also matched HO4-054 only through the function words `of these`). It would add no detection beyond the length rules on this corpus. This is a description of the data, not a validated rule and not a proposal; Dor's v0.3 principle that stem-key echo alone does not authorize restoring the broad rule stands.

### 3.8 Set-level and other rules

- KEY_POSITION_IMBALANCE 2/2 TP and KEY_POSITION_RUN 2/2 TP (HO4-074 all-`b`; HO4-075 six `c` in a row). HO4-073 (healthy spread b,d,a,c,b,a,d,c,d) stayed silent on both, correctly. Sets are 9 to 10 items, so statistical weight is low.
- SET_KEY_LENGTH_BIAS: 0 expected, 1 unlabeled (HO4-075). The key is strictly longest in exactly 5 of 10 items (0.5), which meets the table threshold `>=50 percent`; doc 19.7 item 6 (human-approved, not implemented) says 5 of 10 at exactly 0.5 is not enough. The labeler left it unlabelled for this contradiction.
- OPTION_OVERLAP_HIGH: 0 expected, 1 unlabeled (HO4-075/item7). Options `לכתוב / כתב / כותב / מכתב`: the heuristic prefix stripper reduces `מכתב` to `כתב`, so two distinct words (`כתב`, `מכתב`) collapse to identical token sets (Jaccard 1.0) in a valid grammar item.
- OPTION_DUPLICATE_EXACT (HO4-026) and OPTION_DUPLICATE_NORMALIZED (HO4-058, `Ohm`/`ohm`), EXPLANATION_MISSING (HO4-027, 059): 1/1, 1/1, 2/2 TP, no FP. No CLEAN case lacked an explanation.
- Duplicate-stem and template rules did not fire on any set (the three sets are distinct).

## 4. Run 008 generalization

### 4.1 FUB-077 (OPTION_ALL_OF_ABOVE phrase coverage): `VALIDATED_PROVISIONALLY`, narrow

4 TP / 0 FN / 0 FP, including two Hebrew variants (`כל התשובות נכונות`, `כל הנ״ל` with the U+05F4 spelling) and two English with different punctuation (`All of these.`). Unseen wording variants: none. The v0.4 authors did not produce `כל האפשרויות הנ"ל`, `כל האמור לעיל`, `כולם נכונים` or any other Hebrew variant not already in the list, so the Run 008 additions are not exercised and other Hebrew variants remain unmeasured. The verdict means "no counter-example on 2 Hebrew items", not "phrase coverage is complete".

### 4.2 FUB-075 (STEM_TOO_SHORT), kept as two separate questions

A. Interrogative-family completion (`מהם`, `מהן`): UNMEASURED. No v0.4 stem starts with either word (also no prefixed lead word), so the Run 008 change has no fresh evidence; no regression observed. Side effect from Run 008 (non-words such as `במהם`/`למהם` falsely exempt) is not exercised either.

B. Whole-utterance classification (does the short stem work as a clear question or instruction?): still OPEN. Evidence is again two-directional but thin:
- Fragments caught correctly (003, 035, 039, 061); valid interrogatives correctly exempt (017, 034, 065, 075/item1).
- False exemptions (lost TPs): none observed, because no lookalike (`List of birds`, `שמי`, `במה`) was authored. Prefix and lookalike behaviour is therefore untested in v0.4; the v0.3 lost TPs are neither reproduced nor refuted.
- Reverse direction: HO4-042 `הגדר/י: דמוקרטיה.` is a valid imperative that the closed lead-word list rejects because of an orthographic variant. One case; the label is itself uncertain (label-review notes "slash form is uncertain"; confidence medium, human review recommended). It shows the closed-list mechanism can err by omission on spelling variants in the same way as on `מהם`.
- Bare noun-phrase stems (003 `בירת מונגוליה`, 039): the author intended 003 as a terse CLEAN stem while the labeler called it FLAWED, so whether such stems are defects is an open human judgement that bears directly on whether these 4 TPs are true detections.

### 4.3 FUB-076 (STEM_NEGATIVE_WORDING): `REOPEN` as an active design item

- True negative-question TPs: HO4-005 `אינה` and 009 `אינם` (selection-frame negation) fired correctly; none of the Run 008 selection cues (`איזה`, `בחרו`, ...) with `שלא` occurs, so the `שלא` cue path is unexercised and the cue-list failures noted in Run 008 (`מי מהבאים שלא`, `מצאו ... שלא`) are not measured.
- FNs: HO4-052 `איננה שגויה` (token `איננה` absent from the negation list; see class table; known as the HO-063 `איננה` FN).
- FPs (5 of 5 on Hebrew CLEAN stems; every one a shape Run 008 left untouched):
  - 007 `ויטמין C, שאינו מסיס בשומן, ...` relative clause `שאינו` (descriptive).
  - 008 long vignette stem, `אינה עולה מעל` (content negation inside a physical statement; bare `אינה`).
  - 015 `... שפת סימון ולא שפת תכנות` contrast, next word `שפת` is not `ל`-initial.
  - 062 `... חי במים ואינו דג` exclusion in a relative predicate, `ואינו`.
  - 063 `... של הלב ולא של הריאות` contrast, next word `של` is not `ל`-initial.
- Relative / content / contrast behaviour: the Run 008 narrowing silenced only HO4-064 (`ולא לדלג` is matched by the `ל`-initial CONTRAST_NEXT pattern). By source reading, before Run 008 this stem would have fired, so this is a small positive datapoint for the narrowing, but it is correct for a questionable reason: `לדלג` is a verb, the known "ל-initial 4+ letters is contrast" residual. Not re-run on the pre-Run-008 commit.
- Sentence-boundary / cue-list failures: not triggered. Newly silent cases that look wrong: none observed (no `שלא` stem exists).
- Labels caveat: the labeler itself marked 015, 062, 063 "Arguable"; 008 has author-intent FLAWED versus label CLEAN; 062 sits closest to a selection frame ("which animal ... and is not a fish"). Dor's v0.3 principles (a negation token is not itself a flaw; relative/content and contrast wording are not negative-stem flaws) support 007, 008 and 015/063 as false alarms but were adjudicated on different shapes. These are MODEL_LABELED and are in the human queue.
- Verdict: Run 008's narrow subtraction did not generalize; on fresh data the rule's Hebrew precision is 2 TP of 7 Hebrew emissions on negation-bearing stems (2 TP, 5 FP). The condition "no lexical-token-only negation logic remains" is still not met and is now evidenced by 5 fresh cases.

### 4.4 FUB-074 (semantic ownership): confirmed, scope unchanged

- Weak-tier absolute terms: HO4-013 (`כל`, `שום` in distractors, label CLEAN), 018 (`כל`, `לחלוטין`), 020 (`only`) show weak-tier words are common in natural distractors and were never labelled as the sole flaw; routing them to semantic/human review remains consistent (no precision cost observed, recall unmeasured).
- Leakage: HO4-016 and 057 are caught only via length rules (section 3.7); no case argues for deterministic overlap.
- Semantic-only cases: HO4-066, 067, 068, 071, 072 have no deterministic expectation and no emission (clean lint says nothing about them). They concern answer defensibility (multiple defensible keys, subjective superlatives), which sits with the semantic critic (AE-021), not strictly with FUB-074's weak-tier and leakage scope. HO4-069 (contested key) is also detected only through length rules.
- Verdict: `SEMANTIC_OWNERSHIP_CONFIRMED`; FUB-074 stays deferred until a semantic critic or instructor review step exists.

## 5. Failure classification

Classes: LINTER_BUG, CONTRACT_TOO_NARROW, CONTRACT_TOO_BROAD, SEMANTIC_ONLY, LABEL_QUESTION, LANGUAGE_MORPHOLOGY, KNOWN_WATCH, UNSUPPORTED_RULE, OTHER_JUSTIFIED. Each meaningful row has one primary class and at most one secondary; diagnosis is from the linter source and case text. No LINTER_BUG was found: every emission and miss traces to a documented list, threshold or missing rule.

### 5.1 Implemented-rule rows

| Case | Rule | Kind | Primary [+ secondary] | Diagnosis |
|---|---|---|---|---|
| HO4-052 | STEM_NEGATIVE_WORDING | FN (heuristic gap) | LANGUAGE_MORPHOLOGY [+ KNOWN_WATCH] | `איננה` is not in `NEGATION_TERMS_HE` (`אינה` is); same gap as v0.2 HO-063. The label rests partly on semantic double negative (`איננה שגויה`), a separate unimplemented concern |
| HO4-007 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD [+ KNOWN_WATCH] | `שאינו` relative clause; Run 008 subtraction covers `לא` only (backlog lists `שאינו` as untouched) |
| HO4-008 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD [+ KNOWN_WATCH] | bare `אינה` in a content statement; residual "bare לא/אין in non-selecting clauses". Label flag: intent FLAWED (reading burden) versus label CLEAN |
| HO4-015 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD [+ KNOWN_WATCH] | `ולא` + `שפת`: CONTRAST_NEXT needs a `ל`-initial word. Label flag: labeler "Arguable" |
| HO4-062 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD [+ KNOWN_WATCH] | `ואינו`: no subtraction exists for `ו`+`אינו`. Label flag: labeler "Arguable"; closest to a selection frame |
| HO4-063 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD [+ KNOWN_WATCH] | `ולא` + `של` (not `ל`-initial 4+). Label flag: labeler "Arguable" |
| HO4-042 | STEM_TOO_SHORT | FP | CONTRACT_TOO_NARROW [+ LANGUAGE_MORPHOLOGY] | closed lead list lacks the `הגדר/י` slash spelling; stem ends `.`. Label flag: forbidden-code label assumed the exemption; reviewer called the slash form uncertain |
| HO4-075 | SET_KEY_LENGTH_BIAS | UNLABELED | CONTRACT_TOO_BROAD [+ LABEL_QUESTION] | table `>=50%` fires at 5/10; doc 19.7 item 6 says 5 of 10 is not enough; label left open by design |
| HO4-075/item7 | OPTION_OVERLAP_HIGH | UNLABELED | LANGUAGE_MORPHOLOGY [+ CONTRACT_TOO_BROAD] | prefix stripper maps `מכתב` to `כתב`; Jaccard 1.0 between two distinct words |

### 5.2 NOT_IMPLEMENTED rows (46 FN, one row per code and case)

| Code | Rows | Cases | Primary | Notes |
|---|---|---|---|---|
| OPTION_STYLE_OUTLIER | 26 | 001, 005, 012, 014, 016, 019, 022, 023, 029, 037, 049, 052, 054, 055, 056, 057, 058, 059, 060, 061, 069, 070; 074/item1, 6, 7; 075/item4 | UNSUPPORTED_RULE | 5 are real format outliers (014, 029, 054, 058, 060: terminal period or case); 11 co-occur with an emitted length rule (016, 019, 022, 023, 049, 052, 056, 057, 061, 069, 070); 10 are length-only natural-content outliers [+ LABEL_QUESTION] (001, 005, 012, 037, 055, 059, 074/item1, 6, 7, 075/item4). Doc 19.7 item 5 treats formatting outliers, not bare length, as the defect |
| STEM_NO_QUESTION_FORM | 8 | 003, 004, 031, 035, 039, 040, 041, 042 | UNSUPPORTED_RULE | 004, 031, 040, 042 are imperatives without `?` where author intent was CLEAN [+ LABEL_QUESTION]; 003, 035, 039, 041 are fragment stems |
| OPTION_NUMERIC_UNORDERED | 5 | 006, 028; 074/item9, 075/item3, 075/item9 | UNSUPPORTED_RULE | 006 (multiples of 7, intent CLEAN) and 028 (years, label confidence low-medium, doc speaks of numeric ranges) [+ LABEL_QUESTION] |
| OPTION_PUNCTUATION_INCONSISTENT | 4 | 014, 029, 054, 060 | UNSUPPORTED_RULE | clean literal cases (sole terminal period) |
| QUESTION_TYPE_MONO | 3 | 073, 074, 075 | UNSUPPORTED_RULE | informational; HO4-073 is FLAWED only through this code against CLEAN author intent [+ LABEL_QUESTION] |

### 5.3 Semantic-only rows

| Case | Primary | Diagnosis |
|---|---|---|
| HO4-066, 067, 068, 071, 072 | SEMANTIC_ONLY | multiple defensible or subjective keys; no deterministic expectation |
| HO4-016, 057 | SEMANTIC_ONLY | key restates the stem; detected only through length rules |
| HO4-069 | SEMANTIC_ONLY | contested key; detected only through length rules |

### 5.4 Counts

| Class | Primary | As secondary |
|---|---|---|
| UNSUPPORTED_RULE | 46 | 0 |
| SEMANTIC_ONLY | 8 | 0 |
| CONTRACT_TOO_BROAD | 6 (007, 008, 015, 062, 063, 075 SET_KEY_LENGTH_BIAS) | 1 (075/item7) |
| LANGUAGE_MORPHOLOGY | 2 (052, 075/item7) | 1 (042) |
| CONTRACT_TOO_NARROW | 1 (042) | 0 |
| KNOWN_WATCH | 0 | 6 (052, 007, 008, 015, 062, 063) |
| LABEL_QUESTION | 0 | 18 (17 NOT_IMPLEMENTED rows plus 075 SET_KEY_LENGTH_BIAS) |
| LINTER_BUG | 0 | 0 |
| OTHER_JUSTIFIED | 0 | 0 |

Total classified rows 63 (9 implemented-rule rows + 46 NOT_IMPLEMENTED + 8 semantic). Separately, label-regime questions are flagged in the notes of 008, 015, 042, 062 and 063 (5 more rows where the label, not the linter, is in doubt); counting every flag, 23 rows carry a label-question flag. The dominant finding is not a bug but a closed token list meeting natural Hebrew negation.

## 6. Comparison (never pooled)

Denominators differ: v0.3 has 72 cases (70 items + 2 sets, 37 expected, 38 CLEAN) versus v0.4 75 cases (93 expected, 25 CLEAN); v0.4 expected counts include 46 NOT_IMPLEMENTED detections from a literal labeler; v0.3 labels knew the Run 006 contract; the v0.3 stratum C was a purpose-built adversarial lookalike set while v0.4 contains none of those lookalikes; v0.2 labels came from a different regime and were partly human-adjudicated. Verdicts below are directional only.

| Rule / metric | FRESH_HELD_OUT_V0_3 (frozen model labels, current linter after Run 008) | HUMAN_ADJUDICATED_V0_3 (post-evaluation, not blind) | CURRENT_LINTER_ON_FROZEN_V0_2 | FRESH_HELD_OUT_V0_4 (TP / FN / FP / UNL) | Verdict |
|---|---|---|---|---|---|
| Whole corpus | 29 / 8 / 0 / 1; CLEAN warned 0 of 38 (FP 1 to 0 per Run 008) | 30 / 8 / 0 | 79 / 45 / 2 / 5 (after Run 008); CLEAN warned 1 of 20 | 46 / 47 / 6 / 2; CLEAN warned 5 of 25 | Precision: regressed. Recall: unknown (different expected sets) |
| STEM_NEGATIVE_WORDING | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 6 / 1 / 0 / 0 | 5 / 1 / 5 / 0 | Precision regressed vs all three; recall stable |
| STEM_TOO_SHORT | 5 / 4 / 0 / 0 | 5 / 4 / 0 / 0 | 2 / 0 / 0 / 0 | 4 / 0 / 1 / 0 | Recall: unknown (lookalike stress absent); precision: slight regression (1 new-mechanism FP) |
| OPTION_ALL_OF_ABOVE | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 1 / 0 / 0 / 0 | 4 / 0 / 0 / 0 | Stable |
| OPTION_ABSOLUTE_TERM | 10 / 0 / 0 / 0 | (no change recorded in Run 008 table) | 5 / 4 / 0 / 0 | 3 / 0 / 0 / 0 | Stable (strong tier); weak tier unknown |
| KEY_LONGEST_OPTION | 5 / 0 / 0 / 1 | not tabulated | not tabulated here | 11 / 0 / 0 / 0 | Stable |
| KEY_STEM_LEXICAL_OVERLAP | not emitted | n/a | 0 / 1 / 0 / 0 | not emitted | Stable by design |

What Run 008 changed on fresh data: Run 008 changed known-case behaviour only (HO3-071, HO3-005, HO3-058, HO-073/item8; 0 lost TPs, 0 new FPs on frozen sets). On v0.4 there is no evidence that it changed recall or improved precision beyond those shapes: FUB-077 and FUB-075A were not exercised, and FUB-076's narrowing silenced exactly one stem (HO4-064) while 5 sibling shapes fired. The v0.3-era finding that "CLEAN warned" fell to near zero reflected tuning against observed cases and does not carry over: 20 percent of v0.4 CLEAN cases warned, all on one rule, in Hebrew. Because v0.4 CLEAN is thin (25, only 4 English) and model-labeled, the 20 percent should be read as a lower-confidence estimate of an order of magnitude, not a rate.

## 7. HUMAN REVIEW QUEUE (status MODEL_PROPOSED; NOT HUMAN_APPROVED)

Each row is a question for a human; nothing here changes a label, the linter or a test until decided. Recommended answers are deliberately omitted where a recommendation would pre-empt the principle being asked.

| # | caseId | Why it matters | Exact human question |
|---|---|---|---|
| 1 | HO4-062 | Closest FP to a true selection-frame negation; decides whether FUB-076's condition is "question frame" or "token class" | Is `ואינו דג` ("lives in water and is not a fish") a negative-stem flaw, or acceptable exclusion/contrast content? |
| 2 | HO4-015, HO4-063 | Same principle as v0.3 HO3-058 but with non-`ל` next words; 2 FPs | Is `ולא שפת תכנות` / `ולא של הריאות` contrast wording that must not warn, as Dor ruled for `ולא` in HO3-058? |
| 3 | HO4-007 | Relative `שאינו` in an apposition; Run 008 left `שאינו` untouched | Is `שאינו מסיס בשומן` descriptive content (not a negative stem), as Dor ruled for `שלא` in HO3-005? |
| 4 | HO4-008 | Content negation in a 30-word stem; author intent FLAWED (reading burden), label CLEAN | Does `אינה עולה מעל איזו טמפרטורה` count as negative wording, or is any flaw here only stem length? |
| 5 | HO4-052 | Sole heuristic FN; combines a missing spelling (`איננה`) with a double negative | Is `איננה שגויה` a flaw (double negative), and should it be detected by a negation-word check at all? |
| 6 | HO4-042 | Only STEM_TOO_SHORT FP; orthographic variant of a listed word | Does `הגדר/י: דמוקרטיה.` function as a clear instruction, and is a trailing `.` acceptable? |
| 7 | HO4-003, HO4-041 | Whether bare noun-phrase stems are flaws decides whether 4 STEM_TOO_SHORT TPs and 2 STEM_NO_QUESTION_FORM expectations are true detections (author intent CLEAN, labeler FLAWED) | Are `בירת מונגוליה` and `יחידת המידה של מתח חשמלי` acceptable terse stems or flawed fragments? |
| 8 | HO4-004, HO4-040 | Decides whether 4 of the 8 STEM_NO_QUESTION_FORM expectations (004, 031, 040, 042) stand; doc 19.7 item 4 exempts only `:` | Is an imperative stem without `?` (`Define allele.`, `Name the longest bone ...`) a flaw? |
| 9 | HO4-013 | The weak-tier `כל`, `שום` in two distractors (label CLEAN); FUB-074 fixture polarity | Do the weak-tier absolutes in distractors c and d act as a test-wiseness cue, or are they ordinary content here? |
| 10 | HO4-018 | `לחלוטין` is a strong-tier synonym missing from the strong list; also `כל` | Should Hebrew `לחלוטין` count with `completely`/`entirely` as a strong absolute adverb, or stay content-dependent? |
| 11 | HO4-016, HO4-057 | Only two leakage cases; decide whether leakage is a defect independent of length | Is the key's restatement of the stem phrase a real cue here, separate from the key being the longest option? |
| 12 | HO4-075 | SET_KEY_LENGTH_BIAS fires at 5 of 10; contradiction between the table and doc 19.7 item 6 | Is 5 of 10 longest keys (a run of five consecutive items) a bias worth a warning? |
| 13 | HO4-073 | Healthy set labelled FLAWED only through informational QUESTION_TYPE_MONO | Should a single-type set of 9 count as an expected flaw, or should QUESTION_TYPE_MONO not be a scored expectation? |
| 14 | HO4-075/item7 | Unlabeled OPTION_OVERLAP_HIGH on `כתב`/`מכתב` | Are `כתב` and `מכתב` acceptable distinct options (so the overlap warning is a false alarm)? |

14 rows; single-reviewer decisions would again be post-evaluation and not blind.

## 8. Integration readiness: NOT_READY

Evaluated against the canonical READY exit criteria (`docs/ASSESSMENT_CALIBRATION_V0_1.md` section 4, as carried through the v0.3 report section 9); no criterion moved to MET and a new precision problem appeared.

- Precision on fresh Hebrew data: 5 of 25 CLEAN cases warned (20 percent) and the headline rule's Hebrew precision on negation-bearing stems is 2 of 7. This is the largest new blocker.
- Validation quality: model-authored corpus, model-labeled, one model family, 3 contamination rounds and 48 replacements, accepted generic residual; no human adjudication of v0.4 (14-row queue pending).
- Unsupported rules: 46 of 93 expected detections are for rules the linter does not have (STYLE_OUTLIER, NO_QUESTION_FORM, NUMERIC_UNORDERED, PUNCTUATION_INCONSISTENT, QUESTION_TYPE_MONO); a clean lint says little about them.
- Semantic gap: 9 cases carry a semantic expectation, 5 are semantic-only with no signal; weak-tier absolute and leakage still have no home (FUB-074); no semantic critic exists.
- Evaluation breadth: thin rule coverage (STEM_TOO_SHORT 4, ABSOLUTE_TERM 3 expected), 4 English CLEAN cases, no weak-tier flaw, no lookalike short stems, Run 008 additions (`מהם`, new all-of-above phrases, `שלא` cue path) not exercised.
- Content realism: synthetic general-knowledge items; no Ruppin or real instructor content, no student data, no real Hebrew authoring distribution.
- Open design gates unchanged: advisory-only surface, import-validator naming (DUPLICATE_PROMPT), position-rule significance (SET_KEY_LENGTH_BIAS contradiction re-surfaced), threshold stability, fixture-fit caveat (earlier fixes were tuned on observed cases).

Readiness is not raised by decent synthetic recall: NOT_READY (recommendation only; nothing is wired; AE-031 stays gated).

## 9. FUB routing recommendations (proposed only; the parent edits backlog docs)

| FUB | Recommendation | Basis |
|---|---|---|
| FUB-074 | KEEP (`DEFERRED`, scope unchanged) | Semantic ownership confirmed; add HO4-016, 057, 013, 018 as semantic-review fixtures and note HO4-066, 067, 068, 071, 072 as answer-defensibility fixtures for the semantic critic (AE-021). No new FUB: that is existing critic scope |
| FUB-075 | KEEP as `PARTIALLY_RESOLVED_IMPLEMENTATION` | Part A (`מהם`, `מהן`) unmeasured, no regression; part B open; HO4-042 adds a reverse-direction datapoint (closed list misses `הגדר/י`); lost-TP lookalikes untested. Both parts still need a human design decision and a batch containing lookalike stems |
| FUB-076 | REOPEN as the active implementation-design item (status text stays partial; the "not closed" condition is now confirmed) | 5 fresh Hebrew FPs on shapes Run 008 explicitly left untouched (`שאינו`, `ואינו`, `ולא` + non-`ל` word, bare `אינה`); the narrow phrase-shaped subtraction did not generalize; needs a human principle on question-frame negation before any list tweak |
| FUB-077 | KEEP `RESOLVED_IMPLEMENTED`, annotate `VALIDATED_PROVISIONALLY` (narrow) | 4/4 TP, 0 FP, but the Run 008 phrases were not exercised and Hebrew variants beyond the list are unmeasured |

Not proposing a new FUB: the `איננה` gap, the slash spelling `הגדר/י`, `לחלוטין` and the `כתב`/`מכתב` prefix collision are instances of existing token/list-completeness themes (FUB-075, FUB-076, FUB-066 strong tier) and the unimplemented-codes backlog (AE-029 / FUB-064) covers the 46 NOT_IMPLEMENTED detections.

**Recommended next Run (exactly one):** a human-adjudication Run for the 14-row queue in section 7, producing `HUMAN_ADJUDICATED_V0_4` as a post-evaluation overlay with the frozen v0.4 files untouched, before any linter change. Rationale: the dominant open issue (FUB-076 and the FUB-075B bare-noun/imperative judgements) is a question of human principle, not of list completeness; v0.3 showed that adding phrases without a principle produced a rule that failed on its first fresh batch.

## 10. Safety and verification

Verification and safety table is recorded in the Run report.

# Assessment Linter Held-Out Evaluation - Golden Dataset v0.3

Status: DRAFT evidence artifact. Created in Run `2026-10-09-ASSESSMENT-ENGINE-007`, Slice E2 (fresh held-out validation of the Run 006 / FUB-066 hardening).
Subject: the UNWIRED deterministic question linter `src/domain/assessment/question-lint.ts` (plus `text-normalize.ts`), FROZEN (unchanged) throughout Run 007.
Evidence identity: `FRESH_HELD_OUT_V0_3`. Corpus `MODEL_AUTHORED_HELD_OUT`; labels `MODEL_LABELED_NOT_HUMAN_APPROVED`. `HUMAN_ADJUDICATED_V0_3`: none at Run 007 close; now exists as a separate post-evaluation overlay, see section 11.

> Pointer (Run `2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001`): Dor adjudicated all 13 queued rows post-evaluation (not blind). Sections 1-10 below are the unchanged Run 007 record; the human results, rule reassessment and routing are in section 11 and are never pooled with the numbers here.

Evidence terms used here (never pooled): `FRESH_HELD_OUT_V0_3` (this report); `FIRST_BLIND` (historical, Run 004 only, v0.2); `CURRENT_LINTER_ON_FROZEN_V0_2` (regression evidence); `POST_HUMAN` (v0.2, 9 rows adjudicated by Dor); `CONTRACT_TEST` (Run 006 pre-registered tests); `HUMAN_ADJUDICATED_V0_3` (does not exist yet).

## 1. Identity and provenance

| Item | Value |
|---|---|
| RUN_ID | `2026-10-09-ASSESSMENT-ENGINE-007` |
| START_HEAD | `928f314` |
| V03_FREEZE_HEAD | `2e84392` (corpus + labels + manifest frozen, linter not run on the corpus) |
| Evaluation harness commit | `55b9fb5` (`heldout-v0-3-eval.test.ts`, 27-line addition to `heldout-eval.ts`; linter, text-normalize and frozen data unchanged) |
| Corpus | 72 cases = 70 ITEM + 2 SET; 45 Hebrew / 27 English; 58 single-choice + 12 multiple-choice items |
| Labels | 38 CLEAN / 34 FLAWED; 30 deterministic-labelled cases; 4 semantic-only (HO3-025, 028, 033, 058); 18 cases carry a `semanticExpectation`; 6 `languageReviewRequired` |
| Strata (by design) | A absolute terms 18 / B lexical overlap 16 / C short stems 18 / D mixed controls 12 / E mechanical + sets 8 |
| Expected deterministic detections | 37 |

SHA-256 (`golden/heldout-v0-3/freeze-hashes.json`): corpus `277887131f78bb3c15223f2bef2a1296fb916e56cff674b782d67afb8ae1fe25`; labels `2d197cb62ae946fae7d726b4ac70b8d36fefda182d74f51c18780bb27fb98c10`; author-intent `61d61547a08e870cced3da6b58a7d1a37845ab494d93dace2044ea6e6e3fadd3`; label-review `a6849663a6c17cfe131b3186ca280fdaf14977bb52ed772ddd7e176e0c17c88b`.

Non-claims: NOT human ground truth; NO psychometric or real-course validity (synthetic general-knowledge content, no Ruppin data, no student data); one model family; 72 cases cannot support statistics. A ratio such as `10/10` means "no counter-example in this corpus", not "reliable".

## 2. Methodology and the blindness actually achieved

Pipeline: AUTHOR -> LABEL -> LABEL REVIEW -> FRESHNESS REMEDIATION -> FREEZE -> EVALUATE -> REPORT. All separation was by instruction to fresh workers; none of it is tool-enforced, and it cannot be verified from the repository alone.

1. AUTHOR. A fresh worker was told not to read the repository and wrote the corpus plus a candid per-case intent file. It saw the Run's stratum description, including the example lookalike words given in the task (for example מהירות האור, שמי, במה, "List of birds"). Consequently some lookalike stress cases (HO3-038 "List of birds", HO3-040 "שמי הלילה", HO3-042 "במה") were written knowing which exemption weaknesses were being probed. That is deliberate stress design, but it means stratum C is a purpose-built adversarial set, not a natural sample.
2. LABEL. A fresh worker saw the corpus, the catalog doc sections 4, 9, 10.1, 10.3, 11.1 and the conceptual Run 006 decisions (strong adverbs only, lexical overlap is semantic, narrowed short-stem exemption). It did not see author intent or the linter. Labels for the three target rules therefore encode the Run 006 contract; recall on contract-shaped cases is partly true by construction.
3. LABEL REVIEW. A worker who saw corpus, labels and author-intent made 94 logged pre-freeze edits (`label-review.json`), including 7 FLAWED->CLEAN flips and 40 corpus.json and 54 labels.json change entries. Some cases were turned into clean controls by this reviewer. Corpus and labels are therefore not the raw output of independent author and labeler.
4. FRESHNESS REMEDIATION. A mechanical text-similarity check against v0.1/v0.2 found 11 same-concept overlaps and 1 intra-corpus duplicate (HO3-051, fixed by the parent). The 11 overlapping cases were replaced pre-freeze by a fresh worker not shown the old text. Accepted residual flags: HO3-006 (template overlap) and HO3-068 (median). The AUTHOR independently reproduced staple-topic items (primes, mitosis, photosynthesis style), which shows a model-prior overlap risk: freshness here is lexical/topic-level, not proof of independence from v0.1/v0.2 or from the linter author's habits.
5. FREEZE. Committed at `2e84392` before any linter run on the corpus. The author, label and label-review workers never ran the linter; the parent did not run it before the freeze commit.
6. EVALUATE. Frozen linter, harness `55b9fb5`, first-observed numbers recorded as a regression guard, not targets.

Limitations: same model family for every worker (author, labeler, reviewer, remediation, linter); the reviewer edited corpus and labels pre-freeze; labels were never human-approved; the labeler's knowledge of Run 006 means contract-shaped recall is not a fully independent test.

## 3. Metrics (FRESH_HELD_OUT_V0_3; source `scratch/v03/eval-report.json`)

Headline: expected 37, **TP 28 / FN 9 (5 HEURISTIC_GAP, 4 NOT_IMPLEMENTED) / FP 1 / UNLABELED_EMISSION 3**. CLEAN cases with a WARNING/ERROR: **1 of 38 (2.6 percent)**. PRECISION-LIKE 28/29; RECALL-LIKE 28/37. Set level: SET-scope 2 expected / 2 TP / 0 FN / 0 FP; item codes inside SET cases 1 expected / 0 TP / 1 FN (HO3-070 item 3, NOT_IMPLEMENTED).

| Check code | Impl. | Exp. | TP | FN | FP | UNLAB |
|---|---|---|---|---|---|---|
| EXPLANATION_MISSING | yes | 1 | 1 | 0 | 0 | 0 |
| KEY_LONGEST_OPTION | yes | 5 | 5 | 0 | 0 | 1 (HO3-048) |
| KEY_POSITION_IMBALANCE | yes | 1 | 1 | 0 | 0 | 0 |
| KEY_POSITION_RUN | yes | 1 | 1 | 0 | 0 | 0 |
| **OPTION_ABSOLUTE_TERM** | yes | 10 | 10 | 0 | 0 | 0 |
| OPTION_ALL_OF_ABOVE | yes | 1 | 0 | 1 | 0 | 0 |
| OPTION_DUPLICATE_EXACT | yes | 1 | 1 | 0 | 0 | 0 |
| OPTION_LENGTH_IMBALANCE | yes | 3 | 3 | 0 | 0 | 0 |
| OPTION_NUMERIC_UNORDERED | NO | 1 | 0 | 1 | 0 | 0 |
| OPTION_PUNCTUATION_INCONSISTENT | NO | 1 | 0 | 1 | 0 | 0 |
| OPTION_STYLE_OUTLIER | NO | 2 | 0 | 2 | 0 | 0 |
| STEM_NEGATIVE_WORDING | yes | 1 | 1 | 0 | 1 (HO3-005) | 1 (HO3-058) |
| **STEM_TOO_SHORT** | yes | 9 | 5 | 4 | 0 | 1 (HO3-071) |
| KEY_STEM_LEXICAL_OVERLAP | not emitted by design (FUB-066) | 0 | 0 | 0 | 0 | 0 |

| Slice | Cases | Clean warned | TP / FN / FP / UNLAB |
|---|---|---|---|
| Hebrew | 45 (25 CLEAN) | 1 of 25 | 17 / 4 / 1 / 3 |
| English | 27 (13 CLEAN) | 0 of 13 | 11 / 5 / 0 / 0 |
| Stratum A | 18 | 1 of 10 | 8 / 0 / 1 / 0 |
| Stratum B | 16 | 0 of 9 | 6 / 2 / 0 / 0 |
| Stratum C | 18 | 0 of 9 | 5 / 4 / 0 / 1 |
| Stratum D | 12 | 0 of 9 | 2 / 0 / 0 / 1 |
| Stratum E | 8 (6 ITEM + 2 SET) | 0 of 1 | 7 / 3 / 0 / 1 |
| ITEM cases | 70 | 1 of 38 CLEAN | see headline |
| SET cases | 2 | n/a | SET-scope 2/0/0; item-in-set 0/1/0 |

Hebrew FN: 4 (HO3-040, 042, 065, 071); English FN: 5 (HO3-032 x2, 038, 044, 070/item3). All 4 NOT_IMPLEMENTED FN are rules the linter does not have, not heuristic failures.

## 4. Per-rule analysis (Validation Questions)

Source for every mechanism statement: read-only inspection of `question-lint.ts` (`ABSOLUTE_TERMS`, `isExemptShortStem`, `STEM_LEAD_WORDS`, `HE_LEAD_WORDS`, `ALL_OF_ABOVE_PHRASES`). Nothing was changed.

### 4A. OPTION_ABSOLUTE_TERM (10 expected: 10 TP, 0 FN, 0 FP, 0 unlabeled)

TPs (strong adverb only in non-correct option, none in key, not symmetric): A: HO3-002, 004, 006, 008, 011, 013, 015, 016; D: HO3-054, 063.

- Useful TPs preserved? Yes, 10/10, Hebrew 5/5 and English 5/5, including multi-hit options (HO3-008 b,d; HO3-006 a,c) and a strong adverb mixed with weak words (HO3-015 flags `completely`, not the weak `every`; HO3-063 flags `תמיד`).
- Clean substantive quantifiers avoided? Yes. Forbidden-code controls all silent: HO3-001 (`כולם`), 010 (`כל` in all options), 018 and 061 (`every`/`All`), 057 (`כל` in stem and options), 009 (`בשום פנים` in the key), 053 (`שום`).
- Symmetric avoided? Yes: HO3-012 ("Always ..." in every option) silent.
- Correct-answer content avoided? Yes: HO3-003 (`never` in the key, physics content) silent; HO3-017 (`בהכרח` in the stem only) silent.
- New misses that should stay deterministic? None. The only labelled-absolute-style items the linter did not flag are weak-tier by Run 006 design: HO3-033 `בלבד` in distractor d (labelled semantic/human judgement, not deterministic expectation) and HO3-015/063 weak words co-occurring with strong ones (no loss). Since the labeler knew the Run 006 contract, no case in this corpus tests "a weak-tier word that a human would call a clear cue and the linter must catch"; that remains unmeasured.
- Boundary cases: HO3-004 (`בהכרח` sits inside the misconception claim; TP, label notes arguable); HO3-009 (`בשום פנים` in the key, weak tier; silent, correct); HO3-033 (`בלבד`; silent by design); HO3-015 (strong + weak in same item; TP on the strong one only); HO3-053 (`שום` in key; silent).

### 4B. KEY_STEM_LEXICAL_OVERLAP (SEMANTIC_ONLY since Run 006; code not emitted)

- Was SEMANTIC_ONLY right? Consistent with the evidence. No natural-overlap case fired, and 0 FP with 0 emissions confirms the removal costs no precision. All genuine leakage cases are judged semantic, not structural.
- Natural-overlap controls that stayed clean: HO3-014 (`במישור`), 024 (Japan/Tokyo), 026 (`הלחץ`), 053, 055, 056, 057, 060, 062, 034.
- Genuine leakage cases and their `semanticExpectation`:
  - Blatant (key restates a stem phrase and is also the longest option): HO3-021 ("restates 'תופעת הגאות והשפל'"), HO3-023 ("restates 'network security'"), HO3-030 ("restates 'עלייה בתוחלת החיים'"), HO3-032 (full-sentence key repeating the stem). All four are detected today, but only by KEY_LONGEST_OPTION (and LENGTH_IMBALANCE for 030/032), not as leakage.
  - Subtle: HO3-025 (key restates the definition already in the stem; length ratio only 1.23, no structural flag at all), HO3-028 (`Merge sort` echoes `merges`; borderline, standard term), HO3-033 (circular distractor, `בלבד`), HO3-058 (stem names the excluded category).
- Newly observed narrow structural subset (describe only, NOT implemented, NOT validated): "a contiguous run of at least 2 content tokens shared between stem and a correct option that no distractor shares". A post-hoc, read-only descriptive pass (scratch only) found such a key-only run in HO3-021, 023, 030, 032 and in no CLEAN item, and missed HO3-025 and 028. It would add no detection on this corpus beyond what KEY_LONGEST_OPTION already catches, and 2-token runs are fragile in Hebrew (prefixes) and English (`a hash` in HO3-015, a FLAWED-for-other-reasons item). No blatant leakage case that is NOT also longest-key exists in this corpus, so the need for such a subset is neither shown nor excluded.

### 4C. STEM_TOO_SHORT (9 expected: 5 TP, 4 FN; 0 FP; 1 unlabeled)

- FPs on valid short questions / did narrowing work? Yes for the labelled controls: 0 FP over 11 valid short stems (HO3-035 `מהי`, 037 `ומהו`, 039 `Define`, 041 colon, 043 `למה`, 045 colon, 047 `כמה`, 049 `Who`, 051 `מהי`, 054 `Define`, 064 colon). v0.2 pre-Run-006 had 1 FP for this rule.
- But one valid 3-word question fired: HO3-071 `מהם גזי חממה?` (unlabeled emission). The cause is a gap in the closed lead-word list (`מהם` is absent; the prefix path only accepts ש/ה/ב/ל/ו before a listed lead word). So the narrowing is incomplete for Hebrew plural/inflected interrogatives.
- Real FNs from the known WATCH (first-word/prefix exemption), exact mechanism per case:
  - HO3-038 `List of birds`: first word `list` is in `STEM_LEAD_WORDS` -> exempt.
  - HO3-044 `Name tags`: first word `name` is in `STEM_LEAD_WORDS` -> exempt.
  - HO3-040 `שמי הלילה`: first word `שמי` = prefix `ש` + `מי`, with `מי` in `HE_LEAD_WORDS` -> exempt via the single-prefix path.
  - HO3-042 `במה`: prefix `ב` + `מה` -> exempt via the same path (also a legitimate Hebrew interrogative, so the label is itself contested, confidence low).
  - Contrast: lookalikes that were NOT exempt and were caught: HO3-036 `מהפכה תעשייתית`, 046 `Whale watching`, 048 `מימי הביניים` (`מימי` is not prefix+lead), 050 `Who's who`, 052 `כמהין`. So the WATCH cost is specific to two exemption paths (English lead-word nouns, Hebrew ש/ה/ב/ל/ו + lead-word homographs).
- Is the 4-word threshold defensible? Yes as a structural floor on this evidence. Every invalid short case has 1-3 words; every valid short control is rescued by an exemption; HO3-065 and 069 (4 words) are silent and valid. The threshold itself caused no FN; both problems (4 FN, 1 unlabeled) come from the exemption lists. The floor does misfire on valid 3-word questions outside the list (HO3-071), so it is defensible only together with a complete lead-word set.
- HO3-071 unlabeled STEM_TOO_SHORT: classified LANGUAGE/MORPHOLOGY (missing `מהם`); not counted as FP because the case is FLAWED for a different reason, but on a CLEAN version it would be a genuine false alarm.

## 5. Failure classification

Classes: LINTER_BUG | CONTRACT_TOO_NARROW | CONTRACT_TOO_BROAD | SEMANTIC_ONLY | LABEL_QUESTION | LANGUAGE/MORPHOLOGY | KNOWN_WATCH | UNSUPPORTED_RULE | NEEDS_HUMAN_REVIEW | MORE_DATA_NEEDED. Machine form: `scratch/v03/classification.json` (gitignored).

| Case | Code | Kind | Class | Reason |
|---|---|---|---|---|
| HO3-032 | OPTION_PUNCTUATION_INCONSISTENT | FN | UNSUPPORTED_RULE | No check exists |
| HO3-032 | OPTION_STYLE_OUTLIER | FN | UNSUPPORTED_RULE | No check exists |
| HO3-065 | OPTION_STYLE_OUTLIER | FN | UNSUPPORTED_RULE | No check exists |
| HO3-070/item3 | OPTION_NUMERIC_UNORDERED | FN | UNSUPPORTED_RULE | No check exists |
| HO3-038 | STEM_TOO_SHORT | FN | KNOWN_WATCH | `list` in STEM_LEAD_WORDS |
| HO3-040 | STEM_TOO_SHORT | FN | KNOWN_WATCH | `שמי` = ש + `מי` prefix path |
| HO3-042 | STEM_TOO_SHORT | FN | LABEL_QUESTION | `במה` = ב + `מה`; legitimate interrogative, low-confidence label |
| HO3-044 | STEM_TOO_SHORT | FN | KNOWN_WATCH | `name` in STEM_LEAD_WORDS |
| HO3-071 | OPTION_ALL_OF_ABOVE | FN | CONTRACT_TOO_NARROW | `כל האפשרויות הנ"ל` absent from phrase list (list has `כל הנ"ל`, `כל התשובות`) |
| HO3-005 | STEM_NEGATIVE_WORDING | FP | CONTRACT_TOO_BROAD | `שלא` relative-clause negation counted; not a negative-stem question |
| HO3-048 | KEY_LONGEST_OPTION | UNLABELED | LABEL_QUESTION | Key 25 vs 10 chars is a real signal; label left it open |
| HO3-058 | STEM_NEGATIVE_WORDING | UNLABELED | LABEL_QUESTION | `ולא` contrast negation; label called it borderline |
| HO3-071 | STEM_TOO_SHORT | UNLABELED | LANGUAGE/MORPHOLOGY | Valid `מהם ...?` missing from lead-word list |
| HO3-025 | (leakage) | SEMANTIC | SEMANTIC_ONLY | Subtle definition restatement |
| HO3-028 | (leakage) | SEMANTIC | SEMANTIC_ONLY | Name echoes stem verb; borderline |
| HO3-033 | (weak distractors, `בלבד`) | SEMANTIC | SEMANTIC_ONLY | Routed to human review in Run 006 |
| HO3-058 | (cue) | SEMANTIC | SEMANTIC_ONLY | Stem names excluded category |
| HO3-021, 023, 030, 032 | (leakage component) | SEMANTIC | SEMANTIC_ONLY | Blatant echo; detected only through KEY_LONGEST_OPTION / LENGTH_IMBALANCE |

Notable correct behaviour (not failures): HO3-048 STEM_TOO_SHORT (lookalike `מימי הביניים`) is a TP; HO3-036, 046, 050, 052 TPs; HO3-067 SET-scope codes both TP; HO3-054 `Define a vacuum.` correctly exempt while OPTION_ABSOLUTE_TERM fires.

Class counts for the 13 mandatory rows (9 FN + 1 FP + 3 UNLABELED): UNSUPPORTED_RULE 4, KNOWN_WATCH 3, LABEL_QUESTION 3, CONTRACT_TOO_NARROW 1, CONTRACT_TOO_BROAD 1, LANGUAGE/MORPHOLOGY 1, LINTER_BUG 0. Adding the 8 semantic rows: SEMANTIC_ONLY 8 (21 rows total). No LINTER_BUG was found: every emission and miss traces to a documented contract, list or missing rule.

## 6. HUMAN REVIEW QUEUE (for Dor; status MODEL_PROPOSED, NOT HUMAN_APPROVED at Run 007 close; decided later, see section 11)

Recommended decisions are model suggestions only. Nothing here changes labels, linter or tests until a human decides.

| # | caseId | Stem | Options (key) | Model label | Linter output | Why it matters | Question for Dor | Recommended decision |
|---|---|---|---|---|---|---|---|---|
| 1 | HO3-005 | מה יקרה לגוף במנוחה שלא פועל עליו שום כוח? | a ימשיך להאיץ / b יאבד מסה / c יתחיל לנוע במהירות קבועה / d יישאר במנוחה (**d**) | CLEAN, no expected/forbidden | STEM_NEGATIVE_WORDING (FP) | The only FP; a relative-clause `שלא` fires the negative-stem warning | Is `שלא` in a relative clause a negative-stem flaw, or fine? | Not a flaw; if so the rule is CONTRACT_TOO_BROAD (future narrowing decision) |
| 2 | HO3-058 | אילו מהבאים נחשבים לכלי נגינה, ולא לכלי כתיבה? | a חליל / b עט / c כינור / d עיפרון (**a,c**) | FLAWED, semantic only (low confidence) | STEM_NEGATIVE_WORDING (unlabeled) | Same rule as #1 on a contrast phrase; also a semantic cue | Is `ולא` contrast negative wording, and is the item flawed as a cue? | Negation warning acceptable here; keep semantic note |
| 3 | HO3-048 | מימי הביניים | a תקופה בהיסטוריה של אירופה / b סוג של נהר / c מדד כלכלי / d כוכב לכת (**a**) | FLAWED: STEM_TOO_SHORT | STEM_TOO_SHORT (TP) + KEY_LONGEST_OPTION (unlabeled, ratio 2.5) | Decides whether the longest-key emission is a true flag | Should this key (25 vs 10 chars) count as a length cue? | Yes: add KEY_LONGEST_OPTION to expected |
| 4 | HO3-071 | מהם גזי חממה? | a פחמן דו-חמצני / b מתאן / c אדי מים / d כל האפשרויות הנ"ל (**d**) | FLAWED: OPTION_ALL_OF_ABOVE | STEM_TOO_SHORT (unlabeled); ALL_OF_ABOVE missed | One FN plus one false alarm on a valid question | Is `מהם גזי חממה?` an acceptable short stem, and is `כל האפשרויות הנ"ל` an all-of-the-above option? | Both: stem acceptable, option is all-of-above |
| 5 | HO3-042 | במה | a במה בתיאטרון / b במה היא / c ברמה / d מה (**a**) | FLAWED: STEM_TOO_SHORT (low confidence) | none (exempt via ב+`מה`) | A FN whose label is itself doubtful; Hebrew morphology | Is `במה` a bare noun fragment or a valid interrogative? Is the item well-formed at all? | Label questionable; treat as ambiguous item, drop the STEM_TOO_SHORT expectation |
| 6 | HO3-040 | שמי הלילה | a כוכבים / b שלג / c גלים / d שמש (**a**) | FLAWED: STEM_TOO_SHORT | none (exempt via ש+`מי`) | Could reverse the Run 006 accept-the-WATCH decision for Hebrew prefix path | Is this lost TP worth tightening the Hebrew prefix exemption? | Yes, but only with a stoplist decision from human-valid short-question data |
| 7 | HO3-038 | List of birds | a Eagle, sparrow, owl / b Oak, pine, maple / c Lion, tiger, bear / d Iron, copper, zinc (**a**) | FLAWED: STEM_TOO_SHORT | none (exempt via `list`) | Lost TP from the English imperative lead word | Should noun uses of `list`/`name` be exempt? | Treat as lost TP; consider dropping `list`/`name` from the lead-word set after review |
| 8 | HO3-044 | Name tags | a Labels worn to show a name / b A list of names / c A tag for names only / d A type of file (**a**) | FLAWED: STEM_TOO_SHORT | none (exempt via `name`) | Same as #7 | Same | Same as #7 |
| 9 | HO3-025 | מהי שיטת בחירות יחסית, שבה מנדטים מחולקים לפי חלקן של המפלגות בקולות? | a ... המועמד עם מרב הקולות ... / b הנשיא נבחר ישירות / c מספר המנדטים של כל מפלגה משקף את חלקה בקולות / d הפרלמנט ממנה את ראש הממשלה (**c**) | FLAWED, semantic only | none | Subtle leakage not catchable structurally | Is a key that restates an in-stem definition a real defect? | Yes (circular), keep SEMANTIC_ONLY |
| 10 | HO3-028 | Which sorting algorithm repeatedly splits the list into halves, sorts each half, and merges the results? | a Bubble sort / b Selection sort / c Merge sort / d Insertion sort (**c**) | FLAWED, semantic only (human review recommended) | none | Borderline name leak vs standard term | Is `Merge sort` echoing `merges` a defect or just the correct term? | Not a defect; probably CLEAN |
| 11 | HO3-021 | מהי הסיבה לתופעת הגאות והשפל בים? | a רוחות חזקות באוקיינוס / b זרמי אוויר חמים מעל המים / c תופעת הגאות והשפל נגרמת מכוח המשיכה של הירח / d הטיית הציר של כדור הארץ (**c**) | FLAWED: KEY_LONGEST_OPTION (+ leakage) | KEY_LONGEST_OPTION (TP) | Representative blatant echo; basis for any future narrow structural subset | Is the stem-phrase echo a defect independent of length? | Yes; keep as evidence, no structural rule yet |
| 12 | HO3-004 | מהי הסיבה העיקרית לעונות השנה בכדור הארץ? | a המרחק מהשמש משתנה בהכרח בין חורף לקיץ / b הטיית ציר ... / c הירח מסתיר ... / d שינויים בעוצמת הכבידה (**b**) | FLAWED: OPTION_ABSOLUTE_TERM | OPTION_ABSOLUTE_TERM (TP) | `בהכרח` may be part of the misconception claim; tests the strong-adverb contract edge | Is `בהכרח` here a cue or content? | Cue (acceptable TP) |
| 13 | HO3-033 | אילו מהגורמים הבאים תורמים להתחממות גלובלית? | a פליטת גזי חממה לאטמוספרה / b התחממות גלובלית שנגרמת מקרינת הירח / c כריתת יערות נרחבת / d עלייה בפעילות הגעשית בלבד (**a,c**) | FLAWED, semantic only | none | Weak-tier `בלבד` as a cue is the Run 006 / FUB-074 boundary; a human `yes` would argue for revisiting weak-tier ownership | Is `בלבד` in a distractor a test-wiseness cue here? | Yes as supporting a semantic review step (FUB-074), not a deterministic rule |

## 7. Comparison to prior evidence (never pooled)

| Evidence | Corpus | Linter | Overall TP / FN / FP / UNLAB | OPTION_ABSOLUTE_TERM | KEY_STEM_LEXICAL_OVERLAP | STEM_TOO_SHORT | CLEAN warned |
|---|---|---|---|---|---|---|---|
| FIRST_BLIND (historical, Run 004; immutable) | v0.2, 78 cases | `b9aaca4` | 80 / 44 / 4 / 22 | pre-Run-006 linter on frozen v0.2: 9 / 0 / 1 / 6 | 0 / 1 / 0 / 3 | 2 / 0 / 1 / 7 | 3 of 20 |
| CURRENT_LINTER_ON_FROZEN_V0_2 (after Run 006) | v0.2 | current | 79 / 45 / 2 / 6 | 5 / 4 / 0 / 0 | 0 / 1 / 0 / 0 | 2 / 0 / 0 / 0 | 1 of 20 |
| POST_HUMAN_FINAL (9 rows adjudicated) | v0.2 overlay | current | 79 / 43 / 2 / 6 | not tabulated separately | n/a | n/a | 1 of 20 |
| FRESH_HELD_OUT_V0_3 (this report) | v0.3, 72 cases | current, frozen | 28 / 9 / 1 / 3 | 10 / 0 / 0 / 0 | not emitted | 5 / 4 / 0 / 1 | 1 of 38 |

The per-rule pre-Run-006 row is the figure recorded in the FUB-066 closure (Run 005 did not touch these rules); it is not recomputed here. FIRST_BLIND overall figures are historical and exclude OPTION_COMBINATION_REFERENCE (later added).

Why the numbers differ: v0.3 stratum design is built to stress the three Run 006 rules with purpose-built negatives, v0.2 was not; v0.3 labels were written knowing the Run 006 contract (so OPTION_ABSOLUTE_TERM 10/10 is partly contract-aligned by construction, while v0.2's 5/9 reflects weak-tier items that Run 006 deliberately dropped); the v0.3 STEM_TOO_SHORT stratum contains lookalike words that v0.2 did not, which is why the WATCH shows up as 4 FN here and 0 there; n is 9-10 per rule; labels are model-made on both sides. The 1-of-38 versus 1-of-20 clean-warn rates are not evidence of improvement.

## 8. Validation verdicts

Allowed vocabulary only. n is small (9-10 expected per rule); model-labeled; labeler knew Run 006.

| Rule | Verdict | Basis |
|---|---|---|
| OPTION_ABSOLUTE_TERM | **VALIDATED_PROVISIONALLY** | 10/10 TP, 0 FP, 0 unlabeled; about 10 pointed controls silent (see 4A) (weak quantifiers, symmetric, key content, stem-only). Caveat: contract-shaped labels; weak-tier recall is gone by design and unmeasured here. |
| STEM_TOO_SHORT | **KEEP_WITH_WATCH** | Narrowing worked on 11 valid short controls (0 FP), but the documented WATCH condition ("fresh held-out evidence shows lost TPs") is now met: 4 of 9 lost (3 clear, 1 label-contested), plus one false alarm on a valid 3-word question (HO3-071). Evidence supports no code change without human-valid short-question data. |
| KEY_STEM_LEXICAL_OVERLAP | **SEMANTIC_OWNERSHIP_CONFIRMED** | Natural overlap never fired (no precision cost); all 8 leakage cases are judged semantic; the 4 blatant ones are already covered via KEY_LONGEST_OPTION; the 4 subtle ones cannot be structural. Caveat: no blatant-but-not-longest case exists, so a narrow structural subset is neither shown nor excluded. |

Run 006 outcomes: CONFIRMED - strong-adverb contract (10/10, no FP), removal of lexical-overlap emission (no FP regression), short-stem narrowing for the intended valid questions (0 FP). WEAKENED - the accepted STEM_TOO_SHORT WATCH (real lost TPs), and completeness of the interrogative lead list (`מהם`). UNKNOWN - weak-tier recall loss on natural data; whether lookalike nouns exist at all outside an adversarial corpus; whether any structural subset of leakage is worth owning.

## 9. Integration readiness: NOT_READY

Evaluated against the canonical READY exit criteria (`ASSESSMENT_CALIBRATION_V0_1.md` section 4) and the v0.2 reassessment; no criterion moved to MET.

- Validation quality: 28 TP on 72 model-authored, model-labeled cases, one model family; first fresh data for Run 006 but no human adjudication (`HUMAN_ADJUDICATED_V0_3` none).
- Remaining FP burden: 1 FP of 38 CLEAN (2.6 percent) plus 1 valid-question false alarm and 2 label-open emissions; the noise is not zero and its human classification is pending.
- Semantic gaps: 18 cases carry a semantic expectation, 4 are semantic-only, weak-tier and leakage signals have no home until FUB-074; a clean lint says little about them.
- Recall gaps: 4 NOT_IMPLEMENTED FN, 4 STEM_TOO_SHORT FN, 1 ALL_OF_ABOVE FN.
- Pending human review: 13 queued rows undecided (at Run 007 close; adjudicated afterwards, see section 11; readiness stays NOT_READY).
- Content realism: synthetic general-knowledge items; no Ruppin or real instructor content, no student data, no real Hebrew authoring distribution.
- Open design gates unchanged: advisory-only surface, import-validator naming (DUPLICATE_PROMPT), position-rule significance, threshold stability.

Readiness is not changed by optimism: NOT_READY (recommendation only; nothing is wired, AE-031 stays gated).

## 10. Routing recommendations (proposed only; parent edits backlog docs)

- FUB-066: remains `RESOLVED_IMPLEMENTATION`; annotate with `FRESH_HELD_OUT_V0_3`: OPTION_ABSOLUTE_TERM VALIDATED_PROVISIONALLY, STEM_TOO_SHORT KEEP_WITH_WATCH (WATCH trigger fired), lexical overlap SEMANTIC_OWNERSHIP_CONFIRMED. Do not mark fully validated.
- FUB-074: keep open and unchanged in scope; add HO3-033 / HO3-025 / HO3-028 / HO3-058 as semantic-review fixtures (semantic reviewer still absent).
- New FUB (title only): "STEM_TOO_SHORT exemption lookalikes (list/name, ש/ה/ב/ל/ו + lead word) and lead-word completeness (`מהם`, `מהן`)" - HO3-038/040/042/044/071; decision needs human review of short valid vs invalid stems.
- New FUB: "STEM_NEGATIVE_WORDING on relative-clause and contrast negation (`שלא`, `ולא`)" - HO3-005 FP, HO3-058.
- New FUB: "OPTION_ALL_OF_ABOVE phrase coverage (`כל האפשרויות הנ"ל`)" - HO3-071.
- Existing/new for NOT_IMPLEMENTED: OPTION_STYLE_OUTLIER, OPTION_PUNCTUATION_INCONSISTENT, OPTION_NUMERIC_UNORDERED (HO3-032, 065, 070/item3) stay in the existing unimplemented-codes backlog; no new evidence changes priority.
- Optional record: structural leakage subset (section 4B) as a "described, not evidenced" note under FUB-074.

**Recommended next Run (exactly one):** a human-adjudication Run for the 13-row queue in section 6 (producing `HUMAN_ADJUDICATED_V0_3` as a post-evaluation overlay, labels frozen files untouched), before any linter change.

## Verification (class: unit-level local)

- Held-out v0.3 harness test at `55b9fb5`: passing (first-observed regression guard).
- Assessment tests (`vitest run src/domain/assessment`): 8 files, 299 passed (re-run in this Slice).
- Typecheck (`tsc --noEmit`): clean (no output).
- ESLint on `src/domain/assessment`: clean (no output).
- Invariants: no change under `src/` in this Slice (the 27-line generic harness helper was added earlier, in 55b9fb5); no linter, corpus or label change; this Slice adds only this document (plus gitignored scratch). Evidence is unit-level local on model-authored data; it is not integration, hosted, browser or human-validated evidence.

---

## 11. HUMAN_ADJUDICATED_V0_3 (post-evaluation human adjudication)

Added by Run `2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001` (Slices H1 overlay + evaluation, H2 this section). Sections 1-10 above are the frozen Run 007 record and are not rewritten; the only edits to them are pointer lines referring here. Everything in this section is a SEPARATE evidence class and is never pooled with `FRESH_HELD_OUT_V0_3`.

### 11.1 Provenance and non-blind status

- Machine-readable authority: `src/domain/assessment/golden/heldout-v0-3/human-adjudication.json` (version `v0.3-human-adjudication-1`, reviewer Dor, 2026-10-09, provenance `HUMAN_APPROVED_POST_EVALUATION`). Coverage: 13/13 queued cases (the 13-row queue of section 6). Full reasons and patches live only in the overlay; Dor's verbatim decisions are in the gitignored `scratch/v03hr/dor-decisions.json`.
- POST-EVALUATION, NOT BLINDED. Dor decided after seeing the question, options, key, the frozen model label, the frozen linter emissions and why each case mattered. These 13 cases are therefore observed, are not held-out evidence, and any later fix tested on them is CONTRACT_TEST / regression evidence, not fresh validation.
- Single reviewer, 13 of 72 cases (the 59 unqueued cases remain model-labeled), synthetic general-knowledge content. No inter-annotator agreement, no instructor or real-course data.
- Frozen corpus, labels, author-intent, label-review and hashes are untouched; the overlay is additive. Linter output is unchanged (first observed, not tuned). The harness `heldout-eval.ts` received additive generic overlay support in H1 (commit `35651e4`); no linter, normalizer, threshold or frozen data change.

### 11.2 The 13 decisions (compact; the overlay is the detailed authority)

| caseId | Final judgement | Deterministic decision | Semantic decision |
|---|---|---|---|
| HO3-005 | CLEAN | STEM_NEGATIVE_WORDING FORBIDDEN | - |
| HO3-058 | CLEAN | STEM_NEGATIVE_WORDING FORBIDDEN | REJECTED / NOT_A_FLAW |
| HO3-048 | FLAWED | STEM_TOO_SHORT and KEY_LONGEST_OPTION EXPECTED | - |
| HO3-071 | FLAWED | OPTION_ALL_OF_ABOVE EXPECTED; STEM_TOO_SHORT FORBIDDEN | - |
| HO3-042 | FLAWED | STEM_TOO_SHORT EXPECTED | - |
| HO3-040 | FLAWED | STEM_TOO_SHORT EXPECTED | - |
| HO3-038 | FLAWED | STEM_TOO_SHORT EXPECTED | - |
| HO3-044 | FLAWED | STEM_TOO_SHORT EXPECTED | - |
| HO3-025 | CLEAN | none | REJECTED / NOT_A_FLAW |
| HO3-028 | CLEAN | none | REJECTED / NOT_A_FLAW |
| HO3-021 | FLAWED | KEY_LONGEST_OPTION EXPECTED | APPROVED / REAL_DEFECT (stem-key echo) |
| HO3-004 | FLAWED | OPTION_ABSOLUTE_TERM EXPECTED | BORDERLINE_ACCEPTED_TP |
| HO3-033 | FLAWED | no deterministic expectation | APPROVED / REAL_DEFECT; weak-tier `בלבד` = contextual semantic concern |

### 11.3 Principles recorded by Dor (listed once; wording compact)

1. A negation token is not a negative-stem flaw; content/relative negation (`שלא`) is insufficient.
2. Contrast wording (`ולא ...`) is not a negative-stem flaw; an explicit category contrast is not a cue by itself.
3. Valid Hebrew interrogative morphology must not be rejected merely for having fewer than four words. The family מה / מהו / מהי / מהם / מהן is one interrogative family: a DESIGN NOTE only, not implemented.
4. Morphological or lexical resemblance alone is insufficient for the short-stem exemption; the complete utterance must function as a clear question or instruction, and a lead word that can begin an imperative does not make the whole short stem well-formed.
5. Restating the concept the stem defines is not leakage; leakage needs an asymmetric cue that identifies the key without the intended knowledge; a standard term sharing vocabulary with its defining behavior is not leakage.
6. Stem-key echo is a real defect when the key uniquely mirrors distinctive stem wording the distractors do not. This does NOT authorize restoring the broad KEY_STEM_LEXICAL_OVERLAP.
7. Strong asymmetric absolute wording in a distractor is a valid warning even when it is also misconception content. Weak-tier tokens alone remain semantic / human territory; they can contribute to a cue but the flaw is contextual.
8. Length alone is not always a flaw, but strong isolated length plus specificity asymmetry is a real test-taking cue.

### 11.4 Metrics (HUMAN_ADJUDICATED_V0_3, current linter unchanged; source `scratch/v03hr/post-human-dump.json`)

Reported separately from section 3 (`FRESH_HELD_OUT_V0_3`, which stays TP 28 / FN 9 / FP 1 / UNLABELED 3, clean warned 1 of 38, model-labeled).

Reviewed-13 only (4 CLEAN: 005, 058, 025, 028 / 9 FLAWED):

| Expected | TP | FN (implemented gap) | FN (not implemented) | FP | UNLABELED | CLEAN-reviewed warned |
|---|---|---|---|---|---|---|
| 9 | 4 | 5 | 0 | 3 (005 and 058 STEM_NEGATIVE_WORDING, 071 STEM_TOO_SHORT) | 0 | 2 of 4 |

Whole corpus under the overlay (`POST_HUMAN`; 41 CLEAN / 31 FLAWED):

| Evidence | Expected | TP | FN | FP | UNLABELED | CLEAN warned |
|---|---|---|---|---|---|---|
| FRESH_HELD_OUT_V0_3 (model-labeled, section 3) | 37 | 28 | 9 (5 impl / 4 not impl) | 1 | 3 | 1 of 38 |
| HUMAN_ADJUDICATED_V0_3 whole corpus | 38 | 29 | 9 (5 impl / 4 not impl) | 3 | 0 | 2 of 41 |
| Delta | +1 | +1 | 0 | +2 | -3 | +1 clean warned (clean base +3) |

The FP rise is a re-classification, not new linter errors: the two label-open emissions (058 negation, 071 short stem) became human-confirmed false positives, and HO3-048 KEY_LONGEST_OPTION became an expected TP. The linter emitted exactly what it emitted before.

Per-rule (expected / TP / FN / FP / UNLABELED), frozen model labels to post-human:

| Rule | FRESH_HELD_OUT_V0_3 | HUMAN_ADJUDICATED_V0_3 |
|---|---|---|
| OPTION_ABSOLUTE_TERM | 10 / 10 / 0 / 0 / 0 | same |
| KEY_STEM_LEXICAL_OVERLAP | not emitted | same |
| STEM_TOO_SHORT | 9 / 5 / 4 / 0 / 1 | 9 / 5 / 4 / 1 / 0 |
| STEM_NEGATIVE_WORDING | 1 / 1 / 0 / 1 / 1 | 1 / 1 / 0 / 2 / 0 |
| OPTION_ALL_OF_ABOVE | 1 / 0 / 1 / 0 / 0 | same |
| KEY_LONGEST_OPTION | 5 / 5 / 0 / 0 / 1 | 6 / 6 / 0 / 0 / 0 |

Per-case class changes (TP/FN/FP/UNLABELED, first to post): HO3-058 0/0/0/1 to 0/0/1/0; HO3-048 1/0/0/1 to 2/0/0/0; HO3-071 0/1/0/1 to 0/1/1/0; all other reviewed cases unchanged (005 remains FP; 042, 040, 038, 044 remain FN; 021 and 004 remain TP; 025, 028, 033 silent). The STEM_NEGATIVE_WORDING expected 1 / TP 1 is a different, unreviewed case.

### 11.5 Rule reassessment

Limits that apply to every item below: n is tiny (1 to 5 cases per question); one reviewer; decisions were made post-evaluation on the same 13 cases that now drive any fix, so a later fix is CONTRACT_TEST / regression evidence and validation requires a fresh batch.

**a. STEM_NEGATIVE_WORDING (FUB-076).** Human evidence: HO3-005 and HO3-058 FORBIDDEN (2 human-confirmed FPs). Mechanism (read-only, `question-lint.ts`): `NEGATION_TERMS_HE` (`לא אין אינו אינה אינם אינן בלתי בלא ללא מלבד`) matches as whole tokens with an optional single `ו`/`ש`/`וש` prefix, plus English terms, a `least` check, and `חוץ מ`. So `שלא` (005) and `ולא` (058) fire by design; the rule counts any negation token anywhere in the stem and has no notion of which clause asks the question. This contradicts principles 1-2 directly; the defect is the rule's definition of "negative stem", not an edge case. Verdict: promotion trigger met; reframe FUB-076 from "relative/contrast negation edge" to "define a narrow negative-stem condition". The correct narrow definition (for example negation in the question-asking clause or an "which is NOT / except" frame) is a design decision, not a phrase-list tweak. The one TP in the corpus is unreviewed, so the recall impact of narrowing is unmeasured.

**b. STEM_TOO_SHORT (FUB-075).**
(A) Threshold evidence. The 4-word constant is not shown to be wrong and is not concluded wrong: no flaw was missed because of the threshold itself, and every human-approved flaw (038, 040, 042, 044) and the one human-forbidden emission (071) trace to the exemption, not the count. It is also not shown to be right: HO3-071 shows valid 3-word questions are rejected without the exemption, and principle 3 says word count is the wrong axis for validity. Verdict on the threshold: unknown, not implicated.
(B) Exemption-classification evidence. 4 human-approved lost TPs (038 `List of birds`, 040 `שמי הלילה`, 042 `במה`, 044 `Name tags`) come from the exemption being too permissive (first-word whitelist hit by `list`/`name`; single-prefix path `ש`+`מי`, `ב`+`מה`). 1 human-forbidden emission (071 `מהם גזי חממה?`) comes from the lead list being incomplete (`מהם` absent). So the current first-word whitelist plus single-prefix mechanism errs in BOTH directions. The human principle is about whether the whole short utterance functions as a well-formed question or instruction, not about word count and not about growing the whitelist (principle 4); extending the lead list alone would fix 071 and does nothing for the 042-type leak.

Post-hoc descriptive pass (scratch-only, NOT validated, no fix proposed or decided). Over the 26 frozen v0.3 stems under four words (9 model-labeled flawed fragments: 036, 038, 040, 042, 044, 046, 048, 050, 052; 17 stems valid as questions, including human-valid 071; only 038/040/042/044/071 are human-adjudicated, the rest are model-labeled):
- Terminal `?` or `:`: present on 15 of the 17 valid stems (13 `?`, 2 `:`) and on 0 of the 9 flawed fragments. The other 2 valid stems end in `.` (`Define osmosis.`, `Define a vacuum.`); no flawed fragment has any terminal punctuation. It would separate this corpus completely, but the separation is confounded: the author wrote fragments unpunctuated and questions punctuated by construction, and no punctuated fragment (`שמי הלילה?`) or unpunctuated valid question exists to test it.
- Lone interrogative token with no content word (single-token stem): matches only 042 (and 052 `כמהין`, a non-interrogative); all 17 valid stems have at least two tokens.
- Imperative lead plus object: `Define osmosis.` (valid) and `Name tags` (flaw) have identical shape (lead word plus one noun), so word-shape alone cannot separate them; `List of birds` (lead plus preposition) differs only by the preposition, n=1. No Hebrew imperative short stem exists in the corpus to test.
- Lexical first-word membership (current mechanism): catches 5 of 9 flawed fragments and passes all valid ones except 071.
No signal is validated; n is 9 versus 17, labels mostly model-made, the corpus is purpose-built adversarial. This pass only informs what the next Run should pre-register. FUB-075 decision: promote (trigger met), reframe as "STEM_TOO_SHORT exemption classification (whole-utterance well-formedness) and interrogative-family completeness"; lead-list completeness (`מהם`/`מהן`, the FP side) and exemption permissiveness (the FN side) are two separable parts, the second needing its own design decision.

**c. KEY_STEM_LEXICAL_OVERLAP (FUB-074).** HO3-025 and HO3-028 were human-rejected as non-flaws; HO3-021 is a human-approved semantic defect (unique echo of `תופעת הגאות והשפל`) that KEY_LONGEST_OPTION already catches. SEMANTIC_OWNERSHIP_CONFIRMED is stronger after human adjudication: two of the three leakage-flavored cases were not defects, so a broad lexical rule would be exposed to exactly this kind of false alarm (inference from why they were queued; the retired rule was not re-run), and the one real defect needs a "uniquely mirrors distinctive stem wording, distractors do not" judgement. A narrow structural subset is conceivable (n=1) but is explicitly not authorized; do not restore the rule. FUB-074 stays open; 021 becomes a positive semantic fixture, 025/028 negative fixtures.

**d. OPTION_ABSOLUTE_TERM strong vs weak tier.** HO3-004 (strong `בהכרח` in one distractor, also misconception content) was accepted as a borderline TP; HO3-033 (weak `בלבד`) was judged a contextual semantic concern with no deterministic expectation, and the rule is silent on it. Both match the Run 006 split (strong adverbs deterministic, weak tier human/semantic). Verdict: supports the split, weakly (n=2, one borderline); weak-tier recall on natural data stays unmeasured.

**e. OPTION_ALL_OF_ABOVE (FUB-077).** HO3-071 option d `כל האפשרויות הנ"ל` is human-confirmed as the expected all-of-above (a phrase-coverage gap). Mechanism (read-only): `ALL_OF_ABOVE_PHRASES` is a closed list of whole-token phrases (`כל התשובות`, `כל התשובות נכונות`, `כולן נכונות`, `כולם נכונים`, `כל האמור לעיל`, `כל הנ"ל`, plus English variants) matched against option tokens; `כל האפשרויות הנ"ל` is not a listed form (it says `האפשרויות`, not `התשובות`, and `כל` is not adjacent to `הנ"ל`). Tractability: high (closed-list phrase addition, human-confirmed, deterministic); caveat: it extends a hand-listed set from n=1, so coverage of other Hebrew variants stays unmeasured.

**f. KEY_LONGEST_OPTION.** Human confirmation recorded only: HO3-048 and HO3-021 are expected TPs (5 to 6 expected/TP in the post-human view). No rule change implied.

**g. Run 006/007 updated verdict.** Mixed. STRONGER: the strong-adverb versus weak-tier split (004, 033) and the semantic ownership of key-stem overlap (025, 028, 021). WEAKER: the STEM_TOO_SHORT narrowing (human-confirmed errors in both directions; the WATCH is now human-confirmed rather than model-labeled) and STEM_NEGATIVE_WORDING as implemented (2 human-confirmed FPs; pre-dates Run 006 but now documented). UNKNOWN: natural frequency of any of these flaws in real instructor items, weak-tier recall, whether any short-stem signal generalizes. Integration readiness stays **NOT_READY**: the canonical READY criteria (`ASSESSMENT_CALIBRATION_V0_1.md` section 4) are not met (criteria 2-6 remain OPEN, and criterion 2 requires cases not used to tune rules, which these 13 now are); the adjudication is 13 synthetic cases from one reviewer after the fact, there is no real instructor data, the FP/FN burden remains (reviewed-13 FP 3, FN 5; whole corpus FN 9), 4 rules remain unimplemented, and there is no semantic critic.

### 11.6 Routing and verification

Routing (the backlog is the single home for status): FUB-066 stays `RESOLVED_IMPLEMENTATION` with a human-adjudication annotation; FUB-074 open (fixtures 033 and 021 positive, 025/028/058 negative); FUB-075, FUB-076, FUB-077 promotion triggers met and reframed. See `docs/FOLLOW_UP_BACKLOG.md` and the Run report `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001.md` for the single recommended next Run.

Evidence class actually exercised: unit-level local (`vitest run src/domain/assessment`: 9 files, 330 tests passed at `35651e4`) over model-authored data with a single-reviewer post-evaluation human overlay. Not blind, not integration, not hosted, not real-course data.

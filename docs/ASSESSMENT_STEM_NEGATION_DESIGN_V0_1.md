# Assessment Linter - STEM_NEGATIVE_WORDING Structural Design and Pre-Registration (FUB-076), v0.1

Status: DESIGN + PRE-REGISTRATION. NOT IMPLEMENTED. Nothing in this document changes linter behavior.
Run: `2026-10-10-ASSESSMENT-ENGINE-010`. START_HEAD `a779ba4`. Owner of status: `docs/FOLLOW_UP_BACKLOG.md` FUB-076. Canonical ownership of the deterministic-vs-semantic boundary: `docs/ASSESSMENT_ENGINE.md` section 4 (AI Necessity Matrix) and section 10.3.

## 0. Reading guide, evidence labels and honesty limits

- `FACT` = read from repository source or measured by running the UNCHANGED linter (compiled into a scratch directory outside the repository; no repository file was altered). `INFERENCE` = reasoning about design; not measured.
- Evidence classes (`.claude/rules/testing.md` section 13 vocabulary): `OBSERVED` cases (v0.1 golden, v0.2, v0.3, v0.4) are known to the designer. They may define regression contracts and are NEVER fresh validation. `CONTRACT_TEST` rows are newly authored in this Run for the contract and are also not validation. No row in this document is `FRESH_HELD_OUT`.
- Human evidence is limited to Dor's single-reviewer rulings: HUMAN_ADJUDICATED_V0_3 (HO3-005, HO3-058), HUMAN_ADJUDICATED_V0_4 (HO4-007, 008, 015, 052, 062, 063) and the v0.2 review of HO-063. That is 2 true defects and 7 false positives, all on synthetic model-authored stems. Every other row below carries a MODEL label or no label and gets NO human status here. Nothing in this Run is a human ruling.
- The design was derived from the human PRINCIPLES (section 1.3) and then checked against the cases on paper. A design that agrees with the 9 human-ruled cases is not thereby validated; section 7 defines the only acceptable validation.

## 1. D1 - Evidence reconstruction

### 1.1 Human-ruled cases (the only human evidence)

| ID | Stem (abridged) | Source / class | Human status | Intended semantic category | Current linter (measured) | Observed |
|---|---|---|---|---|---|---|
| HO4-052 | `איזו מהטענות הבאות איננה שגויה?` | FRESH_HELD_OUT_V0_4, then HUMAN_ADJUDICATED_V0_4 | TRUE DEFECT (expected, approved) | Negative selection + double negative; negation governs the key | silent (FN: `איננה` is not in the term list) | yes |
| HO-063 | `איזו מהטענות הבאות איננה נכונה?` | v0.2 FIRST_BLIND, v0.2 human review | TRUE DEFECT ("genuine negative wording", expectation stays) | Negative selection | silent (FN, same cause) | yes |
| HO3-005 | `מה יקרה לגוף במנוחה שלא פועל עליו שום כוח?` | v0.3, HUMAN_ADJUDICATED_V0_3 | FALSE POSITIVE (forbidden) | Relative/content negation inside the physical condition | silent after Run 008 (cue path) | yes |
| HO3-058 | `אילו מהבאים נחשבים לכלי נגינה, ולא לכלי כתיבה?` | v0.3, HUMAN_ADJUDICATED_V0_3 | FALSE POSITIVE (forbidden) | Natural category contrast | silent after Run 008 (`ל`-initial next token) | yes |
| HO4-007 | `ויטמין C, שאינו מסיס בשומן, נמצא בכמות גבוהה במיוחד באיזה מזון?` | v0.4 + HUMAN_ADJUDICATED_V0_4 | FALSE POSITIVE (forbidden) | Descriptive relative clause on the GIVEN entity | EMIT | yes |
| HO4-008 | long vignette, `... טמפרטורת התערובת אינה עולה מעל איזו טמפרטורה ...` | v0.4 + HUMAN_ADJUDICATED_V0_4 | FALSE POSITIVE (forbidden) | Late factual negation in explanatory content | EMIT | yes |
| HO4-015 | `איזו מהבאות היא שפת סימון ולא שפת תכנות?` | v0.4 + HUMAN_ADJUDICATED_V0_4 | FALSE POSITIVE (forbidden) | Natural contrast defining the content | EMIT | yes |
| HO4-062 | `איזה בעל חיים חי במים ואינו דג?` | v0.4 + HUMAN_ADJUDICATED_V0_4 | FALSE POSITIVE (forbidden) | Conjunctive proposition: factual exclusion inside the property | EMIT | yes |
| HO4-063 | `איזו פעולה היא תפקיד של הלב ולא של הריאות?` | v0.4 + HUMAN_ADJUDICATED_V0_4 | FALSE POSITIVE (forbidden) | Natural contrast | EMIT | yes |

Human principles recorded in the repository (verbatim intent): a negation token is not a negative-stem flaw; relative/content/factual/late/contrast negation is not; the flaw exists when the negation controls which answer the learner must select (HO4-052 rationale).

### 1.2 Other OBSERVED negation-bearing cases (NO human ruling; MODEL label or unlabeled)

| ID | Stem (abridged) | Class / label | Semantic category (labeler's reading; not human-confirmed) | Current linter (measured) |
|---|---|---|---|---|
| HO-018 | `Which of the following is NOT a prime number?` | v0.2, model-expected | negative selection | EMIT |
| HO-021 | `איזה מהבאים אינו מתכת?` | v0.2, model-expected | negative selection | EMIT |
| HO-022 | `איזו מהטענות הבאות אינה לא נכונה לגבי כדור הארץ?` | v0.2, model-expected | double negative | EMIT |
| HO-048 | `Which statement about triangles is NOT always true?` | v0.2, model-expected | negative selection | EMIT |
| HO-054 | `Which of the following are NOT mammals?` | v0.2, model-expected | negative selection | EMIT |
| HO3-072 | `איזה מהסלעים הבאים אינו סלע מגמטי?` | v0.3, model-expected | negative selection | EMIT |
| HO4-005 | `איזו מהמדינות הבאות אינה חברה קבועה במועצת הביטחון של האו"ם?` | v0.4, model-expected | negative selection | EMIT |
| HO4-006 | `Which of the following is NOT a multiple of 7?` | v0.4, model-expected | negative selection | EMIT |
| HO4-009 | `אילו מהמספרים הבאים אינם ראשוניים? בחר/י את כל התשובות הנכונות.` | v0.4, model-expected | negative selection | EMIT |
| HO4-051 | `Which of the following is not a noble gas?` | v0.4, model-expected | negative selection | EMIT |
| HO-078/item2 | `איזה מהבאים אינו חלק מהמערכת העצבית המרכזית?` | v0.2 set item, unlabeled | negative selection | EMIT |
| golden WEAK-NEGATION-HE-01 | `איזה מהבאים אינו פרי הגדל על עץ?` | v0.1 golden (tuned fixture) | negative selection | EMIT |
| golden WEAK-NEGATION-EN-01 | `All of these are fruits EXCEPT which one?` | v0.1 golden | exception selection | EMIT |
| **HO4-012** | `Which of these HTTP status codes means that the requested page was not found?` | v0.4, model-expected | content negation inside the meaning being asked about (labeler called it a flaw) | EMIT (**pending a human ruling; the design flips it**) |
| **golden WEAK-NEGATION-HE-PREFIX-01** | `בחרו את החיה שלא חיה במים בדרך כלל.` | v0.1 golden | imperative selection + relative `שלא` | EMIT (**pending; the design flips it**) |
| HO4-064 | `אדם שבודק ... ולא לדלג על ארוחות, ... סובל כנראה ממחלה הנקראת מה?` | v0.4, model CLEAN | content negation in a vignette | silent (by accident: `לדלג` is `ל`-initial, the known Run 008 residual) |
| HO-073/item8 | `איזו תכונה שייכת לתערובת ולא לתרכובת?` | v0.2 set item, unlabeled | contrast | silent after Run 008 |
| HO-046 | `How many months of the year have at least 28 days?` | v0.2 | `at least` is not negation | silent |
| golden FP-NEGATION-HE-HUTZ-01 | `... בנושא מדיניות חוץ?` | v0.1 golden | `חוץ` noun | silent |
| golden FP-NEGATION-EN-LEAST-01 | `A polygon needs at least how many straight sides?` | v0.1 golden | `at least` | silent |

Legacy synthetic contract rows (unit tests; no human ruling, predate the human principle) that depend on token-level firing are listed with their design-predicted fate in section 5.2.

### 1.3 Edge shapes and where they stand

| Shape | Observed instance | Human-ruled? | Current linter |
|---|---|---|---|
| Relative-clause negation on the GIVEN entity | HO3-005 `שלא`, HO4-007 `שאינו` | yes: not a flaw | `שלא` silent via Run 008 cue path; `שאינו` EMIT |
| Factual/descriptive negation (late, vignette) | HO4-008 `אינה`, HO4-064 `ולא לדלג` | 008 yes; 064 no | 008 EMIT; 064 silent by accident |
| Contrast `ולא` | HO3-058, HO4-015, HO4-063, HO-073/item8 | first three yes | silent only when next token is `ל`-initial |
| Conjunctive exclusion `ואינו` | HO4-062 | yes: not a flaw | EMIT |
| Negative selection, wh-frame | HO4-005, 009, 052, HO-021, HO3-072 ... | 052, HO-063 yes | EMIT except `איננ*` forms |
| Double negative | HO4-052, HO-022 | 052 yes | HO-022 EMIT; HO4-052 silent |
| English NOT / except | HO-018, 048, 054, HO4-006, 051; golden EN-01 | none | EMIT |
| English embedded content `not` | HO4-012 | none | EMIT |
| Inflection `אינו אינה אינם אינן` | HO4-005, 009, HO-021 | none specifically | EMIT |
| Inflection `איננו איננה איננם איננן` | HO4-052, HO-063 | yes (the two defects) | silent (all four forms; CT-H02, H03e-h measured) |
| Prefix forms `שאינו`, `ואינו`, `ולא`, `שלא`, `ושלא` | 007, 062, 015/063, HO3-005 | 007, 062, 015, 063, HO3-005 yes | `ו`/`ש`+`אינו` always EMIT; `לא` subtraction only (Run 008) |
| Imperative selection + relative | golden PREFIX-01; legacy test rows | none | EMIT only when an earlier cue (`בחרו`, `סמנו`...) is found |
| Cue-list failures named in Run 008 | `מי מהבאים שלא`, `מצאו ... שלא`, `מהם ... שלא` | no (documented residual) | silent where they used to EMIT (CT-H07b measured silent) |
| Sentence-boundary / clause-position | `שלא` cue check scans ALL earlier tokens | no | no boundary awareness at all |
| Late negation in a long stem | HO4-008 | yes | EMIT |
| Negation without any interrogative/selection frame | none observed in corpora; CT-E32 | no | EMIT (CT-H29, CT-E32 measured) |

### 1.4 What D1 establishes

- The human-ruled set is 9 cases (2 true defects, 7 false positives). The linter is wrong on all 9: 7 FPs it emits (5 fresh in v0.4 plus HO3-005/058 which Run 008 silenced) and 2 defects it misses.
- The TP side of the evidence is almost entirely MODEL-labeled and structurally homogeneous: all 13 non-pending observed negative-selection stems (10 model-expected in v0.2-v0.4, 1 unlabeled, 2 v0.1 golden fixtures that are themselves tuned) share one surface frame (interrogative selector, optional partitive, negated predicate immediately after, or an exception slot). That homogeneity is a property of how the corpora were authored, so it limits what recall can be claimed.
- Two OBSERVED cases whose current EMIT depends on an unreviewed label (HO4-012, golden PREFIX-01) are exactly where a structural design changes behavior. They are flagged, not ruled.

## 2. D2 - Current mechanism

### 2.1 FACT FROM SOURCE

- `tokenize()` (`text-normalize.ts:102-109`): `comparisonKey` (NFC, bidi/zero-width stripped, niqqud stripped, final letters folded, quotes/dashes normalized, lowercased) then split on `/[^\p{L}\p{N}\p{M}'"-]+/u`. **All punctuation is discarded.** No sentence, clause, comma or question-mark position survives into the token array, so the linter cannot see a clause boundary.
- Terms (`question-lint.ts:140-198`): English `not except never` (whole token, no prefixes) plus `hasNegativeLeast` (`least` unless `at (the) least`) plus `hasHutzException` (`חוץ` followed by a token beginning with `מ`). Hebrew `NEGATION_TERMS_HE` = `לא אין אינו אינה אינם אינן בלתי בלא ללא מלבד`, each matched as a WHOLE token with an optional `ו`/`ש`/`וש` prefix (`containsTerm`, `text-normalize.ts:157-191`). Final letters are folded, so `אינם` is stored as `אינמ` and so on.
- Emission (`question-lint.ts:553-558`): `negations` counts how many distinct terms occur ANYWHERE in the prompt; any count > 0 emits one `STEM_NEGATIVE_WORDING` WARNING with `metrics.negationTermCount`. There is no notion of selector, position, clause, or role.
- Run 008 (`question-lint.ts:171-196`): for the term `לא` ONLY: (i) prefix `ש`/`וש` counts only if an earlier token contains one of 10 `SELECTION_CUES` (matched with the default prefix set, scanned over all earlier tokens, no sentence boundary); (ii) prefix `ו` is skipped when the next token matches `/^ל[א-ת]{3,}$/`. Every other term, every other prefix, and English are untouched.

### 2.2 Why each human-ruled case behaves as it does (FACT, traced to the code above and confirmed by execution)

| Case | Why |
|---|---|
| HO4-007 `שאינו` EMIT | term `אינו` with prefix `ש`; Run 008 branch applies to `לא` only |
| HO4-008 `אינה` EMIT | bare whole-token `אינה`; the term has no position test |
| HO4-015 `ולא שפת` EMIT | `ו`+`לא` and next token `שפת` is not `ל`-initial, so the contrast subtraction does not fire |
| HO4-063 `ולא של` EMIT | same: `של` is `ש`-initial |
| HO4-062 `ואינו` EMIT | term `אינו` with prefix `ו`; the contrast subtraction is `לא`-only |
| HO4-052 / HO-063 silent | `איננה` is absent from `NEGATION_TERMS_HE`; `containsTerm` accepts only whole-token equality or an `ו`/`ש` prefix, and `איננה` is not `ו`/`ש` + `אינה` (the extra `נ` is inside the word) |
| HO3-005, HO3-058 silent | Run 008: no earlier selection cue before `שלא`; `ולא לכלי` has a `ל`-initial next token |
| HO4-064 silent | `ולא לדלג`: `לדלג` is a verb that happens to match `ל[א-ת]{3,}` (accidental) |

Measured today on new shapes (section 5): the long-form paradigm is silent in all four forms (`איננו איננה איננם איננן`); English `isn't` and `cannot` are silent; `מי מהבאים שלא` is silent; non-question stems with a content negation emit (`CT-H29`, `CT-E32`); and every `ואינו`/`ולא`/`שאינו` outside a Run 008 pattern emits.

### 2.3 DESIGN INFERENCE

- The two failure directions have one root cause: the rule asks "is a negation word present?" when the human principle asks "does the negation govern the selection?". Run 008 added two surface subtractions for one token (`לא`). Run 009 showed the subtraction did not generalize because the same ambiguity exists for every other token and prefix.
- The Hebrew prefix `ש` is both relativizer and complementizer, and `ו` is the coordinator; the linter has no POS or clause information, so any rule that says "`שאינו` is a flaw only if ..." must be expressed through POSITION relative to an interrogative selector, not through the token.
- Current TPs that a redesign could endanger: every TP whose negation is NOT immediately after an interrogative selector (see 5.2), the `בלתי ללא בלא` adnominal forms, English `never`/`least`, the imperative-selection rows, and exception forms with a named exceptee.

## 3. D3 - Candidate designs

Principle under test: "A negation token is not itself a defect. A deterministic negative-stem warning is justified when the question structure makes negation govern what answer the learner must select."

### 3.1 Candidates

- **A. Interrogative-frame adjacency.** Emit iff a closed-class interrogative selector is followed, within K raw tokens, by a negation token. (Run 008's cue list replaced by a distance window.)
- **B. Clause-aware.** Segment the stem into clauses (punctuation, subordinators) and emit iff a negation sits in the same clause as, and after, an interrogative selector.
- **C. Hybrid structural frame with explicit semantic hand-off (RECOMMENDED).** Emit only for two high-confidence structural frames; everything else is deterministic-silent and owned by the semantic critic / instructor review.
  - Frame 1 SELECTOR-NEGATED-PREDICATE: selector (first per sentence), a bounded noun-phrase span made of grammatical function material plus a small content budget, and then the negated predicate (or a ש-relative negation that attaches directly to the selected head). Coordination (`ו`+negation), a clause boundary, or an exceeded content budget block the frame.
  - Frame 2 EXCEPTION-SLOT: an exception marker whose exceptee is an anaphoric slot (`אחד`, `one`, `which`, end of clause), never a named exceptee.
- **D. Option-set-aware.** The flaw exists when the key is the exception among distractors that satisfy a positive predicate. This is the true semantics behind the human rulings (062/015/063 are conjunctions, 052/005 are exceptions).
- **E. Demote.** Remove deterministic ownership; the semantic critic / humans own all negative-stem detection.

### 3.2 Evaluation on the 9 human-ruled cases (INFERENCE, paper evaluation; A uses K = 4 raw tokens)

| Case (desired) | Current | A | B | C | D | E |
|---|---|---|---|---|---|---|
| HO4-052 (EMIT) | miss | EMIT | EMIT | EMIT | n/a | miss |
| HO-063 (EMIT) | miss | EMIT | EMIT | EMIT | n/a | miss |
| HO3-005 (silent) | silent | **EMIT** (NEG is the 4th token) | **EMIT** (same clause, no punctuation) | silent | n/a | silent |
| HO3-058 (silent) | silent | silent (by distance) | silent (by comma only) | silent | n/a | silent |
| HO4-007 (silent) | EMIT | silent | silent (by commas only) | silent | n/a | silent |
| HO4-008 (silent) | EMIT | silent | silent (NEG precedes selector) | silent | n/a | silent |
| HO4-015 (silent) | EMIT | silent (5th token, K-edge) | **EMIT** | silent | n/a | silent |
| HO4-062 (silent) | EMIT | silent (5th token, K-edge) | **EMIT** | silent | n/a | silent |
| HO4-063 (silent) | EMIT | silent | **EMIT** | silent | n/a | silent |
| Correct of 9 | 2 | 8 (two by a K-edge) | 5 | 9 (not independent evidence) | not evaluable | 7 |

C agreeing with all 9 is a consistency check against the principle I derived it from, not validation. A's two K-edge successes flip if K moves from 4 to 5.

### 3.3 Comparison

| Criterion | A | B | C | D | E |
|---|---|---|---|---|---|
| Recall on the 13 non-pending observed negative-selection stems (10 model-expected + 1 unlabeled + 2 golden; paper) | 7/13 at K=4 (the 5 English `Which of the following is NOT` stems have `NOT` as the 5th token, plus no exception frame); a single K cannot serve both languages | 13/13 | 13/13 | n/a | 0/13 |
| Recall risk on genuine negative stems outside the frame | high | low | medium (imperative, comma-interrupted, NP budget+1 are lost by design) | n/a | total |
| Precision on the human FP shapes | fragile (distance coincidences) | fails 4 of 7 (relative/coordination invisible without POS) | handles all 7 by structural features | n/a | trivial |
| Hebrew morphology robustness | full paradigm needed | full paradigm + clause punctuation (an authoring convention) | full paradigm; prefixes interpreted structurally (`ש` relative, `ו` coordinator) | semantic | n/a |
| English | needs aux handling | punctuation + subordinators | auxiliary-adjacent `not`/`n't`; first-aux rule is real English grammar | semantic | n/a |
| Complexity | low | medium | medium-high (~80-120 lines + a boundary-aware tokenizer) | not deterministic | none |
| Deterministic explainability | high | medium | high: each emission names the frame | n/a | n/a |
| Cue-list-in-disguise risk | medium (a window constant) | medium | **real, bounded, stated in 3.4** | none | none |
| AI Necessity Matrix fit | CODE+HEURISTIC | CODE+HEURISTIC | CODE+HEURISTIC for the frame, AI OPTIONAL / HUMAN for the rest | AI REQUIRED | HUMAN/AI |

### 3.4 Can the principle be implemented deterministically? (the honest answer)

- **Not fully.** "Negation governs selection" is a semantic relation between the stem and the option set (candidate D). Hebrew has no overt complementizer/relativizer distinction (`ש`), no overt coordinator/predicate distinction without POS (`ו`), and no verb lexicon is available. A deterministic rule can only approximate governance by STRUCTURE: where the negation sits relative to the interrogative selector and what lies between them.
- **Partially, yes, for the dominant textbook frame.** Candidate C converts the principle into three checkable structural facts: (1) the negation is in predicate position directly after the selector's noun phrase, (2) no coordinator, clause boundary or over-budget material intervenes, (3) the exceptee of an exception marker is an unnamed slot. Each of the 9 human rulings is explained by one of these features (062/015/063/058: coordination or budget; 007/008: negation does not follow a selector; HO3-005: pronominal selector takes no content; 052/005/009: adjacent negated predicate). That explanation is partly by NOUN-PHRASE LENGTH, a budget rather than syntax: variants with a one-token head (CT-H45, CT-H46) have the same structure as HO3-005 and HO4-007 yet are predicted EMIT, and are recorded as LIMIT rows. "Structural" here means position and coordination, not parsed syntax.
- **It is not list-free, and this document does not pretend otherwise.** C needs inventories of three honest kinds. PURE closed grammatical classes: selectors, the negation paradigm, the English auxiliaries and subordinators, exception markers. LEXEME SETS: the deictic `הבא*` forms and the anaphoric slots `אחד/אחת/one`. An ORTHOGRAPHIC PATTERN: the partitive `מה`+2 letters (it also matches `מהירות`, `מהנדס`, and does not match `מהם/מהן`). Plus four numeric budgets (`N = 2`, relative budget 1, pronoun budget 0, English window 8). What distinguishes this from the Run 008 cue list: (i) the classes are enumerated by paradigm with a paradigm-completeness contract row for every negation member (CT-H03a-h), not grown from observed failures; (ii) no noun, verb or topical vocabulary appears; (iii) the blind spots are enumerated in 4.4 (an enumeration is not a proof that it is complete; v0.5 must probe it); (iv) the budgets are explicit product constants. **The budgets are determined only by authored rows:** on the observed corpora and the 65 original rows, N = 1 breaks only the author-written CT-H05, N = 3 breaks only CT-H33 and CT-H37, a relative budget of 2 breaks nothing, and the pronoun budget 0 is pinned only by stems that contain a content token (HO3-005, CT-H24/H25). The relative budget in particular is untested by any observed datum.
- **Where a structural rule cannot be right** (documented limits, not hidden): CT-H41 `איזה בעל חיים שאינו דג חי במים?` is a semantic twin of the human-CLEAN HO4-062 and the design stays silent only because of a relative budget, so it is PENDING_HUMAN (Q5) and semantic-owned; CT-H45/H46 are the same-structure twins of HO3-005/HO4-007 with a one-token head and are predicted EMIT (precision cost); CT-H42/H44 show that `ש` as a complementizer or free relative is not distinguishable from a relative by position; CT-E25 is a content negation the frame cannot tell from a negated predicate without a lexical-verb test; CT-H36/H37/E11 are genuine negative selections the frame deliberately misses.

### 3.5 Why the others lose

- A: its two successes on HO4-015/062 are distance coincidences (K = 4 vs 5) and it fails HO3-005; it has no principled way to separate "negated predicate" from "negation somewhere nearby".
- B: depends on punctuation, which is an authoring convention (the same confound already documented for FUB-075); fails 4 of 7 FPs because relative/coordinated negation inside ONE clause is invisible without POS.
- D: the correct semantics, but not computable without understanding the options; it is the semantic critic's job (AE-021) and is recorded as the long-term owner of everything C does not cover.
- E: loses all 13 observed negative-selection stems (but those are MODEL-labeled or golden and share one homogeneous frame, so this is weak evidence) and the 2 human-confirmed defects, and leaves ZERO deterministic signal today because the semantic critic (AE-021) is unwired. On the human data alone E is not worse than C: the human set is 7 false positives against 2 defects, and E gets the 7 right. C is chosen for coverage of the dominant textbook frame at an acceptable, enumerated precision cost, not because the human data prove it better. It is kept as the explicit FALLBACK if v0.5 shows C fails its pre-registered precision test (section 7).

## 4. D5 - Decision and specification

### 4.1 Decision

1. **FUB-076 cannot be solved fully deterministically.** The governing relation is semantic (candidate D). **It can be solved PARTIALLY and honestly by a structural rule.**
2. **Chosen design: Candidate C**, a conservative hybrid. Deterministic ownership is reduced to two high-confidence structural frames (SELECTOR-NEGATED-PREDICATE and EXCEPTION-SLOT) in Hebrew and English. Every other negative-selection stem leaves deterministic ownership (no signal in this phase) and belongs to the semantic critic (AI OPTIONAL for detection) and to instructor/human review (severity and the final call).
3. The Run 008 mechanism (token-level `SELECTION_CUES` list and the `ל`-initial contrast regex) is REMOVED by the design, not extended. No closed negation-token list, cue whitelist, or exception list is grown. The only inventories are grammatical classes, lexeme sets and one orthographic pattern, labelled honestly in 4.2; the negation paradigm has a paradigm-completeness contract row for every member.
4. Severity unchanged: WARNING, advisory only, never an ERROR. The rule stays unwired (integration remains NOT_READY).
5. This decision is a DESIGN decision made inside Run scope. It is gated by the human decisions H1-H3 (section 8) before an implementation Run may start.

### 4.2 Definitions (INFERENCE-based design; all lists are comparison-normalized with the existing `norm()` so final letters fold)

Boundary-aware tokens: each token carries the break that precedes it: `NONE`, `CLAUSE` (`,` `;` `:` `(` `)` dash), or `SENTENCE` (`?` `!` and `.` followed by whitespace; decimals, `ד"ר`, acronyms must not split). A *segment* is a run of tokens with no CLAUSE or SENTENCE break; a *sentence* is a run with no SENTENCE break.

Inventories (class kind stated per row; comparison-normalized with the existing `norm()` so final letters fold):

| Name | Members | Class |
|---|---|---|
| SEL_HE_DET (content budget 2) | `איזה איזו אילו איזהו` | closed class: interrogative determiners (exact token; prepositional fusions like `באיזה` are NOT selectors) |
| SEL_HE_PRON (content budget 0) | `מי מה` | interrogative pronouns |
| NEG_PRED_HE | `אינו אינה אינם אינן` `איננו איננה איננם איננן` (copular), `לא` (verbal), `אין` (existential) | full negation paradigm; prefix analysis is exact: optional prefix in `{"", ש, ו, וש}` + a member |
| PARTITIVE_HE (orthographic pattern) | one token matching `מה` + 2 or more Hebrew letters, before any content token (`מהבאים`, `מהטענות`) | free. Also matches `מהירות`, `מהנדס`; does NOT match `מהם/מהן` (they fold to a 1-letter remainder), so `מי מהם ...` is unsupported |
| DEICTIC_HE (lexeme set) | `הבא הבאה הבאים הבאות` | free |
| EXC_HE | `מלבד` (optional `ו/ש/וש` prefix), `חוץ` + a following token starting with `מ` (existing logic) | exception markers |
| SLOT_HE (lexeme set) | `אחד אחת` (after removing the attached `מ` of `חוץ מ-`), a SEL_HE token, or end of clause | anaphoric exceptee |
| SEL_EN | `which what who whom` | first one per sentence, only if it is the first token of its segment |
| AUX_EN | `am is are was were be been being do does did have has had can could may might must shall should will would`; fused: any token ending in `n't`, and `cannot` | auxiliary paradigm |
| NEG_EN | `not` | after AUX_EN |
| SUBORD_EN | `that when because if whether since although while where who whom which` (after the selector) | blocks the frame |
| EXC_EN | `except` | exception marker |
| SLOT_EN | `one which what who`, or end of clause | anaphoric exceptee |

Numeric constants (product defaults, to be pre-registered and validated, not tuned on observed data): `HE_NP_BUDGET = 2` content tokens for SEL_HE_DET; `HE_NP_BUDGET_PRON = 0`; `HE_RELATIVE_BUDGET = 1` (a ש-prefixed NEG must attach to a single head noun); `EN_WINDOW = 8` tokens after the selector (widened from 5 after review: 5 silently dropped canonical stems such as `Which of the following statements about triangles is NOT true?`).

### 4.3 Algorithm (pseudocode; NOT implemented)

```
frames = []
for each sentence S (token list with boundary info):

  # ---- Frame 1: SELECTOR-NEGATED-PREDICATE ----
  sel = first token of S that is in SEL_HE_* or SEL_EN
        (SEL_EN additionally requires: first token of its segment)
  if sel is Hebrew:
      budget = SEL_HE_DET ? 2 : 0 ; content = 0 ; partitive = false ; deictic = false
      for t in tokens after sel, within the same segment (any boundary -> stop, no frame):
          (prefix, base) = parseNeg(t)            # exact decomposition, prefix in {"", ש, ו, וש}
          if base in NEG_PRED_HE:
              if prefix in {"", ש} and (prefix != ש or content <= HE_RELATIVE_BUDGET): frames.add(SELECTOR_NEGATED_PREDICATE)
              break                               # a coordinated (ו / וש) negation never matches
          if t matches PARTITIVE_HE and not partitive and content == 0: partitive = true; continue
          if t in DEICTIC_HE: continue
          content += 1 ; if content > budget: break
  elif sel is English:
      for i in 1..EN_WINDOW over tokens after sel, within the same segment:
          t = token i
          if t in SUBORD_EN: break
          if t is fused (ends with n't) or t == cannot: frames.add(SELECTOR_NEGATED_PREDICATE); break
          if t in AUX_EN: if next(t) == not: frames.add(...); break      # the FIRST auxiliary decides
  # ---- Frame 2: EXCEPTION-SLOT ----
  for each exception marker m in S:
      exceptee = next token(s) after m (Hebrew: strip the attached מ of חוץ מ-)
      if exceptee in SLOT_* or m is last token of its clause: frames.add(EXCEPTION_SLOT)

emit one STEM_NEGATIVE_WORDING WARNING iff frames is non-empty
metrics.negationTermCount = len(frames)      # key kept; semantics change from "terms" to "frames" (documented)
```

Mechanism-to-ruling map (INFERENCE): coordinated negation (`ו`/`וש` prefix) -> HO4-062, HO4-015, HO4-063, HO3-058, HO-073/item8; the content budget alone blocks HO4-015/063/062 and HO-073/item8 (no positive-predicate token list is used; an earlier draft had a copula-pronoun block that no evidence needed and that cost colloquial stems such as CT-H13); negation not after the selector -> HO4-007, HO4-008; pronoun selector with budget 0 -> HO3-005; paradigm completeness -> HO4-052, HO-063; adjacent negated predicate -> HO4-005, 009, HO-021 and the rest.

### 4.4 Documented blind spots, costs and non-goals

Recall costs (genuine negative selection the frame will not catch; by design, to be measured on v0.5 and reported separately):
1. Imperative selection (`בחרו/סמנו ... שלא`, `Select the answer that does not apply`): no structural selector. Decision H1.
2. A clause boundary inside the frame (`CT-H36`); an NP wider than the budget (`CT-H37`).
3. Prepositional selector fusions (`באיזה`, `מאיזה`), `מהו/מהי` frames, and negation in the options.
4. Adnominal negation (`בלתי`, `ללא`, `בלא`) and scalar/absolute English (`least`, `never`): removed from the term set; decision H2.
5. Only the first selector per sentence is evaluated.
6. English noun phrases longer than `EN_WINDOW = 8` tokens before the auxiliary (CT-E11). Removing the copula block makes colloquial `איזו מהמדינות הבאות היא לא באירופה?` EMIT (CT-H13), which is intended.
7. `מי מהם ...` (the partitive pattern does not match `מהם/מהן`).

Precision costs (stems the frame will emit that a human may call fine):
1. Short embedded English clauses (`CT-E25`).
2. A negated predicate adjacent to a selector that a human reads as a conjunctive proposition when written as an adjacent relative (the `CT-H04` / `CT-H41` boundary is a head-token budget, not a semantic fact); same-structure twins of HO3-005 and HO4-007 with a one-token head (CT-H45, CT-H46).
3. `ש` as a complementizer or free relative (`איזה מהתלמידים אמר שלא למד?`, `מי שאינו מסכים ...`; CT-H42, CT-H44): position cannot tell it from a relative.
4. Frame 2 has no selector requirement: a narrative exception with an anaphoric word (`כולם הגיעו מלבד אחד.`, CT-H47) emits.
5. The partitive pattern treats any `מה`+2-letters token as free (`מהירות`), which only widens the budget by one token.

Non-goals: STEM_DOUBLE_NEGATIVE (stays NOT_IMPLEMENTED); STEM_TOO_SHORT / FUB-075; any change to other rules, thresholds or the term lists of other codes; option-set semantics; a new issue code or INFO signal for "negation present but outside the frame" (a schema/UX decision outside this Run; precedent: the weak-tier absolute terms are silent).

### 4.5 Normalization requirements for the implementation Run

- A NEW exported boundary-aware tokenizer in `text-normalize.ts`. `tokenize()` and `comparisonKey()` stay byte-for-byte compatible (other rules depend on them).
- Boundary detection must run on text folded the same way as `comparisonKey` (curly quotes/dashes/maqaf) so `חוץ מ-X`, `isn’t`, and `ד"ר` behave identically across encodings.
- NEG parsing is an exact `prefix + member` decomposition with `prefix` in `{"", ש, ו, וש}`; it must NOT call `stripHebrewPrefixes`/`containsTerm` default prefix sets (they would let `מלא`, `לאומית` through).
- All inventories go through `norm()` (final-letter fold). The paradigm table in the contract file is generated from the same arrays.

### 4.6 What moves out of deterministic ownership

| Moves to | What | Why |
|---|---|---|
| AI OPTIONAL (detection), HUMAN (severity) | negative selection outside Frame 1/2 (imperative, interrupted, wide NP, adnominal, scalar) | needs syntax or option-set semantics (candidate D) |
| stays HUMAN / AI REQUIRED (unchanged) | whether a negation that governs selection is pedagogically harmful for THIS item | already the semantic critic's job (AE-021) |
| nothing | content/relative/contrast/factual negation | not a defect by human principle |

## 5. D4 - Pre-registered contract matrix

Nothing below was executed against a new implementation. The "current linter" column is a measurement of the unchanged code.

### 5.1 OBSERVED regression contracts (29 rows; regression only, never validation)

| Group | Count | Cases | Design-predicted | Status |
|---|---|---|---|---|
| Human-confirmed defects | 2 | HO4-052, HO-063 | EMIT | HUMAN_APPROVED (post-evaluation) |
| Human-confirmed false positives | 7 | HO3-005, HO3-058, HO4-007, HO4-008, HO4-015, HO4-062, HO4-063 | silent | HUMAN_APPROVED (post-evaluation) |
| Model-labeled/unlabeled negative selections retained | 13 | HO-018, HO-021, HO-022, HO-048, HO-054, HO-078/item2, HO3-072, HO4-005, HO4-006, HO4-009, HO4-051, golden WEAK-NEGATION-HE-01, golden WEAK-NEGATION-EN-01 | EMIT | MODEL_LABELED (no human ruling) |
| Flip candidates awaiting a human ruling | 2 | HO4-012 (embedded English `not`), golden WEAK-NEGATION-HE-PREFIX-01 (imperative + relative) | silent | PENDING_HUMAN (H2, H1) |
| Silent guards | 5 | HO4-064, HO-073/item8, HO-046, golden FP-NEGATION-HE-HUTZ-01, golden FP-NEGATION-EN-LEAST-01 | silent | model/golden |

Paper projection on the observed v0.4 human-adjudicated negation rule (NOT validation; the design was derived knowing these cases): expected 6 -> TP 5 (HO4-005, 006, 009, 051, 052) / FN 1 (HO4-012, pending H2) / FP 0, versus today TP 5 / FN 1 / FP 5.

### 5.2 Legacy synthetic unit-test rows whose fate the design changes (INFERENCE; to be reconciled in the implementation Run)

These rows predate the human principle and encode token-level firing. None carries a human ruling.

| Rows (examples) | Today | Design-predicted | Reason / gate |
|---|---|---|---|
| `בחרו מבנה נתונים שלא משתמש בהשוואות`, `בחרו מבנה שלא נמצא בתא החי בגוף`, `בחרו מבנה ושלא נמצא ...`, `בחרו את החומרים שלא מתמוססים במים?`, golden PREFIX-01 | EMIT | silent | imperative selection leaves deterministic ownership (H1) |
| `איזה מבנה ולא נמצא בתא החי בגוף?`, `איזה מבנה ולא נמצא בתא החי?` | EMIT | silent | `ו` is a coordinator (human principle on contrast/conjunction); the stems are also ungrammatical |
| `איזה חלק בלתי נחוץ בתא החי בגוף?`, `איזה מבנה ללא ממברנה ...`, `איזה מבנה בלא ממברנה ...` | EMIT | silent | adnominal negation removed (H2) |
| `כל המבנים נמצאים בתא חוץ מ-X אחד?`, `כל המבנים נמצאים בתא שחוץ מהמעבדה אין?` | EMIT | silent | named exceptee is content, not a slot (H2) |
| `Which structure is the LEAST likely ...` (3 rows), `Which structure is never stored contiguously in memory?` | EMIT | silent | scalar/absolute not negation (H2) |
| the remaining canonical rows (`Which of these is NOT ...`, `Which of these is correct EXCEPT one?`, `איזה מבנה לא/אינו/אין ...`, `כל המבנים מלבד/חוץ מאחד ...`, `מה אינו נכון?`, ...) | EMIT | EMIT | inside Frame 1 or 2 |

### 5.3 NEW synthetic CONTRACT_TEST rows (73; newly authored; NOT fresh validation)

Categories: EMIT = frame expected; SILENT = no frame expected; PENDING_HUMAN = design predicts SILENT but the stem needs a human gate (genuine negative selection outside the frames, or a semantic twin of a human-CLEAN case); LIMIT_RECALL_COST / LIMIT_PRECISION_COST = documented known imperfection, pinned to the design-predicted behavior and explicitly NOT the desired semantics. "Deterministic ownership justified" = YES for EMIT and SILENT rows (the structural feature decides; CT-H04 sits at a budget boundary, see its rationale), NO for PENDING_HUMAN and LIMIT rows (semantic/human ownership). Evidence class for all: CONTRACT_TEST.

Amendment record: this table was first committed with 65 rows (SHA `4827096d...`). The independent review (Run Slice Z) led to: EN_WINDOW 5 -> 8 with CT-E10 and CT-E11; removal of the unevidenced copula block with CT-H13; CT-H41 moved from SILENT to PENDING_HUMAN (Q5); new LIMIT rows CT-H42, CT-H44, CT-H45, CT-H46, CT-H47; CT-H04 and CT-H33 rationale rewording. No implementation consumed the table before the amendment.

| ID | Lang | Stem | Design-predicted | Structural determinant | Rationale | Current linter (measured) |
|---|---|---|---|---|---|---|
| CT-H01 | HE | `איזה מהגזים הבאים אינו גז אציל?` | EMIT | SEL + partitive + deictic + NEG; nothing between | Canonical negative-selection stem | EMIT |
| CT-H02 | HE | `איזו מהמסקנות הבאות איננה נובעת מהנתונים?` | EMIT | Same frame; NEG is the long-form paradigm member איננה | Paradigm completeness (HO4-052 class, new content) | silent |
| CT-H03a | HE | `איזה מהאיברים הבאים אינו חלק מהמערכת?` | EMIT | Paradigm: אינו (m.sg) | Full-paradigm row | EMIT |
| CT-H03b | HE | `איזו מהמערכות הבאות אינה חלק מהגוף?` | EMIT | Paradigm: אינה (f.sg) | Full-paradigm row | EMIT |
| CT-H03c | HE | `אילו מהאיברים הבאים אינם חלק מהמערכת?` | EMIT | Paradigm: אינם (m.pl) | Full-paradigm row | EMIT |
| CT-H03d | HE | `אילו מהמערכות הבאות אינן חלק מהגוף?` | EMIT | Paradigm: אינן (f.pl) | Full-paradigm row | EMIT |
| CT-H03e | HE | `איזה מהאיברים הבאים איננו חלק מהמערכת?` | EMIT | Paradigm: איננו (m.sg, long form) | Full-paradigm row | silent |
| CT-H03f | HE | `איזו מהמערכות הבאות איננה חלק מהגוף?` | EMIT | Paradigm: איננה (f.sg, long form) | Full-paradigm row | silent |
| CT-H03g | HE | `אילו מהאיברים הבאים איננם חלק מהמערכת?` | EMIT | Paradigm: איננם (m.pl, long form) | Full-paradigm row | silent |
| CT-H03h | HE | `אילו מהמערכות הבאות איננן חלק מהגוף?` | EMIT | Paradigm: איננן (f.pl, long form) | Full-paradigm row | silent |
| CT-H04 | HE | `איזה יסוד שאינו מתכת נמצא בטבלה המחזורית?` | EMIT | SEL + 1 head noun + ש-relative NEG (relative attaches to the selected head) | Relative negation attached to the single head noun right after the selector (budget boundary with CT-H40/H41/H45/H46, see LIMIT rows) | EMIT |
| CT-H05 | HE | `איזה בעל חיים לא חי במים?` | EMIT | SEL + 2-token NP (budget edge) + bare לא | NP budget upper edge; verbal negation of the selected entity | EMIT |
| CT-H06 | HE | `מה אינו נכון לגבי תאים?` | EMIT | SEL=מה, budget 0, NEG immediately | Pronominal selector | EMIT |
| CT-H07 | HE | `מי מהבאים אינו יונק?` | EMIT | SEL=מי + partitive + NEG | Pronominal selector with partitive | EMIT |
| CT-H07b | HE | `מי מהבאים שלא נחשב לגז אציל?` | EMIT | SEL=מי + partitive + ש-NEG (relative, 0 content tokens) | Run 008 cue-list failure shape handled structurally | silent |
| CT-H08 | HE | `אילו מהמדינות הבאות אינן חברות באיחוד האירופי?` | EMIT | SEL + partitive + deictic + אינן | Plural feminine | EMIT |
| CT-H09 | HE | `לפניך רשימת גורמים להתחממות כדור הארץ. איזה מהגורמים הבאים אינו גורם לה?` | EMIT | Frame evaluated per sentence; earlier sentence neutral | Multi-sentence stem; frame in final sentence | EMIT |
| CT-H10 | HE | `איזו מהמסקנות הבאות אינה בלתי הגיונית?` | EMIT | First NEG after SEL satisfies the frame; the second negation does not matter | Double negative: STEM_NEGATIVE_WORDING fires; STEM_DOUBLE_NEGATIVE stays NOT_IMPLEMENTED | EMIT |
| CT-H11 | HE | `כל הערים הבאות נמצאות בישראל חוץ מאחת. איזו?` | EMIT | Exception marker חוץ מ- + slot אחת (anaphoric exceptee) | Exception frame: the exceptee is the answer | EMIT |
| CT-H12 | HE | `כל היסודות הבאים הם מתכות מלבד אחד. איזה?` | EMIT | Exception marker מלבד + slot אחד | Exception frame | EMIT |
| CT-H32a | HE | `איזה מבנה שלא נמצא בתא החי?` | EMIT | SEL + 1 head noun + ש-NEG | Relative שלא adjacent to the selected head | EMIT |
| CT-H38 | HE | `איזו תופעה אינה מתרחשת בלילה?` | EMIT | SEL + 1 head noun + NEG | Verbal-predicate negation of the selected entity | EMIT |
| CT-H13 | HE | `איזו מהמדינות הבאות היא לא באירופה?` | EMIT | SEL + partitive + deictic + one content token (colloquial copula היא) + bare לא | Colloquial negative selection; shows the cost of the removed copula block | EMIT |
| CT-E10 | EN | `Which of the following statements about triangles is NOT true?` | EMIT | First AUX at token 7 after the selector, inside EN_WINDOW = 8 | Canonical long noun phrase (window edge, inside) | EMIT |
| CT-E01 | EN | `Which of the following is NOT a renewable energy source?` | EMIT | Sentence-initial SEL; first AUX within window followed by NOT | Canonical | EMIT |
| CT-E02 | EN | `Which planet does not have a moon?` | EMIT | SEL; AUX does + not | do-support negation | EMIT |
| CT-E03 | EN | `What is NOT a function of the liver?` | EMIT | SEL what; AUX is + NOT | what-selector | EMIT |
| CT-E04 | EN | `Which of these isn't a mammal?` | EMIT | Fused AUX+n't token inside window | Contraction (paradigm) | silent |
| CT-E05 | EN | `Which statements are not true?` | EMIT | SEL; AUX are + not | Plural | EMIT |
| CT-E06 | EN | `Which of the following cannot be a prime number?` | EMIT | Fused cannot inside window | Modal negation (paradigm) | silent |
| CT-E07 | EN | `All of the following are noble gases EXCEPT which one?` | EMIT | Exception marker + slot which | Exception frame, explicit slot | EMIT |
| CT-E08 | EN | `All of the following are noble gases EXCEPT:` | EMIT | Exception marker at end of segment (implicit slot = the options) | Classic exception stem | EMIT |
| CT-E09 | EN | `Not all birds can fly. Which bird can't?` | EMIT | Earlier sentence ignored; SEL sentence has fused can't | Sentence segmentation: negation in an earlier sentence is not the frame | EMIT |
| CT-H20 | HE | `ויטמין שאינו מסיס בשומן נמצא בכמות גבוהה באיזה מזון?` | SILENT | NEG precedes the selector (and באיזה is not an exact SEL token) | HO4-007 shape without commas (removes punctuation dependence) | EMIT |
| CT-H21 | HE | `איזה כלי הוא כלי מיתר ולא כלי נשיפה?` | SILENT | COPULA pronoun between SEL and NEG; ו-coordination | Contrast conjunct (HO4-015/063 class) | EMIT |
| CT-H22 | HE | `איזה חומר הוא יסוד, ולא תרכובת?` | SILENT | Copula + clause boundary + ו-coordination | Contrast with comma | EMIT |
| CT-H23 | HE | `איזה בעל חיים חי ביבשה ואינו יונק?` | SILENT | Third content token before NEG; ו-coordination | HO4-062 class | EMIT |
| CT-H24 | HE | `מה קורה לגוף שלא פועל עליו כוח?` | SILENT | SEL=מה budget 0; content token before NEG | HO3-005 class | silent |
| CT-H25 | HE | `מה קרה למים שלא הוסיפו להם מלח?` | SILENT | SEL=מה budget 0 | HO3-005 class | silent |
| CT-H26 | HE | `בניסוי נמדדת טמפרטורת מים בזמן חימום. הטמפרטורה אינה משתנה בזמן הרתיחה. מהי הסיבה לכך?` | SILENT | NEG in a sentence without SEL | Factual negation inside a vignette (HO4-008 class) | EMIT |
| CT-H27 | HE | `איזה מהמקרים הבאים מתאר מצב שבו הגוף אינו מקבל חמצן?` | SILENT | Content budget exceeded before NEG | Positive question containing a negative fact | EMIT |
| CT-H28 | HE | `בחרו את הטענה הנכונה ביותר.` | SILENT | No negation | Selection cue without negation (control) | silent |
| CT-H29 | HE | `החומר אינו מוליך חשמל. הסבירו מדוע.` | SILENT | No SEL | Negation without an interrogative/selection frame | EMIT |
| CT-H32b | HE | `איזה מבנה ושלא נמצא בתא החי?` | SILENT | Prefix וש = coordination | Prefix-form pair with CT-H32a | EMIT |
| CT-H33 | HE | `איזה אדם אמר שהמים לא רותחים?` | SILENT | Content budget exceeded before NEG | Content-budget block; this row does NOT exercise the ש path (see CT-H42) | EMIT |
| CT-H34a | HE | `איזו תנועה לאומית החלה במאה התשע עשרה?` | SILENT | לאומית is not a NEG token (whole-token paradigm only) | Morphological lookalike | silent |
| CT-H34b | HE | `איזה מבנה מלא נוזל נמצא בתא?` | SILENT | מלא is not a NEG token | Morphological lookalike | silent |
| CT-H35 | HE | `איזה איבר מזרים דם? הוא אינו שריר רגיל.` | SILENT | NEG is in a different sentence from SEL | Sentence boundary | EMIT |
| CT-H39 | HE | `כל הערים הבאות נמצאות בישראל חוץ מתל אביב.` | SILENT | Exception marker followed by a NAMED exceptee, not a slot | Content exception | EMIT |
| CT-H40 | HE | `איזה מהמקרים הבאים מתאר גוף שאינו מקבל חמצן?` | SILENT | ש-relative allowed only with <= 1 content token; here 2 | Relative attaches to a non-selected NP | EMIT |
| CT-H41 | HE | `איזה בעל חיים שאינו דג חי במים?` | PENDING_HUMAN_H2 | ש-relative with a 2-token head exceeds the relative budget | Semantic twin of human-CLEAN HO4-062; design predicts SILENT only because of the relative budget (Q5); semantic ownership | EMIT |
| CT-E20 | EN | `A body that is not acted on by any force will do what?` | SILENT | NEG precedes the selector | Relative negation on the given entity | EMIT |
| CT-E21 | EN | `Which HTTP status code is returned when a page is not found?` | SILENT | First AUX after SEL is not followed by NOT; subordinator when | Embedded content negation | EMIT |
| CT-E23 | EN | `Which gas, which is not flammable, is used to fill balloons?` | SILENT | Only the first SEL of a sentence is evaluated; boundary after the first segment | Relative which vs interrogative which | EMIT |
| CT-E24 | EN | `Which country has the largest population, except China?` | SILENT | Exception marker followed by a NAMED exceptee | Content exception | EMIT |
| CT-E26 | EN | `Which metal is liquid at room temperature and does not corrode easily?` | SILENT | First AUX (is) is not followed by NOT | Coordinated negated predicate (HO4-062 class in English) | EMIT |
| CT-E27 | EN | `Which statement is correct?` | SILENT | No negation | Positive question control | silent |
| CT-E31 | EN | `Which notable scientist discovered penicillin?` | SILENT | notable is not a NEG token | Lookalike control (existing guard class) | silent |
| CT-E32 | EN | `Describe why a metal that is not magnetic can still conduct electricity.` | SILENT | No SEL, no frame | Negation without an interrogative frame | EMIT |
| CT-H30 | HE | `בחרו את החיה שלא חיה במים.` | PENDING_HUMAN_H1 | Imperative-selection frame is not structurally recognized (no SEL) | Genuine negative selection; design predicts SILENT, needs recall-loss acceptance | EMIT |
| CT-H31 | HE | `סמנו את כל המשפטים שאינם נכונים.` | PENDING_HUMAN_H1 | Imperative-selection frame is not structurally recognized | Genuine negative selection; design predicts SILENT | EMIT |
| CT-E28 | EN | `Select the answer that does not apply.` | PENDING_HUMAN_H1 | Imperative-selection frame not recognized | Genuine negative selection; design predicts SILENT | EMIT |
| CT-E29 | EN | `Which of the following is the LEAST likely cause of the failure?` | PENDING_HUMAN_H2 | least is a scalar minimum, not a negation token; excluded from Phase 1 | Design predicts SILENT; no human evidence either way | EMIT |
| CT-E30 | EN | `Which structure is never stored contiguously in memory?` | PENDING_HUMAN_H2 | never is an absolute adverb, not predicate negation; excluded | Design predicts SILENT; overlaps the ABSOLUTE_TERM concept | EMIT |
| CT-H36 | HE | `איזה מהמבנים הבאים, בניגוד לאחרים, אינו אברון?` | LIMIT_RECALL_COST | Parenthetical clause boundary inside the frame blocks it | Genuine negative selection; design predicts SILENT (accepted recall cost) | EMIT |
| CT-H37 | HE | `איזה בעל חיים קטן אינו יונק?` | LIMIT_RECALL_COST | Three content tokens exceed the NP budget (2) | Genuine negative selection; design predicts SILENT (budget edge, accepted recall cost) | EMIT |
| CT-E11 | EN | `Which of the following statements about the French Revolution is NOT correct?` | LIMIT_RECALL_COST | First AUX is the 9th token after the selector, outside EN_WINDOW = 8 | Genuine negative selection; design predicts SILENT (window edge, outside) | EMIT |
| CT-H42 | HE | `איזה מהתלמידים אמר שלא למד?` | LIMIT_PRECISION_COST | ש is a complementizer here, but position (1 content token) cannot tell it from a relative | Reported-clause negation; design predicts EMIT | EMIT |
| CT-H44 | HE | `מי שאינו מסכים עם הטענה צריך לבחור באיזה מהמשפטים?` | LIMIT_PRECISION_COST | מי + relative שאינו at budget 0 | Free relative (whoever), not a question about who is negated; design predicts EMIT | EMIT |
| CT-H45 | HE | `איזה גוף שלא פועל עליו כוח ימשיך לנוע?` | LIMIT_PRECISION_COST | SEL + 1 head noun + ש-NEG (the HO3-005 shape with איזה) | Relative negation on the GIVEN entity; design predicts EMIT | EMIT |
| CT-H46 | HE | `איזה ויטמין שאינו מסיס בשומן נמצא בתפוז?` | LIMIT_PRECISION_COST | SEL + 1 head noun + ש-NEG (the HO4-007 shape with one-token head, no commas) | Descriptive relative on the given entity; design predicts EMIT | EMIT |
| CT-H47 | HE | `כולם הגיעו לשיעור מלבד אחד. מה גרם לכך?` | LIMIT_PRECISION_COST | Frame 2 has no selector requirement: narrative מלבד אחד | Content exception with an anaphoric word; design predicts EMIT | EMIT |
| CT-E25 | EN | `Which code means it was not found?` | LIMIT_PRECISION_COST | No lexical-verb detection: AUX was is inside the window and followed by not | Content negation; design predicts EMIT (known precision cost) | EMIT |

### 5.4 Contract matrix summary

| Category | Count | Deterministic ownership justified |
|---|---|---|
| EMIT (HE 23, EN 10) | 33 | yes |
| SILENT (HE 17, EN 8) | 25 | yes |
| PENDING_HUMAN (H1: 3, H2: 3) | 6 | no: semantic/human gate |
| LIMIT (3 recall cost, 6 precision cost) | 9 | no: documented imperfection |
| **NEW CONTRACT_TEST rows** | **73** | |
| OBSERVED regression rows (5.1) | 29 | per row |

The unchanged linter disagrees with the design prediction on 26 of the 58 EMIT/SILENT rows: 8 rows it misses (the `איננ*` paradigm, `מי מהבאים שלא`, `isn't`, `cannot`) and 18 rows it emits (every coordinated, relative-on-given, embedded, late or non-question negation). `CONTRACT_TABLE_SHA256` over the table in 5.3, exactly as printed (header and rows, LF line endings, trailing newline): `a16641cfe15f5c17d370ce61863c439968e80f31311b4c901124a768924ef901`.

Pairs that carry the adversarial weight: H01/H20 (same token, selection vs factual); H32a/H32b (`שלא` vs `ושלא`); H04/H41/H40 (relative budget); H05/H37 (NP budget edge); H03a-h (full paradigm); H22/H21 vs HO3-058 (contrast vs exception, comma and no comma); E01/E10/E11/E21/E22/E26 (English `not` in the frame, at the window edge inside and outside, embedded, far, coordinated); H45/H46 vs HO3-005/HO4-007 (same structure, one-token head); H42/H44 (complementizer and free relative `ש`); E23 (relative `which`); H11/H39 and E07/E24 (anaphoric vs named exceptee); H09/H35/E09 (sentence boundaries); H27/H33 (positive question that contains a negative fact / reported clause); H28 (selection cue without negation); H29/E32 (negation without a frame).

## 6. Implementation handoff (for a LATER Run; this Run does not start it)

Preconditions: human decisions H1-H3 recorded; baseline verified by separate git commands; Plan names the Run.

Order (pre-registration discipline, as in Run 008):
1. **PRE_REGISTERED_TEST commit**: convert 5.1 and 5.3 mechanically into `src/domain/assessment/golden/stem-negation-contract-v0-1.json` (ids, stems, predicted outcome, category) and record `CONTRACT_TABLE_SHA256`; add the contract test file; rows that disagree with today's linter are RED before any code is written. No expectation may be edited after this commit without a recorded reason.
2. Boundary-aware tokenizer in `text-normalize.ts` plus its own unit tests (decimals, `ד"ר`, curly apostrophes, `חוץ מ-X`, `?`/`.`/`:` handling).
3. Replace the negation block in `question-lint.ts` (term sets at lines 140-198 and the emission at 553-558) with the frame matcher of 4.3. Delete `SELECTION_CUES`, `CONTRAST_NEXT`, `hasNegativeLeast`, `hasHutzException`-as-term (folded into Frame 2). No other rule changes.
4. Reconcile legacy rows per 5.2 and the H1/H2 rulings. Every changed count in the regression suites must be explained in the Run report: `golden-calibration.test.ts` (STEM_NEGATIVE_WORDING row), `heldout-eval.test.ts`, `heldout-v0-3-eval.test.ts`, `heldout-v0-3-human-adjudication.test.ts`, `heldout-v0-4-eval.test.ts`, `heldout-v0-4-human-adjudication.test.ts`, `ae008-contracts.test.ts`, `question-lint.test.ts` (B4, B2 and earlier negation rows). Frozen corpora, labels, overlays and freeze hashes stay untouched.
5. Verification per `.claude/rules/testing.md`: contract tests, the full assessment suite, typecheck, eslint; independent review (general; the change is behavioral, not security or DB).
6. Docs: `ASSESSMENT_ENGINE.md` 10.3 row, FUB-076, `DEV_STATUS`, Run report. State the evidence class as CONTRACT_TEST + REGRESSION, never validation.

Expected files to change in that Run: `src/domain/assessment/question-lint.ts`, `src/domain/assessment/text-normalize.ts`, the new contract JSON and test, the eight test files above, and the docs listed. Not expected to change: any API, UI, schema, dependency, or other lint rule.

## 7. Evidence sequence and the fresh-validation requirement

`IMPLEMENTATION RUN` (CONTRACT_TEST + REGRESSION) -> `NEW FRESH HELD-OUT v0.5` (authored AFTER the implementation is frozen, blind-labeled, excluded from every case in this document) -> human adjudication only after the first v0.5 evaluation, and only for rows a human must judge.

Proposed v0.5 pre-registration (requires Dor's approval, H3; these are product thresholds, not facts):
- Composition: at least 23 CLEAN negation-bearing stems (>= 15 Hebrew, >= 8 English) covering relative, contrast, factual, late, embedded, coordinated, `שאינו/ואינו/ושלא/וש-` forms and the `איננ*` paradigm in non-selecting use; at least 16 genuine negative-selection stems (>= 8 Hebrew, >= 8 English) of which at least 8 sit OUTSIDE the frame (imperative, comma-interrupted, NP budget + 1, adnominal) to measure the accepted recall cost; at least 4 exception stems per language; NP-budget boundary stems at N, N+1 and relative-budget 1, 2.
- Contamination: every v0.5 stem checked against all OBSERVED and CONTRACT rows; same-concept overlaps removed pre-freeze.
- Success (proposed): at most 1 CLEAN negation stem warned out of at least 23. With 23 CLEAN stems this allowance cannot bound the false-positive rate tightly (one warning in 23 is a 95 percent upper bound near 20 percent); v0.5 is a gate against gross failure, not a precision estimate, and the report must say so. The in-frame genuine detection criterion (every paradigm form detected) is true by construction and is a regression check, not evidence; the informative measures are the CLEAN-warned count and the outside-frame miss count.
- Fallback trigger (proposed): 3 or more CLEAN negation stems warned out of 23 means Candidate C is rejected and Candidate E (demote to semantic ownership, remove the warning from deterministic output) is designed next. Exactly 2 warned is INCONCLUSIVE: extend the CLEAN negation set to at least 46 fresh stems before deciding; do not tune on the 2.
- Authorship and blindness (required): v0.5 stems must be authored and labeled by an author or process that has NOT read section 5 of this document or the contract file (the design leaks through the matrix), in the same way earlier held-out batches were separated by instruction; the report must state the separation honestly as instruction-based unless enforced.
- The v0.5 composition must include English window-edge stems (8 and 9 tokens before the auxiliary), one-token-head relatives, `ש` complementizers and Frame 2 narrative exceptions, because the observed data do not constrain the budgets.

No claim of validation is possible before v0.5.

## 8. Human decisions

Required before the implementation Run (none is required to close this Run):

- **H1 - Imperative-selection recall loss.** Accept that stems such as `בחרו את החיה שלא חיה במים` and `Select the answer that does not apply` stop warning (CT-H30, CT-H31, CT-E28; golden PREFIX-01; four legacy rows). Recommended: accept. Alternative (not recommended): a minimal imperative frame, which reintroduces a verb list and the Run 008 treadmill.
- **H2 - Rulings on unreviewed shapes the design flips.** The design needs your view, not an assumed ruling: (Q1) HO4-012 `... means that the requested page was not found?`: negative-stem flaw or ordinary content? (Q2) `Which structure is never stored contiguously ...?` (CT-E30): negative wording or the absolute-term concept? (Q3) `... the LEAST likely ...` (CT-E29): keep deterministic as scalar-minimum selection, or semantic? (Q4) adnominal negation as the selection restrictor: `איזה חלק בלתי נחוץ ...`, `איזה מבנה ללא ממברנה ...`. (Q5) `איזה בעל חיים שאינו דג חי במים?` (CT-H41): same as HO4-062 (fine)? (Q6) `איזה בעל חיים קטן אינו יונק?` (CT-H37): do you want it caught (would imply a larger NP budget)? Q1-Q5 are needed (Q5 because CT-H41 is a semantic twin of HO4-062 and the design's silence there is only a budget); Q6 is optional.
- **H3 - v0.5 acceptance and fallback.** Approve or amend the success and fallback criteria in section 7.

## 9. Canonical placement

- `docs/ASSESSMENT_ENGINE.md`: one AI Necessity Matrix row for negative-selection stems (frame: CODE+HEURISTIC; remainder AI OPTIONAL / HUMAN) and a DESIGNED-not-implemented pointer on the 10.3 `STEM_NEGATIVE_WORDING` row. The 10.3 row's current-behavior text is left true to the code.
- `docs/FOLLOW_UP_BACKLOG.md` FUB-076: status and the pointer to this document. No new FUB (the work is FUB-076). FUB-074/075/059/067 are unaffected; the one cross-reference is that the design leaves FUB-075 and the ABSOLUTE_TERM concept (`never`) untouched.
- No ADR: this is an implementation-heuristic boundary inside the unwired prototype linter, not a product or architecture decision of the ADR kind; the durable owner is the Assessment Engine doc.

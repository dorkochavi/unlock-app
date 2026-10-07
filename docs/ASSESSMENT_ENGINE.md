# UNLOCK — Assessment Engine: Canonical Direction

Status: ACTIVE DESIGN DIRECTION
Owner: Assessment Engine product + architecture direction

This document is the canonical home for the Assessment Engine direction. Other documents (Plan, `DEV_STATUS`, capability map, backlog, ADRs, Run Reports) should link here rather than restate it.

## Label legend

Every non-trivial statement carries (or sits under a heading that carries) one of these labels.

| Label | Meaning |
|---|---|
| **CURRENT REALITY** | True of the committed repository at HEAD `882dc5b` (code, migrations, tests, accepted docs). |
| **RUN OUTPUT** | Produced by Run `2026-10-08-ASSESSMENT-ENGINE-NIGHT-001` (documents, and any artifact the Run lists in Section 29). Not product behavior. |
| **FUTURE DESIGN** | A proposed design. Not built. Nothing under this label may be read as implemented. |
| **SPECULATION / OPEN QUESTION** | Unresolved; may be wrong; needs research or a human decision. |

Research claims carry a second tag: **SUPPORTED BY RESEARCH** (with the verification level of the source: `seen` = bibliographic record or search summary only; `memory` = unverified recall; nothing in this Run was verified against full text), **PRODUCT DESIGN DECISION** (our choice, not evidence), or **OPEN QUESTION**.

## How to read

- Sections 1-3 are intent and principles. 4-11 are the analytical core (what code can do vs what AI/humans must do, and the concrete lint checks). 12-19 are the knowledge/blueprint/provenance/pipeline/evaluation design. 20-30 are written in later Slices of this Run.
- If you only need the lint rules: Sections 10 and 11. If you only need "do we need AI for X": Section 4.
- Nothing here changes the Learning Engine, FSRS/scheduler, mastery, or misconception-to-mastery inference. No AI provider, SDK, or model is chosen.

---

## 1. Vision

**FUTURE DESIGN.** Instructors should be able to turn course source material into a reviewed, well-covered, traceable set of draft questions with far less manual effort, without lowering quality and without any AI path that bypasses human approval.

This is explicitly not "send a document to an LLM and ask for 20 questions". The target pipeline:

```
Source Material -> extraction -> normalized document -> knowledge map
 -> learning objectives -> assessment blueprint -> question candidates
 -> answers + distractors -> deterministic lint
 -> semantic critique (only where needed) -> repair / regeneration
 -> instructor review -> existing authoring lifecycle -> publication
 -> real student performance evidence -> future quality feedback
```

Eventually the system should "understand": what is worth learning; which objective an item assesses; the intended cognitive level; the intended difficulty; the source evidence; why the correct answer is correct; why each distractor is wrong; which misconception each distractor may represent; coverage of the material; set-level bias and redundancy; and generated-versus-observed difficulty.

**CURRENT REALITY.** None of the pipeline exists. What exists is a structured text import (JSON/CSV) of already-written questions into DRAFT, a content validator, and the authoring/publish lifecycle (Section 3.1 and Section 20 in a later Slice).

## 2. Product principles

**PRODUCT DESIGN DECISION** unless noted.

1. **Deterministic by default; semantic AI only where necessary; human authority at publication.** "AI spends intelligence, not bookkeeping."
2. **AI proposes. Code validates what code can validate. Semantic AI is an escalation layer. The instructor approves. Existing authoring publishes.**
3. **No parallel AI-only publication path.** (Consistent with MASTER_SPEC; **CURRENT REALITY** as accepted intent.) Engine output ends as DRAFT proposals; it never creates a published `question_versions` row.
4. **Learning Engine independence.** The Assessment Engine does not alter FSRS-family scheduling, mastery, NBA, DailyPlan, or Today ranking. Misconception metadata is NOT fed into mastery now (a possible far-future capability only, Section 8).
5. **Advisory, explainable checks.** Findings are codes with a human-readable rule, not an opaque score. Instructors can override warnings; only structural ERRORs block.
6. **Content-blind diagnostics.** Issue codes and logs never embed question text (matches the existing `ImportIssue` convention and the content-IP threat model posture).
7. **Hebrew-first.** Design must work for Hebrew (RTL, niqqud optional, final letters, attached prefixes, mixed numerals/Latin) and for bilingual content; English-only assumptions are bugs.
8. **Honest evidence.** Thresholds are product defaults unless a source says otherwise; research is cited only at its true verification level.
9. **Cost discipline.** Compute once, cache, run in background where possible; use the cheapest sufficient mechanism (Section 25, later Slice).

## 3. Deterministic-first principle

### 3.1 Why (**PRODUCT DESIGN DECISION**)

- Deterministic checks are free, instant, reproducible, testable, and explainable to an instructor. They also give a stable regression baseline when prompts/models change.
- LLM output varies run to run and across versions; using it for bookkeeping (counting correct answers, comparing strings, tallying key positions) is both costly and less reliable than code.
- Several known generator weaknesses are mechanically detectable (Section 9), so AI critique is not needed to catch them. SUPPORTED BY RESEARCH (`seen`, secondary/preprint): Bialik & Cummings 2025 (QuestionWell preprint; authors have a commercial interest) report LLMs repeatedly produce longest-answer-correct and all-of-the-above items despite prompting. Treat as indicative, not established.

### 3.2 Rules

1. Every check that a small pure function can do is code, not AI.
2. Where a check is a heuristic with false positives, it is a WARNING, never an ERROR.
3. Semantic AI is invoked only for items/sets whose residual risk (after deterministic lint) is MEDIUM/HIGH (Section 17, later Slice).
4. Position of the correct answer is assigned/shuffled by code, never chosen by a model (design candidate from research analysis; **FUTURE DESIGN**).
5. A deterministic result is computed once per content hash and cached; it is invalidated only by content change.

### 3.3 CURRENT REALITY anchors

- `src/domain/import/types.ts`: `CanonicalQuestionRow {sourceRowNumber, topicName, questionType, prompt, answerOptions:{id,content}[], correctOptionIds, explanation|null}` and `validateCanonicalQuestionRowContent`.
- `PILOT_CONTENT_VALIDATOR` (`src/application/import/validate-import-source.ts`, `scripts/validate-import.mjs`): codes with severity ERROR/WARNING, content-blind, includes a `DUPLICATE_PROMPT` warning.
- `assertQuestionPublishReady` (`src/domain/question/types.ts`): the single strict structural publish gate. `QUESTION_TYPES = SINGLE_CHOICE | MULTIPLE_CHOICE`.
- Pedagogical checks (position bias, length, distinctiveness, distractor plausibility, option-count distribution, templated/duplicate detection) are deferred as FUB-035 in `docs/FOLLOW_UP_BACKLOG.md`. **CURRENT REALITY: none of them exist.**

## 4. AI Necessity Matrix

**FUTURE DESIGN** classification (analysis, not implemented). Levels: CODE; CODE+HEURISTIC (code with tunable thresholds, false positives possible); AI OPTIONAL (AI improves recall but code gives a baseline); AI REQUIRED (no adequate non-semantic method); HUMAN REQUIRED (judgment/authority that must not be delegated).

| Operation | Level | Reasoning |
|---|---|---|
| Schema validation | CODE | Types, required fields, id format; already exists (publish gate, import validator). |
| Correct-answer count | CODE | Count vs question type; trivial. |
| Blank option | CODE | Trim and test empty. |
| Exact duplicate (options/stems) | CODE | String equality. |
| Normalized duplicate | CODE | Equality after a documented normalization (Section 10.2). |
| Answer-length bias (item) | CODE+HEURISTIC | Measurement is exact; "too long" threshold is a product default. |
| Correct-position distribution (set) | CODE | Counting. Better: code assigns positions. |
| Provenance presence | CODE | Field present; needs metadata that does not exist today. |
| Topic coverage | CODE+HEURISTIC | Counting per topic is exact; "adequate" depends on blueprint weights. Needs topic/objective metadata. |
| Cognitive-level distribution | CODE+HEURISTIC | Counting is code; assigning the level per item is AI OPTIONAL / HUMAN (see below). |
| Difficulty distribution | CODE+HEURISTIC | Same: counting is code; labels are intended, not measured. |
| Absolute words ("always", "never") | CODE+HEURISTIC | Word list; Hebrew prefix/morphology caveats (Section 10.2). |
| Lexical clueing (stem-key overlap) | CODE+HEURISTIC | Token overlap; heuristic, language caveats. |
| Text overlap between options | CODE+HEURISTIC | Token/char similarity; threshold default. |
| Near-duplicate wording | CODE+HEURISTIC | Token-set similarity; threshold default. |
| Semantic duplicate | AI OPTIONAL | Embedding/LLM catches paraphrase; code baseline catches only surface similarity. |
| Ambiguity (multiple defensible answers) | AI REQUIRED (+ HUMAN) | Needs domain understanding. Code cannot detect it; instructor is the final judge. |
| Distractor plausibility | AI REQUIRED (+ HUMAN) | Requires knowing what a plausible wrong answer is in the domain. Observed data later (selection rates) is the empirical check (Section 23). |
| Misconception quality | AI REQUIRED (+ HUMAN) | Whether a distractor reflects a real misconception is a domain claim. |
| Source-grounded correctness | AI REQUIRED (+ HUMAN) | Requires reading source and judging support/contradiction. Verbatim-span presence is CODE, entailment is not. |
| LO alignment | AI OPTIONAL / HUMAN REQUIRED | AI can propose alignment; the instructor owns the objective. |
| Publication approval | HUMAN REQUIRED | Invariant. No automated approval. |

Rule of thumb (**PRODUCT DESIGN DECISION**): the only operations needing AI are those requiring understanding of domain meaning; the only operations requiring a human are authority/judgment ones. Everything else is code.

## 5. Question Anatomy

**FUTURE DESIGN** field inventory. "CORE NOW" = needed to make the first deterministic linter and a reviewable draft useful; "USEFUL LATER" = valuable once the pipeline/feedback loop exists; "NOT YET JUSTIFIED" = do not add until a concrete consumer exists. **CURRENT REALITY column** states what the repo has today.

| Field | Tier | Current reality | Note |
|---|---|---|---|
| sourceDocumentId | USEFUL LATER | none | Needs the ingestion layer (Section 20). |
| source span / page / section | USEFUL LATER | none | Do not over-promise page precision (Section 15). |
| topic | CORE NOW | `topicName` on `CanonicalQuestionRow`, resolved by `resolveTopicByName` | Already present. |
| knowledge unit | USEFUL LATER | none | Knowledge Map node (Section 12). |
| learning objective (LO) | CORE NOW (optional field) | none | Needed for LO coverage lint; instructor-owned. |
| intended cognitive level | CORE NOW (optional field) | none | Section 6. |
| intended difficulty | CORE NOW (optional field) | none | Section 7; intended, not observed. |
| question type | CORE NOW | `questionType` (SINGLE_CHOICE/MULTIPLE_CHOICE) | Pedagogical type (Section 6) is separate from structural type. |
| stem | CORE NOW | `prompt` | |
| correct answers | CORE NOW | `correctOptionIds` | |
| distractors | CORE NOW | non-correct `answerOptions` | |
| distractor rationale | USEFUL LATER | none | Section 8; high value for review, low cost if generated with the item. |
| misconception category | USEFUL LATER | none | Section 8; NOT fed to mastery. |
| correct-answer rationale | CORE NOW | partially: `explanation` | |
| explanation | CORE NOW | `explanation|null` | |
| source provenance | USEFUL LATER | none | Section 15. |
| generator provenance (model/process) | USEFUL LATER | none | Needed only once a generator exists. |
| generation version (prompt/pipeline) | USEFUL LATER | none | For reproducibility and A/B. |
| confidence | NOT YET JUSTIFIED | none | Model self-confidence is poorly calibrated (SPECULATION/OPEN QUESTION); prefer lint + critic findings. |
| quality warnings | CORE NOW | none persisted | Output of linter; advisory. |
| lint result | CORE NOW | none persisted | Derived; recompute by content hash rather than store as truth. |
| semantic critique result | USEFUL LATER | none | Only when escalated. |
| instructor review state | CORE NOW (for engine proposals) | draft/publish lifecycle exists for questions | Proposal batch needs approve/edit/reject state (Section 22). |
| observed difficulty | USEFUL LATER (feedback loop) | none | Derived from Attempts; never stored on the QuestionVersion. |
| observed distractor effectiveness | USEFUL LATER (feedback loop) | none | Derived; Section 23. |

Constraint (**CURRENT REALITY**): QuestionVersions and Attempts are immutable. New engine metadata must not mutate historical evidence; derived metrics are computed from Attempts, not written into versions.

## 6. Question Type Taxonomy

**FUTURE DESIGN / PRODUCT DESIGN DECISION.** Pedagogical item types (what the item asks the learner to do). These are distinct from the structural `QUESTION_TYPES` (single/multiple choice). Cognitive-level mapping uses a revised-Bloom-style six levels as a working vocabulary. SUPPORTED BY RESEARCH (`memory`, unverified): Anderson & Krathwohl 2001. Which taxonomy to adopt is an OPEN QUESTION (SOLO and Webb DOK are alternatives, `memory`).

| Type | What it asks | Typical cognitive level (primary; range) |
|---|---|---|
| Recall | Retrieve a stated fact/term | Remember |
| Definition | Select/produce the definition of a term | Remember (-> Understand) |
| Concept recognition | Identify which concept a description/example illustrates | Understand |
| Discrimination | Tell two confusable concepts apart | Understand (-> Analyze) |
| Comparison | Similarities/differences between items | Understand / Analyze |
| Cause/effect | What results from / produces what | Understand / Analyze |
| Sequence/process | Order or next step of a process | Understand / Apply |
| Application | Use a rule/concept in a given situation | Apply |
| Scenario/case | Reason about a described realistic case | Apply / Analyze |
| Calculation | Compute with given values | Apply |
| Error identification | Find the mistake in a statement/solution | Analyze / Evaluate |
| Best explanation | Choose the most defensible explanation | Evaluate |
| Multi-step reasoning | Chain several inferences | Analyze / Evaluate |
| Transfer | Apply understanding to an unfamiliar context | Apply -> Create-adjacent |

### 6.1 Difficulty is not cognitive level

**PRODUCT DESIGN DECISION.** Cognitive level describes the kind of mental operation; difficulty describes how hard a particular item is for a particular population. They are independent axes:

- A Remember item can be hard (obscure detail, close distractors, poor wording).
- An Apply item can be easy (a single, well-practiced step).
- Therefore easy/medium/hard must never be mapped to remember/understand/apply, and the two are separate fields (Section 5). A lint check that treats a low-level item as "easy" is wrong by design.

## 7. Difficulty Model v0.1

**FUTURE DESIGN; v0.1 is a feature inventory, not a predictor.** Pre-data difficulty prediction is an OPEN QUESTION in the literature (SUPPORTED BY RESEARCH, `seen` summary: Kurdi et al. 2020, IJAIED 30(1), report weak difficulty control in generated questions; not verified against full text).

### 7.1 Two different things

| | Intended difficulty | Observed difficulty |
|---|---|---|
| Source | Generator/instructor estimate before use | Computed from real learner Attempts |
| Status | A hypothesis, label e.g. EASY/MEDIUM/HARD | Evidence (needs enough responses) |
| Stored as | Proposal/draft metadata | Derived metric, never rewritten into history |
| Coupled to FSRS? | No | No. Separate from any scheduler difficulty parameter; reading Attempts is allowed, writing to the Learning Engine is not. |

### 7.2 Candidate features

| Feature | How computed | Method |
|---|---|---|
| Number of concepts involved | Count of knowledge-map nodes referenced | Semantic (needs knowledge map) |
| Reasoning steps | Estimated chain length | Semantic / instructor |
| Explicit vs implicit evidence | Whether answer is stated or must be inferred from source | Semantic |
| Transfer required | Context differs from source examples | Semantic |
| Calculation required | Numeric operations in stem/options | Heuristic (digits/operators in stem; Hebrew/Latin/numeral mix) |
| Distractor similarity | Token/char similarity among options | Code (+ heuristic threshold) |
| Number of conditions/qualifiers in stem | Count of conditional/qualifier markers | Heuristic |
| Option semantic proximity | Embedding/judge on option meanings | Semantic (AI OPTIONAL) |
| Source span complexity | Length/density of supporting span | Heuristic (needs provenance) |
| Stem/option length | Characters/words | Code |

### 7.3 Use

- v0.1 produces a labelled intended difficulty plus the features that justified it, so an instructor can contest it. No numeric score is exposed as truth.
- Observed difficulty (Section 23) later calibrates feature weights. Convention only (`memory`, unverified): classical test theory p-values and 100+ responses for stability. Minimum responses is an OPEN QUESTION, especially for small cohorts.

## 8. Distractor Model

**FUTURE DESIGN.** Principle: **a distractor should know why it exists.**

### 8.1 Per-option record

| Field | Meaning |
|---|---|
| option | The option text |
| isCorrect | boolean |
| distractorType | One of the taxonomy below (null for correct options) |
| misconception | Short statement of the wrong belief it targets (optional) |
| rationale | Why it is wrong, written for the instructor/learner |
| sourceSupport / sourceContradiction | Reference to the source span that supports the correct option or contradicts the distractor |

### 8.2 Distractor taxonomy

| Type | Description |
|---|---|
| misconception | Reflects a known wrong belief |
| adjacent concept | A related concept from the same area |
| partial truth | True but incomplete for the question asked |
| reversed relationship | Cause/effect, direction, or roles swapped |
| wrong condition | Right claim under the wrong conditions |
| wrong scope | Right claim at the wrong scope/level |
| overgeneralization | Claim extended beyond its valid range |
| undergeneralization | Valid only in a narrower case than stated |
| procedural error | Wrong step or order in a procedure |
| arithmetic error | Plausible calculation slip |
| correct statement in wrong context | True fact that does not answer this stem |
| superficial lexical similarity | Looks like the stem/key textually but is wrong |

### 8.3 Notes

- Plausibility and misconception relevance cannot be decided by code (Section 4).
- SUPPORTED BY RESEARCH (`seen` summary): Shin, Guo & Gierl 2019 (Frontiers in Psychology) derive misconception-style distractors from labeled student responses; Gierl et al. 2017 (Rev. Educ. Res. 87(6)) is on distractor development/analysis (citation seen only, conclusions unverified). Applicability to Hebrew data is unknown (OPEN QUESTION).
- Option count: SUPPORTED BY RESEARCH (`seen`, secondary): Rodriguez 2005 (3 options generally adequate); Tarrant & Ware 2010 (reducing 4 to 3 left difficulty/discrimination about unchanged). Product default for the engine is 4 options (PRODUCT DESIGN DECISION), configurable.
- A distractor that is almost never chosen is a review flag, not an auto-delete (Section 23). The commonly cited convention is that a "functioning" distractor is chosen by at least 5% of examinees (SUPPORTED BY RESEARCH, `seen` secondary: Tarrant, Ware & Mohammed 2009); in small cohorts this is unreliable (OPEN QUESTION).
- **Misconception -> mastery inference is a possible FUTURE capability only (SPECULATION).** It would touch Learning Engine semantics, which are out of scope and governed by ADRs; it requires an explicit decision and is not planned.

## 9. Bad Question Anti-Patterns

**FUTURE DESIGN** catalogue. Source of the guideline set: SUPPORTED BY RESEARCH (`seen` record: Haladyna, Downing & Rodriguez 2002, Applied Measurement in Education 15(3), 309-333, 31 guidelines; the specific guideline wording used here is from `memory`, unverified). Flaws are common in practice (`seen`, abstract: Tarrant et al. 2006, Nurse Education Today, 2,770 nursing MCQs, 19 flaw types). LLM-generated items also show flaws (`seen` summaries, small or single-domain studies: Arif et al. 2024; Camarata 2025 reported via commentary). No source was found on question-writing bias.

Classification: **DET** = deterministically detectable; **HEUR** = heuristic (false positives expected); **SEM** = needs semantic understanding; **HUMAN** = human judgment.

| Anti-pattern | Class | Notes / mechanism |
|---|---|---|
| Multiple defensible answers | SEM + HUMAN | Cannot be decided from text alone. |
| Vague stem | HEUR (stem too short / no question or completion) + HUMAN | |
| Irrelevant trivia | HUMAN | Needs LO/importance judgment. |
| Double negatives | HEUR | Count negation words in stem+option; language-specific lists. |
| Trick wording | HUMAN (HEUR for negation/capitalized NOT) | |
| Grammatical clueing | HEUR (English a/an) / SEM (Hebrew gender/number agreement) | Hebrew agreement needs morphology; not code-reliable. |
| Answer-length bias | DET (measure) + HEUR (threshold) | Key is longest / much longer. |
| Stylistic outlier option | HEUR | One option differs in length/punctuation/format. |
| Implausible distractors | SEM + HUMAN | |
| Overlapping alternatives | HEUR | High token overlap; subsuming options need semantics. |
| Source leakage | DET (verbatim span, needs source) + SEM | Verbatim lifting detectable once a source exists. |
| Stem-answer lexical leakage | HEUR | Key shares more stem tokens than distractors. |
| Absolute cues ("always", "never") | DET (word match) + HEUR (language/morphology) | |
| External-knowledge dependency | SEM + HUMAN | Needs source and "is this outside the material" judgment. |
| Repeated templates | HEUR | Stem n-gram prefix patterns across the set. |
| Redundant questions | HEUR (surface) + SEM (paraphrase) | Section 14. |
| Incorrect difficulty label | SEM + OBSERVED DATA | Only measurable after use. |
| Cognitive-level mismatch | SEM + HUMAN | |
| "All/none of the above", "both A and B" | DET | String patterns; evidence on none-of-the-above is mixed, so flag, do not reject (design candidate). |
| Negative stem words | DET | |
| Numeric options out of order | DET | |

## 10. Item-Level Linter

**FUTURE DESIGN (Run is design-only; the linter module is a separate later Slice).** Home (planned): `src/domain/assessment/question-lint.ts` with `__tests__/question-lint.test.ts`. Pure TypeScript, no I/O, deterministic.

### 10.1 Contract

Input (all available today from `CanonicalQuestionRow`/draft content):

```
{ questionType, prompt, answerOptions: [{id, content}], correctOptionIds, explanation }
```

Output: list of issues shaped like `ImportIssue` — `{ code, severity, scope, rows?, topic?, detail? }`.

- Codes are UPPER_SNAKE and **content-blind**: `detail` may carry counts/ids/positions (e.g. option ids "A".."F", ratios), never the question or option text.
- Severity: **ERROR** = structural; blocks (consistent with existing content validator semantics). **WARNING** = advisory; instructor may override.
- Scope: **ITEM** (this section) or **SET** (Section 11).
- Option ids are "A".."F", trimmed uppercase (**CURRENT REALITY**).
- The ERROR checks intentionally overlap the existing import validator / publish gate; the linter must be self-contained so it works on engine proposals before they reach import. When wiring in, reconcile code names with existing validator codes (do not break existing outputs).
- A check marked **META** needs provenance/topic/objective/cognitive-level/difficulty metadata that does not exist today. Such checks are no-ops when the metadata is absent; they must not fire on current imports.

### 10.2 Normalization and Hebrew-first caveats (**PRODUCT DESIGN DECISION**, thresholds below are defaults)

Used for normalized-duplicate and overlap checks. Raw text is never altered in storage; normalization is for comparison only.

Pipeline for comparison keys:

1. Unicode NFC; remove zero-width and bidi control characters (U+200B-U+200F, U+202A-U+202E, U+2066-U+2069).
2. Collapse whitespace; trim.
3. Lowercase Latin (locale-independent).
4. Strip Hebrew niqqud and cantillation (U+0591-U+05C7, excluding maqaf U+05BE and punctuation marks geresh/gershayim U+05F3/U+05F4 which are handled in step 6). Niqqud is optional in everyday Hebrew, so pointed and unpointed text must compare equal.
5. Fold final letters for comparison only: ך->כ, ם->מ, ן->נ, ף->פ, ץ->צ. Rationale: final forms are positional; folding makes comparison robust to truncation and tokenization splits.
6. Fold punctuation variants: geresh U+05F3 / ASCII apostrophe / curly quotes; gershayim U+05F4 / ASCII double quote (`"` inside Hebrew acronyms such as מנכ"ל); maqaf U+05BE / hyphen / en/em dash.
7. Map digit variants (Arabic-Indic, Extended Arabic-Indic) to ASCII digits. Numbers and Latin tokens inside Hebrew text are kept as tokens, not dropped.
8. Strip terminal punctuation for duplicate comparison only.

Tokenization: split on whitespace and punctuation, but keep a token containing geresh/gershayim/maqaf-joined parts as defined above. Do not drop single-letter tokens blindly (Hebrew prefix letters are single letters but are attached, not separate).

**Attached prefixes.** Hebrew attaches prefix particles to the following word: ה (the), ו (and), ב (in), כ (as), ל (to), מ (from), ש (that/which). Combined forms (e.g. ושב..., וכש..., שבכל...) occur. There is no code-only way to strip them correctly (e.g. "הר", "בית", "מים" begin with prefix-like letters that belong to the root). Heuristic used for overlap/absolute-word checks:

- Compare tokens as-is; additionally compare after stripping up to a limited sequence of prefix letters from {ה,ו,ב,כ,ל,מ,ש} when the remaining token has at least 3 letters.
- Accept the resulting false positives/negatives; checks that use this are WARNING only.
- Absolute-term lists (e.g. תמיד, לעולם, אף פעם, בכל מקרה, בהכרח, כל, רק, בלבד, אף אחד, שום; and English always, never, only, all, none, every, must, entirely) are seed lists to be curated against the Golden Dataset (Section 19), and are matched both bare and with the prefix heuristic ("ותמיד", "שתמיד").
- Negative-stem list likewise (e.g. לא, אין, אינו, אינה, ללא, מלבד, except, not, never), noting לא/אין also appear legitimately.

**Lengths.** Hebrew orthography omits most vowels, so character lengths are systematically shorter than English for the same content. All length checks use **ratios within the same item or set** (language-agnostic) over code-point counts after niqqud stripping, with word count as a secondary measure for mixed Hebrew/English options. Never compare absolute length to an English-derived constant.

**Other caveats.** Article-agreement (a/an) checks apply to Latin-script English only; no Hebrew grammatical-agreement check is attempted in code (SEM). Mixed RTL/LTR text: logical order (storage order) is used for all comparisons; display order is irrelevant. Gender/number inflection is not normalized, so near-duplicate detection will miss inflection-only differences (accepted limit).

### 10.3 Check codes (ITEM scope)

Thresholds are **product-design defaults, NOT research-backed**; no verified numeric thresholds were found (Slice B). They are named constants to be tuned against the Golden Dataset and instructor feedback.

| Code | Severity | Detectability | Rule | Threshold | Rationale |
|---|---|---|---|---|---|
| STEM_EMPTY | ERROR | DET | Prompt is empty after trim | length = 0 | Unanswerable item. |
| OPTIONS_TOO_FEW | ERROR | DET | Fewer than the minimum options | < 2 (MIN_PUBLISHABLE_OPTION_COUNT as repo defines; reconcile) | Not a choice item. |
| OPTION_EMPTY | ERROR | DET | An option is empty after trim | length = 0; detail = option ids | Blank option. |
| OPTION_ID_DUPLICATE | ERROR | DET | Two options share an id | exact | Ambiguous correct reference. |
| OPTION_DUPLICATE_EXACT | ERROR | DET | Two options identical after trim | exact | Two identical options cannot be distinguished. |
| OPTION_DUPLICATE_NORMALIZED | ERROR | DET | Two options equal under the 10.2 comparison key but not exactly | key equality | Differs only by niqqud/final form/quote style/case/whitespace. |
| CORRECT_COUNT_INVALID | ERROR | DET | SINGLE_CHOICE needs exactly 1 correct; MULTIPLE_CHOICE needs >=1 and fewer than all options | per type | Structural validity. |
| CORRECT_ID_UNKNOWN | ERROR | DET | A correct id does not match any option id | exact | Dangling key. |
| STEM_TOO_SHORT | WARNING | HEUR | Prompt has very few words | < 4 words | Likely fragment/vague stem. |
| STEM_NO_QUESTION_FORM | WARNING | HEUR | Prompt has no "?" and does not end like a completion stem (no trailing "..."/blank marker) | pattern | Fragment stem; Hebrew "?" is the ASCII mark, completion stems vary. |
| STEM_NEGATIVE_WORDING | WARNING | DET (word match) | Stem contains a listed negation/exception word | >= 1 | Negative stems increase error (guideline, `memory`). |
| STEM_DOUBLE_NEGATIVE | WARNING | HEUR | >= 2 negation words in stem, or negation in stem plus a negated option | >= 2 | Hard-to-parse logic. |
| OPTION_ALL_OF_ABOVE | WARNING | DET | An option is an "all of the above" phrase (Hebrew/English list) | pattern | Cues test-wiseness; evidence mixed, so flag only. |
| OPTION_NONE_OF_ABOVE | WARNING | DET | An option is a "none of the above" phrase | pattern | Same. |
| OPTION_COMBINATION_REFERENCE | WARNING | DET | Option refers to other options ("A and B", "both A and C") | pattern with ids | Position-dependent and cueing. |
| OPTION_ABSOLUTE_TERM | WARNING | DET + HEUR (Hebrew prefixes) | Option contains an absolute word | >= 1; detail = option ids | Absolutes are usually distractors. |
| KEY_LONGEST_OPTION | WARNING | DET (measure) | A correct option is strictly the longest by margin (SINGLE_CHOICE) | key length >= 1.2 x next longest (and >= 15 chars difference) | Longest-key cue, a known LLM and human flaw (`seen`, preprint). |
| OPTION_LENGTH_IMBALANCE | WARNING | HEUR | Longest/shortest option ratio is large | ratio >= 3.0 and absolute difference >= 20 chars | Homogeneity guideline (`memory`). |
| OPTION_STYLE_OUTLIER | WARNING | HEUR | Exactly one option deviates from the others in length (>60% from median) or in terminal punctuation/capitalization/script | length deviation > 0.6 x median | Stylistic outlier gives away or discards an option. |
| KEY_STEM_LEXICAL_OVERLAP | WARNING | HEUR | The correct option shares more content tokens with the stem than every distractor | key shares >= 2 content tokens and > max distractor overlap | Lexical clueing; prefix heuristic for Hebrew. |
| OPTION_OVERLAP_HIGH | WARNING | HEUR | Two options have high token-set similarity | Jaccard >= 0.85 on normalized tokens (not equal) | Overlapping/near-duplicate alternatives. |
| OPTION_PREFIX_STEM_REPEAT | WARNING | HEUR | All options start with the same word sequence | shared first >= 3 tokens in all options | Wording that should move into the stem. |
| ARTICLE_MISMATCH | WARNING | HEUR (English only) | Stem ends with "a"/"an" and an option's first letter conflicts | pattern | Grammatical cue. Not applied to Hebrew. |
| OPTION_NUMERIC_UNORDERED | WARNING | DET | All options are plain numbers but not sorted | all numeric | Ordering convention. |
| OPTION_COUNT_UNUSUAL | WARNING | DET | Option count outside expected range | < 3 or > 6 | Rodriguez 2005 context (`seen`, secondary); default 4 is a product decision. |
| OPTION_WHITESPACE_ANOMALY | WARNING | DET | Leading/trailing/double whitespace, or control characters | pattern | Format anomaly (also bidi controls). |
| OPTION_PUNCTUATION_INCONSISTENT | WARNING | DET | Mixed terminal punctuation across options | some but not all end with . ; : | Format anomaly / cue. |
| EXPLANATION_MISSING | WARNING | DET | Explanation null or empty | length = 0 | Review and feedback quality; not required by the publish gate (**CURRENT REALITY** is `explanation|null`). |
| EXPLANATION_NAMES_ONLY_KEY | WARNING | HEUR | Explanation does not mention any correct option text/id | no shared content token | Weak rationale. Optional, low priority. |
| PROVENANCE_MISSING | WARNING | DET, META | No source reference on an engine-generated item | field absent | Traceability (Section 15). No-op for ordinary imports. |
| TOPIC_MISSING | WARNING | DET, META | No resolved topic | absent | **CURRENT REALITY**: import already requires topic; applies to engine proposals. |
| OBJECTIVE_MISSING | WARNING | DET, META | No learning objective | absent | LO coverage needs it. No-op until LO exists. |
| COGNITIVE_LEVEL_MISSING | WARNING | DET, META | No intended cognitive level | absent | Needed for set mix check. |
| DIFFICULTY_INTENT_MISSING | WARNING | DET, META | No intended difficulty | absent | Needed for set mix check. |

Notes:

- Content-blindness: `detail` examples: `{ options: ["B","D"] }`, `{ ratio: 3.4 }`. Never raw text.
- SEM/HUMAN anti-patterns (ambiguity, plausibility, grounding, level mismatch) have no code here; they belong to the critic/instructor (Sections 16-17).
- Severity policy: only structural invariants are ERROR. Everything pedagogical is WARNING because the instructor, not the linter, owns pedagogy.

## 11. Assessment-Set Linter

**FUTURE DESIGN.** Operates on an ordered list of items (a proposal batch, or a draft set assembled for a topic/course). Same issue shape as Section 10, `scope: SET`, `rows` listing the affected item indexes. Minimum set size for statistics: 8 items (**product default**; below that, distribution checks are skipped and `SET_TOO_SMALL` is emitted once).

### 11.1 Check codes (SET scope)

All thresholds are **product-design defaults, NOT research-backed**.

| Code | Severity | Detectability | Rule | Threshold | Rationale |
|---|---|---|---|---|---|
| SET_TOO_SMALL | WARNING | DET | Set has too few items for distribution checks | n < 8 | Avoid noisy statistics. |
| DUPLICATE_STEM_EXACT | WARNING | DET | Two items with identical prompts after trim | exact | Matches existing `DUPLICATE_PROMPT` warning in spirit; reconcile with that code. |
| DUPLICATE_STEM_NORMALIZED | WARNING | DET | Prompts equal under 10.2 key | key equality | |
| NEAR_DUPLICATE_STEM | WARNING | HEUR | High token-set similarity between prompts (possibly plus same key) | Jaccard >= 0.8 | Surface redundancy; paraphrase needs SEM (Section 14). |
| NEAR_DUPLICATE_ITEM | WARNING | HEUR | Similar stem and X | Likely same assessed fact. |
| KEY_POSITION_IMBALANCE | WARNING | DET | One position holds the correct answer far more often than expected (SINGLE_CHOICE, same option count) | share > 1.5 x (1/k) | Test-wise guessing; code should assign positions anyway. |
| KEY_POSITION_RUN | WARNING | DET | Same correct position repeated consecutively | run >= 4 | Pattern cue. |
| SET_KEY_LENGTH_BIAS | WARNING | DET | Correct option is the longest in too many items | >= 50% of SINGLE_CHOICE items | Set-level longest-key bias. |
| SET_OPTION_COUNT_MIXED | WARNING | DET | Different option counts in one set | > 1 distinct count | Inconsistent guessing rates; product preference, not research. |
| STEM_TEMPLATE_REPEATED | WARNING | HEUR | Many prompts share the same leading n-gram | >= 40% share first 3 tokens (n >= 8) | Templated generation. |
| ALL_OR_NONE_OVERUSE | WARNING | DET | "All/none of the above" in many items | > 10% of items | Repeated cue. |
| QUESTION_TYPE_MONO | WARNING | DET | Single structural type | all items same type, n >= 8 | Informational; MULTIPLE_CHOICE share is a pilot concern (FUB-035). |
| DIFFICULTY_DISTRIBUTION_SKEWED | WARNING | DET, META | Intended difficulty mix deviates from blueprint (or default) | any band outside target +/- 20 pp | Needs intended difficulty. |
| COGNITIVE_DISTRIBUTION_SKEWED | WARNING | DET, META | Cognitive mix deviates from blueprint | target +/- 20 pp | Needs cognitive level. |
| RECALL_EXCESS | WARNING | DET, META | Remember-level share too high | > 50% (default; course-dependent) | Mostly-recall sets undertest understanding. |
| TOPIC_COVERAGE_GAP | WARNING | DET, META | A blueprint/course topic has zero items | count = 0 | Needs topic list (topics exist today; blueprint does not). |
| TOPIC_CONCENTRATION | WARNING | DET, META | One topic dominates the set | > 40% of items | Section 13 failure mode. |
| OBJECTIVE_UNCOVERED | WARNING | DET, META | A learning objective has no item | count = 0 | Needs LO. |
| CONCEPT_UNDERCOVERED | WARNING | DET, META | A knowledge-map node below its target item count | below blueprint target | Needs knowledge map (Section 12). |
| CONCEPT_OVERCOVERED | WARNING | DET, META | Many items assess one node | > blueprint limit | Section 13. |
| PROVENANCE_COVERAGE_LOW | WARNING | DET, META | Share of items without source reference too high | > 0% for engine proposals | Traceability. |

### 11.2 Final code list (for the linter implementer)

The authoritative machine-readable list: all codes in 10.3 (scope ITEM) and 11.1 (scope SET) above. ERRORs: STEM_EMPTY, OPTIONS_TOO_FEW, OPTION_EMPTY, OPTION_ID_DUPLICATE, OPTION_DUPLICATE_EXACT, OPTION_DUPLICATE_NORMALIZED, CORRECT_COUNT_INVALID, CORRECT_ID_UNKNOWN (all ITEM). Every other code is WARNING. META checks are no-ops when their metadata is absent.

## 12. Knowledge Map

**FUTURE DESIGN.** A structured representation of what the source material teaches, used to drive blueprints and coverage checks.

- **Nodes**: knowledge units (concept, term, fact, rule, procedure, formula, relationship). Each node: id, name, type, short statement, source references (Section 15), optional prerequisite/related edges, optional topic mapping (the existing Topic).
- **Edges** (optional, V1 may omit): prerequisite-of, part-of, contrasts-with (feeds discrimination items and adjacent-concept distractors), causes.
- **Relationship to existing model**: **CURRENT REALITY** has Topics (resolved by name at import) and no concept graph. The knowledge map is additive and must not replace Topics or any Learning Engine structure. Whether a knowledge unit maps 1:1 to anything the learning engine tracks is an OPEN QUESTION and must not be assumed.
- **Who builds it**: extraction of candidate nodes is AI REQUIRED (semantic understanding of what is worth learning); the instructor confirms/edits/prunes (HUMAN REQUIRED because "what is worth learning" is an instructor decision). Counting and coverage over an approved map is CODE.
- **Failure modes**: over-fragmentation (hundreds of trivial nodes), omission of key concepts, hallucinated nodes with no source span. Mitigation: every node requires a source reference; nodes without one are rejected by code.
- **Versioning**: map is versioned per source document revision; item references point to a map version so edits do not silently change meaning.
- **Hebrew**: term nodes store surface forms including prefixed forms/plurals as aliases to support the overlap heuristic; no automatic morphology claim.

## 13. Assessment Blueprint

**FUTURE DESIGN.** A blueprint prevents the common failure "AI generated 20 good questions but 15 test the same two easy concepts".

### 13.1 Contents

| Dimension | Description |
|---|---|
| Target concepts / objectives | Which nodes/LOs must be covered; per-node target item count (min/max) |
| Topic weighting | Share of items per topic (default proportional to source size; instructor can override) |
| Cognitive mix | Target share per level (Section 6) |
| Difficulty mix | Target share per intended difficulty band |
| Type mix | Pedagogical types (Section 6) and structural types (single vs multiple choice) |
| Redundancy limits | Max items per node; max near-duplicate similarity |
| Option policy | Option count, "none of the above" policy |
| Set size | Total target and per-topic targets |

### 13.2 What is deterministic, semantic, or instructor input

| Piece | Who |
|---|---|
| Arithmetic of allocation (distributing N items by weights, enforcing min/max) | CODE |
| Checking a generated set against the blueprint (Section 11 META checks) | CODE |
| Identifying candidate concepts/LOs from source | AI REQUIRED (propose) |
| Approving objectives, weights, level/difficulty mix, what is out of scope | HUMAN REQUIRED (instructor) |
| Choosing which node each candidate item targets | AI proposes; code verifies each item references a valid node |

### 13.3 Flow

Blueprint is produced before generation; generation is requested per blueprint cell (node x level x type), so coverage is a property of the request, not something hoped for afterward. After generation, the set linter reports shortfalls; regeneration targets only the unfilled cells (Section 16).

**SPECULATION/OPEN QUESTION**: default blueprint shapes for a short pilot quiz versus a full course; whether instructors will tolerate configuring a blueprint (a "quick mode" with defaults is likely required).

## 14. Duplicate / Equivalence Model

**FUTURE DESIGN.** Five distinct notions of "same":

| Level | Example | Detection | Class |
|---|---|---|---|
| Exact | identical stem and options | string equality | CODE |
| Normalized textual | differs by niqqud, final letter forms, quote style, case, whitespace, digit script | comparison key (Section 10.2) | CODE |
| Lexical near-duplicate | same words reordered, minor edits | token-set / n-gram similarity (Jaccard, thresholds in 11.1) | CODE+HEURISTIC |
| Semantic duplicate | paraphrase of the same question | embedding similarity or LLM judge | AI OPTIONAL (code baseline catches only surface overlap) |
| Assessment-equivalent | "What is X?" vs "Which statement best defines X?" - different wording and form, same fact assessed from the same node at the same level | same knowledge-map node + same level + same intended key; otherwise AI judge | CODE (if node-tagged) / AI REQUIRED (otherwise) |

Notes:

- Assessment-equivalence is primarily solved by blueprint caps per node/cell (Section 13): prevention beats detection.
- **Separate concern**: this is *authoring-time redundancy* in a question set. It is not the learner anti-repeat logic (which controls when a learner sees an item again, governed by the Learning Engine and ADRs). The two must not share code paths or semantics; deleting a near-duplicate is an authoring decision, never a learner-state change.
- Cross-batch: detection runs against the course's existing questions as well as the new batch (cost: pairwise on normalized keys is cheap at pilot scale; index later).
- Always advisory (WARNING): instructors may deliberately keep paired items, e.g. deliberate retest variants.

## 15. Provenance Model

**FUTURE DESIGN.** (Capability map row 4 covers provenance; **CURRENT REALITY**: none for questions.)

### 15.1 What to record

| Level | Content |
|---|---|
| Document | `sourceDocumentId`, title, file hash, upload time, who uploaded, format |
| Page / section | Page number (where meaningful), section path/heading |
| Chunk | Chunk id, ordinal, text hash |
| Offsets | Character offsets within the normalized extracted text |
| Extraction | Extractor name + version, warnings (e.g. low text density, tables dropped) |
| Generation | Generator model/process identifier, prompt/pipeline version, parameters, timestamp |
| Item-level | Supporting span(s); contradicting span(s) per distractor; "external knowledge used" flag |
| Review | Reviewer, decision, edits, time |

### 15.2 Questions an instructor must be able to ask

Where did this come from? Which section supports it? Why is the correct answer correct? Why is distractor B wrong? Was external knowledge used? Which model/process produced it?

### 15.3 Honest limits

- Page precision is not promised: text PDFs yield page numbers, DOCX has no stable pages (reflow), and Google Docs pagination is not authoritative. Offsets into *our* normalized text are the stable reference; page/section are best-effort display aids.
- A cited span proves the model *pointed* at text, not that the span *entails* the answer (entailment is SEM). Code can verify only that the cited span exists in the document and, optionally, lexical overlap with the key.
- Provenance is stored with the proposal/draft and copied to a published version only through the existing authoring lifecycle; QuestionVersions stay immutable.
- IP: stored source text is sensitive; see CONTENT_IP_THREAT_MODEL for handling expectations (not restated here).

## 16. Generator / Critic / Review Pipeline

**FUTURE DESIGN.** AI is not required at every stage. Each stage defines its contract:

| # | Stage | Input | Output | Deterministic work | Possible AI work | Failure mode | Retry semantics | Provenance | Human gate |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Extract | Source file/text | Normalized document + sections | All of it (text extraction, normalization, chunking, offsets) | None | Empty/garbled/unsupported (e.g. scanned PDF) | Fail fast, report; no auto-retry | Extractor + version, warnings | Instructor sees extraction summary |
| 2 | Understand / Knowledge Map | Normalized document | Candidate knowledge map | Validate nodes cite spans; dedupe; size caps | Identify concepts/relations | Over/under-fragmentation, hallucinated nodes | Re-run with constraints; bounded attempts | Model/prompt version | Instructor edits/approves map |
| 3 | Blueprint | Approved map + instructor settings | Blueprint (cells with targets) | Allocation arithmetic, validation | Suggest objectives/weights | Unfillable cells | Recompute | Settings snapshot | Instructor approves blueprint |
| 4 | Generate | Blueprint cell + source spans | Candidate items with distractor records | Assign option positions/ids; enforce schema; reject malformed | Draft stem, key, distractors, rationales | Invalid structure; ungrounded items; flaws | Regenerate per cell, bounded | Generator, prompt version, spans | None yet |
| 5 | Deterministic lint | Candidates | Item + set lint reports | Sections 10, 11 | None | Many ERRORs | Auto-reject ERROR items; request repair | Lint version | None |
| 6 | Semantic critic (conditional) | Items with MEDIUM/HIGH risk | Critique findings (grounding, ambiguity, plausibility) | Risk routing (Section 17) | Critique | Critic false positives/negatives (AI-judge reliability needs a calibration set; `seen`: automated judges rated far lower than humans in a small study, Arif et al. 2024) | Not re-run on unchanged content (cache by hash) | Critic model/prompt version | None yet |
| 7 | Repair / regenerate | Items + findings | Revised items | Re-lint after repair; cap iterations | Rewrite flagged parts | Loops, drift | Max N iterations (default 2; product default); then escalate to human | Revision lineage | None |
| 8 | Validate | Revised items | Final proposal batch | Re-run lint; blueprint conformity | None | Residual ERRORs | Drop item; report | Final lint | None |
| 9 | Instructor review | Proposal batch + warnings + provenance | Approve / Edit / Reject / Regenerate decisions | Present, batch, track decisions | None | Reviewer overload | n/a | Reviewer decision log | **Required** |
| 10 | Existing authoring | Approved items as `CanonicalQuestionRow`-shaped | DRAFT questions | Existing preview/confirm path or equivalent proposal-batch confirm | None | Validation failure | Existing semantics (all-or-nothing) | Link proposal -> draft | Existing instructor publish |
| 11 | Publish | DRAFT | Immutable `question_versions` row | Existing `assertQuestionPublishReady` | None | Publish gate failure | Existing | Existing | **Instructor publish (existing)** |

Stage 6 is skipped for LOW-risk items. Stage 7 is skipped when no findings exist. Engine begins at `CanonicalQuestionRow`-shaped candidates and ends at an advisory report plus proposals -> DRAFT; it never publishes (**CURRENT REALITY** seam: the import preview/confirm boundary; **FUTURE DESIGN**: confirm must reference a server-held proposal batch id instead of re-parsing raw text, because the current confirm re-sends raw text and re-runs preview).

## 17. AI Escalation Policy

**FUTURE DESIGN; no provider, SDK, model, or LLM call is chosen or made by this Run.**

Risk is determined after deterministic lint, per item, by code, from metadata and lint output:

| Risk | Trigger examples | Action |
|---|---|---|
| LOW | Item passes lint with no WARNINGs; source-lifted recall/definition with grounded span; instructor-authored (not generated) | No critic. Go to instructor review. |
| MEDIUM | WARNINGs present (overlap, length, style); application/scenario types; generated without a verifiable span | AI critic **optional** (budget/config dependent); instructor sees warnings regardless. |
| HIGH | Multi-defensible-answer risk indicators (very high option overlap, MULTIPLE_CHOICE with partial key), no or weak grounding, factual/numeric claims, transfer/multi-step reasoning, calculation, contested topic flag | Critic **recommended**; **required** before the item may be presented as "ready" in batch-approve mode (instructor can still force individual review). |

Rules:

1. Escalation is per item, never "run critic on everything".
2. The critic is advisory; it cannot approve and cannot publish. Its findings are shown to the instructor with provenance.
3. Same content hash + same critic version = cached result.
4. Disagreement between lint and critic is shown, not resolved by a vote.
5. Thresholds that move items between LOW/MEDIUM/HIGH are product defaults to be calibrated (**OPEN QUESTION**: stakes level of the assessments - formative vs graded - changes the policy).
6. A model must never be the sole source of "the correct answer is correct" for a published item: human approval is the gate (OQ-038 concerns human approval of AI content and is DEFERRED in the repo; this document does not resolve it).

## 18. Evaluation Framework

**FUTURE DESIGN.** Quality is a **profile**, never a single opaque score. Evaluation applies both to the engine (offline, against the Golden Dataset) and to its outputs in use.

| Dimension | Meaning | Measured by |
|---|---|---|
| Groundedness | Claims supported by cited source | Instructor + critic; code checks span existence |
| Factual correctness | Key is true | Instructor (primary); critic (aid) |
| Ambiguity | Single defensible key | Instructor; critic; later observed data |
| LO alignment | Item assesses the stated objective | Instructor; AI OPTIONAL |
| Cognitive alignment | Item matches stated level | Instructor; AI OPTIONAL |
| Difficulty quality | Intended vs observed agreement | Observed data (Section 23) |
| Distractor plausibility | Distractors attract unprepared learners | Instructor; observed selection rates |
| Misconception quality | Distractor maps to a real misconception | Instructor |
| Answer leakage | Cues give away the key | Lint (DET/HEUR) + instructor |
| Coverage | Blueprint cells filled | Code |
| Redundancy | Near/assessment-equivalent items | Code + AI OPTIONAL |
| Traceability | Provenance completeness | Code |
| Instructor accept / edit / reject | Human verdict on each proposal | Review log |
| Cost per accepted question | Spend / accepted items | Metrics (Section 25) |

### 18.1 Evaluation practice

- Offline: run the pipeline on the Golden Dataset (Section 19), compare lint results to expected labels, track precision/recall per check code. Regression-test: a lint change must not alter labels on the fixed set without review.
- AI-judge reliability must be calibrated against human labels before the judge is trusted (**OPEN QUESTION**; `seen` summary: small study found automated judges rating far fewer items "good" than humans did, Arif et al. 2024, UMich work in progress).
- Acceptance rate and edit distance are the primary live signals; both depend on instructor review UI (Section 22).
- Published research comparing generators is inconsistent in evaluation methods (`seen` summary: Kurdi et al. 2020); we do not adopt any external benchmark.

## 19. Golden Dataset Approach

**FUTURE DESIGN.** A small, hand-curated, **synthetic** dataset that fixes the expected behavior of the linter and (later) critic.

### 19.1 Constraints

- Synthetic only. No Ruppin proprietary material, no real student data (see CONTENT_IP_THREAT_MODEL).
- **Hebrew-first**, with a bilingual (Hebrew + English) slice for mixed-script behavior.
- Versioned in the repo as test fixtures when the linter is built (fixture location is a later Slice decision).
- Each case has a machine-readable expected result: the set of check codes that must (and must not) fire.

### 19.2 Content coverage

| Content kind | Purpose |
|---|---|
| Definitions | Recall/definition items, source-lifted wording |
| Facts | Dates, names, numbers (mixed numerals / Latin acronyms inside Hebrew) |
| Confusable concepts | Discrimination, adjacent-concept distractors |
| Cause/effect | Reversed-relationship distractors |
| Process / sequence | Ordering, procedural-error distractors |
| Numbers / calculation | Arithmetic-error distractors, numeric option ordering |
| Scenario / case | Application, ambiguity risk |

### 19.3 Labelled case kinds

| Case kind | Expected |
|---|---|
| Strong question | No ERROR, no WARNING |
| Weak question (each anti-pattern: absolute terms, longest key, empty/duplicate options, all-of-the-above, lexical leak, fragment stem) | Specific code(s) fire |
| Strong distractor / weak distractor (plausible vs implausible, with rationale labels) | Used for critic/human-agreement, not lint |
| Ambiguous question (two defensible keys) | Lint passes; critic/human must flag (documents the limits of code) |
| Duplicate and equivalent pairs (exact, normalized, near, paraphrase, assessment-equivalent) | The matching duplicate level fires, others do not |
| Easy / medium / hard labelled items | Intended difficulty labels with feature justification (Section 7); used to test future calibration, not to claim predictive power |

### 19.4 Hebrew-specific cases

- Same option with and without niqqud; with and without final-form variation; with geresh/gershayim vs ASCII quotes (e.g. acronym with `"`); with maqaf vs hyphen -> OPTION_DUPLICATE_NORMALIZED.
- Stem-key leakage where the shared word is the same token with different attached prefixes (ה/ו/ב/כ/ל/מ/ש) -> exercises the prefix heuristic and its accepted false positives (words whose initial letter is root, e.g. beginning with מ/ה/ל).
- Absolute terms with and without prefix (תמיד / ותמיד / שתמיד).
- Numbers: ASCII vs Eastern Arabic digits; digits inside Hebrew text; Latin tokens (units, acronyms) inside RTL options.
- Bidi control characters in pasted text.
- Options differing only in gender/number inflection (documented expected miss for near-duplicate).

### 19.5 Size and growth

Start small (tens of cases) so every case is reviewed by a human fluent in Hebrew; grow it from real linter false positives/negatives. Annotators and agreement protocol are an OPEN QUESTION.

### 19.6 Provisional ledger seeds

**FUTURE DESIGN / not the ledger.** The real Capability Ledger (Section 28) is written in a later Slice. These are provisional IDs and proposed statuses only. No capability is IMPLEMENTED by this document, and none of these is listed as such.

| ID | Name | Proposed status |
|---|---|---|
| AE-001 | Item-level deterministic linter (Section 10) | DESIGNED |
| AE-002 | Set-level deterministic linter (Section 11) | DESIGNED |
| AE-003 | Hebrew-aware comparison normalization (Section 10.2) | DESIGNED |
| AE-004 | Golden Dataset (synthetic, Hebrew-first) | DESIGNED |
| AE-005 | AI Necessity Matrix and escalation policy | DESIGNED |
| AE-006 | Question anatomy / metadata fields | DESIGNED |
| AE-007 | Pedagogical question type taxonomy | DESIGNED |
| AE-008 | Difficulty model v0.1 (intended vs observed) | DESIGNED |
| AE-009 | Distractor model and taxonomy | DESIGNED |
| AE-010 | Knowledge map | IDEA |
| AE-011 | Assessment blueprint | DESIGNED |
| AE-012 | Duplicate / equivalence model | DESIGNED |
| AE-013 | Provenance model | DESIGNED |
| AE-014 | Generator / critic / review pipeline | DESIGNED |
| AE-015 | Evaluation framework (profile) | DESIGNED |
| AE-016 | Content ingestion layer (text PDF, DOCX) | IDEA |
| AE-017 | Google Docs connector | HUMAN_GATE |
| AE-018 | Instructor review workspace | IDEA |
| AE-019 | Real-world feedback loop (observed difficulty, distractor analysis) | IDEA |
| AE-020 | Misconception-to-mastery inference | DEFERRED (out of scope; Learning Engine untouched) |
| AE-021 | Semantic critic / AI escalation execution | IDEA (no provider chosen) |
| AE-022 | Proposal-batch confirm (replaces raw-text re-parse for engine path) | IDEA |

## 20. Content Ingestion architecture

(written in a later Slice of this Run)

## 21. PDF / DOCX / Google direction

(written in a later Slice of this Run)

## 22. Instructor Review Workspace concept

(written in a later Slice of this Run)

## 23. Future Real-World Feedback Loop

(written in a later Slice of this Run)

## 24. Future psychometric possibilities

(written in a later Slice of this Run)

## 25. Cost / performance strategy

(written in a later Slice of this Run)

## 26. Risks

(written in a later Slice of this Run)

## 27. Open Questions

(written in a later Slice of this Run)

## 28. Capability Ledger

(written in a later Slice of this Run)

## 29. What was implemented in this Run

(written in a later Slice of this Run)

## 30. What remains

(written in a later Slice of this Run)

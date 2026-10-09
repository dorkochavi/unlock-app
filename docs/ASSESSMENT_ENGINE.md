# UNLOCK — Assessment Engine: Canonical Direction

Status: ACTIVE DESIGN DIRECTION
Owner: Assessment Engine product + architecture direction

This document is the canonical home for the Assessment Engine direction. Other documents (Plan, `DEV_STATUS`, capability map, backlog, ADRs, Run Reports) should link here rather than restate it.

## Label legend

Every non-trivial statement carries (or sits under a heading that carries) one of these labels.

| Label | Meaning |
|---|---|
| **CURRENT REALITY** | True of the committed repository (code, migrations, tests, accepted docs) as inspected when the statement was last reconciled (Run 002, B1). Re-verify against code before relying on it; no git ref is claimed as "current". |
| **RUN 001 OUTPUT** (also written RUN OUTPUT) | Produced by Run `2026-10-08-ASSESSMENT-ENGINE-NIGHT-001`, ending at `a066435` (RUN 001 END): this document and the linter prototype (Section 29). Not product behavior. |
| **RUN 002** | Work of Run `2026-10-08-ASSESSMENT-ENGINE-002` (Run START_HEAD = RUN 001 END `a066435`). Items marked PLANNED are not done; items marked DONE cite their evidence. |
| **HUMAN GATE** | A decision only the human owner can make (Section 27.1). |
| **FUTURE DESIGN** | A proposed design. Not built. Nothing under this label may be read as implemented. |
| **SPECULATION / OPEN QUESTION** | Unresolved; may be wrong; needs research or a human decision. |

Research claims carry a second tag: **SUPPORTED BY RESEARCH** (with the verification level of the source: `seen` = bibliographic record or search summary only; `memory` = unverified recall; nothing in this Run was verified against full text), **PRODUCT DESIGN DECISION** (our choice, not evidence), or **OPEN QUESTION**.

## How to read

- Sections 1-3 are intent and principles. 4-11 are the analytical core (what code can do vs what AI/humans must do, and the concrete lint checks). 12-19 are the knowledge/blueprint/provenance/pipeline/evaluation design. 20-27 cover ingestion, review, feedback, cost, risks and open questions; 28 is the Capability Ledger (the place to look up what is built, designed, gated, or needs AI); 29-30 state what Run 001 produced and what remains (Run 002 changes are logged in 28.4). Section 5.1 and 28.3 record Run 002 decisions.
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

**CURRENT REALITY.** The pipeline above does not exist as a product flow. What exists is: a structured text import (JSON/CSV) of already-written questions into DRAFT, a content validator, the authoring/publish lifecycle (Sections 3.3 and 20), and one RUN 001 OUTPUT code artifact: a pure, deterministic, **unwired** linter prototype in `src/domain/assessment/` (Sections 10-11; ledger AE-001..003, PROTOTYPED, not VERIFIED). No ingestion, knowledge map, blueprint, generator, critic, or review workspace exists.

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
- Pedagogical checks (position bias, length, distinctiveness, distractor plausibility, option-count distribution, templated/duplicate detection) were deferred as FUB-035 in `docs/FOLLOW_UP_BACKLOG.md`. **CURRENT REALITY:** none of them run in any import, publish, API or UI flow. A subset of the heuristic ones (position, length, overlap, templating, duplicates) exists only as the unwired RUN 001 OUTPUT linter prototype (Section 10 status note); distractor plausibility and semantic checks do not exist.

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
| source provenance | CORE for machine-generated items; optional for manually authored (decision 5.1) | none | Section 15. |
| generator provenance (model/process) | CORE once automated generation exists; not needed before (5.1) | none | Mandatory for any generated item. |
| generation version (prompt/pipeline) | CORE once automated generation exists (5.1) | none | For reproducibility and A/B. |
| confidence | NOT YET JUSTIFIED (re-affirmed, 5.1) | none | Model self-confidence is poorly calibrated (SPECULATION/OPEN QUESTION); prefer lint + critic findings. |
| quality warnings | CORE NOW | computed by the unwired linter prototype; none persisted | Output of linter; advisory. |
| lint result | CORE NOW | computed only, never stored; no flow calls the prototype | Derived; recompute by content hash rather than store as truth. |
| semantic critique result | USEFUL LATER | none | Only when escalated. |
| instructor review state | CORE NOW (for engine proposals) | draft/publish lifecycle exists for questions | Proposal batch needs approve/edit/reject state (Section 22). |
| observed difficulty | USEFUL LATER (feedback loop) | none | Derived from Attempts; never stored on the QuestionVersion. |
| observed distractor effectiveness | USEFUL LATER (feedback loop) | none | Derived; Section 23. |

### 5.1 Run 002 decisions (B3) - PRODUCT DESIGN DECISION, human to confirm

1. **Source provenance is CORE for machine-generated questions and optional for manually authored ones.** A generated item without a traceable source cannot be reviewed for groundedness, so a generated proposal lacking provenance is not review-ready (PROVENANCE_MISSING, META, applies to engine proposals only). Manually authored/imported items keep working without it; the instructor is the source of authority. Nothing is enforced today: no generator and no provenance storage exist.
2. **Generator provenance and generation version become mandatory the moment automated generation exists.** Without them, outputs cannot be reproduced, compared across prompt/model changes, or audited. Until a generator exists they stay unused (no speculative fields).
3. **Intended difficulty is never observed difficulty** (re-affirmed, Sections 6.1 and 7.1). They are separate fields; observed values are derived from Attempts and never written into QuestionVersions. A lint or UI must label the first as "intended".
4. **No generic confidence score is promoted.** No concrete consumer is justified and self-reported model confidence is poorly calibrated. Revisit only if calibration evidence (Section 18.1) shows a score predicts instructor acceptance. Lint findings and critic findings remain the explainable signals.
5. Tier changes above are design decisions only: no schema, migration or field was added.

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

**Design: FUTURE DESIGN beyond the implemented subset below; the subset is a RUN 001 OUTPUT prototype.** Home: `src/domain/assessment/question-lint.ts` with `__tests__/question-lint.test.ts`. Pure TypeScript, no I/O, deterministic. Run 002 B4 hardening is DONE (evidence: `src/domain/assessment/question-lint.ts` and `__tests__/`; 94 assessment tests in total at Run 002 close); B5 Golden Dataset v0.1 and B6 calibration are DONE (Section 19; `docs/ASSESSMENT_CALIBRATION_V0_1.md`). The linter is still unwired and not verified.

**RUN 002 hardening (DONE, B4).** Explicit input caps now emit explicit truncation issues (`TEXT_TRUNCATED`, `SET_ITEMS_TRUNCATED`, `SET_ANALYSIS_TRUNCATED`), never silent truncation; Hebrew negation and all/none-of-above matching are token-based; `QUESTION_TYPE_UNSUPPORTED` and `CORRECT_IDS_TOO_MANY` were added; the header contract states this is a secondary quality linter (defensive structural diagnostics; ERROR is not authoritative validation). Still PROTOTYPED, NOT VERIFIED, NOT wired.

**RUN 001 OUTPUT (status note; the code list below is the Run 001 inventory, extended by the Run 002 hardening above).** A pure prototype of this linter exists in `src/domain/assessment/question-lint.ts` (with `text-normalize.ts`; commits e2d55eb and 022bfed; 52 unit tests). **Implemented ITEM ERRORS:** INPUT_UNREADABLE, OPTIONS_TOO_MANY, STEM_EMPTY, OPTIONS_TOO_FEW, OPTION_EMPTY, OPTION_ID_DUPLICATE, OPTION_DUPLICATE_EXACT, OPTION_DUPLICATE_NORMALIZED, CORRECT_COUNT_INVALID, CORRECT_ID_UNKNOWN. **Implemented ITEM WARNINGS:** STEM_TOO_SHORT, STEM_NEGATIVE_WORDING, OPTION_ALL_OF_ABOVE, OPTION_NONE_OF_ABOVE, OPTION_ABSOLUTE_TERM, KEY_LONGEST_OPTION, OPTION_LENGTH_IMBALANCE, KEY_STEM_LEXICAL_OVERLAP, OPTION_OVERLAP_HIGH, OPTION_WHITESPACE_ANOMALY, EXPLANATION_MISSING. Every other code in 10.3 is **not implemented**, including all META checks (they need metadata that does not exist today). The prototype is **not wired** into import, publish, API, or UI; it is unit-tested only and was reviewed by one general reviewer. Status: PROTOTYPED (Section 28), not verified. The remainder of this section is the design, still **FUTURE DESIGN** where it exceeds the list above.

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

- Compare tokens as-is; additionally compare after stripping up to a limited sequence of prefix letters from {ה,ו,ב,כ,ל,מ,ש} when the remaining token has at least 3 letters. (Run 003: for the 2-letter absolute terms `רק`/`כל` only the prefix `ו` is accepted; see 19.4.)
- Accept the resulting false positives/negatives; checks that use this are WARNING only.
- Absolute-term lists (e.g. תמיד, לעולם, אף פעם, בכל מקרה, בהכרח, כל, רק, בלבד, אף אחד, שום; and English always, never, only, all, none, every, must, entirely) are seed lists to be curated against the Golden Dataset (Section 19), and are matched both bare and with the prefix heuristic ("ותמיד", "שתמיד").
- Negative-stem list likewise (e.g. לא, אין, אינו, אינה, ללא, מלבד, except, not, never), noting לא/אין also appear legitimately.

**Lengths.** Hebrew orthography omits most vowels, so character lengths are systematically shorter than English for the same content. All length checks use **ratios within the same item or set** (language-agnostic) over code-point counts after niqqud stripping, with word count as a secondary measure for mixed Hebrew/English options. Never compare absolute length to an English-derived constant.

**Other caveats.** Article-agreement (a/an) checks apply to Latin-script English only; no Hebrew grammatical-agreement check is attempted in code (SEM). Mixed RTL/LTR text: logical order (storage order) is used for all comparisons; display order is irrelevant. Gender/number inflection is not normalized, so near-duplicate detection will miss inflection-only differences (accepted limit).

### 10.3 Check codes (ITEM scope)

Thresholds are **product-design defaults, NOT research-backed**; no verified numeric thresholds were found (Slice B). They are named constants to be tuned against the Golden Dataset and instructor feedback.

| Code | Severity | Detectability | Rule | Threshold | Rationale |
|---|---|---|---|---|---|
| INPUT_UNREADABLE | ERROR | DET | Item input cannot be read safely (throwing getter/Proxy); lint never throws | read failure | Totality of the linter; other checks are skipped for that item. |
| OPTIONS_TOO_MANY | ERROR | DET | Option count exceeds the lint cap; per-option and pairwise checks are skipped | > 50 (MAX_LINT_OPTIONS, product default) | Bounds work on hostile input. |
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

**RUN 001 OUTPUT (status note).** The prototype implements these **SET WARNINGS** only: SET_TOO_SMALL, DUPLICATE_STEM_EXACT, DUPLICATE_STEM_NORMALIZED, NEAR_DUPLICATE_STEM, KEY_POSITION_IMBALANCE, KEY_POSITION_RUN, SET_KEY_LENGTH_BIAS, STEM_TEMPLATE_REPEATED. Not implemented: NEAR_DUPLICATE_ITEM, SET_OPTION_COUNT_MIXED, ALL_OR_NONE_OVERUSE, QUESTION_TYPE_MONO, and every META check. The prototype is **not wired** into any flow. It has no set-size cap constant (only `MAX_LINT_OPTIONS = 50` per item); a `MAX_LINT_SET_ITEMS` cap is a recommended, unimplemented hardening (AE-032).

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
| SET_KEY_LENGTH_BIAS | WARNING | DET | Correct option is the longest in too many items | >= 50% of SINGLE_CHOICE items; evaluated only when eligible items >= MIN_SET_SIZE (8) | Set-level longest-key bias. |
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

The authoritative machine-readable list: all codes in 10.3 (scope ITEM) and 11.1 (scope SET) above. ERRORs: INPUT_UNREADABLE, OPTIONS_TOO_MANY, STEM_EMPTY, OPTIONS_TOO_FEW, OPTION_EMPTY, OPTION_ID_DUPLICATE, OPTION_DUPLICATE_EXACT, OPTION_DUPLICATE_NORMALIZED, CORRECT_COUNT_INVALID, CORRECT_ID_UNKNOWN (all ITEM). Every other code is WARNING. META checks are no-ops when their metadata is absent.

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

**FUTURE DESIGN; no provider, SDK, model, or LLM call is chosen or made anywhere in the repo (CURRENT REALITY).**

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

**FUTURE DESIGN.** A small, hand-curated, **synthetic** dataset that fixes the expected behavior of the linter and (later) critic. **CURRENT REALITY (Run 002, B5/B6 DONE):** Golden Dataset v0.1 exists as a PROTOTYPED fixture set (AE-004, AE-033) with a calibration harness (AE-034, AE-046). Evidence: `src/domain/assessment/golden/**` and `docs/ASSESSMENT_CALIBRATION_V0_1.md` (89 synthetic cases; 94 assessment tests in total). The 17 Hebrew-judgment-dependent label rows received a single-reviewer human review (Dor, 2026-10-08; 12 approved unchanged, 5 fixtures changed and applied; backlog FUB-060 RESOLVED). This is NOT psychometric, production or real-course validation and has no inter-annotator agreement (Section 19.5). Calibration verdicts: no threshold CHANGE; WATCH for the key-position imbalance/run rules and several others; the rest KEEP-provisional. Every linter threshold remains an unvalidated default (a tiny synthetic fixture is regression evidence, not real-world precision) and the linter stays PROTOTYPED. **Integration verdict: NOT_READY** (unchanged after the Run `2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001` recheck). Run 003 removed the 4 golden false positives (0 FP, 0 of 18 clean cases warn), but that is fixture-fit on 89 synthetic cases, 6 false negatives remain, and the key-position rule is statistically noisy by analytic estimate. Conditions to reach READY (advisory-only) are in `docs/ASSESSMENT_CALIBRATION_V0_1.md` Section 4; suggested fixes in its Section 5 (backlog FUB-059).

### 19.1 Constraints

- Synthetic only. No Ruppin proprietary material, no real student data (see CONTENT_IP_THREAT_MODEL).
- **Hebrew-first**, with a bilingual (Hebrew + English) slice for mixed-script behavior.
- Versioned in the repo as typed test fixtures (`src/domain/assessment/golden/golden-dataset-v0-1.ts`).
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
- Stem-key leakage where the shared word is the same token with different attached prefixes (ה/ו/ב/כ/ל/מ/ש) -> exercises the prefix heuristic and its accepted false positives (words whose initial letter is root, e.g. beginning with מ/ה/ל). **Run 003 update:** the 2-letter absolute terms `רק`/`כל` accept only the conjunction `ו` as an attached prefix (so `מרק`/`ברק` no longer warn, and `בכל/לכל/מכל/ככל` no longer trigger `OPTION_ABSOLUTE_TERM`, a documented recall loss); longer terms keep the general prefix rule. See `docs/ASSESSMENT_CALIBRATION_V0_1.md` Section 7.
- Absolute terms with and without prefix (תמיד / ותמיד / שתמיד).
- Numbers: ASCII vs Eastern Arabic digits; digits inside Hebrew text; Latin tokens (units, acronyms) inside RTL options.
- Bidi control characters in pasted text.
- Options differing only in gender/number inflection (documented expected miss for near-duplicate).

### 19.5 Size and growth

Start small (tens of cases) so every case is reviewed by a human fluent in Hebrew; grow it from real linter false positives/negatives. Annotators and agreement protocol are an OPEN QUESTION. Status: a single-reviewer review of the 17 Hebrew-dependent rows was done (Dor, 2026-10-08; FUB-060 RESOLVED); there is still no recruited annotator pool and no inter-annotator agreement. A second single-reviewer step (Dor, 2026-10-09) adjudicated 9 of the 78 held-out v0.2 rows after their blind evaluation (Section 19.7).

### 19.6 Ledger pointer

The Capability Ledger is Section 28 (the provisional seed list that stood here has been folded into it).

### 19.7 Human-approved design guidance for deterministic checks (HUMAN-APPROVED JUDGMENT; advisory input; NOT implemented)

Source: single-reviewer adjudication of 9 held-out v0.2 rows (Dor, 2026-10-09; `docs/ASSESSMENT_HELDOUT_V0_2.md` sections 12.1, 16). These are human judgments about quality definitions, not linter changes and not thresholds. They guide the design of future or revised checks (FUB-066, FUB-067, AE-029):

1. Lexical overlap between key and stem is not leakage by itself; leakage needs an asymmetry or a wording cue that helps identify the answer without mastering the content.
2. An absolute term is not a flaw merely because it exists; symmetric use across all options is not an answer cue.
3. Hebrew 'שום' and 'כל' need syntactic or semantic context; 'כל' integral to the proposition under assessment is not an absolute-term flaw.
4. A completion (cloze) stem ending in ':' is an acceptable question form; a question-form check must not require '?'.
5. A style outlier (for example niqqud on one option) is a real defect, distinct from key leakage; do not derive key leakage from formatting alone.
6. Set-level statistical warnings must weigh sample size and strength of evidence (5 of 10 at exactly the 0.5 threshold is not enough).

Also approved as a concept (not every existing finding): comparable numeric-range options should be consistently ordered (OPTION_NUMERIC_UNORDERED, still NOT_IMPLEMENTED). Limits: one reviewer, 9 rows, model-authored synthetic corpus; readiness stays NOT_READY.

## 20. Content Ingestion architecture

**FUTURE DESIGN.** Nothing in this section is implemented. Entity names below describe roles and are **not mandated**.

### 20.1 Why a separate layer

**CURRENT REALITY:** instructor import is a synchronous, text-only path: the UI posts raw CSV/JSON text, `previewImport` parses it with a format-specific adapter into `CanonicalQuestionRow` values, and `confirmImport` re-sends and re-parses the same raw text before writing DRAFT questions in one transaction (limits: `MAX_IMPORT_SOURCE_LENGTH` = 2,000,000 characters, `MAX_IMPORT_ROWS` = 2000). The format knowledge lives in `ImportSourceFormat` and the CSV/JSON adapters.

Binary, unstructured documents (DOCX, PDF) differ in kind: they are binary, need bounded and potentially slow extraction, produce prose (not questions), and carry provenance (section, page, offsets) that rows do not. Therefore:

- **Do not overload** `ImportSourceFormat`, the CSV/JSON adapters, `QuestionDraftContent`, `assertQuestionPublishReady`, `validateCanonicalQuestionRowContent`, or `question_versions`.
- Ingestion is a **distinct, async-capable layer** that ends where structured data already begins: it **converges on `CanonicalQuestionRow`-shaped candidates at the existing preview/confirm seam**. CSV/JSON structured import is preserved unchanged.

### 20.2 Roles (names not mandated)

**CURRENT REALITY (Run 002, B7 DONE):** a pure plain-text prototype exists, `src/domain/ingestion/plain-text.ts` (`normalizePlainText`, 15 unit tests): it returns a normalized document with UTF-16 offsets into the original text, enforces rejection caps, and recognizes markdown-ATX headings only. It is not wired, not persisted, and has no UI or route. The role names below remain non-mandated.

| Role | Meaning |
|---|---|
| ContentSource | What the instructor supplied: pasted text, an uploaded file, (later) a linked document. Includes declared type, size, origin. |
| SourceDocument | The identity of one supplied document for the duration it is held (ephemeral until a persistence decision exists). |
| ExtractedDocument | Normalized text plus structure and extraction warnings; no questions. |
| ExtractedSection | A bounded chunk (heading-delimited where possible) with offsets, used for provenance (Section 15). |
| ContentExtractor | Per-format port: bounded bytes in, ExtractedDocument or a stable failure outcome out. |

### 20.3 Flow and the seam

`upload -> validate envelope -> extract (ContentExtractor) -> normalized document + warnings -> [future: knowledge map, blueprint, generation, lint: Section 16] -> CanonicalQuestionRow-shaped candidates -> existing preview/confirm -> DRAFT`. The ingestion layer never publishes; publication stays the existing instructor action behind `assertQuestionPublishReady`.

### 20.4 Constraints

| Constraint | Consequence |
|---|---|
| Vercel function request body is about 4.5 MB (platform knowledge, not stated in the repo) | Upload cap of about 4 MB for the first design; larger files need a direct-to-storage path, which is a separate decision (AE-044). |
| Existing import routes authenticate before reading the body | New upload routes follow the same order (`.claude/rules/auth.md`, `api.md`); no privileged construction before auth. |
| OQ-023 (Minimal Material Model) and OQ-024 are OPEN; CONTENT_IP_THREAT_MODEL is design-only | **Stateless** `upload -> extract -> preview -> discard` until OQ-023 is decided; it is consistent with all accepted decisions. No source file or extracted text is persisted by this design. |
| Current confirm re-sends and re-parses raw text | For the engine path, confirm should reference a **server-held proposal-batch id** instead of re-parsing raw text (AE-022). The batch's storage is undecided (AE-036; group B), so until then the engine path cannot be completed. |
| Source text is sensitive | Logs and error outcomes must be content-blind (the same posture as the linter issues). |

## 21. PDF / DOCX / Google direction

**FUTURE DESIGN.** No extractor exists. Order recommended (human to confirm): DOCX first, then PDF, then Google.

### 21.1 DOCX

**Status: DESIGNED; no code exists (CURRENT REALITY).** A hand-rolled bounded reader is feasible with `node:zlib` and **no new dependency** (the repo has no zip, XML, or PDF parser today; `inflateRawSync` with `maxOutputLength` gives a hard decompression cap). Extraction targets `word/document.xml`: paragraphs/runs/text (`w:p`, `w:r`, `w:t`), `w:tab`, `w:br`, `w:hyperlink` text, tables (`w:tbl`); headings via paragraph style (style ids can be localized, so mapping through `styles.xml` is more reliable than names); Hebrew is stored in logical order (no reversal needed; `w:bidi`/`w:rtl` are direction hints); tracked deletions (`w:delText`) are skipped.

**HUMAN_GATE:** whether to hand-roll or to adopt a vetted library, and how much security-review budget to spend, is a human decision (group B). A hand-rolled reader trades dependency risk for the burden of hostile-input tests and a security review.

Threat controls required of any DOCX reader:

| Threat | Control |
|---|---|
| Oversized upload | Cap upload bytes (about 4 MB, Section 20.4). |
| Zip bomb | Cap entry count, per-entry and total **actual** uncompressed bytes (never trust declared sizes), and compression ratio; use bounded inflate. |
| Path traversal / disk writes | Read only whitelisted fixed part names; never write to disk. |
| Exotic zip features | Reject zip64, encrypted entries (flag bit 0; also OLE/CFB signature), duplicate or overlapping entries, spanned archives; use the last end-of-central-directory record. |
| XML entity attacks (XXE, billion laughs) | Reject any `<!DOCTYPE` or `<!ENTITY` outright. |
| Network access via relationships | Ignore relationships; never fetch External targets. |
| Macros | Reject `vbaProject.bin` and macro-enabled content types; never execute anything. |
| Embedded objects | Never read embeddings or media. |
| Spoofed type | Check magic bytes `PK\x03\x04` and the `[Content_Types]` main-part type, not the browser MIME. |
| Legacy format | Reject legacy `.doc` (CFB container) with a clear message. |

### 21.2 PDF

**Status: HUMAN_GATE (dependency).** Hand-rolling is not realistic (cross-reference tables, stream filters, fonts and CMaps, reading order). A vetted library is required; a candidate is `pdfjs-dist` pinned, used text-only with scripting/eval disabled and caps applied. It had a 2024 JavaScript-execution advisory, so CVE review is part of the decision. Adding it is a **new dependency and therefore a human gate** (group B). A system `pdftotext` binary is not viable on Vercel.

Scope and caveats:

- **Text-based PDF only. No OCR.** Image-only (scanned) PDFs are detected (very few characters per page plus image XObjects) and reported as "no extractable text / unsupported for V1". OCR is DEFERRED (AE-040).
- **Hebrew caveats:** PDFs often store visual order, so extracted text can be reversed or scrambled; presentation forms U+FB1D-FB4F may appear (NFKC normalization helps); fonts missing a ToUnicode map yield garbage. The extractor must emit **quality warnings**, and the instructor must see a human preview before anything is used.
- Page-level provenance is plausible; do not promise finer precision (Section 15.3).

### 21.3 Google Docs: options

There is **no Google OAuth** in the repo; authentication is Supabase email/password only. Supabase's Google provider would give identity, not Drive scopes.

| Dimension | A: export DOCX/PDF, then upload | B: public / shareable link fetch | C: authenticated Drive/Docs connector |
|---|---|---|---|
| UX | Two manual steps (export, upload) | Paste a link; document must be shared | Pick a document in-app |
| Permissions | None new; instructor controls the file | Document must be link-shared (broad exposure) | OAuth consent, scopes, per-user grants |
| Privacy | Same as any upload | Document may be public to anyone with the link | Token holds access to the instructor's Drive |
| Security | Reuses DOCX/PDF controls | Server fetches user-supplied URLs (SSRF, redirect, size risks) | New OAuth app, token storage (secret), new threat model |
| Complexity | Lowest (no new code beyond AE-023/024) | Medium | Highest |
| Provenance | Weak link to the original document | Link recorded, but content may change | Strongest (document id, revision) |
| Reliability | High (static file) | Fragile (permissions, formatting, rate limits) | Depends on Google API availability and quota |
| Pilot suitability | Suitable | Not recommended | Not suitable (needs human decision and review) |
| Long-term | Always remains a fallback | Likely dropped | Possible destination |

### 21.4 Format roadmap (PROVISIONAL, updated with Run 002 plain-text evidence)

Evaluated order, lowest risk first: **plain text paste -> DOCX -> PDF text -> Google export/upload (option A) -> authenticated connector (later)**. Plain text has no binary parsing, so it was the first prototype: AE-025 is PROTOTYPED (`src/domain/ingestion/plain-text.ts`, Run 002 B7 DONE; pure, unwired) and gives evidence about normalization, offsets, caps and Hebrew handling that later extractors reuse. **DOCX is next**, but hand-roll vs library remains a human gate. **PDF** is gated on a new dependency and its security review. **Google**: export-then-upload first, an authenticated connector much later. **No OCR** in V1. DOCX needs a hostile-input parser: the hand-roll vs library choice and security-review budget are a **HUMAN GATE** (group B). PDF needs a new dependency: **HUMAN GATE** (group B). Google option A needs no Google-specific code once DOCX/PDF exist; the connector is a **HUMAN GATE** (group D). Nothing here is implemented.

### 21.5 Staged recommendation (recommended, human to confirm)

1. Stage 1 - option A: Google Doc exported as DOCX (or PDF) and uploaded through the DOCX/PDF path. No Google-specific code.
2. Stage 2 - maybe option B, only if instructors report the export step as a real obstacle and the SSRF controls are accepted.
3. Stage 3 - option C only after an explicit human decision (group D): OAuth app ownership, scopes (read-only, narrowest), token storage, consent screen, threat model, and security review.

## 22. Instructor Review Workspace concept

**FUTURE DESIGN; concept only. No UI, route, or storage exists.** The workspace is where human authority is exercised: AI and code propose, the instructor decides.

For each proposed question the instructor sees:

- the question (stem, options, marked correct answer) and the correct-answer rationale;
- intended difficulty and intended cognitive level (labeled as intended, not observed);
- learning objective and topic;
- source reference with a **View source** action (the cited span in context);
- distractor rationales and misconception tags;
- deterministic warnings (lint codes with severity) and semantic warnings (critic findings, clearly separated);
- confidence and provenance (generator, versions, lint version).

Actions: **Approve**, **Edit**, **Reject**, **Regenerate**, **View source**. Batch review: filter and sort by warning severity and risk class (Section 17); approve-all is offered only for items without ERRORs, and HIGH-risk items require individual review. Approved items flow into the existing authoring lifecycle as DRAFT; the instructor still publishes through the existing path. Decisions are logged (AE-037) to produce accept/edit/reject rates (Section 18).

Open design questions (Section 27): reviewer overload limits, whether edits re-run lint automatically, and retention of rejected proposals.

## 23. Future Real-World Feedback Loop

**FUTURE DESIGN; NOT implemented. No change to FSRS, the scheduler, or mastery.** Observed learner behavior can later be compared to design intent. Signals (all derived from data the product may collect; none is collected for this purpose today):

| Signal | Used to |
|---|---|
| Observed correct rate | Compare with intended difficulty |
| Response time | Detect unusually hard or confusing items |
| Distractor selection frequencies | Identify non-functioning or over-attractive distractors |
| Unused distractors | Flag for review (never auto-delete) |
| Repeated error patterns | Surface candidate misconceptions |
| Abandonment | Detect unclear or overlong items |
| Discrimination (strong vs weak learners) | Flag items that do not separate understanding |
| Instructor edits and rejections | Quality signal for the generator and rules |

Illustrative insights (examples of what the system could eventually say, not current output): "Option D is almost never selected"; "this item performs much harder than intended"; "this item may be ambiguous"; "strong and weak learners fail it similarly"; "this distractor represents a common misconception". Intended vs observed difficulty stay separate fields (Section 7). Feeding misconception metadata into mastery is a different, deferred capability (AE-020). Small cohorts make these statistics unreliable; minimum response counts are an open decision (Section 27).

## 24. Future psychometric possibilities

**FUTURE DESIGN / SPECULATION.** Nothing here is built. Research tags use the Run's verification levels: `seen` means a bibliographic record or search summary only; `memory` means unverified recall. **Nothing was verified against full text. Numeric thresholds are conventions, not laws.**

| Possibility | Description | Tag |
|---|---|---|
| Functioning distractors | Convention of treating a distractor chosen by under about 5% of examinees as non-functioning (Tarrant, Ware, Mohammed 2009; 514 items) | SUPPORTED BY RESEARCH (`seen`, secondary); the 5% value is a convention; weak in small cohorts |
| Fewer options | Three options are generally adequate; reducing 4 to 3 left difficulty and discrimination about unchanged (Rodriguez 2005; Tarrant and Ware 2010) | SUPPORTED BY RESEARCH (`seen`, secondary) |
| Item difficulty (p-value), discrimination (point-biserial) | Classical test theory statistics from response data; review flag for low discrimination (about 0.2 is a convention) | SUPPORTED BY RESEARCH (`memory`); thresholds are conventions |
| Minimum sample | Roughly 100+ responses for stable CTT estimates | `memory`; OPEN QUESTION for UNLOCK cohort sizes |
| Distractors from student responses | Deriving misconception-based distractors from labeled student responses (Shin, Guo, Gierl 2019) | SUPPORTED BY RESEARCH (`seen` summary) |
| Validity frameworks (Kane, Messick) | Argument-based framing of what scores mean | `memory`; PRODUCT DESIGN DECISION whether to adopt |
| Item response theory | Model-based difficulty and ability estimates | SPECULATION: no source was reviewed in Run 001 |
| Pre-data difficulty prediction | Predicting difficulty from features before any responses | OPEN QUESTION (open research; Kurdi et al. 2020 `seen`: generators are weak on difficulty control) |

All of these require response volume, privacy decisions, and a human owner (AE-038, AE-039).

## 25. Cost / performance strategy

**FUTURE DESIGN. No vendor, provider, or API is chosen.** For every operation, ask in order:

1. Can code do it? Then code does it (Section 4).
2. Can it be computed once? Store the result keyed by content hash and version.
3. Can it be cached? Same content hash plus same tool version means no re-run.
4. Can it run offline or in the background rather than in a request?
5. Does it need a strong model, or would any model do? Prefer the weakest sufficient option.

Cost-shaping rules: lint before any AI call (cheap rejection first); escalate per item, never "critic on everything" (Section 17); cap repair iterations (Section 16 stage 7); bound input sizes (Section 20.4) and set sizes (AE-032).

Metrics to collect once AI is ever used (AE-035): AI calls per document and per accepted question; tokens; cost per accepted question; acceptance rate; regeneration rate; deterministic rejection rate; semantic escalation rate. They are observability, not product behavior.

## 26. Risks

**SPECULATION / OPEN QUESTION register.**

| Risk | Impact | Mitigation (design) |
|---|---|---|
| Linter thresholds are unvalidated defaults | False positives and misses; loss of instructor trust | Golden Dataset; advisory-only severity; tune from feedback |
| Prototype is mistaken for a verified feature | Overclaiming quality | Ledger statuses (Section 28); nothing is VERIFIED |
| Hostile DOCX/PDF input | DoS, data exposure | Threat-control table (21.1); caps; security review before any extractor ships |
| New dependency for PDF | Supply-chain and CVE exposure | Human gate; pinned version; CVE review |
| Hebrew extraction quality (PDF visual order, DOCX styles) | Garbled source, wrong questions | Quality warnings; mandatory human preview |
| AI errors (ungrounded or wrong keys, ambiguous items) | Wrong content reaches learners | AI proposes only; human approval; critic advisory; groundedness checks |
| AI-judge unreliability | Misplaced trust in critic | Calibrate against human labels first |
| Reviewer overload | Rubber-stamping | Risk-based routing; batch tools; limits |
| Source IP exposure | Legal and trust damage | Stateless first; IP threat model; content-blind logs |
| Bias in questions | Unfair assessment | No source found; human judgment; AE-041 |
| Scope creep into the Learning Engine | Breaks determinism | Explicit non-goal; AE-020 deferred |
| Small cohorts make psychometrics unreliable | Misleading analytics | Conventions flagged; minimum counts decided by humans |
| Vercel body limit | Large documents fail | Cap and clear message; direct-to-storage deferred (AE-044) |

## 27. Open Questions

**SPECULATION / OPEN QUESTION.** Repo questions OQ-023 (Minimal Material Model), OQ-024, and OQ-038 (human approval of AI content, DEFERRED) are not resolved here. The log below is organized by when a decision is needed. No item is decided by this document.

### 27.1 Human-decision log

| Group | When needed | Decision |
|---|---|---|
| A | Status of existing code (the prototype is already committed, so this is about its accepted status) | A1. Keep the pure linter prototype (not wired) as is, or hold/remove it. A2. Is advisory-only status acceptable until wiring is decided? A3. Keep thresholds as named defaults? |
| B | Before implementing PDF/DOCX | B1. DOCX: hand-roll vs vetted library; security review budget. B2. PDF dependency approval (candidate library, CVE review). B3. Persistence of uploads/proposal batches (OQ-023, OQ-024) or stay stateless. B4. Upload cap and transport (about 4 MB vs direct-to-storage). B5. OCR in or out of V1 (currently out). |
| C | Before using AI | C1. Whether to use AI at all. C2. Provider/SDK/model and data-handling terms. C3. Stakes level (formative vs graded) for escalation policy. C4. Budget and cost ceilings. C5. Human approval policy for AI content (OQ-038). C6. Critic calibration set and annotators. |
| D | Before a Google connector | D1. Whether to build one. D2. OAuth app ownership, scopes, consent screen. D3. Token storage and threat model. D4. Security review. |
| E | Before Pilot | E1. Content sign-off with real material (separate blocker). E2. Whether lint output is shown to Pilot instructors, and where. E3. Golden Dataset annotators and agreement protocol. E4. Which unimplemented lint codes matter for Pilot. |
| F | Post-Pilot | F1. Response-data collection scope and privacy. F2. Minimum responses before psychometrics. F3. Whether feedback may influence generation. F4. Whether any misconception-to-mastery link is wanted (AE-020). |

### 27.2 Design questions

- Which cognitive taxonomy (Section 6) and which difficulty scale (Section 7) does UNLOCK adopt?
- Should `DUPLICATE_PROMPT` (import validator) and `DUPLICATE_STEM_EXACT` be reconciled into one code?
- Where does review state (Section 22) live, and how long are rejected proposals kept?
- Are MULTIPLE_CHOICE items subject to the same rules as SINGLE_CHOICE (position, length)?
- How are Hebrew annotators recruited and their agreement measured?

## 28. Capability Ledger

**Labels: CURRENT REALITY (status of each row), FUTURE DESIGN (phases and next steps), HUMAN GATE (decisions column).** Every capability is labeled by its true status. Status vocabulary: IDEA, RESEARCHED, DESIGNED, PROTOTYPED, IMPLEMENTED, VERIFIED, DEFERRED, HUMAN_GATE, REJECTED. Nothing is IMPLEMENTED or VERIFIED. The code that exists is pure and unwired: the linter (AE-001, AE-002, AE-003; 52 tests as of RUN 001 END `a066435`, hardened in Run 002 B4), the Golden Dataset and calibration harness (AE-004, AE-033, AE-034, AE-046) and the plain-text ingestion prototype (AE-025, 15 tests) and, from Run 003, the pure blueprint validation and coverage comparison prototype (AE-011 validation part, AE-028; `docs/ASSESSMENT_BLUEPRINT_V0_1.md`). Assessment tests in total: 94 at Run 002 close (a claim about that point, not a live figure). All code is **PROTOTYPED, not wired into any flow, not verified.** Status moves only on evidence: DESIGNED never becomes IMPLEMENTED without code, and PROTOTYPED never becomes VERIFIED without evidence beyond unit tests (at minimum Golden Dataset results, Section 19). Phase values (NOW, NEXT, LATER) are recommended, human to confirm; they do not promote work. "Run 002" markers in the Next step column cite Run `2026-10-08-ASSESSMENT-ENGINE-002` work: B4 linter hardening, B5 Golden Dataset v0.1, B6 calibration and B7 plain-text ingestion prototype are DONE (evidence in the rows); integration verdict NOT_READY (Section 19).

| ID | Capability | Why | Status | Evidence / location | Limitations | Dependencies | Human decisions | Phase | Next step | Needs AI? | Code-deterministic? |
|---|---|---|---|---|---|---|---|---|---|---|---|
| AE-001 | Item-level deterministic linter (S10) | Catch structural and heuristic item flaws without AI | PROTOTYPED | `src/domain/assessment/question-lint.ts`, `text-normalize.ts`; Run 001 commits e2d55eb, 022bfed; Run 002 B4 hardening (explicit caps with truncation issues, token-based Hebrew negation and all/none, QUESTION_TYPE_UNSUPPORTED, CORRECT_IDS_TOO_MANY, contract = secondary quality linter); calibrated against the Golden Dataset; Run 003 rule fixes `2e379e2`, `cdfdcd1` (4 golden false positives removed: short-term Hebrew prefixes, contextual `חוץ`, `at least`; explicit default-prefix semantics) | Not wired into any flow; NOT VERIFIED; thresholds are product defaults; integration verdict NOT_READY (Run 003 B5 recheck: 0 FP, 0 of 18 CLEAN warn, but tuned on the same 89 synthetic cases; known recall loss on `בכל/לכל/מכל/ככל`; `שום` ambiguity; see `docs/ASSESSMENT_CALIBRATION_V0_1.md` Section 7); remaining item codes unimplemented (AE-029) | AE-003 | Where results surface (AE-031) | NOW | Residual FUB-059 items (suffix fold, position rule, short-option overlap); real-content evidence (FUB-063) before any wiring (Hebrew label review done, single reviewer); held-out v0.2 blind evaluation (Run 004; model-authored, labels not human-approved) did not change NOT_READY, see `docs/ASSESSMENT_HELDOUT_V0_2.md` | No | Yes |
| AE-002 | Set-level deterministic linter (S11) | Catch set-level bias and redundancy | PROTOTYPED | Same files and commits; SET codes incl. SET_ITEMS_TRUNCATED and SET_ANALYSIS_TRUNCATED (Run 002 B4) | As AE-001; META set checks need metadata (AE-030); KEY_POSITION_IMBALANCE is statistically noisy on small fair sets (analytic estimate, WATCH) | AE-001, AE-003 | Surface location (AE-031) | NOW | Significance-aware position rule (FUB-059) | No | Yes |
| AE-003 | Hebrew-aware comparison normalization (S10.2) | Reliable duplicate/overlap detection on Hebrew text | PROTOTYPED | `text-normalize.ts` (commits e2d55eb, 022bfed); Run 003: bounded Latin/Cyrillic/Greek lookalike fold in the duplicate key (`ee4494e`, 14 lookalikes, ADV-HOMOGLYPH-01 closed) | Exercised by Golden Dataset v0.1 (synthetic); 2-letter absolute terms (`רק`, `כל`) now accept only the conjunction `ו` as prefix (Run 003; the `מרק`/`ברק` false positives are gone, with accepted recall loss on `בכל/לכל/מכל/ככל`); inflection is still not unified; lookalike fold is bounded, not full UTS #39; Hebrew-dependent labels single-reviewer human-reviewed (Dor, 2026-10-08), no inter-annotator agreement | - | Annotator pool and protocol for dataset growth (AE-004) | NOW | Conservative suffix fold (residual FUB-059) | No | Yes |
| AE-004 | Golden Dataset design (synthetic, Hebrew-first) | Fix expected linter/critic behavior; regression base | PROTOTYPED | Section 19; `src/domain/assessment/golden/**`; `docs/ASSESSMENT_CALIBRATION_V0_1.md` (89 cases, Run 002 B5/B6 DONE; report regenerated and Run 002 vs 003 deltas, FN dispositions and a 17-row Hebrew human review queue added in Run 003, `b007952`, `7953113`) | 17 Hebrew-dependent label rows HUMAN_APPROVED by a single reviewer (Dor, 2026-10-08: 12 unchanged, 5 fixtures changed; FUB-060 RESOLVED; calibration Section 10); no inter-annotator agreement; annotator pool and protocol undecided; tiny synthetic set, not real-world, psychometric or real-course evidence | - | Annotators; protocol (group E) | NOW | Grow from real FPs/FNs and real authored items (FUB-063; a model-authored held-out v0.2 split exists, `docs/ASSESSMENT_HELDOUT_V0_2.md`; 69 of 78 labels not human-approved, 9 HUMAN_APPROVED post-evaluation by Dor 2026-10-09, FUB-065 RESOLVED for those rows only) | No | Yes |
| AE-005 | AI Necessity Matrix and escalation policy | Spend AI only where code cannot decide | DESIGNED | Sections 4, 17 | Risk thresholds are defaults; stakes level undecided | - | Stakes level (formative vs graded) | NEXT | Revisit when group C opens | Optional | Partly |
| AE-006 | Question anatomy / metadata fields | Define which metadata is core vs later | DESIGNED | Section 5 (tier decisions recorded in 5.1) | No schema or migration; none stored today | - | Which fields become persisted (OQ-023 related) | NEXT | Decide persistence shape; add LO (AE-045) | No | Yes |
| AE-007 | Pedagogical question type taxonomy | Shared vocabulary for blueprint and review | DESIGNED | Section 6 | Taxonomy choice unresolved; Anderson-Krathwohl is memory-level only | - | Taxonomy choice | NEXT | Human choice of taxonomy | No | Yes |
| AE-008 | Difficulty model v0.1 (intended vs observed) | Intended difficulty without coupling to FSRS | DESIGNED | Section 7 | No pre-data difficulty prediction is validated (open research) | AE-006 | Label scale | LATER | Wait for AE-006 and response data | Optional | Partly |
| AE-009 | Distractor model and taxonomy | Each distractor knows why it exists | DESIGNED | Section 8 | Misconception tags are metadata only | AE-006 | Taxonomy ownership | NEXT | Fold into AE-006 persistence decision | Optional | Partly |
| AE-010 | Knowledge map | Know what is worth assessing | IDEA | Section 12 | Needs semantic extraction (AI REQUIRED); no storage design. A deterministic fake map is explicitly rejected (28.3) | AE-016, AE-023, AE-024 | Instructor approval workflow | LATER | None until group C and AE-016; see 28.3 (no deterministic fake map) | Required | Partly |
| AE-011 | Assessment blueprint | Prevent coverage collapse | DESIGNED | Section 13; `docs/ASSESSMENT_BLUEPRINT_V0_1.md` Part 2 (DESIGNED: dimensions, cell shape, validation and coverage semantics, 13 resolved readings). PROTOTYPED only for the pure `validateBlueprint` (`src/domain/assessment/blueprint/blueprint.ts`, tests + 9 synthetic golden scenarios, Run 003 C3, unwired). Blueprint persistence and authoring are NOT designed, so the row stays DESIGNED | Pure validation is unwired; no persistence, authoring UI or ownership model; candidate human decisions are filed in OQ-050; optional dimensions (type, cognitive, difficulty) deliberately OUT | AE-006, AE-045 | Blueprint ownership | NEXT | Blueprint persistence and authoring shape with AE-006 and AE-045 (OQ-050, OQ-023); no AI, no fake semantic map | Optional | Partly |
| AE-012 | Duplicate / equivalence model | Detect exact to assessment-equivalent duplicates | DESIGNED | Section 14; exact/normalized/near-stem levels prototyped inside AE-002 | Semantic and assessment-equivalent levels need AI; separate from learner anti-repeat | AE-002 | None | NEXT | Surface level covered by AE-002; semantic levels wait for group C | Optional | Partly |
| AE-013 | Provenance model | Answer where a question came from | DESIGNED | Section 15 | No storage; page precision not promised | AE-016 | Storage decision (OQ-023) | NEXT | Decide with AE-006 | No | Yes |
| AE-014 | Generator / critic / review pipeline | End-to-end engine contract | DESIGNED | Section 16 | Only stage 5 (lint) has a prototype; no stage is wired | AE-001, AE-016 | Per-stage human gates | LATER | None | Optional | Partly |
| AE-015 | Evaluation framework (profile) | No opaque single score | DESIGNED | Section 18 | No harness; metrics not collected | AE-004 | AI-judge calibration | LATER | After AE-033/AE-034 | Optional | Partly |
| AE-016 | Content Ingestion layer architecture | Separate async layer for binary sources | DESIGNED | Section 20 (the AE-025 plain-text prototype is the only related code) | Architecture only; no persisted or wired ingestion layer; entity names not mandated | - | Persistence (OQ-023/024); upload transport | NEXT | Use AE-025 evidence; DOCX decision first (FUB-056) | No | Yes |
| AE-017 | Authenticated Google Docs/Drive connector (option C) | Direct import from Google | HUMAN_GATE | Section 21.3 | Repo has email/password auth only; needs OAuth app, scopes, token storage, threat model | AE-016 | Group D decisions | LATER | Human gate | No | Yes |
| AE-018 | Instructor review workspace | Human authority at publication | IDEA | Section 22 | Design concept only; no UI | AE-022, AE-036 | Review policy | LATER | None | No | Yes |
| AE-019 | Real-world feedback loop | Compare intended vs observed quality | IDEA | Section 23 | Needs response volume; no schema; no FSRS change allowed | AE-038 | Analytics scope, privacy | LATER | None | No | Yes |
| AE-020 | Misconception-to-mastery inference | Possible learner modeling | DEFERRED | Out of scope; Learning Engine untouched | Would alter the Learning Engine; no accepted decision | - | Product/ADR decision | LATER | None | No | Partly |
| AE-021 | Semantic critic / AI escalation execution | Judge grounding and ambiguity | IDEA | Section 17 | No provider, SDK, or call chosen; judge reliability uncalibrated | AE-005, AE-004 | Group C decisions | LATER | Human gate (group C) | Required | No |
| AE-022 | Proposal-batch confirm path | Replace raw-text re-parse for engine path | IDEA | Sections 16, 20 | Current confirm re-sends raw text; not changed | AE-036 | Persistence decision | NEXT | Blocked on AE-036 | No | Yes |
| AE-023 | DOCX text extractor (bounded, hand-rolled) | First non-text source; no new dependency | DESIGNED | Section 21.1 | Not implemented; needs hostile-input tests and security review | AE-016 | Hand-roll vs vetted library; security review budget (group B) | NEXT | Human gate, then after plain-text evidence (AE-025) | No | Yes |
| AE-024 | PDF text extractor (text-only, no OCR) | Common instructor source format | HUMAN_GATE | Section 21.2 | Needs a vetted library (new dependency); Hebrew visual-order caveats | AE-016 | Dependency approval (group B) | LATER | Human gate | No | Yes |
| AE-025 | Plain-text paste ingestion | Lowest-risk source, no binary parsing | PROTOTYPED | Section 20; `src/domain/ingestion/plain-text.ts` (`normalizePlainText`; 15 unit tests; Run 002 B7 DONE) | Pure; UTF-16 offsets into the original; rejection caps; markdown-ATX headings only; not wired, not persisted, no UI or route; names not mandated; NOT VERIFIED | AE-016 | None | NOW | None until the ingestion seam is decided (AE-016, AE-036) | No | Yes |
| AE-026 | Google option A: export DOCX/PDF then upload | Google content with no OAuth | DESIGNED | Section 21.3 | Manual instructor step; no provenance link to the Google file | AE-023, AE-024 | None beyond AE-023/024 | NEXT | Follows AE-023/024 | No | Yes |
| AE-027 | Google option B: public/shareable link fetch | Convenience without OAuth | DEFERRED | Section 21.3 | Server-side fetch of user URLs (SSRF risk); weak permissions model | AE-016 | Group D decisions | LATER | None | No | Yes |
| AE-028 | Blueprint coverage checker | Verify cells filled and limits respected | PROTOTYPED | Sections 11, 13; `compareCoverage` in `src/domain/assessment/blueprint/blueprint.ts` (Run 003 C3): pure deterministic UNDER/OVER/OK per cell, total status, unallocated and unlinked items, coverage ratio, topic roll-up; tests + 9 synthetic golden scenarios; design in `docs/ASSESSMENT_BLUEPRINT_V0_1.md` Part 2 | Counts only, over caller-supplied inputs; not wired; no persisted blueprint or Question->LO association exists; never judges whether a linked question tests its objective or whether counts are right | AE-011, AE-030 | None | LATER | Wire only after AE-006 persistence and AE-031 decisions (OQ-050 precedence vs `TOPIC_CONCENTRATION`) | No | Yes |
| AE-029 | Remaining unimplemented lint codes | Complete the designed non-META checks | DESIGNED | Sections 10.3, 11.1 | Not implemented: STEM_NO_QUESTION_FORM, STEM_DOUBLE_NEGATIVE, OPTION_COMBINATION_REFERENCE, OPTION_STYLE_OUTLIER, OPTION_PREFIX_STEM_REPEAT, ARTICLE_MISMATCH, OPTION_NUMERIC_UNORDERED, OPTION_COUNT_UNUSUAL, OPTION_PUNCTUATION_INCONSISTENT, EXPLANATION_NAMES_ONLY_KEY, NEAR_DUPLICATE_ITEM, SET_OPTION_COUNT_MIXED, ALL_OR_NONE_OVERUSE, QUESTION_TYPE_MONO | AE-001, AE-002 | Which to prioritize | NEXT | Prioritize after calibration (AE-046); do not add before Golden cases exist | No | Yes |
| AE-030 | META lint checks (provenance, topic, objective, cognitive, difficulty, coverage) | Coverage/bias checks over metadata | DESIGNED | Sections 10.3, 11.1 | Metadata does not exist today; checks no-op without it | AE-006 | Metadata persistence | LATER | None | No | Yes |
| AE-031 | Lint wiring into import validator; reconcile with DUPLICATE_PROMPT | Make lint results visible to instructors | IDEA | Sections 11.1, 16 | Not wired; code-name reconciliation undecided; no UI | AE-001, AE-002, AE-033, AE-046 | Where and how shown; blocking vs advisory | NEXT | Gated on Golden Dataset and calibration (28.3); Run 003 B5 recheck verdict NOT_READY (calibration Section 4); no wiring | No | Yes |
| AE-032 | Set-size cap MAX_LINT_SET_ITEMS | Bound batch lint cost (pairwise comparisons) | PROTOTYPED | `question-lint.ts` (Run 002 B4 DONE): item cap with explicit SET_ITEMS_TRUNCATED and SET_ANALYSIS_TRUNCATED issues; hostile 2001-item case in the Golden Dataset | Cap value is a default; unwired | AE-002 | Cap value | NOW | None | No | Yes |
| AE-033 | Golden dataset fixtures (code) | Regression base for lint changes | PROTOTYPED | Section 19; `src/domain/assessment/golden/**` (89 cases; Run 002 B5 DONE); `docs/ASSESSMENT_CALIBRATION_V0_1.md` | Hebrew-dependent labels single-reviewer human-reviewed (Dor, 2026-10-08; FUB-060 RESOLVED), no inter-annotator agreement; synthetic only; indicative ratios, not statistics | AE-004 | Annotators | NOW | Real authored items (FUB-063; a model-authored held-out v0.2 split now exists, `docs/ASSESSMENT_HELDOUT_V0_2.md`, not real items; 9 of 78 labels human-approved post-evaluation, 69 model-only) | No | Yes |
| AE-034 | Evaluation harness | Precision/recall per check code | PROTOTYPED | Section 18.1; `src/domain/assessment/golden/calibration.ts` (`runCalibration`; per-check precision-like/recall-like counts, no single score) | Linter-only; no critic or AI-judge evaluation; tiny fixture | AE-033 | None | LATER | Extend when a critic exists | Optional | Partly |
| AE-035 | Cost and acceptance metrics | Cost per accepted question, escalation rate | DESIGNED | Section 25 | No collection; no AI in use | AE-021, AE-037 | Metrics privacy | LATER | None | No | Yes |
| AE-036 | Proposal-batch persistence | Server-held batch for review and confirm | IDEA | Sections 16, 20 | Storage undecided (OQ-023, OQ-024 OPEN); IP threat model applies | - | Persistence and retention (group B) | NEXT | Human decision | No | Yes |
| AE-037 | Instructor decision log (approve/edit/reject) | Live quality signal and training data | IDEA | Section 22 | No storage | AE-036 | Retention policy | LATER | None | No | Yes |
| AE-038 | Item psychometrics (CTT-style statistics) | Observed difficulty and discrimination | IDEA | Section 24 | Needs response volume; conventions only | AE-019 | Min responses; privacy | LATER | None | No | Yes |
| AE-039 | Distractor effectiveness analysis | Flag non-functioning distractors for review | IDEA | Sections 23, 24 | Review flag only, never auto-delete; small cohorts unreliable | AE-038 | Threshold policy | LATER | None | No | Yes |
| AE-040 | OCR for scanned PDFs | Support image-only documents | DEFERRED | Section 21.2 | Out of V1; new dependency/cost; Hebrew OCR quality unknown | AE-024 | Group B decision | LATER | None | Optional | No |
| AE-041 | Question-writing bias screen | Fairness of wording | IDEA | Sections 9, 26 | No source found in Run research; needs human judgment | - | Policy owner | LATER | None | Optional | No |
| AE-042 | AI question generator | Draft items from blueprint cells | IDEA | Section 16 stage 4 | No provider chosen; AI proposes only; instructor approves | AE-011, AE-010 | Group C decisions | LATER | Human gate (group C) | Required | No |
| AE-043 | Repair / regeneration loop | Fix flagged items within bounded retries | IDEA | Section 16 stage 7 | Depends on generator and lint | AE-042, AE-001 | Retry bound | LATER | None | Required | Partly |
| AE-044 | Direct-to-storage upload for large files | Exceed the ~4 MB function body limit | DEFERRED | Section 20 | Needs storage and signed-URL design | AE-016, AE-036 | Storage decision | LATER | None | No | Yes |
| AE-045 | Learning Objectives (instructor-authored metadata) | Give items and blueprint a human-owned target; enables OBJECTIVE_* checks | DESIGNED | Sections 5, 13; `docs/ASSESSMENT_BLUEPRINT_V0_1.md` Part 1 (Run 003 C1: identity, one required Topic, archive lifecycle, Question->LO direction, invariants; design only) | Persistence model NOT designed; no storage or UI; taxonomy, versioning of the Question->LO link, cross-topic, roles unresolved (OQ-050) | AE-006 | Who owns objectives; persistence | NEXT | Persistence and association versioning with AE-006 (OQ-050, OQ-023) | No | Yes |
| AE-046 | Linter threshold calibration | Replace unvalidated defaults with Golden-Dataset-informed values | PROTOTYPED | Section 19; `docs/ASSESSMENT_CALIBRATION_V0_1.md` Section 3 (Run 002 B6 DONE): no threshold CHANGE; WATCH for key-position imbalance and run (analytic, high priority) and several others; the rest KEEP-provisional | Synthetic data only, so not proof of real-world precision; thresholds remain provisional product defaults | AE-033, AE-001 | Acceptable false-positive rate (group E) | NOW | Model-authored held-out v0.2 evaluated blind in Run 004 (`docs/ASSESSMENT_HELDOUT_V0_2.md`, no threshold changed); re-run on real content once available (FUB-063); residual FUB-059 | No | Yes |

### 28.1 Status distribution

| Status | Before Run 002 (44) | After Run 002 doc reconciliation (46) | After Run 002 code evidence (46) | After Run 003 (46) |
|---|---|---|---|---|
| IDEA | 18 | 20 | 15 | 13 |
| RESEARCHED | 0 | 0 | 0 | 0 |
| DESIGNED | 17 | 17 | 16 | 17 |
| PROTOTYPED | 3 | 3 | 9 | 10 |
| IMPLEMENTED | 0 | 0 | 0 | 0 |
| VERIFIED | 0 | 0 | 0 | 0 |
| DEFERRED | 4 | 4 | 4 | 4 |
| HUMAN_GATE | 2 | 2 | 2 | 2 |
| REJECTED | 0 | 0 | 0 | 0 |
| **Total** | **44** | **46** | **46** | **46** |

Phase distribution (recommended, human to confirm): before NOW 3, NEXT 17, LATER 24; after doc reconciliation NOW 8, NEXT 15, LATER 23 (unchanged after code evidence and after Run 003).

| Phase (after Run 003) | IDEA | DESIGNED | PROTOTYPED | DEFERRED | HUMAN_GATE | Total |
|---|---|---|---|---|---|---|
| NOW | 0 | 0 | 8 | 0 | 0 | 8 |
| NEXT | 3 | 12 | 0 | 0 | 0 | 15 |
| LATER | 10 | 5 | 2 | 4 | 2 | 23 |

Counts were taken by counting ledger rows. Status changes in Run 002 were driven by code evidence only (see 28.4): AE-004 DESIGNED -> PROTOTYPED and AE-025, AE-032, AE-033, AE-034, AE-046 IDEA -> PROTOTYPED. The doc-reconciliation column kept IDEA +2 from the two new entries (AE-045, AE-046). Run 003 column: AE-045 IDEA -> DESIGNED (design doc Part 1) and AE-028 IDEA -> PROTOTYPED (pure `compareCoverage`), counted from the table. Nothing is IMPLEMENTED or VERIFIED.

### 28.2 How to query this ledger

- **Is it built?** Look for status PROTOTYPED, IMPLEMENTED, or VERIFIED. Today the PROTOTYPED rows are AE-001, AE-002, AE-003, AE-004, AE-025, AE-028, AE-032, AE-033, AE-034 and AE-046 (all pure and unwired; AE-011 is DESIGNED with only its pure validation prototyped); nothing is IMPLEMENTED or VERIFIED.
- **Is it only designed?** Status DESIGNED or IDEA. DESIGNED means a concrete design exists in this document; IDEA means a direction without a worked design.
- **Does it need research?** Read Limitations and Section 24; statuses are never upgraded on `seen` or `memory` sources, and no capability is RESEARCHED yet.
- **Is it deferred?** Status DEFERRED (AE-020, AE-027, AE-040, AE-044).
- **Does it need Dor?** Status HUMAN_GATE, or any non-trivial entry in the Human decisions column (cross-reference the groups A-F in Section 27.1).
- **Does it need AI?** Column "Needs AI?": No, Optional, or Required. **Is it deterministic in code?** Column "Code-deterministic?": Yes, Partly, or No.

### 28.3 Resequencing review (Run 002, B2) - PRODUCT DESIGN DECISION, human to confirm

**Hypothesis 1: the Golden Dataset should precede wiring heuristic warnings into instructor-facing flows. Verdict: ACCEPTED.** The warnings are heuristics with unvalidated thresholds and known Hebrew false positives (10.2). Showing them to Pilot instructors uncalibrated risks early loss of trust, and nothing yet measures their precision. The structural ERROR codes largely duplicate the existing import validator/publish gate, so wiring them adds little before calibration. Consequences: AE-004/AE-033 (v0.1) and AE-046 (calibration) move to NOW; AE-031 stays NEXT and now depends on them plus a human decision on where lint is shown (groups A and E). Developer-side use (scripts, tests, offline reports) does not need to wait. This does not make the linter VERIFIED: a synthetic dataset gives regression evidence, not real-world precision.

**Hypothesis 2: Knowledge Map, Learning Objectives, Blueprint and Coverage should move from LATER to NEXT, before AI generation. Verdict: PARTLY ACCEPTED, decided per item.**

| Item | Decision | Rationale |
|---|---|---|
| Learning Objectives (AE-045, new) | NEXT (design-level) | Instructor-authored, no AI needed; unlocks OBJECTIVE_* checks and the blueprint. Needs a persistence decision (OQ-023 related). |
| Assessment Blueprint (AE-011) | LATER -> NEXT (design-level, instructor-authored) | Allocation arithmetic and conformity checks are deterministic. It can be designed against Topics and LOs without a knowledge map. No code or schema is promoted. |
| Coverage checker (AE-028) | stays LATER | Needs blueprint, metadata and persistence (AE-006, AE-030); nothing to check yet. |
| Knowledge Map (AE-010) | stays LATER | Extraction is AI REQUIRED (Section 4). A deterministic "map" (keyword/heading extraction) would be a fake semantic map presenting surface structure as meaning, so it is rejected, not deferred. Without ingestion (AE-016) and persistence there is no input or home for it. |
| AI generation (AE-042) | stays LATER | Group C is unresolved. Ordering "map and blueprint before generation" already holds through dependencies (AE-042 depends on AE-010 and AE-011), so promoting the map would only pull semantic work forward without a consumer. |

**Next safe proof step (NEXT-Run candidate, human to confirm).** A design-only, instructor-authored Blueprint schema plus Learning Objectives model (AE-011, AE-045): no AI, no fake semantic map, no schema or migration promoted until a persistence decision (AE-006). The Knowledge Map (AE-010) and Coverage checker (AE-028) verdicts above are unchanged.

### 28.4 Changes in Run 002 (ledger log)

- Added the Next step column; reviewed all 44 rows for status, evidence, dependency, next step and human gate; no status was changed (nothing was promoted).
- Added AE-045 (Learning Objectives, IDEA, NEXT) and AE-046 (linter threshold calibration, IDEA, NOW).
- Phase changes: AE-004, AE-032, AE-033, AE-025 NEXT -> NOW (Run 002 work; since DONE as prototypes, see below); AE-011 LATER -> NEXT (design-level only).
- AE-031 now depends on AE-033 and AE-046. AE-006 notes the Section 5.1 tier decisions. AE-023 sequenced after plain-text evidence.
- DONE in Run 002 (evidence in the rows): B4 hardening (AE-001, AE-002, AE-032), B5 Golden Dataset v0.1 (AE-033, AE-004), B6 calibration (AE-046, AE-034 harness), B7 plain-text ingestion prototype (AE-025).
- Status changes on code evidence: AE-004 DESIGNED -> PROTOTYPED; AE-025, AE-032, AE-033, AE-034, AE-046 IDEA -> PROTOTYPED. Nothing became IMPLEMENTED or VERIFIED. AE-001/AE-002/AE-003 stay PROTOTYPED. Integration verdict: NOT_READY (AE-031 stays gated).

### 28.5 Changes in Run 003 (ledger log)

Run `2026-10-08-ASSESSMENT-ENGINE-003`. Pointers only; details live in the owning docs.

- Linter rule fixes and calibration re-run (AE-001, AE-003, AE-004, AE-046): evidence in `docs/ASSESSMENT_CALIBRATION_V0_1.md` Sections 4, 7-10 (readiness recheck: NOT_READY; 17-row Hebrew review queue). Homoglyph fold under AE-003. No status change.
- Hebrew human review (Run 2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001): all 17 queued rows human-reviewed by Dor on 2026-10-08 (12 approved, 5 fixtures changed and applied, calibration regenerated, 89 cases and totals unchanged); FUB-060 RESOLVED; integration verdict still NOT_READY. Single reviewer, synthetic fixture; no HUMAN_GATE row existed for this review and no AE status changed (counts unchanged).
- Learning Objectives and Blueprint design plus pure prototype (AE-045, AE-011, AE-028): `docs/ASSESSMENT_BLUEPRINT_V0_1.md`. AE-045 IDEA -> DESIGNED; AE-028 IDEA -> PROTOTYPED; AE-011 stays DESIGNED (blueprint persistence/authoring not designed). Candidate human decisions filed as OQ-050.
- Nothing is IMPLEMENTED or VERIFIED; nothing is wired.

## 29. What was implemented in Run 001

**RUN 001 OUTPUT** (historical inventory, RUN 001 END `a066435`). Run `2026-10-08-ASSESSMENT-ENGINE-NIGHT-001`. The Run report owns details; Run 002 changes are not listed here (see 28.4).

- This document, `docs/ASSESSMENT_ENGINE.md` (Sections 1-30), including the Capability Ledger. Commits 1536181 (Sections 1-19) and the commit that adds Sections 20-30.
- A **pure deterministic linter prototype**: `src/domain/assessment/question-lint.ts` and `text-normalize.ts`, with 52 unit tests (commits e2d55eb, then hardening 022bfed after review: ReDoS, totality, caps). It implements 10 item ERROR codes, 11 item WARNING codes, and 8 set WARNING codes (Sections 10, 11). It is **not wired** into any import, publish, API, or UI flow; it makes no AI call; it is **PROTOTYPED, not VERIFIED**.
- Research and feasibility notes were folded into Sections 4-27 (research claims keep their `seen`/`memory` levels; nothing was verified against full text).
- **Pilot UX gate: PARTIAL.** No known UX defect justifies blocking a controlled Pilot; no P0/P1 UX defects are recorded; open items are P3/WATCH only. Human checks remain (real devices on current Production, induced 401, instructor walk-through on Production, content sign-off).
- **Q3 accessibility gate: PARTIAL.** Local automated pass (mocked API, dev server) over 39 probe and 40 extra page configurations; no new P0-P2 findings; WATCH Q3-F3 (headings) and Q3-F4 (small instructor targets) reconfirmed. Not verified: screen readers, physical devices, production, other browsers, zoom/text-resize, contrast ratios.

No Learning Engine, FSRS, scheduler, mastery, schema, API, or UI change was made for the Assessment Engine. No push was performed.

## 30. What remains

**FUTURE DESIGN. All items below are recommended, human to confirm; nothing is autonomously promoted.** Reconciled in Run 002 to match ledger phases (Section 28); the ledger is authoritative if they differ.

| Phase | Work (ledger ids) |
|---|---|
| NOW | Run 002 work is DONE as prototypes (linter hardening and set cap AE-001/002/032; Golden Dataset v0.1 AE-004/033; calibration AE-046; plain-text ingestion AE-025). Run 003 added rule fixes and re-calibration (AE-001/003/046; verdict still NOT_READY). Remaining in this phase: residual linter items (FUB-059), real-content evidence (FUB-063; a model-authored held-out v0.2 split was evaluated blind in Run 2026-10-09-ASSESSMENT-ENGINE-004, verdict still NOT_READY). The native-Hebrew label review (FUB-060) was done by a single reviewer on 2026-10-08 (Run 2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001); verdict still NOT_READY. Human decision on group A (status of the prototype) and where its output would surface. |
| NEXT | Wire lint into the import validator and reconcile `DUPLICATE_PROMPT` (AE-031), only after Golden Dataset and calibration; the remaining non-META lint codes (AE-029); Learning Objectives and blueprint persistence/authoring decisions (AE-045, AE-011; design and pure prototype exist from Run 003, OQ-050); metadata persistence decision (AE-006, AE-013); DOCX extractor after the group B decision (AE-023); proposal-batch persistence decision (AE-036, AE-022); ingestion layer scaffolding (AE-016); Google option A guidance (AE-026). |
| LATER | PDF extractor after dependency approval (AE-024); knowledge map (AE-010) and wiring the coverage checker (AE-028; pure prototype exists); AI generation and critic after group C (AE-021, AE-042, AE-043); review workspace and decision log (AE-018, AE-037); evaluation harness and cost metrics (AE-034, AE-035); feedback loop and psychometrics (AE-019, AE-038, AE-039); Google connector after group D (AE-017); OCR and large-file upload (AE-040, AE-044). |

Remaining human gates for the Pilot are tracked in the Run report and Section 27.1 (group E), not restated here.

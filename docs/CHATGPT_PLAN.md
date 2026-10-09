# UNLOCK — ASSESSMENT-ENGINE-005 — FUB-064 OPTION_COMBINATION_REFERENCE

PLAN_VERSION: 035
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-005
START_HEAD: `db5bfc7`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `eccfd75`
STATUS: **COMPLETE + STOP** — Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/UI or import wiring.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Resolve FUB-064: EVIDENCE → CONTRACT → PRE-REGISTERED TESTS → IMPLEMENTATION IF JUSTIFIED → EVALUATION → REVIEW → CLOSE. Deterministic, narrow, advisory. No AI, no semantic model.

## 2. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Read-only evidence audit (HO-026/027/064, v0.1 WEAK-COMBINATION-EN-01, counterexamples) + Decision Gate A | — | DONE: IMPLEMENT |
| B | Contract (below) + pre-registered contract tests, committed BEFORE implementation (`b66c59e`) | — | DONE |
| C | Implement in `question-lint.ts` | REVIEW_GATE | DONE |
| D | Evaluation (v0.1, v0.2, 9 human-reviewed), Decision Gate B: KEEP | — | DONE |
| Z | Review, verification, docs, Run close | FINAL_GATE | DONE |

## 3. Evidence (Slice A)
- HO-026 (HE, SINGLE_CHOICE): option d "תשובות א ו-ג נכונות" — cue "תשובות" + Hebrew letters א, ג (positional ids a, c). Tokens: תשובות / א / ו-ג / נכונות.
- HO-027 (EN, SINGLE_CHOICE): option d "Both a and c". HO-064 (EN, MULTIPLE_CHOICE): option d "Both a and b" (also marked correct with a and b). v0.1 WEAK-COMBINATION-EN-01: "Both A and B".
- Structural and deterministic: the option text names other options by id/letter, so it is meaningless under shuffling (position-dependent), lets a test-taker eliminate by option interplay without subject knowledge (cueing/dependence, not style), and in select-all items is incoherent. Smallest sufficient syntax: combination cue + at least two references to other options of the same item.
- False-positive families: bare "and"/"ו"/"או"; single letters in ordinary text (ויטמין A, "Vitamins A and C"); "option A of the protocol"; lists of two concepts; "כל"/"שום"/"תמיד"; stem/answer overlap; "all/none of the above" (own codes).
- Counterexamples: to be measured in Slice D by running the unchanged corpora (v0.1 89, v0.2 78), not only read.
- **Decision Gate A: IMPLEMENT** (clear structural family; expressible without semantics; narrow trigger; adds signal beyond OPTION_ALL/NONE_OF_ABOVE; negative set available).

## 4. Contract (fixed before code)
**A. Target.** An option whose text is a reference to a combination of OTHER options of the same item (e.g. "Both a and c", "תשובות א ו-ג נכונות").
**B. Positive shape (per non-blank option, over the existing `tokenize` output, no new normalization).** The token list must contain, in this order: optional filler words, ONE cue token, a run of at least TWO distinct reference tokens (optionally joined by "and"/"or"/"and/or"/"או", Hebrew vav prefix on a reference such as "ו-ג"/"וב", or plain adjacency from a comma), then optional filler words. Nothing else may appear (so the option must be wholly a reference phrase).
- Cue tokens (whole token): EN both, option, options, answer, answers, choice, choices; HE תשובה, תשובות, אפשרות, אפשרויות and the definite forms התשובות, האפשרויות (שניהם / שתי are NOT cues).
- Reference token: a single Latin letter a–h, or a single Hebrew letter א–ח (optional vav prefix, optional hyphen); bare "ו" is a joiner, never a reference. A reference resolves to another option by (1) case-insensitive equality with that option's id, else (2) its ordinal letter position (a/א = first). It must resolve to an existing option other than the option itself; all references in the run must resolve.
- Filler (closed list). EN: the, of, are, is, only, correct, true, right, together. HE: נכונות, נכונים, נכונה, נכון, בלבד, הן, הם.
**C. Non-targets.** Bare and/or/ו/או; "כל", "שום", "תמיד" and other absolute-term content; stem/answer lexical overlap; symmetric wording across options; lists of two substantive concepts; math/logic conjunctions with no cue+reference; an ordinary letter א/ב or A in text without a cue ("ויטמין A ו-C", "Vitamins A and C"); cue + one reference only; cue + references followed by extra content words ("Both A and C vitamins"); "all/none of the above" (stay OPTION_ALL/NONE_OF_ABOVE; no double report). Known uncovered: ordinal phrases ("the first two answers"), cue-less "A and B only", numeric references.
**D. Scope.** Both SINGLE_CHOICE and MULTIPLE_CHOICE (and type-independent): a reference to other options is structurally dependent in either type; a legitimate multi-answer item does not name other options and is not flagged. Not coupled to correctness.
**E. Severity.** WARNING, scope ITEM, advisory (existing policy). Issue echoes the referencing option ids/positions only (content-blind).
**F. Normalization.** Reuse `tokenize` unchanged; no change to `text-normalize.ts`.
**Complexity.** O(options × tokens), bounded by the existing option/text caps; no regex backtracking.

## History

- ASSESSMENT-ENGINE-005: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-005.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-003.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002.md`
- ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001.md`
- BROWSER-ISOLATION-STUDY-001: `docs/RUNS/2026-10-09-BROWSER-ISOLATION-STUDY-001.md`
- DESIGN-AUDIT-FOLLOWUP-001: `docs/RUNS/2026-10-09-DESIGN-AUDIT-FOLLOWUP-001.md`
- ASSESSMENT-ENGINE-004: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-004.md`
- ASSESSMENT-ENGINE-HEBREW-REVIEW-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-HEBREW-REVIEW-001.md`
- ASSESSMENT-ENGINE-003: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-003.md`
- ASSESSMENT-ENGINE-002: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-002.md`
- ASSESSMENT-ENGINE-NIGHT-001: `docs/RUNS/2026-10-08-ASSESSMENT-ENGINE-NIGHT-001.md`
- Q3-A11Y-NIGHT-001: `docs/RUNS/2026-10-08-Q3-A11Y-NIGHT-001.md`

# UNLOCK — ASSESSMENT-ENGINE-006 — FUB-066 Context-Sensitive Warning Hardening

PLAN_VERSION: 037
RUN_ID: 2026-10-09-ASSESSMENT-ENGINE-006
START_HEAD: `477df82`
RUN_STATUS: COMPLETE
LAST_VERIFIED_HEAD: `92c51cb`
STATUS: **COMPLETE — STOP.** Run report: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-006.md`. Local only. No push/merge/deploy/tag/hosted mutation/migration/dependency change/AI API call/UI or import wiring.

This file is CURRENT EXECUTION ONLY. Historical plan bodies live in `docs/RUNS/**` (see "History").

## 1. Goal
Resolve FUB-066: EVIDENCE AUDIT → FAILURE TAXONOMY → PER-RULE CONTRACT → PRE-REGISTERED TESTS → MINIMAL HARDENING IF JUSTIFIED → EVALUATION → HUMAN/SEMANTIC ROUTING → CLOSE. Targets: OPTION_ABSOLUTE_TERM, KEY_STEM_LEXICAL_OVERLAP, STEM_TOO_SHORT. Non-implementation outcomes (KEEP/NARROW/SPLIT/SEMANTIC_ONLY/DROP) are valid. Precision over recall. No threshold tuning against v0.2; no change to the frozen corpus, the human overlay, or the historical FIRST_BLIND record.

## 2. Slices
| Slice | Scope | Gate | Status |
|---|---|---|---|
| A | Read-only evidence audit + failure taxonomy + Decision Gate A | AUTO | DONE |
| B | Per-rule contract (section 5) + pre-registered tests (separate commit, PRE_REGISTERED_TEST_HEAD = the commit that adds section 5) for rules kept deterministic | AUTO | DONE |
| C | Minimal implementation per Gate A (only if justified) | REVIEW_GATE | DONE |
| D | Evaluation (contract, v0.1, CURRENT_LINTER_ON_FROZEN_V0_2, POST_HUMAN), human-consistency check, Decision Gate B | AUTO | DONE |
| Z | Review, verification, docs, Run close | FINAL_GATE | DONE |

## 3. Accepted human principles (hard constraints)
Token != flaw; symmetry across options is not a cue (HO-017); content-essential quantifiers are not cues (HO-063); natural Hebrew "שום" is not an absolute cue (HO-015); lexical overlap != leakage (HO-076 item 1); short completion stems ending ":" are valid (HO-032).


## 4. Decision Gate A (Slice A audit; decided by parent from audit evidence + accepted human principles)
Audit basis: per-rule metrics (not pooled), CURRENT_LINTER_ON_FROZEN_V0_2 / POST_HUMAN / v0.1: OPTION_ABSOLUTE_TERM 9/0/1/6 and 7/0/4/5 (v0.1 3/0/0); KEY_STEM_LEXICAL_OVERLAP 0/1/0/3 and 0/1/1/2 (v0.1 4/1/0); STEM_TOO_SHORT 2/0/1/7 and 2/0/1/7 (v0.1 1/0/0). Guards are justified by the human principles (symmetry, content-essential, natural form, overlap != leakage), not by v0.2 scores; no number is tuned on v0.2; any claim is CONTRACT_TEST + regression only, never fresh validation.
- **OPTION_ABSOLUTE_TERM → SPLIT.** Deterministic: strong frequency/totality adverbs only (always, never, תמיד, לעולם, אף פעם, completely, entirely, בהכרח) in a DISTRACTOR option, only when not every option carries a strong term and the key carries none. Weak quantifier/exclusive tier (כל, שום, רק, בלבד, all, only, every, none, אף אחד) leaves deterministic ownership → HUMAN_REVIEW / AI_OPTIONAL (content-essential vs cue-like).
- **KEY_STEM_LEXICAL_OVERLAP → MOVE_TO_SEMANTIC/HUMAN (stop deterministic emission).** No natural held-out true positive exists (0 TP; HO-076 item1 human-FORBIDDEN, item9/HO-051 contested); the only surviving guard is a share threshold tuned from peeked evidence. Route: AI_REQUIRED / HUMAN_REVIEW. Cost accepted: v0.1 authored positives (3) become misses.
- **STEM_TOO_SHORT → NARROW_DETERMINISTICALLY.** Do not fire for a short stem that begins with a closed-class interrogative (or imperative) word, or ends with ":" (HO-032 form). Still fires for bare nouns/fragments. General brevity concern → HUMAN_REVIEW. The 4-word constant is not changed.

## 5. Contracts (fixed before code)
Pre-registered tests: `src/domain/assessment/__tests__/context-sensitive-warnings.test.ts` (CONTRACT_TEST evidence only; not fresh validation; no tuning against v0.2). All three rules reuse `tokenize` / the existing term-matching helpers unchanged; no change to `text-normalize.ts`. All remain WARNING, scope ITEM, advisory, with the existing content-blind issue shape.

### 5.1 OPTION_ABSOLUTE_TERM (SPLIT)
- **TARGET.** A distractor option carrying a strong frequency/totality adverb (a common wrong-option cue) when the key carries none.
- **POSITIVE SHAPE.** Strong list (whole-token; existing prefix tolerance for the 3+ letter Hebrew terms unchanged): always, never, completely, entirely, תמיד, לעולם, אף פעם, בהכרח. Option i is flagged iff i is NOT a correct option and carries a strong term. The issue fires only if (a) at least one option is flagged, (b) NO correct option carries a strong term, and (c) NOT every non-blank option carries a strong term. The issue lists the flagged option ids/positions (existing `optRefs` shape).
- **NON-TARGETS.** Weak tier never triggers this code: כל, שום, רק, בלבד, only, all, every, none, אף אחד (HO-015 natural "שום"; HO-063 content-essential "כל"; mathematical/universal propositions; ordinary quantifiers). Strong term only in the key; in key AND a distractor; in any correct option of a multiple-choice item; in every option (symmetry, HO-017). "All/none of the above" stay under their own codes. Words merely containing a strong term.
- **QUESTION TYPES.** SINGLE_CHOICE and MULTIPLE_CHOICE; "correct" is the item's correct option set. If no correct option resolves, the code does not fire (fail closed).
- **SEVERITY.** WARNING, ITEM.
- **NORMALIZATION.** `tokenize` + existing `containsTerm`; strong list is a subset of the current list; no new normalization.
- **KNOWN LIMITS.** Misses weak-tier cue-like use ("רק", "all", "only" used as a genuine cue) and strong adverbs in otherwise symmetric items; accepted recall loss (v0.1 authored weak-tier positives become misses). A strong adverb that is legitimate content in a distractor is still flagged (content-blind). **ROUTING.** Weak tier and content-essential vs cue-like judgments: HUMAN_REVIEW / AI_OPTIONAL.

### 5.2 KEY_STEM_LEXICAL_OVERLAP (NO-EMIT)
- **TARGET.** None deterministic. The rule stops emitting (the code stays in the code type for history/consumers).
- **POSITIVE SHAPE.** None: for every input, no KEY_STEM_LEXICAL_OVERLAP issue is produced.
- **NON-TARGETS.** Everything: key near-restating the stem with zero-overlap distractors; natural entity repetition (HO-076 item 1); a domain term repeated in all options; vocabulary shared by several options; science/biology terminology; multiple choice.
- **QUESTION TYPES / SEVERITY.** n/a.
- **NORMALIZATION.** n/a (overlap helpers/constants become unused for this rule; removal vs retention is a Slice C cleanup decision with no behavior effect).
- **KNOWN LIMITS.** v0.1 authored positives (3) become misses; no deterministic stem-leakage signal remains. **ROUTING.** AI_REQUIRED (restatement giveaway vs natural reuse) / HUMAN_REVIEW.

### 5.3 STEM_TOO_SHORT (NARROW)
- **TARGET.** A bare noun phrase or fragment used as a stem: non-empty, fewer than `STEM_MIN_WORDS` (4, unchanged) whitespace-separated words.
- **POSITIVE SHAPE.** Word count 1..3 AND not exempt. Exempt (never flagged) if either:
  1. the trimmed prompt ends with ASCII ':' (HO-032 completion form);
  2. the FIRST whitespace-delimited word, after stripping leading/trailing non-letter, non-digit characters and comparison-normalizing with the existing `comparisonKey` (case and final-letter folding), either equals a list entry, or (Hebrew entries only) equals exactly ONE prefix letter from {ו, ש, ה, ב, ל} immediately followed by a list entry. No stacked prefixes, no other prefix letters, no regex backtracking: a bounded set lookup on the word, then on the word minus its first letter.
- **List (closed).** Hebrew: מה, מהי, מהו, מי, איזה, איזו, כמה, מדוע, למה, היכן, הגדר, ציין. English: what, which, who, how, where, why, when, define, name, list.
- **NON-TARGETS.** Short interrogative/imperative stems ("מהי בירת צרפת?", "Define hashing", "ומהי ...", "שמהו ..."); colon completion stems ("התהליך נקרא:", "The process is:"); stems of 4+ words; empty prompt (STEM_EMPTY); words that merely begin with the same letters ("מהירות", "Whale"). The exemption looks at the first word only.
- **QUESTION TYPES / SEVERITY.** All types; WARNING, ITEM; metrics unchanged (`wordCount`, `minimum: 4`).
- **NORMALIZATION.** Word count unchanged (`collapseWhitespace` split); first-word lookup via `comparisonKey`; no `text-normalize.ts` change.
- **KNOWN LIMITS.** A fragment that happens to start with a list word is exempt (e.g. "מה בירת"); accidental prefix+word matches (e.g. ה+מה) accepted. General brevity or under-specification is not decidable deterministically. **ROUTING.** HUMAN_REVIEW (brevity) / AI_OPTIONAL (is the stem answerable on its own).

## History

- ASSESSMENT-ENGINE-006: `docs/RUNS/2026-10-09-ASSESSMENT-ENGINE-006.md`
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

# Run Report — 2026-10-09-ASSESSMENT-ENGINE-006

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted mutation, migration, schema or dependency change; no AI API; no UI/import wiring).
START_HEAD `477df82`; PRE_REGISTERED_TEST_HEAD `fac7dae`; LAST_VERIFIED_HEAD `92c51cb`. Commits unpushed and not deployed.

## Goal and decision
FUB-066: harden three context-sensitive linter warnings or route them elsewhere. Gate A (parent, from audit evidence plus Dor's accepted principles, not from v0.2 scores):
- OPTION_ABSOLUTE_TERM = SPLIT. Deterministic: strong adverbs in a distractor only. Weak tier (כל/שום/רק/בלבד/all/only/every/none/אף אחד) is no longer emitted; routed HUMAN_REVIEW / AI_OPTIONAL.
- KEY_STEM_LEXICAL_OVERLAP = SEMANTIC_ONLY. Emission stopped; routed AI_REQUIRED / HUMAN_REVIEW.
- STEM_TOO_SHORT = NARROWED. Interrogative/imperative first word (single prefix allowed) or trailing ':' exempt; still fires on bare nouns/fragments; the 4-word constant is unchanged; general brevity goes to HUMAN_REVIEW.

Run-level verdict (Gate B): KEEP_WITH_WATCH.

## Pre-registration
Contracts fixed in the Plan (section 5) and 241 lines of contract tests (`context-sensitive-warnings.test.ts`) committed at `fac7dae` with the positives intentionally red. Tests changed after implementation: no for `context-sensitive-warnings.test.ts` (`git diff fac7dae` on the file is empty). Regression-guard files (`question-lint.test.ts`, `golden-calibration.test.ts`, `heldout-eval.test.ts`) were updated deliberately for the new behavior.

## Metrics (TP/FN/FP/UNLABELED, per rule, not pooled)
| Rule | Dataset | Before | After |
|---|---|---|---|
| OPTION_ABSOLUTE_TERM | v0.1 (TP/FN/FP) | 3/0/0 | 3/0/0 |
| OPTION_ABSOLUTE_TERM | CURRENT_LINTER_ON_FROZEN_V0_2 | 9/0/1/6 | 5/4/0/0 |
| OPTION_ABSOLUTE_TERM | POST_HUMAN | 7/0/4/5 | 5/2/0/0 |
| KEY_STEM_LEXICAL_OVERLAP | v0.1 (TP/FN/FP) | 4/1/0 | 0/5/0 |
| KEY_STEM_LEXICAL_OVERLAP | CURRENT_LINTER_ON_FROZEN_V0_2 | 0/1/0/3 | 0/1/0/0 |
| KEY_STEM_LEXICAL_OVERLAP | POST_HUMAN | 0/1/1/2 | 0/1/0/0 |
| STEM_TOO_SHORT | v0.1 (TP/FN/FP) | 1/0/0 | 1/0/0 |
| STEM_TOO_SHORT | CURRENT_LINTER_ON_FROZEN_V0_2 | 2/0/1/7 | 2/0/0/0 |
| STEM_TOO_SHORT | POST_HUMAN | 2/0/1/7 | 2/0/0/0 |

Regenerated frozen-corpus totals (all rules): CURRENT_LINTER_ON_FROZEN_V0_2 TP 79 / FN 45 / FP 2 / UNLABELED 6 (before Run 006: 83 / 41 / 4 / 22); POST_HUMAN expected 122, TP 79, FN 43, FP 2, UNLABELED 6. v0.1 totals: TP 64 / FN 9 / FP 0 (before: 68 / 5 / 0), 18 CLEAN cases with 0 warnings. Historical FIRST_BLIND (Run 004: TP 80 / FN 44 / FP 4 / UNLABELED 22) is unchanged and never relabelled; current reruns are CURRENT_LINTER_ON_FROZEN_V0_2.

Recall losses (accepted tradeoff, precision over recall): v0.1 KEY_STEM x4 (WEAK-LEAKAGE-HE-01, WEAK-LEAKAGE-HE-PREFIX-01, WEAK-LEAKAGE-EN-01, WEAK-STYLE-CUE-HE-01); v0.2 HO-048 and HO-073/item8 (real); HO-017 and HO-063 (frozen-label only; the human relabelled/removed the expectation, loss intended).

Evidence classes: CONTRACT_TEST (new tests), CALIBRATION/REGRESSION (v0.1; tuned on a small synthetic fixture), HISTORICAL_HELD_OUT_REGRESSION (CURRENT_LINTER_ON_FROZEN_V0_2, already-observed cases), HUMAN_ADJUDICATED / POST_HUMAN (9 reviewed rows). No fresh validation is claimed; nothing here is tuned on v0.2 scores.

## Human-case consistency check
HO-015 ('שום'), HO-017 (symmetric 'תמיד'), HO-032 (colon completion stem), HO-063 (content-essential 'כל'), HO-076 item 1 (natural overlap): no unlabeled emission or false positive remains for any of them under the new linter (POST_HUMAN FP 0 / UNLABELED 0 for the three rules).

## Dataset coherence
Four v0.1 cases (the KEY_STEM list above) got `knownMiss` annotations only; expected labels/codes unchanged. The v0.1 `golden-calibration.test.ts` undocumented-findings assertion is strict again except one exact line: WEAK-STYLE-CUE-HE-01 carries a single-kind knownMiss already NOT_IMPLEMENTED (OPTION_STYLE_OUTLIER), so adding KEY_STEM_LEXICAL_OVERLAP to it trips the "marked NOT_IMPLEMENTED but is implemented" cross-check; kept as a minimal, documented exception (no semantic hack). The v0.2 frozen corpus, labels, freeze hashes and `human-adjudication.json` are untouched.

## Semantic routing
Weak-tier absolute terms and key-stem leakage have no semantic reviewer yet; they now produce no output. Home: new FUB-074 (carries the known uncovered limits: prefix false exemptions such as שמי/במה, and the 'List of birds' first-word exemption). FUB-066 RESOLVED for the deterministic hardening. `docs/ASSESSMENT_ENGINE.md` rule inventory and AI Necessity Matrix updated.

## Review
Independent general reviewer: KEEP (condition: regenerate stale generated docs; done). Minor/nit items: stale 'PINS accepted recall loss' comment in `question-lint.test.ts` fixed; v0.1 knownMiss coherence done; uncovered false exemptions recorded in FUB-074 rather than as separate items.

## Verification (fresh, final)
`npx vitest run src/domain/assessment`: 7 files, 283 tests passed. `tsc --noEmit` clean. eslint clean on the six TS files changed since START_HEAD. Drift-guard tests pass against regenerated `docs/ASSESSMENT_CALIBRATION_V0_1.md` and `docs/ASSESSMENT_HELDOUT_V0_2.md` (generated blocks and classification table). `git diff 477df82` shows no change to the v0.2 corpus, labels, freeze hashes or human-adjudication overlay, no dependency change, no schema change. Full unit suite not run (change confined to the assessment domain; no shared primitives). Schema/PGlite, build and browser E2E not applicable.

## Mechanism evidence (autonomous-run)
4 fresh workers plus 1 reviewer, dispatched sequentially, one Slice at a time; no STOP or ESCALATE events; no interruption recovery.

# Run Report — 2026-10-09-ASSESSMENT-ENGINE-008

Status: `COMPLETE`. Local only; no push, merge, deploy, tag, hosted mutation, migration, schema, dependency, API or UI change.
START_HEAD `b0bbbc0` (code baseline; Plan-open commit `5221670`). PRE_REGISTERED_TEST_HEAD `674ecde` (52 contract tests: 19 failing before implementation, 33 passing). Implementation commit `ab784dc` = LAST_VERIFIED_HEAD (contract 52/52, assessment suite 10 files / 382 tests, `tsc` clean, eslint clean on changed TS, by implementer and reviewer). Later commits are docs-only.

## Goal
Human-confirmed deterministic hardening of `question-lint.ts` (still unwired) for FUB-077, the FUB-075 safe interrogative family and FUB-076, justified by HUMAN_ADJUDICATED_V0_3 (post-evaluation, not blind). One implementation pass; no corpus, label, overlay or threshold edits.

## Slices
| Slice | Content | Status |
|---|---|---|
| A | Design gates | DONE |
| B | Contract tests pre-registered (`674ecde`) | DONE |
| C | Implementation in `question-lint.ts` (`ab784dc`) | DONE |
| D | Regression metrics before to after | DONE |
| Z | Independent review (unlock-reviewer) | DONE: KEEP |
| Z2 | Docs reconcile and Run close | DONE |

## Design gates
- FUB-077: IMPLEMENT. `כל האפשרויות הנ"ל` and `כל האפשרויות הנל` added to `ALL_OF_ABOVE_PHRASES` (whole token sequence; apostrophe `הנ'ל` not matched).
- FUB-075 interrogative family: IMPLEMENT. מהם, מהן added to `STEM_LEAD_WORDS` and `HE_LEAD_WORDS`. Side effect: the existing single-prefix rule exempts non-words such as במהם/למהם (unpinned).
- FUB-075 whole-utterance classification: DEFER_AS_SEMANTIC_OR_FUTURE_DESIGN. 38 distinct stems under 4 words (v0.1 1, v0.2 10, v0.3 27); terminal punctuation separates v0.3 only by authoring convention and would regress unpunctuated valid stems ('מי כתב המלט', 'Name three planets'); 'List of birds'/'Name tags' versus 'List two primes' needs semantics or a word list. Micro-rule considered (a lone lead word is never exempt) fixes only 'במה' (n=1); not selected, needs Dor's decision.
- FUB-076: IMPLEMENT NARROW SUBTRACTION, Hebrew `לא` only. Relative שלא/ושלא counts only after an earlier selection cue (איזה איזו אילו איזהו בחר בחרו סמן סמנו זהה ציין); ו+לא is silent when the next token matches `/^ל[א-ת]{3,}$/` (contrast); everything else unchanged. Rejected: a general 'negation must be in an interrogative frame' rule (would break about 18 existing contract/TP prompts).

## Metrics (TP/FN/FP/UNL, before to after; v0.1 has no UNL)
| Set | Rule | Before | After |
|---|---|---|---|
| v0.1 | ALL_OF_ABOVE / STEM_TOO_SHORT / STEM_NEGATIVE_WORDING | 3/0/0, 1/0/0, 3/0/0 | unchanged |
| CURRENT_LINTER_ON_FROZEN_V0_2 | ALL_OF_ABOVE | 1/0/0/0 | unchanged |
| | STEM_TOO_SHORT | 2/0/0/0 | unchanged |
| | STEM_NEGATIVE_WORDING | 6/1/0/1 | 6/1/0/0 (HO-073/item8 `ולא לתרכובת` silent; unlabeled, not human-adjudicated) |
| FRESH_HELD_OUT_V0_3 (frozen model labels) | ALL_OF_ABOVE | 0/1/0/0 | 1/0/0/0 |
| | STEM_TOO_SHORT | 5/4/0/1 | 5/4/0/0 |
| | STEM_NEGATIVE_WORDING | 1/0/1/1 | 1/0/0/0 |
| HUMAN_ADJUDICATED_V0_3 | ALL_OF_ABOVE | 0/1/0/0 | 1/0/0/0 |
| | STEM_TOO_SHORT | 5/4/1/0 | 5/4/0/0 |
| | STEM_NEGATIVE_WORDING | 1/0/2/0 | 1/0/0/0 |

Whole-corpus v0.3 frozen: TP 28 to 29, FN 9 to 8, FP 1 to 0, UNL 3 to 1; post-human TP 29 to 30, FN 9 to 8, FP 3 to 0. v0.2 frozen UNL 6 to 5 (generated blocks in `docs/ASSESSMENT_HELDOUT_V0_2.md` regenerated in `ab784dc`). Lost TPs: none. New FPs: none.

Evidence class: CONTRACT_TEST plus frozen-set REGRESSION (CURRENT_LINTER_ON_FROZEN_V0_2, FRESH_HELD_OUT_V0_3 regression, HUMAN_ADJUDICATED_V0_3 regression). NOT FIRST_BLIND, NOT fresh validation; fresh validation after these fixes is absent.

## Human-confirmed defects
Fixed: HO3-071 all-of-above miss (now TP) and HO3-071 STEM_TOO_SHORT FP; HO3-005 and HO3-058 STEM_NEGATIVE_WORDING FPs. Still open: HO3-038/040/042/044 STEM_TOO_SHORT lost TPs (deferred), HO-063 'איננה' FN.

## FUB routing
- FUB-077: RESOLVED_IMPLEMENTED (n=1; other Hebrew variants unmeasured; fresh validation pending).
- FUB-075: PARTIALLY_RESOLVED_IMPLEMENTATION (interrogative family done; whole-utterance classification open; not resolved).
- FUB-076: PARTIALLY_RESOLVED_IMPLEMENTATION (the Run condition 'no lexical-token-only negation logic remains' is NOT met). Residuals: bare `לא`/`אין` in non-selecting clauses still fire; the cue list is closed ('מי מהבאים שלא', 'מצאו/קבעו ... שלא', 'מהם ... שלא' now silent where they fired before); no sentence boundary in the cue check; CONTRAST_NEXT treats any ל-initial 4+ letter word incl. verbs as contrast ('ולא לומדים'); `שאינו`, English `not`, 'אבל לא' untouched.
- FUB-074: unchanged (semantic ownership). FUB-066 historical closure untouched.

## Review
Independent reviewer (unlock-reviewer): KEEP, 0 blocker, 1 material (FUB-076 wording must stay PARTIAL: adopted), 2 minors (closed cue list and missing sentence boundary: documented as FUB-076 residuals; a negative test row for 'מי מהבאים שלא': left as a backlog note, not added, to avoid post-hoc tuning).

## Integration readiness
NOT_READY: semantic gap, remaining NOT_IMPLEMENTED rules, no real instructor data, no fresh validation after fixes. Frozen v0.3 corpus, overlay, v0.2 and FIRST_BLIND records unchanged.

## Mechanism notes (autonomous-run)
Thin parent with 5 sequential fresh workers (A, B, C+D, D2, Z) plus Z2; 0 STOP/ESCALATE events; the parent stayed thin. Quantitative telemetry from `node .claude/telemetry/summarize.mjs 2026-10-09-ASSESSMENT-ENGINE-008` is reported in the close handoff, not copied here.

## Next recommended Run
One Run: fresh held-out v0.4 validation batch (new authored stems, not tuned against, including short-stem and Hebrew negation-frame cases) with blind labeling, before any further linter change.

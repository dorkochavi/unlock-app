# Run Report — 2026-10-09-ASSESSMENT-ENGINE-009

Status: `COMPLETE`. Local only; no push, merge, deploy, tag, hosted mutation, migration, schema, dependency, API or UI change.
START_HEAD `73d8767`. V04_FREEZE_HEAD `5a99fdf` (corpus, labels, author-intent, label-review, contamination audit, hashes; linter not yet run). Eval guard `7d3f517`. Report commit `28bd30a` = LAST_VERIFIED_HEAD (assessment suite 12 files / 403 tests, `tsc` clean, eslint clean on new test files). Later commits are docs-only. END_HEAD derived from Git after commit.

## Goal
Fresh held-out v0.4 VALIDATION of the Run 008 hardening of `question-lint.ts` (unwired). Evidence class `FRESH_HELD_OUT_V0_4`: model-authored, model-labeled, not human ground truth, not FIRST_BLIND, never pooled. No linter, normalizer, threshold, post-freeze corpus or label edit.

## Method
AUTHOR (fresh worker, no linter/src/docs access) → LABEL (independent fresh worker) → LABEL REVIEW (fresh worker, pre-freeze edits) → CONTAMINATION AUDIT (3 audit/replace/relabel/review rounds plus a parent Jaccard check) → FREEZE → evaluate unchanged linter → classify → report → independent review. Separation was by instruction, not tool-enforced; same model family throughout. Details: `docs/ASSESSMENT_HELDOUT_V0_4.md` (evidence home; corpus not copied here).

## Slices
| Slice | Content | Status |
|---|---|---|
| A | Author corpus and author-intent | DONE |
| B | Independent labels | DONE |
| C | Label review and change log | DONE |
| D | Contamination audit and replacements (48 item replacements over 3 rounds plus a parent check) | DONE |
| E | Freeze (`5a99fdf`), manifest, v0.4 tests | DONE |
| F | Evaluate, classify, report (`7d3f517`, `28bd30a`) | DONE |
| Z | Independent review (unlock-reviewer): KEEP | DONE |
| Z2 | Docs reconcile and Run close | DONE |

## Headline results (FRESH_HELD_OUT_V0_4)
75 cases (72 items + 3 sets), 25 CLEAN (33%, below the 40-50% target; 4 English CLEAN). Expected 93: 46 TP / 47 FN (46 NOT_IMPLEMENTED, 1 heuristic gap HO4-052) / 6 FP / 2 UNL. Implemented rules only: recall 46/47. CLEAN warned 5 of 25 (HO4-007, 008, 015, 062, 063; all STEM_NEGATIVE_WORDING, Hebrew). Other FP: STEM_TOO_SHORT on HO4-042 (`הגדר/י`). No LINTER_BUG found. Precision regressed against v0.3 (CLEAN warned 0 of 38 there); denominators differ and are never pooled.

## Verdicts
- STEM_NEGATIVE_WORDING: `WEAKENED` (Hebrew generalization of the Run 008 narrowing failed; 5 TP / 1 FN / 5 FP). The 5 are FPs only under the harness CLEAN-warn convention plus Dor's v0.3 principle (label review had neutralized the forbiddenCodes).
- STEM_TOO_SHORT: `KEEP_WITH_WATCH` (4/0/1; lookalike stress absent). OPTION_ALL/NONE_OF_ABOVE, OPTION_ABSOLUTE_TERM, KEY_LONGEST_OPTION, OPTION_LENGTH_IMBALANCE: `VALIDATED_PROVISIONALLY` (thin; pre-Run-008 phrases/tiers only, Run 008 additions not exercised). KEY_STEM_LEXICAL_OVERLAP: no counter-evidence for semantic ownership; recall unmeasured.
- FUB routing: FUB-077 stays RESOLVED_IMPLEMENTED (`VALIDATED_PROVISIONALLY`, narrow); FUB-075 stays PARTIALLY_RESOLVED_IMPLEMENTATION (part A unmeasured, part B open); FUB-076 REOPENED as active design item conditional on human ruling; FUB-074 scope unchanged. No new FUB.
- Integration readiness: NOT_READY (unchanged; precision on fresh Hebrew data is the new blocker).

## Review
Independent reviewer (unlock-reviewer): KEEP, 0 blocker, 0 material, 5 minors (4 applied to the report, 1 methodology note acknowledged) (label-review neutralization of forbiddenCodes, FUB-074/KEY_STEM wording, narrow VALIDATED_PROVISIONALLY scope, contamination-audit note).

## Verification
| Evidence | Result | Class |
|---|---|---|
| Assessment suite (12 files) | 403 passed at `28bd30a` | unit-level, local |
| v0.4 freeze and evaluation guard tests | pass (within the suite) | unit-level, local |
| `tsc --noEmit` | clean at `28bd30a` | typecheck |
| eslint on new test files | clean | lint |
| Later commits | docs-only; evidence reused | freshness basis |

No browser, schema/PGlite, hosted or human-adjudication evidence. The linter is unwired; nothing here proves real-course behavior.

## Safety
| Question | Answer |
|---|---|
| `question-lint.ts`, `text-normalize.ts`, `heldout-eval.ts`, thresholds changed | NO |
| v0.2/v0.3 data, human overlay, FIRST_BLIND records changed | NO |
| Corpus/labels edited after freeze | NO |
| Schema, migration, dependency, API, UI change | NO |
| Push, deploy, hosted mutation, AI call | NO |

## Human / next
HUMAN: 14-row v0.4 review queue (`docs/ASSESSMENT_HELDOUT_V0_4.md` section 7), status MODEL_PROPOSED. Next recommended Run (one): human adjudication producing `HUMAN_ADJUDICATED_V0_4` as a post-evaluation overlay with frozen v0.4 files untouched, before any linter change.

## Mechanism notes (autonomous-run)
About 21 sequential fresh workers (author, label, label review, audit plus 3 re-audit/replace/relabel/review cycles, evaluation, classification) plus 1 independent reviewer; 0 STOP/ESCALATE events; no context-inheriting workers; the parent did Plan, checkpoint, merge and commit only. Observations: 3 contamination rounds were needed because the first audit under-detected same-concept overlaps (48 of 72 items replaced); the independent labeler's literal rules (STYLE_OUTLIER etc.) inflated expected detections (46 of 93 on unimplemented rules); CLEAN share 33% fell below target. Telemetry via `node .claude/telemetry/summarize.mjs 2026-10-09-ASSESSMENT-ENGINE-009` is reported in the close handoff, not copied here.

Mechanism note: the parent kept CURRENT_SLICE at D across the three audit/replace/relabel/review rounds (15 worker dispatches), so per-Slice telemetry attribution for Slice D is coarse (verify-run-close WARN); sub-round labels should have been used.

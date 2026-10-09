# Run Report — 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-V0-3-HUMAN-REVIEW-001

Status: `DRAFT` (H1 and H2 complete; Slices Z/Z2 and Run close pending, to be finalized by the closer). Local only; no push, merge, deploy, tag, hosted mutation, migration, schema or dependency change.
START_HEAD `32ca933` (= `origin/main` at Run start). H1 commit `35651e4`. LAST_VERIFIED_HEAD `35651e4`. Commits are unpushed and not deployed; `origin/main` is not Production.

## Goal
Record Dor's 13 post-evaluation decisions on the queued v0.3 cases as a separate additive overlay, recompute `HUMAN_ADJUDICATED_V0_3` with the unchanged linter, reassess the affected rules from that evidence, and route the findings. No linter, normalizer, threshold or frozen-data change.

## Slices
| Slice | Content | Status |
|---|---|---|
| H1 | Overlay `human-adjudication.json` (13/13), generic overlay support in the harness `heldout-eval.ts` (additive), tests `heldout-v0-3-human-adjudication.test.ts`, HUMAN_ADJUDICATED_V0_3 evaluation (commit `35651e4`) | DONE |
| H2 | Docs: report section 11 in `docs/ASSESSMENT_HELDOUT_V0_3.md`, rule reassessment, backlog FUB-066/074/075/076/077, pointers in `ASSESSMENT_ENGINE.md` and `CONTEXT_MAP.md`, this report, `DEV_STATUS.md` | DONE (this commit) |
| Z | Independent review / final verification | PENDING (closer) |
| Z2 | Run close: Plan status, DEV_STATUS finalization, final Git state | PENDING (closer) |

## Provenance
`HUMAN_APPROVED_POST_EVALUATION`, reviewer Dor, 2026-10-09. Decisions were made after seeing the question, options, key, frozen model label, frozen linter emissions and why the case mattered: POST-EVALUATION, NOT blind, single reviewer, 13 of 72 synthetic cases. These cases are observed; any later fix tested on them is CONTRACT_TEST / regression evidence, not fresh validation.

## Results (HUMAN_ADJUDICATED_V0_3; details in `docs/ASSESSMENT_HELDOUT_V0_3.md` section 11)
- Reviewed-13: 4 CLEAN / 9 FLAWED; expected 9, TP 4, FN 5 (all implemented-rule gaps), FP 3, UNLABELED 0; clean-reviewed warned 2 of 4.
- Whole corpus POST_HUMAN: 41 CLEAN / 31 FLAWED; expected 38, TP 29, FN 9 (5 implemented / 4 not implemented), FP 3, UNLABELED 0; clean warned 2 of 41.
- FRESH_HELD_OUT_V0_3 stays TP 28 / FN 9 / FP 1 / UNLABELED 3, clean warned 1 of 38 (model-labeled; never pooled).
- Delta: expected +1, TP +1, FN 0, FP +2, UNLABELED -3. The FP rise is a re-classification of label-open emissions (058, 071), not new linter errors.

## Verdicts (rule reassessment; limits: n tiny, one reviewer, post-evaluation)
- STEM_NEGATIVE_WORDING: rule matches any negation token (incl. `שלא`, `ולא`), contradicting Dor's principle; 2 human-confirmed FPs; FUB-076 promoted and reframed (needs a design decision on a narrow negative-stem condition).
- STEM_TOO_SHORT: 4-word threshold not implicated and not concluded wrong; exemption errs in both directions (4 human-approved lost TPs, 1 human-forbidden emission); FUB-075 promoted and reframed. A post-hoc descriptive, unvalidated scratch pass on the short stems is in report section 11.5b (terminal punctuation separates the corpus but is confounded by authoring convention); no fix proposed.
- KEY_STEM_LEXICAL_OVERLAP: SEMANTIC_OWNERSHIP_CONFIRMED stronger; not restored; FUB-074 gains fixtures.
- OPTION_ABSOLUTE_TERM: weak support for the strong/weak split.
- OPTION_ALL_OF_ABOVE: phrase gap `כל האפשרויות הנ"ל` human-confirmed (closed whole-token phrase list); highly tractable.
- KEY_LONGEST_OPTION: HO3-048, HO3-021 human-confirmed.
- Run 006/007 overall: stronger on the absolute-term split and overlap ownership, weaker on the short-stem narrowing, unknown on natural frequency. Integration readiness remains NOT_READY (canonical criteria not met; tiny single-reviewer post-evaluation adjudication of 13 synthetic cases, no real instructor data, FP/FN burden remains, 4 unimplemented rules, no semantic critic).

## FUB routing
- FUB-066: stays `RESOLVED_IMPLEMENTATION`; human-adjudication annotation added.
- FUB-074: stays open; positive fixtures HO3-033, HO3-021; negative fixtures HO3-025, HO3-028, HO3-058.
- FUB-075: promoted to MEDIUM, reframed to exemption classification plus interrogative-family completeness.
- FUB-076: promoted to MEDIUM, reframed to defining a narrow negative-stem condition.
- FUB-077: trigger met, stays LOW, ride-along.
- No new FUBs.

## Recommended next Run (exactly one)
**A small deterministic hardening Run for the three human-confirmed defects in implemented rules, followed by a fresh batch for validation (the fresh batch may be a later Run).** Justification: all three are human-confirmed defects in rules that exist and are deterministic by design, so they are not semantic-critic territory; together they account for all 3 human-confirmed FPs and 5 of the 5 implemented-rule FNs in the reviewed set. They share one test-first pattern (pre-register contract tests, then change, then freeze), so one coherent Run is supported. Proposed ordering and risk, lowest to highest:
1. FUB-077 (`כל האפשרויות הנ"ל`): closed-list phrase addition, human-confirmed, minimal overfitting risk beyond list coverage.
2. FUB-075 part 2, lead-list/interrogative-family completeness (`מהם`, `מהן`): fixes the 071 FP; Dor's family note is a design note, so the family boundary should be stated in the contract tests.
3. FUB-076, narrow negative-stem condition: removes the 2 FPs, but needs a design decision (what counts as the question-asking negation frame) before implementation; recall cost is unmeasured (one unreviewed TP).
4. FUB-075 part 1, exemption classification (whole-utterance well-formedness): the riskiest slice (errs in both directions, no validated signal, Hebrew-imperative cases absent from the corpus); it needs its own design decision and may be dropped to a later Run if that decision is not made. Do not simply grow or shrink the whitelist.
Prioritization basis: human-confirmed defect (all four), deterministic tractability (1 > 2 > 3 > 4), FP/FN burden (3 and 4 carry most of the burden), architecture ownership (all in `question-lint.ts`; no semantic critic needed), ability to pre-register tests (1, 2 straightforward; 3, 4 need a design decision first), overfitting risk (rises 1 to 4). Overfitting guard: the 13 cases are now observed, so tests built from them are CONTRACT_TEST / regression only; claims about generalization need a fresh held-out batch (new corpus, frozen before running), and must not be inferred from these cases.

## Safety confirmations
- `question-lint.ts`: NO change. `text-normalize.ts`: NO change. Threshold: NO change.
- Frozen v0.3 corpus, labels, author-intent, label-review and hashes: NO change. v0.2: NO change. Previous overlays: NO change.
- Schema, dependencies, hosted, push, deploy: NO.
- Disclosure: `src/domain/assessment/golden/heldout-eval.ts` received additive generic overlay support in H1 (commit `35651e4`, test and data support only; not product code, not the linter).
- H2 changes only docs (verify with `git diff 35651e4 --stat`).

## Verification (unit-level local, no upgrade of evidence class)
`npx vitest run src/domain/assessment`: 9 files, 330 tests passed at `35651e4` (re-run at H2 start). H2 is docs-only, so that evidence stays fresh. No typecheck/lint/schema/build/browser re-run (no code change). Human decisions are `HUMAN_APPROVED_POST_EVALUATION` and not automated evidence; no blind, integration, hosted or real-course evidence.

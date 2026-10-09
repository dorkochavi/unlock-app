# Run Report — 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-001

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted/Supabase mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `0f32fec`; Plan-open commit `ed78cca`; LAST_VERIFIED_HEAD `94bce38`. `origin/main` == `0f32fec` at start (human-pushed); this Run's commits are local and unpushed. `origin/main` is not Production. Scratch (git-ignored): `scratch/telemetry/**`.

## Goal
Apply Dor's 9 human decisions (HUMAN_APPROVED, Dor, 2026-10-09) to the Golden Dataset v0.2 held-out labels as a POST-EVALUATION adjudication; recompute with the UNCHANGED linter; preserve FIRST_BLIND evidence; update provenance, readiness, FUB-064 and FUB-065 truthfully. Not a tuning Run.

## Slices and commits
| Slice | Commit | Content |
|---|---|---|
| Plan | `ed78cca` | Plan identity open |
| H1 | `c388423` | Overlay `human-adjudication.json` (not part of the freeze hashes); `applyHumanAdjudication`, `compareFirstBlindAndPostHuman`, `formatPostHumanMarkdown` (new exports only); tests; second generated block (section 14) |
| H2 | `94bce38` | Provenance, 9-row decision table, post-human annotations (FIRST_BLIND text preserved), principles, readiness, FUB-064 reassessment, FUB-065 resolved, FUB-073 |
| Z | (Run close) | Review nits, Run-close docs |

## Representation decision
The frozen files (`corpus.json`, `labels.json`, `author-intent.json`, `freeze-hashes.json`) stay byte-identical so the freeze invariant and the FIRST_BLIND report are preserved. Human decisions are an overlay applied in code on top of the frozen labels; the harness reports FIRST_BLIND and POST_HUMAN separately plus a delta. Corpus text is not rewritten.

## Decisions applied (only 3 of 9 change a label)
CHANGED: HO-017 (to CLEAN; removed OPTION_ABSOLUTE_TERM and OPTION_PREFIX_STEM_REPEAT), HO-063 (removed OPTION_ABSOLUTE_TERM; "remove", not "forbid"), HO-069 (to FLAWED; added OPTION_NUMERIC_UNORDERED, a NOT_IMPLEMENTED check). APPROVED unchanged: HO-049, HO-070, HO-015, HO-032, HO-073 (SET_KEY_LENGTH_BIAS stays a forbidden FP). APPROVED_PARTIAL, no label change: HO-076 (Dor's condition "reject item-1 lexical leakage if currently expected" was not met: item 1 expected only KEY_LONGEST_OPTION and OPTION_LENGTH_IMBALANCE; the linter's item-1 KEY_STEM_LEXICAL_OVERLAP stays an UNLABELED_EMISSION; the Hebrew issues are recorded, corpus not edited; FUB-073).

## Metrics (evidence class: unit, model-labeled fixture with 9 human-adjudicated rows; never pooled with v0.1)
| | FIRST_BLIND | POST_HUMAN (post-evaluation) | Delta |
|---|---|---|---|
| Expected deterministic detections | 124 | 122 | -2 |
| TP | 80 | 78 | -2 |
| FN (heuristic / NOT_IMPLEMENTED) | 44 (8 / 36) | 44 (8 / 36) | 0 |
| FP | 4 | 5 | +1 |
| CLEAN cases with warning | 3 of 20 | 4 of 20 | +1 |
| UNLABELED_EMISSION | 22 | 23 | +1 |
| SET-scope expected / TP / FN / FP | 17 / 15 / 2 / 1 | 17 / 15 / 2 / 1 | 0 |

Causes: HO-017, HO-063 and HO-069 are HUMAN_DECIDED_LABEL_CHANGE (metric effect); HO-049, HO-070, HO-076, HO-015, HO-032 and HO-073 are HUMAN_DECIDED_NO_LABEL_CHANGE with HUMAN_DECIDED_BUT_NO_METRIC_EFFECT; TRUE_REMAINING_AMBIGUITY is 0 (all 9 decisions are definitive). The linter's output is unchanged, so the FP rise is a label effect, not a linter regression.
Corrected in Run 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002: the earlier "ambiguity remaining" label described a harness accounting state, not human uncertainty.

## Readiness and verdicts (recommendations only)
Integration readiness stays NOT_READY (9 of 78 labels human-approved by a single reviewer; model-authored corpus; 5 FP post-human; 36 NOT_IMPLEMENTED FN; 12 semantic-only; position-rule significance, import-validator reconciliation and advisory design untouched). FUB-064 OPTION_COMBINATION_REFERENCE: IMPLEMENT_NEXT reaffirmed (low-to-medium); its 3 cases were not human-reviewed; WATCH is defensible; no code. FUB-065 RESOLVED for the 9 queued rows only (`HUMAN_APPROVED: Dor, 2026-10-09`); the other 69 rows remain MODEL_LABELED_NOT_HUMAN_APPROVED.

## Invariants (proof)
`git diff 0f32fec..94bce38` over `question-lint.ts`, `text-normalize.ts`, `calibration.ts`, `golden-types.ts`, `golden-dataset-v0-1.ts` and the four frozen held-out files is empty; the freeze hash test passes; the first GENERATED block is byte-identical (reviewer md5). No dependency, schema or config change.

## Review
Independent general review (`unlock-reviewer`): ACCEPT; 0 BLOCKER, 0 CORRECTION, 4 NON-BLOCKING. Applied: the section 12.1 pointer fix and a sentence that the linter output is byte-identical before and after. Accepted unchanged: the overlay JSON is LF-only while sibling frozen blobs are CRLF in the index (it is deliberately outside the freeze hashes); FUB-065's promotion-trigger subsection was removed on closure.

## Verification (evidence class: unit / static, local)
`npx vitest run src/domain/assessment`: 5 files, 235 tests passed. Full `npm test`: 190 files passed, 1 skipped; 2460 tests passed, 4 skipped; 0 failed (at `94bce38`). `npm run typecheck`: clean. eslint on the two changed TS files: clean. Not run (no relevant change): schema/PGlite, production build, browser E2E.

## Mechanism evidence
Fresh workers: H1 (implementation), H2 (docs), reviewer; sequential, the parent did no product work. The parent checked the frozen-file diff independently after H1. Two of Dor's conditional instructions (HO-076 item 1, HO-073 forbidden code) were already satisfied by the frozen labels, so the workers recorded them as approvals instead of inventing changes.

## Deferred / human
HO-076 Hebrew corpus corrections and any re-freeze go through FUB-073 (a separate human-approved step). The mechanical label questions left out of the queue remain model-only. FUB-064 implementation, FUB-066/067 threshold work and real or cleared items (FUB-063) are separate Runs.

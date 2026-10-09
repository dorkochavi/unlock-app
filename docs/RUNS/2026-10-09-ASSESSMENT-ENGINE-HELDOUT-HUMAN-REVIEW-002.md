# Run Report — 2026-10-09-ASSESSMENT-ENGINE-HELDOUT-HUMAN-REVIEW-002

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted/Supabase mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `131cb28`; Plan-open commit `1114aa2`; LAST_VERIFIED_HEAD `4084291`. Local commits unpushed and not deployed; `origin/main` is not Production. Scratch (git-ignored): `scratch/telemetry/**`.

## Goal
Verify that all 9 of Dor's held-out decisions (HUMAN_APPROVED, Dor, 2026-10-09) are represented exactly, and remove the incorrect "ambiguity remaining" language introduced in Run -001. Dor's decisions are definitive. The earlier label described a harness accounting state (a linter emission neither expected nor forbidden is an UNLABELED_EMISSION), not human uncertainty.

## Slices and commits
| Slice | Commit | Content |
|---|---|---|
| Plan | `1114aa2` | Plan identity open |
| F1 | `4084291` | Decision taxonomy in the harness and test; regenerated second GENERATED block; prose corrections in the held-out doc, the Run -001 report and FUB-066; overlay wording-only edits |
| Z | (Run close) | Run-close docs |

## Result of the verification
The overlay already represented every decision correctly (patches, before snapshots and `touchedFindings` untouched). Only vocabulary and prose were wrong. No label, patch or forbidden code changed.

| Case | Label effect | Metric effect | Linter emission left UNLABELED by harness convention |
|---|---|---|---|
| HO-049 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | none |
| HO-070 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | none |
| HO-076 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | item-1 KEY_STEM_LEXICAL_OVERLAP |
| HO-017 | HUMAN_DECIDED_LABEL_CHANGE | metric effect | none |
| HO-015 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | OPTION_ABSOLUTE_TERM |
| HO-063 | HUMAN_DECIDED_LABEL_CHANGE | metric effect | OPTION_ABSOLUTE_TERM |
| HO-032 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | none |
| HO-069 | HUMAN_DECIDED_LABEL_CHANGE | metric effect | none |
| HO-073 | HUMAN_DECIDED_NO_LABEL_CHANGE | HUMAN_DECIDED_BUT_NO_METRIC_EFFECT | none |

TRUE_REMAINING_AMBIGUITY: 0 of 9. The three emissions left UNLABELED are a metric-accounting convention: Dor removed or declined an expectation but did not say "forbid". If Dor additionally rules those three codes forbidden for those cases, POST_HUMAN FP (5) and UNLABELED (23) would change (reviewer's estimate: FP 8, UNLABELED 20). That is a separate human choice, NOT applied; HO-076 item 1 would also need a harness extension because SET labels have no per-item forbidden list.

## Metrics: unchanged
FIRST_BLIND: 124 expected / TP 80 / FN 44 (8 heuristic + 36 NOT_IMPLEMENTED) / FP 4 / CLEAN-warned 3 of 20 / UNLABELED 22 / SET 17-15-2-1. POST_HUMAN: 122 / 78 / 44 / 5 / 4 of 20 / 23 / SET 17-15-2-1. The first GENERATED block is byte-identical (CRLF-normalized hash equal at `131cb28` and HEAD); the existing first-run assertions are not weakened.

## Invariants (proof)
`git diff 1114aa2..4084291` over `question-lint.ts`, `text-normalize.ts`, `calibration.ts`, `golden-types.ts`, `golden-dataset-v0-1.ts`, the four frozen held-out files, `DEV_STATUS.md`, `package.json`, `supabase/` and `.claude/` is empty. The linter was not run differently; its output is byte-identical. FUB-065 stays RESOLVED (9 queued rows only). Readiness stays NOT_READY. FUB-064 stays a recommendation. Only 9 of 78 rows are HUMAN_APPROVED.

## Review
Independent general review (`unlock-reviewer`): ACCEPT; 0 BLOCKER, 0 CORRECTION; NON-BLOCKING only (the `trueAmbiguity` branch is never exercised; unrelated "PENDING"/"human decision required" wording is correctly untouched). The reviewer judged leaving the three emissions UNLABELED a defensible reading of "remove / do not add", and noted it may understate FP, which the held-out doc states explicitly.

## Verification (evidence class: unit / static, local)
`npx vitest run src/domain/assessment`: 5 files, 235 tests passed. Full `npm test`: 190 files passed, 1 skipped; 2460 tests passed, 4 skipped; 0 failed. `npm run typecheck`: clean. eslint on the two changed TS files: clean. Not run (no relevant change): schema/PGlite, production build, browser E2E.

## Mechanism evidence
One implementation worker (F1) and one reviewer, sequential; the parent verified the frozen-file diff and the removal of the wording independently. The error was a vocabulary mistake in the parent-approved Run -001 output (a harness accounting term presented as a statement about the human), caught by the human reviewer.

## Deferred / human
Optional human choice: whether the three declined emissions (HO-015 and HO-063 OPTION_ABSOLUTE_TERM, HO-076 item-1 KEY_STEM_LEXICAL_OVERLAP) should be ruled forbidden (counts as FP). Not applied.

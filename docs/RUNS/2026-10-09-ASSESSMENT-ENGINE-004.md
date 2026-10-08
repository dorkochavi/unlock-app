# Run Report — 2026-10-09-ASSESSMENT-ENGINE-004

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted/Supabase mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `170ed8c`; Plan-open commit `b3f8438`; LAST_VERIFIED_HEAD `d837177`. Local commits unpushed and not deployed; `origin/main` is not Production. Scratch (git-ignored): `scratch/telemetry/**`.

## Goal
Blind held-out evaluation of the unwired question linter (FUB-063): AUTHOR → INDEPENDENT LABEL → FREEZE → EVALUATE → REPORT, with no linter tuning. The corpus is `MODEL_AUTHORED_HELD_OUT`, labels `MODEL_LABELED_NOT_HUMAN_APPROVED`: a methodological split, not human ground truth, not psychometric or real-course validation.

## Slices and commits
| Slice | Commit | Content |
|---|---|---|
| Plan | `b3f8438` | Plan identity open |
| A1 / A2 | (scratchpad, outside repo) | Blind HELD_OUT_AUTHOR (no repo access) then independent HELD_OUT_LABELER (no repo access, author intent withheld) |
| A3 | `23fbc1c` (`HELD_OUT_FREEZE_HEAD`), `536b94f` | Frozen corpus (78 cases: 70 ITEM + 8 SET), labels, withheld author intent; hash record `freeze-hashes.json` (`manifest.json` is git-ignored) |
| A4 | `b9aaca4` | Pure harness `heldout-eval.ts`, test `heldout-eval.test.ts`, `docs/ASSESSMENT_HELDOUT_V0_2.md` |
| A5 | `6ceccfa` | Verdicts, human-review queue, FUB-063/064 updates, FUB-065..067, routing |
| Z | `d837177`, (Run close) | Review wording corrections; Run-close docs |

## Results (v0.2 held-out only; never pooled with v0.1; evidence class: unit, model-labeled fixture)
78 cases. 124 expected deterministic detections: TP 80, FN 44 (36 NOT_IMPLEMENTED, 8 HEURISTIC_GAP). FP 4. CLEAN cases with a warning 3/20. UNLABELED_EMISSION 22 (not counted as FP). Semantic-only cases 12 (29 with any semantic expectation). SET scope codes: 17 expected, TP 15, FN 2, FP 1. Failure classification of 70 findings: LIKELY_HEURISTIC_LIMIT 55, LIKELY_LABEL_QUESTION 12, NEEDS_HUMAN_HEBREW_REVIEW 2, NEEDS_MORE_DATA 1, LIKELY_LINTER_BUG 0 (borderline: two tokenization behaviours arguable). v0.1 (DEV/CALIBRATION, unchanged): TP 67, FN 6, FP 0, CLEAN-with-warning 0/18; its zero-FP result is fixture-fit and not evidence of held-out behavior. Author-vs-labeler: 6 of 78 clear directional disagreements.

## Verdicts (recommendations only; no code change)
- FUB-064 OPTION_COMBINATION_REFERENCE: IMPLEMENT_NEXT (low-to-medium confidence; the 3 cases were deliberately authored; reading check, not a measured FP rate).
- KEY_POSITION_IMBALANCE: WATCH. KEY_POSITION_RUN: KEEP (provisional). Only 8 set cases.
- Integration readiness: NOT_READY (held-out FP 4 and 3/20 clean warned; model-only provenance; position-rule significance, naming reconciliation and advisory-only design untouched).
- New FUBs: FUB-065 (human review of 9 label questions, HUMAN action), FUB-066 (STEM_TOO_SHORT / absolute-term context clusters), FUB-067 (KEY_LONGEST 15-char gate, set eligibility). FUB-063/064 remain open.

## Invariants (proof)
`git diff 170ed8c HEAD` over `question-lint.ts`, `text-normalize.ts`, `golden-dataset-v0-1.ts`, `calibration.ts`, the v0.1 calibration test and doc is empty. Frozen files under `golden/heldout-v0-2/` unchanged since `23fbc1c` (only `freeze-hashes.json` added later; the test re-hashes LF-normalized bytes). Harness added after the freeze. No labels edited after results. No dependency/schema/config change.

## Review
Independent general review (`unlock-reviewer`): ACCEPT_WITH_CORRECTIONS, 0 BLOCKER, 0 CORRECTION, 6 NON-BLOCKING. Applied (wording only): no model-side relabel (any relabel is post-observation and needs a new freeze), tokenizer-defect hedge, HO-073 row labeled a policy question, labeler-vocabulary contamination note. Accepted unchanged: HO-063 category wobble; the in-repo hash test detects accidental, not coordinated, edits (git history is the real protection).

## Verification (evidence class: unit / static, local)
`npx vitest run src/domain/assessment`: 5 files, 224 tests passed (after the last doc edit). `npm run typecheck` and eslint on the two new TS files clean at `b9aaca4`; no `src/` change since (A5 and Z diffs under `src/` empty), so reused. Full unit, schema/PGlite, build and browser suites not run: no shared or runtime code changed (freshness basis: `.claude/rules/testing.md` §2).

## Mechanism evidence (telemetry, runtime measurements, not billed tokens)
5 fresh workers (author, labeler, A4, A5, reviewer) executed sequentially; parent compactions 0; highest context use 24%; 15 substantive reads, all by subagents, 0 by the parent; re-read rate 27%. Blindness held by construction (author and labeler had no repo access; labeler never saw the author intent or linter). Workers needed the vocabulary file written by the parent, which is the one disclosed leak (documented default thresholds).

## Deferred / human
Answers to FUB-065 queue; real or cleared items for a human-approved v0.2; any implementation of FUB-064/066/067 (separate Runs); nothing marked HUMAN_APPROVED.

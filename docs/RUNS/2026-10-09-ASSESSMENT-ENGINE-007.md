# Run Report — 2026-10-09-ASSESSMENT-ENGINE-007

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted mutation, migration, schema or dependency change; no AI API; no UI/import wiring).
START_HEAD `928f314`; Plan-open `e9ea2a6`; V03_FREEZE_HEAD `2e84392`; harness `55b9fb5`; report `9ba123c`; wording fixes `04b2bbb`; LAST_VERIFIED_HEAD `9ba123c` (tests, typecheck, eslint fresh there; later changes docs-only). Commits unpushed and not deployed.

## Goal
Fresh held-out v0.3 validation of the Run 006 (FUB-066) decisions with the linter FROZEN: design a fresh corpus, label it independently, review labels, freeze (V03_FREEZE_HEAD), evaluate the unchanged linter, classify failures, queue human review, issue validation verdicts. No tuning. Detailed tables and per-case classification: `docs/ASSESSMENT_HELDOUT_V0_3.md` (not duplicated here).

## Slices (all DONE)
A author (blind to linter and v0.1/v0.2 text); B label; C label review; C2 freshness remediation (a mechanical check found 11 same-concept overlaps with earlier corpora plus 1 intra-corpus duplicate; replaced pre-freeze; the author worker had reproduced staple topics from model priors despite not reading fixtures); D freeze `2e84392`; E1 harness plus run `55b9fb5` (generic `runHeldOutEvaluationByGroup` in `golden/heldout-eval.ts` and `heldout-v0-3-eval.test.ts`); E2 classification, report, queue `9ba123c`; Z independent general review (KEEP; 0 blocker, 0 material, 3 minor doc nits fixed in `04b2bbb`); Z2 close.

## Results (FRESH_HELD_OUT_V0_3)
Evidence class: model-authored and model-labeled, NOT human ground truth, never pooled with v0.1/v0.2/FIRST_BLIND. 72 cases (70 items, 2 sets); 45 HE / 27 EN; 38 CLEAN / 34 FLAWED; 30 deterministic-labelled, 4 semantic-only.
TP 28 / FN 9 / FP 1 / UNLABELED 3; 1 of 38 clean cases warned. FN: 5 on implemented rules (STEM_TOO_SHORT HO3-038/040/042/044; OPTION_ALL_OF_ABOVE HO3-071) and 4 NOT_IMPLEMENTED. FP: HO3-005 STEM_NEGATIVE_WORDING.

## Methodology limits
Same model family for every worker; the reviewer edited corpus and labels pre-freeze; labels never human-approved; the labeler knew Run 006, so contract-shaped recall is not a fully independent test; blindness was instruction-level, not tool-enforced.

## Failure classes
UNSUPPORTED_RULE 4, KNOWN_WATCH 3, LABEL_QUESTION 3, CONTRACT_TOO_NARROW 1, CONTRACT_TOO_BROAD 1, LANGUAGE/MORPHOLOGY 1, LINTER_BUG 0, plus 8 SEMANTIC_ONLY rows.

## Human review queue
13 rows, MODEL_PROPOSED, not HUMAN_APPROVED: HO3-005, 058, 048, 071, 042, 040, 038, 044, 025, 028, 021, 004, 033.

## Verdicts and readiness
OPTION_ABSOLUTE_TERM 10/10/0/0/0 (TP/expected/FN/FP/UNLABELED) = VALIDATED_PROVISIONALLY (labels contract-shaped; weak-tier recall unmeasured). KEY_STEM_LEXICAL_OVERLAP 0 emissions = SEMANTIC_OWNERSHIP_CONFIRMED (no blatant-but-not-longest case in the corpus). STEM_TOO_SHORT 9/5/4/0/1 = KEEP_WITH_WATCH: the FUB-066 WATCH trigger is met (lookalike prefix/lead-word exemptions; HO3-071 'מהם' not a lead word; HO3-042 label contested); the 4-word floor is defensible. Integration readiness: NOT_READY (unchanged; linter unwired).

## FUB routing
FUB-066 stays RESOLVED_IMPLEMENTATION, annotated with v0.3 verdicts. FUB-074 stays open with HO3-025/028/033/058 as semantic fixtures. New: FUB-075 (STEM_TOO_SHORT exemption lookalikes and lead-word completeness), FUB-076 (STEM_NEGATIVE_WORDING relative-clause/contrast negation), FUB-077 (OPTION_ALL_OF_ABOVE phrase coverage). The 4 NOT_IMPLEMENTED rules stay in existing backlog items. Next recommended Run: human adjudication of the 13-row queue (HUMAN_ADJUDICATED_V0_3 overlay, frozen files untouched) before any linter change.

## Verification (fresh, final)
`npx vitest run src/domain/assessment`: 299 tests passed; `tsc --noEmit` clean; eslint clean (all at `9ba123c`; unit/typecheck/lint class only, no browser, hosted or production evidence). `04b2bbb` is a docs wording fix, so that evidence was reused, not rerun. Full unit suite not run (no shared code changed). `git diff 928f314 --stat -- src` lists only `golden/heldout-eval.ts`, `golden/heldout-v0-3/**` and `__tests__/heldout-v0-3-eval.test.ts`.

## Safety confirmations
`question-lint.ts` changed: NO. `text-normalize.ts` changed: NO. Threshold changed: NO. v0.2 corpus changed: NO. Human overlay changed: NO. Schema/migration: NO. Dependencies: NO. Hosted mutation: NO. Push: NO. Deploy: NO. Scratch artifacts (`scratch/**`, including `scratch/v03/**` and telemetry) are gitignored and not part of the repository.

## Mechanism evidence (autonomous-run)
7 fresh sequential workers (author, label, label-review, freshness remediation, evaluation, report, independent reviewer) plus the closer; zero STOP/ESCALATE events; no context compaction in the parent (telemetry: 0 compactions, highest ending context 15%); isolation held (no concurrent writers). Telemetry (`node .claude/telemetry/summarize.mjs`): 139 events, 1 session, 8 Agent dispatches, ~33m summed session time, ~97% prompt-cache hit, subagent hand-backs averaged ~36 chars (measured on 28 of 35 completions); runtime measurements, not billed tokens. Notable: the mechanical freshness check caught real contamination that instruction-level blindness did not prevent. Provisional call: KEEP (WATCH for the blindness limit: instruction-only blindness is not tool-enforced); not promoted to default policy from one Run.

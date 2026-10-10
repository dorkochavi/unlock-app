# Run Report — 2026-10-10-ASSESSMENT-ENGINE-010

Status: `COMPLETE`. DESIGN + PRE-REGISTRATION ONLY for FUB-076 (STEM_NEGATIVE_WORDING). No implementation. No push, merge, deploy, tag, hosted mutation, dependency, schema, API or UI change.
START_HEAD `a779ba4`. LAST_VERIFIED_HEAD `e388536` = the last commit that touches design content; later commits are Run-close documentation only. END_HEAD is derived from Git after the closing commit and is intentionally not self-cited here.

## Goal and scope decisions

Design and pre-register a structural / question-frame contract for `STEM_NEGATIVE_WORDING` from existing human-approved evidence. Human scope decisions (Dor, 2026-10-10): structural direction, no growth of a closed Hebrew negation-token list, cue whitelist or exception list; FUB-075 out of scope.

## Result

Full record: `docs/ASSESSMENT_STEM_NEGATION_DESIGN_V0_1.md` (D1 evidence table, D2 mechanism with fact/inference labels, D3 five candidates, D4 contract matrix, D5 decision and handoff).

- **Decision:** the governing relation ("negation controls which answer is selected") is semantic and cannot be implemented fully deterministically. Chosen design = Candidate C, a conservative hybrid: deterministic ownership only for SELECTOR-NEGATED-PREDICATE and EXCEPTION-SLOT frames (Hebrew and English). The Run 008 `SELECTION_CUES`/`CONTRAST_NEXT` mechanism is replaced, not extended. Everything outside the frames (imperative selection, comma-interrupted, wide NP, adnominal, scalar/absolute English) leaves deterministic ownership: AI OPTIONAL (detection) and HUMAN (severity), with no new signal.
- **Why alternatives lost:** A (adjacency window) succeeds on two human FP cases only by a K-edge coincidence and needs a different K per language; B (clause-aware) fails 4 of 7 human FPs because relative or coordinated negation is invisible without POS and it depends on punctuation; D (option-set-aware) is the correct semantics but not computable (semantic critic's job); E (demote) is the FALLBACK and is not worse than C on the human data alone (7 FP vs 2 defects), but gives zero signal today. C was chosen for coverage of the dominant frame at an enumerated precision cost, not because the human data prove it better.
- **Honest limits:** C is not list-free (closed classes, lexeme sets, one orthographic pattern, four numeric budgets). The budgets are determined only by authored rows; the relative budget is untested by any observed datum.
- **Pre-registered contract:** 73 new CONTRACT_TEST rows (33 EMIT, 25 SILENT, 6 PENDING_HUMAN, 9 LIMIT = 3 recall + 6 precision cost) plus 29 OBSERVED regression rows. `CONTRACT_TABLE_SHA256` `a16641cf...ef901` (recomputed from the committed document). The unchanged linter disagrees with the design prediction on 26 of the 58 EMIT/SILENT rows (8 misses, 18 emits). All observed cases are regression only; no row is fresh validation.
- **Paper projection (not validation):** observed v0.4 human-adjudicated negation rule would move from TP 5 / FN 1 / FP 5 to TP 5 / FN 1 (HO4-012, pending ruling) / FP 0. The design was derived knowing these cases.

## Review

Independent general review (`unlock-reviewer`): ACCEPT_WITH_CORRECTIONS, 0 blocker, 6 material, 5 minor. The reviewer reimplemented the pseudocode and reproduced all predictions, counts and the SHA. Corrections applied (commit `e388536`): English window 5 -> 8 (undisclosed loss of canonical long-NP stems) with CT-E10/E11; unevidenced copula block removed (CT-H13 added); `ש` complementizer / free relative precision costs disclosed (CT-H42, H44) and CT-H33 rationale corrected; one-token-head twins of HO3-005/HO4-007 recorded as LIMIT rows (CT-H45, H46); CT-H41 moved to PENDING_HUMAN (Q5); "closed grammatical class" claim made honest; Frame 2 selector-less precision cost disclosed (CT-H47); observed-stem provenance counts corrected (10 + 1 + 2 golden); candidate E rejection rationale made even-handed; v0.5 criteria gap, blindness and the weak FP bound stated. The corrected algorithm was re-executed in scratch against all 73 rows (mechanical cross-check, not an implementation in the repository).

## Human decisions required before an implementation Run (none to close this Run)

H1 accept recall loss for imperative-selection stems; H2 rulings Q1-Q5 (Q6 optional) on unreviewed shapes the design flips, notably HO4-012; H3 v0.5 acceptance and fallback criteria (document sections 7-8).

## Status routing

FUB-076: `DESIGNED_PRE_REGISTERED` (not implemented). No new FUB. FUB-074/075/059/067/077 untouched. `docs/ASSESSMENT_ENGINE.md`: one matrix row and a pointer on the 10.3 row (current-behavior text unchanged). No ADR (implementation-heuristic boundary in an unwired prototype, not an ADR-class decision). Integration remains `NOT_READY`.

## Verification (evidence classes stated)

- Docs-only change set: `git diff a779ba4..HEAD --stat -- src` is empty; `question-lint.ts`, `text-normalize.ts`, corpora, labels, overlays and freeze hashes unchanged.
- Measured facts about the UNCHANGED linter come from running a compiled scratch copy outside the repository (class: local execution of existing code).
- Contract table: row counts and SHA recomputed from the committed document; table predictions cross-checked by an independent scratch reimplementation (reviewer's, adjusted). Class: design consistency check, NOT product validation, NOT an implementation test.
- Assessment unit suite, typecheck and eslint were not rerun: no source changed after the fresh evidence at `fcc0ec3` (freshness rule, `.claude/rules/testing.md` section 2).
- `.claude/telemetry/verify-run-close.mjs`: see the closing result in the final handoff.

## Next

STOP. A future Run may implement only after H1-H3, starting with the PRE_REGISTERED_TEST commit (design document section 6), followed by a NEW fresh held-out v0.5 evaluated after the implementation. Do not push.

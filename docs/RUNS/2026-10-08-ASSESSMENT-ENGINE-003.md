# Run Report — 2026-10-08-ASSESSMENT-ENGINE-003

Status: `COMPLETE` (local only; no push, merge, deploy, tag, hosted/Supabase/Vercel mutation, migration, schema or dependency change; no AI API or Google contact).
START_HEAD `f729e65`; Plan-open commit `cd13fa3`; last verified content commit `4bb6753`; ORIGIN_MAIN `0ac70d1` (local main ahead, unpushed, not deployed). Scratch (git-ignored): `scratch/telemetry/**`.

## Goal
A: fix coarse per-Slice telemetry attribution. B: harden linter false positives, recalibrate the Golden Dataset, classify false negatives, prepare the Hebrew human review queue, recheck readiness (no integration). C: Learning Objectives v0.1 + Assessment Blueprint v0.1 design and a pure validation prototype. Product direction is owned by `docs/ASSESSMENT_ENGINE.md`.

## Slices and commits
| Slice | Commit(s) | Content |
|---|---|---|
| Plan | `cd13fa3` | Plan identity open |
| A | `9f4c542` | SKILL §7 `CURRENT_SLICE` pre-dispatch item; verifier advisory `checkSliceAttributionGranularity` (WARN-only) + 2 tests; OBSERVABILITY §11 sentence |
| B1-B2 | `2e379e2`, `ee4494e`, `cdfdcd1` | FP root cause + rule-level fixes; homoglyph fold; review fixes |
| B3-B5 | `b007952`, `7953113` | Recalibration, FN dispositions, 17-row Hebrew review queue, readiness recheck |
| C1-C2 | `9c366b1`, `8d821e3` | Learning Objectives + Blueprint design (`docs/ASSESSMENT_BLUEPRINT_V0_1.md`) |
| C3-C4 | `9a9920b`, `86cf398`, `b222245` | Pure `validateBlueprint` / `compareCoverage` prototype, 9 synthetic scenarios, review fixes |
| L | `4bb6753` | Ledger / routing docs (AE-028, AE-045, FUB-059/063/064, OQ-049, CONTEXT_MAP) |

## Slice A finding and telemetry acceptance
Run 002's coarse attribution was a PARENT PROCESS failure (9 workers, 4 distinct slice_ids; the instruction lived only in §13). Fix: SKILL §7 pre-dispatch item plus WARN-only verifier advisory. The skill change took effect only from this Run's bootstrap; the advisory ran at this Run's close.
Acceptance (runtime measurements, not billed tokens; scratch summary, pre-close): 13 workers dispatched (13 SubagentStart, 13 unique, all typed); distinct slice stamps A, B1, B2, B4, BREV, B3, B5, C1, C2, C3, C4, CREV, L1 (+V), one worker each; 284 events, 0 unattributed; parent main-context file reads 0, subagent reads 35; compactions 0; highest context 14%; hand-back average about 40 chars. Attribution verdict: PASS (Run 002: 4 distinct for 9 workers). Mechanism call: KEEP/WATCH, provisional.
Minor note: a session named for this Run was filed under the 002 telemetry folder for events before the Plan identity edit (preflight). Benign; the protocol already requires setting Plan identity before the first Bash.

## Linter calibration (Run 002 -> Run 003, evidence class: unit, Golden fixtures)
| Metric | Run 002 | Run 003 |
|---|---|---|
| Caught | 66/73 | 67/73 |
| False negatives | 7 | 6 |
| False positives | 4 | 0 |
| CLEAN cases that warn | 4/18 | 0/18 |
| Unsupported semantic | 6 | 6 |
| Precision-like | 66/70 | 67/67 |

Fixes (rule level): short Hebrew terms (<3 letters) accept only the `ו` prefix; contextual `חוץ מ…`; `at least` excluded; 14-entry Cyrillic/Greek to Latin homoglyph fold in `duplicateKey`. Caveat: fixture-fit / tuned-on-test. Accepted recall loss for `בכל/לכל/מכל/ככל` is documented and test-pinned. Independent review (`unlock-reviewer`): 0 material, 3 minor (2 fixed in `cdfdcd1`, 1 documented).

FN dispositions: 1 FIXED (homoglyph); 4 KNOWN_LIMIT (Hebrew inflection overlap, Hebrew near-duplicate inflection, overlap boundary, OPTION_COMBINATION_REFERENCE deferred to FUB-064); ARTICLE_MISMATCH TOO_NOISY / FUTURE_RESEARCH; OPTION_STYLE_OUTLIER FUTURE_RESEARCH.

Human Hebrew review queue: 17 rows in `docs/ASSESSMENT_CALIBRATION_V0_1.md` §10 (MODEL_REVIEWED_NOT_HUMAN_APPROVED). FUB-060 stays OPEN / DEFERRED. Readiness verdict: **NOT_READY** (linter is not wired anywhere).

## Blueprint
`docs/ASSESSMENT_BLUEPRINT_V0_1.md`: Part 1 Learning Objectives DESIGNED; Part 2 Blueprint DESIGNED. Pure prototype `src/domain/assessment/blueprint/blueprint.ts` (`validateBlueprint`, `compareCoverage`; `MAX_BLUEPRINT_COUNT = 1_000_000`) PROTOTYPED, unwired; 9 synthetic scenarios. Independent review: 0 material, 5 minor, all addressed in `b222245`.

## Ledger deltas
AE-028 IDEA to PROTOTYPED; AE-045 IDEA to DESIGNED; AE-011 stays DESIGNED. Counts before to after: IDEA 15 to 13, DESIGNED 16 to 17, PROTOTYPED 9 to 10; DEFERRED 4, HUMAN_GATE 2; none IMPLEMENTED or VERIFIED. FUB-059 narrowed (FP part resolved, residuals open); FUB-063, FUB-064 new; OQ-049 new (13 sub-questions; note FOLLOW_UP_BACKLOG also mentions a "former OQ-049" for an earlier resolved Topic-name decision, so the id is reused).

## Verification (evidence class: unit / static, local only; all at or after `4bb6753`)
- `vitest src/domain`: 32 files / 674 tests pass.
- `npm run typecheck`: clean. `eslint src/domain/assessment`: clean.
- `node --test .claude/telemetry/*.test.mjs`: pass (2 files).
- `git diff --check` START..HEAD clean; dependency diff (package.json / lock) none; schema / migration / supabase diff none; secret scan of START..HEAD diff none.
- NOT run (not relevant: no UI / route / DB change): full build, browser E2E, schema/PGlite.
- Note: `npx` transiently fetched `tsx` in a worker for a throwaway script; no repository dependency change.
- Not proven: any hosted behavior; Hebrew label correctness by a fluent human; real-item linter precision.

## Residuals
Linter and blueprint prototypes unwired; FUB-059 residuals; FUB-060 human Hebrew review; FUB-063 golden expansion; FUB-064 OPTION_COMBINATION_REFERENCE; telemetry attribution WATCH over further Runs. Unpushed local commits (32 above `origin/main` at close); `origin/main` is not Production and nothing here is deployed.

## Decision Packet (human)
1. FUB-060: a fluent Hebrew reviewer approves, edits or rejects the 17 queue rows in CALIBRATION §10. Needed before any instructor-facing wiring.
2. OQ-049: decide Learning Objective / Blueprint questions (13 sub-questions) before any schema or UI work.
3. Push of the 32 local commits remains a human action (ADR-019).

Optional next steps. NOW: human Hebrew review of the queue (FUB-060). NEXT: FUB-063 real-item golden expansion with held-out split; FUB-064 OPTION_COMBINATION_REFERENCE; decide OQ-049. LATER: wire lint into import (AE-031) only after the human review and a readiness recheck; DOCX/PDF/AI remain gated.

# UNLOCK — Development OS / Observability Longitudinal Review

RUN_ID: `2026-09-27-DEVOS-LONGITUDINAL-REVIEW` (meta-review, not a product Run; no Slices, no product code touched).

Status: COMPLETE. Performed before Run UX-03, per `docs/DEVOS_OBSERVABILITY.md` methodology
(`MEASURE → INTERPRET → COMPARE → ACT`). No composite productivity score produced.

## 1. Evidence Window

Level 2 automated telemetry (`docs/RUN_TELEMETRY.md` §26) began 2026-09-21. Runs before that
(`2026-09-20-001` through `-006`) have no machine telemetry and are out of scope for trend
analysis.

Runs with usable telemetry, in order:

| Run | Date | Summary generated at Run close? | Sessions | Shape |
|---|---|---|---|---|
| `2026-09-21-DEVOS-V1.2` / `-FINAL` | 09-21 | No (backfilled this review) | 2 + 1 | Thin DevOS design/compression passes (21, 51 events; $2.41–low cost) — reference points only, not compared as product Runs |
| `2026-09-21-007` | 09-21 | Yes | 2 | Structured Import V1 (multi-Slice) |
| `2026-09-22-008` | 09-22 | Yes | 1 | Authoring Integration + Pilot Readiness (6 Slices) |
| `2026-09-23-PRE-PILOT` | 09-23 | Yes | 1 (shared with Run 008 closeout) | Investigation/hosted-verification, not implementation |
| `2026-09-25-009` | 09-25 | Yes | 3 (multi-day) | Learner Progress + Instructor Insights |
| `2026-09-26-010` | 09-26 | No (backfilled; excluded) | 1 | 17-event, 1-file-read artifact — a momentary Plan `RUN_ID` value during the UX-01 rename, not a real Run (see §5) |
| `2026-09-26-UX-01` | 09-26 | **No** (backfilled this review) | 1 | Learner UX Foundation |
| `2026-09-26-UX-02` | 09-26/27 | **No** (backfilled this review) | 5 (see §5 — inflated) | Course/Topic Practice, plus this review's own session |

**Two consecutive Runs (UX-01, UX-02) never had `node .claude/telemetry/summarize.mjs` run at
their own close**, unlike 007/008/PRE-PILOT/009. This review generated all three missing
summaries (`2026-09-26-010`, `-UX-01`, `-UX-02`) retroactively before any of the analysis below
was possible. That is itself a finding — see §6.

Comparable trend Runs (had real implementation Slices and clean per-Run telemetry): **007, 008,
PRE-PILOT (investigation shape, flagged separately), 009, UX-01, UX-02**.

## 2. Trend Summary

### 2.1 Performance / context (paired per `DEVOS_OBSERVABILITY.md` §4 — never read in isolation)

| Metric | 007 | 008 | PRE-PILOT | 009 | UX-01 | UX-02 |
|---|---|---|---|---|---|---|
| Peak/ending context | 57% | 54% | 59% | 47% | 41% | 51% |
| Compactions | 0 | 0 | 0 | 0 | 0 | 0 |
| Cache hit ratio | 99% | 100% | 99% | 98% | 99% | 98% |
| Re-read rate | 63% | 48% | 27% | 38% | 29% | 38% |
| Tool failures | 3 | 0 | 6 | 6 | 0 | 3 |
| Blocking/CORRECTION findings at review | 2 gaps (S4, S6) | 1 recurrence (S4) | 2 real TLS defects | 2 test-defect fixes (S3) + 1 escaped regression (join `next=`, caught by human Preview) | 2 CORRECTIONS | **0** |

- **Context/compaction never became a binding constraint in any of the six measured Runs** — peaks
  ran 41–59% of a 1,000,000-token window with 0 compactions across the board. This is a clean,
  consistent "no action" signal, not something that improved or degraded — it was already fine at
  the start of the telemetry window and stayed fine.
- **Cache hit ratio stayed 98–100% in every Run** — no degradation trend.
- **Re-read rate has no visible relationship to the paired quality signal.** 007 had both the
  highest re-read rate (63%) and review-stage gaps; UX-02 had a middling re-read rate (38%) and
  zero blocking findings across three reviewer dispatches — the cleanest Run in the window. This
  matches `DEVOS_OBSERVABILITY.md` §5 ("frequent read ≠ inefficiency") rather than contradicting
  it; re-read rate alone should not be treated as an efficiency KPI here.
- **Reviewer selection scaled with actual changed-surface risk in every Run reviewed** (007, 008,
  009, UX-01, UX-02 Run reports each state this explicitly and evidence it per-Slice) — no
  Slice received a reviewer "by default," and no Slice that plausibly needed one went without.
  This is the strongest, most consistently repeated KEEP signal in the whole window.
- **Subagent hand-back size stayed compact throughout**: average hand-back characters per Run were
  184 (007, mostly unmeasured), 287 (008), 363 (PRE-PILOT), 203 (009), 445 (UX-01), 349 (UX-02) —
  no Run's subagent reports ballooned into a main-context cost problem.
- **Quality trend has a real high-water mark in Run UX-02**: zero blocking or CORRECTION findings
  across P2 (general+DB), P3 (security), P4 (general) reviewer dispatches — the only Run in the
  window with a clean sweep. This should be read as one good data point, not a proven trend
  (Signal Horizons, `DEVOS_OBSERVABILITY.md` §6).
- **The sharpest single quality gap in the window is Run 009's join-intent bug**: a client-side
  `?next=` read at render time (not submit time) broke join-through-auth, and it escaped
  typecheck, lint, the full unit suite, PGlite/schema evidence, and the mocked browser matrix —
  every automated layer — and was only caught by manual Preview. Run-local so far (one
  occurrence); worth watching for a second instance before treating it as a systemic gap in how
  client-render-timing bugs are covered.

### 2.2 The Run-007/008/UX-01 review pattern (now resolved this Run — see §7)

A specific, repeatable near-miss pattern recurred across three separate Runs:

- **Run 007** (S4, S6): a named negative/isolation scenario in the Slice's own accepted
  acceptance criteria (a TOCTOU race; a genuine-rollback proof) reached review without being
  explicitly tested — caught only by the reviewer, not by targeted verification.
- **Run 008** (S4): the same category recurred in a more specific form (a test asserted the
  right *thing*, but through a code path that didn't actually isolate the branch under test).
  This crossed `DEVOS_OBSERVABILITY.md` §6's cross-Run bar and was promoted to `CHANGE CANDIDATE`
  in `docs/DEV_STATUS.md` on 2026-09-22 — but never absorbed into policy.
- **Run UX-01**: a general-reviewer CORRECTION on the golden-path E2E test — "reload assertion no
  longer proved persistence" — is the same category again: a test claimed to prove something it
  did not actually exercise, caught only at review.

Three separate Runs, the same category, spanning six days — this is exactly the cross-Run
evidence `DEVOS_OBSERVABILITY.md` §8 requires before a `CHANGE` is real, and it sat as an
unresolved `CHANGE CANDIDATE` for three more Run cycles (009, UX-01, UX-02) without being decided
either way. See §7 for the resolution applied in this Run.

## 3. HOT / WARM / COLD Cross-Run File Temperature

| File | 007 | 008 | PRE-PILOT | 009 | UX-01 | UX-02 | Verdict |
|---|---|---|---|---|---|---|---|
| `docs/CHATGPT_PLAN.md` | 10 | – | 1 | 1 | – | 7 | **Healthy HOT** — the intended HOT-tier doc, read at every Run/Slice boundary. Working as designed. |
| `docs/DEV_STATUS.md` | – | – | 1 | 3 | – | 5 | **Healthy HOT** — same; intended HOT tier. |
| `src/app/instructor/courses/[courseId]/import/page.tsx` | 10 | 5 | – | – | – | – | **Correctly cooled** — hot only while Structured Import V1 was being built (007–008), silent since. Not a compression candidate. |
| `src/application/import/preview-import.ts` | 9 | 3 | – | – | – | – | **Correctly cooled**, same reason. |
| `src/application/dailyPlan/get-or-create-daily-plan-for-today.ts` (+its test) | – | 8 / 10 | – | – | – | – | **Correctly cooled** — hot only for Run 008 S4's archived-Course eligibility fix; not touched again even though UX-01/UX-02 both build on DailyPlan/Today. |
| `src/domain/import/types.ts` | 7 | – | – | – | – | – | **WATCH, unchanged** — the "bundles 3 concerns" observation is still valid and still dormant; import work hasn't recurred, so there's no new evidence either way. |
| Test-fakes-as-template full reads (`*/__tests__/in-memory-fakes.ts`) | 7 | 4 | – | – | – | – | **DROP** — hot in 007 and 008 only; absent from the most-read list in the three subsequent Runs (PRE-PILOT, 009, UX-01, UX-02). The evidence that motivated the WATCH no longer holds (`DEVOS_OBSERVABILITY.md` §8). |
| `src/domain/learning/answer.ts` full-read pattern | 1 full read (007) | – | 1 (via shell, not "hot") | – | – | – | **DROP** — the Run-007 full-read need has not recurred in four later Runs. |
| `src/application/learning/submit-answer.ts` | – | – | – | – | 2 | 3 | **Healthy WARM, trending** — the shared Answer funnel, now touched by two consecutive learner-UX Runs because Practice deliberately reuses it (ADR-010/012, "one pipeline"). This is the intended architecture working, not a refactor signal. |
| `src/domain/learning/progress-update.ts` | – | – | – | – | – | 4 | **New HOT, driven by a real change** — UX-02 P1 added the early-correct Practice scheduling rule here. Not rediscovery. |
| `docs/LEARNING_ENGINE.md` | – | – | – | – | – | 5 | **COLD used correctly** — loaded only by the one Run that needed §39A. **WATCH going into Run 010** (Learning Intelligence is likely to need it again; worth a second data point before concluding anything about its internal navigability). |
| `docs/UNLOCK_CAPABILITY_MAP.md` | – | – | – | – | – | 4 | **COLD used correctly** — scoped to UX-02's own P0 design phase. |

**No file in this window shows the pattern that would justify a refactor/compression
recommendation** (a file staying inappropriately HOT across multiple Runs *after* its own feature
shipped, or a COLD file being reopened in full for small facts repeatedly across Runs). That is an
explicit no-action conclusion, not an absence of looking.

## 4. Context Efficiency

- Repeated reads observed were justified in every case checked: Slice-boundary Plan/Status reads,
  reviewer re-reads after a relevant change, and in-Run iteration on files actually being edited.
  No cross-Run rediscovery pattern (the same fact re-learned from scratch in a later, unrelated
  Run) was found.
- No oversized canonical document showed up as a repeated full-read cost across Runs — `LEARNING_ENGINE.md`
  and `UNLOCK_CAPABILITY_MAP.md` were read several times *within* UX-02 (Cross-Slice, not
  Cross-Run — the weaker signal horizon per `DEVOS_OBSERVABILITY.md` §6) but that is exactly what
  a COLD design-phase Run should look like.
- `CONTEXT_MAP.md`'s Task → Smallest Context table continues to route correctly: every COLD
  document that got opened had a task-specific reason (ADR/§39A for the Practice scheduling rule,
  the Capability Map for the P0 design pass), not blind preloading.
- No evidence of unnecessary reviewer/context duplication — every Slice's reviewer set matched its
  own stated risk, and no reviewer output shows a body larger than a few hundred characters
  entering the main session (subagent hand-back sizes, §2.1).

## 5. RUN_ID / Telemetry Attribution (new finding this review)

`RUN_ID` is resolved live from `docs/CHATGPT_PLAN.md`'s `RUN_ID:` field
(`.claude/telemetry/summarize.mjs`/`collect.mjs`), and a Run is defined as "one or more Claude
sessions" under that live value (`docs/RUN_TELEMETRY.md` §4). Two concrete consequences observed
in this window:

1. **`2026-09-26-010`** is a 17-event, one-file-read telemetry folder with no real Slice work in
   it — it is simply what got attributed to `RUN_ID` while the Plan file said `010` for a few
   minutes during the Run UX-01 rename (`docs/RUNS/2026-09-26-UX-01.md` line 41 already documents
   the rename itself). Correctly excluded from trend comparison; noted here so it isn't mistaken
   for a real, unreported Run.
2. **This review session is itself running under `RUN_ID: 2026-09-26-UX-02`**, because the Plan
   file's `RUN_ID:` field was never changed after Run UX-02 closed. The two prior sessions that
   recorded the manual Preview-QA and Production-smoke verifications (docs-only, legitimately part
   of closing out UX-02) are also inside that same telemetry folder — but so is this
   Development-OS review, which is explicitly *not* part of Run UX-02's product scope. That is why
   `2026-09-26-UX-02`'s summarized cost/duration (5 sessions, $44.93, 7h9m) in §1 is **not
   comparable** to the other Runs' figures — it now conflates a closed Run with unrelated
   follow-on work.

This is Run-local so far (observed once, this session) but the mechanism is structural, not
incidental — it will recur for every future docs-only or meta session that runs before a Plan's
`RUN_ID` is updated. Recorded as `WATCH`, not `CHANGE` (single occurrence; per
`DEVOS_OBSERVABILITY.md` §8, cross-Run evidence should precede a policy change unless it's a
safety blocker, and this isn't one). See §8 recommendation 2.

## 6. Telemetry-Summary Generation Gap (new finding this review)

`docs/RUN_TELEMETRY.md` §3 expects: silent collection → deterministic summarizer → compact summary
→ Run Report. That pipeline's last two steps did not happen at Run close for **two consecutive
Runs** (UX-01, UX-02) even though raw collection kept working — Run UX-01's own report says so
explicitly ("Not summarized for this Run: NOT AVAILABLE"), and Run UX-02's report has no Telemetry
section at all. This review had to run the summarizer manually for both before any of the analysis
above was possible. Two separate, consecutive Runs both skipping it is cross-Run evidence of a
real process gap, not one noisy Run. Recorded as `WATCH` with a concrete recommendation (§8.3) —
not implemented this Run, since the fix belongs in Slice/Run-close orchestration
(`.claude/skills/implement-slice/SKILL.md` or kernel §12), a more sensitive surface than a
verification-rule addition, and is better made as its own deliberate decision.

## 7. KEEP / WATCH / CHANGE / DROP

**KEEP** (strongly, repeatedly evidenced across the whole window):
- Risk-based reviewer selection scaled to actual changed-surface risk (007, 008, 009, UX-01, UX-02
  — no exceptions found).
- Background-subagent discipline for reviewers/audits — no polling loops in any Run.
- Deliberate evidence reuse across Slice boundaries (007 S5; UX-02 §5 "Reused (not rerun)") instead
  of blind re-verification.
- Full-suite reruns used *when* cross-cutting risk justified them, not avoided dogmatically (008
  S1/S4; UX-02 P1) — `.claude/rules/testing.md` §5 working as intended in both directions.
- Mandatory security review for trust/TLS/secret-adjacent changes (PRE-PILOT: both real TLS
  defects found only there).
- Human-only push/hosted-mutation gates — never bypassed in this window.

**DROP** (evidence that motivated the WATCH no longer holds, 3+ Runs without recurrence):
- `src/domain/learning/answer.ts` full-read-for-one-fact pattern.
- Test-fakes-as-template full reads.

**WATCH** (kept open; single-Run or non-binding evidence):
- `src/domain/import/types.ts` bundling three concerns — dormant, unchanged.
- Telemetry has no native per-Slice attribution — still true; this review needed manual
  reconstruction from Run-report prose to get per-Slice review/finding data.
- Edit/Write tool-result echoes as a large fraction of tool-response characters — recurred (007
  yes, 008 no/non-binding, PRE-PILOT yes at 48%) but never once caused a compaction across any of
  6 measured Runs. **Correcting a stale conclusion**: `docs/DEV_STATUS.md` previously called this
  a "candidate for DROP if a future Run also shows no material impact" — PRE-PILOT (after that
  note was written) showed the pattern recur, so it is updated to WATCH, not dropped, but it also
  is not promoted to CHANGE since no Run has shown actual harm.
- Run 009's join-intent bug that escaped every automated layer and was only caught by manual
  Preview — one occurrence; the sharpest quality gap in the window, worth a second data point.
- RUN_ID attribution drift for post-close/meta sessions (§5) — new, Run-local.
- Telemetry-summary generation skipped at Run close for UX-01 and UX-02 (§6) — new, cross-Run (2
  Runs).

**CHANGE (implemented this Run — see below):**
- The Run 007/008/UX-01 "named negative-case scenario proven only at review" pattern, absorbed
  into `.claude/rules/testing.md`.

## 8. Recommendations Before UX-03

1. **(Done this Run)** Absorbed the three-Run `CHANGE CANDIDATE` into
   `.claude/rules/testing.md` §1 (one line, evidence-cited); updated `docs/DEV_STATUS.md`'s rolling
   Active Observations to reflect the `ABSORB`, the two `DROP`s, and the corrected Edit/Write-echo
   framing, and added the two new `WATCH` items from §5/§6. Docs-only; no product code touched.
2. **Give the next unrelated session its own `RUN_ID`.** Before starting Run UX-03 (or any other
   non-UX-02 work), update `docs/CHATGPT_PLAN.md`'s `RUN_ID:` field first, so its telemetry stops
   accumulating inside the already-closed `2026-09-26-UX-02` folder.
3. **Add "run the telemetry summarizer" to the Run-close checklist.** Not implemented here
   (touches Slice/Run-close orchestration, a more sensitive surface); left as an explicit decision
   for whoever next edits `.claude/skills/implement-slice/SKILL.md` or kernel §12.
4. **No product-code, test, or `src/**` change is recommended from this review.** Every file that
   showed up HOT in this window was hot because of an actual in-Run change (§3); nothing is
   flagged as a compression/refactor candidate.
5. **No composite score, and no single Run's shape was used alone to justify a change** — PRE-PILOT's
   investigation-heavy profile and 009's multi-day idle span were both excluded from
   apples-to-apples cost/duration comparison rather than blended in.

## 9. Explicit No-Action Conclusions

- Context/compaction pressure: never binding in any of 6 measured Runs — no action.
- Cache hit ratio: consistently 98–100% — no action.
- Re-read rate: no observed relationship to rework/quality — not adopted as an efficiency signal.
- Subagent hand-back size: stayed compact (183–445 chars average) throughout — no action.
- `src/domain/import/types.ts`'s bundled concerns: still not costly while import work is dormant —
  remains WATCH, not promoted.
- HOT/WARM/COLD file temperature: no file requires compression or refactor based on read-frequency
  evidence in this window.

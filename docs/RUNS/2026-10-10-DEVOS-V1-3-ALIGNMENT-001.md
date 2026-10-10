# Run 2026-10-10-DEVOS-V1-3-ALIGNMENT-001 — DevOS alignment

Status: COMPLETE
RUN_ID: 2026-10-10-DEVOS-V1-3-ALIGNMENT-001
START_HEAD: `1da8b51`; content commit `617509a`. NO PRODUCT CHANGE. NO PUSH.

## Root causes
- **Discovery miss:** the verifier was already indexed in `docs/CLAUDE_CODE_OPERATING_GUIDE.md`, but nothing told Claude to consult the guide first (it was "not preloaded; read for a map").
- **Telemetry gap:** `cat/sed/grep` via Bash was `SHELL`/`shell:other`; native reads are only Read/Grep/Glob.
- **Cost blind spot:** only a total `tool_response_chars` existed.
- **Stale slice:** `CURRENT_SLICE` was read from an untracked checkpoint that nothing tied to a Run, so Run 009's `Z2` stamped two later Runs.

## Changes
- **D1:** Operating Guide §0 = Operational Discovery Index (no second index); one-line pointer in `CLAUDE.md` §1; CONTEXT_MAP row reworded.
- **D2:** `nav:*` command classes (leading-word match; `sed` only as `-n` non-in-place); summary adds `repository_access` (native reads / native searches / shell navigation, separate) and `response_sizes` (by tool, by first command class, max, top-5 metadata). No paths, commands or bodies stored.
- **D3:** `readSliceId` honors `CURRENT_SLICE` only if the checkpoint's `RUN_ID:` equals the Plan's; verifier `checkStaleSliceAttribution` WARNs (never FAILs, silent without telemetry/table) on slice_ids the Plan table does not declare.
- **D4 replay** (old vs new summarizer code over the same frozen raw copies, 74 and 28 events): zero drift in every existing value. Stale `Z2` surfaced for both Runs. Shell navigation reads 0 for both (not recorded before `nav:*`). Hotspot: Edit responses (569,632 of 801,714 and 388,346 of 448,823 chars), not Bash.
- **D5:** DEV_STATUS 270 → 224 lines, 55,812 → 28,357 characters (not tokens), 13 sections unchanged. Removed per-Run narrative owned by Git/`docs/RUNS/**` (all cited reports exist); kept Production/release truth, undeployed boundary, capabilities, Pilot focus, risks, human gates. Corrected stale items (FUB-068 now "decided Option B"; removed outdated `ORIGIN_MAIN`). Open FUB/OQ ids no longer listed there remain owned by FOLLOW_UP_BACKLOG / OPEN_QUESTIONS.
- **D6:** context-shape guidance (declare expected owners, broad reads, subagents, high-output ops; >300-line files default to targeted reads) in `implement-slice` §3; guidance, no numeric budget.

## Verification and review
`telemetry.test.mjs` 14/14, `verify-run-close.test.mjs` 27/27, `node --check` on all telemetry scripts; privacy tests assert no command text in raw events or summaries; no `src/**`, schema, dependency, API or UI file changed. Independent review (`unlock-reviewer`): KEEP_WITH_FIXES, 0 blocker / 0 material. Applied: `sed -i.bak` in-place hole (+ test), trailing punctuation in Plan slice ids, removed duplicated policy sentence. Not changed: pipe-only compound commands and PowerShell aliases (`gc`, `type`, `sls`) are not classified, and write-form `cat > f` counts as nav (documented lower bound).

## Limitations / WATCH (not policy)
- Shell navigation is a lower bound and not recorded for pre-V1.3 Runs.
- Edit/Write echo dominance is from two Runs of different scope.
- Context-shape practice rests on one two-Run comparison; pair with quality evidence.
- Ending context 20% is the last runtime snapshot, not an interactive `/context` reading.
- Replay summaries for the two old Runs were regenerated in local ignored `scratch/telemetry`, which also grew with later same-day events.

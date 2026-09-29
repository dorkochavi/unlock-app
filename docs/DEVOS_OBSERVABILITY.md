# UNLOCK — Development OS Observability Methodology

Status: ACTIVE
Load level: COLD — load only when interpreting telemetry, running a context-cost/source-context audit, or deciding whether an observation should change policy. Not normal Run/Slice context.

This file owns **how to interpret** UNLOCK development-execution signals. It does not own product policy, testing policy, or reviewer selection, and it is not a metrics dump or a Run diary — raw numbers live in `scratch/telemetry/**` and `docs/RUNS/**`.

## 1. Purpose

Observability exists to improve how UNLOCK development work is performed — not to minimize any proxy metric.

The goal is **not** minimum tokens, minimum file reads, minimum tool calls, minimum reviewers, or minimum time.

The goal is:
- reliable delivery;
- appropriate evidence for the actual risk;
- low unnecessary rework;
- efficient context use;
- increasingly better Development OS decisions across multiple Runs.

A number moving in the "efficient" direction is not itself success. See §4.

## 2. Evidence Sources

Four complementary sources, none of which substitutes for another:

- **Git / test output** — deterministic repository truth (commits, diffs, pass/fail). Always authoritative for "what actually happened to the code."
- **UNLOCK telemetry** (`.claude/telemetry/**` → `scratch/telemetry/<RUN_ID>/**`) — Run-specific execution behavior: file/tool activity, verification commands run, reviewer dispatch, evidence reuse.
- **Claude Code `/context`** — native current-session context composition and aggregate context-cost diagnostics. Session-scoped only; resets each session.
- **Claude Code `/insights`** — native cross-session behavioral/friction analysis; an independent second opinion on patterns across many sessions.

**Native recommendations (from `/context` or `/insights`) are inputs to analysis, not automatically accepted Development OS policy.** Both are generic tools with no knowledge of UNLOCK's own accepted architecture, Slice discipline, or reviewer risk model — treat their suggestions the way you'd treat a linter's suggestion: informative, not binding.

## 3. Analysis Loop

`MEASURE → INTERPRET → COMPARE → ACT`

Never `measure → immediately optimize`.

- **MEASURE** — what happened? Use the narrowest evidence source in §2 that answers the question.
- **INTERPRET** — why did it happen? A raw count has no meaning without a cause (edit-driven, reuse-driven, review-driven, rediscovery-driven, etc.).
- **COMPARE** — is this Run-local, cross-Slice, or cross-Run? A single Run's evidence is a data point, not a trend (§6).
- **ACT** — one of `KEEP` / `WATCH` / `CHANGE` (see §8 for how `CHANGE` is promoted).

## 4. Paired Signals

Every efficiency signal must be read beside its corresponding quality signal — never in isolation:

| Efficiency signal | Paired quality signal |
|---|---|
| fewer tool calls | missed criteria / reviewer corrections |
| shorter Slice | rework / defects found later |
| fewer file reads | missed context / rediscovery |
| fewer reviewers | risk coverage / material findings |
| fewer tests | acceptance criteria actually proven |
| lower cost | completed scope and correction rate |
| lower context use | ability to find authoritative ground truth |
| greater autonomy | `PLAN_CONFLICT` / scope drift / human intervention |

Do not create a composite Development-OS efficiency score. A single number cannot carry both halves of a pair honestly.

## 5. Interpretation Rules

- Frequent read ≠ inefficiency.
- Large file ≠ context problem.
- High churn *within the Run that created a file* ≠ structural debt.
- Reviewer subagent file reads do not enter the main-session context; only the final hand-back report does.
- High test count ≠ strong verification.
- Low tool count ≠ good execution.
- Low token/cost usage ≠ a successful Run.
- Native `/context` optimization suggestions are generic heuristics, not repository-specific verdicts.
- **Repeated cross-Run rediscovery + low context utility + duplicated/history-heavy content already owned elsewhere is stronger evidence of a real context problem** than any single one of those alone.

**Context utility per read** (qualitative, not a score): how much of what a file read actually loaded was useful for the reason it was opened? A full read of a dense multi-purpose file to extract one small fact has low utility-per-read even if the read itself was justified; a full read of a small, focused, single-purpose file that is then reused unchanged by three later Slices has high utility-per-read. Judge this narratively per finding — do not reduce it to a number.

## 6. Signal Horizons

- **Run-local** — observed once, in one Run. Weakest evidence; often circumstance, not pattern.
- **Cross-Slice** — observed more than once within a Run, across independent Slices. Stronger — suggests something about the Run's own shape, not a one-off.
- **Cross-Run** — observed again in a *later, separate* Run. Strongest — this is what actually justifies a canonical policy change.

**Prefer cross-Run evidence before changing canonical policy**, unless the issue is a correctness/safety blocker (in which case act immediately regardless of horizon).

## 7. Near Misses and Process Rework

**Near miss**: a real issue caught before final delivery — especially by review or checkpoint — even though no bad commit ultimately survived. Track the *category/pattern*, never "which agent/reviewer missed it."

Examples:
- a named acceptance criterion reached review without explicit proof it was tested;
- evidence was claimed to cover more than a test actually exercised;
- factual handoff metadata (commit hash, test count, HEAD state) drifted from reality;
- verification was replayed without a relevant change justifying it.

**Process rework**: unplanned work caused by an earlier preventable miss — a reviewer correction plus re-verification, undoing scope drift, or repairing an incorrect assumption discovered late. Rework is a cost signal in its own right, independent of whether the final commit was correct.

## 8. Promotion Lifecycle

`OBSERVATION → WATCH → CHANGE CANDIDATE → EXPERIMENT / OWNER CHANGE → VALIDATE → ABSORB OR REVERT`

Also allowed: `WATCH → DROP`, when the evidence that motivated the watch no longer holds (e.g. a later Run shows the pattern didn't recur).

A `CHANGE` item is only real once it states all of:
- **evidence** (which Run(s), what was measured);
- **smallest proposed change** (not a redesign);
- **canonical owner** (which file/skill/rule actually changes — `CLAUDE.md`, a `.claude/rules/*`, a skill, or product code);
- **expected effect** (what should measurably differ afterward);
- **guardrail** against a new regression (what would tell us the change made something else worse);
- **observation window** (how many Runs/Slices before judging it).

## 9. Information Ownership — One Fact, One Home

| Home | Owns |
|---|---|
| `scratch/telemetry/**` | raw/derived machine telemetry; disposable, gitignored |
| `docs/RUNS/<run>.md` | detailed Run evidence and retrospective |
| `docs/DEV_STATUS.md` | only *currently active* WATCH/experiment state (rolling, not a diary) |
| `docs/FOLLOW_UP_BACKLOG.md` | only concrete deferred work already decided |
| `docs/DEVOS_OBSERVABILITY.md` (this file) | stable interpretation methodology |
| the canonical policy owner (`CLAUDE.md`, a `.claude/rules/*`, a skill) | validated policy after evidence clears §8 |

`docs/DEV_STATUS.md`'s Active Observations section is **rolling state, not an accumulating diary** — an item leaves it the moment it resolves (`DROP`, `ABSORB`, or `REVERT`), it is not archived there for history. History belongs to `docs/RUNS/**` and Git.

## 10. Ownership Boundary — This File vs. Current State

This file defines **how** observations are interpreted and promoted (§§3, 6-8) — it is timeless methodology, not a record of any Run's conclusions.

- Current `WATCH` items, experiments in flight, and evidence-backed non-actions belong in `docs/DEV_STATUS.md`'s rolling Active Observations section, never here.
- Detailed supporting evidence for any of those items belongs in the relevant `docs/RUNS/<run>.md`, never here.
- Current conclusions must not accumulate in this methodology file — if a specific finding needs stating, it goes in `docs/DEV_STATUS.md` or a Run Report, not as a new subsection here.
- Future evidence may freely change current conclusions (§6) without requiring any change to this file — only a change to the interpretation *method itself* (the loop, the paired-signal discipline, the lifecycle, the ownership table above) is a change to this file.

## 11. Telemetry Event Semantics (canonical interpretation)

Owner of how raw events and summaries are read. Implementation: `.claude/telemetry/collect.mjs` (events), `summarize.mjs` (summary), `verify-run-close.mjs` (attribution sanity); tests in `.claude/telemetry/*.test.mjs`. Design intent and metric catalogue: `docs/RUN_TELEMETRY.md`.

**What telemetry is.** Runtime session/context measurements (event counts, characters, durations, session snapshots) — not billed tokens, not an invoice. Metadata only: never file contents, prompts, or tool-response bodies.

**Event record** (`scratch/telemetry/<RUN_ID>/raw/<session_id>.jsonl`, `schema_version: 1`):

| Field | Meaning |
|---|---|
| `event` | Claude Code hook name (`SessionStart`, `PostToolUse`, `SubagentStart`, `SubagentStop`, ...) |
| `activity` | Collector class derived from `event`/tool: `SESSION_START/END`, `INSTRUCTION_LOAD`, `FILE_READ/EDIT/WRITE`, `SEARCH_GREP/GLOB`, `SHELL`, `TOOL`, `SUBAGENT_START/STOP`, `COMPACT_START/END`, `LIFECYCLE` |
| `run_id` | Plan `RUN_ID` at event time (§ RUN_ID attribution below) |
| `session_id` | Claude session; a Run spans one or more sessions |
| `slice_id` | Optional (absent/`null` = unattributed); first token of the `CURRENT_SLICE:` line in `scratch/development_checkpoint.md` at event time. Never guessed after the fact |
| `agent_id` / `agent_type` | Present on events emitted by or about a subagent; absent = main session. `agent_type` is empty for untyped background/internal agents |

**RUN_ID attribution.** Every event is filed under the Plan's `RUN_ID` read at that event's time, so a Plan `RUN_ID` that is stale (not updated at Run start) silently files the whole Run under the previous Run's folder. Hooks read only the Plan; `UNLOCK_RUN_ID` is an explicit user-set override (outranks the Plan in collector, summarizer, and statusline) and is never persisted by the collector. Establish the Plan identity before the first worker; `verify-run-close.mjs` emits WARN-only attribution-sanity findings (missing Run folder; near-zero events despite many commits since `START_HEAD`; a recently active session in another folder whose name references this Run).

**Subagent metrics.** `SubagentStart` fires only for agents dispatched via the Agent tool; `SubagentStop` also fires for untyped background/internal agents that have no start, no tool events, and tiny hand-backs. A resumed agent emits several start/stop events per `agent_id`. Therefore `started` (start events) and `completed` (all stop events) are different categories and are not expected to match; compare `started` with `completed_dispatched` (stops with a matching start or a non-empty `agent_type`); `completed_background_untyped` is reported separately.

**Per-Slice attribution.** `summarize.mjs` adds a per-Slice table only when some event carries `slice_id`; Runs collected before the marker existed summarize unchanged, with no per-Slice section.

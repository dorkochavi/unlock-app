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

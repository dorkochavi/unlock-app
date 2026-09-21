# UNLOCK — Run Telemetry

Status: ACTIVE

Load level: COLD

Purpose: define how UNLOCK measures the efficiency, context usage, tool activity, and execution characteristics of development Runs.

This document owns the **telemetry model**.

It does not own:

* current Run execution;
* testing policy;
* reviewer selection;
* product analytics;
* repository current state;
* Claude Code configuration details.

Current execution belongs to `docs/CHATGPT_PLAN.md`.

Historical Run summaries belong in `docs/RUNS/**`.

Raw telemetry is temporary/local and belongs under `scratch/telemetry/**`.

---

# 1. Why Run Telemetry Exists

UNLOCK treats the Development OS itself as something that can be measured and improved.

Run telemetry should help answer questions such as:

* How much context did a Run require?
* Which files were actually needed?
* Which files were read repeatedly?
* Which instructions loaded automatically?
* How often were COLD or historical documents needed?
* Were large investigations isolated in subagents?
* How often did context compaction occur?
* How much time and token usage did the Run consume?
* Which tools consumed the most time/context?
* Did review create meaningful corrections?
* Did the Context Map lead Claude to the correct source efficiently?
* Are Development OS changes reducing context cost over time?

Telemetry exists to improve the development system.

It must not become a second development task.

---

# 2. Design Principles

Run telemetry should be:

* automatic where reliable;
* deterministic where possible;
* low-overhead;
* outside the main model context;
* privacy-conscious;
* honest about unavailable data;
* summarized once at Run closeout;
* comparable across Runs.

Do not ask Claude to manually maintain a telemetry diary during implementation.

Do not inject raw telemetry into the conversation.

---

# 3. Telemetry Architecture

Preferred flow:

```text
Claude Code lifecycle
→ silent local collectors
→ scratch/telemetry/<RUN_ID>/
→ deterministic summarizer
→ compact telemetry summary
→ Run Report
```

Raw event data remains local and temporary.

Claude should normally read only the generated summary.

---

# 4. Run Identity

Telemetry should be grouped by the active `RUN_ID` from:

`docs/CHATGPT_PLAN.md`

A Run may span multiple Claude Code sessions.

Therefore:

```text
Run
  └── one or more Claude sessions
```

`session_id` must not be treated as equivalent to `RUN_ID`.

If no valid active Run ID can be resolved:

```text
RUN_ID = UNASSIGNED
```

Do not invent a Run ID.

---

# 5. Raw Telemetry Location

Use:

```text
scratch/telemetry/<RUN_ID>/
```

Example:

```text
scratch/
└── telemetry/
    └── 2026-09-22-007/
        ├── raw/
        │   ├── <session-id>.jsonl
        │   └── <session-id-2>.jsonl
        ├── sessions/
        │   ├── <session-id>.json
        │   └── <session-id-2>.json
        ├── summary.json
        └── summary.md
```

`scratch/**` remains local/non-canonical.

Raw telemetry must not be committed.

---

# 6. File Access

A substantive file retrieval counts as a file read.

Examples:

```text
Read file
Read file range
Re-read file later
```

A filename merely appearing in:

* Git output;
* Glob output;
* Grep results;
* search results;

does not automatically count as a full file read.

Track where technically available:

* file path;
* session;
* operation;
* timestamp;
* duration;
* response size metadata.

Do not store the retrieved file content in telemetry.

---

# 7. Re-Reads

A re-read is:

> a second or later substantive retrieval of the same file during the same Run.

Track:

```text
total reads
unique files read
files read more than once
maximum reads of one file
```

Repeated reads are not automatically bad.

Possible legitimate reasons include:

* state changed;
* implementation changed the file;
* Slice boundary;
* reviewer finding;
* conflict resolution;
* closeout verification.

Repeated reads become interesting when they reveal:

* unclear ownership;
* oversized documents;
* missing navigation;
* forgotten context;
* unnecessary rechecking.

The raw collector should not try to infer semantic intent.

Semantic assessment belongs only in the Run closeout summary when useful.

---

# 8. Instruction Loading

Track instruction files loaded by Claude Code where the runtime exposes the event.

Useful fields include:

* file path;
* load reason;
* triggering file;
* scope;
* session.

Relevant load reasons may include:

```text
session_start
nested_traversal
path_glob_match
include
compact
```

This allows UNLOCK to measure whether scoped rules actually reduce default context.

Do not infer an instruction load that the runtime did not report.

Some Claude Code loading mechanisms may not emit the same instruction-load event.

Record such limitations rather than fabricating data.

---

# 9. Context Classification

For analysis, classify files where possible as:

```text
HOT
WARM
COLD
RESTRICTED
IMPLEMENTATION
TEST
OTHER
```

Examples:

* startup operating instructions → HOT;
* task-navigation/reference → WARM;
* deep canonical/reference material → COLD;
* historical Run Reports → RESTRICTED;
* `src/**` → IMPLEMENTATION;
* test files → TEST.

Classification is used for aggregate learning.

It does not change source authority.

---

# 10. Search Activity

Track search/navigation operations separately from full file reads.

Relevant operations include:

```text
Grep
Glob
symbol/code search where available
```

Useful aggregate metrics:

* total searches;
* search operations by type;
* result payload size where available;
* repeated searches;
* searches followed by file reads.

Do not save full search results in telemetry.

---

# 11. Tool Activity

Track aggregate tool behavior where available.

Useful fields include:

* tool name;
* success/failure;
* duration;
* response-size metadata;
* session;
* agent/subagent identity.

Do not persist:

* full tool output;
* full source code;
* secrets;
* raw prompts;
* arbitrary command output.

For shell commands, prefer normalized command classes over full command text when later classification is added.

---

# 12. Session Performance

Where Claude Code exposes reliable session data, preserve:

* Claude Code version;
* model;
* session ID;
* wall-clock duration;
* API duration;
* estimated session cost;
* lines added;
* lines removed.

Do not estimate unavailable values manually.

Use:

```text
NOT AVAILABLE
```

when necessary.

---

# 13. Token / Context Metrics

Where available, preserve:

* current input tokens;
* current output tokens;
* context-window size;
* peak context utilization;
* ending context utilization;
* context threshold flags;
* compaction count;
* compaction trigger type.

Token counts must come from Claude Code/runtime telemetry.

Do not estimate token counts from file size and present them as actual usage.

---

# 14. Prompt Cache Metrics

Where available, preserve:

* whether prompt caching was observed;
* cache hit ratio;
* cache misses;
* cache write tokens;
* cache read/reuse behavior;
* known miss causes.

Cache behavior is useful because Development OS changes can alter the stable prompt prefix and therefore affect cost/latency.

Do not optimize for cache hit ratio at the expense of correctness.

---

# 15. Subagent Offload

Track where available:

* subagents started;
* subagents completed;
* agent type;
* parent relationship;
* duration where available;
* the LENGTH of the subagent's final hand-back message (`handback_chars`, a `response_chars`-style proxy per §23/§24) — never the message text itself. This exists specifically because a subagent's own file reads happen in its separate context and do not cost the main session anything, but its final hand-back report does land in the main session — this is the one part of subagent activity worth measuring as a main-context cost proxy.

Subagents are useful when broad exploration would otherwise pollute the main context.

A healthy Run does not require maximizing subagent count.

The useful question is:

> Was high-volume disposable context kept out of the main session when appropriate?

---

# 16. Compaction

Track:

* automatic compactions;
* manual compactions;
* session in which compaction occurred.

Compaction is not inherently a failure.

Repeated compaction may indicate:

* a legitimately long Run;
* excessive context loading;
* unnecessary exploration;
* oversized instructions;
* poor Run/Slice boundaries.

Interpret it together with the rest of the telemetry.

---

# 17. Verification Activity

The telemetry summary may report:

* verification commands executed;
* successful checks;
* failed checks;
* repeated checks.

Operational verification policy remains owned by:

`.claude/rules/testing.md`

Telemetry observes verification activity.

It does not decide which verification is required.

---

# 18. Review Activity

The Run Report should preserve where known:

* review passes;
* reviewer types used;
* BLOCKER findings;
* CORRECTION findings;
* material corrections performed after review.

Reviewer selection remains owned by:

`/review-commit`

Telemetry measures the resulting workflow.

---

# 19. Context Misses

A Context Miss is:

> work or reasoning progressed before discovering a source that should reasonably have been loaded earlier.

Context Misses require judgment and therefore should not be inferred automatically by the raw collector.

When one materially occurs, record:

```text
source missed
when discovered
why it should have been loaded earlier
impact
```

Impact classification:

```text
NONE
EXTRA_CONTEXT
REWORK
CORRECTION
BLOCKING
```

Context Misses are especially useful for improving:

* `CONTEXT_MAP`;
* startup policy;
* rule scoping;
* document ownership.

---

# 20. Unnecessary Rechecks

An Unnecessary Recheck is:

> a repeated retrieval or verification that, in retrospect, did not provide new evidence and was not required by changed state.

This is a qualitative closeout observation.

Do not force Claude to classify every re-read.

Record only meaningful patterns.

---

# 21. Run-Level Summary Metrics

A Run telemetry summary should aim to provide, when available:

```text
sessions
model(s)
Claude Code version(s)

wall-clock duration
API duration
estimated cost

context peak %
context ending %
input/output token data
compactions

prompt-cache hit ratio
prompt-cache misses

unique files read
total file reads
re-read count
most-read files

instruction loads
path-scoped instruction loads
COLD documents loaded
historical Run Reports loaded

search operations
tool calls
tool failures

subagents started/completed

verification activity
review activity

context misses
notable unnecessary rechecks
```

Unavailable metrics must remain explicitly unavailable.

---

# 22. Derived Metrics

Derived metrics may be calculated from reliable raw measurements.

Examples:

### Re-read rate

```text
(total file reads - unique files read)
/
total file reads
```

### Historical context usage

```text
number of historical Run files substantively read
```

### COLD-context usage

```text
number of COLD documents substantively loaded
```

### Subagent offload

Report the amount of exploration delegated where the runtime provides enough evidence.

Derived metrics should remain descriptive.

Do not create arbitrary “performance scores” without evidence that the score is meaningful.

---

# 23. Response-Size Proxy

Tool response character count may be recorded as a lightweight proxy for how much material a tool returned.

Call it:

```text
response_chars
```

Do not call it tokens.

Do not convert characters into an estimated token count and present that estimate as runtime usage.

The runtime token fields remain the authoritative token source.

---

# 24. Privacy / Data Minimization

Raw telemetry must avoid storing unnecessary content.

Do not persist by default:

* user prompts;
* assistant response bodies;
* file contents;
* tool response contents;
* secrets;
* tokens/cookies;
* environment values;
* raw Bash/PowerShell output;
* complete arbitrary shell commands.

Prefer metadata:

```text
path
tool
duration
result size
success/failure
classification
session
timestamp
```

Telemetry must not become a shadow copy of the repository or conversation.

---

# 25. Token-Efficiency Rules

The telemetry system itself should consume negligible model context.

Therefore:

* hooks should normally produce no Claude-visible output;
* status-line collection should run outside model context;
* raw telemetry should never be loaded routinely;
* deterministic scripts should aggregate raw telemetry;
* Claude should read only the compact Run summary at closeout;
* broad research should use subagents when isolation materially protects main context;
* `/clear` should separate unrelated tasks;
* focused compaction should be preferred when a long Run genuinely needs continuation;
* targeted search/read should be preferred over broad file loading.

Do not save tokens by withholding context required for correctness.

---

# 26. Telemetry Levels

## Level 0 — Unavailable

No reliable telemetry.

Run Report says so.

## Level 1 — Run Summary

Manual/runtime available:

* duration;
* tokens/context;
* high-level file counts;
* verification/review observations.

## Level 2 — Local Automated Telemetry

Silent hooks/status-line collection provide:

* file/tool activity;
* instruction loads;
* session metrics;
* compaction;
* subagents;
* deterministic aggregation.

This is the target for Run 007.

## Level 3 — Observability Backend

Optional future capability using OpenTelemetry for:

* per-request token metrics;
* traces;
* latency distributions;
* organization-wide dashboards;
* multi-Run trend analysis.

Do not build Level 3 until the collected Level 2 data demonstrates a real need.

---

# 27. Run Report Relationship

`docs/RUNS/RUN_TEMPLATE.md` defines how telemetry appears in the durable Run Report.

The durable report should contain:

* compact aggregate metrics;
* meaningful context observations;
* notable misses/rechecks;
* limitations.

It should not contain raw telemetry.

---

# 28. Development OS Improvement Loop

Periodically compare Runs to identify patterns such as:

* startup context shrinking or growing;
* repeated use of unnecessary COLD sources;
* frequent Context Map misses;
* documents repeatedly reopened;
* rules loading too broadly;
* excessive compaction;
* underused subagents for broad exploration;
* cache degradation;
* review loops repeatedly finding the same class of issue.

Evidence from multiple Runs may justify a Development OS change.

One unusual Run should not automatically trigger policy redesign.

---

# 29. Core Principle

> Measure the Development OS without making measurement part of the cognitive workload.

> Collect raw activity outside the model context.

> Summarize deterministically.

> Load only the summary.

> Use trends to improve context efficiency, not to reward superficial metrics.

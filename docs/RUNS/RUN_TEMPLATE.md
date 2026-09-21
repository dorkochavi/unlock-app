# UNLOCK — Run Report Template

Run: `<RUN_ID>`

Status: `<COMPLETE | PARTIAL | BLOCKED | ABORTED>`

Baseline:

`<BASE_HEAD>`

Final commit:

`<COMMIT | NOT CREATED>`

---

## 1. Run Goal

Describe the concrete goal of this Run.

Keep this focused on what this Run was intended to accomplish.

---

## 2. Scope Completed

Summarize the capabilities, fixes, migrations, documentation changes, or infrastructure work completed.

Use implementation-level facts.

Do not reproduce the entire execution Plan.

---

## 3. Scope Not Completed

Record planned work intentionally left incomplete, removed, deferred, or blocked.

If none:

`None.`

---

## 4. Important Decisions

Record only decisions that materially affected this Run.

Durable architectural/product decisions must still live in their canonical decision source.

This section is historical context, not a new source of truth.

---

## 5. Implementation Summary

Record the major implementation areas touched.

Examples:

* domain;
* application;
* persistence;
* API;
* UI;
* migration;
* documentation;
* Development OS.

Do not list every changed file unless that file is materially important.

---

## 6. Verification Evidence

Record the relevant final verification evidence for the Run.

Examples:

* unit tests;
* schema tests;
* integration tests;
* E2E;
* typecheck;
* lint;
* build;
* migration verification;
* targeted manual/browser verification.

Use actual evidence only.

Do not claim verification that did not run.

Operational verification selection is owned by:

`.claude/rules/testing.md`

---

## 7. Review Evidence

Record:

* reviewer(s) used;
* material findings;
* corrections applied;
* final reviewer verdict.

If no reviewer was required under the risk model, state that explicitly.

Reviewer selection/orchestration is owned by:

`/review-commit`

---

# 8. Run Telemetry

Telemetry definitions and measurement policy are owned by:

`docs/RUN_TELEMETRY.md`

The durable Run Report contains only the compact summary.

Raw telemetry remains local under:

`scratch/telemetry/<RUN_ID>/`

---

## 8.1 Run Performance

Record the generated telemetry values where available:

```text
Sessions:
Model(s):
Claude Code version(s):

Summed session duration:
Summed API duration:
Estimated cost:
```

If unavailable:

`NOT AVAILABLE`

Do not estimate missing runtime metrics.

---

## 8.2 Token / Context Activity

Record where available:

```text
Highest ending context usage:
Latest session input-token values:
Latest session output-token values:
Compactions:
```

Token values must be described according to the runtime semantics in `RUN_TELEMETRY.md`.

Do not describe context-window token values as guaranteed total billed Run tokens.

---

## 8.3 Prompt Cache

Record where available:

```text
Sessions with cache data:
Average reported hit ratio:
Reported misses:
```

If unavailable:

`NOT AVAILABLE`

---

## 8.4 Context Access

Record:

```text
Total substantive file reads:
Unique files read:
Re-reads:
Re-read rate:

Main-context reads:
Subagent reads:

Unique COLD files read:
Historical Run files read:
```

Include the most-read files only when useful.

Example:

| File                   | Reads | Assessment                                  |
| ---------------------- | ----: | ------------------------------------------- |
| `docs/CHATGPT_PLAN.md` |     3 | expected: startup, Slice boundary, closeout |
| `docs/DATABASE.md`     |     4 | investigate repeated lookup                 |

Do not infer that every repeated read is waste.

---

## 8.5 Instruction Loading

Record where available:

```text
Instruction loads:
Unique instruction files:
Load reasons:
```

Use this to evaluate whether scoped Claude rules are actually loading narrowly.

Do not infer loads the runtime did not report.

---

## 8.6 Search / Navigation

Record:

```text
Search operations:
Grep operations:
Glob operations:
```

Optionally note navigation patterns that reveal:

* effective Context Map usage;
* repeated search;
* unclear source ownership.

---

## 8.7 Tool Activity

Record compact aggregates where useful:

```text
Tool calls:
Tool failures:
Recorded tool duration:
```

Avoid dumping raw tool logs into the Run Report.

---

## 8.8 Subagent Offload

Record:

```text
Subagents started:
Subagents completed:
File reads inside subagents:
```

Add a short interpretation only when useful.

Example:

> Broad repository exploration was delegated to an Explore subagent, keeping disposable investigation context out of the primary session.

---

## 8.9 Verification Activity

Use the telemetry summary as supporting evidence for observed verification activity.

The telemetry layer does not determine what verification was required.

Record material discrepancies if telemetry and the explicit verification record disagree.

---

## 8.10 Context Misses

A Context Miss is recorded only when materially observed.

Format:

```text
MISS-01

Source missed:
Discovered:
Why it should have been loaded earlier:
Impact: NONE | EXTRA_CONTEXT | REWORK | CORRECTION | BLOCKING
```

If none:

`None observed.`

---

## 8.11 Unnecessary Rechecks

Record only meaningful examples.

Format:

```text
RECHECK-01

What was repeated:
Why it was unnecessary in retrospect:
Likely cause:
Possible Development OS improvement:
```

If none:

`None observed.`

---

## 8.12 Context Efficiency Observations

Summarize only meaningful findings.

Examples:

* no historical Run Reports were needed;
* MASTER_SPEC remained COLD;
* one scoped database rule loaded only when persistence files were accessed;
* broad exploration was successfully offloaded to a subagent;
* a canonical document was reopened excessively;
* Context Map failed to identify the correct owner early enough.

This section should usually remain short.

---

## 8.13 Measurement Limitations

Record any material limitations.

Examples:

* telemetry enabled only partway through the Run;
* session began before hooks were installed;
* status-line metrics unavailable;
* overlapping sessions;
* instruction-load events unavailable for a loading mechanism.

Never fill measurement gaps with invented numbers.

---

# 9. Follow-Up Backlog

Record intentionally deferred technical work only when it belongs in:

`docs/FOLLOW_UP_BACKLOG.md`

Reference existing/new `FUB-*` IDs.

Do not turn this section into an informal task list.

---

# 10. Manual / Hosted Actions

Record actions that remain explicitly human-controlled.

Examples:

* hosted migration application;
* deployment;
* external-service configuration;
* production secret changes.

---

# 11. Final Repository State

Record:

```text
Branch:
Final HEAD:
Working tree:
Push state:
Deployment state:
Hosted database state:
```

Keep local/committed/pushed/deployed/hosted states distinct.

---

# 12. Result

State the durable Run result clearly.

Example:

```text
RUN_007_COMPLETE
```

Then state the next Run/capability if known.

Do not automatically begin it.

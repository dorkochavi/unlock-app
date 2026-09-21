---

name: implement-slice
description: Implement one focused UNLOCK Slice from the active CHATGPT_PLAN using the canonical Development OS lifecycle. Orchestrates inspection, implementation, verification, review, checkpoint, and commit boundaries without duplicating the policies owned by testing, review, or checkpoint.
-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# /implement-slice

Use this skill to execute one focused Slice from the current UNLOCK Run.

This skill owns **workflow orchestration**.

It does not own:

* product decisions;
* testing policy;
* reviewer selection policy;
* checkpoint policy;
* architecture rules;
* Git safety policy;
* Run history.

Use the dedicated owner for each of those responsibilities.

Do not push.

---

## 1. Load Current Execution Context

Read:

* `AGENTS.md`
* `CLAUDE.md`
* `docs/CHATGPT_PLAN.md`
* `docs/DEV_STATUS.md`

Determine:

* `PLAN_VERSION`
* `RUN_ID`
* `BASE_HEAD`
* current Slice
* Slice mode
* Slice goal
* required deliverables
* explicit non-goals
* relevant acceptance criteria
* expected stop condition

`CHATGPT_PLAN` owns current execution.

`DEV_STATUS` owns current durable state.

Do not infer the next task from historical Run Reports.

---

## 2. Inspect Repository Reality

Inspect at minimum:

```text
git status --short
git status -sb
git log --oneline --decorate -5
```

Determine:

* current branch;
* current HEAD;
* ahead/behind state;
* staged/unstaged/untracked work;
* whether repository reality is compatible with the active Plan.

Do not edit yet.

If repository reality contradicts a material Plan assumption, investigate before continuing.

Do not reset, clean, overwrite, or discard unknown work.

---

## 3. Identify the Executable Slice

Execute only the earliest incomplete Slice whose prerequisites are satisfied.

Do not:

* skip ahead for convenience;
* repeat completed work;
* infer new work from `DEV_STATUS`;
* consume `docs/RUNS/**` as normal working context.

If the Slice is investigation-only, investigate only.

If the Slice permits implementation, continue.

---

## 4. Load Minimum Relevant Context

Load only the sources required by the Slice.

Potential sources include:

* relevant ADRs;
* relevant Open Questions;
* `docs/CONTEXT_MAP.md` as GPS;
* relevant `.claude/rules/**`;
* relevant domain/application/infrastructure code;
* relevant tests;
* relevant canonical docs.

Do not reconstruct the entire project history.

Search first.

Read narrowly.

---

## 5. Confirm the Slice Boundary

Before changing code, establish:

* exact problem being solved;
* acceptance criteria;
* affected layers;
* invariants that must remain unchanged;
* explicit non-goals;
* trust boundaries involved;
* likely verification needs;
* whether review specialization may be needed.

Do not expand the Slice merely because nearby cleanup opportunities exist.

---

## 6. Handle Plan Conflict

If implementation reality differs from the Plan:

### Compatible adjustment

When the same accepted intent can be achieved safely through the repository's actual architecture:

* adapt minimally;
* preserve scope;
* continue.

### Genuine conflict

When continuing requires:

* a new product decision;
* a new architecture decision;
* a security-policy decision;
* invalidating dependent Slice assumptions;
* unsafe scope expansion;

report:

```text
PLAN_CONFLICT
- Plan assumption
- Repository reality
- Why the mismatch matters
- Decision required
- Affected Slice(s)
```

Do not invent the missing decision.

Continue only independent safe work.

---

## 7. Implement the Smallest Correct Change

Change only what is required to satisfy the Slice.

Preserve:

* domain/application/infrastructure boundaries;
* trusted identity boundaries;
* transactional semantics;
* immutable historical evidence;
* deterministic Learning Engine behavior;
* accepted ADRs;
* current DailyPlan semantics.

Do not opportunistically:

* refactor unrelated code;
* rename unrelated concepts;
* add speculative abstractions;
* change calibration;
* redesign persistence;
* add dependencies without need;
* fix unrelated cosmetic debt.

When an unrelated non-blocking issue is worth preserving, use:

`docs/FOLLOW_UP_BACKLOG.md`

Do not expand current execution automatically.

---

## 8. Produce Targeted Evidence

After meaningful implementation progress, produce targeted verification.

Operational selection is owned by:

`.claude/rules/testing.md`

Follow that rule for:

* which checks to run;
* evidence freshness;
* invalidation;
* escalation.

Do not embed a separate verification matrix in this skill.

The goal at this stage is:

> prove the changed behavior with the narrowest sufficient evidence.

---

## 9. Run Risk Review

After implementation and targeted verification, run the appropriate review workflow:

`/review-commit`

That skill owns:

* reviewer selection;
* review packet;
* specialist invocation;
* findings format;
* review verdict.

Do not choose or invoke reviewers independently here except through that workflow.

---

## 10. Fix Material Findings

Address:

* BLOCKER findings;
* required CORRECTION findings.

Do not automatically implement non-blocking suggestions.

If a review correction changes code:

* identify which prior evidence became stale;
* refresh only the affected evidence.

Use `.claude/rules/testing.md` for that decision.

---

## 11. Final Relevant Verification

After material review corrections are complete, ensure all materially affected risks have fresh evidence.

This may reuse earlier evidence that remains valid.

Do not rerun:

* the full unit suite;
* schema suite;
* build;
* E2E;

merely because review finished.

Refresh only evidence invalidated by relevant later changes or required by unresolved integration risk.

---

## 12. Run Evidence Checkpoint

Invoke:

`/checkpoint`

Checkpoint owns evidence/state validation.

It should evaluate whether:

* relevant evidence exists;
* it is fresh;
* findings are resolved;
* blockers are visible;
* repository state is understood.

Checkpoint is not another implementation phase and not another full verification cycle.

If checkpoint reports not ready:

* fix only the identified current-Slice issue;
* refresh invalidated evidence;
* rerun checkpoint as needed.

---

## 13. Update Durable State

After the Slice is genuinely complete, update:

`docs/DEV_STATUS.md`

only if durable current truth changed.

Examples:

* a new capability now exists;
* a migration state changed;
* a durable gap closed;
* a new current limitation exists;
* a significant verified baseline changed.

Do not add execution narrative.

`DEV_STATUS` is a snapshot, not a diary.

---

## 14. Update Run History When Required

If the active Run uses a Run Report, update only the current Run Report under:

`docs/RUNS/<RUN_ID>.md`

Record concise historical evidence such as:

* Slice completion;
* commit;
* material verification;
* review result;
* blockers;
* manual actions.

Do not read historical Run Reports unless explicitly needed.

Do not duplicate Git diffs.

---

## 15. Commit the Slice

Create a focused local commit when the active Plan/Definition of Done requires it.

Before committing:

* ensure implementation is complete;
* ensure required review is complete;
* ensure material findings are resolved;
* ensure final relevant evidence is fresh;
* ensure checkpoint is ready;
* inspect the intended diff;
* stage only intended files;
* verify no secrets, `.env`, scratch, or unrelated files are staged.

Use a concise commit message.

Do not push.

If the Plan explicitly requires uncommitted handoff, follow the Plan.

---

## 16. Continue or Stop

After Slice completion:

* inspect the active Plan;
* determine whether another Slice may begin.

Continue only when:

* prerequisites are satisfied;
* no manual gate exists;
* no `PLAN_CONFLICT` exists;
* the Plan has not reached its stop condition.

Stop when:

* expected stop is reached;
* a manual remote action is required;
* a product/architecture/security decision is required;
* repository safety requires human involvement;
* the Run is complete.

Do not start the next Product Run automatically.

---

## 17. Run-End Behavior

When the final Slice in the active Run is complete:

1. perform additional integration acceptance **only if relevant Run-level behavior still lacks evidence**;
2. update `DEV_STATUS`;
3. generate the deterministic Run telemetry summary when telemetry is available;
4. read only the compact telemetry summary, not the raw telemetry;
5. update/create the current Run Report;
6. inspect final Git state;
7. stop at the Run boundary.

Run-end acceptance is not a replay of every Slice verification.

Do not rerun checks merely because the Run is ending.

Use existing fresh evidence unless a relevant later change invalidated what it proved.

---

## 18. Telemetry During Slice Execution

Run telemetry is passive infrastructure.

Canonical telemetry policy:

`docs/RUN_TELEMETRY.md`

Runtime collection may be performed automatically through:

* `.claude/telemetry/collect.mjs`;
* `.claude/telemetry/statusline.mjs`;
* `.claude/settings.json`.

During a Slice:

* allow configured telemetry hooks/status-line collection to operate normally;
* do not manually update telemetry after individual reads, searches, tool calls, or edits;
* do not inspect raw telemetry unless diagnosing the telemetry system itself;
* do not add extra tool calls merely to improve telemetry completeness;
* do not change implementation behavior to optimize telemetry metrics;
* do not treat repeated reads, subagent usage, cache behavior, or context size as quality scores;
* continue normal Slice execution if telemetry is unavailable.

Prefer normal context-efficient behavior:

* targeted reads over broad loading;
* search before opening large unrelated documents;
* scoped rules instead of loading every rule;
* subagents for high-volume disposable exploration when appropriate;
* fresh evidence over ritual reruns.

Telemetry collection must remain observational.

It does not determine:

* implementation scope;
* verification requirements;
* reviewer selection;
* architecture;
* product correctness.

---

## 19. Telemetry at Run Closeout

Telemetry summarization belongs to Run closeout, not normal Slice execution.

When telemetry is available:

```text
node .claude/telemetry/summarize.mjs
→ read scratch/telemetry/<RUN_ID>/summary.md
→ add useful aggregate evidence to the Run Report
```

Do not routinely read:

* raw `.jsonl` telemetry;
* complete session snapshots;
* telemetry implementation files.

Do not invent missing:

* token values;
* duration;
* cost;
* cache data;
* file reads;
* instruction loads;
* context usage.

Qualitative observations such as:

* Context Misses;
* unnecessary rechecks;
* excessive COLD-context loading;
* unexpectedly broad instruction loading;

should be recorded only when materially observed.

If telemetry is unavailable or incomplete:

1. continue the normal Run closeout;
2. state the measurement limitation honestly;
3. do not reconstruct missing metrics from memory or estimates.

Telemetry failure by itself does not invalidate otherwise sufficient implementation evidence unless telemetry itself is the subject of the active Slice.

---

## 20. Final Handoff

At a Run or manual stop boundary, report only useful current information:

### Run state

* Run ID;
* Plan version;
* baseline;
* current/end HEAD;
* completion status.

### Completed work

* completed Slices;
* focused commits;
* material capabilities added.

### Evidence

State exact evidence levels actually produced, for example:

* focused unit/application tests;
* schema/PGlite;
* route/auth tests;
* Playwright;
* typecheck;
* lint;
* build;
* hosted/manual verification if actually performed.

### Review

* reviewer types used;
* material findings and resolution state.

### Pending manual actions

Examples:

* hosted migration application;
* hosted QA;
* push.

### Git state

* branch;
* HEAD;
* ahead/behind;
* worktree state.

Do not overstate verification.

Do not claim remote actions occurred when they did not.

---

## 19. Core Rules

* `CHATGPT_PLAN` defines current work.
* `DEV_STATUS` defines current durable state.
* One Slice at a time.
* Load only relevant context.
* Implement the smallest correct change.
* Testing policy belongs to `.claude/rules/testing.md`.
* Reviewer selection belongs to `/review-commit`.
* Evidence validation belongs to `/checkpoint`.
* Review happens before final relevant verification.
* Reuse fresh evidence.
* Commit focused completed work when required.
* Never push.
* Never invent product decisions.
* Never expand scope casually.
* Never use destructive Git commands without explicit approval.
* Stop at the active Plan boundary.

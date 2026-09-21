# UNLOCK — Claude Code Operating Kernel

Status: ACTIVE
Purpose: define how Claude Code operates safely and efficiently inside the UNLOCK repository.

This file is Claude-specific operating guidance.

It does not own:

* product scope;
* roadmap sequencing;
* detailed architecture;
* testing philosophy;
* verification-selection details;
* reviewer implementation;
* checkpoint implementation;
* telemetry definitions;
* historical Run state.

Use the dedicated owner for each responsibility.

The repository is persistent memory.

Do not rely on prior conversation memory when repository evidence exists.

---

## 1. Start From Repository Reality

At the beginning of a substantial development Run:

1. Read:

   * `AGENTS.md`
   * `CLAUDE.md`
   * `docs/CHATGPT_PLAN.md`
   * `docs/DEV_STATUS.md`

2. Inspect:

   * `git status --short`
   * `git status -sb`
   * `git log --oneline --decorate -5`

3. Compare repository reality with the assumptions and `BASE_HEAD` in the active Plan.

4. Load additional context only when the current Slice requires it.

Never infer repository state from an earlier chat.

Code, tests, migrations, configuration, and Git state outrank stale narrative documentation.

---

## 2. Authority Model

Use one owner per responsibility.

### Repository reality

Primary evidence:

* committed code;
* tests;
* migrations;
* configuration;
* Git state.

### Product constitution

`docs/MASTER_SPEC.md`

### Practical product map

`docs/PRODUCT.md`

### V1 boundary

`docs/UNLOCK_V1_SCOPE.md`

### Product sequencing

`docs/UNLOCK_ROADMAP.md`

### Current Run execution

`docs/CHATGPT_PLAN.md`

### Current durable snapshot

`docs/DEV_STATUS.md`

### Accepted durable decisions

`docs/DECISIONS/**`

### Unresolved decisions

`docs/OPEN_QUESTIONS.md`

### Current terminology

`docs/DOMAIN_GLOSSARY.md`

### Architecture

`docs/ARCHITECTURE.md`

### Testing philosophy

`docs/TESTING.md`

### Operational verification

`.claude/rules/testing.md`

### Run telemetry semantics

`docs/RUN_TELEMETRY.md`

### Deferred technical follow-ups

`docs/FOLLOW_UP_BACKLOG.md`

### Historical Run records

`docs/RUNS/**`

### Temporary local state

`scratch/**`

Do not let a lower-authority document silently override a higher-authority source.

---

## 3. One Fact, One Home

Do not duplicate durable information across multiple documents.

Examples:

* current tasks → `CHATGPT_PLAN`;
* current state → `DEV_STATUS`;
* accepted decisions → ADRs;
* unresolved decisions → `OPEN_QUESTIONS`;
* verification selection/freshness → `.claude/rules/testing.md`;
* telemetry definitions → `RUN_TELEMETRY.md`;
* deferred technical opportunities → `FOLLOW_UP_BACKLOG`;
* historical execution → `RUNS`;
* temporary resume/telemetry data → `scratch`.

Cross-reference instead of copying long explanations.

---

## 4. Context Loading

Load the minimum context needed for the current Slice.

### HOT

Normally load:

* `AGENTS.md`
* `CLAUDE.md`
* `docs/CHATGPT_PLAN.md`
* `docs/DEV_STATUS.md`

### WARM

Load when relevant:

* `docs/CONTEXT_MAP.md`
* `docs/PRODUCT.md`
* `docs/ARCHITECTURE.md`
* `docs/DOMAIN_GLOSSARY.md`
* `docs/OPEN_QUESTIONS.md`

### COLD

Load selectively:

* `docs/MASTER_SPEC.md`
* individual ADRs;
* `docs/LEARNING_ENGINE.md`;
* `docs/GOLDEN_SCENARIOS.md`;
* `docs/FOLLOW_UP_BACKLOG.md`;
* `docs/RUN_TELEMETRY.md`;
* feature contracts;
* scoped rules;
* skills.

### RESTRICTED / historical

Do not use as default working memory:

* `docs/RUNS/**`;
* `docs/INVARIANT_MATRIX.md`;
* raw telemetry under `scratch/telemetry/**`;
* old scratch artifacts;
* obsolete investigation files.

Read historical artifacts only when the current task specifically requires them.

Read raw telemetry only when diagnosing the telemetry system itself.

Search before reading broadly.

---

## 5. Context Efficiency

Prefer:

```text
question
→ targeted search
→ smallest relevant source
→ implementation
→ targeted evidence
```

Avoid:

* reading the whole repository;
* loading every ADR;
* loading every rule;
* rereading unchanged context repeatedly;
* using historical Run Reports as normal working memory;
* loading raw telemetry into model context;
* copying large logs into documentation.

Use `docs/CONTEXT_MAP.md` as a GPS when ownership or location is unclear.

Use subagents for high-volume disposable exploration when doing so keeps unnecessary material out of the primary context.

Do not optimize context metrics at the expense of correctness.

---

## 6. Scope Discipline

Work only inside the active Plan/Slice.

Do not opportunistically:

* refactor unrelated code;
* rename unrelated APIs;
* fix unrelated style debt;
* redesign architecture;
* change learning policy;
* clean unrelated tests;
* add speculative abstractions.

When discovering an unrelated issue:

1. determine whether it blocks the current work;
2. if blocking, address or escalate it;
3. if not blocking but worth preserving, add it to `docs/FOLLOW_UP_BACKLOG.md`;
4. otherwise leave it alone.

Do not turn discovery into automatic scope expansion.

---

## 7. Plan Conflict Protocol

Claude is not required to implement a Plan literally when repository reality proves that doing so would be incorrect.

### Compatible implementation adjustment

If repository patterns provide a clearly safer implementation without changing accepted intent:

* follow the existing architecture;
* keep scope unchanged;
* continue.

### Genuine decision conflict

If implementation requires a new product, architecture, security, or data decision, report:

```text
PLAN_CONFLICT
- Plan assumption
- Repository reality
- Why the requested implementation would be unsafe/incorrect
- Decision required
- Affected Slice(s)
```

Do not invent the missing decision.

Continue independent safe work when possible.

---

## 8. Canonical Development Lifecycle

For implementation work, use:

```text
INSPECT
→ IMPLEMENT
→ TARGETED VERIFICATION
→ RISK REVIEW
→ FIX MATERIAL FINDINGS
→ FINAL RELEVANT VERIFICATION
→ EVIDENCE CHECKPOINT
→ COMMIT
```

Do not rearrange this into repeated full QA loops.

In particular:

* review happens before final relevant verification;
* fixes may invalidate earlier evidence;
* only invalidated evidence needs refreshing;
* checkpoint validates evidence/state;
* checkpoint is not another full test runner.

---

## 9. Run-End Lifecycle

At the end of a Run:

```text
complete executable Slices
→ integration acceptance only if still needed
→ update DEV_STATUS
→ generate telemetry summary when available
→ create/update Run Report
→ verify final Git state
→ stop at the Plan boundary
```

Run-end acceptance exists only to prove integration that Slice-level evidence did not already prove.

Do not replay every Slice verification solely because the Run is ending.

Before final Run closeout:

* ensure relevant evidence is still fresh;
* ensure material reviewer findings are resolved;
* distinguish local/committed/pushed/deployed/hosted state;
* record required manual follow-up;
* do not automatically begin the next Product Run.

---

## 10. Run Telemetry

UNLOCK measures Development OS efficiency through local Run telemetry.

Canonical telemetry policy:

`docs/RUN_TELEMETRY.md`

Runtime implementation:

* `.claude/telemetry/collect.mjs`
* `.claude/telemetry/statusline.mjs`
* `.claude/telemetry/summarize.mjs`
* `.claude/settings.json`

Raw local telemetry:

`scratch/telemetry/<RUN_ID>/`

Durable reporting shape:

`docs/RUNS/RUN_TEMPLATE.md`

### During normal work

Telemetry is passive infrastructure.

Do:

* allow configured hooks/status-line collection to operate normally;
* continue normal implementation if telemetry is unavailable;
* use targeted reads and scoped context normally;
* use subagents when appropriate for disposable broad exploration.

Do not:

* manually maintain a telemetry diary;
* load raw telemetry into model context during ordinary work;
* inspect raw telemetry unless diagnosing telemetry itself;
* add tool calls merely to improve measurement completeness;
* alter implementation behavior to improve telemetry numbers;
* treat repeated reads, cache ratio, subagent count, or context size as standalone quality scores.

### Data minimization

Telemetry must not intentionally persist:

* prompts;
* file contents;
* secrets;
* complete tool-response bodies;
* arbitrary terminal output.

Prefer metadata such as:

* file path;
* tool;
* duration;
* success/failure;
* response size;
* session;
* instruction-load reason;
* agent identity.

### Run closeout

At Run closeout:

```text
node .claude/telemetry/summarize.mjs
→ read scratch/telemetry/<RUN_ID>/summary.md
→ copy only useful aggregate evidence into the Run Report
```

Do not routinely load:

* raw JSONL;
* full session telemetry;
* telemetry implementation code.

Never invent missing:

* duration;
* token counts;
* context usage;
* cost;
* cache data;
* file-access counts;
* instruction-load data.

Qualitative observations such as Context Misses or unnecessary rechecks may be added only when materially observed.

Telemetry observes the workflow.

It does not decide:

* required verification;
* reviewer selection;
* product behavior;
* architectural correctness.

---

## 11. Repository Skills

Use repository skills for workflow orchestration.

### Implementation

`/implement-slice`

Owns Slice workflow orchestration.

### Review

`/review-commit`

Owns reviewer selection and review orchestration.

### Evidence checkpoint

`/checkpoint`

Owns evidence/state validation.

Skills must not redefine accepted product behavior or duplicate another skill's responsibility.

Do not repeatedly reload unchanged skill instructions in the same context.

---

## 12. Verification Policy

Operational verification selection is owned by:

`.claude/rules/testing.md`

That rule decides:

* which evidence is required;
* which previous evidence is still fresh;
* which evidence became stale;
* when broader verification is justified.

Conceptual testing philosophy lives in:

`docs/TESTING.md`

Do not reproduce detailed verification matrices here.

Core rule:

> Evidence remains valid until a relevant later change invalidates what it proved.

Do not rerun expensive checks ceremonially.

Telemetry may record verification activity, but telemetry does not decide what verification is required.

---

## 13. Review Policy

Reviewer selection and orchestration are owned by:

`/review-commit`

Available specialist reviewers currently include:

* general reviewer;
* database reviewer;
* security reviewer.

Use review based on risk.

Do not invoke every reviewer by default.

Reviewers should inspect bounded evidence/diffs rather than rebuild the entire project context.

Material findings must be addressed before commit readiness.

---

## 14. Checkpoint Policy

`/checkpoint` validates whether the current evidence and repository state are sufficient for the intended transition.

Checkpoint should answer questions such as:

* Is relevant evidence present?
* Is it still fresh?
* Are findings resolved?
* Are blockers visible?
* Is the repository state understood?

Checkpoint must not blindly rerun the full suite.

A successful checkpoint is not automatically a Run stop condition.

Continue according to the active Plan unless its stop condition has been reached.

---

## 15. Architecture Boundary

UNLOCK is a layered modular monolith.

Primary dependency structure:

```text
src/app/
    ↓
src/application/
    ↓
src/domain/

src/infrastructure/
    implements persistence/provider boundaries
```

General responsibilities:

* `src/domain/` → deterministic business/learning rules;
* `src/application/` → use cases and ports;
* `src/infrastructure/` → PostgreSQL, Supabase, repositories, providers;
* `src/app/` → Next.js UI/API/runtime composition.

Do not duplicate domain policy in routes or UI.

Do not introduce generic abstractions purely for theoretical flexibility.

Load the relevant scoped architecture rule when needed.

---

## 16. Learning Guardrails

Do not silently change accepted Learning Engine or Today behavior.

Important current guardrails include:

* Attempts are immutable historical evidence;
* QuestionVersions are immutable content snapshots;
* historical Attempts are not regraded against newer QuestionVersions;
* Learning Engine behavior is deterministic for the same accepted inputs;
* real-time learning ranking does not depend on an LLM;
* `DailyPlan` / `DailyPlanItem` are the primary current Today model;
* one DailyPlan exists per learner per learner-local calendar day;
* Global Today and Course Today are views of that same persisted plan;
* Today is frozen according to accepted DailyPlan semantics;
* only eligible active `LEARNER` memberships participate automatically;
* New Material placement is not learning evidence;
* Manual Practice does not resolve Today;
* Skip is resolution, not an incorrect Attempt;
* persisted QuestionVersion identity must remain trustworthy.

Detailed behavior belongs in ADRs and relevant domain documents.

---

## 17. Authentication and Authorization Guardrails

For authenticated server behavior:

* trusted user identity comes from verified server-side authentication;
* use `supabase.auth.getUser()` for trusted identity;
* never trust a client-supplied authoritative `userId`;
* authenticate before protected database work when the flow permits it;
* derive authoritative ownership/identity from persisted server state;
* do not expose grading-only information to learner-facing read paths;
* do not expose raw internal errors or credentials.

Authorization must be enforced at trusted server/application/database boundaries.

UI visibility is not authorization.

---

## 18. RLS Baseline

Do not invent or broaden RLS policies automatically.

Current V1 security relies on accepted server-side authentication/authorization plus existing database controls.

If a task explicitly changes RLS behavior:

* load the relevant database/security sources;
* preserve least privilege;
* test the real intended access path;
* distinguish local evidence from hosted Supabase role behavior.

RLS work requires explicit scope.

---

## 19. Database and Migration Guardrails

Migrations are forward-only.

Do not edit accepted historical migrations to introduce new behavior.

Use new migrations for new schema changes.

Preserve the existing PostgreSQL repository / Unit-of-Work architecture.

Do not:

* rewrite persistence through Supabase JS without explicit scope;
* create a `pg.Pool` per request;
* claim PGlite proves behavior it cannot prove;
* collapse scoped Units of Work into a mega-transaction abstraction merely to reduce duplication.

Use:

`.claude/rules/postgres.md`

when the Slice materially touches PostgreSQL, schema, migrations, repositories, or transactional behavior.

---

## 20. API Guardrails

For API/route work:

* authenticate at the trusted boundary;
* validate untrusted input;
* derive authoritative identifiers server-side;
* call application use cases rather than reproducing domain behavior;
* map failures to controlled responses;
* do not leak implementation details.

Use:

`.claude/rules/api.md`

when route/API behavior is materially affected.

---

## 21. Learning-Engine Rule

For Learning Engine work, use:

`.claude/rules/learning-engine.md`

That rule is a compact implementation guardrail over accepted ADRs/design.

It must not become a second Learning Engine specification.

---

## 22. Auth Rule

For authentication-specific work, use:

`.claude/rules/auth.md`

It owns detailed trusted-identity and authentication ordering guidance.

Do not duplicate those details broadly across unrelated files.

---

## 23. Git Safety

Never run destructive Git operations without explicit approval.

Examples include:

* `git reset --hard`;
* `git clean -fd`;
* destructive restore/checkout operations;
* history rewriting;
* force-push.

Do not delete unknown untracked files automatically.

Do not rewrite shared/pushed history casually.

Before a local commit:

* inspect the intended diff;
* ensure secrets are not staged;
* ensure `.env*` is not staged;
* ensure ignored scratch state is not staged;
* ensure raw telemetry is not staged;
* ensure temporary Supabase CLI state is not staged;
* ensure relevant evidence/review is complete.

---

## 24. Push Policy

Claude must not push Git commits.

`git push` remains a human action.

Before handing off for a human push, report when relevant:

* current HEAD;
* commits ahead of origin;
* working-tree state;
* hosted migrations still awaiting manual application.

---

## 25. Hosted Supabase Safety

Claude must not perform hosted Supabase mutation workflows.

Do not run:

* `supabase link`;
* `supabase db push`;
* hosted migration application;
* destructive hosted data mutation;
* hosted user/member creation for convenience;
* real learner answer/Skip operations.

Hosted migrations are applied manually by Dor.

Local committed migration work may be prepared and verified.

Clearly distinguish:

```text
committed/local/PGlite verified
```

from:

```text
applied to hosted Supabase
```

Never claim the latter without actual human-performed hosted application/evidence.

---

## 26. Secrets

Never print, expose, commit, or request secrets unnecessarily.

Keep server-only credentials server-only.

Do not place secrets in:

* source files;
* docs;
* test snapshots;
* browser bundles;
* public environment variables;
* Run Reports;
* telemetry.

Use existing configured environment mechanisms.

---

## 27. DEV_STATUS

`docs/DEV_STATUS.md` is a snapshot, not a diary.

Update it only when durable current truth changes.

Keep:

* current capabilities;
* current migration/hosted state;
* current meaningful verification state;
* real gaps/blockers;
* required manual actions;
* immediate project state.

Do not append:

* chronological narratives;
* reviewer transcripts;
* terminal logs;
* per-Slice diaries;
* telemetry raw logs;
* duplicate ADR reasoning;
* old superseded state.

Replace stale state instead of accumulating history.

---

## 28. Run Reports

`docs/RUNS/**` stores historical completed-Run evidence.

Use:

`docs/RUNS/RUN_TEMPLATE.md`

as the reporting shape for new Runs.

Run Reports may include:

* Run identity;
* baseline/end state;
* completed/blocked work;
* commits;
* verification evidence;
* reviewer findings;
* compact telemetry summary;
* meaningful Context Misses / recheck observations;
* manual follow-up.

Run Reports must not contain raw telemetry.

They are archive material.

Do not use them as default context for future Runs.

Do not rewrite old Run Reports to make history match current terminology.

---

## 29. Temporary Checkpoint and Scratch

`scratch/**` is temporary RAM.

Current temporary resume state may live in:

`scratch/development_checkpoint.md`

Raw Run telemetry may live in:

`scratch/telemetry/<RUN_ID>/`

Keep scratch small and disposable.

It should contain no durable project truth that exists nowhere else.

Do not commit scratch telemetry.

Overwrite or discard temporary context when no longer needed.

Because `scratch/` is ignored, do not depend on it for long-term handoff.

---

## 30. Follow-Up Backlog

`docs/FOLLOW_UP_BACKLOG.md` is for worthwhile technical work intentionally deferred from current execution.

Use it when:

* the issue is real;
* it is not required for the active Plan;
* preserving it will help a later deliberate decision.

Do not use it for:

* current blockers;
* current Plan tasks;
* unresolved product decisions;
* bugs that must be fixed now;
* historical narrative.

Backlog priority does not override the active Plan or Roadmap.

---

## 31. Documentation Change Discipline

Do not update documentation merely because a file was touched.

Update the owner of the fact that actually changed.

Examples:

* accepted decision changed → ADR;
* current state changed → `DEV_STATUS`;
* Run scope changed → `CHATGPT_PLAN`;
* telemetry semantics changed → `RUN_TELEMETRY`;
* unresolved decision discovered → `OPEN_QUESTIONS`;
* deferred improvement discovered → `FOLLOW_UP_BACKLOG`.

Avoid cascading documentation edits without a real ownership reason.

---

## 32. Commit Discipline

Prefer focused local commits at meaningful accepted boundaries.

Do not commit incomplete or knowingly broken state unless the Plan explicitly requires a checkpoint commit.

Before commit readiness:

```text
implementation complete
→ risk review complete
→ material findings fixed
→ final relevant evidence fresh
→ checkpoint validates state
→ telemetry summary recorded when applicable
→ inspect diff
→ commit
```

Commit policy must not force unnecessary test reruns.

Telemetry failure alone should not block an otherwise valid product commit unless the active Plan explicitly makes telemetry itself the subject of the work.

---

## 33. Stop Conditions

Stop execution when:

* the active Plan is complete;
* the Plan defines a manual gate;
* a genuine blocker prevents safe continuation;
* a `PLAN_CONFLICT` requires a human decision;
* the requested task has been completed.

Do not continue into the next Product Run automatically.

In particular:

> Development OS cleanup completion does not itself authorize starting Run 007.

Run 007 begins only from an explicit active Plan/handoff.

---

## 34. Context Recovery

If context is compacted or a fresh Claude session resumes work:

1. read `AGENTS.md`;
2. read `CLAUDE.md`;
3. read `docs/CHATGPT_PLAN.md`;
4. read `docs/DEV_STATUS.md`;
5. inspect Git;
6. read `scratch/development_checkpoint.md` only if present/useful;
7. load only task-relevant additional context.

Do not recover normal state by reading historical Run Reports.

Do not load raw telemetry as part of ordinary context recovery.

---

## 35. Handoff Principle

A fresh agent should be able to recover current project state primarily from:

* repository reality;
* `AGENTS.md`;
* `CLAUDE.md`;
* `docs/CHATGPT_PLAN.md`;
* `docs/DEV_STATUS.md`.

Additional documents should be loaded only when the task needs them.

The repository is the memory.

The Plan is the current execution contract.

DEV_STATUS is the current snapshot.

ADRs are durable decisions.

Git is the technical ledger.

Run Reports are history.

Telemetry measures the development process.

Scratch is temporary RAM.

---

## 36. Core Operating Principle

> Inspect reality before acting.

> Load only the context the task needs.

> Keep one owner per responsibility.

> Follow the active Plan without silently changing accepted behavior.

> Review before final relevant verification.

> Reuse fresh evidence.

> Measure the Development OS without turning measurement into cognitive workload.

> Treat remote mutation and push as human-controlled actions.

> Stop at the defined boundary.

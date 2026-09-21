# UNLOCK — Current Execution Plan

PLAN_VERSION: DEVOS-1.2
RUN_ID: 2026-09-21-DEVOS-V1.2
BASE_HEAD: `0dd28ce51699c55b3e2cde338a4ab92697775552`
RUN_TYPE: DEVELOPMENT_OS
STATUS: IN_PROGRESS
EXPECTED_STOP: DEVELOPMENT_OS_V1_2_COMPLETE — STOP BEFORE RUN 007

---

# 1. Run Goal

Complete the UNLOCK Development OS V1.2 cleanup so future product Runs operate with:

* one owner per responsibility;
* smaller default context;
* no duplicated workflow policy;
* risk-based review;
* reusable verification evidence;
* clear separation between current state, execution, decisions, backlog, history, and temporary context;
* thin Claude/Cursor tool projections over canonical repository truth.

This Run changes the **development operating system**, not the UNLOCK product.

Product development remains paused.

---

# 2. Baseline

Product baseline before this Run:

* branch: `feature/project-foundation`;
* baseline commit: `0dd28ce51699c55b3e2cde338a4ab92697775552`;
* Run 006: COMPLETE and pushed;
* next product Run: Run 007 — Structured Import;
* hosted Supabase migrations applied through migration #9;
* migrations #10–#12 committed and locally/PGlite verified but not yet applied to hosted Supabase.

Historical Run 006 execution detail belongs in:

`docs/RUNS/2026-09-20-006.md`

and Git history.

Do not preserve completed Run 006 detail in this current Plan.

---

# 3. Scope

This Run MAY change:

* repository operating instructions;
* Development OS documentation;
* Claude rules;
* Claude skills;
* Claude reviewer agents;
* Cursor rules;
* temporary checkpoint structure;
* stale terminology in canonical governance documents;
* navigation/ownership references;
* documentation classification.

This Run MAY perform small repository-policy consistency corrections required by the audit.

---

# 4. Explicit Non-Goals

This Run MUST NOT:

* implement Run 007;
* implement Structured Import;
* change learner-facing product behavior;
* redesign the Learning Engine;
* introduce new Learning Engine calibration;
* introduce RLS policies;
* change CourseMembership semantics;
* change DailyPlan product policy;
* rewrite accepted historical migrations;
* apply hosted Supabase migrations;
* deploy;
* push;
* perform broad product refactors;
* solve unrelated maintainability backlog items;
* delete historical Run Reports;
* broadly rewrite `MASTER_SPEC.md`.

Potential future technical improvements belong in:

`docs/FOLLOW_UP_BACKLOG.md`

when worth preserving.

---

# 5. Canonical Ownership Target

V1.2 must end with the following ownership model:

| Responsibility                     | Owner                               |
| ---------------------------------- | ----------------------------------- |
| Tool-agnostic repository baseline  | `AGENTS.md`                         |
| Claude operating kernel            | `CLAUDE.md`                         |
| Machine-enforced Claude safety     | `.claude/settings.json`             |
| Current execution scope/sequence   | `docs/CHATGPT_PLAN.md`              |
| Current durable state              | `docs/DEV_STATUS.md`                |
| Context/document GPS               | `docs/CONTEXT_MAP.md`               |
| Testing philosophy                 | `docs/TESTING.md`                   |
| Operational verification/freshness | `.claude/rules/testing.md`          |
| Project-wide quality bar           | `docs/DEFINITION_OF_DONE.md`        |
| Slice orchestration                | `implement-slice`                   |
| Reviewer selection/orchestration   | `review-commit`                     |
| Evidence/state validation          | `checkpoint`                        |
| General adversarial review         | `unlock-reviewer`                   |
| Database specialist review         | `unlock-db-reviewer`                |
| Security specialist review         | `unlock-security-reviewer`          |
| PostgreSQL implementation policy   | `.claude/rules/postgres.md`         |
| Auth/trusted identity policy       | `.claude/rules/auth.md`             |
| API boundary policy                | `.claude/rules/api.md`              |
| Learning implementation guardrails | `.claude/rules/learning-engine.md`  |
| Cursor-specific projection         | `.cursor/rules/**`                  |
| V1 product boundary                | `docs/UNLOCK_V1_SCOPE.md`           |
| Product sequencing                 | `docs/UNLOCK_ROADMAP.md`            |
| Durable decisions                  | `docs/DECISIONS/**`                 |
| Unresolved decisions               | `docs/OPEN_QUESTIONS.md`            |
| Deferred technical follow-ups      | `docs/FOLLOW_UP_BACKLOG.md`         |
| Historical execution               | Git + `docs/RUNS/**`                |
| Temporary resume state             | `scratch/development_checkpoint.md` |

---

# 6. Development OS Lifecycle Target

Canonical Slice lifecycle:

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

Run completion:

```text
INTEGRATION ACCEPTANCE — only if missing
→ DEV_STATUS
→ RUN REPORT
→ FINAL GIT STATE
→ STOP
```

Evidence remains reusable until a relevant later change invalidates what it proved.

The exact operational verification decision belongs only to:

`.claude/rules/testing.md`

---

# 7. Execution Method

This Development OS cleanup is being applied deliberately in dependency order.

During the current manual-edit phase:

* replace one file at a time;
* preserve accepted product behavior;
* avoid unrelated cleanup;
* do not commit after every individual file;
* review the accumulated phase diff before committing;
* do not push.

The reconciled Development OS audit and V1.2 Patch Plan are the design basis for this Run.

---

# S1 — Shared Authority & Governance Reconciliation

STATUS: COMPLETE

## Goal

Establish the common repository authority model and remove major contradictions from canonical governance documents.

## Delivered

* `AGENTS.md`

  * tool-agnostic repository baseline;
  * source/authority categories;
  * repository startup;
  * safety boundaries;
  * thin Claude/Cursor entry points.

* `docs/FOLLOW_UP_BACKLOG.md`

  * dedicated deferred technical parking lot;
  * distinct from Plan, Roadmap, Open Questions, Run history, and scratch.

* `docs/UNLOCK_V1_SCOPE.md`

  * V1 Scope owns WHAT;
  * `UNLOCK_ROADMAP.md` owns sequencing;
  * stale Run sequence removed.

* `docs/DOMAIN_GLOSSARY.md`

  * `DailyPlan` / `DailyPlanItem` primary;
  * `TodaySession` / `TodaySessionItem` explicitly legacy/non-primary.

* `docs/PRODUCT.md`

  * current Today terminology aligned;
  * Feature Contracts optional/proportional;
  * documentation ownership aligned.

* `docs/ARCHITECTURE.md`

  * current layered architecture aligned with repository;
  * Supabase already present;
  * Playwright current;
  * current RLS baseline clarified;
  * DailyPlan primary.

* `docs/PERSISTENCE_SCHEMA_V1.md`

  * migration inventory updated through #12;
  * hosted state separated from physical schema authority.

* `docs/DATABASE.md`

  * DailyPlan primary;
  * legacy TodaySession compatibility explicit;
  * current authorization/RLS baseline aligned;
  * recent persistence capabilities reflected.

* `docs/LEARNING_ENGINE.md`

  * adopted/current vs historical/prototype material clarified.

* `docs/GOLDEN_SCENARIOS.md`

  * current DailyPlan evidence made primary;
  * legacy TodaySession scenarios explicitly classified.

* `docs/INVARIANT_MATRIX.md`

  * historical/restricted classification.

* `docs/FEATURES/FEATURE_TEMPLATE.md`

  * Feature Contract classified as optional/on-demand.

* `scratch/development_checkpoint.md`

  * reduced to temporary local resume state.

## Acceptance

* canonical product scope is unchanged;
* stale Run sequencing no longer competes with Roadmap;
* current DailyPlan terminology is primary;
* historical artifacts no longer masquerade as current authority.

---

# S2 — Testing & Evidence Ownership

STATUS: COMPLETE

## Goal

Create one clear conceptual testing source and one operational verification owner.

## Delivered

### `docs/TESTING.md`

Owns:

* testing philosophy;
* meaning of evidence layers;
* confidence model;
* evidence reuse concept;
* evidence limitations.

Does not own current command selection.

### `.claude/rules/testing.md`

Owns:

* targeted verification selection;
* evidence freshness;
* evidence invalidation;
* verification escalation;
* final relevant verification selection;
* evidence-language precision.

## Acceptance

The Development OS must no longer require ceremonial replay of:

* full unit suite;
* schema suite;
* build;
* E2E;

solely because review/checkpoint/Run-end occurred.

---

# S3 — Claude Operating Kernel & Workflow Skills

STATUS: COMPLETE

## Goal

Remove duplicated workflow policy from `CLAUDE.md` and make each operational skill own one responsibility.

## Delivered

### `CLAUDE.md`

Converted to compact Claude operating kernel covering:

* startup;
* authority map;
* context loading;
* lifecycle;
* safety;
* tool/skill routing;
* Git/remote boundaries;
* stop conditions.

### `implement-slice`

Owns:

* Slice workflow orchestration.

Does not own:

* testing policy;
* reviewer selection;
* checkpoint policy.

### `review-commit`

Owns:

* review target;
* reviewer selection;
* review packet;
* findings consolidation;
* verdict.

### `checkpoint`

Owns:

* evidence/state validation.

Does not own:

* broad verification reruns;
* implementation;
* review selection;
* commit execution.

## Acceptance

The three skills must not redefine each other's responsibilities.

---

# S4 — Reviewer & Scoped Claude Rule Compression

STATUS: COMPLETE

## Goal

Reduce default context and remove mini-operating-systems embedded inside specialist files.

## Delivered Reviewers

* `unlock-reviewer`

  * general adversarial/cross-layer review.

* `unlock-db-reviewer`

  * PostgreSQL/persistence specialist.

* `unlock-security-reviewer`

  * trust/security specialist.

Shared reviewer model:

* `BLOCKER`
* `CORRECTION`
* `NON-BLOCKING`

Shared verdict model:

* `NO BLOCKING FINDINGS`
* `CORRECTIONS REQUIRED`
* `BLOCKED`

## Delivered Rules

* `.claude/rules/postgres.md`
* `.claude/rules/auth.md`
* `.claude/rules/api.md`
* `.claude/rules/learning-engine.md`

Each rule now owns only its implementation boundary.

Operational verification remains owned by `.claude/rules/testing.md`.

---

# S5 — Shared Operational Document Compression

STATUS: IN_PROGRESS

## Goal

Reduce the documents that are loaded most often and make each one serve a single purpose.

## Required Deliverables

### `docs/CHATGPT_PLAN.md`

This file.

Own only:

* current Run metadata;
* goal;
* scope/non-goals;
* Slices;
* deliverables;
* acceptance;
* risk/gates;
* stop condition.

Do not contain generic testing/reviewer/checkpoint policy.

### `docs/DEV_STATUS.md`

Target:

* current durable snapshot only;
* approximately 200–300 lines where practical.

Remove:

* Run chronology;
* Slice diary;
* superseded verification history;
* old repository state.

### `docs/CONTEXT_MAP.md`

Convert to navigation/GPS:

```text
Task
→ Decision Source
→ Rule
→ Implementation
→ Tests
```

Do not use it as a second product specification.

### `docs/DEFINITION_OF_DONE.md`

Reduce to project-wide quality bar.

Do not include:

* command matrix;
* reviewer matrix;
* lifecycle orchestration.

## Acceptance

A fresh agent should recover normal current execution primarily from:

* `AGENTS.md`;
* `CLAUDE.md`;
* `CHATGPT_PLAN.md`;
* `DEV_STATUS.md`;
* Git/repository reality.

---

# S6 — Cursor Rules Reconciliation

STATUS: PENDING

## Goal

Make Cursor a thin tool-specific projection instead of a second independent policy system.

## Files

At minimum inspect/reconcile:

* `.cursor/rules/workflow.mdc`
* `.cursor/rules/architecture.mdc`
* `.cursor/rules/coding-standards.mdc`
* `.cursor/rules/database.mdc`
* `.cursor/rules/security.mdc`
* `.cursor/rules/learning-engine.mdc`
* `.cursor/rules/product.mdc`
* `.cursor/rules/rtl-i18n.mdc`
* `.cursor/rules/ai.mdc`

## Required Outcomes

* remove duplicate workflow/testing matrices;
* align architecture with actual repository layers;
* remove stale Answer Options TBD language;
* align RLS baseline;
* align DailyPlan terminology;
* remove prototype-only Learning Engine assumptions;
* keep universal product identity concise;
* path-scope rules where appropriate;
* verify actual supported Cursor frontmatter/path-scope syntax before changing it.

Do not delete `.cursor`.

---

# S7 — Repository Navigation & Cleanup

STATUS: PENDING

## Goal

Remove remaining Development OS ambiguity without broad historical cleanup.

## Required Work

* reconcile `README.md` with current navigation/Today terminology where necessary;
* confirm `scratch/**` remains local/ignored;
* preserve `docs/RUNS/**` as restricted historical records;
* preserve `MASTER_SPEC.md` as canonical COLD source;
* keep `OPEN_QUESTIONS.md` unresolved-only;
* verify active docs do not point to obsolete owners;
* inspect `.claude/settings.json` for alignment with final safety model;
* avoid deleting historical evidence merely because terminology evolved.

## Non-Goal

Do not perform a repository-wide content rewrite.

---

# S8 — Development OS V1.2 Verification & Closeout

STATUS: PENDING

## Goal

Verify the operating system as a coherent whole before product development resumes.

## Required Verification Areas

### Ownership consistency

Confirm no active source materially competes with another owner for:

* testing;
* review;
* checkpoint;
* current execution;
* current state;
* decisions;
* backlog;
* history.

### Stale-term/conflict search

Search active operational sources for stale or contradictory guidance involving:

* `TodaySession` as primary current Today model;
* old Run sequence;
* mandatory Feature Contracts;
* Playwright as future/not installed;
* unconditional RLS requirements;
* mandatory repeated full-suite verification;
* reviewer matrices outside `review-commit`;
* checkpoint as test runner;
* automatic push/deploy/hosted mutation.

Historical/restricted sources may preserve old terminology when clearly classified.

### References

Verify:

* referenced files exist;
* renamed/removed ownership references are correct;
* no broken critical navigation remains.

### Rule/frontmatter validity

Verify:

* Claude rule files are loadable;
* Cursor rules use supported syntax;
* paths/scoping do not unintentionally disable universal safety policy.

### Workflow simulation

Reason through at least:

1. domain-only Slice;
2. migration + repository Slice;
3. auth/API security Slice;
4. documentation-only Slice;
5. Run-end integration acceptance.

For each, confirm:

* correct context sources load;
* correct reviewers are chosen;
* testing rule selects proportional evidence;
* checkpoint validates rather than recreates evidence.

### Context-size comparison

Confirm the normal startup/working set is materially smaller than before V1.2.

Exact token thresholds are not required for this Run.

## Acceptance

No unresolved high-risk ownership contradiction remains.

---

# 8. Risk Profile

Primary risks in this Run:

### Policy drift

A rewritten tool/rule may accidentally change accepted product behavior.

Mitigation:

* preserve ADR/product authority;
* treat this as operating-system cleanup, not product design.

### Duplicate ownership remains

Two active files may still claim the same responsibility.

Mitigation:

* final ownership search and workflow simulation.

### Over-compression

A file may become too short to preserve an important safety boundary.

Mitigation:

* retain critical guardrails;
* remove repetition, not safety.

### Historical rewrite

Cleanup may accidentally rewrite historical truth.

Mitigation:

* preserve Run Reports and historical artifacts;
* classify them rather than modernize them.

### Tool scoping error

Cursor/Claude frontmatter may unintentionally make a required rule unavailable.

Mitigation:

* verify supported syntax before scoping;
* keep universal safety in always-available sources.

---

# 9. Manual / Safety Gates

During this Run:

* no Git push;
* no deployment;
* no hosted Supabase mutation;
* no `supabase link`;
* no `supabase db push`;
* no destructive Git operations;
* no secret exposure.

Hosted migrations #10–#12 remain a separate human-controlled action.

Do not combine that remote action with Development OS cleanup unless explicitly requested later.

---

# 10. Commit Strategy

Do not commit after every individual documentation edit.

Prefer focused phase commits once the corresponding set is reconciled and reviewed.

Suggested boundaries:

1. authority + governance;
2. testing/evidence ownership;
3. Claude lifecycle/skills/reviewers/rules;
4. shared operational docs;
5. Cursor projection;
6. cleanup + final OS verification.

Exact commit boundaries may be adjusted to preserve coherent diffs.

Do not push.

---

# 11. Current Progress

Completed:

* S1 — Shared Authority & Governance Reconciliation
* S2 — Testing & Evidence Ownership
* S3 — Claude Operating Kernel & Workflow Skills
* S4 — Reviewer & Scoped Claude Rule Compression
* S5 — Shared Operational Document Compression
* S6 — Cursor Rules Reconciliation
* S7 — Repository Navigation & Cleanup
* S8 — Development OS V1.2 Verification & Closeout

Verification completed:

* local Run telemetry framework was added and smoke-tested;
* telemetry collection, deterministic summarization, and status-line snapshots passed synthetic verification;
* synthetic telemetry data was removed after verification;
* Development OS V1.2 is not used as a telemetry baseline because instrumentation was introduced only at closeout;
* Run 007 is intended to be the first fully instrumented baseline Run.
* `git diff --check` passed with no whitespace errors;
* remaining CRLF/LF messages are Git line-ending warnings only;
* active operational `TodaySession` references are explicitly legacy / compatibility / historical;
* Cursor rule frontmatter was inspected and corrected;
* only `.cursor/rules/workflow.mdc` remains `alwaysApply: true`;
* scoped Cursor rules use valid `globs`;
* Apply Intelligently rules use `alwaysApply: false`;
* ownership and workflow simulations passed for:

  * domain-only work;
  * migration/repository work;
  * auth/API work;
  * documentation-only work;
  * Run-end closeout;
* no product implementation from Run 007 has started.

Current state:

`DEVELOPMENT_OS_V1_2_COMPLETE`

Product development remains paused until a new explicit Run 007 execution Plan is activated.

---

# 12. Completion Criteria

Development OS V1.2 is complete when:

* ownership model is internally consistent;
* `CHATGPT_PLAN` contains only current execution;
* `DEV_STATUS` is a current snapshot rather than chronology;
* `CONTEXT_MAP` is navigation rather than duplicated specification;
* `DEFINITION_OF_DONE` is a project-wide quality bar;
* testing philosophy and operational verification are separated;
* review selection exists only in `review-commit`;
* checkpoint validates evidence/state rather than replaying QA;
* Claude rules are scoped and non-duplicative;
* reviewers are compact and specialist;
* Cursor is a thin projection of canonical policy;
* Follow-Up Backlog exists and remains non-current;
* scratch remains temporary/local;
* historical Run/invariant artifacts are clearly non-current;
* stale/conflicting active guidance has been searched and reconciled;
* final Development OS workflow simulations are coherent;
* repository state is understood;
* no product work from Run 007 has started.

---

# 13. Stop Condition

Development OS V1.2 has reached its stop condition.

Completed closeout state:

1. operational ownership is reconciled;
2. Development OS verification passed;
3. current repository state is understood;
4. `docs/DEV_STATUS.md` is updated to the completed V1.2 snapshot;
5. final Git state remains local and uncommitted until the deliberate commit step;
6. no product work from Run 007 has started.

Final state:

`DEVELOPMENT_OS_V1_2_COMPLETE`

STOP.

Do **not** begin Run 007 automatically.

Run 007 — Structured Import requires a new explicit current execution Plan/handoff.

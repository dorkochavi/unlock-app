# UNLOCK — Current Execution Plan

PLAN_VERSION: DEVOS-1.2-FINAL-COMPRESSION
RUN_ID: 2026-09-21-DEVOS-V1.2-FINAL
BASELINE_REMOTE_HEAD: `c545284` (`feature/project-foundation`, manually pushed by Dor)
STATUS: COMPLETE

## 1. Goal

Finish Development OS V1.2 by compressing the active operating layer **without changing its accepted policy or product/runtime behavior**.

The previous V1.2 reconciliation correctly established ownership, evidence freshness, risk-based review, DailyPlan terminology, Cursor scoping, and telemetry. This final patch removes remaining duplication/context bloat and reconciles closure state.

## 2. Scope

In scope:
- shrink HOT/high-fan-out operational files;
- preserve the final ownership model;
- preserve canonical Slice/Run lifecycle;
- keep evidence reuse/freshness behavior;
- keep risk-based reviewer selection;
- keep telemetry active but COLD;
- keep current Cursor activation/scoping while shrinking projections;
- reconcile Plan/DEV_STATUS/Run-close state;
- structural/reference/frontmatter/JSON/JS validation.

Out of scope:
- Run 007 / Structured Import;
- product/runtime code changes;
- migration changes;
- accepted ADR rewrites;
- RLS introduction;
- runtime/test maintainability refactors;
- hosted Supabase mutation;
- Git push.

## 3. Ownership Contract

| Responsibility | Owner |
|---|---|
| Common agent baseline | `AGENTS.md` |
| Claude operating kernel | `CLAUDE.md` |
| Current Run scope | `docs/CHATGPT_PLAN.md` |
| Current durable state | `docs/DEV_STATUS.md` |
| Context navigation | `docs/CONTEXT_MAP.md` |
| Testing philosophy | `docs/TESTING.md` |
| Verification selection/freshness | `.claude/rules/testing.md` |
| Slice orchestration | `implement-slice` |
| Reviewer selection | `review-commit` |
| Evidence/readiness gate | `checkpoint` |
| DB policy | `.claude/rules/postgres.md` |
| Auth/security policy | `.claude/rules/auth.md` |
| API policy | `.claude/rules/api.md` |
| Learning guardrails | `.claude/rules/learning-engine.md` |
| Deferred work | `docs/FOLLOW_UP_BACKLOG.md` |
| Telemetry details | `docs/RUN_TELEMETRY.md` |

## 4. Canonical Lifecycle

Slice:

`INSPECT → IMPLEMENT → TARGETED VERIFICATION → RISK REVIEW → FIX MATERIAL FINDINGS → FINAL RELEVANT VERIFICATION → EVIDENCE CHECKPOINT → COMMIT`

Run close:

`INTEGRATION ACCEPTANCE (only if missing) → DEV_STATUS → RUN REPORT → FINAL GIT STATE → STOP`

No automatic Run-end replay of broad tests/reviewers.

## 5. S1 — Compress Core Operating Context

STATUS: COMPLETE

Risk: documentation/governance only.

Deliverables:
- `CLAUDE.md` becomes a thin operating kernel;
- `AGENTS.md` remains the common baseline;
- telemetry detail is referenced, not restated;
- no accepted safety/lifecycle behavior is lost.

Acceptance:
- delegated responsibilities have valid owners;
- no product/runtime file changes;
- no remote action.

## 6. S2 — Compress Workflow / Verification / Review Layer

STATUS: COMPLETE

Deliverables:
- concise `testing.md` with freshness/escalation only;
- concise `implement-slice` orchestration;
- concise `review-commit` sole review ownership;
- concise `checkpoint` evidence gate;
- compact specialist reviewers;
- compact scoped Claude rules.

Acceptance:
- testing owner is unique;
- reviewer-selection owner is unique;
- checkpoint does not automatically replay fresh evidence;
- specialist reviewers reference scoped policy instead of copying it.

## 7. S3 — Compress Shared Operational Docs

STATUS: COMPLETE

Deliverables:
- `DEV_STATUS` = current snapshot only;
- `CONTEXT_MAP` = GPS only;
- `TESTING` = conceptual strategy only;
- `DEFINITION_OF_DONE` = outcome-level quality bar only;
- temporary checkpoint remains compact/local.

Acceptance:
- no Run diary in `DEV_STATUS`;
- no specification prose in `CONTEXT_MAP`;
- no command scheduler in `TESTING`/DoD.

## 8. S4 — Thin Cursor Projections

STATUS: COMPLETE

Deliverables:
- preserve existing activation/scoping semantics;
- shrink each Cursor rule to stable tool-specific guardrails;
- eliminate duplicated handbooks.

Acceptance:
- one always-on workflow adapter only;
- DB/Learning/RTL remain scoped as currently configured;
- no stale Answer Option/RLS/TodaySession guidance returns.

## 9. S5 — Closure Reconciliation

STATUS: COMPLETE

Deliverables:
- `DEV_STATUS` reflects remote baseline `c545284` before this patch;
- current Plan has one consistent status model;
- telemetry remains COLD;
- historical Run reports remain historical.

Acceptance:
- no contradictory COMPLETE/PENDING markers inside the Plan;
- no statement that the already-pushed V1.2 baseline is still uncommitted/unpushed.

## 10. S6 — Development OS Verification

STATUS: COMPLETE

Run structural checks only; product full-suite testing is not required for documentation-only compression.

Required checks:
- JSON validity for `.claude/settings.json`;
- JavaScript syntax for telemetry scripts;
- Cursor frontmatter presence/shape;
- referenced changed paths exist;
- searches for stale active guidance:
  - primary `TodaySession` terminology;
  - Answer Options `TBD`;
  - blanket RLS requirement;
  - duplicated reviewer matrices outside `review-commit`;
  - automatic broad Run-end replay;
- changed-file inventory confirms no runtime/migration/ADR changes.

## 11. Closure

The Final Compression Patch is complete in this repository snapshot.

Validated:
- operational context compressed;
- ownership/lifecycle policy preserved;
- telemetry kept COLD;
- JSON/telemetry JavaScript/frontmatter/reference checks passed;
- no runtime source, migration, or accepted ADR changed.

Next: apply/review the patch in the live repository, create a focused local commit, and let Dor push manually. Then create the Run 007 plan.

Stop when:
- the compression patch is structurally verified;
- current durable state is reconciled;
- no runtime/product behavior was changed;
- a focused patch/ZIP is ready for Dor to apply/review.

Do not start Run 007 inside this Plan.
Do not push.

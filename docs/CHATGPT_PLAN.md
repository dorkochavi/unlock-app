# UNLOCK — ChatGPT Execution Plan

PLAN_VERSION: 002
RUN_ID: 2026-09-20-003
BASE_HEAD: fd9162e
RUN_GOAL: Formalize Development OS V1.1 from the first real Run, reconcile hosted-state truth after the successful manual Supabase/QA gate, and leave the repository ready for the next product Run without changing product behavior.
EXPECTED_STOP: COMPLETE

---

## Run-Start Contract

This Plan is authored against committed baseline:

`fd9162e`

Expected Run-start state:

- `HEAD == BASE_HEAD`
- `docs/CHATGPT_PLAN.md` may be the only expected uncommitted modification
- no other staged, unstaged, or untracked changes are expected

`docs/CHATGPT_PLAN.md` is user/ChatGPT-owned during execution:

- read it
- execute it
- do not rewrite it
- do not stage it
- do not discard it

If repository reality differs materially from the above, diagnose before executing.

Do not push.
Do not deploy.
Do not run `supabase db push`.
Do not mutate hosted Supabase.
Do not request or expose secrets.

This is a workflow/documentation Run. Do not change product behavior or application runtime code.

---

## Run Context

The first Development OS Run (`2026-09-20-002`) validated the basic operating model:

- ChatGPT authored the Plan.
- Claude executed against a fixed committed baseline.
- `CHATGPT_PLAN.md` remained uncommitted during execution.
- Claude respected scope containment and remote-safety boundaries.
- risk-based reviewers were used correctly.
- a no-op implementation slice remained a no-op instead of producing unnecessary code.
- `DEV_STATUS` and an immutable Run Report were produced at handoff.
- the executed Plan, `DEV_STATUS`, and Run Report were committed together afterward as the Run handoff checkpoint.

That Run also exposed four workflow improvements that should now become durable repository rules:

1. formal `BASE_HEAD` semantics;
2. checkpoint must not accidentally terminate an unfinished Run;
3. explicit Run Completion Protocol;
4. stricter `DEV_STATUS` snapshot discipline.

After that Run, Dor manually completed the remote gate:

- `20260924000000_daily_plan_answer_attempts.sql` is now applied to hosted Supabase;
- `20260925000000_daily_plan_new_material_v1.sql` is now applied to hosted Supabase;
- `npx supabase migration list` showed local/remote parity through `20260925000000`;
- hosted/browser QA confirmed:
  - real login;
  - hosted Today read;
  - hosted Today answer submission;
  - Today completion state;
  - `AUTHORIZED_ONLY` self-join fails closed with `403`;
  - a clean `OPEN` QA Course self-join succeeds and redirects to `/today`.

The QA Course was created manually in hosted Supabase solely to verify OPEN join behavior. Do not invent broader product semantics from that seed.

---

# S1 — Formalize BASE_HEAD Semantics

MODE: IMPLEMENT

## Goal

Make the Run-start baseline contract explicit and durable so future Plans do not suffer from the tracked-Plan / `BASE_HEAD` circularity.

## Relevant context

Read only what is needed, starting with:

- `CLAUDE.md`
- `.claude/skills/implement-slice/SKILL.md`
- `.claude/skills/checkpoint/SKILL.md`

Use `docs/CONTEXT_MAP.md` only if needed to locate another workflow file that currently defines Plan-start validation.

## Must

Establish this semantic contract:

`BASE_HEAD` means:

> the committed repository baseline the current Plan was authored against.

Valid Run-start state A — preferred/default:

- `HEAD == BASE_HEAD`
- `docs/CHATGPT_PLAN.md` may be the only expected uncommitted modification
- that Plan modification is not treated as unexplained dirty state

Valid Run-start state B — supported alternative:

- `HEAD` is exactly one dedicated Plan-only commit above `BASE_HEAD`
- that commit's only changed path is `docs/CHATGPT_PLAN.md`

Any other mismatch:

- diagnose before execution
- do not silently continue
- if repository reality contradicts the Plan materially, surface `PLAN_CONFLICT`

During execution:

- Claude never rewrites `docs/CHATGPT_PLAN.md`

At Run completion:

- the executed Plan may later be committed by Dor together with `DEV_STATUS` and the immutable Run Report as the handoff checkpoint
- Claude does not need to create a Plan-only commit before execution

## Do not

- do not introduce a second planning source
- do not add ROADMAP/BACKLOG/TODO management files
- do not rewrite unrelated Git/workflow guidance
- do not change product code

## Verification

Targeted read-back / grep demonstrating that all active workflow instructions describing `BASE_HEAD` are consistent with the new semantics.

`git diff --check`

## Review

Use `unlock-reviewer` if the change spans more than one permanent workflow source.

## Exit

Complete when no active workflow instruction requires literal `HEAD == BASE_HEAD` while rejecting the expected uncommitted Plan case.

---

# S2 — Make Checkpoint Non-Terminating and Add Run Completion Protocol

MODE: IMPLEMENT

## Goal

Prevent a successful checkpoint from accidentally becoming the end of an unfinished Run, and formalize exactly how a Run reaches a stop token.

## Relevant context

Start with:

- `.claude/skills/checkpoint/SKILL.md`
- `.claude/skills/implement-slice/SKILL.md`
- `CLAUDE.md`

Read `.claude/skills/review-commit/SKILL.md` only if it currently owns part of final-Run sequencing.

## Must

### A. Checkpoint continuation rule

Make explicit:

- checkpoint is a verification operation, not inherently a Run stop
- after checkpoint completes, inspect the active Plan
- if required Plan work remains and there is no blocker/gate, continue automatically
- do not end the turn merely because checkpoint verdict is READY / green
- stop only when:
  - the Plan is actually complete, or
  - an explicit stop/gate is reached, or
  - a real blocker / `PLAN_CONFLICT` requires Dor

### B. Run Completion Protocol

Define a compact canonical end-of-Run sequence, preserving risk-based behavior:

1. complete all executable slices;
2. run required final verification/checkpoint;
3. run risk-appropriate reviewer(s);
4. address blocking/relevant findings;
5. update `docs/DEV_STATUS.md` with durable current truth only;
6. create immutable `docs/RUNS/<RUN_ID>.md`;
7. verify final Git state and `git diff --check`;
8. report the explicit Plan stop token/status;
9. stop.

If a Run ends at a manual gate, the Run Report must contain the exact manual handoff and distinguish:

- locally verified;
- hosted/externally verified;
- still unverified.

## Do not

- do not require a reviewer for trivial copy/CSS-only work
- do not turn checkpoint into a commit operation
- do not let Run Reports become normal working memory
- do not create a second lifecycle document if `CLAUDE.md` / skills are the correct home

## Verification

Read back the final instructions as if executing a Run with:

- green checkpoint;
- one remaining S4 documentation task;
- no blocker.

The rules must unambiguously require continuation rather than stopping.

`git diff --check`

## Exit

Complete when the first Run's observed failure mode — "checkpoint green, work still remains, Claude stops anyway" — is explicitly prohibited by active workflow guidance.

---

# S3 — Tighten DEV_STATUS Snapshot Discipline

MODE: IMPLEMENT

## Goal

Keep `docs/DEV_STATUS.md` as a compact current-state snapshot and prevent Run-history/detail from accumulating there.

## Relevant context

Start with:

- `CLAUDE.md`
- `docs/DEV_STATUS.md`
- any existing permanent rule/skill that tells Claude how to maintain `DEV_STATUS`

Do not read old Run Reports unless this Plan explicitly references one for a concrete fact. The current Plan already provides the first Run's relevant lesson.

## Must

Durably encode:

`DEV_STATUS` should contain:

- current capabilities;
- current migration/deployment state;
- current verification state;
- current known gaps/blockers;
- current test baseline when useful;
- current manual action still required, if any.

`DEV_STATUS` should not contain:

- chronological Run narration;
- long reviewer summaries;
- detailed per-scenario test inventories when a short current-state statement suffices;
- completed execution history already preserved in Git / `docs/RUNS`;
- duplicated ADR reasoning;
- next-task queue content.

Preferred compression pattern:

Instead of:

> long paragraph listing every scenario audited in Run X...

Prefer:

> demo journey locally verified at unit/application/PGlite layers; browser/hosted status: ...

Then point to the Run Report only when historical detail is genuinely useful.

Apply this discipline to the current `docs/DEV_STATUS.md` itself:

- remove obvious diary-style detail introduced by Run `2026-09-20-002`
- preserve all current factual truth
- do not delete useful current verification state

## Do not

- do not make `DEV_STATUS` so terse that current operational truth disappears
- do not move current blockers into historical reports
- do not copy ADR detail into `DEV_STATUS`

## Verification

Review `DEV_STATUS` section by section and confirm every paragraph answers "what is true now?" rather than "what happened in a previous Run?"

`git diff --check`

## Exit

Complete when `DEV_STATUS` is materially more snapshot-like without losing current operational truth.

---

# S4 — Reconcile Hosted Supabase / Browser State

MODE: IMPLEMENT

## Goal

Update repository current-state documentation so it no longer says migrations 24/25 or the post-Slice-6 learner flow are awaiting the manual remote gate.

## Relevant context

Use:

- `docs/DEV_STATUS.md`
- `supabase/README.md` only if it contains a current migration-state list/status that is now stale
- `docs/DATABASE.md` only if it explicitly tracks hosted-applied-vs-local state and is now stale

Do not broad-sweep historical design documents. Historical files may accurately describe their own earlier state.

## Must

Record current durable facts:

- hosted migration chain is applied through `20260925000000_daily_plan_new_material_v1.sql`
- migrations 24 and 25 are no longer "committed but NOT remotely applied"
- local/remote migration parity through `20260925000000` was manually confirmed
- hosted/browser verification now includes:
  - login;
  - Today read;
  - Today answer submission;
  - Today completion state;
  - `AUTHORIZED_ONLY` self-join fail-closed (`403`);
  - clean OPEN Course self-join success and redirect to `/today`

Be precise about what was NOT manually proven if still applicable.

Do not claim the entire product is production-ready.

Do not claim browser automation exists.

Do not convert the manually created QA Course into a product requirement.

If `supabase/README.md` has a migration list, update it minimally to match the current committed/applied chain.

## Hosted QA note

The earlier malformed/non-UUID Course path behavior remains a known low-priority API validation gap:

- literal `/join/[courseId]` leads the API to PostgreSQL UUID parsing and a generic `500`
- this is not a blocker for valid Course IDs
- do not fix it in this workflow-only Run unless an existing documentation statement becomes false

## Verification

Use targeted grep for stale current-state claims such as:

- `NOT yet applied remotely`
- `committed but NOT yet applied`
- `through auth provisioning`
- current-hosted claims ending at migration `20260923000000`
- hosted answer/join described as unverified

Classify hits:
- active/current truth → update
- clearly historical body → leave intact

`git diff --check`

## Exit

Complete when active current-state documentation matches the post-manual-gate hosted reality.

---

# S5 — Development OS V1.1 Consistency Review and Handoff

MODE: VERIFY

## Goal

Prove the workflow changes are coherent, scoped, and ready to become the operating model for the next product Run.

## Must

Perform a narrow consistency review across changed workflow/current-state files.

Specifically verify:

- one fact, one home still holds;
- `CHATGPT_PLAN` remains the execution queue;
- `DEV_STATUS` remains current truth;
- `docs/RUNS/**` remains restricted historical archive;
- `BASE_HEAD` semantics are consistent everywhere active;
- checkpoint continuation rule is unambiguous;
- Run Completion Protocol has one canonical meaning;
- no new competing management file was created;
- no product/runtime code changed;
- no remote mutation occurred during this Run.

Run:

- `git diff --check`
- targeted workflow grep(s)
- final `git status -sb`

Do not run the full unit or schema suite solely for documentation/workflow edits unless an unexpected source/schema change occurred.

## Review

Run `unlock-reviewer` as the final Development OS V1.1 review.

Address meaningful workflow/documentation findings before handoff.

## DEV_STATUS

Ensure it reflects the post-hosted-QA current state and does not narrate this Run.

## Run Report

Create:

`docs/RUNS/2026-09-20-003.md`

Target 50–150 lines.

Include:

- what V1.1 changed;
- exact `BASE_HEAD` semantics adopted;
- checkpoint continuation rule;
- Run Completion Protocol;
- DEV_STATUS discipline;
- hosted-state reconciliation;
- files changed;
- verification/reviewer outcomes;
- any deferred low-risk issue;
- final Git state.

Do not read or summarize old Run Reports to produce it.

## Final stop

When complete, report:

`COMPLETE`

Do not push.
Do not stage or modify `docs/CHATGPT_PLAN.md`.

---

# Definition of Done

This Run is complete only when all of the following are true:

- Development OS V1.1 semantics are durable in active repo guidance;
- the `BASE_HEAD` circularity is formally resolved;
- checkpoint can no longer be interpreted as an automatic Run terminator;
- Run Completion Protocol is explicit;
- `DEV_STATUS` discipline is explicit and current file is compacted accordingly;
- hosted Supabase state is reconciled through migration `20260925000000`;
- hosted/browser QA truth is recorded precisely;
- no product/runtime behavior changed;
- final reviewer has no blocker;
- `git diff --check` is clean;
- `docs/RUNS/2026-09-20-003.md` exists;
- final status is reported as `COMPLETE`.

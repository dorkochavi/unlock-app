---

name: checkpoint
description: Validate UNLOCK's current Slice evidence and repository state after review and final relevant verification. Read-only. Confirms that required evidence exists, remains fresh, findings are resolved, and state is understood. Does not rerun the full verification suite by default.
-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# /checkpoint

Use this skill after:

```text id="i9a20k"
IMPLEMENT
→ TARGETED VERIFICATION
→ RISK REVIEW
→ FIX MATERIAL FINDINGS
→ FINAL RELEVANT VERIFICATION
```

Its job is to answer:

> Is the current Slice state supported by sufficient fresh evidence to proceed?

This skill owns **evidence/state validation**.

It does not own:

* implementation;
* test selection;
* reviewer selection;
* product decisions;
* Run sequencing;
* commit execution.

This skill is strictly read-only.

Never:

* modify files;
* modify documentation;
* auto-fix failures;
* stage;
* commit;
* push;
* reset;
* clean;
* delete files.

---

## 1. Establish Current Context

Use current session context when already fresh.

Load only what is necessary to identify:

* `PLAN_VERSION`;
* `RUN_ID`;
* current Slice;
* Slice acceptance criteria;
* expected lifecycle transition.

Primary sources:

* `docs/CHATGPT_PLAN.md`;
* `docs/DEV_STATUS.md`;
* repository/Git reality.

Do not infer the current task from historical Run Reports.

---

## 2. Establish Repository State

Inspect enough Git state to understand what is being checkpointed.

Typical minimum:

```text id="f1nqf4"
git status --short
git status -sb
git log --oneline --decorate -5
git diff --check
```

Use additional diff inspection only when needed.

Determine:

* current branch;
* HEAD;
* ahead/behind state;
* staged changes;
* unstaged changes;
* untracked files;
* unexpected repository state.

Do not modify anything.

---

## 3. Confirm Slice Alignment

Compare the current implementation state with the active Slice.

Validate:

* intended Slice work is present;
* acceptance criteria are addressed;
* explicit non-goals remain respected;
* unrelated work has not leaked into the Slice;
* no unapproved product/architecture/security decision was introduced.

If repository reality conflicts with the Plan, report:

```text id="spjufj"
PLAN_CONFLICT
```

Do not fix or rewrite the Plan here.

---

## 4. Validate Review State

Confirm that the required risk review occurred before checkpoint.

Expected review source:

`/review-commit`

Validate:

* appropriate reviewer type(s) were used for the actual risk surface;
* no unresolved BLOCKER remains;
* no required CORRECTION remains;
* any material correction has been incorporated.

Do not rerun review merely because checkpoint was invoked.

If review has not happened when the lifecycle requires it:

checkpoint is not ready.

---

## 5. Validate Evidence Inventory

Identify the evidence already produced for this Slice.

Possible evidence includes:

* focused domain/unit tests;
* application tests;
* API/route tests;
* repository/PGlite integration;
* schema migration tests;
* auth/security regression tests;
* Playwright E2E;
* typecheck;
* lint;
* production build;
* `git diff --check`;
* hosted/manual verification where actually performed.

Checkpoint should inspect the available evidence.

It should not assume every category is required.

---

## 6. Validate Evidence Sufficiency

Use:

`.claude/rules/testing.md`

to determine whether the evidence set is sufficient for the changed risk surface.

Ask:

```text id="2fjtdd"
For every materially affected risk,
is there an appropriate proving layer?
```

Examples:

* pure domain change → focused domain evidence may be sufficient;
* SQL/constraint change → relevant schema/PGlite evidence is required;
* route-auth change → route/auth evidence is required;
* integrated learner path change → browser E2E may be required;
* build/runtime-boundary change → build evidence may be required.

Do not require unrelated checks.

---

## 7. Validate Evidence Freshness

For each important evidence result, ask:

```text id="q0eyra"
What changed after this check passed?
```

If no later relevant change could affect what it proved:

* evidence remains fresh.

If a later relevant change could affect it:

* evidence is stale.

If uncertain:

* treat it as stale.

Checkpoint does not itself invent a new testing matrix.

Use the operational testing rule.

---

## 8. Do Not Rerun Valid Evidence

Checkpoint is not another QA cycle.

Do not automatically rerun:

* `npm test`;
* `npm run test:schema`;
* `npm run typecheck`;
* `npm run lint`;
* `npm run build`;
* Playwright;

merely because checkpoint began.

If evidence is missing or stale:

report exactly what must be refreshed.

Return execution to the implementation/testing lifecycle.

---

## 9. Minimal Checkpoint-Owned Checks

Checkpoint may perform small read-only state checks that validate the checkpoint itself.

Examples:

```text id="rrp0ml"
git status --short
git status -sb
git diff --check
```

It may inspect:

* diff scope;
* staged file list;
* repository cleanliness;
* current HEAD;
* documentation consistency relevant to the transition.

These checks do not replace implementation verification.

---

## 10. Validate Verification Claims

Ensure evidence descriptions do not overstate what was actually proved.

Distinguish:

* unit-tested;
* application-tested;
* route-wiring tested;
* PGlite integration-tested;
* browser E2E tested;
* inspected by reviewer;
* reasoned under PostgreSQL semantics;
* hosted Supabase verified;
* deployed environment verified.

Do not promote local evidence into hosted/production evidence.

---

## 11. Validate Database Evidence Boundaries

When database work is involved, checkpoint should ensure claims match reality.

For example:

PGlite may prove:

* migration application;
* constraints;
* repository SQL;
* transactional behavior supported by the environment.

It does not automatically prove:

* hosted Supabase Auth;
* network behavior;
* pooling;
* every true multi-backend concurrency case;
* hosted RLS/role behavior.

Do not block valid local work merely because hosted verification is not part of the current Slice.

Do report hosted/manual actions that remain intentionally pending.

---

## 12. Validate Hosted Migration State

If the Slice creates a migration:

distinguish clearly between:

```text id="2wfglw"
committed/local/PGlite verified
```

and:

```text id="a27tsq"
applied to hosted Supabase
```

Claude must not apply hosted migrations.

If hosted application is a later manual gate:

* checkpoint may still be locally ready;
* report the manual action explicitly.

Do not claim hosted completion prematurely.

---

## 13. Validate Temporary / Accidental Files

Inspect for unintended files relevant to commit/handoff safety.

Examples:

* `.env*`;
* secrets;
* scratch files;
* zip archives;
* generated artifacts;
* Supabase CLI temporary state;
* unrelated local files.

`scratch/**` is temporary local state and should not be staged.

Do not delete or modify unexpected files.

Report them.

---

## 14. Validate Durable Documentation Need

Checkpoint may identify whether durable current truth now requires a documentation update.

Typical owner:

`docs/DEV_STATUS.md`

Examples:

* capability became real;
* migration state changed;
* durable blocker closed;
* new current limitation appeared;
* meaningful verification baseline changed.

Checkpoint must not edit DEV_STATUS.

Report the needed update to the implementation workflow.

Do not demand DEV_STATUS updates for transient execution details.

---

## 15. Validate Commit Safety

If the intended next step is commit readiness, inspect whether:

* only intended files will be committed;
* no secret/config leakage is visible;
* scratch is not staged;
* unrelated files are not staged;
* material review findings are resolved;
* evidence is sufficient and fresh;
* `git diff --check` is clean.

Checkpoint does not stage or commit.

---

## 16. Run-End Checkpoint

If checkpoint is being used near the end of a Run, do not automatically require all Run checks again.

Validate whether:

* every Slice is complete;
* any cross-Slice integration criterion still lacks evidence;
* Run-level manual gates remain;
* durable status/history updates are required;
* final Git state is understood.

Additional integration verification belongs only where a real evidence gap exists.

---

## 17. Verdict Model

Checkpoint returns exactly one of these verdicts.

### `READY`

Use when:

* current Slice is aligned;
* required review is complete;
* no blocking finding remains;
* relevant evidence is sufficient;
* evidence is fresh;
* repository state is understood;
* no current blocker prevents the next lifecycle action.

### `NOT READY`

Use when:

* required evidence is missing/stale;
* review is incomplete;
* a material finding remains unresolved;
* repository state is unclear;
* acceptance criteria are not satisfied;
* unsafe/unexpected files block the intended transition.

### `BLOCKED`

Use when safe continuation requires:

* a human decision;
* a manual remote action that is the current gate;
* resolution of a genuine `PLAN_CONFLICT`;
* repository safety intervention.

Do not use multiple readiness tiers such as:

* `READY FOR REVIEW`;
* `READY FOR COMMIT`;
* `READY FOR HANDOFF`.

The active workflow already knows what transition comes next.

Checkpoint only answers whether current evidence/state is ready for that transition.

---

## 18. Report Format

Return exactly these sections.

### Checkpoint Target

* Run ID;
* Slice;
* branch;
* HEAD;
* intended next lifecycle action.

### Repository State

Summarize:

* staged;
* unstaged;
* untracked;
* unexpected state.

### Review State

Report:

* reviewers used;
* unresolved BLOCKERs;
* unresolved CORRECTIONs.

### Evidence Inventory

List only meaningful evidence actually available.

For each item:

```text id="j5de8k"
Evidence
Status: fresh / stale
What it proves
```

### Evidence Gaps

List any missing/stale evidence required by the changed risk surface.

If none:

`None.`

### Documentation / Manual Actions

List only durable updates or manual gates still required.

If none:

`None.`

### Blockers

List blockers.

If none:

`None.`

### Verdict

Exactly one:

* `READY`
* `NOT READY`
* `BLOCKED`

### Next Action

Give exactly one next action.

Examples:

* create focused local commit;
* refresh specific stale verification;
* resolve review correction;
* update DEV_STATUS then rerun checkpoint;
* perform required human hosted migration;
* resolve PLAN_CONFLICT.

Do not perform the action.

---

## 19. Evidence Gap Response

If checkpoint finds stale/missing evidence, do not solve it by default.

Report narrowly:

```text id="73tv3m"
Evidence gap:
- affected risk
- missing/stale evidence
- reason it is required
```

The implementation workflow should then use `.claude/rules/testing.md` to run the appropriate check.

Afterward, checkpoint may be rerun.

---

## 20. Failure Honesty

Do not hide:

* failed tests;
* unresolved reviewer findings;
* unexplained worktree changes;
* pending hosted migration;
* unverified real-environment assumptions.

Likewise, do not exaggerate them.

A known manual hosted action may be acceptable at a local checkpoint if the active Plan explicitly places that action later.

State the boundary accurately.

---

## 21. Historical Artifacts

Do not use:

* old Run Reports;
* historical Invariant Matrix;
* stale scratch;
* old test counts;

as current readiness authority.

Current readiness comes from:

* active Plan;
* repository state;
* current review;
* current relevant evidence.

---

## 22. Test Counts

Do not require exact historical test counts for readiness.

Counts may be useful as diagnostics.

They are not acceptance criteria unless the active Plan explicitly makes them one.

A changed count is not itself a defect.

---

## 23. No Automatic Scope Expansion

If checkpoint discovers unrelated technical debt:

* do not block current work unless it creates current risk;
* do not fix it;
* preserve it in `FOLLOW_UP_BACKLOG` only when genuinely useful.

Checkpoint is not a cleanup phase.

---

## 24. Stop Condition

Checkpoint ends when:

1. current repository state is understood;
2. review state is understood;
3. relevant evidence has been inventoried;
4. freshness and sufficiency have been evaluated;
5. gaps/blockers are explicit;
6. one verdict and one next action are returned.

Do not continue into:

* implementation;
* test reruns;
* documentation edits;
* staging;
* commit;
* push.

---

## 25. Core Rules

* Read-only.
* Validate evidence; do not recreate it.
* Validate state; do not mutate it.
* Use the active Plan.
* Use `.claude/rules/testing.md` for evidence sufficiency/freshness.
* Review must precede checkpoint.
* Reuse fresh evidence.
* Do not rerun broad suites ceremonially.
* Do not overstate verification.
* Do not stage.
* Do not commit.
* Do not push.
* Do not modify DEV_STATUS.
* Do not delete unknown files.
* Return one verdict and one next action.

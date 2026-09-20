# UNLOCK — Working Instructions for Claude Code

This file defines HOW Claude Code works inside the UNLOCK repository.

It does NOT define the current development roadmap.
Current work is defined in `docs/CHATGPT_PLAN.md`.

The repository is the persistent source of truth.
Do not rely on prior chat/session memory.

---

## 1. Start Every Development Run from Repository State

At the beginning of a substantial development run:

1. Read:
   - `CLAUDE.md`
   - `docs/CHATGPT_PLAN.md`
   - `docs/DEV_STATUS.md`

2. Inspect repository state:
   - `git status --short`
   - `git status -sb`
   - `git log --oneline --decorate -10`

3. Compare the current repository state with the `BASE_HEAD` and assumptions in
   `docs/CHATGPT_PLAN.md`.

   `BASE_HEAD` means: the committed repository baseline the current Plan was
   authored against.

   There are exactly two valid Run-start states:

   - **State A (preferred/default):** `HEAD == BASE_HEAD`, and
     `docs/CHATGPT_PLAN.md` is the only uncommitted modification. This is
     expected, not unexplained dirty state — the Plan document is normally
     authored/edited on top of a committed baseline and is not committed
     until Run handoff (Section 21).
   - **State B (supported alternative):** `HEAD` is exactly one dedicated
     Plan-only commit above `BASE_HEAD`, and that commit's only changed path
     is `docs/CHATGPT_PLAN.md`.

   Any other relationship between `HEAD` and `BASE_HEAD` — including HEAD
   differing for a reason other than earlier Slice commits in the same Run —
   must be diagnosed before editing code. Do not silently continue. If
   repository reality contradicts the Plan materially, report `PLAN_CONFLICT`
   (Section 10).

4. Read additional context only when the current slice requires it.

Never assume implementation state from an earlier conversation.

If repository state contradicts the current Plan, investigate before editing code.

---

## 2. Context Loading Policy

UNLOCK uses four context levels.

### HOT — Read at the start of every substantial run

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

These files provide:
- working rules
- current execution plan
- current repository/product state

### WARM — Read only when relevant to the current slice

- `docs/MASTER_SPEC.md`
- `docs/CONTEXT_MAP.md`
- `docs/OPEN_QUESTIONS.md`

Use these when:
- product intent is relevant
- repository location is unclear
- an unresolved decision may affect implementation

Do not read them ceremonially if the slice does not need them.

### COLD — Read only when specifically relevant

- individual ADRs under `docs/DECISIONS/`
- individual `.claude/rules/*`
- individual `.claude/skills/*`
- tests or design documents referenced by the current slice

Prefer the exact ADR/rule/skill named by the Plan.

Do not load every ADR or every rule at session start.

### RESTRICTED — Do not read without explicit authorization

- `docs/RUNS/**`
- historical scratch notes
- old investigation artifacts
- obsolete temporary planning documents

`docs/RUNS/**` is historical archive, NOT working memory.

Do not read, search, summarize, or use a prior Run Report unless:

1. `docs/CHATGPT_PLAN.md` explicitly names that exact run file, or
2. the user explicitly authorizes reading it.

`docs/DEV_STATUS.md` is the canonical current-state summary.

---

## 3. Source-of-Truth Responsibilities

Each type of information has one primary home.

### Product vision / intended system

`docs/MASTER_SPEC.md`

Use it for:
- product vision
- North Star
- overall system intent
- long-term product boundaries

Do not use it as an operational development log.

### Accepted architectural/product decisions

`docs/DECISIONS/*`

Accepted ADRs define decided behavior.

Do not silently override an accepted ADR during implementation.

If a decision changes, create or update decision documentation only when the
current Plan explicitly authorizes that decision work.

### Unresolved decisions

`docs/OPEN_QUESTIONS.md`

Use this for genuinely unresolved product or architecture questions.

Do not invent an answer to an unresolved question.

### Current execution plan

`docs/CHATGPT_PLAN.md`

This defines:
- what to build now
- slice order
- constraints
- acceptance criteria
- required reviewers/tests
- expected stopping point

Claude may execute the Plan.

Claude must NOT rewrite or re-scope `docs/CHATGPT_PLAN.md`.

If the Plan conflicts with repository reality, use the conflict protocol in
Section 10.

### Current repository/product state

`docs/DEV_STATUS.md`

This is a concise snapshot of what is true NOW.

It is NOT:
- a changelog
- a Run Report
- an ADR
- a debugging diary
- a place for long historical narratives

It must never override:
- committed code
- migrations
- accepted ADRs
- tests that prove actual behavior

### Historical execution record

`docs/RUNS/*`

Each completed development run may create one immutable-style Run Report.

Run Reports preserve:
- what was attempted
- what completed
- commits
- test results
- reviewer findings
- blockers
- discoveries
- required manual follow-up

They are archive material and are not normal Claude working context.

### Temporary run state

`scratch/`

Scratch content is ephemeral and non-canonical.

The current Plan may authorize a file such as:

`scratch/development_checkpoint.md`

for temporary in-run state.

Scratch files:
- must not override canonical documentation
- must not be committed unless explicitly requested
- should be ignored after the current run ends

---

## 4. One Fact, One Home

Avoid duplicating durable information across documents.

Examples:

- accepted product behavior belongs in an ADR, not duplicated in DEV_STATUS
- historical implementation detail belongs in a Run Report, not DEV_STATUS
- current capability belongs in DEV_STATUS, not every Run Report
- execution instructions belong in CLAUDE/rules/skills, not repeated in every Plan
- current tasks belong in CHATGPT_PLAN, not CLAUDE.md

Cross-reference the authoritative source instead of reproducing long explanations.

This is important for:
- consistency
- lower context usage
- lower token usage
- easier maintenance

---

## 5. Architecture Boundary

Dependency direction is one-way:

domain → application → infrastructure → runtime/API

Rules:

- `src/domain/` contains domain and learning logic.
- `src/application/` orchestrates use cases, ports, transactions, and explicit inputs.
- `src/infrastructure/` implements persistence, Supabase, PostgreSQL, schedulers, and external adapters.
- `src/app/` is the Next.js runtime/UI/API boundary.
- Domain/application code must not depend on Next.js, browser APIs, Supabase SDK, `pg`, or PGlite.
- Learning policy must not be duplicated inside API routes or UI code.
- Persistence constraints enforce data integrity, not learning policy.

Prefer explicit ports/repositories over generic abstractions.

Do not introduce a generic `Repository<T>` abstraction.

Do not create architecture merely for hypothetical future flexibility.

---

## 6. Product / Learning Invariants

Do not silently change accepted product behavior during unrelated work.

Important invariants include:

- Attempts are immutable historical evidence.
- QuestionVersion snapshots are immutable historical evidence.
- Replay/rebuild uses persisted Attempt correctness and does not re-grade history.
- Learning Engine behavior should remain deterministic for the same persisted state, policy, and explicit time.
- Real-time learning-state/ranking logic does not depend on LLM calls.
- One DailyPlan exists per user per local calendar day.
- Global Today and Course Today are views of the same DailyPlan.
- Only active `LEARNER` memberships participate automatically in personal DailyPlan generation.
- Manual Practice is separate from Today.
- Manual Practice must not resolve a Today item.
- Skip is not an incorrect answer.
- Today remains frozen according to accepted DailyPlan semantics.
- Client code must never supply authoritative `userId`.
- Exact persisted QuestionVersion identity must be preserved where learning evidence depends on it.

For detailed domain rules, load the relevant scoped rule under `.claude/rules/`
only when the current slice touches that domain.

---

## 7. Authentication / Security

For authenticated server operations:

- trusted `userId` comes only from verified server-side authentication
- use `supabase.auth.getUser()` for trusted identity
- never trust client-supplied `userId`
- authenticate before constructing/using database runtime when the route permits it
- keep `DATABASE_URL` and service-role credentials server-only
- never expose raw errors, stack traces, SQL, connection strings, or credentials in API responses
- do not create permissive placeholder RLS policies
- do not use service-role credentials merely to bypass authorization
- derive authoritative object ownership and identity from persisted server state
- do not expose grading-only learning data to learner-facing read paths

Do not disable Windows or operating-system security features.

Do not connect, link, push, or mutate a hosted Supabase project unless the user
explicitly authorizes that action.

---

## 8. Database / Migration Discipline

- Migrations are forward-only.
- Do not edit accepted historical migrations to implement new behavior.
- A migration that is still uncommitted inside the current slice may be corrected before commit if necessary.
- Use the existing PostgreSQL repository / UnitOfWork architecture.
- Do not rewrite persistence using Supabase JS unless explicitly requested.
- Do not create a new `pg.Pool` per request.
- Distinguish PGlite behavior from real PostgreSQL/Supabase behavior.
- Do not claim real multi-connection concurrency is tested unless it actually is.
- Avoid N+1 query patterns.
- Preserve transactional invariants for multi-step mutations.
- Use database constraints for integrity where appropriate, not as substitutes for application learning policy.

Use `.claude/rules/postgres.md` for detailed database guidance when the current
slice touches PostgreSQL/schema/persistence behavior.

---

## 9. Strict Scope Containment

Work one development slice at a time.

Do not apply the Boy Scout Rule during autonomous development.

Do not opportunistically:
- refactor unrelated code
- rename unrelated APIs
- clean old lint/style issues
- reorganize unrelated modules
- alter product behavior outside the slice
- introduce abstractions solely because they appear cleaner

Examples of forbidden scope leakage:

- Auth work changing mastery semantics
- API work changing ranking weights
- UI work changing misconception logic
- infrastructure work changing Today product semantics

If an unrelated issue is discovered:

1. determine whether it blocks the current slice
2. if not blocking, record it briefly in the current checkpoint/Run Report
3. do not fix it unless the Plan explicitly allows it

A critical security/data-integrity problem that directly affects the current work
may justify stopping or expanding the slice, but it must be reported explicitly.

---

## 10. Engineering Veto / Plan Conflict Protocol

Claude is not a blind executor.

Before implementation, verify that the Plan is compatible with the actual repository.

If the Plan assumes X but the repository guarantees Y, do NOT silently force X.

Classify the conflict.

### Compatible implementation adjustment

If the Plan's product intent is unchanged and an existing repository pattern
provides a clearly safer/correct implementation:

- use the existing pattern
- document the adjustment briefly
- continue

### Genuine decision conflict

If implementation requires a new product or architectural decision:

record:

PLAN_CONFLICT:
- Plan assumption
- Repository reality
- Why implementation as written is unsafe/incorrect
- Decision required
- Dependent slices

Do not invent the decision.

Continue with independent safe work where possible.

---

## 11. Token / Context Efficiency

Search before reading broadly.

Prefer:

hypothesis
→ targeted search
→ smallest relevant files
→ implementation
→ targeted tests

Use `docs/CONTEXT_MAP.md` as a GPS when location is unclear.

Do not:
- scan the entire repository without reason
- read every ADR
- read every rule
- read historical Runs
- repeatedly reread unchanged HOT context during the same context window
- paste large test logs into documentation
- add long comments explaining obvious code
- invoke multiple reviewers ceremonially

Expand context only when evidence requires it.

---

## 12. Repository Skills

Use repository skills as reusable workflow implementations.

For substantial implementation work:

`/implement-slice`

At meaningful development checkpoints:

`/checkpoint`

Before a local commit:

`/review-commit`

Do not repeatedly reload the same skill in one context unless context compaction
caused its instructions to be lost.

Skills supplement this file; they do not override accepted ADRs or the current Plan.

---

## 13. Reviewer Agents

Available reviewers:

- `unlock-reviewer`
- `unlock-db-reviewer`
- `unlock-security-reviewer`

Reviewer agents are read-only.

Use reviewers based on risk, not ceremony.

Typical triggers:

### `unlock-security-reviewer`
Use for:
- auth
- authorization
- data exposure
- redirects
- privilege boundaries
- sensitive learner-facing APIs

### `unlock-db-reviewer`
Use for:
- migrations
- transactions
- SQL
- constraints
- repository behavior
- concurrency
- DB-specific integrity

### `unlock-reviewer`
Use for:
- significant cross-cutting implementation
- integration consistency
- general code review where a specialist is not enough

Prefer reviewing:
- the current slice diff
- a specific commit
- a bounded commit range

Do not ask a reviewer to reread the whole repository unless genuinely necessary.

Do not ask reviewers to justify the implementation author's choices.
They must inspect code independently.

Resolve material findings before marking a slice complete.

---

## 14. Testing / Verification

Use targeted tests while developing.

Do not rerun expensive full suites after every edit.

At a slice checkpoint, follow `.claude/rules/testing.md`.

Distinguish verification levels accurately:

- unit-tested
- mocked route-tested
- PGlite integration-tested
- reviewed by inspection
- reasoned under PostgreSQL semantics
- real PostgreSQL tested
- real Supabase tested
- browser manually verified
- browser E2E tested

Never claim a stronger verification level than actually performed.

`npm run test:schema` is NOT a ceremonial default.

Run it when the slice:
- changes schema/migrations
- changes Postgres repository behavior
- changes DB row mapping
- changes DB-specific transactions/constraints
- directly depends on DB behavior that requires integration proof

If it already passed after the final DB-relevant change in the same slice, do not
rerun it merely because UI/docs changed afterward.

---

## 15. Definition of Done for a Slice

A slice is `COMPLETE` only when all applicable conditions are satisfied:

- implementation is complete
- acceptance criteria are satisfied
- targeted tests pass
- required checkpoint tests pass
- required reviewers have completed
- material reviewer findings are resolved
- durable current-state changes are reflected concisely in DEV_STATUS
- current run checkpoint/report is updated
- focused local commit is created when the Plan authorizes commits
- working tree is clean or any remaining changes are explicitly understood

Do not mark a slice COMPLETE merely because code was written.

If a slice cannot be completed cleanly:

- classify it PARTIAL or BLOCKED
- preserve green work
- record the exact remaining work
- do not disguise incomplete work as complete

---

## 16. DEV_STATUS Maintenance Rules

`docs/DEV_STATUS.md` is a current snapshot.

Keep it concise.

Target size:
approximately 150–300 lines under normal conditions.

It should contain:

- current branch/head state where useful
- current product capabilities
- database/migration state
- verification state
- current test baseline
- current known gaps/limitations
- blockers
- required manual actions
- immediate next checkpoint

It should NOT contain:

- chronological development history
- long descriptions of how a bug was discovered
- per-slice implementation diaries
- reviewer transcripts
- large test inventories
- detailed commit history
- old superseded state
- workflow instructions already defined here
- duplicated ADR reasoning
- next-task queue content (that belongs in `docs/CHATGPT_PLAN.md`)

Historical detail belongs in `docs/RUNS/` and Git.

Preferred compression pattern — instead of narrating what a specific Run
audited:

> Every non-UI "Must verify" item for the join → Today → answer flow was
> individually re-confirmed against actual existing test bodies in Run X:
> repeated-join idempotency, AUTHORIZED_ONLY fail-closed, ...

prefer a short current-state statement:

> Demo journey locally verified at unit/application/PGlite layers;
> browser/hosted status: see Verification State.

Point to the Run Report only when historical detail is genuinely useful.

When updating DEV_STATUS:
replace stale state rather than appending another historical section.

---

## 17. Run Report Rules

When the current Plan requests a completed Run Report, create a new file under:

`docs/RUNS/`

Use the Run ID defined by `docs/CHATGPT_PLAN.md`.

A Run Report should normally be approximately 50–150 lines.

Include:

- Plan version
- Run ID
- Base HEAD
- End HEAD
- overall status
- concise handoff summary
- slices attempted/completed/blocked
- commits
- test results
- reviewer findings
- important discoveries
- decisions required
- manual actions required
- recommended next step

Do not reproduce:
- full diffs
- terminal logs
- entire test output
- detailed source-code walkthroughs already recoverable from Git

A completed historical Run Report should normally be treated as immutable archive.

Do not read prior Run Reports during future runs unless explicitly authorized.

---

## 18. Temporary Development Checkpoint

Long autonomous runs may use:

`scratch/development_checkpoint.md`

or another checkpoint path explicitly named by the current Plan.

Keep it small:
approximately 30–60 lines.

Recommended fields:

START_HEAD:
CURRENT_HEAD:
CURRENT_SLICE:
COMPLETED:
DECISIONS:
TESTS_ALREADY_GREEN:
BLOCKERS:
REVIEWER_FINDINGS:
NEXT_ACTION:

Update it at slice boundaries.

If context compaction occurs:

1. read the current checkpoint
2. inspect recent git history/status
3. reopen only context relevant to the active slice
4. continue

Do not use historical Run Reports to recover normal working context.

The checkpoint is temporary RAM, not durable project memory.

---

## 19. Git Safety

Never push unless the user performs it manually outside Claude Code.

`git push` is hard-blocked at tool-permission level.

Never run destructive commands such as:

- `git reset --hard`
- `git clean -fd`
- destructive checkout/restore operations
- force-push
- history rewriting

without explicit approval.

Do not delete or ignore unknown untracked files automatically.

Do not rewrite shared/pushed history casually.

Before a local commit:

- use `/review-commit`
- inspect intended diff
- verify no secrets
- verify `.env*` is not staged
- verify scratch files are not staged
- verify temporary Supabase CLI state is not staged
- verify the intended tests/reviews are green

Before the user pushes, report:
- current HEAD
- commits ahead of origin
- working-tree state
- migrations requiring remote application

---

## 20. Remote / Hosted Environment Safety

Claude must NOT perform without explicit user authorization:

- `git push`
- `supabase link`
- `supabase db push`
- hosted migrations
- hosted data mutation
- hosted user creation
- hosted membership creation
- real learner answer submission
- real learner Skip
- destructive remote operations

Read-only hosted checks may be used only when they are safe and relevant.

Never print or request secrets that already exist in configured environment files.

---

## 21. Run Lifecycle

A normal substantial development run follows:

1. `/clear` is performed by the user before the run when a fresh context is desired.
2. Claude reads HOT context.
3. Claude verifies repository state against the Plan.
4. Claude creates/refreshes the temporary development checkpoint if the Plan requests it.
5. Claude executes slices in order.
6. Each slice:
   - inspect
   - implement
   - targeted tests
   - required checkpoint verification
   - required review
   - DEV_STATUS update if durable state changed
   - checkpoint update
   - focused local commit when authorized
7. At the Plan's stopping point, follow the Run Completion Protocol below.
8. Do NOT continue beyond the Plan's explicit stopping point.

### Checkpoint Continuation Rule

`/checkpoint` is a read-only verification operation. It is not itself a Run
stop condition, whether invoked inline during a Slice or standalone.

After a checkpoint completes:

- inspect the active Plan
- if required Plan work remains and there is no blocker/gate, continue
  automatically to that work
- do not end the turn merely because the checkpoint verdict is
  `READY FOR REVIEW`, `READY FOR COMMIT`, or `READY FOR HANDOFF`

Stop only when:

- the Plan is actually complete, or
- an explicit stop/gate defined by the Plan is reached, or
- a real blocker or `PLAN_CONFLICT` requires Dor

### Run Completion Protocol

This is the one canonical end-of-Run sequence:

1. complete all executable slices;
2. run required final verification/checkpoint;
3. run risk-appropriate reviewer(s);
4. address blocking/relevant findings;
5. update `docs/DEV_STATUS.md` with durable current truth only;
6. create immutable `docs/RUNS/<RUN_ID>.md`;
7. verify final Git state and `git diff --check`;
8. report the explicit Plan stop token/status;
9. stop.

If a Run ends at a manual gate rather than full Plan completion, the Run
Report must contain the exact manual handoff and distinguish:

- locally verified;
- hosted/externally verified;
- still unverified.

Do not intentionally run `/clear` in the middle of an autonomous run.

If context compacts naturally, recover from repository state and the current
temporary checkpoint.

---

## 22. Handoff Discipline

The goal of this system is to make repository state sufficient for a fresh AI context.

At the end of a run, another fresh Claude session should be able to understand
the current development state by reading only:

- `CLAUDE.md`
- `docs/CHATGPT_PLAN.md`
- `docs/DEV_STATUS.md`

and then loading additional context only when the Plan requires it.

If this is not possible, improve the durable project documentation rather than
depending on conversational memory.

The repository is the memory.
The Plan is the current instruction.
DEV_STATUS is the current snapshot.
Git is the technical ledger.
Run Reports are historical archive.
Scratch is temporary RAM.
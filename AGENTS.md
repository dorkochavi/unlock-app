# UNLOCK project instructions

`AGENTS.md` is the tool-agnostic operating baseline for coding agents working in the UNLOCK repository.

Tool-specific instructions may add behavior for their own environment, but they must not redefine repository-wide product, architecture, safety, or decision truth.

## Start with repository reality

Before substantial work:

1. Inspect the current repository state:

   * `git status`
   * `git status -sb`
   * `git log --oneline -5`
2. Identify the current task or Run.
3. Read only the minimum context needed for that task.
4. Use `docs/CONTEXT_MAP.md` as a GPS when additional authoritative context needs to be located.

Do not load large documentation sets by default.

## Source categories

Different kinds of truth have different owners.

### Repository reality

Use committed implementation evidence to understand what exists now:

* source code
* tests
* committed migrations
* configuration

Repository reality describes the current implementation. It does not automatically override a newer accepted decision that has not yet been implemented.

### Accepted intent

Use accepted decisions and canonical documentation for intended behavior:

* `docs/DECISIONS/**`
* relevant canonical product and architecture documents

Accepted ADRs override older conflicting design descriptions.

### Unresolved decisions

`docs/OPEN_QUESTIONS.md` owns unresolved product, architecture, learning, data, and calibration decisions.

Load it only when the current task touches an unresolved area or an accepted answer cannot be found.

Do not invent an answer.

### Current execution

`docs/CHATGPT_PLAN.md` owns the current Run's scope, Slice order, Run-specific acceptance, gates, and non-goals.

It does not redefine canonical product or architecture truth.

### Current snapshot

`docs/DEV_STATUS.md` describes the durable current state of the project.

It is a snapshot, not a task queue, changelog, or product-decision record.

### Historical context

Git and `docs/RUNS/**` preserve execution history.

Historical documents are not default implementation context and must not override current accepted decisions.

### Temporary context

`scratch/**` is temporary and non-canonical.

Use it only for short-lived continuity or when the current task explicitly requires it.

## Scope discipline

Implement one focused change at a time.

Do not silently mix unrelated product, Learning Engine, database, authentication, API, or UI work.

Do not introduce deferred features merely because the architecture could support them.

If repository reality conflicts with the current Plan or accepted intent, surface the conflict instead of silently resolving it by assumption.

Useful future work that is real but outside the current scope belongs in `docs/FOLLOW_UP_BACKLOG.md`, not in the active task.

## Safety

Coding agents must not:

* push Git changes unless repository policy is explicitly changed by the human owner;
* deploy or publish automatically;
* link to or mutate hosted Supabase projects automatically;
* apply hosted database migrations automatically;
* use destructive Git or filesystem operations without explicit human approval;
* delete unknown files;
* expose, reproduce, request, or commit secrets.

Hosted database migration remains a human/manual action in the current UNLOCK workflow.

Prefer the smallest reversible change that satisfies the current task.

## Tool-specific instructions

For Claude Code-specific workflow, skills, reviewers, and scoped rules, use:

* `CLAUDE.md`
* `.claude/**`

For Cursor-specific projections, use:

* `.cursor/rules/**`

Tool-specific files may define how that tool works, but canonical repository truth remains in the shared repository sources described above.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

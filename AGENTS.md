# UNLOCK project instructions

Before doing substantial work in this repository:

1. Read `CLAUDE.md` for the repository-wide working rules.
2. Read `docs/DEV_STATUS.md` for the current development checkpoint.
3. Run:
   - `git status`
   - `git status -sb`
   - `git log --oneline -5`
4. Use `docs/CONTEXT_MAP.md` to locate additional documents relevant to the current task.

## Source of truth

Use, in this order:

1. committed code
2. accepted ADRs under `docs/DECISIONS/`
3. `docs/OPEN_QUESTIONS.md`
4. committed migrations under `supabase/migrations/`
5. relevant canonical product/API/design documentation

`docs/MASTER_SPEC.md` is important high-level product context, but it does not override committed code or accepted ADRs.

`docs/DEV_STATUS.md` describes the current development state. It is operational context, not a product decision record.

Content under `scratch/` is temporary and non-canonical. Do not use it as a source of truth unless the current task explicitly requires it.

## Scope discipline

Do not invent unresolved product, learning, authorization, or data behavior.

If a decision is unclear:

1. check the relevant ADR
2. check `docs/OPEN_QUESTIONS.md`
3. surface the gap instead of guessing

Implement one focused development slice at a time.

Do not silently mix unrelated product, learning-engine, database, auth, API, or UI changes.

## Git safety

Do not push unless explicitly instructed.

Do not use destructive git commands such as `git reset --hard` or `git clean -fd` without explicit approval.

Do not delete unknown untracked files.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
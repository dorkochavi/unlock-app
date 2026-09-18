---
name: checkpoint
description: Run UNLOCK's standard pre-commit / handoff verification (status, tests, typecheck, lint, diff) and report findings. Read-only — never stages, commits, pushes, or modifies code. Use before committing or handing off work.
---

# /checkpoint

Standard UNLOCK pre-commit / handoff verification. This skill is **read-only**:
it never stages, commits, pushes, modifies code, or auto-fixes failures.

## Steps

1. Run, in this order, capturing output:
   ```
   git status
   git log --oneline -5
   npm test
   npm run test:schema
   npm run typecheck
   npm run lint
   git diff --check
   git diff --stat
   ```

2. Verify:
   - No unexpected staged files.
   - None of the temporary report files are staged
     (`OVERNIGHT_REPORT.md`, `PERSISTENCE_IMPLEMENTATION_REPORT.md`,
     `QUESTION_MODEL_OVERNIGHT_REPORT.md`).
   - No Postgres/Supabase imports in `src/domain/` or `src/application/`
     (grep for `pg`, `@electric-sql/pglite`, `supabase`, `postgres` in those trees).
   - Current branch is known and reported.
   - Whether the branch is ahead/behind its remote tracking branch (`git status -sb`
     or `git rev-list --left-right --count origin/<branch>...HEAD`).
   - No failing checks among the commands above.

3. Report compactly, in this shape:
   - **Branch + HEAD**: branch name, short SHA, ahead/behind origin.
   - **Tests**: `npm test` pass/total, `npm run test:schema` pass/total.
   - **Typecheck / Lint**: clean or first error(s).
   - **Diff summary**: `git diff --stat` output, `git diff --check` result.
   - **Staged / unstaged / untracked**: short summary, flagging any of the three
     temporary report files or any unexpected file.
   - **Blockers before commit**: a short bullet list, or "none."

4. Do NOT stage, commit, push, modify code, or auto-fix any failure found.
   If the user wants a fix after seeing the report, wait for them to explicitly ask.

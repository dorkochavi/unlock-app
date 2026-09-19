# UNLOCK — Working Instructions for Claude Code

## 1. Start Every Session from the Repository

Do not rely on prior chat/session memory.

At the beginning of substantial work:

1. Read this file.
2. Read `docs/DEV_STATUS.md`.
3. Run:
   - `git status`
   - `git status -sb`
   - `git log --oneline -5`
4. Read only the ADRs, rules, docs, tests, and code relevant to the current task.

The committed repository is the source of truth.

## 2. Source of Truth

Use, in this order:

1. committed code
2. accepted ADRs under `docs/DECISIONS/`
3. `docs/OPEN_QUESTIONS.md`
4. committed migrations under `supabase/migrations/`
5. relevant API/design docs

`docs/DEV_STATUS.md` is the operational development-state summary.
It is not an ADR and must not override committed code or accepted decisions.

Content under `scratch/` is temporary, non-canonical development material.

Do not read, rely on, or commit files under `scratch/` unless the user explicitly asks for them or the current task specifically requires one.

`scratch/` must never override committed code, accepted ADRs, or canonical documentation.

## 3. Architecture Boundary

Dependency direction is one-way:

domain → application → infrastructure → runtime/API

Rules:

- `src/domain/` contains learning/domain logic.
- `src/application/` orchestrates use cases, ports, transactions, and explicit inputs.
- `src/infrastructure/` implements persistence, Supabase, PostgreSQL, schedulers, and external adapters.
- `src/app/` is the Next.js runtime/UI/API boundary.
- Domain/application code must not depend on Next.js, browser APIs, Supabase SDK, `pg`, or PGlite.
- Learning policy must not be duplicated inside API routes or UI code.
- Persistence constraints enforce data integrity, not learning policy.

Prefer explicit ports/repositories over generic abstractions.
Do not introduce a generic `Repository<T>` abstraction.

## 4. Product / Learning Invariants

Do not silently change accepted product behavior during unrelated work.

Important invariants:

- Attempts are immutable historical evidence.
- QuestionVersion snapshots are immutable historical evidence.
- Replay/rebuild uses persisted Attempt correctness and does not re-grade history.
- Learning Engine behavior should remain deterministic for the same persisted state, policy, and explicit time.
- Real-time learning-state/ranking logic does not depend on LLM calls.
- One DailyPlan exists per user per local calendar day.
- Global Today and Course Today are views of the same DailyPlan.
- Only active `LEARNER` memberships participate automatically in personal DailyPlan generation.
- Manual Practice is separate from Today.
- Client code must never supply authoritative `userId`.

For detailed rules, use the relevant files under `.claude/rules/`.

## 5. Authentication / Security

For authenticated server operations:

- trusted `userId` comes only from verified server-side authentication
- use `supabase.auth.getUser()` for trusted identity
- never trust client-supplied `userId`
- authenticate before constructing/using database runtime
- keep `DATABASE_URL` and service-role credentials server-only
- never expose raw errors, stack traces, SQL, connection strings, or credentials in API responses
- do not create permissive placeholder RLS policies
- do not use service-role credentials merely to bypass authorization

Do not disable Windows security features.

Do not connect/link/push to a remote Supabase project unless the user explicitly authorizes it.

## 6. Database / Migration Discipline

- Migrations are forward-only.
- Do not edit accepted historical migrations to implement new behavior.
- Use the existing PostgreSQL repository / UnitOfWork architecture.
- Do not rewrite persistence using Supabase JS unless explicitly requested.
- Do not create a new `pg.Pool` per request.
- Distinguish PGlite behavior from real PostgreSQL/Supabase behavior.
- Do not claim real multi-connection concurrency is tested unless it actually is.

Use `.claude/rules/postgres.md` for detailed database rules.

## 7. Scope Discipline

Implement one development slice at a time.

Do not mix unrelated changes such as:

- Auth work changing mastery semantics
- API work changing ranking weights
- UI work changing misconception logic
- infrastructure work changing Today product semantics

If you discover an unrelated issue:

1. report it
2. explain whether it blocks the current task
3. do not silently fix it unless explicitly instructed

If a product decision is unresolved, consult `docs/OPEN_QUESTIONS.md`.
Do not invent an answer.

## 8. Testing / Verification

Use targeted tests while developing.

Before commit/push/handoff, use the repository's checkpoint workflow:

`/checkpoint`

Do not claim behavior is verified beyond the environment actually used.

Distinguish:

- unit-tested
- PGlite integration-tested
- reviewed by inspection
- reasoned under PostgreSQL semantics
- real PostgreSQL tested
- real Supabase tested
- browser E2E tested

Use `.claude/rules/testing.md` for detailed testing rules.

## 9. Review Workflow

For commit review, use:

`/review-commit`

Use the appropriate reviewer agent only when relevant:

- `unlock-reviewer`
- `unlock-db-reviewer`
- `unlock-security-reviewer`

Reviewers are read-only.

Do not ask reviewers to justify the author's implementation.
They must inspect the actual code independently.

## 10. Git Safety

Never stage, commit, or push unless the current task explicitly requests it.

Never use destructive commands such as:

- `git reset --hard`
- `git clean -fd`

without explicit approval.

Do not delete or ignore unknown untracked files automatically.

Do not rewrite shared/pushed history casually.

Before push, verify the intended commits and worktree state.

`git push` and Supabase `link`/`db push` commands are additionally hard-blocked at the tool-permission level (`.claude/settings.json`). Pushes are always performed manually by the user outside Claude Code, consistent with `docs/DEV_STATUS.md`'s session protocol.

## 11. Session / Context Discipline

Prefer fresh context over carrying long session history.

After a major approved checkpoint or push:

- update `docs/DEV_STATUS.md`
- use `/clear`
- begin again from the repository state

Do not preserve old implementation assumptions merely because they appeared earlier in the conversation.

The repository, ADRs, rules, tests, and current DEV_STATUS are authoritative.
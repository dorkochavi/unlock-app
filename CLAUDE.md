# UNLOCK — Working Instructions for Claude Code

## 1. Source of Truth

Trust, in order: committed code, `docs/DECISIONS/` (ADRs), `docs/OPEN_QUESTIONS.md`,
`docs/API_V1_DRAFT.md` (where relevant), and committed migrations under
`supabase/migrations/`.

**NOT sources of truth** — temporary session audit trails, untracked and not meant
to be committed. Do not read unless the user explicitly asks:
`OVERNIGHT_REPORT.md`, `PERSISTENCE_IMPLEMENTATION_REPORT.md`,
`QUESTION_MODEL_OVERNIGHT_REPORT.md`.

## 2. Architecture

Dependency direction (one-way only):

```
domain → application → infrastructure → runtime/API
```

- No Postgres/Supabase imports in `src/domain/` or `src/application/`.
- Learning logic (mastery, scheduling, misconceptions, ranking) lives in `domain`.
- `application` orchestrates ports/transactions; no learning policy of its own.
- `infrastructure` implements ports (e.g. `src/infrastructure/postgres/`).
- SQL (FKs/CHECKs) enforces persistence integrity, never learning policy.

## 3. Current Major Decisions

- Next.js 16 + TypeScript, App Router.
- PostgreSQL via Supabase (ADR-013); modular monolith (ADR-001).
- Course does not require an Institution (ADR-006); cost-efficient by default (ADR-007).
- Hebrew/RTL product, English internals (ADR-002).
- FSRS-family memory scheduler behind a `MemoryScheduler` interface (ADR-008).
- Today is course-scoped in V1 (ADR-011).
- Attempts are immutable historical evidence (ADR-005); QuestionVersion is immutable (ADR-009).
- `submitAnswer` runs as one transaction with an advisory lock + idempotency
  key on `(user_id, submission_id)` (ADR-010).
- Replay/rebuild uses the persisted `Attempt.isCorrect` — never re-grades history (ADR-012).
- V1 question types: `SINGLE_CHOICE` + `MULTIPLE_CHOICE` only; `TRUE_FALSE` is a
  2-option `SINGLE_CHOICE`, not a distinct type; `selectedAnswer` semantics per ADR-014.
- Auth / RLS authorization model is still unresolved.

## 4. Current Blocker

**Open Question #1** (`docs/OPEN_QUESTIONS.md`) — the User↔Course authorization
model — blocks final Auth wiring, real RLS policies, and any implemented API route
(`docs/API_V1_DRAFT.md` is deliberately unimplemented pending this).

## 5. Workflow Rules

Before substantial work: `git status`, `git log --oneline -10`, read the relevant
ADR(s)/docs/code. Treat the committed repo as source of truth, not memory of past
sessions.

Before any commit: `npm test`, `npm run test:schema`, `npm run typecheck`,
`npm run lint`, `git diff --check`, `git status`, `git diff --stat`.

Never stage, commit, or push unless explicitly told to.

## 6. Security / Infra Rules

- Do not disable Windows security features.
- Do not use production credentials.
- Do not link or push to remote Supabase unless explicitly requested.
- Do not create permissive placeholder RLS policies.
- At the future API boundary, `userId` must come from the authenticated principal,
  never from client-supplied request data.

## 7. Scope Discipline

- Do not invent answers to unresolved product decisions — add/check
  `docs/OPEN_QUESTIONS.md` instead.
- If one path is blocked, continue other independent safe work rather than stalling.
- Prefer small, explicit ports/repositories over generic abstractions
  (no generic `Repository<T>`).

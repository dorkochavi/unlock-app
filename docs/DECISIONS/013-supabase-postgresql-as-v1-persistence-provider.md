# ADR-013: PostgreSQL + Supabase as the V1 Persistence Provider

Status: ACCEPTED

## Context

`docs/OPEN_QUESTIONS.md` #25 ("Supabase Final Confirmation") recorded
Supabase as only a *direction*, explicitly marked `Status: OPEN`, pending
"final confirmation... before database/auth implementation." The
persistence/application architecture (ADR-005/008/009/010/011/012,
`docs/PERSISTENCE_SCHEMA_V1.md`, `src/domain/learning/`,
`src/application/learning/`) was deliberately designed provider-independent
throughout — no committed code imports a Supabase or `pg` package anywhere.

We are now beginning the real database-foundation phase (first migration),
which requires an actual target database engine and provider to write SQL
against. This ADR records that confirmation as a real, durable decision
rather than leaving it implicit in a migration file's choice of dialect.

## Decision

### 1. PostgreSQL is the V1 database engine; Supabase is the managed provider

UNLOCK V1 uses PostgreSQL, hosted via Supabase, closing
`docs/OPEN_QUESTIONS.md` #25 for the *database* part of that question
specifically (Auth/RLS/storage confirmations are addressed narrowly below —
this ADR does not overstate them). Next.js remains the application/API
layer, unchanged (ADR-001).

### 2. Supabase is infrastructure — it must never leak into domain or application code

No Supabase-specific type or import may appear in `src/domain/` or
`src/application/`. Both layers already only depend on plain
TypeScript/domain types and the small, explicit ports defined in
`src/application/learning/ports.ts` (`AttemptRepository`,
`UserQuestionProgressRepository`, `TodaySessionRepository`, `UnitOfWork`,
etc.) — this decision does not require changing either layer, only
confirms the constraint going forward. A future Postgres/Supabase adapter
implementing those ports belongs under `src/infrastructure/postgres/` — see
the corrected "Alternatives Considered" entry below for why this ADR's
original text named `src/services/` instead, and why that was wrong — and
is explicitly the NEXT checkpoint, not part of this one.

### 3. Migrations are plain, reviewable PostgreSQL SQL under `supabase/migrations/`

Versioned local migrations live in `supabase/migrations/*.sql`
(Supabase-CLI-conventional layout), each one plain PostgreSQL DDL —
readable and reviewable without any Supabase-specific tooling required to
understand it. `supabase/config.toml` describes local project/port
configuration only; it is not itself part of the domain/application
contract.

### 4. Auth and RLS: minimal compatible foundation now, real policies later

Supabase Auth and Row Level Security are **not** implemented in this phase.
The only foundation laid now: `users.id` is conceptually intended to equal
`auth.users.id` once Supabase Auth is wired (documented on the `users`
table in the initial migration and in `docs/PERSISTENCE_SCHEMA_V1.md`), but
no FK to `auth.users` exists yet, and `users.id` has no default value — an
explicit id must always be supplied. This avoids silently implying an
identity model that hasn't actually been decided.

RLS is enabled on every V1 table (`ALTER TABLE ... ENABLE ROW LEVEL
SECURITY`) with **zero policies** — this is a safe default posture, not a
policy decision: PostgREST (Supabase's auto-generated REST API) exposes
every public-schema table to `anon`/`authenticated` callers by default, and
enabling RLS with no policies makes every table deny-by-default for those
two roles specifically (`anon`/`authenticated` have neither superuser nor
`BYPASSRLS`, and are not table owners). This is not the same claim as "only
`service_role` bypasses RLS" — PostgreSQL superusers, any role granted the
`BYPASSRLS` attribute, and (absent `FORCE ROW LEVEL SECURITY`, not set here)
a table's own owner all bypass RLS independently of policies. In Supabase,
`service_role` is simply the specific `BYPASSRLS`-attributed role the
platform provides for trusted server-side access — it must remain
server-side-only because of that elevated attribute, not because RLS
singles it out by name. This distinction does not change V1's actual
security posture (PostgREST's `anon`/`authenticated` callers remain
genuinely deny-by-default on every table today); it only states PostgreSQL's
RLS bypass rules accurately rather than overstating them as a single
service-role special case. Writing permissive "allow all authenticated
users" policies now, before `docs/OPEN_QUESTIONS.md` #1 (User↔Course
relationship/authorization model) is resolved, would silently lock in a
model nobody has actually decided — explicitly rejected, per this task's own
instruction not to do that.

## Consequences

- `docs/OPEN_QUESTIONS.md` #25 is resolved for the database-engine/provider
  question; Auth/RLS/storage confirmations remain open and are not
  overstated by this ADR.
- Domain/application code remains fully portable: swapping the Postgres
  provider (or testing against a different Postgres-compatible engine)
  requires only a new adapter implementing the existing ports, never a
  change to `src/domain/` or `src/application/`.
- Every V1 table is inaccessible via Supabase's auto-generated REST API
  until real RLS policies are written — a deliberate, safe starting
  posture, not a temporary placeholder that could be mistaken for "working
  auth."
- The first real migration (`supabase/migrations/20260917203000_initial_schema.sql`)
  can now be written against a concrete, named engine/provider, rather than
  against a still-open direction.

## Alternatives Considered

### Defer this confirmation further, write the migration against "PostgreSQL, provider TBD"

Rejected. The migration must target a real SQL dialect and later a real
managed provider's conventions (Supabase CLI's `supabase/migrations/`
layout, `auth.users`, PostgREST's RLS-driven exposure model) to be useful
at all; deferring the provider confirmation while writing provider-shaped
files would be an implicit decision dressed as an open one.

### Write permissive RLS policies now so the schema "works" end-to-end sooner

Rejected explicitly. `docs/OPEN_QUESTIONS.md` #1 (User↔Course
authorization model) is not resolved; a permissive policy today would have
to be walked back once that model exists, and in the meantime would expose
V1 tables through Supabase's public REST API with no real authorization
check — the exact outcome RLS exists to prevent.

### `src/infrastructure/` as the future adapter location

**This entry was WRONG and is corrected here, not deleted, so the mistake
stays on the record.** The original text rejected `src/infrastructure/` in
favor of `src/services/` (`docs/ARCHITECTURE.md` §29), reasoning that
`src/infrastructure/` would be "a second, competing convention for the same
concept" — without first checking whether either convention was already in
use in the actual codebase. It was already in use: `src/infrastructure/
learning/fsrs/` (`ts-fsrs-memory-scheduler.ts`, `ts-fsrs-mapper.ts`) is the
committed, tested adapter wrapping the ts-fsrs library behind UNLOCK's
`MemoryScheduler` domain interface (ADR-008), and predates this ADR.
`src/services/` has no adapter code in it at all. Naming `src/services/` as
"already-established" for this purpose was therefore backwards: this ADR
would have been the one introducing a second, competing convention, by
picking the location with zero precedent over the one already in real use
for exactly this kind of "external library behind a project-owned
interface" boundary (the same pattern ADR-008 already established for the
scheduler, cited by this ADR's own "Related Documents" section below).
**Corrected decision**: a future Postgres/Supabase adapter belongs under
`src/infrastructure/postgres/`, matching the existing `src/infrastructure/
learning/fsrs/` precedent. `src/services/` remains available per
`docs/ARCHITECTURE.md` §29 for infrastructure boundaries that are not
"an adapter implementing an existing domain/application port" in this same
sense (e.g. a future AI provider or notification service) — this correction
does not deprecate `src/services/` itself, only this ADR's earlier claim
that it was already the established location for port-implementing
adapters specifically.

## Related Documents

- `docs/OPEN_QUESTIONS.md` (#1, #25)
- `docs/ARCHITECTURE.md` (§19 Provider Boundaries, §20 Database Access, §29 Services)
- `docs/PERSISTENCE_SCHEMA_V1.md`
- `docs/DECISIONS/008-fsrs-memory-scheduler.md` (the same "external
  library/provider sits behind a project-owned boundary" pattern, applied
  there to the scheduler instead of persistence)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`
- `supabase/migrations/20260917203000_initial_schema.sql`
- `supabase/config.toml`

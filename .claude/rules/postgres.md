# UNLOCK — PostgreSQL & Migration Rule

Status: ACTIVE
Owner: PostgreSQL implementation policy

Use for migrations, PostgreSQL repositories, transaction infrastructure, and DB-sensitive persistence changes.

## Canonical Sources
- committed migrations are schema truth;
- `docs/DATABASE.md` / `PERSISTENCE_SCHEMA_V1.md` are companion references;
- relevant ADRs own durable decisions.

## Migrations
- forward-only; do not rewrite accepted historical migrations for new behavior;
- use timestamped additive migrations where practical;
- consider existing rows, nullability, defaults/backfills, FK/delete semantics, indexes, constraints;
- do not introduce unrelated schema cleanup in a feature migration.

## Repositories / Mapping
- keep SQL/PostgreSQL details behind infrastructure repositories;
- map DB types/nullability explicitly;
- preserve historical identifiers/version references;
- avoid product-policy decisions hidden only in SQL.

## Transactions
Multi-write atomic use cases must use one transaction-bound connection:
- `BEGIN`;
- construct transaction-scoped repositories;
- execute application work;
- `COMMIT` on success;
- `ROLLBACK` on failure;
- release connection;
- rollback/release failures must not mask the original application error.

Keep domain-specific Unit-of-Work contracts narrow. Do not merge them into a global UoW solely to reduce boilerplate.

## Concurrency / Locks
Reason explicitly when concurrent writes can violate invariants.
Use DB constraints as integrity protection, but distinguish integrity from user-friendly concurrency behavior.
Do not claim PGlite proves true multi-connection concurrency when it does not.

## Delete / Archive
Respect current archive-vs-delete semantics. Do not turn archival models into destructive deletion without an accepted decision.

## Supabase / Hosted Safety
Claude may write/verify migrations locally but must not:
- `supabase link`;
- `supabase db push`;
- apply hosted migrations or mutate hosted state autonomously.

## RLS
Current UNLOCK authorization baseline is explicit server-side auth/authorization.
Do not invent/add RLS during unrelated work. If a future accepted design introduces RLS, implement/test that policy explicitly.

## Verification
Follow `.claude/rules/testing.md` for selection/freshness.
Use schema/PGlite/real PostgreSQL evidence proportional to the claim and state environment limits honestly.

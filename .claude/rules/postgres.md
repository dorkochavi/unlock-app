---

paths:

* "src/infrastructure/postgres/**"
* "supabase/migrations/**"
* "supabase/tests/postgres/**"
* "supabase/tests/schema.integration.test.ts"

---

# UNLOCK — PostgreSQL & Persistence Rule

Status: ACTIVE
Purpose: define PostgreSQL, migration, repository, transaction, and persistence guardrails for UNLOCK.

This rule owns persistence implementation constraints.

It does not own:

* product semantics;
* testing philosophy;
* operational verification selection;
* reviewer selection;
* checkpoint policy;
* Git workflow.

Use the dedicated owner for those responsibilities.

---

## 1. Repository Boundaries

Keep PostgreSQL persistence behind existing application/repository boundaries.

Do not:

* call SQL directly from UI code;
* bypass application/domain rules from API routes;
* move product policy into repository classes;
* rewrite persistence through Supabase JS unless explicitly required;
* replace existing repository/Unit-of-Work boundaries without a concrete need.

Prefer the existing `SqlExecutor` pattern where applicable.

Infrastructure implements persistence.

It does not redefine domain behavior.

---

## 2. Transactions

Use an explicit transaction when multiple persistence operations must succeed or fail atomically.

Rules:

* transaction ownership belongs in infrastructure/Unit of Work;
* use one transaction-bound connection for all participating repositories;
* do not mix transaction-bound and pool-level executors inside one logical atomic operation;
* commit only after successful completion;
* rollback on failure;
* preserve the original failure if rollback also fails;
* always release acquired connections.

Do not introduce a global mega-Unit-of-Work merely to reduce boilerplate.

Scoped atomic boundaries should remain explicit.

---

## 3. Pool and Connection Handling

Use the existing shared/lazy `pg.Pool` runtime foundation.

Do not:

* create a new Pool per request;
* leak connections;
* expose `DATABASE_URL`;
* hardcode insecure TLS such as `rejectUnauthorized: false`;
* introduce environment-specific connection behavior without explicit justification.

Distinguish:

```text
Pool construction
≠
connection acquisition
≠
query execution
```

For protected routes, authentication should occur before protected DB work when the route contract allows early rejection.

---

## 4. PostgreSQL Type Semantics

Be deliberate with PostgreSQL/driver representations such as:

* `date`;
* timestamp types;
* UUID;
* JSON/JSONB;
* numeric;
* arrays;
* nullable columns.

Do not rely on accidental machine timezone behavior.

PGlite and real `node-postgres` may differ in serialization/decoding edge cases.

When a mapping depends on driver-specific behavior, inspect the actual runtime contract.

---

## 5. Migrations

Migrations are forward-only.

Never edit an accepted historical migration to introduce new behavior.

For new schema behavior:

* add a new timestamped migration;
* preserve chronological ordering;
* prefer additive evolution;
* avoid destructive changes unless explicitly required and reviewed.

Do not silently:

* backfill hosted data;
* invent defaults merely to make a migration pass;
* reinterpret earlier schema intent.

When changing a populated table, consider:

* existing-row validity;
* lock implications;
* backfill requirements;
* nullability transitions;
* foreign-key compatibility;
* cascade/delete behavior.

Committed migrations are the physical schema authority.

---

## 6. Constraints

Use database constraints for invariants that must hold regardless of application path.

Relevant tools include:

* primary keys;
* unique constraints;
* foreign keys;
* composite foreign keys;
* CHECK constraints;
* nullability constraints.

Use composite identity constraints where cross-entity consistency materially matters.

Do not encode adaptive/product policy in schema constraints.

Examples of policy that should remain outside schema constraints:

* mastery calibration;
* misconception thresholds;
* ranking weights;
* exam-urgency formulas.

Do not weaken integrity constraints merely to simplify implementation.

---

## 7. Historical Evidence Integrity

Persistence must preserve immutable learning history.

Protect invariants such as:

* Attempt is historical evidence;
* QuestionVersion is immutable;
* Attempt remains linked to the exact QuestionVersion presented;
* derived learner state may evolve without rewriting raw evidence.

Do not mutate Attempts as a shortcut.

Do not make historical interpretation depend on current Question content.

---

## 8. DailyPlan Persistence

`DailyPlan` / `DailyPlanItem` are the primary current Today persistence model.

Protect accepted invariants such as:

* one DailyPlan per learner and learner-local planned date;
* each DailyPlanItem belongs to one DailyPlan;
* Course / Question / QuestionVersion identity remains internally consistent;
* item ordering remains stable;
* state and timestamps remain coherent;
* resolved items do not silently reopen;
* Skip remains distinct from answered/completed state;
* New Material placement does not fabricate learner evidence;
* DailyPlan answer linkage remains compatible with accepted legacy TodaySession constraints where both paths coexist.

Do not redefine DailyPlan product semantics in SQL.

Use ADR-016/017 and committed schema as authority.

---

## 9. Legacy TodaySession Compatibility

Legacy `TodaySession` / `TodaySessionItem` persistence may remain where still intentionally supported.

Do not:

* treat it as the primary current Today model;
* remove it solely for terminology cleanup;
* let legacy linkage create contradictory DailyPlan/Attempt state.

Only touch legacy persistence when the active Slice actually requires it.

---

## 10. Concurrency

Be precise about concurrency guarantees.

Identify the actual mechanism:

* unique constraint;
* `ON CONFLICT`;
* row lock;
* advisory lock;
* transaction isolation;
* other PostgreSQL primitive.

Do not rely on timing assumptions when a constraint/lock should provide correctness.

Do not silently change isolation level.

Distinguish:

```text
tested empirically
```

from:

```text
reasoned from PostgreSQL semantics
```

PGlite does not prove true multi-backend concurrency.

---

## 11. Idempotency

When persistence supports idempotent actions, protect the database boundary that makes retries safe.

For answer submission and similar flows, ensure:

* duplicate logical submission does not create duplicate immutable evidence;
* conflict handling validates canonical command identity where required;
* a reused idempotency key with different logical content is rejected;
* legitimate distinct submissions remain distinct.

Do not collapse real repeated learner activity into one record.

---

## 12. Supabase-Managed Schemas

Hosted Supabase owns managed infrastructure such as:

* `auth`;
* `auth.users`;
* GoTrue lifecycle behavior.

Application migrations may reference managed objects when appropriate.

Do not recreate the real managed Auth schema in production migrations.

Test-only stand-ins must remain clearly test infrastructure.

Do not treat a PGlite `auth.users` stand-in as proof of hosted Supabase Auth behavior.

---

## 13. Auth User Provisioning

When provisioning logic is involved, preserve:

* authenticated UUID continuity;
* narrow trigger/function responsibility;
* safe handling of untrusted metadata;
* explicit timezone/default behavior;
* clear distinction between existing-user backfill and future insert behavior.

Do not broaden provisioning semantics outside explicit scope.

---

## 14. SECURITY DEFINER

When creating or changing `SECURITY DEFINER` functions:

* keep responsibility narrow;
* inspect `search_path`;
* prefer schema-qualified object references;
* avoid unnecessary dynamic SQL;
* understand ownership/privilege assumptions;
* understand RLS-bypass implications;
* verify trigger/direct-call behavior as appropriate.

Do not copy a common Supabase pattern without evaluating its actual privilege model.

---

## 15. Triggers

When trigger behavior changes, inspect:

* BEFORE vs AFTER;
* event type;
* row vs statement level;
* `NEW` / `OLD` usage;
* recursion risk;
* conflict behavior;
* retry behavior;
* side effects when target state already exists.

Trigger behavior must remain deterministic and aligned with accepted lifecycle semantics.

---

## 16. RLS Boundary

Do not automatically introduce or broaden RLS policies.

Current V1 uses trusted server-side authorization plus existing database controls.

When RLS is explicitly in scope:

* preserve least privilege;
* align policy behavior with accepted authorization semantics;
* distinguish direct PostgreSQL access from Supabase client access;
* distinguish local evidence from hosted role behavior.

RLS policy design requires explicit scope.

---

## 17. PGlite Evidence Boundary

PGlite can provide meaningful PostgreSQL-compatible evidence for:

* migration application;
* SQL syntax;
* constraints;
* repository behavior;
* supported transaction behavior.

It does not automatically prove:

* hosted Supabase Auth;
* production network behavior;
* pooling;
* every extension;
* true multi-backend concurrency;
* hosted role/RLS behavior;
* every `node-postgres` decoding edge case.

Use precise evidence language.

Operational verification selection belongs to:

`.claude/rules/testing.md`

---

## 18. Test Harness Guardrail

When schema/PostgreSQL integration tests are relevant:

* prefer applying real committed migration files in filename order;
* exercise real repository SQL where practical;
* exercise actual constraints;
* test rollback where atomic behavior matters.

Do not test paraphrased migration SQL when the real migration can be applied.

Test-only setup may prepare managed-Supabase prerequisites.

Do not let test infrastructure redefine production schema semantics.

---

## 19. Scope Discipline

Database work must not silently change:

* mastery policy;
* misconception policy;
* NBA ranking/calibration;
* CourseMembership semantics;
* Today composition;
* New Material product rules;
* unresolved exam-date policy.

If persistence work exposes a genuine unresolved product/architecture/security decision, report:

```text
PLAN_CONFLICT
- assumption
- repository/schema reality
- why the conflict matters
- decision required
```

Do not invent the answer in SQL.

---

## 20. Verification Ownership

This rule does not decide which commands must run for the current Slice.

Use:

`.claude/rules/testing.md`

for:

* targeted verification selection;
* `test:schema` necessity;
* typecheck/lint/build selection;
* evidence freshness;
* invalidation;
* escalation.

This rule only defines what persistence behavior must remain correct.

---

## 21. Core Principle

> Keep persistence explicit, transactional where needed, and aligned with accepted domain semantics.

> Use PostgreSQL constraints for true data invariants.

> Preserve immutable evidence.

> Be exact about concurrency and evidence boundaries.

> Do not let infrastructure invent product policy.

---

paths:

* "src/app/api/**"
* "docs/API_V1_DRAFT.md"

---

# UNLOCK — API Boundary Rule

Status: ACTIVE
Purpose: define Next.js API/HTTP boundary guardrails for UNLOCK.

This rule owns:

* request parsing;
* boundary validation;
* trusted identity propagation;
* route composition;
* application delegation;
* DTO mapping;
* HTTP response/error contracts.

It does not own:

* authentication policy;
* authorization policy;
* PostgreSQL implementation;
* product/domain behavior;
* testing policy;
* reviewer selection;
* Git workflow.

Use the dedicated owner for those responsibilities.

---

## 1. Keep Routes Thin

Route handlers should normally:

1. read the HTTP boundary;
2. establish trusted caller identity where required;
3. validate request inputs;
4. derive authoritative server-owned values;
5. construct/request application dependencies;
6. invoke an application use case;
7. map the result to a stable HTTP response.

Do not place domain or Learning Engine rules directly in route files.

---

## 2. Trusted Identity

For authenticated routes, trusted identity comes from the server-side auth boundary.

Do not accept authoritative `userId` from:

* query parameters;
* request bodies;
* path parameters;
* custom headers;
* browser state;
* client metadata.

Detailed authentication rules live in:

`.claude/rules/auth.md`

The API layer should receive/propagate trusted identity, not redefine auth policy.

---

## 3. Authentication Before Protected Runtime Construction

For protected routes, reject unauthenticated callers before constructing protected database/application dependencies when the flow allows early rejection.

Preferred shape:

```text id="fph5mf"
create request-scoped auth client
→ resolve trusted user
→ reject if unauthenticated
→ construct protected runtime/application dependencies
→ authorize
→ execute
```

Do not make an unauthenticated request require protected DB configuration merely to return `401`.

---

## 4. Authorization Boundary

Authentication does not grant resource access automatically.

Routes should delegate accepted authorization behavior to the appropriate application/domain layer.

Before protected mutation:

* establish trusted user identity;
* resolve authoritative resource state;
* enforce the accepted authorization rule;
* fail closed where required.

Do not invent unresolved role or ownership semantics inside the route.

If behavior requires a new decision, report `PLAN_CONFLICT`.

---

## 5. Runtime

Routes using `pg`/PostgreSQL infrastructure must use:

```ts id="za1ezg"
export const runtime = "nodejs";
```

Do not move PostgreSQL-backed routes to Edge runtime.

Use existing runtime/composition infrastructure.

Do not create a new `pg.Pool` inside a request handler.

Detailed persistence rules live in:

`.claude/rules/postgres.md`

---

## 6. Composition

Prefer existing production composition roots/factories.

Routes should not manually reconstruct:

* repositories;
* Unit-of-Work behavior;
* Learning Engine policy;
* DailyPlan policy;
* engine versions;
* transaction semantics;

when an established composition path already owns them.

The route composes dependencies.

It does not become a second application layer.

---

## 7. Time at the Boundary

When an operation depends on "now", create the relevant request time once at the trusted boundary where appropriate.

Example:

```ts id="vrch77"
const now = new Date();
```

Pass that value downward.

Avoid multiple hidden `new Date()` / `Date.now()` calls across one deterministic application flow when they could create inconsistent behavior.

Do not force boundary-created time when the accepted application/domain contract owns time differently.

---

## 8. Request Validation

Treat all request input as untrusted.

Validate:

* required fields;
* supported value shapes;
* identifiers;
* optional/null semantics;
* query/path/body boundaries.

Use runtime validation where the input contract warrants it.

TypeScript types alone do not validate network input.

Do not add client inputs for values already owned authoritatively by server/application state.

---

## 9. Server-Owned Values

Where the server can derive a value from trusted persisted state, do not move that authority to the client.

Examples:

* authenticated user;
* learner timezone;
* learner-local date;
* Course eligibility;
* resource ownership;
* DailyPlanItem Course/Question/QuestionVersion identity.

A client may provide a resource selector.

It must not redefine trusted state.

---

## 10. GET Request Discipline

Do not read a request body from GET routes unless an explicit API contract genuinely requires it.

Prefer:

* path parameters;
* query parameters;

for client-controlled GET inputs.

Do not introduce parameters simply because they are technically possible.

---

## 11. Application Delegation

Routes should call application use cases.

Do not duplicate in the route:

* learner-state updates;
* DailyPlan generation;
* ranking;
* membership semantics;
* transaction coordination;
* persistence mutation logic.

The route is an HTTP adapter.

Application/domain layers own behavior.

---

## 12. DTO Mapping

Do not automatically expose raw application/domain/database objects.

Use explicit client-facing mapping when the underlying object contains:

* internal IDs not needed by the UI;
* persistence-only metadata;
* `Date` objects;
* redundant parent identifiers;
* server-only state;
* grading-only content;
* implementation details.

DTO rules:

* expose only needed fields;
* serialize dates explicitly;
* preserve meaningful `null`;
* do not invent fields;
* do not casually rename domain concepts;
* do not leak correct-answer/grading data before allowed.

---

## 13. Stable Error Contracts

Expected client-visible failures should map to stable machine-readable outcomes.

Example:

```json id="pqu498"
{
  "error": {
    "code": "INTERNAL_ERROR"
  }
}
```

Unexpected internal failures must not expose:

* raw exception text;
* stack traces;
* SQL;
* PostgreSQL driver errors;
* connection strings;
* credentials;
* Supabase tokens/keys;
* filesystem paths;
* environment values.

Keep client contracts stable even when internal implementation changes.

---

## 14. Error Boundary Placement

Failures can occur before the application use case runs.

Route-level handling should account for relevant failures from:

* server auth-client construction;
* authentication helpers;
* runtime configuration;
* dependency composition;
* `getPool()`/infrastructure setup;
* application invocation.

Do not assume a `try/catch` around only the final use-case call protects earlier boundary failures.

---

## 15. Logging

For current V1, server-side `console.error` is acceptable when no structured logger exists.

Rules:

* keep useful internal failure detail server-side;
* return controlled client errors;
* never log credentials/tokens/cookies;
* avoid repeatedly logging the same exception at many layers when practical.

Logging does not replace error handling.

---

## 16. DailyPlan Today Route

Current route:

```text id="shmlwg"
GET /api/daily-plan/today
```

Protect accepted behavior:

* no client-authoritative `userId`;
* no client-authoritative `courseId`;
* no client-authoritative planned date;
* authenticated user comes from trusted server auth;
* learner-local date comes from persisted timezone through application behavior;
* eligible Courses are resolved by application logic;
* Node runtime is used.

Current response mapping includes:

* `READY` → `200`;
* `UNAUTHENTICATED` → `401`;
* `TIMEZONE_NOT_SET` → `422`;
* authenticated missing public User/provisioning inconsistency → controlled server error;
* unexpected failure → generic internal error.

Do not silently reinterpret an Auth/public-user provisioning inconsistency as a normal resource `404` unless accepted behavior changes.

---

## 17. DailyPlan Item Answer

For Today item answer routes:

* authenticated identity is authoritative;
* item ownership is resolved server-side;
* Course/Question/QuestionVersion identity comes from the persisted item;
* client input must not override that identity;
* answer submission must flow through the accepted application transaction;
* idempotency semantics must remain intact;
* grading-only information must not be exposed before submission.

Do not implement a separate route-local learner-progress update path.

---

## 18. DailyPlan Item Skip

For Skip routes:

* authenticated identity is authoritative;
* ownership is derived server-side;
* not-owned resources fail closed;
* Skip resolves the item according to accepted DailyPlan semantics;
* Skip does not become an incorrect Attempt;
* already-resolved state maps to a controlled outcome.

Do not create replacement Today work in the route.

---

## 19. Manual Practice Separation

Manual Practice and DailyPlan execution are separate product paths.

Do not let API wiring cause Manual Practice to:

* resolve a DailyPlanItem;
* inherit DailyPlan ownership incorrectly;
* pretend to be Today evidence.

Shared answer-submission logic may be reused where accepted.

The route must preserve the distinction.

---

## 20. Safe Resource Errors

Where ownership-sensitive lookup is involved, avoid leaking whether another user's private resource exists.

Use fail-closed outcomes when accepted behavior requires them.

Example:

```text id="mtl66a"
not found
and
not owned
```

may intentionally map to the same client-visible result.

Do not leak private existence through error detail.

---

## 21. Redirects

When API/auth flows accept a redirect/return path:

* prefer application-local targets;
* reject arbitrary external URLs unless explicitly required;
* reject scheme-relative external targets;
* validate encoded input safely.

Detailed auth/redirect trust rules live in:

`.claude/rules/auth.md`

---

## 22. Draft API Documentation

`docs/API_V1_DRAFT.md` is API-boundary documentation, not stronger authority than implemented accepted behavior.

When API behavior materially changes:

* update relevant API documentation;
* distinguish draft from implemented behavior;
* document important status/error mappings;
* document trusted identity sources where relevant.

Do not let draft API text override accepted ADRs or current implementation truth.

---

## 23. Scope Discipline

API work must not silently change:

* mastery semantics;
* misconception semantics;
* ranking/calibration;
* DailyPlan sizing/composition;
* New Material policy;
* CourseMembership role semantics;
* database schema;
* unresolved exam-date behavior.

If the route cannot be implemented without a new product/architecture/security decision:

report:

```text id="kg1m8n"
PLAN_CONFLICT
- assumption
- repository reality
- why it matters
- decision required
```

Do not invent the decision in the HTTP layer.

---

## 24. Verification Ownership

This rule does not define which route tests, builds, or E2E checks must run.

Use:

`.claude/rules/testing.md`

for:

* route/API verification selection;
* auth-before-DB regression evidence;
* evidence freshness;
* browser escalation;
* hosted/real-environment verification decisions.

Do not confuse mocked route evidence with hosted Supabase/browser evidence.

---

## 25. Review Relationship

Material API changes receive risk-based review through:

`/review-commit`

General/security reviewers inspect the relevant cross-layer/trust risks.

This rule defines implementation guardrails only.

---

## 26. Core Principle

> Keep HTTP routes thin.

> Trust server-derived identity and ownership.

> Validate untrusted input at the boundary.

> Delegate behavior to application/domain code.

> Return stable, minimal, non-sensitive responses.

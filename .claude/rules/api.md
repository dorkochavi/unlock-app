---
paths:
  - "src/app/api/**"
  - "docs/API_V1_DRAFT.md"
---

# UNLOCK — API Route Rules

These rules apply whenever working on Next.js API Route Handlers or API-boundary documentation.

This file defines API implementation constraints.

It does NOT define the current task or execution queue.

Current work comes from `docs/CHATGPT_PLAN.md`.

---

## Route Responsibility

Route files should remain thin.

A route should normally be responsible for:

- reading the HTTP request boundary
- constructing request-scoped infrastructure
- authenticating the caller
- validating route/request inputs
- mapping trusted request data into an application command
- invoking application logic
- mapping application outcomes into stable HTTP responses

Do not place learning/domain rules directly inside route files.

---

## Authentication

For authenticated routes:

1. create the request-scoped Supabase server client
2. resolve the authenticated user using `requireAuthenticatedUser`
3. return immediately if unauthenticated
4. only then construct PostgreSQL/runtime dependencies
5. invoke authorized application logic

The only trusted `userId` source is authenticated server-side identity.

Never accept authoritative `userId` from:

- query parameters
- request body
- custom headers
- URL path values
- manually parsed cookies
- client metadata

---

## Auth Before Database

Authentication must happen before PostgreSQL runtime construction for authenticated routes.

An unauthenticated request must not unnecessarily:

- call `getPool()`
- require `DATABASE_URL`
- construct database repositories
- construct DailyPlan runtime ports
- invoke application persistence

This ordering is security-relevant.

Protect it with a regression test when the route wiring makes the ordering meaningful.

---

## Authorization

Authentication does not replace authorization.

After identity is established:

- resolve the relevant resource
- enforce the accepted ownership/membership rule
- fail closed when authorization policy requires it
- do not invent unresolved role semantics

Authorization must happen before protected mutation.

If required authorization semantics are unresolved and cannot be safely derived from an accepted ADR/product rule:

report `PLAN_CONFLICT`.

---

## Runtime

Routes using `pg` must use:

`export const runtime = "nodejs";`

Do not switch such routes to Edge runtime.

Use the existing runtime foundation:

- `getPool()`
- `PgConnectionProvider`
- production composition factories

Do not create a new `Pool` inside a request handler.

---

## Time

Create request time exactly once at the HTTP boundary when the operation depends on "now".

Preferred shape:

`const now = new Date();`

Pass the exact same value downward.

Do not introduce hidden `Date.now()` or `new Date()` calls deeper in the same deterministic application flow unless explicitly required.

---

## Dependency Construction

Prefer existing composition roots.

Do not manually recreate repositories or policy settings in a route when a production composition function already exists.

Routes must not duplicate:

- learning policy
- TodayPlanner policy
- engine version policy
- repository construction logic
- transaction logic

---

## DTOs

Do not automatically return raw domain/application objects.

Use explicit route-layer DTO mapping when objects contain:

- internal identity fields
- Date objects
- persistence-only fields
- redundant parent IDs
- implementation details not needed by the UI
- grading-only information

DTO rules:

- expose only required client-facing fields
- convert Date values explicitly to ISO strings
- preserve null intentionally
- do not invent fields
- do not rename domain concepts casually
- do not leak correct-answer/grading data before product policy allows it

---

## Stable Error Contracts

Expected client-visible failures must use stable machine-readable error codes.

Do not return raw exception text.

Unexpected failures should map to a generic response such as:

```json
{
  "error": {
    "code": "INTERNAL_ERROR"
  }
}
```

Do not expose:

- stack traces
- SQL
- connection strings
- Supabase credentials
- PostgreSQL driver details
- internal filesystem paths
- raw SDK messages
- secret environment values

---

## DailyPlan Today Route

Current route:

`GET /api/daily-plan/today`

Accepted semantics:

- no client-supplied `userId`
- no client-supplied `courseId`
- no client-supplied planned date
- user comes from verified Supabase Auth
- local date is derived by the application from persisted user timezone
- eligible Courses are discovered by the application
- route uses Node runtime

Current HTTP mapping includes:

- `READY` → `200`
- `UNAUTHENTICATED` → `401`
- `TIMEZONE_NOT_SET` → `422`
- `USER_NOT_FOUND` → `500` with `USER_PROVISIONING_INCONSISTENT`
- unexpected failure → `500` with `INTERNAL_ERROR`

Do not treat authenticated `USER_NOT_FOUND` as an ordinary 404 when the accepted provisioning model requires Auth users to exist in `public.users`.

If runtime behavior intentionally changes this contract, update the relevant API documentation and accepted decision/state rather than leaving conflicting sources.

---

## DailyPlan Item Mutations

For Today item answer/Skip routes:

- authenticated identity is authoritative
- item ownership is derived server-side
- Course/Question/QuestionVersion identity is not trusted from client input
- resolved-state conflicts must produce controlled behavior
- retry/idempotency behavior must preserve immutable Attempt semantics
- Skip must not be converted into incorrect-answer evidence
- Manual Practice behavior must remain separate from DailyPlan resolution

Do not expose learner-inaccessible grading information before submission.

---

## Request Inputs

For GET routes, do not read a request body unless API design explicitly requires it.

Do not introduce client parameters merely because a value could theoretically be configurable.

When server/application state already owns:

- user identity
- timezone
- local date
- Course eligibility
- resource ownership

do not move that authority to the client.

---

## Error Boundary Placement

Infrastructure failures may occur before application logic.

Route-level handling must account for relevant failures from:

- Supabase client construction
- authentication helpers
- environment validation
- `getPool()`
- infrastructure composition
- application invocation

Do not assume an application-level `try/catch` protects code that executes before the application handler is called.

---

## Logging

For V1, `console.error` is acceptable for unexpected server-side failures when no structured logging system exists.

Rules:

- log internally
- return a stable generic client error
- never include secrets in client-visible responses
- do not log credentials
- avoid duplicate logging at several layers for the same exception when practical

---

## Testability

Important route behavior should be testable without real external network dependencies.

Prefer small injected seams for:

- authentication outcome
- database/runtime construction
- application invocation
- explicit time

Do not create a large custom framework merely to unit-test a route.

A real route-wiring test is especially valuable for behavior such as:

- authentication before DB construction
- authorization before mutation
- validation before persistence
- safe redirect handling

---

## Verification Levels

Do not confuse local tests with hosted verification.

Distinguish:

- unit-tested
- route-wiring tested
- PGlite integration-tested
- real Supabase tested
- browser E2E tested
- deployed environment tested

Hosted/manual verification should be performed when the current `CHATGPT_PLAN.md` requires it or when the behavior genuinely depends on the real environment.

Examples include:

- real Auth cookie/session roundtrip
- `auth.getUser()` against hosted Supabase
- signup provisioning into `public.users`
- hosted `DATABASE_URL`
- real PostgreSQL persistence
- browser navigation/login redirect behavior

Do not claim these are verified from mocks or PGlite.

---

## Documentation

When an API contract materially changes:

- update relevant API documentation
- distinguish implemented behavior from draft behavior
- document important HTTP outcome mappings
- document trusted identity sources where relevant
- document real-environment verification status honestly

Do not let API documentation claim behavior that actual route ordering/runtime does not guarantee.

---

## Scope Discipline

API work must not silently change:

- mastery semantics
- misconception semantics
- ranking weights
- DailyPlan sizing/calibration
- CourseMembership role semantics
- unrelated database schema
- Today/New Material product behavior

If such a change is genuinely required to satisfy the current Slice:

- determine whether accepted intent already defines the answer
- adapt minimally when safe
- otherwise report `PLAN_CONFLICT`

Do not opportunistically create another Slice or product decision yourself.

---

## Git Safety

Follow repository-wide Git safety rules in `CLAUDE.md`.

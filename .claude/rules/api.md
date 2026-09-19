---
paths:
  - "src/app/api/**"
  - "docs/API_V1_DRAFT.md"
---

# UNLOCK — API Route Rules

These rules apply whenever working on Next.js API Route Handlers or API boundary documentation.

## Route responsibility

Route files should remain thin.

A route should normally be responsible for:

- reading the HTTP request boundary
- constructing request-scoped infrastructure
- authenticating the caller
- mapping trusted request data into an application command
- invoking application logic
- mapping application outcomes into stable HTTP responses

Do not place learning/domain rules directly inside route files.

## Authentication

For authenticated routes:

1. create the request-scoped Supabase server client
2. resolve the authenticated user using `requireAuthenticatedUser`
3. return immediately if unauthenticated
4. only then construct PostgreSQL/runtime dependencies
5. invoke application logic

The only trusted `userId` source is authenticated server-side identity.

Never accept `userId` from:

- query params
- request body
- custom headers
- URL path values
- manually parsed cookies
- client metadata

## Auth before database

Authentication must happen before PostgreSQL runtime construction.

An unauthenticated request must not:

- call `getPool()`
- require `DATABASE_URL`
- construct database repositories
- construct DailyPlan runtime ports
- invoke application persistence

This ordering is security-relevant and should be covered by a regression test when practical.

## Runtime

Routes using `pg` must use:

`export const runtime = "nodejs";`

Do not switch such routes to Edge runtime.

Use the existing runtime foundation:

- `getPool()`
- `PgConnectionProvider`
- production composition factories

Do not create a new `Pool` inside a request handler.

## Time

Create request time exactly once at the HTTP boundary when the operation depends on "now".

Preferred shape:

`const now = new Date();`

Then pass the exact same Date instance downward.

Do not introduce additional hidden `Date.now()` or `new Date()` calls deeper in the same application flow unless explicitly required.

## Dependency construction

Prefer existing composition roots.

Do not manually recreate repositories or policy settings in the route if a production composition function already exists.

Routes must not duplicate:

- learning policy values
- TodayPlanner policy
- engine version
- repository construction logic
- database transaction logic

## DTOs

Do not return raw domain/application objects automatically.

Use explicit route-layer DTO mapping when the domain object contains:

- internal identity fields
- Date objects
- persistence-only fields
- redundant parent IDs
- implementation details not needed by the UI

DTO rules:

- expose only required client-facing fields
- explicitly convert Date values to ISO strings
- preserve null intentionally
- do not invent fields that do not exist in the domain
- do not rename domain concepts casually without a deliberate API contract decision

## Stable error contracts

Expected client-visible failures must use stable machine-readable error codes.

Do not return raw exception text.

Unexpected failures should return a generic response such as:

    {
      "error": {
        "code": "INTERNAL_ERROR"
      }
    }

Do not expose:

- stack traces
- SQL
- connection strings
- Supabase credentials
- Postgres driver details
- internal filesystem paths
- raw SDK messages

## DailyPlan Today route

Current route:

`GET /api/daily-plan/today`

Accepted semantics:

- no client-supplied `userId`
- no client-supplied `courseId`
- no client-supplied planned date
- user comes from verified Supabase Auth
- local date is derived by the application from persisted user timezone
- eligible courses are discovered by the application
- route uses Node runtime

Current intended HTTP mapping:

- `READY` → `200`
- `UNAUTHENTICATED` → `401`
- `TIMEZONE_NOT_SET` → `422`
- `USER_NOT_FOUND` → `500` with `USER_PROVISIONING_INCONSISTENT`
- unexpected failure → `500` with `INTERNAL_ERROR`

Do not treat authenticated `USER_NOT_FOUND` as a normal 404 because new Auth users should be provisioned into `public.users`.

## Request inputs

For GET routes, do not read request body unless the API design explicitly requires it.

Do not introduce query parameters merely because data could theoretically be configurable.

For `GET /api/daily-plan/today`, the server/application already owns:

- user identity
- timezone
- local date
- eligible course discovery

Do not move those responsibilities back to the client.

## Error boundary placement

Infrastructure failures can happen before application logic is invoked.

Route-level error handling must account for failures from:

- Supabase client construction
- auth helper execution
- environment validation
- `getPool()`
- infrastructure composition
- application invocation

Do not assume an application handler's try/catch covers failures that occur before the handler is called.

## Logging

For V1, `console.error` is acceptable for unexpected server-side failures when no structured logging system exists.

Rules:

- log internally
- return a stable generic client error
- never interpolate secrets into client-visible responses
- avoid duplicate logging at multiple layers for the same exception when possible

## Testability

Important route behavior should be testable without real network/database dependencies.

Prefer a small injected seam for:

- authentication outcome
- database/runtime construction
- application invocation
- explicit time

Do not create a large custom framework just to unit-test a route.

A route wiring test is particularly valuable when verifying ordering such as:

- auth before DB
- authorization before mutation
- validation before persistence

## Real environment verification

Unit tests do not replace real environment verification.

Once a hosted Supabase project exists, verify:

- real Auth cookie/session roundtrip
- real `auth.getUser()`
- real signup provisioning into `public.users`
- real `DATABASE_URL`
- real route request
- real PostgreSQL persistence

Until then, describe the route as implemented and unit-tested, not fully E2E verified.

## Documentation

When API behavior is implemented:

- update API docs to distinguish implemented behavior from draft behavior
- document exact HTTP outcome mapping
- document trusted identity source
- document runtime requirements
- document what remains unverified in a real environment

Do not let API documentation claim a behavior that the route ordering or runtime does not actually guarantee.

## Scope discipline

API work must not silently change:

- mastery semantics
- misconception semantics
- ranking weights
- DailyPlan sizing policy
- membership role semantics
- database schema unrelated to the route

If such a change becomes necessary, stop and report it as a separate slice.

## Git safety

Follow the repository-wide Git safety rules in `CLAUDE.md`.
---
paths:
  - "src/infrastructure/supabase/**"
  - "src/app/api/**"
---

# UNLOCK — Auth and API Security Rules

These rules apply whenever working on Supabase authentication or server API routes.

## Trusted user identity

- Never accept `userId` from:
  - query parameters
  - request bodies
  - custom headers
  - manually parsed cookies
  - client-provided metadata
- The only trusted user identity source is verified server-side authentication.
- For Supabase Auth, use `supabase.auth.getUser()`.
- Do not use `getSession()` as the authorization decision source.

## Auth before database

Authentication must be resolved before constructing or using PostgreSQL runtime infrastructure.

For authenticated API routes, prefer this order:

1. create the request-scoped Supabase server client
2. resolve authenticated user
3. if unauthenticated, return immediately
4. only then construct database/runtime dependencies
5. invoke application logic

An unauthenticated request must not require `DATABASE_URL`.

## Secrets and environment variables

- `NEXT_PUBLIC_SUPABASE_URL` is public by design.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` is public by design.
- `DATABASE_URL` is server-only.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed to browser code.
- Do not introduce service-role authentication unless explicitly required by the task.
- Never include secrets, connection strings, tokens, or raw environment values in client responses.

## Supabase client boundaries

- Browser code uses the browser Supabase client only.
- Server code uses the request-scoped server Supabase client only.
- Never create a global Supabase server client.
- Keep browser and server Supabase infrastructure separate.
- Do not leak server-only modules into Client Components.

## Error handling

Expected auth failures should use stable typed outcomes or stable HTTP error codes.

Unexpected infrastructure/runtime errors must not expose:

- raw `Error.message`
- stack traces
- SQL
- PostgreSQL details
- connection strings
- Supabase credentials
- internal implementation details

For V1, logging unexpected errors server-side with `console.error` is acceptable when no structured logger exists.

## Database access

- Supabase JavaScript SDK is currently used for authentication, not for rewriting repository persistence.
- Existing SQL repositories and PostgreSQL transaction boundaries remain the source of truth for application persistence.
- Do not bypass existing repositories unless explicitly required.

## RLS

- Do not invent or add RLS policies unless the task explicitly requires them.
- Current server-side authorization must remain explicit at the application/API boundary.
- Do not assume public client access to tables merely because Supabase Auth exists.

## User provisioning

- `auth.users.id` and `public.users.id` represent the same user identity.
- New Supabase Auth users are provisioned into `public.users` via the database trigger.
- Do not add a timezone default during Auth provisioning.
- Existing Auth users must not be silently backfilled unless explicitly requested and justified by known data.

## API routes

- Prefer thin Next.js Route Handlers.
- Keep business/application logic outside route files when practical.
- Do not duplicate learning policy values or repository logic inside routes.
- Use `runtime = "nodejs"` for routes that depend on `pg`.
- Create the request time once at the HTTP boundary and pass it downward explicitly.
- Do not use hidden `Date.now()` calls deeper in the application path when an explicit `now` is available.

## Git safety

Follow the repository-wide Git safety rules in `CLAUDE.md`.
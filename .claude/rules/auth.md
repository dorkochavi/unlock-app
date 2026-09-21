# UNLOCK — Auth & Trust Boundary Rule

Status: ACTIVE
Owner: authentication/authorization baseline

## Trusted Identity
Server-side authenticated identity is authoritative.
For Supabase-protected server routes, use the trusted server auth flow (`auth.getUser()` under current architecture).

Never trust authoritative user identity from request-controlled:
- body;
- query;
- path;
- custom headers;
- browser metadata.

## Auth Before Privilege
For protected routes, authenticate before constructing/using privileged DB/runtime dependencies where feasible and required by current architecture.
Unauthenticated requests must fail closed.

## Authorization
Authentication is not authorization.
Check the accepted CourseMembership/role/ownership policy explicitly.
Unresolved revoke/rejoin/permission semantics fail closed rather than being invented.

## Secrets
Keep service/database credentials server-only.
Never expose/request/reproduce `.env.local` secret values.
Do not return secrets/internal connection details in errors or logs.

## RLS
RLS is not an automatic requirement for every Supabase table in the current architecture.
Do not add RLS unless the task/accepted design explicitly requires it.
Existing explicit server-side authorization remains mandatory.

## Verification
Use focused auth/security evidence under `.claude/rules/testing.md`.
Security reviewer selection belongs to `review-commit`.

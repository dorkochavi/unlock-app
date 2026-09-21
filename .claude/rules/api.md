# UNLOCK — API Route Rule

Status: ACTIVE
Owner: API boundary implementation policy

## Thin Boundary
Route handlers should:
1. resolve trusted auth context when protected;
2. validate route/request input;
3. construct/invoke the relevant application use case;
4. map stable outcomes to HTTP;
5. log/return unexpected failures safely.

Do not embed Learning Engine/product policy in route handlers.

## Authentication / Authorization
Follow `.claude/rules/auth.md`.
Do not trust request-supplied authoritative user IDs.
Authenticate before privileged DB construction where required.
Authorization belongs in trusted server/application boundaries and must fail closed.

## Inputs
Validate malformed IDs and request payloads deliberately.
Do not rely on DB/parser crashes as input validation.
Use stable DTOs/outcomes rather than leaking infrastructure exceptions.

## Errors / Leakage
Expected application outcomes may map to stable client-safe statuses/codes.
Unexpected failures must not expose:
- raw SQL;
- stack traces;
- secrets;
- connection details;
- internal implementation detail.

## Runtime / Time
Use explicit/request-scoped time where product determinism depends on it.
Do not introduce hidden timezone assumptions for DailyPlan behavior.

## Composition
Keep route composition testable and request-scoped.
Avoid constructing privileged dependencies before authentication on protected routes.

## Verification
Follow `.claude/rules/testing.md` for focused route/application evidence.
Reviewer selection belongs to `review-commit`.

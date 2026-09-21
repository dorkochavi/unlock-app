---

paths:

* "src/infrastructure/supabase/**"
* "src/app/api/**"

---

# UNLOCK — Authentication & Trusted Identity Rule

Status: ACTIVE
Purpose: define trusted identity, Supabase Auth, session, secret, and authentication-ordering guardrails for UNLOCK.

This rule owns authentication-specific trust boundaries.

It does not own:

* general API architecture;
* Course authorization policy;
* database architecture;
* RLS design;
* testing policy;
* reviewer selection;
* Git workflow.

Use the relevant dedicated source for those responsibilities.

---

## 1. Trusted User Identity

Never accept authoritative `userId` from:

* query parameters;
* request bodies;
* custom headers;
* manually parsed cookies;
* client-provided metadata;
* browser state.

The trusted user identity source is verified server-side authentication.

For Supabase Auth:

```text id="72hnzz"
supabase.auth.getUser()
```

is the trusted identity source.

Do not use `getSession()` as the server-side authorization identity source.

---

## 2. Authentication Before Protected Database Work

For authenticated server/API operations, resolve authentication before constructing or using protected PostgreSQL/application dependencies when the route can safely reject early.

Preferred sequence:

```text id="r2bo4h"
create request-scoped Supabase server client
→ resolve authenticated user
→ reject unauthenticated request
→ construct protected database/application dependencies
→ perform authorization
→ execute application use case
```

An unauthenticated request should not require `DATABASE_URL` merely to return the expected auth failure.

Do not move protected mutation or ownership-sensitive work before authentication.

---

## 3. Authentication Is Not Authorization

Authentication answers:

> Who is the caller?

Authorization answers:

> May this caller perform this action?

Do not treat successful authentication as permission to:

* manage a Course;
* access another learner's state;
* mutate another learner's DailyPlan;
* use an instructor/owner capability;
* reactivate revoked access.

Authorization policy belongs to the relevant application/domain decision.

---

## 4. Server-Derived Ownership

Where trusted persisted state can determine ownership or identity, derive it server-side.

Examples may include:

* authenticated user;
* DailyPlan owner;
* DailyPlanItem → Course/Question/QuestionVersion identity;
* CourseMembership role.

Client-provided IDs may identify a requested resource.

They must not redefine the authoritative owner or trusted identity.

---

## 5. Supabase Client Boundaries

Browser code uses the browser Supabase client.

Server code uses a request-scoped server Supabase client.

Do not:

* create a global mutable Supabase server client;
* leak server-only Supabase infrastructure into Client Components;
* use browser session state as server authorization proof;
* mix privileged server credentials into client code.

Keep browser and server boundaries explicit.

---

## 6. Secrets and Environment Variables

Public by design:

* `NEXT_PUBLIC_SUPABASE_URL`
* `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:

* `DATABASE_URL`
* `SUPABASE_SERVICE_ROLE_KEY`

Do not expose server-only values through:

* browser bundles;
* `NEXT_PUBLIC_*`;
* API responses;
* logs;
* documentation;
* committed source.

Do not introduce service-role usage merely for convenience.

Use privileged credentials only when an explicit trusted server operation genuinely requires them.

---

## 7. Service Role

`SUPABASE_SERVICE_ROLE_KEY` is privileged.

It must never become a substitute for normal user authorization.

Do not use it to bypass:

* CourseMembership checks;
* learner ownership;
* accepted application authorization;
* product policy.

If service-role behavior becomes necessary, keep it:

* server-only;
* narrow;
* explicit;
* scoped to the trusted operation.

---

## 8. Error Handling

Expected authentication failures should use stable typed outcomes or stable HTTP responses.

Unexpected infrastructure/runtime errors must not expose:

* raw stack traces;
* SQL;
* PostgreSQL details;
* connection strings;
* credentials;
* tokens;
* cookies;
* internal implementation details.

Server-side `console.error` remains acceptable where no structured logger exists, provided sensitive values are not logged.

---

## 9. User Provisioning

Current identity relationship:

```text id="8fka45"
auth.users.id
=
public.users.id
```

New Supabase Auth users are provisioned into `public.users` through the accepted database provisioning flow.

Preserve these guardrails:

* authenticated UUID continuity;
* no arbitrary identity remapping;
* no unapproved metadata becoming trusted;
* no invented timezone default during Auth provisioning;
* no silent existing-user backfill unless explicitly scoped.

Provisioning implementation details belong to the database layer.

---

## 10. Session and Cookie Boundary

When handling Supabase SSR/session behavior:

* use request-scoped server clients;
* use the installed Next.js cookie APIs correctly;
* mutate cookies only in supported runtime contexts;
* do not treat a browser-side session object as trusted server authorization;
* keep token/session details out of client-visible error output.

Do not introduce middleware solely because authentication exists.

Add middleware only when a real product/runtime requirement justifies it.

---

## 11. Redirect Safety

When authentication flows accept a return/redirect target:

* prefer application-local paths;
* reject arbitrary external URLs unless explicitly required;
* reject scheme-relative external redirects such as `//evil.example`;
* do not trust encoded input without validation.

Authentication success must not create an open redirect.

---

## 12. Current RLS Baseline

Do not invent or broaden RLS policies automatically.

Current V1 authorization remains explicit at trusted server/application boundaries, alongside existing database controls.

The existence of Supabase Auth does not imply:

* public table access;
* browser-direct persistence;
* missing authorization is solved automatically by RLS;
* every user-owned table needs a new policy in the current Slice.

If RLS becomes explicit scope, use the database/security sources that own that work.

---

## 13. Persistence Boundary

Supabase JavaScript SDK is currently used for authentication-related capabilities.

It does not replace the existing PostgreSQL repository architecture.

Do not rewrite persistence through Supabase JS merely because authentication already uses Supabase.

Current SQL repositories and transaction boundaries remain authoritative for application persistence unless explicit architecture scope changes that decision.

---

## 14. API Relationship

General Route Handler design belongs to:

`.claude/rules/api.md`

This auth rule only requires that authentication-sensitive routes preserve:

* trusted server identity;
* safe ordering;
* ownership/authorization boundaries;
* secret isolation;
* controlled auth errors.

Do not duplicate full API policy here.

---

## 15. Verification Ownership

This rule does not define which tests/commands must run.

Use:

`.claude/rules/testing.md`

for:

* auth verification selection;
* route/auth regression evidence;
* evidence freshness;
* escalation to browser or hosted verification.

Local mocks do not automatically prove real hosted Supabase Auth behavior.

State evidence boundaries precisely.

---

## 16. Security Review Relationship

Material authentication/security changes should receive risk-based security review through:

`/review-commit`

The specialist reviewer inspects trust-boundary correctness.

This rule defines implementation guardrails only.

---

## 17. Core Principle

> Trust verified server identity, not client claims.

> Authenticate before protected work when early rejection is possible.

> Keep privileged credentials server-only.

> Authentication establishes identity; authorization still has to be enforced explicitly.

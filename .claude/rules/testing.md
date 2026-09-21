# UNLOCK — Operational Testing & Evidence Rule

Status: ACTIVE
Owner: verification selection, evidence freshness, invalidation, and escalation for Claude Code

This rule applies whenever Claude changes repository state or evaluates whether implementation work has sufficient verification.

Conceptual testing philosophy and the meaning of each evidence layer live in:

`docs/TESTING.md`

This rule answers a different question:

> Given the current change, what evidence must be produced or refreshed now?

---

## 1. Ownership

This rule owns:

* verification selection;
* targeted test selection;
* evidence freshness;
* evidence invalidation;
* verification escalation;
* final relevant verification selection;
* precise verification claims.

This rule does **not** own:

* product behavior;
* current Run scope;
* Slice sequencing;
* reviewer selection;
* reviewer findings;
* checkpoint workflow;
* commit orchestration;
* Git safety policy;
* Definition of Done.

Those responsibilities belong to their dedicated documents/rules/skills.

---

## 2. Core Rule

Use the **smallest sufficient set of evidence** that proves the risks affected by the change.

Do not:

* run everything by default;
* rerun valid evidence merely because a lifecycle stage changed;
* skip required evidence because a narrow test happened to pass;
* confuse execution volume with confidence.

Verification should follow risk.

---

## 3. Canonical Lifecycle Position

The normal lifecycle is:

```text
IMPLEMENT
→ TARGETED VERIFICATION
→ RISK REVIEW
→ FIX MATERIAL FINDINGS
→ FINAL RELEVANT VERIFICATION
→ EVIDENCE CHECKPOINT
```

This rule owns the verification steps.

Reviewers identify risks and findings.

Checkpoint validates that the resulting evidence/state is sufficient.

Neither review nor checkpoint automatically means:

> rerun every test suite.

---

## 4. Start From the Change Surface

Before selecting verification, identify what materially changed.

Relevant surfaces may include:

* domain logic;
* Learning Engine behavior;
* application orchestration;
* API/route wiring;
* authentication;
* authorization;
* PostgreSQL repositories;
* migrations/schema;
* Unit of Work / transactions;
* DailyPlan behavior;
* UI interaction;
* shared UI infrastructure;
* localization;
* configuration/build behavior;
* browser-integrated behavior;
* documentation only.

Select evidence from the affected risk surface, not from habit.

---

## 5. Prefer the Narrowest Proving Layer

Default escalation order:

```text
focused domain/unit test
↓
application/use-case test
↓
route/API test
↓
repository/PGlite integration
↓
browser E2E
↓
hosted/real-environment verification
```

Do not escalate merely because a broader layer exists.

Escalate when the narrower layer cannot prove the affected contract.

A broader layer does not replace a narrower test when the narrow test is the best proof of a specific invariant.

---

## 6. Targeted Verification During Implementation

While implementing:

* run the nearest relevant tests first;
* keep feedback loops short;
* verify changed behavior before broad cleanup;
* add a regression test when fixing a meaningful reproducible defect;
* rerun only evidence invalidated by the latest relevant edit.

Do not repeatedly run full suites after every small edit.

---

## 7. Evidence Freshness

A successful verification result remains valid until a later relevant change can reasonably affect what it proved.

Freshness is based on dependency/risk relevance, not elapsed time.

Example:

```text
domain test passes
→ documentation edited
→ domain evidence remains fresh
```

Example:

```text
domain test passes
→ shared domain function edited
→ previous domain evidence is stale
```

A new lifecycle stage does not itself invalidate evidence.

---

## 8. Conservative Freshness Rule

If it is unclear whether a later change could affect the evidence:

> treat the evidence as stale.

Do not spend excessive effort arguing that uncertain evidence is probably still valid.

Refresh the smallest relevant check.

---

## 9. Evidence Invalidation Examples

### Domain / Learning Engine

Changes to:

* learning formulas;
* ranking;
* retrieval qualification;
* mastery;
* misconceptions;
* evidence strength;
* scheduler integration;
* shared domain utilities;

invalidate the relevant domain tests.

They may also invalidate application or DailyPlan tests if those layers depend on the changed behavior.

### Application

Changes to:

* use-case orchestration;
* ownership checks;
* dependency ordering;
* error outcomes;
* idempotency flow;

invalidate relevant application tests.

Route tests become stale only where route-visible behavior or wiring is affected.

### API / Auth

Changes to:

* authentication;
* authorization;
* route composition;
* request validation;
* trusted identity propagation;

invalidate relevant route/API/security tests.

### Database

Changes to:

* migrations;
* SQL;
* PostgreSQL repositories;
* row mapping;
* transaction behavior;
* constraints;
* Unit of Work;

invalidate relevant persistence/schema evidence.

### UI

Changes to:

* user interaction;
* navigation;
* important state rendering;
* shared presentation primitives;

invalidate relevant UI evidence.

Browser E2E becomes stale only when the changed surface affects the E2E flow being claimed.

---

## 10. Documentation-Only Changes

Documentation-only changes normally do not require runtime test execution.

Still consider:

* link/reference correctness;
* stale terminology searches;
* Markdown/frontmatter validity where relevant;
* consistency with accepted sources;
* `git diff --check`.

Do not run unit/schema/E2E suites merely because documentation changed.

---

## 11. Typecheck

Run TypeScript typecheck when a change can affect TypeScript contracts.

Typical triggers:

* TypeScript implementation changes;
* exported type/interface changes;
* function signatures;
* imports/module boundaries;
* generated TypeScript consumed by the app;
* configuration affecting TypeScript compilation.

A prior successful typecheck remains valid until a later relevant TypeScript/config change invalidates it.

Do not rerun typecheck after documentation-only edits.

---

## 12. Lint

Run lint when the affected files/configuration are covered by lint and meaningful lint risk exists.

Typical triggers:

* source-code changes;
* lint configuration changes;
* patterns likely to introduce configured static-quality violations.

Do not treat lint as behavioral evidence.

A successful lint result may be reused while no lint-relevant files/configuration changed.

---

## 13. Production Build

Run the production build when the change creates meaningful build/integration risk.

Typical triggers:

* Next.js routing/layout changes;
* server/client boundary changes;
* build configuration;
* environment/config handling;
* package/dependency changes;
* framework-level integration;
* significant application wiring changes;
* final Run/pilot acceptance when build evidence is explicitly required.

Do not run a production build after every small domain edit solely by ritual.

A build result becomes stale when later build-relevant code/configuration changes.

---

## 14. `git diff --check`

Use `git diff --check` before a commit-ready checkpoint for changed tracked content.

It provides formatting/whitespace evidence only.

It does not replace:

* tests;
* typecheck;
* lint;
* build;
* review.

Do not claim more from it.

---

## 15. Domain / Learning Verification

For deterministic domain behavior, prefer focused unit tests.

Relevant risks include:

* state transitions;
* ranking;
* evidence interpretation;
* time calculations;
* answer correctness;
* eligibility;
* deterministic replay.

Use explicit time and deterministic fixtures.

Do not use browser/database verification to prove a pure-domain rule when a focused unit test proves it directly.

---

## 16. Learning Engine Verification

Learning Engine changes should normally receive:

1. focused tests for the changed rule;
2. nearby regression/Golden Scenario coverage;
3. replay/rebuild coverage when historical ordering or derived-state reconstruction is affected.

If the changed domain behavior feeds DailyPlan or answer submission, escalate to the relevant application tests when integration risk exists.

Do not encode unresolved calibration values merely to obtain a green test.

---

## 17. DailyPlan Verification

For changes affecting current Today behavior, consider evidence for:

* same-day persistence;
* learner-local date;
* eligible membership filtering;
* global ranking;
* frozen QuestionVersion identity;
* New Material fallback;
* Skip;
* answer ownership;
* completion/resolution;
* persistence/race behavior.

Use the narrowest affected tests.

Do not automatically rerun every DailyPlan test for an unrelated UI change.

---

## 18. Application Use-Case Verification

Application tests are preferred when a change affects orchestration across boundaries.

Examples:

```text
answer
→ Attempt
→ progress
→ DailyPlanItem resolution
```

or:

```text
memberships
→ eligible Courses
→ candidate discovery
→ DailyPlan
```

Use injected dependencies where they prove application behavior sufficiently.

Escalate to database integration only when persistence semantics matter.

---

## 19. API / Route Verification

For Next.js route changes, verify route-specific behavior that matters.

Typical cases:

* authentication before database construction;
* authorization before mutation;
* input validation;
* trusted user identity;
* application-result → HTTP-result mapping;
* controlled error responses;
* endpoint-specific wiring.

Shared route-test helpers may reduce boilerplate.

Retain endpoint-specific evidence for security-sensitive wiring.

Do not replace route-specific proof with one overly generic harness.

---

## 20. Authentication Verification

Auth-sensitive work should protect, where relevant:

* `auth.getUser()` as trusted identity;
* unauthenticated short-circuit behavior;
* no protected DB/application work before authentication;
* client user IDs cannot override trusted identity;
* raw auth/runtime errors are not leaked.

Ordinary unit/route tests should not call live Supabase Auth.

Hosted Auth verification is a separate evidence layer.

---

## 21. Authorization Verification

Authorization changes require evidence at the boundary where authorization is enforced.

Relevant cases may include:

* Course management roles;
* learner ownership;
* revoked/archived membership;
* DailyPlanItem ownership;
* server-derived identifiers;
* fail-closed behavior.

UI visibility is not authorization evidence.

---

## 22. PostgreSQL / Repository Verification

For persistence behavior, prefer real repository code against the available PostgreSQL-compatible integration environment.

Use relevant tests for:

* mappings;
* constraints;
* queries;
* transaction behavior;
* rollback;
* Unit of Work;
* persisted canonical state.

Avoid mocking SQL when the actual repository can reasonably be exercised.

---

## 23. When `npm run test:schema` Is Required

Run `npm run test:schema` when current changes affect or directly depend on:

* migration files;
* database schema;
* SQL queries;
* PostgreSQL repositories;
* database row serialization/mapping;
* constraints;
* transaction behavior;
* Unit of Work behavior;
* DB-specific integration logic.

Do **not** rerun it when only unrelated surfaces changed afterward.

A previously passing schema run remains fresh until a DB-relevant change invalidates it.

---

## 24. PGlite Evidence Boundary

PGlite meaningfully proves many PostgreSQL-compatible behaviors, including:

* SQL syntax;
* migration application;
* constraints;
* repository behavior;
* transactional behavior supported by the environment;
* test-prepared trigger/schema behavior.

PGlite does **not** automatically prove:

* hosted Supabase Auth;
* production network behavior;
* connection pooling;
* every real multi-backend concurrency property;
* hosted role/RLS behavior;
* every host-dependent type-decoding detail.

State the evidence boundary precisely.

---

## 25. Supabase Auth Test Stand-In

A minimal test-only `auth.users` stand-in may be used where required for migration/schema tests.

Rules:

* keep it minimal;
* label it test-only;
* do not model the full Supabase Auth schema without need;
* do not claim it proves hosted GoTrue/Auth behavior.

---

## 26. Concurrency Evidence

Concurrency claims require evidence capable of proving the claimed concurrency behavior.

If a PGlite/in-process test cannot reproduce the real multi-connection property:

* test what can be tested;
* reason about the PostgreSQL mechanism;
* document the limitation;
* use stronger integration evidence when required by risk.

Do not label simulated single-connection behavior as full concurrency proof.

---

## 27. Known Replay Diagnostic

Canonical Attempt replay may be sensitive when ordering timestamps tie and a later stable key is used for ordering.

If a replay-related test fails:

* inspect `answered_at`;
* inspect `created_at`;
* inspect stable tie-breaking;
* determine whether the failure is production behavior or unstable fixture setup.

Do not casually change canonical production ordering to accommodate an accidental test tie.

---

## 28. Browser E2E Verification

Playwright is part of the current repository stack.

Use browser E2E when integration across real application layers is the risk being tested.

High-value examples:

* authentication/join;
* Today golden path;
* answer/Skip;
* resume;
* completion;
* pilot-critical instructor flow.

Do not use E2E to prove every Learning Engine rule.

Do not rerun browser E2E merely because review or checkpoint occurred.

Refresh it when the integrated path it proves changed.

---

## 29. Hosted / Real-Environment Verification

Escalate to hosted Supabase or other real-environment checks only when the behavior depends materially on that environment or the current Plan explicitly requires it.

Examples may include:

* real Auth behavior;
* hosted migration application;
* environment configuration;
* role-policy behavior;
* production deployment integration.

Claude must respect repository safety rules.

In particular, Claude must not:

* `supabase link`;
* `supabase db push`;
* apply hosted migrations;
* deploy;
* push Git changes;

unless repository policy explicitly changes and the required human authorization exists.

Local evidence must not be mislabeled as hosted verification.

---

## 30. RLS Verification

Only require RLS policy verification when the current accepted surface actually uses or changes RLS policies.

Do not invent RLS work merely because a table contains user data.

When RLS is in scope, verify the relevant:

* allowed access;
* denied access;
* ownership boundary;
* role behavior;
* interaction with trusted server authorization.

Hosted role behavior may require stronger evidence than local PGlite can provide.

---

## 31. AI-Related Verification

Do not use live AI provider calls in ordinary automated verification.

Prefer:

* deterministic fixtures;
* provider fakes;
* schema validation;
* malformed-output cases;
* controlled provider failures;
* approval/rejection workflow tests.

Live AI quality evaluation is a separate activity and should be explicitly scoped.

---

## 32. Regression Tests

When fixing a meaningful defect:

* reproduce the failure where practical;
* add the narrowest useful regression test;
* make the test express the real behavioral contract;
* verify the fix;
* avoid broad duplicate coverage.

Do not add a regression test when automation would be brittle or meaningless.

---

## 33. Failure Handling

Never ignore a failure without understanding it.

When verification fails:

1. identify the first meaningful failure;
2. determine whether it is reproducible;
3. classify it as:

   * implementation defect;
   * stale/incorrect test;
   * environment/configuration issue;
   * known flaky behavior;
   * unrelated pre-existing failure;
   * unclear and requiring investigation;
4. determine whether it blocks the current work;
5. fix only within scope unless safety/integrity requires escalation.

Do not weaken assertions merely to obtain green output.

---

## 34. Unrelated Failures

If a failure is clearly unrelated to the current change:

* do not opportunistically expand the Slice;
* preserve/report the evidence;
* determine whether the current work can safely proceed;
* use `docs/FOLLOW_UP_BACKLOG.md` only when it is a real intentional deferred follow-up.

Do not hide the failure.

---

## 35. Reviewer-Driven Invalidation

A reviewer may identify a material issue requiring code changes.

After fixing it:

* identify which prior evidence the fix invalidated;
* rerun only the affected verification;
* retain unrelated fresh evidence.

Review itself does not invalidate anything.

The corrective change may.

---

## 36. Final Relevant Verification

Before evidence checkpoint/commit readiness, confirm that every materially affected risk has fresh evidence.

The final evidence set may reuse earlier successful results.

It does not require a ceremonial complete rerun.

Ask:

```text
What changed since each relevant passing check?
```

If nothing relevant changed, reuse it.

If something relevant changed, refresh it.

---

## 37. Run-End Integration Acceptance

Run-end acceptance is not a second full Slice QA cycle.

Additional verification is warranted when:

* multiple Slices now need to work together;
* cross-Slice integration has not yet been proven;
* a Run-level acceptance criterion lacks evidence;
* a final high-risk integrated path remains unverified.

Otherwise reuse valid Slice evidence.

---

## 38. Current Repository Commands

Use existing repository scripts from `package.json`.

Common available checks include:

```text
npm test
npm run test:schema
npm run typecheck
npm run lint
npm run build
git diff --check
```

These are **available evidence tools**, not a universal mandatory checklist.

Inspect `package.json` if script names may have changed.

Do not invent duplicate scripts solely to avoid existing commands.

---

## 39. Full Unit Suite

The full unit suite is appropriate when:

* changes affect widely shared logic;
* many unit-test areas depend on the modified contract;
* a Slice acceptance criterion explicitly requires it;
* final relevant verification needs broad unit confidence.

Do not require the full unit suite after every small isolated change if focused evidence is sufficient.

If it already passed and no unit-relevant code changed afterward, reuse the result.

---

## 40. Evidence Record

For each meaningful verification result, retain enough context to understand:

* what command/test was run;
* whether it passed;
* what behavior/risk it proves;
* whether later relevant changes invalidated it.

The evidence does not need a verbose diary.

Checkpoint owns validation of the final evidence/state.

`DEV_STATUS` owns durable current-state facts when they remain useful beyond the working session.

---

## 41. Verification Claims

Use precise evidence language.

Examples:

* focused unit tests passed;
* application orchestration tests passed;
* route-wiring/auth-ordering tests passed;
* PGlite schema integration passed;
* Playwright learner golden path passed;
* production build passed;
* inspected by reviewer;
* reasoned under PostgreSQL semantics;
* hosted Supabase migration not yet applied.

Avoid vague claims such as:

* fully tested;
* production verified;
* completely safe;
* end-to-end verified;

unless literally justified by the evidence.

---

## 42. Do Not Let Tests Decide Open Product Questions

If expected behavior is unresolved:

* consult the relevant accepted source;
* consult `docs/OPEN_QUESTIONS.md`;
* do not choose a fixture value and thereby turn it into policy;
* do not update production behavior merely to satisfy an outdated test.

Tests protect accepted decisions.

They do not create them.

---

## 43. Evidence vs Test Counts

Test counts are useful local regression indicators.

They are not product requirements.

Do not alter implementation to preserve an old count.

If durable current counts are worth recording, `docs/DEV_STATUS.md` owns that snapshot.

This rule should not contain canonical test counts.

---

## 44. Test Fakes and Helpers

Use test helpers/fakes where they improve clarity.

Do not create:

* one giant fake repository;
* one universal route harness;
* one mega-Unit-of-Work;

solely to reduce duplication.

Preserve meaningful domain/application boundaries.

Broader maintainability consolidation belongs in deliberate follow-up work, not in verification policy.

---

## 45. Commit Relationship

This rule does not decide whether a commit should be created.

It only determines whether verification evidence is sufficient/fresh for the affected risks.

Commit orchestration belongs elsewhere.

A commit-ready checkpoint should receive:

* fresh relevant evidence;
* known failures/limitations;
* precise evidence claims.

Do not duplicate commit policy here.

---

## 46. Git Relationship

Repository-wide Git safety rules live in `AGENTS.md` / `CLAUDE.md`.

This file does not own:

* staging rules;
* branch rules;
* push rules;
* destructive Git restrictions.

Verification may inspect repository state when needed to understand affected files, but Git policy remains separate.

---

## 47. Stop Condition

Verification for the current change is sufficient when:

1. every materially affected risk has appropriate evidence;
2. required relevant checks are green or explicitly understood;
3. no known blocker is being hidden;
4. evidence claims match what was actually executed;
5. later changes have not invalidated the evidence being reused.

Then hand the evidence/state to the checkpoint/review lifecycle rather than continuing to rerun tests without a new reason.

---

## 48. Key Principle

> Evidence is reusable until relevant change invalidates it.

> Verification follows risk, not ceremony.

> Run the narrowest check that proves the behavior, and escalate only when the affected boundary requires stronger evidence.

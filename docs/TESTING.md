# UNLOCK Testing Strategy

Status: ACTIVE
Purpose: define what trustworthy testing means in UNLOCK, what each test layer can prove, and the quality principles that protect learning behavior, data integrity, security, and critical product flows.

This document owns **testing philosophy and evidence meaning**.

It does **not** own operational verification selection for a specific code change.

For Claude Code, the operational decision of:

* what checks to run;
* what evidence may be reused;
* when evidence becomes stale;
* when to escalate to broader verification;

belongs to:

`.claude/rules/testing.md`

---

# 1. Testing Goal

Testing exists to build justified confidence in behavior.

The goal is not:

* maximum test count;
* maximum coverage percentage;
* replaying the full suite after every change;
* proving framework internals;
* creating the appearance of engineering maturity.

The goal is to answer:

> What evidence proves that the behavior we care about still works?

---

# 2. Core Testing Principles

UNLOCK testing should prioritize:

1. learning correctness;
2. historical evidence integrity;
3. deterministic behavior;
4. transactional consistency;
5. authorization and ownership boundaries;
6. persisted Today behavior;
7. critical user journeys;
8. regression protection.

Prefer tests that would fail if an important product invariant were broken.

Avoid tests that only confirm implementation details exist.

---

# 3. Evidence Is Layer-Specific

A test proves only what its layer actually exercises.

For example:

```text
domain unit test
≠
database proof
```

```text
PGlite schema/integration test
≠
hosted Supabase proof
```

```text
API handler test
≠
browser E2E
```

```text
browser E2E
≠
concurrency proof
```

Do not describe one layer's evidence as proof of another layer.

This distinction is fundamental to UNLOCK's verification model.

---

# 4. Preferred Test Shape

The general preference remains:

```text
many focused deterministic tests
↓
fewer cross-boundary integration tests
↓
a small set of critical browser E2E tests
```

This is a design preference, not a rigid quota.

Use the narrowest test layer that can actually prove the behavior.

Escalate only when the narrower layer cannot provide sufficient evidence.

---

# 5. Domain Tests

Domain tests are the primary evidence for deterministic business and learning rules.

Use them for behavior such as:

* Learning Engine transitions;
* retrieval qualification;
* mastery derivation;
* misconception logic;
* evidence strength;
* Next Best Action ranking;
* DailyPlan candidate ranking;
* eligibility rules;
* local-date calculations;
* answer correctness;
* deterministic policy behavior.

Domain tests should be:

* fast;
* deterministic;
* independent;
* explicit;
* easy to understand;
* free from UI/network/database dependencies unless the domain itself requires them.

---

# 6. Learning Engine Tests

Learning Engine behavior requires especially strong evidence because it directly affects the learner model.

For meaningful rules, tests should cover relevant combinations such as:

* normal behavior;
* boundary behavior;
* insufficient evidence;
* repeated behavior;
* contradictory signals;
* lapse and recovery;
* same-session repetition;
* spaced retrieval;
* assisted or weak evidence;
* out-of-order evidence;
* regression cases discovered during development.

Assertions should describe the behavior being protected.

Prefer:

```ts
expect(progress.masteryCategory).toBe("learning");
```

over:

```ts
expect(progress).toBeTruthy();
```

---

# 7. Golden Scenarios

Important learning and product behaviors should be represented by realistic scenario-based evidence where that improves confidence.

A Golden Scenario describes:

* learner history;
* important context;
* expected behavior;
* the tests that currently prove it.

The active scenario-to-evidence map lives in:

`docs/GOLDEN_SCENARIOS.md`

Golden Scenarios do not create product policy.

Accepted ADRs and canonical product/domain documentation define behavior.

Tests prove that implementation matches it.

---

# 8. Deterministic Replay

Where derived learner state can be rebuilt from immutable historical evidence, tests should protect deterministic replay.

Important properties include:

* stable ordering;
* equivalent final state regardless of arrival order where designed;
* preservation of immutable Attempts;
* explicit handling of out-of-order evidence;
* reproducibility across rebuilds.

Historical evidence must not be rewritten merely because current derived state changes.

---

# 9. QuestionVersion Integrity

Question editing must not invalidate historical learning evidence.

Tests should protect:

* immutable QuestionVersions;
* Attempt linkage to the exact version shown;
* correctness evaluation against the historical frozen version;
* absence of retroactive regrading from a newer Question version.

Question is the stable logical identity.

QuestionVersion is the immutable content identity the learner saw.

---

# 10. Attempt Tests

Attempt tests should protect historical evidence.

Relevant behavior includes:

* one logical submission creates one immutable Attempt;
* user/question/version identity is correct;
* response evidence is preserved;
* retries are idempotent;
* distinct intentional submissions remain distinct;
* old Attempts are not rewritten by future learning-state changes;
* server-owned fields cannot be forged through client input.

Attempts answer:

> What happened?

They do not represent current learner state.

---

# 11. UserQuestionProgress Tests

Tests should verify that learner-specific derived progress:

* updates from accepted evidence;
* remains learner-specific;
* remains Question-specific;
* preserves historical Attempts;
* does not mutate shared Question content;
* follows the accepted Learning Engine logic;
* can be reconciled/rebuilt where the architecture requires it.

Do not infer expected behavior from outdated field lists in documentation.

Tests should follow current domain contracts and accepted decisions.

---

# 12. Next Best Action Tests

Next Best Action tests should verify actual ranking behavior.

Possible assertions include:

* an accepted stronger need outranks a weaker one;
* lapse/relearning behaves according to current policy;
* misconception evidence affects ranking as designed;
* exam urgency is applied only when valid exam context exists;
* no urgency is invented when no applicable date exists;
* identical deterministic input yields identical ranking;
* tie-breaking is stable where defined.

Do not use this document to invent unresolved ranking thresholds.

Calibration belongs in accepted decisions and current open questions.

---

# 13. Exam-Date Tests

Exam-related tests should prove only behavior that has actually been decided.

The exact V1 exam-date hierarchy remains an explicit product/domain decision boundary.

Therefore this testing strategy must **not** canonize a specific precedence such as:

```text
personal > group > course
```

unless a later accepted decision establishes it.

Tests should instead follow the currently accepted exam-context contract.

At minimum:

* no valid exam date must not create artificial urgency;
* accepted date-resolution behavior should live in one reusable domain location;
* urgency behavior should remain deterministic;
* unresolved product choices must not be silently decided through fixtures.

---

# 14. DailyPlan Tests

`DailyPlan` / `DailyPlanItem` are the primary current Today persistence model.

Tests should protect accepted Today semantics including:

* one DailyPlan per learner per learner-local calendar day;
* same-day reuse rather than silent regeneration;
* frozen plan behavior;
* learner-local timezone boundaries;
* eligible Course membership filtering;
* globally ranked eligible candidates;
* deterministic item ordering;
* frozen QuestionVersion identity;
* atomic persistence;
* race-safe create-if-not-exists behavior;
* legitimate empty plan behavior;
* New Material fallback;
* resume behavior;
* completion/resolution behavior.

Canonical product behavior comes from ADR-016 and ADR-017.

---

# 15. DailyPlanItem Answer Tests

Answering a Today item crosses several trust boundaries.

Tests should prove that:

* the item belongs to the authenticated learner;
* persisted item identity is authoritative;
* client input cannot substitute another Course/Question/QuestionVersion;
* Attempt creation remains idempotent;
* learner progress updates correctly;
* the DailyPlanItem resolves correctly;
* transactional failure does not leave partial state.

A DailyPlan-specific wrapper must not accidentally create a second independent Learning Engine implementation.

---

# 16. Skip Tests

Skip is resolution, not learning evidence.

Tests should verify that Skip:

* resolves a pending DailyPlanItem;
* creates no incorrect Attempt merely because the learner skipped;
* creates no false mastery/misconception evidence;
* does not automatically invent replacement work;
* does not mutate an already-resolved item;
* is safe under repeated requests;
* does not expose another learner's item ownership.

---

# 17. Legacy TodaySession Tests

The repository may still contain tests for:

* TodaySession;
* TodaySessionItem;
* legacy answer/session linkage.

These tests remain valid where the compatibility path still exists.

They should be treated as:

```text
legacy / compatibility evidence
```

not as the primary current Today product model.

Do not delete valid legacy regression coverage merely for terminology cleanup.

---

# 18. Application Tests

Application tests prove use-case orchestration without requiring a full browser.

Use them when behavior involves several domain/repository boundaries, for example:

```text
submit answer
→ persist Attempt
→ update progress
→ resolve DailyPlanItem
```

or:

```text
load memberships
→ determine eligible Courses
→ generate DailyPlan
→ persist plan
```

Application tests are especially useful for proving:

* orchestration;
* fail-closed behavior;
* trusted identity use;
* idempotency coordination;
* dependency ordering;
* transactional intent at the application boundary.

---

# 19. Repository and Infrastructure Tests

Repository tests should protect persistence behavior and mapping.

Examples include:

* database row ↔ domain mapping;
* create/read behavior;
* ownership filters;
* unique-key behavior;
* transaction boundaries;
* DailyPlan create-if-not-exists;
* QuestionVersion persistence;
* CourseMembership behavior;
* Topic/question authoring persistence.

Mocks should not be presented as proof of actual database constraints.

---

# 20. PostgreSQL / PGlite Schema Tests

UNLOCK uses PostgreSQL-compatible integration testing through PGlite for important schema and migration behavior.

These tests can provide real PostgreSQL-engine evidence for:

* migration validity;
* foreign keys;
* unique constraints;
* CHECK constraints;
* valid row chains;
* transactional schema behavior;
* repository behavior that PGlite faithfully supports.

PGlite is not a SQL string mock.

However, PGlite evidence does **not** automatically prove:

* hosted Supabase configuration;
* Supabase Auth behavior;
* every PostgreSQL extension;
* real network/pooling behavior;
* production concurrency characteristics;
* role switching/RLS behavior that depends on hosted role context.

State those boundaries honestly.

---

# 21. Migration Tests

Forward-only migrations are part of the product's data integrity.

Testing should protect:

* full migration-chain application;
* compatibility with existing accepted schema;
* constraints introduced by new migrations;
* persistence behavior required by the corresponding feature.

Do not rewrite an accepted historical migration merely to make a newer design easier.

Use a new migration.

Hosted migration application is a separate operational action and does not become proven merely because local migration tests pass.

---

# 22. Authorization Tests

Authorization is feature behavior, not UI behavior.

Important cases should verify:

* unauthenticated requests fail appropriately;
* authenticated identity is resolved before protected database work;
* learners cannot access another learner's private state;
* Course management uses accepted membership/role semantics;
* revoked/archived memberships are treated according to accepted policy;
* client-provided ownership identifiers are not trusted.

Hiding a button is not authorization evidence.

---

# 23. RLS Tests

RLS testing is required **when an accepted surface actually relies on RLS policies**.

The current V1 baseline must not be interpreted as:

> every table needs a new RLS policy now.

Where RLS policies exist or are explicitly introduced, test the relevant allow/deny behavior.

Potential cases include:

* intended role can perform the action;
* unintended role cannot;
* another learner's private data remains inaccessible;
* privileged server paths behave as designed.

Do not claim PGlite proves hosted Supabase role-policy behavior when it does not.

---

# 24. API / Route Tests

Route tests should prove HTTP-boundary behavior that matters.

Examples:

* authentication occurs before protected DB work;
* input parsing/validation;
* application use case is called with trusted identity;
* domain/application error maps to the intended HTTP response;
* malformed input receives controlled output;
* route-specific wiring is correct.

Do not recreate all application/domain behavior inside every route test.

Shared route test helpers are acceptable when they reduce boilerplate without hiding endpoint-specific behavior.

---

# 25. UI Tests

UI tests should focus on meaningful interaction behavior.

Examples:

* required action is available;
* error state is displayed;
* resume state renders correctly;
* completed state is represented;
* learner input triggers the intended application action;
* disabled/blocked behavior is communicated correctly.

Avoid brittle tests based on:

* exact DOM nesting;
* CSS implementation details;
* incidental snapshots;
* framework behavior with no UNLOCK-specific meaning.

---

# 26. RTL and Localization Tests

UNLOCK is Hebrew-first and RTL-first.

Automated tests are useful where RTL/i18n behavior has stable product importance.

Potential areas include:

* directional navigation;
* answer layouts;
* mixed Hebrew/English content;
* date/number formatting;
* user-facing message lookup;
* mobile interaction direction.

Not every visual RTL issue requires automation.

Use visual/manual review when it provides better evidence.

---

# 27. Accessibility Testing

Automated accessibility checks can detect common failures.

They do not replace human evaluation.

Important behavior includes:

* labels;
* semantic elements;
* keyboard access;
* focus behavior;
* disabled states;
* error communication;
* screen-reader meaning;
* touch-target usability where relevant.

Accessibility evidence should grow with the product surface.

---

# 28. Browser End-to-End Tests

Playwright is part of the current UNLOCK testing stack.

Browser E2E should focus on a small number of high-value flows.

Examples include:

```text
authenticate / join Course
→ open Today
→ answer or Skip
→ progress through DailyPlan
→ complete Today
```

and:

```text
open Today
→ leave
→ return
→ resume same persisted DailyPlan
```

Instructor/browser flows should be added when they become pilot-critical.

Do not attempt to prove every domain rule through browser automation.

E2E gives confidence that important layers work together.

It does not replace focused domain/database/application testing.

---

# 29. AI Tests

Normal automated tests should not repeatedly call live AI providers.

Use:

* deterministic fixtures;
* provider fakes;
* schema validation;
* controlled error simulation.

Application correctness tests may cover:

* extraction/output parsing;
* malformed structured output;
* provider failure;
* review-state transitions;
* generation orchestration;
* approval/rejection behavior.

AI quality evaluation is a separate concern from application correctness.

---

# 30. AI Content Verification Tests

When AI-generated learning content is introduced, tests should protect the accepted review pipeline.

Potential cases include:

* source supports the proposed answer;
* source does not support the answer;
* ambiguous answer options;
* unsupported explanation;
* invalid structured output;
* verifier failure;
* unapproved content cannot become learner-facing.

Do not require live provider calls to prove deterministic workflow behavior.

---

# 31. Time-Dependent Tests

Learning behavior contains significant time dependence.

Tests involving time should explicitly control time.

Examples:

* learner-local DailyPlan date;
* retrieval spacing;
* review scheduling;
* exam urgency;
* completion boundaries;
* timestamps used for deterministic replay.

Do not depend on the developer machine's uncontrolled current time.

---

# 32. Timezone Tests

Because Today is learner-local, timezone behavior deserves direct evidence.

Relevant cases include:

* UTC date differs from learner-local date;
* local midnight creates a new Today day;
* persisted IANA timezone is authoritative;
* DST boundaries where applicable;
* invalid timezone input is rejected/handled according to domain policy.

Timezone behavior should remain deterministic.

---

# 33. Randomness

Core learning behavior should avoid uncontrolled randomness.

If randomness is intentionally introduced:

* inject or seed it;
* make relevant tests reproducible;
* preserve deterministic replay where learning outcomes depend on selection order.

A flaky Learning Engine test is unacceptable.

---

# 34. External Services

Standard tests should not unnecessarily depend on live external systems.

Examples:

* AI;
* email;
* analytics;
* object storage;
* third-party APIs.

Use provider boundaries and fakes for normal test suites.

True provider/infrastructure verification may exist separately when justified.

---

# 35. Test Data

Fixtures should be:

* small;
* readable;
* intentional;
* behavior-oriented.

Avoid giant opaque fixture systems.

Builders/helpers are useful when they make scenarios clearer and remove real duplication.

They should not hide important test facts.

Example:

```ts
createAttempt({
  isCorrect: false,
  confidenceLevel: "HIGH",
});
```

is useful if those facts remain obvious to the reader.

---

# 36. Test Fakes

In-memory fakes should stay close to the contracts they represent.

Do not create one giant "God Fake" merely to reduce file count.

Shared helpers are appropriate only when:

* behavior is genuinely identical;
* ownership boundaries remain visible;
* tests remain easy to understand.

Potential fake consolidation is a maintainability follow-up, not a testing-policy requirement.

---

# 37. Test Naming

Test names should describe behavior.

Prefer:

```text
returns the persisted DailyPlan when Today is reopened on the same local day
```

over:

```text
daily plan test 4
```

A failing test name should help explain the broken rule.

---

# 38. Regression Tests

When a defect is fixed, ask:

> Can an automated test meaningfully prevent this regression?

If yes, add or strengthen the relevant test.

If automation would be brittle or meaningless, do not force it solely to satisfy process.

A regression test should reproduce the actual class of failure, not merely increase line coverage.

---

# 39. What Not to Test

Do not spend significant effort testing:

* framework internals;
* third-party library implementation;
* trivial TypeScript guarantees;
* static structure with no product meaning;
* exact implementation details that may safely change;
* generated code with no UNLOCK-specific behavior.

Test the behavior UNLOCK owns.

---

# 40. Coverage

Coverage percentage is a diagnostic tool.

It is not a quality target by itself.

Do not optimize for arbitrary global percentages.

High-risk areas should naturally accumulate stronger coverage, especially:

* Learning Engine;
* answer submission;
* learner progress;
* DailyPlan behavior;
* authorization;
* migrations/database integrity.

High numeric coverage does not compensate for missing critical scenarios.

---

# 41. Test Failure Rule

Do not:

* disable;
* skip;
* weaken;
* delete;

a failing test merely to obtain a green suite unless the test itself is proven incorrect or obsolete.

When intended behavior changes:

1. identify the accepted source of the new behavior;
2. update product/domain documentation or ADR if required;
3. update implementation;
4. update the affected test evidence.

Investigate whether a failure represents:

* implementation defect;
* stale test;
* stale contract;
* environment problem;
* unrelated pre-existing failure.

Do not assume automatically.

---

# 42. Evidence Reuse

Passing evidence does not become invalid merely because time passed or a later lifecycle step began.

Relevant evidence may be reused while it remains fresh.

Examples:

* a domain test run remains valid if no relevant domain code or dependencies changed afterward;
* a schema suite remains valid if migrations/schema-related code did not change;
* an E2E result remains valid if the relevant integrated path was not modified afterward.

Do not rerun expensive checks merely because:

* a reviewer finished;
* a checkpoint was reached;
* the Run is ending.

Evidence freshness is about **relevant change**, not ritual repetition.

Operational freshness rules belong in `.claude/rules/testing.md`.

---

# 43. Evidence Invalidation

Evidence becomes stale when a subsequent change can reasonably affect what that evidence proved.

Examples:

```text
Learning Engine changed
→ relevant learning tests stale
```

```text
migration changed
→ schema/database evidence stale
```

```text
route authentication changed
→ relevant route/security evidence stale
```

```text
shared UI behavior changed
→ relevant UI/E2E evidence may be stale
```

A documentation-only change does not automatically invalidate unrelated runtime evidence.

When uncertain whether a relevant modification invalidated evidence, treat the evidence as stale.

Detailed operational selection belongs in the testing rule.

---

# 44. Verification Escalation

Use the narrowest evidence that proves the change.

Escalate when:

* the change crosses additional layers;
* narrower tests cannot prove integration;
* the risk surface expands;
* reviewer findings reveal an untested boundary;
* a shared dependency affects broader behavior.

Do not default immediately to the broadest suite.

Likewise, do not avoid broader verification when the change genuinely requires it.

---

# 45. Final Relevant Verification

After implementation and material review corrections, there should be current evidence for all relevant affected behavior.

This does not mean:

> rerun every available command.

It means:

> ensure every materially affected risk has fresh enough evidence.

The final evidence set may combine:

* results produced earlier in the Slice;
* targeted reruns after corrections;
* integration/browser evidence where needed;
* static checks relevant to the change.

---

# 46. Build, Typecheck, and Lint

Static and build checks provide different forms of evidence.

Examples:

* typecheck → TypeScript contract consistency;
* lint → configured static-quality constraints;
* production build → bundling/framework/build-time integration.

None of these replaces behavioral tests.

Whether each check must be run for a particular change is an operational verification decision based on the affected surface.

Do not encode a universal "always rerun all three at every lifecycle boundary" rule in this document.

---

# 47. Current Testing Stack

Current repository testing capabilities include:

* Vitest;
* domain/application unit tests;
* PostgreSQL-compatible PGlite schema/integration testing;
* API/route-level tests;
* Playwright browser E2E;
* TypeScript typecheck;
* lint;
* production build verification.

This list describes available evidence layers.

It does not mean all layers must run for every change.

---

# 48. Golden Path Confidence

Before pilot readiness, the learner's primary vertical loop should have confidence across the appropriate layers:

```text
authenticate / join
→ obtain Today
→ DailyPlan persisted
→ answer / Skip
→ Attempt and progress update
→ resume / complete Today
→ future planning reflects evidence
```

No single test layer is expected to prove the entire system.

Confidence comes from complementary evidence.

---

# 49. Instructor Path Confidence

As instructor authoring becomes pilot-critical, testing should cover the relevant vertical behavior:

```text
create Course
→ create Topic/content
→ author/import Question
→ review/publish
→ learner can consume approved content
```

Use the appropriate combination of:

* domain tests;
* application tests;
* database integration;
* route tests;
* browser E2E.

Do not create browser automation solely because an instructor feature exists.

---

# 50. Security Evidence

Security-sensitive changes require evidence proportional to the trust boundary affected.

Potential areas include:

* authentication ordering;
* Course authorization;
* ownership filtering;
* privileged database use;
* server-only secrets;
* untrusted identifiers;
* malformed inputs;
* future RLS policy behavior.

Security review is not a replacement for tests.

Tests are not a replacement for security review.

They provide different evidence.

---

# 51. Reviewer Relationship

Review occurs before final relevant verification in the canonical lifecycle.

A reviewer may discover:

* missing test cases;
* stale assumptions;
* unverified integration risk;
* security gaps;
* incorrect evidence claims.

Material findings should be fixed.

Relevant evidence invalidated by those fixes should then be refreshed.

Review should not automatically trigger replay of all tests that remain valid.

---

# 52. Checkpoint Relationship

An evidence checkpoint validates that:

* relevant evidence exists;
* results are understandable;
* required risks have coverage;
* stale evidence has been refreshed;
* blockers are visible.

A checkpoint should not blindly rerun every suite.

The operational checkpoint behavior belongs to the Development OS skill/rule that owns it.

---

# 53. Run-End Integration Acceptance

Run-end acceptance exists to close meaningful integration gaps not already proven during Slice work.

It is not a second full QA cycle.

Use additional integration acceptance only when:

* several Slices must now work together;
* Run-level behavior was not previously proven;
* a final cross-Slice risk remains.

Do not replay all Slice QA solely because the Run is ending.

---

# 54. Test File Placement

Prefer tests close to the code they protect when that matches repository conventions.

Examples:

```text
src/domain/learning/
├── progress-update.ts
└── __tests__/
    └── progress-update.test.ts
```

Cross-cutting database/E2E suites may live in their established dedicated locations.

Follow the actual repository structure rather than inventing a new test hierarchy.

---

# 55. Source of Truth for Test Expectations

A test expectation should come from an accepted behavior source.

Depending on the topic:

* ADR;
* domain contract;
* canonical product document;
* accepted Learning Engine design;
* implemented database invariant;
* explicit feature contract when one exists.

Do not allow test fixtures to silently become product policy.

Tests protect decisions.

They do not replace the decision-making system.

---

# 56. Open Questions Must Stay Open

Testing must not resolve unresolved product or architecture questions accidentally.

If behavior remains open:

* do not encode one arbitrary answer as canonical;
* do not derive policy from an old fixture;
* do not claim a test proves behavior that has not been decided.

Instead:

* test the parts that are decided;
* preserve the decision boundary;
* resolve the question through the appropriate product/ADR process.

---

# 57. Honest Evidence Language

Describe verification precisely.

Prefer:

> PGlite integration suite passed and proves the committed migration chain and tested PostgreSQL constraints.

Not:

> Production database is fully verified.

Prefer:

> Route tests prove auth-before-DB ordering for these handlers.

Not:

> Security is fully verified.

Prefer:

> Playwright proves the tested learner golden path works in the browser environment used by the suite.

Not:

> The entire product is production-safe.

Precise evidence language prevents false confidence.

---

# 58. Definition of Good UNLOCK Testing

Good testing should make us confident that:

* immutable learning history remains intact;
* derived state changes only through accepted logic;
* deterministic rules remain reproducible;
* DailyPlan behavior remains stable;
* retries do not duplicate learning evidence;
* Course and learner ownership boundaries remain enforced;
* database constraints protect important invariants;
* critical learner flows work across layers;
* algorithm changes are detectable;
* regressions are caught close to their source;
* refactoring can happen without fear;
* evidence claims accurately match what was actually tested.

---

# 59. Key Principle

> Testing is evidence, not ceremony.

Use the smallest sufficient set of trustworthy evidence for the risk being changed.

Preserve valid evidence until relevant changes invalidate it.

Escalate when the risk requires broader proof.

Do not confuse more test execution with more confidence.

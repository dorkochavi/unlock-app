# UNLOCK Testing Strategy

Status: Active testing guide

Purpose: define how UNLOCK should be tested, what kinds of tests belong in each layer, and what quality standards apply to learning-critical behavior.

Testing exists to protect product behavior, data integrity, and learning logic.

Tests should not exist merely to increase coverage numbers.

---

## 1. Testing Principles

UNLOCK tests should prioritize:

1. learning correctness;
2. data integrity;
3. deterministic behavior;
4. critical user flows;
5. regression protection.

Prefer tests that answer:

> "If this behavior changes incorrectly, will the test catch it?"

Avoid tests that only prove that implementation details exist.

---

## 2. Testing Pyramid

Preferred testing order:

```text
Many focused unit tests
↓
Fewer integration tests
↓
A small number of critical end-to-end tests
```

Do not attempt to test everything through the browser.

Core learning logic should be testable without UI or network dependencies.

---

## 3. Unit Tests

Unit tests are the primary test type for deterministic domain logic.

Use unit tests for:

- Learning Engine calculations;
- mastery updates;
- review scheduling;
- misconception logic;
- confidence-related calculations;
- average response-time logic;
- exam-date resolution;
- Next Best Action ranking;
- eligibility rules;
- verification-state transitions;
- pure formatting or locale utilities where useful.

Unit tests should be:

- fast;
- deterministic;
- independent;
- easy to understand;
- explicit about inputs and expected outputs.

---

## 4. Learning Engine Tests

Learning Engine behavior requires especially strong test coverage.

For each meaningful rule, tests should include:

- normal case;
- boundary case;
- missing/insufficient data;
- repeated behavior;
- contradictory signals where applicable;
- regression cases discovered from real usage.

Example style:

```ts
it("increases misconception_hits after repeated incorrect answers", () => {
  // Arrange
  // Act
  // Assert
});
```

Avoid vague assertions such as:

```ts
expect(result).toBeTruthy();
```

Prefer explicit expectations.

---

## 5. Golden Learning Scenarios

For important Learning Engine behavior, maintain stable scenario-based tests.

A golden scenario represents a known learner history and expected engine output.

Example:

```text
Scenario:
- learner answered Question A incorrectly twice;
- confidence was high;
- last review was yesterday;
- exam is in 4 days.

Expected:
- misconception signal increases;
- Question A remains eligible for review;
- priority is higher than a mastered Question B.
```

Golden scenarios should protect learning behavior when formulas evolve.

When intentional engine behavior changes, update the scenario only after the change is documented and approved.

---

## 6. Engine Versioning Tests

When learning logic becomes versioned, tests should verify that:

- the active engine version is explicit;
- historical Attempts remain unchanged;
- different engine versions can produce different derived state without rewriting history;
- the version used for important calculations can be traced where required.

Do not introduce versioning infrastructure before the Learning Engine implementation actually requires it.

---

## 7. Next Best Action Tests

Next Best Action tests should verify ranking behavior, not only presence of output.

Examples:

- overdue review outranks non-due review when other factors are equal;
- stronger misconception evidence changes ranking as designed;
- exam urgency affects ranking only when a valid exam date exists;
- no exam urgency is invented when the exam date is null;
- deterministic inputs always produce deterministic ranking.

If ranking ties are possible, tie-breaking behavior should be explicitly defined and tested.

---

## 8. Today Planning Tests

Today planning tests should verify:

- eligible learning items are selected according to approved rules;
- Today Session Items reflect the prepared plan;
- the same active Today Session is reused when appropriate;
- Today is not silently regenerated during resume;
- completed sessions do not behave like active sessions;
- Quiz does not independently alter question selection.

Exact rules should follow `docs/FEATURES/TODAY.md` once that contract exists.

---

## 9. Attempt Tests

Attempt-related tests should protect historical integrity.

Verify that:

- a learner response creates an Attempt;
- the correct user/question relationship is recorded;
- relevant response evidence is preserved;
- an Attempt is not silently rewritten by progress updates;
- duplicate submissions are handled according to the feature contract.

Attempts should be treated as evidence, not mutable progress records.

---

## 10. UserQuestionProgress Tests

Tests should verify that derived Question progress:

- updates from relevant Attempts;
- does not delete history;
- remains learner-specific;
- does not mutate the shared Question;
- uses the approved Learning Engine logic.

Known V1 signals include:

- `mastery_level`;
- `next_review_date`;
- `misconception_hits`;
- `confidence_level`;
- `average_time_seconds`.

Exact expected behavior must be defined before implementing each formula.

---

## 11. Exam Date Tests

At minimum verify:

```text
personal_exam_date > shared/group/course exam date > null
```

Cases:

- both personal and shared dates exist → personal wins;
- only shared date exists → shared date is used;
- neither exists → result is null;
- invalid/missing date does not create artificial urgency.

The exact shared-date model must be finalized during domain/database design.

This logic should exist in one reusable domain location.

---

## 12. AI Tests

AI must not be tested by repeatedly calling a real provider during normal automated tests.

Use mocks or deterministic fixtures.

Test:

- structured-output parsing;
- schema validation;
- provider failure handling;
- invalid model output;
- verification-state transitions;
- generation/verification orchestration.

Do not test whether an LLM is "smart enough" inside the normal unit test suite.

AI quality evaluation is a separate concern from application correctness.

---

## 13. AI Verification Tests

The verification pipeline should eventually test cases such as:

- source supports correct answer;
- source does not support correct answer;
- two answers are plausibly correct;
- explanation contains unsupported information;
- citation is irrelevant;
- malformed structured output;
- verifier failure.

AI-generated content must not become learner-facing when the required verification state has not been reached.

---

## 14. Integration Tests

Integration tests should verify behavior across meaningful boundaries.

Use them when unit tests alone cannot prove the system works correctly.

Examples:

```text
Submit answer
→ create Attempt
→ update UserQuestionProgress
→ update Today Session Item
```

Other candidates:

- user → Course authorization;
- Today Session persistence;
- database constraints;
- RLS policies;
- question verification → learner eligibility.

Keep integration tests focused.

Do not recreate the entire application inside every test.

---

## 15. Database Tests

When the database is introduced, test important constraints and security behavior.

Examples:

- required relationships;
- unique constraints;
- ownership boundaries;
- immutable/history assumptions where enforceable;
- RLS policies;
- user A cannot read user B progress;
- Course without Institution is valid.

Database tests should protect rules that cannot safely rely only on application code.

**Implemented**: `supabase/tests/schema.integration.test.ts` (run via
`npm run test:schema`, deliberately separate from `npm test`) runs the real
initial migration against a real PostgreSQL engine
(`@electric-sql/pglite` — a genuine, WASM-compiled Postgres, not a mock)
and proves required relationships/unique constraints/ownership boundaries/
the evidence-counter-sum check are actually rejected by the database, plus
that a representative valid row chain is accepted. This is real database
verification, not merely "the SQL looks right" — application-layer
in-memory tests (`src/domain/**`, `src/application/**`) do not exercise
real database constraint behavior and never claim to. RLS
allow/deny-by-role behavior specifically is NOT covered by this suite (see
§16) — pglite has no Supabase Auth/role-switching context to test against.

---

## 16. RLS Tests

When Supabase RLS is introduced, RLS testing is required.

At minimum verify:

- learner can access own authorized data;
- learner cannot access another learner's private progress;
- privileged/server operations behave as intended;
- institution-level access is not accidentally granted before institutional rules exist.

RLS is part of feature correctness, not post-launch hardening.

---

## 17. UI Tests

UI tests should focus on meaningful user behavior.

Examples:

- required action is available;
- error state is shown;
- resume state appears correctly;
- a completed session is represented correctly;
- user input triggers the intended application action.

Avoid brittle tests based on:

- exact DOM nesting;
- CSS class names;
- implementation details;
- irrelevant snapshots.

Do not test React simply for rendering static text unless that text represents important behavior.

---

## 18. RTL Tests

Important UI should eventually verify RTL behavior where errors are likely.

Examples:

- Quiz answer layout;
- navigation direction;
- directional icons;
- back/next controls;
- mixed Hebrew/English text;
- progress UI;
- tables/charts.

Not every RTL issue requires automated testing.

Use automated tests where the behavior is stable and important, and visual/manual review where that is more appropriate.

---

## 19. Accessibility Tests

Automated checks can help detect common accessibility issues but do not replace human review.

Important areas include:

- labels;
- semantic elements;
- keyboard interaction;
- focus;
- disabled states;
- error announcements.

Accessibility testing should grow with the UI rather than being postponed until launch.

---

## 20. End-to-End Tests

E2E tests should be introduced when critical flows are stable.

Initial future candidates:

### Flow 1

```text
New learner
→ Course/content available
→ Today ready
→ Start Today
→ Answer questions
→ Complete session
```

### Flow 2

```text
Start Today
→ leave mid-session
→ return
→ resume same session
```

### Flow 3

```text
Answer Question
→ Attempt created
→ progress updated
→ future Today changes
```

Do not introduce a large E2E suite before these flows exist.

Playwright is the intended direction when browser-level testing becomes justified.

---

## 21. Regression Tests

When a real bug is discovered, ask:

> Can this bug reasonably be protected by an automated test?

If yes, add a regression test.

A bug fix without a regression test may allow the same failure to return later.

Do not force a test where automation would be brittle or meaningless.

---

## 22. Test Data

Test fixtures should be:

- small;
- readable;
- intentional;
- easy to modify.

Avoid giant opaque fixtures.

Prefer builders/helpers only when repetition becomes meaningful.

Example:

```ts
createAttempt({
  correct: false,
  confidence: "high",
});
```

is useful when it makes scenarios clearer.

Do not build a large fixture framework prematurely.

---

## 23. Time-Dependent Logic

Learning systems contain significant time-based behavior.

Tests involving time should control the clock explicitly.

Examples:

- `next_review_date`;
- Today session period;
- exam urgency;
- overdue review;
- session expiration.

Do not rely on the developer's real current date/time for deterministic tests.

---

## 24. Randomness

Core V1 learning logic should avoid uncontrolled randomness.

If randomness is intentionally introduced later:

- it must be seeded or injectable in tests;
- deterministic replay should remain possible where learning outcomes depend on it.

A flaky Learning Engine test is unacceptable.

---

## 25. External Services

Tests must not depend unnecessarily on live external services.

Examples:

- AI provider;
- email provider;
- analytics;
- storage.

Use provider boundaries and mocks.

Separate true external integration checks from the standard local test suite.

---

## 26. Test File Placement

Prefer tests close to the code they protect.

Example:

```text
src/
└── lib/
    ├── locale.ts
    └── locale.test.ts
```

For feature code:

```text
src/features/today/
├── ...
└── today-planner.test.ts
```

Large integration/E2E suites may eventually use dedicated directories.

Do not create them until needed.

---

## 27. Naming Tests

Test names should describe behavior.

Prefer:

```text
returns the personal exam date when both personal and shared dates exist
```

over:

```text
testExamDate1
```

A developer should be able to understand the rule from the test output.

---

## 28. What Not to Test

Do not spend time testing:

- framework internals;
- third-party library behavior;
- trivial TypeScript type guarantees;
- static implementation details with no product meaning;
- generated code that provides no project-specific behavior.

Test UNLOCK's behavior.

---

## 29. Coverage

Code coverage percentage is a diagnostic tool, not a product objective.

Do not target arbitrary global percentages.

High-risk learning logic should naturally have strong coverage.

Low-risk presentational code may require less.

A 95% coverage number does not compensate for missing the important scenarios.

---

## 30. Required Checks

Current baseline:

```text
npm run lint
npm run typecheck
npm test
```

Run:

```text
npm run build
```

when changes may affect application/runtime/build behavior or before important integration milestones.

All relevant checks should pass before work is considered complete.

---

## 31. Test Failure Rule

Do not:

- disable;
- skip;
- weaken;
- delete;

a failing test merely to make the suite green unless the test itself is demonstrably incorrect.

If intended product behavior changed:

1. document the behavior change;
2. update the relevant contract/ADR if necessary;
3. update the test.

A failing test may reveal either a code defect or a contract mismatch.

Investigate before changing it.

---

## 32. Current Testing Scope

Current foundation:

- Vitest;
- TypeScript;
- lint;
- typecheck;
- production build validation.

Current focus:

- establish the testing discipline;
- prepare for deterministic domain testing.

Do not add yet:

- React Testing Library;
- Playwright;
- coverage tooling;
- external test services;

until the relevant application behavior exists.

---

## 33. Testing Priority for the First Learning Loop

When the first real learning loop is implemented, testing priority should be:

```text
1. Learning Engine behavior
2. Exam-date resolution
3. Attempt creation
4. UserQuestionProgress update
5. Next Best Action ranking
6. Today planning
7. Today persistence
8. Quiz/application integration
9. UI behavior
10. End-to-end critical flow
```

The core intelligence must be trusted before UI polish is treated as evidence of correctness.

---

## 34. Definition of Good Testing

Good UNLOCK testing should make us confident that:

- learning history is not corrupted;
- deterministic rules remain deterministic;
- adaptive behavior changes only intentionally;
- important boundaries remain separated;
- a user cannot accidentally receive another user's data;
- Today behaves consistently;
- algorithm changes can be detected;
- future refactoring is safer.

The purpose of testing is confidence in behavior, not the appearance of engineering maturity.

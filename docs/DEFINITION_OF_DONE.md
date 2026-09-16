# UNLOCK Definition of Done

Status: Active delivery standard

Purpose: define what "done" means for UNLOCK so features, fixes, refactors, domain logic, and infrastructure changes are not considered complete merely because code runs locally.

A change is done only when it is correct, scoped, testable, maintainable, documented where needed, and safe to build on.

---

## 1. Scope Is Correct

The implemented work matches the approved task.

The change should:

- solve the intended problem;
- stay within the agreed feature or technical scope;
- avoid unrelated feature additions;
- avoid speculative architecture;
- avoid unnecessary refactors.

If useful future work is discovered, document it separately rather than silently expanding the current task.

---

## 2. Product Behavior Is Correct

The implemented behavior matches:

- `docs/MASTER_SPEC.md`;
- `docs/PRODUCT.md`;
- the relevant feature contract;
- relevant ADRs;
- the domain glossary.

Do not treat "the UI looks right" as proof that the product behavior is correct.

If documentation conflicts, resolve the conflict before implementation is considered done.

---

## 3. Type Safety Is Preserved

TypeScript should remain meaningful.

Requirements:

- no unnecessary `any`;
- domain types should be explicit where appropriate;
- unsafe casts should be avoided;
- important inputs and outputs should have clear contracts.

A passing build does not justify weakening types.

---

## 4. Lint Passes

Relevant work must pass:

```bash
npm run lint
```

Do not disable lint rules merely to make the check pass unless the rule itself is intentionally changed and justified.

---

## 5. Typecheck Passes

Relevant work must pass:

```bash
npm run typecheck
```

Type errors should be resolved rather than hidden.

---

## 6. Relevant Tests Exist and Pass

Tests should be added when the change introduces or modifies meaningful behavior.

Testing should prioritize:

- Learning Engine behavior;
- domain rules;
- data integrity;
- ranking logic;
- persistence behavior;
- security boundaries;
- regression-prone behavior.

Run:

```bash
npm test
```

Do not add tests simply to increase a coverage number.

---

## 7. Production Build Passes When Relevant

Run:

```bash
npm run build
```

when a change may affect:

- routing;
- Next.js runtime behavior;
- application compilation;
- server/client boundaries;
- configuration;
- deployment behavior;
- major integration work.

Before important milestones, the production build should pass even if the most recent task was small.

---

## 8. Domain Boundaries Are Preserved

Core learning and business logic should not leak into React components.

Examples of logic that belongs outside presentation code:

- mastery calculations;
- review scheduling;
- misconception updates;
- exam-date resolution;
- Next Best Action ranking;
- Today planning.

Quiz should not become the owner of Today selection logic.

A feature is not done if it works only because responsibilities were mixed together incorrectly.

---

## 9. Learning Data Integrity Is Preserved

Any change affecting learner data must protect historical evidence.

Requirements include:

- raw Attempts remain preserved;
- current progress does not overwrite historical Attempts;
- shared Question data remains separate from learner-specific progress;
- important updates do not create inconsistent partial state;
- engine behavior is versionable where required.

Do not silently mutate historical learning evidence to represent current state.

---

## 10. RTL and Localization Are Correct

User-facing interfaces must follow the product's Hebrew-first, RTL-first direction.

Requirements:

- default language is Hebrew;
- default direction is RTL;
- locale is `he-IL`;
- user-facing copy should use the messages layer;
- directional UI should be checked for RTL behavior;
- mixed Hebrew/English content should remain readable.

Do not scatter hardcoded user-facing strings across components where avoidable.

---

## 11. Accessibility Is Addressed

For meaningful UI changes, consider:

- semantic HTML;
- keyboard access;
- focus behavior;
- accessible labels;
- error communication;
- readable contrast;
- mobile touch targets;
- screen-reader meaning.

Accessibility is part of feature quality, not a separate optional polish phase.

---

## 12. Security Is Preserved

A change is not done if it weakens security for convenience.

Requirements may include:

- secrets remain server-side;
- authorization is enforced at trusted boundaries;
- RLS is used and tested when Supabase is introduced;
- ownership rules are respected;
- user input is validated at important boundaries;
- privileged credentials never reach browser code.

Hiding UI controls is not authorization.

---

## 13. Dependencies Are Justified

Do not add a package merely because it makes a task slightly easier.

Before adding a dependency, consider:

- can the existing stack solve the problem cleanly?
- is the dependency actively needed now?
- what runtime/bundle/maintenance cost does it introduce?
- does it duplicate existing capability?

Large or foundational dependencies require explicit justification.

---

## 14. Documentation Matches Behavior

Documentation should be updated when a change materially affects:

- product behavior;
- domain terminology;
- architecture;
- persistence;
- Learning Engine logic;
- security;
- feature behavior;
- durable technical decisions.

Do not update unrelated documentation just because a code change occurred.

Do not leave important decisions only inside a chat or code comment.

---

## 15. ADR Is Added When Needed

Create or update an Architecture Decision Record when a durable decision materially affects:

- architecture;
- data ownership;
- core domain model;
- persistence strategy;
- external providers;
- security model;
- deployment topology;
- learning-engine strategy.

Small implementation details do not require ADRs.

An ADR should explain why the decision exists, not merely what code was written.

---

## 16. Git State Is Safe

Before considering a task complete:

- review `git status`;
- review relevant diffs;
- confirm no accidental files are included;
- do not discard unrelated user work;
- do not perform destructive Git operations without approval.

Commit, push, merge, rebase, reset, or branch deletion should only happen when explicitly intended.

---

## 17. Error and Edge States Are Considered

A feature should not only work on the happy path.

Where relevant, handle:

- missing data;
- empty state;
- duplicate submission;
- refresh;
- resume;
- network failure;
- unauthorized access;
- invalid input;
- insufficient learner evidence;
- external provider failure.

If an unresolved edge case changes product behavior, document it as an open question rather than inventing behavior.

---

## 18. Analytics Match the Product Question

If the feature requires analytics, events should exist only when they answer a defined question.

For example:

- Did users open Today?
- Did they start?
- Did they complete?
- Did they abandon?

Do not add speculative telemetry without a stated use.

---

## 19. No False Precision

Learner-facing estimates must not imply certainty the system does not have.

For progress, readiness, mastery, or confidence-related displays:

- use insufficient-data states when appropriate;
- avoid exact-looking numbers without enough evidence;
- communicate uncertainty when it matters.

A polished number is not useful if it overstates what UNLOCK actually knows.

---

## 20. Current Scope Classification Is Preserved

Changes should respect whether a capability is:

- V1 REQUIRED;
- ARCHITECTURE-READY;
- DEFERRED.

Do not implement architecture-ready or deferred features merely because they are easy to add.

---

## 21. Completion Report

When finishing a meaningful task, summarize:

1. what changed;
2. which files changed;
3. tests/checks run;
4. known limitations;
5. unresolved questions;
6. any follow-up work intentionally left out.

Do not claim a check passed if it was not run.

Do not hide warnings or failures.

---

## Final Standard

"Done" means:

> The approved behavior works, important rules are protected, the code is understandable, the relevant checks pass, documentation is consistent, and the next developer can safely build on the result.

Code that merely runs is not automatically done.

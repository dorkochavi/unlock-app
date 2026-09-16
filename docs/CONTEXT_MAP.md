# UNLOCK Context Map

Status: Active navigation guide

Purpose: help developers and AI coding agents quickly identify which documents should be read for a given type of task.

This file is intentionally short.

It is a map, not another source of truth.

---

## 1. Always Start Here

For any meaningful UNLOCK implementation task, begin with:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
docs/ARCHITECTURE.md
```

These define:

- product direction;
- V1 scope;
- major boundaries;
- technical structure.

---

## 2. If the Task Changes Product Behavior

Read:

```text
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
docs/FEATURES/<relevant-feature>.md
```

Also check:

```text
docs/OPEN_QUESTIONS.md
```

Use `docs/MASTER_SPEC.md` when the behavior touches product strategy, V1 scope, or a potentially conflicting requirement.

---

## 3. If the Task Changes Architecture

Read:

```text
docs/ARCHITECTURE.md
docs/DECISIONS/
.cursor/rules/architecture.mdc
```

Also inspect:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
```

if the architecture change affects product behavior or scope.

---

## 4. If the Task Changes Learning Logic

Read:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
.cursor/rules/learning-engine.mdc
docs/TESTING.md
```

Also read the focused prototype-learning notes relevant to the signal being changed.

Do not invent missing Learning Engine rules.

If the behavior is not yet known, mark it as unresolved and surface it before implementation.

---

## 5. If the Task Changes Today

Read:

```text
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
docs/ROADMAP.md
docs/FEATURES/TODAY.md
.cursor/rules/product.mdc
.cursor/rules/learning-engine.mdc
```

Critical invariant:

```text
Today planning selects the learning items.
Quiz executes the prepared plan.
```

Do not move Today selection logic into Quiz.

---

## 6. If the Task Changes Quiz

Read:

```text
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
docs/FEATURES/QUIZ.md
docs/TESTING.md
```

Also inspect Today contracts if Quiz is being used in Today mode.

Critical invariant:

```text
Quiz does not independently select Today Questions.
```

---

## 7. If the Task Changes Attempts or Progress

Read:

```text
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
docs/DATABASE.md
docs/TESTING.md
.cursor/rules/database.mdc
.cursor/rules/learning-engine.mdc
```

Critical invariant:

```text
Attempts are historical evidence.
UserQuestionProgress is derived learner state.
```

Do not rewrite Attempt history to represent current progress.

---

## 8. If the Task Changes the Database

Read:

```text
docs/DATABASE.md
docs/DOMAIN_GLOSSARY.md
docs/ARCHITECTURE.md
.cursor/rules/database.mdc
```

Also inspect:

```text
docs/OPEN_QUESTIONS.md
docs/DECISIONS/
```

for unresolved or durable data-model decisions.

Do not infer a future-heavy schema from architecture-ready concepts.

---

## 9. If the Task Changes Authentication or Authorization

Read:

```text
docs/ARCHITECTURE.md
docs/DATABASE.md
.cursor/rules/security.mdc
.cursor/rules/database.mdc
```

When Supabase is introduced, also inspect current RLS policies and related tests.

Critical principle:

```text
The UI is not a security boundary.
```

---

## 10. If the Task Uses AI

Read:

```text
docs/PRODUCT.md
docs/ARCHITECTURE.md
.cursor/rules/ai.mdc
```

For AI-generated Questions, also read the relevant feature/content-verification contract.

Critical principle:

```text
AI is not the Learning Engine.
```

Prefer:

```text
deterministic logic
→ SQL/statistics
→ cached/precomputed logic
→ AI only where justified
```

---

## 11. If the Task Changes UI or Copy

Read:

```text
docs/PRODUCT.md
docs/DEFINITION_OF_DONE.md
.cursor/rules/rtl-i18n.mdc
```

Also inspect:

```text
src/messages/
src/lib/locale.ts
```

Critical defaults:

```text
language: Hebrew
direction: RTL
locale: he-IL
```

User-facing copy should use the messages layer where practical.

---

## 12. If the Task Adds or Changes Tests

Read:

```text
docs/TESTING.md
docs/DEFINITION_OF_DONE.md
```

For learning-critical tests, also inspect:

```text
.cursor/rules/learning-engine.mdc
```

Prefer tests that protect behavior, not implementation details.

---

## 13. If the Task Adds a New Feature

Before coding:

1. read the relevant product/domain docs;
2. check `docs/OPEN_QUESTIONS.md`;
3. create or update the feature contract under `docs/FEATURES/`;
4. identify affected data/domain boundaries;
5. define relevant tests;
6. surface unresolved behavior before implementation.

Use:

```text
docs/FEATURES/FEATURE_TEMPLATE.md
```

---

## 14. If the Task Changes a Durable Decision

Check:

```text
docs/DECISIONS/
```

Create or update an ADR when the change materially affects:

- architecture;
- domain boundaries;
- persistence;
- data ownership;
- security;
- provider strategy;
- deployment;
- Learning Engine strategy.

Do not create ADRs for minor implementation details.

---

## 15. If the Task Is Prototype Recovery

Read:

```text
docs/MASTER_SPEC.md
docs/PROTOTYPE_LEARNINGS_TEMPLATE.md
.cursor/rules/learning-engine.mdc
```

Audit only the behavior currently needed.

Current priority:

```text
mastery_level
next_review_date
misconception_hits
direct inputs to those calculations
```

Do not rebuild the prototype wholesale.

---

## 16. If the Task Is Planning the Next Work

Read:

```text
docs/ROADMAP.md
docs/OPEN_QUESTIONS.md
```

Then confirm that the proposed work supports the current core loop:

```text
Course
→ Content
→ Starter / Today
→ Quiz
→ Attempt
→ Learner State
→ Next Best Action
→ Future Today
```

---

## 17. Documentation Ownership Principle

Avoid duplicating detailed rules across many documents.

Each document should have a primary responsibility.

Preferred ownership:

```text
MASTER_SPEC.md
→ product constitution and high-level system vision

PRODUCT.md
→ practical product map and V1 behavior boundaries

ARCHITECTURE.md
→ technical structure and module boundaries

DOMAIN_GLOSSARY.md
→ canonical terminology

DATABASE.md
→ data-model and persistence decisions

TESTING.md
→ test strategy

ROADMAP.md
→ implementation sequence

FEATURES/*.md
→ feature-specific behavior

DECISIONS/*.md
→ durable decisions and rationale

.cursor/rules/*.mdc
→ concise coding-agent execution rules
```

When a detailed rule already has an owner, other documents should reference it rather than restating it extensively.

---

## 18. Conflict Rule

If two sources appear to conflict:

1. do not silently choose;
2. identify the conflicting statements;
3. check whether one is newer or explicitly more specific;
4. use the Master Spec's current V1 activation guidance where it explicitly overrides broader earlier guidance;
5. surface unresolved conflict before coding.

A hidden interpretation is worse than an explicit open question.

---

## 19. Current Core Context

The current product focus is:

```text
Build the smallest trustworthy adaptive loop.
```

The current implementation priority is not:

- institution management;
- social features;
- advanced gamification;
- autonomous agents;
- native mobile apps;
- broad LMS functionality.

The main question for new work is:

> Does this directly help build, validate, or protect the core adaptive learning loop?

If not, it is probably not the current priority.

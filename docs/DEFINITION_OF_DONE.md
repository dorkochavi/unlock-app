# UNLOCK — Definition of Done

Status: ACTIVE QUALITY STANDARD

Purpose: define the project-wide quality bar that must be satisfied before UNLOCK work is considered complete.

This document defines **what Done means**.

It does not define:

* the current Run;
* Slice sequencing;
* exact verification commands;
* reviewer selection;
* checkpoint workflow;
* commit workflow;
* Git safety policy.

Those responsibilities belong to their dedicated owners.

---

# 1. Scope Is Correct

The completed work must:

* solve the approved problem;
* satisfy the active Slice/Run requirements;
* remain inside explicit scope;
* preserve explicit non-goals;
* avoid unrelated feature additions;
* avoid speculative architecture;
* avoid opportunistic refactors that materially expand the change.

Useful non-blocking future work should be deferred deliberately rather than silently absorbed.

---

# 2. Accepted Behavior Is Correct

Implementation must match the relevant accepted sources.

Depending on the change, these may include:

* accepted ADRs;
* `docs/PRODUCT.md`;
* `docs/UNLOCK_V1_SCOPE.md`;
* `docs/ARCHITECTURE.md`;
* `docs/DOMAIN_GLOSSARY.md`;
* relevant domain documentation;
* explicit feature contract where one exists.

Open questions must remain open until explicitly resolved.

Tests or implementation details must not silently create new product policy.

---

# 3. Repository Reality Is Coherent

The final repository state must be internally understandable.

There should be no unexplained:

* partial implementation;
* contradictory code paths;
* accidental generated files;
* unresolved merge artifacts;
* stale authoritative documentation created by the change;
* hidden dependency on temporary local state.

A fresh developer should be able to understand the completed change from repository reality and the relevant canonical sources.

---

# 4. Architecture Boundaries Are Preserved

The current layered modular-monolith boundaries should remain coherent.

Primary structure:

```text id="2m8fme"
app
→ application
→ domain

infrastructure
→ persistence/provider implementation
```

A change is not Done if it works only by:

* duplicating domain logic in UI/API code;
* bypassing application boundaries;
* embedding product policy in infrastructure;
* creating unnecessary cross-layer coupling;
* introducing speculative abstraction without a current need.

Architecture may evolve when explicitly required, but it should not drift accidentally.

---

# 5. Domain and Learning Integrity Are Preserved

Changes affecting learning behavior must preserve accepted invariants.

Relevant examples include:

* Attempts remain immutable historical evidence;
* QuestionVersions remain immutable content snapshots;
* historical Attempts remain interpretable;
* derived learner state remains distinct from raw evidence;
* deterministic behavior remains deterministic;
* replay/rebuild remains trustworthy where supported;
* learner evidence is not fabricated from planning state.

A change that corrupts learning history or silently changes learning semantics is not Done.

---

# 6. Today / DailyPlan Integrity Is Preserved

Changes affecting Today must preserve accepted current semantics.

Relevant invariants include:

* `DailyPlan` / `DailyPlanItem` are the primary current Today model;
* one DailyPlan per learner per learner-local calendar day;
* same-day plan reuse;
* frozen-plan behavior;
* authoritative persisted item identity;
* active `LEARNER` eligibility rules;
* New Material placement is not learning evidence;
* Skip is resolution, not an incorrect Attempt;
* Manual Practice does not silently resolve Today.

Legacy compatibility behavior may remain where explicitly supported.

It must not redefine the current model accidentally.

---

# 7. Data Integrity Is Preserved

Persistence changes must protect canonical data invariants.

Where relevant:

* required operations are atomic;
* partial writes do not create corrupted state;
* constraints protect true database invariants;
* idempotency prevents duplicate logical writes;
* legitimate distinct actions remain distinct;
* foreign-key relationships remain valid;
* historical evidence is not rewritten.

Migration history must remain forward-only.

---

# 8. Authentication and Authorization Are Preserved

Security-sensitive changes must maintain trusted boundaries.

Where relevant:

* server-side verified identity is authoritative;
* client-provided identity does not override trusted identity;
* authentication and authorization remain distinct;
* ownership is enforced at trusted boundaries;
* protected mutation does not occur before required authorization;
* unauthorized/private resource access fails safely;
* privileged credentials remain server-only.

UI visibility is not authorization.

---

# 9. Secrets and Sensitive Data Remain Protected

A change is not Done if it exposes:

* `DATABASE_URL`;
* service-role credentials;
* tokens;
* cookies;
* passwords;
* authorization headers;
* private environment data;
* sensitive raw internal errors.

Secrets must remain in appropriate server-side configuration.

Do not commit secret material.

---

# 10. Error Behavior Is Controlled

Meaningful failure paths should behave intentionally.

Where relevant, handle:

* invalid input;
* unauthenticated access;
* unauthorized access;
* missing resources;
* duplicate/replayed requests;
* persistence failures;
* external-provider failures;
* empty/insufficient-data states;
* unexpected internal failures.

Client-facing errors should remain stable and non-sensitive.

Do not hide material failures behind silent fallback.

---

# 11. Important Edge Cases Are Addressed

A feature is not Done merely because the primary happy path works.

Consider the edge cases relevant to its risk surface.

Examples:

* retry;
* refresh;
* resume;
* duplicate submission;
* already-resolved state;
* missing timezone;
* absent learner evidence;
* ownership mismatch;
* stale/legacy state;
* concurrent write where relevant.

Unresolved behavior that requires a product decision should remain an explicit open question rather than being guessed.

---

# 12. Type and Contract Quality Is Preserved

TypeScript contracts should remain meaningful.

Avoid:

* unnecessary `any`;
* unsafe casts used to hide real contract mismatches;
* anonymous repeated domain structures when a stable contract exists;
* weakening types merely to satisfy compilation.

Runtime boundaries must still validate untrusted external input where TypeScript alone cannot provide safety.

---

# 13. User-Facing Quality Is Appropriate

For learner/instructor UI changes, quality includes the relevant product requirements.

Where applicable:

* Hebrew-first behavior;
* RTL correctness;
* `he-IL` locale behavior;
* mobile usability;
* readable mixed Hebrew/English content;
* meaningful empty/error/loading states;
* accessible semantic structure;
* keyboard/focus behavior;
* appropriate touch targets.

Accessibility and localization are part of product quality, not optional polish.

---

# 14. Learner-Facing Claims Are Honest

UNLOCK must not present certainty the evidence does not justify.

For outputs involving:

* mastery;
* progress;
* readiness;
* confidence;
* learning recommendations;

avoid false precision.

Use insufficient-data or uncertainty states where appropriate.

A precise-looking number is not quality if the model cannot support it.

---

# 15. Dependencies Are Justified

New dependencies must solve a real current need.

A dependency should not be added merely because:

* it is convenient;
* it may be useful later;
* it creates theoretical flexibility.

Consider:

* whether the existing stack already solves the problem;
* bundle/runtime cost;
* maintenance burden;
* security implications;
* duplication of existing capabilities.

Foundational dependencies require stronger justification.

---

# 16. Relevant Evidence Exists

Done requires sufficient evidence for the risks actually changed.

Evidence may include, depending on scope:

* domain/unit tests;
* application tests;
* route/API tests;
* repository/schema integration;
* browser E2E;
* typecheck;
* lint;
* production build;
* review;
* hosted/manual verification.

Not every change requires every evidence layer.

Operational verification selection and freshness are owned by:

`.claude/rules/testing.md`

The requirement here is only:

> material changed behavior has appropriate fresh evidence.

---

# 17. Evidence Claims Are Precise

Do not overstate verification.

Examples:

Prefer:

> PGlite migration/schema tests passed.

over:

> Production database verified.

Prefer:

> Route tests proved auth-before-DB ordering.

over:

> Security fully verified.

Prefer:

> Playwright proved the tested browser flow.

over:

> The whole application is production-safe.

Done requires honest evidence language.

---

# 18. Material Review Findings Are Resolved

When risk review is required:

* BLOCKER findings must be resolved;
* required CORRECTION findings must be resolved;
* fixes must receive refreshed evidence where they invalidate prior checks.

NON-BLOCKING observations do not automatically become current work.

Reviewer selection belongs to:

`/review-commit`

---

# 19. Durable Documentation Is Consistent

Documentation should be updated only when durable truth changed.

Potential owners include:

* ADR → durable decision;
* `DEV_STATUS` → current durable state;
* `CHATGPT_PLAN` → current execution;
* `OPEN_QUESTIONS` → unresolved decision;
* `FOLLOW_UP_BACKLOG` → intentionally deferred technical work;
* canonical product/domain docs → durable accepted behavior.

Do not leave a material durable decision only in:

* chat;
* terminal output;
* temporary scratch;
* code comment.

Do not update unrelated documentation ceremonially.

---

# 20. Scope Classification Is Preserved

Changes should respect whether a capability is:

* V1 REQUIRED;
* ARCHITECTURE-READY;
* DEFERRED.

Architecture-ready does not mean implement now.

Deferred does not mean forgotten.

Do not silently promote future scope into current implementation.

---

# 21. Repository State Is Safe to Hand Off

Before completion, repository state should be understood.

There should be no hidden uncertainty about:

* intended changed files;
* unrelated user work;
* temporary files;
* pending manual actions;
* remote migration/deployment state.

Git mutation policy belongs to `AGENTS.md` / `CLAUDE.md`.

Definition of Done only requires that the resulting state be clear and safe to continue from.

---

# 22. Manual / Remote Boundaries Are Honest

Local completion must not be confused with remote completion.

Examples:

```text id="7l0zwd"
migration committed + locally/PGlite verified
≠
migration applied to hosted Supabase
```

```text id="5fgdei"
build passes
≠
production deployed
```

```text id="7s8hkq"
mocked auth tests pass
≠
hosted Supabase Auth verified
```

Pending manual gates must be stated clearly.

---

# 23. Definition of Done

Work is Done when:

* approved scope is complete;
* accepted behavior is correct;
* relevant architecture boundaries are preserved;
* learning/data/security invariants remain trustworthy;
* relevant edge cases are handled;
* sufficient fresh evidence exists;
* material review findings are resolved;
* durable documentation matches current truth;
* repository state is safe and understandable;
* remaining manual/remote boundaries are explicit.

---

# Final Standard

> Done means the approved change is correct, trustworthy, proportionally verified, documented where durable truth changed, and safe for the next developer to build on.

> Done does not mean every available test was rerun.

> Done does not mean every future improvement was implemented.

> Done does not mean remote actions occurred when only local evidence exists.

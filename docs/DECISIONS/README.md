# UNLOCK Architecture Decision Records

Status: Active decision log

Purpose: record durable product-architecture and engineering decisions whose rationale should remain understandable over time.

ADRs are for decisions that materially affect:

- architecture;
- domain boundaries;
- persistence;
- data ownership;
- security;
- external providers;
- deployment topology;
- learning-engine strategy;
- major implementation constraints.

Do not create ADRs for minor implementation details.

---

## ADR Format

Each ADR should contain:

- Status
- Context
- Decision
- Consequences
- Alternatives Considered
- Related Documents

Recommended status values:

```text
PROPOSED
ACCEPTED
SUPERSEDED
DEPRECATED
```

If an ADR is superseded, do not delete it.

Link it to the replacement ADR.

---

## Naming

Use sequential numeric prefixes:

```text
001-modular-monolith.md
002-hebrew-rtl-first.md
003-quiz-does-not-select-today-questions.md
```

Keep titles short and descriptive.

---

## Current ADRs

### ADR-001 — Modular Monolith

UNLOCK starts as a modular monolith rather than microservices.

### ADR-002 — Hebrew / RTL First

Hebrew, RTL, and `he-IL` are product defaults from the beginning.

### ADR-003 — Quiz Does Not Select Today Questions

Today planning owns learning-item selection. Quiz executes the prepared plan.

### ADR-004 — AI Is Not the Learning Engine

Core adaptive learning decisions remain deterministic in V1.

### ADR-005 — Attempts Are Immutable

Attempts preserve historical learning evidence and are not rewritten as current progress changes.

### ADR-006 — Course Does Not Require Institution

A Course must be valid independently of an Institution in V1.

### ADR-007 — Cost-Efficient by Default

Prefer deterministic logic and existing infrastructure before adding recurring external or AI cost.

### ADR-008 — FSRS Memory Scheduler

UNLOCK V1 uses an FSRS-family scheduler behind the internal `MemoryScheduler` interface. FSRS owns memory scheduling only; it is not the Learning Engine.

### ADR-009 — Question Versioning

Question is a stable logical identity; QuestionVersion is an immutable content snapshot. Editing a Question creates a new QuestionVersion rather than mutating one an Attempt may reference.

### ADR-010 — Answer Submission Transaction Model

`submitAnswer` runs as one database transaction (Attempt insert, progress update, Today session item update). A transaction-scoped advisory lock keyed by `(user_id, question_id)` serializes concurrent writers — including the very first Attempt on a pair, before any UserQuestionProgress row exists. `Attempt` idempotency is scoped `UNIQUE (user_id, submission_id)`, with explicit conflict-validation against the full canonical command-identity field list (including `selectedAnswer`, `confidenceLevel`, and every evidence-classification-gating field, not just Question/version/session-item) before treating a reused key as a safe retry. TodaySessionItem freezes its selected action/tier/reasons at generation time.

### ADR-011 — Today Is Course-Scoped in V1

UNLOCK V1 Today is course-scoped: `TodaySession` is uniquely keyed by `(user_id, course_id, planned_for_date)`. A learner with multiple active Courses may have multiple Today sessions on the same date. Global cross-course Today is deferred beyond V1.

### ADR-012 — Attempt Replayability and Rebuild Semantics

`Attempt` gains a stable `learningSessionId`; `UserQuestionProgress` gains a matching `retrievalBaselineLearningSessionId`. `isSameLearningSession` is always derived fresh from these two identities, never stored as a relational snapshot (the prior approach could not survive reordering). Rebuild always uses CURRENT engine/scheduler/policy logic, never historical, and uses one fixed rebuild-time `now` for every replay step (proven equivalent to per-step `answeredAt`). Out-of-order online Attempts are reconciled synchronously via a full canonical-order replay in the same transaction — no permanent stale-progress state, no queue. `learningSessionId` ownership is split by Attempt origin: application-derived from `TodaySessionItem.todaySessionId` for Today, client-owned only for manual practice — a client can never claim an unrelated `learningSessionId` for a Today-attached Attempt.

### ADR-013 — PostgreSQL + Supabase as the V1 Persistence Provider

UNLOCK V1 uses PostgreSQL via Supabase (closing `docs/OPEN_QUESTIONS.md` #25 for the database-engine/provider question). Supabase is infrastructure only — no Supabase-specific type/import may appear in `src/domain/` or `src/application/`; a future adapter implementing the existing ports belongs under `src/infrastructure/postgres/` (this ADR's own original text wrongly named `src/services/` — corrected in place once `src/infrastructure/learning/fsrs/` was found to already be the real, committed precedent). RLS is enabled on every table now with zero policies (safe deny-by-default, not a policy decision); real policies wait for `docs/OPEN_QUESTIONS.md` #1 (User↔Course authorization) to be resolved. `users.id` is intended to eventually equal `auth.users.id`, with no FK/default added yet.

### ADR-014 — Question/Answer Model V1

UNLOCK V1 supports exactly two question types, `SINGLE_CHOICE` and `MULTIPLE_CHOICE` (`TRUE_FALSE` is deliberately not a distinct type — it's a `SINGLE_CHOICE` question with two options). `QuestionAnswerDefinition` (`options: {id, content}[]`, `correctOptionIds: string[]`) is the durable persisted-content contract on `question_versions`; `SelectedAnswer` (`string | string[] | null`) is the submitted-answer contract on `Attempt`, always canonicalized (sorted, duplicate-free) before comparison or persistence. Correctness is computed by one pure domain function (`evaluateAnswerCorrectness`), never in SQL. A malformed persisted definition and a malformed submitted answer are two distinct, never-conflated error types — neither is ever silently treated as "incorrect."

---

## Decision Rule

Create an ADR when a future developer may reasonably ask:

> "Why is the system structured this way, and are we allowed to change it?"

If the answer matters beyond one local implementation detail, an ADR is probably appropriate.

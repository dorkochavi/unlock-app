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

---

## Decision Rule

Create an ADR when a future developer may reasonably ask:

> "Why is the system structured this way, and are we allowed to change it?"

If the answer matters beyond one local implementation detail, an ADR is probably appropriate.

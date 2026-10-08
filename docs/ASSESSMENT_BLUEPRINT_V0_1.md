# Assessment Blueprint v0.1 - Design

Status: DESIGNED (design only; Run 2026-10-08-ASSESSMENT-ENGINE-003)
Owner of parent framing: `docs/ASSESSMENT_ENGINE.md` (Sections 11-13; ledger rows AE-011, AE-028, AE-045).
Scope: design-level models only. No code, schema, migration, UI, or AI. Instructor-authored throughout.

## Part 1 - Learning Objectives (Slice C1)

### 1.1 Design model vs persistence model

- **DESIGN MODEL (this Part):** the minimal conceptual shape of a Learning Objective (LO), its relationships, lifecycle, and invariants.
- **PERSISTENCE MODEL: NOT DESIGNED.** No table, column, migration, repository, or DTO is specified here. Field names below are conceptual labels, not schema. Open persistence questions are listed in 1.7 only.

### 1.2 Repository reality used for alignment

- `Topic` (`src/domain/topic/types.ts`): flat, belongs to one Course, `archivedAt: Date | null`, never hard-deleted. No hierarchy or knowledge graph.
- `QuestionAuthoringRecord` carries a single nullable `topicId` (`src/domain/question/types.ts`); publish requires non-null `topicId`; QuestionVersions are immutable.
- No cognitive-level, intended-difficulty, or objective field exists on any domain type (lint doc comments confirm `OBJECTIVE_*`, `COGNITIVE_*`, `DIFFICULTY_*` are META checks that are no-ops today).

### 1.3 Design model (minimal fields)

| Concept | Decision |
|---|---|
| Identity | Stable opaque id, scoped to exactly one Course. Instructor-authored only; **never AI-generated in v0.1**. Id never derived from statement text. |
| Statement | Human-readable free text, Hebrew-first (other languages allowed). Code stores and displays it; **code never interprets its meaning**. Edits do not change identity. |
| Topic relationship | **DECIDED: exactly one required Topic reference** (existing Topic id, same Course, flat). Rationale: Topic is flat and Question has a single `topicId`, so one-to-one-parent keeps `TOPIC_*` roll-ups and per-topic blueprint allocation unambiguous and avoids double counting. A cross-topic outcome is authored as one LO per Topic (or deferred, see OQ candidate 4). |
| Cognitive level | Optional. **Taxonomy unresolved; string-enumerated opt-in.** AE Section 6 offers a revised-Bloom six-level working vocabulary only; the taxonomy choice (Bloom vs SOLO vs Webb DOK) is an open human decision (AE-007). Nothing is closed or validated until it is chosen. Not an inferred field. |
| Intended difficulty guidance | Optional. **Unresolved.** AE 7.1 only names an illustrative label (EASY/MEDIUM/HARD) for *intended* difficulty; no repository enum or band exists. If ever added it is a hypothesis label, never observed difficulty, never coupled to FSRS, and independent of cognitive level (AE 6.1). |
| Lifecycle | `active` / `archived`. **Archive, never delete** (same discipline as Topic/Course). Archived LOs are excluded from default authoring lists and from new associations; existing history and past associations remain valid. No unarchive path designed (matches Topic V1). |
| Question association | **DECIDED direction: Question -> list of LO ids** (association lives on the question side, as `topicId` does today). The LO does not own a list of items; "items for an LO" is a derived query. Logically many-to-many: a question may target several LOs, an LO is targeted by many questions. A question's LO should belong to the question's Topic (a deterministic consistency check, not semantic). |

### 1.4 Future coverage-reporting inputs (not built)

Coverage is deterministic counting over: active LOs of a Course x their Topic x Question->LO associations x (optional) cognitive level. This feeds `OBJECTIVE_MISSING` (item has none), `OBJECTIVE_UNCOVERED` (active LO with zero items), `TOPIC_COVERAGE_GAP`, `TOPIC_CONCENTRATION`, and the Part 2 blueprint cells. All are counts; none require semantics. AE-028 stays LATER.

### 1.5 Invariants

1. Code never infers, extracts, or suggests objectives from question or source text. LOs exist only because an instructor authored them.
2. The Knowledge Map (AE-010) is NOT built or implied; LOs are not knowledge-map nodes and a deterministic keyword "map" is rejected (AE doc 28.3).
3. Objective statements are not linted semantically (no "is this a good objective", no overlap or wording judgement). Only structural checks (non-empty, length cap) are conceivable, and none are specified here.
4. LOs never rewrite history: Attempts and QuestionVersions are untouched; association metadata must not mutate an already-published QuestionVersion (see OQ candidate 3).
5. LO does not alter mastery, scheduling, DailyPlan, or Today semantics. Authoring metadata only.
6. Authorization reuses the existing Course-authoring policy (`canAuthorCourse`) unless an accepted decision says otherwise; unresolved cases fail closed.

### 1.6 Modelable now vs unresolved

- **Safely modelable now:** identity scope, statement as opaque text, required single Topic reference, archive lifecycle, Question->LO direction, counting-based coverage inputs, invariants above.
- **Unresolved (needs human decision):** cognitive taxonomy, intended-difficulty vocabulary, cross-topic LOs, whether association is versioned, persistence shape, ownership/authorship roles, import support.

### 1.7 Candidate OPEN_QUESTIONS items (not yet filed; OPEN_QUESTIONS.md not edited)

1. **Cognitive taxonomy:** Bloom (revised) vs SOLO vs Webb DOK, closed vocabulary or free label (AE-007).
2. **Intended difficulty vocabulary:** enum vs numeric band, and whether it lives on LO, Question, or both.
3. **Association mutability vs immutable QuestionVersions:** is Question->LO a mutable authoring link on the Question record, or snapshotted per QuestionVersion? Historical-coverage reporting depends on it.
4. **Cross-topic objectives:** keep strict one-Topic-per-LO (split by topic), or allow a multi-Topic LO later.
5. **Persistence (relates to OQ-023 / AE-006):** table vs embedded metadata, join table for Question->LO, FK/archive semantics, backfill of existing questions (all have zero LOs).
6. **Ownership/authorization:** which roles author LOs; are LOs per-Course only or reusable across Courses.
7. **Structured Import:** whether import may reference/create LOs, and how unresolved names behave (mirror Topic name resolution or not).
8. **Required vs optional:** whether LO becomes mandatory for publish at some point (v0.1: optional; `OBJECTIVE_MISSING` stays a warning).

## Part 2 - Assessment Blueprint (Slice C2)

_Placeholder - to be designed in Slice C2._

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

Status: DESIGNED (design only). Answers one question: **"what do we intend this assessment set to cover?"** It is an instructor plan, not an AI reading of the course. Persistence: **NOT DESIGNED** (see 2.8).

### 2.1 Dimension decisions (v0.1)

| Dimension | v0.1 | Rationale |
|---|---|---|
| Learning Objective | **IN** (the cell key) | Instructor-authored, stable id (Part 1); the only human-owned coverage target that exists. |
| Topic | **IN, derived** (LO -> its one Topic) | Part 1 fixes one Topic per LO, so a stored topic on a cell would be redundant and could contradict the LO. |
| Question count (min/max) | **IN** | Pure integer arithmetic; the core of AE-011. |
| Total target count | **IN, optional** | Cheap consistency anchor; absent means "no total declared". |
| Required vs optional cell | **IN, derived** (required iff `min >= 1`) | A stored flag would duplicate `min`; `min = 0` means optional. |
| Single target value | **OUT** | Expressible as `min = max`; avoids a third number. |
| Question type | **OUT (unresolved opt-in)** | Pedagogical vs structural vocabulary undecided; `QUESTION_TYPE_MONO` stays a lint concern. |
| Cognitive level | **OUT (unresolved opt-in)** | Taxonomy open (Part 1, AE-007); `COGNITIVE_DISTRIBUTION_SKEWED` stays a no-op. |
| Intended difficulty | **OUT (unresolved opt-in)** | No vocabulary or field exists; `DIFFICULTY_DISTRIBUTION_SKEWED` stays a no-op. |
| Percent weights | **OUT** | Weights are instructor authority; counts are enough and unambiguous. |
| Option policy / redundancy limits | **OUT** | Item-quality lint territory, not coverage intent. |

### 2.2 Recommended v0.1 shape (conceptual labels, not schema)

- **Blueprint:** `id`, `name`, `courseId`, `targetTotal` (nonneg int or absent), `cells[]`.
- **Cell:** `objectiveId` (required, the key), `min` (nonneg int, default 0), `max` (nonneg int or absent = unbounded).
- Future dimensions (type, cognitive, difficulty) may later become optional cell attributes or separate sections. v0.1 neither defines nor validates them.
- Authored by the instructor. Code never proposes cells, counts, or weights.

### 2.3 Plan validation semantics (`validateBlueprint`)

Inputs: the blueprint and the **declared-objective universe supplied by the caller** (`{id, topicId}[]`, already filtered to active LOs of the Course). Code does not fetch or infer objectives. Output is a deterministic issue list (sorted by code, then objectiveId); bad plan data yields issues, never exceptions.

| Code | Severity | Rule |
|---|---|---|
| `BLUEPRINT_CELL_COUNT_INVALID` | ERROR | `min`/`max` not a finite nonneg integer (NaN, negative, fractional). |
| `BLUEPRINT_CELL_MIN_GT_MAX` | ERROR | `max` present and `min > max`. |
| `BLUEPRINT_CELL_DUPLICATE` | ERROR | Same `objectiveId` in more than one cell (reported once per id; never merged or summed). |
| `BLUEPRINT_OBJECTIVE_UNKNOWN` | ERROR | Cell `objectiveId` not in the declared universe. Such cells are excluded from every total below. |
| `BLUEPRINT_TOTAL_INVALID` | ERROR | `targetTotal` present but not a nonneg integer. |
| `BLUEPRINT_TOTAL_BELOW_MINS` | ERROR | `targetTotal < sum(min)` over valid cells. |
| `BLUEPRINT_TOTAL_ABOVE_MAXES` | ERROR | Every valid cell has a `max` and `targetTotal > sum(max)`. If any cell is unbounded, this rule is skipped. |
| `BLUEPRINT_OBJECTIVE_UNALLOCATED` | WARNING | Declared objective with no cell. Informational: "no intent stated", never "should be covered". |

Valid cells for the sums = cells that are not duplicate-id, unknown-objective, count-invalid, or min>max (a duplicated id contributes none of its cells). Zero rules: `min = 0` is valid (optional cell). `max = 0` is valid and means **explicitly excluded** (any linked question is overallocated). A blueprint with zero cells is valid (every declared objective is then unallocated). `targetTotal = 0` is valid only if all valid mins are 0 (follows from BELOW_MINS).
Plan arithmetic assumes one objective per question; a multi-objective question can make the distinct total smaller than `sum(min)`, which is not a plan error (OQ 6).

### 2.4 Coverage comparison semantics (`compareCoverage`)

Inputs: blueprint, declared universe, and `items: {questionId, objectiveIds[]}[]` supplied by the caller. Pure and deterministic; no clock, no I/O, no input mutation.

- **Item normalization:** duplicate `questionId` -> first occurrence wins; later ones are listed in `duplicateQuestionIds` and not counted. Duplicate ids inside one `objectiveIds` collapse. Ids not in the universe are not counted and are listed in `unknownObjectiveRefs` (`{questionId, objectiveId}`).
- **Multi-objective rule (DECIDED):** a question linked to k declared objectives counts **once toward each** of those k objectives (`actual(O)` = distinct questions linking O). The **total counts distinct questions**, so `sum(actual)` may exceed the total. `targetTotal` is compared with the distinct total.
- **No-objective question:** a question whose declared-objective set is empty is listed in `unlinkedQuestionIds`. It counts in the distinct total but toward no objective and no topic. It is reported, never guessed or auto-assigned.
- **Per-cell status** (valid cells only; others are surfaced by validation): `UNDER` (`actual < min`), `OVER` (`max` present and `actual > max`), else `OK`.
- **Unallocated objectives:** declared objectives with no valid cell are reported with their `actual` and no status.
- **Total status:** if `targetTotal` is valid and present: `UNDER` / `OVER` / `OK` vs the distinct total; otherwise `NOT_EVALUATED`.
- **Coverage:** `covered = |declared objectives with actual >= 1|`, `declared = |universe|`, `ratio = covered / declared`, `ratio = null` when `declared = 0`. Blueprint-independent.
- **Distribution summary:** per declared objective `{objectiveId, actual}` plus `{min, max}` if a valid cell exists. Counts only.
- **Topic roll-up (LO -> Topic):** per `topicId` in the universe: `declaredObjectives`, `coveredObjectives`, `distinctQuestions` (distinct questions linked to any of its objectives), `sumMin`, `sumMax` (null if any of its cells is unbounded or none exist). Topics with no declared objectives do not appear.
- **Ordering:** every output list is sorted by id ascending (code-unit order), so results are input-order independent.

### 2.5 HARD BOUNDARY: deterministic coverage vs pedagogical quality

Code states facts: "O3 has 0 allocated questions", "O5 exceeds its max of 4", "topic T covers 2 of 5 objectives". Code must **never** state or imply that O3 deserves 30%, that a count is the right amount, that an objective is important or well worded, or that a linked question actually tests its objective (that link is instructor-supplied metadata, trusted as given). Counts, minimums, maximums, and the total are instructor authority.

### 2.6 Separation of concerns and mapping to existing policy

| Concern | Owner | Notes |
|---|---|---|
| Plan (what to cover) | **Blueprint** (this Part, AE-011) | Instructor-authored data + `validateBlueprint`. |
| Item and set quality | **Question Linter** (AE Sections 10-11) | Unchanged; gains no blueprint knowledge. |
| Plan vs items | **Coverage Checker** (AE-028, stays LATER as a product feature) | `compareCoverage` is a pure design-level prototype only; not wired. |

No merge into question-lint. Blueprint/Coverage emit their own `BLUEPRINT_*` facts and add no lint code or threshold. When a later Slice wires them (by name only, no duplicated policy):
- `actual = 0` on a declared objective carries the meaning of `OBJECTIVE_UNCOVERED`; an item with no objective is `OBJECTIVE_MISSING`; a topic with `coveredObjectives = 0` is `TOPIC_COVERAGE_GAP`.
- Blueprint `max` is an explicit instructor limit; the lint default `TOPIC_CONCENTRATION` (> 40%) is a default for when no blueprint speaks. Precedence is a wiring decision (OQ 7).
- `COGNITIVE_/DIFFICULTY_DISTRIBUTION_SKEWED` and `CONCEPT_UNDER/OVERCOVERED` remain no-ops (dimension OUT, or needs the Knowledge Map).

### 2.7 C3 justification and contract

A pure prototype in C3 **is justified**: every rule above is closed-form integer arithmetic over plain types with no persistence, vocabulary, or semantic input. **No residual ambiguity blocks C3**; the items in 2.8 affect persistence and wiring only. Contract (plain types, no Date/I/O, readonly inputs, never throws on bad plan data):

- Types: `BlueprintCell {objectiveId; min; max: number | null}`; `Blueprint {id; name; courseId; targetTotal: number | null; cells}`; `DeclaredObjective {id; topicId}`; `CoverageItem {questionId; objectiveIds}`; `BlueprintIssue {code; severity; objectiveId?; message}`.
- `validateBlueprint(blueprint, declaredObjectives): BlueprintIssue[]` per 2.3.
- `compareCoverage(blueprint, declaredObjectives, items): CoverageReport` per 2.4; `CoverageReport {totalDistinctQuestions; totalStatus; cells[]; unallocated[]; unlinkedQuestionIds; unknownObjectiveRefs; duplicateQuestionIds; coverage {covered, declared, ratio}; topics[]}`.
- Same input -> deep-equal output; no input mutation.

### 2.8 Candidate OPEN_QUESTIONS (not filed; OPEN_QUESTIONS.md not edited)

1. **Persistence (OQ-023 / AE-006):** table vs JSON, cardinality per Course, behaviour when an LO referenced by a cell is archived.
2. **Versioning:** is a blueprint mutable, or snapshotted when a set is checked against it?
3. **Authorization:** which roles author blueprints (default `canAuthorCourse`).
4. **Optional dimensions:** when and in what vocabulary to add question type, cognitive, and difficulty.
5. **Quick mode:** default blueprint shape for short quizzes (AE 13.3), and whether code may generate any default.
6. **Multi-objective questions:** should planning discount them, or assume one objective per question?
7. **Precedence:** blueprint `max` vs lint default 40% concentration; archived LOs in cells.
8. **Items scope:** which set is compared (course, topic, draft batch); whether archived/unpublished questions count.

### Resolved in the C3 prototype

Smallest-consistent readings where this doc is not explicit (verified against `blueprint.ts`):

1. Duplicate `questionId`: items are canonically sorted by (questionId, sorted objective set) before taking the first, so output is input-order independent.
2. UNALLOCATED: in `validateBlueprint` = no cell of any kind references the objective; in `compareCoverage` = no VALID cell does.
3. `TOTAL_ABOVE_MAXES` requires at least one valid cell (an empty plan stays valid) and all valid cells bounded.
4. Cell defects stack independently per cell; `CELL_DUPLICATE` is emitted once per objective id.
5. Within a code, issues without `objectiveId` sort before those with one; ties broken by message.
6. Invalid `targetTotal` => total rules skipped in validation and `totalStatus` is `NOT_EVALUATED` (also when no total is declared).
7. `max` undefined is treated as null (unbounded); non-string ids are skipped (items) or reported as unknown (cells).
8. A duplicated declared-universe id is deduped; the smallest `topicId` wins.
9. `duplicateQuestionIds` lists each repeated id once.
10. `unknownObjectiveRefs` are deduped per (question, objective) and only from the first occurrence of a question.
11. Cell counts and `targetTotal` must be safe non-negative integers.
12. `CoverageReport` also exposes `distribution[]`: one entry per declared objective `{objectiveId, actual}`, plus `min`/`max` only when a valid cell exists (no per-entry status; status lives in `cells[]`).
13. Topic `sumMin`/`sumMax` use valid cells only; `sumMax` is null if any valid cell is unbounded or the Topic has none.

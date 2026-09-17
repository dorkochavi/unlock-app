# UNLOCK V1 Physical Persistence Schema (Design Only)

Status: DESIGN — no migration exists yet; this document is a design contract,
not SQL. Companion to `docs/DATABASE.md` (conceptual data model) and
`docs/DECISIONS/009-question-versioning.md` / `010-answer-submission-transaction-model.md`
(the durable decisions this schema implements). Written during the overnight
session that began at commit `ba3fc2f`; see `OVERNIGHT_REPORT.md` (repo root,
not committed) for the audit that produced several of the constraints below.

Do not create migrations from this document without separately confirming
final column types/enum representations with whoever owns the Supabase
setup — this document fixes *relationships and invariants*, and is
deliberately non-committal about a few implementation-detail choices noted
inline (native Postgres `ENUM` vs. `CHECK (... IN (...))`, exact numeric
precision, etc.).

---

## Conventions used throughout

- All primary keys are `uuid`.
- All timestamps are `timestamptz`, stored UTC (`docs/DATABASE.md` §25).
- "Never deleted" means: V1 defines no application code path or cascade that
  removes the row; a future retirement/soft-delete mechanism (`docs/DATABASE.md`
  §37/§38, still OPEN) may add a status flag later without needing this
  document to change.
- Composite foreign keys are used in several places specifically to make an
  invariant a *database* guarantee rather than an application-only promise —
  each one is called out with the specific risk it closes (found during the
  Phase 2 audit in `OVERNIGHT_REPORT.md`).
- `ON DELETE RESTRICT` (the default assumed everywhere unless stated
  otherwise) is chosen over `CASCADE` wherever a cascade could silently
  destroy historical evidence or a frozen decision snapshot — consistent
  with `docs/ARCHITECTURE.md` §12 and ADR-005. This is deliberately
  conservative; it can be relaxed later once deletion/retirement semantics
  (`docs/DATABASE.md` §37/§38) are actually decided, which this document
  does not do.

---

## `users`

Conceptual mapping for Supabase Auth (not implemented): a `public.users`
profile row with `id` equal to the corresponding `auth.users.id` (1:1,
`id` is both PK and the FK target). No Supabase code is written here.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK; conceptually `= auth.users.id` |
| `created_at` | timestamptz | no | default `now()` |

- **Unique constraints**: PK only.
- **Mutable**: none beyond what Supabase Auth itself owns.
- **Source of truth**: identity only; `docs/DATABASE.md` §3 — "do not add
  profile complexity unless required."
- **Unresolved**: nothing beyond `docs/OPEN_QUESTIONS.md` #1 (User↔Course
  relationship), which this table does not address — see `courses` below.

---

## `courses`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `owner_user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `title` | text | no | |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

- **Unique constraints**: none beyond PK.
- **Mutable**: `title`, `updated_at` — shared content metadata, safe to edit
  in place (`docs/DECISIONS/009-question-versioning.md`'s immutability
  principle applies to *Question content*, not Course metadata).
- **Delete behavior**: not addressed; no code path deletes a Course in V1.
- **Source of truth**: shared content (`docs/DATABASE.md` §2).
- **Explicitly UNRESOLVED, not decided here**: `owner_user_id` is the
  "direct owner field on Course" option from `docs/DATABASE.md` §5's three
  candidates — chosen only as the minimum needed to make this table
  concrete, **not** a closure of `docs/OPEN_QUESTIONS.md` #1. A future
  Enrollment/multi-access model can be added additively (a separate
  `course_access` table) without changing this column.
- No `institution_id` (ADR-006).

---

## `materials`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `course_id` | uuid | no | FK → `courses.id`, `ON DELETE RESTRICT` |
| `title` | text | no | |
| `material_type` | text | no | **UNRESOLVED**: candidate values not finalized anywhere in docs |
| `source_reference` | text | yes | |
| `created_by` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

- **Mutable**: `title`, `source_reference`, `updated_at`.
- **Source of truth**: shared content.
- Included for completeness (`docs/DATABASE.md` §6); not central to the
  `submitAnswer`/Today vertical slice this session focuses on.

---

## `questions`

Stable logical identity only — see ADR-009.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `course_id` | uuid | no | FK → `courses.id`, `ON DELETE RESTRICT` |
| `material_id` | uuid | yes | FK → `materials.id`, `ON DELETE SET NULL` |
| `current_version_id` | uuid | yes* | FK → `question_versions.id`. See note below. |
| `verification_state` | text | yes | candidate values per `docs/DATABASE.md` §24 (`UNVERIFIED`/`SOURCE_LINKED`/`RULE_VALIDATED`/`AI_VERIFIED`/`HUMAN_APPROVED`/`REJECTED`) — listed as candidates there, not finalized |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

- **Unique constraints**: `UNIQUE (id, course_id)` — exists purely so
  `attempts` and `today_session_items` can composite-FK against
  `(question_id, course_id)`, enforcing that an Attempt's `course_id` can
  never diverge from its Question's actual Course (Phase 2 audit finding
  #19 — this was previously unenforced).
- **`current_version_id` nullability note (\*)**: `questions` and
  `question_versions` reference each other (`questions.current_version_id →
  question_versions.id`, `question_versions.question_id → questions.id`),
  which cannot both be declared `NOT NULL` without either a bootstrapping
  step or a deferred constraint. This document chooses the simpler option:
  `current_version_id` is nullable at the column level, with an
  **application-level invariant** — a Question must have its
  `current_version_id` set (in the same transaction as creating its first
  `QuestionVersion`) before it is servable to a learner. A `DEFERRABLE
  INITIALLY DEFERRED` FK was considered and rejected here as unnecessary
  mechanism for a one-time bootstrapping step that content-authoring flows
  (not part of this session's vertical slice) already control.
- **Mutable**: `current_version_id` (repointed on edit), `material_id`,
  `verification_state`, `updated_at`. **Immutable in spirit**: `course_id`
  should not move a Question between Courses (no product requirement for
  this; not physically prevented, flagged as an application-level
  expectation, not a DB constraint, since there's no stated need for one).
- **Delete behavior**: `ON DELETE RESTRICT` from `question_versions` (see
  below) means a Question can never actually be deleted once it has any
  version — matching `docs/DATABASE.md` §37's "retire, don't delete"
  principle without this document deciding the retirement mechanism itself.
- **Source of truth**: shared content, identity only.

---

## `question_versions`

Immutable content snapshot — see ADR-009. **Never updated after creation,
never deleted.**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `question_id` | uuid | no | FK → `questions.id`, `ON DELETE RESTRICT` |
| `version_number` | int | no | monotonic per Question, for human readability only |
| `prompt` | text | no | |
| `answer_options` | jsonb | no | **UNRESOLVED shape** — `docs/DATABASE.md` §9 (normalized table vs. JSON) is still OPEN; JSONB used here as the simplest V1 placeholder, not a closure of that question |
| `correct_answer` | jsonb | no | same shape caveat as `answer_options` |
| `explanation` | text | yes | |
| `created_at` | timestamptz | no | the only timestamp this table needs — **no `updated_at`**, since a version is never updated |

- **Unique constraints**: `UNIQUE (question_id, version_number)`;
  `UNIQUE (question_id, id)` — the latter exists purely so `attempts` and
  `today_session_items` can composite-FK against `(question_id,
  question_version_id)`, enforcing that a referenced version actually
  belongs to the referenced Question (Phase 2 audit findings #3/#20 —
  previously unenforced).
- **Mutable columns**: none. This is the entire point of the table.
- **Delete behavior**: never deleted (`ON DELETE RESTRICT` from `questions`
  above means the parent can't be removed out from under it either).
- **Source of truth**: content the learner actually saw — this table, not
  `questions`, is what `Attempt.questionVersionId` anchors to.

---

## `attempts`

Immutable historical evidence — ADR-005. **Never updated after creation.**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `submission_id` | text | no | idempotency key, see below |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `course_id` | uuid | no | see composite FK below |
| `question_id` | uuid | no | see composite FK below |
| `question_version_id` | uuid | no | see composite FK below |
| `today_session_item_id` | uuid | yes | see composite FK below; null = manual practice / no Today context |
| `learning_session_id` | text | yes | **ADR-012 §5**: stable, intrinsic identity of the continuous learning session/occasion this Attempt belongs to. Ownership is split by origin: for a Today-attached Attempt (`today_session_item_id` not null) this is APPLICATION-derived from that item's `today_session_id`, never the client's claim; for manual practice (`today_session_item_id` null) the client supplies and owns a stable token, and it participates in the idempotency command-identity comparison only in that case. This is what replaced the earlier, insufficient idea of persisting the `isSameLearningSession` boolean itself — see the Replay/Rebuild Contract section below |
| `answered_at` | timestamptz | no | client-captured event time |
| `is_correct` | boolean | no | server-computed from `selected_answer` vs. the referenced `QuestionVersion`'s correct answer — **not** independently client-supplied |
| `selected_answer` | jsonb | yes | matches the domain type's `string \| number \| null` |
| `confidence_level` | text | yes | `low` / `medium` / `high` |
| `response_time_seconds` | numeric | yes | `CHECK (response_time_seconds IS NULL OR response_time_seconds >= 0)` |
| `assistance_used` | text | no | `NONE` / `FIFTY_FIFTY` / `HINT` / `SECOND_ATTEMPT` / `ANSWER_REVEALED` / `OTHER`; default `NONE` |
| `attempt_number_for_presented_item` | int | no | `CHECK (attempt_number_for_presented_item >= 1)` |
| `suspicious_timing` | boolean | no | server/application-derived (verified, ADR-010); default `false` |
| `answer_was_revealed_before_response` | boolean | no | client-supplied (verified, ADR-010); default `false` |
| `engine_version` | text | no | server processing metadata |
| `created_at` | timestamptz | no | DB persistence time — **distinct from `answered_at`**; default `now()` |

- **Unique constraints**:
  - `UNIQUE (user_id, submission_id)` — the idempotency boundary (ADR-010;
    scoped per-user, not global, to avoid a cross-user collision surface).
- **Foreign keys / composite FKs**:
  - `(question_id, course_id) REFERENCES questions (id, course_id)` —
    closes audit finding #19 (Attempt/Question/Course consistency).
  - `(question_id, question_version_id) REFERENCES question_versions
    (question_id, id)` — closes audit findings #3/#20 (QuestionVersion must
    belong to the referenced Question).
  - `(today_session_item_id, user_id) REFERENCES today_session_items (id,
    user_id)` — closes audit findings **#17/#18**, the two BLOCKING gaps
    found in Phase 2: this makes it a database-enforced impossibility, not
    just an application-level check, for an Attempt to reference a
    TodaySessionItem belonging to a different user. `ON DELETE SET NULL` —
    see `today_session_items` below for why.
- **Mutable columns**: none. Entirely append-only.
- **Delete behavior**: never deleted or updated by application code.
- **Timestamps**: `answered_at` (event time, client) vs. `created_at`
  (persistence time, server) are kept deliberately distinct per
  `docs/DATABASE.md` §25/§27 — they will usually be close but are not the
  same concept, and conflating them would hide clock-skew/backfill cases.
- **Indexes**: `(user_id, question_id, answered_at)` — the natural access
  pattern for both `submitAnswer`'s own progress lookup and any future
  per-question Attempt history view; `(today_session_item_id)` partial
  index `WHERE today_session_item_id IS NOT NULL`.
- **Source of truth**: THE primary historical evidence table.

---

## `user_question_progress`

Fully derived, rebuildable state (`docs/ARCHITECTURE.md` §13). No column
here is independently authoritative — every value is reconstructable from
`attempts` via `applyAttemptToProgress` (see Phase 6 below for the
replay contract and its open questions).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `user_id` | uuid | no | PK part 1; FK → `users.id`, `ON DELETE RESTRICT` |
| `question_id` | uuid | no | PK part 2; FK → `questions.id`, `ON DELETE RESTRICT` |
| `attempt_count` | int | no | default 0, `CHECK (attempt_count >= 0)` |
| `correct_count` | int | no | `CHECK (correct_count >= 0 AND correct_count <= attempt_count)` |
| `last_attempt_at` | timestamptz | yes | |
| `last_correct_at` | timestamptz | yes | |
| `last_incorrect_at` | timestamptz | yes | |
| `memory_stability` | numeric | yes | typed FSRS field — see "Scheduler state" note below |
| `memory_difficulty` | numeric | yes | typed FSRS field |
| `scheduled_review_at` | timestamptz | yes | typed FSRS field — **indexed**, see below |
| `last_review_at` | timestamptz | yes | typed FSRS field |
| `scheduler_review_count` | int | yes | typed FSRS field (`SchedulerMemoryState.reviewCount`) |
| `scheduler_lapse_count` | int | yes | typed FSRS field (`SchedulerMemoryState.lapseCount`) — **see note below, deliberately distinct from `lapse_count`** |
| `scheduler_implementation` | text | yes | `SchedulerImplementationState.implementation`, e.g. `"ts-fsrs"` |
| `scheduler_schema_version` | int | yes | `SchedulerImplementationState.schemaVersion` |
| `scheduler_state` | jsonb | yes | `SchedulerImplementationState.state` — adapter-owned opaque bag |
| `retrieval_baseline_at` | timestamptz | yes | |
| `retrieval_baseline_learning_session_id` | text | yes | **ADR-012**: `learning_session_id` of whichever Attempt currently set/last-moved `retrieval_baseline_at`, tracked in exact lockstep with it. Together with the current Attempt's own `learning_session_id`, this is what `deriveIsSameLearningSession` compares to derive `isSameLearningSession` fresh — never a stored relational snapshot |
| `successful_spaced_retrievals` | int | no | default 0, `CHECK (>= 0)` |
| `lapse_count` | int | no | default 0, `CHECK (>= 0)` — **UNLOCK's own domain-level field, NOT the same as `scheduler_lapse_count`** |
| `last_lapse_at` | timestamptz | yes | |
| `misconception_state` | text | no | `none`/`suspected`/`active`/`recovering`/`resolved`, default `none` |
| `misconception_score` | numeric | no | default 0 |
| `misconception_last_seen_at` | timestamptz | yes | |
| `timed_attempt_count` | int | no | default 0 |
| `average_response_time_seconds` | numeric | yes | |
| `meaningful_attempt_count` | int | no | default 0 |
| `assisted_attempt_count` | int | no | default 0 |
| `low_quality_attempt_count` | int | no | default 0 |
| `invalid_for_mastery_attempt_count` | int | no | default 0 |
| `first_meaningful_evidence_at` | timestamptz | yes | |
| `last_meaningful_evidence_at` | timestamptz | yes | |
| `evidence_strength` | text | no | `insufficient`/`early`/`moderate`/`strong` |
| `mastery_category` | text | no | `not_started`/`learning`/`strengthening`/`mastered` |
| `engine_version` | text | no | |
| `created_at` | timestamptz | no | when this row was first created (first-ever Attempt) |
| `updated_at` | timestamptz | no | derived-snapshot time — matches `context.now`, **not** necessarily the last Attempt's `answeredAt` (`progress-update.ts`'s own design note) |

- **Primary key**: `(user_id, question_id)` — **not** `(user_id, course_id,
  question_id)`. A Question belongs to exactly one Course (`docs/DATABASE.md`
  §7), so `course_id` is already transitively determined via
  `question_id → questions.course_id`; including it in this key would be
  redundant denormalization with no query benefit a join can't provide
  (this was already decided in the prior session; restated here for
  schema completeness).
- **Check constraint** (found and added during this session's audit — a
  real DB-level enforcement of an invariant `src/domain/learning/types.ts`
  already documents in a comment but nothing previously enforced):
  ```sql
  CHECK (
    attempt_count = meaningful_attempt_count + assisted_attempt_count
      + low_quality_attempt_count + invalid_for_mastery_attempt_count
  )
  ```
- **Naming note — do not conflate two different "lapse count" concepts**:
  `scheduler_lapse_count` is FSRS's own internal lapse counter
  (`SchedulerMemoryState.lapseCount`, owned by the scheduler adapter and
  not read by any UNLOCK domain logic outside the scheduler itself);
  `lapse_count` is UNLOCK's own `StateUpdateReason`-driven count, computed
  in `progress-update.ts` from the `isLapse` boolean and consumed by
  `mastery.ts`. They can legitimately diverge (a scheduler-level "again"
  rating isn't automatically the same accounting as UNLOCK's `LAPSE`
  reason) and must never be merged into one column.
- **Scheduler-state persistence — this is a decision this document is
  making explicitly**, because it was previously only discussed verbally
  and never committed to any doc (Phase 2 audit gap #4): **both** typed
  columns and a JSONB blob, matching `SchedulerImplementationState`'s own
  existing split. Typed columns for the cross-adapter fields UNLOCK
  actually needs to query/index (`memory_stability`, `memory_difficulty`,
  `scheduled_review_at`, `last_review_at`, `scheduler_review_count`,
  `scheduler_lapse_count`) — `docs/DATABASE.md` §33 already lists
  "UserQuestionProgress by user and review date" as a likely index
  candidate, which requires a real column, not something buried in JSON.
  One `scheduler_state jsonb` column for the adapter-opaque
  `SchedulerImplementationState.state` bag, tagged by
  `scheduler_implementation`/`scheduler_schema_version`. No ts-fsrs-specific
  column names appear outside that one labeled JSONB blob
  (`docs/DECISIONS/008-fsrs-memory-scheduler.md`'s "no domain module may
  import `ts-fsrs` directly" extends naturally to "no ts-fsrs-specific
  schema columns").
- **Application-layer requirement (not a DB constraint — see Phase 2 audit
  finding #29)**: whatever code reads `scheduler_state` must validate
  `scheduler_implementation` matches the currently-configured adapter and
  `scheduler_schema_version` is one that adapter knows how to interpret,
  and must reject/throw rather than silently misinterpret unrecognized or
  corrupted JSON as valid state. Not implemented in this session (the
  adapter infrastructure this would live in does not exist yet in this
  repo).
- **Mutable**: every derived column, by design — this is the row rewritten
  on every `submitAnswer` for its `(user_id, question_id)`.
- **Delete behavior**: not addressed by application code in V1; a future
  rebuild tool would `UPDATE`/upsert in place rather than delete-then-reinsert
  (keeps the row's `created_at` meaningful), but this is not decided here.
- **Indexes**: `(user_id, scheduled_review_at)` — supports "find due
  reviews," the query `next-best-action.ts`'s `REVIEW_DUE` candidate
  conceptually needs once wired to real data.
- **Source of truth**: none — 100% rebuildable from `attempts`.

---

## `today_sessions`

Persisted decision output (`docs/DATABASE.md` §2's fourth category — not
source-of-truth, not derived-and-rebuildable, a frozen record of what was
decided).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `course_id` | uuid | no | FK → `courses.id`, `ON DELETE RESTRICT` |
| `planned_for_date` | date | no | caller-supplied logical date; no timezone/day-boundary logic here or anywhere in the domain/persistence layer (`docs/OPEN_QUESTIONS.md` #3 remains open) |
| `status` | text | no | candidate values per `docs/DATABASE.md` §17 (`prepared`/`started`/`completed`/`expired`/`abandoned`) — **exact state machine DEFERRED**, see audit findings #14/#15 |
| `engine_version` | text | no | planner version |
| `generated_at` | timestamptz | no | default `now()` |
| `started_at` | timestamptz | yes | |
| `completed_at` | timestamptz | yes | |

- **`course_id` and uniqueness — DECIDED for V1**, see
  `docs/DECISIONS/011-today-is-course-scoped-v1.md`: UNLOCK V1 Today is
  course-scoped. `course_id uuid NOT NULL REFERENCES courses(id)` +
  `UNIQUE (user_id, course_id, planned_for_date)`. A learner with multiple
  active Courses may have multiple `today_sessions` rows for the same
  date, one per Course. Global cross-course Today is deferred beyond V1 —
  not designed further here.
- `getOrCreateTodaySession` is implemented as `INSERT ... ON CONFLICT DO
  NOTHING RETURNING` against this key, with a fallback `SELECT` — race-free
  by Postgres's own unique-index insert semantics (verified by hand-tracing
  in Phase 2, audit finding #11).
- **Mutable**: `status`, `started_at`, `completed_at` — session-execution
  progress, not the frozen plan itself (see `today_session_items`).
- **Delete behavior**: not addressed; no code path deletes a TodaySession in
  normal V1 operation. `today_session_items` cascades from this table (see
  below) — safe specifically because deleting a `today_sessions` row is not
  a normal operation, not because cascading item deletion is intrinsically
  safe.
- **Source of truth**: persisted decision, frozen at generation time for the
  plan-shape columns items carry; mutable for execution-progress columns
  above.

---

## `today_session_items`

The frozen plan, one row per planned Question within a session — ADR-010's
"Today Session freeze model."

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `today_session_id` | uuid | no | FK → `today_sessions.id`, `ON DELETE CASCADE` |
| `user_id` | uuid | no | **denormalized** from `today_sessions.user_id` at insert time — exists purely to support the ownership-enforcing composite FK from `attempts` (Phase 2 audit findings #17/#18); see below |
| `position` | int | no | `CHECK (position >= 0)`; 0-based, matches the domain `TodayPlanItem.position` exactly |
| `question_id` | uuid | no | see composite FK below |
| `question_version_id` | uuid | no | resolved by the **application layer** at plan-persistence time (ADR-010 — `today-planner.ts` itself has no version concept); see composite FK below |
| `action_type` | text | no | `REVIEW_DUE` / `RELEARN_LAPSE` / `REPAIR_MISCONCEPTION` / `STRENGTHEN_MEMORY` — matches `NextBestActionType` exactly |
| `tier` | text | no | `REMEDIATION` / `DUE_REVIEW` / `LOWER_SEVERITY_REPAIR` / `STRENGTHEN` — matches `NextBestActionPriorityTier` exactly |
| `other_applicable_types` | jsonb | no | array of `action_type` values, default `[]` |
| `reasons` | jsonb | no | array of `NextBestActionReason` values, default `[]` |
| `status` | text | no | `pending`/`completed`/`skipped`, default `pending` |
| `completed_at` | timestamptz | yes | |

- **Unique constraints**:
  - `UNIQUE (today_session_id, position)` — no duplicate position within a
    session (`docs/DATABASE.md` §32's own explicit example).
  - `UNIQUE (today_session_id, question_id)` — a Question appears at most
    once per session (matches `today-planner.ts`'s "one question once"
    contract, already guaranteed by ranking's own primary-per-question
    collapse, but enforced here as well so a persistence bug can't
    silently violate it).
  - `UNIQUE (id, user_id)` — exists purely so `attempts` can composite-FK
    against `(today_session_item_id, user_id)`.
- **Foreign keys / composite FKs**:
  - `(today_session_id, user_id) REFERENCES today_sessions (id, user_id)` —
    requires `today_sessions` to also carry `UNIQUE (id, user_id)`; this is
    what keeps the denormalized `user_id` above from ever silently
    disagreeing with its parent session's owner.
  - `(question_id, question_version_id) REFERENCES question_versions
    (question_id, id)` — same consistency enforcement as `attempts`.
- **Deliberately NOT added**: a reverse `completed_by_attempt_id` pointer.
  `attempts.today_session_item_id` already points Attempt → Item; adding an
  Item → Attempt pointer too would create two mutable, independently-writable
  references to the same fact that could disagree — `docs/DATABASE.md` §34's
  "avoid multiple independent writable copies of the same current learning
  signal" applies directly. A caller that needs "which Attempt completed
  this item" queries `attempts WHERE today_session_item_id = ...` instead.
- **Frozen (never recomputed after insert)**: `position`, `action_type`,
  `tier`, `other_applicable_types`, `reasons`, `question_version_id` — this
  is the entire point of the table (ADR-010).
- **Mutable**: `status`, `completed_at` only — execution progress, not the
  plan itself.
- **Delete behavior**: cascades from `today_sessions` (see above); protected
  independently by `attempts.today_session_item_id`'s `ON DELETE SET NULL`
  (not `CASCADE` or `RESTRICT`) — if a `today_session_items` row is ever
  removed via its parent session's cascade, any Attempt that referenced it
  keeps its raw evidence intact and simply loses the "which planned item"
  pointer, rather than either blocking the delete or losing the Attempt.
- **Source of truth**: frozen decision output for the plan-shape columns;
  none for `status`/`completed_at` (those mirror execution state that could
  in principle be rederived from `attempts`, but are stored directly for
  simple, fast reads).

---

## Cross-table invariants and how each is enforced

| Invariant | Mechanism | Found during |
|---|---|---|
| Attempt's `question_version_id` belongs to its `question_id` | composite FK (`attempts`) | Phase 2 audit #3/#20 |
| Attempt's `course_id` matches its Question's actual Course | composite FK (`attempts`) | Phase 2 audit #19 |
| TodaySessionItem's `question_version_id` belongs to its `question_id` | composite FK (`today_session_items`) | Phase 2 audit #20 |
| Attempt cannot reference a TodaySessionItem owned by a different user | composite FK via denormalized `user_id` (`attempts` ↔ `today_session_items`) | **Phase 2 audit #17/#18 — the two BLOCKING gaps this session found and fixed** |
| `UserQuestionProgress`'s four evidence-quality counters sum to `attempt_count` | `CHECK` constraint (`user_question_progress`) | already documented as a domain invariant in `types.ts`, now also DB-enforced |
| No duplicate Attempt for the same logical command | `UNIQUE (user_id, submission_id)` + application-level field comparison on conflict | ADR-010 (prior session) |
| No duplicate TodaySessionItem position/Question within a session | `UNIQUE` constraints (`today_session_items`) | ADR-010 / this session |
| TodaySession uniqueness (one session per user/Course/date) | `UNIQUE (user_id, course_id, planned_for_date)` | ADR-011 (course-scoped V1 decision) |
| QuestionVersion actually belongs to the Question/Course it's claimed for | composite FK (schema) **+** an equivalent application-layer check in `submitAnswer` (`resolveVersionContext`), since in-memory/test callers and any pre-insert validation can't rely on a DB constraint firing | this session's correctness pass |

Trigger-based enforcement was considered and rejected wherever a composite
FK could express the same guarantee declaratively — matching the brief's
"prefer declarative DB constraints... avoid clever trigger-heavy
architecture unless necessary." No triggers appear in this design.

---

## Replay/Rebuild Contract

**Status: DECIDED — see `docs/DECISIONS/012-attempt-replayability-and-rebuild-semantics.md`.**
This section previously recorded the `isSameLearningSession`
reconstructability gap as an open blocker with only a recommendation on
record. ADR-012 closed it: `attempts.learning_session_id` (see the
`attempts` table above) plus `user_question_progress
.retrieval_baseline_learning_session_id` make replay fully truthful, and
`rebuildUserQuestionProgress` (`src/domain/learning/rebuild.ts`) is a real,
tested, pure domain function — not merely a recommendation.

### Canonical ordering

**`answeredAt ASC, created_at ASC, id ASC`** (`rebuild.ts`'s
`sortReplayRecords`).

- `answeredAt ASC` is not a choice — `retrieval-qualification.ts`'s
  `OutOfOrderRetrievalError` already requires Attempts to be fed through
  `applyAttemptToProgress` in nondecreasing `answeredAt` order.
- `created_at ASC` is the tie-break for exactly-equal `answeredAt` values
  (possible under coarse client timestamp granularity, or two attempts
  genuinely submitted at the same instant from different devices): it
  reflects the DB's actual processing/acceptance order — what the live
  system actually did — rather than an arbitrary key. `created_at` is
  deliberately NOT a column on the pure `Attempt` domain type — it lives
  only in the small `AttemptReplayRecord` envelope
  (`AttemptRepository.listForReplay`'s return type), since it is a
  persistence-layer concept, not a fact about learning evidence.
- `id ASC` is the final, purely mechanical tie-break for the
  vanishingly-unlikely case of two rows sharing both `answeredAt` and
  `created_at`.

### `isSameLearningSession` is now reconstructable — RESOLVED (ADR-012)

The prior gap: `applyAttemptToProgress`'s `ProgressUpdateContext
.isSameLearningSession` is relational — "same session as **the previous
qualifying retrieval**" — and which Attempt counts as that baseline can
differ between original (arrival-order) processing and a later
canonical-order replay. A stored `true`/`false` snapshot could not survive
reordering; only comparing two STABLE identities can.

**Resolution**: `attempts.learning_session_id` (intrinsic, reorder-safe)
plus `user_question_progress.retrieval_baseline_learning_session_id`
(tracked in lockstep with `retrieval_baseline_at`). `isSameLearningSession`
is derived fresh, every time, via `deriveIsSameLearningSession`
(`src/domain/learning/learning-session.ts`), by both the online
`submitAnswer` path and `rebuildUserQuestionProgress` — never stored as a
snapshot again. This is proven, not merely asserted: see
`src/domain/learning/__tests__/rebuild.test.ts` (arrival-order-independence,
determinism) and `__tests__/learning-session.test.ts`.

Historical Attempts recorded before `learning_session_id` existed remain
unrecoverable — an unavoidable migration-boundary limitation, not
something backfilled by inventing data.

### Every other `ProgressUpdateContext` input, classified

| Input | Classification | Rationale |
|---|---|---|
| `now` | current-policy input | **Proven (ADR-012 §6), not assumed**: a single fixed rebuild-time value is used for every replay step. Traced every use of `context.now` reachable from `applyAttemptToProgress` — it only affects that step's own `masteryCategory`/`updatedAt`, neither of which is read back as an input by any later step — so this is provably equivalent to using `attempt.answeredAt` as `now` for intermediate steps and rebuild-time `now` only for the final one. See `rebuild.test.ts`'s targeted regression test. |
| `engineVersion` | reconstructable from Attempt/history (as a record only) | Stored per-Attempt as historical metadata (ADR-005/009 spirit), but there is exactly one implementation of `applyAttemptToProgress` today — no dispatch mechanism exists to actually run "the old logic." The stored value documents what ran, it does not select what runs. |
| `memoryScheduler` | current-policy input | Only the currently-configured adapter is available at rebuild time; no historical scheduler-version pinning exists. |
| `retrievalQualificationPolicy` | current-policy input | Threshold values are never persisted anywhere, only used transiently. |
| `isSameLearningSession` | **resolved (ADR-012)** | Derived fresh from `learningSessionId`/`retrievalBaselineLearningSessionId` — see above. No longer an externally-injected `ProgressUpdateContext` override in `submitAnswer`; `SubmitAnswerContext` omits it entirely. |
| `evidenceStrengthPolicy` | current-policy input | Same as `retrievalQualificationPolicy`. |
| `masteryPolicy` | current-policy input | Same. |
| `misconceptionPolicy` | current-policy input | Same. |

### Historical-vs-current rebuild semantics: DECIDED = current logic always (ADR-012)

Six of the eight context inputs above are current-policy inputs by
necessity, not preference — none of `retrievalQualificationPolicy`,
`evidenceStrengthPolicy`, `masteryPolicy`, `misconceptionPolicy`, or the
concrete scheduler implementation/parameters are versioned or persisted
anywhere. **Reproducing exact historical behavior is not achievable with
the schema as currently designed, independent of preference.** ADR-012
makes this an explicit, durable decision: rebuild always uses CURRENT
engine/scheduler/policy logic. `Attempt.engineVersion` remains historical
metadata — it records what engine produced the *original* live-computed
derived state, even after a rebuild recomputes that state under current
logic; `rebuild.ts` never reads it as a dispatch key (tested explicitly,
see `rebuild.test.ts`'s policy-injection test).

### Synchronous out-of-order reconciliation (ADR-012)

`submitAnswer` no longer leaves an out-of-order Attempt's progress
permanently stale. Within the same transaction the Attempt was accepted
in: the immutable Attempt is inserted, `AttemptRepository.listForReplay`
loads every Attempt for the `(user_id, question_id)` pair (including the
new one), `rebuildUserQuestionProgress` replays them canonically, and the
result replaces `user_question_progress` before commit. This is an `O(n)`
full replay rather than an `O(1)` incremental update, judged acceptable
because out-of-order arrival is rare, `n` (one learner's Attempt history on
one Question) is expected to stay small, and correctness of a rare
recovery path matters more than its speed — see ADR-012 for the full
reasoning, stated explicitly rather than assumed.

## Explicitly unresolved in this document (not guessed)

- `TodaySession.status`'s exact state machine (`docs/DATABASE.md` §17).
- `answer_options`/`correct_answer` exact JSON shape (`docs/DATABASE.md` §9).
- `Question.verification_state`'s exact enum (`docs/DATABASE.md` §24 lists
  candidates, not final values).
- `Material.material_type`'s exact enum (no candidate list exists yet).
- User↔Course relationship beyond the minimal `owner_user_id` used here
  (`docs/OPEN_QUESTIONS.md` #1).
- Deletion/retirement mechanics for `questions`/`courses`/`materials`
  (`docs/DATABASE.md` §37/§38) — this schema only ensures deletion cannot
  silently destroy `attempts`/`question_versions` history, not what a
  retirement flow itself looks like.

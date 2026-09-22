# UNLOCK V1 Physical Persistence Schema

Status: **IMPLEMENTED IN REPOSITORY** — thirteen forward-only migrations exist:

1. `20260917203000_initial_schema.sql` — initial PostgreSQL/Supabase schema (ADR-013)
2. `20260918000000_question_answer_model_v1.sql` — Question answer model (ADR-014)
3. `20260919000000_course_membership_v1.sql` — CourseMembership / join policy (ADR-015)
4. `20260920000000_user_timezone_v1.sql` — persisted learner timezone
5. `20260921000000_daily_plan_v1.sql` — `daily_plans` / `daily_plan_items` (ADR-016)
6. `20260922000000_daily_plan_item_state_consistency.sql` — DailyPlanItem state/timestamp constraint
7. `20260923000000_auth_user_provisioning.sql` — Auth user → `public.users` provisioning
8. `20260924000000_daily_plan_answer_attempts.sql` — DailyPlan-linked Attempts / answer flow persistence
9. `20260925000000_daily_plan_new_material_v1.sql` — New Material action/tier persistence support (ADR-017)
10. `20260926000000_course_lifecycle_v1.sql` — Course lifecycle status + optional exam-date metadata
11. `20260927000000_topics_v1.sql` — flat Topic model for Course authoring
12. `20260928000000_question_authoring_v1.sql` — Question draft authoring, Topic association, and publishing persistence support
13. `20260929000000_retire_today_session.sql` — drops the superseded `today_sessions`/`today_session_items` tables and `attempts.today_session_id`/`attempts.today_session_item_id` (ADR-011, fully retired before Run 009 — see that migration's own header comment and ADR-011's current status note)

Hosted Supabase migration state at this Development OS V1.2 baseline:

* migrations #1–#9 have been applied to the hosted Supabase project;
* migrations #10–#12 are committed and locally/PGlite verified but remain pending explicit human remote application;
* migration #13 is committed and locally/PGlite verified but deliberately NOT applied hosted yet — pending the backup-readiness gate (`docs/FOLLOW_UP_BACKLOG.md` FUB-009), per `docs/DEV_STATUS.md`.

Hosted migration state is operational status, not physical-schema authority. It may advance independently of this document and should be tracked in `docs/DEV_STATUS.md`.

The full committed migration chain is exercised by the repository's PostgreSQL-compatible/PGlite schema integration suite. No later migration edits an earlier accepted migration.

This document remains the design-contract companion to the committed migration chain and to `docs/DATABASE.md` (conceptual data model) and the relevant durable decisions, including:

* `009-question-versioning.md`
* `010-answer-submission-transaction-model.md`
* `012-attempt-replayability-and-rebuild-semantics.md`
* `013-supabase-postgresql-as-v1-persistence-provider.md`
* `014-question-answer-model-v1.md`
* `015-user-course-membership-and-join-authorization-model.md`
* `016-global-daily-plan-and-today-view-semantics.md`
* `017-daily-plan-new-material-v1.md`

The composite-FK and CHECK-constraint choices below were produced by iterative adversarial review of this schema against the actual domain/application code. The committed migration files themselves and the cross-table invariant table below are the authoritative record of that reasoning.

The implementation-detail choices this document was previously non-committal about are DECIDED where the committed migrations decide them. Closed value sets use `text` + `CHECK (... IN (...))`, not native PostgreSQL `ENUM`, unless a later accepted migration explicitly changes that approach. Numeric precision remains unconstrained (`numeric`) where documented.

If this document and a committed migration disagree, the migration is authoritative. Update this document to match the migration rather than rewriting accepted migration history.

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
  each one is called out below with the specific risk it closes.
- `ON DELETE RESTRICT` (the default assumed everywhere unless stated
  otherwise) is chosen over `CASCADE` wherever a cascade could silently
  destroy historical evidence or a frozen decision snapshot — consistent
  with `docs/ARCHITECTURE.md` §12 and ADR-005. This is deliberately
  conservative; it can be relaxed later once deletion/retirement semantics
  (`docs/DATABASE.md` §37/§38) are actually decided, which this document
  does not do.

---

## `users`

Supabase Auth identity is mapped 1:1 to `public.users`: the profile row uses
the same UUID as `auth.users.id`. New Auth users are provisioned through
`supabase/migrations/20260923000000_auth_user_provisioning.sql`.
The hosted provisioning path has been verified for real Auth user creation;
the PGlite test harness still uses only a minimal test-only `auth.users`
stand-in and must not be confused with hosted Auth behavior.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK; conceptually `= auth.users.id` |
| `timezone` | text | yes | IANA timezone identifier, `docs/OPEN_QUESTIONS.md` #35 (RESOLVED). `NULL` = not yet detected/persisted — never an implied default. No DB `CHECK`; validity/canonicalization is enforced at the application boundary (`src/domain/user/timezone.ts`). Added by `supabase/migrations/20260920000000_user_timezone_v1.sql` |
| `created_at` | timestamptz | no | default `now()` |

- **Unique constraints**: PK only.
- **Mutable**: `timezone` — detected client-side on first relevant session,
  then server-authoritative (self-service write only, see
  `src/application/user/set-user-timezone.ts`); nothing else beyond what
  Supabase Auth itself owns.
- **Source of truth**: identity only; `docs/DATABASE.md` §3 — "do not add
  profile complexity unless required." `timezone` is the one accepted
  exception (`docs/DATABASE.md` §26).
- **User↔Course relationship**: decided at the product level by
  `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  (`docs/OPEN_QUESTIONS.md` #1) and implemented by
  `supabase/migrations/20260919000000_course_membership_v1.sql` — see
  `courses` and `course_memberships` below. This table itself carries no
  new column for the relationship; `course_memberships` is where it lives.

---

## `courses`

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `owner_user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `title` | text | no | |
| `join_policy` | text | no | `AUTHORIZED_ONLY` (default) / `OPEN`, `CHECK` constraint — ADR-015 §3. Added by `supabase/migrations/20260919000000_course_membership_v1.sql` |
| `created_at` | timestamptz | no | |
| `updated_at` | timestamptz | no | |

- **Unique constraints**: none beyond PK.
- **Mutable**: `title`, `join_policy`, `updated_at` — shared content
  metadata, safe to edit in place
  (`docs/DECISIONS/009-question-versioning.md`'s immutability principle
  applies to *Question content*, not Course metadata). `join_policy` writes
  are gated at the application layer to a management `CourseMembership`
  (OWNER/INSTRUCTOR, non-revoked) on that specific Course — see
  `course_memberships` below — not by a DB constraint (same
  physical-integrity-vs-authorization-policy division as every other table
  here).
- **Delete behavior**: not addressed; no code path deletes a Course in V1.
- **Source of truth**: shared content (`docs/DATABASE.md` §2).
- **User↔Course relationship — DECIDED and IMPLEMENTED**:
  `docs/OPEN_QUESTIONS.md` #1 is resolved by
  `docs/DECISIONS/015-user-course-membership-and-join-authorization-model.md`
  and implemented by `supabase/migrations/20260919000000_course_membership_v1.sql`
  — see `course_memberships` below. `owner_user_id` is **unaffected by
  ADR-015 and remains as creator/legacy metadata only**: `CourseMembership
  .role = OWNER` is the authorization source of truth for Course
  management (checked by every application-layer use case in
  `src/application/course/` via `isManagementRole`); `owner_user_id` must
  **not** independently grant management authorization, and no current code
  path reads it for that purpose. Whether `owner_user_id` is retired in a
  future migration remains open (ADR-015 §1, §12) — this is a documentation
  clarification of already-accepted intent, not a new decision or a schema
  change. The exact authorization source for an `AUTHORIZED_ONLY` Course
  also remains open (ADR-015 §5); until it exists, self-join against an
  `AUTHORIZED_ONLY` Course fails closed (`NOT_AUTHORIZED`) unconditionally —
  see `canSelfJoin` (`src/domain/course/types.ts`) — not a bug, a
  deliberate dead end pending that future decision.
- No `institution_id` (ADR-006).

---

## `course_memberships`

The single explicit User↔Course relationship (ADR-015 §1) — there is no
other path to Course access. Added by
`supabase/migrations/20260919000000_course_membership_v1.sql`.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `course_id` | uuid | no | FK → `courses.id`, `ON DELETE RESTRICT` |
| `role` | text | no | `OWNER` / `INSTRUCTOR` / `LEARNER`, `CHECK` constraint — ADR-015 §2 |
| `joined_at` | timestamptz | no | default `now()` |
| `revoked_at` | timestamptz | yes | `null` = has access; non-null = access revoked (ADR-015 §7) |
| `archived_at` | timestamptz | yes | `null` = participates in this learner's active learning set; non-null = excluded from automatic Today for this learner only, still accessible/manually-practiceable (ADR-015 §7, §9) |
| `created_at` | timestamptz | no | |

- **Unique constraints**: `UNIQUE (user_id, course_id)` — at most one
  membership row per user per Course; also what makes `joinCourse`
  race-free by construction (`INSERT ... ON CONFLICT (user_id, course_id)
  DO NOTHING RETURNING`, mirroring `today_sessions.createIfNotExists`'s own
  established pattern), never a check-then-insert race.
- **Mutable**: `revoked_at`, `archived_at` — independent facts, never
  conflated (ADR-015 §7); each is a single conditional `UPDATE`. `role` is
  not currently mutated by any application code path (no "promote/demote a
  member" use case exists yet — out of scope for this slice).
- **Delete behavior**: never deleted by any application code path.
  Revoking sets `revoked_at`; it does not delete the row, and it never
  touches `attempts`/`user_question_progress` (ADR-015 §8 — learner history
  durability extends to the membership boundary).
- **Source of truth**: access/authorization state
  (`docs/DATABASE.md` §28).
- **Known open follow-ups (not decided by ADR-015, not guessed at by this
  implementation — see `docs/OPEN_QUESTIONS.md` #43)**:
  - Rejoin semantics for a previously-revoked membership: `joinCourse`'s
    `createMembership` is `INSERT ... ON CONFLICT DO NOTHING`, so a second
    join attempt against an existing (possibly revoked) row returns
    `ALREADY_MEMBER` with that row as-is — access is never silently
    restored by self-join, but the `ALREADY_MEMBER` outcome label for a
    still-revoked membership is not a designed product signal, just the
    conservative (non-access-granting) consequence of the current
    idempotent-insert shape.
  - Last-management-member self-revocation: `revokeCourseMembership` does
    not special-case `targetUserId === actorUserId`, nor does it check
    whether the target is the Course's only remaining OWNER/INSTRUCTOR — a
    sole manager can currently revoke their own management access, leaving
    the Course with zero management members. No product decision exists on
    whether this should be prevented.
  - Repeated `revoke`/`setArchived` calls unconditionally overwrite
    `revoked_at`/`archived_at` with the new timestamp (not a no-op once
    already set) — harmless to the boolean access/archive fact either way,
    but not a designed "first revocation wins" audit guarantee.

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

Immutable content snapshot — see ADR-009 (versioning) and ADR-014
(answer/question-type content contract). **Never updated after creation,
never deleted.**

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `question_id` | uuid | no | FK → `questions.id`, `ON DELETE RESTRICT` |
| `version_number` | int | no | monotonic per Question, for human readability only |
| `prompt` | text | no | |
| `question_type` | text | no | `SINGLE_CHOICE` / `MULTIPLE_CHOICE`, `CHECK` constraint — DECIDED, ADR-014 §1. `TRUE_FALSE` is represented as a 2-option `SINGLE_CHOICE`, not a distinct type. Added by the second migration (`supabase/migrations/20260918000000_question_answer_model_v1.sql`): added nullable, backfilled to `SINGLE_CHOICE`, then set `NOT NULL` — no column default left behind, matching this schema's `users.id` precedent |
| `answer_options` | jsonb | no | `AnswerOption[]` (`{id, content}[]`) — DECIDED, ADR-014 §2. Display order is meaningful and frozen at version-creation time |
| `correct_answer` | jsonb | no | `correctOptionIds: string[]` — DECIDED, ADR-014 §2. One shape for both question types; per-type cardinality (exactly one for `SINGLE_CHOICE`, at least one for `MULTIPLE_CHOICE`) is an application-level rule, not a DB `CHECK` (deep JSON-shape validation is application/infrastructure code, per this schema's established style) |
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
| ~~`today_session_id`~~ | uuid | — | **REMOVED** by migration #13 (`20260929000000_retire_today_session.sql`) — the legacy TodaySession columns/tables are fully retired; see the historical FK notes further below, preserved as design-rationale record, not current schema |
| ~~`today_session_item_id`~~ | uuid | — | **REMOVED** by migration #13, same as above |
| `daily_plan_id` | uuid | yes | current DailyPlan linkage; server-derived for DailyPlan answer submission, never authoritative client identity |
| `daily_plan_item_id` | uuid | yes | current DailyPlanItem linkage; nullable for Manual Practice |
| `learning_session_id` | text | yes | **ADR-012 §5**: stable identity of the continuous learning occasion. For a DailyPlan-attached Attempt, the application derives the learning-session identity from authoritative persisted context rather than trusting a client claim. Manual Practice may supply its own stable token under the existing contract. |
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
    TodaySessionItem belonging to a different user. `ON DELETE SET NULL
    (today_session_item_id)` — **column-scoped** (PostgreSQL 15+), not a
    plain `ON DELETE SET NULL` on the whole composite constraint. **Bug
    found and fixed while writing the real migration**: an unqualified
    composite `ON DELETE SET NULL` sets EVERY referencing column to null,
    which here would also null out `attempts.user_id` — violating its
    `NOT NULL` constraint and, in practice, making the delete fail outright
    instead of the intended "Attempt keeps its evidence, only loses the
    pointer" behavior this design always meant. Verified against a real
    PostgreSQL engine, see `supabase/tests/schema.integration.test.ts`'s
    "10b" test. See `today_session_items` below for the rest of the
    reasoning.
  - `(today_session_item_id, today_session_id) REFERENCES
    today_session_items (id, today_session_id)`, `ON DELETE SET NULL
    (today_session_item_id, today_session_id)` — a SEPARATE composite FK
    (not merged into one 3-column FK with `user_id`: `user_id` is `NOT
    NULL`, which would force `MATCH FULL` semantics that then break manual
    practice's nullability requirement for the other two columns — see the
    migration's own comment) closing the gap the missing `today_session_id`
    column left: without it, nothing stopped an Attempt from claiming a
    real `today_session_item_id` while independently claiming a
    *different* `today_session_id` than that item's actual session.
    Verified against the repository's PostgreSQL-compatible integration path.
  - `daily_plan_id` / `daily_plan_item_id` are added by
    `20260924000000_daily_plan_answer_attempts.sql` for the current Today path.
    The migration enforces ownership/parent consistency and mutually exclusive
    planned-item origin: an Attempt cannot simultaneously claim the legacy
    TodaySessionItem path and the DailyPlanItem path. DailyPlan deletion clears
    only the planning pointers so immutable Attempt evidence survives.
- **Mutable columns**: none. Entirely append-only.
- **Delete behavior**: never deleted or updated by application code.
- **Timestamps**: `answered_at` (event time, client) vs. `created_at`
  (persistence time, server) are kept deliberately distinct per
  `docs/DATABASE.md` §25/§27 — they will usually be close but are not the
  same concept, and conflating them would hide clock-skew/backfill cases.
- **Indexes** (as actually implemented — a strict superset of the
  originally-suggested 3-column version, see the migration's own comment
  for why): `(user_id, question_id, answered_at, created_at, id)` — matches
  `rebuild.ts`'s exact canonical replay order (ADR-012 §4), so Postgres can
  satisfy the replay `ORDER BY` via an index scan; `(today_session_item_id)`
  partial index `WHERE today_session_item_id IS NOT NULL`.
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
- **Accepted product taxonomy vs. implemented enum — reconciliation gap,
  not resolved here**: a 2026-09-19 product decision accepts
  `UNKNOWN → EMERGING → DEVELOPING → STRONG → MASTERED` as the qualitative
  mastery progression, and `NONE → SUSPECTED → ACTIVE → RESOLVED` as the
  misconception state model (see `docs/LEARNING_ENGINE.md` §16/§20 and
  `docs/OPEN_QUESTIONS.md` #11/#13). This differs from the **currently
  implemented** `mastery_category` enum above
  (`not_started`/`learning`/`strengthening`/`mastered`, four values) and
  `misconception_state` enum above (`none`/`suspected`/`active`/
  `recovering`/`resolved`, five values including `recovering`, which the
  accepted model does not name as a distinct state) — both enforced today
  by `supabase/migrations/20260917203000_initial_schema.sql`'s CHECK
  constraints and read/written by `src/domain/learning/mastery.ts`,
  `misconception.ts`, and `types.ts`. This document does not change the
  migration or any runtime code to match the new taxonomy — that is
  implementation work, not decided or performed here. Exact numeric
  thresholds for the accepted progression are also not product-locked (see
  `docs/LEARNING_ENGINE_PRODUCTION_COMPOSITION_AUDIT.md`), so reconciling
  the enum shape and the threshold values is one piece of future work, not
  two.
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
- **Indexes**: `questions (course_id)` — supports `listForUser(userId,
  courseId)`'s join to `questions`, the actual query
  `getOrCreateTodaySession` uses. **Deviation from this document's earlier
  draft, found and corrected during migration-writing**: a
  `(user_id, scheduled_review_at)` "find due reviews" index was previously
  suggested here, but the currently-IMPLEMENTED `listForUser` loads ALL
  progress rows for a user+Course and filters/ranks them in pure domain
  code — it never issues a due-date-filtered SQL query — so that index has
  no real query to serve yet and was deliberately NOT added. Revisit if a
  direct due-date query is ever implemented.
- **Source of truth**: none — 100% rebuildable from `attempts`.

---

## `today_sessions` — RETIRED

**This table no longer exists** — dropped by migration #13
(`20260929000000_retire_today_session.sql`), after a runtime reachability
audit found no live `src/app` route creating/retrieving a TodaySession and
hosted Supabase verification found zero rows in it. `DailyPlan` (below) is
the sole active Today persistence model. The section below is preserved as
historical design-rationale record only — do not read it as current schema.

Persisted decision output (`docs/DATABASE.md` §2's fourth category — not
source-of-truth, not derived-and-rebuildable, a frozen record of what was
decided).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `course_id` | uuid | no | FK → `courses.id`, `ON DELETE RESTRICT` |
| `planned_for_date` | date | no | legacy caller-supplied logical date for the TodaySession path. Current DailyPlan Today derives its date from persisted learner timezone at the application boundary; this legacy column does not define the current day-boundary policy. |
| `status` | text | no | candidate values per `docs/DATABASE.md` §17 (`prepared`/`started`/`completed`/`expired`/`abandoned`) — **exact state machine DEFERRED**, see audit findings #14/#15 |
| `engine_version` | text | no | planner version |
| `generated_at` | timestamptz | no | default `now()` |
| `started_at` | timestamptz | yes | |
| `completed_at` | timestamptz | yes | |

- **Legacy identity and uniqueness**: this table remains implemented exactly
  as ADR-011 defined it: `course_id NOT NULL` plus
  `UNIQUE (user_id, course_id, planned_for_date)`.
  ADR-016 supersedes this as the current Today product architecture.
  Current Today generation/orchestration persists one `DailyPlan` per
  learner-local day and reads Course Today / Global Today as views over the
  same `daily_plan_items`. The legacy TodaySession tables remain intact and
  usable by the older path; they are compatibility/history infrastructure,
  not the primary current planner persistence.
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

## `today_session_items` — RETIRED

**This table no longer exists** — dropped by migration #13, same as
`today_sessions` above. Preserved as historical design-rationale record
only.

The frozen plan, one row per planned Question within a session — ADR-010's
"Today Session freeze model."

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `today_session_id` | uuid | no | see composite FK below (as implemented, this is the ONLY FK on this column — not also a separate plain FK, which would be redundant with the composite one) |
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
  - `UNIQUE (id, today_session_id)` — exists purely so `attempts` can
    composite-FK against `(today_session_item_id, today_session_id)` (see
    `attempts`' composite FKs above).
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
  independently by `attempts`' composite FK, whose `ON DELETE SET NULL
  (today_session_item_id)` is column-scoped (not `CASCADE` or `RESTRICT`,
  and not an unqualified `SET NULL` either — see the `attempts` section
  above for the bug that distinction fixes) — if a `today_session_items`
  row is ever removed via its parent session's cascade, any Attempt that
  referenced it keeps its raw evidence AND its correct `user_id` intact,
  and simply loses the "which planned item" pointer, rather than either
  blocking the delete, losing the Attempt, or corrupting its ownership.
- **Source of truth**: frozen decision output for the plan-shape columns;
  none for `status`/`completed_at` (those mirror execution state that could
  in principle be rederived from `attempts`, but are stored directly for
  simple, fast reads).

---

## `daily_plans`

**IMPLEMENTED AND USED BY CURRENT TODAY FLOW — ADR-016 §1.** Added by
`supabase/migrations/20260921000000_daily_plan_v1.sql` and used by the current
DailyPlan generation/orchestration path. One row exists per
`(user_id, planned_for_date)`; Global Today and Course Today are views over
the same persisted `daily_plan_items`. `today_sessions`/`today_session_items`
were the legacy path this migration ran additively alongside; they have
since been dropped entirely by migration #13 — see the "RETIRED" sections
above.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `user_id` | uuid | no | FK → `users.id`, `ON DELETE RESTRICT` |
| `planned_for_date` | date | no | caller-supplied logical date, same contract as `today_sessions.planned_for_date` |
| `status` | text | no | state machine DEFERRED, same honesty as `today_sessions.status` |
| `engine_version` | text | no | |
| `generated_at` | timestamptz | no | default `now()` |
| `started_at` | timestamptz | yes | |
| `completed_at` | timestamptz | yes | |

- **Unique constraints**: `UNIQUE (user_id, planned_for_date)` — the
  schema-level enforcement of "exactly one DailyPlan per user per local
  day" (ADR-016 §1), and what makes plan creation idempotent by
  construction (`INSERT ... ON CONFLICT DO NOTHING`, mirroring
  `today_sessions`' own pattern). `UNIQUE (id, user_id)` exists purely so
  `daily_plan_items` can composite-FK against `(daily_plan_id, user_id)`.
- **Mutable**: `status`, `started_at`, `completed_at`.
- **Delete behavior**: not addressed; no code path deletes a DailyPlan in
  normal V1 operation. `daily_plan_items` cascades from this table.
- **Source of truth**: persisted decision, same category as `today_sessions`.

---

## `daily_plan_items`

**IMPLEMENTED AND USED BY CURRENT TODAY FLOW — ADR-016 §1/§19.** Added by
`supabase/migrations/20260921000000_daily_plan_v1.sql`; its status/timestamp
CHECK constraint was added by
`20260922000000_daily_plan_item_state_consistency.sql`. Current answer/Skip
flows resolve these rows, and ADR-017 New Material values are supported by
`20260925000000_daily_plan_new_material_v1.sql`. The direct successor to
`today_session_items`, with
one structural difference: `course_id` is a genuinely independent, per-item
fact, not a value forced equal to a single parent session's Course — this
is exactly what lets Global Today and Course Today share one underlying
plan (ADR-016 §1).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | no | PK |
| `daily_plan_id` | uuid | no | see composite FK below |
| `user_id` | uuid | no | denormalized from `daily_plans.user_id` at insert time, same reason `today_session_items.user_id` is denormalized |
| `course_id` | uuid | no | **not** forced equal to a parent's single Course — this item's own Course, independently |
| `position` | int | no | `CHECK (position >= 0)`, 0-based |
| `question_id` | uuid | no | see composite FK below |
| `question_version_id` | uuid | no | resolved by the application layer at plan-persistence time, unchanged from `today_session_items`' rule |
| `action_type` | text | no | ordinary Next Best Action values plus the accepted `NEW_LEARNING` value used by ADR-017 New Material fallback |
| `tier` | text | no | ordinary priority tiers plus the accepted `NEW_MATERIAL` tier used by ADR-017 fallback |
| `other_applicable_types` | jsonb | no | array, default `[]` |
| `reasons` | jsonb | no | array, default `[]` |
| `status` | text | no | `pending`/`completed`/`skipped`, default `pending` |
| `resolved_at` | timestamptz | yes | **new relative to `today_session_items`** — set once, the first time this item leaves `pending` (ADR-016 §19), regardless of COMPLETED or SKIPPED |
| `completed_at` | timestamptz | yes | set only for a COMPLETED item; equals `resolved_at` in that case |

- **Unique constraints**:
  - `UNIQUE (daily_plan_id, position)` — no duplicate position within a plan.
  - `UNIQUE (daily_plan_id, question_id)` — a Question appears at most once
    per plan. This is the exact constraint that closes plan-membership
    double-counting by construction
    (`docs/GLOBAL_TODAY_ARCHITECTURE_REVIEW.md` §2's central claim for
    Option A).
- **CHECK `daily_plan_items_status_timestamps_check`** (added by
  `20260922000000_daily_plan_item_state_consistency.sql`, following an
  adversarial review of the first migration that found Postgres would
  otherwise accept a structurally impossible row via any write path other
  than the repository's own conditional `UPDATE`):
  ```text
  pending   -> resolved_at IS NULL     AND completed_at IS NULL
  completed -> resolved_at IS NOT NULL AND completed_at IS NOT NULL
  skipped   -> resolved_at IS NOT NULL AND completed_at IS NULL
  ```
  Exhaustive across the three values `status`'s own CHECK already allows.
  This constraint only rules out self-contradictory rows — it does NOT by
  itself enforce ADR-016 §19's "resolved exactly once" rule (a `pending`
  item resolving a second time would still produce a *consistent*
  `completed`/`skipped` row under this CHECK alone); that remains the
  repository layer's job, per the "Single-use resolution" bullet below.
- **Foreign keys / composite FKs**:
  - `(daily_plan_id, user_id) REFERENCES daily_plans (id, user_id)` —
    deliberately does NOT also include `course_id` (unlike
    `today_session_items`' equivalent FK), since there is no single parent
    Course to cross-check against.
  - `(question_id, question_version_id) REFERENCES question_versions (question_id, id)` — unchanged shape.
  - `(question_id, course_id) REFERENCES questions (id, course_id)` — now
    the ONLY mechanism enforcing Course consistency for this item (no
    parent-session `course_id` to also cross-check).
- **Frozen (never recomputed after insert)**: `position`, `action_type`,
  `tier`, `other_applicable_types`, `reasons`, `question_version_id`,
  `course_id`.
- **Mutable**: `status`, `resolved_at`, `completed_at` only.
- **Single-use resolution (ADR-016 §19)**: enforced by the repository layer
  (`PostgresDailyPlanRepository.markCompleted`/`markSkipped`, a conditional
  `UPDATE ... WHERE status = 'pending'`), not by a DB constraint —
  `markItemCompleted` on the existing `today_session_items` table is
  deliberately NOT gated this way today (a known, pre-existing gap this
  migration does not retrofit onto the old table); the new
  `daily_plan_items` methods close that gap for the new table from the
  start.
- **Delete behavior**: cascades from `daily_plans`.
- **Source of truth**: frozen decision output for the plan-shape columns;
  none for `status`/`resolved_at`/`completed_at`.
- **Attempt linkage is implemented** by
  `20260924000000_daily_plan_answer_attempts.sql`: `attempts` can reference
  `daily_plan_id` / `daily_plan_item_id` for current Today answer submission.
  The server derives those identities from the authenticated learner and
  persisted item, and preserves immutable Attempt evidence if a DailyPlan is
  later deleted by clearing only the planning pointers. That migration also
  added a CHECK preventing one Attempt from claiming both legacy
  TodaySessionItem and DailyPlanItem origins — since retired along with
  `today_session_item_id` itself by migration #13.

---

## Cross-table invariants and how each is enforced

| Invariant | Mechanism | Found during |
|---|---|---|
| Attempt's `question_version_id` belongs to its `question_id` | composite FK (`attempts`) | Phase 2 audit #3/#20 |
| Attempt's `course_id` matches its Question's actual Course | composite FK (`attempts`) | Phase 2 audit #19 |
| ~~TodaySessionItem's `question_version_id` belongs to its `question_id`~~ | **RETIRED** (migration #13) — was composite FK (`today_session_items`) | Phase 2 audit #20 |
| ~~Attempt cannot reference a TodaySessionItem owned by a different user~~ | **RETIRED** (migration #13) — was composite FK via denormalized `user_id` (`attempts` ↔ `today_session_items`) | Phase 2 audit #17/#18 |
| ~~Attempt's `today_session_id` cannot disagree with the session its `today_session_item_id` actually belongs to~~ | **RETIRED** (migration #13) — was composite FK (`attempts` ↔ `today_session_items`) | found during migration-writing |
| `UserQuestionProgress`'s four evidence-quality counters sum to `attempt_count` | `CHECK` constraint (`user_question_progress`) | already documented as a domain invariant in `types.ts`, now also DB-enforced |
| No duplicate Attempt for the same logical command | `UNIQUE (user_id, submission_id)` + application-level field comparison on conflict | ADR-010 (prior session) |
| ~~No duplicate TodaySessionItem position/Question within a session~~ | **RETIRED** (migration #13) — was `UNIQUE` constraints (`today_session_items`) | ADR-010 |
| ~~TodaySession uniqueness (one session per user/Course/date)~~ | **RETIRED** (migration #13) — was `UNIQUE (user_id, course_id, planned_for_date)` | ADR-011 (course-scoped V1 decision, superseded) |
| DailyPlan uniqueness (one plan per user/local date) | `UNIQUE (user_id, planned_for_date)` | ADR-016 |
| DailyPlanItem state/timestamps remain consistent | `daily_plan_items_status_timestamps_check` | `20260922000000_daily_plan_item_state_consistency.sql` |
| ~~Attempt cannot claim both legacy TodaySessionItem and current DailyPlanItem origins~~ | **RETIRED** (migration #13) — was Attempt CHECK / FK constraints | `20260924000000_daily_plan_answer_attempts.sql` |
| DailyPlan-linked Attempt ownership/parent identity is constrained | composite DailyPlan/DailyPlanItem linkage constraints | `20260924000000_daily_plan_answer_attempts.sql` |
| QuestionVersion actually belongs to the Question/Course it's claimed for | composite FK (schema) **+** an equivalent application-layer check in `submitAnswer` (`resolveVersionContext`), since in-memory/test callers and any pre-insert validation can't rely on a DB constraint firing | this session's correctness pass |

Trigger-based enforcement was considered and rejected wherever a composite
FK could express the same guarantee declaratively — matching the brief's
"prefer declarative DB constraints... avoid clever trigger-heavy
architecture unless necessary." No triggers appear in this design.

**Immutability enforcement (`attempts`/`question_versions`) — DECIDED:
application discipline only, no trigger/REVOKE.** Verified, not assumed:
`AttemptRepository`/`QuestionVersionRepository` (`src/application/learning/ports.ts`)
expose no `update` method at all for either entity — there is no code path
that could mutate them even by accident, so DB-level enforcement would
defend against a mutation path that does not exist. Revisit only if a
future content-authoring/admin-correction flow adds an `update` capability
to either port. See the migration's own "Immutability enforcement" section
for the full reasoning.

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

- `Question.verification_state`'s exact enum (`docs/DATABASE.md` §24 lists
  candidates, not final values).
- `Material.material_type`'s exact enum (no candidate list exists yet).
- Deletion/retirement mechanics for `questions`/`courses`/`materials`
  (`docs/DATABASE.md` §37/§38) — this schema only ensures deletion cannot
  silently destroy `attempts`/`question_versions` history, not what a
  retirement flow itself looks like.

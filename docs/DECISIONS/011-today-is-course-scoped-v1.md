# ADR-011: Today Is Course-Scoped in V1

Status: ACCEPTED

## Context

`docs/OPEN_QUESTIONS.md` #34 (Today Scope Across Courses) and ADR-010's
"Today Session freeze model" section both left `TodaySession`'s physical
uniqueness key deliberately unresolved — the wrong move at the time would
have been to bake a `course_id` column into the schema while pretending the
scope question was still open, since a `course_id`-bearing key is itself a
silent decision. Two candidate shapes were on record: `(user_id, course_id,
planned_for_date)` if Today is course-scoped, or `(user_id,
planned_for_date)` if Today is global per learner across active Courses.

Building the application layer (`src/application/learning/today-session.ts`)
and the physical schema (`docs/PERSISTENCE_SCHEMA_V1.md`) further without
this resolved forces every downstream type (`TodaySessionKey`,
`UserQuestionProgressRepository.listForUser`'s Course-scoping parameter,
the `today_sessions` table's `course_id` nullability) to carry speculative
either/or shapes indefinitely. The current learner-progress/NBA/Today
pipeline is already naturally Course-contextual (`UserQuestionProgress` is
keyed by `(user_id, question_id)`, and every `Question` belongs to exactly
one Course per `docs/DATABASE.md` §7), so course-scoping Today does not
require inventing anything new — it only requires *not* deferring a
decision the rest of the pipeline already implies.

## Decision

**UNLOCK V1 Today is course-scoped.**

- One `TodaySession` belongs to exactly one `(user_id, course_id,
  planned_for_date)` tuple. Uniqueness: `UNIQUE (user_id, course_id,
  planned_for_date)`.
- A learner with two active Courses may have two separate `TodaySession`
  rows for the same logical date, one per Course.
- Global, cross-course Today (a single combined session spanning multiple
  Courses) is explicitly **deferred beyond V1** — not implemented, not
  designed further here.
- `TodaySessionKey` (application layer) is a plain `{ userId, courseId,
  plannedForDate }` object — the discriminated `scope: "course" | "global"`
  union that previously represented this ambiguity in the type system is
  removed, since there is no longer an ambiguity to represent.

This resolves `docs/OPEN_QUESTIONS.md` #34 for V1 (not for all time — a
future cross-course Today remains an available extension, not a closed
door).

## Consequences

- `docs/PERSISTENCE_SCHEMA_V1.md`'s `today_sessions.course_id` becomes `NOT
  NULL` with a concrete `FOREIGN KEY REFERENCES courses(id)` and the
  concrete `UNIQUE` constraint above — no longer marked unresolved.
- `UserQuestionProgressRepository.listForUser` in
  `src/application/learning/ports.ts` takes a required `courseId: string`
  instead of `courseId: string | null` — there is no longer a "no Course
  scoping" case to represent for Today generation.
- `getOrCreateTodaySession` no longer branches on `key.scope` — it always
  Course-scopes candidate generation.
- Today composition/interleaving decisions (`docs/LEARNING_ENGINE.md` §34,
  §36) remain entirely unaffected — this ADR only fixes the *session
  identity* key, not ranking or planning logic.
- A learner's Today "picture" across multiple Courses is not addressed by
  this decision — if the product later wants a single combined view, that
  is new work on top of this (e.g. a UI-level aggregation of per-Course
  sessions), not a reason to revisit this key.

## Alternatives Considered

### Keep Today's scope open indefinitely, never resolve `TodaySession`'s key

Rejected. The application layer and physical schema cannot progress past a
placeholder state without *some* concrete key; every day this stayed
unresolved, more downstream code (types, repository signatures) had to
carry a speculative either/or shape it didn't otherwise need.

### Global (cross-Course) Today for V1

Rejected for V1. It would require Today composition/ranking to balance and
interleave across Courses with entirely different content, difficulty
distributions, and exam contexts — a materially harder design problem
`docs/LEARNING_ENGINE.md` §34's interleaving guidance does not yet address,
and not required for the first vertical slice (`docs/ARCHITECTURE.md` §38's
"smallest trustworthy adaptive loop").

## Related Documents

- `docs/OPEN_QUESTIONS.md` (#34, now resolved for V1)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DATABASE.md` (§17, §18, §51)
- `docs/PERSISTENCE_SCHEMA_V1.md`

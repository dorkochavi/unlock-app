# ADR-011: Today Is Course-Scoped in V1

Status: **SUPERSEDED AND RETIRED — see
`docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016,
ACCEPTED).**

**A future reader must not mistake the Decision section below for the
current target architecture.** As of ADR-016 (ACCEPTED, 2026-09-19), the
accepted target persistence architecture is **one `DailyPlan` per learner
per local day**, with `DailyPlanItem` carrying its own `courseId`, and
Course Today served as a filtered *view* over that one plan — not this
ADR's model of one independent `TodaySession` per `(user_id, course_id,
planned_for_date)`. See "Supersession detail," below, for exactly which
clauses of this ADR are superseded and which still hold.

**Current implementation note (retirement, pre-Run-009):** ADR-016's
`DailyPlan`/`DailyPlanItem` architecture is the sole active Today runtime and
persistence model. The legacy `TodaySession`/`TodaySessionItem` runtime code
and the `today_sessions`/`today_session_items` schema it depended on have
been fully removed from the active repository — retired after a runtime
reachability audit found no live `src/app` route creating/retrieving a
TodaySession, and after hosted Supabase verification found zero rows in
either table and zero `attempts` rows referencing a `TodaySessionItem`. The
drop migration
(`supabase/migrations/20260929000000_retire_today_session.sql`) is committed
to this repository but was intentionally not yet applied to the hosted
Supabase project as of that retirement (pending the separate backup-readiness
gate, `docs/FOLLOW_UP_BACKLOG.md` FUB-009) — see `docs/DEV_STATUS.md` for the
current hosted-migration status. This ADR's Decision and Consequences
sections below remain intact as the historical record of why the schema
(while it existed) looked the way it did; they must not be read as current
product architecture or current repository state.

## Supersession detail

| ADR-011 clause | Status under ADR-016 |
|---|---|
| One `TodaySession` per `(user_id, course_id, planned_for_date)`; `UNIQUE (user_id, course_id, planned_for_date)` | **Superseded and implemented beyond.** ADR-016 §1 replaces this with one `DailyPlan` per `(user_id, planned_for_date)`; `courseId` moves to the item level. The legacy TodaySession schema still exists, but DailyPlan is now the active Today architecture. |
| A learner with two active Courses may have two separate `TodaySession` rows for the same date | **Superseded as target architecture.** Under ADR-016 §1, a learner has one `DailyPlan` regardless of how many active Courses contribute items to it. |
| Global, cross-course Today explicitly deferred beyond V1, "not implemented, not designed further" | **Superseded.** ADR-016 accepts one cross-Course-capable DailyPlan architecture. The DailyPlan foundation, generation, Today read path, answer flow, Skip flow, and New Material fallback are implemented; richer multi-Course presentation remains product/UI scope rather than a persistence-architecture blocker. |
| `TodaySessionKey` as a plain `{ userId, courseId, plannedForDate }` object, no `scope` union | **Superseded as target architecture.** The target key becomes `{ userId, plannedForDate }` at the DailyPlan level, with `courseId` recoverable per `DailyPlanItem`, not per session. |
| Domain grounding: a `Question` belongs to exactly one Course (`docs/DATABASE.md` §7); `UserQuestionProgress` keyed by `(user_id, question_id)` | **Not superseded — still valid**, and is exactly what makes it possible for a `DailyPlanItem` to carry a recoverable `courseId` without duplicating progress data. |
| Today composition/ranking/interleaving logic (`docs/LEARNING_ENGINE.md` §34, §36) is unaffected by session-identity choice | **Not superseded — still valid.** `src/domain/learning/next-best-action.ts`, `next-best-action-ranking.ts`, and `today-planner.ts` carry no `courseId` concept either before or after this change. |
| A day's plan is generated once (on first relevant open) and resumed, not regenerated, on subsequent opens | **Not superseded — still valid**, and carries forward unchanged into ADR-016 §2's DailyPlan first-open generation rule. |
| Per-item persisted identity (a stable row per planned Question, distinct from the Attempt it may later produce) | **Not superseded as a pattern.** `TodaySessionItem`'s role is inherited by `DailyPlanItem` under the new architecture; the concept of a stable, individually-resolvable planned item survives the entity rename. |
| `docs/DECISIONS/003-quiz-does-not-select-today-questions.md` (a separate, related ADR — Quiz does not independently choose Today questions) | **Not this ADR's clause and not superseded by ADR-016 either** — noted here only because it is easy to conflate with "frozen plan" behavior. It remains independently valid and unaffected. |

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

- `docs/OPEN_QUESTIONS.md` (#34, resolved for V1 by this ADR at the time; resolution now updated by ADR-016 §21/§22)
- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/DECISIONS/016-global-daily-plan-and-today-view-semantics.md` (ADR-016, ACCEPTED — partially supersedes this ADR; see "Supersession detail" above)
- `docs/DATABASE.md` (§17, §18, §51)
- `docs/PERSISTENCE_SCHEMA_V1.md` (documents both the legacy TodaySession schema this ADR originally described and the implemented DailyPlan successor from ADR-016)

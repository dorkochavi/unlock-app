# ADR-012: Attempt Replayability, Rebuild Semantics, and Synchronous Out-of-Order Reconciliation

Status: ACCEPTED

## Context

A prior design review found that
`ProgressUpdateContext.isSameLearningSession` — the flag
`retrieval-qualification.ts` uses to decide whether a retrieval is "the
same learning session/occasion as the previous qualifying retrieval" — was
not reconstructable from any persisted `Attempt` field. That review
recommended persisting the exact boolean used at original processing time
(`wasSameLearningSession`) and deferred building a rebuild capability,
since without production data yet, that gap seemed acceptable to leave
open a little longer.

Before any real schema or production data exists, this ADR revisits that
recommendation and finds it **insufficient**, not merely incomplete.

### Why a stored boolean is not sufficient (the critical finding)

`isSameLearningSession`'s meaning, per `retrieval-qualification.ts`'s own
doc comment, is relational: "the caller has confirmed the current Attempt
is in the same learning session/occasion as **the previous qualifying
retrieval**." Which Attempt counts as "the previous qualifying retrieval"
is itself determined by `retrievalBaselineAt`, which can differ between
original (arrival-order) processing and a later canonical-order replay —
precisely in the out-of-order case this ADR exists to fix. Concretely: if
Attempt B is folded into progress while Attempt C is baseline (because C
was processed first, out of order), the live-computed
`isSameLearningSession` for B is relative to C. Replaying later in true
chronological order might fold B against a *different* Attempt as
baseline. A stored `true`/`false` snapshot from the original computation
would silently misrepresent history after the reorder — it answers a
question ("same session as *that* baseline") that a replay is not asking.

## Decision

### 1. Attempts are made fully, truthfully replayable

`Attempt` gains `learningSessionId: string | null` — a stable, intrinsic,
reorder-safe identity (e.g. a Today session id, or a client-generated
token for manual practice), the same category of fact as `todaySessionId`.
`UserQuestionProgress` gains `retrievalBaselineLearningSessionId: string |
null`, tracked in exact lockstep with `retrievalBaselineAt`
(`progress-update.ts`'s `nextRetrievalBaseline`).

`isSameLearningSession` is never stored again. It is derived, fresh, every
time, by `deriveIsSameLearningSession` (`src/domain/learning/learning-session.ts`)
comparing `attempt.learningSessionId` against whichever
`retrievalBaselineLearningSessionId` is current at that point in a fold —
by both the online path (`submitAnswer`) and any replay (`rebuild.ts`).
This is what makes replay safe under reordering: two stable identities can
be compared truthfully in any order; a relational snapshot cannot.

`qualifyRetrieval`'s own signature (`RetrievalQualificationInput
.isSameLearningSession: boolean | null`) is unchanged — this decision does
not touch that contract, only who computes the value passed into it.

### 2. Rebuild uses CURRENT engine/scheduler/policy logic, never historical

`UserQuestionProgress` is derived/cache state; `Attempt` is immutable
historical truth. A rebuild (`rebuildUserQuestionProgress`, `rebuild.ts`)
reinterprets historical Attempts using the CURRENT Learning Engine logic,
`MemoryScheduler` implementation/configuration, and
retrieval-qualification/evidence-strength/mastery/misconception policies —
never an attempt to replay through whichever engine/scheduler version was
active at original processing time.

This is not merely a preference: none of the four policy objects, nor the
concrete scheduler implementation/parameters, are versioned or persisted
anywhere in this codebase. "Use current logic" is the only thing the
persisted data actually supports today. `Attempt.engineVersion` remains
historical metadata describing what was active when an Attempt was
*originally* folded into progress online — rebuild never reads it as a
dispatch key. We accept that improving algorithms may change rebuilt
derived state; this is the same trade-off `docs/ARCHITECTURE.md` §13
("Derived state may change as... algorithms evolve") already establishes
for derived state generally, now made explicit for rebuild specifically.

### 3. Out-of-order online Attempts are reconciled synchronously, not left stale

The permanently-stale "Option C" behavior from the prior review (preserve
the Attempt, never fold it into progress) is superseded. With
`isSameLearningSession` now truthfully reconstructable, permanently stale
progress is no longer acceptable. `submitAnswer` now reconciles an
out-of-order Attempt **synchronously, in the same transaction**: the
immutable Attempt is inserted, every Attempt for the `(userId, questionId)`
pair (including the new one) is loaded via
`AttemptRepository.listForReplay`, `rebuildUserQuestionProgress` replays
them in canonical order, and the result replaces `UserQuestionProgress`
before the transaction commits. There is no queue, no eventual-consistency
worker, and no permanent stale-progress state.

**Complexity/performance, stated explicitly, not assumed**: this is an
`O(n)` full replay of one learner-question's entire Attempt history, not
an `O(1)` incremental update. Judged acceptable for V1 because (a)
out-of-order arrival is the rare path — the overwhelming majority of
submissions are normal, in-order, and keep the existing `O(1)` incremental
path untouched; (b) `n` is bounded by one learner's Attempt history on one
Question, expected to stay small (tens, not thousands) for a
spaced-repetition workload; and (c) correctness of a rare recovery path
matters more than its speed. If V1 data volume assumptions change, this is
the place to revisit — not something to guess about now.

### 4. Canonical replay order

`answeredAt ASC, createdAt ASC, id ASC` (`rebuild.ts`'s
`sortReplayRecords`). `answeredAt` is not a choice —
`OutOfOrderRetrievalError` already requires it. `createdAt` (DB
acceptance time, deliberately kept OUTSIDE the pure `Attempt` domain type,
in a small `AttemptReplayRecord` envelope owned by the persistence
boundary) is the tie-break for equal `answeredAt`, reflecting what the
live system actually did. `id` is the final, purely mechanical tie-break.

### 5. `learningSessionId` ownership boundary (pre-commit correctness audit)

A pre-commit audit, run before any of the above was committed, asked
whether `learningSessionId` is safe to treat as a plain client-supplied
identity field. It is not, without a boundary: `learningSessionId`
directly controls `deriveIsSameLearningSession`, and therefore whether a
retrieval is treated as same-session vs longitudinal spaced evidence. The
draft implementation trusted `command.learningSessionId` unconditionally,
which meant a buggy or malicious client could claim a NEW
`learningSessionId` on every Today answer and force every retrieval to
qualify as a spaced retrieval — a real Learning Engine evidence-corruption
vector, not a cosmetic identity concern.

Fixed by splitting ownership by Attempt origin (`submit-answer.ts`'s
`resolveLearningSessionId`):

- **Today-attached Attempts** (`todaySessionItemId !== null`): the
  application derives `learningSessionId` from the persisted
  `TodaySessionItem.todaySessionId`. A `TodaySessionItem` belongs to
  exactly one `TodaySession`, and Today is already course+date scoped
  (ADR-011) — reusing `todaySessionId` as the learning-session identity is
  unambiguous and requires no new Session subsystem. The client's
  `learningSessionId` claim is IGNORED for these Attempts, the same
  treatment already given to other server-derived fields (`isCorrect`,
  `engineVersion`), and is therefore also excluded from the canonical
  command-identity comparison for these Attempts — comparing a value the
  client does not actually own would only produce false idempotency
  conflicts on legitimate retries.
- **Manual practice** (`todaySessionItemId === null`): no persisted
  session concept exists for manual practice in V1. Inventing one is
  explicitly out of scope for this decision (`docs/ARCHITECTURE.md` §7/§29
  discipline against unneeded new subsystems). The client supplies and
  owns a stable token for this case — the same trust boundary V1 already
  extends to every other client-supplied evidence field the server does
  not independently re-derive (e.g. `answeredAt`, `confidenceLevel`). It
  remains part of the canonical command-identity comparison, so a retry
  claiming a different `learningSessionId` is still rejected as a
  conflict.

This is a durable ownership rule, not merely a validation nicety: it
determines which of two different code paths a given Attempt's
`learningSessionId` value comes from, and callers of `submitAnswer` cannot
override it for Today-attached Attempts by any means.

### 6. `context.now` during rebuild replay

Audited whether `rebuildUserQuestionProgress` folding every historical
Attempt through `applyAttemptToProgress` with ONE fixed `context.now` (the
rebuild-time clock reading) for every replay step is correct, or whether
intermediate steps need `attempt.answeredAt` as their "now" instead.

Traced every use of `context.now` reachable from `applyAttemptToProgress`
(`progress-update.ts`): it is read in exactly one place —
`context.memoryScheduler.estimateRetrievability(memory, context.now)` —
whose result feeds only `masteryDecisionInput.retrievabilityEstimate` →
that step's own `masteryCategory`, and separately stamps that step's own
`updatedAt`. Neither `masteryCategory` nor `updatedAt` is read back by
`applyAttemptToProgress` as an input on any later call (mastery
recomputation depends only on `meaningfulAttemptCount`,
`successfulSpacedRetrievals`, `lapseCount`, `evidenceStrength`, and
`hasUnresolvedLapse` — none of which depend on `now`). Scheduler-memory
evolution itself (`nextSchedulerMemory`) is keyed on `attempt.answeredAt`
as `reviewedAt`, never `context.now`. `evidence-strength.ts`,
`mastery.ts`, `misconception.ts`, and `lapse.ts` take no `now`/clock input
of any kind.

Consequence: an intermediate replay step's `now`-derived outputs
(`masteryCategory`, `updatedAt`) are unconditionally overwritten by the
next iteration's own recomputation and never influence it — so using one
rebuild-time `now` for every step (what the code already does) produces
EXACTLY the same final result as using `attempt.answeredAt` as `now` for
every intermediate step and only the true rebuild-time `now` for the
final step. The two candidate designs are provably equivalent in output;
the simpler one (a single fixed `context.now`, already implemented) is
correct as-is. No code change was needed. `src/domain/learning/__tests__
/rebuild.test.ts` has a targeted regression test
("uniform rebuild-time now equals answeredAt-for-intermediate-steps
replay") that would fail if a future change made some `now`-derived value
leak forward as an input to a later fold step.

## Consequences

- No `Attempt` recorded from now on can produce a permanently-stale
  `UserQuestionProgress` due to arrival-order — every Attempt is either
  folded incrementally or reconciled via synchronous rebuild in the same
  transaction it was accepted in.
- `createdAt` does not appear on the domain `Attempt` type — it is a
  persistence-layer concept, bundled only into `AttemptReplayRecord`,
  which `AttemptRepository.listForReplay` returns.
- `SubmitAnswerContext` no longer accepts an externally-injected
  `isSameLearningSession` override — callers can no longer supply an
  arbitrary relational boolean; they supply `learningSessionId` on the
  command instead, and the value used for
  `applyAttemptToProgress` is always derived internally.
- `learningSessionId` ownership is split by Attempt origin (§5): for
  manual practice it is client-command identity (a retry with a different
  value is rejected as an idempotency-key conflict, the same treatment
  `todaySessionId` already receives); for a Today-attached Attempt it is
  application-derived from `TodaySessionItem.todaySessionId` and the
  client's claim is never authoritative.
- Historical Attempts recorded before `learningSessionId` existed cannot
  be retroactively made replay-safe — this is an unavoidable
  migration-boundary limitation, not something this decision claims to
  solve.
- A rebuild silently produces different derived state than what the
  online path would have computed only when a real algorithm/policy
  change occurred between original processing and rebuild time — an
  accepted, intentional consequence of decision #2, not a bug.

## Alternatives Considered

### Persist the `isSameLearningSession` boolean itself (the prior review's recommendation)

Rejected on further inspection — see "why a stored boolean is not
sufficient" above. This was the recommendation on record before this ADR;
this ADR supersedes it after verifying it does not actually solve the
problem, rather than assuming a prior report's recommendation was
sufficient.

### Reproduce historical engine/scheduler/policy behavior during rebuild

Rejected. Not achievable with the current schema regardless of preference
— no policy object or scheduler configuration is versioned/persisted
anywhere. Pursuing this would require a substantial new
policy-versioning/scheduler-pinning subsystem with no demonstrated V1 need.

### Keep out-of-order Attempts permanently stale (continue "Option C")

Rejected once true rebuild became possible. Continuing to accept
permanently stale derived state after removing the reason it was accepted
would be choosing staleness for its own sake, not for a real constraint.

### Asynchronous reconciliation (queue/eventual-consistency worker)

Rejected for V1. `docs/ARCHITECTURE.md` §34 explicitly rejects introducing
queue infrastructure without demonstrated need; synchronous, in-transaction
reconciliation is simpler and sufficient at the data volumes V1 expects
(see the complexity/performance reasoning above).

## Related Documents

- `docs/DECISIONS/010-answer-submission-transaction-model.md`
- `docs/PERSISTENCE_SCHEMA_V1.md` (Replay/Rebuild Contract section)
- `docs/ARCHITECTURE.md` (§13, §34)
- `src/domain/learning/learning-session.ts`
- `src/domain/learning/rebuild.ts`
- `src/application/learning/submit-answer.ts`

# ADR-010: Answer Submission Transaction Model and Today Session Freeze Semantics

Status: ACCEPTED

## Context

The learner-state domain (`src/domain/learning/`) is a pure, deterministic engine: `applyAttemptToProgress` (progress-update.ts), `generateNextBestActionCandidates`/`rankNextBestActionCandidates` (next-best-action.ts / next-best-action-ranking.ts), and `generateTodayPlan` (today-planner.ts) are all pure functions with no DB, no network, and no Date.now(). Moving to persistence requires defining, without yet writing SQL or a Supabase client:

- what must happen atomically when a learner submits an answer;
- how duplicate submissions (`Attempt.submissionId`, already part of the domain contract) are prevented from double-applying;
- how two concurrent writers for the same learner-question pair are prevented from losing an update;
- what a persisted `TodaySessionItem` must freeze so a resumed session at 20:00 shows exactly what was decided at 08:00, per the core product requirement (`docs/MASTER_SPEC.md` §27, `docs/ARCHITECTURE.md` §14).

`docs/DATABASE.md` §31 already sketches this transaction's shape at a high level but leaves the concrete mechanics open. `docs/DATABASE.md` §16 already suggests, without finalizing, persisting the selected NBA decision inside `TodaySessionItem` rather than storing every ranking candidate.

**Revision note (post-review)**: the first version of this ADR had three problems, found and fixed in this revision before any migration was written:

1. `SELECT ... FOR UPDATE` on `UserQuestionProgress` does not protect the case where no row exists yet — two different, individually valid `submissionId`s for the same `(user_id, question_id)` submitted concurrently could both read `previousProgress = null` and race to `INSERT`, losing one derived update. Fixed below with a transaction-scoped advisory lock.
2. The original text simultaneously claimed `TodaySession` uniqueness was `(user_id, course_id, planned_for_date)` **and** that Today's Course scope was still open (`docs/OPEN_QUESTIONS.md` #34) — those two statements contradict each other, since a `course_id`-bearing key silently commits V1 to course-scoped Today. Fixed below by leaving the physical key open until the product decision is made.
3. The idempotency path did not specify what must be validated when `submission_id` already exists, leaving a theoretical cross-context leak (returning an Attempt that does not actually match the caller's request). Fixed below with an explicit conflict-validation rule and a narrower uniqueness scope.
4. That conflict-validation rule initially compared only `question_id`/`question_version_id`/`today_session_item_id` — too narrow to prove "same logical command." Two requests with identical `submissionId`, `questionId`, `questionVersionId`, and `todaySessionItemId` but `selectedAnswer: "B"` vs. `"C"` (and `confidenceLevel: "high"` vs. `"low"`) are different answers and must not be treated as the same retry. Fixed below with a complete canonical command-identity field list.
5. That field list initially excluded `responseTimeSeconds` on the reasoning that it does not affect Learning Engine output. On review that reasoning conflated two different questions: idempotency means "is this the same immutable Attempt command being retried?", not "would this produce the same major Learning Engine decision?" `responseTimeSeconds` is a persisted part of the historical Attempt fact, so a retry with a different measured value (e.g. `7.2` vs. `19.4`) is a different payload and must be rejected as a conflict, not silently accepted. The list also had not verified `suspiciousTiming`'s actual ownership before classifying it as client-supplied. Both are corrected below.
6. The initial justification for excluding `suspiciousTiming` claimed recomputing it would deterministically reproduce the original value, since its inputs were "already compared." That invariant does not hold: the anomaly rule may depend on contextual server state (question timing baseline, prior attempts, repeated ultra-fast responses, session behavior) that can genuinely differ between the original request and a later retry. The corrected rationale does not depend on determinism at all — an idempotent retry never recomputes `suspiciousTiming`, it returns the already-persisted result of the original processing. Corrected below.

## Decision

### First-progress-row concurrency: transaction-scoped advisory lock

Before touching `Attempt` or `UserQuestionProgress` at all, `submitAnswer` acquires a **Postgres transaction-scoped advisory lock keyed by `(user_id, question_id)`**:

```sql
SELECT pg_advisory_xact_lock(hashtextextended(user_id::text || ':' || question_id::text, 0));
```

This is evaluated against three options:

- **(A) Transaction-scoped advisory lock keyed by `(user_id, question_id)`, acquired before reading/writing progress — chosen.** It requires no row to exist, so it correctly serializes the very first concurrent Attempts on a learner-question pair, not just later ones. It leaves the domain contract untouched: `previousProgress` can still be genuinely `null` on a real first Attempt — no placeholder/sentinel row is ever created to make locking possible. The lock is per-`(user_id, question_id)` (via a single hashed bigint key), not per-Question globally, so unrelated learners or unrelated Questions for the same learner are never serialized against each other. It is transaction-scoped (`_xact_lock`), so it is automatically released on `COMMIT` or `ROLLBACK` with no explicit unlock/cleanup code, and it composes cleanly with the existing `submitAnswer` flow as its very first step.
- **(B) Atomically ensure a canonical progress row exists first** (`INSERT UserQuestionProgress (...) ON CONFLICT (user_id, question_id) DO NOTHING`, using some "zero state" default), **then** `SELECT ... FOR UPDATE` it — considered, rejected. This closes the same race, but only by inventing a persisted "empty progress" row that does not correspond to any real derived state. The application would then need a second concept — "is this row the real zero-state, or a genuine one-Attempt result?" — to still correctly pass `null` into `applyAttemptToProgress` on a true first Attempt, since the domain function's `isFirstAttempt` behavior (e.g. the `INITIAL_ATTEMPT` reason) depends on receiving `null`, not a zero-valued object. That mapping is exactly the kind of "row existence ≠ domain meaning" drift this project has repeatedly avoided elsewhere (see progress-update.ts's `deriveStateUpdateReasons` history). It also complicates a future rebuild tool, which would need to either reproduce or skip these placeholder rows.
- **(C) another explicit strategy** — none found preferable. `SERIALIZABLE` isolation for the whole transaction would close the race too, but at the cost of instance-wide serialization-failure retries for unrelated learner-question pairs, which is broader than the actual requirement (per-pair consistency only).

(A) is chosen: it fixes the race with no domain-semantics cost, no placeholder rows, no change to rebuildability, and a lock granularity that is exactly per learner-question.

**Required discipline**: because an advisory lock is not attached to the row itself, every code path that reads-then-writes `UserQuestionProgress` for a given `(user_id, question_id)` — including a future `rebuildUserQuestionProgress` if it is ever made to run concurrently with live traffic rather than offline — must acquire this same lock first. Unlike `SELECT ... FOR UPDATE` on an existing row, Postgres does not enforce this automatically; it is an application-level contract that must be followed everywhere `UserQuestionProgress` is written.

### Transaction boundary

A single answer submission (`submitAnswer`) executes as **one database transaction** covering, in order:

1. `SELECT pg_advisory_xact_lock(hashtextextended(user_id || ':' || question_id, 0))` — acquire the per-`(user_id, question_id)` lock first, before any read or write. A concurrent transaction for the same pair blocks here until this transaction commits or rolls back.
2. `INSERT Attempt ... ON CONFLICT (user_id, submission_id) DO NOTHING RETURNING *` (see the narrower idempotency uniqueness scope below).
3. If nothing was returned (an existing Attempt already has this `(user_id, submission_id)`): validate it (see "Idempotency" below), then either return the already-committed Attempt/progress result (`applyAttemptToProgress` is **not** re-invoked) or raise an idempotency-key-conflict error — the transaction ends here either way.
4. If a new Attempt was inserted: `SELECT UserQuestionProgress WHERE (user_id, question_id) = (...)`, optionally `FOR UPDATE` as defense-in-depth for any row that already exists (the advisory lock from step 1 is what actually excludes concurrent writers, including when no row exists yet). No row means `previousProgress = null`, and this is now safe to treat as a true, uncontested first Attempt because step 1 already excludes any other transaction for this exact pair.
5. Call the pure `applyAttemptToProgress(previousProgress, attempt, context)`.
6. Upsert the resulting `UserQuestionProgress` (`INSERT ... ON CONFLICT (user_id, question_id) DO UPDATE ...`).
7. If the Attempt carries a `today_session_item_id`, update that item's status/`completed_at` and roll up `TodaySession` completion, within the same transaction.

Steps 1–6 (and 7, when applicable) are never split across transactions: a partial commit (Attempt recorded, progress not updated) is exactly the corrupted state `docs/ARCHITECTURE.md` §21 prohibits. Releasing the advisory lock is implicit — it happens automatically at `COMMIT`/`ROLLBACK`, not as a separate step.

**Why two simultaneous first Attempts can no longer lose an update**: say transactions A and B submit two different valid `submissionId`s for the same `(user_id, question_id)`, with neither having a `UserQuestionProgress` row yet. Both reach step 1. One of them (say A) acquires the advisory lock; B blocks. A proceeds through steps 2–7 and commits, which both releases the lock and leaves a real `UserQuestionProgress` row in place. Only then does B's step 1 unblock — B's step 4 now finds A's row and correctly computes `previousProgress` from it, not `null`. B's `applyAttemptToProgress` call therefore builds on A's real result instead of overwriting it. The two transactions are fully serialized for this pair — "as if sequential" — even though neither row existed when either transaction started.

### Idempotency

**Uniqueness scope: `UNIQUE (user_id, submission_id)`, not a global `UNIQUE (submission_id)`.** A client-generated idempotency token is inherently a per-user concept — "has *this user's* *this* logical command already been processed" — not a claim that no other user in the system may ever submit an equal-looking token. Scoping the constraint to `(user_id, submission_id)` means two different users reusing an equal `submission_id` string never even reaches the conflict path; it is simply two independent, uncontended inserts. This removes an entire class of cross-user leak risk at the schema level, rather than relying only on application-level validation to catch it after the fact.

**Conflict validation — canonical logical-command identity.** A `submission_id` conflict is only a *successful idempotent retry* if the existing Attempt matches the expected logical command in full, not just in a few fields. The governing principle: canonical command identity includes **every client-supplied immutable Attempt fact**, not only the fields that happen to influence the Learning Engine's major decisions — idempotency here answers "is this the same immutable Attempt command being retried?", not the narrower "would this produce the same Learning Engine output?" `Attempt`'s fields are split into three categories accordingly:

1. **Client command identity fields** — what the client is asserting it wants to submit. These are compared on conflict, with exact (null-aware) equality:
   - `courseId`, `questionId`, `questionVersionId` — *what* was answered, and which exact content snapshot the learner saw;
   - `selectedAnswer` — **the answer itself**. Two requests with the same `submissionId` but different `selectedAnswer` are different commands by definition, regardless of anything else matching;
   - `confidenceLevel` — feeds `CONFIDENT_ERROR`/misconception detection directly; a differing value changes Learning Engine output;
   - `responseTimeSeconds` — a persisted, immutable part of the historical Attempt fact. It does not gate evidence classification, but it is still part of what the client reported happened, and a retry with a materially different measured value (e.g. `7.2` vs. `19.4`) is a different payload, not the same command;
   - `todaySessionId`, `todaySessionItemId` — which session/item context this Attempt belongs to. Compared with exact null-aware equality: an existing `todaySessionItemId` of `"item-123"` and a retry carrying `null` (or a different id) are **not** the same command, not silently coalesced;
   - `assistanceUsed`, `attemptNumberForPresentedItem` — each directly gates `classifyAttemptEvidence`'s quality classification (evidence.ts), so a differing value changes whether the Attempt is `FULL_EVIDENCE`/`ASSISTED_EVIDENCE`/`LOW_QUALITY_EVIDENCE`/`INVALID_FOR_MASTERY`, and therefore changes `applyAttemptToProgress`'s output;
   - `answerWasRevealedBeforeResponse` — **verified client-owned, not assumed** (see "Ownership verification" below): a direct fact about the interaction the client just observed (did its own UI reveal the answer before the response was made), not an inferred/statistical signal;
   - `answeredAt` — client-captured event time, not server-generated. It materially affects `applyAttemptToProgress` (evidence timestamps, retrieval-qualification gap math, scheduler review timing, `lastLapseAt`/`lastCorrectAt`/`lastIncorrectAt`), so it is compared. **A legitimate retry is expected to preserve it exactly**: the client is expected to capture `answeredAt` once, at the moment of the original submission attempt, and bind it to `submissionId` for every retry of that same attempt — never regenerate a fresh timestamp per HTTP retry. A retry with a different `answeredAt` is either a client bug (re-stamping time on each attempt) or evidence this is actually a different logical submission reusing a stale key; either way it is correctly treated as a conflict, not silently accepted.

   (`userId` is not separately re-compared here — it is already guaranteed equal by the `(user_id, submission_id)` lookup itself.)

   **Ownership verification** (do not guess — inspected against `src/domain/learning/types.ts`'s `Attempt` doc comments and `docs/LEARNING_ENGINE.md` §10, not assumed):
   - `answerWasRevealedBeforeResponse`'s doc comment reads only "True only when the answer was revealed before this response was made" — a direct fact, phrased the same way as `selectedAnswer`/`assistanceUsed`, with no mention of a rule or algorithm computing it. **Finding: client-supplied (category A)** — kept in command identity, as above.
   - `suspiciousTiming`'s doc comment reads "Set upstream only when a deterministic timing/anomaly rule has enough evidence to flag the response," and `docs/LEARNING_ENGINE.md` §10 describes its intended inputs as "response time relative to question baseline," "repeated ultra-fast responses," and "session behavior" — signals that require visibility into question-level statistics and attempt history a lone client request cannot honestly self-report (a client asserting its own "suspicious" flag is not a trustworthy signal — the whole point is to flag behavior the submitter would not flag about themselves). **Finding: server/application-derived (category B)**, not client-supplied. Moved to category 2 below; the client is not required to reproduce it on retry.

2. **Server/generated metadata** — not part of the client's command, deliberately excluded from comparison:
   - `id` — the Attempt's own generated primary key;
   - `engineVersion` — which engine version was active when the server processed the request. This describes the *environment*, not what the client asked for; rejecting a legitimate retry merely because a deploy happened between the original attempt and its retry would be wrong;
   - `suspiciousTiming` — server/application-derived (see "Ownership verification" above): it is processing *output*, not part of the client's immutable command. It is excluded from comparison **not** because recomputing it would necessarily produce the same value — the anomaly rule may depend on contextual server state (question timing baseline, prior attempts, repeated ultra-fast responses, session behavior) that can genuinely change between the original request and a later retry, so no determinism claim is being made here. It is excluded because **an idempotent retry never recomputes it at all**: on conflict, the already-persisted Attempt from the *original* processing is returned as-is, `suspiciousTiming` included, exactly as it was first computed. A retry therefore has no `suspiciousTiming` of its own to compare against — there is nothing to reconcile, only a prior result to return. This is the same reasoning as `engineVersion`: a retry preserves the result of the original processing rather than re-running the request under today's processing context and demanding identical server metadata.

3. **Derived fields** — computed from the client-identity fields above, deliberately excluded because comparing them adds nothing once their inputs are already compared:
   - `isCorrect` — computed server-side from `selectedAnswer` against the `QuestionVersion`'s correct answer. Since `selectedAnswer` and `questionVersionId` are both already compared, `isCorrect` is guaranteed to recompute identically; it is implied, not separately checked.

If every client-command-identity field matches, this is a genuine retry: return the existing, already-committed Attempt/progress/session result safely, and never re-invoke `applyAttemptToProgress`. **If any of them differ, this is not an idempotent retry of the same command — it is an idempotency-key conflict** (the same key reused, by the same user, for a different logical answer — for example a client bug that reuses a token across two different Questions, or resubmits a corrected answer under the original key instead of a new one). This must be rejected with an explicit error distinct from a normal validation failure, never silently treated as success and never used to return a result for a different command than the one requested.

**Explicit field comparison, not a fingerprint/hash.** V1 compares the fields above directly against the already-loaded existing `Attempt` row (fetched on conflict regardless, to potentially return it) — it does not compute or store a request fingerprint/hash. A hash would require choosing a canonical serialization (field order, number formatting, null vs. undefined handling), adding a new stored column that must be kept in sync with exactly the same field list this design already needs to name, and would report only "mismatch" rather than which field differed — worse for debugging a client bug, for no simplification benefit. This is deliberately not a generic idempotency framework — only the fixed field list above, checked once at the point of conflict.

### Concurrency

Two distinct races are addressed:

- **Retried/duplicate `submissionId` for the same command, including the first Attempt on a pair** (double-click, refresh, network replay): closed by the `(user_id, submission_id)` unique constraint plus the advisory lock from step 1 (which also protects the very-first-row case described above).
- **Two different concurrent Attempts on the same `(user_id, question_id)`** (e.g. two tabs, two different answers): closed by the same advisory lock, reinforced by `SELECT ... FOR UPDATE` on the `UserQuestionProgress` row once it exists, as defense-in-depth.

Row locking alone (`SELECT ... FOR UPDATE` with no advisory lock) was the original proposal and is now known to be **insufficient** — see "First-progress-row concurrency" above. Optimistic concurrency (a version column + compare-and-swap) was also considered and rejected for V1: it adds application-level retry logic for a case the advisory lock already fully excludes, for no additional benefit at V1 traffic levels. Full `SERIALIZABLE` isolation for the whole transaction was rejected as broader than needed — only per-`(user_id, question_id)` consistency is actually required, not instance-wide serializability.

### Today Session freeze model

**Today's Course scope is now DECIDED — see `docs/DECISIONS/011-today-is-course-scoped-v1.md`.** UNLOCK V1 Today is course-scoped: `TodaySession` is uniquely keyed by `UNIQUE (user_id, course_id, planned_for_date)`. A learner with multiple active Courses may have multiple `TodaySession` rows for the same date, one per Course. Global cross-course Today is deferred beyond V1. (This section previously left the key unresolved pending that product decision — it has since been made; the superseded "two candidate shapes" framing is preserved only in ADR-011's own Context section for the historical record.)

`getOrCreateTodaySession` is implemented as `INSERT ... ON CONFLICT DO NOTHING RETURNING` with a fallback `SELECT` — never a check-then-insert race. This is the mechanism that makes "the same session resumes" reliable.

`planned_for_date` is a caller-supplied `DATE` value. No day-boundary or timezone logic exists in the domain or persistence layer for computing it — that remains an open, application-layer decision (`docs/OPEN_QUESTIONS.md` #3).

Once generated, a `TodaySessionItem` freezes the following fields, copied verbatim from the domain `TodayPlanItem` at generation time and never recomputed afterward: `position`, `action_type`, `tier`, `other_applicable_types`, `reasons`. A later change in ranking, mastery, or misconception state must not silently reorder or relabel an already-persisted item.

**Question version resolution is an application-layer, not domain-layer, responsibility.** `today-planner.ts`'s `TodayPlanItem` intentionally carries no `questionVersionId` — the pure planner only ever sees `NextBestActionCandidate`, which carries `questionId` only. But `Attempt.questionVersionId` is required (ADR-009), and Quiz must execute the exact prepared item. The application layer therefore resolves each item's Question's *current* `QuestionVersion` at the moment of **persisting** the generated plan, and writes that resolved id onto `TodaySessionItem.question_version_id`. This keeps the pure domain planner unaware of `QuestionVersion` while still giving Quiz/Attempt a frozen, explainable content reference.

Selected-decision persistence confirms `docs/DATABASE.md` §16's "likely V1 direction": no separate table stores every NBA candidate or ranking result; only the chosen primary action per Question is persisted, on `TodaySessionItem`.

### Client retry contract (made explicit)

Everything above about idempotency and "a legitimate retry preserves the original values" depends on one client-side requirement, stated explicitly here rather than left implicit: **a client must generate `submissionId` exactly once per logical answer attempt, and must resend that same `submissionId` together with the exact original request payload (including `answeredAt` and `responseTimeSeconds`) on every retry of that same attempt** — after a network failure, an unclear response, or an application crash between commit and response. A client that instead generates a fresh `submissionId` per HTTP attempt gets no idempotency protection at all (each attempt becomes a genuinely new command); a client that resends the same `submissionId` with a regenerated `answeredAt`/`responseTimeSeconds` will have its retry correctly rejected as an idempotency-key conflict rather than silently accepted (see "Conflict validation" above). This requirement belongs on the client/API-contract side of the boundary this ADR sits at; it is recorded here because the entire idempotency model is meaningless without it.

## Consequences

- a duplicate answer submission is always safe to retry — it returns the original result rather than corrupting counters or re-deriving state, and a same-user submission-id reused for a *different* logical command is rejected explicitly rather than silently misattributed;
- concurrent submissions for the same learner-question pair, including the very first Attempt ever recorded for that pair, cannot silently lose an update;
- `UserQuestionProgress` is never written by any path that skips the advisory lock — this must be documented and enforced as a standing discipline, not just true of `submitAnswer` today;
- `TodaySession`'s physical uniqueness constraint is now decided (`UNIQUE (user_id, course_id, planned_for_date)`, ADR-011) and implementable in a real migration;
- a resumed Today session at 20:00 shows exactly what was decided at 08:00, including which other actions applied and why, even if the learner's mastery/misconception state has since changed;
- `rebuildUserQuestionProgress` (future, deferred) remains possible because `UserQuestionProgress` is never written outside this transaction pattern and Attempts remain the sole source of truth it is rebuilt from, and no placeholder/zero-state rows are ever created that a rebuild would need to account for;
- the advisory lock plus row lock adds a short-lived lock per answer submission; acceptable at V1 traffic scale and consistent with `docs/ARCHITECTURE.md` §33's cost-efficiency principle.

## Alternatives Considered

### Application-level-only idempotency check (no DB unique constraint)

Rejected. A race between the check and the insert would still allow two Attempts for the same submission under concurrent requests; `docs/DATABASE.md` §32 explicitly warns against relying on TypeScript alone for this class of integrity rule.

### `SELECT ... FOR UPDATE` alone, with no advisory lock

This was the original proposal in this ADR's first version. Rejected on review: it only locks a row that already exists, so it does not protect two different first-ever Attempts on the same learner-question pair from racing (see "First-progress-row concurrency" above).

### Ensure a placeholder `UserQuestionProgress` row exists first, then lock it

Considered as option (B) above. Rejected: it closes the race, but only by introducing a persisted "empty progress" row with no corresponding real derived state, forcing the application to distinguish "placeholder row" from "one real Attempt's worth of state" to still correctly pass `null` into `applyAttemptToProgress` — a domain-semantics cost with no offsetting benefit over the advisory-lock approach.

### Optimistic concurrency (version column) instead of locking

Rejected for V1. Requires application-level retry-on-conflict logic for a case the advisory lock already fully excludes, for no clear benefit at V1 traffic levels.

### Global `UNIQUE (submission_id)` instead of `UNIQUE (user_id, submission_id)`

Rejected. A global constraint would make an equal `submission_id` reused by two different users collide at the database level, requiring the application to distinguish "my own retry" from "someone else's token" purely through validation logic after the fact — an unnecessary cross-user leak surface for what is fundamentally a per-user idempotency concept. Scoping the constraint to `(user_id, submission_id)` removes that surface entirely rather than only detecting it.

### Silently return the existing Attempt on any `submission_id` conflict, without validating it matches the request

Rejected. Without validation, a reused key for a genuinely different command would return a result the caller did not ask for — a correctness bug, and in the worst case a data-exposure bug if the mismatched Attempt belonged to a different logical context than the caller expected.

### Validate only `question_id`/`question_version_id`/`today_session_item_id` on conflict

This was this ADR's first attempt at conflict validation. Rejected on further review: it does not include `selectedAnswer`, so two requests that differ only in the actual answer choice (e.g. `"B"` vs. `"C"`) — or in `confidenceLevel`, or in any of the evidence-classification-gating fields — would incorrectly be accepted as "the same command." See "Conflict validation — canonical logical-command identity" above for the corrected, complete field list.

### Exclude `responseTimeSeconds` from comparison because it does not affect Learning Engine output

This was this ADR's second attempt at the field list. Rejected on further review: it answered the wrong question. Idempotency means "is this the same immutable Attempt command being retried?", not "would this produce the same major Learning Engine decision?" `responseTimeSeconds` is a persisted historical fact regardless of its (lack of) influence on evidence classification or mastery, so a retry reporting a materially different measured value is a different payload and must conflict, not silently pass. `responseTimeSeconds` is now included in client command identity.

### Assume `suspiciousTiming` is client-supplied without verifying its ownership

Rejected. The field's own doc comment ("set upstream only when a deterministic timing/anomaly rule has enough evidence") and `docs/LEARNING_ENGINE.md` §10's description of its intended inputs (question-baseline-relative timing, repeated ultra-fast responses, session behavior) make clear it is a server/application-derived anomaly signal, not something a client can honestly self-report. It was moved to the server/generated-metadata category.

### Justify excluding `suspiciousTiming` by claiming recomputation would be deterministic

This was this ADR's first attempt at justifying the exclusion, and it is incorrect. The anomaly rule's inputs may include contextual server state (question timing baseline, prior attempts, repeated ultra-fast responses, session behavior) that can genuinely change between the original request and a later retry — recomputing on retry is not guaranteed to reproduce the original value. The exclusion does not depend on that claim: an idempotent retry never recomputes `suspiciousTiming` at all, it returns the already-persisted Attempt from the original processing, `suspiciousTiming` included as first computed. See "Server/generated metadata" above for the corrected rationale.

### Persist a request fingerprint/hash and compare that instead of individual fields

Considered (option B in the task that prompted this fix). Rejected for V1: it requires choosing a canonical serialization scheme and a new stored column, provides no simplification over comparing the already-loaded `Attempt` row's own fields directly, and would only report "mismatch" rather than which field differed, which is strictly worse for diagnosing a client bug. Explicit field comparison (option A) was chosen instead.

### Decide Today's Course scope now, for schema convenience

Rejected **at the time this ADR was originally written**: `docs/OPEN_QUESTIONS.md` #34 was a genuine open product question, and deciding it only to make `TodaySession`'s uniqueness key clean would have been exactly the kind of silent product decision `docs/OPEN_QUESTIONS.md` §42 (Open Question Discipline) warns against — so the uniqueness key was left unresolved. **This has since been superseded**: Today's Course scope was later decided explicitly, on its own merits, as a real product/architecture decision — see `docs/DECISIONS/011-today-is-course-scoped-v1.md` — not adopted here for schema convenience after the fact.

### Persist every NBA ranking candidate, not just the selected one

Rejected for V1, per `docs/DATABASE.md` §16's own stated reasoning: unnecessary data volume, and rankings go stale immediately as new evidence arrives. Only the selected decision is persisted; full candidate/ranking history can be added later if auditability needs justify it.

### Let the domain Today Planner resolve QuestionVersion itself

Rejected. `today-planner.ts` is deliberately pure and only consumes `NextBestActionRankedCandidate`, which has no version concept. Adding one would couple a pure ranking-consumer to content-versioning concerns it does not need for its own job (deciding inclusion/order), and would require passing `QuestionVersion` lookups into an otherwise-DB-free domain function.

## Related Documents

- `docs/DATABASE.md` (§12, §13, §16, §17, §18, §31, §32)
- `docs/ARCHITECTURE.md` (§14, §21)
- `docs/LEARNING_ENGINE.md` (§10 — response-time/suspicious-timing separation)
- `docs/OPEN_QUESTIONS.md` (#3, #34, #42)
- `docs/DECISIONS/005-attempts-are-immutable.md`
- `docs/DECISIONS/009-question-versioning.md`
- `src/domain/learning/evidence.ts` (`classifyAttemptEvidence`'s exact evidence-quality gates)

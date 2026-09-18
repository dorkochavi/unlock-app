# UNLOCK Golden Scenarios

Status: Active test-coverage map (written during the 2026-09-18 overnight hardening session)

Purpose: describe, in product language, the realistic learner histories UNLOCK's
test suite proves the Learning Engine and answer-submission pipeline handle
correctly — and link each scenario to the exact test file(s) that prove it.

This document does not define new product behavior. Every scenario below
describes ALREADY-DECIDED behavior (per the ADRs in `docs/DECISIONS/` and
`docs/LEARNING_ENGINE.md`). Where a scenario's expected behavior would depend
on an open product question, it is explicitly excluded — see "Deliberately
excluded" at the end.

---

## A. First exposure

**Story**: A learner answers a Question for the very first time. There is no
prior evidence for this learner-question pair.

**Expected behavior**: The first clean, correct answer establishes the
retrieval baseline but does NOT itself count as a spaced retrieval (there is
nothing prior to be spaced from). Evidence strength starts at `early`,
mastery starts at `learning`, misconception state starts at `none`.

**Proof**:
- `src/domain/learning/__tests__/learning-engine-golden-scenarios.test.ts` —
  scenario 1 ("new learner calibration: first clean correct evidence")
- `src/domain/learning/__tests__/retrieval-qualification.test.ts` —
  `NO_PRIOR_RETRIEVAL` reason
- `src/application/learning/__tests__/submit-answer.test.ts` — test 1 ("a new
  submission creates exactly one Attempt")

---

## B. Same-session repetition

**Story**: A learner answers the same Question correctly several times within
one sitting (same `learningSessionId`).

**Expected behavior**: Same-session repetition never qualifies as a spaced
retrieval, regardless of how many repetitions occur. `successfulSpacedRetrievals`
stays at 0, evidence strength cannot exceed `early`, and mastery cannot
advance past `learning` — no matter how large `meaningfulAttemptCount` grows.

**Proof**:
- `learning-engine-golden-scenarios.test.ts` — scenario 2 ("same-session
  repetition does not fake mastery"): 5 correct answers in one session, still
  `evidenceStrength: "early"`, `masteryCategory: "learning"`.
- `retrieval-qualification.test.ts` — `SAME_SESSION` reason.

---

## C. Spaced success

**Story**: A learner answers correctly, then answers correctly again after a
genuine gap in a different learning session.

**Expected behavior**: The second (and later) correct answers qualify as
spaced retrievals, moving `retrievalBaselineAt`/`retrievalBaselineLearningSessionId`
forward, incrementing `successfulSpacedRetrievals`, and progressing mastery
through `learning -> strengthening -> mastered` as policy thresholds are met
(spacing count, evidence strength, retrievability, and absence of an
unresolved lapse — all four gates, not just one).

**Proof**:
- `learning-engine-golden-scenarios.test.ts` — scenario 3 ("healthy
  longitudinal strengthening"), scenario 4 ("full path to mastered, never
  earlier than policy allows" — proves each of the four gates individually
  blocks mastery until satisfied).
- `retrieval-qualification.test.ts` — `QUALIFYING_SPACED_RETRIEVAL` reason.

---

## D. Lapse

**Story**: A learner who previously succeeded (including reaching `mastered`)
later answers incorrectly.

**Expected behavior**: A lapse increments `lapseCount`, sets `lastLapseAt`,
and immediately makes the item ineligible for `mastered` via
`hasUnresolvedLapse`. The lapse is NOT resolved by a same-session or
too-short-gap correct answer afterward — only a later genuinely qualifying
spaced retrieval (which moves `retrievalBaselineAt` past `lastLapseAt`)
resolves it and allows mastery to be re-earned. Full attempt history before
the lapse is never erased.

**Proof**:
- `learning-engine-golden-scenarios.test.ts` — scenario 7 ("mastered -> lapse
  -> recovery"): proves the lapse blocks mastery, that a same-session correct
  answer does NOT resolve it, and that a later qualifying retrieval does.
- `src/domain/learning/__tests__/lapse.test.ts` — `deriveHasUnresolvedLapse`
  unit coverage.
- `src/domain/learning/__tests__/next-best-action.test.ts` — `RELEARN_LAPSE`
  candidate generation from the same unresolved-lapse signal.

---

## E. Confident error

**Story**: A learner answers incorrectly while reporting high confidence.

**Expected behavior**: A clean (`FULL_EVIDENCE`), incorrect, high-confidence
answer is simultaneously a `CONFIDENT_ERROR` (misconception signal) AND a
`LAPSE` (memory signal) — both are recorded, neither silently drops the
other. Misconception state escalates `none -> suspected -> active` based on
policy-driven score thresholds, purely from confident-error evidence.
Assisted, second-attempt, revealed-answer, or low/medium-confidence wrong
answers never trigger this signal.

**Proof**:
- `learning-engine-golden-scenarios.test.ts` — scenario 5 ("confident
  misconception emergence"), scenario 6 (misconception recovery over time),
  scenario 8/9 (assisted/low-quality answers cannot repair or trigger it).
- `src/domain/learning/__tests__/misconception.test.ts`,
  `progress-update.test.ts` — the exact reason-collection logic
  (`deriveStateUpdateReasons`) proving `CONFIDENT_ERROR` and `LAPSE` can
  co-occur without one suppressing the other (a real bug this codebase fixed
  once — see `progress-update.ts`'s module doc comment).

---

## F. Out-of-order evidence

**Story**: Attempts for the same learner-question pair are recorded (or
arrive over the network) out of chronological order — e.g. answers 1, 3, 2.

**Expected behavior**: `UserQuestionProgress` after processing must be
IDENTICAL regardless of arrival order, always equal to what canonical
(`answeredAt` ascending, `createdAt` ascending, `id` ascending) replay would
produce. `submitAnswer` detects an out-of-order Attempt and synchronously
reconciles progress via a full canonical-order rebuild in the same
transaction — there is no permanently-stale state and no async queue.

**Proof**:
- `src/domain/learning/__tests__/rebuild.test.ts` — scenario 8 ("three
  Attempts replayed in arrival order 1,3,2 produce the SAME progress as
  canonical order 1,2,3"), scenario 9 (determinism), scenario 13 (createdAt
  tie-break independent of input array position).
- `learning-engine-golden-scenarios.test.ts` — scenario 11 (out-of-order
  historical evidence boundary; a correct Attempt earlier than the existing
  baseline throws `OutOfOrderRetrievalError` rather than silently computing a
  negative gap), scenario 12 (deterministic replay).
- `submit-answer.test.ts` — tests 5, 6, 8/9, 11, 12, 15 (out-of-order
  Attempts at the application/transaction layer: preserved, reconciled,
  deterministic under A,C,B vs A,B,C ordering, retried without a second
  rebuild, rolled back cleanly on a failed rebuild, and correctly complete a
  Today item).

---

## G. Historical version integrity

**Story**: A Question's content (options, correct answer) changes after
learners have already answered an earlier version of it.

**Expected behavior**: Editing a Question always creates a new immutable
`QuestionVersion` (ADR-009) and repoints `Question.current_version_id` — the
old `QuestionVersion` row is never mutated. Every `Attempt` is graded and
remains gradable against the EXACT `QuestionVersion` id it references, never
against `Question.current_version_id` at read time. Replay/rebuild never
re-grades a historical Attempt's stored `isCorrect` — it only reinterprets
already-computed correctness into learner state.

**Proof**:
- `supabase/tests/postgres/answer-correctness-checker.test.ts` — "historical
  grading: an old QuestionVersion is graded by ITS OWN definition, never by
  questions.current_version_id" (a real-Postgres integration test: creates
  two versions with different correct answers, repoints `current_version_id`
  to the newer one, and proves the older version still grades by its own
  frozen definition).
- `src/domain/learning/answer.ts`'s `evaluateAnswerCorrectness` — pure
  function of exactly `(definition, selectedAnswer)`, no hidden
  "current version" lookup (see ADR-014 Decision §2(K)/(L)).
- ADR-012's rebuild contract — `rebuildUserQuestionProgress` replays
  `Attempt.isCorrect` as already-decided historical fact; it never
  recomputes correctness.

---

## H. Today session identity

**Story**: A learner answers multiple Questions inside one Today session, and
separately does manual practice outside of Today.

**Expected behavior**: For a Today-attached Attempt, `learningSessionId` is
always derived by the application from the persisted
`TodaySessionItem.todaySessionId` — the client's claimed value is ignored
entirely (not merely validated), so a buggy or malicious client cannot force
every retrieval to appear as a new spaced session. For manual practice (no
`TodaySessionItem`), the client supplies and owns a stable
`learningSessionId` token, which participates in idempotency comparison like
any other client-owned field.

**Proof**:
- `submit-answer.test.ts` — "learningSessionId ownership (pre-commit
  correctness audit)" describe block, tests A ("a client CANNOT change
  retrieval qualification by claiming a new learningSessionId on a
  Today-attached Attempt") and B (a retry with a different client claim is
  still a safe idempotent retry, not a conflict, because the client never
  owned the field), plus the manual-practice regression test (a retry WITH a
  different `learningSessionId` for manual practice IS rejected as a
  conflict, since there the client does own it).
- `src/domain/learning/__tests__/learning-session.test.ts` — the pure
  `deriveIsSameLearningSession` comparison.
- `src/application/learning/__tests__/today-session.test.ts` — Today session
  creation/resume, confirming a `TodaySessionItem`'s `todaySessionId` is
  stable across the session's lifetime.

---

## I. Idempotent retry

**Story**: The same logical answer submission is sent twice (network retry,
double-click, replayed request) with an identical `submissionId` and
identical payload.

**Expected behavior**: Exactly one `Attempt` is ever created. The second
request returns the original result without re-invoking
`applyAttemptToProgress`, without a second learning-state update, and (on the
fast retry path) without even recomputing `isCorrect`/`suspiciousTiming` or
re-running the QuestionVersion/TodaySessionItem consistency checks.

**Proof**:
- `submit-answer.test.ts` — test 2 ("a duplicate identical submission returns
  idempotently without double-processing"), "retry short-circuit: a genuine
  retry never invokes isCorrect/suspiciousTiming or the consistency checks a
  second time" (proves the FAST path performs no correctness recomputation,
  per the Phase 1 requirement), test 11 ("a retry does not cause another
  rebuild or progress increment").

---

## J. Legitimate distinct repeat

**Story**: A learner deliberately answers the same Question twice on purpose
(e.g. manual practice retry) using two different `submissionId`s.

**Expected behavior**: Both Attempts are accepted and retained as separate
historical records — this is not idempotency-deduplicated, and both
contribute to accumulated progress (`attemptCount` increases by 2, not
treated as 1).

**Proof**:
- `submit-answer.test.ts` — new test "J. two intentional answers to the same
  question with different submissionIds are BOTH retained as distinct
  Attempts (contrast with test 2's same-submissionId dedup)" (added during
  this session — the existing suite proved the contrast implicitly across
  several out-of-order tests using distinct submissionIds, but had no single
  test stating this contract directly; see `docs/INVARIANT_MATRIX.md` for
  the reasoning).
- Contrast with test 3 ("the same submissionId with a different logical
  command is rejected as an idempotency-key conflict") — the dividing line
  between "same submissionId, different answer" (rejected) and "different
  submissionId, different answer" (accepted, both retained) is what
  distinguishes idempotency-key identity from genuine repeat practice.

---

## Deliberately excluded

The Phase 1 brief for this session also suggested scenarios that depend on
still-open product questions and are intentionally NOT modeled as golden
scenarios yet:

- **Starter/calibration experience** for a brand-new learner with zero
  Course-wide evidence (`docs/OPEN_QUESTIONS.md` #4/#5) — `today-planner.ts`
  deliberately returns an empty plan rather than inventing filler content;
  see its own module doc comment.
- **Today session boundary / "what counts as today"**
  (`docs/OPEN_QUESTIONS.md` #3) — `plannedForDate` is treated as an opaque,
  caller-supplied string throughout; no scenario asserts a specific
  timezone/day-boundary behavior because none is decided.
- **Exam urgency effects on ranking** (`docs/OPEN_QUESTIONS.md` #2) — not yet
  a ranking input.
- **Evidence-strength/mastery/misconception/retrieval-qualification
  production threshold values** (`docs/OPEN_QUESTIONS.md` #11, #12, #13) —
  every scenario above uses injected test policies, matching the domain
  layer's explicit "no default production policy" design; the scenarios
  prove the RULES, not any particular numeric threshold.

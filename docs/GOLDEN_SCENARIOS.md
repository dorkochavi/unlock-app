# UNLOCK Golden Scenarios

Status: Active supporting test/evidence map

Load level: COLD

Purpose: describe, in product language, the realistic learner histories and critical product behaviors that UNLOCK's automated tests currently prove — and link each scenario to the exact test file(s) that provide that evidence.

This document is a map from important product behavior to automated evidence.

It does not define new product behavior.

Canonical behavior is owned by:

* accepted ADRs in `docs/DECISIONS/`;
* current canonical product/domain documentation;
* `docs/LEARNING_ENGINE.md` for adopted Learning Engine detail;
* committed implementation and tests.

If this document conflicts with a newer accepted decision or current implementation, the newer authority controls and this evidence map should be reconciled.

Legacy behavior may remain documented when the repository still intentionally supports or tests it, but legacy scenarios must be labeled as such.

---

## A. First exposure

**Story:** A learner answers a Question for the very first time. There is no prior evidence for this learner-question pair.

**Expected behavior:** The first clean, correct answer establishes the retrieval baseline but does NOT itself count as a spaced retrieval because there is nothing prior to be spaced from.

Evidence strength starts at `early`, mastery starts at `learning`, and misconception state starts at `none` under the current implemented Learning Engine vocabulary.

**Proof:**

* `src/domain/learning/__tests__/learning-engine-golden-scenarios.test.ts`

  * scenario 1: new learner calibration / first clean correct evidence;
* `src/domain/learning/__tests__/retrieval-qualification.test.ts`

  * `NO_PRIOR_RETRIEVAL`;
* `src/application/learning/__tests__/submit-answer.test.ts`

  * new submission creates exactly one Attempt.

---

## B. Same-session repetition

**Story:** A learner answers the same Question correctly several times within one learning session.

**Expected behavior:** Same-session repetition never qualifies as a genuinely spaced retrieval, regardless of how many repetitions occur.

Repeated correct answers inside one session must not manufacture longitudinal mastery.

`successfulSpacedRetrievals` therefore remains unchanged by same-session repetition, and evidence/mastery cannot advance merely because the learner repeated the Question immediately.

**Proof:**

* `learning-engine-golden-scenarios.test.ts`

  * same-session repetition does not fake mastery;
* `retrieval-qualification.test.ts`

  * `SAME_SESSION`.

---

## C. Spaced success

**Story:** A learner answers correctly, then later answers correctly again after a genuine gap in a different learning session.

**Expected behavior:** Later qualifying correct retrievals can count as spaced retrieval evidence.

They may:

* move the retrieval baseline forward;
* increment successful spaced retrieval evidence;
* strengthen the learner's current state;
* contribute toward mastery when all applicable gates are satisfied.

Mastery must not be granted from one signal alone.

**Proof:**

* `learning-engine-golden-scenarios.test.ts`

  * healthy longitudinal strengthening;
  * full path to mastered;
  * individual mastery gates prevent premature mastery;
* `retrieval-qualification.test.ts`

  * `QUALIFYING_SPACED_RETRIEVAL`.

---

## D. Lapse

**Story:** A learner who previously demonstrated successful knowledge later answers incorrectly.

**Expected behavior:** The lapse remains meaningful historical evidence.

It:

* increments lapse evidence;
* records the lapse time;
* can make previously strong knowledge require relearning;
* is not erased by an immediate same-session correct answer.

A later genuinely qualifying retrieval may resolve the active lapse condition and allow the learner state to strengthen again.

Historical Attempts remain preserved throughout.

**Proof:**

* `learning-engine-golden-scenarios.test.ts`

  * mastered → lapse → recovery;
* `src/domain/learning/__tests__/lapse.test.ts`

  * unresolved-lapse derivation;
* `src/domain/learning/__tests__/next-best-action.test.ts`

  * `RELEARN_LAPSE` candidate generation.

---

## E. Confident error

**Story:** A learner answers incorrectly while reporting high confidence.

**Expected behavior:** A clean incorrect high-confidence answer may simultaneously provide:

* misconception evidence;
* memory/lapse evidence.

Neither signal should silently suppress the other.

Assisted, revealed-answer, low-quality, or otherwise weak evidence must not automatically receive the same interpretation as a clean confident error.

**Proof:**

* `learning-engine-golden-scenarios.test.ts`

  * confident misconception emergence;
  * misconception recovery;
  * weak/assisted evidence does not falsely trigger or repair strong signals;
* `src/domain/learning/__tests__/misconception.test.ts`;
* `src/domain/learning/__tests__/progress-update.test.ts`

  * state-update reasons allow `CONFIDENT_ERROR` and `LAPSE` to coexist.

---

## F. Out-of-order evidence

**Story:** Attempts for the same learner-question pair are stored or arrive out of chronological order.

Example:

```text id="d5vu5k"
Attempt 1
Attempt 3
Attempt 2
```

**Expected behavior:** Final `UserQuestionProgress` must be equivalent to canonical chronological replay.

Canonical ordering uses stable Attempt ordering rather than arrival order.

When an out-of-order Attempt reaches the application path, learner progress is reconciled from immutable historical Attempts rather than permanently preserving stale derived state.

**Proof:**

* `src/domain/learning/__tests__/rebuild.test.ts`

  * arrival order 1,3,2 produces the same derived progress as canonical 1,2,3;
  * deterministic replay;
  * stable tie-breaking;
* `learning-engine-golden-scenarios.test.ts`

  * out-of-order historical evidence boundary;
  * deterministic replay;
* `src/application/learning/__tests__/submit-answer.test.ts`

  * out-of-order Attempts are preserved and reconciled;
  * retries do not cause duplicate rebuilds;
  * failed rebuilds roll back;
  * applicable planned-item completion remains transactional.

---

## G. Historical QuestionVersion integrity

**Story:** A Question's content changes after learners already answered an earlier version.

**Expected behavior:** Historical evidence remains interpretable.

Editing Question content creates a new immutable `QuestionVersion`.

An existing historical QuestionVersion is not rewritten.

Every Attempt remains linked to the exact QuestionVersion presented to the learner.

Historical Attempts are not later regraded against `Question.current_version_id`.

**Proof:**

* `supabase/tests/postgres/answer-correctness-checker.test.ts`

  * an older QuestionVersion is graded according to its own frozen definition even after `current_version_id` changes;
* `src/domain/learning/answer.ts`

  * `evaluateAnswerCorrectness` evaluates the supplied frozen answer definition;
* ADR-009;
* ADR-012;
* ADR-014.

---

# Current Today / DailyPlan Scenarios

The following scenarios represent the current primary Today model.

`DailyPlan` / `DailyPlanItem` are the sole active Today runtime and persistence model — the superseded Course-scoped `TodaySession` model was retired before Run 009 (ADR-011's current status note).

---

## H. Same learner-local day returns the same DailyPlan

**Story:** A learner opens Today more than once during the same learner-local calendar day.

**Expected behavior:** The same persisted DailyPlan is returned.

Today is not silently regenerated on:

* refresh;
* reopening;
* navigating away and back;
* repeated API/application calls on the same local day.

The frozen plan remains the learner's Today plan for that local day.

**Proof:**

* `src/application/dailyPlan/__tests__/get-or-create-daily-plan-for-today.test.ts`

  * `I. two calls on the same local day return the same persisted DailyPlan without regeneration`;
* `src/application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`

  * `A. resumes an existing DailyPlan without re-reading progress/candidates/versions`;
  * `K. resumes a persisted empty plan without regenerating on a second call`;
* `supabase/tests/postgres/daily-plan-repository.test.ts`

  * same `(user, date)` key returns the existing plan rather than creating a duplicate.

---

## I. Learner-local day, not UTC day, controls Today

**Story:** A learner's timezone causes their local calendar date to differ from UTC.

**Expected behavior:** DailyPlan lookup/generation uses the learner's persisted IANA timezone to derive the learner-local date.

The server must not use the UTC calendar date as a substitute for the learner's local day.

A call after the learner crosses local midnight may produce/load a different DailyPlan.

**Proof:**

* `src/application/dailyPlan/__tests__/get-or-create-daily-plan-for-today.test.ts`

  * Asia/Jerusalem local date is derived correctly when different from UTC;
  * America/New_York local date is derived correctly when different from UTC;
  * next local day produces a different DailyPlan;
* `src/domain/user/__tests__/local-date.test.ts`;
* `src/domain/user/__tests__/timezone.test.ts`;
* `supabase/tests/postgres/daily-plan-repository.test.ts`

  * `plannedForDate` round-trips exactly across a year boundary.

---

## J. Only eligible active LEARNER memberships participate automatically

**Story:** The same user has different relationships with multiple Courses.

Some may be:

* `LEARNER`;
* `OWNER`;
* `INSTRUCTOR`;
* archived;
* revoked.

**Expected behavior:** Automatic Global Today generation uses only eligible active `LEARNER` memberships.

OWNER/INSTRUCTOR-only Courses do not automatically contribute Today work.

Archived or revoked learner memberships are excluded.

Duplicate membership input must not duplicate candidate processing.

**Proof:**

* `src/application/dailyPlan/__tests__/get-or-create-daily-plan-for-today.test.ts`

  * `D. pools progress only from LEARNER-role Courses`;
  * `E. excludes an archived LEARNER membership`;
  * `F. excludes a revoked LEARNER membership`;
  * `J. duplicate LEARNER memberships ... do not leak duplicated processing`;
  * `L. new-material discovery reuses the SAME LEARNER-only eligible Course set`.

---

## K. Global DailyPlan ranks eligible work once across Courses

**Story:** A learner participates in several eligible Courses and has learning needs in more than one.

**Expected behavior:** Today is one Global DailyPlan.

Eligible candidates from participating Courses are pooled and ranked together rather than independently generating competing per-Course Today sessions.

The final persisted plan contains the selected globally ranked work.

**Proof:**

* `src/application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`

  * `B. pools progress across multiple Courses and ranks once globally`;
  * `C. truncates to maxItems when more candidates are ranked than policy allows`;
  * `D. persists exactly the ranked candidate count when fewer exist — no filler`;
  * `I. deduplicates eligibleCourseIds`.

Canonical product semantics:

* ADR-016.

---

## L. DailyPlan freezes QuestionVersion identity at generation time

**Story:** A DailyPlan is generated and later the underlying Question is edited.

**Expected behavior:** The existing DailyPlan continues to refer to the QuestionVersion selected at generation time.

Resuming the plan must not silently replace the item with a newer QuestionVersion.

This protects reproducibility and historical integrity.

**Proof:**

* `src/application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`

  * `F. freezes the current QuestionVersion at generation time and never re-resolves it on resume`;
* `supabase/tests/postgres/daily-plan-repository.test.ts`

  * frozen item fields persist exactly.

---

## M. DailyPlan creation is atomic and race-safe

**Story:** Plan persistence fails partway through, or two requests attempt to create the same learner/day plan concurrently.

**Expected behavior:**

A persistence failure must not leave a partial plan.

Concurrent creation must not produce two valid DailyPlans for the same learner/local date.

When another transaction wins the create race, the caller should return the persisted winner.

**Proof:**

* `src/application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`

  * `G. rolls back the whole transaction on a persistence failure`;
  * `H. returns the concurrent winner rather than the locally generated plan`;
* `supabase/tests/postgres/daily-plan-repository.test.ts`

  * `createIfNotExists` is race-safe for `(user, date)`;
* `supabase/tests/postgres/daily-plan-unit-of-work.test.ts`

  * transaction behavior.

---

## N. Fresh learner receives New Material instead of an artificial empty Today

**Story:** A learner has:

* an active eligible LEARNER membership;
* no Attempts;
* no UserQuestionProgress;
* eligible unseen Questions.

**Expected behavior:** The learner can receive unseen Questions through the ADR-017 New Material fallback.

The system must not interpret "no historical progress" as "nothing useful to study."

New Material activates only when ordinary learning candidates are empty.

It does not mix with ordinary candidates merely to fill plan size.

**Proof:**

* `src/application/dailyPlan/__tests__/get-or-create-daily-plan-for-today.test.ts`

  * `K. fresh learner regression ... Today is non-empty`;
* `src/application/dailyPlan/__tests__/generate-daily-plan-for-resolved-inputs.test.ts`

  * `L. fresh learner ... receives exactly 3`;
  * `M. only 2 eligible unseen questions → selects only those`;
  * `N. normal candidate exists → unseen fallback NEVER activates`;
  * `O. no normal or unseen candidate → legitimately empty`;
  * `P. existing fallback plan does not re-query unseen questions`;
  * `Q. new-material selection creates no UserQuestionProgress row`.

Canonical product semantics:

* ADR-017.

---

## O. New Material placement is not learning evidence

**Story:** An unseen Question is selected into Today as New Material.

**Expected behavior:** Merely placing the Question into DailyPlan does not create evidence that the learner knows it.

Selection must not fabricate:

* mastery;
* Attempt history;
* UserQuestionProgress;
* successful retrieval evidence.

Learning evidence begins when the learner actually interacts in a way the accepted learning model treats as evidence.

**Proof:**

* `generate-daily-plan-for-resolved-inputs.test.ts`

  * `Q. new-material selection creates no UserQuestionProgress row`;
* ADR-017.

---

## P. Answering a DailyPlanItem uses server-owned item identity

**Story:** A learner submits an answer for one DailyPlanItem.

**Expected behavior:** The application resolves the item and uses the authoritative persisted item identity.

The answer command does not trust client-provided:

* courseId;
* questionId;
* questionVersionId;
* DailyPlan identity.

The resolved DailyPlanItem supplies those values.

An item belonging to another user must behave like a missing/not-owned resource rather than leak its existence.

**Proof:**

* `src/application/dailyPlan/__tests__/submit-daily-plan-item-answer.test.ts`

  * nonexistent item → `ITEM_NOT_FOUND_OR_NOT_OWNED`;
  * item owned by another user → same fail-closed result;
  * matching owner → `submitAnswer` receives the looked-up item's own Course/Question/QuestionVersion/DailyPlan identity;
  * the underlying answer path still performs its own consistency re-check;
* `src/app/api/daily-plan/items/[itemId]/answer/__tests__/handle-submit-daily-plan-item-answer.test.ts`;
* route auth/DB-ordering regression coverage under the same endpoint.

---

## Q. Answering a DailyPlanItem preserves the trusted learning transaction

**Story:** A learner answers one Question from Today.

**Expected behavior:** The DailyPlan answer path remains part of the trusted answer-submission transaction.

The action must preserve:

* immutable Attempt creation;
* idempotency;
* learner-progress update;
* DailyPlanItem resolution;
* ownership/identity consistency.

A DailyPlan wrapper must not create a second independent learning-update implementation.

**Proof:**

* `src/application/dailyPlan/__tests__/submit-daily-plan-item-answer.test.ts`;
* `src/application/learning/__tests__/submit-answer.test.ts`;
* relevant PostgreSQL DailyPlan Unit-of-Work tests;
* ADR-010;
* ADR-016.

---

## R. Skip resolves Today without creating false evidence

**Story:** A learner does not want to answer one Today item and chooses Skip.

**Expected behavior:** Skip resolves the DailyPlanItem as `SKIPPED`.

Skip must not:

* create an incorrect Attempt;
* create mastery evidence;
* create replacement work automatically;
* mutate an already-resolved item;
* leak whether another learner owns a requested item.

Repeated Skip is idempotent at the resolution level.

**Proof:**

* `src/application/dailyPlan/__tests__/skip-daily-plan-item.test.ts`

  * owner can Skip pending item;
  * nonexistent/not-owned items fail closed;
  * completed/skipped items return `ALREADY_RESOLVED`;
* `supabase/tests/postgres/daily-plan-repository.test.ts`

  * `markSkipped` resolves a pending item exactly once;
  * completed/skipped cross-status resolution is rejected as already resolved;
* `supabase/tests/postgres/skip-daily-plan-item.test.ts`;
* DailyPlan Skip API handler/route tests;
* ADR-016.

---

# Core Answer-Submission Scenarios

The following remain critical regardless of whether the Attempt originated from Today or Manual Practice.

---

## S. Idempotent retry

**Story:** The same logical answer submission is sent twice due to:

* network retry;
* double-click;
* replayed request.

The requests use the same `submissionId` and identical canonical command identity.

**Expected behavior:** Exactly one Attempt is created.

The retry returns the original logical result without applying the learning update a second time.

A reused `submissionId` with a different logical command is rejected rather than silently treated as the same submission.

**Proof:**

* `src/application/learning/__tests__/submit-answer.test.ts`

  * duplicate identical submission returns idempotently;
  * retry does not cause another progress increment/rebuild;
  * mismatched logical command using the same submissionId is rejected;
* database uniqueness on `(user_id, submission_id)` through the accepted persistence model;
* ADR-010.

---

## T. Legitimate distinct repeat

**Story:** A learner deliberately answers the same Question more than once, for example during Manual Practice, using different `submissionId`s.

**Expected behavior:** Distinct intentional submissions remain separate immutable Attempts.

Idempotency must not deduplicate real repeated practice merely because:

* the Question is the same;
* the learner is the same.

The idempotency identity is the submission, not the user-question pair.

**Proof:**

* `src/application/learning/__tests__/submit-answer.test.ts`

  * distinct submissions to the same Question are retained separately;
* contrast with the same-submissionId idempotency tests.

---

# Deliberately Excluded From This Evidence Map

A Golden Scenario should only exist when the underlying product behavior is accepted and the repository has evidence that actually proves it.

Do not turn an unresolved question into a Golden Scenario.

Current exclusions include:

## Exact exam-date hierarchy and urgency calibration

Exam urgency is an accepted learning consideration, but the exact V1 exam-date hierarchy/calibration remains governed by current accepted decisions and `docs/OPEN_QUESTIONS.md`.

Do not encode a disputed personal/group/course precedence here.

## Exact production threshold values

Numeric calibration for concepts such as:

* evidence strength;
* mastery transitions;
* misconception transitions;
* retrieval qualification;
* other policy thresholds;

should not be inferred from test fixtures.

Many domain scenarios use injected policies specifically so tests prove behavioral rules rather than accidentally canonizing arbitrary numeric values.

Current calibration status belongs in:

`docs/OPEN_QUESTIONS.md`

and relevant accepted ADRs.

## Deferred product capabilities

Do not create Golden Scenarios merely for future architecture such as:

* deep Knowledge Graph;
* autonomous AI coach;
* sophisticated intervention models;
* advanced institutional flows;
* deferred analytics/ML capabilities.

They become Golden Scenarios only when their behavior becomes accepted active scope.

---

# Evidence Interpretation Rules

A test proves only the layer it actually exercises.

Examples:

```text id="f9rmta"
domain unit test
≠
real PostgreSQL proof
```

```text id="kh2j2e"
PGlite schema/integration test
≠
hosted Supabase verification
```

```text id="m8t5s5"
route wiring test
≠
browser E2E
```

```text id="gqkswg"
browser E2E
≠
proof of every concurrency condition
```

Use `docs/TESTING.md` for the conceptual testing strategy.

Use the operational testing policy for deciding what verification is required for a current change.

This file only maps important behavior to existing evidence.

---

# Maintenance Rule

Update this document when:

* a new product-critical invariant gains meaningful automated evidence;
* the primary implementation path changes;
* an accepted ADR changes the behavior represented by a scenario;
* a referenced test is replaced or removed.

Do not update it merely because:

* a test file was mechanically reorganized;
* a Run completed;
* a reviewer made a non-behavioral observation.

When old behavior remains only for compatibility, move its scenario under:

`Legacy Compatibility Scenarios`

rather than allowing historical behavior to remain indistinguishable from the current product model.

---

# Key Principle

> Golden Scenarios describe important behavior the current product relies on and point to the evidence that proves it.

> They do not create product policy.

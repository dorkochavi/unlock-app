---

paths:

* "src/domain/**"
* "src/application/learning/**"
* "src/application/dailyPlan/**"
* "src/infrastructure/learning/**"
* "src/infrastructure/dailyPlan/**"

---

# UNLOCK — Learning Engine Guardrail

Status: ACTIVE
Purpose: protect accepted Learning Engine and DailyPlan invariants during implementation.

This rule is a compact implementation guardrail.

It does not replace:

* `docs/LEARNING_ENGINE.md`;
* accepted ADRs;
* `docs/OPEN_QUESTIONS.md`;
* `docs/GOLDEN_SCENARIOS.md`;
* `.claude/rules/testing.md`.

Do not use this file to invent new learning policy or calibration.

---

## 1. Deterministic Learning Logic

Core Learning Engine behavior must remain deterministic for the same:

* persisted evidence;
* accepted policy;
* explicit time/context inputs.

Do not introduce LLM calls into:

* answer correctness;
* learner-state transitions;
* mastery derivation;
* misconception logic;
* review scheduling;
* Next Best Action ranking;
* DailyPlan selection.

AI may assist content workflows elsewhere.

It is not the real-time learning decision-maker.

---

## 2. Immutable Historical Evidence

Attempts are immutable historical evidence.

Do not:

* overwrite Attempts to reflect new learner state;
* mutate an old Attempt after algorithm changes;
* reinterpret an Attempt against a newer QuestionVersion.

QuestionVersion is an immutable content snapshot.

An Attempt must remain interpretable according to the exact version the learner saw.

Derived state may evolve.

Historical evidence must remain preserved.

---

## 3. Derived Learner State

`UserQuestionProgress` and broader learner-state signals are derived from evidence.

Do not confuse:

```text
Attempt
= what happened
```

with:

```text
UserQuestionProgress
= what UNLOCK currently believes
```

Derived state may be:

* updated;
* recalculated;
* replayed;
* rebuilt;

according to accepted logic.

Raw evidence must not be rewritten to match current conclusions.

---

## 4. Deterministic Replay

Where learner state is rebuildable from Attempts, preserve deterministic replay.

Important properties include:

* stable ordering;
* explicit tie-breaking;
* consistent out-of-order handling;
* equivalent state under canonical replay;
* no dependence on incidental database arrival order.

Do not change replay ordering casually.

If replay semantics materially change, evaluate engine-version implications.

---

## 5. Explicit Time

Learning logic that depends on time should receive explicit time/context inputs where practical.

Avoid hidden wall-clock calls inside deterministic domain behavior.

Timezone-sensitive learner-day decisions belong to the accepted application/domain boundary.

The persisted learner IANA timezone is authoritative for current DailyPlan local-day behavior.

---

## 6. Evidence Quality

Not every learner interaction has equal evidentiary value.

Preserve accepted distinctions such as:

* clean retrieval;
* assisted/revealed response;
* same-session repetition;
* spaced retrieval;
* lapse;
* confident incorrect response;
* low-confidence correct response.

Do not silently upgrade weak evidence into strong mastery evidence.

Do not silently suppress meaningful negative evidence.

---

## 7. Mastery Guardrails

Mastery is:

* evidence-based;
* cumulative;
* reversible;
* not granted by one correct answer;
* not permanently terminal.

Same-session repetition must not manufacture spaced mastery.

Previously strong knowledge may become relevant again when forgetting risk rises.

Do not hard-code new mastery thresholds or state transitions unless an accepted decision explicitly authorizes them.

Current internal enum names may differ from product-facing terminology.

Do not rename them during unrelated work.

---

## 8. Misconception Guardrails

A misconception is stronger than an ordinary isolated error.

Preserve accepted principles:

* one ordinary wrong answer does not automatically imply a strong misconception;
* high-confidence wrong evidence is more meaningful;
* repeated relevant error patterns matter;
* misconception state should require convincing evidence to resolve;
* elapsed time alone does not resolve a misconception.

Do not change the implemented misconception state machine or thresholds during unrelated work.

---

## 9. Memory Scheduling

FSRS-backed scheduling is the current memory-scheduling foundation.

Preserve the ability for previously strong material to become relevant again as forgetting risk increases.

Do not:

* permanently suppress mastered material;
* add arbitrary maintenance quotas;
* replace FSRS behavior with ad hoc interval tables;
* invent new rating/retention calibration without an accepted decision.

Exact scheduler mapping/calibration remains owned by current accepted decisions/open questions.

---

## 10. Next Best Action

Next Best Action ranking is based on learning need.

It is not a fairness scheduler between Courses.

Relevant accepted signals may include:

* memory/forgetting need;
* learning gap;
* misconception evidence;
* mastery/weakness;
* exam urgency when valid;
* other explicitly accepted context.

Preserve these constraints:

* no per-Course fairness quotas;
* no guaranteed representation for every Course;
* Courses without exams remain eligible through ordinary learning need;
* exam urgency amplifies relevant need rather than acting as the sole eligibility gate;
* ranking is global across eligible learner Courses.

Do not invent exact weights.

---

## 11. DailyPlan Is the Current Today Model

`DailyPlan` / `DailyPlanItem` are the primary current Today model.

Preserve:

* one DailyPlan per learner per learner-local calendar day;
* Global Today and Course Today use the same persisted plan;
* one plan may contain items from several eligible Courses;
* same-day reopening returns the persisted plan;
* Today is frozen by default after generation.

Do not create a second independent per-Course Today plan.

Legacy `TodaySession` behavior may remain for compatibility where still implemented.

Do not treat it as the current primary model.

---

## 12. Eligible Courses

Automatic DailyPlan generation uses eligible active `LEARNER` memberships.

Do not automatically include:

* OWNER-only memberships;
* INSTRUCTOR-only memberships;
* revoked memberships;
* archived memberships.

Course ownership and automatic learner participation are separate concepts.

---

## 13. New Material

New Material behavior is governed by ADR-017.

Preserve these V1 rules:

* unseen means no prior real Attempt for the Question;
* missing UserQuestionProgress alone does not prove unseen;
* ordinary learning candidates always take precedence;
* New Material activates only when ordinary candidates are empty;
* do not use unseen material merely as filler;
* select at most the accepted fallback limit;
* selection must remain deterministic;
* do not add per-Course fairness;
* placing a Question into DailyPlan creates no learner evidence;
* do not fabricate UserQuestionProgress merely because material was planned.

The first real learner interaction creates evidence through the normal answer path.

---

## 14. Plan Size and Finish Line

DailyPlan size is driven by meaningful learning need.

Do not:

* force-fill a cosmetic target;
* create endless replenishment;
* add replacement items because one was skipped;
* silently encode provisional min/max/calibration values as permanent rules.

Today must have a real finish line.

When all DailyPlanItems are resolved, Today is complete for that learner-local day.

Additional practice exists outside that DailyPlan.

---

## 15. Frozen Plan Semantics

After generation, the current day's DailyPlan is frozen by default.

Ordinary learner activity must not silently trigger same-day global reranking.

Preserve:

* completed items remain resolved;
* skipped items remain resolved;
* Manual Practice does not regenerate Today;
* item resolution does not automatically add replacement work;
* persisted QuestionVersion identity remains frozen.

Any future mid-day adaptation requires an explicit accepted product decision.

---

## 16. Skip

Skip is resolution, not learning evidence.

Skip must not:

* create an incorrect Attempt;
* reduce mastery as if the learner answered incorrectly;
* create misconception evidence;
* create replacement work;
* reopen an already-resolved item.

Skip resolves the Today item without asserting success or failure of knowledge.

---

## 17. Manual Practice

Manual Practice is separate from Today.

Manual Practice may:

* create valid Attempts;
* update learner state;
* affect future DailyPlan generation;
* permit intentional re-answering.

Manual Practice must not automatically:

* complete a matching DailyPlanItem;
* skip/remove a DailyPlanItem;
* resolve Today;
* trigger same-day DailyPlan regeneration.

Do not merge these product paths accidentally.

---

## 18. Exam Urgency

Exam context may amplify learning urgency.

Preserve:

* an exam is not required for Course/question eligibility;
* no exam date may be fabricated;
* exam urgency interacts with actual learning need;
* urgency does not replace the broader Learning Engine.

Do not hard-code unresolved:

* date hierarchy;
* urgency curve;
* thresholds;
* timing windows;
* weights.

Use accepted decisions and `docs/OPEN_QUESTIONS.md`.

---

## 19. Engine Versioning

Retain engine-version metadata where current architecture expects it.

A material change to:

* learner-state derivation;
* replay semantics;
* ranking behavior;
* Today planning semantics;

may require an engine-version decision.

Do not bump engine version for:

* UI changes;
* formatting;
* route wiring;
* unrelated infrastructure.

Do not invent versioning granularity.

---

## 20. Scope Discipline

Learning work must not silently absorb unrelated product or infrastructure changes.

Examples:

* API work must not rename mastery states;
* auth work must not change ranking;
* UI work must not redefine misconception logic;
* PostgreSQL cleanup must not redefine Today semantics;
* New Material work must not redefine general DailyPlan calibration.

If repository reality exposes a genuine unresolved learning/product decision, report:

```text
PLAN_CONFLICT
- assumption
- repository reality
- why it matters
- decision required
```

Do not invent the answer.

---

## 21. Source of Truth

When learning semantics are unclear, use this order:

1. relevant accepted ADR;
2. `docs/LEARNING_ENGINE.md`;
3. relevant canonical product/domain document;
4. `docs/OPEN_QUESTIONS.md`;
5. current implementation/tests as evidence of repository reality.

Accepted ADRs override older conflicting design prose.

Historical Run Reports are not a current decision source.

---

## 22. Verification Ownership

This rule does not define which tests or commands must run.

Use:

`.claude/rules/testing.md`

for:

* Learning Engine verification selection;
* Golden Scenario/regression evidence;
* replay evidence;
* DailyPlan evidence;
* freshness/invalidation;
* escalation.

Do not duplicate testing policy here.

---

## 23. Core Principle

> Preserve immutable evidence.

> Keep learner-state updates deterministic and replayable.

> Let learning need — not Course fairness — drive ranking.

> Keep DailyPlan stable and finite.

> Do not turn unresolved calibration into hidden implementation policy.

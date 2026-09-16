# UNLOCK Learning Engine V1 — Design Draft 0.2

Status: DESIGN CANDIDATE — ready to place in `docs/` after project review  
Scope: Learning Engine V1 only. This is not the full product roadmap.

This version consolidates:
- the current UNLOCK/Base44 prototype audit;
- the earlier Learning Engine draft;
- the later Claude research/conversations supplied by the product owner;
- external verification of the strongest learning-science claims.

The Base44 prototype is historical evidence and inspiration. It is not the target architecture or algorithm.

---

# 1. Product Learning Thesis

UNLOCK should not optimize for:

> “How many questions did the learner answer?”

or:

> “How many correct answers happened in a row?”

The core question is:

> Given the learner’s complete evidence history, what learning action is most useful now to increase durable retrieval over the relevant time horizon?

The engine must be:
- deterministic;
- explainable;
- fast;
- testable;
- versioned;
- independent of LLM calls at answer time;
- based on immutable raw evidence;
- conservative when evidence is weak.

---

# 2. Scientific Foundation

V1 is built around two high-utility learning techniques:

1. **Retrieval / practice testing**
2. **Distributed practice / spacing**

These remain the primary learning mechanisms.

Supporting mechanisms may include:
- confidence reflection;
- feedback;
- interleaving after sufficient initial acquisition;
- generation / self-explanation;
- preparation-to-teach;
- pretesting.

These are supporting layers, not reasons to expand V1 uncontrollably.

---

# 3. Metacognitive Design Principle

Learners often prefer rereading and stop retrieval too early because familiarity can feel like mastery.

Therefore UNLOCK must not reward a false feeling of knowledge.

The system should repeatedly distinguish:

```text
feels familiar
≠
can retrieve
≠
can retrieve after time has passed
```

This is one reason the primary recurring experience remains active learning through Today / Quiz, not passive review.

---

# 4. Engine Layers

```text
Raw Attempt
↓
Attempt Validity / Assistance Classification
↓
Evidence Interpretation
↓
Memory Scheduler
↓
Misconception State
↓
UserQuestionProgress
↓
Evidence Strength
↓
Next Best Action
↓
Today Planner
```

Every layer has one responsibility.

---

# 5. Raw Attempt Is the Historical Truth

Attempts are append-only and immutable.

Minimum V1 Attempt evidence:

```text
attempt_id
submission_id

user_id
course_id
question_id
question_version_id OR immutable question snapshot reference

answered_at
is_correct
selected_answer

confidence_level
response_time_seconds

today_session_id nullable
today_session_item_id nullable

assistance_used
attempt_number_for_presented_item

engine_version
```

Important:
- first-answer evidence is the main knowledge measurement;
- a second chance may exist as learning UX, but must not rewrite the first Attempt;
- missing response time is `null`, never `0`.

---

# 6. Submission Idempotency

Repeated network requests must not create multiple Attempts.

Every first-answer submission requires a unique identity.

Logical write path:

```text
submit
↓
validate submission_id
↓
create immutable Attempt
↓
update UserQuestionProgress
↓
update TodaySessionItem
↓
commit
```

Gamification is not part of the critical evidence transaction.

---

# 7. Evidence Quality

Not every correct answer is equally strong evidence.

Classify every Attempt before updating learning state.

Draft:

```text
FULL_EVIDENCE
ASSISTED_EVIDENCE
LOW_QUALITY_EVIDENCE
INVALID_FOR_MASTERY
```

Examples:

### FULL_EVIDENCE
Normal first attempt with no meaningful assistance.

### ASSISTED_EVIDENCE
Correct after a hint / 50:50 / other help.

### LOW_QUALITY_EVIDENCE
Potentially useful but compromised by context, suspicious timing, or a second attempt.

### INVALID_FOR_MASTERY
Duplicate submission, answer revealed before response, corrupted timing, or other invalid measurement.

This classification prevents scattered special-case logic across the engine.

---

# 8. Assistance Is Explicit Data

Do not infer assistance later.

Possible V1 values:

```text
NONE
FIFTY_FIFTY
HINT
SECOND_ATTEMPT
ANSWER_REVEALED
OTHER
```

A correct assisted response may still be a useful learning event.

It should not automatically count as full mastery evidence.

---

# 9. Response Time

Base44 used a universal 30-second threshold.

V1 will not.

Track:

```text
raw_response_time
timed_attempt_count
average_response_time
```

Later, if sufficient data exists:

```text
relative_response_time =
response_time / expected_time
```

Expected time may eventually use:
- question baseline;
- learner baseline;
- question type;
- empirical item statistics.

Until enough data exists:

```text
time_signal = neutral
```

Response time is supporting evidence, not a primary truth signal.

---

# 10. Suspicious Timing / Gaming

V1 should preserve the ability to identify low-quality evidence.

Do NOT use one universal rule such as:

```text
< 5 seconds = cheating
```

Instead, design a future-compatible anomaly signal.

Inputs may include:
- response time relative to question baseline;
- repeated ultra-fast responses;
- assistance;
- answer pattern;
- session behavior.

V1 requirement:
- store the data;
- allow evidence to be downgraded;
- do not build complex fraud ML before real usage exists.

---

# 11. Confidence / CBM

Use a simple three-level scale:

```text
low
medium
high
```

Confidence is diagnostic evidence, not truth.

Do not:
- award/penalize XP directly from confidence;
- let confidence create mastery;
- interpret confidence identically across all users.

Primary V1 value:

```text
incorrect + high confidence
→ strong misconception signal
```

Confidence calibration can become a later learner metric.

---

# 12. Memory Scheduler

Recommended direction:

Use an FSRS-family scheduler behind an internal adapter.

Do not couple UNLOCK domain logic to:
- a specific FSRS version;
- a fixed parameter count;
- the external library’s type system.

Conceptual interface:

```ts
interface MemoryScheduler {
  initialize(input: InitialReviewInput): MemoryState;
  review(state: MemoryState, evidence: SchedulerEvidence): MemoryReviewResult;
  estimateRetrievability(state: MemoryState, at: Date): number;
}
```

The adapter should make it possible to:
- upgrade the scheduler;
- test it independently;
- recalculate state later;
- compare versions.

---

# 13. FSRS Is Not the Learning Engine

FSRS answers questions about memory scheduling.

It does NOT decide:
- misconception remediation;
- Course coverage;
- Today composition;
- exam urgency;
- question quality;
- learner motivation;
- teacher intervention;
- knowledge graph;
- content generation.

UNLOCK’s intelligence lives above and around the scheduler.

---

# 14. Separate Memory Difficulty From Item Difficulty

These concepts must never be conflated.

```text
user_memory_difficulty
```

means:
> how difficult this memory appears to be for this learner.

```text
item_empirical_difficulty
```

means:
> how difficult this Question appears across real attempts/users.

Memory scheduler uses the first.

QuestionStats / later psychometrics use the second.

---

# 15. Scheduler Rating Mapping

Do not blindly map:

```text
correct → Good
slow correct → Hard
incorrect → Again
```

until validated.

Response time should initially remain separate from the scheduler rating.

V1 implementation must define and test an explicit mapping from UNLOCK evidence to scheduler input.

This mapping is an open design decision, not a hidden library default.

---

# 16. Mastery Is a Derived Product State

Mastery must not be the deepest stored truth.

Underlying evidence may include:

```text
memory_stability
memory_difficulty
scheduled_review_at
retrievability_estimate

successful_spaced_retrievals
lapse_count

evidence_strength
```

Learner-facing category:

```text
not_started
learning
strengthening
mastered
```

---

# 17. Mastery Requires Time

Same-session repetition is mainly acquisition evidence.

A successful retrieval after meaningful delay is stronger retention evidence.

Therefore:

```text
5 correct answers in 10 minutes
≠
durable mastery
```

Mastery should emerge from successful retrieval across time.

Avoid an arbitrary “5 observations means mastered” rule.

Five may be useful as a heuristic for confidence in some contexts, but time-separated evidence is more important than the raw count.

---

# 18. Mastered Is Not Permanent

A mastered Question can:
- become due;
- decline in retrievability;
- experience a lapse;
- return to strengthening;
- become urgent before an exam.

Never implement:

```text
mastered = exclude forever
```

This fixes a significant Base44 prototype weakness.

---

# 19. Lapses

A lapse is an incorrect retrieval after meaningful prior learning.

A lapse should:
- decrease current memory confidence/stability;
- increase priority;
- potentially lower mastery category;
- create relearning need;
- preserve prior history.

Do not erase months of evidence because of one error.

---

# 20. Misconception Lifecycle

Replace cumulative `misconception_hits` as the main model.

Draft:

```text
none
suspected
active
recovering
resolved
```

Strong evidence:

```text
incorrect + high confidence
```

Recovery evidence may include:
- corrective feedback;
- later correct retrieval;
- meaningful spacing;
- appropriate confidence.

Potential state:

```text
misconception_state
misconception_score
misconception_last_seen_at
misconception_recovery_evidence
```

Exact thresholds remain TBD.

---

# 21. Feedback Is Part of the Learning Loop

A wrong answer should not only change the scheduler.

It should create a learning opportunity.

Feedback may include:
- explanation;
- source excerpt;
- misconception-specific explanation later;
- relearning action;
- eventual teach-back / generation activity.

Do not require AI for every feedback event.

---

# 22. Generation / Teach-Back — Future Intervention, Not V1 Core

Research supports learning benefits from preparing to teach and teaching.

Potential intervention:

```text
repeated misconception
→ “Explain it in your own words”
→ compare against source-supported key points
→ brief feedback
```

This is promising, especially for conceptual knowledge.

But V1 should only be architecture-ready for it.

Do not block the learning loop on:
- AI personas;
- voice teaching;
- generated follow-up dialogue.

Status:

```text
DEFERRED / EXPERIMENT
```

---

# 23. Pretesting / “Guess Before Seeing”

Unsuccessful retrieval attempts can improve later learning in some conditions.

Possible future mode:

```text
prompt
→ learner predicts/recalls
→ options appear
→ answer
→ feedback
```

This is especially interesting because multiple choice normally allows recognition.

Status:

```text
FUTURE EXPERIMENT
```

Do not insert an extra step into every V1 question.

---

# 24. UserQuestionProgress — Draft State

Candidate fields:

```text
user_id
question_id

attempt_count
correct_count

last_attempt_at
last_correct_at
last_incorrect_at

memory_stability
memory_difficulty
scheduled_review_at

successful_spaced_retrievals
lapse_count

misconception_state
misconception_score
misconception_last_seen_at

timed_attempt_count
average_response_time_seconds

evidence_strength
mastery_category

engine_version
updated_at
```

Final schema should remove fields that can safely and cheaply be derived.

---

# 25. Evidence Strength

UNLOCK must distinguish:

```text
mastery estimate
```

from:

```text
confidence in the estimate
```

Inputs may include:
- meaningful Attempt count;
- spaced retrieval count;
- time span of evidence;
- recency;
- content coverage;
- assistance rate;
- diversity of occasions.

Internal categories:

```text
insufficient
early
moderate
strong
```

Do not expose fake precision.

---

# 26. Evidence Provenance

For debugging and explainability, record why a state materially changed.

Candidate reasons:

```text
INITIAL_ATTEMPT
SAME_SESSION_SUCCESS
SPACED_RETRIEVAL_SUCCESS
LAPSE
CONFIDENT_ERROR
ASSISTED_SUCCESS
MISCONCEPTION_RECOVERY
```

This may be stored as update metadata or derived in logs/events.

Do not create a giant permanent audit table unless implementation needs it.

---

# 27. Next Best Action Selects Actions

NBA should not merely rank Questions.

Candidate actions:

```text
REVIEW_DUE
RELEARN_LAPSE
REPAIR_MISCONCEPTION
STRENGTHEN_MEMORY
EXPAND_COVERAGE
NEW_LEARNING
EXAM_PRIORITY
```

Later:

```text
TEACH_BACK
PRETEST
PRACTICE_TEST
TAKE_BREAK
```

Only V1 action types should be implemented now.

---

# 28. NBA Is Explainable

Do not begin with one opaque score.

Candidate components:

```text
review_urgency
memory_risk
misconception_urgency
coverage_need
weakness
exam_urgency
uncertainty_need

minus:
cooldown
recent_overexposure
assistance_dependency
```

Example internal output:

```ts
{
  score: 78,
  primaryReason: "REPAIR_MISCONCEPTION",
  components: {
    reviewUrgency: 15,
    memoryRisk: 18,
    misconceptionUrgency: 30,
    coverageNeed: 5,
    examUrgency: 10
  }
}
```

The user sees a reason, not the number.

---

# 29. Exam Urgency Is Context, Not Memory

An exam does not magically increase mastery.

It changes the cost of forgetting.

Therefore exam urgency affects:
- NBA ranking;
- session composition;
- maybe desired review intensity.

It does not directly increase:
- stability;
- difficulty;
- mastery.

---

# 30. Coverage

A learner can answer many Questions while providing poor Course coverage.

Therefore calibration/readiness should track breadth across relevant content.

Possible dimensions:
- Topics covered;
- Questions with meaningful evidence;
- high-priority Topics not sampled;
- exam-relevant content not sampled.

---

# 31. Starter / Calibration

Replace:

```text
attempts < N
→ newest Questions
```

with:

```text
insufficient evidence
→ calibration session
```

Calibration objective:

> reduce uncertainty across the Course with the smallest useful sample.

Likely V1:
- multiple Topics;
- limited repetition;
- unseen Questions;
- representative coverage.

Exact size remains a product decision.

---

# 32. QuestionStats Boundary

QuestionStats is NOT UserQuestionProgress.

Future aggregate fields may include:

```text
attempt_count
correct_rate
item_empirical_difficulty

distractor_distribution
discrimination_estimate

edit_rate
rejection_rate
explanation_effectiveness

recent_vs_historical_shift
```

This layer becomes more useful as real usage grows.

Do not make V1 depend on having large cross-user samples.

---

# 33. Elo / CAT

Adaptive difficulty is interesting but not V1 core.

Reasons:
- shared Questions may not have enough users;
- user-created Questions start cold;
- adaptive selection and difficulty estimation can create feedback/bias issues;
- the primary V1 problem is durable learning, not psychometric measurement.

Status:

```text
DEFERRED / RESEARCH
```

Potential later use:
- practice-test mode;
- difficulty-balanced unseen Questions;
- large shared Course cohorts.

---

# 34. Interleaving

Preserve the principle:

```text
initial acquisition
→ more blocked practice

established knowledge
→ stronger interleaving
```

Do not maximize interleaving for beginners automatically.

Today Planner should apply interleaving based on learner state.

---

# 35. Today Planner

Flow:

```text
eligible learning actions
↓
NBA ranking
↓
session constraints
↓
topic / action diversity
↓
interleaving rules
↓
persist Today Session + Items
```

Today remains stable during the day.

Quiz executes the prepared Today plan.

Quiz must not independently re-plan Today.

---

# 36. Today Composition

Avoid rigid quota logic such as:

```text
30% weak
30% review
20% misconception
20% exam
```

as the sole decision mechanism.

A Question may qualify for several reasons.

Use ranking + constraints.

Constraints may include:
- target duration;
- review protection;
- misconception priority;
- calibration coverage;
- topic diversity;
- no excessive repeats;
- exam-aware emphasis.

---

# 37. Session Duration vs Question Count

Prefer thinking in learning time rather than only fixed Question count.

Long term:

```text
target_duration_minutes
```

may be more useful than:

```text
exactly 12 Questions
```

V1 can still use a simple Question cap if duration estimates are not yet trustworthy.

---

# 38. Cognitive Fatigue

Potential future signal:

```text
response time trend ↑
+
accuracy trend ↓
+
session length ↑
```

Possible action:

```text
gentle break suggestion
```

Status:

```text
DATA-READY, FEATURE DEFERRED
```

V1 should capture timestamps/session position needed to study this later.

Do not create a fatigue “brain” before real behavioral data exists.

---

# 39. Autonomy

UNLOCK is an autopilot, not a prison.

Today should be the default recommended path, but later the learner may choose:
- a Topic;
- manual practice;
- exam mode;
- question type.

Learner choice should not corrupt learner-state measurement.

Manual practice Attempts remain evidence with clear context.

---

# 40. Motivation / Gamification Principle

Gamification exists to help users persist through effortful retrieval.

It must not:
- redefine mastery;
- reward low-quality evidence as strongly as real retrieval;
- create artificial failure;
- block learning behind lives/timers;
- intentionally frustrate users to monetize relief.

Rewards should reflect real learning behavior.

Celebration magnitude should roughly match achievement magnitude.

---

# 41. Progress Map / Saga Map

A visual Course journey may later be valuable.

But it is a presentation layer over:
- Course structure;
- prerequisites;
- mastery;
- coverage.

Do not make V1 depend on an inferred knowledge graph.

Status:

```text
FUTURE UX
```

---

# 42. Avoid Manipulative Game Patterns

Explicitly reject:
- intentional “pinch levels” designed to frustrate;
- lives that prevent learning;
- paying to bypass artificial learning friction;
- misleading mastery celebrations.

This is a product principle, not an engine feature.

---

# 43. Analytics Vocabulary

Keep these separate:

### Performance
Recent correctness.

### Coverage
How much relevant content has meaningful evidence.

### Retention
Retrieval success after meaningful delay.

### Mastery
Current estimate of durable knowledge.

### Evidence Strength
How trustworthy that estimate is.

### Readiness
Exam-context estimate using mastery + coverage + evidence quality + relevance.

---

# 44. Readiness

Readiness must not be:

```text
mastered_count / total_questions
```

alone.

Future formula may consider:
- content relevance;
- coverage;
- retrievability at exam horizon;
- mastery distribution;
- evidence strength.

If evidence is weak:

```text
insufficient evidence
```

is better than a fake percentage.

---

# 45. Teacher / Cross-User Intelligence Is Not V1 Engine

Teacher digests, group misconception maps, distractor analysis, content QA, explanation effectiveness, and aggregate Course insights are strategically valuable.

But they sit outside the V1 realtime learner loop.

Status:

```text
ARCHITECTURE-READY / DEFERRED
```

Do not block:
- Attempt;
- UserQuestionProgress;
- NBA;
- Today.

---

# 46. AI Agents Are Not Required for the Learning Engine

Future capabilities may include:
- Content QA;
- Personal Coach;
- Class Digest;
- Web Resource Curator;
- Knowledge Graph inference.

These are separate capabilities.

Do not automatically create:
- agents;
- queues;
- autonomous background loops;
- LLM calls.

A deterministic function or SQL query should be preferred when sufficient.

---

# 47. Engine Versioning

Every state update must be attributable to an engine version.

Example:

```text
learning_engine_v1.0
```

Material rule changes increment the version.

Attempts never change.

Derived state should be reconstructable where practical.

---

# 48. Determinism

For:

```text
previous state
+ Attempt
+ clock
+ engine version
```

the state update should be deterministic.

No random values.

No LLM.

Inject:
- clock;
- scheduler;
- configuration.

This is required for Golden Scenario testing.

---

# 49. Golden Learning Scenarios

## A. Same-session success is not durable mastery
Five correct answers in a short sitting do not prove mastery.

## B. Spaced success strengthens memory
Successful retrieval after meaningful delays increases stability.

## C. One lapse does not erase history
A strong item becomes urgent, not brand new.

## D. Confident error
Wrong + high confidence triggers misconception evidence.

## E. Misconception recovery
Later spaced success can move active → recovering → resolved.

## F. Missing time
No response time remains null and does not distort averages.

## G. Mastered but due
A mastered item becomes eligible when memory risk rises.

## H. Assisted correct
Correct after 50:50 does not count as full mastery evidence.

## I. Second attempt
First wrong Attempt remains the measurement truth; second-attempt success is a learning event, not rewritten success.

## J. New learner coverage
Repeated work on one Topic does not complete calibration.

## K. Exam urgency
Exam proximity changes ranking, not memory state.

## L. Duplicate submit
One submission processed twice creates one Attempt and one state update.

## M. Early learner interleaving
New material may remain partly blocked rather than fully interleaved.

## N. Manual practice
Manual practice updates evidence but does not mutate an existing Today plan.

---

# 50. What We Preserve From Base44

Preserve:
- learner-specific progress;
- immutable answer history direction;
- confidence capture;
- confident-error misconception signal;
- spaced review intent;
- persistent daily session;
- Today-selected Questions;
- Quiz execution;
- early/established interleaving idea;
- exam-aware priority;
- explainable “why this now” UX.

---

# 51. What We Replace From Base44

Replace:
- 5-correct-streak mastery;
- universal 30-second threshold;
- fixed streak → interval table;
- cumulative misconception counter;
- permanent exclusion of mastered Questions;
- rigid block quotas;
- newest-Question onboarding;
- duplicated persisted derived booleans;
- non-transactional evidence writes;
- averages that treat missing time as zero.

---

# 52. What We Explicitly Do Not Build Yet

Not V1 blockers:
- Elo/IRT/CAT;
- inferred knowledge graph;
- fatigue intervention;
- AI teach-back;
- voice mode;
- leagues;
- Wrapped;
- autonomous coach;
- external resource curator;
- group psychometrics;
- A/B learning experimentation;
- public content intelligence;
- sophisticated anomaly ML.

Data structures should not prevent these later.

---

# 53. Recommended Implementation Order

```text
1. Attempt contract
2. idempotent submission contract
3. evidence-quality classifier
4. UserQuestionProgress contract
5. MemoryScheduler interface
6. FSRS adapter spike
7. confidence / misconception transition
8. mastery derivation
9. evidence-strength derivation
10. Golden Scenarios
11. NBA candidate/action model
12. NBA scoring components
13. calibration planner
14. Today Planner
15. persistent Today execution loop
```

Only then:
- Basic Progress;
- readiness;
- QuestionStats;
- AI/content intelligence.

---

# 54. Decisions Still Required Before Coding the Full Formula

Open:

1. Exact UNLOCK → FSRS scheduler-rating mapping.
2. Initial desired retention configuration.
3. Whether desired retention changes near exam date.
4. Mastery derivation thresholds.
5. Misconception transition thresholds.
6. Evidence-quality treatment of each assistance type.
7. Calibration exit criteria.
8. Today target: Question count, duration, or hybrid.
9. Minimum Topic/Course structure needed for coverage.
10. Whether `retrievability_estimate` is persisted or computed.

These decisions should be resolved with Golden Scenarios, not intuition alone.

---

# 55. Research-Informed Product Principle

The purpose of the app is not to make learning feel effortless.

Effective retrieval can feel harder than rereading, and learners can mistake familiarity for knowledge.

UNLOCK should make effective effort:
- approachable;
- motivating;
- understandable;
- appropriately rewarded.

It should not remove the effort that makes retrieval useful.

---

# 56. V1 Success Criterion

The Learning Engine works when:

```text
a learner action
↓
creates trustworthy historical evidence
↓
updates learner state correctly
↓
changes the next recommended action
↓
improves future retrieval decisions
```

and the result is:

```text
deterministic
explainable
testable
fast
upgradeable
```

The objective is not algorithmic sophistication.

The objective is the smallest reliable engine that models durable learning materially better than the Base44 prototype and can improve from real pilot evidence.

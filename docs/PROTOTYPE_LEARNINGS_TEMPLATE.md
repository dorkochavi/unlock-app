# UNLOCK Prototype Learnings Template

Status: Active audit template

Purpose: capture useful behavioral knowledge from the earlier prototype without treating the prototype as the target architecture.

This template is for focused learning-logic recovery.

It is not a migration checklist.

Do not audit the whole prototype by default.

Current audit priority:

```text
mastery_level
next_review_date
misconception_hits
direct inputs to those calculations
```

Use one copy of this template per meaningful behavior or rule.

---

# Prototype Learning Audit

## 1. Behavior Name

Short canonical name for the behavior.

Example:

```text
Mastery update after incorrect answer
```

---

## 2. Why This Behavior Matters

Explain why this behavior is relevant to V1.

Questions to answer:

- What learner decision depends on it?
- What product behavior would break without understanding it?
- Is it required for Learner State, Next Best Action, Today, or Quiz?

Do not include behavior merely because it exists in the prototype.

---

## 3. Prototype Area

Where was the behavior found?

Examples:

- function name;
- file name;
- low-code workflow;
- formula field;
- backend action;
- UI action;
- database rule.

Include enough context that the behavior can be found again.

---

## 4. Inputs

List every known input.

Example:

```text
previous_mastery_level
is_correct
confidence_level
misconception_hits
attempt_count
```

For each input, note:

- type;
- expected range;
- whether required;
- default value;
- source.

Do not infer missing inputs without evidence.

---

## 5. Current Prototype Rule

Write the current behavior as clearly as possible.

Prefer pseudocode or a formula.

Example:

```text
if answer is correct:
    mastery_level += X

if answer is incorrect:
    mastery_level -= Y
```

If the prototype behavior is difficult to interpret, write what is directly observed and mark uncertainty.

Do not rewrite it into a cleaner rule before documenting what actually exists.

---

## 6. Outputs

List what the behavior changes or returns.

Examples:

```text
mastery_level
next_review_date
misconception_hits
```

Note whether the output is:

- persisted;
- returned only;
- used immediately elsewhere;
- displayed to the learner;
- used as input to another rule.

---

## 7. Defaults

Document default values used by the prototype.

Examples:

```text
initial mastery = ?
initial misconception_hits = ?
missing confidence = ?
```

If a default cannot be confirmed, write:

```text
UNKNOWN
```

Do not invent a likely value.

---

## 8. Thresholds

Document explicit thresholds.

Examples:

```text
if mastery >= 80
if misconception_hits >= 2
if response_time > 30 seconds
```

For each threshold, note where it came from.

If a threshold appears arbitrary, document that observation without silently changing it.

---

## 9. Edge Cases

Document known or observed edge behavior.

Examples:

- first Attempt;
- no previous progress record;
- missing confidence;
- zero response time;
- negative response time;
- repeated identical answers;
- very high Attempt count;
- overdue review;
- exam date missing.

Do not assume edge behavior that was not observed.

---

## 10. Examples

Add concrete examples.

Example:

```text
Input:
mastery_level = 40
answer = correct
confidence = high

Prototype output:
mastery_level = 55
```

Use multiple examples if they help reveal the rule.

---

## 11. Known Bugs or Suspicious Behavior

Document anything that appears incorrect, inconsistent, or fragile.

Examples:

- value can exceed intended range;
- review date moves backward;
- first Attempt skips initialization;
- high-confidence incorrect answer is treated the same as low-confidence incorrect;
- stale value is used;
- duplicate submission changes state twice.

Do not fix the bug in this section.

First document it.

---

## 12. Evidence

Record the evidence supporting this interpretation.

Possible evidence:

- exact prototype code;
- screenshot;
- database values;
- observed before/after behavior;
- test case;
- user explanation;
- historical documentation.

If there are multiple evidence sources, list them separately.

---

## 13. Confidence in Understanding

Choose one:

```text
HIGH
MEDIUM
LOW
```

### HIGH

The rule is directly visible and examples confirm it.

### MEDIUM

The likely rule is clear but some inputs, defaults, or branches remain uncertain.

### LOW

The behavior is inferred from outputs or partial evidence.

Explain the reason for MEDIUM or LOW.

---

## 14. Classification

Choose one:

```text
PRESERVE V1
PRESERVE WITH FIX
REDESIGN FOR V1
DEFER
REMOVE
UNKNOWN
```

### PRESERVE V1

The behavior is useful and should be carried into V1 substantially as-is.

### PRESERVE WITH FIX

The core idea is useful but a specific bug or flaw should be corrected.

### REDESIGN FOR V1

The product intent is useful but the prototype implementation should not be preserved.

### DEFER

Potentially useful later, but not needed for V1.

### REMOVE

The behavior should not exist in the new product.

### UNKNOWN

Not enough evidence to decide yet.

---

## 15. Classification Rationale

Explain why the classification was chosen.

Consider:

- product value;
- learning value;
- correctness;
- simplicity;
- data integrity;
- V1 necessity;
- risk.

Avoid reasoning such as:

> "The prototype already does it."

Existing behavior alone is not a reason to preserve it.

---

## 16. Proposed V1 Behavior

Only fill this section after the prototype behavior is understood well enough.

Describe the intended V1 rule.

Keep it:

- deterministic;
- explicit;
- testable;
- simple where possible.

If the correct V1 behavior is still unresolved, write:

```text
TBD — requires decision
```

Do not use this section to hide uncertainty.

---

## 17. Differences from Prototype

List every intentional difference.

Example:

```text
Prototype:
mastery can exceed 100.

V1:
mastery is clamped to the approved maximum.
```

This section is important for distinguishing:

```text
recovered behavior
```

from:

```text
new V1 decision
```

---

## 18. Required Tests

Describe the tests needed to protect the V1 behavior.

At minimum consider:

- normal case;
- boundary case;
- first-use case;
- missing-data case;
- repeated behavior;
- regression case for any known prototype bug.

Example:

```text
- incorrect high-confidence answer increments misconception_hits
- correct answer does not increment misconception_hits
- missing confidence follows defined fallback
```

---

## 19. Golden Learning Scenario

If this behavior materially affects learner state or ranking, define at least one scenario.

Example:

```text
History:
1. Question answered incorrectly with high confidence
2. Question answered incorrectly again
3. Review becomes due

Expected:
- misconception_hits reflects repeated misconception evidence
- Question becomes high priority
- Today can select it for review
```

This becomes a regression anchor for future engine changes.

---

## 20. Related Fields

List related data fields.

Example:

```text
mastery_level
next_review_date
misconception_hits
confidence_level
average_time_seconds
```

---

## 21. Related Domain Areas

Examples:

```text
Attempt
UserQuestionProgress
Learner State
Next Best Action
Today
Quiz
Exam Urgency
```

---

## 22. Related Documents

List relevant current documentation.

Examples:

```text
docs/MASTER_SPEC.md
docs/PRODUCT.md
docs/DOMAIN_GLOSSARY.md
docs/TESTING.md
docs/OPEN_QUESTIONS.md
```

---

## 23. Open Questions

List unresolved questions that affect implementation.

Examples:

- Is confidence always available?
- Is mastery clamped?
- Does exam urgency affect this rule?
- Does the rule use the most recent Attempt or all Attempts?
- How is the first progress record initialized?

If the question materially affects correctness, do not implement until it is resolved.

---

## 24. Decision Owner

Who or what should resolve the remaining behavior?

Examples:

- prototype evidence;
- product decision;
- learning-science decision;
- database design;
- feature contract;
- pilot evidence.

This does not require naming a person unless useful.

---

## 25. Implementation Readiness

Choose one:

```text
READY
NOT READY
READY WITH EXPLICIT ASSUMPTIONS
```

### READY

The behavior is sufficiently defined to implement and test.

### NOT READY

Important inputs, rules, or decisions remain unresolved.

### READY WITH EXPLICIT ASSUMPTIONS

Implementation can proceed only if the listed assumptions are documented and approved.

---

## 26. Implementation Notes

Only include notes that help future implementation.

Examples:

- likely pure domain function;
- requires controlled clock;
- should be versioned;
- needs transaction with Attempt creation;
- should not run in React component.

Do not turn this section into speculative architecture.

---

## 27. Audit Completion Checklist

Before considering this behavior audited, confirm:

```text
[ ] Behavior matters to V1
[ ] Inputs are documented
[ ] Current prototype rule is documented
[ ] Outputs are documented
[ ] Defaults are known or marked UNKNOWN
[ ] Thresholds are documented
[ ] Edge cases are captured
[ ] Evidence is recorded
[ ] Confidence level is assigned
[ ] Classification is assigned
[ ] Proposed V1 behavior is defined or marked TBD
[ ] Intentional differences are explicit
[ ] Required tests are listed
[ ] Open questions are surfaced
[ ] Implementation readiness is assigned
```

---

# Audit Discipline

The purpose of prototype audit is not to reproduce old code.

The purpose is to answer:

> Which learning behavior is worth preserving, what exactly does it do, what should V1 do instead where necessary, and how will we prove the new implementation behaves correctly?

Recover behavior just in time.

Do not turn prototype archaeology into a separate product-development project.

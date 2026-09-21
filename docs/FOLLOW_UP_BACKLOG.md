# UNLOCK — Follow-Up Backlog

**Status:** ACTIVE
**Load level:** COLD / never default
**Purpose:** Preserve concrete useful follow-up work that has been identified but is intentionally outside the current execution scope.

> Capture now. Execute deliberately later.

---

## Role

`docs/FOLLOW_UP_BACKLOG.md` is the parking place for work that:

* appears valuable or worth investigating;
* has enough evidence to avoid being forgotten;
* is not required for the current Run or active task;
* should not interrupt the current execution sequence;
* may later become a dedicated Run, Slice, audit, ADR, or explicit rejection.

Its purpose is to protect focus without losing useful findings.

---

## This File Is Not

This file is not:

* the current execution plan;
* a roadmap;
* an unresolved-decision queue;
* a bug tracker;
* a current-state document;
* a historical Run report;
* a temporary scratchpad.

Use the correct owner instead:

| Need                                       | Canonical owner                     |
| ------------------------------------------ | ----------------------------------- |
| What are we doing now?                     | `docs/CHATGPT_PLAN.md`              |
| What is true now?                          | `docs/DEV_STATUS.md`                |
| What decision is unresolved?               | `docs/OPEN_QUESTIONS.md`            |
| What was formally decided?                 | `docs/DECISIONS/**`                 |
| What is the product sequence?              | `docs/UNLOCK_ROADMAP.md`            |
| What belongs in V1?                        | `docs/UNLOCK_V1_SCOPE.md`           |
| What happened in a completed Run?          | `docs/RUNS/**`                      |
| What is temporary resume state?            | `scratch/development_checkpoint.md` |
| What is useful but intentionally deferred? | `docs/FOLLOW_UP_BACKLOG.md`         |

---

## Add an Item When

Add a follow-up item only when all of the following are true:

1. a concrete issue, duplication, maintainability opportunity, or investigation target was identified;
2. it is not required to complete the current scope;
3. acting on it now would create scope expansion or distraction;
4. there is enough context to understand later why it was added.

---

## Do Not Add

Do not use this file for:

* vague ideas;
* current blockers;
* accepted product decisions;
* unresolved product or architecture decisions;
* work already committed to the current Plan;
* low-value cleanup with no clear benefit;
* historical notes that belong in a Run Report.

If a finding blocks the current task, handle it in the current task.

If it requires a new product or architecture decision, use `docs/OPEN_QUESTIONS.md`.

---

## Item Lifecycle

Each item must use one of these statuses:

* `DEFERRED` — valid, intentionally not scheduled;
* `PROMOTED` — moved into an active Plan, Run, or dedicated audit;
* `RESOLVED` — completed elsewhere;
* `REJECTED` — intentionally not pursued;
* `OBSOLETE` — no longer relevant.

When an item is promoted, keep only a short reference here to its new owner.

Do not maintain the full active implementation plan in both places.

---

## Priority

Use only:

* `HIGH` — meaningful technical/product risk or recurring maintenance cost;
* `MEDIUM` — worthwhile improvement with clear benefit;
* `LOW` — useful cleanup or optimization with limited current impact.

Priority does not determine execution order.

The active Plan always wins.

---

# FUB-001 — API Route Auth / DB Ordering Test Boilerplate

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Tests / API / Maintainability

## Observation

The repository contains many endpoint-specific files named:

`route-auth-db-ordering.test.ts`

A repository review identified approximately 18 such files.

They repeatedly verify important route-level behavior such as:

* authentication occurs before database construction or access;
* unauthenticated requests fail closed;
* authenticated requests proceed through the expected route wiring;
* route-specific security/error behavior remains intact.

## Important Constraint

The files are not automatically redundant.

Each test exercises the actual wiring of a different endpoint.

Collapsing all of them into one generic test could remove valuable route-specific regression coverage.

## Follow-Up Investigation

Evaluate whether a shared test harness could reduce boilerplate while preserving one small explicit declaration per endpoint.

Possible direction:

```text
shared auth-before-db test harness
        ↓
small endpoint-specific test declaration
```

## Do Not Do Yet

Do not delete endpoint-level coverage merely because the test structure is similar.

## Promotion Trigger

Promote when:

* maintenance cost becomes material;
* new routes continue multiplying the same boilerplate;
* or a dedicated runtime/test maintainability Run is scheduled.

---

# FUB-002 — Application Test Fakes Duplication Review

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Tests / Application Layer / Maintainability

## Observation

Separate `in-memory-fakes.ts` files exist across several application areas, including:

* course;
* dailyPlan;
* learning;
* question;
* topic;
* user.

## Important Constraint

These files are not proven duplicates.

They represent different application ports and bounded areas.

Combining them into one global fake database could increase coupling and weaken test isolation.

## Follow-Up Investigation

Check whether smaller repeated primitives can be shared safely, such as:

* builders;
* fixtures;
* object factories;
* common setup helpers.

Prefer extracting small stable primitives over creating one large shared fake layer.

## Do Not Do Yet

Do not merge all application fakes solely because the filenames are similar.

---

# FUB-003 — PostgreSQL Unit-of-Work Boilerplate Review

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Infrastructure / Transactions / Maintainability

## Observation

The PostgreSQL infrastructure contains multiple Unit-of-Work implementations, including:

* `postgres-unit-of-work.ts`;
* `postgres-course-unit-of-work.ts`;
* `postgres-question-unit-of-work.ts`;
* `daily-plan-unit-of-work.ts`.

They appear to share transaction mechanics such as:

```text
BEGIN
→ construct scoped repositories
→ execute
→ COMMIT

on failure:
→ ROLLBACK
→ preserve original error
```

## Important Constraint

The separate Unit-of-Work contracts appear to protect different transactional boundaries and expose intentionally narrow repository sets.

They also differ in some locking/concurrency behavior.

## Follow-Up Investigation

Evaluate whether only the transaction mechanics can be shared behind a small internal abstraction.

Possible direction:

```text
shared PostgreSQL transaction runner
        ↓
Course UoW
Question UoW
DailyPlan UoW
Learning UoW
```

## Do Not Do Yet

Do not replace scoped Unit-of-Work contracts with one global Unit of Work unless repository evidence demonstrates a real cross-domain need.

---

# FUB-004 — Runtime / Test Maintainability Audit

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Repository Maintainability

## Context

The current priority is Development OS V1.2 reconciliation.

A separate repository review identified possible maintainability opportunities inside runtime/test code that should not interrupt the Development OS work.

## Candidate Scope

A later focused audit may inspect:

* API route test boilerplate;
* repeated test builders/fakes;
* transaction infrastructure duplication;
* repeated API route composition patterns;
* unusually large source/test files;
* other concrete duplication with measurable maintenance cost.

## Guiding Principle

Do not refactor merely because two files look similar.

Only introduce abstractions when they:

* reduce meaningful maintenance cost;
* preserve or improve test coverage;
* preserve architectural boundaries;
* make the system easier to reason about.

## Suggested Timing

After Development OS V1.2 is implemented and verified, and before or during a future product Run when the work becomes relevant.

---

# FUB-005 — Structured Import Source Size/Row Limits

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Run 007 / Structured Import

## Observation

Run 007 S1's JSON/CSV import adapters (`src/application/import/adapters/`)
are pure parsing functions with no upper bound on payload size or row
count — a multi-megabyte JSON array or a CSV with hundreds of thousands of
rows is parsed synchronously in one call. Flagged during S1's
`/review-commit` general review.

## Important Constraint

Not a defect in S1 itself: S1 has no API/auth boundary yet (it is only
called by the S3 preview/confirm routes, not yet built), so there is
nowhere for a request-size limit to attach today.

## Follow-Up Investigation

When S3 (Preview API + Instructor Preview UI) is implemented, decide a
concrete request-body/row-count limit for the preview/confirm routes and
enforce it at that HTTP boundary — not inside the format-independent
adapters themselves.

## Do Not Do Yet

Do not add a size/row cap to the adapters in S1/S2 — no HTTP boundary
exists yet to make that limit meaningful, and guessing a number now would
be exactly the kind of premature constraint `.claude/rules/api.md` asks to
avoid inventing ahead of the real boundary.

---

## Maintenance Rule

Keep this file small.

When an item becomes active:

1. move actionable work into `docs/CHATGPT_PLAN.md` or another appropriate canonical owner;
2. mark the backlog item `PROMOTED`;
3. reference the new owner;
4. do not duplicate the active plan here.

Closed items may remain briefly for traceability, but periodically prune:

* `RESOLVED`;
* `REJECTED`;
* `OBSOLETE`;

when they no longer provide useful context.

---

## Scope Boundary

Items in this file must not silently expand the current Run or task.

Finding something interesting is not permission to work on it.

The active execution contract remains authoritative.

---

## Key Principle

> The Follow-Up Backlog exists so that useful discoveries do not become immediate distractions.

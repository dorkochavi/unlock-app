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

# FUB-006 — Source Context/Comment Debt Audit

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Repository Maintainability / `src/**`

## Observation

A Run 008 repository audit found substantial comment-only lines across
`src/**`, including Run/Plan/reviewer history embedded directly in source
doc comments (e.g. "Run 007 S4's DB review finding", "fixed after general
reviewer's CORRECTIONS REQUIRED").

## Follow-Up Investigation

A future audit should classify comments per file into KEEP (non-obvious
invariants, security rationale, current "why", protocol/algorithm
reasoning) vs. REMOVE/MOVE (Run chronology, implementation history,
reviewer history, duplicate ADR prose, stale Plan references) and migrate
the latter to Git history / Run Reports, which already own that
information.

## Do Not Do Yet

Do not perform this cleanup opportunistically inside an unrelated Slice —
it touches many files for no behavioral benefit and deserves its own
bounded pass.

---

# FUB-007 — CI/CD / Release Automation

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Post-Pilot / Production Readiness

## Observation

Narrowed 2026-09-26: minimal CI now exists (`.github/workflows/ci.yml`,
ADR-019: typecheck + lint + unit tests on every push). Still not covered:
the schema/PGlite suite, the production build and Playwright/E2E are
deliberately excluded from CI; `main` has no required status checks
(ADR-019 defers them); what Vercel does on a failed build is unverified.

## Follow-Up Investigation

Post-pilot production work should evaluate adding build/schema/E2E checks,
required status checks, and release/deployment gates (Run 012 territory).

## Do Not Do Yet

Not required for the Ruppin pilot; do not add CI infrastructure inside a
product Run.

---

# FUB-008 — Runtime Observability / Application Monitoring

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Post-Pilot / Production Readiness

## Observation

Development OS telemetry (`docs/RUN_TELEMETRY.md`) measures agent
behavior, not application runtime health — there is no error
reporting/structured logging/latency visibility for production traffic.

## Follow-Up Investigation

Future production work should evaluate runtime error reporting, structured
logging, and latency/error visibility for import/auth/Today failure paths
(e.g. Sentry or equivalent) — Run 012 territory.

## Do Not Do Yet

Pilot-minimum runtime/error visibility is owned by `docs/PILOT_READINESS.md`
§3 item 13 and does not by itself require a provider; this entry covers
monitoring beyond that minimum. Do not choose or integrate a provider now;
Run 008 S6 may add a narrow,
pilot-scoped log around one critical path if repository evidence proves it
genuinely warranted, no broader stack.

---

# FUB-009 — Backup / Restore / Disaster Recovery

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Post-Pilot / Production Readiness

## Observation

Git protects code, not learner data. A manual hosted logical backup was
taken before the pilot (Run 008 gate closed 2026-09-23; no restore drill
performed). Ongoing backup ownership, frequency, RPO/RTO, and a
restore-verification procedure have still not been established.

## Follow-Up Investigation

Pilot-minimum backup/recovery sanity (a current backup and a known
recovery path) is owned by `docs/PILOT_READINESS.md` §3 item 13. Beyond
that: establish backup ownership, frequency, RPO, RTO, and a periodic
restore-verification procedure before scaling past the pilot. Do not
assume/claim Supabase-managed backup guarantees without verifying the
actual project plan/settings.

## Do Not Do Yet

Requires a human to check the hosted Supabase project's actual plan/
settings — not verifiable from the repository alone.

---

# FUB-010 — Postgres / Vercel Connection Strategy

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Post-Pilot / Production Readiness

## Observation

Current `pg.Pool` usage (`src/infrastructure/postgres/pg-pool.ts`) has not
been explicitly validated against a real serverless (Vercel) deployment's
concurrency/pool-size/timeout behavior against Supabase's pooler vs.
direct connection modes.

## Follow-Up Investigation

Before real production scale, explicitly validate connection mode, pool
size, idle/connection/statement timeouts, and pooler-vs-direct choice
against real deployment evidence.

## Do Not Do Yet

Do not tune pool behavior blindly without deployment evidence; not a
pilot blocker at current expected pilot load.

---

# FUB-011 — Abuse / Platform Hardening

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Post-Pilot / Production Readiness

## Observation

No rate limiting, canonical field-length policy beyond what individual
routes already validate, CSP/security headers, or request-body limits
beyond Structured Import's (`MAX_IMPORT_SOURCE_LENGTH`/`MAX_IMPORT_ROWS`)
exist yet.

## Follow-Up Investigation

Post-pilot hardening may add rate limiting, a canonical field-length
policy, CSP/security headers, and broader request-body limits where
justified by real traffic/abuse evidence — Run 012 territory.

## Do Not Do Yet

Do not implement broadly now; only act inside a Run if repository evidence
proves an actual Run 008 pilot blocker (none found as of Run 008 S1/S6).

---

# FUB-013 — Unwired Application Code Review

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Repository Maintainability

## Observation

A repository audit identified several application files that appeared
structurally unconnected from normal runtime roots, including candidates
around membership revoke/archive and some helper/use-case files.

## Follow-Up Investigation

A future focused review should classify each candidate KEEP / CONNECT /
REMOVE with actual evidence (call-graph/route wiring), not assumption.

## Do Not Do Yet

Do not call anything dead code or remove it without that proof.

---

# FUB-014 — Structured Import Concurrency Hardening + Bulk Persistence

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Run 007-008 / Structured Import

## Observation

Two related, currently-accepted V1 limitations, both documented in
`docs/DEV_STATUS.md`'s Structured Import section:

1. (Run 008 S1.F) `confirmImport`'s Phase 2 re-check is not lock-
   serialized against its own write loop (plain `READ COMMITTED` reads, no
   `FOR UPDATE`) — a concurrent membership-revoke/Course-archive/
   Topic-archive that commits between the re-check and this transaction's
   commit is not caught. No corruption risk (no unique-constraint
   collision), but a small window where `DRAFT_ONLY` Questions can be
   created into a just-archived Course/Topic.
2. (carried over from Run 007) `confirmImport` performs ~2 writes per
   imported Question (`createDraft` + `updateDraft`, the existing Run 006
   persistence methods, reused unchanged) — architecturally correct for
   V1, not bulk-optimized.

## Follow-Up Investigation

Reconsider stronger locking (e.g. `SELECT ... FOR UPDATE` on the Course/
Topic rows during Phase 2) if collaborative/concurrent multi-instructor
editing becomes real; reconsider bulk persistence only if real
performance evidence justifies it.

## Do Not Do Yet

Acceptable for the single-editor Ruppin V1 pilot; do not add pessimistic
locking or bulk-write optimization without real evidence of need.

---

# FUB-015 — UNLOCK Starter Kit / Project Bootstrap Assets

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Cross-Project / Tooling

## Observation

Several Development-OS/architecture patterns built for UNLOCK are
reusable across future projects: a tool-neutral `AGENTS.md` baseline, thin
tool-specific adapters, the evidence-freshness model
(`.claude/rules/testing.md`), risk-based reviewer orchestration
(`review-commit`), the HOT/WARM/COLD/RESTRICTED context model, the
modular-monolith TypeScript layout, the auth-before-DB test pattern
(`route-auth-db-ordering.test.ts`), the PGlite integration harness,
explicit-time testing, and the Run 008 S1.A safe review-bundle tooling.

## Follow-Up Investigation

After the pilot, extract these into a reusable starter kit — tool-neutral
patterns only, never UNLOCK-specific product policy.

## Do Not Do Yet

Post-pilot; not required for Run 008.

---

# FUB-016 — Future Project Inception Template

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Cross-Project / Tooling

## Observation

UNLOCK's own build surfaced a recurring set of early-project questions
(auth/RBAC, secrets/environment contract, backup/restore, observability,
CI/CD, request/field limits, concurrency semantics, privacy/deletion,
timezone/date semantics, migration policy, hosted-vs-local state, E2E
fixture strategy, failure modes, deterministic-logic-vs-AI boundaries)
that would have been useful to answer explicitly at project inception.

## Follow-Up Investigation

Create a reusable kickoff/spec checklist covering these areas for future
projects.

## Do Not Do Yet

Capture only; not an active task.

---

# FUB-017 — Safe Review Bundle: Dirty-Working-Tree Robustness

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Run 008 / Tooling

## Observation

`scripts/create-review-bundle.mjs` (Run 008 S1.A) selects paths via
`git ls-files` (tracked, non-deleted paths) but then copies each one from
the CURRENT WORKING TREE (`copyFileSync(src, dest)`), not from the
committed blob at `sourceHead`. Against a dirty working tree this means:
new untracked files are silently omitted (never in the tracked-path
list); but a modified TRACKED file is INCLUDED, with its current
working-tree content — not the version at the commit the manifest's
`sourceHead` names. The manifest's `sourceHead` alone therefore does not
prove every included tracked file actually matches that commit. Morning
Review of Run 008 (2026-09-22) corrected an earlier, less precise version
of this observation that had claimed modified tracked files were also
omitted — they are not.

## Follow-Up Investigation

Consider having the script detect a dirty working tree (`git status
--porcelain`) and warn or refuse when untracked or modified files exist,
or explicitly record dirty-working-tree state (e.g. the list of modified
tracked paths) in the manifest so a reader isn't misled by `sourceHead`
alone.

## Do Not Do Yet

Not a security issue — every included path still passes the same
unsafe-pattern filter regardless of working-tree state, so nothing
sensitive leaks; the risk is a misleadingly labeled bundle (working-tree
content presented under a `sourceHead` it may not exactly match), not
exposure. Low priority — act only if a real review bundle is generated
from a dirty tree and the mismatch actually causes confusion.

---

# FUB-018 — Learner Learning Visibility (Landscape / Pulse / Advanced Progress)

**Status:** `PARTIALLY PROMOTED TO RUN 009` — only the simple, read-only Topic-state learner Progress (qualitative states, coverage context, path back to Today; `docs/CHATGPT_PLAN.md` S1/S2). Everything else below stays `DEFERRED`: Landscape, Pulse/movement, historical trends, readiness score, percentages, forecasting, learner-selected study workflow, gamification, advanced Progress. Pilot evidence has NOT validated the advanced directions.
**Priority:** `MEDIUM`
**Area:** Product / Learner Progress

## Observation

Deliberately retained because the direction appears valuable; deferred for
sequencing and evidence, not rejected. Core principle: UNLOCK should
visualize learning as **evolving state, not grades**.

- **Learning Landscape** — Topic-first presentation (cards, bubbles, nodes,
  areas, or another mobile/RTL/accessibility-safe visual language) grounded
  in actual learning evidence, free of Learning Engine jargon, without false
  precision, showing where attention is needed.
- **Learning Pulse / Movement** — communicating meaningful change over time:
  strengthening, becoming stale / needing refresh, newly stabilized,
  persistent difficulty.
- **Advanced Progress** — Topic state, strengths, areas needing attention,
  interpretation and a useful action, later combined with Pulse / Readiness /
  Mirror signals (FUB-019). Progress should lead to useful action, normally
  back to Today.

## Important Constraint

A trustworthy trend needs explicit historical semantics (replay, snapshots,
or another justified history model); current state alone cannot honestly
show movement. A simple Topic-state UI may arrive earlier; a richer custom
visualization waits for pilot evidence.

## Do Not Do Yet

No custom visualization, trend claim, or history model before pilot evidence
shows learners want and understand it.

## Promotion Trigger

Pilot evidence that a simple Topic-state Progress view is used and leaves
learners wanting more.

---

# FUB-019 — Metacognition + Readiness (UNLOCK Mirror, Readiness)

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Product / Learning Intelligence

## Observation

Retained as potentially distinctive; deferred for sequencing and evidence.

- **UNLOCK Mirror** — compare learner self-assessment with behavioral
  evidence to expose over-/underconfidence and support metacognitive
  awareness.
- **Readiness** — a possible combination of knowledge/mastery, coverage,
  retention/memory freshness, stability/misconception evidence, and later
  exam context if justified. Previously discussed visuals: Readiness
  Compass, Unlock Ring, an eventual readiness percentage.

## Important Constraint

- Mirror creates NEW evidence (UX, persistence, timing semantics,
  interpretation); it is not merely a read model.
- Never present false precision. A readiness number or strong readiness
  claim waits until its model is explicitly defined, deterministic,
  testable/versioned as needed, and validated enough to justify the claim.
  A visual Compass is still a readiness model — visual design must not
  disguise undefined semantics.

## Do Not Do Yet

No readiness number, Compass, or Mirror flow before the model/semantics
exist.

## Promotion Trigger

Progress (FUB-018) is established and pilot evidence supports a defined
readiness or self-assessment need.

---

# FUB-020 — Instructor Learning Intelligence (Class Pulse / Teach Next / Classroom Visualization)

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Product / Instructor Insights

## Observation

Retained because it may answer real instructor needs; deferred until the
pilot shows what instructors actually value.

- **Class Pulse** — meaningful Course/Class learning state that shows what
  deserves instructional attention, not vanity metrics. Minimal Item
  Analysis is NOT the full Class Pulse.
- **Teach Next** — "what should I revisit in the next lesson?" from weak
  Topics, repeated difficulty, trustworthy misconception evidence and
  instructional priority.
- **Richer classroom visualization** — polling/realtime updates,
  projection-friendly classroom mode, "knowledge weather"-style views if
  instructors value them.

## Important Constraint

Recommendations must not be stronger than the evidence supports. Raw facts
(e.g. counts) must not silently become interpretations ("the class is
weak"). Aggregate exposure needs an explicit disclosure/privacy policy.

## Do Not Do Yet

No realtime or visualization theater before instructional value is proven.

## Promotion Trigger

Pilot instructors use minimal Item Analysis and ask for more.

---

# FUB-021 — Cohorts / Multiple Classes (and Cross-Class Lens)

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Domain / Course Structure

## Observation

Retained as a likely future domain shape: Instructor → Course →
Cohort/Class → Learner. One instructor may teach several Courses, or the
same Course to several distinct classes. Pilot simplification: each class
is represented as a separate Course.

**Cross-Class Lens** — comparing the same content across Cohorts to
distinguish content/question difficulty from class-specific difficulty, and
to support instructor reflection without ranking individual learners.

## Important Constraint

Requires explicit domain semantics, schema, memberships, authorization,
analytics aggregation and privacy design; Cross-Class Lens additionally
needs real Cohort modeling and enough privacy-safe evidence.

## Do Not Do Yet

No Cohort schema or cross-class comparison during the pilot.

## Promotion Trigger

A real instructor needs multiple classes for one Course and the
Course-per-class workaround causes actual friction.

---

# FUB-022 — Deeper Interpretation + Individual Views (Semantic Misconceptions / Learner Drill-Down)

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Product / Learning Intelligence / Privacy

## Observation

Retained as valuable but higher-risk.

- **Semantic misconception tagging** — modeling WHAT a wrong answer
  represents, e.g. instructor-authored distractor → misconception label,
  with a structured taxonomy later if justified. The current
  misconception score/state does NOT tell the system the semantic reason
  for a learner's mistake.
- **Instructor learner drill-down** — an individual learner view for
  legitimate pedagogical use.

## Important Constraint

Drill-down raises privacy, consent/disclosure, authorization, real
pedagogical value, and surveillance-style-behavior concerns. First-pilot
instructor analytics stay aggregate-only.

## Do Not Do Yet

No drill-down and no distractor→misconception modeling before an accepted
privacy/authorization decision and demonstrated instructor need.

## Promotion Trigger

Pilot feedback shows aggregate views are insufficient, and an accepted
disclosure/authorization design exists.

---

# FUB-023 — Pilot Evidence / Analytics Data Gaps

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Analytics / Data Model / Pilot Evidence

## Observation

Found by the Pre-Pilot reality audit (2026-09-23). Answers, joins, and
DailyPlan item completion are already derivable from authoritative domain
records (`attempts`, `course_memberships.joined_at`,
`daily_plan_items.status`/`completed_at`); the gaps below are what those
records do not cover.

- **Missing behavioral observations:** `today_opened` (and a future
  `progress_opened`, once a Progress surface exists) are not recorded. The
  nearest proxy, `daily_plans.generated_at`, marks only the first Today
  request per local day. `docs/PRODUCT.md` §15 names `today_opened`/
  `today_started`/`session_completed`/`session_abandoned` as events the
  product should support.
- **Unmaintained plan-level columns:** `daily_plans.started_at`,
  `completed_at`, and plan-level `status` are written only at insert (null /
  initial value) and never updated afterwards, so they must not currently be
  treated as authoritative KPI state; plan completion is derived from
  `daily_plan_items` instead.
- **Possible Attempts index:** the only `attempts` index is
  `attempts_replay_idx (user_id, question_id, answered_at, created_at, id)`,
  which does not serve Course/Question aggregate reads.

## Important Constraint

Prefer authoritative domain records over a duplicate analytics event log;
record only observations with a defined product, learning, or operational
reason (`docs/PRODUCT.md` §15). An index is a migration and needs real
query/performance evidence, not speculation.

## Follow-Up Investigation

Decide whether the pilot KPI needs `today_opened` at all, whether the
unmaintained plan columns should be maintained or retired, and whether
aggregate queries ever justify an Attempts index.

## Do Not Do Yet

No event log, plan-column maintenance, or new index during the pilot
without evidence that the current derivation is insufficient. The
pilot-minimum product event evidence itself is owned by
`docs/PILOT_READINESS.md` §3 item 13 (decide there whether derivation
suffices, e.g. for `today_opened`).

## Promotion Trigger

Pilot KPI analysis cannot be answered from existing records, or an
aggregate query shows measured performance problems.

---

# FUB-024 — Item Analysis Extensions (Session-Scoped and Cross-Version)

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Instructor Insights / Analytics

## Observation

Minimal Live Item Analysis is expected to be cumulative and
current-QuestionVersion-only. Two extensions are retained as plausible
follow-ups:

- **Session-scoped classroom analytics** — "what happened in this specific
  class session", rather than only cumulative aggregates.
- **QuestionVersion analytics** — all-version views, comparison between
  versions, and clearer instructor handling or notice after a re-publish
  (a re-publish creates a new immutable version, so a current-version-only
  count effectively restarts; a DailyPlan item keeps its generation-time
  version for that day).

## Important Constraint

Historical Attempts remain immutably tied to their exact QuestionVersion;
"session" has no persisted meaning today and would need explicit semantics.
Aggregate exposure needs an explicit disclosure/privacy policy (see
FUB-020, FUB-022).

## Do Not Do Yet

No session model or cross-version comparison before the minimal Item
Analysis shows instructors want them.

## Promotion Trigger

Pilot instructors ask "what happened in this class?" or are confused by
post-re-publish counts.

---

# FUB-025 — Answer Submission Idempotency vs. Server-Generated `answeredAt`

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Learning Engine / Answer Submission / API

## Observation

Found by the hosted Pre-Pilot S3 smoke test (2026-09-24) and reproduced by the
local burst harness. `answeredAt` is part of the canonical command identity
compared for idempotent retries (`CANONICAL_COMMAND_IDENTITY_FIELDS` in
`src/application/learning/submit-answer.ts`), but the HTTP route
(`POST /api/daily-plan/items/:itemId/answer`) sets it to the server's own
`new Date()` per request. Consequences for two requests carrying the SAME
`submissionId`:

- a later, sequential retry finds the existing Attempt and its `answeredAt`
  differs, so it returns `409 SUBMISSION_ID_REUSED` instead of the idempotent
  `200`;
- a truly concurrent duplicate loses the race, sees the already-resolved item
  (the pending check runs before the insert), and returns
  `409 ITEM_ALREADY_RESOLVED`.

No data is corrupted: exactly one Attempt and one completed DailyPlanItem
result either way. The current UI is unaffected — it generates a fresh
`submissionId` per click and treats 409 as "already resolved"
(`src/app/(learner)/today/page.tsx`).

## Important Constraint

The unresolved question is semantic, not a bug fix: should a server-generated
`answeredAt` participate in idempotency identity at all, and should a
concurrent same-key duplicate return the original result? Any change touches
the Attempt/idempotency contract (ADR-010) and needs DB and general review.
Attempts are immutable evidence; do not rewrite history.

## Follow-Up Investigation

Decide (ADR-010 amendment if accepted) whether to exclude a server-derived
`answeredAt` from the identity comparison, and/or re-check the submission id
after acquiring the per-learner lock so a concurrent duplicate returns the
existing result. Keep the strongest invariant: one Attempt and one resolved
item per logical submission.

## Do Not Do Yet

No change to answer-submission semantics during the Pre-Pilot Run. The
S3 harness accepts `200+200` or `200+409` (`ITEM_ALREADY_RESOLVED` /
`SUBMISSION_ID_REUSED`) for a same-submissionId duplicate pair.

## Promotion Trigger

A real client needs same-`submissionId` retry (flaky-network resubmit, mobile
offline queue), or pilot evidence shows duplicate-submit 409s confusing
learners.

---

# FUB-026 — Today / Answer Round-Trip Reduction

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Performance / Application + Infrastructure

## Observation

Found by the hosted Pre-Pilot S3 burst investigation (2026-09-24). Database
execution is fast (`pg_stat_statements`: 0.04–0.9 ms per statement) and there
is no cross-learner locking; latency under concurrency came from connection
queueing, fixed for the pilot by `DATABASE_POOL_MAX=5` (Today p95 4.85 s,
Answer p95 3.18 s at 30 learners). Both paths are still chatty, so every
request pays many sequential Vercel↔Supabase round trips:

- **Today** (new learner): about 15 statements plus an auth HTTP call —
  timezone, active memberships and Course status as three separate reads before
  the transaction; a two-step plan lookup; three sequential one-row item
  inserts; a separate learner-content read after the transaction.
- **Answer:** about 13 statements — the DailyPlanItem is loaded twice (before
  and inside the transaction), and version context and correctness definition
  are separate lookups.

## Follow-Up Investigation

If pilot evidence shows latency matters at larger scale: a single
resume-first query for an existing plan and its items; merge the pre-reads;
one multi-row item insert; drop the duplicate item lookup and merge the version
and correctness reads. Prove each change with per-request statement counts and
the S3 burst harness (`npm run test:burst`, `scripts/burst/`).

## Important Constraint

Preserve every invariant: one plan per learner per local day, one Attempt and
one resolved item per logical submission, the per-(learner, question) advisory
lock, and immutable Attempts.

## Do Not Do Yet

No Today/Answer query restructuring in Pre-Pilot; the S3 gate passed without it.

## Promotion Trigger

Larger cohorts, or pilot latency complaints, or hosted p95 above the S3
guidance (about 5 s) at the target class size.

---

# FUB-029 — Publish Validates Persisted State (Save Draft Before Publish)

**Status:** `UX WATCH` (not a persistence bug, not a blocker)
**Area:** Question authoring UI

Observed 2026-09-25: a correct answer selected in the form but not saved makes Publish fail
with "correct answer must be selected"; Save Draft then Publish succeeds. Publish validates the
persisted draft, not unsaved form state. Options: clearer copy, dirty-state hint, or
save-on-publish.

---

# FUB-030 — Course/Topic Practice (UX-3), Blocked by Early Practice + FSRS Semantics

**Status:** `DONE` locally in Run UX-02 (P1–P4 committed, not pushed; `docs/RUNS/2026-09-27-UX-02.md`). Semantics: ADR-020 and `docs/LEARNING_ENGINE.md` §39A
(both ACCEPTED 2026-09-26); UX: `docs/UX_SPEC.md` §10. The text below is the original deferral record.
**Priority:** `MEDIUM`
**Area:** Product / Learning semantics / Learner UX

## Observation

`docs/UX_SPEC.md` (Run UX-01 — Learner UX Foundation) reserves Course Practice and Topic Practice as learner-selected study beyond the finite Today plan: bounded sessions (assumption: 10 questions, then an explicit "another 10"), through the same Answer → Attempt → Progress → FSRS pipeline. ADR-016 §6/§19/§21 define Manual Practice as separate from Today (never resolves a DailyPlanItem). No document defines how early/extra repetitions affect FSRS scheduling; ADR-008 is silent.

## Important Constraint

The blocker is a semantics decision (how early practice interacts with FSRS scheduling and Today), not document ceremony. After Run UX-01 (UX-1 + UX-2), first decide whether it is an architectural invariant (→ ADR) or a narrower learning-policy decision (→ an existing canonical learning/design doc). A route exposing manual-practice `submitAnswer` (auth first, `learningSessionId`) would also be required; none exists today.

## Do Not Do Yet

No Practice route, session model, selector, or Practice-shaped CTA in Run UX-01. Temporary bridges that stand in for it are listed in `docs/UX_SPEC.md` §9.

## Promotion Trigger

Run UX-01 complete (UX-1 and UX-2 implemented and browser-verified), and the Early Practice + FSRS semantics decision is made.

---

# FUB-031 — DailyPlan Deletion vs. Practice Classification on Replay

**Status:** `LATENT` (no live defect; no production path deletes plans)
**Area:** Learning Engine / persistence

Since `learning-engine-v2` (Run UX-02 P1, `LEARNING_ENGINE.md` §39A case 4) scheduler outcomes depend on whether
`attempts.daily_plan_item_id` is null. That FK is `ON DELETE SET NULL`
(`20260924000000_daily_plan_answer_attempts.sql`), so deleting a `daily_plans`/`daily_plan_items` row would make its
historical Today Attempts look like Practice, and a rebuild would silently apply the early-correct gate to them.
Today `users → daily_plans` is `ON DELETE RESTRICT` and only a test deletes plans.

## Promotion Trigger

Any plan retention/deletion/cleanup feature, or any change to that FK. Then either forbid plan deletion while
Attempts reference it, or persist an explicit Practice marker on the Attempt.

---

# FUB-032 — Practice Hardening Leftovers (Run UX-02)

**Status:** `LATENT` (no observed defect)
**Area:** Practice / application

Recorded during Run UX-02 review; none blocks V1 and none is needed for the accepted behavior.

- **Same-day re-answer.** The Practice answer path validates eligibility, scope, current version and pending-Today
  but does not reject a Question already answered in the current learning session (ADR-020 lists no such rule). A stale
  client can submit a second same-day Practice answer; it is a normal Attempt and the same-session logic in retrieval
  qualification applies. Decide whether to reject it (409) if it ever shows up in real usage.
- **Retry idempotency.** Practice inherits FUB-025: `answeredAt` is server-captured, so a sequential retry with the same
  `submissionId` can return `SUBMISSION_ID_REUSED` (the Practice UI treats it as a generic retryable error and never
  reuses a submission id). Fix once with FUB-025 for both Today and Practice.
- **Batch content gap.** If a batch Question's version content row were missing, the batch would hold fewer than 10 items
  while `hasMore` still counts it. Unreachable under FK integrity; harden only if a content read path changes.
- **Progress entry link.** Progress lists a Course from `/api/courses/mine` (active, not archived LEARNER) and shows
  Practice links without a `practiceAvailable` signal; an unpublished Course degrades to the calm "unavailable" state.

## Promotion Trigger

Real pilot usage showing any of the above, or the FUB-025 idempotency fix.

---

# FUB-033 — UX3-1 Visual System Polish Leftovers (Run UX-03)

**Status:** `LATENT` (cosmetic only, no defect)
**Area:** Instructor Course-manage page / visual system

Recorded during Run UX-03 UX3-1 general review; both are pre-existing choices carried through the token migration
unchanged, not new decisions, and neither blocks the Slice or the Run.

- **Archive-action color inconsistency.** "Archive Course" (Course-manage page, transition card) renders as a neutral
  `secondary` button while "Remove Topic" (same page, Topics card) renders in `text-danger` red. Both are
  destructive-ish, non-undoable lifecycle actions but are weighted/colored differently — this was already true before
  the migration (`bg-zinc-900`-bordered vs `text-red-600`); the token migration remapped it faithfully rather than
  deciding it. Worth a single deliberate color-hierarchy decision across both actions if a future UX Slice touches
  this page again.
- **Two simultaneous primary CTAs on the instructor Course-manage page.** In the DRAFT-course ready state, "Save"
  (details form) and "Publish" (transition card) can both render as `variant="primary"` at once.
  `docs/UX_SPEC.md` item 8 ("one visually dominant primary CTA per screen/state") is written under the
  Learner-UX-scoped document and is not clearly binding on the instructor authoring surface; the change is already a
  net improvement over the pre-Slice state (every action was equally dominant). Worth a future explicit decision on
  whether the "one dominant primary" rule should extend to instructor authoring screens.

## Promotion Trigger

A future UX Slice (UX3-2 or UX3-4) revisiting the instructor Course-manage page's information architecture, or an
explicit product-owner decision on either color hierarchy or the "one primary per screen" rule's instructor scope.

---

# FUB-034 — Open-Ended Practice, Same-Day Repetition, Daily Plan Budget, PARTIAL Grading (Run UX-03-QA1 Findings 8/9, PARTIAL)

**Status:** `PROMOTED — owned by Run 010` (recorded here so it is never silently dropped; the actionable decision
belongs in `docs/CHATGPT_PLAN.md` once Run 010 starts, not in this file)
**Area:** Learning Engine — evidence/scheduler semantics, Today plan sizing, grading vocabulary

Product-owner QA (real 30-question course) surfaced four explicit product directions that this Run (UX-03-QA1) was
authorized to record but NOT implement, because each requires a new Learning Engine evidence/semantics decision this
Run has no authority to invent (`.claude/rules/learning-engine.md`).

1. **Practice must not dead-end — RESOLVED by RUN010-B.** Today is finite by design; Practice is learner-initiated
   and should feel open-ended (a batch of 10 is pacing/UI only, never a hard session limit). RUN010-B added a Tier 4
   "same-day reinforcement" fallback to `selectPracticeBatch` (activates only once Tiers 1-3 are genuinely exhausted
   for the requested scope), ranked weaker/incorrect-evidence-first then least-recently-answered-first, with an
   anti-immediate-repeat rule and controlled randomness only among exact ties — and extended the existing §39A
   "early correct = evidence-only, no scheduler review" carry-over rule (`progress-update.ts`'s `nextSchedulerMemory`)
   so a Question's 2nd+ real Attempt in the SAME learning-day session never re-invokes a real FSRS scheduler
   transition (regardless of correctness), closing the mastery-inflation risk this item flagged. See
   `src/application/practice/select-practice-batch.ts`, `src/domain/learning/progress-update.ts`,
   `src/domain/learning/learning-session.ts` (`deriveIsReinforcementAttempt`), and
   `supabase/tests/postgres/practice.test.ts`'s `RUN010-B` describe block for the accepted design/evidence.
   Sub-items 2-4 below remain open.
2. **Today Daily Plan Budget — RESOLVED (architecture) by RUN010-D; numeric calibration remains open.** The product
   owner's 30-50 figure was explicitly rejected as an untested hypothesis (not adopted). RUN010-D instead implemented
   the already-accepted-direction tiered-need-bucket + whole-plan-guardrail model
   (`docs/GLOBAL_TODAY_PLAN_SIZE_MODEL.md` §2, `docs/OPEN_QUESTIONS.md` #16): `computeTodayPlanBudget`
   (`src/domain/learning/today-plan-budget.ts`) sizes the plan from genuine REMEDIATION/DUE_REVIEW-tier candidate
   counts (excluding same-day FSRS learning-step artifacts per OQ-044 — see `MemoryScheduler.estimateCardPhase`,
   recomputed at read time rather than stored, so it survives real persistence),
   bounded by minUsefulItems=5 / hardMaximumItems=15 (`PRODUCTION_TODAY_PLAN_BUDGET_POLICY`), with exam proximity
   feeding in only as an amplifier on ranking order (`docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §3/§7,
   `src/domain/learning/exam-urgency.ts`), never a separate budget input. These three numbers (5/8-12/15) and the
   amplifier curve constants remain CONSERVATIVE CALIBRATION CANDIDATES, not locked — see OQ-016 and the module doc
   comments in `today-plan-budget.ts`/`exam-urgency.ts` for what future tuning would touch.
3. **PARTIAL grading outcome.** The product owner observed MULTIPLE_CHOICE attempts that "felt partially correct."
   Investigated in UX-03-QA1: confirmed the domain/application layer has NO canonical PARTIAL outcome — grading is
   `isCorrect: boolean` only (`src/domain/learning/answer.ts`'s `evaluateAnswerCorrectness`, `types.ts`'s `Attempt
   .isCorrect`). UX-03-QA1 did NOT invent PARTIAL semantics; instead it shipped correct-answer reveal + selected/
   missed-option feedback (Finding 3) so the learner still understands what happened, without a new grading category.
   Whether MULTIPLE_CHOICE should ever have a real PARTIAL/partial-credit outcome (and what it would mean for
   `isCorrect`, mastery, scheduler review) is an open Run-010 product/domain decision.
   **Human decision (2026-09-29, resolving RUN010-G Half B's ESCALATE):** Option A (status quo) — no PARTIAL
   grading in V1. `isCorrect: boolean` stays the sole grading outcome; no change to mastery, scheduler review,
   or misconception interaction. Item 3 stays explicitly **OPEN** (declined, not resolved) — the decision
   packet's Option B (learner-facing "almost" acknowledgment) and Option C (real partial-credit grading via a
   future dedicated ADR) remain available if the product owner revisits this post-V1; nothing here should be
   read as ruling them out permanently.
4. **Practice ranking diversification (partially resolved this Run).** UX-03-QA1 already fixed the reported
   symptom safely: Tier 2 (unseen)/Tier 3 (broader coverage) candidates within `selectPracticeBatch` are now
   Topic-interleaved (`interleaveByTopic`) instead of raw creation/import order, without touching the canonical NBA
   ranking Today also uses. If Run 010 revisits ranking/tie-break policy more broadly (e.g., for Today itself), start
   from this same "diversify ties, never priorities" principle rather than re-deciding it from scratch.
5. **ADR-016 §10 tier-crossing requirement — still not implemented (pre-existing gap, surfaced by RUN010-D review).**
   ADR-016 §10 / `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5 already ACCEPT, as a binding product rule, that
   sufficiently severe Memory Need/overdue duration must eventually be able to promote a candidate across a priority
   TIER boundary (e.g. a badly-overdue `DUE_REVIEW` candidate must not be permanently capped below every
   `REMEDIATION` candidate forever, purely because a sibling Course keeps generating REMEDIATION-tier candidates
   every day) — see also `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a, which states this makes §7/§14's "tier is the
   primary axis, exam urgency only within-tier" framing "no longer sufficient as stated." `tierOf()`
   (`src/domain/learning/next-best-action-ranking.ts`) still has zero dependency on `dueAt`/`retrievability` — this
   gap predates RUN010-D and RUN010-D's own delivered scope (an exam-urgency amplifier, confined to the within-tier
   tie-break per ADR-016 §11 "amplifier, not gate") does not violate this rule, but RUN010-D substantially rewrote
   this same file's doc comments without tracking the still-open tier-crossing requirement anywhere outside those two
   design docs. Exact escalation mechanism/thresholds remain explicitly undecided calibration work, not solved here.

## Promotion Trigger

Run 010 start — this item is the Run's own required early input, not backlog to rediscover later.

---

# FUB-035 — Assessment/Content-Quality Critic Signals (Run UX-03-QA1 Finding 6, owned by Run 011)

**Status:** `PROMOTED — owned by Run 011` (content-generation / AI critic / assessment-quality intelligence; explicitly
out of scope for any Run before 011, including UX-03-QA1 which found it)
**Area:** Content Intelligence (future) — authoring-time / import-time quality signals

Product-owner QA (real 30-question course) found the CONTENT itself, not runtime code, leaked assessment patterns a
learner could exploit instead of learning the material: correct answers noticeably longer/more specific/more polished
than distractors, alongside the separately-fixed position bias (UX-03-QA1 Finding 4, resolved with a stable
per-presentation shuffle). UX-03-QA1 explicitly did NOT build a speculative AI/content-quality engine. Suggested
future Run-011 signals, none designed or scoped yet:

- correct-answer position bias across a Question set (now mitigated at PRESENTATION time by Finding 4's shuffle, but
  not detected/flagged at AUTHORING/IMPORT time — a critic could still warn an instructor their SOURCE data is
  positionally biased even though learners no longer see it);
- correct-answer average length vs. distractor length;
- correct-answer lexical/stylistic distinctiveness vs. distractors;
- distractor plausibility/ambiguity;
- MULTIPLE_CHOICE correct-option-count distribution (predictable patterns across a set);
- duplicated/templated-question detection across a content set.

## Promotion Trigger

Run 011 start.

---

# FUB-036 — Author-Can-Learn-Own-Course Blocked by Single-Role Membership Schema (QA2-D, STOPPED)

**Status:** `RECORDED — decision needed before Run 010/011 pick this up`
**Area:** Course Membership / Authorization (ADR-015)

QA2-D ("Author can learn their own Course") was investigated and STOPPED per its own gate — see
`docs/RUNS/` entry for this Slice for full detail. One-line summary: `course_memberships` has a physical
`UNIQUE (user_id, course_id)` constraint with a single scalar `role` column
(`supabase/migrations/20260919000000_course_membership_v1.sql`), so one user can hold exactly one role on
one Course, ever. `createCourse` gives the creator an `OWNER` row
(`src/application/course/create-course.ts`); the existing self-join path
(`src/application/course/join-course.ts` -> `createMembership`'s `ON CONFLICT (user_id, course_id) DO
NOTHING`) would just return that same `OWNER` row unchanged (`ALREADY_MEMBER`), never add a concurrent
`LEARNER` row. Both eligibility checks that gate Today/Practice
(`src/application/dailyPlan/live-learner-membership.ts`, `src/application/practice/practice-eligibility.ts`)
require `membership.role === "LEARNER"` on that same single row. There is no existing, already-authorized
mechanism for one user to hold two roles on one Course — closing this requires an explicit product/schema
decision (e.g. multi-row membership per user/Course, or a role-set column), not an implementation-only fix.

## Promotion Trigger

Before Run 010 or inside Run 011 — product owner to decide the membership-plurality model; do not let an
implementation Slice invent it ad hoc.

**RUN010-H re-confirmation (2026-09-29, ESCALATE, no code change):** Re-verified against current repository
state — finding holds exactly as recorded. `course_memberships` (`supabase/migrations/20260919000000_course_
membership_v1.sql`) still has `UNIQUE(user_id, course_id)` + scalar `role`; `CourseMembershipRepository
.findMembership(userId, courseId): Promise<CourseMembership | null>` (`src/application/course/ports.ts`) —
the single-row assumption is baked into the port CONTRACT, not just the DB constraint, so every caller
(`join-course.ts`, `live-learner-membership.ts`, `practice-eligibility.ts`, and any future authoring-side
check) inherits it. No already-authorized plurality model exists: ADR-015 (`docs/DECISIONS/015-user-course-
membership-and-join-authorization-model.md`) documents `role` as a single conceptual field and its Addendum's
"genuinely undecided edge cases" (OQ-043) cover revoke/rejoin only, not plurality; `docs/OPEN_QUESTIONS.md`
has no open item on membership plurality; `docs/CHATGPT_PLAN.md` only records QA2-D's STOP. No "author preview
as learner" or self-enrollment side-mechanism exists anywhere in `src/` (checked). Decision packet delivered
(see `scratch/development_checkpoint.md` RUN010-H entry for full detail) — five things a real decision needs
to resolve (schema shape; the `findMembership`-family port/call-site ripple; what "revoke this user" means
when they hold multiple roles; whether an Author's own attempts on their own Course should count toward
instructor-facing aggregate Insights, given they already know the answers; and the self-enrollment UX/backfill
question), and three schema-shape options with tradeoffs (1: composite-key multi-row membership — most
general, most invasive to the port layer; 2: role-set/array column — keeps one row per user/Course pair,
smaller port-signature change, but forces an enum-to-array migration touched pervasively; 3: a separate,
additive self-enrollment concept that does not touch `course_memberships` at all — smallest migration, but
is a second access path that directly revises ADR-015 §1's "the single explicit User↔Course relationship"
claim and needs its own explicit product sign-off). No recommendation is made among the three; that choice
is the product owner's, not an implementation Slice's, per this item's own Promotion Trigger.

**Human decisions (APPROVED 2026-09-29) — Option 4 architecture selected.** The product owner chose a
fourth option beyond the three the RUN010-H decision packet offered: a separate, additive
`course_authors` table modeling management capability (OWNER/INSTRUCTOR) independently of
`course_memberships`, which will eventually narrow to learner-participation-only. Three specific
decisions were approved, refining/superseding the open questions above:

1. **Author self-enrollment exception.** An active Course Author may self-enroll as an ordinary LEARNER
   in their own Course even when it is DRAFT/AUTHORIZED_ONLY/otherwise not publicly self-joinable — a
   narrow bypass of `canSelfJoinCourse` scoped only to the Course's own author. The resulting
   `course_memberships` LEARNER row gets NO special treatment downstream (same Today/Practice/Attempts/
   Evidence/Progress/FSRS paths as any other learner). Authoring capability itself never grants learner
   eligibility — only this one narrow self-join bypass is authorized. (Answers this item's "self-enrollment
   UX/backfill" open question; implementation deferred to RUN010-H.3.)
2. **Last-author protection.** `revokeCourseAuthor` must fail closed (a new, explicit outcome) if the
   operation would leave a non-deleted Course with zero active `course_authors` rows. Future
   ownership-transfer/deletion workflows may refine this later. (Answers this item's "what does revoke mean"
   open question for the single-capability-per-row case; implementation deferred to RUN010-H.3.)
3. **Phased pacing with a hard human gate.** Implementation proceeds as H.1 (additive schema + backfill,
   zero application change) → H.2 (application-layer authorization cutover + required DTO/API surface
   changes) → **hard human-review gate** → H.3 (destructive legacy-row deletion + the two decisions above)
   → optional H.4 (Insights CTE cleanup / polish). Full detail in
   `scratch/development_checkpoint.md`'s "RUN010-H human decisions" section.

Still explicitly deferred (not part of this approved plan): the staff-vs-self-study cohort/analytics-
inclusion distinction — no exclusion of any kind is added to Insights by this work; a dual-role
Author-learner's Attempts count exactly like any other learner's (authoring capability carries zero
mastery/evidence signal). New co-author-management UI likely remains a future FUB item, not part of H.1-H.4.

**RUN010-H.1 outcome (2026-09-29, STATUS KEEP):** Implemented Phase A only — additive migration
`supabase/migrations/20260929010000_course_authors_v1.sql` creates `course_authors` (`unique(user_id,
course_id, capability)`, RLS enabled with zero policies, matching `course_membership_v1.sql`'s own
convention) and backfills existing OWNER/INSTRUCTOR `course_memberships` rows into it in the same
migration (LEARNER rows excluded; revoked rows keep their `revoked_at`; `course_memberships` itself
untouched). New domain type `CourseAuthorGrant` + `isActiveAuthorGrant` predicate
(`src/domain/course/types.ts`), new `CourseAuthorRepository` port (`src/application/course/ports.ts`,
mirroring `CourseMembershipRepository`'s shape) with `findActiveCapabilities`/`grant`/`revoke`, and its
`PostgresCourseAuthorRepository` implementation + row mapper
(`src/infrastructure/postgres/course-author-{repository,mapper}.ts`). Wired into
`PostgresCourseUnitOfWork` as an optional `CourseRepositories.authors` field (optional specifically so
none of the ~18 existing route/UnitOfWork call sites needed to change) — available for RUN010-H.2 to use,
not called by any application code yet. Zero authorization call sites, zero DTOs/routes, and zero
`course_memberships` rows/columns touched — confirmed via diff inspection (only 2 lines removed across all
modified files, both immediately expanded re-additions, not behavioral deletions). New tests: 8 PGlite
repository tests (`course-author-repository.test.ts`) + 5 migration-ordering-sensitive backfill-parity
tests (`course-authors-backfill.test.ts`, applying only prior migrations, seeding `course_memberships`,
then applying just the new migration to prove row-count parity, field-level parity, revoked-row
preservation, LEARNER exclusion, and `course_memberships` non-mutation). Full unit suite 1612/1612 PASS
(no regression from the pre-Slice count), typecheck/lint clean on all changed files. See this Slice's own
compact handoff for full verification detail and reviewer outcome.

---

# FUB-037 — Question Management Workspace (Search/Filter/Pagination/Review Queue)

**Status:** `RECORDED — owned by Run 011`
**Area:** Instructor Question Management (`src/app/instructor/courses/[courseId]/page.tsx`, `question-row.tsx`)

QA2-C (bounded visual polish of the per-row Question Management markup — `StatusPill`, divider rows) left
the underlying list itself unchanged: it still renders every Question in one flat, unpaginated list with no
search, no state/topic filter, and no dedicated review-queue view for pending-draft Questions. That is fine
at current pilot scale but will not hold as a Course's Question count grows. A future Slice should design a
real Question Management workspace (search, filter by state/Topic, pagination or virtualization, and a
focused review queue) rather than an implementation Slice inventing this ad hoc.

## Promotion Trigger

Inside Run 011, once Question-list scale (or instructor feedback) makes the flat list impractical.

---

# FUB-038 — Reinforcement Scheduler-Freeze Scoped to "Any Earlier Attempt," Not "Any Earlier Rated Attempt" (RUN010-B review finding, NON-BLOCKING)

**Status:** `RECORDED`
**Area:** Learning Engine — FSRS scheduler freeze (`src/domain/learning/progress-update.ts`, `learning-session.ts`)

RUN010-B's `deriveIsReinforcementAttempt` (and the `nextSchedulerMemory` freeze it feeds) treats a Question's 2nd+
Attempt in the SAME learning-day session as "reinforcement" (frozen scheduler transition) based on whether ANY
earlier Attempt exists this session — not specifically an earlier RATABLE (`FULL_EVIDENCE`) one. If a Question's
first same-day Practice Attempt were `NOT_RATABLE` (assisted, second-attempt, or answer-revealed evidence) and a
later same-day Attempt were the first genuinely ratable one, this would freeze that later Attempt even though no
real scheduler review had fired yet that day — not quite matching the intended "whichever happens first" rule
(the first *scheduler-affecting* event, not literally the first attempt of any quality).

Currently **unreachable in production**: `submitPracticeAnswer` hardcodes `assistanceUsed: "NONE"`,
`attemptNumberForPresentedItem: 1`, `answerWasRevealedBeforeResponse: false` for every Practice submission, and
`createProductionSubmitAnswerContext` hardcodes `determineSuspiciousTiming: () => false`
(`src/infrastructure/learning/composition-root.ts`) — so every Practice Attempt is always `FULL_EVIDENCE`/ratable
today, and this gap cannot fire. Recorded so it is not rediscovered as a live bug once assisted Practice or real
suspicious-timing detection ships. Fix (when relevant): tighten `deriveIsReinforcementAttempt`'s derivation to
"prior RATED (FULL_EVIDENCE, not NOT_RATABLE) same-session Attempt," mirroring the same
`mapEvidenceToSchedulerRating`/`NOT_RATABLE` distinction `nextSchedulerMemory` already applies to the current
Attempt.

## Promotion Trigger

Before or alongside any Slice that ships assisted Practice attempts (hints/second-attempt/answer-reveal) or real
`determineSuspiciousTiming` detection.

---

# FUB-039 — Same-Day Reinforcement Freeze Can Delay a New Card's FSRS Graduation When Only Touched via Same-Day Practice (RUN010-C audit, NON-BLOCKING)

**Status:** `RECORDED`
**Area:** Learning Engine — FSRS scheduler freeze x short-term learning steps
(`src/domain/learning/progress-update.ts`, `learning-session.ts`, OQ-044)

RUN010-C audited whether RUN010-B's unconditional same-day reinforcement scheduler-freeze
(`isReinforcementAttempt` in `nextSchedulerMemory`) incorrectly conflates (a) a learner voluntarily
re-practicing a Question before it is due again with (b) a Question that has genuinely become due again the
same calendar day (a real FSRS-scheduled event, distinct from an artificial repeat) — directly relevant given
OQ-044's confirmed finding (RUN010-C) that a brand-new card's first correct answer is due again in exactly 10
minutes under current ts-fsrs defaults.

**Verdict: the unconditional freeze is intentional and correct, not a bug** — see
`src/infrastructure/learning/__tests__/practice-early-correct-scheduling.test.ts`'s "RUN010-B — same-day
reinforcement" describe block (including its already-existing "not merely 'still early'" test, predating this
audit) and the new RUN010-C test proving the identical outcome for a genuinely-due-again NEW card. "At most
one real scheduler-moving event per Question per day, regardless of why" remains the accepted invariant;
distinguishing "before due" from "genuinely due again" would reopen exactly the risk RUN010-B closed (a
same-day repeat being able to retrigger a second real AGAIN/lapse for what is really one day's due event) and
would additionally require deciding, ahead of OQ-044's own still-open calibration, whether a same-day
learning-step event should count as a real review at all — a product decision, not a threshold fix.

**Residual, bounded, non-blocking consequence recorded here:** because Today can never re-present the same
Question twice in one plan, and Practice's Tier 4 (`selectPracticeBatch`) is the ONLY way an
already-answered-today Question is served again that day, a brand-new card that a learner ONLY ever touches
via same-day Practice reinforcement (never on a later calendar day) will never actually graduate out of
ts-fsrs's short-term "Learning" state that day — every same-day reinforcement repeat freezes the transition
`memoryScheduler.review()` would otherwise perform. This is bounded to a single calendar day (the very next
day it is touched — via Today or a fresh, non-reinforcement Practice pick — is not "same session," so a real
review fires and the card progresses normally, just a session later than the raw due timestamp suggests,
which is already OQ-044's known, accepted drift). Not fixed here because it is an interaction between two
already-open/deliberate policies (OQ-044 learning-step calibration + RUN010-B's per-day event cap), not an
independent bug.

## Promotion Trigger

If/when OQ-044 is calibrated (e.g. learning steps disabled, shortened, or a minimum first-interval floor is
adopted), re-check whether this residual same-day-graduation-delay interaction still applies under the new
configuration, and whether it is still acceptable.

---

# FUB-040 — RUN010-E Residual Gaps: Cross-Course Topic Diversity, and Unmapped OQ-018 Reason Categories (NON-BLOCKING)

**Status:** `RECORDED`
**Area:** New Material fallback Topic diversity (`src/infrastructure/postgres/unseen-question-repository.ts`,
`src/application/dailyPlan/generate-daily-plan-for-resolved-inputs.ts`); OQ-018 learner-facing reason mapping
(`src/messages/he.ts`, `src/app/(learner)/today/question-card.tsx`)

RUN010-E investigated whether ADR-017's V1 New Material fallback samples representatively across Topics.
Evidence (see `supabase/tests/postgres/unseen-question-repository.test.ts`'s new "Topic-diversifying
round-robin" suite) showed a real, previously-unaddressed clustering bug: pure `created_at asc` ordering let
one Topic's older unseen Questions monopolize the entire (typically 3-item) fallback for as long as that Topic
still had unseen material, silently starving every other Topic of early calibration evidence. This was fixed
**within a single Course's own selection** via a deterministic `row_number() over (partition by topic_id ...)`
round-robin, still unseen-only, still capped at ADR-017's existing max-3, still deterministic — no ADR-017
envelope change.

**Two bounded items intentionally left open, not solved by that fix:**

1. **Cross-Course pooling still isn't Topic-aware.** `generate-daily-plan-for-resolved-inputs.ts`'s
   `discoverNewMaterialItems` pools each eligible Course's own (now Topic-diversified) candidate list and
   re-sorts the pooled result **globally by `createdAt` only** before taking the final top-3 — this pre-existing
   step was left untouched (it is a Course-count-correctness concern, documented in that file's own comment,
   not a Topic concern). Consequence: a learner with unseen material in MULTIPLE simultaneously-eligible
   Courses on the same day can still have one Course's Topic-diversified order partially overridden by the
   cross-Course recency re-sort. Bounded (affects only the multi-Course-simultaneous-fallback edge case, never
   the common single-dominant-Course case) and explicitly NOT a per-Course fairness quota (which ADR-017 still
   forbids) — a genuine fix would need a deliberate product decision about how Topic diversity and Course
   pooling should interact, which is out of this Slice's authority to invent.

2. **Not every real internal NBA/tier signal has a clean, honest 1:1 mapping to one of OQ-018's six candidate
   learner-facing reason strings** (review due / repeated mistake / weak area / exam approaching / not enough
   evidence / new material). RUN010-E mapped `REVIEW_DUE` → "review due", `RELEARN_LAPSE` → "weak area",
   `REPAIR_MISCONCEPTION` → "repeated mistake", and the ADR-017 fallback's `NEW_LEARNING` → "new material"
   (closing the concrete cold-start mislabeling bug: `NEW_LEARNING` previously had no mapped label at all and
   fell back to leaking the raw internal string). Two things were deliberately left UNMAPPED rather than
   guessed:
   - `STRENGTHEN_MEMORY` (a positive-progress, not-yet-mastered state) does not honestly fit any of OQ-018's six
     strings — they all read as either routine/negative signals or the cold-start case, and reusing "weak area"
     for it would conflate a positive, non-remediation state with a genuinely weak one. Its pre-existing shipped
     label ("חיזוק זיכרון" / "memory strengthening", predating OQ-018 and this Slice) was left unchanged, since
     it is already honest, just not literally one of OQ-018's six candidate strings.
   - "exam approaching" has no per-item persisted signal to hang an honest label on: RUN010-D's exam-urgency
     amplifier is a continuous within-tier tie-break multiplier applied uniformly across a Course's items, not a
     boolean/threshold fact recorded on any one `DailyPlanItem` — labeling a specific item "exam approaching"
     would require a genuine new product/threshold decision (when is urgency "high enough" to say so out loud?)
     that OQ-018 does not itself resolve.

3. **`GET /api/daily-plan/today` still serializes raw internal `tier`/`reasons`/`otherApplicableTypes`/
   `actionType` strings at the wire level** (`src/app/api/daily-plan/today/daily-plan-dto.ts`), even though the
   UI (`question-card.tsx`) now only ever renders a mapped, honest label and never the raw code. This DTO
   predates RUN010-E by a wide margin (introduced well before this Run, as an already-reviewed, deliberate "use
   only real domain fields, no invented score" design) and is unchanged by this Slice's diff — flagged here
   because RUN010-E's own review process (general-reviewer pass) surfaced it as a gap in this Slice's own
   "no other leak surface" verification, not as a new defect this Slice introduced. Whether this is actually a
   problem depends on a reading of OQ-018's "avoid exposing internal scores" constraint: narrowly (only the
   rendered UI matters) it is already satisfied; broadly (a technical learner opening DevTools/Network can see
   e.g. `MISCONCEPTION_ACTIVE` or an unmapped raw `actionType`) it is not. Resolving this would mean either
   tightening the DTO to only carry an already-mapped learner-facing reason (a real, if small, API-contract
   change) or an explicit product decision that wire-level internal codes are acceptable as long as the UI
   never renders them raw — not something to infer here.

## Promotion Trigger

Promote item 1 if/when a Run adds genuine multi-Course-simultaneous Today composition depth (beyond today's
pooled-and-capped fallback). Promote item 2 (either half) only alongside an actual product decision — resolving
OQ-018's `STRENGTHEN_MEMORY`/"exam approaching" gap, or literally reconciling the pre-existing
`RELEARN_LAPSE`/`REPAIR_MISCONCEPTION`/`STRENGTHEN_MEMORY` copy to OQ-018's exact six strings — is a copy/product
call for the human product owner, not something to infer here. Promote item 3 alongside a formal OQ-018
resolution (the DTO-tightening question is naturally part of "what does explainability mean at the API
boundary," not a standalone fix to invent mid-Slice).

---

# FUB-041 — Two Pre-Existing Failing Schema/PGlite Tests, Confirmed Unrelated to RUN010-E (NON-BLOCKING, NEEDS TRIAGE)

**Status:** `RECORDED`
**Area:** `supabase/tests/postgres/practice-vertical.test.ts`, `supabase/tests/postgres/practice.test.ts`

While gathering final verification evidence for RUN010-E, a full `npx vitest run --config supabase/vitest.config.mts`
pass surfaced 2 failing tests (out of 310) in files RUN010-E's diff does not touch:

1. `practice-vertical.test.ts` > "Practice selects around Today, answers through the normal pipeline, never
   resolves Today, and Today keeps working" — fails because the Practice wire response now includes an
   unexpected extra `topicId` field the test's exact-keys assertion does not allow for. Very likely a
   consequence of `questions.topic_id` (added by `20260928000000_question_authoring_v1.sql`, Run 006 S2) now
   being included somewhere in the Practice read path's row mapping, with this test never updated for it.
2. `practice.test.ts` > "RUN010-B — same-day reinforcement (Tier 4, resolves FUB-034) > never returns the
   just-answered Question first when a genuine alternative exists, even if that alternative is lower ranked by
   evidence" — an ordering/tie-break assertion failure between two specific Questions.

**Confirmed unrelated to this Slice**: both failures were reproduced identically against the clean pre-Slice
tree (`git stash` of every RUN010-E change, re-run, same 2 failures; `git stash pop` to restore). RUN010-E's
diff never touches Practice selection/ranking code or the Practice read path — only
`unseen-question-repository.ts`, `application/dailyPlan/ports.ts` (doc comment only), `question-card.tsx`,
`he.ts`, and test/doc files. Per `.claude/rules/testing.md` §14 ("do not silently broaden scope to repair
unrelated failures... report unrelated pre-existing blockers accurately"), these were left unfixed and are
recorded here rather than folded into this Slice.

## Promotion Trigger

Triage promptly — a currently-broken schema/PGlite suite reduces confidence in future Slices' "no regression"
claims for anything touching Practice. Whoever picks this up should first determine how long these have been
failing (bisect recent RUN010-B/C/D commits) before assuming either is a trivial test-fixture staleness issue.

---

# Closed items (moved to archive)

These items are closed; full text lives in `docs/archive/FOLLOW_UP_BACKLOG_CLOSED.md`. IDs are never reused.

| ID | Title | Outcome |
| --- | --- | --- |
| FUB-005 | Structured Import Source Size/Row Limits | closed — `RESOLVED`, see archive |
| FUB-012 | Legacy TodaySession Retirement Investigation | closed — `RESOLVED`, see archive |
| FUB-027 | Signup Confirmation Redirect / Join-Intent Preservation | closed — `HOSTED + MANUAL VERIFIED`, see archive |
| FUB-028 | Item Analysis Discoverability | closed — `RESOLVED`, see archive |

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

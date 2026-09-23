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

**Status:** `RESOLVED` — Run 008 S1.D added `MAX_IMPORT_ROWS` (2,000,
`src/application/import/limits.ts`), enforced in `previewImport` right
after parsing, inherited by `confirmImport`'s Phase 1 reparse. Kept for
traceability; the original observation below is historical.
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

The repository has verification commands (`npm run typecheck/lint/test/
test:schema/build`) but no repository-owned CI pipeline enforcing them on
PRs/pushes.

## Follow-Up Investigation

Post-pilot production work should evaluate PR verification, typecheck,
relevant tests, build, and release/deployment gates (Run 012 territory).

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

Do not choose or integrate a provider now; Run 008 S6 may add a narrow,
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

Establish backup ownership, frequency, RPO, RTO, and a periodic
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

# FUB-012 — Legacy TodaySession Retirement Investigation

**Status:** `RESOLVED` — retired pre-Run-009 (dedicated cleanup Slice,
2026-09-23). Confirmed human evidence before deletion: hosted
`today_sessions` = 0 rows, `today_session_items` = 0 rows,
`attempts.today_session_item_id IS NOT NULL` = 0 rows. A runtime
reachability audit confirmed no live `src/app` route created/retrieved a
TodaySession. All TodaySession application/domain/infrastructure code and
tests were removed; `DailyPlan`/`DailyPlanItem` (ADR-016) is now the sole
active Today model. A forward-only migration
(`supabase/migrations/20260929000000_retire_today_session.sql`) drops
`today_sessions`/`today_session_items` and
`attempts.today_session_id`/`attempts.today_session_item_id`. That migration
is committed and locally/PGlite-verified; it was deliberately not applied
hosted as part of this Slice, and was later applied hosted by a human
(2026-09-23) after the backup gate closed; see `docs/DEV_STATUS.md`. ADR-011 updated to
reflect retirement. Kept for traceability; the original observation below is
historical.
**Priority:** `LOW`
**Area:** Repository Maintainability

## Observation

Legacy `today_sessions`/`today_session_items` tables and associated code
may no longer be required now that persisted DailyPlan/DailyPlanItems
(ADR-016) own Today.

## Follow-Up Investigation

Investigate whether these can eventually be removed once no required
compatibility path remains.

## Do Not Do Yet

Do not delete now — no proof yet that nothing depends on them.

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

**Status:** `DEFERRED`
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

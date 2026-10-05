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

This item was recorded during Development OS V1.2 reconciliation (since completed).

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

Development OS V1.2 is implemented and verified; run this audit before or during a future product Run when the work becomes relevant.

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

Update 2026-10-04: pilot-minimum sanitized error logging now exists (`src/lib/ops-log.ts`); see `docs/PILOT_EVIDENCE_OPERATIONS.md`.

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
performed; a second logical backup was taken 2026-10-03 before hosted
migration H.3). **Narrowed 2026-10-04 (PILOT-HARDENING-EVIDENCE-001 Slice B, `b818a90`):** the public schema, data and
migration history were restored into a disposable local PostgreSQL 17.6 container (counts match, FK/author checks pass,
hosted-isolation proven, resources destroyed). **Narrowed further 2026-10-04 (AUTH-RESTORE-HARDENING-001):** the
local runbook/script gap is DONE: `docs/RESTORE_RUNBOOK.md` + `scripts/restore-local-backup.mjs` (validate/restore,
local-only guards, tests, independently reviewed). Real drill on the latest backup = PARTIAL (exit 2): public data and
migration history verified (12 tables, 25 FKs, 15 migrations match repo); trigger recreated post-load; Auth only STAGED
in an all-text schema, NOT faithfully recovered (backup is auth data-only: no auth DDL, auth.schema_migrations/GoTrue
version, trigger/supabase_migrations DDL or roles; dump command undocumented). Hosted restore, sign-in usability and
concurrency remain unproven. **Engineering narrowed 2026-10-04 (BACKUP-DR-V1-IMPLEMENTATION-001, Slices B-G):** the V1 FULL procedure tooling is DONE and independently reviewed (security + DB, twice; no blocking findings after fixes): `backup:create|validate|keygen|encrypt|decrypt|retention` and the `restore:local` package layout. A disposable restore drill is FULL but on a SYNTHETIC_LOCAL source (GoTrue v2.197.0 replay), not hosted (`docs/RUNS/2026-10-04-BACKUP-DR-V1-IMPLEMENTATION-001-F-restore-drill.md`). **Production proof DONE 2026-10-04 (human-executed; Run report "Post-close addendum"):** a real Production V1 backup (Session Pooler, FULL_CANDIDATE) was validated, encrypted (UBKENC01), decrypted and restored into a disposable local container: RESULT FULL (public + auth + migration state; 15/15 `supabase_migrations`, 82/82 `auth.schema_migrations`, 25 FKs 0 orphans, orphan counts 3/0 = manifest, trigger present and enabled). Plaintext deleted; encrypted local copy and an encrypted off-device copy (Google Drive, owner-chosen) exist. **Closed parts:** real-Production backup procedure, Auth-inclusive package, migration-state recovery, disposable local FULL drill, off-device encrypted copy. Operations checklist/cadence (recommended): `docs/BACKUP_DR_POLICY.md`. Non-blocking review residuals: FUB-047; key custody hardening: FUB-048.
**Narrowed 2026-10-05 [HUMAN_REPORTED, Run `2026-10-05-PILOT-CLOSURE-OVERNIGHT-001`]:** the project is on the Supabase Free plan; managed scheduled backups and PITR are unavailable on this plan. This settles item (a) as a fact (the custom V1 backup/restore procedure is the only recovery path; it does not invalidate the satisfied Pilot DR gate); a plan upgrade decision remains human-owned.
**Still open (NARROWED, not closed):** (a) ~~Supabase plan / managed-backup / PITR settings~~ plan facts now known (see above); whether to upgrade is undecided; (b) the recommended restore-drill cadence is not owner-approved; (c) no hosted restore / hosted DR, no 24/7 response; (d) FULL local restore does NOT prove hosted GoTrue-version equality or sign-in usability against the restored Auth.
Still human-owned: backup owner, frequency, RPO/RTO, Supabase plan/PITR, retention/encryption of PII dumps. **Policy decided 2026-10-04 (human-approved): `docs/BACKUP_DR_POLICY.md`** (owner, frequency, scope, RPO/RTO, retention, encryption, Pilot DR gate); Supabase plan/PITR still unverified. Evidence:
`docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-B-restore-drill.md`,
`docs/RUNS/2026-10-04-AUTH-RESTORE-HARDENING-001-D-local-drill.md`. Not closed: items (a)-(d) above remain. The Pilot DR gate is SATISFIED (2026-10-04); it was NOT_READY until the Production proof.

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

**Status:** `DEFERRED`
**Priority:** `MEDIUM`
**Area:** Product / Learner Progress

Simple read-only Topic-state Progress is already delivered (Run 009: `docs/RUNS/2026-09-25-009.md`; current capability in `docs/DEV_STATUS.md`) and is not reopened here. Still deferred: Landscape, Pulse/movement, historical trends, richer history, readiness score, percentages, forecasting, learner-selected study workflow, gamification, advanced Progress. Pilot evidence has NOT validated the advanced directions.

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

**Narrowed 2026-10-05 (Run `2026-10-05-PILOT-CLOSURE-OVERNIGHT-001`):** Pilot item 13(a) is satisfied by derivation; `today_opened` is not required for the pilot minimum (`docs/PILOT_EVIDENCE_OPERATIONS.md` §3.1). Remaining here: plan-column maintenance, Attempts index, and a `today_opened` only if a later decision wants it.

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

**Status:** `DEFERRED`
**Area:** Question authoring UI

Status qualifier (moved from the Status line, verbatim): UX WATCH (not a persistence bug, not a blocker).

Observed 2026-09-25: a correct answer selected in the form but not saved makes Publish fail
with "correct answer must be selected"; Save Draft then Publish succeeds. Publish validates the
persisted draft, not unsaved form state. Options: clearer copy, dirty-state hint, or
save-on-publish.

---

# FUB-031 — DailyPlan Deletion vs. Practice Classification on Replay

**Status:** `DEFERRED`
**Area:** Learning Engine / persistence

Status qualifier (moved from the Status line, verbatim): LATENT (no live defect; no production path deletes plans).

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

**Status:** `DEFERRED`
**Area:** Practice / application

Status qualifier (moved from the Status line, verbatim): LATENT (no observed defect).

Recorded during Run UX-02 review; none blocks V1 and none is needed for the accepted behavior.

- **Same-day re-answer.** The Practice answer path validates eligibility, scope, current version and pending-Today
  but does not reject a Question already answered in the current learning session (ADR-020 lists no such rule). A stale
  client can submit a second same-day Practice answer; it is a normal Attempt and the same-session logic in retrieval
  qualification applies. Decide whether to reject it (409) if it ever shows up in real usage.
- **Retry idempotency.** Practice inherits the Today answer-idempotency question (`docs/OPEN_QUESTIONS.md` OQ-048; archived
  FUB-025): `answeredAt` is server-captured, so a sequential retry with the same `submissionId` can return
  `SUBMISSION_ID_REUSED` (the Practice UI treats it as a generic retryable error and never reuses a submission id). Resolve
  once with OQ-048 for both Today and Practice.
- **Batch content gap.** If a batch Question's version content row were missing, the batch would hold fewer than 10 items
  while `hasMore` still counts it. Unreachable under FK integrity; harden only if a content read path changes.
- **Progress entry link.** Progress lists a Course from `/api/courses/mine` (active, not archived LEARNER) and shows
  Practice links without a `practiceAvailable` signal; an unpublished Course degrades to the calm "unavailable" state.

## Promotion Trigger

Real pilot usage showing any of the above, or the OQ-048 idempotency resolution.

---

# FUB-033 — UX3-1 Visual System Polish Leftovers (Run UX-03)

**Status:** `DEFERRED`
**Area:** Instructor Course-manage page / visual system

Status qualifier (moved from the Status line, verbatim): LATENT (cosmetic only, no defect).

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

# FUB-034 — ADR-016 §10 Severe-Overdue Tier-Crossing Not Implemented (Residual of Open-Ended Practice / Plan Budget / PARTIAL Grading Item)

**Status:** `DEFERRED`
**Area:** Learning Engine — NBA ranking (`src/domain/learning/next-best-action-ranking.ts`)

The original item (Run UX-03-QA1 Findings 8/9, PARTIAL) was promoted to Run 010, which is COMPLETE
(`docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md` owns delivered scope and evidence). Its full pre-prune text,
including every resolved narrative and the PARTIAL Option A/B/C wording, is in `docs/archive/FOLLOW_UP_BACKLOG_CLOSED.md`
(FUB-034). Former residuals and where they now live:

- Numeric calibration of the Today plan budget (5 / 8-12 / 15) and exam-urgency amplifier constants: `docs/OPEN_QUESTIONS.md`
  OQ-016 (CALIBRATION).
- PARTIAL grading: declined for V1 by the product owner (Option A, status quo; Run 010 report §4). `isCorrect: boolean` stays
  the sole grading outcome (`docs/DECISIONS/014-question-answer-model-v1.md` "Deferred"). Options B (learner-facing "almost")
  and C (real partial credit via a future dedicated ADR) are revisitable only if the product owner reopens it post-V1.
- Practice ranking diversification: Tier 2/3 Topic-interleaved (`interleaveByTopic`); principle "diversify ties, never
  priorities" (archived FUB-034 item 4).

Still open here (implementation gap, pre-existing, surfaced by the RUN010-D review):

ADR-016 §10 / `docs/GLOBAL_TODAY_REMAINING_DECISIONS.md` §5 accept that sufficiently severe Memory Need/overdue duration must
be able to promote a candidate across a priority TIER boundary (a badly-overdue `DUE_REVIEW` must not be permanently capped
below every `REMEDIATION` candidate); see `docs/GLOBAL_TODAY_PRIORITY_MODEL.md` §5a. `tierOf()` has no dependency on
`dueAt`/`retrievability` yet. RUN010-D's exam-urgency amplifier (within-tier tie-break only, ADR-016 §11) does not violate
the rule. The escalation mechanism/thresholds are undecided calibration work owned by `docs/OPEN_QUESTIONS.md` OQ-017.

## Promotion Trigger

A future ranking-policy Run (explicit, testable, versioned per `.claude/rules/learning-engine.md`) after the
mechanism/thresholds are decided (OQ-017).

---

# FUB-035 — Assessment/Content-Quality Critic Signals (Run UX-03-QA1 Finding 6)

**Status:** `DEFERRED`
**Area:** Content Intelligence (future) — authoring-time / import-time quality signals

Status qualifier (moved from the Status line, verbatim): PROMOTED — owned by Run 011 (content-generation / AI critic / assessment-quality intelligence; explicitly out of scope for any Run before 011, including UX-03-QA1 which found it). That label is historical: Run 011 has not started and does not own this item. It stays DEFERRED until a started Run's Plan names it.

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

Run 011 start — promote when Run 011 actually starts and its Plan names this item.

---

# FUB-037 — Question Management Workspace (Search/Filter/Pagination/Review Queue)

**Status:** `DEFERRED`
**Area:** Instructor Question Management (`src/app/instructor/courses/[courseId]/page.tsx`, `question-row.tsx`)

Status qualifier (moved from the Status line, verbatim): RECORDED — owned by Run 011. That label is historical: Run 011 has not started and does not own this item; promote when a started Run's Plan names it.

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

**Status:** `DEFERRED`
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

# FUB-042 — FUB-036 Option 4 Remaining Cleanup (Optional H.4 Scope, Declined For Now)

**Status:** `DEFERRED` (item 1 closed 2026-10-03; item 7(c) closed 2026-10-04; items 2-3, 5-6, 7(a)/(b) remain, item 4 moved to OQ-047)
**Area:** Course Membership / Authorization (ADR-015), Instructor Insights

Deliberately not part of Run 010. FUB-036 (Author-Can-Learn-Own-Course, Option 4 architecture; full text archived) is
functionally complete and RESOLVED through RUN010-H.3 (`12d5c51`) — Migration B, the author self-enrollment bypass, and
`revokeCourseAuthor` with last-author protection are implemented, tested, and reviewed with no blocking findings. RUN010-H.4
was optional by the Run's own plan, and the human explicitly declined it for now (2026-09-29) so the remaining cleanup is
preserved here rather than expanding Run010-H further. None of these items blocks or affects current correctness.

1. **CLOSED 2026-10-03 (post-Run010 Product Fix, `eeeaaa5`): `revokeCourseAuthor` last-author concurrency hardening.**
   It now runs inside `CourseUnitOfWork`: it locks the Course's active `course_authors` rows `FOR UPDATE` ordered by id,
   counts under the lock, then revokes; still not wired to any route. Evidence limit: PGlite is single-connection, so tests
   prove the SQL, sequential last-author protection and rollback only; true multi-connection serialization is now proven by the opt-in real-PostgreSQL test
   (item 7(c), 2026-10-04). Details: archive.
2. **Insights CTE cleanup / polish** — the original H.4 scope item (no new exclusion logic implied or
   required; purely a code-quality/readability pass over the Insights aggregation queries, if one is ever
   warranted).
3. **New co-author-management UI** — explicitly out of scope for every H.1-H.4 phase by FUB-036's own
   recorded decision; `revokeCourseAuthor` currently has no caller anywhere in `src/app`. A future Slice
   would need to design this UI, and have the re-grant semantics of `docs/OPEN_QUESTIONS.md`
   OQ-047 decided before wiring `revokeCourseAuthor` or any grant path to a route.
4. **MOVED to `docs/OPEN_QUESTIONS.md` OQ-047** (author re-grant after revoke; a lifecycle decision, not technical debt). The
   number is kept so existing references stay valid. It is NOT the same problem as learner revoke/rejoin (OQ-043).
5. **`course_authors` has no `archivedAt` (accepted narrowing, from FUB-036 H.2; recorded in the archived FUB-036 text).**
   An archived-but-not-revoked management row is now authorized (the old `canAuthorCourse` blocked it); no known V1 path
   archives an OWNER/INSTRUCTOR row. Related: `archive-course-membership.ts` has no role restriction and is unwired
   (self-service on the actor's own membership; `course_memberships` is LEARNER-only after H.3, so it cannot address
   `course_authors` grants). The original review note asked for an explicit decision before that use case is ever wired to a
   route; whether that note still applies after H.3 has not been re-determined here.
6. **Stale post-cutover doc/dead-parameter cleanup (from FUB-036 H.2 notes 2-6, cosmetic):** `CourseAuthorRepository`
   module comment ("not called from any application code"); doc comments in `domain/topic/types.ts`,
   `domain/insights/analysis-entry.ts`, `handle-set-course-join-policy.ts` still naming `canAuthorCourse` or a
   vanished authorization asymmetry; unused `memberships` parameter on `checkAnalysisAccess`; `CourseUnitOfWork`
   port comment still says `createCourse` writes a `course_memberships` row. (H.3 note: dropping the CHECK by
   its default name follows repo convention; no action.)
7. **Residuals of the item 1 hardening (non-blocking, from the `eeeaaa5` review; none affects the last-author invariant):**
   (a) the `revoke()` SQL lacks an `and revoked_at is null` guard (unreachable today because the locked list holds only
   active rows): cosmetic, no defect found, kept deferred (the port documents an unconditional UPDATE; tie to OQ-043 C);
   (b) the actor-authorization check runs before the lock, leaving a stale-snapshot window (observed 2026-10-04 as N3: A
   authorized, B revokes A, A still completes; last-author invariant holds). **HUMAN DECISION:** may a mid-flight-revoked
   author still complete a revoke? Decide before `revokeCourseAuthor` is wired to a route (kept here, not a new OQ: no
   behavior ships until it is wired, and it shares the OQ-047 gate; a strict fix derives actor authorization from the locked
   rows); (c) **CLOSED 2026-10-04 (PILOT-HARDENING-EVIDENCE-001 Slice C, `1c534df`/`8409881`):** opt-in real-PostgreSQL
   two-connection test (`npm run test:real-pg`, `UNLOCK_REAL_PG_URL`, localhost only) 14/14: N1 last-author invariant proven, N2
   no corruption, N3 as above. Evidence: `docs/RUNS/2026-10-04-PILOT-HARDENING-EVIDENCE-001-C-revoke-concurrency.md`.

## Promotion Trigger

Item 3 requires OQ-047 to be settled first; item 7(b) (HUMAN DECISION) must be settled before `revokeCourseAuthor` is wired to a
route. Items 2, 5-6 and 7(a) have no forcing trigger;
pick up opportunistically or when co-author management becomes a real product need (likely Run011+).

---

# FUB-044 — Pilot UX / Readiness Follow-Up Candidates and Expired-Session Recovery Gaps

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Pilot UX / readiness

Preserved (not copied) in `docs/RUNS/2026-09-26-SLICE-B-PILOT-READINESS-VERIFICATION.md`. Candidates for a later
Pilot UX / Readiness decision; none required by any verdict, nothing applied:

* Hebrew `not-found`/`error` boundaries; `role="status"`/focus management on Today feedback; four basic response
  headers via `headers()`; CSP only as Report-Only on Preview if a trigger appears; a CI build step (see FUB-007).
* Three confirmed, low-severity expired-session recovery UX gaps: (a) 401 sign-in links lack `next` (re-login lands
  on `/today`); (b) instructor save/publish has no 401 branch (generic "failed" message); (c) a 401 during an
  Answer drops the learner's selection with no "not saved" message.

Open human gates from that verification (Q2-B, Q3-Q5, Q6a framing) are owned by `docs/PILOT_READINESS.md`, not here.

## Promotion Trigger

A Pilot UX / Readiness Run, or observed pilot friction on any of the recovery gaps.

---

# FUB-045 — ARCHIVED Course: Author vs Non-Author Active-Membership Join Asymmetry

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Course join (`src/application/course`), Course lifecycle

Residual of the OQ-045 decision (Option B, `9a19b05`, 2026-10-03; ARCHIVED hard-stops NEW learner enrollment including an
active Course Author). On an ARCHIVED Course, an author with an existing ACTIVE LEARNER membership gets `ALREADY_MEMBER`
(idempotent) while a non-author with an active membership gets `NOT_AUTHORIZED`; the non-author behavior was deliberately
left unchanged. Both are non-enrolling and expose nothing new. Revisit only if a consistent outcome for existing active
members on ARCHIVED Courses is wanted; any change to the non-author outcome is a product decision (open an OQ then).

## Promotion Trigger

Next change to Course join outcomes or ARCHIVED-Course handling (F-04b).

---

# FUB-047 — Backup/DR V1 Tooling Non-Blocking Review Residuals

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Backup/DR tooling (`scripts/backup-*.mjs`, `scripts/restore-local-backup.mjs`), `docs/BACKUP_DR_POLICY.md`

Non-blocking residuals from the two independent reviews of BACKUP-DR-V1-IMPLEMENTATION-001 (none changes the approved policy):
- Re-read relationship counts after the dump (false-FAIL on a live source); distinct reason code `migration-recheck-missing` for old manifests.
- S5 compare: relkind r/p only, and require manifest `after` keys == `before` keys. Sequence value sanity; extension version drift diff; role attribute/membership fidelity.
- README/runbook: PG* credentials live in container Config.Env (visible to `docker inspect` while the container runs); consider `--env-file`/pgpass. Optional `--cap-add` minimization.
- Optional host-guard denies (`.localdomain`, `2002::/16`, `2001:db8::/32`).
- Document the volatile-table window trade-off; an unencrypted package's manifest is unauthenticated (optional HMAC; encrypted packages already bind it).
- Run the `--user`/mode-bit branches on Linux/macOS.
- Passphrase/scrypt key mode; monthly-selection helper; automation of the daily backup (no hosted automation, cloud job or scheduled task exists).

## Promotion Trigger

The first real hosted V1 backup has occurred (2026-10-04; FULL drill, no false FAIL observed, so the hosted-privilege and pooler-behavior unknowns for the `postgres` role are now proven for that backup). Remaining trigger: the next change to the backup tooling, or a false FAIL on a live source. The residuals above are otherwise unchanged.

---

# FUB-048 — Offline Custody of the Backup Encryption Key

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Backup/DR operations (`docs/BACKUP_DR_POLICY.md` key custody)

The Production V1 backup key (key_id `3a27b9203ec29ddb`, non-secret) exists locally and as a separate copy in OneDrive; it is not stored with the encrypted off-device backup. Desired hardening: true offline/separate custody (e.g. an encrypted USB drive) so that loss or compromise of one cloud account does not take both the key and a backup. Non-blocking operational hardening; policy already requires only that the key is not stored beside the backup. No deadline or cadence is set. Key loss makes every backup encrypted with it unrecoverable.

## Promotion Trigger

Owner decision, or the next key rotation / change of off-device storage.

---

# FUB-049 — Require Recovery-Specific State for the Password-Reset UI

**Status:** `DEFERRED`
**Priority:** `LOW`
**Area:** Auth (`src/lib/password-recovery.ts` `hasRecoverySession`, `src/app/login/page.tsx`)

## Observation

`hasRecoverySession` proves only that some authenticated session exists. An already-authenticated user who manually opens `/login?mode=recovery` (no recovery link) can see the password-update form. Security review 2026-10-05: LOW, not a regression (that user can already call `updateUser` on their own session); non-blocking for the Pilot.

## Follow-Up Investigation

Show the recovery UI only with recovery-specific evidence, e.g. the `PASSWORD_RECOVERY` auth event/state, evidence of a recovery code exchange, or another repository-supported recovery-specific signal. Not chosen yet.

## Do Not Do Yet

Do not weaken the same-origin/PKCE flow and do not invent custom token storage.

## Promotion Trigger

Next Auth-hardening pass, or a real issue caused by recovery/session UX.

---

# Closed items (moved to archive)

These items are closed; full text lives in `docs/archive/FOLLOW_UP_BACKLOG_CLOSED.md`. IDs are never reused.

| ID | Title | Outcome |
| --- | --- | --- |
| FUB-005 | Structured Import Source Size/Row Limits | closed — `RESOLVED`, see archive |
| FUB-012 | Legacy TodaySession Retirement Investigation | closed — `RESOLVED`, see archive |
| FUB-027 | Signup Confirmation Redirect / Join-Intent Preservation | closed — `HOSTED + MANUAL VERIFIED`, see archive |
| FUB-028 | Item Analysis Discoverability | closed — `RESOLVED`, see archive |
| FUB-030 | Course/Topic Practice (UX-3) | closed — `DONE` in Run UX-02 (ADR-020, `LEARNING_ENGINE` §39A), see archive |
| FUB-036 | Author-Can-Learn-Own-Course (Single-Role Membership) | closed — `RESOLVED` (Option 4, RUN010-H.1-H.3; `docs/RUNS/2026-09-28-RUN-010-LEARNING-INTELLIGENCE.md`); residue carried in FUB-042, see archive |
| FUB-025 | Answer Submission Idempotency vs. Server-Generated `answeredAt` | closed — `RESOLVED` AS A BACKLOG ITEM; canonical ownership moved. The underlying decision is NOT resolved and now lives in OQ-048; see archive |
| FUB-039 | Same-Day Reinforcement Freeze Can Delay a New Card's FSRS Graduation | closed — `RESOLVED`: the original audit question is resolved (the freeze is intentional); the residual FSRS-calibration interaction remains open in OQ-044; see archive |
| FUB-040 | RUN010-E Residual Gaps: Cross-Course Topic Diversity, Unmapped OQ-018 Reason Categories | closed — `RESOLVED` AS A BACKLOG ITEM; canonical ownership moved. The underlying decisions are NOT resolved and now live in OQ-017 (item 1) and OQ-018 (items 2-3); see archive |
| FUB-034 | resolved parts only | pre-prune FUB-034 text archived; the open residual remains active (narrowed to the tier-crossing gap) |
| FUB-041 | Practice `practice-vertical.test.ts` `topicId` Failure | closed — `RESOLVED` 2026-10-03 (`a773f90`): stale exact-key test, not a mapping defect; see archive |
| FUB-043 | Exam-Urgency Constant Named `HALF_LIFE` Is an E-Folding Constant | closed — `RESOLVED` 2026-10-03 (`c8f3dc6`): naming/docs only, behavior-neutral; see archive |
| FUB-042 item 1 | `revokeCourseAuthor` last-author concurrency | closed 2026-10-03 (`eeeaaa5`); the item stays listed in FUB-042 with its closure note and residuals (item 7); see archive |
| FUB-046 | Hosted QA Data Cleanup (QA-PREVIEW-A / QA-PREVIEW-B) | closed 2026-10-03: both Courses ARCHIVED (A via product UI); QA data retained as evidence, no hard delete; see archive |

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

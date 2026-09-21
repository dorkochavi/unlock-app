# UNLOCK — Development Status

Status: ACTIVE CURRENT-STATE SNAPSHOT

Purpose: describe what is true about UNLOCK **now**.

This file is not:

* a changelog;
* a Run Report;
* a current execution plan;
* a product specification;
* a decision log;
* a terminal/test diary.

Historical execution belongs in Git and `docs/RUNS/**`.

Current execution belongs in `docs/CHATGPT_PLAN.md`.

Durable decisions belong in `docs/DECISIONS/**`.

Unresolved decisions belong in `docs/OPEN_QUESTIONS.md`.

---

# 1. Repository / Development State

Current product-development branch:

`feature/project-foundation`

Baseline before Development OS V1.2 cleanup:

`0dd28ce51699c55b3e2cde338a4ab92697775552`

Run 006 — Question Authoring & Publishing V1:

**COMPLETE AND PUSHED**

Current active work:

Development OS V1.2:

**COMPLETE — VERIFIED LOCALLY, PENDING COMMIT**

The Development OS V1.2 cleanup completed:

* authority/ownership reconciliation;
* canonical governance cleanup;
* testing/evidence ownership separation;
* Claude operating-kernel compression;
* workflow skill separation;
* reviewer specialization;
* scoped Claude implementation rules;
* operational-document compression;
* Cursor rule reconciliation and scoping;
* repository navigation cleanup;
* final stale-guidance / ownership / frontmatter / workflow verification.

Final V1.2 verification confirmed:

* `git diff --check` has no whitespace errors;
* active `TodaySession` references are legacy/compatibility-only;
* `.cursor/rules/workflow.mdc` is the only Cursor rule with `alwaysApply: true`;
* database, Learning Engine, and RTL Cursor rules are path-scoped;
* other specialist Cursor rules use intelligent relevance loading;
* representative workflow simulations are coherent;
* no Run 007 product implementation has started.

The cleanup is currently present in the local working tree and has not yet been committed.

Next product Run after Development OS V1.2:

**Run 007 — Structured Import**

Run 007 has not started.

A new explicit execution Plan is required before product implementation resumes.

Next product Run after Development OS V1.2:

**Run 007 — Structured Import**

Do not begin Run 007 until the Development OS cleanup reaches its explicit stop condition and a new execution Plan is activated.

---

# 2. Current Product Architecture

UNLOCK is a layered modular monolith.

Primary structure:

```text id="8pqf07"
src/app/
    ↓
src/application/
    ↓
src/domain/

src/infrastructure/
    implements persistence/provider boundaries
```

Current stack includes:

* Next.js App Router;
* TypeScript;
* PostgreSQL;
* Supabase Auth;
* Supabase-hosted PostgreSQL;
* Tailwind CSS;
* Vitest;
* PGlite-backed PostgreSQL/schema integration tests;
* Playwright E2E.

Current learner product is Hebrew-first, RTL-first, mobile-first.

---

# 3. Authentication / User

Implemented:

* Supabase browser/server authentication clients;
* trusted server identity through `supabase.auth.getUser()`;
* `auth.users → public.users` provisioning;
* email/password login and signup;
* safe internal login return paths;
* persisted learner IANA timezone;
* browser timezone detection when no timezone is persisted;
* auth-before-protected-DB ordering on authenticated API paths;
* generic controlled internal-error responses.

Current security baseline:

* authoritative `userId` is not accepted from the client;
* database/service credentials remain server-only;
* protected ownership/authorization is enforced at trusted server/application/database boundaries;
* raw SQL, credentials, stack traces, and internal errors are not returned to clients;
* external/protocol-relative login redirects are rejected.

No new RLS policy should be introduced automatically.

---

# 4. Learner Shell / Navigation

Implemented:

* learner route-group shell;
* mobile bottom navigation;
* Today tab;
* Courses tab;
* active-state highlighting;
* Hebrew/RTL behavior.

Current learner entry points include:

* `/`
* `/login`
* `/today`
* `/join/[courseId]`
* `/courses`
* `/courses/[courseId]`

Pre-authentication entry points remain outside the learner shell where appropriate.

---

# 5. Course / Membership

Implemented:

* Course persistence;
* CourseMembership;
* membership roles:

  * `OWNER`
  * `INSTRUCTOR`
  * `LEARNER`
* join policies:

  * `OPEN`
  * `AUTHORIZED_ONLY`
* Course ownership/management authorization;
* public-safe Course summary lookup;
* OPEN-course self-join;
* idempotent repeat join;
* OWNER/INSTRUCTOR role preservation;
* revoked membership fail-closed behavior;
* authenticated learner Course listing;
* membership-gated Course context.

Only active `LEARNER` memberships automatically participate in DailyPlan generation.

Revoked-membership rejoin behavior remains intentionally unresolved.

---

# 6. Course Lifecycle / Instructor Authoring

Implemented:

Course lifecycle:

* `DRAFT`
* `PUBLISHED`
* `ARCHIVED`

Course metadata includes optional exam date.

Instructor/owner authoring capabilities include:

* create Course;
* edit Course metadata;
* change join policy;
* publish Course;
* archive Course;
* view/manage instructor Courses.

Instructor UI currently exists under:

`/instructor/courses`

and related Course-management routes.

Course lifecycle and authoring authorization are server-enforced according to current accepted behavior.

---

# 7. Topics

Implemented flat V1 Topic model.

Capabilities include:

* create Topic;
* list Topics;
* rename Topic;
* archive Topic;
* same-Course integrity;
* non-leaking cross-Course behavior.

The V1 Topic model is intentionally flat.

No hierarchy, prerequisite graph, or nested-topic model is currently required.

---

# 8. Question Authoring / Publishing

Implemented:

* manual Question draft creation;
* SINGLE_CHOICE;
* MULTIPLE_CHOICE;
* Topic association;
* draft editing;
* publish-readiness validation;
* explicit publish;
* re-publish through a new immutable QuestionVersion;
* atomic publish transaction;
* Course/Topic same-Course enforcement;
* instructor Question editor UI.

Question is the stable logical identity.

QuestionVersion is immutable content history.

Publishing or republishing never rewrites a historical QuestionVersion.

Historical Attempts remain linked to the exact version presented.

Draft-only Questions are excluded from learner eligibility through the existing `current_version_id` contract.

Structured Import is **not yet implemented**.

That is the next product Run.

---

# 9. Learning Evidence / Learning Engine

Implemented:

* immutable Attempts;
* immutable QuestionVersion history;
* persisted correctness;
* deterministic learner-state processing;
* replay/rebuild from historical evidence;
* FSRS-backed memory scheduling;
* retrieval qualification;
* misconception tracking;
* mastery/evidence processing;
* Next Best Action candidate generation;
* deterministic ranking foundation;
* production learning-policy composition.

Historical responses are replayed from persisted Attempt evidence rather than regraded against current Question content.

Real-time learner-state decisions do not depend on an LLM.

Manual Practice remains separate from Today.

---

# 10. DailyPlan / Today

`DailyPlan` / `DailyPlanItem` are the primary current Today model.

Implemented:

* one persisted DailyPlan per learner per learner-local calendar day;
* persisted DailyPlanItems;
* Global Today across eligible Courses;
* active-LEARNER membership filtering;
* deterministic ordering;
* frozen same-day plan behavior;
* exact persisted QuestionVersion identity;
* PostgreSQL repository / Unit-of-Work support;
* learner-facing Today API;
* learner-facing Today UI;
* resume/reload behavior;
* Today completion state.

Global Today and Course context refer to the same underlying DailyPlan.

Legacy `TodaySession` infrastructure remains only where required for compatibility/history.

---

# 11. Today Answer Submission

Implemented:

`POST /api/daily-plan/items/:itemId/answer`

Current behavior includes:

* authenticated ownership enforcement;
* server-derived authoritative:

  * Course;
  * Question;
  * QuestionVersion;
  * DailyPlan;
  * DailyPlanItem;
* server-side correctness evaluation;
* immutable Attempt creation;
* idempotency protection;
* Learning Engine update;
* exact DailyPlanItem completion;
* Manual Practice / Today separation.

Learner-facing read paths do not expose grading-only data before answer submission.

---

# 12. Today Skip

Implemented:

`POST /api/daily-plan/items/:itemId/skip`

Skip:

* resolves the DailyPlanItem;
* creates no Attempt;
* creates no incorrect-answer evidence;
* does not update mastery/misconception/scheduler state;
* creates no replacement item;
* does not reopen already-resolved work.

Skip is resolution, not evidence of incorrect knowledge.

---

# 13. New Material V1

Accepted behavior:

ADR-017.

Implemented:

* unseen = no previous real Attempt for the Question;
* absence of UserQuestionProgress alone does not prove unseen;
* ordinary learning candidates are considered first;
* New Material activates only when ordinary candidates are empty;
* no review + New Material mixing in V1;
* deterministic selection;
* up to the accepted fallback limit;
* placement into Today does not create evidence;
* UserQuestionProgress is not fabricated during planning;
* first actual learner Attempt creates evidence normally.

Persisted DailyPlan vocabulary supports New Material action/tier/reason metadata.

---

# 14. Current Major API Surface

Relevant implemented APIs include:

### Learner / Today

* `GET /api/daily-plan/today`
* `POST /api/daily-plan/items/:itemId/answer`
* `POST /api/daily-plan/items/:itemId/skip`
* `POST /api/user/timezone`

### Course / learner access

* public Course summary lookup;
* Course join;
* My Courses;
* membership-gated Course context.

### Instructor authoring

Implemented APIs exist for:

* Course creation;
* Course metadata;
* Course lifecycle;
* join policy;
* Topic management;
* Question draft management;
* Question publishing.

Exact route contracts belong to implementation/API documentation rather than this snapshot.

---

# 15. Database / Migration State

The committed migration chain currently contains **12 migrations**.

## Applied to hosted Supabase

Migrations #1–#9 are applied through:

`20260925000000_daily_plan_new_material_v1.sql`

This includes the current hosted foundations for:

* initial schema;
* Question answer model;
* CourseMembership;
* learner timezone;
* DailyPlan;
* DailyPlan state consistency;
* Auth user provisioning;
* DailyPlan answer linkage;
* New Material V1.

## Committed and locally verified, not yet applied to hosted Supabase

Migration #10:

`20260926000000_course_lifecycle_v1.sql`

Migration #11:

`20260927000000_topics_v1.sql`

Migration #12:

`20260928000000_question_authoring_v1.sql`

These migrations are committed and verified through the local PostgreSQL-compatible/PGlite migration/schema suite.

They remain pending explicit human hosted application.

Claude must not run:

* `supabase link`;
* `supabase db push`;
* hosted migration application.

---

# 16. Verification Baseline

Last known clean runtime/product verification baseline before the documentation-only Development OS cleanup:

* Unit tests: `911 / 911`
* PostgreSQL/schema PGlite tests: `253 / 253`
* Typecheck: clean
* Lint: clean
* Production build: clean
* `git diff --check`: clean
* final Run 006 reviewer result: approved / no blocking findings

These counts are snapshot information, not permanent acceptance requirements.

Current Development OS edits are documentation/rule/workflow changes and do not by themselves invalidate unrelated product runtime evidence.

Relevant Development OS verification still needs to occur before V1.2 closeout.

---

# 17. Browser / Hosted Verification State

Previously verified against hosted/configured environments where applicable:

* real Auth provisioning;
* real learner login;
* persisted learner timezone;
* authenticated Today retrieval;
* populated Today rendering;
* same-day DailyPlan persistence;
* learner-facing prompt/options;
* learner-local planned date;
* protected-route auth-before-DB behavior;
* Today answer submission;
* Today completion;
* AUTHORIZED_ONLY self-join fail-closed;
* OPEN Course self-join;
* malformed/nonexistent join-link browser behavior.

Still not fully exercised in the hosted environment:

* hosted Today Skip;
* hosted New Material fallback;
* full login → join → Today → answer → completion golden-path Playwright flow.

The golden-path E2E harness exists but requires a safe real fixture strategy.

Do not manufacture hosted users/Courses automatically.

---

# 18. Known Current Limitations

Known non-blocking limitations include:

* production deployment is not yet complete;
* final learner-facing demo/visual polish remains;
* hosted Skip and New Material manual QA remain;
* full golden-path browser E2E remains unexecuted;
* revoked CourseMembership rejoin semantics remain unresolved;
* true multi-backend PostgreSQL concurrency is not fully proven by PGlite;
* concurrent publish of the same Question is fail-safe through DB uniqueness but currently returns generic internal failure to the losing request;
* archived-Course draft create/update follows the currently accepted V1 boundary and is not fully server-blocked until publication;
* Structured Import is not yet implemented.

These limitations do not automatically become current execution tasks.

Current execution is defined only by `docs/CHATGPT_PLAN.md`.

---

# 19. Current Explicit Non-Capabilities

Not currently implemented as product behavior:

* mid-day automatic reranking of an existing frozen DailyPlan;
* automatic carry-over of unresolved Today items;
* per-Course fairness quotas;
* mixing ordinary review candidates and New Material in V1;
* deep Knowledge Graph;
* autonomous learning coach;
* advanced institutional multi-tenancy;
* native mobile applications.

Do not infer these capabilities from architecture-ready language.

---

# 20. Current Development OS State

Development OS V1.2 is complete and locally verified.

Current ownership model:

- `AGENTS.md` — tool-agnostic repository baseline;
- `CLAUDE.md` — Claude operating kernel;
- `docs/CHATGPT_PLAN.md` — current execution;
- `docs/DEV_STATUS.md` — current durable snapshot;
- `docs/CONTEXT_MAP.md` — navigation/GPS;
- `docs/TESTING.md` — testing philosophy;
- `.claude/rules/testing.md` — operational verification and evidence freshness;
- `/implement-slice` — Slice orchestration;
- `/review-commit` — reviewer selection/orchestration;
- `/checkpoint` — evidence/state validation;
- `.cursor/rules/**` — thin Cursor-specific projections.
Development OS telemetry is now installed and locally smoke-tested.

Telemetry ownership:

* `docs/RUN_TELEMETRY.md` — canonical measurement policy;
* `.claude/telemetry/**` — local collection and deterministic summarization;
* `.claude/settings.json` — Claude Code hook/status-line wiring;
* `docs/RUNS/RUN_TEMPLATE.md` — durable Run telemetry reporting shape.

Raw telemetry remains local under `scratch/telemetry/**` and must not be committed.

Development OS V1.2 itself is not treated as a valid telemetry baseline because instrumentation was added only near the end of the Run.

Run 007 is intended to be the first fully instrumented baseline Run.

Cursor loading model:

- `workflow.mdc` — always active;
- database / Learning Engine / RTL-i18n — path-scoped;
- architecture / coding / security / product / AI — intelligent relevance loading.

Current repository state:

- V1.2 cleanup exists locally in the working tree;
- no commit has yet been created for the cleanup;
- no push has occurred;
- product development remains stopped before Run 007.

---

# 21. Current Blockers

No known blocker to committing Development OS V1.2.

No known product-code blocker.

Run 007 must not begin until:

1. the Development OS V1.2 changes are deliberately committed;
2. repository state is clean/understood;
3. a new explicit Run 007 execution Plan is activated.

Hosted migrations #10–#12 remain pending human application and are separate from the Development OS closeout.

---

# 22. Manual Actions Still Required

Current human-controlled actions include:

1. apply migrations #10–#12 to hosted Supabase when explicitly ready;
2. manually exercise hosted Today Skip;
3. manually exercise hosted New Material fallback;
4. decide/provide a safe fixture strategy for full golden-path Playwright E2E;
5. complete production deployment when pilot readiness reaches that stage;
6. push Development OS commits only after the cleanup has been reviewed and deliberately committed.

Do not perform remote mutations automatically.

---

# 23. Current Documentation Ownership

Use:

* `AGENTS.md`

  * tool-agnostic repository baseline

* `CLAUDE.md`

  * Claude operating kernel

* `docs/CHATGPT_PLAN.md`

  * current execution

* `docs/DEV_STATUS.md`

  * current durable state

* `docs/CONTEXT_MAP.md`

  * task/document/code GPS

* `docs/MASTER_SPEC.md`

  * product constitution

* `docs/PRODUCT.md`

  * practical product map

* `docs/UNLOCK_V1_SCOPE.md`

  * V1 destination

* `docs/UNLOCK_ROADMAP.md`

  * product sequencing

* `docs/DECISIONS/**`

  * accepted durable decisions

* `docs/OPEN_QUESTIONS.md`

  * unresolved decisions

* `docs/FOLLOW_UP_BACKLOG.md`

  * deferred technical follow-ups

* `docs/RUNS/**`

  * historical execution archive

* `scratch/development_checkpoint.md`

  * temporary local resume state

Historical Run Reports and the historical Invariant Matrix are not default working context.

---

# 24. Immediate State

Development OS V1.2:

**COMPLETE — VERIFIED LOCALLY, PENDING COMMIT**

Current product implementation:

**PAUSED**

Next product capability:

**Run 007 — Structured Import**

Run 007:

**NOT STARTED**

Immediate next action:

**Create the deliberate Development OS V1.2 commit(s), inspect final Git state, then stop.**

Do not begin product implementation from this snapshot.
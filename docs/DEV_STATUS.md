# UNLOCK — Development Status

Status: CURRENT SNAPSHOT
Updated: 2026-09-21

## Repository

- Branch: `feature/project-foundation`
- Last confirmed remote baseline before the V1.2 closure reconciliation: `ef7497c`
- Dor manually pushed that baseline to `origin/feature/project-foundation`.
- Product/runtime code is unchanged by the Development OS V1.2 cleanup snapshot.
- Hosted/remote mutation remains human-controlled.

## Product Direction

UNLOCK is a Hebrew-first, RTL-first, mobile-first adaptive learning application.
Its core differentiator is a longitudinal learner model that determines the next best learning action.

Pilot target: Ruppin Academic Center.

Primary learner navigation direction:
- Today
- Progress
- Courses

Primary instructor navigation direction:
- Courses
- Students
- Insights

## Current Product Capabilities

Current repository capabilities include:
- authentication and authenticated API boundaries;
- Course + CourseMembership with `OWNER`, `INSTRUCTOR`, `LEARNER` roles;
- OPEN / AUTHORIZED_ONLY join behavior;
- Course lifecycle (`DRAFT`, `PUBLISHED`, `ARCHIVED`);
- flat Course-scoped Topics;
- SINGLE_CHOICE / MULTIPLE_CHOICE Question authoring;
- draft save/edit;
- explicit publish/re-publish;
- immutable QuestionVersion history;
- immutable historical Attempts;
- UserQuestionProgress / learner-state foundations;
- FSRS-backed memory scheduling;
- mastery/evidence/misconception handling;
- persisted DailyPlan / DailyPlanItems;
- Today answer + Skip behavior;
- New Material fallback V1;
- learner shell / My Courses / Course View;
- Playwright E2E harness.

## DailyPlan / Today

Current accepted behavior is governed by ADR-016/017.

Key current truths:
- one persisted DailyPlan per learner-local calendar day;
- global Today and Course Today are views over the same plan;
- plan normally freezes after generation for the day;
- no automatic carry-over;
- Manual Practice does not resolve Today items;
- Skip resolves the plan item without creating Attempt/mastery/misconception evidence;
- New Material is deterministic fallback-only in V1;
- only active LEARNER memberships auto-participate.

## Question Authoring / Publishing

Run 006 delivered:
- draft persistence and Topic association;
- authoritative publish-ready validation;
- manual authoring APIs/UI;
- transaction-backed first publish and re-publish;
- immutable QuestionVersions;
- historical Attempt preservation;
- draft-only learner exclusion;
- archived Course publish guard.

Accepted V1 limitation:
- concurrent publish to the same Question is not lock-serialized;
- unique `(question_id, version_number)` prevents corruption;
- one racing request may receive generic INTERNAL_ERROR.

## Database / Supabase

Supabase project:
- name: UNLOCK
- ref: `luinowttujolknxsduug`
- region: Central EU / Frankfurt

Hosted migrations are confirmed through:
- `20260925000000_daily_plan_new_material_v1`

Committed/local-PGlite verified but not confirmed hosted at the last durable product baseline:
- `20260926000000_course_lifecycle_v1.sql`
- `20260927000000_topics_v1.sql`
- `20260928000000_question_authoring_v1.sql`

Do not infer hosted application from local migration existence.
Claude must not run `supabase link` or `supabase db push`.

## Verification Baseline

Run 006 final product verification recorded:
- unit: 911
- schema: 253
- typecheck: clean
- lint: clean
- production build: clean
- diff check: clean
- final review: no blockers

These are historical evidence for the Run 006 code baseline, not a claim that later product changes have been tested.

## Development OS V1.2

V1.2 direction is established:
- one owner per operational responsibility;
- testing rule owns verification selection/freshness;
- `review-commit` owns reviewer selection;
- `checkpoint` validates evidence/state;
- review precedes final relevant verification;
- Run-end acceptance reuses fresh Slice evidence;
- historical Runs are restricted context;
- Follow-Up Backlog captures useful deferred work;
- Cursor rules are tool-specific projections;
- telemetry is a COLD observability layer.

The Development OS V1.2 Final Compression Patch is complete in this repository snapshot. It reduces remaining context duplication without changing those policies or product/runtime behavior.

## Development OS Safety

Current hard Claude denies include:
- `git push*`;
- destructive Git reset/clean/restore patterns;
- destructive filesystem deletion patterns;
- `supabase link*`;
- `supabase db push*`.

Remote Git push and hosted database mutation remain manual/user-controlled actions.

## Known Limitations / Gaps

Product roadmap remains:
- Run 007 — Structured Import (PLANNED, implementation not started)
- Run 008 — Authoring Integration + Pilot Readiness
- Run 009 — Learner Progress + Instructor Insights
- Run 010 — Learning Intelligence
- Run 011 — PDF/AI
- Run 012 — Production / Scale

Run 007 — Structured Import V1 is planned in `docs/CHATGPT_PLAN.md`
(6 Slices, S1-S6). No Slice implementation has started; no dependency has
been added; no `src/**` file has changed.

Known deferred maintainability work lives in `docs/FOLLOW_UP_BACKLOG.md`.

## Current Manual Actions

For Run 007:
- begin S1 (Canonical Import Contract + JSON/CSV Adapters) per
  `docs/CHATGPT_PLAN.md` when ready to start implementation.

For hosted Supabase:
- pending migration application remains a separate manual action when product work requires it.

## Blockers

No known product blocker is introduced by the Development OS compression work.

Current execution source:
- `docs/CHATGPT_PLAN.md`

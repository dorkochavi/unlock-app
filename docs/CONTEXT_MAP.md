# UNLOCK — Context Map

Status: ACTIVE GPS

Purpose: identify the **smallest authoritative context** for a task. This file points to truth; it does not restate it.

## Load Levels

- **HOT:** normal Run/session startup.
- **WARM:** load when the task needs it.
- **COLD:** specific technical/decision reference only.
- **RESTRICTED:** historical/archive material; never normal working context.

## Core Operational Map

| Need | Authority | Load |
|---|---|---|
| How Claude works | `CLAUDE.md` | HOT |
| What is being executed now | `docs/CHATGPT_PLAN.md` | HOT |
| What is true now | `docs/DEV_STATUS.md` | HOT |
| Where context lives | `docs/CONTEXT_MAP.md` | WARM |
| Broad product constitution | `docs/MASTER_SPEC.md` | COLD |
| Unresolved decisions | `docs/OPEN_QUESTIONS.md` | WARM |
| Deferred useful work | `docs/FOLLOW_UP_BACKLOG.md` | COLD |
| Real-pilot gate (Content/Technical status, remaining checklist, rehearsal protocol) | `docs/PILOT_READINESS.md` | COLD |
| Historical execution | Git + `docs/RUNS/**` | RESTRICTED |
| Temporary resume state | `scratch/development_checkpoint.md` | LOCAL/COLD |
| How to interpret telemetry/context-cost signals | `docs/DEVOS_OBSERVABILITY.md` | COLD |

## Task → Smallest Context

| Task | Decision / Canonical Docs | Scoped Rule | Primary Code / Evidence |
|---|---|---|---|
| Product/V1 scope | `UNLOCK_V1_SCOPE.md`, `MASTER_SPEC.md`, relevant ADR | — | relevant source/tests |
| Roadmap / sequencing | `UNLOCK_ROADMAP.md` | — | current Plan |
| Course access / membership | ADR-015, `DATABASE.md` | `auth.md`, `api.md` | Course membership app/API/tests |
| DailyPlan / Today | ADR-016, ADR-017, `PRODUCT.md` | `learning-engine.md` | dailyPlan application/domain/tests |
| Learning Engine | `LEARNING_ENGINE.md`, relevant ADRs | `learning-engine.md` | `src/domain/learning/**`, tests |
| Question authoring/versioning | ADR-009, `DATABASE.md` | `api.md`, `postgres.md` as needed | question app/infra/tests |
| PostgreSQL / migration | migrations, `DATABASE.md`, `PERSISTENCE_SCHEMA_V1.md` | `postgres.md`, `testing.md` | infra + schema/PGlite tests |
| Auth / trust boundary | ADR-015 + current security baseline | `auth.md`, `api.md` | protected routes/auth tests |
| API route work | relevant product/ADR | `api.md`, `auth.md`, `testing.md` | route + application tests |
| Testing strategy | `docs/TESTING.md` | `testing.md` | package scripts + relevant tests |
| Slice implementation | current Plan | `implement-slice` | current diff |
| Review selection | current Slice risk | `review-commit` | reviewer agent(s) |
| DB review | relevant DB change | `postgres.md` | `unlock-db-reviewer` |
| Security review | relevant trust change | `auth.md`, `api.md` | `unlock-security-reviewer` |
| Evidence/readiness | current Slice | `testing.md`, `checkpoint` | fresh evidence + Git diff |
| Cursor coding | `AGENTS.md` + task owner | relevant `.cursor/rules/*.mdc` | current files |
| Telemetry analysis | `RUN_TELEMETRY.md` | — | `.claude/telemetry/**`, scratch telemetry |

## Canonical Product / Architecture References

Load only when the task requires them:
- `docs/PRODUCT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATABASE.md`
- `docs/DOMAIN_GLOSSARY.md`
- `docs/UNLOCK_V1_SCOPE.md`
- `docs/UNLOCK_ROADMAP.md`
- `docs/PERSISTENCE_SCHEMA_V1.md`
- `docs/LEARNING_ENGINE.md`
- `docs/GOLDEN_SCENARIOS.md`
- `docs/DEFINITION_OF_DONE.md`

## ADRs

`docs/DECISIONS/**` are durable accepted decisions.
Load the specific ADR needed by the task rather than the whole directory.

High-frequency current ADRs include:
- ADR-009 — QuestionVersion
- ADR-010 — Answer submission transaction model
- ADR-015 — CourseMembership / join authorization
- ADR-016 — Global DailyPlan / Today semantics
- ADR-017 — Starter New Material V1
- ADR-018 — Topic Model V1

## Scoped Claude Owners

| Area | Owner |
|---|---|
| Verification/freshness | `.claude/rules/testing.md` |
| PostgreSQL/migrations | `.claude/rules/postgres.md` |
| Auth/security | `.claude/rules/auth.md` |
| API boundary | `.claude/rules/api.md` |
| Learning/DailyPlan guardrails | `.claude/rules/learning-engine.md` |
| Slice orchestration | `.claude/skills/implement-slice/SKILL.md` |
| Reviewer orchestration | `.claude/skills/review-commit/SKILL.md` |
| Evidence gate | `.claude/skills/checkpoint/SKILL.md` |

## Historical / Restricted Material

Do not load by default:
- `docs/RUNS/**`
- `docs/GLOBAL_TODAY_*`
- old drafts such as `COURSE_ACCESS_MODEL_DRAFT.md`
- old roadmap/vertical-slice planning artifacts
- historical audit/review reports
- `scratch/**` history

Use them only for an explicit historical question or when current canonical sources point to them.

## Local / Generated — Not Project Knowledge

Do not treat as canonical context:
- `.env.local`
- `supabase/.temp/**`
- `test-results/**`
- `tsconfig.tsbuildinfo`
- telemetry output under `scratch/**`
- build/cache artifacts

Never reproduce secret values.

## Rule of Thumb

Start with:
1. current Plan;
2. current `DEV_STATUS`;
3. the one canonical decision/reference for the task;
4. the relevant scoped rule;
5. the exact implementation/tests.

Stop loading context when that set is sufficient.
